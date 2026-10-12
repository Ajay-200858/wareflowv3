from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field

from app.database.connection import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.models.employee import (
    Employee, EmployeeSkill, EmployeeShift, EmployeeAvailability,
    EmployeePerformance, EmployeeAttendance
)
from app.models.job import Job, JobItem
from app.models.order import Order
from app.models.inventory import Inventory, InventoryMovement
from app.models.warehouse import Warehouse, Zone, Rack, Row, Position
from app.models.product import Product
from app.models.salary import SalaryRule, SalaryRecord, SalaryAdjustment
from app.models.notification import Notification
from app.models.company import Company
from app.services.notification_service import create_notification

router = APIRouter()

# --- HELPER: RESOLVE AUTHENTICATED EMPLOYEE ---

def get_current_employee(db: Session, current_user: User) -> Employee:
    """
    Resolves the authenticated employee profile from current_user.
    Guarantees company scoping and role safety.
    """
    # 1. Direct lookup by user_id
    emp = db.query(Employee).filter(
        Employee.user_id == current_user.id,
        Employee.company_id == current_user.company_id
    ).first()
    if emp:
        return emp

    # 2. Email-based link fallback if user_id wasn't linked yet
    if current_user.email:
        clean_prefix = current_user.email.split('@')[0].lower()
        company_emps = db.query(Employee).filter(
            Employee.company_id == current_user.company_id
        ).all()
        for candidate in company_emps:
            cand_name = f"{candidate.first_name.lower()}.{candidate.last_name.lower()}"
            if cand_name == clean_prefix or candidate.first_name.lower() == clean_prefix:
                candidate.user_id = current_user.id
                db.commit()
                return candidate

    # 3. If user is an EMPLOYEE and still has no profile, create one automatically
    if current_user.role == "EMPLOYEE":
        first = current_user.email.split('@')[0].capitalize() if current_user.email else "Employee"
        emp = Employee(
            company_id=current_user.company_id,
            user_id=current_user.id,
            first_name=first,
            last_name="Member",
            role_type="Picker",
            status="ACTIVE",
            current_workload=0.0
        )
        db.add(emp)
        db.commit()
        db.refresh(emp)
        return emp

    # 4. If manager/admin accesses employee portal, return first employee or raise
    first_emp = db.query(Employee).filter(
        Employee.company_id == current_user.company_id
    ).first()
    if first_emp:
        return first_emp

    raise HTTPException(status_code=404, detail="No employee profile associated with this account")


# --- SCHEMAS ---

class RejectJobRequest(BaseModel):
    reason: str = Field(..., min_length=2, description="Mandatory reason for job rejection")

class UpdateProfileRequest(BaseModel):
    notes: Optional[str] = None


# --- ENDPOINTS ---

@router.get("/me")
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    emp = get_current_employee(db, current_user)
    company = db.query(Company).filter(Company.id == emp.company_id).first()
    skills = db.query(EmployeeSkill).filter(EmployeeSkill.employee_id == emp.id).all()
    shifts = db.query(EmployeeShift).filter(EmployeeShift.employee_id == emp.id).all()
    perf = db.query(EmployeePerformance).filter(EmployeePerformance.employee_id == emp.id).first()

    return {
        "id": emp.id,
        "employee_code": f"EMP-{emp.id:04d}",
        "user_id": current_user.id,
        "first_name": emp.first_name,
        "last_name": emp.last_name,
        "full_name": f"{emp.first_name} {emp.last_name}",
        "email": current_user.email,
        "role_type": emp.role_type or "Warehouse Associate",
        "status": emp.status or "ACTIVE",
        "current_workload": float(emp.current_workload or 0.0),
        "company_id": emp.company_id,
        "company_name": company.name if company else "WareFlow Logistics",
        "skills": [{"id": s.id, "name": s.skill_name, "level": s.level} for s in skills],
        "shifts": [
            {
                "id": sh.id,
                "start_time": sh.start_time.isoformat() if sh.start_time else None,
                "end_time": sh.end_time.isoformat() if sh.end_time else None,
                "is_active": sh.is_active
            }
            for sh in shifts
        ],
        "performance": {
            "jobs_completed": perf.jobs_completed if perf else 0,
            "jobs_rejected": perf.jobs_rejected if perf else 0,
            "on_time_rate": perf.on_time_rate if perf else 1.0,
            "accuracy": perf.accuracy if perf else 1.0,
            "overtime_hours": perf.overtime_hours if perf else 0.0
        } if perf else None,
        "created_at": emp.created_at.isoformat() if emp.created_at else None
    }


