import os
import requests
import json
from sqlalchemy import create_engine, text

API_BASE = "http://127.0.0.1:8000/api"
DB_URL = "mysql+pymysql://root:Ajay%402008@localhost:3306/wareflow" # Default from README.md

def run_tests():
    print("--- 1. Login ---")
    r = requests.post(f"{API_BASE}/auth/login", json={"email": "admin@wareflow.demo", "password": "password123"})
    if r.status_code != 200:
        print("Login failed:", r.status_code, r.text)
        return
    token = r.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    print("Login successful, token retrieved.")
    
    # We need a valid product_id for the sales import. Let's find one.
    engine = create_engine(DB_URL)
    with engine.connect() as conn:
        prod = conn.execute(text("SELECT id FROM products LIMIT 1")).fetchone()
        prod_id = prod[0] if prod else 1
    
    print(f"--- 2. Upload Historical Sales CSV for Product {prod_id} ---")
    csv_content = f"""product_id,date,quantity_sold
{prod_id},2026-01-01,15
{prod_id},2026-01-02,18
{prod_id},2026-01-03,14
{prod_id},2026-01-04,20
{prod_id},2026-01-05,17
{prod_id},2026-01-06,22
{prod_id},2026-01-07,19
{prod_id},2026-01-08,25
{prod_id},2026-01-09,21
{prod_id},2026-01-10,24
"""
    files = {'file': ('04_historical_sales.csv', csv_content.encode('utf-8'))}
    r = requests.post(f"{API_BASE}/ai/import-historical", headers=headers, files=files)
    print("Upload Response:", r.status_code, r.text)
    
    print("--- 3. Verify Database Insertions ---")
    with engine.connect() as conn:
        # Get admin user's company_id
        admin = conn.execute(text("SELECT company_id FROM users WHERE email='admin@wareflow.demo'")).fetchone()
        company_id = admin[0]
        
        # Check sales_history
        rows = conn.execute(text(f"SELECT id, company_id, product_id, date, quantity_sold FROM sales_history WHERE company_id={company_id} AND date >= '2026-01-01'")).fetchall()
        print(f"Found {len(rows)} recent sales rows for company {company_id}.")
        for row in rows[:2]:
            print("Row:", dict(row._mapping))
            
        null_rows = conn.execute(text(f"SELECT COUNT(*) FROM sales_history WHERE company_id IS NULL")).scalar()
        print(f"Rows with NULL company_id: {null_rows}")

    print("--- 4. Verify ML Training Isolation ---")
    r = requests.post(f"{API_BASE}/ai/train", headers=headers)
    print("Train Response:", r.status_code, r.text)
    
    print("--- 5. Verify ML Prediction ---")
    r = requests.get(f"{API_BASE}/ai/demand/product/{prod_id}", headers=headers)
    print("Forecast Response:", r.status_code, r.text)

if __name__ == "__main__":
    run_tests()
