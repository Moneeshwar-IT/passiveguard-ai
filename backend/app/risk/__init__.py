"""
Risk module for PassiveGuard AI.
Provides score normalization, severity mapping, and multi-signal risk fusion.
"""
from app.risk.scoring import normalize_score, map_score_to_severity
from app.risk.fusion import RiskFusionEngine, FusedRiskAssessment

__all__ = ["normalize_score", "map_score_to_severity", "RiskFusionEngine", "FusedRiskAssessment"]
