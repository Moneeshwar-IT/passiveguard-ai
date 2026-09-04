"""
PassiveGuard AI — Hybrid Reconnaissance & Port Scanning Detector (Module 7 & Module 16 ML Integration)

STRICT PASSIVE CONSTRAINT:
Analyzes observed flow telemetry (destination fan-out, port fan-out, TCP SYN probe ratios, short flow durations)
and Layer B Machine Learning inference (RandomForest model trained on UNSW-NB15) to detect reconnaissance probing.

Under NO circumstances does it initiate network scans, transmit SYN probes, perform service discovery,
or query external reputation APIs.
"""
import os
import time
import logging
from typing import Any, Dict, List, Optional, Set, Tuple
from pydantic import BaseModel, Field

from app.detection.base import BaseDetector, DetectionResult
from app.risk.scoring import map_score_to_severity
from app.features.models import FeatureVector
from app.features.flow_features import FlowFeatures
from app.ml.inference import MLInferenceEngine, MLPrediction

logger = logging.getLogger(__name__)


class ReconConfig(BaseModel):
    """
    Configurable weights and thresholds for reconnaissance & port scan behavioral analysis.
    """
    port_fanout_weight: float = Field(default=0.30, description="Weight for unique destination port count score")
    destination_fanout_weight: float = Field(default=0.30, description="Weight for unique destination IP count score")
    syn_scan_weight: float = Field(default=0.20, description="Weight for unanswered SYN probe ratio score")
    short_flow_weight: float = Field(default=0.10, description="Weight for short-lived flow ratio score")
    connection_rate_weight: float = Field(default=0.10, description="Weight for connection attempt frequency score")
    min_connections: int = Field(default=3, description="Minimum observed connections required to establish scan profile")
    alert_threshold: float = Field(default=0.65, description="Minimum fused score to declare RECON_SCAN")
    ml_enabled: bool = Field(default=True, description="Enable Layer B ML inference corroboration if model artifact exists")
    model_path: Optional[str] = Field(default=None, description="Optional explicit path to ML model artifact")


class ReconStateTracker:
    """
    Bounded streaming state tracker for reconnaissance telemetry.
    Groups connection attempts by source IP and tracks destination IPs, destination ports,
    TCP flag statistics, and short flow counts with stale state eviction.
    """

    def __init__(self, max_history: int = 100, state_timeout: float = 3600.0):
        self.max_history = max_history
        self.state_timeout = state_timeout
        # Key: src_ip -> dict of tracking state
        self._state: Dict[str, Dict[str, Any]] = {}
        self._last_access: Dict[str, float] = {}

    def add_flow(
        self,
        src_ip: str,
        dst_ip: str,
        dst_port: int,
        duration: float,
        packet_count: int,
        syn_count: int,
        ack_count: int,
        rst_count: int,
        timestamp: float
    ) -> None:
        """Records a flow observation into bounded state for a given src_ip."""
        self._last_access[src_ip] = timestamp
        if src_ip not in self._state:
            self._state[src_ip] = {
                "dests": set(),
                "ports": set(),
                "history": [],
                "syn_total": 0,
                "ack_total": 0,
                "rst_total": 0,
                "short_flows": 0
            }

        st = self._state[src_ip]
        st["dests"].add(dst_ip)
        st["ports"].add(dst_port)
        st["syn_total"] += syn_count
        st["ack_total"] += ack_count
        st["rst_total"] += rst_count

        if duration < 1.0 or packet_count <= 2:
            st["short_flows"] += 1

        history = st["history"]
        history.append((dst_ip, dst_port, timestamp))
        if len(history) > self.max_history:
            st["history"] = history[-self.max_history:]

    def evict_stale_state(self, current_time: Optional[float] = None) -> int:
        """Evicts stale source IP tracking state exceeding state_timeout."""
        now = current_time or time.time()
        stale_keys = [k for k, last_t in self._last_access.items() if (now - last_t) > self.state_timeout]
        for k in stale_keys:
            del self._state[k]
            del self._last_access[k]
        return len(stale_keys)

    def get_summary(self, src_ip: str) -> Dict[str, Any]:
        """Calculates summary statistics for a given source IP."""
        st = self._state.get(src_ip)
        if not st or not st["history"]:
            return {
                "total_flows": 0,
                "unique_dests": 0,
                "unique_ports": 0,
                "syn_total": 0,
                "ack_total": 0,
                "rst_total": 0,
                "short_flows": 0,
                "first_seen": 0.0,
                "last_seen": 0.0
            }

        history = st["history"]
        return {
            "total_flows": len(history),
            "unique_dests": len(st["dests"]),
            "unique_ports": len(st["ports"]),
            "syn_total": st["syn_total"],
            "ack_total": st["ack_total"],
            "rst_total": st["rst_total"],
            "short_flows": st["short_flows"],
            "first_seen": history[0][2],
            "last_seen": history[-1][2]
        }


