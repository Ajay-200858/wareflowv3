from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import csv
import io

from app.database.connection import get_db
from app.core.dependencies import get_current_active_user, get_current_active_manager
from app.models.user import User
from app.models.employee import (
    Employee,
    EmployeeSkill,
    EmployeeShift,
    EmployeeAvailability,
    EmployeePerformance,
    EmployeeAttendance,
)
from app.models.invitation import EmployeeInvitation
from app.models.warehouse import Warehouse
from app.models.salary import SalaryRule, SalaryRecord, SalaryAdjustment
from app.models.job import Job
from app.core.security import get_password_hash
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeResponse,
    ShiftCreate,
    ShiftResponse,
    AvailabilityCreate,
    AvailabilityResponse,
    SalaryRuleCreate,
    SalaryRuleResponse,
    SalaryRecordResponse,
    SalaryAdjustmentCreate,
    SalaryStatusUpdate,
    InvitationCreate,
    InvitationResponse,
)

router = APIRouter()

# --- INVITATIONS MANAGEMENT (Must come before /{emp_id} to avoid path collision) ---

@router.get("/invitations", response_model=List[InvitationResponse])
def get_invitations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_manager),
):
    invitations = db.query(EmployeeInvitation).filter(
        EmployeeInvitation.company_id == current_user.company_id
    ).order_by(EmployeeInvitation.created_at.desc()).all()

    result = []
    for inv in invitations:
        wh_name = inv.warehouse.name if inv.warehouse else None
        result.append(
            InvitationResponse(
                id=inv.id,
                company_id=inv.company_id,
                invitation_code=inv.invitation_code,
                role_type=inv.role_type or "Picker",
                email=inv.email,
                warehouse_id=inv.warehouse_id,
                warehouse_name=wh_name,
                is_used=inv.is_used,
                is_revoked=inv.is_revoked,
                expires_at=inv.expires_at,
                created_at=inv.created_at,
                used_at=inv.used_at,
            )
        )
    return result


@router.post("/invitations", response_model=InvitationResponse, status_code=201)
def create_invitation(
    data: InvitationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_manager),
):
    # Validate warehouse if specified
    wh_name = None
    if data.warehouse_id:
        wh = db.query(Warehouse).filter(
            Warehouse.id == data.warehouse_id,
            Warehouse.company_id == current_user.company_id,
        ).first()
        if not wh:
            raise HTTPException(status_code=400, detail="Invalid warehouse ID for your company")
        wh_name = wh.name

    code = f"WF-INV-{uuid.uuid4().hex[:8].upper()}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=data.expires_in_days or 7)

    inv = EmployeeInvitation(
        company_id=current_user.company_id,
        invitation_code=code,
        email=data.email.strip().lower() if data.email else None,
        role_type=data.role_type or "Picker",
        warehouse_id=data.warehouse_id,
        is_used=False,
        is_revoked=False,
        expires_at=expires_at,
        created_by_user_id=current_user.id,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)

    return InvitationResponse(
        id=inv.id,
        company_id=inv.company_id,
        invitation_code=inv.invitation_code,
        role_type=inv.role_type,
        email=inv.email,
        warehouse_id=inv.warehouse_id,
        warehouse_name=wh_name,
        is_used=inv.is_used,
        is_revoked=inv.is_revoked,
        expires_at=inv.expires_at,
        created_at=inv.created_at,
        used_at=inv.used_at,
    )


@router.post("/invitations/{inv_id}/revoke")
def revoke_invitation(
    inv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_manager),
):
    inv = db.query(EmployeeInvitation).filter(
        EmployeeInvitation.id == inv_id,
        EmployeeInvitation.company_id == current_user.company_id,
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")
    inv.is_revoked = True
    db.commit()
    return {"status": "success", "message": f"Invitation {inv.invitation_code} revoked"}


# --- SALARY & PAYROLL MANAGEMENT (Must come before /{emp_id}) ---

@router.get("/salary/summary")
def get_salary_summary(
    period: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_manager),
):
    if not period:
        period = datetime.now(timezone.utc).strftime("%Y-%m")

    employees = db.query(Employee).filter(
        Employee.company_id == current_user.company_id,
        Employee.status == "ACTIVE",
    ).all()
    total_employees = len(employees)

    records = db.query(SalaryRecord).join(Employee).filter(
        Employee.company_id == current_user.company_id,
        SalaryRecord.period == period,
    ).all()

    total_payout = sum(r.total_amount for r in records)
    total_base = sum(r.base_amount for r in records)
    total_piece_rate = sum(r.piece_rate_amount for r in records)
    total_adjustments = sum(r.adjustments for r in records)

    finalized_count = sum(1 for r in records if r.status in ["FINALIZED", "PAID"])
    paid_count = sum(1 for r in records if r.status == "PAID")
    draft_count = sum(1 for r in records if r.status in ["DRAFT", "PENDING"])
    unbilled_count = max(0, total_employees - len(records))

    return {
        "period": period,
        "total_employees": total_employees,
        "total_payout": round(total_payout, 2),
        "total_base": round(total_base, 2),
        "total_piece_rate": round(total_piece_rate, 2),
        "total_adjustments": round(total_adjustments, 2),
        "finalized_count": finalized_count,
        "paid_count": paid_count,
        "draft_count": draft_count,
        "unbilled_count": unbilled_count,
        "processed_count": len(records),
    }


