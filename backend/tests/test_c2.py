import ast
import os
import pytest
from app.detection.base import DetectionResult
from app.detection.c2 import C2Detector, C2Config, C2StateTracker
from app.features.models import FeatureVector
from app.features.temporal_features import extract_temporal_features


@pytest.fixture
def c2_detector():
    return C2Detector()


# 1. Periodic behavior test (10s, 10s, 10s, 10s, 10s)
def test_c2_perfect_periodic_behavior(c2_detector):
    ts = [100.0, 110.0, 120.0, 130.0, 140.0]
    temp_f = extract_temporal_features(ts)

    fv = FeatureVector(
        flow_id="FLOW-C2-001",
        timestamp=140.0,
        protocol="TCP",
        flow_packet_count=10,
        flow_byte_count=500,
        flow_duration=1.0,
        flow_packets_per_sec=10.0,
        flow_bytes_per_sec=500.0,
        temporal_mean_iat=temp_f.temporal_mean_iat,
        temporal_std_iat=temp_f.temporal_std_iat,
        temporal_cv_iat=temp_f.temporal_cv_iat,
        temporal_periodicity=temp_f.temporal_periodicity,
        temporal_recurrence_count=5
    )

    res = c2_detector.analyze(fv)
    assert isinstance(res, DetectionResult)
    assert res.threat_class == "C2_BEACON"
    assert res.score >= 0.65
    assert res.severity in ["HIGH", "CRITICAL"]
    assert res.evidence["periodicity_score"] > 0.85


# 2. Slightly noisy periodic behavior (10.1s, 9.8s, 10.3s, 9.9s, 10.2s)
def test_c2_noisy_periodic_behavior(c2_detector):
    ts = [100.0, 110.1, 119.9, 130.2, 140.1]
    temp_f = extract_temporal_features(ts)

    fv = FeatureVector(
        flow_id="FLOW-C2-NOISY",
        timestamp=140.1,
        protocol="TCP",
        flow_packet_count=10,
        flow_byte_count=500,
        flow_duration=1.0,
        flow_packets_per_sec=10.0,
        flow_bytes_per_sec=500.0,
        temporal_mean_iat=temp_f.temporal_mean_iat,
        temporal_std_iat=temp_f.temporal_std_iat,
        temporal_cv_iat=temp_f.temporal_cv_iat,
        temporal_periodicity=temp_f.temporal_periodicity,
        temporal_recurrence_count=5
    )

    res = c2_detector.analyze(fv)
    assert isinstance(res, DetectionResult)
    assert res.threat_class == "C2_BEACON"
    assert res.score >= 0.60


# 3. Irregular behavior (2s, 17s, 4s, 31s, 8s)
def test_c2_irregular_behavior(c2_detector):
    ts = [100.0, 102.0, 119.0, 123.0, 154.0, 162.0]
    temp_f = extract_temporal_features(ts)

    fv = FeatureVector(
        flow_id="FLOW-IRREGULAR",
        timestamp=162.0,
        protocol="TCP",
        flow_packet_count=100,
        flow_byte_count=50000,
        flow_duration=10.0,
        flow_packets_per_sec=10.0,
        flow_bytes_per_sec=5000.0,
        temporal_mean_iat=temp_f.temporal_mean_iat,
        temporal_std_iat=temp_f.temporal_std_iat,
        temporal_cv_iat=temp_f.temporal_cv_iat,
        temporal_periodicity=temp_f.temporal_periodicity,
        temporal_recurrence_count=6
    )

    res = c2_detector.analyze(fv)
    assert isinstance(res, DetectionResult)
    assert res.threat_class == "BENIGN"
    assert res.score < 0.60


# 4. Insufficient events test (< 3 events)
def test_c2_insufficient_events(c2_detector):
    fv_single = FeatureVector(
        flow_id="FLOW-SINGLE",
        timestamp=100.0,
        protocol="TCP",
        flow_packet_count=1,
        flow_byte_count=60,
        flow_duration=0.0,
        flow_packets_per_sec=0.0,
        flow_bytes_per_sec=0.0,
        temporal_recurrence_count=1
    )

    res = c2_detector.analyze(fv_single)
    assert isinstance(res, DetectionResult)
    assert res.threat_class == "BENIGN"
    assert res.score < 0.20
    assert res.evidence.get("insufficient_temporal_observations") is True


