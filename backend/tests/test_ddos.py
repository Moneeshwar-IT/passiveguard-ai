import ast
import os
import pytest
from app.detection.base import DetectionResult
from app.detection.ddos import DDoSDetector, DDoSConfig
from app.features.models import FeatureVector


@pytest.fixture
def ddos_detector():
    return DDoSDetector(model_dir="./backend/models")


@pytest.fixture
def benign_feature_vector():
    return FeatureVector(
        flow_id="FLOW-BENIGN-001",
        timestamp=1700000000.0,
        protocol="TCP",
        flow_packet_count=10,
        flow_byte_count=1000,
        flow_duration=2.0,
        flow_packets_per_sec=5.0,
        flow_bytes_per_sec=500.0,
        tcp_syn_count=1,
        tcp_syn_ack_count=1,
        tcp_ack_count=8,
        directional_packet_ratio=0.5,
        directional_byte_ratio=0.5,
        temporal_mean_iat=0.2,
        temporal_std_iat=0.05
    )


# 1. SYN Flood Tests
def test_ddos_syn_flood_detection(ddos_detector):
    syn_flood_fv = FeatureVector(
        flow_id="FLOW-SYN-001",
        timestamp=1700000000.0,
        protocol="TCP",
        flow_packet_count=18000,
        flow_byte_count=1080000,
        flow_duration=1.0,
        flow_packets_per_sec=18000.0,
        flow_bytes_per_sec=1080000.0,
        tcp_syn_count=17000,
        tcp_syn_ack_count=10,
        tcp_ack_count=20,
        directional_packet_ratio=0.99,
        directional_byte_ratio=0.99,
        temporal_mean_iat=0.00005,
        temporal_std_iat=0.00001
    )

    res = ddos_detector.analyze(syn_flood_fv)
    assert isinstance(res, DetectionResult)
    assert res.threat_class == "DDOS_SYN_FLOOD"
    assert res.score >= 0.70
    assert res.severity in ["HIGH", "CRITICAL"]
    assert "syn_rate" in res.evidence
    assert res.evidence["syn_rate"] > 1000.0


def test_normal_tcp_benign(ddos_detector, benign_feature_vector):
    res = ddos_detector.analyze(benign_feature_vector)
    assert isinstance(res, DetectionResult)
    assert res.threat_class == "BENIGN"
    assert res.score < 0.50
    assert res.severity in ["INFO", "LOW"]


# 2. UDP Flood Tests
def test_ddos_udp_flood_detection(ddos_detector):
    udp_flood_fv = FeatureVector(
        flow_id="FLOW-UDP-001",
        timestamp=1700000000.0,
        protocol="UDP",
        flow_packet_count=25000,
        flow_byte_count=25000000,
        flow_duration=1.0,
        flow_packets_per_sec=25000.0,
        flow_bytes_per_sec=25000000.0,
        directional_packet_ratio=0.6,
        directional_byte_ratio=0.6,
        temporal_mean_iat=0.00004,
        temporal_std_iat=0.00001
    )

    res = ddos_detector.analyze(udp_flood_fv)
    assert isinstance(res, DetectionResult)
    assert res.threat_class in ["DDOS_UDP_FLOOD", "DDOS_UDP_AMPLIFICATION"]
    assert res.score >= 0.65
    assert res.severity in ["MEDIUM", "HIGH", "CRITICAL"]
    assert "packet_rate" in res.evidence


# 3. UDP Amplification Tests
def test_ddos_udp_amplification_detection(ddos_detector):
    amp_fv = FeatureVector(
        flow_id="FLOW-AMP-001",
        timestamp=1700000000.0,
        protocol="UDP",
        flow_packet_count=12000,
        flow_byte_count=15000000,
        flow_duration=1.0,
        flow_packets_per_sec=12000.0,
        flow_bytes_per_sec=15000000.0,
        direction_src_to_dst_packets=12000,
        direction_dst_to_src_packets=0,
        direction_src_to_dst_bytes=15000000,
        direction_dst_to_src_bytes=0,
        directional_packet_ratio=1.0,
        directional_byte_ratio=1.0,
        temporal_mean_iat=0.00008,
        temporal_std_iat=0.00002
    )

    res = ddos_detector.analyze(amp_fv)
    assert isinstance(res, DetectionResult)
    assert res.threat_class == "DDOS_UDP_AMPLIFICATION"
    assert res.score >= 0.70
    assert res.evidence["directional_asymmetry"] == 1.0
    assert "directional_observation_note" in res.evidence


# 4. Spoofed Source Anomaly Tests
def test_ddos_spoofed_source_detection(ddos_detector):
    spoof_fv = FeatureVector(
        flow_id="FLOW-SPOOF-001",
        timestamp=1700000000.0,
        protocol="UDP",
        flow_packet_count=30000,
        flow_byte_count=30000000,
        flow_duration=1.0,
        flow_packets_per_sec=30000.0,
        flow_bytes_per_sec=30000000.0,
        source_entropy=0.95,
        directional_packet_ratio=0.5,
        directional_byte_ratio=0.5
    )

    res = ddos_detector.analyze(spoof_fv)
    assert isinstance(res, DetectionResult)
    assert res.score >= 0.70
    assert res.evidence["spoofing_likelihood"] > 0.80


# 5. ML Model Loading & Artifact Tests
def test_ml_model_loading_and_version(ddos_detector):
    assert ddos_detector.detector_name == "ddos_detector"
    assert ddos_detector.model_version == "v1.0.0-hybrid"
    assert ddos_detector.ml_model is not None


# 6. Safety & Passive Security Test
def test_verify_no_active_packet_transmission_in_ddos_detector():
    forbidden_funcs = {"send", "sendp", "sr", "sr1", "srp", "srp1"}
    ddos_filepath = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "detection", "ddos.py"))
    
    with open(ddos_filepath, "r", encoding="utf-8") as f:
        tree = ast.parse(f.read(), filename=ddos_filepath)

    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func_name = None
            if isinstance(node.func, ast.Name):
                func_name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                func_name = node.func.attr
            
            assert func_name not in forbidden_funcs, f"Forbidden active transmission function '{func_name}' found in {ddos_filepath}"


# 7. End-to-End Integration Test
def test_feature_vector_to_ddos_detector_integration(ddos_detector, benign_feature_vector):
    res = ddos_detector.analyze(benign_feature_vector)
    assert isinstance(res, DetectionResult)
    assert res.detector_name == "ddos_detector"
    assert res.model_version == "v1.0.0-hybrid"
    assert 0.0 <= res.score <= 1.0
    assert res.severity in ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]
    assert isinstance(res.evidence, dict)


def test_ddos_detector_model_path_init():
    """Verify DDoSDetector can be instantiated with model_path keyword argument directly."""
    detector = DDoSDetector(model_path="nonexistent_test_model.joblib")
    assert detector.config.model_path == "nonexistent_test_model.joblib"
    assert detector.detector_name == "ddos_detector"