@router.get("/salary/rules", response_model=List[SalaryRuleResponse])
def get_salary_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_manager),
):
    return db.query(SalaryRule).filter(SalaryRule.company_id == current_user.company_id).all()


@router.post("/salary-rules", response_model=SalaryRuleResponse)
def create_salary_rule(
    rule: SalaryRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_manager),
):
    existing = db.query(SalaryRule).filter(
        SalaryRule.company_id == current_user.company_id,
        SalaryRule.role_type == rule.role_type,
    ).first()

    if existing:
        existing.salary_model = rule.salary_model
        existing.base_salary = rule.base_salary
        existing.picking_rate = rule.picking_rate
        existing.packing_rate = rule.packing_rate
        existing.delivery_rate = rule.delivery_rate
        existing.overtime_rate = rule.overtime_rate
        db.commit()
        db.refresh(existing)
        return existing

    db_rule = SalaryRule(**rule.model_dump(), company_id=current_user.company_id)
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.get("/salary/records")
def get_salary_records(
    period: Optional[str] = None,
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_manager),
):
    query = db.query(SalaryRecord).join(Employee).filter(
        Employee.company_id == current_user.company_id
    )
    if period:
        query = query.filter(SalaryRecord.period == period)
    if employee_id:
        query = query.filter(SalaryRecord.employee_id == employee_id)

    records = query.order_by(SalaryRecord.created_at.desc()).all()
    result = []
    for r in records:
        emp = r.employee
        result.append({
            "id": r.id,
            "employee_id": r.employee_id,
            "employee_name": f"{emp.first_name} {emp.last_name}" if emp else "Unknown",
            "employee_code": emp.employee_code if emp else None,
            "role_type": emp.role_type if emp else None,
            "period": r.period,
            "base_amount": round(r.base_amount, 2),
            "piece_rate_amount": round(r.piece_rate_amount, 2),
            "overtime_amount": round(r.overtime_amount, 2),
            "bonus": round(r.bonus, 2),
            "adjustments": round(r.adjustments, 2),
            "total_amount": round(r.total_amount, 2),
            "status": r.status,
            "created_at": r.created_at,
        })
    return result


@router.post("/salary/records/{record_id}/adjustment")
def add_salary_adjustment(
    record_id: int,
    adj: SalaryAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_manager),
):
    record = db.query(SalaryRecord).join(Employee).filter(
        SalaryRecord.id == record_id,
        Employee.company_id == current_user.company_id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Salary record not found")

    if not adj.reason or not adj.reason.strip():
        raise HTTPException(status_code=400, detail="A recorded reason is mandatory for salary adjustments")

    if record.status == "PAID":
        raise HTTPException(status_code=400, detail="Cannot adjust an already paid payroll record")

    db_adj = SalaryAdjustment(
        salary_record_id=record.id,
        amount=adj.amount,
        reason=adj.reason.strip(),
    )
    db.add(db_adj)

    record.adjustments = (record.adjustments or 0.0) + adj.amount
    record.total_amount = round(
        record.base_amount + record.piece_rate_amount + record.overtime_amount + record.bonus + record.adjustments,
        2
    )
    db.commit()
    db.refresh(record)

    return {
        "status": "success",
        "record_id": record.id,
        "new_adjustments": record.adjustments,
        "new_total": record.total_amount,
        "adjustment": {"amount": adj.amount, "reason": adj.reason},
    }


@router.post("/salary/records/{record_id}/status")
def update_salary_record_status(
    record_id: int,
    status_update: SalaryStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_manager),
):
    record = db.query(SalaryRecord).join(Employee).filter(
        SalaryRecord.id == record_id,
        Employee.company_id == current_user.company_id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Salary record not found")

    new_status = status_update.status.upper()
    valid_statuses = ["DRAFT", "PENDING", "FINALIZED", "PAID"]
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")

    record.status = new_status
    db.commit()
    db.refresh(record)
    return {"status": "success", "record_id": record.id, "new_status": record.status}


# --- EMPLOYEES CRUD ---

@router.get("", response_model=List[EmployeeResponse])
def get_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_manager),
):
    employees = db.query(Employee).filter(
        Employee.company_id == current_user.company_id
    ).order_by(Employee.id.asc()).all()

    current_period = datetime.now(timezone.utc).strftime("%Y-%m")

    # Fetch batch counts for performance & active jobs
    result = []
    for emp in employees:
        active_count = db.query(Job).filter(
            Job.employee_id == emp.id,
            Job.company_id == current_user.company_id,
            Job.status.in_(["ASSIGNED", "ACCEPTED", "STARTED"]),
        ).count()

        completed_count = db.query(Job).filter(
            Job.employee_id == emp.id,
            Job.company_id == current_user.company_id,
            Job.status == "COMPLETED",
        ).count()

        perf = db.query(EmployeePerformance).filter(
            EmployeePerformance.employee_id == emp.id
        ).order_by(EmployeePerformance.id.desc()).first()

        sal_rec = db.query(SalaryRecord).filter(
            SalaryRecord.employee_id == emp.id,
            SalaryRecord.period == current_period,
        ).first()

        email = emp.user.email if emp.user else None
        wh_name = emp.warehouse.name if emp.warehouse else None
        sal_status = sal_rec.status if sal_rec else "UNBILLED"

        result.append(
            EmployeeResponse(
                id=emp.id,
                company_id=emp.company_id,
                first_name=emp.first_name,
                last_name=emp.last_name,
                role_type=emp.role_type,
                status=emp.status or "ACTIVE",
                user_id=emp.user_id,
                warehouse_id=emp.warehouse_id,
                employee_code=emp.employee_code or f"EMP-{emp.id:04d}",
                current_workload=emp.current_workload or 0.0,
                email=email,
                warehouse_name=wh_name,
                active_jobs_count=active_count,
                completed_jobs_count=completed_count,
                accuracy=perf.accuracy if perf else 1.0,
                on_time_rate=perf.on_time_rate if perf else 1.0,
                salary_status=sal_status,
                created_at=emp.created_at or datetime.now(timezone.utc),
            )
        )
    return result


