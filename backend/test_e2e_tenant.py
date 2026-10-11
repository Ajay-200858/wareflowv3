import requests
import json
import time

base_url = "http://127.0.0.1:8000/api"

# 1. Login as the tenant manager
res = requests.post(f"{base_url}/auth/login", json={"email": "ajayselva5802008@gmail.com", "password": "password123"})
assert res.status_code == 200, f"Login failed: {res.text}"
token = res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 2. Get active jobs
res = requests.get(f"{base_url}/jobs", headers=headers)
assert res.status_code == 200
jobs = res.json()
pending_jobs = [j for j in jobs if j["status"] == "PENDING"]
assert len(pending_jobs) > 0, "No pending jobs found!"
job = pending_jobs[0]
job_id = job["id"]

# 3. AI Assign
print(f"Triggering AI Assign for Job {job_id}")
res = requests.post(f"{base_url}/ai/assignment/recommend?job_id={job_id}", headers=headers)
assert res.status_code == 200, f"AI Assign failed: {res.text}"
ai_rec = res.json()
rec_id = ai_rec["id"]
print(f"AI Recommendation ID: {rec_id} - {ai_rec}")

# 4. Check Decision Center
res = requests.get(f"{base_url}/ai/recommendations", headers=headers)
assert res.status_code == 200
decisions = res.json()
assert any(d["id"] == rec_id for d in decisions), "Recommendation not found in decision center"

# 5. Manager Approve
print(f"Manager approving recommendation {rec_id}")
res = requests.post(f"{base_url}/ai/feedback", headers=headers, json={"recommendation_id": rec_id, "decision": "ACCEPTED", "reason": "Looks good"})
assert res.status_code == 200

# 6. Verify Job is ASSIGNED
res = requests.get(f"{base_url}/jobs", headers=headers)
jobs = res.json()
assigned_job = next((j for j in jobs if j["id"] == job_id), None)
assert assigned_job["status"] == "ASSIGNED", f"Job status is {assigned_job['status']}, expected ASSIGNED"
assigned_emp_id = assigned_job["employee_id"]
print(f"Job {job_id} assigned to employee {assigned_emp_id}")

# 7. Employee Accept Job
print(f"Accepting Job {job_id}")
res = requests.put(f"{base_url}/jobs/{job_id}/accept", headers=headers)
assert res.status_code == 200, f"Accept job failed: {res.text}"

# 8. Complete Job
print(f"Completing Job {job_id}")
res = requests.put(f"{base_url}/jobs/{job_id}/complete", headers=headers)
assert res.status_code == 200, f"Complete job failed: {res.text}"

res = requests.get(f"{base_url}/jobs", headers=headers)
jobs = res.json()
completed_job = next((j for j in jobs if j["id"] == job_id), None)
assert completed_job["status"] == "COMPLETED", "Job is not completed!"

print("ALL E2E API VERIFICATIONS PASSED FOR TENANT!")
