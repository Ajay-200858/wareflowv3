import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.connection import SessionLocal
from app.models.user import User

client = TestClient(app)

@pytest.fixture(scope="module")
def manager_token():
    # Login as manager
    response = client.post("/api/auth/login", json={"email": "manager@wareflow.demo", "password": "password123"})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]

@pytest.fixture(scope="module")
def auth_headers(manager_token):
    return {"Authorization": f"Bearer {manager_token}"}

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

state = {}

def test_create_product(auth_headers):
    import uuid
    sku = f"TEST-SKU-{uuid.uuid4().hex[:8]}"
    state['sku'] = sku
    payload = {
        "sku": sku,
        "name": "Test Product",
        "category": "Test",
        "unit": "pcs",
        "price": 100.0,
        "weight": 1.5,
        "storage_type": "GENERAL",
        "minimum_stock": 10,
        "expiry_required": False
    }
    response = client.post("/api/products", json=payload, headers=auth_headers)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["sku"] == sku
    assert "id" in data
    
    # Store ID for next tests
    state['test_product_id'] = data["id"]

def test_create_duplicate_product(auth_headers):
    payload = {
        "sku": state['sku'],
        "name": "Test Product Duplicate",
        "unit": "pcs",
        "price": 100.0
    }
    response = client.post("/api/products", json=payload, headers=auth_headers)
    assert response.status_code == 400

def test_get_products(auth_headers):
    response = client.get("/api/products", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert any(p["sku"] == state['sku'] for p in data)

def test_update_product(auth_headers):
    payload = {
        "sku": state['sku'] + "-MOD",
        "name": "Test Product Modified",
        "unit": "box",
        "price": 150.0
    }
    response = client.put(f"/api/products/{state['test_product_id']}", json=payload, headers=auth_headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["sku"] == state['sku'] + "-MOD"
    assert data["unit"] == "box"

def test_inventory_receive(auth_headers):
    # Ensure position 1 has capacity
    client.put("/api/warehouses/positions/1", json={"capacity": 999999}, headers=auth_headers)
    
    payload = {
        "product_id": state['test_product_id'],
        "allocations": [{"position_id": 1, "quantity": 100}]
    }
    response = client.post("/api/inventory/allocate", json=payload, headers=auth_headers)
    assert response.status_code == 200, response.text
    
    # Complete the put-away job created by allocate
    job_id = response.json().get("job_id")
    if job_id:
        client.put(f"/api/jobs/{job_id}/assign?employee_id=1", headers=auth_headers)
        client.put(f"/api/jobs/{job_id}/accept", headers=auth_headers)
        client.put(f"/api/jobs/{job_id}/complete", headers=auth_headers)
    
    # Verify inventory was added
    res2 = client.get("/api/inventory", headers=auth_headers)
    assert res2.status_code == 200
    inv = next((i for i in res2.json() if i["product_id"] == state['test_product_id']), None)
    assert inv is not None
    assert inv["quantity"] == 100
    assert inv["available_quantity"] == 100
    
    state['test_inventory_id'] = inv["id"]

def test_inventory_negative_receive(auth_headers):
    payload = {
        "product_id": state['test_product_id'],
        "quantity": -50,
        "to_position": 1,
        "movement_type": "RECEIVE"
    }
    response = client.post("/api/inventory/movement", json=payload, headers=auth_headers)
    assert response.status_code == 400

def test_inventory_manual_adjust(auth_headers):
    payload = {
        "quantity": 90
    }
    response = client.put(f"/api/inventory/{state['test_inventory_id']}", json=payload, headers=auth_headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["quantity"] == 90
    assert data["available_quantity"] == 90 # went from 100 to 90

def test_inventory_move(auth_headers):
    # Ensure position 2 has capacity
    client.put("/api/warehouses/positions/2", json={"capacity": 999999}, headers=auth_headers)
    
    payload = {
        "product_id": state['test_product_id'],
        "quantity": 20,
        "from_position": 1,
        "to_position": 2,
        "movement_type": "MOVE"
    }
    response = client.post("/api/inventory/movement", json=payload, headers=auth_headers)
    assert response.status_code == 200, response.text
    
    res2 = client.get("/api/inventory", headers=auth_headers)
    inv_from = next((i for i in res2.json() if i["product_id"] == state['test_product_id'] and i["position_id"] == 1), None)
    inv_to = next((i for i in res2.json() if i["product_id"] == state['test_product_id'] and i["position_id"] == 2), None)
    
    assert inv_from["quantity"] == 70 # 90 - 20
    assert inv_to["quantity"] == 20