@router.post("", response_model=EmployeeResponse, status_code=201)
def create_employee(
    employee: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_manager),
):
    db_emp = Employee(**employee.model_dump(), company_id=current_user.company_id)
    db.add(db_emp)
    db.flush()
    if not db_emp.employee_code:
        db_emp.employee_code = f"EMP-{db_emp.id:04d}"
    db.commit()
    db.refresh(db_emp)

    return EmployeeResponse(
        id=db_emp.id,
        company_id=db_emp.company_id,
        first_name=db_emp.first_name,
        last_name=db_emp.last_name,
        role_type=db_emp.role_type,
        status=db_emp.status or "ACTIVE",
        user_id=db_emp.user_id,
        warehouse_id=db_emp.warehouse_id,
        employee_code=db_emp.employee_code,
        current_workload=db_emp.current_workload or 0.0,
        email=db_emp.user.email if db_emp.user else None,
        warehouse_name=db_emp.warehouse.name if db_emp.warehouse else None,
        active_jobs_count=0,
        completed_jobs_count=0,
        accuracy=1.0,
        on_time_rate=1.0,
        salary_status="UNBILLED",
        created_at=db_emp.created_at or datetime.now(timezone.utc),
    )


@router.get("/{emp_id}/details")
def get_employee_details(
    emp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_manager),
):
    emp = db.query(Employee).filter(
        Employee.id == emp_id,
        Employee.company_id == current_user.company_id,
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Active jobs
    active_jobs = db.query(Job).filter(
        Job.employee_id == emp.id,
        Job.company_id == current_user.company_id,
        Job.status.in_(["ASSIGNED", "ACCEPTED", "STARTED"]),
    ).order_by(Job.priority.asc(), Job.created_at.desc()).all()

    active_jobs_data = [{
        "id": j.id,
        "type": j.type,
        "status": j.status,
        "priority": j.priority,
        "order_id": j.order_id,
        "estimated_duration": j.estimated_duration,
        "created_at": j.created_at,
    } for j in active_jobs]

    # Completed jobs (recent 15)
    completed_jobs = db.query(Job).filter(
        Job.employee_id == emp.id,
        Job.company_id == current_user.company_id,
        Job.status == "COMPLETED",
    ).order_by(Job.completed_at.desc()).limit(15).all()

    completed_jobs_data = [{
        "id": j.id,
        "type": j.type,
        "order_id": j.order_id,
        "completed_at": j.completed_at,
        "estimated_duration": j.estimated_duration,
    } for j in completed_jobs]

    # Skills
    skills = db.query(EmployeeSkill).filter(EmployeeSkill.employee_id == emp.id).all()
    skills_data = [{"id": s.id, "skill_name": s.skill_name, "level": s.level} for s in skills]

    # Shifts
    shifts = db.query(EmployeeShift).filter(EmployeeShift.employee_id == emp.id).all()
    shifts_data = [{
        "id": s.id,
        "start_time": s.start_time,
        "end_time": s.end_time,
        "is_active": s.is_active,
    } for s in shifts]

    # Attendance (recent 10)
    attendance = db.query(EmployeeAttendance).filter(
        EmployeeAttendance.employee_id == emp.id
    ).order_by(EmployeeAttendance.date.desc()).limit(10).all()

    attendance_data = [{
        "id": a.id,
        "date": a.date,
        "check_in": a.check_in,
        "check_out": a.check_out,
        "status": a.status,
        "working_hours": a.working_hours,
        "notes": a.notes,
    } for a in attendance]

    # Performance
    perf = db.query(EmployeePerformance).filter(
        EmployeePerformance.employee_id == emp.id
    ).order_by(EmployeePerformance.id.desc()).first()

    perf_data = {
        "jobs_completed": perf.jobs_completed if perf else len(completed_jobs),
        "jobs_rejected": perf.jobs_rejected if perf else 0,
        "on_time_rate": perf.on_time_rate if perf else 1.0,
        "accuracy": perf.accuracy if perf else 1.0,
        "overtime_hours": perf.overtime_hours if perf else 0.0,
    }

    # Salary Rule & Records
    salary_rule = db.query(SalaryRule).filter(
        SalaryRule.company_id == current_user.company_id,
        SalaryRule.role_type == emp.role_type,
    ).first()

    salary_rule_data = {
        "salary_model": salary_rule.salary_model if salary_rule else "FIXED",
        "base_salary": salary_rule.base_salary if salary_rule else 0.0,
        "picking_rate": salary_rule.picking_rate if salary_rule else 0.0,
        "packing_rate": salary_rule.packing_rate if salary_rule else 0.0,
        "delivery_rate": salary_rule.delivery_rate if salary_rule else 0.0,
        "overtime_rate": salary_rule.overtime_rate if salary_rule else 0.0,
    } if salary_rule else None

    salary_records = db.query(SalaryRecord).filter(
        SalaryRecord.employee_id == emp.id
    ).order_by(SalaryRecord.period.desc()).limit(6).all()

    salary_records_data = [{
        "id": r.id,
        "period": r.period,
        "base_amount": r.base_amount,
        "piece_rate_amount": r.piece_rate_amount,
        "adjustments": r.adjustments,
        "total_amount": r.total_amount,
        "status": r.status,
        "created_at": r.created_at,
    } for r in salary_records]

    return {
        "employee": {
            "id": emp.id,
            "company_id": emp.company_id,
            "first_name": emp.first_name,
            "last_name": emp.last_name,
            "role_type": emp.role_type,
            "status": emp.status or "ACTIVE",
            "employee_code": emp.employee_code or f"EMP-{emp.id:04d}",
            "email": emp.user.email if emp.user else None,
            "warehouse_id": emp.warehouse_id,
            "warehouse_name": emp.warehouse.name if emp.warehouse else "Unassigned",
            "current_workload": emp.current_workload or 0.0,
            "created_at": emp.created_at,
        },
        "performance": perf_data,
        "skills": skills_data,
        "shifts": shifts_data,
        "attendance": attendance_data,
        "active_jobs": active_jobs_data,
        "completed_jobs": completed_jobs_data,
        "salary_rule": salary_rule_data,
        "salary_records": salary_records_data,
    }


@router.put("/{emp_id}", response_model=EmployeeResponse)
def update_employee(
    emp_id: int,
    employee: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_manager),
):
    db_emp = db.query(Employee).filter(
        Employee.id == emp_id,
        Employee.company_id == current_user.company_id,
    ).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    update_data = employee.model_dump(exclude_unset=True)

    # If deactivating, ensure no unresolved active jobs
    if update_data.get("status") == "INACTIVE" and db_emp.status != "INACTIVE":
        active_jobs = db.query(Job).filter(
            Job.employee_id == emp_id,
            Job.company_id == current_user.company_id,
            Job.status.in_(["ASSIGNED", "ACCEPTED", "STARTED"]),
        ).all()
        if active_jobs:
            job_ids = [str(j.id) for j in active_jobs[:3]]
            raise HTTPException(
                status_code=400,
                detail=f"Cannot deactivate employee with {len(active_jobs)} active job(s) (#{', #'.join(job_ids)}). Please reassign or complete them first."
            )

    # Validate warehouse assignment if updated
    if "warehouse_id" in update_data and update_data["warehouse_id"] is not None:
        wh = db.query(Warehouse).filter(
            Warehouse.id == update_data["warehouse_id"],
            Warehouse.company_id == current_user.company_id,
        ).first()
        if not wh:
            raise HTTPException(status_code=400, detail="Invalid warehouse ID for your company")

    for key, value in update_data.items():
        setattr(db_emp, key, value)

    # Sync linked user is_active flag with employee status
    if "status" in update_data and db_emp.user:
        db_emp.user.is_active = (update_data["status"] == "ACTIVE")

    db.commit()
    db.refresh(db_emp)

    active_count = db.query(Job).filter(
        Job.employee_id == db_emp.id,
        Job.company_id == current_user.company_id,
        Job.status.in_(["ASSIGNED", "ACCEPTED", "STARTED"]),
    ).count()

    completed_count = db.query(Job).filter(
        Job.employee_id == db_emp.id,
        Job.company_id == current_user.company_id,
        Job.status == "COMPLETED",
    ).count()

    current_period = datetime.now(timezone.utc).strftime("%Y-%m")
    sal_rec = db.query(SalaryRecord).filter(
        SalaryRecord.employee_id == db_emp.id,
        SalaryRecord.period == current_period,
    ).first()

    return EmployeeResponse(
        id=db_emp.id,
        company_id=db_emp.company_id,
        first_name=db_emp.first_name,
        last_name=db_emp.last_name,
        role_type=db_emp.role_type,
        status=db_emp.status or "ACTIVE",
        user_id=db_emp.user_id,
        warehouse_id=db_emp.warehouse_id,
        employee_code=db_emp.employee_code or f"EMP-{db_emp.id:04d}",
        current_workload=db_emp.current_workload or 0.0,
        email=db_emp.user.email if db_emp.user else None,
        warehouse_name=db_emp.warehouse.name if db_emp.warehouse else None,
        active_jobs_count=active_count,
        completed_jobs_count=completed_count,
        accuracy=1.0,
        on_time_rate=1.0,
        salary_status=sal_rec.status if sal_rec else "UNBILLED",
        created_at=db_emp.created_at or datetime.now(timezone.utc),
    )


