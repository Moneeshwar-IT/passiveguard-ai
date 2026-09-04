import ast
import os
import pytest
from app.detection.base import DetectionResult
from app.detection.tls import TLSDetector, TLSConfig
from app.features.models import FeatureVector
from app.features.tls_features import TLSFeatures


@pytest.fixture
def tls_detector():
    return TLSDetector()


# 1. Benign TLS Traffic Test
def test_tls_benign_traffic(tls_detector):
    fv_benign = FeatureVector(
        flow_id="FLOW-TLS-BENIGN",
        timestamp=1700000000.0,
        protocol="TCP",
        flow_packet_count=150,
        flow_byte_count=120000,
        flow_duration=10.0,
        flow_packets_per_sec=15.0,
        flow_bytes_per_sec=12000.0,
        tls_version="TLS 1.3",
        tls_mean_packet_size=800.0,
        tls_std_packet_size=250.0,  # High normal variance
        directional_packet_ratio=0.5,
        directional_byte_ratio=0.5,
        temporal_mean_iat=0.1,
        temporal_std_iat=0.08,
        temporal_cv_iat=0.8,
        temporal_periodicity=0.1
    )

    res = tls_detector.analyze(fv_benign)
    assert isinstance(res, DetectionResult)
    assert res.threat_class == "BENIGN"
    assert res.score < 0.50
    assert res.severity in ["INFO", "LOW"]


# 2. Suspicious Encrypted Traffic Test
def test_tls_suspicious_encrypted_malware(tls_detector):
    fv_suspicious = FeatureVector(
        flow_id="FLOW-TLS-MALWARE",
        timestamp=1700000000.0,
        protocol="TCP",
        flow_packet_count=20,
        flow_byte_count=2000,
        flow_duration=1.0,
        flow_packets_per_sec=20.0,
        flow_bytes_per_sec=2000.0,
        tls_version="SSLv3",  # Deprecated TLS version
        tls_mean_packet_size=100.0,
        tls_std_packet_size=8.0,  # Unnatural uniform packet size
        directional_packet_ratio=0.95,
        directional_byte_ratio=0.95,  # Severe directional asymmetry
        temporal_mean_iat=0.05,
        temporal_std_iat=0.001,
        temporal_cv_iat=0.02,  # Highly regular timing
        temporal_periodicity=0.92
    )

    res = tls_detector.analyze(fv_suspicious)
    assert isinstance(res, DetectionResult)
    assert res.threat_class == "ENCRYPTED_MALWARE"
    assert res.score >= 0.65
    assert res.severity in ["MEDIUM", "HIGH", "CRITICAL"]
    assert len(res.evidence["reasons"]) >= 2


# 3. Missing Fingerprints / Partial Metadata Test
def test_tls_missing_metadata(tls_detector):
    fv_missing = FeatureVector(
        flow_id="FLOW-TLS-NO-FP",
        timestamp=1700000000.0,
        protocol="TCP",
        flow_packet_count=10,
        flow_byte_count=1000,
        flow_duration=1.0,
        flow_packets_per_sec=10.0,
        flow_bytes_per_sec=1000.0,
        tls_ja3=None,
        tls_ja4=None,
        tls_version=None
    )

    res = tls_detector.analyze(fv_missing)
    assert isinstance(res, DetectionResult)
    assert res.evidence["ja3_fingerprint"] is None
    assert 0.0 <= res.score <= 1.0


# 4. QUIC Metadata Test (Metadata-only, zero decryption)
def test_quic_metadata_handling(tls_detector):
    fv_quic = FeatureVector(
        flow_id="FLOW-QUIC-001",
        timestamp=1700000000.0,
        protocol="UDP",
        flow_packet_count=25,
        flow_byte_count=2500,
        flow_duration=1.0,
        flow_packets_per_sec=25.0,
        flow_bytes_per_sec=2500.0,
        quic_version="QUICv1",
        quic_packet_count=25,
        quic_byte_count=2500,
        quic_mean_packet_size=100.0,
        quic_std_packet_size=10.0,  # Uniform packet sizes
        temporal_periodicity=0.90
    )

    res = tls_detector.analyze(fv_quic)
    assert isinstance(res, DetectionResult)
    assert res.evidence["quic_version"] == "QUICv1"
    assert res.threat_class == "ENCRYPTED_MALWARE"


# 5. Insufficient Data Guard Test (< 3 packets)
def test_tls_insufficient_context(tls_detector):
    fv_single = FeatureVector(
        flow_id="FLOW-SINGLE-PKT",
        timestamp=1700000000.0,
        protocol="TCP",
        flow_packet_count=1,
        flow_byte_count=60,
        flow_duration=0.0,
        flow_packets_per_sec=0.0,
        flow_bytes_per_sec=0.0,
        tls_std_packet_size=0.0
    )

    res = tls_detector.analyze(fv_single)
    assert isinstance(res, DetectionResult)
    assert res.threat_class == "BENIGN"
    assert res.score < 0.20
    assert res.evidence.get("insufficient_encrypted_session_context") is True


# 6. Determinism Test
def test_tls_detector_determinism(tls_detector):
    fv = FeatureVector(
        flow_id="FLOW-DET",
        timestamp=1700000000.0,
        protocol="TCP",
        flow_packet_count=10,
        flow_byte_count=1000,
        flow_duration=1.0,
        flow_packets_per_sec=10.0,
        flow_bytes_per_sec=1000.0,
        tls_version="TLS 1.3"
    )

    r1 = tls_detector.analyze(fv)
    r2 = tls_detector.analyze(fv)
    assert r1.model_dump() == r2.model_dump()


# 7. Static AST Security Test verifying zero network calls and zero decryption APIs
def test_verify_no_socket_or_decryption_calls_in_tls_detector():
    forbidden_calls = {
        "socket", "connect", "send", "sendto", "sendall",
        "sr", "sr1", "srp", "srp1", "decrypt", "private_key", "ssl.wrap_socket"
    }
    tls_filepath = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "detection", "tls.py"))

    with open(tls_filepath, "r", encoding="utf-8") as f:
        tree = ast.parse(f.read(), filename=tls_filepath)

    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func_name = None
            if isinstance(node.func, ast.Name):
                func_name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                func_name = node.func.attr

            assert func_name not in forbidden_calls, f"Forbidden call '{func_name}' found in {tls_filepath}"


# 8. Detector Contract Verification
def test_tls_detector_contract(tls_detector):
    assert tls_detector.detector_name == "tls_detector"
    assert tls_detector.model_version == "statistical-v1"
