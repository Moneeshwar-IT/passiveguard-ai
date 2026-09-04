import ast
import os
import pytest
from app.detection.base import DetectionResult
from app.detection.dga import DGADetector, DGAConfig, extract_sld
from app.features.models import FeatureVector
from app.features.dns_features import DNSFeatures, calculate_shannon_entropy


@pytest.fixture
def dga_detector():
    return DGADetector()


# 1. Benign Domains Test
def test_dga_benign_domains(dga_detector):
    benign_domains = ["google.com", "microsoft.com", "github.com", "example.org"]
    for domain in benign_domains:
        dns_f = DNSFeatures(
            domain_name=domain,
            domain_length=len(domain),
            shannon_entropy=calculate_shannon_entropy(extract_sld(domain)),
            digit_ratio=0.0
        )
        res = dga_detector.analyze(dns_f)
        assert isinstance(res, DetectionResult)
        assert res.threat_class == "BENIGN"
        assert res.score < 0.50
        assert res.severity in ["INFO", "LOW"]


# 2. Suspicious DGA Domains Test
def test_dga_suspicious_domains(dga_detector):
    suspicious_domains = ["xq7m2k9v4z8p3n1m5r.example", "aj3k9q7m2x8p4n2v9z.example", "qz8x1m4n7r2k9v5w3y.example"]
    for domain in suspicious_domains:
        sld = extract_sld(domain)
        digits = sum(1 for c in sld if c.isdigit())
        dns_f = DNSFeatures(
            domain_name=domain,
            domain_length=len(domain),
            shannon_entropy=calculate_shannon_entropy(sld),
            digit_ratio=digits / len(sld)
        )
        res = dga_detector.analyze(dns_f)
        assert isinstance(res, DetectionResult)
        assert res.threat_class in ["DGA_DOMAIN", "DGA"]
        assert res.score >= 0.60
        assert res.severity in ["MEDIUM", "HIGH", "CRITICAL"]


# 3. Single Feature False-Positive Guard Test
def test_dga_single_feature_false_positive_protection(dga_detector):
    # Long domain slug but low entropy and normal English word combinations
    domain = "customer-support-service-portal-12345.com"
    dns_f = DNSFeatures(
        domain_name=domain,
        domain_length=len(domain),
        shannon_entropy=2.8,  # Low entropy
        digit_ratio=0.1
    )
    res = dga_detector.analyze(dns_f)
    assert res.threat_class == "BENIGN"
    assert res.score < 0.65


# 4. Edge Cases Test (Empty domain, TLD stripping)
def test_dga_edge_cases(dga_detector):
    res_empty = dga_detector.analyze(DNSFeatures(domain_name=""))
    assert res_empty.threat_class == "BENIGN"
    assert res_empty.score == 0.0

    sld = extract_sld("sub.domain.co.uk")
    assert sld == "domain"


# 5. Determinism Test
def test_dga_determinism(dga_detector):
    dns_f = DNSFeatures(domain_name="qwrtyuiop123456x8z.biz", shannon_entropy=4.5, digit_ratio=0.3)
    r1 = dga_detector.analyze(dns_f)
    r2 = dga_detector.analyze(dns_f)
    assert r1.model_dump() == r2.model_dump()


# 6. AST Security test verifying zero DNS resolution or network socket calls
def test_verify_no_dns_resolvers_or_socket_calls_in_dga_detector():
    forbidden_calls = {"gethostbyname", "getaddrinfo", "resolver", "socket", "connect", "send", "requests", "urllib"}
    dga_filepath = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "detection", "dga.py"))

    with open(dga_filepath, "r", encoding="utf-8") as f:
        tree = ast.parse(f.read(), filename=dga_filepath)

    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func_name = None
            if isinstance(node.func, ast.Name):
                func_name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                func_name = node.func.attr

            assert func_name not in forbidden_calls, f"Forbidden network/resolver function '{func_name}' found in {dga_filepath}"


# 7. Detector Contract Verification
def test_dga_detector_contract(dga_detector):
    assert dga_detector.detector_name == "dga_detector"
    assert dga_detector.model_version == "statistical-v1"
