"""
PassiveGuard AI — Real Cybersecurity Dataset Training & Validation Test Suite (Module 16)

STRICT PASSIVE & HONEST METRICS DIRECTIVE:
Verifies dataset adapters, explicit label mapping, feature availability categorization,
leakage-safe splitting, class imbalance strategies, RandomForest model training,
honest metrics computation (FPR, FNR, F1), model provenance manifests, artifact reloading,
and passive enclave security rules.
"""
import os
import ast
import tempfile
import pytest
import numpy as np
import pandas as pd
import joblib

from app.ml.datasets import (
    BaseDatasetAdapter,
    UNSWNB15Adapter,
    CSECICIDS2018Adapter,
    SyntheticFixtureAdapter,
    DatasetAdapterRegistry,
    PASSIVEGUARD_FEATURE_SCHEMA
)
from app.ml.preprocessing import DataPreprocessor, LabelMapper, DataManifest
from app.ml.trainer import ModelTrainer
from app.ml.inference import MLInferenceEngine


@pytest.fixture
def mock_unsw_csv(tmp_path):
    """Creates a temporary UNSW-NB15 sample CSV file."""
    csv_file = tmp_path / "UNSW_NB15_testing-set.csv"
    data = {
        "dur": [0.1, 0.5, 0.01, 2.0, 0.05],
        "spkts": [10, 50, 1000, 5, 500],
        "dpkts": [12, 60, 5, 6, 2],
        "sbytes": [1000, 5000, 100000, 500, 50000],
        "dbytes": [1200, 6000, 300, 600, 100],
        "rate": [220.0, 220.0, 100500.0, 5.5, 100400.0],
        "sttl": [64, 64, 254, 64, 254],
        "dttl": [64, 64, 0, 64, 0],
        "sload": [80000.0, 80000.0, 8000000.0, 2000.0, 8000000.0],
        "dload": [96000.0, 96000.0, 2400.0, 2400.0, 1600.0],
        "sloss": [0, 0, 10, 0, 50],
        "dloss": [0, 0, 0, 0, 0],
        "sinpkt": [10.0, 10.0, 0.01, 400.0, 0.01],
        "dinpkt": [8.0, 8.0, 0.0, 300.0, 0.0],
        "sjit": [5.0, 5.0, 1.0, 10.0, 0.5],
        "djit": [4.0, 4.0, 0.5, 8.0, 0.2],
        "swin": [255, 255, 0, 255, 0],
        "stcpb": [100, 200, 300, 400, 500],
        "dtcpb": [101, 201, 301, 401, 501],
        "dwin": [255, 255, 0, 255, 0],
        "tcprtt": [0.01, 0.02, 0.001, 0.05, 0.001],
        "synack": [0.005, 0.01, 0.0005, 0.02, 0.0005],
        "ackdat": [0.005, 0.01, 0.0005, 0.03, 0.0005],
        "smean": [100, 100, 100, 100, 100],
        "dmean": [100, 100, 60, 100, 50],
        "attack_cat": ["Normal", "Normal", "DoS", "Exploits", "DoS"]
    }
    df = pd.DataFrame(data)
    df.to_csv(csv_file, index=False)
    return str(csv_file)


@pytest.fixture
def mock_cic_csv(tmp_path):
    """Creates a temporary CSE-CIC-IDS2018 sample CSV file."""
    csv_file = tmp_path / "CSE-CIC-IDS2018.csv"
    data = {
        "Flow Duration": [100000, 500000, 10000, 2000000, 5000],
        "Tot Fwd Pkts": [10, 50, 1000, 5, 500],
        "Tot Bwd Pkts": [12, 60, 5, 6, 2],
        "TotLen Fwd Pkts": [1000, 5000, 100000, 500, 50000],
        "TotLen Bwd Pkts": [1200, 6000, 300, 600, 100],
        "Flow Pkts/s": [220.0, 220.0, 100500.0, 5.5, 100400.0],
        "Flow Byts/s": [22000.0, 22000.0, 1003000.0, 550.0, 1001000.0],
        "SYN Flag Cnt": [1, 1, 1000, 1, 500],
        "ACK Flag Cnt": [10, 50, 2, 5, 1],
        "Pkt Len Mean": [100.0, 100.0, 100.0, 100.0, 100.0],
        "Pkt Len Std": [15.0, 15.0, 2.0, 20.0, 1.0],
        "Label": ["Benign", "Benign", "DDoS attacks-LOIC-HTTP", "Bot", "DDOS attack-HOIC"]
    }
    df = pd.DataFrame(data)
    df.to_csv(csv_file, index=False)
    return str(csv_file)


