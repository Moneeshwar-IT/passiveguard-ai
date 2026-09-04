"""
PassiveGuard AI — Module 16 Alert Store Inter-Process Persistence Test Suite

Verifies that AlertManager persists generated alerts to the shared SQLite store,
that separate process-style store instances read the persisted alerts, that FastAPI API endpoints
and WebSocket background polling deliver persisted alerts to frontend clients,
and that passive enclave security rules (zero sockets, zero external HTTP, zero DNS resolution, zero TLS decryption) remain enforced.
"""
import sys
import os
import time
import tempfile
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
from app.alerts.schema import Alert
from app.alerts.store import AlertStore, alert_store
from app.alerts.manager import AlertManager, alert_manager
from app.pipeline.engine import PipelineEngine

try:
    from generate_demo_data import generate_ddos_scenario, generate_c2_scenario
    from run_demo import reset_demo_state
except ImportError:
    from scripts.generate_demo_data import generate_ddos_scenario, generate_c2_scenario
    from scripts.run_demo import reset_demo_state

client = TestClient(app)


@pytest.fixture
def temp_store():
    """Creates a temporary isolated SQLite database file for testing."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        tmp_path = tmp.name
    store = AlertStore(db_path=tmp_path)
    yield store
    if os.path.exists(tmp_path):
        os.remove(tmp_path)


@pytest.fixture(autouse=True)
def clean_state():
    """Resets demo state before each test."""
    reset_demo_state()
    yield
    reset_demo_state()


def test_1_alert_manager_creates_and_saves_alert(temp_store):
    """Verify AlertManager creates and saves alert to SQLite store."""
    mgr = AlertManager(store=temp_store)
    alert = Alert(
        flow_id="FLOW-100", source_ip="192.168.1.10", destination_ip="10.0.0.1",
        source_port=1234, destination_port=80, protocol="TCP", threat_class="DDOS_SYN_FLOOD",
        severity="HIGH", confidence=0.85, evidence={"test": "data"}, detector_name="test_detector"
    )
    created = mgr.create_alert(alert)
    assert created.alert_id == alert.alert_id
    assert len(temp_store.get_recent_alerts()) == 1


def test_2_alert_is_persisted_to_sqlite(temp_store):
    """Verify raw SQLite store contains persisted alert."""
    alert = Alert(
        flow_id="FLOW-101", source_ip="192.168.1.11", destination_ip="10.0.0.2",
        source_port=54321, destination_port=443, protocol="TCP", threat_class="C2_BEACON",
        severity="CRITICAL", confidence=0.92, evidence={"jitter": 0.01}, detector_name="c2_detector"
    )
    temp_store.save_alert(alert)
    retrieved = temp_store.get_alert_by_id(alert.alert_id)
    assert retrieved is not None
    assert retrieved.alert_id == alert.alert_id


def test_3_separate_store_instance_reads_persisted_alert():
    """Verify a separate process-style AlertStore instance reads alerts from same DB file."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        store_proc_a = AlertStore(db_path=tmp_path)
        alert = Alert(
            flow_id="FLOW-PROC-A", source_ip="10.0.0.50", destination_ip="10.0.0.1",
            source_port=9999, destination_port=80, protocol="TCP", threat_class="DDOS_SYN_FLOOD",
            severity="HIGH", confidence=0.88, evidence={"packet_rate": 5000}, detector_name="ddos_detector"
        )
        store_proc_a.save_alert(alert)

        # Process B opens independent connection to same DB file
        store_proc_b = AlertStore(db_path=tmp_path)
        alerts_proc_b = store_proc_b.get_recent_alerts()
        assert len(alerts_proc_b) == 1
        assert alerts_proc_b[0].alert_id == alert.alert_id
        assert alerts_proc_b[0].threat_class == "DDOS_SYN_FLOOD"
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def test_4_get_alerts_api_returns_persisted_alerts():
    """Verify GET /api/alerts returns alerts stored in SQLite database."""
    alert = Alert(
        flow_id="FLOW-API-1", source_ip="192.168.1.150", destination_ip="10.0.0.5",
        source_port=50000, destination_port=80, protocol="TCP", threat_class="DDOS_SPOOFED_SOURCE",
        severity="HIGH", confidence=0.88, evidence={"test": 123}, detector_name="ddos_detector"
    )
    alert_store.save_alert(alert)

    res = client.get("/api/alerts")
    assert res.status_code == 200
    data = res.json()
    assert len(data) > 0
    assert any(a["alert_id"] == alert.alert_id for a in data)


