import pytest
from fastapi.testclient import TestClient
from app.main import app
import io
from app.models.inventory import Inventory
from app.models.order import Order, OrderItem
from app.models.job import Job
from app.database.connection import SessionLocal

client = TestClient(app)

@pytest.fixture(scope="module")
def auth_headers():
    response = client.post("/api/auth/login", json={"email": "manager@wareflow.demo", "password": "password123"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}

def get_product(auth_headers):
    # Just get any product to test with
    res = client.get("/api/products", headers=auth_headers)
    products = res.json()
    assert len(products) > 0
    return products[0]

def add_stock(prod_id, qty, auth_headers):
    # Check inventory
    db = SessionLocal()
    inv = db.query(Inventory).filter(Inventory.product_id == prod_id).first()
    
    if not inv:
        # get position
        res = client.get("/api/warehouses", headers=auth_headers)
        wh_id = res.json()[0]['id']
        map_res = client.get(f"/api/warehouses/{wh_id}/map", headers=auth_headers)
        pos = map_res.json()["zones"][0]["racks"][0]["rows"][0]["positions"][0]
        
        inv = Inventory(company_id=1, product_id=prod_id, position_id=pos["id"], quantity=qty, available_quantity=qty)
        db.add(inv)
    else:
        inv.quantity += qty
        inv.available_quantity += qty
    db.commit()
    db.close()


def test_manual_order_creation_valid(auth_headers):
    prod = get_product(auth_headers)
    add_stock(prod["id"], 50, auth_headers)
    
    payload = {
        "customer_id": None,
        "delivery_address": "123 Test St",
        "priority": "HIGH",
        "items": [
            {"product_id": prod["id"], "quantity": 2}
        ]
    }
    res = client.post("/api/orders", json=payload, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["delivery_address"] == "123 Test St"
    assert data["items"][0]["quantity"] == 2

def test_manual_order_missing_items(auth_headers):
    payload = {
        "customer_id": None,
        "delivery_address": "123 Test St",
        "items": []
    }
    res = client.post("/api/orders", json=payload, headers=auth_headers)
    assert res.status_code == 400
    assert "must have at least one item" in res.json()["detail"].lower()

def test_manual_order_invalid_quantity(auth_headers):
    prod = get_product(auth_headers)
    payload = {
        "customer_id": None,
        "delivery_address": "123 Test St",
        "items": [{"product_id": prod["id"], "quantity": -5}]
    }
    res = client.post("/api/orders", json=payload, headers=auth_headers)
    assert res.status_code == 400
    assert "quantity must be positive" in res.json()["detail"].lower()

def test_manual_order_insufficient_inventory(auth_headers):
    prod = get_product(auth_headers)
    payload = {
        "customer_id": None,
        "delivery_address": "123 Test St",
        "items": [{"product_id": prod["id"], "quantity": 999999}]
    }
    res = client.post("/api/orders", json=payload, headers=auth_headers)
    assert res.status_code == 400
    assert "insufficient stock" in res.json()["detail"].lower()

def test_csv_import_valid(auth_headers):
    prod = get_product(auth_headers)
    add_stock(prod["id"], 100, auth_headers)
    
    csv_data = f"""order_reference,customer_name,delivery_address,priority,product_sku,quantity
CSV-ORD-1,Test Cust,456 Market St,NORMAL,{prod['sku']},3
CSV-ORD-1,Test Cust,456 Market St,NORMAL,{prod['sku']},2
CSV-ORD-2,Another Cust,789 Broad St,HIGH,{prod['sku']},1
"""
    files = {"file": ("orders.csv", io.BytesIO(csv_data.encode('utf-8')), "text/csv")}
    res = client.post("/api/orders/import", files=files, headers=auth_headers)
    
    assert res.status_code == 200
    data = res.json()
    assert data["success"] == True
    assert data["created_orders"] == 2
    assert data["created_items"] == 3
    assert data["skipped"] == 0

def test_csv_import_invalid_sku(auth_headers):
    csv_data = """order_reference,customer_name,delivery_address,priority,product_sku,quantity
CSV-ORD-BAD,Test Cust,456 Market St,NORMAL,INVALID-SKU-999,3
"""
    files = {"file": ("orders.csv", io.BytesIO(csv_data.encode('utf-8')), "text/csv")}
    res = client.post("/api/orders/import", files=files, headers=auth_headers)
    
    assert res.status_code == 200
    data = res.json()
    assert data["created_orders"] == 0
    assert data["skipped"] == 1
    assert "Unknown product SKU INVALID-SKU-999" in data["errors"][0]

def test_csv_import_partial_failure(auth_headers):
    prod = get_product(auth_headers)
    add_stock(prod["id"], 100, auth_headers)
    
    csv_data = f"""order_reference,customer_name,delivery_address,priority,product_sku,quantity
CSV-PARTIAL-1,Test Cust,456 Market St,NORMAL,{prod['sku']},3
CSV-PARTIAL-2,Test Cust,456 Market St,NORMAL,BAD-SKU,3
"""
    files = {"file": ("orders.csv", io.BytesIO(csv_data.encode('utf-8')), "text/csv")}
    res = client.post("/api/orders/import", files=files, headers=auth_headers)
    
    assert res.status_code == 200
    data = res.json()
    assert data["created_orders"] == 1
    assert data["skipped"] == 1
    assert len(data["errors"]) == 1