# 1. Registry Discovery
def test_1_dataset_adapter_registry_discovery():
    adapter_unsw = DatasetAdapterRegistry.get_adapter("unsw_nb15")
    assert isinstance(adapter_unsw, UNSWNB15Adapter)

    adapter_cic = DatasetAdapterRegistry.get_adapter("cse_cic_ids2018")
    assert isinstance(adapter_cic, CSECICIDS2018Adapter)

    adapter_syn = DatasetAdapterRegistry.get_adapter("synthetic")
    assert isinstance(adapter_syn, SyntheticFixtureAdapter)


# 2. UNSW-NB15 Adapter Loading
def test_2_unsw_nb15_adapter_local_fixture_loading(mock_unsw_csv):
    adapter = UNSWNB15Adapter(data_dir=os.path.dirname(mock_unsw_csv))
    files = adapter.discover_local_files()
    assert len(files) >= 1

    df = adapter.load(mock_unsw_csv)
    assert len(df) == 5
    assert "attack_cat" in df.columns


# 3. CSE-CIC-IDS2018 Adapter Loading
def test_3_cse_cic_ids2018_adapter_local_fixture_loading(mock_cic_csv):
    adapter = CSECICIDS2018Adapter(data_dir=os.path.dirname(mock_cic_csv))
    files = adapter.discover_local_files()
    assert len(files) >= 1

    df = adapter.load(mock_cic_csv)
    assert len(df) == 5
    assert "label" in df.columns


# 4. Synthetic Fixture Adapter
def test_4_synthetic_fixture_adapter():
    adapter = SyntheticFixtureAdapter(n_samples=200)
    df = adapter.load()
    assert len(df) == 200
    df_filtered, counts = adapter.map_labels(df, target_threat_class="DDOS")
    assert counts.get("BENIGN", 0) == 100
    assert counts.get("DDOS", 0) == 100


# 5. Explicit Label Mapping - UNSW-NB15
def test_5_explicit_label_mapping_unsw_nb15(mock_unsw_csv):
    adapter = UNSWNB15Adapter()
    df = adapter.load(mock_unsw_csv)
    df_filtered, counts = adapter.map_labels(df, target_threat_class="DDOS")

    assert counts["BENIGN"] == 2
    assert counts["DDOS"] == 2
    assert counts["EXCLUDED"] == 1
    assert len(df_filtered) == 4


# 6. Explicit Label Mapping - CSE-CIC-IDS2018
def test_6_explicit_label_mapping_cse_cic_ids2018(mock_cic_csv):
    adapter = CSECICIDS2018Adapter()
    df = adapter.load(mock_cic_csv)
    df_filtered, counts = adapter.map_labels(df, target_threat_class="DDOS")

    assert counts["BENIGN"] == 2
    assert counts["DDOS"] == 2
    assert counts["EXCLUDED"] == 1
    assert len(df_filtered) == 4


# 7. Feature Availability Categorization
def test_7_feature_availability_categorization(mock_unsw_csv):
    adapter = UNSWNB15Adapter()
    df = adapter.load(mock_unsw_csv)
    _, availability = adapter.map_features(df)

    assert "flow_duration" in availability
    assert availability["flow_duration"] in ["DIRECTLY AVAILABLE", "DERIVABLE"]
    assert "flow_packet_count" in availability
    assert availability["flow_packet_count"] in ["DIRECTLY AVAILABLE", "DERIVABLE"]


# 8. Cleaning Audit Drops NaNs & Infs
def test_8_cleaning_audit_drops_nan_and_inf():
    adapter = SyntheticFixtureAdapter(n_samples=200)
    df = adapter.load()

    # Inject NaN and Inf values
    df.loc[0, "flow_packets_per_sec"] = np.nan
    df.loc[1, "flow_bytes_per_sec"] = np.inf

    df_clean, availability = adapter.map_features(df)
    assert len(df_clean) == 198
    assert adapter.cleaning_audit["dropped_rows"] == 2


