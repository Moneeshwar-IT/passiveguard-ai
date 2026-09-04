"""
PassiveGuard AI — Demo API & Simulation Endpoint Unit & Integration Tests (Module 17)

STRICT PASSIVE & SAFETY DIRECTIVE:
Verifies that controlled demo API endpoints execute synthetic telemetry through the existing
pipeline engine safely, without initiating active network connections, emitting packets, or resolving DNS.
"""
import pytest
import ast
import os
import sys
from fastapi.testclient import TestClient

# Ensure backend directory is on sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app
from app.alerts.store import alert_store
from app.alerts.manager import alert_manager

client = TestClient(app)


# 1. Scenarios Catalog Endpoint
def test_1_get_demo_scenarios_returns_catalog():
    response = client.get("/api/demo/scenarios")
    assert response.status_code == 200
    data = response.json()
    assert "scenarios" in data
    assert "passive_safety_notice" in data

    scenarios = data["scenarios"]
    assert len(scenarios) >= 8
    scenario_ids = [s["id"] for s in scenarios]
    assert "ddos" in scenario_ids
    assert "recon" in scenario_ids
    assert "c2" in scenario_ids
    assert "dga" in scenario_ids
    assert "dns_tunnel" in scenario_ids
    assert "tls_malware" in scenario_ids
    assert "exfiltration" in scenario_ids
    assert "all" in scenario_ids


# 2. Demo Status Endpoint
def test_2_get_demo_status_returns_valid_structure():
    response = client.get("/api/demo/status")
    assert response.status_code == 200
    data = response.json()
    assert "is_running" in data
    assert "passive_safety_notice" in data
    assert data["passive_safety_notice"]["network_transmission"] == "DISABLED"


# 3. Invalid Scenario Request Handled Safely
def test_3_run_invalid_scenario_returns_400():
    response = client.post("/api/demo/run", json={"scenario": "invalid_hacker_attack"})
    assert response.status_code == 400
    assert "Invalid scenario name" in response.json()["detail"]


# 4. Single Scenario Run — DDoS
def test_4_run_ddos_scenario_via_api():
    # Clear alerts first
    client.post("/api/demo/reset")

    response = client.post("/api/demo/run", json={"scenario": "ddos", "reset_state": True})
    assert response.status_code == 200
    data = response.json()
    assert data["scenario"] == "ddos"
    assert data["status"] in ["DETECTED", "BENIGN"]
    assert data["events_processed"] >= 1
    assert data["detections_count"] >= 1
    assert data["alerts_generated_count"] >= 1

    # Verify alert reaches AlertStore and API endpoint /api/alerts
    alerts_resp = client.get("/api/alerts")
    assert alerts_resp.status_code == 200
    alerts = alerts_resp.json()
    assert len(alerts) >= 1
    ddos_alerts = [a for a in alerts if "DDOS" in a["threat_class"]]
    assert len(ddos_alerts) >= 1
    assert ddos_alerts[0]["source"] == "controlled_demo"


# 5. Single Scenario Run — Recon
def test_5_run_recon_scenario_via_api():
    client.post("/api/demo/reset")

    response = client.post("/api/demo/run", json={"scenario": "recon", "reset_state": True})
    assert response.status_code == 200
    data = response.json()
    assert data["scenario"] == "recon"
    assert data["status"] == "DETECTED"
    assert data["events_processed"] == 25
    assert data["detections_count"] >= 1

    alerts_resp = client.get("/api/alerts")
    assert alerts_resp.status_code == 200
    alerts = alerts_resp.json()
    recon_alerts = [a for a in alerts if a["threat_class"] == "RECON_SCAN"]
    assert len(recon_alerts) >= 1
    assert recon_alerts[0]["model_version"] == "v1.0.0-hybrid"


