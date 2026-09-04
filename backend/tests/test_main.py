import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check():
    """Verify system health endpoint returns 200 OK and passive mode tag."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["mode"] == "passive_read_only"


def test_get_alerts_endpoint():
    """Verify /api/alerts returns alert list."""
    response = client.get("/api/alerts")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_traffic_current():
    """Verify /api/traffic/current returns current metrics."""
    response = client.get("/api/traffic/current")
    assert response.status_code == 200
    data = response.json()
    assert "active_flows" in data
    assert "protocol_distribution" in data


def test_get_traffic_historical():
    """Verify /api/traffic/historical returns list of timeline points."""
    response = client.get("/api/traffic/historical")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_alert_not_found():
    """Verify 404 response for invalid alert ID."""
    response = client.get("/api/alerts/ALT-NONEXISTENT")
    assert response.status_code == 404