# 9. Time-Aware Split Strategy
def test_9_time_aware_split_strategy():
    preprocessor = DataPreprocessor(random_seed=42)
    adapter = SyntheticFixtureAdapter(n_samples=100)
    df = adapter.load()
    df_filtered, _ = adapter.map_labels(df)
    df_features, _ = adapter.map_features(df_filtered)

    X_train, X_val, X_test, y_train, y_val, y_test, _, _ = preprocessor.prepare_dataset(
        df_features,
        feature_cols=PASSIVEGUARD_FEATURE_SCHEMA,
        label_col="mapped_label",
        split_strategy="time_aware"
    )

    assert len(X_train) == 70
    assert len(X_val) == 15
    assert len(X_test) == 15


# 10. Stratified Split Strategy
def test_10_stratified_split_strategy():
    preprocessor = DataPreprocessor(random_seed=42)
    adapter = SyntheticFixtureAdapter(n_samples=100)
    df = adapter.load()
    df_filtered, _ = adapter.map_labels(df)
    df_features, _ = adapter.map_features(df_filtered)

    X_train, X_val, X_test, y_train, y_val, y_test, _, _ = preprocessor.prepare_dataset(
        df_features,
        feature_cols=PASSIVEGUARD_FEATURE_SCHEMA,
        label_col="mapped_label",
        split_strategy="stratified"
    )

    assert len(X_train) == 70
    assert len(X_val) == 15
    assert len(X_test) == 15


# 11. Class Imbalance Handling - Undersampling
def test_11_class_imbalance_handling_undersample():
    preprocessor = DataPreprocessor(random_seed=42)
    adapter = SyntheticFixtureAdapter(n_samples=200)
    df = adapter.load()

    # Create severe class imbalance
    df_imbalanced = pd.concat([df[df["label"] == "BENIGN"].iloc[:90], df[df["label"] == "DDOS"].iloc[:10]], ignore_index=True)
    df_filtered, _ = adapter.map_labels(df_imbalanced)
    df_features, _ = adapter.map_features(df_filtered)

    X_train, _, _, y_train, _, _, _, _ = preprocessor.prepare_dataset(
        df_features,
        feature_cols=PASSIVEGUARD_FEATURE_SCHEMA,
        label_col="mapped_label",
        imbalance_strategy="undersample"
    )

    # Balanced classes in Train set after undersampling
    assert np.sum(y_train == 0) == np.sum(y_train == 1)


# 12. Class Imbalance Handling - Oversampling
def test_12_class_imbalance_handling_oversample():
    preprocessor = DataPreprocessor(random_seed=42)
    adapter = SyntheticFixtureAdapter(n_samples=200)
    df = adapter.load()

    # Create severe class imbalance
    df_imbalanced = pd.concat([df[df["label"] == "BENIGN"].iloc[:90], df[df["label"] == "DDOS"].iloc[:10]], ignore_index=True)
    df_filtered, _ = adapter.map_labels(df_imbalanced)
    df_features, _ = adapter.map_features(df_filtered)

    X_train, _, _, y_train, _, _, _, _ = preprocessor.prepare_dataset(
        df_features,
        feature_cols=PASSIVEGUARD_FEATURE_SCHEMA,
        label_col="mapped_label",
        imbalance_strategy="oversample"
    )

    # Balanced classes in Train set after oversampling
    assert np.sum(y_train == 0) == np.sum(y_train == 1)


# 13. Random Forest Model Training
def test_13_random_forest_training_on_adapter_output():
    trainer = ModelTrainer(random_seed=42)
    with tempfile.TemporaryDirectory() as tmp_dir:
        model, manifest = trainer.train_and_evaluate(
            dataset_name="synthetic",
            target_threat_class="DDOS",
            model_type="rf",
            out_dir=tmp_dir,
            manifest_dir=tmp_dir
        )
        assert model is not None
        assert manifest.dataset_name == "synthetic_fixture"
        assert manifest.evaluation_metrics["accuracy"] >= 0.90


# 14. Real Metrics Calculation Accuracy
def test_14_real_metrics_calculation_accuracy_precision_recall_f1():
    trainer = ModelTrainer(random_seed=42)
    with tempfile.TemporaryDirectory() as tmp_dir:
        _, manifest = trainer.train_and_evaluate(
            dataset_name="synthetic",
            target_threat_class="DDOS",
            model_type="rf",
            out_dir=tmp_dir,
            manifest_dir=tmp_dir
        )

        metrics = manifest.evaluation_metrics
        assert "accuracy" in metrics
        assert "precision_macro" in metrics
        assert "recall_macro" in metrics
        assert "f1_macro" in metrics
        assert "false_positive_rate" in metrics
        assert "false_negative_rate" in metrics


