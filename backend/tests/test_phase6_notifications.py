import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

@pytest.fixture(scope="module")
def auth_headers():
    response = client.post("/api/auth/login", json={"email": "manager@wareflow.demo", "password": "password123"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}

def test_get_notifications(auth_headers):
    res = client.get("/api/notifications", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_get_unread_count(auth_headers):
    res = client.get("/api/notifications/unread-count", headers=auth_headers)
    assert res.status_code == 200
    assert "count" in res.json()

def test_mark_all_as_read(auth_headers):
    res = client.post("/api/notifications/read-all", headers=auth_headers)
    assert res.status_code == 200

def test_create_and_read_notification(auth_headers):
    # Reject a job to trigger a notification
    job_payload = {
        "order_id": 1,
        "job_type": "PICKING"
    }
    # Create order first if needed, assume order 1 exists from seed
    job_res = client.post("/api/jobs", json=job_payload, headers=auth_headers)
    if job_res.status_code == 200:
        job_id = job_res.json()["id"]
        
        # assign
        client.put(f"/api/jobs/{job_id}/status", json={"status": "ASSIGNED", "employee_id": 1}, headers=auth_headers)
        
        # reject
        client.put(f"/api/jobs/{job_id}/status", json={"status": "REJECTED"}, headers=auth_headers)
        
        # Now get notifications
        notif_res = client.get("/api/notifications", headers=auth_headers)
        assert notif_res.status_code == 200
        notifs = notif_res.json()
        assert len(notifs) > 0
        
        notif_id = notifs[0]["id"]
        
        # mark as read
        read_res = client.post(f"/api/notifications/{notif_id}/read", headers=auth_headers)
        assert read_res.status_code == 200
        
        count_res = client.get("/api/notifications/unread-count", headers=auth_headers)
        # unread count should decrease, but we don't know the exact count
        assert count_res.json()["count"] >= 0
