"""
PassiveGuard AI — Passive DNS Tunnelling Threat Detector (Module 5)

STRICT PASSIVE CONSTRAINT:
Analyzes DNS query metadata (query length, entropy, subdomain churn, frequency rates)
to identify covert data exfiltration / tunneling over DNS protocols.

Under NO circumstances does it send DNS resolution queries, contact external reputation APIs,
or transmit network packets.
"""
import time
import logging
from typing import Any, Dict, List, Optional, Set, Tuple
from pydantic import BaseModel, Field

from app.detection.base import BaseDetector, DetectionResult
from app.risk.scoring import map_score_to_severity
from app.features.models import FeatureVector
from app.features.dns_features import DNSFeatures, calculate_shannon_entropy
from app.detection.dga import extract_sld

logger = logging.getLogger(__name__)


class DNSTunnelConfig(BaseModel):
    """
    Configurable weights and thresholds for DNS Tunnelling detection.
    """
    query_length_weight: float = Field(default=0.30, description="Weight for long DNS query length score")
    entropy_weight: float = Field(default=0.25, description="Weight for high lexical entropy score")
    frequency_weight: float = Field(default=0.20, description="Weight for high query frequency score")
    subdomain_diversity_weight: float = Field(default=0.15, description="Weight for unique subdomain churn score")
    nxdomain_weight: float = Field(default=0.10, description="Weight for elevated NXDOMAIN ratio score")
    min_queries: int = Field(default=3, description="Minimum queries required per parent domain to establish tunneling")
    alert_threshold: float = Field(default=0.65, description="Minimum fused score to declare DNS_TUNNEL detection")


class DNSTunnelStateTracker:
    """
    Bounded state tracker grouping DNS queries by (source_ip, parent_domain).
    Tracks subdomain diversity, query lengths, and query rates with stale state eviction.
    """

    def __init__(self, max_history: int = 100, state_timeout: float = 3600.0):
        self.max_history = max_history
        self.state_timeout = state_timeout
        self._state: Dict[Tuple[str, str], List[Tuple[str, int, float, float, bool]]] = {}
        self._last_access: Dict[Tuple[str, str], float] = {}

    def add_query(
        self,
        src_ip: str,
        parent_domain: str,
        subdomain: str,
        query_len: int,
        entropy: float,
        timestamp: float,
        is_nxdomain: bool = False
    ) -> None:
        """Records a DNS query entry for a given (src_ip, parent_domain)."""
        key = (src_ip, parent_domain)
        self._last_access[key] = timestamp
        if key not in self._state:
            self._state[key] = []

        history = self._state[key]
        history.append((subdomain, query_len, entropy, timestamp, is_nxdomain))
        if len(history) > self.max_history:
            self._state[key] = history[-self.max_history:]

    def evict_stale_state(self, current_time: Optional[float] = None) -> int:
        """Evicts stale tracking state exceeding state_timeout."""
        now = current_time or time.time()
        stale_keys = [k for k, last_t in self._last_access.items() if (now - last_t) > self.state_timeout]
        for k in stale_keys:
            del self._state[k]
            del self._last_access[k]
        return len(stale_keys)

    def get_context(self, src_ip: str, parent_domain: str) -> Dict[str, Any]:
        """Calculates summary context statistics for a given (src_ip, parent_domain) pair."""
        key = (src_ip, parent_domain)
        history = self._state.get(key, [])
        if not history:
            return {
                "query_count": 0,
                "unique_subdomain_ratio": 0.0,
                "avg_query_length": 0.0,
                "max_query_length": 0,
                "avg_entropy": 0.0,
                "nxdomain_ratio": 0.0
            }

        q_count = len(history)
        unique_subs = set(sub for sub, _, _, _, _ in history if sub)
        unique_ratio = len(unique_subs) / q_count if q_count > 0 else 0.0
        avg_len = sum(length for _, length, _, _, _ in history) / q_count
        max_len = max(length for _, length, _, _, _ in history)
        avg_ent = sum(ent for _, _, ent, _, _ in history) / q_count
        nx_count = sum(1 for _, _, _, _, is_nx in history if is_nx)

        return {
            "query_count": q_count,
            "unique_subdomain_ratio": round(unique_ratio, 4),
            "avg_query_length": round(avg_len, 2),
            "max_query_length": max_len,
            "avg_entropy": round(avg_ent, 4),
            "nxdomain_ratio": round(nx_count / q_count, 4)
        }


