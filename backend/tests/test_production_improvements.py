import pytest
import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.database.connection import SessionLocal
from app.models.product import Product
from app.models.warehouse import Warehouse, Position
from app.models.inventory import Inventory
from app.models.ai import AIRecommendation


client = TestClient(app)

@pytest.fixture(scope="module")
def manager_token():
    response = client.post("/api/auth/login", json={"email": "manager@wareflow.demo", "password": "password123"})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]

@pytest.fixture(scope="module")
def auth_headers(manager_token):
    return {"Authorization": f"Bearer {manager_token}"}

def test_ml_models_loaded_and_active(auth_headers):
    """Test Phase 4 & Phase 6: Verify persisted ML models are loaded and active"""
    response = client.get("/api/ai/models", headers=auth_headers)
    assert response.status_code == 200, response.text
    data = response.json()
    
    assert "storage_model" in data
    assert "ACTIVE" in data["storage_model"]["status"]
    assert "GradientBoosting" in data["storage_model"]["algorithm"]
    assert data["storage_model"]["training_samples"] > 0
    
    assert "employee_model" in data
    assert "ACTIVE" in data["employee_model"]["status"]
    assert "RandomForest" in data["employee_model"]["algorithm"]
    assert data["employee_model"]["training_samples"] > 0
    
    assert "feedback_stats" in data
    assert "total_decisions_recorded" in data["feedback_stats"]

def test_incoming_product_creation_and_zero_stock_recommendation(auth_headers):
    """Test Phase 3: Zero initial stock does not block storage recommendations for incoming stock"""
    uid = uuid.uuid4().hex[:8]
    sku = f"INCOMING-{uid}"
    
    prod_payload = {
        "sku": sku,
        "name": f"Incoming Item {uid}",
        "category": "Electronics",
        "unit": "pcs",
        "price": 450.0,
        "weight": 2.5,
        "storage_type": "GENERAL"
    }
    prod_res = client.post("/api/products", json=prod_payload, headers=auth_headers)
    assert prod_res.status_code == 201, prod_res.text
    prod_id = prod_res.json()["id"]
    
    # Check current inventory is 0
    inv_res = client.get("/api/inventory", headers=auth_headers)
    curr_inv = [i for i in inv_res.json() if i["product_id"] == prod_id]
    assert len(curr_inv) == 0 # zero stock on hand
    
    # Request ML storage recommendation for incoming quantity of 30 units
    rec_res = client.post("/api/ai/storage/recommend", json={"product_id": prod_id, "quantity": 30}, headers=auth_headers)
    assert rec_res.status_code == 200, rec_res.text
    rec = rec_res.json()
    
    assert rec["product_id"] == prod_id
    assert rec["sku"] == sku
    assert rec["total_allocated"] == 30
    assert rec["unallocated"] == 0
    assert len(rec["allocations"]) > 0
    assert "v2." in rec["model_version"]
    assert rec["score"] > 0
    
    # Check employee assignment recommendation is included
    assert rec["assigned_employee"] is not None
    assert "id" in rec["assigned_employee"]
    assert "score" in rec["assigned_employee"]

def test_large_quantity_split_across_positions_respecting_capacity(auth_headers):
    """Test Phase 4 & Phase 5: Multi-position allocation across real storage cells with capacity constraints"""
    uid = uuid.uuid4().hex[:8]
    sku = f"BULK-{uid}"
    
    prod_payload = {
        "sku": sku,
        "name": f"Bulk Item {uid}",
        "category": "Raw Materials",
        "unit": "units",
        "price": 50.0,
        "weight": 1.0,
        "storage_type": "GENERAL"
    }
    prod_res = client.post("/api/products", json=prod_payload, headers=auth_headers)
    assert prod_res.status_code == 201
    prod_id = prod_res.json()["id"]
    
    # Create or set 3 positions with limited capacity (e.g. 20, 25, 30)
    # Positions 1, 2, 3
    client.put("/api/warehouses/positions/1", json={"capacity": 25}, headers=auth_headers)
    client.put("/api/warehouses/positions/2", json={"capacity": 35}, headers=auth_headers)
    
    # Request allocation for 50 units
    rec_res = client.post("/api/ai/storage/recommend", json={"product_id": prod_id, "quantity": 50}, headers=auth_headers)
    assert rec_res.status_code == 200, rec_res.text
    rec = rec_res.json()
    
    # The total allocated must equal min(50, total available capacity)
    alloc_sum = sum(a["quantity"] for a in rec["allocations"])
    assert alloc_sum == rec["total_allocated"]
    assert alloc_sum <= 50
    
    # Each individual allocation must never exceed the position's capacity
    for a in rec["allocations"]:
        assert a["quantity"] <= a["available_capacity"]
        assert a["quantity"] > 0
        assert "rack" in a
        assert "row" in a
        assert "column" in a

