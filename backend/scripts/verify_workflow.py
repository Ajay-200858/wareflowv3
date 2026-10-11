import requests
import json
import uuid

BASE_URL = "http://127.0.0.1:8000/api"
session = requests.Session()

def print_step(msg):
    print(f"\n--- {msg} ---")

def run():
    print_step("1. Health Check")
    resp = session.get(f"{BASE_URL}/health")
    print(resp.json())
    assert resp.status_code == 200

    print_step("2. Login Demo User")
    resp = session.post(f"{BASE_URL}/auth/login", json={
        "email": "manager@wareflow.demo",
        "password": "password123"
    })
    print(resp.json())
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    session.headers.update({"Authorization": f"Bearer {token}"})

    print_step("3. Get Warehouses")
    resp = session.get(f"{BASE_URL}/warehouses")
    print(resp.json())
    assert resp.status_code == 200
    warehouse_id = resp.json()[0]["id"]

    print_step("4. Create Product")
    rnd = uuid.uuid4().hex[:6]
    resp = session.post(f"{BASE_URL}/products", json={
        "sku": f"SKU-{rnd}",
        "name": "Test Product",
        "category": "Test",
        "unit": "pcs",
        "price": 10.99
    })
    print(resp.json())
    assert resp.status_code == 201
    product_id = resp.json()["id"]

    print_step("5. Recommend Storage (ML Fallback Test)")
    resp = session.post(f"{BASE_URL}/ai/storage/recommend", json={
        "product_id": product_id,
        "quantity": 10
    })
    print(resp.status_code, resp.text)
    assert resp.status_code == 200

    print_step("6. Get Notifications")
    resp = session.get(f"{BASE_URL}/notifications")
    print(resp.json())
    assert resp.status_code == 200

    print_step("7. Demand Forecast (ML Fallback Test)")
    resp = session.get(f"{BASE_URL}/ai/demand/product/{product_id}")
    print(resp.json())
    assert resp.status_code == 200

    print("\nALL WORKFLOW TESTS COMPLETED SUCCESSFULLY")

if __name__ == "__main__":
    run()
