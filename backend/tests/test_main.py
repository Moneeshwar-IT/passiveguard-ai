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


def test_cors_get_health_production_frontend():
    """Verify CORS headers on GET /health for production frontend origin."""
    prod_origin = "https://passiveguard-frontend.onrender.com"
    response = client.get("/health", headers={"Origin": prod_origin})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == prod_origin
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_cors_options_preflight_production_frontend():
    """Verify CORS preflight (OPTIONS) request for production frontend origin."""
    prod_origin = "https://passiveguard-frontend.onrender.com"
    response = client.options(
        "/api/demo/run",
        headers={
            "Origin": prod_origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type"
        }
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == prod_origin
    assert "POST" in response.headers.get("access-control-allow-methods", "")


def test_cors_localhost_dev_support():
    """Verify CORS headers for local development origin http://localhost:5173."""
    dev_origin = "http://localhost:5173"
    response = client.get("/health", headers={"Origin": dev_origin})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == dev_origin
