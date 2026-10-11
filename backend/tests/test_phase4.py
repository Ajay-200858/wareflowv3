import pytest
import uuid
from datetime import datetime
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

@pytest.fixture(scope="module")
def manager_token():
    response = client.post("/api/auth/login", json={"email": "manager@wareflow.demo", "password": "password123"})
    assert response.status_code == 200
    return response.json()["access_token"]

@pytest.fixture(scope="module")
def auth_headers(manager_token):
    return {"Authorization": f"Bearer {manager_token}"}

@pytest.fixture(scope="module")
def employee(auth_headers):
    payload = {
        "first_name": "Test",
        "last_name": "Employee",
        "role_type": "Picker",
        "status": "ACTIVE"
    }
    res = client.post("/api/employees", json=payload, headers=auth_headers)
    assert res.status_code == 201
    return res.json()

def test_employee_crud(auth_headers, employee):
    # Get employees
    res = client.get("/api/employees", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()) >= 1
    
    # Update employee
    res = client.put(f"/api/employees/{employee['id']}", json={"status": "INACTIVE"}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "INACTIVE"
    
    # Revert
    client.put(f"/api/employees/{employee['id']}", json={"status": "ACTIVE"}, headers=auth_headers)

def test_employee_availability_and_assignment(auth_headers, employee):
    # Mark unavailable
    payload = {
        "employee_id": employee["id"],
        "date": datetime.utcnow().isoformat(),
        "status": "SICK"
    }
    res = client.post(f"/api/employees/{employee['id']}/availability", json=payload, headers=auth_headers)
    assert res.status_code == 200
    
    # Create an order and job to try assigning
    unique_id = str(uuid.uuid4())[:8]
    prod_payload = {
        "sku": f"EMP-TEST-{unique_id}",
        "name": "Emp Test Product",
        "category": "Test",
        "unit": "pcs",
        "price": 100.0
    }
    prod_res = client.post("/api/products", json=prod_payload, headers=auth_headers)
    product_id = prod_res.json()["id"]
    
    client.post("/api/inventory/direct", json={"product_id": product_id, "quantity": 10, "position_id": 1}, headers=auth_headers)
    
    order_payload = {
        "delivery_address": "Test",
        "items": [{"product_id": product_id, "quantity": 1}]
    }
    order_res = client.post("/api/orders", json=order_payload, headers=auth_headers)
    order_id = order_res.json()["id"]
    
    jobs = client.get("/api/jobs", headers=auth_headers).json()
    job = next(j for j in jobs if j["order_id"] == order_id and j["job_type"] == "PICKING")
    
    # Try assign
    res = client.put(f"/api/jobs/{job['id']}/assign?employee_id={employee['id']}", headers=auth_headers)
    assert res.status_code == 400
    assert "unavailable today" in res.json()["detail"]

def test_workload_calculation(auth_headers, employee):
    res = client.post(f"/api/employees/{employee['id']}/calculate_workload", headers=auth_headers)
    assert res.status_code == 200
    assert "workload_minutes" in res.json()

def test_salary_calculation(auth_headers, employee):
    # Setup salary rule
    rule_payload = {
        "role_type": "Picker",
        "salary_model": "FIXED",
        "base_salary": 2500.0
    }
    client.post("/api/employees/salary-rules", json=rule_payload, headers=auth_headers)
    
    # Calculate salary
    period = "2026-10"
    res = client.post(f"/api/employees/{employee['id']}/calculate-salary?period={period}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["total_amount"] == 2500.0
    
    # Duplicate period check
    res_dup = client.post(f"/api/employees/{employee['id']}/calculate-salary?period={period}", headers=auth_headers)
    assert res_dup.status_code == 400
