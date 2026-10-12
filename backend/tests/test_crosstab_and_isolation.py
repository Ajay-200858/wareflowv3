import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_cross_session_token_and_role_isolation():
    """
    Simulates Tab A (Employee) and Tab B (Manager) operating concurrently.
    Verifies that requests with Employee Token and Manager Token remain strictly
    isolated, that employee actions preserve employee role and identity, and that
    role barriers are strictly enforced on all sensitive endpoints.
    """
    # 1. Tab A logs in as Employee
    res_a = client.post("/api/auth/login", json={
        "email": "employee@wareflow.demo",
        "password": "password123"
    })
    assert res_a.status_code == 200
    token_a = res_a.json()["access_token"]
    user_a = res_a.json()["user"]
    assert user_a["role"] == "EMPLOYEE"
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 2. Tab B logs in as Manager
    res_b = client.post("/api/auth/login", json={
        "email": "manager@wareflow.demo",
        "password": "password123"
    })
    assert res_b.status_code == 200
    token_b = res_b.json()["access_token"]
    user_b = res_b.json()["user"]
    assert user_b["role"] == "MANAGER"
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Verify tokens are distinct
    assert token_a != token_b

    # 3. Tab A queries Employee Portal endpoints
    emp_overview = client.get("/api/employee/dashboard", headers=headers_a)
    assert emp_overview.status_code == 200
    assert "kpis" in emp_overview.json()

    emp_me = client.get("/api/employee/me", headers=headers_a)
    assert emp_me.status_code == 200
    assert emp_me.json()["email"] == "employee@wareflow.demo"
    assert emp_me.json()["company_id"] == 1

    emp_jobs = client.get("/api/employee/jobs", headers=headers_a)
    assert emp_jobs.status_code == 200
    assert isinstance(emp_jobs.json(), list)

    # 4. Tab B queries Manager Operations endpoints
    mgr_emp_list = client.get("/api/employees", headers=headers_b)
    assert mgr_emp_list.status_code == 200
    assert isinstance(mgr_emp_list.json(), list)

    mgr_salary_summary = client.get("/api/employees/salary/summary?period=2026-10", headers=headers_b)
    assert mgr_salary_summary.status_code == 200
    assert "total_payout" in mgr_salary_summary.json()

    # 5. Tab A attempts to perform employee job actions (clock in, check salary)
    attendance_res = client.get("/api/employee/attendance", headers=headers_a)
    assert attendance_res.status_code == 200

    salary_res = client.get("/api/employee/salary", headers=headers_a)
    assert salary_res.status_code == 200
    assert "salary_rule" in salary_res.json()
    assert "current_period" in salary_res.json()

    # 6. Verify Tab A is strictly prevented from accessing Manager-only endpoints (IDOR / RBAC check)
    forbidden_mgr_emp = client.get("/api/employees", headers=headers_a)
    assert forbidden_mgr_emp.status_code in [401, 403]

    forbidden_mgr_summary = client.get("/api/employees/salary/summary?period=2026-10", headers=headers_a)
    assert forbidden_mgr_summary.status_code in [401, 403]

    forbidden_invites = client.get("/api/employees/invitations", headers=headers_a)
    assert forbidden_invites.status_code in [401, 403]

    # 7. Verify Tab A's profile check still confirms EMPLOYEE role
    me_a = client.get("/api/auth/me", headers=headers_a)
    assert me_a.status_code == 200
    assert me_a.json()["role"] == "EMPLOYEE"
    assert me_a.json()["email"] == "employee@wareflow.demo"

    # 8. Verify Tab B's profile check still confirms MANAGER role
    me_b = client.get("/api/auth/me", headers=headers_b)
    assert me_b.status_code == 200
    assert me_b.json()["role"] == "MANAGER"
    assert me_b.json()["email"] == "manager@wareflow.demo"
