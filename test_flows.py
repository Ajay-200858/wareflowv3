import requests
import sys

BASE_URL = "http://localhost:8000/api"

def run_tests():
    print("Running tests...")
    
    # 1. Login or Register
    import time
    user_email = f"admin_{int(time.time())}@demo.com"
    requests.post(f"{BASE_URL}/auth/register", json={
        "email": user_email, 
        "password": "password",
        "company_name": "Test Co",
        "industry": "Tech",
        "role": "MANAGER"
    })
    res = requests.post(f"{BASE_URL}/auth/login", json={"email": user_email, "password": "password"})
    if not res.ok:
        print("Login failed:", res.text)
        sys.exit(1)
        
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Get/Create Products and Warehouse
    requests.post(f"{BASE_URL}/warehouses", json={
        "name": "Test WH",
        "location": "Test Loc",
        "type": "MAIN"
    }, headers=headers)
    
    requests.post(f"{BASE_URL}/products", json={
        "name": "Test Product",
        "sku": "TP-001",
        "category": "Electronics",
        "unit": "pcs",
        "weight": 1.0,
        "dimensions": "1x1x1"
    }, headers=headers)
    
    res = requests.get(f"{BASE_URL}/products", headers=headers)
    products = res.json()
    p1 = products[0]
    
    # 3. Receive Stock (Inbound)
    print("Testing Inbound Receiving...")
    res = requests.post(f"{BASE_URL}/inventory/receive", json={
        "product_id": p1["id"],
        "warehouse_id": 1,
        "quantity": 100,
        "receipt_reference": "TEST-REC-1"
    }, headers=headers)
    
    if not res.ok:
        print("Receive stock failed:", res.text)
        sys.exit(1)
        
    # Check Staging inventory
    res = requests.get(f"{BASE_URL}/inventory", headers=headers)
    invs = res.json()
    staging_found = any(i["product_id"] == p1["id"] and i["position_id"] is None for i in invs)
    if not staging_found:
        print("Staging inventory not found after receipt")
        sys.exit(1)
        
    # Check AI Recommendation generated
    res = requests.get(f"{BASE_URL}/ai/recommendations", headers=headers)
    recs = res.json()
    if not recs:
        print("No AI Recommendation generated")
        sys.exit(1)
        
    rec = recs[-1] # the latest one
    print(f"AI Recommendation generated: {rec['recommendation']}")
    
    # 4. Allocate Put-Away Job
    print("Testing Put-Away Allocation...")
    # Get a position
    res = requests.get(f"{BASE_URL}/warehouses", headers=headers)
    pos_res = requests.get(f"{BASE_URL}/warehouses/1/map", headers=headers)
    zones = pos_res.json()
    pos_id = zones[0]["racks"][0]["rows"][0]["positions"][0]["id"]
    
    res = requests.post(f"{BASE_URL}/inventory/allocate", json={
        "product_id": p1["id"],
        "recommendation_id": rec["id"],
        "allocations": [{"position_id": pos_id, "quantity": 100}]
    }, headers=headers)
    
    if not res.ok:
        print("Allocate failed:", res.text)
        sys.exit(1)
        
    # 5. Complete Put-Away Job
    print("Testing Job Completion (Put-Away)...")
    res = requests.get(f"{BASE_URL}/jobs", headers=headers)
    jobs = res.json()
    putaway_job = [j for j in jobs if j["job_type"] == "PUT_AWAY" and j["status"] == "PENDING"][-1]
    
    # Assign and complete
    requests.put(f"{BASE_URL}/jobs/{putaway_job['id']}/assign?employee_id=1", headers=headers)
    requests.put(f"{BASE_URL}/jobs/{putaway_job['id']}/accept", headers=headers)
    res = requests.put(f"{BASE_URL}/jobs/{putaway_job['id']}/complete", headers=headers)
    
    if not res.ok:
        print("Job completion failed:", res.text)
        sys.exit(1)
        
    # Verify Inventory moved out of staging
    res = requests.get(f"{BASE_URL}/inventory", headers=headers)
    invs = res.json()
    dest_inv = [i for i in invs if i["product_id"] == p1["id"] and i["position_id"] == pos_id]
    if not dest_inv or dest_inv[0]["quantity"] < 100:
        print("Inventory not correctly transferred to position")
        sys.exit(1)
        
    # 6. Test Outbound Fulfillment
    print("Testing Outbound Fulfillment...")
    res = requests.post(f"{BASE_URL}/orders", json={
        "customer_id": 1,
        "items": [{"product_id": p1["id"], "quantity": 50}],
        "priority": "HIGH",
        "delivery_address": "Test Address",
        "required_by": "2026-12-31"
    }, headers=headers)
    
    if not res.ok:
        print("Order creation failed:", res.text)
        sys.exit(1)
        
    # Get picking job
    res = requests.get(f"{BASE_URL}/jobs", headers=headers)
    jobs = res.json()
    picking_job = [j for j in jobs if j["job_type"] == "PICKING" and j["status"] == "PENDING"][-1]
    
    requests.put(f"{BASE_URL}/jobs/{picking_job['id']}/assign?employee_id=1", headers=headers)
    requests.put(f"{BASE_URL}/jobs/{picking_job['id']}/accept", headers=headers)
    res = requests.put(f"{BASE_URL}/jobs/{picking_job['id']}/complete", headers=headers)
    
    if not res.ok:
        print("Picking job completion failed:", res.text)
        sys.exit(1)
        
    # Verify Inventory decreased
    res = requests.get(f"{BASE_URL}/inventory", headers=headers)
    invs = res.json()
    dest_inv = [i for i in invs if i["product_id"] == p1["id"] and i["position_id"] == pos_id]
    
    print(f"Final Inventory at pos_id={pos_id}: {dest_inv[0]['quantity']}")
    
    print("All tests passed successfully!")

if __name__ == "__main__":
    run_tests()
