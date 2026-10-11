import requests
base_url = "http://127.0.0.1:8000/api"
res = requests.post(f"{base_url}/auth/login", json={"email": "ajayselva5802008@gmail.com", "password": "password123"})
token = res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}
res = requests.post(f"{base_url}/ai/assignment/recommend?job_id=157", headers=headers)
print("Status:", res.status_code)
print("Body:", res.text)