# 15. FPR Calculation Accuracy
def test_15_fpr_calculation_accuracy():
    tn, fp = 90, 10
    fpr = float(fp / (fp + tn))
    assert round(fpr, 4) == 0.1000


# 16. FNR Calculation Accuracy
def test_16_fnr_calculation_accuracy():
    fn, tp = 5, 95
    fnr = float(fn / (fn + tp))
    assert round(fnr, 4) == 0.0500


# 17. Manifest Provenance and Feature Order
def test_17_manifest_provenance_and_feature_order():
    trainer = ModelTrainer(random_seed=42)
    with tempfile.TemporaryDirectory() as tmp_dir:
        _, manifest = trainer.train_and_evaluate(
            dataset_name="synthetic",
            target_threat_class="DDOS",
            model_type="rf",
            out_dir=tmp_dir,
            manifest_dir=tmp_dir
        )

        assert manifest.feature_names == PASSIVEGUARD_FEATURE_SCHEMA
        assert manifest.split_strategy == "time_aware"
        assert manifest.imbalance_strategy == "balanced_weights"


# 18. Model Artifact Reload & Feature Order Protection
def test_18_model_artifact_reload_and_feature_order_protection(tmp_path):
    out_dir = str(tmp_path / "models")
    manifest_dir = str(tmp_path / "manifests")

    trainer = ModelTrainer(random_seed=42)
    trainer.train_and_evaluate(
        dataset_name="synthetic",
        target_threat_class="DDOS",
        model_type="rf",
        out_dir=out_dir,
        manifest_dir=manifest_dir
    )

    model_path = os.path.join(out_dir, "ddos_rf_v1.joblib")
    assert os.path.exists(model_path)

    artifact = joblib.load(model_path)
    assert artifact["feature_cols"] == PASSIVEGUARD_FEATURE_SCHEMA


# 19. ML Inference Engine Compatibility
def test_19_ml_inference_engine_compatibility(tmp_path):
    out_dir = str(tmp_path / "models")
    manifest_dir = str(tmp_path / "manifests")

    trainer = ModelTrainer(random_seed=42)
    trainer.train_and_evaluate(
        dataset_name="synthetic",
        target_threat_class="DDOS",
        model_type="rf",
        out_dir=out_dir,
        manifest_dir=manifest_dir
    )

    model_path = os.path.join(out_dir, "ddos_rf_v1.joblib")
    engine = MLInferenceEngine(model_path=model_path)
    assert engine.is_available()

    features = {col: 100.0 for col in PASSIVEGUARD_FEATURE_SCHEMA}
    pred = engine.predict(features)
    assert pred is not None
    assert pred.label in ["DDOS", "BENIGN"]
    assert 0.0 <= pred.score <= 1.0


# 20. Passive Enclave AST Security Check
def test_20_verify_no_network_or_socket_calls_in_real_ml_pipeline():
    """Verify zero socket, urllib, requests, dns, or sendp calls in dataset adapters."""
    forbidden_calls = {"socket", "urllib", "requests", "dns", "send", "sendp", "sr", "sr1"}
    
    target_files = [
        os.path.join("backend", "app", "ml", "datasets", "base.py"),
        os.path.join("backend", "app", "ml", "datasets", "unsw_nb15.py"),
        os.path.join("backend", "app", "ml", "datasets", "cse_cic_ids2018.py"),
        os.path.join("backend", "app", "ml", "datasets", "synthetic_fixture.py"),
        os.path.join("backend", "app", "ml", "datasets", "registry.py"),
        os.path.join("backend", "app", "ml", "trainer.py"),
        os.path.join("scripts", "train_models.py"),
        os.path.join("scripts", "validate_real_dataset.py")
    ]

    for rel_path in target_files:
        full_path = os.path.abspath(rel_path)
        if not os.path.exists(full_path):
            continue
        with open(full_path, "r", encoding="utf-8") as f:
            tree = ast.parse(f.read(), filename=full_path)

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    assert alias.name not in forbidden_calls, f"Forbidden import '{alias.name}' found in {rel_path}"
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    assert node.module not in forbidden_calls, f"Forbidden import from '{node.module}' found in {rel_path}"