class ReconDetector(BaseDetector):
    """
    Hybrid Passive Reconnaissance & Port Scanning Detector.
    Integrates Layer A statistical heuristics and Layer B ML model inference trained on UNSW-NB15.
    """

    def __init__(
        self,
        config: Optional[ReconConfig] = None,
        state_tracker: Optional[ReconStateTracker] = None,
        model_dir: str = "./data/models",
        model_path: Optional[str] = None
    ):
        self.config = config or ReconConfig()
        if model_path is not None:
            self.config.model_path = model_path
        self.model_dir = model_dir
        self.state_tracker = state_tracker or ReconStateTracker()
        self.ml_engine = MLInferenceEngine()
        self._init_ml_engine()

    @property
    def detector_name(self) -> str:
        return "recon_detector"

    @property
    def model_version(self) -> str:
        return "v1.0.0-hybrid"

    def _init_ml_engine(self) -> None:
        """Attempts to load persisted Recon ML model artifact from local storage."""
        if not self.config.ml_enabled:
            logger.info("Recon Layer B ML inference disabled by configuration.")
            return

        candidate_paths = []
        if self.config.model_path:
            candidate_paths = [self.config.model_path]
        else:
            candidate_paths = [
                os.path.join("data", "models", "recon_scan_rf_unsw_nb15_v1.joblib"),
                os.path.join("data", "models", "recon_rf_unsw_nb15_v1.joblib"),
                os.path.join("data", "models", "recon_rf_v1.joblib"),
                os.path.join(self.model_dir, "recon_model_v1.joblib"),
                os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "models", "recon_rf_v1.joblib"))
            ]

        found_path = None
        for p in candidate_paths:
            if os.path.exists(p):
                found_path = p
                break

        if found_path:
            success = self.ml_engine.load_model(found_path)
            if success:
                logger.info(f"Loaded Recon ML model artifact from: {found_path}")
            else:
                logger.warning(f"Failed to load Recon ML model from: {found_path}. Layer A active.")
        else:
            logger.info("No Recon ML model binary artifact found at standard paths. Layer A statistical detection active.")

    def _extract_feature_dict(self, features: Any) -> Dict[str, Any]:
        """Extracts standard feature dictionary from FeatureVector, FlowFeatures, or dict."""
        if isinstance(features, FeatureVector):
            return features.model_dump()
        elif isinstance(features, FlowFeatures):
            return {
                "src_ip": getattr(features, "src_ip", "10.0.0.1"),
                "dst_ip": getattr(features, "dst_ip", "192.168.1.1"),
                "dst_port": getattr(features, "dst_port", 80),
                "flow_duration": features.flow_duration,
                "flow_packet_count": features.flow_packet_count,
                "flow_byte_count": features.flow_byte_count,
                "tcp_syn_count": features.tcp_syn_count,
                "tcp_ack_count": features.tcp_ack_count,
                "tcp_rst_count": features.tcp_rst_count
            }
        elif isinstance(features, dict):
            return features
        elif hasattr(features, "__dict__"):
            d = dict(features.__dict__)
            if hasattr(features, "dst_port"):
                d["dst_port"] = getattr(features, "dst_port")
            if hasattr(features, "tcp_syn_count"):
                d["tcp_syn_count"] = getattr(features, "tcp_syn_count")
            if hasattr(features, "tcp_ack_count"):
                d["tcp_ack_count"] = getattr(features, "tcp_ack_count")
            return d
        return {}

    def analyze(self, features: Any) -> DetectionResult:
        """
        Analyzes flow telemetry for reconnaissance and scanning signatures.
        """
        fdict = self._extract_feature_dict(features)

        src_ip = str(fdict.get("src_ip", "10.0.0.1"))
        dst_ip = str(fdict.get("dst_ip", "192.168.1.1"))
        dst_port = int(fdict.get("dst_port") or fdict.get("port") or 80)
        duration = float(fdict.get("flow_duration", 0.0))
        pkt_count = int(fdict.get("flow_packet_count", 1))
        syn_count = int(fdict.get("tcp_syn_count", 0))
        ack_count = int(fdict.get("tcp_ack_count", 0))
        rst_count = int(fdict.get("tcp_rst_count", 0))
        timestamp = float(fdict.get("timestamp", time.time()))

        # Record flow entry into state tracker
        self.state_tracker.add_flow(
            src_ip=src_ip,
            dst_ip=dst_ip,
            dst_port=dst_port,
            duration=duration,
            packet_count=pkt_count,
            syn_count=syn_count,
            ack_count=ack_count,
            rst_count=rst_count,
            timestamp=timestamp
        )

        # Retrieve source IP summary statistics
        summary = self.state_tracker.get_summary(src_ip)
        total_flows = summary["total_flows"]
        unique_dests = summary["unique_dests"]
        unique_ports = summary["unique_ports"]
        syn_total = summary["syn_total"]
        ack_total = summary["ack_total"]
        short_flows = summary["short_flows"]

        # INSUFFICIENT CONTEXT GUARD:
        # Fewer than min_connections (< 3) cannot establish a reliable scan profile
        if total_flows < self.config.min_connections:
            return DetectionResult(
                threat_class="BENIGN",
                score=0.05,
                severity="INFO",
                evidence={
                    "insufficient_recon_context": True,
                    "total_flows": total_flows,
                    "min_required_connections": self.config.min_connections,
                    "reasons": [f"Insufficient observed flow attempts ({total_flows} < {self.config.min_connections}) to establish scanning profile"]
                },
                detector_name=self.detector_name,
                model_version=self.model_version
            )

        # 1. Port Fan-Out Sub-Score (1 source -> many ports)
        port_fanout_sub = 0.0
        if unique_ports >= 15:
            port_fanout_sub = 1.0
        elif unique_ports >= 3:
            port_fanout_sub = (unique_ports - 3) / 12.0
        port_fanout_sub = max(0.0, min(1.0, port_fanout_sub))

        # 2. Destination Fan-Out Sub-Score (1 source -> many dest IPs)
        dest_fanout_sub = 0.0
        if unique_dests >= 15:
            dest_fanout_sub = 1.0
        elif unique_dests >= 3:
            dest_fanout_sub = (unique_dests - 3) / 12.0
        dest_fanout_sub = max(0.0, min(1.0, dest_fanout_sub))

        # 3. SYN Probe Ratio Sub-Score (High SYNs vs low ACK completions)
        syn_scan_sub = 0.0
        if syn_total > 0:
            unanswered_ratio = syn_total / max(ack_total, 1)
            if unanswered_ratio > 3.0:
                syn_scan_sub = min(1.0, 0.5 + (unanswered_ratio / 10.0))
            elif syn_total >= 5 and ack_total == 0:
                syn_scan_sub = 0.85

        # 4. Short Flow Ratio Sub-Score
        short_flow_ratio = short_flows / total_flows if total_flows > 0 else 0.0
        short_sub = max(0.0, min(1.0, short_flow_ratio))

        # 5. Connection Rate Sub-Score
        time_delta = max(summary["last_seen"] - summary["first_seen"], 1.0)
        rate_per_min = (total_flows / time_delta) * 60.0
        rate_sub = min(1.0, rate_per_min / 60.0) if rate_per_min > 10.0 else 0.0

        # Weighted Score Aggregation for Layer A Statistical Score
        w_p = self.config.port_fanout_weight
        w_d = self.config.destination_fanout_weight
        w_s = self.config.syn_scan_weight
        w_f = self.config.short_flow_weight
        w_r = self.config.connection_rate_weight

        total_weight = w_p + w_d + w_s + w_f + w_r
        weighted_sum = (
            (port_fanout_sub * w_p) +
            (dest_fanout_sub * w_d) +
            (syn_scan_sub * w_s) +
            (short_sub * w_f) +
            (rate_sub * w_r)
        )

        stat_score = round(min(1.0, max(0.0, weighted_sum / total_weight)), 4) if total_weight > 0 else 0.0

        # Layer B Machine Learning Scoring
        ml_score = 0.0
        ml_label = "BENIGN"
        ml_active = False
        top_feats = {}

        if self.config.ml_enabled and self.ml_engine.is_available():
            pred = self.ml_engine.predict(features)
            if pred is not None:
                ml_score = pred.score
                ml_label = pred.label
                ml_active = True
                top_feats = pred.top_contributing_features

        # Scan Subtype Determination
        scan_type = "UNKNOWN"
        if unique_dests == 1 and unique_ports >= 3:
            scan_type = "VERTICAL"
        elif unique_dests >= 3 and unique_ports <= 2:
            scan_type = "HORIZONTAL"
        elif unique_dests >= 3 and unique_ports >= 3:
            scan_type = "MIXED"

        # Human-readable evidence reasons
        reasons = []
        if port_fanout_sub >= 0.70:
            reasons.append(f"High destination port fan-out ({unique_ports} distinct ports probed)")
        if dest_fanout_sub >= 0.70:
            reasons.append(f"High destination host fan-out ({unique_dests} distinct target IPs probed)")
        if syn_scan_sub >= 0.70:
            reasons.append(f"Unanswered SYN probe storm ({syn_total} SYNs vs {ack_total} ACKs)")
        if short_sub >= 0.70:
            reasons.append(f"High short-lived connection attempt ratio ({short_flow_ratio*100:.1f}%)")

        # Hybrid Score Fusion
        if ml_active:
            blended = (0.50 * stat_score) + (0.50 * ml_score)
            fused_score = max(stat_score, blended)
            stat_alert = stat_score >= self.config.alert_threshold
            ml_alert = ml_score >= 0.50
            agreement = (stat_alert == ml_alert)

            if agreement and ml_alert:
                reasons.append(f"✓ Layer B ML model ({self.ml_engine._model_name}) corroborates Reconnaissance scan pattern (ML risk score: {ml_score:.2f})")
            elif not agreement and ml_score >= 0.50:
                reasons.append(f"✓ Layer B ML model detected Reconnaissance pattern (ML risk score: {ml_score:.2f})")
        else:
            fused_score = stat_score
            agreement = True

        fused_score = round(min(1.0, max(0.0, fused_score)), 4)
        severity = map_score_to_severity(fused_score)

        # Threat classification
        threat_class = "BENIGN"
        if fused_score >= self.config.alert_threshold and total_flows >= self.config.min_connections:
            threat_class = "RECON_SCAN"

        evidence: Dict[str, Any] = {
            "scan_type": scan_type,
            "unique_destination_ports": unique_ports,
            "unique_destinations": unique_dests,
            "total_observed_flows": total_flows,
            "syn_count": syn_total,
            "ack_count": ack_total,
            "short_flow_ratio": round(short_flow_ratio, 2),
            "port_fanout_score": round(port_fanout_sub, 2),
            "destination_fanout_score": round(dest_fanout_sub, 2),
            "statistical_score": stat_score,
            "ml_score": ml_score,
            "ml_label": ml_label,
            "ml_available": ml_active,
            "ml_model_name": self.ml_engine._model_name if ml_active else "N/A",
            "ml_model_version": self.ml_engine._model_version if ml_active else "N/A",
            "agreement": agreement,
            "sub_scores": {
                "port_fanout": round(port_fanout_sub, 2),
                "destination_fanout": round(dest_fanout_sub, 2),
                "syn_scan": round(syn_scan_sub, 2),
                "short_flow": round(short_sub, 2),
                "connection_rate": round(rate_sub, 2)
            },
            "reasons": reasons if reasons else ["Normal baseline connection diversity"]
        }

        if ml_active and top_feats:
            evidence["top_contributing_features"] = top_feats

        return DetectionResult(
            threat_class=threat_class,
            score=fused_score,
            severity=severity,
            evidence=evidence,
            detector_name=self.detector_name,
            model_version=self.model_version
        )
