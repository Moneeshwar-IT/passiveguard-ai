"""
Risk Scoring & Score Normalization Module.

DOCUMENTED SCORING ASSUMPTIONS:
1. Raw detector scores output by individual engines are uncalibrated anomaly scores bounded in [0.0, 1.0].
2. Raw scores DO NOT represent calibrated posterior probabilities until formal Platt scaling or Isotonic regression is applied.
3. Severity thresholds map scores into 5 standardized operational buckets:
   - 0.00 <= score < 0.20: INFO
   - 0.20 <= score < 0.45: LOW
   - 0.45 <= score < 0.70: MEDIUM
   - 0.70 <= score < 0.88: HIGH
   - 0.88 <= score <= 1.00: CRITICAL
"""
import logging
from typing import Dict

logger = logging.getLogger(__name__)


def normalize_score(raw_score: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
    """
    Normalizes a raw detection score into a standard [0.0, 1.0] range using min-max scaling.
    """
    if max_val <= min_val:
        return 0.0
    clamped = max(min_val, min(max_val, raw_score))
    return (clamped - min_val) / (max_val - min_val)


def map_score_to_severity(score: float) -> str:
    """
    Maps a normalized risk score [0.0, 1.0] to a human-readable severity level.
    """
    if score >= 0.88:
        return "CRITICAL"
    elif score >= 0.70:
        return "HIGH"
    elif score >= 0.45:
        return "MEDIUM"
    elif score >= 0.20:
        return "LOW"
    return "INFO"