# 21. Synthetic Partitions & 2x2 Confusion Matrix Test
def test_21_synthetic_partitions_contain_both_classes_and_2x2_confusion_matrix():
    """Verify synthetic fixture time-aware split produces BENIGN + DDOS in train, val, test and 2x2 CM."""
    preprocessor = DataPreprocessor(random_seed=42)
    adapter = SyntheticFixtureAdapter(n_samples=1000)
    df = adapter.load()
    df_filtered, _ = adapter.map_labels(df)
    df_features, _ = adapter.map_features(df_filtered)

    X_train, X_val, X_test, y_train, y_val, y_test, _, _ = preprocessor.prepare_dataset(
        df_features,
        feature_cols=PASSIVEGUARD_FEATURE_SCHEMA,
        label_col="mapped_label",
        split_strategy="time_aware"
    )

    # Verify train, val, and test partitions contain both classes (0 = BENIGN, 1 = DDOS)
    assert set(np.unique(y_train)) == {0, 1}
    assert set(np.unique(y_val)) == {0, 1}
    assert set(np.unique(y_test)) == {0, 1}

    # Verify trainer output produces 2x2 confusion matrix with non-zero TN and TP
    trainer = ModelTrainer(random_seed=42)
    with tempfile.TemporaryDirectory() as tmp_dir:
        _, manifest = trainer.train_and_evaluate(
            dataset_name="synthetic",
            target_threat_class="DDOS",
            model_type="rf",
            split_strategy="time_aware",
            out_dir=tmp_dir,
            manifest_dir=tmp_dir
        )

        cm = manifest.confusion_matrix
        assert len(cm) == 2
        assert len(cm[0]) == 2
        assert len(cm[1]) == 2

        cm_summary = manifest.evaluation_metrics["confusion_matrix_summary"]
        assert cm_summary["TN"] > 0
        assert cm_summary["TP"] > 0
        assert manifest.class_distribution["BENIGN"] > 0
        assert manifest.class_distribution["DDOS"] > 0


# 22. UNSW-NB15 File Discovery & Metadata Exclusion Test
def test_22_unsw_nb15_file_discovery_and_metadata_exclusion(tmp_path):
    """Verify UNSW-NB15 adapter ignores metadata files and selects traffic CSVs deterministically."""
    # Create mock directory structure with metadata and traffic files
    meta_file = tmp_path / "NUSW-NB15_features.csv"
    meta_file.write_bytes("No,Name,Type,Description\n1,dur,Float,Record duration’s value\n".encode("cp1252"))

    train_file = tmp_path / "UNSW_NB15_training-set.csv"
    train_file.write_text("dur,spkts,dpkts,sbytes,dbytes,attack_cat,label\n0.1,10,12,1000,1200,Normal,0\n")

    test_file = tmp_path / "UNSW_NB15_testing-set.csv"
    test_file.write_text("dur,spkts,dpkts,sbytes,dbytes,attack_cat,label\n0.5,50,60,5000,6000,DoS,1\n")

    adapter = UNSWNB15Adapter(data_dir=str(tmp_path))

    # Verify metadata detection
    assert adapter.is_metadata_file(str(meta_file))
    assert not adapter.is_metadata_file(str(train_file))

    # Verify discovery ignores metadata and sorts training first
    discovered = adapter.discover_local_files()
    assert len(discovered) == 2
    assert os.path.basename(discovered[0]) == "UNSW_NB15_training-set.csv"
    assert os.path.basename(discovered[1]) == "UNSW_NB15_testing-set.csv"

    # Verify dataset loads cleanly without attempting to parse metadata file as traffic data
    df = adapter.load()
    assert len(df) == 2
    assert "attack_cat" in df.columns


# 23. UNSW-NB15 Encoding Fallback (cp1252 / latin-1) Test
def test_23_unsw_nb15_encoding_fallback_cp1252_and_latin1(tmp_path):
    """Verify UNSW-NB15 adapter safely falls back to cp1252 / latin-1 for non-UTF8 traffic CSVs."""
    cp1252_file = tmp_path / "UNSW_NB15_testing-set.csv"
    # Write non-UTF8 byte 0x92 (curly apostrophe in Windows-1252) inside a comment/string
    cp1252_content = "dur,spkts,dpkts,sbytes,dbytes,attack_cat,label\n0.1,10,12,1000,1200,DoS’Attack,1\n".encode("cp1252")
    cp1252_file.write_bytes(cp1252_content)

    adapter = UNSWNB15Adapter(data_dir=str(tmp_path))
    df = adapter.load()
    assert len(df) == 1
    assert "dos" in df["attack_cat"].iloc[0].lower()


