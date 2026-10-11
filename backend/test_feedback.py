import requests
import json
base_url = "http://127.0.0.1:8000/api"
res = requests.post(f"{base_url}/auth/login", json={"email": "manager@wareflow.demo", "password": "password123"})
token = res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

res = requests.post(f"{base_url}/ai/feedback", headers=headers, json={
    "recommendation_id": 20,
    "decision": "ACCEPTED",
    "reason": "Manager approved test"
})
print("Feedback Response:", res.status_code, res.text)
