import requests
import json
import os

def run_test():
    base_url = "http://127.0.0.1:8000/api"
    
    # Login
    res = requests.post(f"{base_url}/auth/login", json={"email": "manager@wareflow.demo", "password": "password123"})
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    print("--- Products ---")
    prods = requests.get(f"{base_url}/products", headers=headers).json()
    p_map = {p["sku"]: p["id"] for p in prods}
    print("Found products:", list(p_map.keys())[:10])
    
    if "ITEM-001" not in p_map:
        print("Importing products...")
        products_csv = "sku,name,category,unit,dimensions,weight,base_price\nITEM-001,Widget1,Tools,pcs,10x10,1,10\nITEM-002,Widget2,Tools,pcs,10x10,1,10\nITEM-003,Widget3,Tools,pcs,10x10,1,10\nITEM-004,Widget4,Tools,pcs,10x10,1,10\nITEM-005,Widget5,Tools,pcs,10x10,1,10"
        requests.post(f"{base_url}/products/import", headers=headers, files={"file": ("products.csv", products_csv, "text/csv")})
        prods = requests.get(f"{base_url}/products", headers=headers).json()
        p_map = {p["sku"]: p["id"] for p in prods}

    print("--- Setting Stock to 10 via /direct ---")
    pos_res = requests.get(f"{base_url}/warehouses/1/map", headers=headers).json()
    pos_id_1 = 1
    pos_id_2 = 2
    pos_id_3 = 3
    
    requests.post(f"{base_url}/inventory/direct", headers=headers, json={"product_id": p_map["ITEM-001"], "position_id": pos_id_1, "quantity": 10})
    requests.post(f"{base_url}/inventory/direct", headers=headers, json={"product_id": p_map["ITEM-002"], "position_id": pos_id_2, "quantity": 10})
    requests.post(f"{base_url}/inventory/direct", headers=headers, json={"product_id": p_map["ITEM-003"], "position_id": pos_id_3, "quantity": 10})
    
    print("--- Inventory Check ---")
    invs = requests.get(f"{base_url}/inventory", headers=headers).json()
    # verify
    i1 = [i for i in invs if i["product_id"] == p_map["ITEM-001"]][-1]
    print(f"ITEM-001 stock: {i1['quantity']}")
    
    print("--- Orders Import ---")
    with open("c:\\Users\\ajays\\Downloads\\orders_sample (2).csv", "r") as f:
        orders_csv = f.read()
        
    res = requests.post(f"{base_url}/orders/import", headers=headers, files={"file": ("orders.csv", orders_csv, "text/csv")})
    print(res.json())

if __name__ == "__main__":
    run_test()
