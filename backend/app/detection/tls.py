"""
PassiveGuard AI — Passive Encrypted-Session Malware Detector (Module 6)

STRICT PASSIVE CONSTRAINT:
Analyzes observed TLS/QUIC metadata, packet size distributions, inter-arrival timing,
and directional flow characteristics to detect malware communicating over encrypted channels.

Under NO circumstances does it decrypt TLS/QUIC payloads, extract private keys, perform MITM interception,
contact external APIs, or transmit network packets.
"""
import logging
from typing import Any, Dict, Optional, List
from pydantic import BaseModel, Field

from app.detection.base import BaseDetector, DetectionResult
from app.risk.scoring import map_score_to_severity
from app.features.models import FeatureVector
from app.features.tls_features import TLSFeatures

logger = logging.getLogger(__name__)

DEPRECATED_TLS_VERSIONS = {"SSLv3", "SSLV3", "TLS 1.0", "TLS1.0", "TLS 1.1", "TLS1.1"}
KNOWN_SUSPICIOUS_SNI_KEYWORDS = {"malware", "c2", "beacon", "exfil", "botnet", "test-c2"}


class TLSConfig(BaseModel):
    """
    Configurable weights and thresholds for encrypted-session malware behavioral analysis.
    """
    packet_size_weight: float = Field(default=0.25, description="Weight for packet size distribution anomaly")
    timing_weight: float = Field(default=0.25, description="Weight for inter-arrival timing anomaly")
    flow_volume_weight: float = Field(default=0.20, description="Weight for low-volume heartbeat profile")
    directional_weight: float = Field(default=0.15, description="Weight for directional byte ratio asymmetry")
    fingerprint_weight: float = Field(default=0.15, description="Weight for TLS version/SNI fingerprint anomaly")
    min_packets: int = Field(default=3, description="Minimum packets required to establish behavioral profile")
    alert_threshold: float = Field(default=0.65, description="Minimum fused score to declare ENCRYPTED_MALWARE")


