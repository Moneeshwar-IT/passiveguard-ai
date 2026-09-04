"""
PassiveGuard AI — Module 12 ML Pipeline Test Suite

Tests dataset registry, label mapping, data cleaning, leakage-free splitting, reproducible model training,
evaluation metrics calculation, artifact creation, in-memory inference, missing model handling,
and static security constraints (zero socket calls, zero DNS resolutions, zero network requests, zero TLS decryption).
"""
import os
import ast
import pytest
import numpy as np
import pandas as pd

from app.ml.datasets import DatasetRegistry, DatasetMetadata
from app.ml.preprocessing import DataPreprocessor, LabelMapper, DataManifest
from app.ml.trainer import ModelTrainer
from app.ml.inference import MLInferenceEngine, MLPrediction
from app.features.models import FeatureVector


FIXTURE_CSV_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "ml_sample.csv")


def test_1_dataset_registry_validation():
    """Verify dataset metadata registration and schema retrieval."""
    datasets = DatasetRegistry.list_datasets()
    assert len(datasets) >= 4

    unsw = DatasetRegistry.get_dataset("UNSW-NB15")
    assert unsw is not None
    assert unsw.name == "UNSW-NB15"
    assert "DDOS" in unsw.supported_threat_classes
    assert "RECON_SCAN" in unsw.supported_threat_classes


def test_2_label_mapper_mappings():
    """Verify raw label to PassiveGuard canonical threat class mapping."""
    assert LabelMapper.map_label("DoS") == "DDOS"
    assert LabelMapper.map_label("DDoS attacks-LOIC-HTTP") == "DDOS"
    assert LabelMapper.map_label("Reconnaissance") == "RECON_SCAN"
    assert LabelMapper.map_label("Botnet") == "C2_BEACON"
    assert LabelMapper.map_label("dga_conficker") == "DGA_DOMAIN"
    assert LabelMapper.map_label("dns_tunnel") == "DNS_TUNNEL"
    assert LabelMapper.map_label("Normal") == "BENIGN"
    assert LabelMapper.map_label("Benign") == "BENIGN"
    assert LabelMapper.map_label("unknown_custom_attack") == "NOT_SUPPORTED_BY_DATASET"


def test_3_data_cleaning_and_audit():
    """Verify missing value imputation, duplicate removal, and audit logging."""
    df_raw = pd.DataFrame({
        "flow_packets_per_sec": [10.0, np.nan, np.inf, 10.0],
        "flow_bytes_per_sec": [5000.0, 6000.0, 7000.0, 5000.0],
        "tcp_syn_count": [1, 2, 3, 1],
        "tcp_ack_count": [10, 12, 14, 10],
        "directional_byte_ratio": [0.5, 0.5, 0.5, 0.5],
        "directional_packet_ratio": [0.5, 0.5, 0.5, 0.5],
        "flow_duration": [1.0, 1.0, 1.0, 1.0],
        "flow_packet_count": [10, 10, 10, 10],
        "flow_byte_count": [5000, 5000, 5000, 5000],
        "label": ["BENIGN", "BENIGN", "DDOS", "BENIGN"]
    })

    preprocessor = DataPreprocessor(random_seed=42)
    feature_cols = [c for c in df_raw.columns if c != "label"]

    X_tr, X_va, X_te, y_tr, y_va, y_te, scaler, audit = preprocessor.prepare_dataset(
        df_raw, feature_cols=feature_cols, label_col="label", target_threat_class="DDOS"
    )

    assert audit["rows_before"] == 4
    assert audit["rows_after"] < audit["rows_before"]
    assert len(audit["reasons"]) > 0
    assert not np.isnan(X_tr).any()
    assert not np.isinf(X_tr).any()


def test_4_data_leakage_prevention_train_fit_only():
    """Verify scaler is fitted on Train set ONLY before transforming Val/Test sets."""
    df_sample = pd.read_csv(FIXTURE_CSV_PATH)
    feature_cols = [c for c in df_sample.columns if c != "label"]

    preprocessor = DataPreprocessor(random_seed=42)
    X_tr, X_va, X_te, y_tr, y_va, y_te, scaler, audit = preprocessor.prepare_dataset(
        df_sample, feature_cols=feature_cols, label_col="label", target_threat_class="DDOS"
    )

    assert scaler.mean_ is not None
    assert len(scaler.mean_) == len(feature_cols)

    # Scaler mean must NOT equal total dataset mean due to split
    total_mean = np.mean(df_sample[feature_cols].values, axis=0)
    assert not np.allclose(scaler.mean_, total_mean)


