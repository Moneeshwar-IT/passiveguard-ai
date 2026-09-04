import ast
import os
import time
import pytest
from app.detection.base import DetectionResult
from app.risk.fusion import RiskFusionEngine, FusedRiskAssessment, UnifiedThreatAssessment
from app.risk.scoring import normalize_score, map_score_to_severity
from app.alerts.schema import Alert
from app.alerts.manager import AlertManager
from app.alerts.store import AlertStore


@pytest.fixture
def fusion_engine():
    return RiskFusionEngine()


# 1. Empty Detector Results Test
def test_fusion_empty_results(fusion_engine):
    res = fusion_engine.fuse([])
    assert isinstance(res, FusedRiskAssessment)
    assert res.fused_score == 0.0
    assert res.severity == "INFO"
    assert res.primary_threat_class == "BENIGN"
    assert res.corroborating_threats == []


# 2. Single Low-Risk Detector Test
def test_fusion_single_low_risk(fusion_engine):
    r = DetectionResult(
        threat_class="BENIGN",
        score=0.15,
        severity="INFO",
        evidence={"reason": "Low activity"},
        detector_name="recon_detector"
    )
    fused = fusion_engine.fuse([r])
    assert fused.fused_score < 0.25
    assert fused.severity in ["INFO", "LOW"]


# 3. Single High-Risk Detector Test
def test_fusion_single_high_risk(fusion_engine):
    r = DetectionResult(
        threat_class="C2_BEACON",
        score=0.85,
        severity="HIGH",
        evidence={"periodicity": 0.92},
        detector_name="c2_detector"
    )
    fused = fusion_engine.fuse([r])
    assert fused.fused_score >= 0.70
    assert fused.primary_threat_class == "C2_BEACON"


# 4. Single Critical Detector Test
def test_fusion_single_critical(fusion_engine):
    r = DetectionResult(
        threat_class="DDOS_SYN_FLOOD",
        score=0.95,
        severity="CRITICAL",
        evidence={"syn_rate": 5000},
        detector_name="ddos_detector"
    )
    fused = fusion_engine.fuse([r])
    assert fused.fused_score >= 0.88
    assert fused.severity == "CRITICAL"


# 5. Multi-Detector Fusion & Corroboration Bonus Test
def test_fusion_multi_detector_corroboration(fusion_engine):
    r1 = DetectionResult(
        threat_class="C2_BEACON",
        score=0.90,
        severity="CRITICAL",
        evidence={"periodicity": 0.95},
        detector_name="c2_detector"
    )
    r2 = DetectionResult(
        threat_class="ENCRYPTED_MALWARE",
        score=0.85,
        severity="HIGH",
        evidence={"tls_anomaly": 0.88},
        detector_name="tls_detector"
    )

    fused = fusion_engine.fuse([r1, r2])
    assert fused.fused_score >= 0.90
    assert fused.fused_score <= 1.0
    assert fused.primary_threat_class == "C2_BEACON"
    assert "ENCRYPTED_MALWARE" in fused.corroborating_threats


# 6. Three Corroborating Detectors Test
def test_fusion_three_detectors(fusion_engine):
    r1 = DetectionResult(threat_class="DGA_DOMAIN", score=0.80, severity="HIGH", evidence={}, detector_name="dga_detector")
    r2 = DetectionResult(threat_class="DNS_TUNNEL", score=0.85, severity="HIGH", evidence={}, detector_name="dns_tunneling_detector")
    r3 = DetectionResult(threat_class="C2_BEACON", score=0.92, severity="CRITICAL", evidence={}, detector_name="c2_detector")

    fused = fusion_engine.fuse([r1, r2, r3])
    assert fused.fused_score >= 0.92
    assert fused.fused_score <= 1.0
    assert fused.primary_threat_class == "C2_BEACON"
    assert len(fused.corroborating_threats) == 2


# 7. Primary Threat Selection Test
def test_fusion_primary_threat_selection(fusion_engine):
    r_low = DetectionResult(threat_class="RECON_SCAN", score=0.40, severity="LOW", evidence={}, detector_name="recon_detector")
    r_high = DetectionResult(threat_class="DATA_EXFILTRATION", score=0.94, severity="CRITICAL", evidence={}, detector_name="exfiltration_detector")

    fused = fusion_engine.fuse([r_low, r_high])
    assert fused.primary_threat_class == "DATA_EXFILTRATION"


# 8. Confidence vs Risk Separation Test
def test_fusion_confidence_vs_risk_separation(fusion_engine):
    r1 = DetectionResult(threat_class="C2_BEACON", score=0.70, severity="HIGH", evidence={}, detector_name="c2_detector")
    r2 = DetectionResult(threat_class="TLS_MALWARE", score=0.65, severity="MEDIUM", evidence={}, detector_name="tls_detector")

    fused = fusion_engine.fuse([r1, r2])
    assert isinstance(fused.confidence, float)
    assert 0.0 <= fused.confidence <= 1.0
    assert fused.confidence != fused.fused_score


# 9. Order Invariance Test
def test_fusion_order_invariance(fusion_engine):
    r1 = DetectionResult(threat_class="DDoS", score=0.80, severity="HIGH", evidence={}, detector_name="DDoSDetector")
    r2 = DetectionResult(threat_class="C2_Beaconing", score=0.90, severity="CRITICAL", evidence={}, detector_name="C2Detector")

    fused_a = fusion_engine.fuse([r1, r2])
    fused_b = fusion_engine.fuse([r2, r1])

    assert fused_a.fused_score == fused_b.fused_score
    assert fused_a.primary_threat_class == fused_b.primary_threat_class