class TLSDetector(BaseDetector):
    """
    Passive Encrypted-Session Malware Detector.
    Identifies malware communicating over encrypted TLS/QUIC sessions using metadata & traffic statistics.
    """

    def __init__(self, config: Optional[TLSConfig] = None):
        self.config = config or TLSConfig()

    @property
    def detector_name(self) -> str:
        return "tls_detector"

    @property
    def model_version(self) -> str:
        return "statistical-v1"

    def _extract_feature_dict(self, features: Any) -> Dict[str, Any]:
        """Extracts standard feature dictionary from FeatureVector, TLSFeatures, or dict."""
        if isinstance(features, FeatureVector):
            return features.model_dump()
        elif isinstance(features, TLSFeatures):
            return {
                "tls_version": features.tls_version,
                "sni_hostname": getattr(features, "sni_hostname", None),
                "tls_ja3": getattr(features, "ja3_hash", None) or getattr(features, "tls_ja3", None),
                "tls_packet_count": getattr(features, "packet_count", 10),
                "tls_mean_packet_size": getattr(features, "mean_packet_size", 400.0),
                "tls_std_packet_size": getattr(features, "std_packet_size", 50.0),
                "flow_packet_count": getattr(features, "packet_count", 10),
                "flow_byte_count": getattr(features, "byte_count", 4000)
            }
        elif isinstance(features, dict):
            return features
        elif hasattr(features, "__dict__"):
            d = dict(features.__dict__)
            if hasattr(features, "tls_version"):
                d["tls_version"] = getattr(features, "tls_version")
            if hasattr(features, "sni_hostname"):
                d["sni_hostname"] = getattr(features, "sni_hostname")
            return d
        return {}

    def analyze(self, features: Any) -> DetectionResult:
        """
        Analyzes encrypted TLS/QUIC session metadata and traffic statistics for malware signatures.
        """
        fdict = self._extract_feature_dict(features)

        pkt_count = int(fdict.get("flow_packet_count") or fdict.get("tls_packet_count") or fdict.get("quic_packet_count") or 0)
        byte_count = int(fdict.get("flow_byte_count") or fdict.get("tls_byte_count") or fdict.get("quic_byte_count") or 0)

        # INSUFFICIENT CONTEXT GUARD:
        # Fewer than min_packets (< 3) cannot establish a reliable encrypted session profile
        if pkt_count < self.config.min_packets:
            return DetectionResult(
                threat_class="BENIGN",
                score=0.05,
                severity="INFO",
                evidence={
                    "insufficient_encrypted_session_context": True,
                    "packet_count": pkt_count,
                    "min_required_packets": self.config.min_packets,
                    "reasons": [f"Insufficient encrypted session packets ({pkt_count} < {self.config.min_packets}) to establish behavioral profile"]
                },
                detector_name=self.detector_name,
                model_version=self.model_version
            )

        # Packet size statistics
        mean_pkt_size = float(fdict.get("tls_mean_packet_size") or fdict.get("quic_mean_packet_size") or fdict.get("flow_mean_packet_size") or 0.0)
        std_pkt_size = float(fdict.get("tls_std_packet_size") or fdict.get("quic_std_packet_size") or fdict.get("flow_std_packet_size") or 0.0)

        # Timing statistics
        mean_iat = float(fdict.get("tls_mean_iat") or fdict.get("quic_mean_iat") or fdict.get("temporal_mean_iat") or 0.0)
        std_iat = float(fdict.get("tls_std_iat") or fdict.get("quic_std_iat") or fdict.get("temporal_std_iat") or 0.0)
        cv_iat = float(fdict.get("temporal_cv_iat") or ((std_iat / mean_iat) if mean_iat > 0 else 0.0))
        periodicity = float(fdict.get("temporal_periodicity") or 0.0)

        # Directional statistics
        dir_byte_ratio = float(fdict.get("directional_byte_ratio", 0.5))

        # Fingerprint metadata
        tls_ver = fdict.get("tls_version")
        quic_ver = fdict.get("quic_version")
        sni = str(fdict.get("sni_hostname") or fdict.get("sni") or "").lower()
        ja3 = fdict.get("tls_ja3")
        ja4 = fdict.get("tls_ja4")

        # 1. Packet Size Anomaly Sub-Score
        # Automated malware C2 over TLS often exhibits unnaturally fixed/uniform packet payload sizes (std_pkt_size < 15.0)
        pkt_size_sub = 0.0
        if pkt_count >= 5 and std_pkt_size < 15.0 and mean_pkt_size < 800.0:
            pkt_size_sub = 0.90
        elif std_pkt_size < 30.0:
            pkt_size_sub = 0.45
        else:
            pkt_size_sub = 0.0

        # 2. Timing Anomaly Sub-Score (Regular IAT or high periodicity)
        timing_sub = 0.0
        if periodicity > 0.85 or (mean_iat > 0.5 and cv_iat < 0.10):
            timing_sub = 0.95
        elif periodicity > 0.60 or (mean_iat > 0.1 and cv_iat < 0.25):
            timing_sub = 0.50
        else:
            timing_sub = 0.0

        # 3. Flow Volume Profile Sub-Score (Small recurring control sessions vs heavy HTTPS browsing)
        volume_sub = 0.0
        if pkt_count <= 30 and byte_count <= 6000:
            volume_sub = 0.80
        elif pkt_count <= 100:
            volume_sub = 0.35
        else:
            volume_sub = 0.0

        # 4. Directional Asymmetry Sub-Score
        dir_sub = 0.0
        if dir_byte_ratio >= 0.90 or dir_byte_ratio <= 0.10:
            dir_sub = 0.85
        elif dir_byte_ratio >= 0.80 or dir_byte_ratio <= 0.20:
            dir_sub = 0.40
        else:
            dir_sub = 0.0

        # 5. Fingerprint & Metadata Anomaly Sub-Score
        fp_sub = 0.0
        fp_reasons = []

        if tls_ver in DEPRECATED_TLS_VERSIONS:
            fp_sub = max(fp_sub, 0.75)
            fp_reasons.append(f"Deprecated TLS protocol version observed: {tls_ver}")

        if sni and any(kw in sni for kw in KNOWN_SUSPICIOUS_SNI_KEYWORDS):
            fp_sub = max(fp_sub, 0.90)
            fp_reasons.append(f"Suspicious SNI hostname pattern: {sni}")

        if ja3 or ja4:
            fp_reasons.append(f"Observed passive fingerprint metadata (JA3: {ja3 or 'N/A'}, JA4: {ja4 or 'N/A'})")

        # Weighted Score Fusion
        w_p = self.config.packet_size_weight
        w_t = self.config.timing_weight
        w_v = self.config.flow_volume_weight
        w_d = self.config.directional_weight
        w_f = self.config.fingerprint_weight

        total_weight = w_p + w_t + w_v + w_d + w_f
        weighted_sum = (
            (pkt_size_sub * w_p) +
            (timing_sub * w_t) +
            (volume_sub * w_v) +
            (dir_sub * w_d) +
            (fp_sub * w_f)
        )

        fused_score = round(min(1.0, max(0.0, weighted_sum / total_weight)), 4) if total_weight > 0 else 0.0

        # Human-readable evidence reasons
        reasons = []
        if pkt_size_sub >= 0.70:
            reasons.append(f"Uniform TLS/QUIC packet size distribution (std dev: {std_pkt_size:.1f} B)")
        if timing_sub >= 0.70:
            reasons.append(f"Highly regular inter-arrival timing (CV: {cv_iat:.4f}, periodicity: {periodicity:.2f})")
        if volume_sub >= 0.70:
            reasons.append("Low-volume recurring encrypted control flow profile")
        if dir_sub >= 0.70:
            reasons.append(f"Severe directional byte asymmetry (ratio: {dir_byte_ratio:.2f})")
        reasons.extend(fp_reasons)

        # Threat classification
        threat_class = "BENIGN"
        if fused_score >= self.config.alert_threshold and pkt_count >= self.config.min_packets:
            threat_class = "ENCRYPTED_MALWARE"

        severity = map_score_to_severity(fused_score)

        evidence: Dict[str, Any] = {
            "tls_version": tls_ver,
            "quic_version": quic_ver,
            "sni_hostname": sni or None,
            "ja3_fingerprint": ja3,
            "ja4_fingerprint": ja4,
            "packet_size_std_dev": round(std_pkt_size, 2),
            "inter_arrival_cv": round(cv_iat, 4),
            "directional_byte_ratio": round(dir_byte_ratio, 2),
            "sub_scores": {
                "packet_size_anomaly": round(pkt_size_sub, 2),
                "timing_anomaly": round(timing_sub, 2),
                "flow_volume_anomaly": round(volume_sub, 2),
                "directional_asymmetry": round(dir_sub, 2),
                "fingerprint_anomaly": round(fp_sub, 2)
            },
            "reasons": reasons if reasons else ["Normal encrypted session baseline traffic"]
        }

        return DetectionResult(
            threat_class=threat_class,
            score=fused_score,
            severity=severity,
            evidence=evidence,
            detector_name=self.detector_name,
            model_version=self.model_version
        )
