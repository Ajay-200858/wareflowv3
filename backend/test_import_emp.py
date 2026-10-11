import requests
import json
base_url = "http://127.0.0.1:8000/api"
res = requests.post(f"{base_url}/auth/login", json={"email": "manager@wareflow.demo", "password": "password123"})
token = res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

with open(r"c:\Users\ajays\Downloads\WareFlow_Sample_Upload_Files\02_employees_and_managers.csv", "rb") as f:
    res = requests.post(f"{base_url}/employees/import", headers=headers, files={"file": f})
    
print("Import Response:", res.status_code)
print("Data:", res.json())