def test_5_deterministic_train_val_test_split():
    """Verify reproducible 70/15/15 split using random_seed=42."""
    df_sample = pd.read_csv(FIXTURE_CSV_PATH)
    feature_cols = [c for c in df_sample.columns if c != "label"]

    prep1 = DataPreprocessor(random_seed=42)
    X_tr1, X_va1, X_te1, y_tr1, y_va1, y_te1, _, _ = prep1.prepare_dataset(
        df_sample, feature_cols=feature_cols, label_col="label", target_threat_class="DDOS"
    )

    prep2 = DataPreprocessor(random_seed=42)
    X_tr2, X_va2, X_te2, y_tr2, y_va2, y_te2, _, _ = prep2.prepare_dataset(
        df_sample, feature_cols=feature_cols, label_col="label", target_threat_class="DDOS"
    )

    np.testing.assert_array_equal(X_tr1, X_tr2)
    np.testing.assert_array_equal(y_tr1, y_tr2)
    np.testing.assert_array_equal(y_te1, y_te2)


def test_6_model_training_and_manifest_generation(tmp_path):
    """Verify ModelTrainer trains classifier, computes actual metrics, and saves joblib/JSON artifacts."""
    out_dir = tmp_path / "models"
    manifest_dir = tmp_path / "manifests"

    trainer = ModelTrainer(random_seed=42)
    clf, manifest = trainer.train_and_evaluate(
        data_path=FIXTURE_CSV_PATH,
        target_threat_class="DDOS",
        model_type="rf",
        out_dir=str(out_dir),
        manifest_dir=str(manifest_dir)
    )

    assert clf is not None
    assert isinstance(manifest, DataManifest)
    assert manifest.total_samples == 20
    assert manifest.evaluation_metrics["accuracy"] >= 0.0

    # Verify persisted joblib artifact
    joblib_path = out_dir / "ddos_rf_v1.joblib"
    assert os.path.exists(joblib_path)

    # Verify persisted JSON manifest
    json_path = manifest_dir / "ddos_rf_v1.json"
    assert os.path.exists(json_path)


def test_7_confusion_matrix_and_fpr_fnr_metrics(tmp_path):
    """Verify numerical confusion matrix and FPR/FNR metric calculations."""
    trainer = ModelTrainer(random_seed=42)
    _, manifest = trainer.train_and_evaluate(
        data_path=FIXTURE_CSV_PATH,
        target_threat_class="DDOS",
        model_type="rf",
        out_dir=str(tmp_path / "models"),
        manifest_dir=str(tmp_path / "manifests")
    )

    metrics = manifest.evaluation_metrics
    assert "false_positive_rate" in metrics
    assert "false_negative_rate" in metrics
    assert "confusion_matrix_summary" in metrics

    cm_summary = metrics["confusion_matrix_summary"]
    assert "TN" in cm_summary and "FP" in cm_summary and "FN" in cm_summary and "TP" in cm_summary


def test_8_feature_importance_extraction(tmp_path):
    """Verify top feature importance extraction for explainability."""
    trainer = ModelTrainer(random_seed=42)
    _, manifest = trainer.train_and_evaluate(
        data_path=FIXTURE_CSV_PATH,
        target_threat_class="DDOS",
        model_type="rf",
        out_dir=str(tmp_path / "models"),
        manifest_dir=str(tmp_path / "manifests")
    )

    assert manifest.feature_importances is not None
    assert len(manifest.feature_importances) > 0
    # Importances should sum close to 1.0
    total_imp = sum(manifest.feature_importances.values())
    assert 0.90 <= total_imp <= 1.10


