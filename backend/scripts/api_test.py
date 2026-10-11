import urllib.request
import urllib.error
import json

BASE_URL = "http://127.0.0.1:8000/api"

def make_request(method, endpoint, data=None, token=None):
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url, method=method)
    if data:
        req.data = json.dumps(data).encode('utf-8')
        req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', f'Bearer {token}')
    
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"Error {e.code}: {e.read().decode('utf-8')}")
        exit(1)

print("1. Testing Login...")
res = make_request("POST", "/auth/login", {"email": "manager@wareflow.demo", "password": "password123"})
token = res["access_token"]
print("Login Success!")

print("2. Testing Products...")
res = make_request("GET", "/products", token=token)
print("Products:", len(res))

print("3. Testing Inventory...")
res = make_request("GET", "/inventory", token=token)
print("Inventory records:", len(res))

print("4. Testing Jobs...")
res = make_request("GET", "/jobs", token=token)
print("Jobs:", len(res))

print("All critical API workflows passed!")