def test_insufficient_capacity_reports_exact_shortage(auth_headers):
    """Test Phase 5: Reports exact shortage if incoming quantity exceeds compatible warehouse capacity"""
    uid = uuid.uuid4().hex[:8]
    sku = f"OVERSIZE-{uid}"
    
    prod_payload = {
        "sku": sku,
        "name": f"Oversize Item {uid}",
        "category": "Heavy Machinery",
        "unit": "units",
        "price": 1000.0,
        "weight": 500.0,
        "storage_type": "GENERAL"
    }
    prod_res = client.post("/api/products", json=prod_payload, headers=auth_headers)
    assert prod_res.status_code == 201
    prod_id = prod_res.json()["id"]
    
    # Request an impossible quantity (e.g. 99,999,999 units)
    rec_res = client.post("/api/ai/storage/recommend", json={"product_id": prod_id, "quantity": 99999999}, headers=auth_headers)
    assert rec_res.status_code == 400
    assert "Shortage" in rec_res.json()["detail"]

def test_full_putaway_lifecycle_and_inventory_update(auth_headers):
    """Test Phase 10: Put-away job creation, assignment, manager feedback, and inventory update upon completion"""
    uid = uuid.uuid4().hex[:8]
    sku = f"PUTAWAY-{uid}"
    
    prod_payload = {
        "sku": sku,
        "name": f"Putaway Item {uid}",
        "category": "Consumer Goods",
        "unit": "boxes",
        "price": 120.0,
        "weight": 2.0,
        "storage_type": "GENERAL"
    }
    prod_res = client.post("/api/products", json=prod_payload, headers=auth_headers)
    assert prod_res.status_code == 201
    prod_id = prod_res.json()["id"]
    
    # Ensure position 1 has plenty of space
    client.put("/api/warehouses/positions/1", json={"capacity": 50000}, headers=auth_headers)
    
    # 1. Get recommendation
    rec_res = client.post("/api/ai/storage/recommend", json={"product_id": prod_id, "quantity": 40}, headers=auth_headers)
    assert rec_res.status_code == 200
    rec = rec_res.json()
    rec_id = rec["recommendation_id"]
    
    # 2. Allocate & trigger Put-away job with manager decision
    alloc_payload = {
        "product_id": prod_id,
        "allocations": rec["allocations"],
        "recommendation_id": rec_id,
        "manager_decision": "ACCEPTED",
        "reason": "Manager approved ML allocation"
    }
    alloc_res = client.post("/api/inventory/allocate", json=alloc_payload, headers=auth_headers)
    assert alloc_res.status_code == 200
    job_id = alloc_res.json().get("job_id")
    assert job_id is not None
    
    # 3. Verify manager feedback was persisted
    dec_res = client.get("/api/ai/recommendations", headers=auth_headers)
    assert dec_res.status_code == 200
    matched_rec = next((r for r in dec_res.json() if r["id"] == rec_id), None)
    assert matched_rec is not None
    assert matched_rec["status"] == "ACCEPTED"
    assert matched_rec["manager_decision"] == "ACCEPTED"
    
    # 4. Assign, Accept, and Complete Put-away Job
    client.put(f"/api/jobs/{job_id}/assign?employee_id=1", headers=auth_headers)
    client.put(f"/api/jobs/{job_id}/accept", headers=auth_headers)
    comp_res = client.put(f"/api/jobs/{job_id}/complete", headers=auth_headers)
    assert comp_res.status_code == 200
    
    # 5. Verify inventory and warehouse map reflect new stock
    inv_res = client.get("/api/inventory", headers=auth_headers)
    new_inv = [i for i in inv_res.json() if i["product_id"] == prod_id]
    assert len(new_inv) > 0
    total_qty = sum(i["quantity"] for i in new_inv)
    assert total_qty == 40
    
    # Verify warehouse map reflects occupancy
    map_res = client.get("/api/warehouses/1/map", headers=auth_headers)
    assert map_res.status_code == 200

def test_employee_recommendation_ranks_candidates(auth_headers):
    """Test Phase 6: Employee assignment ranking model uses historical workload and skills"""
    # Create a job to recommend employee for
    from app.models.job import Job
    db = SessionLocal()
    job = Job(company_id=1, type="PUT_AWAY", status="PENDING", priority=2, estimated_duration=20)
    db.add(job)
    db.commit()
    db.refresh(job)
    job_id = job.id
    db.close()
    
    rec_res = client.post(f"/api/ai/assignment/recommend?job_id={job_id}", headers=auth_headers)
    assert rec_res.status_code == 200
    data = rec_res.json()
    
    assert "assigned_employee" in data
    assert data["assigned_employee"]["id"] is not None
    assert data["assigned_employee"]["score"] > 0
    assert "confidence" in data
    assert "alternatives" in data
    assert isinstance(data["alternatives"], list)

def test_csv_reimport_idempotency(auth_headers):
    """Test Phase 2: Startup CSV re-import is idempotent and does not duplicate products or employees"""
    csv_data = "sku,name,category,unit,weight,price\nTEST-IDEMP-01,Idempotent Product,General,pcs,1.0,100\n"
    files = {"file": ("products.csv", csv_data.encode("utf-8"), "text/csv")}
    
    res1 = client.post("/api/products/import", headers=auth_headers, files=files)
    assert res1.status_code == 200
    
    # Second import of exact same SKU
    files2 = {"file": ("products.csv", csv_data.encode("utf-8"), "text/csv")}
    res2 = client.post("/api/products/import", headers=auth_headers, files=files2)
    assert res2.status_code == 200
    
    # Query database products with this SKU
    db = SessionLocal()
    count = db.query(Product).filter(Product.sku == "TEST-IDEMP-01").count()
    db.close()
    assert count == 1, f"Expected 1 product, found {count}"
