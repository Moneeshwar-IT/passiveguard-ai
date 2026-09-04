"""
PassiveGuard AI — Algorithmically Generated Domain (DGA) Detector (Module 5)

STRICT PASSIVE CONSTRAINT:
Analyzes DNS query lexical metadata (entropy, length, digit ratio, character distributions)
to identify algorithmically generated domain names (DGA).

Under NO circumstances does it perform live DNS resolutions, contact external reputation APIs,
or transmit network packets.
"""
import re
import math
import logging
from typing import Any, Dict, Optional, List
from pydantic import BaseModel, Field

from app.detection.base import BaseDetector, DetectionResult
from app.risk.scoring import map_score_to_severity
from app.features.models import FeatureVector
from app.features.dns_features import DNSFeatures, calculate_shannon_entropy

logger = logging.getLogger(__name__)

SECOND_LEVEL_PREFIXES = {"co", "com", "org", "gov", "edu", "net", "ac", "ne", "or", "gen"}


def extract_sld(domain: str) -> str:
    """
    Extracts Second-Level Domain (SLD) or primary domain label.
    Strips top-level domains (.com, .org, .example, .co.uk) so fixed TLD strings
    do not skew entropy and length statistics.
    """
    if not domain:
        return ""
    clean_domain = domain.lower().strip().rstrip(".")
    parts = clean_domain.split(".")

    if len(parts) == 1:
        return parts[0]

    # Handle multi-part country TLDs e.g. domain.co.uk
    if len(parts) >= 3 and parts[-2] in SECOND_LEVEL_PREFIXES:
        return parts[-3]

    # Standard TLD e.g. domain.com or domain.example
    return parts[-2]


class DGAConfig(BaseModel):
    """
    Configurable weights and thresholds for DGA domain lexical detection.
    """
    entropy_weight: float = Field(default=0.35, description="Weight for Shannon entropy H(X) score")
    length_weight: float = Field(default=0.25, description="Weight for domain query length score")
    digit_ratio_weight: float = Field(default=0.20, description="Weight for numeric digit ratio score")
    lexical_anomaly_weight: float = Field(default=0.20, description="Weight for consonant/unique char anomaly score")
    alert_threshold: float = Field(default=0.60, description="Minimum score to declare DGA_DOMAIN detection")


