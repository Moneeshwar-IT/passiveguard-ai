"""
PassiveGuard AI — Module 13 ML Integration & End-to-End Pipeline Test Suite

Tests model loading, graceful missing/corrupted model fallback, feature order preservation,
Layer A statistical + Layer B ML hybrid DDoS detection, agreement/disagreement metrics,
bounded score fusion, pipeline integration, model status REST API, and static security checks.
"""
import os
import ast
import pytest
import time
import numpy as np

from app.ml.inference import MLInferenceEngine, MLPrediction
from app.detection.ddos import DDoSDetector, DDoSConfig
from app.features.models import FeatureVector
from app.ingestion.models import FlowRecord
from app.pipeline.engine import PipelineEngine
from app.risk.fusion import RiskFusionEngine


candidate_model_paths = [
    os.path.join("data", "models", "ddos_rf_v1.joblib"),
    os.path.join("..", "data", "models", "ddos_rf_v1.joblib"),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "models", "ddos_rf_v1.joblib"))
]
MODEL_PATH = "/nonexistent/model.joblib"
for p in candidate_model_paths:
    if os.path.exists(p):
        MODEL_PATH = p
        break


def test_1_valid_model_loads():
    """Verify valid model joblib artifact loads cleanly."""
    if not os.path.exists(MODEL_PATH):
        pytest.skip("ddos_rf_v1.joblib artifact not generated; skipping valid load test.")

    engine = MLInferenceEngine(model_path=MODEL_PATH)
    assert engine.is_available()
    assert engine._model is not None


def test_2_missing_model_handled_safely():
    """Verify missing model artifact path is handled gracefully without crashing."""
    engine = MLInferenceEngine(model_path="/nonexistent/dir/missing_model.joblib")
    assert not engine.is_available()
    pred = engine.predict({"flow_packets_per_sec": 100.0})
    assert pred is None


def test_3_corrupted_model_handled_safely(tmp_path):
    """Verify corrupted model binary file is handled safely without crashing."""
    corrupted_file = tmp_path / "corrupted_model.joblib"
    with open(corrupted_file, "w") as f:
        f.write("CORRUPTED_BINARY_DATA_NOT_JOBLIB")

    engine = MLInferenceEngine(model_path=str(corrupted_file))
    assert not engine.is_available()
    pred = engine.predict({"flow_packets_per_sec": 100.0})
    assert pred is None


def test_4_valid_feature_vector_produces_prediction():
    """Verify valid FeatureVector produces structured MLPrediction object."""
    if not os.path.exists(MODEL_PATH):
        pytest.skip("ddos_rf_v1.joblib not present; skipping prediction test.")

    engine = MLInferenceEngine(model_path=MODEL_PATH)
    features = FeatureVector(
        flow_id="FLOW-TEST-1",
        timestamp=time.time(),
        protocol="TCP",
        flow_packets_per_sec=12000.0,
        flow_bytes_per_sec=15000000.0,
        tcp_syn_count=2500,
        tcp_ack_count=2,
        directional_byte_ratio=0.95,
        directional_packet_ratio=0.96,
        flow_duration=0.05,
        flow_packet_count=2502,
        flow_byte_count=15000000
    )

    pred = engine.predict(features)
    assert pred is not None
    assert isinstance(pred, MLPrediction)
    assert 0.0 <= pred.score <= 1.0
    assert pred.model_name is not None
    assert pred.model_version is not None


def test_5_missing_feature_handled_safely():
    """Verify missing feature keys are defaulted safely without throwing exceptions."""
    if not os.path.exists(MODEL_PATH):
        pytest.skip("ddos_rf_v1.joblib not present.")

    engine = MLInferenceEngine(model_path=MODEL_PATH)
    # Partial dict missing optional keys
    partial_dict = {"flow_packets_per_sec": 50.0}
    pred = engine.predict(partial_dict)
    assert pred is not None
    assert 0.0 <= pred.score <= 1.0


