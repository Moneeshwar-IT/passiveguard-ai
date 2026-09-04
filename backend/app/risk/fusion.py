"""
PassiveGuard AI — Multi-Detector Risk Fusion & Unified Threat Engine (Module 9)

STRICT PASSIVE CONSTRAINT:
Combines outputs from independent threat detectors (DDoS, C2 Beaconing, DGA, DNS Tunnelling,
Encrypted Malware, Reconnaissance, Data Exfiltration) into a single normalized threat assessment.

Under NO circumstances does it perform active scanning, packet injection, TLS decryption,
or initiate automated blocking/mitigation commands.
"""
import time
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict

from app.detection.base import DetectionResult
from app.risk.scoring import normalize_score, map_score_to_severity

logger = logging.getLogger(__name__)


class FusedRiskAssessment(BaseModel):
    """
    Unified result model for multi-signal risk fusion across threat detectors.
    Maintains backward compatibility with earlier scaffold requirements.
    """
    timestamp: float = Field(default_factory=time.time, description="Unix timestamp of risk fusion assessment")
    flow_id: Optional[str] = Field(default=None, description="Associated flow identifier")
    src_ip: Optional[str] = Field(default=None, description="Observed source IP address")
    dst_ip: Optional[str] = Field(default=None, description="Observed destination IP address")

    fused_score: float = Field(..., ge=0.0, le=1.0, description="Aggregate normalized fused risk score [0.0, 1.0]")
    severity: str = Field(..., description="Mapped severity level: INFO, LOW, MEDIUM, HIGH, CRITICAL")
    confidence: float = Field(default=0.80, ge=0.0, le=1.0, description="Heuristic evidence confidence score [0.0, 1.0]")
    primary_threat_class: str = Field(..., description="Threat class associated with highest detector contribution")
    corroborating_threats: List[str] = Field(default_factory=list, description="Secondary active threat classes corroborating attack")

    contributing_evidence: Dict[str, Any] = Field(default_factory=dict, description="Merged evidence dictionary across detectors")
    detector_scores: Dict[str, float] = Field(default_factory=dict, description="Normalized score breakdown per detector")
    model_versions: Dict[str, str] = Field(default_factory=dict, description="Version tags of contributing detectors")

    @property
    def overall_score(self) -> float:
        """Alias for fused_score for API compatibility."""
        return self.fused_score

    model_config = ConfigDict(arbitrary_types_allowed=True)


# UnifiedThreatAssessment alias for FusedRiskAssessment
UnifiedThreatAssessment = FusedRiskAssessment


class RiskFusionEngine:
    """
    Deterministic multi-detector risk fusion engine.
    Applies weighted max-average hybrid scoring, cross-detector corroboration bonuses,
    and primary threat selection while maintaining strict passive constraints.
    """

    DEFAULT_WEIGHTS: Dict[str, float] = {
        # Class names
        "DDoSDetector": 1.2,
        "C2Detector": 1.5,
        "DGADetector": 1.0,
        "DNSTunnelDetector": 1.1,
        "TLSDetector": 1.1,
        "ReconDetector": 0.8,
        "ExfiltrationDetector": 1.4,
        # Detector string names
        "ddos_detector": 1.2,
        "c2_detector": 1.5,
        "dga_detector": 1.0,
        "dns_tunneling_detector": 1.1,
        "tls_detector": 1.1,
        "recon_detector": 0.8,
        "exfiltration_detector": 1.4
    }

    def __init__(self, weights: Optional[Dict[str, float]] = None):
        self.weights = weights or self.DEFAULT_WEIGHTS

    def fuse(
        self,
        results: List[DetectionResult],
        flow_id: Optional[str] = None,
        src_ip: Optional[str] = None,
        dst_ip: Optional[str] = None
    ) -> FusedRiskAssessment:
        """
        Fuses a list of DetectionResult outputs into a single FusedRiskAssessment.
        """
        if not results:
            return FusedRiskAssessment(
                timestamp=time.time(),
                flow_id=flow_id,
                src_ip=src_ip,
                dst_ip=dst_ip,
                fused_score=0.0,
                severity="INFO",
                confidence=0.0,
                primary_threat_class="BENIGN",
                corroborating_threats=[],
                contributing_evidence={"info": "No detector results provided"},
                detector_scores={},
                model_versions={}
            )

        total_weight = 0.0
        weighted_sum = 0.0
        max_score = 0.0
        primary_threat = "BENIGN"
        combined_evidence: Dict[str, Any] = {}
        scores_map: Dict[str, float] = {}
        model_versions_map: Dict[str, str] = {}
        corroborating_threats_list: List[str] = []

        active_detectors_count = 0

        for res in results:
            weight = self.weights.get(res.detector_name, 1.0)
            norm_s = normalize_score(res.score)

            weighted_sum += norm_s * weight
            total_weight += weight
            scores_map[res.detector_name] = norm_s
            model_versions_map[res.detector_name] = res.model_version

            # Track primary threat class based on peak detector score
            if norm_s > max_score and res.threat_class != "BENIGN":
                max_score = norm_s
                primary_threat = res.threat_class

            # Record corroborating non-benign threat classes
            if norm_s >= 0.50 and res.threat_class != "BENIGN":
                active_detectors_count += 1
                if res.threat_class not in corroborating_threats_list:
                    corroborating_threats_list.append(res.threat_class)

            combined_evidence[res.detector_name] = {
                "score": res.score,
                "severity": res.severity,
                "threat_class": res.threat_class,
                "evidence": res.evidence,
                "model_version": res.model_version
            }

        if primary_threat in corroborating_threats_list:
            corroborating_threats_list.remove(primary_threat)

        avg_score = weighted_sum / total_weight if total_weight > 0 else 0.0

        # Cross-detector corroboration bonus:
        # Multiple independent active detectors (> 1) increase threat confidence
        corroboration_bonus = 0.0
        if active_detectors_count > 1:
            corroboration_bonus = min(0.20, 0.08 * (active_detectors_count - 1))

        # Hybrid fusion: preserve peak detector contribution while allowing corroboration bonus
        raw_fused = (0.6 * max_score) + (0.4 * avg_score) + corroboration_bonus
        fused_score = min(1.0, max(max_score, raw_fused))

        severity = map_score_to_severity(fused_score)

        # Heuristic confidence score based on signal quality & corroboration
        confidence = min(1.0, max(0.20, 0.40 + (0.15 * len(results)) + (0.20 * max_score)))

        return FusedRiskAssessment(
            timestamp=time.time(),
            flow_id=flow_id,
            src_ip=src_ip,
            dst_ip=dst_ip,
            fused_score=round(fused_score, 4),
            severity=severity,
            confidence=round(confidence, 4),
            primary_threat_class=primary_threat,
            corroborating_threats=corroborating_threats_list,
            contributing_evidence=combined_evidence,
            detector_scores=scores_map,
            model_versions=model_versions_map
        )
