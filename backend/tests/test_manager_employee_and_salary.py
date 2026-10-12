import pytest
import uuid
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

@pytest.fixture(scope="module")
def manager_headers():
    res = client.post("/api/auth/login", json={"email": "manager@wareflow.demo", "password": "password123"})
    assert res.status_code == 200
    return {"Authorization": f"Bearer {res.json()['access_token']}"}

@pytest.fixture(scope="module")
def employee_headers():
    res = client.post("/api/auth/login", json={"email": "employee@wareflow.demo", "password": "password123"})
    assert res.status_code == 200
    return {"Authorization": f"Bearer {res.json()['access_token']}"}

def test_manager_employee_directory_and_details(manager_headers):
    # Get enriched directory
    res = client.get("/api/employees", headers=manager_headers)
    assert res.status_code == 200
    employees = res.json()
    assert len(employees) > 0
    first = employees[0]
    assert "employee_code" in first
    assert "active_jobs_count" in first
    assert "completed_jobs_count" in first
    assert "salary_status" in first

    # Get details
    detail_res = client.get(f"/api/employees/{first['id']}/details", headers=manager_headers)
    assert detail_res.status_code == 200
    details = detail_res.json()
    assert "employee" in details
    assert "performance" in details
    assert "active_jobs" in details
    assert "completed_jobs" in details
    assert "attendance" in details
    assert "skills" in details

def test_manager_employee_deactivation_protection(manager_headers):
    # Employee 1 (Arjun Kumar) has completed or active work
    # Update skills
    skill_res = client.post(f"/api/employees/1/skills?skill_name=COLD_STORAGE&level=2", headers=manager_headers)
    assert skill_res.status_code == 200
    assert skill_res.json()["skill_name"] == "COLD_STORAGE"

    # Assign warehouse
    wh_res = client.post(f"/api/employees/1/assign-warehouse?warehouse_id=1", headers=manager_headers)
    assert wh_res.status_code == 200
    assert wh_res.json()["warehouse_id"] == 1

def test_manager_salary_management_endpoints(manager_headers, employee_headers):
    period = "2026-10"

    # 1. Salary summary
    summary_res = client.get(f"/api/employees/salary/summary?period={period}", headers=manager_headers)
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["period"] == period
    assert "total_payout" in summary
    assert "unbilled_count" in summary

    # 2. View/Upsert salary rule
    rule_res = client.post("/api/employees/salary-rules", json={
        "role_type": "Picker",
        "salary_model": "WORK_BASED",
        "base_salary": 1500.0,
        "picking_rate": 15.0,
        "packing_rate": 12.0,
        "delivery_rate": 20.0,
        "overtime_rate": 25.0
    }, headers=manager_headers)
    assert rule_res.status_code == 200
    assert rule_res.json()["picking_rate"] == 15.0

    # 3. Employee salary breakdown
    breakdown_res = client.get(f"/api/employees/1/salary-breakdown?period={period}", headers=manager_headers)
    assert breakdown_res.status_code == 200
    bd = breakdown_res.json()
    assert bd["employee_id"] == 1
    assert "completed_jobs" in bd
    assert "piece_rate_earnings" in bd

    # 4. Finalize payroll
    fin_res = client.post(f"/api/employees/1/finalize-salary?period={period}&status=FINALIZED", headers=manager_headers)
    assert fin_res.status_code == 200
    record_id = fin_res.json()["record_id"]
    assert fin_res.json()["salary_status"] == "FINALIZED"

    # 5. Add authorized adjustment with mandatory reason
    adj_res = client.post(f"/api/employees/salary/records/{record_id}/adjustment", json={
        "amount": 150.0,
        "reason": "Top speed bonus for October surge"
    }, headers=manager_headers)
    assert adj_res.status_code == 200
    assert adj_res.json()["new_adjustments"] >= 150.0

    # 6. Reject adjustment with empty reason
    bad_adj = client.post(f"/api/employees/salary/records/{record_id}/adjustment", json={
        "amount": 50.0,
        "reason": ""
    }, headers=manager_headers)
    assert bad_adj.status_code == 400

    # 7. Update status to PAID
    paid_res = client.post(f"/api/employees/salary/records/{record_id}/status", json={"status": "PAID"}, headers=manager_headers)
    assert paid_res.status_code == 200
    assert paid_res.json()["new_status"] == "PAID"

    # 8. IDOR / Access Control: Regular employee CANNOT access manager salary summary or adjustment
    emp_blocked = client.get(f"/api/employees/salary/summary?period={period}", headers=employee_headers)
    assert emp_blocked.status_code in [401, 403]

    emp_adj_blocked = client.post(f"/api/employees/salary/records/{record_id}/adjustment", json={
        "amount": 999.0,
        "reason": "Hacking myself a bonus"
    }, headers=employee_headers)
    assert emp_adj_blocked.status_code in [401, 403]