@router.post("/{emp_id}/deactivate")
def deactivate_employee(
    emp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_manager),
):
    db_emp = db.query(Employee).filter(
        Employee.id == emp_id,
        Employee.company_id == current_user.company_id,
    ).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    active_jobs = db.query(Job).filter(
        Job.employee_id == emp_id,
        Job.company_id == current_user.company_id,
        Job.status.in_(["ASSIGNED", "ACCEPTED", "STARTED"]),
    ).all()
    if active_jobs:
        job_ids = [str(j.id) for j in active_jobs[:3]]
        raise HTTPException(
            status_code=400,
            detail=f"Cannot deactivate employee with {len(active_jobs)} active job(s) (#{', #'.join(job_ids)}). Please reassign them before deactivating."
        )

    db_emp.status = "INACTIVE"
    if db_emp.user:
        db_emp.user.is_active = False
    db.commit()
    return {"status": "success", "message": f"Employee {db_emp.first_name} {db_emp.last_name} deactivated"}


@router.post("/{emp_id}/activate")
def activate_employee(
    emp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_manager),
):
    db_emp = db.query(Employee).filter(
        Employee.id == emp_id,
        Employee.company_id == current_user.company_id,
    ).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    db_emp.status = "ACTIVE"
    if db_emp.user:
        db_emp.user.is_active = True
    db.commit()
    return {"status": "success", "message": f"Employee {db_emp.first_name} {db_emp.last_name} activated"}