class DNSTunnelDetector(BaseDetector):
    """
    Passive DNS Tunnelling Detector.
    Identifies covert data exfiltration over DNS by analyzing multi-query context and domain structure.
    """

    def __init__(self, config: Optional[DNSTunnelConfig] = None, state_tracker: Optional[DNSTunnelStateTracker] = None):
        self.config = config or DNSTunnelConfig()
        self.state_tracker = state_tracker or DNSTunnelStateTracker()

    @property
    def detector_name(self) -> str:
        return "dns_tunneling_detector"

    @property
    def model_version(self) -> str:
        return "statistical-v1"

    def _extract_feature_dict(self, features: Any) -> Dict[str, Any]:
        """Extracts standard feature dictionary from FeatureVector, DNSFeatures, or dict."""
        if isinstance(features, FeatureVector):
            return features.model_dump()
        elif isinstance(features, DNSFeatures):
            return {
                "domain_name": features.domain_name,
                "dns_query_length": features.domain_length,
                "dns_entropy": features.shannon_entropy,
                "dns_digit_ratio": features.digit_ratio,
                "dns_query_frequency": getattr(features, "query_frequency", 10.0),
                "dns_nxdomain_ratio": getattr(features, "nxdomain_ratio", 0.0)
            }
        elif isinstance(features, dict):
            return features
        elif hasattr(features, "__dict__"):
            d = dict(features.__dict__)
            if hasattr(features, "domain_name"):
                d["domain_name"] = getattr(features, "domain_name")
            if hasattr(features, "shannon_entropy"):
                d["dns_entropy"] = getattr(features, "shannon_entropy")
            return d
        return {}

    def analyze(self, features: Any) -> DetectionResult:
        """
        Analyzes DNS query metadata and parent domain context for DNS Tunnelling behavior.
        """
        fdict = self._extract_feature_dict(features)

        src_ip = str(fdict.get("src_ip", "10.0.0.1"))
        domain_name = str(fdict.get("domain_name") or fdict.get("dns_query_name") or "")
        parent_domain = extract_sld(domain_name)
        
        # Subdomain prefix extraction
        subdomain = domain_name.lower().replace(f".{parent_domain}", "") if parent_domain and domain_name else domain_name

        raw_len = fdict.get("dns_query_length")
        query_len = int(raw_len) if raw_len is not None else len(domain_name)

        entropy = fdict.get("dns_entropy")
        if entropy is None:
            entropy = calculate_shannon_entropy(domain_name) if domain_name else 0.0
        else:
            entropy = float(entropy)

        timestamp = float(fdict.get("timestamp") or time.time())
        nxdomain_ratio = float(fdict.get("dns_nxdomain_ratio") or 0.0)
        query_freq = float(fdict.get("dns_query_frequency") or 5.0)

        # Record query into state tracker
        self.state_tracker.add_query(
            src_ip=src_ip,
            parent_domain=parent_domain,
            subdomain=subdomain,
            query_len=query_len,
            entropy=entropy,
            timestamp=timestamp,
            is_nxdomain=nxdomain_ratio > 0.5
        )

        # Get parent domain multi-query context
        context = self.state_tracker.get_context(src_ip, parent_domain)
        q_count = context["query_count"]

        # INSUFFICIENT DATA GUARD:
        # Fewer than min_queries (<3) for a parent domain cannot establish a tunneling stream
        if q_count < self.config.min_queries:
            return DetectionResult(
                threat_class="BENIGN",
                score=0.05,
                severity="INFO",
                evidence={
                    "insufficient_dns_context": True,
                    "query_count": q_count,
                    "min_required_queries": self.config.min_queries,
                    "parent_domain": parent_domain,
                    "reasons": [f"Insufficient DNS query history ({q_count} < {self.config.min_queries} queries) for parent domain '{parent_domain}'"]
                },
                detector_name=self.detector_name,
                model_version=self.model_version
            )

        avg_len = context["avg_query_length"]
        avg_ent = context["avg_entropy"]
        unique_ratio = context["unique_subdomain_ratio"]

        # 1. Query Length Sub-Score (DNS Tunnelling uses long queries, e.g. > 50 chars)
        len_sub = 0.0
        if avg_len > 60:
            len_sub = 1.0
        elif avg_len > 30:
            len_sub = (avg_len - 30) / 30.0
        len_sub = max(0.0, min(1.0, len_sub))

        # 2. Entropy Sub-Score (Encoded payload data exhibits high entropy > 4.0)
        ent_sub = 0.0
        if avg_ent > 4.5:
            ent_sub = 1.0
        elif avg_ent > 3.5:
            ent_sub = (avg_ent - 3.5) / 1.0
        ent_sub = max(0.0, min(1.0, ent_sub))

        # 3. Query Frequency Sub-Score
        freq_sub = 0.0
        if query_freq > 30.0:
            freq_sub = 1.0
        elif query_freq > 10.0:
            freq_sub = (query_freq - 10.0) / 20.0
        freq_sub = max(0.0, min(1.0, freq_sub))

        # 4. Subdomain Diversity Sub-Score (High unique subdomain churn indicates payload chunking)
        div_sub = max(0.0, min(1.0, unique_ratio))

        # 5. NXDOMAIN Ratio Sub-Score
        nx_sub = max(0.0, min(1.0, context["nxdomain_ratio"]))

        # Weighted Score Fusion
        w_l = self.config.query_length_weight
        w_e = self.config.entropy_weight
        w_f = self.config.frequency_weight
        w_d = self.config.subdomain_diversity_weight
        w_n = self.config.nxdomain_weight

        total_weight = w_l + w_e + w_f + w_d + w_n
        weighted_sum = (
            (len_sub * w_l) +
            (ent_sub * w_e) +
            (freq_sub * w_f) +
            (div_sub * w_d) +
            (nx_sub * w_n)
        )

        fused_score = round(min(1.0, max(0.0, weighted_sum / total_weight)), 4) if total_weight > 0 else 0.0

        # Human-readable evidence reasons
        reasons = []
        if len_sub >= 0.70:
            reasons.append(f"Repeated unusually long DNS queries (avg length: {avg_len:.1f} characters)")
        if ent_sub >= 0.70:
            reasons.append(f"High DNS query payload entropy (avg H(X) = {avg_ent:.2f})")
        if div_sub >= 0.80:
            reasons.append(f"High unique subdomain churn ratio ({unique_ratio*100:.1f}%) under parent domain '{parent_domain}'")
        if freq_sub >= 0.70:
            reasons.append(f"High DNS query rate ({query_freq:.1f} queries/min)")

        # Threat classification
        threat_class = "BENIGN"
        if fused_score >= self.config.alert_threshold and q_count >= self.config.min_queries:
            threat_class = "DNS_TUNNEL"

        severity = map_score_to_severity(fused_score)

        evidence: Dict[str, Any] = {
            "parent_domain": parent_domain,
            "average_query_length": avg_len,
            "maximum_query_length": context["max_query_length"],
            "average_entropy": avg_ent,
            "query_frequency": query_freq,
            "unique_subdomain_ratio": unique_ratio,
            "query_count": q_count,
            "sub_scores": {
                "length": round(len_sub, 2),
                "entropy": round(ent_sub, 2),
                "frequency": round(freq_sub, 2),
                "subdomain_diversity": round(div_sub, 2),
                "nxdomain": round(nx_sub, 2)
            },
            "reasons": reasons if reasons else ["Normal DNS query traffic pattern"]
        }

        return DetectionResult(
            threat_class=threat_class,
            score=fused_score,
            severity=severity,
            evidence=evidence,
            detector_name=self.detector_name,
            model_version=self.model_version
        )
