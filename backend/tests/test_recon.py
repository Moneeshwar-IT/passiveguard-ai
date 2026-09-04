import ast
import os
import pytest
from app.detection.base import DetectionResult
from app.detection.recon import ReconDetector, ReconConfig, ReconStateTracker
from app.features.models import FeatureVector
from app.features.flow_features import FlowFeatures


@pytest.fixture
def recon_detector():
    return ReconDetector()


# 1. Vertical Scan Test (1 source -> 1 dest -> 25 ports)
def test_recon_vertical_scan():
    tracker = ReconStateTracker()
    detector = ReconDetector(state_tracker=tracker)

    for p in range(1, 26):
        fv = FeatureVector(
            flow_id=f"FLOW-VERT-{p}",
            timestamp=100.0 + (p * 0.1),
            protocol="TCP",
            flow_packet_count=1,
            flow_byte_count=60,
            flow_duration=0.01,
            flow_packets_per_sec=100.0,
            flow_bytes_per_sec=6000.0,
            tcp_syn_count=1,
            tcp_ack_count=0
        )
        d = fv.model_dump()
        d["src_ip"] = "10.0.0.5"
        d["dst_ip"] = "192.168.1.10"
        d["dst_port"] = p * 10
        res = detector.analyze(d)

    assert isinstance(res, DetectionResult)
    assert res.threat_class in ["RECON_SCAN", "Reconnaissance"]
    assert res.score >= 0.65
    assert res.evidence["scan_type"] == "VERTICAL"
    assert res.evidence["unique_destination_ports"] == 25


# 2. Horizontal Scan Test (1 source -> 20 dests -> port 445)
def test_recon_horizontal_scan():
    tracker = ReconStateTracker()
    detector = ReconDetector(state_tracker=tracker)

    for i in range(1, 21):
        fv = FeatureVector(
            flow_id=f"FLOW-HORIZ-{i}",
            timestamp=100.0 + (i * 0.1),
            protocol="TCP",
            flow_packet_count=1,
            flow_byte_count=60,
            flow_duration=0.01,
            flow_packets_per_sec=100.0,
            flow_bytes_per_sec=6000.0,
            tcp_syn_count=1,
            tcp_ack_count=0
        )
        d = fv.model_dump()
        d["src_ip"] = "10.0.0.5"
        d["dst_ip"] = f"192.168.1.{i}"
        d["dst_port"] = 445
        res = detector.analyze(d)

    assert isinstance(res, DetectionResult)
    assert res.threat_class in ["RECON_SCAN", "Reconnaissance"]
    assert res.score >= 0.65
    assert res.evidence["scan_type"] == "HORIZONTAL"
    assert res.evidence["unique_destinations"] == 20


# 3. Mixed Scan Test (many dests + many ports)
def test_recon_mixed_scan():
    tracker = ReconStateTracker()
    detector = ReconDetector(state_tracker=tracker)

    for i in range(1, 15):
        fv = FeatureVector(
            flow_id=f"FLOW-MIX-{i}",
            timestamp=100.0 + (i * 0.1),
            protocol="TCP",
            flow_packet_count=1,
            flow_byte_count=60,
            flow_duration=0.01,
            flow_packets_per_sec=100.0,
            flow_bytes_per_sec=6000.0,
            tcp_syn_count=1,
            tcp_ack_count=0
        )
        d = fv.model_dump()
        d["src_ip"] = "10.0.0.5"
        d["dst_ip"] = f"192.168.1.{i}"
        d["dst_port"] = 100 + i
        res = detector.analyze(d)

    assert isinstance(res, DetectionResult)
    assert res.threat_class in ["RECON_SCAN", "Reconnaissance"]
    assert res.score >= 0.65
    assert res.evidence["scan_type"] == "MIXED"


# 4. Normal Traffic Test (small number of ordinary connections)
def test_recon_normal_traffic(recon_detector):
    fv_benign = FeatureVector(
        flow_id="FLOW-NORM-01",
        timestamp=100.0,
        protocol="TCP",
        flow_packet_count=50,
        flow_byte_count=40000,
        flow_duration=5.0,
        flow_packets_per_sec=10.0,
        flow_bytes_per_sec=8000.0,
        tcp_syn_count=1,
        tcp_ack_count=48
    )

    res = recon_detector.analyze(fv_benign)
    assert isinstance(res, DetectionResult)
    assert res.threat_class == "BENIGN"
    assert res.score < 0.50
    assert res.severity in ["INFO", "LOW"]


# 5. Insufficient Data Guard Test (< 3 connections)
def test_recon_insufficient_context(recon_detector):
    fv_single = FeatureVector(
        flow_id="FLOW-SINGLE",
        timestamp=100.0,
        protocol="TCP",
        flow_packet_count=1,
        flow_byte_count=60,
        flow_duration=0.01,
        flow_packets_per_sec=100.0,
        flow_bytes_per_sec=6000.0,
        tcp_syn_count=1,
        tcp_ack_count=0
    )

    res = recon_detector.analyze(fv_single)
    assert isinstance(res, DetectionResult)
    assert res.threat_class == "BENIGN"
    assert res.score < 0.20
    assert res.evidence.get("insufficient_recon_context") is True


# 6. Streaming State Eviction & Multi-Source Isolation Test
def test_recon_state_eviction_and_isolation():
    tracker = ReconStateTracker(max_history=5, state_timeout=10.0)

    # Source 1
    for i in range(10):
        tracker.add_flow("10.0.0.1", f"192.168.1.{i}", 80, 0.1, 1, 1, 0, 0, float(i * 10))

    # Source 2
    tracker.add_flow("10.0.0.2", "192.168.1.5", 443, 2.0, 10, 1, 9, 0, 500.0)

    s1 = tracker.get_summary("10.0.0.1")
    s2 = tracker.get_summary("10.0.0.2")

    assert s1["total_flows"] == 5
    assert s2["total_flows"] == 1

    evicted = tracker.evict_stale_state(current_time=1000.0)
    assert evicted == 2


# 7. Determinism Test
def test_recon_detector_determinism():
    d = {
        "src_ip": "10.0.0.5",
        "dst_ip": "192.168.1.10",
        "dst_port": 80,
        "flow_duration": 0.01,
        "flow_packet_count": 1,
        "tcp_syn_count": 1,
        "tcp_ack_count": 0,
        "timestamp": 100.0
    }
    detector1 = ReconDetector(state_tracker=ReconStateTracker())
    detector2 = ReconDetector(state_tracker=ReconStateTracker())

    r1 = detector1.analyze(d)
    r2 = detector2.analyze(d)
    assert r1.model_dump() == r2.model_dump()


# 8. Static AST Security Test verifying zero socket/probing calls
def test_verify_no_socket_calls_in_recon_detector():
    forbidden_calls = {"socket", "connect", "send", "sendto", "sendall", "sr", "sr1", "srp", "srp1"}
    recon_filepath = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "detection", "recon.py"))

    with open(recon_filepath, "r", encoding="utf-8") as f:
        tree = ast.parse(f.read(), filename=recon_filepath)

    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func_name = None
            if isinstance(node.func, ast.Name):
                func_name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                func_name = node.func.attr

            assert func_name not in forbidden_calls, f"Forbidden network call '{func_name}' found in {recon_filepath}"


# 9. Detector Contract Verification
def test_recon_detector_contract(recon_detector):
    assert recon_detector.detector_name == "recon_detector"
    assert recon_detector.model_version in ["v1.0.0-hybrid", "statistical-v1"]