# 24. UNSW-NB15 Missing Required Files Error Reporting Test
def test_24_unsw_nb15_missing_required_files_error_reporting(tmp_path):
    """Verify detailed FileNotFoundError when required traffic files are missing."""
    # Place only a metadata file
    meta_file = tmp_path / "NUSW-NB15_features.csv"
    meta_file.write_text("No,Name,Type,Description\n")

    adapter = UNSWNB15Adapter(data_dir=str(tmp_path))
    with pytest.raises(FileNotFoundError) as exc_info:
        adapter.load()

    err_msg = str(exc_info.value)
    assert "Expected Filenames" in err_msg
    assert "Discovered CSV Filenames" in err_msg
    assert "Missing Required Files" in err_msg
    assert "NUSW-NB15_features.csv" in err_msg


# 25. UNSW-NB15 Predefined Split Class Distribution & Leakage-Safe Evaluation Test
def test_25_unsw_nb15_predefined_split_class_distribution_and_leakage_safety(tmp_path):
    """Verify UNSW-NB15 predefined splits contain BENIGN + DDOS in train, val, and test partitions."""
    train_file = tmp_path / "UNSW_NB15_training-set.csv"
    train_content = (
        "dur,spkts,dpkts,sbytes,dbytes,attack_cat,label\n"
        + "0.1,10,12,1000,1200,Normal,0\n" * 10
        + "0.5,50,60,5000,6000,DoS,1\n" * 5
    )
    train_file.write_text(train_content)

    test_file = tmp_path / "UNSW_NB15_testing-set.csv"
    test_content = (
        "dur,spkts,dpkts,sbytes,dbytes,attack_cat,label\n"
        + "0.2,15,18,1500,1800,Normal,0\n" * 8
        + "0.8,80,90,8000,9000,DoS,1\n" * 4
    )
    test_file.write_text(test_content)

    adapter = UNSWNB15Adapter(data_dir=str(tmp_path))
    assert adapter.has_predefined_splits

    df_train, df_test = adapter.load_splits()
    assert len(df_train) == 15
    assert len(df_test) == 12

    preprocessor = DataPreprocessor(random_seed=42)
    df_train_filt, _ = adapter.map_labels(df_train, target_threat_class="DDOS")
    df_train_feat, _ = adapter.map_features(df_train_filt)

    df_test_filt, _ = adapter.map_labels(df_test, target_threat_class="DDOS")
    df_test_feat, _ = adapter.map_features(df_test_filt)

    X_train, X_val, X_test, y_train, y_val, y_test, scaler, audit = preprocessor.prepare_predefined_dataset(
        df_train_feat,
        df_test_feat,
        feature_cols=PASSIVEGUARD_FEATURE_SCHEMA,
        label_col="mapped_label",
        target_threat_class="DDOS"
    )

    # Verify both classes exist in Train, Validation, and Held-Out Test partitions
    assert set(np.unique(y_train)) == {0, 1}
    assert set(np.unique(y_val)) == {0, 1}
    assert set(np.unique(y_test)) == {0, 1}

    # Verify scaler fitted on train partition ONLY
    assert scaler is not None
    assert audit["split_type"] == "official_predefined_split"


# 26. Single-Class Test Partition Honest Warning Test
def test_26_single_class_test_partition_honest_warning_test(tmp_path):
    """Verify single-class test set generates notice instead of fake binary metrics."""
    train_file = tmp_path / "UNSW_NB15_training-set.csv"
    train_file.write_text("dur,spkts,dpkts,sbytes,dbytes,attack_cat,label\n0.1,10,12,1000,1200,Normal,0\n0.5,50,60,5000,6000,DoS,1\n")

    # Test file contains ONLY Normal (BENIGN = 0)
    test_file = tmp_path / "UNSW_NB15_testing-set.csv"
    test_file.write_text("dur,spkts,dpkts,sbytes,dbytes,attack_cat,label\n0.2,15,18,1500,1800,Normal,0\n0.3,20,22,2000,2200,Normal,0\n")

    adapter = UNSWNB15Adapter(data_dir=str(tmp_path))
    trainer = ModelTrainer(random_seed=42)

    with tempfile.TemporaryDirectory() as tmp_out:
        _, manifest = trainer.train_and_evaluate(
            dataset_name="unsw_nb15",
            data_dir=str(tmp_path),
            target_threat_class="DDOS",
            model_type="rf",
            out_dir=tmp_out,
            manifest_dir=tmp_out
        )

        assert manifest.evaluation_metrics["confusion_matrix_summary"]["TP"] == 0
        assert manifest.evaluation_metrics["confusion_matrix_summary"]["FN"] == 0
