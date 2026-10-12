import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.connection import SessionLocal
from app.models.user import User
from app.models.employee import Employee, EmployeePerformance, EmployeeAttendance
from app.models.job import Job, JobItem
from app.models.salary import SalaryRule, SalaryRecord
from app.models.notification import Notification

client = TestClient(app)

@pytest.fixture(scope="module")
def employee_auth():
    # Login as employee demo user
    res = client.post("/api/auth/login", json={"email": "employee@wareflow.demo", "password": "password123"})
    assert res.status_code == 200, f"Login failed: {res.text}"
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(scope="module")
def manager_auth():
    # Login as manager demo user
    res = client.post("/api/auth/login", json={"email": "manager@wareflow.demo", "password": "password123"})
    assert res.status_code == 200, f"Manager login failed: {res.text}"
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_employee_me_profile(employee_auth):
    res = client.get("/api/employee/me", headers=employee_auth)
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "employee@wareflow.demo"
    assert "employee_code" in data
    assert data["first_name"] == "Arjun"
    assert data["role_type"] == "Picker"
    assert data["company_id"] == 1

def test_employee_dashboard_metrics(employee_auth):
    res = client.get("/api/employee/dashboard", headers=employee_auth)
    assert res.status_code == 200
    data = res.json()
    assert "kpis" in data
    assert "assigned_jobs" in data["kpis"]
    assert "completed_jobs" in data["kpis"]
    assert "salary_amount" in data["kpis"]
    assert "unread_notifications" in data["kpis"]
    assert "today_work" in data
    assert "recent_completed" in data
    assert "performance" in data
    assert data["kpis"]["completed_jobs"] > 0

def test_employee_jobs_list_and_filters(employee_auth):
    # All jobs
    res = client.get("/api/employee/jobs", headers=employee_auth)
    assert res.status_code == 200
    all_jobs = res.json()
    assert len(all_jobs) > 0

    # Filter completed
    res_comp = client.get("/api/employee/jobs?status=COMPLETED", headers=employee_auth)
    assert res_comp.status_code == 200
    for j in res_comp.json():
        assert j["status"] == "COMPLETED"

    # Filter pending
    res_pend = client.get("/api/employee/jobs?status=PENDING", headers=employee_auth)
    assert res_pend.status_code == 200
    for j in res_pend.json():
        assert j["status"] == "ASSIGNED"

def test_employee_job_lifecycle(employee_auth):
    # Get active job
    res = client.get("/api/employee/jobs", headers=employee_auth)
    jobs = res.json()
    assigned = [j for j in jobs if j["status"] in ["ASSIGNED", "ACCEPTED", "STARTED"]]
    if not assigned:
        from app.database.connection import SessionLocal
        from app.models.job import Job
        db = SessionLocal()
        new_j = Job(
            company_id=1,
            employee_id=1,
            type="PICKING",
            status="ASSIGNED",
            priority=1,
            estimated_duration=10.0
        )
        db.add(new_j)
        db.commit()
        db.refresh(new_j)
        job_id = new_j.id
        db.close()
    else:
        job = assigned[0]
        job_id = job["id"]

    # 1. View detail
    detail_res = client.get(f"/api/employee/jobs/{job_id}", headers=employee_auth)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == job_id
    assert "instructions" in detail

    # 2. If ASSIGNED, test accept
    if detail["status"] == "ASSIGNED":
        acc_res = client.post(f"/api/employee/jobs/{job_id}/accept", headers=employee_auth)
        assert acc_res.status_code == 200
        assert acc_res.json()["job_status"] == "ACCEPTED"

    # 3. Test start
    start_res = client.post(f"/api/employee/jobs/{job_id}/start", headers=employee_auth)
    assert start_res.status_code == 200
    assert start_res.json()["job_status"] == "STARTED"

    # 4. Test complete
    comp_res = client.post(f"/api/employee/jobs/{job_id}/complete", headers=employee_auth)
    assert comp_res.status_code == 200
    assert "marked COMPLETED" in comp_res.json()["message"]

def test_employee_job_rejection_mandatory_reason(employee_auth):
    # Empty reason should fail validation
    res = client.post("/api/employee/jobs/150/reject", headers=employee_auth, json={"reason": ""})
    assert res.status_code in [400, 422]

def test_employee_workspace(employee_auth):
    res = client.get("/api/employee/workspace", headers=employee_auth)
    assert res.status_code == 200
    data = res.json()
    assert "warehouses" in data
    assert "directives" in data

def test_employee_salary_scoped(employee_auth):
    res = client.get("/api/employee/salary", headers=employee_auth)
    assert res.status_code == 200
    data = res.json()
    assert "current_period" in data
    assert "salary_rule" in data
    assert "history" in data
    assert data["salary_rule"]["role_type"] == "Picker"

def test_employee_attendance_flow(employee_auth):
    # 1. Get attendance status
    res = client.get("/api/employee/attendance", headers=employee_auth)
    assert res.status_code == 200
    data = res.json()
    assert "today" in data
    assert "summary" in data
    assert "history" in data

    # 2. Clock in
    cin_res = client.post("/api/employee/attendance/check-in", headers=employee_auth)
    # May be 200 (checked in) or 400 (already checked in)
    assert cin_res.status_code in [200, 400]

    # 3. Clock out
    cout_res = client.post("/api/employee/attendance/check-out", headers=employee_auth)
    assert cout_res.status_code in [200, 400]

def test_employee_notifications(employee_auth):
    res = client.get("/api/employee/notifications", headers=employee_auth)
    assert res.status_code == 200
    notifs = res.json()
    assert isinstance(notifs, list)

    if len(notifs) > 0:
        nid = notifs[0]["id"]
        read_res = client.post(f"/api/employee/notifications/{nid}/read", headers=employee_auth)
        assert read_res.status_code == 200

    # Read all
    read_all = client.post("/api/employee/notifications/read-all", headers=employee_auth)
    assert read_all.status_code == 200

def test_employee_ai_insights(employee_auth):
    res = client.get("/api/employee/ai-insights", headers=employee_auth)
    assert res.status_code == 200
    data = res.json()
    assert "job_sequence" in data
    assert "workload_analysis" in data
    assert "performance_insight" in data

def test_employee_forbidden_manager_endpoints(employee_auth):
    # Employee cannot assign jobs
    assign_res = client.put("/api/jobs/1/assign?employee_id=1", headers=employee_auth)
    assert assign_res.status_code in [401, 403]

    # Employee cannot create salary rules
    rule_res = client.post("/api/employees/salary-rules", headers=employee_auth, json={
        "role_type": "Picker",
        "salary_model": "FIXED",
        "base_salary": 99999
    })
    assert rule_res.status_code in [401, 403]