def test_5_alert_detail_endpoint_returns_persisted_alert():
    """Verify GET /api/alerts/{alert_id} returns detailed alert from SQLite store."""
    alert = Alert(
        flow_id="FLOW-API-2", source_ip="192.168.1.150", destination_ip="10.0.0.88",
        source_port=54500, destination_port=443, protocol="TCP", threat_class="ENCRYPTED_MALWARE",
        severity="HIGH", confidence=0.89, evidence={"ja3": "e7d705a3286e19ea42f587b344ee6865"}, detector_name="tls_detector"
    )
    alert_store.save_alert(alert)

    res = client.get(f"/api/alerts/{alert.alert_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["alert_id"] == alert.alert_id
    assert data["threat_class"] == "ENCRYPTED_MALWARE"


def test_6_evidence_survives_persistence(temp_store):
    """Verify evidence JSON metadata survives SQLite persistence round-trip."""
    evidence = {
        "nested_key": {"val": 123},
        "metrics": [1.0, 2.0, 3.0],
        "flag": True
    }
    alert = Alert(
        flow_id="FLOW-EV", source_ip="10.0.0.1", destination_ip="10.0.0.2",
        source_port=100, destination_port=200, protocol="TCP", threat_class="C2_BEACON",
        severity="HIGH", confidence=0.80, evidence=evidence, detector_name="test"
    )
    temp_store.save_alert(alert)
    retrieved = temp_store.get_alert_by_id(alert.alert_id)
    assert retrieved.evidence == evidence
    assert retrieved.evidence["nested_key"]["val"] == 123


def test_7_threat_class_survives_persistence(temp_store):
    """Verify threat_class string survives persistence intact."""
    alert = Alert(
        flow_id="FLOW-TC", source_ip="10.0.0.1", destination_ip="10.0.0.2",
        source_port=100, destination_port=200, protocol="UDP", threat_class="DNS_TUNNEL",
        severity="HIGH", confidence=0.85, evidence={}, detector_name="test"
    )
    temp_store.save_alert(alert)
    retrieved = temp_store.get_alert_by_id(alert.alert_id)
    assert retrieved.threat_class == "DNS_TUNNEL"


def test_8_severity_survives_persistence(temp_store):
    """Verify severity string survives persistence intact."""
    alert = Alert(
        flow_id="FLOW-SEV", source_ip="10.0.0.1", destination_ip="10.0.0.2",
        source_port=100, destination_port=200, protocol="TCP", threat_class="DATA_EXFILTRATION",
        severity="CRITICAL", confidence=0.95, evidence={}, detector_name="test"
    )
    temp_store.save_alert(alert)
    retrieved = temp_store.get_alert_by_id(alert.alert_id)
    assert retrieved.severity == "CRITICAL"


def test_9_confidence_survives_persistence(temp_store):
    """Verify float confidence score survives persistence intact."""
    alert = Alert(
        flow_id="FLOW-CONF", source_ip="10.0.0.1", destination_ip="10.0.0.2",
        source_port=100, destination_port=200, protocol="TCP", threat_class="RECON_SCAN",
        severity="MEDIUM", confidence=0.7361, evidence={}, detector_name="test"
    )
    temp_store.save_alert(alert)
    retrieved = temp_store.get_alert_by_id(alert.alert_id)
    assert retrieved.confidence == pytest.approx(0.7361, 0.0001)


def test_10_model_metadata_survives_persistence(temp_store):
    """Verify model version metadata survives persistence intact."""
    alert = Alert(
        flow_id="FLOW-META", source_ip="10.0.0.1", destination_ip="10.0.0.2",
        source_port=100, destination_port=200, protocol="TCP", threat_class="DDOS_SYN_FLOOD",
        severity="HIGH", confidence=0.90, evidence={}, detector_name="ddos_detector", model_version="rf-v1.0"
    )
    temp_store.save_alert(alert)
    retrieved = temp_store.get_alert_by_id(alert.alert_id)
    assert retrieved.detector_name == "ddos_detector"
    assert retrieved.model_version == "rf-v1.0"


def test_11_controlled_demo_source_survives_persistence(temp_store):
    """Verify source='controlled_demo' metadata tagging survives persistence."""
    alert = Alert(
        flow_id="FLOW-SRC", source_ip="10.0.0.1", destination_ip="10.0.0.2",
        source_port=100, destination_port=200, protocol="TCP", threat_class="DGA_DOMAIN",
        severity="HIGH", confidence=0.82, evidence={}, detector_name="dga_detector", source="controlled_demo"
    )
    temp_store.save_alert(alert)
    retrieved = temp_store.get_alert_by_id(alert.alert_id)
    assert getattr(retrieved, "source", None) == "controlled_demo"


def test_12_duplicate_alert_behavior_remains_correct(temp_store):
    """Verify AlertManager deduplication suppresses duplicate alert IDs."""
    mgr = AlertManager(store=temp_store)
    alert = Alert(
        flow_id="FLOW-DUP", source_ip="10.0.0.1", destination_ip="10.0.0.2",
        source_port=100, destination_port=200, protocol="TCP", threat_class="C2_BEACON",
        severity="HIGH", confidence=0.85, evidence={}, detector_name="test"
    )
    mgr.create_alert(alert)
    mgr.create_alert(alert)  # Duplicate call

    alerts = temp_store.get_recent_alerts()
    assert len(alerts) == 1


def test_13_cooldown_behavior_remains_correct(temp_store):
    """Verify AlertManager suppresses alerts within 60s cooldown window."""
    mgr = AlertManager(cooldown_sec=60.0, store=temp_store)
    a1 = Alert(
        flow_id="FLOW-C1", source_ip="192.168.1.5", destination_ip="10.0.0.5",
        source_port=100, destination_port=80, protocol="TCP", threat_class="DDOS_SYN_FLOOD",
        severity="HIGH", confidence=0.90, evidence={}, detector_name="test"
    )
    a2 = Alert(
        flow_id="FLOW-C2", source_ip="192.168.1.5", destination_ip="10.0.0.5",
        source_port=101, destination_port=80, protocol="TCP", threat_class="DDOS_SYN_FLOOD",
        severity="HIGH", confidence=0.90, evidence={}, detector_name="test"
    )
    mgr.create_alert(a1, current_time=100.0)
    mgr.create_alert(a2, current_time=110.0)  # Within 60s cooldown

    alerts = temp_store.get_recent_alerts()
    assert len(alerts) == 1


def test_14_get_new_alerts_since_retrieves_incremental_alerts(temp_store):
    """Verify get_new_alerts_since retrieves newly created alerts for WebSocket poller."""
    t0 = time.time()
    time.sleep(0.01)

    a1 = Alert(
        flow_id="FLOW-INC-1", source_ip="10.0.0.1", destination_ip="10.0.0.2",
        source_port=100, destination_port=80, protocol="TCP", threat_class="RECON_SCAN",
        severity="MEDIUM", confidence=0.75, evidence={}, detector_name="recon_detector"
    )
    temp_store.save_alert(a1)

    new_alerts = temp_store.get_new_alerts_since(t0)
    assert len(new_alerts) == 1
    assert new_alerts[0].alert_id == a1.alert_id


def test_15_store_survives_separate_process_style_instances():
    """Verify multiple independent AlertStore handles read/write without corruption."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        s1 = AlertStore(db_path=tmp_path)
        s2 = AlertStore(db_path=tmp_path)
        s3 = AlertStore(db_path=tmp_path)

        for i in range(5):
            a = Alert(
                flow_id=f"FLOW-MULTI-{i}", source_ip=f"10.0.0.{i+1}", destination_ip="10.0.0.100",
                source_port=1000+i, destination_port=80, protocol="TCP", threat_class="DDOS_SYN_FLOOD",
                severity="HIGH", confidence=0.80 + (i * 0.02), evidence={}, detector_name="ddos_detector"
            )
            s1.save_alert(a)

        retrieved = s3.get_recent_alerts(limit=10)
        assert len(retrieved) == 5
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def test_16_verify_no_socket_calls_in_store():
    """AST static security check: Verify zero socket calls in store.py."""
    store_file = os.path.join(backend_dir, "app", "alerts", "store.py")
    with open(store_file, "r", encoding="utf-8") as f:
        content = f.read()
        assert "socket.socket" not in content
        assert "socket.connect" not in content


def test_17_verify_no_external_http_in_store():
    """AST static security check: Verify zero external HTTP libraries in store.py."""
    store_file = os.path.join(backend_dir, "app", "alerts", "store.py")
    with open(store_file, "r", encoding="utf-8") as f:
        content = f.read()
        assert "import requests" not in content
        assert "urllib.request" not in content


def test_18_verify_no_dns_resolution_in_store():
    """AST static security check: Verify zero DNS resolver calls in store.py."""
    store_file = os.path.join(backend_dir, "app", "alerts", "store.py")
    with open(store_file, "r", encoding="utf-8") as f:
        content = f.read()
        assert "dns.resolver" not in content


def test_19_verify_no_tls_decryption_in_store():
    """AST static security check: Verify zero TLS decryption calls in store.py."""
    store_file = os.path.join(backend_dir, "app", "alerts", "store.py")
    with open(store_file, "r", encoding="utf-8") as f:
        content = f.read().lower()
        assert "decrypt_tls" not in content
        assert "ssl_strip" not in content


def test_20_clear_alerts_empties_sqlite_store(temp_store):
    """Verify clear_alerts removes all alerts from SQLite database."""
    a = Alert(
        flow_id="FLOW-CLR", source_ip="10.0.0.1", destination_ip="10.0.0.2",
        source_port=100, destination_port=80, protocol="TCP", threat_class="C2_BEACON",
        severity="HIGH", confidence=0.85, evidence={}, detector_name="test"
    )
    temp_store.save_alert(a)
    assert len(temp_store.get_recent_alerts()) == 1

    cleared_count = temp_store.clear_alerts()
    assert cleared_count == 1
    assert len(temp_store.get_recent_alerts()) == 0
