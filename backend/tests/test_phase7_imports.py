import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.warehouse import Warehouse, Position

client = TestClient(app)

@pytest.fixture(scope="module")
def auth_headers():
    response = client.post("/api/auth/login", json={"email": "manager@wareflow.demo", "password": "password123"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}

def test_warehouse_csv_import_success(auth_headers):
    csv_content = "warehouse,zone,rack,row,position,capacity\nMain WH,Zone A,Rack 1,Row 1,A1-01,100"
    files = {"file": ("test.csv", csv_content.encode("utf-8-sig"), "text/csv")}
    response = client.post("/api/warehouses/import", headers=auth_headers, files=files)
    assert response.status_code == 200
    assert response.json()["created"]["positions"] + response.json()["skipped"] >= 1
    
    # Verify via API
    res = client.get("/api/warehouses", headers=auth_headers)
    wh_id = [w['id'] for w in res.json() if w['name'] == 'Main WH'][0]
    map_res = client.get(f"/api/warehouses/{wh_id}/map", headers=auth_headers)
    assert map_res.status_code == 200
    assert map_res.json()["name"] == "Main WH"
    assert "A1-01" in str(map_res.json())

def test_warehouse_csv_import_missing_columns(auth_headers):
    # Missing position code
    csv_content = "warehouse,zone,rack,row,position,capacity\nMain WH,Zone A,Rack 1,Row 1,,100"
    files = {"file": ("test.csv", csv_content.encode("utf-8-sig"), "text/csv")}
    response = client.post("/api/warehouses/import", headers=auth_headers, files=files)
    assert response.status_code == 200
    assert response.json()["created"]["positions"] == 0
    assert "Missing warehouse or position code" in response.json()["errors"][0]

def test_warehouse_csv_import_invalid_capacity(auth_headers):
    # Should fallback to 100
    csv_content = "warehouse,zone,rack,row,position,capacity\nMain WH,Zone A,Rack 1,Row 1,A1-02,INVALID"
    files = {"file": ("test.csv", csv_content.encode("utf-8-sig"), "text/csv")}
    response = client.post("/api/warehouses/import", headers=auth_headers, files=files)
    assert response.status_code == 200
    assert response.json()["created"]["positions"] + response.json()["skipped"] >= 1
    
    # Verify via API
    res = client.get("/api/warehouses", headers=auth_headers)
    wh_id = [w['id'] for w in res.json() if w['name'] == 'Main WH'][0]
    map_res = client.get(f"/api/warehouses/{wh_id}/map", headers=auth_headers)
    assert "A1-02" in str(map_res.json())

def test_warehouse_csv_import_utf8_bom(auth_headers):
    # Add BOM exactly
    csv_content = "\ufeffwarehouse,zone,rack,row,position,capacity\nBOM WH,Zone A,Rack 1,Row 1,B1-01,100"
    files = {"file": ("test.csv", csv_content.encode("utf-8"), "text/csv")}
    response = client.post("/api/warehouses/import", headers=auth_headers, files=files)
    assert response.status_code == 200
    assert response.json()["created"]["positions"] + response.json()["skipped"] >= 1
