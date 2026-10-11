import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

@pytest.fixture(scope="module")
def auth_headers():
    response = client.post("/api/auth/login", json={"email": "manager@wareflow.demo", "password": "password123"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}

def test_get_warehouse_map(auth_headers):
    # Retrieve warehouses list to get ID
    res = client.get("/api/warehouses", headers=auth_headers)
    assert res.status_code == 200
    warehouses = res.json()
    assert len(warehouses) > 0
    wh_id = warehouses[0]["id"]
    
    # Retrieve the map
    res_map = client.get(f"/api/warehouses/{wh_id}/map", headers=auth_headers)
    assert res_map.status_code == 200
    data = res_map.json()
    assert "zones" in data
    
    # Find a position
    assert len(data["zones"]) > 0
    assert len(data["zones"][0]["racks"]) > 0
    assert len(data["zones"][0]["racks"][0]["rows"]) > 0
    
    positions = data["zones"][0]["racks"][0]["rows"][0]["positions"]
    assert len(positions) > 0
    
    pytest.pos = positions[0]

def test_update_position_valid(auth_headers):
    payload = {
        "capacity": pytest.pos["capacity"] + 50,
        "status": "AVAILABLE"
    }
    res = client.put(f"/api/warehouses/positions/{pytest.pos['id']}", json=payload, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["capacity"] == pytest.pos["capacity"] + 50

def test_update_position_invalid_capacity(auth_headers):
    # Try setting capacity below current occupancy
    # We will simulate current occupancy by creating some inventory if not existing, but let's assume it's 0 for now.
    # Actually wait, we just set capacity to -1 which shouldn't be valid, but logic is `capacity < current_occupancy`.
    # Let's set current occupancy = 10, then update capacity = 5.
    
    # Create product and receive inventory to position
    import uuid
    prod_payload = {
        "sku": f"MAP-TEST-PROD-{uuid.uuid4().hex[:6]}",
        "name": "Map Test Prod",
        "category": "Test",
        "unit": "pcs",
        "price": 10.0
    }
    res_prod = client.post("/api/products", json=prod_payload, headers=auth_headers)
    assert res_prod.status_code == 201
    prod_id = res_prod.json()["id"]
    
    # Receive 10 items to this position
    inv_payload = {
        "product_id": prod_id,
        "quantity": 10,
        "position_id": pytest.pos["id"]
    }
    res_inv = client.post("/api/inventory/direct", json=inv_payload, headers=auth_headers)
    assert res_inv.status_code == 200
    
    # Now try to set capacity to 5
    update_payload = {
        "capacity": 5,
        "status": "AVAILABLE"
    }
    res_fail = client.put(f"/api/warehouses/positions/{pytest.pos['id']}", json=update_payload, headers=auth_headers)
    assert res_fail.status_code == 400
    assert "Capacity cannot be less than currently occupied" in res_fail.json()["detail"]
import pytest

def test_warehouse_selection_isolation(auth_headers):
    res = client.get("/api/warehouses", headers=auth_headers)
    assert res.status_code == 200
    warehouses = res.json()
    if len(warehouses) >= 2:
        wh1 = warehouses[0]
        wh2 = warehouses[1]
        
        map1 = client.get(f"/api/warehouses/{wh1['id']}/map", headers=auth_headers).json()
        map2 = client.get(f"/api/warehouses/{wh2['id']}/map", headers=auth_headers).json()
        
        assert map1['id'] == wh1['id']
        assert map2['id'] == wh2['id']
        assert map1['id'] != map2['id']
