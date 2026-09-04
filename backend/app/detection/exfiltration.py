"""
PassiveGuard AI — Passive Data Exfiltration Detector (Module 8)

STRICT PASSIVE CONSTRAINT:
Analyzes observed flow telemetry (directional volume asymmetry, sustained transfer durations,
destination access rarity, and egress transfer persistence) to detect suspicious data exfiltration
patterns using metadata only.

Under NO circumstances does it decrypt TLS/QUIC payloads, inspect application content,
perform socket connections, query external reputation APIs, or transmit network traffic.
"""
import math
import time
import logging
from typing import Any, Dict, List, Optional, Set
from pydantic import BaseModel, Field

from app.detection.base import BaseDetector, DetectionResult
from app.risk.scoring import map_score_to_severity
from app.features.models import FeatureVector
from app.features.flow_features import FlowFeatures

logger = logging.getLogger(__name__)


class ExfiltrationConfig(BaseModel):
    """
    Configurable weights and thresholds for data exfiltration behavioral analysis.
    """
    volume_weight: float = Field(default=0.25, description="Weight for cumulative outbound byte volume score")
    asymmetry_weight: float = Field(default=0.25, description="Weight for directional outbound/inbound byte asymmetry score")
    duration_weight: float = Field(default=0.20, description="Weight for sustained transfer duration score")
    rarity_weight: float = Field(default=0.15, description="Weight for destination rarity score")
    persistence_weight: float = Field(default=0.15, description="Weight for repeated transfer persistence score")
    min_outbound_bytes: int = Field(default=50_000, description="Minimum outbound bytes (50 KB) required for exfiltration analysis")
    alert_threshold: float = Field(default=0.65, description="Minimum fused score to declare DATA_EXFILTRATION")


class ExfiltrationStateTracker:
    """
    Bounded streaming state tracker for data exfiltration telemetry.
    Tracks cumulative directional byte volumes per (source_ip, destination_ip) pair
    and maintains local destination access frequency for rarity estimation.
    """

    def __init__(self, max_history: int = 100, state_timeout: float = 3600.0):
        self.max_history = max_history
        self.state_timeout = state_timeout
        # Key: (src_ip, dst_ip) -> dict of tracking state
        self._pair_state: Dict[tuple, Dict[str, Any]] = {}
        # Key: dst_ip -> total connection frequency count across enclave
        self._dest_freq: Dict[str, int] = {}
        self._last_access: Dict[tuple, float] = {}

    def add_flow(
        self,
        src_ip: str,
        dst_ip: str,
        outbound_bytes: int,
        inbound_bytes: int,
        duration: float,
        timestamp: float
    ) -> None:
        """Records a flow observation into bounded state for a given (src_ip, dst_ip) pair."""
        pair_key = (src_ip, dst_ip)
        self._last_access[pair_key] = timestamp

        # Global local destination access counter
        self._dest_freq[dst_ip] = self._dest_freq.get(dst_ip, 0) + 1

        if pair_key not in self._pair_state:
            self._pair_state[pair_key] = {
                "outbound_total": 0,
                "inbound_total": 0,
                "total_duration": 0.0,
                "flow_count": 0,
                "history": []
            }

        st = self._pair_state[pair_key]
        st["outbound_total"] += outbound_bytes
        st["inbound_total"] += inbound_bytes
        st["total_duration"] += duration
        st["flow_count"] += 1

        history = st["history"]
        history.append((outbound_bytes, inbound_bytes, duration, timestamp))
        if len(history) > self.max_history:
            st["history"] = history[-self.max_history:]

    def evict_stale_state(self, current_time: Optional[float] = None) -> int:
        """Evicts stale pair tracking state exceeding state_timeout."""
        now = current_time or time.time()
        stale_keys = [k for k, last_t in self._last_access.items() if (now - last_t) > self.state_timeout]
        for k in stale_keys:
            del self._pair_state[k]
            del self._last_access[k]
        return len(stale_keys)

    def get_summary(self, src_ip: str, dst_ip: str) -> Dict[str, Any]:
        """Calculates summary statistics for a given (src_ip, dst_ip) pair."""
        pair_key = (src_ip, dst_ip)
        st = self._pair_state.get(pair_key)
        dest_total_hits = self._dest_freq.get(dst_ip, 0)

        if not st or not st["history"]:
            return {
                "outbound_total": 0,
                "inbound_total": 0,
                "total_duration": 0.0,
                "flow_count": 0,
                "dest_total_hits": dest_total_hits,
                "first_seen": 0.0,
                "last_seen": 0.0
            }

        history = st["history"]
        return {
            "outbound_total": st["outbound_total"],
            "inbound_total": st["inbound_total"],
            "total_duration": st["total_duration"],
            "flow_count": st["flow_count"],
            "dest_total_hits": dest_total_hits,
            "first_seen": history[0][3],
            "last_seen": history[-1][3]
        }


