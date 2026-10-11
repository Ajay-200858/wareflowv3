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

def test_setup_product_and_inventory(auth_headers):
    # Setup product
    unique_id = str(uuid.uuid4())[:8]
    payload = {
        "sku": f"ORDER-TEST-{unique_id}",
        "name": "Order Test Product",
        "category": "Test",
        "unit": "pcs",
        "price": 200.0
    }
    response = client.post("/api/products", json=payload, headers=auth_headers)
    assert response.status_code == 201
    
    state = {}
    state['test_product_id'] = response.json()["id"]
    global shared_state
    shared_state = state
    
    # Receive 50 units
    client.put("/api/warehouses/positions/1", json={"capacity": 999999}, headers=auth_headers)
    inv_payload = {
        "product_id": shared_state['test_product_id'],
        "quantity": 50,
        "position_id": 1
    }
    res_inv = client.post("/api/inventory/direct", json=inv_payload, headers=auth_headers)
    assert res_inv.status_code == 200

def test_create_order_success(auth_headers):
    payload = {
        "delivery_address": "123 Test St",
        "priority": "HIGH",
        "items": [
            {
                "product_id": shared_state['test_product_id'],
                "quantity": 10
            }
        ]
    }
    res = client.post("/api/orders", json=payload, headers=auth_headers)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["status"] == "RESERVED"
    assert len(data["items"]) == 1
    shared_state['test_order_id'] = data["id"]
    
    # Verify inventory was reserved
    res_inv = client.get("/api/inventory", headers=auth_headers)
    inv = next(i for i in res_inv.json() if i["product_id"] == shared_state['test_product_id'])
    # started with 50, reserved 10
    assert inv["available_quantity"] == 40
    assert inv["reserved_quantity"] == 10

def test_create_order_insufficient_stock(auth_headers):
    payload = {
        "delivery_address": "123 Test St",
        "priority": "NORMAL",
        "items": [
            {
                "product_id": shared_state['test_product_id'],
                "quantity": 100 # only 40 available
            }
        ]
    }
    res = client.post("/api/orders", json=payload, headers=auth_headers)
    assert res.status_code == 400
    assert "Insufficient stock" in res.json()["detail"]

def test_cancel_order(auth_headers):
    payload = {
        "delivery_address": "123 Test St",
        "items": [
            {"product_id": shared_state['test_product_id'], "quantity": 5}
        ]
    }
    res = client.post("/api/orders", json=payload, headers=auth_headers)
    assert res.status_code == 201
    order_id = res.json()["id"]
    
    # Check inventory before cancel (40 - 5 = 35)
    res_inv1 = client.get("/api/inventory", headers=auth_headers)
    inv1 = next(i for i in res_inv1.json() if i["product_id"] == shared_state['test_product_id'])
    assert inv1["available_quantity"] == 35
    
    # Cancel order
    res_cancel = client.delete(f"/api/orders/{order_id}", headers=auth_headers)
    assert res_cancel.status_code == 200
    
    # Check inventory after cancel (should be 40 again)
    res_inv2 = client.get("/api/inventory", headers=auth_headers)
    inv2 = next(i for i in res_inv2.json() if i["product_id"] == shared_state['test_product_id'])
    assert inv2["available_quantity"] == 40
    assert inv2["reserved_quantity"] == 10 # from the first test

def test_job_flow(auth_headers):
    # Find job for the first order
    res_jobs = client.get("/api/jobs", headers=auth_headers)
    assert res_jobs.status_code == 200
    jobs = res_jobs.json()
    job = next(j for j in jobs if j["order_id"] == shared_state['test_order_id'])
    job_id = job["id"]
    
    # Assign job
    res_assign = client.put(f"/api/jobs/{job_id}/assign?employee_id=1", headers=auth_headers)
    assert res_assign.status_code == 200
    
    # Reject job
    res_reject = client.put(f"/api/jobs/{job_id}/reject?reason=Busy", headers=auth_headers)
    assert res_reject.status_code == 200
    
    # Re-assign job
    res_assign2 = client.put(f"/api/jobs/{job_id}/assign?employee_id=2", headers=auth_headers)
    assert res_assign2.status_code == 200
    
    # Accept job
    res_accept = client.put(f"/api/jobs/{job_id}/accept", headers=auth_headers)
    assert res_accept.status_code == 200
    
    # Complete job
    res_complete = client.put(f"/api/jobs/{job_id}/complete", headers=auth_headers)
    assert res_complete.status_code == 200
    
    # Verify order is PACKING (since Phase 3 added packing)
    res_order = client.get(f"/api/orders/{shared_state['test_order_id']}", headers=auth_headers)
    assert res_order.status_code == 200
    assert res_order.json()["status"] == "PACKING"
    
    # Verify inventory was deducted permanently
    res_inv = client.get("/api/inventory", headers=auth_headers)
    inv = next(i for i in res_inv.json() if i["product_id"] == shared_state['test_product_id'])
    assert inv["quantity"] == 40
    assert inv["reserved_quantity"] == 0
    assert inv["available_quantity"] == 40
