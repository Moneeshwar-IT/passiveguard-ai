import ast
import os
import pytest
from app.detection.base import DetectionResult
from app.detection.exfiltration import ExfiltrationDetector, ExfiltrationConfig, ExfiltrationStateTracker
from app.features.models import FeatureVector
from app.features.flow_features import FlowFeatures


@pytest.fixture
def exfil_detector():
    return ExfiltrationDetector()


# 1. Normal Balanced Traffic Test
def test_exfil_normal_balanced_traffic(exfil_detector):
    fv_benign = FeatureVector(
        flow_id="FLOW-EXFIL-BENIGN",
        timestamp=100.0,
        protocol="TCP",
        flow_packet_count=100,
        flow_byte_count=50000,
        flow_duration=10.0,
        flow_packets_per_sec=10.0,
        flow_bytes_per_sec=5000.0,
        direction_src_to_dst_bytes=25000,
        direction_dst_to_src_bytes=25000,
        directional_byte_ratio=0.5
    )

    res = exfil_detector.analyze(fv_benign)
    assert isinstance(res, DetectionResult)
    assert res.threat_class == "BENIGN"
    assert res.score < 0.50
    assert res.severity in ["INFO", "LOW"]


# 2. Suspicious Asymmetric Outbound Transfer Test
def test_exfil_suspicious_asymmetric_transfer():
    tracker = ExfiltrationStateTracker()
    detector = ExfiltrationDetector(state_tracker=tracker)

    # Simulate repeated large asymmetric egress to a rare destination
    for i in range(1, 4):
        d = {
            "src_ip": "10.0.0.5",
            "dst_ip": "198.51.100.44",
            "outbound_bytes": 15_000_000,
            "inbound_bytes": 10_000,
            "duration": 120.0,
            "timestamp": 100.0 + i * 10
        }
        res = detector.analyze(d)

    assert isinstance(res, DetectionResult)
    assert res.threat_class in ["DATA_EXFILTRATION", "Data_Exfiltration"]
    assert res.score >= 0.65
    assert res.evidence["outbound_inbound_ratio"] > 10.0
    assert len(res.evidence["reasons"]) >= 2


# 3. Legitimate Large Upload / Backup False-Positive Protection Test
def test_exfil_false_positive_protection_backup_traffic():
    tracker = ExfiltrationStateTracker()
    detector = ExfiltrationDetector(state_tracker=tracker)

    # Establish frequent destination history (e.g. enterprise backup server / cloud storage)
    for _ in range(10):
        tracker.add_flow("10.0.0.5", "10.100.0.50", 10_000, 10_000, 1.0, 50.0)

    # Large upload with balanced response traffic to frequent destination
    d = {
        "src_ip": "10.0.0.5",
        "dst_ip": "10.100.0.50",
        "outbound_bytes": 30_000_000,
        "inbound_bytes": 15_000_000,  # High inbound acknowledgment/sync volume
        "duration": 60.0,
        "timestamp": 100.0
    }
    res = detector.analyze(d)

    assert isinstance(res, DetectionResult)
    assert res.threat_class == "BENIGN"
    assert res.score <= 0.50


# 4. Sustained Outbound Transfer Test
def test_exfil_sustained_outbound_transfer(exfil_detector):
    d = {
        "src_ip": "10.0.0.5",
        "dst_ip": "198.51.100.50",
        "outbound_bytes": 20_000_000,
        "inbound_bytes": 50_000,
        "duration": 400.0,
        "timestamp": 100.0
    }
    res = exfil_detector.analyze(d)

    assert isinstance(res, DetectionResult)
    assert res.evidence["sub_scores"]["duration"] >= 0.90


# 5. Insufficient Data Guard Test (< 50 KB outbound)
def test_exfil_insufficient_context(exfil_detector):
    d = {
        "src_ip": "10.0.0.5",
        "dst_ip": "198.51.100.50",
        "outbound_bytes": 1000,
        "inbound_bytes": 500,
        "duration": 0.5,
        "timestamp": 100.0
    }
    res = exfil_detector.analyze(d)

    assert isinstance(res, DetectionResult)
    assert res.threat_class == "BENIGN"
    assert res.score < 0.20
    assert res.evidence.get("insufficient_exfiltration_context") is True


# 6. Missing Fields & Zero Inbound Bytes Handling Test
def test_exfil_zero_inbound_and_missing_fields(exfil_detector):
    fv = FeatureVector(
        flow_id="FLOW-EXFIL-NO-INBOUND",
        timestamp=100.0,
        protocol="TCP",
        flow_packet_count=10,
        flow_byte_count=100_000,
        flow_duration=1.0,
        flow_packets_per_sec=10.0,
        flow_bytes_per_sec=100000.0
    )

    res = exfil_detector.analyze(fv)
    assert isinstance(res, DetectionResult)
    assert 0.0 <= res.score <= 1.0


# 7. State Eviction & Pair Isolation Test
def test_exfil_state_eviction_and_isolation():
    tracker = ExfiltrationStateTracker(max_history=5, state_timeout=10.0)

    tracker.add_flow("10.0.0.1", "192.168.1.1", 100_000, 1000, 2.0, 10.0)
    tracker.add_flow("10.0.0.2", "192.168.1.2", 200_000, 2000, 3.0, 15.0)

    s1 = tracker.get_summary("10.0.0.1", "192.168.1.1")
    s2 = tracker.get_summary("10.0.0.2", "192.168.1.2")

    assert s1["outbound_total"] == 100_000
    assert s2["outbound_total"] == 200_000

    evicted = tracker.evict_stale_state(current_time=1000.0)
    assert evicted == 2


# 8. Determinism Test
def test_exfil_detector_determinism():
    d = {
        "src_ip": "10.0.0.5",
        "dst_ip": "198.51.100.10",
        "outbound_bytes": 10_000_000,
        "inbound_bytes": 1000,
        "duration": 30.0,
        "timestamp": 100.0
    }
    detector1 = ExfiltrationDetector(state_tracker=ExfiltrationStateTracker())
    detector2 = ExfiltrationDetector(state_tracker=ExfiltrationStateTracker())

    r1 = detector1.analyze(d)
    r2 = detector2.analyze(d)
    assert r1.model_dump() == r2.model_dump()


# 9. Static AST Security Test verifying zero socket/network calls and zero TLS decryption APIs
def test_verify_no_socket_or_decryption_calls_in_exfil_detector():
    forbidden_calls = {
        "socket", "connect", "send", "sendto", "sendall",
        "sr", "sr1", "srp", "srp1", "decrypt", "private_key", "ssl.wrap_socket"
    }
    exfil_filepath = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "detection", "exfiltration.py"))

    with open(exfil_filepath, "r", encoding="utf-8") as f:
        tree = ast.parse(f.read(), filename=exfil_filepath)

    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func_name = None
            if isinstance(node.func, ast.Name):
                func_name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                func_name = node.func.attr

            assert func_name not in forbidden_calls, f"Forbidden call '{func_name}' found in {exfil_filepath}"


# 10. Detector Contract Verification
def test_exfil_detector_contract(exfil_detector):
    assert exfil_detector.detector_name == "exfiltration_detector"
    assert exfil_detector.model_version == "statistical-exfil-v1"