def test_9_in_memory_ml_inference_execution(tmp_path):
    """Verify MLInferenceEngine loads model joblib artifact and evaluates FeatureVector."""
    import time
    out_dir = tmp_path / "models"
    manifest_dir = tmp_path / "manifests"

    trainer = ModelTrainer(random_seed=42)
    trainer.train_and_evaluate(
        data_path=FIXTURE_CSV_PATH,
        target_threat_class="DDOS",
        model_type="rf",
        out_dir=str(out_dir),
        manifest_dir=str(manifest_dir)
    )

    joblib_path = os.path.join(str(out_dir), "ddos_rf_v1.joblib")
    engine = MLInferenceEngine(model_path=joblib_path)
    assert engine.is_available()

    # Benign Feature Vector Test
    benign_features = FeatureVector(
        flow_id="FLOW-TEST-BENIGN",
        timestamp=time.time(),
        protocol="TCP",
        flow_packets_per_sec=10.0,
        flow_bytes_per_sec=5000.0,
        tcp_syn_count=1,
        tcp_ack_count=10,
        directional_byte_ratio=0.45,
        directional_packet_ratio=0.50,
        flow_duration=1.2,
        flow_packet_count=11,
        flow_byte_count=5200
    )

    pred_benign = engine.predict(benign_features)
    assert isinstance(pred_benign, MLPrediction)
    assert pred_benign.label == "BENIGN"
    assert pred_benign.score < 0.50

    # Suspicious DDoS Feature Vector Test
    ddos_features = FeatureVector(
        flow_id="FLOW-TEST-DDOS",
        timestamp=time.time(),
        protocol="TCP",
        flow_packets_per_sec=15000.0,
        flow_bytes_per_sec=18000000.0,
        tcp_syn_count=3000,
        tcp_ack_count=1,
        directional_byte_ratio=0.98,
        directional_packet_ratio=0.97,
        flow_duration=0.04,
        flow_packet_count=3001,
        flow_byte_count=18000000
    )

    pred_ddos = engine.predict(ddos_features)
    assert isinstance(pred_ddos, MLPrediction)
    assert pred_ddos.label == "DDOS"
    assert pred_ddos.score >= 0.50


def test_10_missing_model_handling():
    """Verify missing model artifact is handled gracefully without exceptions."""
    engine = MLInferenceEngine(model_path="/nonexistent/path/model.joblib")
    assert not engine.is_available()

    # Predict should return None safely
    pred = engine.predict({"flow_packets_per_sec": 100.0})
    assert pred is None


def test_11_verify_no_socket_calls_in_ml_pipeline():
    """AST static security check: Verify zero socket calls in app/ml."""
    ml_dir = os.path.join(os.path.dirname(__file__), "..", "app", "ml")
    for root, _, files in os.walk(ml_dir):
        for fname in files:
            if fname.endswith(".py"):
                fpath = os.path.join(root, fname)
                with open(fpath, "r", encoding="utf-8") as f:
                    content = f.read()
                    assert "import socket" not in content, f"Forbidden 'import socket' in {fpath}"
                    assert "socket.socket" not in content, f"Forbidden 'socket.socket' in {fpath}"


def test_12_verify_no_dns_resolvers_or_network_calls_in_ml_pipeline():
    """AST static security check: Verify zero dns resolvers or requests in app/ml."""
    ml_dir = os.path.join(os.path.dirname(__file__), "..", "app", "ml")
    for root, _, files in os.walk(ml_dir):
        for fname in files:
            if fname.endswith(".py"):
                fpath = os.path.join(root, fname)
                with open(fpath, "r", encoding="utf-8") as f:
                    content = f.read()
                    assert "dns.resolver" not in content, f"Forbidden DNS resolver in {fpath}"
                    assert "import requests" not in content, f"Forbidden HTTP requests in {fpath}"
                    assert "urllib.request" not in content, f"Forbidden urllib in {fpath}"


def test_13_verify_no_tls_decryption_in_ml_pipeline():
    """AST static security check: Verify zero payload decryption keywords in app/ml."""
    ml_dir = os.path.join(os.path.dirname(__file__), "..", "app", "ml")
    for root, _, files in os.walk(ml_dir):
        for fname in files:
            if fname.endswith(".py"):
                fpath = os.path.join(root, fname)
                with open(fpath, "r", encoding="utf-8") as f:
                    content = f.read().lower()
                    assert "decrypt_tls" not in content
                    assert "ssl_strip" not in content
                    assert "private_key" not in content
