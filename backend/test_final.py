import requests
import json
import os

def run_test():
    base_url = "http://127.0.0.1:8000/api"
    
    # Login
    res = requests.post(f"{base_url}/auth/login", json={"email": "manager@wareflow.demo", "password": "password123"})
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    prods = requests.get(f"{base_url}/products", headers=headers).json()
    p_map = {p["sku"]: p["id"] for p in prods}
    
    print("--- Setting Stock to exactly 10 for each item ---")
    pos_id = 1
    
    requests.post(f"{base_url}/inventory/direct", headers=headers, json={"product_id": p_map["ITEM-001"], "position_id": pos_id, "quantity": 10})
    requests.post(f"{base_url}/inventory/direct", headers=headers, json={"product_id": p_map["ITEM-002"], "position_id": pos_id, "quantity": 10})
    requests.post(f"{base_url}/inventory/direct", headers=headers, json={"product_id": p_map["ITEM-003"], "position_id": pos_id, "quantity": 10})
    
    invs = requests.get(f"{base_url}/inventory", headers=headers).json()
    i1 = [i for i in invs if i["product_id"] == p_map["ITEM-001"]][-1]
    print(f"ITEM-001 stock before order: {i1['quantity']} total, {i1['available_quantity']} available")
    
    print("--- Importing Orders ---")
    with open("c:\\Users\\ajays\\Downloads\\orders_sample (2).csv", "r") as f:
        orders_csv = f.read()
        
    res = requests.post(f"{base_url}/orders/import", headers=headers, files={"file": ("orders.csv", orders_csv, "text/csv")})
    print("Order Import Response:", res.json())
    
    invs_after = requests.get(f"{base_url}/inventory", headers=headers).json()
    i1_after = [i for i in invs_after if i["product_id"] == p_map["ITEM-001"]][-1]
    print(f"ITEM-001 stock after order: {i1_after['quantity']} total, {i1_after['available_quantity']} available, {i1_after['reserved_quantity']} reserved")

if __name__ == "__main__":
    run_test()
