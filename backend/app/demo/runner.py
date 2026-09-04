"""
PassiveGuard AI — Programmatic Demo Simulation Runner & Service (Module 17)

STRICT PASSIVE & SAFETY DIRECTIVE:
Executes safe, offline controlled threat demonstrations using synthetic telemetry flows.
Feeds observations sequentially through the EXISTING PipelineEngine, detects genuine threats,
fuses multi-signal risk, creates alerts via AlertManager, and streams real-time updates over WebSocket.

Zero network packet transmission, zero active network scanning, zero DNS query resolution, zero TLS decryption.
All telemetry objects are explicitly tagged with source="controlled_demo".
"""
import sys
import os
import time
import asyncio
import logging
from typing import List, Dict, Any, Optional

# Ensure scripts directory is importable
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(script_dir, "..", "..", ".."))
scripts_dir = os.path.join(project_root, "scripts")
if scripts_dir not in sys.path:
    sys.path.insert(0, scripts_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

try:
    from generate_demo_data import get_scenario_telemetry, SCENARIOS_CATALOG
except ImportError:
    from scripts.generate_demo_data import get_scenario_telemetry, SCENARIOS_CATALOG

from app.pipeline.engine import pipeline_engine
from app.alerts.manager import alert_manager

logger = logging.getLogger(__name__)

# Structured metadata catalog for Demo UI display
SCENARIO_METADATA = {
    "ddos": {
        "title": "Volumetric & SYN Flood DDoS",
        "category": "Denial of Service",
        "threat_class": "DDOS_SPOOFED_SOURCE",
        "description": "High-volume SYN flood telemetry targeting internal server port 80.",
        "icon": "ShieldAlert"
    },
    "recon": {
        "title": "Port Scanning & Reconnaissance",
        "category": "Reconnaissance",
        "threat_class": "RECON_SCAN",
        "description": "Vertical port scanning sweep probing 25 distinct target ports.",
        "icon": "Search"
    },
    "c2": {
        "title": "C2 Beaconing Heartbeat",
        "category": "Command & Control",
        "threat_class": "C2_BEACON",
        "description": "Low-and-slow periodic session sequence with regular inter-arrival intervals.",
        "icon": "Radio"
    },
    "dga": {
        "title": "DGA Domain Query",
        "category": "Malware C2",
        "threat_class": "DGA_DOMAIN",
        "description": "High-entropy algorithmically generated domain query telemetry.",
        "icon": "FileCode"
    },
    "dns_tunnel": {
        "title": "DNS Tunnelling Exfiltration",
        "category": "Covert Channel",
        "threat_class": "DNS_TUNNEL",
        "description": "Sequence of DNS queries with long encoded subdomains under same parent.",
        "icon": "Terminal"
    },
    "tls_malware": {
        "title": "Encrypted Session Malware",
        "category": "Encrypted Malware",
        "threat_class": "ENCRYPTED_MALWARE",
        "description": "Metadata-only suspicious SSL/TLS session with fixed packet size uniformity.",
        "icon": "Lock"
    },
    "exfiltration": {
        "title": "Data Exfiltration",
        "category": "Exfiltration",
        "threat_class": "DATA_EXFILTRATION",
        "description": "High-volume asymmetric outbound TCP transfer session.",
        "icon": "UploadCloud"
    },
    "mixed": {
        "title": "Multi-Stage Attack Chain",
        "category": "Advanced Persistent Threat",
        "threat_class": "MULTI_STAGE_APT",
        "description": "Sequential multi-stage cyber attack chain (Recon -> C2 -> DGA -> Tunnel -> TLS -> Exfil -> DDoS).",
        "icon": "Layers"
    },
    "all": {
        "title": "Full Sequential Demonstration",
        "category": "Comprehensive",
        "threat_class": "FULL_SUITE",
        "description": "Executes all 7 controlled threat scenarios sequentially in order.",
        "icon": "PlayCircle"
    }
}


class DemoRunnerService:
    """
    Thread-safe, lock-protected Demo Simulation Service.
    Executes controlled demo scenarios programmatically using existing PipelineEngine and AlertManager.
    """

    def __init__(self):
        self._lock = asyncio.Lock()
        self._is_running = False
        self._current_scenario: Optional[str] = None
        self._last_run: Optional[Dict[str, Any]] = None

    @property
    def is_running(self) -> bool:
        return self._is_running

    def get_scenarios_catalog(self) -> List[Dict[str, Any]]:
        """Returns structured list of available controlled demonstration scenarios."""
        catalog = []
        for key, desc in SCENARIOS_CATALOG.items():
            meta = SCENARIO_METADATA.get(key, {
                "title": key.upper(),
                "category": "Simulation",
                "threat_class": key.upper(),
                "description": desc,
                "icon": "AlertCircle"
            })
            catalog.append({
                "id": key,
                "title": meta["title"],
                "category": meta["category"],
                "threat_class": meta["threat_class"],
                "description": desc,
                "icon": meta["icon"]
            })
        return catalog

    def get_status(self) -> Dict[str, Any]:
        """Returns current demo runner status."""
        return {
            "is_running": self._is_running,
            "current_scenario": self._current_scenario,
            "last_run": self._last_run,
            "passive_safety_notice": {
                "mode": "OFFLINE / CONTROLLED DEMO DATA",
                "network_transmission": "DISABLED",
                "external_dns": "DISABLED",
                "tls_decryption": "DISABLED"
            }
        }

    def reset_state(self) -> Dict[str, Any]:
        """
        Safely resets in-memory demonstration state, SQLite alert store, alert buffer,
        deduplication cache, traffic analytics, and temporal detector state trackers.
        """
        self._last_run = None
        self._current_scenario = None

        alert_manager.clear_alerts()

        if hasattr(pipeline_engine, "traffic_tracker") and hasattr(pipeline_engine.traffic_tracker, "reset"):
            pipeline_engine.traffic_tracker.reset()

        for detector in [
            getattr(pipeline_engine, "ddos_detector", None),
            getattr(pipeline_engine, "c2_detector", None),
            getattr(pipeline_engine, "dga_detector", None),
            getattr(pipeline_engine, "dns_tunnel_detector", None),
            getattr(pipeline_engine, "tls_detector", None),
            getattr(pipeline_engine, "recon_detector", None),
            getattr(pipeline_engine, "exfil_detector", None)
        ]:
            if not detector:
                continue
            for attr_name in ["state_tracker", "tracker", "history", "_history", "_state", "_last_access"]:
                if hasattr(detector, attr_name):
                    tracker = getattr(detector, attr_name)
                    if hasattr(tracker, "clear") and callable(tracker.clear):
                        tracker.clear()
                    if hasattr(tracker, "_history") and isinstance(tracker._history, dict):
                        tracker._history.clear()
                    if hasattr(tracker, "_state") and isinstance(tracker._state, dict):
                        tracker._state.clear()
                    if hasattr(tracker, "_last_access") and isinstance(tracker._last_access, dict):
                        tracker._last_access.clear()

        # Broadcast WebSocket reset notification to all open SOC dashboard connections
        try:
            from app.api.websocket import ws_manager
            ws_manager.broadcast_sync({
                "event": "state_reset",
                "type": "state_reset",
                "data": {
                    "active_flows": 0,
                    "total_packets_sec": 0.0,
                    "total_bytes_sec": 0.0,
                    "bandwidth_mbps": 0.0,
                    "protocol_distribution": {"TCP": 0, "UDP": 0, "ICMP": 0, "OTHER": 0},
                    "alerts_count": 0,
                    "history": pipeline_engine.traffic_tracker.get_historical_points() if hasattr(pipeline_engine, "traffic_tracker") else []
                }
            })
        except Exception as e:
            logger.error(f"Error dispatching WebSocket state_reset event: {e}")

        logger.info("Reset demonstration state, SQLite alert store, traffic analytics, and temporal trackers.")
        return {
            "status": "success",
            "message": "Demo state, SQLite alert store, deduplication cache, and temporal state trackers cleared successfully.",
            "events_processed": 0,
            "detections_count": 0,
            "alerts_generated_count": 0
        }

    async def run_scenario(self, scenario: str, reset_state: bool = False, delay: float = 0.0) -> Dict[str, Any]:
        """
        Executes controlled demo simulation programmatically.
        Enforces lock to prevent concurrent runs.
        """
        scenario = scenario.lower().strip()
        if scenario not in SCENARIOS_CATALOG:
            raise ValueError(f"Invalid demo scenario: '{scenario}'. Allowed scenarios: {list(SCENARIOS_CATALOG.keys())}")

        if self._lock.locked():
            raise RuntimeError("A demonstration scenario is currently executing. Please wait for it to complete.")

        async with self._lock:
            self._is_running = True
            self._current_scenario = scenario
            try:
                if reset_state:
                    self.reset_state()

                if scenario == "all":
                    result = await self._run_full_demo(delay=delay)
                else:
                    result = await self._run_single_scenario(scenario=scenario, delay=delay)

                self._last_run = result
                return result
            finally:
                self._is_running = False
                self._current_scenario = None

    async def _run_single_scenario(self, scenario: str, delay: float = 0.0) -> Dict[str, Any]:
        """Runs a single scenario programmatically."""
        t0 = time.perf_counter()

        flows = get_scenario_telemetry(scenario)

        detections_count = 0
        alerts_generated_count = 0
        alerts_suppressed_count = 0
        events_processed = 0
        max_risk_score = 0.0
        highest_severity = "INFO"
        primary_threat = "BENIGN"
        scenario_alerts = []

        severity_weights = {"CRITICAL": 5, "HIGH": 4, "MEDIUM": 3, "LOW": 2, "INFO": 1}

        for flow in flows:
            events_processed += 1
            alerts_before = len(alert_manager.get_recent_alerts())

            # Process flow through EXISTING PipelineEngine
            fused = pipeline_engine.process_flow(flow)

            alerts_after = len(alert_manager.get_recent_alerts())

            if fused.fused_score > max_risk_score:
                max_risk_score = fused.fused_score

            if severity_weights.get(fused.severity, 0) > severity_weights.get(highest_severity, 0):
                highest_severity = fused.severity

            if fused.primary_threat_class != "BENIGN":
                detections_count += 1
                primary_threat = fused.primary_threat_class

                if alerts_after > alerts_before:
                    alerts_generated_count += 1
                    latest_alert = alert_manager.get_recent_alerts()[0]
                    scenario_alerts.append(latest_alert.model_dump(mode="json"))
                elif fused.fused_score >= pipeline_engine.alert_threshold:
                    alerts_suppressed_count += 1

            if delay > 0:
                await asyncio.sleep(delay)

        duration = max(0.0001, time.perf_counter() - t0)
        rate = events_processed / duration

        meta = SCENARIO_METADATA.get(scenario, {"title": scenario.upper(), "description": SCENARIOS_CATALOG.get(scenario, "")})

        return {
            "mode": "OFFLINE / CONTROLLED DEMO DATA",
            "scenario": scenario,
            "title": meta["title"],
            "description": meta["description"],
            "status": "DETECTED" if detections_count > 0 else "BENIGN",
            "events_processed": events_processed,
            "detections_count": detections_count,
            "alerts_generated_count": alerts_generated_count,
            "alerts_suppressed_count": alerts_suppressed_count,
            "highest_severity": highest_severity if detections_count > 0 else "INFO",
            "max_risk_score": round(max_risk_score, 4),
            "primary_threat_class": primary_threat,
            "duration_sec": round(duration, 4),
            "rate_events_per_sec": round(rate, 2),
            "alerts": scenario_alerts,
            "passive_safety_notice": {
                "network_transmission": "DISABLED",
                "external_dns": "DISABLED",
                "tls_decryption": "DISABLED"
            }
        }

    async def _run_full_demo(self, delay: float = 0.0) -> Dict[str, Any]:
        """Runs all 7 individual threat scenarios sequentially in order."""
        t0 = time.perf_counter()
        sequential_scenarios = ["ddos", "recon", "c2", "dga", "dns_tunnel", "tls_malware", "exfiltration"]

        full_results = []
        total_events = 0
        total_detections = 0
        total_alerts_generated = 0
        total_alerts_suppressed = 0

        for sc in sequential_scenarios:
            sc_result = await self._run_single_scenario(scenario=sc, delay=delay)
            full_results.append(sc_result)

            total_events += sc_result["events_processed"]
            total_detections += sc_result["detections_count"]
            total_alerts_generated += sc_result["alerts_generated_count"]
            total_alerts_suppressed += sc_result["alerts_suppressed_count"]

        duration = max(0.0001, time.perf_counter() - t0)
        rate = total_events / duration

        return {
            "mode": "OFFLINE / CONTROLLED DEMO DATA",
            "scenario": "all",
            "title": "Full Sequential Demonstration",
            "description": "Executes all 7 controlled threat scenarios sequentially in order.",
            "status": "SUCCESS",
            "total_events_processed": total_events,
            "total_detections_generated": total_detections,
            "total_alerts_generated": total_alerts_generated,
            "total_alerts_suppressed": total_alerts_suppressed,
            "duration_sec": round(duration, 4),
            "rate_events_per_sec": round(rate, 2),
            "scenarios_summary": full_results,
            "passive_safety_notice": {
                "network_transmission": "DISABLED",
                "external_dns": "DISABLED",
                "tls_decryption": "DISABLED"
            }
        }


# Global DemoRunnerService instance
demo_runner_service = DemoRunnerService()
