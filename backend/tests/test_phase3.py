import pytest
import uuid
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

def test_full_order_lifecycle(auth_headers):
    # Setup product
    unique_id = str(uuid.uuid4())[:8]
    payload = {
        "sku": f"LIFECYCLE-SKU-{unique_id}",
        "name": "Lifecycle Product",
        "category": "Test",
        "unit": "pcs",
        "price": 300.0
    }
    response = client.post("/api/products", json=payload, headers=auth_headers)
    assert response.status_code == 201
    product_id = response.json()["id"]
    
    # Receive stock
    client.put("/api/warehouses/positions/1", json={"capacity": 999999}, headers=auth_headers)
    inv_payload = {
        "product_id": product_id,
        "quantity": 100,
        "position_id": 1
    }
    res_receive = client.post("/api/inventory/direct", json=inv_payload, headers=auth_headers)
    assert res_receive.status_code == 200
    
    # 1. Create order
    order_payload = {
        "delivery_address": "456 Order Lifecycle St",
        "priority": "HIGH",
        "items": [{"product_id": product_id, "quantity": 10}]
    }
    res = client.post("/api/orders", json=order_payload, headers=auth_headers)
    assert res.status_code == 201
    order_id = res.json()["id"]
    
    # 2. Verify picking job created
    res_jobs = client.get("/api/jobs", headers=auth_headers)
    jobs = res_jobs.json()
    picking_job = next(j for j in jobs if j["order_id"] == order_id and j["job_type"] == "PICKING")
    
    # Accept and complete picking job
    client.put(f"/api/jobs/{picking_job['id']}/assign?employee_id=1", headers=auth_headers)
    client.put(f"/api/jobs/{picking_job['id']}/accept", headers=auth_headers)
    client.put(f"/api/jobs/{picking_job['id']}/complete", headers=auth_headers)
    
    # Verify order status is PACKING
    res_order = client.get(f"/api/orders/{order_id}", headers=auth_headers)
    assert res_order.json()["status"] == "PACKING"
    
    # 3. Verify packing job created
    res_jobs = client.get("/api/jobs", headers=auth_headers)
    jobs = res_jobs.json()
    packing_job = next(j for j in jobs if j["order_id"] == order_id and j["job_type"] == "PACKING")
    
    # Accept and complete packing job
    client.put(f"/api/jobs/{packing_job['id']}/assign?employee_id=1", headers=auth_headers)
    client.put(f"/api/jobs/{packing_job['id']}/accept", headers=auth_headers)
    client.put(f"/api/jobs/{packing_job['id']}/complete", headers=auth_headers)
    
    # Verify order status is DELIVERY
    res_order = client.get(f"/api/orders/{order_id}", headers=auth_headers)
    assert res_order.json()["status"] == "DELIVERY"
    
    # 4. Verify delivery job created
    res_jobs = client.get("/api/jobs", headers=auth_headers)
    jobs = res_jobs.json()
    delivery_job = next(j for j in jobs if j["order_id"] == order_id and j["job_type"] == "DELIVERY")
    
    # Accept and complete delivery job
    client.put(f"/api/jobs/{delivery_job['id']}/assign?employee_id=1", headers=auth_headers)
    client.put(f"/api/jobs/{delivery_job['id']}/accept", headers=auth_headers)
    client.put(f"/api/jobs/{delivery_job['id']}/complete", headers=auth_headers)
    
    # Verify order status is COMPLETED
    res_order = client.get(f"/api/orders/{order_id}", headers=auth_headers)
    assert res_order.json()["status"] == "COMPLETED"
    
    # Verify inventory is deducted properly
    res_inv = client.get("/api/inventory", headers=auth_headers)
    inv = next(i for i in res_inv.json() if i["product_id"] == product_id)
    assert inv["quantity"] == 90
    assert inv["available_quantity"] == 90
    assert inv["reserved_quantity"] == 0

def test_packing_job_invalid_transition(auth_headers):
    # Try to complete a pending packing job (without accepting)
    res_jobs = client.get("/api/jobs", headers=auth_headers)
    # The previous test finished all jobs, let's create a new order and pick it
    unique_id = str(uuid.uuid4())[:8]
    payload = {
        "sku": f"LIFECYCLE-SKU-2-{unique_id}",
        "name": "Lifecycle Product 2",
        "category": "Test",
        "unit": "pcs",
        "price": 300.0
    }
    res = client.post("/api/products", json=payload, headers=auth_headers)
    product_id = res.json()["id"]
    client.put("/api/warehouses/positions/1", json={"capacity": 999999}, headers=auth_headers)
    res_receive = client.post("/api/inventory/direct", json={"product_id": product_id, "quantity": 100, "position_id": 1}, headers=auth_headers)
    assert res_receive.status_code == 200
    
    res = client.post("/api/orders", json={"delivery_address": "Test", "items": [{"product_id": product_id, "quantity": 10}]}, headers=auth_headers)
    order_id = res.json()["id"]
    
    picking_job = next(j for j in client.get("/api/jobs", headers=auth_headers).json() if j["order_id"] == order_id and j["job_type"] == "PICKING")
    client.put(f"/api/jobs/{picking_job['id']}/assign?employee_id=1", headers=auth_headers)
    client.put(f"/api/jobs/{picking_job['id']}/accept", headers=auth_headers)
    client.put(f"/api/jobs/{picking_job['id']}/complete", headers=auth_headers)
    
    packing_job = next(j for j in client.get("/api/jobs", headers=auth_headers).json() if j["order_id"] == order_id and j["job_type"] == "PACKING")
    
    # Try to complete packing job without assigning/accepting
    res_complete = client.put(f"/api/jobs/{packing_job['id']}/complete", headers=auth_headers)
    assert res_complete.status_code == 400
    assert "Job must be accepted before completing" in res_complete.json()["detail"]
