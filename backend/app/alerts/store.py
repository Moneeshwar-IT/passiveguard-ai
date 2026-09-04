"""
PassiveGuard AI — Shared SQLite Alert & Telemetry Persistence Store (Module 16)

STRICT PASSIVE CONSTRAINT:
Provides a safe local inter-process persistence store using SQLite.
Enables separate Python processes (e.g. scripts/run_demo.py and FastAPI uvicorn)
to share generated alerts and traffic telemetry locally without external network sockets.

Zero network transmission, zero active scanning, zero DNS resolution, zero TLS decryption.
"""
import os
import json
import time
import sqlite3
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from app.alerts.schema import Alert

logger = logging.getLogger(__name__)

# Default SQLite database path in data/ directory
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
DEFAULT_DB_PATH = os.path.join(PROJECT_ROOT, "data", "passiveguard.db")


class AlertStore:
    """
    SQLite-backed persistent store for alerts and traffic metrics.
    Enables cross-process synchronization between demo runner CLI and FastAPI backend.
    """

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or DEFAULT_DB_PATH
        if self.db_path != ":memory:":
            db_dir = os.path.dirname(os.path.abspath(self.db_path))
            os.makedirs(db_dir, exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=15.0)
        conn.row_factory = sqlite3.Row
        # Enable WAL mode for concurrent multi-process access if not in-memory
        if self.db_path != ":memory:":
            try:
                conn.execute("PRAGMA journal_mode=WAL;")
            except Exception:
                pass
        return conn

    def _init_db(self) -> None:
        """Initializes database schema if tables do not exist."""
        conn = self._get_connection()
        try:
            with conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS alerts (
                        alert_id TEXT PRIMARY KEY,
                        timestamp REAL NOT NULL,
                        flow_id TEXT,
                        source_ip TEXT NOT NULL,
                        source_port INTEGER NOT NULL,
                        destination_ip TEXT NOT NULL,
                        destination_port INTEGER NOT NULL,
                        protocol TEXT NOT NULL,
                        threat_class TEXT NOT NULL,
                        confidence REAL NOT NULL,
                        severity TEXT NOT NULL,
                        evidence TEXT,
                        detector_name TEXT NOT NULL,
                        model_version TEXT NOT NULL,
                        source TEXT DEFAULT 'controlled_demo',
                        created_at REAL NOT NULL
                    )
                """)
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp DESC)
                """)
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at ASC)
                """)
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS traffic_stats (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp REAL NOT NULL,
                        active_flows INTEGER DEFAULT 0,
                        total_packets_sec REAL DEFAULT 0.0,
                        total_bytes_sec REAL DEFAULT 0.0,
                        bandwidth_mbps REAL DEFAULT 0.0,
                        protocol_distribution TEXT,
                        updated_at REAL NOT NULL
                    )
                """)
        finally:
            conn.close()

    def _row_to_alert(self, row: sqlite3.Row) -> Alert:
        """Converts SQLite Row object to Alert Pydantic model."""
        evidence_dict = json.loads(row["evidence"]) if row["evidence"] else {}
        raw_ts = row["timestamp"]
        if isinstance(raw_ts, (int, float)):
            ts = datetime.fromtimestamp(raw_ts, tz=timezone.utc)
        else:
            ts = datetime.now(timezone.utc)

        source_val = row["source"] if "source" in row.keys() and row["source"] else "controlled_demo"

        alert_obj = Alert(
            alert_id=row["alert_id"],
            timestamp=ts,
            flow_id=row["flow_id"],
            source_ip=row["source_ip"],
            destination_ip=row["destination_ip"],
            source_port=int(row["source_port"]),
            destination_port=int(row["destination_port"]),
            protocol=row["protocol"],
            threat_class=row["threat_class"],
            confidence=float(row["confidence"]),
            severity=row["severity"],
            evidence=evidence_dict,
            detector_name=row["detector_name"],
            model_version=row["model_version"],
            source=source_val
        )
        object.__setattr__(alert_obj, "created_at", float(row["created_at"]))
        return alert_obj

    def save_alert(self, alert: Alert) -> Alert:
        """
        Persists an Alert instance to SQLite.
        """
        conn = self._get_connection()
        now = time.time()
        ts_val = alert.timestamp.timestamp() if isinstance(alert.timestamp, datetime) else float(alert.timestamp)
        evidence_json = json.dumps(alert.evidence or {})
        source_val = getattr(alert, "source", "controlled_demo")

        try:
            with conn:
                conn.execute("""
                    INSERT OR REPLACE INTO alerts (
                        alert_id, timestamp, flow_id, source_ip, source_port,
                        destination_ip, destination_port, protocol, threat_class,
                        confidence, severity, evidence, detector_name, model_version,
                        source, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    alert.alert_id,
                    ts_val,
                    alert.flow_id,
                    alert.source_ip,
                    alert.source_port,
                    alert.destination_ip,
                    alert.destination_port,
                    alert.protocol,
                    alert.threat_class,
                    alert.confidence,
                    alert.severity,
                    evidence_json,
                    alert.detector_name,
                    alert.model_version,
                    source_val,
                    now
                ))
            logger.debug(f"Alert persisted to SQLite: {alert.alert_id}")
        finally:
            conn.close()
        return alert

    def get_recent_alerts(self, limit: int = 50, severity: Optional[str] = None) -> List[Alert]:
        """
        Retrieves recent alerts sorted by timestamp descending, optionally filtered by severity.
        """
        conn = self._get_connection()
        try:
            if severity:
                cursor = conn.execute(
                    "SELECT * FROM alerts WHERE UPPER(severity) = ? ORDER BY timestamp DESC LIMIT ?",
                    (severity.upper(), limit)
                )
            else:
                cursor = conn.execute(
                    "SELECT * FROM alerts ORDER BY timestamp DESC LIMIT ?",
                    (limit,)
                )
            rows = cursor.fetchall()
            return [self._row_to_alert(r) for r in rows]
        finally:
            conn.close()

    def get_alert_by_id(self, alert_id: str) -> Optional[Alert]:
        """
        Retrieves a single alert by ID.
        """
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM alerts WHERE alert_id = ?", (alert_id,))
            row = cursor.fetchone()
            if row:
                return self._row_to_alert(row)
            return None
        finally:
            conn.close()

    def get_new_alerts_since(self, since_created_at: float) -> List[Alert]:
        """
        Retrieves new alerts created after since_created_at for WebSocket background polling.
        """
        conn = self._get_connection()
        try:
            cursor = conn.execute(
                "SELECT * FROM alerts WHERE created_at > ? ORDER BY created_at ASC",
                (since_created_at,)
            )
            rows = cursor.fetchall()
            return [self._row_to_alert(r) for r in rows]
        finally:
            conn.close()

    def clear_alerts(self) -> int:
        """
        Deletes all stored alerts from SQLite.
        """
        conn = self._get_connection()
        try:
            with conn:
                cursor = conn.execute("DELETE FROM alerts")
                count = cursor.rowcount
            logger.info(f"Cleared {count} alerts from SQLite store.")
            return count
        finally:
            conn.close()

    def clear_traffic_stats(self) -> int:
        """
        Deletes all traffic statistics snapshots from SQLite.
        """
        conn = self._get_connection()
        try:
            with conn:
                cursor = conn.execute("DELETE FROM traffic_stats")
                count = cursor.rowcount
            logger.info(f"Cleared {count} traffic stats rows from SQLite store.")
            return count
        finally:
            conn.close()

    def save_traffic_stats(self, stats: Dict[str, Any]) -> None:
        """
        Saves current traffic statistics snapshot to SQLite.
        """
        conn = self._get_connection()
        now = time.time()
        proto_json = json.dumps(stats.get("protocol_distribution", {}))
        try:
            with conn:
                conn.execute("""
                    INSERT INTO traffic_stats (
                        timestamp, active_flows, total_packets_sec, total_bytes_sec,
                        bandwidth_mbps, protocol_distribution, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    now,
                    int(stats.get("active_flows", 0)),
                    float(stats.get("total_packets_sec", 0.0)),
                    float(stats.get("total_bytes_sec", 0.0)),
                    float(stats.get("bandwidth_mbps", 0.0)),
                    proto_json,
                    now
                ))
        finally:
            conn.close()

    def get_latest_traffic_stats(self) -> Optional[Dict[str, Any]]:
        """
        Retrieves the latest traffic statistics snapshot from SQLite.
        """
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM traffic_stats ORDER BY id DESC LIMIT 1")
            row = cursor.fetchone()
            if row:
                proto_dist = json.loads(row["protocol_distribution"]) if row["protocol_distribution"] else {}
                return {
                    "timestamp": datetime.fromtimestamp(row["timestamp"], tz=timezone.utc).isoformat(),
                    "active_flows": int(row["active_flows"]),
                    "total_packets_sec": float(row["total_packets_sec"]),
                    "total_bytes_sec": float(row["total_bytes_sec"]),
                    "bandwidth_mbps": float(row["bandwidth_mbps"]),
                    "protocol_distribution": proto_dist
                }
            return None
        finally:
            conn.close()


# Default global singleton store instance
alert_store = AlertStore()
