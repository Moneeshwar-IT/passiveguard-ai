"""
PassiveGuard AI — Hybrid DDoS Threat Detector (Module 3 & Module 13 Integration)

STRICT PASSIVE CONSTRAINT:
Analyzes FeatureVector metadata through hybrid Statistical (Layer A) and Machine Learning (Layer B) scoring.
Extracts rich explainable evidence for SOC analysts.
Under NO circumstances does it send network packets, alter firewall rules, or perform active host probes.
"""
import os
import logging
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field

from app.config import resolve_model_path
from app.detection.base import BaseDetector, DetectionResult
from app.risk.scoring import map_score_to_severity, normalize_score
from app.features.models import FeatureVector
from app.ml.inference import MLInferenceEngine, MLPrediction

logger = logging.getLogger(__name__)


class DDoSConfig(BaseModel):
    """
    Configurable detection thresholds for Layer A statistical and Layer B ML detection.
    """
    syn_rate_threshold: float = Field(default=250.0, description="SYN packets/sec threshold")
    syn_ack_ratio_threshold: float = Field(default=2.5, description="SYN to ACK imbalance ratio threshold")
    udp_packet_rate_threshold: float = Field(default=2000.0, description="UDP packets/sec flood threshold")
    udp_byte_rate_threshold: float = Field(default=2_000_000.0, description="UDP bytes/sec flood threshold")
    asymmetry_threshold: float = Field(default=0.85, description="Directional byte asymmetry ratio threshold")
    alert_threshold: float = Field(default=0.65, description="Minimum fused score to declare a DDoS detection")
    ml_enabled: bool = Field(default=True, description="Enable Layer B ML inference corroboration if model artifact exists")
    model_path: Optional[str] = Field(default=None, description="Optional explicit path to ML model artifact")


