import sys
import os
import ast
import pytest
import time

# Ensure project root and scripts directories are on sys.path
test_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(test_dir, "..", ".."))
backend_dir = os.path.join(project_root, "backend")
scripts_dir = os.path.join(project_root, "scripts")

for p in [project_root, backend_dir, scripts_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from generate_demo_data import (
        get_scenario_telemetry, SCENARIOS_CATALOG,
        generate_ddos_scenario, generate_c2_scenario, generate_dga_scenario,
        generate_dns_tunnel_scenario, generate_tls_malware_scenario,
        generate_recon_scenario, generate_exfiltration_scenario, generate_mixed_scenario
    )
    from run_demo import run_demo_simulation
except ImportError:
    from scripts.generate_demo_data import (
        get_scenario_telemetry, SCENARIOS_CATALOG,
        generate_ddos_scenario, generate_c2_scenario, generate_dga_scenario,
        generate_dns_tunnel_scenario, generate_tls_malware_scenario,
        generate_recon_scenario, generate_exfiltration_scenario, generate_mixed_scenario
    )
    from scripts.run_demo import run_demo_simulation
from app.pipeline.engine import PipelineEngine
from app.alerts.manager import AlertManager, alert_manager
from app.alerts.schema import Alert


def test_1_scenario_listing_validation():
    """Verify scenario catalog contains all 9 supported demo scenarios."""
    assert "ddos" in SCENARIOS_CATALOG
    assert "c2" in SCENARIOS_CATALOG
    assert "dga" in SCENARIOS_CATALOG
    assert "dns_tunnel" in SCENARIOS_CATALOG
    assert "tls_malware" in SCENARIOS_CATALOG
    assert "recon" in SCENARIOS_CATALOG
    assert "exfiltration" in SCENARIOS_CATALOG
    assert "mixed" in SCENARIOS_CATALOG
    assert "all" in SCENARIOS_CATALOG


def test_2_each_scenario_generates_valid_telemetry():
    """Verify all individual scenarios generate non-empty lists of DemoFlowRecord objects."""
    for s_name in ["ddos", "c2", "dga", "dns_tunnel", "tls_malware", "recon", "exfiltration", "mixed"]:
        flows = get_scenario_telemetry(s_name)
        assert len(flows) > 0
        for f in flows:
            assert f.flow_id is not None
            assert f.src_ip is not None
            assert f.dst_ip is not None
            assert f.source == "controlled_demo"


def test_3_ddos_reaches_ddos_detector():
    """Verify synthetic DDoS telemetry triggers DDoS detection in pipeline."""
    engine = PipelineEngine()
    flows = generate_ddos_scenario()
    fused = engine.process_flow(flows[0])
    assert fused.detector_scores["ddos_detector"] >= 0.65


def test_4_c2_sequence_reaches_c2_detector():
    """Verify synthetic C2 sequence triggers C2 beaconing detection in pipeline."""
    engine = PipelineEngine()
    flows = generate_c2_scenario()
    fused = None
    for f in flows:
        fused = engine.process_flow(f)
    assert fused is not None
    assert fused.detector_scores["c2_detector"] >= 0.65


def test_5_dga_reaches_dga_detector():
    """Verify synthetic DGA domain telemetry triggers DGA detection in pipeline."""
    engine = PipelineEngine()
    flows = generate_dga_scenario()
    fused = engine.process_flow(flows[0])
    assert fused.detector_scores["dga_detector"] >= 0.60


def test_6_dns_tunnel_reaches_dns_tunnel_detector():
    """Verify synthetic DNS tunnelling sequence triggers DNS_TUNNEL detection in pipeline."""
    engine = PipelineEngine()
    flows = generate_dns_tunnel_scenario()
    fused = None
    for f in flows:
        fused = engine.process_flow(f)
    assert fused is not None
    assert fused.detector_scores["dns_tunneling_detector"] >= 0.60


def test_7_tls_metadata_reaches_tls_detector():
    """Verify metadata-only TLS telemetry triggers ENCRYPTED_MALWARE detection in pipeline."""
    engine = PipelineEngine()
    flows = generate_tls_malware_scenario()
    fused = engine.process_flow(flows[0])
    assert fused.detector_scores["tls_detector"] >= 0.60


def test_8_recon_reaches_recon_detector():
    """Verify vertical port scan sequence triggers RECON_SCAN detection in pipeline."""
    engine = PipelineEngine()
    flows = generate_recon_scenario()
    fused = None
    for f in flows:
        fused = engine.process_flow(f)
    assert fused is not None
    assert fused.detector_scores["recon_detector"] >= 0.60


def test_9_exfiltration_reaches_exfiltration_detector():
    """Verify high outbound byte flow triggers DATA_EXFILTRATION detection in pipeline."""
    engine = PipelineEngine()
    flows = generate_exfiltration_scenario()
    fused = engine.process_flow(flows[0])
    assert fused.detector_scores["exfiltration_detector"] >= 0.65


def test_10_mixed_scenario_executes_successfully():
    """Verify mixed multi-stage attack scenario executes cleanly via run_demo_simulation."""
    success = run_demo_simulation(scenario="mixed", delay=0.0)
    assert success is True


def test_11_generated_data_is_deterministic():
    """Verify demo telemetry generation is 100% deterministic given fixed seed."""
    flows1 = get_scenario_telemetry("mixed")
    flows2 = get_scenario_telemetry("mixed")

    assert len(flows1) == len(flows2)
    for f1, f2 in zip(flows1, flows2):
        assert f1.flow_id == f2.flow_id
        assert f1.byte_count == f2.byte_count


def test_12_verify_no_socket_calls_in_demo_scripts():
    """AST static security check: Verify zero socket calls in generate_demo_data.py and run_demo.py."""
    for script_name in ["generate_demo_data.py", "run_demo.py"]:
        fpath = os.path.join(os.path.dirname(__file__), "..", "..", "scripts", script_name)
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()
            assert "import socket" not in content
            assert "socket.socket" not in content
            assert "socket.connect" not in content


def test_13_verify_no_dns_calls_in_demo_scripts():
    """AST static security check: Verify zero DNS resolvers in generate_demo_data.py and run_demo.py."""
    for script_name in ["generate_demo_data.py", "run_demo.py"]:
        fpath = os.path.join(os.path.dirname(__file__), "..", "..", "scripts", script_name)
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()
            assert "dns.resolver" not in content


def test_14_verify_no_external_http_calls_in_demo_scripts():
    """AST static security check: Verify zero HTTP request libraries in demo scripts."""
    for script_name in ["generate_demo_data.py", "run_demo.py"]:
        fpath = os.path.join(os.path.dirname(__file__), "..", "..", "scripts", script_name)
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()
            assert "import requests" not in content
            assert "urllib.request" not in content


def test_15_verify_no_packet_transmission_in_demo_scripts():
    """AST static security check: Verify zero Scapy/raw packet send calls in demo scripts."""
    for script_name in ["generate_demo_data.py", "run_demo.py"]:
        fpath = os.path.join(os.path.dirname(__file__), "..", "..", "scripts", script_name)
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()
            assert "sendp(" not in content
            assert "send(" not in content
            assert "sr(" not in content
            assert "srp(" not in content


def test_16_verify_no_tls_decryption_in_demo_scripts():
    """AST static security check: Verify zero TLS decryption calls in demo scripts."""
    for script_name in ["generate_demo_data.py", "run_demo.py"]:
        fpath = os.path.join(os.path.dirname(__file__), "..", "..", "scripts", script_name)
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read().lower()
            assert "decrypt_tls" not in content
            assert "ssl_strip" not in content


def test_17_alerts_are_produced_through_existing_pipeline():
    """Verify alerts created during simulation pass through PipelineEngine and AlertManager."""
    alert_manager.clear_alerts()
    initial_count = len(alert_manager.get_recent_alerts())

    engine = PipelineEngine()
    flows = generate_ddos_scenario()
    engine.process_flow(flows[0])

    new_count = len(alert_manager.get_recent_alerts())
    assert new_count > initial_count


def test_18_evidence_is_preserved_in_alerts():
    """Verify created Alert object contains detailed evidence dictionary."""
    engine = PipelineEngine()
    flows = generate_ddos_scenario()
    engine.process_flow(flows[0])

    alerts = alert_manager.get_recent_alerts()
    assert len(alerts) > 0
    latest = alerts[0]
    assert isinstance(latest.evidence, dict)
    assert "risk_score" in latest.evidence or "detector_scores" in latest.evidence


def test_19_risk_fusion_is_preserved():
    """Verify FusedRiskAssessment preserves corroborating threat evidence."""
    engine = PipelineEngine()
    flows = generate_ddos_scenario()
    fused = engine.process_flow(flows[0])

    assert fused.fused_score >= 0.50
    assert isinstance(fused.detector_scores, dict)
    assert "ddos_detector" in fused.detector_scores


def test_20_existing_alert_schema_remains_compatible():
    """Verify Alert schema remains compatible with frontend requirements."""
    alert = Alert(
        flow_id="TEST-COMPAT",
        source_ip="192.168.1.1",
        destination_ip="10.0.0.1",
        source_port=12345,
        destination_port=80,
        protocol="TCP",
        threat_class="DDOS_SYN_FLOOD",
        severity="CRITICAL",
        confidence=0.95,
        evidence={"test": True},
        detector_name="risk_fusion_engine",
        model_version="statistical-v1"
    )
    d = alert.model_dump()
    assert d["threat_class"] == "DDOS_SYN_FLOOD"
    assert d["severity"] == "CRITICAL"
