import pytest
from app.alerts.schema import Alert
from app.alerts.manager import AlertManager


def test_alert_schema_creation():
    """Verify creation and validation of structured Alert object."""
    alert = Alert(
        flow_id="flow_abc",
        source_ip="10.0.0.15",
        destination_ip="192.168.1.1",
        source_port=44312,
        destination_port=443,
        protocol="TCP",
        threat_class="DDoS",
        confidence=0.85,
        severity="HIGH",
        evidence={"packets_per_sec": 12000},
        detector_name="DDoSDetector"
    )
    assert alert.alert_id.startswith("ALT-")
    assert alert.confidence == 0.85
    assert alert.severity == "HIGH"


def test_alert_manager_operations():
    """Verify AlertManager storage, retrieval, and filtering."""
    mgr = AlertManager(max_alerts=10)
    
    alert1 = Alert(
        flow_id="f1",
        source_ip="10.0.0.1",
        destination_ip="10.0.0.2",
        source_port=1000,
        destination_port=80,
        protocol="TCP",
        threat_class="Reconnaissance",
        confidence=0.75,
        severity="HIGH",
        detector_name="ReconDetector"
    )
    
    alert2 = Alert(
        flow_id="f2",
        source_ip="10.0.0.5",
        destination_ip="10.0.0.2",
        source_port=2000,
        destination_port=53,
        protocol="UDP",
        threat_class="DGA",
        confidence=0.35,
        severity="LOW",
        detector_name="DGADetector"
    )

    mgr.create_alert(alert1)
    mgr.create_alert(alert2)

    recent = mgr.get_recent_alerts(limit=5)
    assert len(recent) == 2

    high_sev = mgr.get_recent_alerts(severity="HIGH")
    assert len(high_sev) == 1
    assert high_sev[0].alert_id == alert1.alert_id

    fetched = mgr.get_alert_by_id(alert1.alert_id)
    assert fetched is not None
    assert fetched.threat_class == "Reconnaissance"
