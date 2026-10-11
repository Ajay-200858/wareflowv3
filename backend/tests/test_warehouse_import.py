import pytest
from app.models.warehouse import Warehouse, Position
from fastapi.testclient import TestClient
from app.main import app
from app.database.connection import SessionLocal

client_instance = TestClient(app)

@pytest.fixture(scope="module")
def client():
    return client_instance

@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="module")
def manager_token(client):
    response = client.post("/api/auth/login", json={"email": "manager@wareflow.demo", "password": "password123"})
    return response.json()["access_token"]

@pytest.fixture(scope="module")
def auth_headers(manager_token):
    return {"Authorization": f"Bearer {manager_token}"}

def test_warehouse_csv_import_success(auth_headers, client, db_session):
    csv_content = "warehouse,zone,rack,row,position,capacity\nMain WH,Zone A,Rack 1,Row 1,A1-01,100"
    files = {"file": ("test.csv", csv_content.encode("utf-8-sig"), "text/csv")}
    response = client.post("/api/warehouses/import", headers=auth_headers, files=files)
    assert response.status_code == 200
    assert response.json()["success"] == True
    assert (response.json()["created"]["positions"] == 1 or response.json()["skipped"] == 1)
    
    # Verify in DB
    wh = db_session.query(Warehouse).filter_by(name="Main WH").first()
    assert wh is not None
    pos = db_session.query(Position).filter_by(position_code="A1-01").first()
    assert pos is not None
    assert pos.capacity == 100

def test_warehouse_csv_import_missing_columns(auth_headers, client):
    # Missing position code
    csv_content = "warehouse,zone,rack,row,position,capacity\nMain WH,Zone A,Rack 1,Row 1,,100"
    files = {"file": ("test.csv", csv_content.encode("utf-8-sig"), "text/csv")}
    response = client.post("/api/warehouses/import", headers=auth_headers, files=files)
    assert response.status_code == 200
    assert response.json()["success"] == True
    assert "Missing warehouse or position code" in response.json()["errors"][0]

def test_warehouse_csv_import_invalid_capacity(auth_headers, client, db_session):
    # Should fallback to 100
    csv_content = "warehouse,zone,rack,row,position,capacity\nMain WH,Zone A,Rack 1,Row 1,A1-02,INVALID"
    files = {"file": ("test.csv", csv_content.encode("utf-8-sig"), "text/csv")}
    response = client.post("/api/warehouses/import", headers=auth_headers, files=files)
    assert response.status_code == 200
    assert response.json()["success"] == True
    assert (response.json()["created"]["positions"] == 1 or response.json()["skipped"] == 1)
    pos = db_session.query(Position).filter_by(position_code="A1-02").first()
    assert pos.capacity == 100

def test_warehouse_csv_import_utf8_bom(auth_headers, client):
    # Add BOM exactly
    csv_content = "\ufeffwarehouse,zone,rack,row,position,capacity\nBOM WH,Zone A,Rack 1,Row 1,B1-01,100"
    files = {"file": ("test.csv", csv_content.encode("utf-8"), "text/csv")}
    response = client.post("/api/warehouses/import", headers=auth_headers, files=files)
    assert response.status_code == 200
    assert response.json()["success"] == True
    assert (response.json()["created"]["positions"] == 1 or response.json()["skipped"] == 1)
