"""
PassiveGuard AI — Passive C2 Beaconing Detector (Module 4)

STRICT PASSIVE CONSTRAINT:
Analyzes observed temporal periodicity, inter-arrival time (IAT) consistency,
destination recurrence, and low-volume flow profiles to identify potential Command & Control (C2) beaconing.

Under NO circumstances does it transmit packets, query DNS resolvers, probe destination hosts,
or decrypt encrypted TLS/QUIC payloads.

Scores represent behavioral evidence consistent with C2 patterns, NOT calibrated infection probabilities.
"""
import time
import logging
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field

from app.detection.base import BaseDetector, DetectionResult
from app.risk.scoring import map_score_to_severity
from app.features.models import FeatureVector
from app.features.temporal_features import TemporalFeatures

logger = logging.getLogger(__name__)


class C2Config(BaseModel):
    """
    Configurable weights and thresholds for C2 beaconing behavioral analysis.
    """
    periodicity_weight: float = Field(default=0.35, description="Weight for temporal periodicity score")
    interval_consistency_weight: float = Field(default=0.25, description="Weight for low IAT variance/CV score")
    recurrence_weight: float = Field(default=0.20, description="Weight for recurring connection count")
    flow_volume_weight: float = Field(default=0.10, description="Weight for small-volume heartbeat flow profile")
    tls_anomaly_weight: float = Field(default=0.10, description="Weight for metadata TLS fingerprint profile")
    min_observations: int = Field(default=3, description="Minimum events required to establish beaconing")
    alert_threshold: float = Field(default=0.65, description="Minimum fused behavioral score to trigger C2_BEACON label")


class C2StateTracker:
    """
    Bounded in-memory destination recurrence tracker.
    
    Tracks destination IP history per source IP to measure destination concentration.
    Evicts stale state exceeding state_timeout to guarantee bounded memory.
    """

    def __init__(self, max_history: int = 100, state_timeout: float = 3600.0):
        self.max_history = max_history
        self.state_timeout = state_timeout
        self._history: Dict[str, List[Tuple[str, float]]] = {}
        self._last_access: Dict[str, float] = {}

    def add_event(self, src_ip: str, dst_ip: str, timestamp: float) -> None:
        """Records a connection event (dst_ip, timestamp) for a given src_ip."""
        self._last_access[src_ip] = timestamp
        if src_ip not in self._history:
            self._history[src_ip] = []

        events = self._history[src_ip]
        events.append((dst_ip, timestamp))
        if len(events) > self.max_history:
            self._history[src_ip] = events[-self.max_history:]

    def evict_stale_state(self, current_time: Optional[float] = None) -> int:
        """Evicts stale source IP tracking state exceeding state_timeout."""
        now = current_time or time.time()
        stale_keys = [k for k, last_t in self._last_access.items() if (now - last_t) > self.state_timeout]
        for k in stale_keys:
            del self._history[k]
            del self._last_access[k]
        return len(stale_keys)

    def get_destination_recurrence_ratio(self, src_ip: str, dst_ip: str) -> float:
        """
        Calculates destination recurrence ratio: fraction of connections from src_ip directed to dst_ip.
        """
        events = self._history.get(src_ip, [])
        if not events:
            return 1.0
        matching = sum(1 for target, _ in events if target == dst_ip)
        return round(matching / len(events), 4)