@router.post("/{emp_id}/assign-warehouse")
def assign_warehouse(
    emp_id: int,
    warehouse_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_manager),
):
    db_emp = db.query(Employee).filter(
        Employee.id == emp_id,
        Employee.company_id == current_user.company_id,
    ).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    wh = db.query(Warehouse).filter(
        Warehouse.id == warehouse_id,
        Warehouse.company_id == current_user.company_id,
    ).first()
    if not wh:
        raise HTTPException(status_code=400, detail="Invalid warehouse for your company")

    db_emp.warehouse_id = warehouse_id
    db.commit()
    return {"status": "success", "warehouse_id": warehouse_id, "warehouse_name": wh.name}


# --- SKILLS MANAGEMENT ---

@router.post("/{emp_id}/skills")
def add_employee_skill(
    emp_id: int,
    skill_name: str = Query(...),
    level: int = Query(1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_manager),
):
    db_emp = db.query(Employee).filter(
        Employee.id == emp_id,
        Employee.company_id == current_user.company_id,
    ).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    clean_name = skill_name.strip().upper()
    existing = db.query(EmployeeSkill).filter(
        EmployeeSkill.employee_id == emp_id,
        EmployeeSkill.skill_name == clean_name,
    ).first()
    if existing:
        existing.level = level
        db.commit()
        return {"id": existing.id, "skill_name": existing.skill_name, "level": existing.level}

    skill = EmployeeSkill(employee_id=emp_id, skill_name=clean_name, level=level)
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return {"id": skill.id, "skill_name": skill.skill_name, "level": skill.level}


@router.delete("/{emp_id}/skills/{skill_id}")
def delete_employee_skill(
    emp_id: int,
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_manager),
):
    db_emp = db.query(Employee).filter(
        Employee.id == emp_id,
        Employee.company_id == current_user.company_id,
    ).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    skill = db.query(EmployeeSkill).filter(
        EmployeeSkill.id == skill_id,
        EmployeeSkill.employee_id == emp_id,
    ).first()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")

    db.delete(skill)
    db.commit()
    return {"status": "success"}


# --- WORKLOAD ---