class DGADetector(BaseDetector):
    """
    Passive DGA Threat Detector.
    Identifies algorithmically generated domains using multi-feature lexical analysis.
    """

    def __init__(self, config: Optional[DGAConfig] = None):
        self.config = config or DGAConfig()

    @property
    def detector_name(self) -> str:
        return "dga_detector"

    @property
    def model_version(self) -> str:
        return "statistical-v1"

    def _extract_feature_dict(self, features: Any) -> Dict[str, Any]:
        """Extracts standard feature dictionary from FeatureVector, DNSFeatures, or dict."""
        if isinstance(features, FeatureVector):
            return features.model_dump()
        elif isinstance(features, DNSFeatures):
            sub_count = getattr(features, "subdomain_count", 0) or 0
            return {
                "domain_name": features.domain_name,
                "dns_query_length": features.dns_query_length or features.domain_length,
                "dns_entropy": features.dns_entropy if features.dns_entropy is not None else features.shannon_entropy,
                "dns_digit_ratio": features.dns_digit_ratio if features.dns_digit_ratio is not None else getattr(features, "digit_ratio", 0.0),
                "dns_label_count": sub_count + 1,
                "dns_unique_character_ratio": getattr(features, "unique_character_ratio", 0.7)
            }
        elif isinstance(features, dict):
            return features
        elif hasattr(features, "__dict__"):
            d = dict(features.__dict__)
            if hasattr(features, "domain_name"):
                d["domain_name"] = getattr(features, "domain_name")
            if hasattr(features, "dns_entropy") and getattr(features, "dns_entropy") is not None:
                d["dns_entropy"] = getattr(features, "dns_entropy")
            elif hasattr(features, "shannon_entropy"):
                d["dns_entropy"] = getattr(features, "shannon_entropy")
            if hasattr(features, "dns_digit_ratio") and getattr(features, "dns_digit_ratio") is not None:
                d["dns_digit_ratio"] = getattr(features, "dns_digit_ratio")
            elif hasattr(features, "digit_ratio"):
                d["dns_digit_ratio"] = getattr(features, "digit_ratio")
            return d
        return {}

    def analyze(self, features: Any) -> DetectionResult:
        """
        Analyzes DNS query lexical features for DGA signatures.
        """
        fdict = self._extract_feature_dict(features)

        domain_name = str(fdict.get("domain_name") or fdict.get("dns_query_name") or "")
        sld = extract_sld(domain_name)
        sld_len = len(sld)

        # 1. Entropy Sub-Score (SLD Shannon Entropy)
        entropy = fdict.get("dns_entropy")
        if entropy is None:
            entropy = calculate_shannon_entropy(sld) if sld else 0.0
        else:
            entropy = float(entropy)

        # Normal SLDs typically exhibit entropy in 2.2 - 3.2. DGA domains exceed 3.2
        entropy_sub = 0.0
        if entropy > 4.0:
            entropy_sub = 1.0
        elif entropy > 3.0:
            entropy_sub = (entropy - 3.0) / 1.0
        else:
            entropy_sub = 0.0
        entropy_sub = max(0.0, min(1.0, entropy_sub))

        # 2. Length Sub-Score
        raw_len = fdict.get("dns_query_length")
        query_len = int(raw_len) if raw_len is not None else len(domain_name)

        length_sub = 0.0
        if sld_len > 20:
            length_sub = 1.0
        elif sld_len > 8:
            length_sub = (sld_len - 8) / 12.0
        length_sub = max(0.0, min(1.0, length_sub))

        # 3. Digit Ratio Sub-Score
        digit_ratio = fdict.get("dns_digit_ratio")
        if digit_ratio is None and sld:
            digits = sum(1 for c in sld if c.isdigit())
            digit_ratio = digits / len(sld)
        elif digit_ratio is not None:
            digit_ratio = float(digit_ratio)
        else:
            digit_ratio = 0.0

        digit_sub = 0.0
        if digit_ratio > 0.35:
            digit_sub = 1.0
        elif digit_ratio > 0.15:
            digit_sub = (digit_ratio - 0.15) / 0.20
        digit_sub = max(0.0, min(1.0, digit_sub))

        # 4. Lexical Anomaly Sub-Score (Vowel ratio & Unique Char ratio)
        unique_char_ratio = fdict.get("dns_unique_character_ratio")
        if unique_char_ratio is None and sld:
            unique_char_ratio = len(set(sld)) / len(sld)
        elif unique_char_ratio is not None:
            unique_char_ratio = float(unique_char_ratio)
        else:
            unique_char_ratio = 0.8

        vowels = sum(1 for c in sld.lower() if c in "aeiou")
        vowel_ratio = vowels / len(sld) if sld else 0.3

        lexical_sub = 0.0
        if unique_char_ratio > 0.85 and (vowel_ratio < 0.15 or vowel_ratio > 0.65):
            lexical_sub = 0.90
        elif unique_char_ratio > 0.75:
            lexical_sub = 0.50

        # Weighted Score Aggregation
        w_e = self.config.entropy_weight
        w_l = self.config.length_weight
        w_d = self.config.digit_ratio_weight
        w_x = self.config.lexical_anomaly_weight

        total_weight = w_e + w_l + w_d + w_x
        weighted_sum = (
            (entropy_sub * w_e) +
            (length_sub * w_l) +
            (digit_sub * w_d) +
            (lexical_sub * w_x)
        )

        fused_score = round(min(1.0, max(0.0, weighted_sum / total_weight)), 4) if total_weight > 0 else 0.0

        # Human-readable evidence reasons
        reasons = []
        if entropy_sub >= 0.70:
            reasons.append(f"High domain lexical entropy (H(X) = {entropy:.2f})")
        if length_sub >= 0.70:
            reasons.append(f"Unusual domain label length ({sld_len} characters in SLD)")
        if digit_sub >= 0.70:
            reasons.append(f"Abnormal numeric digit ratio ({digit_ratio*100:.1f}%)")
        if lexical_sub >= 0.70:
            reasons.append(f"Lexical distribution anomaly (vowel ratio: {vowel_ratio:.2f}, unique ratio: {unique_char_ratio:.2f})")

        # Threat classification
        threat_class = "BENIGN"
        if fused_score >= self.config.alert_threshold:
            threat_class = "DGA_DOMAIN"

        severity = map_score_to_severity(fused_score)

        evidence: Dict[str, Any] = {
            "domain_name": domain_name,
            "sld_analyzed": sld,
            "dns_entropy": round(entropy, 2),
            "dns_query_length": query_len,
            "dns_digit_ratio": round(digit_ratio, 2),
            "lexical_anomaly_score": round(lexical_sub, 2),
            "sub_scores": {
                "entropy": round(entropy_sub, 2),
                "length": round(length_sub, 2),
                "digit_ratio": round(digit_sub, 2),
                "lexical_anomaly": round(lexical_sub, 2)
            },
            "reasons": reasons if reasons else ["Normal domain lexical distribution"]
        }

        return DetectionResult(
            threat_class=threat_class,
            score=fused_score,
            severity=severity,
            evidence=evidence,
            detector_name=self.detector_name,
            model_version=self.model_version
        )
