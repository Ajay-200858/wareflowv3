import requests

def run_test():
    base_url = "http://127.0.0.1:8000/api"
    
    # 0. Login
    res = requests.post(f"{base_url}/auth/login", json={"email": "manager@wareflow.demo", "password": "password123"})
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    print("--- Products Import ---")
    products_csv = "sku,name,category,unit,dimensions,weight,base_price\nITEM-001,Widget1,Tools,pcs,10x10,1,10\nITEM-002,Widget2,Tools,pcs,10x10,1,10\nITEM-003,Widget3,Tools,pcs,10x10,1,10"
    res = requests.post(f"{base_url}/products/import", headers=headers, files={"file": ("products.csv", products_csv, "text/csv")})
    print(res.json())
    
    print("--- Inventory Import ---")
    inv_csv = "product_sku,position_code,quantity\nITEM-001,A-R1-1-1,50\nITEM-002,A-R1-1-2,50\nITEM-003,A-R1-1-3,50"
    res = requests.post(f"{base_url}/inventory/import", headers=headers, files={"file": ("inventory.csv", inv_csv, "text/csv")})
    print(res.json())
    
    print("--- Inventory Check ---")
    res = requests.get(f"{base_url}/inventory", headers=headers)
    print([i for i in res.json() if i["quantity"] == 50][:3])
    
    print("--- Orders Import ---")
    orders_csv = "order_reference,customer_name,delivery_address,priority,product_sku,quantity\nORD-999,Test Customer,123 Test St,NORMAL,ITEM-001,2\nORD-999,Test Customer,123 Test St,NORMAL,ITEM-002,2"
    res = requests.post(f"{base_url}/orders/import", headers=headers, files={"file": ("orders.csv", orders_csv, "text/csv")})
    print(res.json())
    
    print("--- Jobs Check ---")
    res = requests.get(f"{base_url}/jobs", headers=headers)
    print([j for j in res.json() if "ORD-999" in str(j)])

if __name__ == "__main__":
    run_test()