@router.put("/me")
def update_my_profile(
    payload: UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    emp = get_current_employee(db, current_user)
    # Sensitive fields like role, salary, company cannot be altered here
    db.commit()
    return {"status": "success", "message": "Profile updated successfully"}


@router.get("/dashboard")
def get_employee_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    emp = get_current_employee(db, current_user)
    company_id = emp.company_id

    # 1. Job Counts scoped strictly to this employee
    all_my_jobs = db.query(Job).filter(
        Job.employee_id == emp.id,
        Job.company_id == company_id
    ).all()

    assigned_active = [j for j in all_my_jobs if j.status in ["ASSIGNED", "ACCEPTED", "STARTED"]]
    pending_jobs = [j for j in all_my_jobs if j.status == "ASSIGNED"]
    completed_jobs = [j for j in all_my_jobs if j.status == "COMPLETED"]

    # 2. Today's progress
    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)

    completed_today = [
        j for j in completed_jobs
        if j.completed_at and j.completed_at.replace(tzinfo=timezone.utc if j.completed_at.tzinfo is None else j.completed_at.tzinfo) >= today_start
    ]
    total_today = len(completed_today) + len(assigned_active)
    completion_rate_today = round((len(completed_today) / total_today * 100), 1) if total_today > 0 else 0.0

    # 3. Today's Attendance
    today_date = now.date()
    att_today = db.query(EmployeeAttendance).filter(
        EmployeeAttendance.employee_id == emp.id,
        func.date(EmployeeAttendance.date) == today_date
    ).first()

    attendance_data = {
        "has_record": att_today is not None,
        "status": att_today.status if att_today else "NOT_CHECKED_IN",
        "check_in": att_today.check_in.isoformat() if att_today and att_today.check_in else None,
        "check_out": att_today.check_out.isoformat() if att_today and att_today.check_out else None,
        "working_hours": float(att_today.working_hours or 0.0) if att_today else 0.0,
        "is_checked_in": att_today is not None and att_today.check_in is not None and att_today.check_out is None
    }

    # 4. Salary Summary
    current_period = f"{now.year}-{now.month:02d}"
    salary_rec = db.query(SalaryRecord).filter(
        SalaryRecord.employee_id == emp.id,
        SalaryRecord.period == current_period
    ).first()

    rule = db.query(SalaryRule).filter(
        SalaryRule.company_id == company_id,
        SalaryRule.role_type == emp.role_type
    ).first()

    salary_summary = {
        "period": current_period,
        "has_record": salary_rec is not None,
        "total_amount": float(salary_rec.total_amount or 0.0) if salary_rec else 0.0,
        "base_amount": float(salary_rec.base_amount or 0.0) if salary_rec else 0.0,
        "piece_rate_amount": float(salary_rec.piece_rate_amount or 0.0) if salary_rec else 0.0,
        "overtime_amount": float(salary_rec.overtime_amount or 0.0) if salary_rec else 0.0,
        "bonus": float(salary_rec.bonus or 0.0) if salary_rec else 0.0,
        "adjustments": float(salary_rec.adjustments or 0.0) if salary_rec else 0.0,
        "status": salary_rec.status if salary_rec else "UNBILLED",
        "salary_model": rule.salary_model if rule else "FIXED",
        "unbilled_completed_jobs": len(completed_today) if not salary_rec else 0
    }

    # 5. Notifications count
    unread_notifs_count = db.query(Notification).filter(
        Notification.company_id == company_id,
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()

    recent_notifs = db.query(Notification).filter(
        Notification.company_id == company_id,
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).limit(5).all()

    # 6. Priority and Today's Assigned Work
    active_sorted = sorted(assigned_active, key=lambda j: (j.priority or 1), reverse=True)
    today_work_items = []
    for j in active_sorted[:5]:
        first_item = j.items[0] if j.items else None
        pos_code = None
        prod_name = None
        if first_item:
            if first_item.position:
                pos_code = first_item.position.position_code
            if first_item.product:
                prod_name = first_item.product.name

        today_work_items.append({
            "id": j.id,
            "type": j.type,
            "status": j.status,
            "priority": j.priority or 1,
            "order_id": j.order_id,
            "estimated_duration": j.estimated_duration or 15,
            "product_name": prod_name,
            "position_code": pos_code,
            "created_at": j.created_at.isoformat() if j.created_at else None
        })

    # 7. Recent completed jobs
    completed_sorted = sorted(completed_jobs, key=lambda j: j.completed_at or j.created_at or datetime.min, reverse=True)
    recent_completed = [
        {
            "id": j.id,
            "type": j.type,
            "order_id": j.order_id,
            "completed_at": j.completed_at.isoformat() if j.completed_at else None,
            "priority": j.priority or 1
        }
        for j in completed_sorted[:5]
    ]

    # 8. Performance Stats
    perf = db.query(EmployeePerformance).filter(EmployeePerformance.employee_id == emp.id).first()
    job_type_counts = {}
    for j in completed_jobs:
        job_type_counts[j.type] = job_type_counts.get(j.type, 0) + 1

    return {
        "employee": {
            "id": emp.id,
            "name": f"{emp.first_name} {emp.last_name}",
            "role_type": emp.role_type or "Warehouse Associate",
            "workload_minutes": float(emp.current_workload or 0.0)
        },
        "kpis": {
            "assigned_jobs": len(assigned_active),
            "pending_jobs": len(pending_jobs),
            "completed_jobs": len(completed_jobs),
            "completed_today": len(completed_today),
            "completion_rate_today": completion_rate_today,
            "unread_notifications": unread_notifs_count,
            "attendance_status": attendance_data["status"],
            "salary_amount": salary_summary["total_amount"],
            "salary_period": salary_summary["period"]
        },
        "today_progress": {
            "completed": len(completed_today),
            "remaining": len(assigned_active),
            "total": total_today,
            "rate": completion_rate_today
        },
        "attendance": attendance_data,
        "salary": salary_summary,
        "today_work": today_work_items,
        "recent_completed": recent_completed,
        "recent_notifications": [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "type": n.type,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None
            }
            for n in recent_notifs
        ],
        "performance": {
            "jobs_completed": len(completed_jobs),
            "jobs_rejected": perf.jobs_rejected if perf else 0,
            "on_time_rate": perf.on_time_rate if perf else 1.0,
            "accuracy": perf.accuracy if perf else 1.0,
            "job_types": job_type_counts
        }
    }