@router.post("/{emp_id}/calculate_workload")
def calculate_workload(
    emp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    db_emp = db.query(Employee).filter(
        Employee.id == emp_id,
        Employee.company_id == current_user.company_id,
    ).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    active_jobs = db.query(Job).filter(
        Job.employee_id == emp_id,
        Job.company_id == current_user.company_id,
        Job.status.in_(["ASSIGNED", "ACCEPTED", "STARTED"]),
    ).all()

    total_minutes = sum(j.estimated_duration for j in active_jobs if j.estimated_duration)
    db_emp.current_workload = float(total_minutes)
    db.commit()

    return {"status": "success", "workload_minutes": total_minutes}


# --- SHIFTS ---

@router.get("/{emp_id}/shifts", response_model=List[ShiftResponse])
def get_employee_shifts(
    emp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    db_emp = db.query(Employee).filter(
        Employee.id == emp_id,
        Employee.company_id == current_user.company_id,
    ).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return db.query(EmployeeShift).filter(EmployeeShift.employee_id == emp_id).all()


@router.post("/{emp_id}/shifts", response_model=ShiftResponse, status_code=201)
def create_shift(
    emp_id: int,
    shift: ShiftCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_manager),
):
    db_emp = db.query(Employee).filter(
        Employee.id == emp_id,
        Employee.company_id == current_user.company_id,
    ).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    overlapping = db.query(EmployeeShift).filter(
        EmployeeShift.employee_id == emp_id,
        EmployeeShift.is_active == True,
        EmployeeShift.start_time < shift.end_time,
        EmployeeShift.end_time > shift.start_time,
    ).first()

    if overlapping:
        raise HTTPException(status_code=400, detail="Shift overlaps with an existing shift")

    db_shift = EmployeeShift(**shift.model_dump())
    db_shift.employee_id = emp_id
    db.add(db_shift)
    db.commit()
    db.refresh(db_shift)
    return db_shift


# --- IMPORT EMPLOYEES ---

@router.post("/import", status_code=200)
async def import_employees(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_manager),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    content = await file.read()
    try:
        decoded = content.decode("utf-8-sig")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file encoding")

    raw_reader = csv.DictReader(io.StringIO(decoded))
    if not raw_reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file is empty or missing headers")

    field_map = {col.strip().lower(): col for col in raw_reader.fieldnames if col}
    fn_col = field_map.get("first_name") or field_map.get("firstname") or field_map.get("name")
    ln_col = field_map.get("last_name") or field_map.get("lastname")
    email_col = field_map.get("email") or field_map.get("email_address")
    role_col = field_map.get("role") or field_map.get("role_type") or field_map.get("role_name")
    skills_col = field_map.get("skills") or field_map.get("skill")

    if not fn_col:
        raise HTTPException(status_code=400, detail="Missing required column: must include first_name")

    count = 0
    errors = []

    for row_num, raw_row in enumerate(raw_reader, start=1):
        try:
            r = {k.strip().lower(): v for k, v in raw_row.items() if k}
            first_name = (r.get(fn_col.strip().lower()) or "").strip()
            last_name = (r.get(ln_col.strip().lower()) or "").strip() if ln_col else ""

            if not last_name and " " in first_name:
                parts = first_name.split(" ", 1)
                first_name = parts[0]
                last_name = parts[1]

            if not last_name:
                last_name = "Team"

            email = (r.get(email_col.strip().lower()) or "").strip() if email_col else ""
            if not email:
                clean_fn = "".join(c for c in first_name if c.isalnum()).lower()
                clean_ln = "".join(c for c in last_name if c.isalnum()).lower()
                email = f"{clean_fn}.{clean_ln}@wareflow.demo"

            if email.startswith("["):
                import re
                m = re.search(r"\[(.*?)\]", email)
                if m:
                    email = m.group(1).strip()

            role_type = (r.get(role_col.strip().lower()) or "EMPLOYEE").strip().upper() if role_col else "EMPLOYEE"
            skills_str = (r.get(skills_col.strip().lower()) or "WAREHOUSE").strip() if skills_col else "WAREHOUSE"

            if not first_name:
                errors.append(f"Row {row_num}: Missing first name")
                continue

            if role_type not in ["ADMIN", "MANAGER", "EMPLOYEE", "WAREHOUSE", "STORAGE", "PICKING", "PACKING", "DELIVERY"]:
                role_type = "EMPLOYEE"

            user_role = "EMPLOYEE"
            if role_type in ["ADMIN", "MANAGER"]:
                user_role = role_type

            existing_user = db.query(User).filter(User.email == email).first()
            user_id = None

            if existing_user:
                if existing_user.company_id != current_user.company_id:
                    errors.append(f"Row {row_num}: Email {email} already belongs to another company")
                    continue
                user_id = existing_user.id
            else:
                new_user = User(
                    company_id=current_user.company_id,
                    email=email,
                    hashed_password=get_password_hash("password123"),
                    role=user_role,
                    is_active=True,
                    setup_completed=True,
                )
                db.add(new_user)
                db.flush()
                user_id = new_user.id

            exists = db.query(Employee).filter_by(
                company_id=current_user.company_id,
                first_name=first_name,
                last_name=last_name,
            ).first()

            if exists:
                errors.append(f"Row {row_num}: Employee {first_name} {last_name} already exists")
                continue

            db_emp = Employee(
                company_id=current_user.company_id,
                user_id=user_id,
                first_name=first_name,
                last_name=last_name,
                role_type=role_type,
                status="ACTIVE",
            )
            db.add(db_emp)
            db.flush()
            db_emp.employee_code = f"EMP-{db_emp.id:04d}"

            if skills_str:
                skill_list = [s.strip() for s in skills_str.split(",") if s.strip()]
                for s in skill_list:
                    db_skill = EmployeeSkill(employee_id=db_emp.id, skill_name=s.upper(), level=1)
                    db.add(db_skill)

            count += 1
        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Database error during import: {str(e)}")

    return {"imported": count, "errors": errors, "skipped": len(errors)}


# --- AVAILABILITY ---

@router.post("/{emp_id}/availability", response_model=AvailabilityResponse)
def set_availability(
    emp_id: int,
    avail: AvailabilityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_manager),
):
    db_emp = db.query(Employee).filter(
        Employee.id == emp_id,
        Employee.company_id == current_user.company_id,
    ).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    db_avail = EmployeeAvailability(**avail.model_dump())
    db_avail.employee_id = emp_id
    db.add(db_avail)
    db.commit()
    db.refresh(db_avail)
    return db_avail