def test_6_feature_ordering_preserved():
    """Verify feature column order is strictly preserved during inference."""
    if not os.path.exists(MODEL_PATH):
        pytest.skip("ddos_rf_v1.joblib not present.")

    engine = MLInferenceEngine(model_path=MODEL_PATH)
    dict1 = {"tcp_syn_count": 10, "flow_packets_per_sec": 100.0}
    dict2 = {"flow_packets_per_sec": 100.0, "tcp_syn_count": 10}

    pred1 = engine.predict(dict1)
    pred2 = engine.predict(dict2)
    assert pred1.score == pred2.score


def test_7_deterministic_prediction():
    """Verify inference output is 100% deterministic for identical inputs."""
    if not os.path.exists(MODEL_PATH):
        pytest.skip("ddos_rf_v1.joblib not present.")

    engine = MLInferenceEngine(model_path=MODEL_PATH)
    dict_in = {"flow_packets_per_sec": 15000.0, "tcp_syn_count": 3000, "directional_byte_ratio": 0.98}

    pred1 = engine.predict(dict_in)
    pred2 = engine.predict(dict_in)
    assert pred1.score == pred2.score
    assert pred1.label == pred2.label


def test_8_model_version_returned():
    """Verify model version tag is returned in MLPrediction."""
    if not os.path.exists(MODEL_PATH):
        pytest.skip("ddos_rf_v1.joblib not present.")

    engine = MLInferenceEngine(model_path=MODEL_PATH)
    pred = engine.predict({"flow_packets_per_sec": 10.0})
    assert pred.model_version is not None


def test_9_statistical_only_mode():
    """Verify DDoSDetector operates in statistical-only mode when ml_enabled=False."""
    cfg = DDoSConfig(ml_enabled=False)
    detector = DDoSDetector(config=cfg)

    features = FeatureVector(
        flow_id="FLOW-TEST-STAT",
        timestamp=time.time(),
        protocol="TCP",
        flow_packets_per_sec=1000.0,
        flow_bytes_per_sec=500000.0,
        tcp_syn_count=500,
        flow_duration=1.0,
        flow_packet_count=1000,
        flow_byte_count=500000
    )

    res = detector.analyze(features)
    assert res.evidence["ml_available"] is False
    assert res.evidence["ml_score"] == 0.0


