import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.caspian_service import caspian_service

client = TestClient(app)

@pytest.fixture(scope="module")
def auth_headers():
    response = client.post("/api/auth/login", json={"email": "manager@wareflow.demo", "password": "password123"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}

def test_caspian_service_initialization():
    """Verify that Caspian service initializes properly with configuration."""
    assert caspian_service is not None
    assert caspian_service.base_url == "https://api.trycaspianai.com"
    assert caspian_service.timeout == 5.0
    assert caspian_service.max_retries == 3

def test_caspian_gateway_connection():
    """Verify that the Caspian public API channels endpoint is reachable."""
    result = caspian_service.check_connection()
    assert result["connected"] is True
    assert result["status_code"] == 200
    assert "email" in result["available_channels"]
    assert "discord" in result["available_channels"]

def test_caspian_status_endpoint(auth_headers):
    """Verify GET /api/notifications/caspian-status reports accurate diagnostic lifecycle states."""
    response = client.get("/api/notifications/caspian-status", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "stages" in data
    assert data["stages"]["initialized"] is True
    assert data["stages"]["connected"] is True
    # In current environment, CASPIAN_API_KEY is configured
    assert data["stages"]["configured"] is True
    assert data["overall_status"] == "READY"

def test_caspian_test_dispatch_live(auth_headers):
    """Verify POST /api/notifications/test-caspian performs full in-app creation and Caspian delivery."""
    payload = {
        "title": "Automated Caspian Live Test",
        "message": "Testing delivery pipeline stages with real Caspian credentials.",
        "type": "INFO",
        "channel": "discord",
        "recipient": "alerts@wareflow.internal"
    }

    response = client.post("/api/notifications/test-caspian", json=payload, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    # In-app creation
    assert data["in_app_created"] is True
    assert data["in_app_notification_id"] is not None

    # External Caspian dispatch accepted and delivered
    dispatch = data["caspian_dispatch"]
    assert dispatch["stage_configured"] is True
    assert dispatch["stage_accepted"] is True
    assert dispatch["stage_delivered"] is True
    assert dispatch["status"] == "DELIVERED"
    assert dispatch["delivery_id"] is not None