class ExfiltrationDetector(BaseDetector):
    """
    Passive Data Exfiltration Detector.
    Identifies suspicious egress volume transfers, directional asymmetries, and destination rarity using metadata.
    """

    def __init__(self, config: Optional[ExfiltrationConfig] = None, state_tracker: Optional[ExfiltrationStateTracker] = None):
        self.config = config or ExfiltrationConfig()
        self.state_tracker = state_tracker or ExfiltrationStateTracker()

    @property
    def detector_name(self) -> str:
        return "exfiltration_detector"

    @property
    def model_version(self) -> str:
        return "statistical-exfil-v1"

    def _extract_feature_dict(self, features: Any) -> Dict[str, Any]:
        """Extracts standard feature dictionary from FeatureVector, FlowFeatures, or dict."""
        if isinstance(features, FeatureVector):
            d = features.model_dump()
            # If directional fields present, map outbound/inbound bytes
            outbound = d.get("direction_src_to_dst_bytes")
            inbound = d.get("direction_dst_to_src_bytes")
            if outbound is None:
                outbound = d.get("flow_byte_count", 0)
            if inbound is None:
                inbound = 0
            d["outbound_bytes"] = outbound
            d["inbound_bytes"] = inbound
            d["duration"] = d.get("flow_duration", 0.0)
            return d
        elif isinstance(features, FlowFeatures):
            return {
                "src_ip": getattr(features, "src_ip", "10.0.0.1"),
                "dst_ip": getattr(features, "dst_ip", "192.168.1.1"),
                "outbound_bytes": getattr(features, "bytes_sent", getattr(features, "byte_count", 0)),
                "inbound_bytes": getattr(features, "bytes_received", 0),
                "duration": getattr(features, "duration", 0.0)
            }
        elif isinstance(features, dict):
            d = dict(features)
            outbound = d.get("outbound_bytes")
            if outbound is None:
                outbound = d.get("direction_src_to_dst_bytes") or d.get("src_bytes") or d.get("flow_byte_count") or d.get("byte_count", 0)
            inbound = d.get("inbound_bytes")
            if inbound is None:
                inbound = d.get("direction_dst_to_src_bytes") or d.get("dst_bytes") or 0
            d["outbound_bytes"] = outbound
            d["inbound_bytes"] = inbound
            if "duration" not in d:
                d["duration"] = d.get("flow_duration", d.get("duration", 0.0))
            return d
        elif hasattr(features, "__dict__"):
            d = dict(features.__dict__)
            if hasattr(features, "byte_count"):
                d["outbound_bytes"] = getattr(features, "byte_count")
            if hasattr(features, "duration"):
                d["duration"] = getattr(features, "duration")
            return d
        return {}

    def analyze(self, features: Any) -> DetectionResult:
        """
        Analyzes passive flow telemetry for data exfiltration indicators.
        """
        fdict = self._extract_feature_dict(features)

        src_ip = str(fdict.get("src_ip", "10.0.0.1"))
        dst_ip = str(fdict.get("dst_ip", "192.168.1.1"))
        out_bytes = int(fdict.get("outbound_bytes", 0))
        in_bytes = int(fdict.get("inbound_bytes", 0))
        duration = float(fdict.get("duration", 0.0))
        timestamp = float(fdict.get("timestamp", time.time()))

        # Record flow entry into state tracker
        self.state_tracker.add_flow(
            src_ip=src_ip,
            dst_ip=dst_ip,
            outbound_bytes=out_bytes,
            inbound_bytes=in_bytes,
            duration=duration,
            timestamp=timestamp
        )

        # Retrieve (src_ip, dst_ip) summary statistics
        summary = self.state_tracker.get_summary(src_ip, dst_ip)
        cum_outbound = summary["outbound_total"]
        cum_inbound = summary["inbound_total"]
        cum_duration = summary["total_duration"]
        flow_count = summary["flow_count"]
        dest_hits = summary["dest_total_hits"]

        # INSUFFICIENT CONTEXT GUARD:
        # Fewer than min_outbound_bytes (< 50 KB) cannot establish an exfiltration profile
        if cum_outbound < self.config.min_outbound_bytes:
            return DetectionResult(
                threat_class="BENIGN",
                score=0.05,
                severity="INFO",
                evidence={
                    "insufficient_exfiltration_context": True,
                    "outbound_bytes": cum_outbound,
                    "min_required_bytes": self.config.min_outbound_bytes,
                    "reasons": [f"Insufficient outbound volume ({cum_outbound} B < {self.config.min_outbound_bytes} B) to establish data exfiltration profile"]
                },
                detector_name=self.detector_name,
                model_version=self.model_version
            )

        # 1. Outbound Volume Sub-Score
        volume_sub = 0.0
        if cum_outbound >= 50_000_000:  # >= 50 MB
            volume_sub = 0.95
        elif cum_outbound >= 10_000_000:  # >= 10 MB
            volume_sub = 0.80
        elif cum_outbound >= 1_000_000:  # >= 1 MB
            volume_sub = 0.50
        elif cum_outbound >= 100_000:  # >= 100 KB
            volume_sub = 0.25
        volume_sub = max(0.0, min(1.0, volume_sub))

        # 2. Directional Asymmetry Sub-Score (outbound / max(inbound, 1))
        asym_ratio = cum_outbound / max(cum_inbound, 1)
        asym_sub = 0.0
        if asym_ratio >= 200.0:
            asym_sub = 0.95
        elif asym_ratio >= 50.0:
            asym_sub = 0.85
        elif asym_ratio >= 10.0:
            asym_sub = 0.50
        elif asym_ratio >= 3.0:
            asym_sub = 0.20
        asym_sub = max(0.0, min(1.0, asym_sub))

        # 3. Transfer Duration Sub-Score
        duration_sub = 0.0
        if cum_duration >= 300.0:  # >= 5 mins
            duration_sub = 0.95
        elif cum_duration >= 60.0:  # >= 1 min
            duration_sub = 0.75
        elif cum_duration >= 10.0:
            duration_sub = 0.40
        duration_sub = max(0.0, min(1.0, duration_sub))

        # 4. Destination Rarity Sub-Score (based on locally observed destination hits)
        rarity_sub = 0.0
        if dest_hits <= 2:
            rarity_sub = 0.85
        elif dest_hits <= 5:
            rarity_sub = 0.45
        else:
            rarity_sub = 0.10

        # 5. Persistence Sub-Score (repeated outbound transfers to same destination)
        persistence_sub = 0.0
        if flow_count >= 5:
            persistence_sub = 0.90
        elif flow_count >= 3:
            persistence_sub = 0.60
        elif flow_count >= 2:
            persistence_sub = 0.30

        # Weighted Sub-Score Fusion
        w_v = self.config.volume_weight
        w_a = self.config.asymmetry_weight
        w_d = self.config.duration_weight
        w_r = self.config.rarity_weight
        w_p = self.config.persistence_weight

        total_weight = w_v + w_a + w_d + w_r + w_p
        weighted_sum = (
            (volume_sub * w_v) +
            (asym_sub * w_a) +
            (duration_sub * w_d) +
            (rarity_sub * w_r) +
            (persistence_sub * w_p)
        )

        fused_score = round(min(1.0, max(0.0, weighted_sum / total_weight)), 4) if total_weight > 0 else 0.0

        # FALSE-POSITIVE PROTECTION:
        # High volume alone (e.g. backup, video stream upload, cloud sync) without asymmetry or rarity
        # MUST NOT trigger a high critical exfiltration alert. Cap score conservatively.
        if volume_sub >= 0.70 and asym_sub < 0.30 and rarity_sub < 0.30:
            fused_score = min(fused_score, 0.45)

        # Human-readable evidence reasons
        reasons = []
        if volume_sub >= 0.70:
            reasons.append(f"Elevated egress data transfer volume ({cum_outbound / 1e6:.2f} MB)")
        if asym_sub >= 0.70:
            reasons.append(f"Strong directional byte asymmetry (outbound/inbound ratio: {asym_ratio:.2f})")
        if duration_sub >= 0.70:
            reasons.append(f"Sustained egress transfer duration ({cum_duration:.1f} s)")
        if rarity_sub >= 0.70:
            reasons.append(f"Rare destination IP observed in enclave history ({dest_hits} hits)")
        if persistence_sub >= 0.60:
            reasons.append(f"Repeated outbound transfer persistence ({flow_count} flows)")

        # Threat classification
        threat_class = "BENIGN"
        if fused_score >= self.config.alert_threshold and cum_outbound >= self.config.min_outbound_bytes:
            threat_class = "DATA_EXFILTRATION"

        severity = map_score_to_severity(fused_score)

        evidence: Dict[str, Any] = {
            "outbound_bytes": cum_outbound,
            "inbound_bytes": cum_inbound,
            "outbound_inbound_ratio": round(asym_ratio, 2),
            "total_transfer_duration": round(cum_duration, 2),
            "destination_hits": dest_hits,
            "repeat_flow_count": flow_count,
            "sub_scores": {
                "volume": round(volume_sub, 2),
                "asymmetry": round(asym_sub, 2),
                "duration": round(duration_sub, 2),
                "destination_rarity": round(rarity_sub, 2),
                "persistence": round(persistence_sub, 2)
            },
            "reasons": reasons if reasons else ["Normal balanced enterprise data flow"]
        }

        return DetectionResult(
            threat_class=threat_class,
            score=fused_score,
            severity=severity,
            evidence=evidence,
            detector_name=self.detector_name,
            model_version=self.model_version
        )