# 5. Repeated destination test vs different destinations
def test_c2_destination_recurrence():
    tracker = C2StateTracker()
    detector = C2Detector(state_tracker=tracker)

    # 5 events to same destination
    for i in range(5):
        fv = FeatureVector(
            flow_id=f"FLOW-DST-{i}",
            timestamp=100.0 + i * 10.0,
            protocol="TCP",
            flow_packet_count=10,
            flow_byte_count=500,
            flow_duration=1.0,
            flow_packets_per_sec=10.0,
            flow_bytes_per_sec=500.0,
            temporal_periodicity=0.95,
            temporal_cv_iat=0.02,
            temporal_recurrence_count=5
        )
        detector.analyze(fv)

    # Fifth event destination ratio should be 1.0
    res = detector.analyze(fv)
    assert res.evidence["destination_recurrence"] == 1.0


# 6. TLS Metadata present vs absent (metadata-only, zero decryption)
def test_c2_tls_metadata_handling(c2_detector):
    ts = [100.0, 110.0, 120.0, 130.0, 140.0]
    temp_f = extract_temporal_features(ts)

    fv_tls = FeatureVector(
        flow_id="FLOW-TLS-C2",
        timestamp=140.0,
        protocol="TCP",
        flow_packet_count=10,
        flow_byte_count=500,
        flow_duration=1.0,
        flow_packets_per_sec=10.0,
        flow_bytes_per_sec=500.0,
        tls_version="TLS 1.3",
        tls_ja3="771,4865-4866-4867,0-23-65281,29-23-24,0",
        tls_std_packet_size=12.5,
        temporal_mean_iat=temp_f.temporal_mean_iat,
        temporal_std_iat=temp_f.temporal_std_iat,
        temporal_cv_iat=temp_f.temporal_cv_iat,
        temporal_periodicity=temp_f.temporal_periodicity,
        temporal_recurrence_count=5
    )

    res = c2_detector.analyze(fv_tls)
    assert res.evidence["tls_metadata_present"] is True
    assert res.threat_class == "C2_BEACON"


# 7. Streaming state eviction & timeout
def test_c2_state_eviction():
    tracker = C2StateTracker(max_history=5, state_timeout=10.0)
    
    for i in range(10):
        tracker.add_event("10.0.0.1", "192.168.1.1", float(i * 10))

    assert len(tracker._history["10.0.0.1"]) == 5
    
    evicted = tracker.evict_stale_state(current_time=1000.0)
    assert evicted == 1
    assert "10.0.0.1" not in tracker._history


# 8. Determinism test
def test_c2_detector_determinism(c2_detector):
    ts = [100.0, 110.0, 120.0, 130.0, 140.0]
    temp_f = extract_temporal_features(ts)
    fv = FeatureVector(
        flow_id="FLOW-DET",
        timestamp=140.0,
        protocol="TCP",
        flow_packet_count=10,
        flow_byte_count=500,
        flow_duration=1.0,
        flow_packets_per_sec=10.0,
        flow_bytes_per_sec=500.0,
        temporal_mean_iat=temp_f.temporal_mean_iat,
        temporal_std_iat=temp_f.temporal_std_iat,
        temporal_cv_iat=temp_f.temporal_cv_iat,
        temporal_periodicity=temp_f.temporal_periodicity,
        temporal_recurrence_count=5
    )

    r1 = c2_detector.analyze(fv)
    r2 = c2_detector.analyze(fv)
    assert r1.model_dump() == r2.model_dump()


# 9. AST Security test verifying zero socket/network transmission calls
def test_verify_no_socket_calls_in_c2_detector():
    forbidden_calls = {"socket", "connect", "send", "sendto", "sendall", "sr", "sr1", "srp", "srp1"}
    c2_filepath = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "detection", "c2.py"))

    with open(c2_filepath, "r", encoding="utf-8") as f:
        tree = ast.parse(f.read(), filename=c2_filepath)

    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func_name = None
            if isinstance(node.func, ast.Name):
                func_name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                func_name = node.func.attr

            assert func_name not in forbidden_calls, f"Forbidden network transmission function '{func_name}' found in {c2_filepath}"


# 10. Detector Contract Verification
def test_c2_detector_contract(c2_detector):
    assert c2_detector.detector_name == "c2_detector"
    assert c2_detector.model_version == "statistical-v1"
