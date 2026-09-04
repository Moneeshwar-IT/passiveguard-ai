import pytest
from app.risk.scoring import normalize_score, map_score_to_severity
from app.risk.fusion import RiskFusionEngine, FusedRiskAssessment
from app.detection.base import DetectionResult


def test_score_normalization():
    assert normalize_score(0.5, 0.0, 1.0) == 0.5
    assert normalize_score(1.5, 0.0, 1.0) == 1.0
    assert normalize_score(-0.5, 0.0, 1.0) == 0.0


def test_severity_mapping():
    assert map_score_to_severity(0.95) == "CRITICAL"
    assert map_score_to_severity(0.75) == "HIGH"
    assert map_score_to_severity(0.50) == "MEDIUM"
    assert map_score_to_severity(0.30) == "LOW"
    assert map_score_to_severity(0.10) == "INFO"


def test_risk_fusion_engine():
    engine = RiskFusionEngine()
    
    r1 = DetectionResult(
        threat_class="DDoS",
        score=0.85,
        severity="HIGH",
        evidence={"packets": 10000},
        detector_name="DDoSDetector"
    )
    r2 = DetectionResult(
        threat_class="C2_Beaconing",
        score=0.90,
        severity="CRITICAL",
        evidence={"periodicity": 0.95},
        detector_name="C2Detector"
    )

    fused = engine.fuse([r1, r2])
    assert isinstance(fused, FusedRiskAssessment)
    assert fused.fused_score > 0.8
    assert fused.severity in ["HIGH", "CRITICAL"]
    assert "C2Detector" in fused.detector_scores
    assert "DDoSDetector" in fused.detector_scores
