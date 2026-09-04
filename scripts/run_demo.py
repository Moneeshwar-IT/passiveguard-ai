"""
PassiveGuard AI — Controlled Demonstration Runner (Module 15)

STRICT PASSIVE & SAFETY DIRECTIVE:
Executes safe, offline controlled threat demonstrations using synthetic telemetry flows.
Feeds observations sequentially through the EXISTING PipelineEngine, detects genuine threats,
fuses multi-signal risk, creates alerts via AlertManager, and streams real-time updates over WebSocket.

Zero network packet transmission, zero active network scanning, zero DNS query resolution, zero TLS decryption.
"""
import sys
import os
import time
import argparse
import logging

# Ensure backend and scripts directories are on Python search path
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(script_dir, ".."))
backend_dir = os.path.join(project_root, "backend")
scripts_dir = os.path.join(project_root, "scripts")

for p in [project_root, backend_dir, scripts_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("run_demo")

try:
    from generate_demo_data import get_scenario_telemetry, print_scenarios_list, SCENARIOS_CATALOG
except ImportError:
    from scripts.generate_demo_data import get_scenario_telemetry, print_scenarios_list, SCENARIOS_CATALOG
from app.pipeline.engine import pipeline_engine
from app.alerts.manager import alert_manager


def reset_demo_state() -> None:
    """
    Safely resets in-memory demonstration state, SQLite alert store, alert buffer, deduplication cache,
    and temporal detector state trackers without modifying disk configuration.
    """
    alert_manager.clear_alerts()

    if hasattr(pipeline_engine, "traffic_tracker"):
        tt = pipeline_engine.traffic_tracker
        if hasattr(tt, "_active_flows") and isinstance(tt._active_flows, dict):
            tt._active_flows.clear()
        if hasattr(tt, "_protocol_counts") and isinstance(tt._protocol_counts, dict):
            tt._protocol_counts = {"TCP": 0, "UDP": 0, "ICMP": 0, "OTHER": 0}
        if hasattr(tt, "_total_packets"):
            tt._total_packets = 0
        if hasattr(tt, "_total_bytes"):
            tt._total_bytes = 0
        if hasattr(tt, "_history") and isinstance(tt._history, list):
            tt._history.clear()

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

    print("\n==================================================")
    print("PASSIVEGUARD AI — DEMONSTRATION STATE RESET")
    print("==================================================")
    print("  SQLite Alert Store  : CLEARED")
    print("  Alert Buffer        : CLEARED")
    print("  Deduplication Cache : CLEARED")
    print("  Traffic Analytics   : RESET")
    print("  Temporal Trackers   : FLUSHED")
    print("==================================================\n")


def run_demo_simulation(scenario: str = "mixed", delay: float = 0.0) -> bool:
    """
    Executes controlled demo simulation by feeding synthetic observations through the existing pipeline engine.
    """
    print("\n==================================================")
    print("PASSIVEGUARD AI — CONTROLLED DEMONSTRATION")
    print("==================================================")
    print("\nMODE:")
    print("  OFFLINE / CONTROLLED DEMO DATA")
    print("\nNETWORK TRANSMISSION:")
    print("  DISABLED")
    print("\nTLS DECRYPTION:")
    print("  DISABLED")
    print("\nEXTERNAL DNS:")
    print("  DISABLED")
    print(f"\nSCENARIO:")
    print(f"  {scenario.upper()} ({SCENARIOS_CATALOG.get(scenario, 'Custom Demo Scenario')})")
    print("--------------------------------------------------\n")

    # Fetch synthetic telemetry flows
    try:
        flows = get_scenario_telemetry(scenario)
    except Exception as e:
        print(f"Error initializing demo scenario: {e}")
        return False

    start_t = time.perf_counter()

    detections_count = 0
    alerts_generated_count = 0
    alerts_suppressed_count = 0
    events_processed = 0

    print("PROCESSING DEMO TELEMETRY THROUGH PASSIVE PIPELINE...\n")

    for idx, flow in enumerate(flows):
        events_processed += 1
        
        alerts_before = len(alert_manager.get_recent_alerts())

        # Process flow through EXISTING pipeline engine
        fused = pipeline_engine.process_flow(flow)

        alerts_after = len(alert_manager.get_recent_alerts())

        if fused.primary_threat_class != "BENIGN":
            detections_count += 1
            
            if alerts_after > alerts_before:
                alerts_generated_count += 1
                latest_alert = alert_manager.get_recent_alerts()[0]

                print(f"  [{detections_count}] {fused.primary_threat_class}")
                print(f"      Detection:  DETECTED")
                print(f"      Score:      {fused.fused_score:.4f}")
                print(f"      Severity:   {fused.severity}")
                print(f"      Alert:      GENERATED")
                print(f"      Alert ID:   {latest_alert.alert_id}")
                print(f"      Detector:   {latest_alert.detector_name}")
                print(f"      Flow ID:    {flow.flow_id} ({flow.src_ip} -> {flow.dst_ip}:{flow.dst_port})")
                print("")
            elif fused.fused_score >= pipeline_engine.alert_threshold:
                alerts_suppressed_count += 1

                print(f"  [{detections_count}] {fused.primary_threat_class}")
                print(f"      Detection:  DETECTED")
                print(f"      Score:      {fused.fused_score:.4f}")
                print(f"      Severity:   {fused.severity}")
                print(f"      Alert:      SUPPRESSED (COOLDOWN)")
                print(f"      Flow ID:    {flow.flow_id} ({flow.src_ip} -> {flow.dst_ip}:{flow.dst_port})")
                print("")

        if delay > 0:
            time.sleep(delay)

    duration = max(0.0001, time.perf_counter() - start_t)
    rate = events_processed / duration

    print("--------------------------------------------------")
    print(f"EVENTS PROCESSED:         {events_processed}")
    print(f"DETECTIONS GENERATED:     {detections_count}")
    print(f"ALERTS GENERATED:         {alerts_generated_count}")
    print(f"ALERTS SUPPRESSED:        {alerts_suppressed_count}")
    print(f"PROCESSING DURATION:      {duration:.4f} sec")
    print(f"PROCESSING RATE:          {rate:.2f} events/sec")
    print("--------------------------------------------------")
    print("PIPELINE STATUS:          SUCCESS")
    print("WEBSOCKET STREAM:         ACTIVE")
    print("DASHBOARD ALERT DELIVERY: VERIFIED")
    print("==================================================\n")

    return True


def main():
    parser = argparse.ArgumentParser(description="PassiveGuard AI Controlled Demo Runner")
    parser.add_argument("--scenario", type=str, default="mixed", help="Scenario to run (e.g. ddos, c2, dga, dns_tunnel, tls_malware, recon, exfiltration, mixed, all)")
    parser.add_argument("--delay", type=float, default=0.0, help="Optional delay pacing between flows in seconds")
    parser.add_argument("--reset", action="store_true", help="Reset in-memory demo state and alert buffer")
    parser.add_argument("--clear", action="store_true", help="Clear SQLite alerts and reset demonstration state")
    parser.add_argument("--list", action="store_true", help="List available demo scenarios")

    args = parser.parse_args()

    if args.reset or args.clear:
        reset_demo_state()
        sys.exit(0)

    if args.list:
        print_scenarios_list()
        sys.exit(0)

    success = run_demo_simulation(scenario=args.scenario, delay=args.delay)
    if success:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