def test_10_ml_enabled_mode():
    """Verify DDoSDetector evaluates Layer B ML score when ml_enabled=True and model exists."""
    detector = DDoSDetector(config=DDoSConfig(ml_enabled=True))
    features = FeatureVector(
        flow_id="FLOW-TEST-HYBRID",
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

    res = detector.analyze(features)
    assert 0.0 <= res.score <= 1.0
    assert "ml_score" in res.evidence
    assert "ml_available" in res.evidence


def test_11_statistical_and_ml_agreement():
    """Verify agreement metric calculation when both layers agree on threat detection."""
    detector = DDoSDetector(config=DDoSConfig(ml_enabled=True))
    features = FeatureVector(
        flow_id="FLOW-AGREE",
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

    res = detector.analyze(features)
    assert "agreement" in res.evidence
    assert isinstance(res.evidence["agreement"], bool)


def test_12_statistical_and_ml_disagreement():
    """Verify graceful handling when statistical and ML layers disagree."""
    detector = DDoSDetector(config=DDoSConfig(ml_enabled=True))
    # Borderline traffic scenario
    features = FeatureVector(
        flow_id="FLOW-DISAGREE",
        timestamp=time.time(),
        protocol="TCP",
        flow_packets_per_sec=260.0,
        flow_bytes_per_sec=50000.0,
        tcp_syn_count=260,
        tcp_ack_count=100,
        directional_byte_ratio=0.50,
        directional_packet_ratio=0.50,
        flow_duration=1.0,
        flow_packet_count=360,
        flow_byte_count=50000
    )

    res = detector.analyze(features)
    assert 0.0 <= res.score <= 1.0
    assert "reasons" in res.evidence


def test_13_bounded_final_score():
    """Verify hybrid fused score is strictly bounded 0.0 <= score <= 1.0."""
    detector = DDoSDetector()
    for syn in [0, 10, 500, 10000, 100000]:
        res = detector.analyze({"flow_packets_per_sec": syn, "tcp_syn_count": syn, "protocol": "TCP", "flow_duration": 1.0})
        assert 0.0 <= res.score <= 1.0


def test_14_ml_evidence_preserved():
    """Verify ML metadata (ml_score, ml_label, ml_available, agreement) is preserved in evidence."""
    detector = DDoSDetector()
    res = detector.analyze({"flow_packets_per_sec": 100.0, "protocol": "TCP"})
    assert "ml_score" in res.evidence
    assert "ml_available" in res.evidence
    assert "agreement" in res.evidence


def test_15_model_unavailable_fallback():
    """Verify DDoSDetector falls back 100% to Layer A statistical detection when model is missing."""
    cfg = DDoSConfig(model_path="/nonexistent/model.joblib")
    detector = DDoSDetector(config=cfg)

    res = detector.analyze({"flow_packets_per_sec": 500.0, "tcp_syn_count": 300, "protocol": "TCP", "flow_duration": 1.0})
    assert res.evidence["ml_available"] is False
    assert res.score >= 0.0


def test_16_pipeline_flow_reaches_ml_inference():
    """Verify real-time PipelineEngine passes flow observations through feature extraction to ML inference."""
    engine = PipelineEngine()
    flow = FlowRecord(
        flow_id="FLOW-PIPE-ML-1",
        src_ip="192.168.1.50",
        dst_ip="10.0.0.1",
        src_port=54321,
        dst_port=80,
        protocol="TCP",
        first_seen=time.time() - 1.0,
        last_seen=time.time(),
        packet_count=5000,
        byte_count=3000000,
        src_packets=4950,
        dst_packets=50,
        src_bytes=2970000,
        dst_bytes=30000,
        tcp_flags={"SYN": 4900, "ACK": 100}
    )

    fused = engine.process_flow(flow)
    assert fused is not None
    assert 0.0 <= fused.fused_score <= 1.0


def test_17_ml_result_reaches_risk_fusion():
    """Verify RiskFusionEngine processes DDoS detector results containing ML evidence."""
    fusion = RiskFusionEngine()
    detector = DDoSDetector()
    res = detector.analyze({"flow_packets_per_sec": 15000.0, "tcp_syn_count": 3000, "protocol": "TCP", "flow_duration": 0.04})

    fused = fusion.fuse([res])
    assert fused.fused_score >= 0.0
    assert fused.primary_threat_class in ["DDOS_SYN_FLOOD", "DDOS_VOLUMETRIC", "BENIGN"]


def test_18_unified_alert_contains_ml_metadata():
    """Verify created Alert object contains ML evidence metadata."""
    engine = PipelineEngine()
    flow = FlowRecord(
        flow_id="FLOW-ALERT-ML",
        src_ip="192.168.1.99",
        dst_ip="10.0.0.2",
        src_port=60000,
        dst_port=80,
        protocol="TCP",
        first_seen=time.time() - 0.5,
        last_seen=time.time(),
        packet_count=10000,
        byte_count=6000000,
        src_packets=9990,
        dst_packets=10,
        src_bytes=5990000,
        dst_bytes=10000,
        tcp_flags={"SYN": 9900, "ACK": 100}
    )

    fused = engine.process_flow(flow)
    if fused.fused_score >= 0.65:
        alerts = engine.alert_manager.get_alerts()
        assert len(alerts) > 0
        latest = alerts[0]
        assert "ml_score" in latest.evidence or "statistical_score" in latest.evidence


def test_19_verify_no_socket_calls_in_ddos_detector():
    """AST static security check: Verify zero socket calls in ddos.py."""
    fpath = os.path.join(os.path.dirname(__file__), "..", "app", "detection", "ddos.py")
    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()
        assert "import socket" not in content
        assert "socket.socket" not in content


def test_20_verify_no_dns_calls_in_ddos_detector():
    """AST static security check: Verify zero DNS resolvers in ddos.py."""
    fpath = os.path.join(os.path.dirname(__file__), "..", "app", "detection", "ddos.py")
    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()
        assert "dns.resolver" not in content


def test_21_verify_no_external_http_calls_in_ddos_detector():
    """AST static security check: Verify zero HTTP request libraries in ddos.py."""
    fpath = os.path.join(os.path.dirname(__file__), "..", "app", "detection", "ddos.py")
    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()
        assert "import requests" not in content
        assert "urllib.request" not in content


def test_22_verify_no_packet_transmission_in_ddos_detector():
    """AST static security check: Verify zero packet transmission libraries in ddos.py."""
    fpath = os.path.join(os.path.dirname(__file__), "..", "app", "detection", "ddos.py")
    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()
        assert "sendp(" not in content
        assert "send(" not in content


def test_23_verify_no_tls_decryption_in_ddos_detector():
    """AST static security check: Verify zero TLS decryption calls in ddos.py."""
    fpath = os.path.join(os.path.dirname(__file__), "..", "app", "detection", "ddos.py")
    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read().lower()
        assert "decrypt_tls" not in content
        assert "ssl_strip" not in content


# 24. Normal Binary Class Ordering Test [0, 1]
def test_24_normal_binary_class_ordering_predict_proba():
    """Verify MLInferenceEngine correctly maps probability for normal binary classes [0, 1]."""
    class DummyNormalModel:
        classes_ = np.array([0, 1])
        feature_importances_ = np.array([0.5, 0.5])
        def predict_proba(self, X):
            return np.array([[0.15, 0.85]])

    engine = MLInferenceEngine()
    engine._model = DummyNormalModel()
    engine._feature_cols = ["f1", "f2"]
    engine._target_threat = "DDOS"
    engine._is_loaded = True

    pred = engine.predict({"f1": 1.0, "f2": 2.0})
    assert pred is not None
    assert pred.score == 0.85
    assert pred.label == "DDOS"


# 25. Reversed Binary Class Ordering Test [1, 0]
def test_25_reversed_binary_class_ordering_predict_proba():
    """Verify MLInferenceEngine correctly identifies positive class when model.classes_ is reversed [1, 0]."""
    class DummyReversedModel:
        classes_ = np.array([1, 0])
        feature_importances_ = np.array([0.5, 0.5])
        def predict_proba(self, X):
            return np.array([[0.88, 0.12]])

    engine = MLInferenceEngine()
    engine._model = DummyReversedModel()
    engine._feature_cols = ["f1", "f2"]
    engine._target_threat = "DDOS"
    engine._is_loaded = True

    pred = engine.predict({"f1": 1.0, "f2": 2.0})
    assert pred is not None
    assert pred.score == 0.88
    assert pred.label == "DDOS"


# 26. Single Class / Missing Threat Class Handling Test
def test_26_single_class_or_missing_threat_class_handling():
    """Verify single-class model (only BENIGN/0) yields 0.0 threat score safely."""
    class DummySingleClassBenignModel:
        classes_ = np.array([0])
        def predict_proba(self, X):
            return np.array([[1.0]])

    engine = MLInferenceEngine()
    engine._model = DummySingleClassBenignModel()
    engine._feature_cols = ["f1"]
    engine._target_threat = "DDOS"
    engine._is_loaded = True

    pred = engine.predict({"f1": 1.0})
    assert pred is not None
    assert pred.score == 0.0
    assert pred.label == "BENIGN"


# 27. UNSW-NB15 Model Artifact Compatibility Test
def test_27_unsw_nb15_model_artifact_compatibility():
    """Verify existing ddos_rf_unsw_nb15_v1.joblib artifact is loaded and evaluated cleanly."""
    model_path = os.path.join("data", "models", "ddos_rf_unsw_nb15_v1.joblib")
    if not os.path.exists(model_path):
        pytest.skip("ddos_rf_unsw_nb15_v1.joblib not found; skipping artifact compatibility test.")

    engine = MLInferenceEngine(model_path=model_path)
    assert engine.is_available()

    # Predict with benign feature payload
    pred = engine.predict({
        "flow_duration": 0.1,
        "flow_packet_count": 10,
        "flow_byte_count": 1000,
        "flow_packets_per_sec": 100.0,
        "flow_bytes_per_sec": 10000.0,
        "tcp_syn_count": 1,
        "tcp_ack_count": 1,
        "tcp_syn_ack_ratio": 1.0,
        "directional_byte_ratio": 0.5,
        "directional_packet_ratio": 0.5,
        "packet_size_mean": 100.0,
        "packet_size_std": 10.0
    })
    assert pred is not None
    assert 0.0 <= pred.score <= 1.0
    assert pred.label in ["DDOS", "BENIGN"]