# 6. Full Sequential Demo Run — "all"
def test_6_run_full_demo_via_api():
    client.post("/api/demo/reset")

    response = client.post("/api/demo/run", json={"scenario": "all", "reset_state": True})
    assert response.status_code == 200
    data = response.json()
    assert data["scenario"] == "all"
    assert data["status"] == "SUCCESS"
    assert "scenarios_summary" in data
    summary = data["scenarios_summary"]
    assert len(summary) == 7

    scenario_ids = [s["scenario"] for s in summary]
    assert scenario_ids == ["ddos", "recon", "c2", "dga", "dns_tunnel", "tls_malware", "exfiltration"]

    # Verify overall events and alerts created
    assert data["total_events_processed"] >= 30
    assert data["total_detections_generated"] >= 10


# 7. Reset State Endpoint & Traffic State Verification
def test_7_reset_demo_state_clears_store():
    # First run a scenario so there is active traffic and alerts
    client.post("/api/demo/run", json={"scenario": "ddos"})

    reset_resp = client.post("/api/demo/reset")
    assert reset_resp.status_code == 200
    assert reset_resp.json()["status"] == "success"

    # Verify status now has last_run as None
    status_resp = client.get("/api/demo/status")
    assert status_resp.status_code == 200
    assert status_resp.json()["last_run"] is None
    assert status_resp.json()["is_running"] is False

    # Verify alerts store is completely empty
    alerts_resp = client.get("/api/alerts")
    assert alerts_resp.status_code == 200
    assert len(alerts_resp.json()) == 0

    # Verify active flows and traffic metrics become 0 in /api/traffic/current
    traffic_resp = client.get("/api/traffic/current")
    assert traffic_resp.status_code == 200
    tdata = traffic_resp.json()
    assert tdata["active_flows"] == 0
    assert tdata["total_packets_sec"] == 0.0
    assert tdata["total_bytes_sec"] == 0.0
    assert tdata["bandwidth_mbps"] == 0.0

    # Verify historical traffic has 1 clean baseline point
    hist_resp = client.get("/api/traffic/historical")
    assert hist_resp.status_code == 200
    hdata = hist_resp.json()
    assert len(hdata) >= 1
    assert hdata[-1]["tcp_packets"] == 0
    assert hdata[-1]["udp_packets"] == 0


def test_7b_demo_reset_demo_sequence():
    # Step 1: Run DDoS
    run1 = client.post("/api/demo/run", json={"scenario": "ddos"})
    assert run1.status_code == 200
    assert len(client.get("/api/alerts").json()) > 0

    # Step 2: Reset
    reset1 = client.post("/api/demo/reset")
    assert reset1.status_code == 200
    assert client.get("/api/traffic/current").json()["active_flows"] == 0
    assert len(client.get("/api/alerts").json()) == 0

    # Step 3: Run Recon after Reset
    run2 = client.post("/api/demo/run", json={"scenario": "recon"})
    assert run2.status_code == 200
    assert run2.json()["scenario"] == "recon"
    assert len(client.get("/api/alerts").json()) > 0

    # Step 4: Reset again
    reset2 = client.post("/api/demo/reset")
    assert reset2.status_code == 200
    assert client.get("/api/traffic/current").json()["active_flows"] == 0
    assert len(client.get("/api/alerts").json()) == 0


# 8. AST Verification for Demo API & Service (No Network Calls)
def test_8_verify_no_network_or_socket_calls_in_demo_service():
    target_files = [
        os.path.join(backend_dir, "app", "demo", "runner.py"),
        os.path.join(backend_dir, "app", "api", "demo.py")
    ]

    forbidden_calls = {"socket", "connect", "send", "sendp", "sendall", "gethostbyname", "urlopen"}

    for filepath in target_files:
        assert os.path.exists(filepath), f"File {filepath} does not exist"
        with open(filepath, "r", encoding="utf-8") as f:
            tree = ast.parse(f.read(), filename=filepath)

        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                func_name = None
                if isinstance(node.func, ast.Name):
                    func_name = node.func.id
                elif isinstance(node.func, ast.Attribute):
                    func_name = node.func.attr

                assert func_name not in forbidden_calls, f"Forbidden call '{func_name}' found in {filepath}"
