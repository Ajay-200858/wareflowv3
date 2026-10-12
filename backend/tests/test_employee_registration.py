import pytest
import uuid
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

@pytest.fixture(scope="module")
def manager_headers():
    res = client.post("/api/auth/login", json={"email": "manager@wareflow.demo", "password": "password123"})
    assert res.status_code == 200
    return {"Authorization": f"Bearer {res.json()['access_token']}"}

def test_invitation_lifecycle_and_registration(manager_headers):
    # 1. Manager creates an invitation
    unique_str = uuid.uuid4().hex[:6]
    test_email = f"new.picker.{unique_str}@wareflow.demo"
    inv_payload = {
        "role_type": "Picker",
        "email": test_email,
        "warehouse_id": 1,
        "expires_in_days": 3
    }
    inv_res = client.post("/api/employees/invitations", json=inv_payload, headers=manager_headers)
    assert inv_res.status_code == 201
    inv_data = inv_res.json()
    code = inv_data["invitation_code"]
    assert code.startswith("WF-INV-")
    assert inv_data["is_used"] is False
    assert inv_data["is_revoked"] is False

    # 2. Public query for invitation info
    info_res = client.get(f"/api/auth/invitation-info?code={code}")
    assert info_res.status_code == 200
    info_data = info_res.json()
    assert info_data["valid"] is True
    assert info_data["target_email"] == test_email
    assert info_data["role_type"] == "Picker"

    # 3. Fail registration with wrong email when invitation is targeted
    reg_wrong_email = {
        "full_name": "Arun Kumar",
        "email": f"different.{unique_str}@wareflow.demo",
        "password": "password123",
        "invitation_code": code
    }
    fail_res = client.post("/api/auth/employee-register", json=reg_wrong_email)
    assert fail_res.status_code == 400
    assert "assigned to a different email" in fail_res.json()["detail"]

    # 4. Successful registration
    reg_payload = {
        "full_name": "Arun Kumar",
        "email": test_email,
        "password": "password123",
        "invitation_code": code
    }
    reg_res = client.post("/api/auth/employee-register", json=reg_payload)
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    assert reg_data["role"] == "EMPLOYEE"
    assert reg_data["user"]["email"] == test_email
    assert reg_data["user"]["role"] == "EMPLOYEE"
    emp_token = reg_data["access_token"]
    assert emp_token is not None

    # 5. Access employee dashboard with new token
    emp_headers = {"Authorization": f"Bearer {emp_token}"}
    dash_res = client.get("/api/employee/dashboard", headers=emp_headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["employee"]["name"] == "Arun Kumar"

    # 6. Verify invitation is now marked as used and cannot be reused
    reuse_res = client.post("/api/auth/employee-register", json=reg_payload)
    assert reuse_res.status_code == 400
    assert "already exists" in reuse_res.json()["detail"] or "already been used" in reuse_res.json()["detail"]

    reuse_code_res = client.post("/api/auth/employee-register", json={
        "full_name": "Another Person",
        "email": f"another.{unique_str}@wareflow.demo",
        "password": "password123",
        "invitation_code": code
    })
    assert reuse_code_res.status_code == 400
    assert "already been used" in reuse_code_res.json()["detail"]

def test_revoked_invitation_rejection(manager_headers):
    unique_str = uuid.uuid4().hex[:6]
    inv_res = client.post("/api/employees/invitations", json={"role_type": "Packer"}, headers=manager_headers)
    assert inv_res.status_code == 201
    inv_data = inv_res.json()
    code = inv_data["invitation_code"]
    inv_id = inv_data["id"]

    # Revoke
    rev_res = client.post(f"/api/employees/invitations/{inv_id}/revoke", headers=manager_headers)
    assert rev_res.status_code == 200

    # Attempt registration with revoked code
    reg_payload = {
        "full_name": "Revoked User",
        "email": f"revoked.{unique_str}@wareflow.demo",
        "password": "password123",
        "invitation_code": code
    }
    res = client.post("/api/auth/employee-register", json=reg_payload)
    assert res.status_code == 400
    assert "revoked" in res.json()["detail"]

def test_invalid_and_duplicate_registration_validation(manager_headers):
    # Invalid code
    res = client.post("/api/auth/employee-register", json={
        "full_name": "Fake User",
        "email": "fake.user@wareflow.demo",
        "password": "password123",
        "invitation_code": "WF-INV-NONEXISTENT"
    })
    assert res.status_code == 400
    assert "Invalid invitation code" in res.json()["detail"]

    # Short password (< 8 chars)
    inv_res = client.post("/api/employees/invitations", json={"role_type": "Driver"}, headers=manager_headers)
    code = inv_res.json()["invitation_code"]

    res_short_pw = client.post("/api/auth/employee-register", json={
        "full_name": "Short Pw",
        "email": "short.pw@wareflow.demo",
        "password": "123",
        "invitation_code": code
    })
    assert res_short_pw.status_code == 400
    assert "at least 8 characters" in res_short_pw.json()["detail"]
