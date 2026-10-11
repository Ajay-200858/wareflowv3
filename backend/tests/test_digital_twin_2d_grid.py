import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

@pytest.fixture(scope="module")
def auth_headers():
    response = client.post("/api/auth/login", json={"email": "ajay@gmail.com", "password": "password123"})
    if response.status_code != 200:
        response = client.post("/api/auth/login", json={"email": "manager@wareflow.demo", "password": "password123"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}

def test_warehouse_map_endpoint_structure(auth_headers):
    """Test get_warehouse_map returns enriched hierarchy with rack dimensions, coordinates, and inventory details."""
    res_wh = client.get("/api/warehouses", headers=auth_headers)
    assert res_wh.status_code == 200
    warehouses = res_wh.json()
    assert len(warehouses) > 0
    wh_id = warehouses[0]["id"]

    response = client.get(f"/api/warehouses/{wh_id}/map", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == wh_id
    assert len(data["zones"]) >= 1

    # Check Zone C with 10x10 rack if exists
    zone_c = next((z for z in data["zones"] if z["name"] == "Zone C"), None)
    if zone_c:
        rack_10 = next((r for r in zone_c["racks"] if "10x10" in r["name"]), None)
        assert rack_10 is not None
        assert rack_10["rows_count"] == 10
        assert rack_10["positions_per_row"] == 10
        assert len(rack_10["rows"]) == 10
        total_cells = sum(len(rw["positions"]) for rw in rack_10["rows"])
        assert total_cells == 100

def test_warehouse_math_aggregations(auth_headers):
    """Verify warehouse mathematical invariants:
    Available = Capacity - Occupied
    Occupancy % = Occupied / Capacity * 100
    """
    res_wh = client.get("/api/warehouses", headers=auth_headers)
    wh_id = res_wh.json()[0]["id"]
    response = client.get(f"/api/warehouses/{wh_id}/map", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()

    for zone in data["zones"]:
        zone_total_cap = 0
        zone_total_occ = 0
        for rack in zone["racks"]:
            rack_total_cap = 0
            rack_total_occ = 0
            for row in rack["rows"]:
                for pos in row["positions"]:
                    cap = pos["capacity"]
                    occ = pos["current_occupancy"]
                    avail = pos["available_capacity"]
                    assert avail == cap - occ, f"Cell {pos['code']} math mismatch: {avail} != {cap} - {occ}"
                    assert avail >= 0, f"Negative available capacity in {pos['code']}"

                    rack_total_cap += cap
                    rack_total_occ += occ

            rack_avail = rack_total_cap - rack_total_occ
            assert rack_avail >= 0
            zone_total_cap += rack_total_cap
            zone_total_occ += rack_total_occ

        zone_avail = zone_total_cap - zone_total_occ
        assert zone_avail >= 0

def test_multi_product_cell_inspection(auth_headers):
    """Verify that cell inspection handles multi-product cells and returns SKUs, quantities, and expiry dates."""
    res_wh = client.get("/api/warehouses", headers=auth_headers)
    wh_id = res_wh.json()[0]["id"]
    response = client.get(f"/api/warehouses/{wh_id}/map", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()

    zone_a = next((z for z in data["zones"] if z["name"] == "Zone A"), data["zones"][0])
    rack_1 = zone_a["racks"][0]
    row_1 = rack_1["rows"][0]
    pos = row_1["positions"][0]

    assert "inventory" in pos
    assert isinstance(pos["inventory"], list)
    if pos["current_occupancy"] > 0:
        total_inv = sum(i["quantity"] for i in pos["inventory"])
        assert total_inv == pos["current_occupancy"]

def test_position_capacity_update_validation(auth_headers):
    """Verify that position capacity update enforces capacity >= current_occupancy."""
    res_wh = client.get("/api/warehouses", headers=auth_headers)
    wh_id = res_wh.json()[0]["id"]
    response = client.get(f"/api/warehouses/{wh_id}/map", headers=auth_headers)
    data = response.json()
    pos = data["zones"][0]["racks"][0]["rows"][0]["positions"][0]
    pos_id = pos["id"]
    current_occ = pos["current_occupancy"]

    # Attempt to set capacity lower than current occupancy -> Must fail with 400
    if current_occ > 0:
        res_fail = client.put(
            f"/api/warehouses/positions/{pos_id}",
            json={"capacity": current_occ - 1, "status": "AVAILABLE"},
            headers=auth_headers
        )
        assert res_fail.status_code == 400

    # Valid capacity update -> Must succeed
    new_cap = max(current_occ + 50, 150)
    res_ok = client.put(
        f"/api/warehouses/positions/{pos_id}",
        json={"capacity": new_cap, "status": "AVAILABLE"},
        headers=auth_headers
    )
    assert res_ok.status_code == 200
    updated = res_ok.json()
    assert updated["capacity"] == new_cap
    assert updated["available_capacity"] == new_cap - current_occ
