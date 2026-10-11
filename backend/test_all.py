import requests
import time

BASE_URL = "http://127.0.0.1:8000/api"
session = requests.Session()

def run_tests():
    print("1. Registering Manager")
    res = session.post(f"{BASE_URL}/auth/register", json={
        "email": "test_e2e@wareflow.demo",
        "password": "password123",
        "company_name": "E2E Logistics",
        "industry": "Retail",
        "role": "MANAGER"
    })
    if res.status_code == 400 and "already registered" in res.text:
        # Login instead
        res = session.post(f"{BASE_URL}/auth/login", json={
            "email": "test_e2e@wareflow.demo",
            "password": "password123"
        })
    token = res.json()["access_token"]
    session.headers.update({"Authorization": f"Bearer {token}"})
    print("Logged in successfully.")
    
    print("1.5. Completing Setup")
    res = session.put(f"{BASE_URL}/auth/me/setup", json={"company_name": "E2E Logistics Updated"})
    print(f"Setup Complete: {res.status_code} {res.text}")
    assert res.status_code == 200
    
    print("2. Import Employees CSV")
    csv_emp = "first_name,last_name,email,role,skills\nWorker,One,worker1@wareflow.demo,EMPLOYEE,FORKLIFT\nWorker,Two,worker2@wareflow.demo,EMPLOYEE,MANUAL\n"
    res = session.post(f"{BASE_URL}/employees/import", files={"file": ("emp.csv", csv_emp.encode('utf-8'), "text/csv")})
    print(f"Emp Import: {res.status_code} {res.text}")
    assert res.status_code == 200

    print("3. Import Warehouse CSV")
    csv_wh = "warehouse,zone,rack,row,position,capacity\nMain,Zone A,Rack 1,Row 1,A1-01,100\nMain,Zone A,Rack 1,Row 1,A1-02,100\n"
    res = session.post(f"{BASE_URL}/warehouses/import", files={"file": ("wh.csv", csv_wh.encode('utf-8'), "text/csv")})
    print(f"WH Import: {res.status_code} {res.text}")
    assert res.status_code == 200

    print("4. Import Products CSV")
    csv_prod = "sku,name,unit,category,dimensions,weight,base_price\nSKU-001,Widget A,pcs,Tools,1x1x1,1,10\nSKU-002,Widget B,pcs,Tools,1x1x1,1,20\n"
    res = session.post(f"{BASE_URL}/products/import", files={"file": ("prod.csv", csv_prod.encode('utf-8'), "text/csv")})
    print(f"Prod Import: {res.status_code} {res.text}")
    assert res.status_code == 200
    
    # get products and positions to map inventory
    prods = session.get(f"{BASE_URL}/products").json()
    p1_id = prods[-2]["id"]
    p2_id = prods[-1]["id"]
    
    whs = session.get(f"{BASE_URL}/warehouses").json()
    map_data = session.get(f"{BASE_URL}/warehouses/{whs[0]['id']}/map").json()
    pos1_id = map_data["zones"][0]["racks"][0]["rows"][0]["positions"][0]["id"]
    
    print("5. Import Inventory CSV")
    csv_inv = f"sku,warehouse_code,quantity,receipt_reference\nSKU-001,Main,50,REF-1\nSKU-002,Main,30,REF-1\n"
    res = session.post(f"{BASE_URL}/inventory/import", files={"file": ("inv.csv", csv_inv.encode('utf-8'), "text/csv")})
    print(f"Inv Import: {res.status_code} {res.text}")
    assert res.status_code == 200
    
    print("6. Import Orders CSV")
    csv_ord = f"order_reference,customer_name,delivery_address,priority,product_sku,quantity\nORD-999,Alice,123 Main St,NORMAL,SKU-001,10\nORD-999,Alice,123 Main St,NORMAL,SKU-002,5\n"
    res = session.post(f"{BASE_URL}/orders/import", files={"file": ("ord.csv", csv_ord.encode('utf-8'), "text/csv")})
    print(f"Ord Import: {res.status_code} {res.text}")
    assert res.status_code == 200
    
    print("7. Fetch Jobs and Test Assignment")
    jobs = session.get(f"{BASE_URL}/jobs").json()
    
    # get the latest job
    job_id = jobs[-1]["id"]
    
    emps = session.get(f"{BASE_URL}/employees").json()
    emp_id = emps[0]["id"]
    
    print(f"Assigning job {job_id} to employee {emp_id}")
    res = session.put(f"{BASE_URL}/jobs/{job_id}/assign?employee_id={emp_id}")
    print(f"Assign: {res.status_code} {res.text}")
    assert res.status_code == 200
    
    print("8. Accept Job")
    res = session.put(f"{BASE_URL}/jobs/{job_id}/accept")
    print(f"Accept: {res.status_code} {res.text}")
    assert res.status_code == 200
    
    print("9. Complete Job")
    res = session.put(f"{BASE_URL}/jobs/{job_id}/complete")
    print(f"Complete: {res.status_code} {res.text}")
    assert res.status_code == 200
    
    print("All E2E Pipeline tests passed!")

if __name__ == "__main__":
    run_tests()