# --- EMPLOYEE SALARY BREAKDOWN & CALCULATION ---

@router.get("/{emp_id}/salary-breakdown")
def get_employee_salary_breakdown(
    emp_id: int,
    period: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_manager),
):
    if not period:
        period = datetime.now(timezone.utc).strftime("%Y-%m")

    db_emp = db.query(Employee).filter(
        Employee.id == emp_id,
        Employee.company_id == current_user.company_id,
    ).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    rule = db.query(SalaryRule).filter(
        SalaryRule.company_id == current_user.company_id,
        SalaryRule.role_type == db_emp.role_type,
    ).first()

    # Completed jobs for this period
    try:
        year, month = map(int, period.split("-"))
    except Exception:
        raise HTTPException(status_code=400, detail="Period must be in YYYY-MM format")

    jobs = db.query(Job).filter(
        Job.employee_id == emp_id,
        Job.status == "COMPLETED",
        Job.company_id == current_user.company_id,
    ).all()

    period_jobs = [
        j for j in jobs
        if j.completed_at and j.completed_at.year == year and j.completed_at.month == month
    ]

    picking_count = sum(1 for j in period_jobs if j.type == "PICKING")
    packing_count = sum(1 for j in period_jobs if j.type == "PACKING")
    delivery_count = sum(1 for j in period_jobs if j.type == "DELIVERY")
    other_count = len(period_jobs) - (picking_count + packing_count + delivery_count)

    base_salary = rule.base_salary if rule else 0.0
    salary_model = rule.salary_model if rule else "FIXED"

    piece_rate = 0.0
    if rule:
        piece_rate = (
            (picking_count * (rule.picking_rate or 0.0)) +
            (packing_count * (rule.packing_rate or 0.0)) +
            (delivery_count * (rule.delivery_rate or 0.0))
        )

    existing_record = db.query(SalaryRecord).filter(
        SalaryRecord.employee_id == emp_id,
        SalaryRecord.period == period,
    ).first()

    adjustments_list = []
    if existing_record:
        adjs = db.query(SalaryAdjustment).filter(
            SalaryAdjustment.salary_record_id == existing_record.id
        ).all()
        adjustments_list = [{"id": a.id, "amount": a.amount, "reason": a.reason, "created_at": a.created_at} for a in adjs]

    calculated_base = base_salary if salary_model == "FIXED" else 0.0
    calculated_piece = piece_rate if salary_model == "WORK_BASED" else 0.0
    total = (
        existing_record.total_amount if existing_record
        else (calculated_base + calculated_piece)
    )

    return {
        "employee_id": emp_id,
        "employee_name": f"{db_emp.first_name} {db_emp.last_name}",
        "employee_code": db_emp.employee_code,
        "role_type": db_emp.role_type,
        "period": period,
        "has_rule": rule is not None,
        "salary_model": salary_model,
        "base_salary": base_salary,
        "rates": {
            "picking": rule.picking_rate if rule else 0.0,
            "packing": rule.packing_rate if rule else 0.0,
            "delivery": rule.delivery_rate if rule else 0.0,
            "overtime": rule.overtime_rate if rule else 0.0,
        },
        "completed_jobs": {
            "total": len(period_jobs),
            "picking": picking_count,
            "packing": packing_count,
            "delivery": delivery_count,
            "other": other_count,
        },
        "piece_rate_earnings": round(piece_rate, 2),
        "existing_record": {
            "id": existing_record.id,
            "status": existing_record.status,
            "base_amount": existing_record.base_amount,
            "piece_rate_amount": existing_record.piece_rate_amount,
            "adjustments": existing_record.adjustments,
            "total_amount": existing_record.total_amount,
            "created_at": existing_record.created_at,
        } if existing_record else None,
        "adjustments": adjustments_list,
        "calculated_total": round(total, 2),
    }


