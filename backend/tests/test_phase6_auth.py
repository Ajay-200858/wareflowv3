import pytest
from datetime import timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token
from app.core.config import settings
import uuid

client = TestClient(app)

def test_unauthenticated_request():
    res = client.get("/api/products")
    assert res.status_code == 401
    
def test_expired_token():
    # Create an expired token manually
    token = create_access_token(data={"sub": "manager@wareflow.demo"}, expires_delta=timedelta(minutes=-10))
    res = client.get("/api/products", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401

def test_incorrect_role_access():
    # Attempt to hit an endpoint requiring MANAGER using an employee token
    # First login as employee
    res = client.post("/api/auth/login", json={"email": "employee@wareflow.demo", "password": "password123"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    
    # Try to create product (Manager only endpoint typically, let's assume it requires manager)
    # Actually wait, products router might not use get_current_active_manager. Let's check!
    # Let's hit the salary rule creation endpoint which definitely uses it.
    payload = {
        "role_type": "Test",
        "salary_model": "FIXED",
        "base_salary": 1000.0
    }
    res_salary = client.post("/api/employees/salary-rules", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert res_salary.status_code == 403

def test_cross_company_access():
    # We will forge a token for a user that doesn't exist but has company_id=999
    token = create_access_token(data={"sub": "fake@wareflow.demo", "role": "MANAGER", "company_id": 999, "user_id": 999})
    res = client.get("/api/products", headers={"Authorization": f"Bearer {token}"})
    # Since user doesn't exist in DB, dependency should fail at user lookup
    assert res.status_code == 401