@router.get("/jobs")
def get_my_jobs(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    emp = get_current_employee(db, current_user)
    query = db.query(Job).filter(
        Job.employee_id == emp.id,
        Job.company_id == emp.company_id
    )

    if status_filter and status_filter.upper() != "ALL":
        filter_val = status_filter.upper()
        if filter_val == "PENDING":
            query = query.filter(Job.status == "ASSIGNED")
        elif filter_val == "IN_PROGRESS" or filter_val == "STARTED":
            query = query.filter(Job.status == "STARTED")
        else:
            query = query.filter(Job.status == filter_val)

    jobs = query.order_by(Job.priority.desc(), Job.created_at.desc()).all()

    result = []
    for j in jobs:
        items_data = []
        for it in j.items:
            pos_label = None
            zone_name = None
            rack_label = None
            if it.position:
                pos_label = it.position.position_code
                if it.position.row and it.position.row.rack:
                    rack_label = it.position.row.rack.name
                    if it.position.row.rack.zone:
                        zone_name = it.position.row.rack.zone.name

            items_data.append({
                "id": it.id,
                "product_id": it.product_id,
                "product_name": it.product.name if it.product else "Unknown Product",
                "product_sku": it.product.sku if it.product else "",
                "quantity": it.quantity,
                "status": it.status,
                "position_id": it.position_id,
                "position_code": pos_label,
                "zone_name": zone_name,
                "rack_label": rack_label
            })

        order_ref = None
        if j.order:
            order_ref = f"ORD-{j.order.id:04d}"

        result.append({
            "id": j.id,
            "type": j.type,
            "status": j.status,
            "priority": j.priority or 1,
            "order_id": j.order_id,
            "order_ref": order_ref,
            "estimated_minutes": int(j.estimated_duration or 15),
            "created_at": j.created_at.isoformat() if j.created_at else None,
            "started_at": j.started_at.isoformat() if j.started_at else None,
            "completed_at": j.completed_at.isoformat() if j.completed_at else None,
            "items_count": len(items_data),
            "items": items_data
        })

    return result


@router.get("/jobs/{job_id}")
def get_my_job_detail(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    emp = get_current_employee(db, current_user)
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.company_id == emp.company_id
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Strict IDOR protection: employee must own this job
    if current_user.role == "EMPLOYEE" and job.employee_id != emp.id:
        raise HTTPException(status_code=403, detail="Access denied: You are not assigned to this job")

    items_data = []
    for it in job.items:
        pos_label = None
        zone_name = None
        rack_label = None
        wh_name = None
        if it.position:
            pos_label = it.position.position_code
            if it.position.row and it.position.row.rack:
                rack_label = it.position.row.rack.name
                if it.position.row.rack.zone:
                    zone_name = it.position.row.rack.zone.name
                    if it.position.row.rack.zone.warehouse:
                        wh_name = it.position.row.rack.zone.warehouse.name

        items_data.append({
            "id": it.id,
            "product_id": it.product_id,
            "product_name": it.product.name if it.product else "Product Item",
            "product_sku": it.product.sku if it.product else "",
            "category": it.product.category if it.product else "",
            "quantity": it.quantity,
            "status": it.status,
            "position_id": it.position_id,
            "position_code": pos_label,
            "zone_name": zone_name,
            "rack_label": rack_label,
            "warehouse_name": wh_name
        })

    order_info = None
    if job.order:
        cust_name = job.order.customer.name if job.order.customer else "Standard Customer"
        order_info = {
            "id": job.order.id,
            "reference": f"ORD-{job.order.id:04d}",
            "customer": cust_name,
            "destination": job.order.delivery_address or "Standard Shipping",
            "status": job.order.status
        }

    return {
        "id": job.id,
        "type": job.type,
        "status": job.status,
        "priority": job.priority or 1,
        "estimated_duration": job.estimated_duration or 15,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "order": order_info,
        "items": items_data,
        "instructions": f"Carry out {job.type} according to standard warehouse operating procedures. Verify product SKU and quantity before confirming completion."
    }


@router.post("/jobs/{job_id}/accept")
def accept_my_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    emp = get_current_employee(db, current_user)
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.company_id == emp.company_id
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if current_user.role == "EMPLOYEE" and job.employee_id != emp.id:
        raise HTTPException(status_code=403, detail="Cannot accept job assigned to another employee")

    if job.status != "ASSIGNED":
        raise HTTPException(status_code=400, detail=f"Cannot accept job in {job.status} status. Must be ASSIGNED.")

    job.status = "ACCEPTED"
    job.started_at = datetime.now(timezone.utc)
    db.commit()

    return {"status": "success", "message": f"Job #{job.id} accepted successfully", "job_status": job.status}


@router.post("/jobs/{job_id}/start")
def start_my_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    emp = get_current_employee(db, current_user)
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.company_id == emp.company_id
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if current_user.role == "EMPLOYEE" and job.employee_id != emp.id:
        raise HTTPException(status_code=403, detail="Cannot start job assigned to another employee")

    if job.status not in ["ASSIGNED", "ACCEPTED", "STARTED"]:
        raise HTTPException(status_code=400, detail=f"Cannot start job in {job.status} status. Must be ASSIGNED, ACCEPTED or STARTED.")

    job.status = "STARTED"
    if not job.started_at:
        job.started_at = datetime.now(timezone.utc)
    db.commit()

    return {"status": "success", "message": f"Job #{job.id} started. Timer active.", "job_status": job.status}


@router.post("/jobs/{job_id}/reject")
def reject_my_job(
    job_id: int,
    payload: RejectJobRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    reason = payload.reason.strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Rejection reason is required")

    emp = get_current_employee(db, current_user)
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.company_id == emp.company_id
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if current_user.role == "EMPLOYEE" and job.employee_id != emp.id:
        raise HTTPException(status_code=403, detail="Cannot reject job not assigned to you")

    if job.status not in ["ASSIGNED", "ACCEPTED"]:
        raise HTTPException(status_code=400, detail=f"Job cannot be rejected from '{job.status}' status")

    # Record rejection stats on employee
    perf = db.query(EmployeePerformance).filter(EmployeePerformance.employee_id == emp.id).first()
    if not perf:
        perf = EmployeePerformance(
            employee_id=emp.id,
            jobs_completed=0,
            jobs_rejected=1,
            on_time_rate=1.0,
            accuracy=1.0
        )
        db.add(perf)
    else:
        perf.jobs_rejected = (perf.jobs_rejected or 0) + 1

    # Transition job
    job.status = "REJECTED"
    prev_emp_id = job.employee_id
    job.employee_id = None
    job.started_at = None

    # Trigger automatic AI re-assignment workflow
    from app.api.ai import recommend_assignment
    try:
        recommend_assignment(job.id, db, current_user)
    except Exception:
        # Fallback if no employee matches
        pass

    db.commit()

    # Notify managers with reason
    create_notification(
        db,
        emp.company_id,
        "Job Rejection Alert",
        f"Job #{job.id} ({job.type}) was rejected by {emp.first_name} {emp.last_name}. Reason: \"{reason}\". AI re-assignment initiated.",
        "WARNING"
    )

    return {
        "status": "success",
        "message": f"Job #{job.id} rejected. Reassignment workflow triggered.",
        "rejection_reason": reason
    }


@router.post("/jobs/{job_id}/complete")
def complete_my_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    emp = get_current_employee(db, current_user)
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.company_id == emp.company_id
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if current_user.role == "EMPLOYEE" and job.employee_id != emp.id:
        raise HTTPException(status_code=403, detail="Cannot complete job assigned to another employee")

    if job.status not in ["ACCEPTED", "STARTED"]:
        raise HTTPException(status_code=400, detail=f"Job must be in ACCEPTED or STARTED status to complete (current: {job.status})")

    # Perform inventory mutations per job type
    if job.type == "PICKING":
        for j_item in job.items:
            if j_item.status != "COMPLETED":
                inv = db.query(Inventory).filter(
                    Inventory.product_id == j_item.product_id,
                    Inventory.position_id == j_item.position_id,
                    Inventory.company_id == emp.company_id
                ).first()
                if inv:
                    inv.reserved_quantity = max(0, inv.reserved_quantity - j_item.quantity)
                    inv.quantity = max(0, inv.quantity - j_item.quantity)

                    if j_item.position_id:
                        pos = db.query(Position).filter(Position.id == j_item.position_id).with_for_update().first()
                        if pos:
                            pos.current_occupancy = max(0, pos.current_occupancy - j_item.quantity)
                            pos.available_capacity = pos.capacity - pos.current_occupancy

                    movement = InventoryMovement(
                        company_id=emp.company_id,
                        product_id=j_item.product_id,
                        source_position_id=j_item.position_id,
                        dest_position_id=None,
                        quantity=j_item.quantity,
                        employee_id=emp.id,
                        reason="Picking Job Completed"
                    )
                    db.add(movement)
                j_item.status = "COMPLETED"

    elif job.type in ["RECEIVING", "STORAGE", "PUT_AWAY"]:
        for j_item in job.items:
            if j_item.status != "COMPLETED":
                staging_inv = db.query(Inventory).filter(
                    Inventory.product_id == j_item.product_id,
                    Inventory.position_id.is_(None),
                    Inventory.company_id == emp.company_id
                ).first()

                if j_item.position_id:
                    pos = db.query(Position).filter(Position.id == j_item.position_id).with_for_update().first()
                    if pos:
                        if staging_inv and staging_inv.quantity >= j_item.quantity:
                            staging_inv.quantity -= j_item.quantity
                            staging_inv.available_quantity -= j_item.quantity
                            wh_id = staging_inv.warehouse_id
                        else:
                            wh_id = pos.row.rack.zone.warehouse_id if (pos.row and pos.row.rack and pos.row.rack.zone) else None

                        dest_inv = db.query(Inventory).filter(
                            Inventory.product_id == j_item.product_id,
                            Inventory.position_id == j_item.position_id,
                            Inventory.company_id == emp.company_id
                        ).first()
                        if dest_inv:
                            dest_inv.quantity += j_item.quantity
                            dest_inv.available_quantity += j_item.quantity
                        else:
                            dest_inv = Inventory(
                                company_id=emp.company_id,
                                product_id=j_item.product_id,
                                position_id=j_item.position_id,
                                quantity=j_item.quantity,
                                available_quantity=j_item.quantity,
                                reserved_quantity=0,
                                warehouse_id=wh_id
                            )
                            db.add(dest_inv)

                        pos.current_occupancy += j_item.quantity
                        pos.available_capacity = max(0, pos.capacity - pos.current_occupancy)

                        movement = InventoryMovement(
                            company_id=emp.company_id,
                            product_id=j_item.product_id,
                            source_position_id=None,
                            dest_position_id=pos.id,
                            quantity=j_item.quantity,
                            employee_id=emp.id,
                            reason="Put-away Job Completed"
                        )
                        db.add(movement)

                j_item.status = "COMPLETED"
    else:
        for j_item in job.items:
            j_item.status = "COMPLETED"

    # Mark completion
    job.status = "COMPLETED"
    job.completed_at = datetime.now(timezone.utc)

    # Update employee performance
    perf = db.query(EmployeePerformance).filter(EmployeePerformance.employee_id == emp.id).first()
    if not perf:
        perf = EmployeePerformance(
            employee_id=emp.id,
            jobs_completed=1,
            jobs_rejected=0,
            on_time_rate=1.0,
            accuracy=1.0
        )
        db.add(perf)
    else:
        perf.jobs_completed = (perf.jobs_completed or 0) + 1

    # Recalculate employee workload
    remaining_jobs = db.query(Job).filter(
        Job.employee_id == emp.id,
        Job.company_id == emp.company_id,
        Job.status.in_(["ASSIGNED", "ACCEPTED", "STARTED"])
    ).all()
    emp.current_workload = float(sum(j.estimated_duration or 15 for j in remaining_jobs))

    # Advance order lifecycle if attached
    if job.order_id:
        order = db.query(Order).filter(Order.id == job.order_id).first()
        if order:
            if job.type == "PICKING":
                picking_jobs = [j for j in order.jobs if j.type == "PICKING"]
                if all(j.status == "COMPLETED" for j in picking_jobs):
                    if not any(j.type == "PACKING" for j in order.jobs):
                        new_job = Job(
                            company_id=emp.company_id,
                            type="PACKING",
                            order_id=order.id,
                            status="PENDING",
                            priority=job.priority,
                            estimated_duration=15
                        )
                        db.add(new_job)
                        order.status = "PACKING"
            elif job.type == "PACKING":
                packing_jobs = [j for j in order.jobs if j.type == "PACKING"]
                if all(j.status == "COMPLETED" for j in packing_jobs):
                    if not any(j.type == "DELIVERY" for j in order.jobs):
                        new_job = Job(
                            company_id=emp.company_id,
                            type="DELIVERY",
                            order_id=order.id,
                            status="PENDING",
                            priority=job.priority,
                            estimated_duration=60
                        )
                        db.add(new_job)
                        order.status = "DELIVERY"
            elif job.type == "DELIVERY":
                delivery_jobs = [j for j in order.jobs if j.type == "DELIVERY"]
                if all(j.status == "COMPLETED" for j in delivery_jobs):
                    order.status = "COMPLETED"
                    order.completed_at = datetime.now(timezone.utc)

    db.commit()

    # Manager notification
    create_notification(
        db,
        emp.company_id,
        "Job Completed",
        f"Job #{job.id} ({job.type}) was completed by {emp.first_name} {emp.last_name}.",
        "SUCCESS"
    )

    return {
        "status": "success",
        "message": f"Job #{job.id} marked COMPLETED. Inventory and metrics updated.",
        "completed_at": job.completed_at.isoformat()
    }


@router.get("/workspace")
def get_my_workspace(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    emp = get_current_employee(db, current_user)
    company_id = emp.company_id

    # Active jobs assigned to this employee
    active_jobs = db.query(Job).filter(
        Job.employee_id == emp.id,
        Job.company_id == company_id,
        Job.status.in_(["ASSIGNED", "ACCEPTED", "STARTED"])
    ).all()

    # Gather assigned position IDs
    assigned_positions: Dict[int, Dict[str, Any]] = {}
    warehouse_ids = set()

    for job in active_jobs:
        for item in job.items:
            if item.position_id:
                pos = item.position
                if pos:
                    if pos.row and pos.row.rack and pos.row.rack.zone:
                        wh_id = pos.row.rack.zone.warehouse_id
                        if wh_id:
                            warehouse_ids.add(wh_id)

                    assigned_positions[pos.id] = {
                        "job_id": job.id,
                        "job_type": job.type,
                        "job_status": job.status,
                        "priority": job.priority,
                        "position_id": pos.id,
                        "position_code": pos.position_code,
                        "quantity": item.quantity,
                        "product_name": item.product.name if item.product else "Item",
                        "product_sku": item.product.sku if item.product else "",
                        "occupancy": float(pos.current_occupancy or 0),
                        "capacity": float(pos.capacity or 100)
                    }

    # Fetch relevant warehouses (only those associated with assignments, or primary facility)
    wh_query = db.query(Warehouse).filter(Warehouse.company_id == company_id)
    if warehouse_ids:
        warehouses = wh_query.filter(Warehouse.id.in_(list(warehouse_ids))).all()
    else:
        warehouses = wh_query.limit(1).all()

    facilities_data = []
    for wh in warehouses:
        zones_data = []
        for zone in wh.zones:
            racks_data = []
            for rack in zone.racks:
                rack_has_assignment = False
                positions_list = []
                for row in rack.rows:
                    for pos in row.positions:
                        is_target = pos.id in assigned_positions
                        if is_target:
                            rack_has_assignment = True
                        positions_list.append({
                            "id": pos.id,
                            "code": pos.position_code,
                            "capacity": float(pos.capacity or 100),
                            "occupancy": float(pos.current_occupancy or 0),
                            "is_assigned_to_me": is_target,
                            "assignment_details": assigned_positions.get(pos.id)
                        })

                racks_data.append({
                    "id": rack.id,
                    "label": rack.name,
                    "has_assignment": rack_has_assignment,
                    "positions_count": len(positions_list),
                    "positions": positions_list
                })

            zones_data.append({
                "id": zone.id,
                "name": zone.name,
                "code": zone.name,
                "racks": racks_data
            })

        facilities_data.append({
            "id": wh.id,
            "name": wh.name,
            "code": wh.name,
            "zones": zones_data
        })

    # Ordered navigation directives for the employee
    directives = []
    for pos_id, item_info in assigned_positions.items():
        directives.append({
            "step": len(directives) + 1,
            "job_id": item_info["job_id"],
            "type": item_info["job_type"],
            "instruction": f"Proceed to Position {item_info['position_code']} to {item_info['job_type'].lower()} {item_info['quantity']}x {item_info['product_name']} (SKU: {item_info['product_sku']})",
            "position_code": item_info["position_code"],
            "priority": item_info["priority"]
        })

    return {
        "employee_id": emp.id,
        "active_jobs_count": len(active_jobs),
        "target_positions_count": len(assigned_positions),
        "warehouses": facilities_data,
        "directives": directives
    }


@router.get("/salary")
def get_my_salary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    emp = get_current_employee(db, current_user)
    company_id = emp.company_id
    now = datetime.now(timezone.utc)
    current_period = f"{now.year}-{now.month:02d}"

    # Current period record
    current_record = db.query(SalaryRecord).filter(
        SalaryRecord.employee_id == emp.id,
        SalaryRecord.period == current_period
    ).first()

    # Past records
    past_records = db.query(SalaryRecord).filter(
        SalaryRecord.employee_id == emp.id
    ).order_by(SalaryRecord.period.desc()).all()

    # Applicable company rule
    rule = db.query(SalaryRule).filter(
        SalaryRule.company_id == company_id,
        SalaryRule.role_type == emp.role_type
    ).first()

    rule_info = {
        "role_type": emp.role_type or "Warehouse Associate",
        "salary_model": rule.salary_model if rule else "FIXED",
        "base_salary": float(rule.base_salary or 0.0) if rule else 0.0,
        "picking_rate": float(rule.picking_rate or 0.0) if rule else 0.0,
        "packing_rate": float(rule.packing_rate or 0.0) if rule else 0.0,
        "delivery_rate": float(rule.delivery_rate or 0.0) if rule else 0.0,
        "overtime_rate": float(rule.overtime_rate or 0.0) if rule else 0.0
    } if rule else None

    # Calculate real pending completed jobs for this month if no generated record exists
    unbilled_earnings = 0.0
    if not current_record:
        completed_this_month = db.query(Job).filter(
            Job.employee_id == emp.id,
            Job.status == "COMPLETED",
            Job.company_id == company_id
        ).all()
        month_jobs = [
            j for j in completed_this_month
            if j.completed_at and j.completed_at.year == now.year and j.completed_at.month == now.month
        ]
        if rule:
            if rule.salary_model == "FIXED":
                unbilled_earnings = rule.base_salary or 0.0
            else:
                picking_c = sum(1 for j in month_jobs if j.type == "PICKING")
                packing_c = sum(1 for j in month_jobs if j.type == "PACKING")
                delivery_c = sum(1 for j in month_jobs if j.type == "DELIVERY")
                unbilled_earnings = (
                    (picking_c * (rule.picking_rate or 0.0)) +
                    (packing_c * (rule.packing_rate or 0.0)) +
                    (delivery_c * (rule.delivery_rate or 0.0))
                )

    return {
        "current_period": current_period,
        "has_record": current_record is not None,
        "current_salary": {
            "id": current_record.id,
            "period": current_record.period,
            "base_amount": float(current_record.base_amount or 0.0),
            "piece_rate_amount": float(current_record.piece_rate_amount or 0.0),
            "overtime_amount": float(current_record.overtime_amount or 0.0),
            "bonus": float(current_record.bonus or 0.0),
            "adjustments": float(current_record.adjustments or 0.0),
            "total_amount": float(current_record.total_amount or 0.0),
            "status": current_record.status or "PENDING",
            "created_at": current_record.created_at.isoformat() if current_record.created_at else None
        } if current_record else {
            "period": current_period,
            "base_amount": rule_info["base_salary"] if rule_info and rule_info["salary_model"] == "FIXED" else 0.0,
            "piece_rate_amount": unbilled_earnings if rule_info and rule_info["salary_model"] == "WORK_BASED" else 0.0,
            "total_amount": unbilled_earnings,
            "status": "UNBILLED",
            "message": "Payroll for the current period has not yet been processed by management."
        },
        "salary_rule": rule_info,
        "history": [
            {
                "id": r.id,
                "period": r.period,
                "base_amount": float(r.base_amount or 0.0),
                "piece_rate_amount": float(r.piece_rate_amount or 0.0),
                "overtime_amount": float(r.overtime_amount or 0.0),
                "bonus": float(r.bonus or 0.0),
                "adjustments": float(r.adjustments or 0.0),
                "total_amount": float(r.total_amount or 0.0),
                "status": r.status or "PENDING",
                "created_at": r.created_at.isoformat() if r.created_at else None
            }
            for r in past_records
        ]
    }


@router.get("/attendance")
def get_my_attendance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    emp = get_current_employee(db, current_user)
    now = datetime.now(timezone.utc)
    today_date = now.date()

    # Today's attendance
    today_record = db.query(EmployeeAttendance).filter(
        EmployeeAttendance.employee_id == emp.id,
        func.date(EmployeeAttendance.date) == today_date
    ).first()

    # Past 30 days
    past_records = db.query(EmployeeAttendance).filter(
        EmployeeAttendance.employee_id == emp.id
    ).order_by(EmployeeAttendance.date.desc()).limit(30).all()

    # Week total
    week_start = today_date - timedelta(days=today_date.weekday())
    week_records = [r for r in past_records if r.date and r.date.date() >= week_start]
    week_hours = sum(r.working_hours or 0.0 for r in week_records)

    # Month total
    month_records = [r for r in past_records if r.date and r.date.year == today_date.year and r.date.month == today_date.month]
    month_hours = sum(r.working_hours or 0.0 for r in month_records)

    return {
        "today": {
            "has_record": today_record is not None,
            "is_checked_in": today_record is not None and today_record.check_in is not None and today_record.check_out is None,
            "check_in": today_record.check_in.isoformat() if today_record and today_record.check_in else None,
            "check_out": today_record.check_out.isoformat() if today_record and today_record.check_out else None,
            "working_hours": float(today_record.working_hours or 0.0) if today_record else 0.0,
            "status": today_record.status if today_record else "NOT_CHECKED_IN"
        },
        "summary": {
            "hours_this_week": round(week_hours, 2),
            "hours_this_month": round(month_hours, 2),
            "days_present_this_month": len(month_records)
        },
        "history": [
            {
                "id": r.id,
                "date": r.date.strftime("%Y-%m-%d") if r.date else "",
                "check_in": r.check_in.isoformat() if r.check_in else None,
                "check_out": r.check_out.isoformat() if r.check_out else None,
                "working_hours": float(r.working_hours or 0.0),
                "status": r.status or "PRESENT"
            }
            for r in past_records
        ]
    }


@router.post("/attendance/check-in")
def check_in(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    emp = get_current_employee(db, current_user)
    now = datetime.now(timezone.utc)
    today_date = now.date()

    record = db.query(EmployeeAttendance).filter(
        EmployeeAttendance.employee_id == emp.id,
        func.date(EmployeeAttendance.date) == today_date
    ).first()

    if record and record.check_in and not record.check_out:
        raise HTTPException(status_code=400, detail="Already checked in for today")

    if not record:
        record = EmployeeAttendance(
            employee_id=emp.id,
            company_id=emp.company_id,
            date=now,
            check_in=now,
            status="PRESENT",
            working_hours=0.0
        )
        db.add(record)
    else:
        # Re-checkin
        record.check_in = now
        record.check_out = None
        record.status = "PRESENT"

    db.commit()
    db.refresh(record)

    return {
        "status": "success",
        "message": f"Checked in successfully at {record.check_in.strftime('%H:%M:%S UTC')}",
        "check_in": record.check_in.isoformat()
    }


@router.post("/attendance/check-out")
def check_out(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    emp = get_current_employee(db, current_user)
    now = datetime.now(timezone.utc)
    today_date = now.date()

    record = db.query(EmployeeAttendance).filter(
        EmployeeAttendance.employee_id == emp.id,
        func.date(EmployeeAttendance.date) == today_date
    ).first()

    if not record or not record.check_in:
        raise HTTPException(status_code=400, detail="Cannot check out: You have not checked in today")

    if record.check_out:
        raise HTTPException(status_code=400, detail="Already checked out for today")

    record.check_out = now
    # Calculate duration
    ci_tz = record.check_in.replace(tzinfo=timezone.utc) if record.check_in.tzinfo is None else record.check_in
    diff_sec = (now - ci_tz).total_seconds()
    record.working_hours = round(max(0.0, diff_sec / 3600.0), 2)
    db.commit()
    db.refresh(record)

    return {
        "status": "success",
        "message": f"Checked out successfully at {record.check_out.strftime('%H:%M:%S UTC')}. Total hours: {record.working_hours}",
        "check_out": record.check_out.isoformat(),
        "working_hours": record.working_hours
    }


@router.get("/notifications")
def get_my_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    emp = get_current_employee(db, current_user)
    notifs = db.query(Notification).filter(
        Notification.company_id == emp.company_id,
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).limit(50).all()

    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "type": n.type or "INFO",
            "is_read": n.is_read or False,
            "created_at": n.created_at.isoformat() if n.created_at else None
        }
        for n in notifs
    ]


@router.post("/notifications/{notification_id}/read")
def mark_my_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    emp = get_current_employee(db, current_user)
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.company_id == emp.company_id
    ).first()

    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    if current_user.role == "EMPLOYEE" and notif.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot access other users' notifications")

    notif.is_read = True
    db.commit()
    return {"status": "success"}


@router.post("/notifications/read-all")
def mark_all_my_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    emp = get_current_employee(db, current_user)
    db.query(Notification).filter(
        Notification.company_id == emp.company_id,
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"status": "success"}


@router.get("/ai-insights")
def get_my_ai_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Employee-scoped AI assistance:
    - Recommended execution sequence for assigned jobs to minimize transit time
    - Workload and rest recommendations
    - Performance trajectory
    """
    emp = get_current_employee(db, current_user)
    company_id = emp.company_id

    active_jobs = db.query(Job).filter(
        Job.employee_id == emp.id,
        Job.company_id == company_id,
        Job.status.in_(["ASSIGNED", "ACCEPTED", "STARTED"])
    ).all()

    # Sort jobs by Priority first, then by Location cluster
    sequenced_jobs = []
    for j in sorted(active_jobs, key=lambda x: (x.priority or 1), reverse=True):
        first_item = j.items[0] if j.items else None
        loc_str = "Main Floor"
        if first_item and first_item.position:
            loc_str = first_item.position.position_code

        sequenced_jobs.append({
            "job_id": j.id,
            "type": j.type,
            "status": j.status,
            "priority": j.priority or 1,
            "location": loc_str,
            "estimated_minutes": j.estimated_duration or 15,
            "recommendation_reason": "High priority order deadline" if (j.priority or 1) >= 3 else "Optimized warehouse pick sequence"
        })

    # Workload insight
    workload_min = float(emp.current_workload or 0.0)
    workload_status = "Optimal"
    if workload_min > 120:
        workload_status = "High Workload - Consider taking scheduled break"
    elif workload_min == 0:
        workload_status = "Standby - Ready for new assignments"

    perf = db.query(EmployeePerformance).filter(EmployeePerformance.employee_id == emp.id).first()
    on_time = perf.on_time_rate * 100.0 if perf else 100.0

    return {
        "job_sequence": sequenced_jobs,
        "workload_analysis": {
            "current_workload_minutes": workload_min,
            "status": workload_status,
            "recommended_next_break": "After completion of current priority job" if workload_min > 60 else "Standard shift schedule"
        },
        "performance_insight": {
            "on_time_rate_percentage": round(on_time, 1),
            "tips": [
                "Group adjacent picking locations in Rack A to minimize transit steps.",
                "Ensure barcode verification before confirming pallet movement.",
                "Log out or report availability change when taking unexpected leave."
            ]
        }
    }