@router.post("/{emp_id}/calculate-salary")
def calculate_salary(
    emp_id: int,
    period: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_manager),
):
    db_emp = db.query(Employee).filter(
        Employee.id == emp_id,
        Employee.company_id == current_user.company_id,
    ).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    existing = db.query(SalaryRecord).filter(
        SalaryRecord.employee_id == emp_id,
        SalaryRecord.period == period,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Salary record for this period already exists")

    rule = db.query(SalaryRule).filter(
        SalaryRule.company_id == current_user.company_id,
        SalaryRule.role_type == db_emp.role_type,
    ).first()
    if not rule:
        raise HTTPException(status_code=400, detail="No salary rule defined for this role")

    record = SalaryRecord(
        employee_id=emp_id,
        period=period,
        status="PENDING",
        base_amount=0.0,
        piece_rate_amount=0.0,
        overtime_amount=0.0,
        bonus=0.0,
        adjustments=0.0,
        total_amount=0.0,
    )

    if rule.salary_model == "FIXED":
        record.base_amount = rule.base_salary
        record.total_amount = record.base_amount
    elif rule.salary_model == "WORK_BASED":
        year, month = map(int, period.split("-"))
        jobs = db.query(Job).filter(
            Job.employee_id == emp_id,
            Job.status == "COMPLETED",
            Job.company_id == current_user.company_id,
        ).all()

        period_jobs = [
            j for j in jobs
            if j.completed_at and j.completed_at.year == year and j.completed_at.month == month
        ]

        picking = sum(1 for j in period_jobs if j.type == "PICKING")
        packing = sum(1 for j in period_jobs if j.type == "PACKING")
        delivery = sum(1 for j in period_jobs if j.type == "DELIVERY")

        record.piece_rate_amount = (
            (picking * (rule.picking_rate or 0.0)) +
            (packing * (rule.packing_rate or 0.0)) +
            (delivery * (rule.delivery_rate or 0.0))
        )
        record.total_amount = record.piece_rate_amount

    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.post("/{emp_id}/finalize-salary")
def finalize_salary(
    emp_id: int,
    period: str = Query(...),
    status: str = Query("FINALIZED"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_manager),
):
    db_emp = db.query(Employee).filter(
        Employee.id == emp_id,
        Employee.company_id == current_user.company_id,
    ).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    rule = db.query(SalaryRule).filter(
        SalaryRule.company_id == current_user.company_id,
        SalaryRule.role_type == db_emp.role_type,
    ).first()
    if not rule:
        raise HTTPException(status_code=400, detail="No salary rule defined for this role")

    record = db.query(SalaryRecord).filter(
        SalaryRecord.employee_id == emp_id,
        SalaryRecord.period == period,
    ).first()

    year, month = map(int, period.split("-"))
    jobs = db.query(Job).filter(
        Job.employee_id == emp_id,
        Job.status == "COMPLETED",
        Job.company_id == current_user.company_id,
    ).all()

    period_jobs = [
        j for j in jobs
        if j.completed_at and j.completed_at.year == year and j.completed_at.month == month
    ]

    picking = sum(1 for j in period_jobs if j.type == "PICKING")
    packing = sum(1 for j in period_jobs if j.type == "PACKING")
    delivery = sum(1 for j in period_jobs if j.type == "DELIVERY")

    base_amt = rule.base_salary if rule.salary_model == "FIXED" else 0.0
    piece_amt = (
        (picking * (rule.picking_rate or 0.0)) +
        (packing * (rule.packing_rate or 0.0)) +
        (delivery * (rule.delivery_rate or 0.0))
    ) if rule.salary_model == "WORK_BASED" else 0.0

    if not record:
        record = SalaryRecord(
            employee_id=emp_id,
            period=period,
            status=status.upper(),
            base_amount=base_amt,
            piece_rate_amount=piece_amt,
            overtime_amount=0.0,
            bonus=0.0,
            adjustments=0.0,
            total_amount=round(base_amt + piece_amt, 2),
        )
        db.add(record)
    else:
        record.base_amount = base_amt
        record.piece_rate_amount = piece_amt
        record.status = status.upper()
        record.total_amount = round(base_amt + piece_amt + (record.adjustments or 0.0) + (record.bonus or 0.0), 2)

    db.commit()
    db.refresh(record)
    return {
        "status": "success",
        "record_id": record.id,
        "employee_id": emp_id,
        "period": period,
        "salary_status": record.status,
        "total_amount": record.total_amount,
    }