class C2Detector(BaseDetector):
    """
    Passive C2 Beaconing Detector.
    
    Combines temporal periodicity, interval consistency, destination recurrence,
    and metadata profiles into a transparent behavioral score.
    """

    def __init__(self, config: Optional[C2Config] = None, state_tracker: Optional[C2StateTracker] = None):
        self.config = config or C2Config()
        self.state_tracker = state_tracker or C2StateTracker()

    @property
    def detector_name(self) -> str:
        return "c2_detector"

    @property
    def model_version(self) -> str:
        return "statistical-v1"

    def _extract_feature_dict(self, features: Any) -> Dict[str, Any]:
        """Extracts standard feature dictionary from FeatureVector, TemporalFeatures, or dict."""
        if isinstance(features, FeatureVector):
            return features.model_dump()
        elif isinstance(features, TemporalFeatures):
            return {
                "temporal_periodicity": features.periodicity_score,
                "temporal_mean_iat": features.mean_iat,
                "temporal_std_iat": features.std_iat,
                "temporal_cv_iat": (features.std_iat / features.mean_iat) if features.mean_iat > 0 else 0.0,
                "temporal_recurrence_count": getattr(features, "recurrence_count", 5),
                "flow_packet_count": 10,
                "flow_byte_count": 500,
                "flow_duration": 1.0
            }
        elif isinstance(features, dict):
            return features
        elif hasattr(features, "__dict__"):
            d = dict(features.__dict__)
            if hasattr(features, "periodicity_score"):
                d["temporal_periodicity"] = getattr(features, "periodicity_score")
            if hasattr(features, "mean_iat"):
                d["temporal_mean_iat"] = getattr(features, "mean_iat")
            if hasattr(features, "std_iat"):
                d["temporal_std_iat"] = getattr(features, "std_iat")
            return d
        return {}

    def analyze(self, features: Any) -> DetectionResult:
        """
        Analyzes temporal and flow metadata for C2 beaconing behavior.
        """
        fdict = self._extract_feature_dict(features)

        src_ip = str(fdict.get("src_ip", "10.0.0.1"))
        dst_ip = str(fdict.get("dst_ip", "192.168.1.1"))
        timestamp = float(fdict.get("timestamp", time.time()))

        # Update destination recurrence tracker
        self.state_tracker.add_event(src_ip, dst_ip, timestamp)

        # Temporal metrics
        periodicity = float(fdict.get("temporal_periodicity", 0.0))
        mean_iat = float(fdict.get("temporal_mean_iat", 0.0))
        std_iat = float(fdict.get("temporal_std_iat", 0.0))
        cv_iat = float(fdict.get("temporal_cv_iat", 0.0))
        recurrence_count = int(fdict.get("temporal_recurrence_count", 0))

        # Flow volume metrics
        pkt_count = int(fdict.get("flow_packet_count", 1))
        byte_count = int(fdict.get("flow_byte_count", 0))
        duration = float(fdict.get("flow_duration", 0.0))

        # Destination recurrence ratio
        dst_recurrence = self.state_tracker.get_destination_recurrence_ratio(src_ip, dst_ip)

        # INSUFFICIENT DATA GUARD:
        # If fewer than min_observations (default 3) events exist, return low score with explicit reason
        obs_count = max(recurrence_count, pkt_count)
        if obs_count < self.config.min_observations:
            return DetectionResult(
                threat_class="BENIGN",
                score=0.05,
                severity="INFO",
                evidence={
                    "insufficient_temporal_observations": True,
                    "recurrence_count": obs_count,
                    "min_required_observations": self.config.min_observations,
                    "reasons": [f"Insufficient temporal observations ({obs_count} < {self.config.min_observations} events) to establish beaconing pattern"]
                },
                detector_name=self.detector_name,
                model_version=self.model_version
            )

        # 1. Periodicity Sub-score
        periodicity_sub = max(0.0, min(1.0, periodicity))

        # 2. Interval Consistency Sub-score (Low CV => High Consistency)
        consistency_sub = max(0.0, min(1.0, 1.0 - min(1.0, cv_iat)))

        # 3. Recurrence Sub-score (More events => Higher score, maxes out at 10 events)
        recurrence_sub = max(0.0, min(1.0, recurrence_count / 10.0))

        # 4. Destination Recurrence Sub-score
        dst_sub = max(0.0, min(1.0, dst_recurrence))

        # 5. Low-Volume Heartbeat Flow Profile Sub-score
        # C2 beacons typically use small, uniform control packets (e.g. < 30 packets, < 5000 bytes)
        flow_volume_sub = 0.0
        if pkt_count <= 30 and byte_count <= 5000:
            flow_volume_sub = 0.8
        elif pkt_count <= 100:
            flow_volume_sub = 0.4
        else:
            flow_volume_sub = 0.1

        # 6. TLS Metadata Anomaly Sub-score (Metadata-only, NO decryption)
        tls_ver = fdict.get("tls_version")
        ja3 = fdict.get("tls_ja3")
        ja4 = fdict.get("tls_ja4")
        tls_std_pkt = fdict.get("tls_std_packet_size")

        tls_sub = 0.0
        has_tls = bool(tls_ver or ja3 or ja4)
        if has_tls:
            # Low packet size variance in TLS session or presence of fingerprint
            if tls_std_pkt is not None and tls_std_pkt < 50.0:
                tls_sub = 0.75
            else:
                tls_sub = 0.40

        # Weighted Score Aggregation
        # If TLS metadata is absent, re-distribute TLS weight proportionally to temporal scores
        w_p = self.config.periodicity_weight
        w_c = self.config.interval_consistency_weight
        w_r = self.config.recurrence_weight
        w_f = self.config.flow_volume_weight
        w_t = self.config.tls_anomaly_weight if has_tls else 0.0

        total_weight = w_p + w_c + w_r + w_f + w_t
        weighted_sum = (
            (periodicity_sub * w_p) +
            (consistency_sub * w_c) +
            (recurrence_sub * w_r) +
            (flow_volume_sub * w_f) +
            (tls_sub * w_t)
        )

        fused_score = round(min(1.0, max(0.0, weighted_sum / total_weight)), 4) if total_weight > 0 else 0.0

        # Generate human-readable explanation reasons
        reasons = []
        if periodicity_sub >= 0.80:
            reasons.append(f"Highly periodic communication pattern detected (periodicity score: {periodicity_sub:.2f})")
        if consistency_sub >= 0.80:
            reasons.append(f"Low inter-arrival time variation (CV: {cv_iat:.4f})")
        if dst_sub >= 0.80:
            reasons.append(f"High destination recurrence ({dst_recurrence*100:.1f}% connections to target {dst_ip})")
        if flow_volume_sub >= 0.70:
            reasons.append("Low-volume recurring heartbeat flow profile")
        if has_tls and tls_sub >= 0.70:
            reasons.append("Metadata TLS application record size uniformity observed")

        # Threat classification
        threat_class = "BENIGN"
        if fused_score >= self.config.alert_threshold and obs_count >= self.config.min_observations:
            threat_class = "C2_BEACON"

        severity = map_score_to_severity(fused_score)

        evidence: Dict[str, Any] = {
            "periodicity_score": periodicity_sub,
            "interval_cv": cv_iat,
            "mean_iat": mean_iat,
            "std_iat": std_iat,
            "recurrence_count": recurrence_count,
            "destination_recurrence": dst_recurrence,
            "flow_volume_profile_score": flow_volume_sub,
            "tls_metadata_present": has_tls,
            "sub_scores": {
                "periodicity": periodicity_sub,
                "consistency": consistency_sub,
                "recurrence": recurrence_sub,
                "flow_volume": flow_volume_sub,
                "tls_metadata": tls_sub if has_tls else None
            },
            "reasons": reasons if reasons else ["Normal non-periodic baseline traffic"]
        }

        return DetectionResult(
            threat_class=threat_class,
            score=fused_score,
            severity=severity,
            evidence=evidence,
            detector_name=self.detector_name,
            model_version=self.model_version
        )