# 10. Evidence & Model Version Preservation Test
def test_fusion_evidence_preservation(fusion_engine):
    r = DetectionResult(
        threat_class="DGA_DOMAIN",
        score=0.88,
        severity="HIGH",
        evidence={"entropy": 4.5},
        detector_name="dga_detector",
        model_version="statistical-v1"
    )

    fused = fusion_engine.fuse([r])
    assert "dga_detector" in fused.contributing_evidence
    assert fused.contributing_evidence["dga_detector"]["evidence"]["entropy"] == 4.5
    assert fused.model_versions["dga_detector"] == "statistical-v1"


# 11. Alert Deduplication Cooldown Test
def test_alert_deduplication_cooldown():
    manager = AlertManager(cooldown_sec=10.0, store=AlertStore(":memory:"))

    a1 = Alert(
        flow_id="FLOW-DEDUP-1",
        source_ip="10.0.0.5",
        destination_ip="192.168.1.10",
        source_port=54321,
        destination_port=80,
        protocol="TCP",
        threat_class="RECON_SCAN",
        confidence=0.85,
        severity="HIGH",
        detector_name="recon_detector"
    )

    a2 = Alert(
        flow_id="FLOW-DEDUP-2",
        source_ip="10.0.0.5",
        destination_ip="192.168.1.10",
        source_port=54322,
        destination_port=80,
        protocol="TCP",
        threat_class="RECON_SCAN",
        confidence=0.85,
        severity="HIGH",
        detector_name="recon_detector"
    )

    # First alert created
    manager.create_alert(a1, current_time=100.0)
    assert len(manager.get_recent_alerts()) == 1

    # Duplicate alert within cooldown window suppressed
    manager.create_alert(a2, current_time=105.0)
    assert len(manager.get_recent_alerts()) == 1

    # Different threat class for same IP pair allowed immediately
    a3 = Alert(
        flow_id="FLOW-DEDUP-3",
        source_ip="10.0.0.5",
        destination_ip="192.168.1.10",
        source_port=54323,
        destination_port=443,
        protocol="TCP",
        threat_class="ENCRYPTED_MALWARE",
        confidence=0.90,
        severity="CRITICAL",
        detector_name="tls_detector"
    )
    manager.create_alert(a3, current_time=106.0)
    assert len(manager.get_recent_alerts()) == 2

    # After cooldown expires, duplicate threat class allowed
    manager.create_alert(a2, current_time=115.0)
    assert len(manager.get_recent_alerts()) == 3


# 12. Synthetic Multi-Stage Attack Chain Integration Test (Section 19)
def test_multi_stage_attack_chain_integration(fusion_engine):
    # Simulated multi-stage attack detectors outputs:
    # Stage 1: DGA Domain Lookup
    r_dga = DetectionResult(threat_class="DGA_DOMAIN", score=0.82, severity="HIGH", evidence={"sld": "q8z1m4x7v"}, detector_name="dga_detector")
    # Stage 2: DNS Tunnelling
    r_dns = DetectionResult(threat_class="DNS_TUNNEL", score=0.86, severity="HIGH", evidence={"query_len": 65}, detector_name="dns_tunneling_detector")
    # Stage 3: C2 Beaconing
    r_c2 = DetectionResult(threat_class="C2_BEACON", score=0.91, severity="CRITICAL", evidence={"periodicity": 0.94}, detector_name="c2_detector")
    # Stage 4: TLS Encrypted Malware Session
    r_tls = DetectionResult(threat_class="ENCRYPTED_MALWARE", score=0.88, severity="HIGH", evidence={"tls_std_size": 8.0}, detector_name="tls_detector")
    # Stage 5: Data Exfiltration
    r_exfil = DetectionResult(threat_class="DATA_EXFILTRATION", score=0.95, severity="CRITICAL", evidence={"outbound_bytes": 25000000}, detector_name="exfiltration_detector")

    results = [r_dga, r_dns, r_c2, r_tls, r_exfil]

    fused = fusion_engine.fuse(results, flow_id="FLOW-ATTACK-CHAIN", src_ip="10.0.0.50", dst_ip="198.51.100.99")

    assert isinstance(fused, UnifiedThreatAssessment)
    assert fused.fused_score >= 0.95
    assert fused.fused_score <= 1.0
    assert fused.severity == "CRITICAL"
    assert fused.primary_threat_class == "DATA_EXFILTRATION"
    assert len(fused.corroborating_threats) == 4
    assert len(fused.contributing_evidence) == 5
    assert fused.confidence >= 0.80


# 13. Static AST Security Test verifying zero socket/network calls in risk/fusion.py & alerts/manager.py
def test_verify_no_socket_calls_in_risk_fusion_and_alerts():
    forbidden_calls = {"socket", "connect", "send", "sendto", "sendall", "sr", "sr1", "srp", "srp1"}
    files_to_check = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "risk", "fusion.py")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "alerts", "manager.py"))
    ]

    for filepath in files_to_check:
        with open(filepath, "r", encoding="utf-8") as f:
            tree = ast.parse(f.read(), filename=filepath)

        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                func_name = None
                if isinstance(node.func, ast.Name):
                    func_name = node.func.id
                elif isinstance(node.func, ast.Attribute):
                    func_name = node.func.attr

                assert func_name not in forbidden_calls, f"Forbidden call '{func_name}' found in {filepath}"
