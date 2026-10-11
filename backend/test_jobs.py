import requests
base_url = "http://127.0.0.1:8000/api"
res = requests.post(f"{base_url}/auth/login", json={"email": "manager@wareflow.demo", "password": "password123"})
token = res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

res = requests.get(f"{base_url}/orders", headers=headers)
order_id = [o for o in res.json() if o.get("status") == "RESERVED"][-1]["id"]

res = requests.get(f"{base_url}/jobs", headers=headers)
jobs = [j for j in res.json() if j.get("order_id") == order_id]
print("Jobs for Order", order_id, ":", len(jobs))
if len(jobs) > 0:
    print(jobs[0])