class DDoSDetector(BaseDetector):
    """
    Hybrid DDoS Threat Detector.
    
    Combines Layer A (transparent statistical heuristics) and Layer B (RandomForest ML inference).
    Classifies threat outcomes into:
    - DDOS_SYN_FLOOD
    - DDOS_UDP_FLOOD
    - DDOS_UDP_AMPLIFICATION
    - DDOS_SPOOFED_SOURCE
    - BENIGN
    """

    def __init__(
        self,
        config: Optional[DDoSConfig] = None,
        model_dir: str = "./data/models",
        model_path: Optional[str] = None
    ):
        self.config = config or DDoSConfig()
        if model_path is not None:
            self.config.model_path = model_path
        self.model_dir = model_dir
        self.ml_engine = MLInferenceEngine()
        self._init_ml_engine()

    @property
    def detector_name(self) -> str:
        return "ddos_detector"

    @property
    def model_version(self) -> str:
        return "v1.0.0-hybrid"

    @property
    def ml_model(self) -> Any:
        """Backward compatibility property returning raw model object if loaded."""
        return self.ml_engine._model if self.ml_engine.is_available() else None

    def _init_ml_engine(self) -> None:
        """Attempts to load persisted ML model artifact from local storage."""
        if not self.config.ml_enabled:
            logger.info("DDoS Layer B ML inference disabled by configuration.")
            return

        candidate_paths = []
        if self.config.model_path:
            candidate_paths = [self.config.model_path]
        else:
            candidate_paths = [
                "data/models/ddos_rf_unsw_nb15_v1.joblib",
                "data/models/ddos_rf_v1.joblib",
                os.path.join(self.model_dir, "ddos_model_v1.joblib"),
                os.path.join("backend", "models", "ddos_model_v1.joblib")
            ]

        found_path = None
        for p in candidate_paths:
            resolved = resolve_model_path(p)
            if resolved and os.path.exists(resolved):
                found_path = resolved
                break

        if found_path:
            success = self.ml_engine.load_model(found_path)
            if success:
                logger.info(f"Loaded DDoS ML model artifact from resolved path: '{found_path}' | Loaded: {self.ml_engine.is_available()}")
            else:
                logger.warning(f"Failed to load DDoS ML model from resolved path: '{found_path}'. Layer A active.")
        else:
            logger.info("No DDoS ML model binary artifact found at candidate paths. Layer A statistical detection active.")


    def _extract_feature_dict(self, features: Any) -> Dict[str, Any]:
        """Extracts standard feature dictionary from FeatureVector or dict input."""
        if isinstance(features, FeatureVector):
            return features.model_dump()
        elif isinstance(features, dict):
            return features
        elif hasattr(features, "__dict__"):
            d = dict(features.__dict__)
            if hasattr(features, "packet_count"):
                d["flow_packet_count"] = getattr(features, "packet_count")
            if hasattr(features, "byte_count"):
                d["flow_byte_count"] = getattr(features, "byte_count")
            if hasattr(features, "duration"):
                d["flow_duration"] = getattr(features, "duration")
            if hasattr(features, "packets_per_sec"):
                d["flow_packets_per_sec"] = getattr(features, "packets_per_sec")
            if hasattr(features, "bytes_per_sec"):
                d["flow_bytes_per_sec"] = getattr(features, "bytes_per_sec")
            return d
        return {}

    def _compute_layer_a_statistical_score(self, fdict: Dict[str, Any]) -> Tuple[float, Dict[str, float], List[str]]:
        """
        Layer A: Calculates transparent statistical indicator scores.
        """
        reasons = []
        scores = {}

        pkt_rate = float(fdict.get("flow_packets_per_sec", 0.0))
        byte_rate = float(fdict.get("flow_bytes_per_sec", 0.0))
        protocol = str(fdict.get("protocol", "TCP")).upper()

        syn_count = int(fdict.get("tcp_syn_count", 0))
        ack_count = int(fdict.get("tcp_ack_count", 0))
        syn_ack_count = int(fdict.get("tcp_syn_ack_count", 0))
        duration = float(fdict.get("flow_duration", 0.0))

        dir_byte_ratio = float(fdict.get("directional_byte_ratio", 1.0))
        source_entropy = fdict.get("source_entropy")

        # 1. SYN Flood Signal
        syn_rate = (syn_count / max(duration, 0.001)) if duration > 0 else float(syn_count)
        syn_ack_ratio = (syn_count / max(ack_count + syn_ack_count, 1))
        
        syn_score = 0.0
        if protocol == "TCP":
            if syn_rate > self.config.syn_rate_threshold or (syn_count > 100 and syn_ack_ratio > self.config.syn_ack_ratio_threshold):
                syn_score = min(1.0, 0.5 + (syn_rate / (self.config.syn_rate_threshold * 2)))
                reasons.append(f"Abnormal SYN packet rate ({syn_rate:.1f} SYN/s) and SYN/ACK imbalance (ratio: {syn_ack_ratio:.2f})")
        scores["syn_rate_score"] = round(syn_score, 4)

        # 2. UDP Flood Signal
        udp_score = 0.0
        if protocol == "UDP":
            if pkt_rate > self.config.udp_packet_rate_threshold or byte_rate > self.config.udp_byte_rate_threshold:
                udp_score = min(1.0, 0.4 + (pkt_rate / (self.config.udp_packet_rate_threshold * 2)))
                reasons.append(f"High-volume UDP flood packet rate ({pkt_rate:.1f} pkt/s, {byte_rate/1e6:.2f} MB/s)")
        scores["udp_rate_score"] = round(udp_score, 4)

        # 3. Amplification / Asymmetry Signal
        amp_score = 0.0
        if protocol == "UDP" and (dir_byte_ratio > self.config.asymmetry_threshold or byte_rate > 2_000_000):
            amp_score = min(1.0, 0.3 + dir_byte_ratio * 0.6)
            reasons.append(f"UDP payload asymmetry observed (directional byte ratio: {dir_byte_ratio:.2f})")
        scores["asymmetry_score"] = round(amp_score, 4)

        # 4. Spoofing / Source Anomaly Signal
        spoof_score = 0.0
        if source_entropy is not None:
            if float(source_entropy) > 0.8:
                spoof_score = min(1.0, float(source_entropy))
                reasons.append(f"High source IP entropy indicating spoofed source distribution ({float(source_entropy):.2f})")
        elif pkt_rate > 10000:
            spoof_score = 0.4
        scores["spoofing_score"] = round(spoof_score, 4)

        # Combine Layer A indicators
        max_indicator = max(syn_score, udp_score, amp_score, spoof_score)
        avg_indicator = sum([syn_score, udp_score, amp_score, spoof_score]) / 4.0
        statistical_score = (0.7 * max_indicator) + (0.3 * avg_indicator)

        return round(min(1.0, max(0.0, statistical_score)), 4), scores, reasons

    def _compute_layer_b_ml_score(self, features: Any) -> Tuple[float, str, bool, Dict[str, float]]:
        """
        Layer B: Computes machine learning prediction score via MLInferenceEngine.
        Returns (ml_score, ml_label, ml_active, top_features).
        """
        if not self.config.ml_enabled or not self.ml_engine.is_available():
            return 0.0, "BENIGN", False, {}

        pred = self.ml_engine.predict(features)
        if pred is None:
            return 0.0, "BENIGN", False, {}

        return pred.score, pred.label, True, pred.top_contributing_features

    def analyze(self, features: Any) -> DetectionResult:
        """
        Analyzes flow feature telemetry for DDoS flooding and spoofing signatures.
        Integrates Layer A statistical heuristics and Layer B ML model outputs.
        """
        fdict = self._extract_feature_dict(features)
        
        stat_score, indicator_scores, reasons = self._compute_layer_a_statistical_score(fdict)
        ml_score, ml_label, ml_active, top_feats = self._compute_layer_b_ml_score(features)

        # Hybrid Score Fusion: ML corroborates statistical heuristics without suppressing Layer A
        if ml_active:
            blended = (0.50 * stat_score) + (0.50 * ml_score)
            fused_score = max(stat_score, blended)
            stat_alert = stat_score >= self.config.alert_threshold
            ml_alert = ml_score >= 0.50
            agreement = (stat_alert == ml_alert)

            if agreement and ml_alert:
                reasons.append(f"✓ Layer B ML model ({self.ml_engine._model_name}) corroborates DDoS attack signature (ML risk score: {ml_score:.2f})")
            elif not agreement and ml_score >= 0.50:
                reasons.append(f"✓ Layer B ML model detected DDoS pattern (ML risk score: {ml_score:.2f})")
        else:
            fused_score = stat_score
            agreement = True

        fused_score = round(min(1.0, max(0.0, fused_score)), 4)
        severity = map_score_to_severity(fused_score)

        protocol = str(fdict.get("protocol", "TCP")).upper()
        syn_count = int(fdict.get("tcp_syn_count", 0))
        ack_count = int(fdict.get("tcp_ack_count", 0))
        duration = max(float(fdict.get("flow_duration", 0.0)), 0.001)
        syn_rate = syn_count / duration

        # Threat sub-classification
        threat_class = "BENIGN"
        if fused_score >= self.config.alert_threshold:
            if protocol == "TCP" and (syn_rate > self.config.syn_rate_threshold or syn_count > 200):
                threat_class = "DDOS_SYN_FLOOD"
            elif protocol == "UDP" and indicator_scores.get("asymmetry_score", 0) > 0.5:
                threat_class = "DDOS_UDP_AMPLIFICATION"
            elif protocol == "UDP" and indicator_scores.get("udp_rate_score", 0) > 0.4:
                threat_class = "DDOS_UDP_FLOOD"
            elif indicator_scores.get("spoofing_score", 0) > 0.6:
                threat_class = "DDOS_SPOOFED_SOURCE"
            else:
                threat_class = "DDOS_VOLUMETRIC"

        # Evidence dictionary
        evidence: Dict[str, Any] = {
            "packet_rate": float(fdict.get("flow_packets_per_sec", 0.0)),
            "byte_rate": float(fdict.get("flow_bytes_per_sec", 0.0)),
            "syn_rate": round(syn_rate, 2),
            "syn_ack_ratio": round(syn_count / max(ack_count, 1), 2),
            "directional_asymmetry": float(fdict.get("directional_byte_ratio", 1.0)),
            "spoofing_likelihood": indicator_scores.get("spoofing_score", 0.0),
            "statistical_score": stat_score,
            "ml_score": ml_score,
            "ml_label": ml_label,
            "ml_available": ml_active,
            "ml_model_name": self.ml_engine._model_name if ml_active else "N/A",
            "ml_model_version": self.ml_engine._model_version if ml_active else "N/A",
            "agreement": agreement,
            "reasons": reasons if reasons else ["Normal baseline traffic volume"]
        }

        if ml_active and top_feats:
            evidence["top_contributing_features"] = top_feats

        # Explicit note when directional data is single-direction
        if fdict.get("direction_dst_to_src_packets", 0) == 0:
            evidence["directional_observation_note"] = "Single-direction enclave observation feed; reverse telemetry not observed."

        return DetectionResult(
            threat_class=threat_class,
            score=fused_score,
            severity=severity,
            evidence=evidence,
            detector_name=self.detector_name,
            model_version=self.model_version
        )
