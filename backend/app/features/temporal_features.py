"""
PassiveGuard AI — Temporal Feature Extraction Module (Module 2)

STRICT PASSIVE CONSTRAINT:
Calculates time-series metrics, inter-arrival time (IAT) statistics, and deterministic periodicity
from observed timestamp sequences. Memory usage is strictly bounded with configurable history limits and eviction timeouts.
"""
import math
import time
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class TemporalFeatures(BaseModel):
    """
    Structured container for time-series and inter-arrival time metrics.
    """
    temporal_mean_iat: float = 0.0
    temporal_std_iat: float = 0.0
    temporal_min_iat: float = 0.0
    temporal_max_iat: float = 0.0
    temporal_cv_iat: float = 0.0
    temporal_burstiness: float = 0.0
    temporal_periodicity: float = 0.0
    temporal_event_frequency: float = 0.0
    temporal_recurrence_count: int = 0


def calculate_periodicity(std_iat: float, mean_iat: float) -> float:
    """
    Calculates a deterministic beaconing periodicity score in [0.0, 1.0].
    
    Formula:
    For periodic heartbeats (e.g. 10s, 10s, 10s), std_iat is close to 0, yielding CV ~ 0.
    Periodicity = 1.0 / (1.0 + (std_iat / mean_iat))
    
    Examples:
    - Periodic (10s, 10s, 10s, 10s): mean=10.0, std=0.0 -> Periodicity = 1.00 (High)
    - Irregular (2s, 17s, 4s, 31s): mean=13.5, std=11.6 -> Periodicity = 0.53 (Lower)
    """
    if mean_iat <= 0.000001:
        return 0.0
    cv = std_iat / mean_iat
    score = 1.0 / (1.0 + cv)
    return round(max(0.0, min(1.0, score)), 4)


class TemporalFeatureExtractor:
    """
    Bounded stateful temporal feature engine.
    
    Tracks timestamp history per host/flow key up to max_history entries.
    Evicts idle state exceeding state_timeout to prevent unbounded memory growth.
    """

    def __init__(self, max_history: int = 100, feature_window: float = 300.0, state_timeout: float = 3600.0):
        self.max_history = max_history
        self.feature_window = feature_window
        self.state_timeout = state_timeout
        self._history: Dict[str, List[float]] = {}
        self._last_access: Dict[str, float] = {}

    def add_timestamp(self, entity_key: str, timestamp: float) -> None:
        """Adds a timestamp to the entity's bounded history buffer."""
        self._last_access[entity_key] = timestamp

        if entity_key not in self._history:
            self._history[entity_key] = []

        ts_list = self._history[entity_key]
        ts_list.append(timestamp)

        # Enforce maximum history buffer size
        if len(ts_list) > self.max_history:
            self._history[entity_key] = ts_list[-self.max_history:]

    def evict_stale_state(self, current_time: Optional[float] = None) -> int:
        """Evicts entity state that has exceeded state_timeout."""
        now = current_time or time.time()
        stale_keys = [k for k, last_t in self._last_access.items() if (now - last_t) > self.state_timeout]
        for k in stale_keys:
            del self._history[k]
            del self._last_access[k]
        return len(stale_keys)

    def extract_temporal_features(self, timestamps: List[float]) -> TemporalFeatures:
        """
        Extracts temporal features from a sequence of float timestamps (in seconds).
        """
        if len(timestamps) < 2:
            return TemporalFeatures(
                temporal_recurrence_count=len(timestamps)
            )

        sorted_ts = sorted(timestamps)
        # Filter timestamps within feature_window relative to latest timestamp if required
        latest_ts = sorted_ts[-1]
        window_ts = [t for t in sorted_ts if (latest_ts - t) <= self.feature_window]
        
        if len(window_ts) < 2:
            window_ts = sorted_ts

        iats = [window_ts[i] - window_ts[i - 1] for i in range(1, len(window_ts))]
        count = len(iats)
        
        min_iat = min(iats)
        max_iat = max(iats)
        mean_iat = sum(iats) / count

        variance = sum((x - mean_iat) ** 2 for x in iats) / count
        std_iat = math.sqrt(variance)

        # Coefficient of Variation (CV = std / mean) safely handled
        cv_iat = (std_iat / mean_iat) if mean_iat > 0.000001 else 0.0

        # Burstiness Index = (std - mean) / (std + mean)
        denom = std_iat + mean_iat
        burstiness = ((std_iat - mean_iat) / denom) if denom > 0.000001 else 0.0

        # Periodicity Calculation
        periodicity = calculate_periodicity(std_iat, mean_iat)

        # Event frequency (events per minute)
        time_span = max(window_ts[-1] - window_ts[0], 0.000001)
        event_freq = (len(window_ts) / (time_span / 60.0))

        return TemporalFeatures(
            temporal_mean_iat=round(mean_iat, 6),
            temporal_std_iat=round(std_iat, 6),
            temporal_min_iat=round(min_iat, 6),
            temporal_max_iat=round(max_iat, 6),
            temporal_cv_iat=round(cv_iat, 4),
            temporal_burstiness=round(burstiness, 4),
            temporal_periodicity=periodicity,
            temporal_event_frequency=round(event_freq, 4),
            temporal_recurrence_count=len(window_ts)
        )


def extract_temporal_features(timestamps: List[float]) -> TemporalFeatures:
    """Convenience functional interface for temporal feature extraction."""
    extractor = TemporalFeatureExtractor()
    return extractor.extract_temporal_features(timestamps)
