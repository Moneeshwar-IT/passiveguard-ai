import time
import logging
from typing import List, Optional, Dict, Set, Callable, Tuple
from app.alerts.schema import Alert
from app.alerts.store import alert_store, AlertStore

logger = logging.getLogger(__name__)


class AlertManager:
    """
    In-memory & persistent Alert Manager.
    Handles alert ingestion, storage, bounded deduplication cooldown, SQLite persistence, and subscriber dispatching.
    
    STRICT PASSIVE CONSTRAINT:
    Dispatches alerts to passive monitoring UI consumers. NEVER sends mitigation commands.
    """

    def __init__(self, max_alerts: int = 1000, cooldown_sec: float = 60.0, store: Optional[AlertStore] = None):
        self.max_alerts = max_alerts
        self.cooldown_sec = cooldown_sec
        self.store = store or alert_store
        self._alerts: List[Alert] = []
        self._alert_ids: Set[str] = set()
        self._subscribers: List[Callable[[Alert], None]] = []

        # Deduplication cache: Key (src_ip, dst_ip, threat_class) -> last_alert_timestamp
        self._dedup_cache: Dict[Tuple[str, str, str], float] = {}

    def is_duplicate(self, source_ip: str, destination_ip: str, threat_class: str, current_time: Optional[float] = None) -> bool:
        """
        Checks if an alert for (src_ip, dst_ip, threat_class) occurred within the cooldown window.
        """
        now = current_time or time.time()
        dedup_key = (source_ip, destination_ip, threat_class)
        last_t = self._dedup_cache.get(dedup_key)

        if last_t is not None and (now - last_t) < self.cooldown_sec:
            return True
        return False

    def evict_stale_dedup_state(self, current_time: Optional[float] = None) -> int:
        """Evicts expired deduplication keys from cache."""
        now = current_time or time.time()
        stale = [k for k, t in self._dedup_cache.items() if (now - t) > self.cooldown_sec]
        for k in stale:
            del self._dedup_cache[k]
        return len(stale)

    def create_alert(self, alert: Alert, current_time: Optional[float] = None) -> Alert:
        """
        Registers a new alert, enforcing deduplication, SQLite persistence, and subscriber notification.
        """
        now = current_time or time.time()

        if alert.alert_id in self._alert_ids:
            logger.debug(f"Duplicate alert ID skipped: {alert.alert_id}")
            return alert

        # Deduplication cooldown check per (src_ip, dst_ip, threat_class)
        if self.is_duplicate(alert.source_ip, alert.destination_ip, alert.threat_class, current_time=now):
            logger.debug(f"Deduplicated alert suppressed for ({alert.source_ip} -> {alert.destination_ip}, {alert.threat_class})")
            return alert

        # Record deduplication timestamp
        dedup_key = (alert.source_ip, alert.destination_ip, alert.threat_class)
        self._dedup_cache[dedup_key] = now

        # Persist alert to SQLite store for cross-process access
        try:
            self.store.save_alert(alert)
        except Exception as e:
            logger.error(f"Error persisting alert to SQLite store: {e}")

        self._alerts.insert(0, alert)  # Newest alerts first
        self._alert_ids.add(alert.alert_id)

        # Enforce max buffer limit
        if len(self._alerts) > self.max_alerts:
            removed = self._alerts.pop()
            self._alert_ids.remove(removed.alert_id)

        # Periodic deduplication cache cleanup
        if len(self._dedup_cache) > 1000:
            self.evict_stale_dedup_state(current_time=now)

        logger.info(f"Alert Created: [{alert.severity}] {alert.threat_class} from {alert.source_ip} (ID: {alert.alert_id})")

        # Notify active WebSocket / API subscribers
        for sub in self._subscribers:
            try:
                sub(alert)
            except Exception as e:
                logger.error(f"Error dispatching alert to subscriber: {e}")

        return alert

    def get_recent_alerts(self, limit: int = 50, severity: Optional[str] = None) -> List[Alert]:
        """
        Retrieves recent alerts from the shared SQLite store, optionally filtered by severity.
        """
        try:
            return self.store.get_recent_alerts(limit=limit, severity=severity)
        except Exception as e:
            logger.error(f"Error querying SQLite store for recent alerts: {e}")
            if severity:
                sev_upper = severity.upper()
                return [a for a in self._alerts if a.severity.upper() == sev_upper][:limit]
            return self._alerts[:limit]

    def get_alert_by_id(self, alert_id: str) -> Optional[Alert]:
        """
        Retrieves a specific alert by ID from the shared SQLite store.
        """
        try:
            stored = self.store.get_alert_by_id(alert_id)
            if stored:
                return stored
        except Exception as e:
            logger.error(f"Error querying SQLite store for alert ID {alert_id}: {e}")

        for a in self._alerts:
            if a.alert_id == alert_id:
                return a
        return None

    def clear_alerts(self) -> int:
        """
        Clears all alerts from both SQLite persistence and in-memory buffers.
        """
        count = 0
        try:
            count = self.store.clear_alerts()
        except Exception as e:
            logger.error(f"Error clearing SQLite alerts: {e}")
        
        self._alerts.clear()
        self._alert_ids.clear()
        self._dedup_cache.clear()
        return count

    def subscribe(self, callback: Callable[[Alert], None]) -> None:
        """
        Register a subscriber callback function for live alert streaming.
        """
        self._subscribers.append(callback)


# Global singleton instance for app lifespan
alert_manager = AlertManager()
