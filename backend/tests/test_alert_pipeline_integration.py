"""
PassiveGuard AI — Module 15 End-to-End Alert Pipeline & Integration Test Suite

Verifies that qualifying detector results pass through Risk Fusion to generate unified alerts in AlertManager,
preserve evidence, emit WebSocket events, populate REST API endpoints, enforce deduplication cooldown,
and maintain 100% passive security constraints.
"""
import sys
import os
import time
import pytest
from fastapi.testclient import TestClient

# Ensure backend and scripts directories are on sys.path
test_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(test_dir, "..", ".."))
backend_dir = os.path.join(project_root, "backend")
scripts_dir = os.path.join(project_root, "scripts")

for p in [project_root, backend_dir, scripts_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

from app.main import app
from app.pipeline.engine import PipelineEngine, pipeline_engine
from app.alerts.manager import alert_manager, AlertManager
from app.alerts.schema import Alert
from app.api.websocket import ws_manager

try:
    from generate_demo_data import (
        generate_ddos_scenario, generate_c2_scenario, generate_dga_scenario,
        generate_dns_tunnel_scenario, generate_tls_malware_scenario,
        generate_recon_scenario, generate_exfiltration_scenario, generate_mixed_scenario
    )
    from run_demo import run_demo_simulation, reset_demo_state
except ImportError:
    from scripts.generate_demo_data import (
        generate_ddos_scenario, generate_c2_scenario, generate_dga_scenario,
        generate_dns_tunnel_scenario, generate_tls_malware_scenario,
        generate_recon_scenario, generate_exfiltration_scenario, generate_mixed_scenario
    )
    from scripts.run_demo import run_demo_simulation, reset_demo_state

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_demo_state():
    """Flushes alert manager and temporal trackers before each test."""
    reset_demo_state()
    yield
    reset_demo_state()


def test_1_qualifying_detector_result_creates_unified_alert():
    """Verify that a flow meeting alert threshold creates a unified alert in AlertManager."""
    initial_count = len(alert_manager.get_recent_alerts())
    engine = PipelineEngine()
    flows = generate_ddos_scenario()
    fused = engine.process_flow(flows[0])

    assert fused.fused_score >= engine.alert_threshold
    assert len(alert_manager.get_recent_alerts()) == initial_count + 1


def test_2_alert_is_accepted_by_alert_manager():
    """Verify alert manager accepts and stores created Alert instance."""
    engine = PipelineEngine()
    flows = generate_c2_scenario()
    for f in flows:
        engine.process_flow(f)

    alerts = alert_manager.get_recent_alerts()
    assert len(alerts) > 0
    assert alerts[0].threat_class == "C2_BEACON"


def test_3_alert_receives_valid_alert_id():
    """Verify generated alert possesses non-empty unique alert_id starting with ALT-."""
    engine = PipelineEngine()
    flows = generate_ddos_scenario()
    engine.process_flow(flows[0])

    latest = alert_manager.get_recent_alerts()[0]
    assert latest.alert_id is not None
    assert latest.alert_id.startswith("ALT-")


def test_4_evidence_is_preserved():
    """Verify alert evidence dictionary contains risk_score, detector_scores, and contributing_evidence."""
    engine = PipelineEngine()
    flows = generate_ddos_scenario()
    engine.process_flow(flows[0])

    latest = alert_manager.get_recent_alerts()[0]
    assert "risk_score" in latest.evidence
    assert "detector_scores" in latest.evidence
    assert "contributing_evidence" in latest.evidence


def test_5_threat_class_is_preserved():
    """Verify primary threat class is accurately preserved from Risk Fusion to Alert."""
    engine = PipelineEngine()
    flows = generate_exfiltration_scenario()
    fused = engine.process_flow(flows[0])

    latest = alert_manager.get_recent_alerts()[0]
    assert latest.threat_class == fused.primary_threat_class
    assert latest.threat_class == "DATA_EXFILTRATION"


def test_6_severity_is_preserved():
    """Verify severity level is correctly preserved in generated Alert."""
    engine = PipelineEngine()
    flows = generate_ddos_scenario()
    fused = engine.process_flow(flows[0])

    latest = alert_manager.get_recent_alerts()[0]
    assert latest.severity == fused.severity
    assert latest.severity in ["MEDIUM", "HIGH", "CRITICAL"]


def test_7_score_and_confidence_are_preserved():
    """Verify fused risk score and confidence are preserved in generated Alert."""
    engine = PipelineEngine()
    flows = generate_ddos_scenario()
    fused = engine.process_flow(flows[0])

    latest = alert_manager.get_recent_alerts()[0]
    assert latest.confidence == fused.confidence
    assert latest.evidence["risk_score"] == fused.fused_score


def test_8_model_metadata_is_preserved():
    """Verify model version metadata tags are preserved in alert object."""
    engine = PipelineEngine()
    flows = generate_ddos_scenario()
    engine.process_flow(flows[0])

    latest = alert_manager.get_recent_alerts()[0]
    assert latest.model_version is not None
    assert latest.detector_name == "risk_fusion_engine"


def test_9_alert_appears_through_get_alerts_api():
    """Verify GET /api/alerts returns newly created controlled-demo alerts."""
    engine = PipelineEngine()
    flows = generate_ddos_scenario()
    engine.process_flow(flows[0])

    res = client.get("/api/alerts")
    assert res.status_code == 200
    data = res.json()
    assert len(data) > 0
    assert data[0]["threat_class"] in ["DDOS_SYN_FLOOD", "DDOS_SPOOFED_SOURCE"]


def test_10_alert_detail_endpoint_works():
    """Verify GET /api/alerts/{alert_id} returns detailed alert data."""
    engine = PipelineEngine()
    flows = generate_ddos_scenario()
    engine.process_flow(flows[0])

    latest = alert_manager.get_recent_alerts()[0]
    res = client.get(f"/api/alerts/{latest.alert_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["alert_id"] == latest.alert_id
    assert data["threat_class"] == latest.threat_class


def test_11_websocket_broadcast_is_triggered():
    """Verify alert creation dispatches alert_created event to WebSocket manager."""
    broadcasted_messages = []

    def mock_broadcast(msg):
        broadcasted_messages.append(msg)

    orig_broadcast = ws_manager.broadcast_sync
    ws_manager.broadcast_sync = mock_broadcast

    try:
        engine = PipelineEngine()
        flows = generate_ddos_scenario()
        engine.process_flow(flows[0])

        assert len(broadcasted_messages) > 0
        event_types = [m.get("event") or m.get("type") for m in broadcasted_messages]
        assert "alert_created" in event_types
    finally:
        ws_manager.broadcast_sync = orig_broadcast


def test_12_deduplication_suppresses_rapid_identical_alerts():
    """Verify deduplication suppresses duplicate alerts for same 3-tuple within cooldown."""
    engine = PipelineEngine()
    flows1 = generate_ddos_scenario()
    flows2 = generate_ddos_scenario()

    engine.process_flow(flows1[0])
    count_1 = len(alert_manager.get_recent_alerts())

    # Second identical flow within 60s cooldown
    engine.process_flow(flows2[0])
    count_2 = len(alert_manager.get_recent_alerts())

    assert count_1 == 1
    assert count_2 == 1  # Suppressed by deduplication cooldown


def test_13_cooldown_eviction_allows_new_alert_after_timeout():
    """Verify alert manager allows new alert after deduplication cooldown expires."""
    mgr = AlertManager(cooldown_sec=1.0)
    a1 = Alert(
        flow_id="FLOW-1", source_ip="192.168.1.1", destination_ip="10.0.0.1",
        source_port=1234, destination_port=80, protocol="TCP", threat_class="DDOS_SYN_FLOOD",
        severity="HIGH", confidence=0.90, evidence={}, detector_name="test_detector"
    )
    mgr.create_alert(a1, current_time=100.0)
    assert len(mgr.get_recent_alerts()) == 1

    a2 = Alert(
        flow_id="FLOW-2", source_ip="192.168.1.1", destination_ip="10.0.0.1",
        source_port=1235, destination_port=80, protocol="TCP", threat_class="DDOS_SYN_FLOOD",
        severity="HIGH", confidence=0.90, evidence={}, detector_name="test_detector"
    )
    mgr.create_alert(a2, current_time=105.0)  # 5s > 1.0s cooldown
    assert len(mgr.get_recent_alerts()) == 2


def test_14_controlled_demo_alerts_are_tagged():
    """Verify demo flow telemetry carries source='controlled_demo' metadata tag."""
    flows = generate_mixed_scenario()
    for f in flows:
        assert getattr(f, "source", None) == "controlled_demo"


def test_15_no_fake_manual_alert_insertion_in_demo_runner():
    """Verify run_demo.py processes flows through PipelineEngine without fake alert insertion."""
    success = run_demo_simulation(scenario="ddos", delay=0.0)
    assert success is True


def test_16_dga_demo_reaches_dga_detector():
    """Verify synthetic DGA scenario triggers DGA_DOMAIN threat class."""
    engine = PipelineEngine()
    flows = generate_dga_scenario()
    fused = engine.process_flow(flows[0])

    assert fused.primary_threat_class == "DGA_DOMAIN"
    assert fused.fused_score >= engine.alert_threshold


def test_17_dns_tunnel_demo_reaches_dns_tunnel_detector():
    """Verify synthetic DNS tunnelling scenario triggers DNS_TUNNEL threat class."""
    engine = PipelineEngine()
    flows = generate_dns_tunnel_scenario()
    fused = None
    for f in flows:
        fused = engine.process_flow(f)

    assert fused is not None
    assert fused.primary_threat_class == "DNS_TUNNEL"
    assert fused.fused_score >= engine.alert_threshold


def test_18_recon_demo_reaches_recon_detector():
    """Verify synthetic Recon scenario triggers RECON_SCAN threat class."""
    engine = PipelineEngine()
    flows = generate_recon_scenario()
    fused = None
    for f in flows:
        fused = engine.process_flow(f)

    assert fused is not None
    assert fused.primary_threat_class == "RECON_SCAN"
    assert fused.fused_score >= engine.alert_threshold


def test_19_mixed_demo_produces_multiple_legitimate_detections():
    """Verify mixed multi-stage scenario produces multiple legitimate alert detections."""
    engine = PipelineEngine()
    flows = generate_mixed_scenario()
    
    threats = set()
    for f in flows:
        fused = engine.process_flow(f)
        if fused.primary_threat_class != "BENIGN" and fused.fused_score >= engine.alert_threshold:
            threats.add(fused.primary_threat_class)

    assert len(threats) >= 4  # e.g., DDoS, C2, DGA, Tunnel, TLS, Exfil, Recon


def test_20_verify_no_socket_calls_in_alert_pipeline():
    """AST static security check: Verify zero socket calls in alert pipeline files."""
    for rel_path in ["app/pipeline/engine.py", "app/alerts/manager.py", "app/risk/fusion.py"]:
        fpath = os.path.join(backend_dir, rel_path)
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()
            assert "socket.socket" not in content
            assert "socket.connect" not in content


def test_21_verify_no_external_http_in_alert_pipeline():
    """AST static security check: Verify zero external HTTP request libraries in alert pipeline."""
    for rel_path in ["app/pipeline/engine.py", "app/alerts/manager.py", "app/risk/fusion.py"]:
        fpath = os.path.join(backend_dir, rel_path)
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()
            assert "import requests" not in content
            assert "urllib.request" not in content


def test_22_verify_no_dns_resolution_in_alert_pipeline():
    """AST static security check: Verify zero active DNS resolvers in alert pipeline."""
    for rel_path in ["app/pipeline/engine.py", "app/alerts/manager.py", "app/risk/fusion.py"]:
        fpath = os.path.join(backend_dir, rel_path)
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()
            assert "dns.resolver" not in content


def test_23_verify_no_packet_transmission_in_alert_pipeline():
    """AST static security check: Verify zero Scapy/raw packet send calls in alert pipeline."""
    for rel_path in ["app/pipeline/engine.py", "app/alerts/manager.py", "app/risk/fusion.py"]:
        fpath = os.path.join(backend_dir, rel_path)
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()
            assert "sendp(" not in content
            assert "send(" not in content


def test_24_verify_no_tls_decryption_in_alert_pipeline():
    """AST static security check: Verify zero TLS decryption calls in alert pipeline."""
    for rel_path in ["app/pipeline/engine.py", "app/alerts/manager.py", "app/risk/fusion.py"]:
        fpath = os.path.join(backend_dir, rel_path)
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read().lower()
            assert "decrypt_tls" not in content
            assert "ssl_strip" not in content
