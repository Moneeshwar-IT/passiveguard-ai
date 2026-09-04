import ast
import os
import pytest
from app.detection.base import DetectionResult
from app.detection.dns_tunneling import DNSTunnelDetector, DNSTunnelConfig, DNSTunnelStateTracker
from app.features.models import FeatureVector
from app.features.dns_features import DNSFeatures, calculate_shannon_entropy


@pytest.fixture
def tunnel_detector():
    return DNSTunnelDetector()


# 1. Normal DNS Queries Test
def test_dns_tunnel_normal_queries(tunnel_detector):
    tracker = DNSTunnelStateTracker()
    detector = DNSTunnelDetector(state_tracker=tracker)

    # 5 normal short queries to google.com
    for i in range(5):
        fv = FeatureVector(
            flow_id=f"FLOW-NORM-{i}",
            timestamp=100.0 + i,
            protocol="UDP",
            flow_packet_count=2,
            flow_byte_count=150,
            flow_duration=0.1,
            flow_packets_per_sec=20.0,
            flow_bytes_per_sec=1500.0,
            dns_query_length=15,
            dns_entropy=2.5,
            dns_digit_ratio=0.0,
            dns_query_frequency=2.0
        )
        detector.analyze(fv)

    res = detector.analyze(fv)
    assert isinstance(res, DetectionResult)
    assert res.threat_class == "BENIGN"
    assert res.score < 0.50
    assert res.severity in ["INFO", "LOW"]


# 2. Suspicious Tunnelling Queries Test
def test_dns_tunnel_suspicious_tunnelling(tunnel_detector):
    tracker = DNSTunnelStateTracker()
    detector = DNSTunnelDetector(state_tracker=tracker)

    # 5 long encoded base64 subdomain queries to badc2domain.org
    base64_chunks = [
        "aHR0cHM6Ly9leGFtcGxlLmNvbS9zZWNyZXQx.badc2domain.org",
        "aHR0cHM6Ly9leGFtcGxlLmNvbS9zZWNyZXQy.badc2domain.org",
        "aHR0cHM6Ly9leGFtcGxlLmNvbS9zZWNyZXQz.badc2domain.org",
        "aHR0cHM6Ly9leGFtcGxlLmNvbS9zZWNyZXQ0.badc2domain.org",
        "aHR0cHM6Ly9leGFtcGxlLmNvbS9zZWNyZXQ1.badc2domain.org"
    ]

    for i, domain in enumerate(base64_chunks):
        fv = FeatureVector(
            flow_id=f"FLOW-TUNNEL-{i}",
            timestamp=100.0 + i,
            protocol="UDP",
            flow_packet_count=2,
            flow_byte_count=500,
            flow_duration=0.1,
            flow_packets_per_sec=20.0,
            flow_bytes_per_sec=5000.0,
            dns_query_length=len(domain),
            dns_entropy=4.8,
            dns_digit_ratio=0.2,
            dns_query_frequency=45.0
        )
        # Pass domain_name explicitly in dict format for test
        d = fv.model_dump()
        d["domain_name"] = domain
        res = detector.analyze(d)

    assert isinstance(res, DetectionResult)
    assert res.threat_class == "DNS_TUNNEL"
    assert res.score >= 0.65
    assert res.severity in ["MEDIUM", "HIGH", "CRITICAL"]
    assert res.evidence["unique_subdomain_ratio"] > 0.80


# 3. Insufficient Context Guard Test (< 3 queries)
def test_dns_tunnel_insufficient_context(tunnel_detector):
    fv_single = FeatureVector(
        flow_id="FLOW-SINGLE-DNS",
        timestamp=100.0,
        protocol="UDP",
        flow_packet_count=2,
        flow_byte_count=200,
        flow_duration=0.1,
        flow_packets_per_sec=20.0,
        flow_bytes_per_sec=2000.0,
        dns_query_length=65,
        dns_entropy=4.9
    )

    res = tunnel_detector.analyze(fv_single)
    assert isinstance(res, DetectionResult)
    assert res.threat_class == "BENIGN"
    assert res.score < 0.20
    assert res.evidence.get("insufficient_dns_context") is True


# 4. Streaming State Eviction & Timeout Test
def test_dns_tunnel_state_eviction():
    tracker = DNSTunnelStateTracker(max_history=5, state_timeout=10.0)

    for i in range(10):
        tracker.add_query(
            src_ip="10.0.0.1",
            parent_domain="exfiltration.org",
            subdomain=f"chunk-{i}",
            query_len=50,
            entropy=4.5,
            timestamp=float(i * 10)
        )

    key = ("10.0.0.1", "exfiltration.org")
    assert len(tracker._state[key]) == 5

    evicted = tracker.evict_stale_state(current_time=1000.0)
    assert evicted == 1
    assert key not in tracker._state


# 5. Determinism Test
def test_dns_tunnel_detector_determinism():
    d = {
        "domain_name": "chunk1.exfiltration.org",
        "dns_query_length": 55,
        "dns_entropy": 4.6,
        "timestamp": 100.0
    }
    detector1 = DNSTunnelDetector(state_tracker=DNSTunnelStateTracker())
    detector2 = DNSTunnelDetector(state_tracker=DNSTunnelStateTracker())

    r1 = detector1.analyze(d)
    r2 = detector2.analyze(d)
    assert r1.model_dump() == r2.model_dump()


# 6. AST Security test verifying zero DNS resolution or network socket calls
def test_verify_no_socket_calls_in_dns_tunnel_detector():
    forbidden_calls = {"gethostbyname", "getaddrinfo", "resolver", "socket", "connect", "send", "requests", "urllib"}
    tunnel_filepath = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "detection", "dns_tunneling.py"))

    with open(tunnel_filepath, "r", encoding="utf-8") as f:
        tree = ast.parse(f.read(), filename=tunnel_filepath)

    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func_name = None
            if isinstance(node.func, ast.Name):
                func_name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                func_name = node.func.attr

            assert func_name not in forbidden_calls, f"Forbidden network/resolver function '{func_name}' found in {tunnel_filepath}"


# 7. Detector Contract Verification
def test_dns_tunnel_detector_contract(tunnel_detector):
    assert tunnel_detector.detector_name == "dns_tunneling_detector"
    assert tunnel_detector.model_version == "statistical-v1"
