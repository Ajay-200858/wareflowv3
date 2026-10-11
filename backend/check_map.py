import requests
import json
base_url = "http://127.0.0.1:8000/api"
res = requests.post(f"{base_url}/auth/login", json={"email": "manager@wareflow.demo", "password": "password123"})
token = res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}
res = requests.get(f"{base_url}/warehouses/1/map", headers=headers)
print(json.dumps(res.json(), indent=2)[:500])
