from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime

from app.database.connection import get_db
from app.core.dependencies import get_current_active_user, get_current_active_manager
from app.models.user import User
from app.models.job import Job, JobItem
from app.models.order import Order
from app.models.inventory import Inventory
from app.schemas.job import JobResponse
from app.models.employee import Employee
from app.services.notification_service import create_notification

router = APIRouter()

@router.get("", response_model=List[JobResponse])
def get_jobs(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    jobs = db.query(Job).filter(Job.company_id == current_user.company_id).all()
    result = []
    for j in jobs:
        result.append({
            "id": j.id,
            "order_id": j.order_id,
            "employee_id": j.employee_id,
            "job_type": j.type,
            "status": j.status,
            "priority": str(j.priority),
            "estimated_minutes": int(j.estimated_duration) if j.estimated_duration else None,
            "created_at": j.created_at or datetime.utcnow()
        })
    return result

@router.put("/{job_id}/assign")
def assign_job(job_id: int, employee_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_manager)):
    from app.models.employee import EmployeeAvailability
    job = db.query(Job).filter(Job.id == job_id, Job.company_id == current_user.company_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    if job.status not in ["PENDING", "REJECTED"]:
        raise HTTPException(status_code=400, detail=f"Cannot assign job in {job.status} status")
        
    # Check availability
    today = datetime.utcnow().date()
    unavailable = db.query(EmployeeAvailability).filter(
        EmployeeAvailability.employee_id == employee_id,
        func.date(EmployeeAvailability.date) == today,
        EmployeeAvailability.status.in_(["ON_LEAVE", "SICK"])
    ).first()
    
    if unavailable:
        raise HTTPException(status_code=400, detail=f"Employee is unavailable today due to {unavailable.status}")
        
    job.employee_id = employee_id
    job.status = "ASSIGNED"
    db.commit()
    
    # Notify employee
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if emp and emp.user_id:
        create_notification(db, current_user.company_id, "New Job Assigned", f"You have been assigned to Job #{job.id} ({job.type})", "INFO", emp.user_id)
        
    return {"status": "success", "message": "Job assigned"}

def _verify_job_ownership(job: Job, current_user: User, db: Session):
    if current_user.role == "EMPLOYEE":
        emp = db.query(Employee).filter(Employee.user_id == current_user.id, Employee.company_id == current_user.company_id).first()
        if not emp or job.employee_id != emp.id:
            raise HTTPException(status_code=403, detail="Cannot operate on job not assigned to you")

@router.put("/{job_id}/accept")
def accept_job(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    job = db.query(Job).filter(Job.id == job_id, Job.company_id == current_user.company_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    _verify_job_ownership(job, current_user, db)
        
    if job.status != "ASSIGNED":
        raise HTTPException(status_code=400, detail="Job is not assigned to anyone")
        
    job.status = "ACCEPTED"
    job.started_at = datetime.utcnow()
    db.commit()
    return {"status": "success", "message": "Job accepted"}

@router.put("/{job_id}/start")
def start_job(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    job = db.query(Job).filter(Job.id == job_id, Job.company_id == current_user.company_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    _verify_job_ownership(job, current_user, db)
        
    if job.status not in ["ASSIGNED", "ACCEPTED"]:
        raise HTTPException(status_code=400, detail=f"Cannot start job in {job.status} status")
        
    job.status = "STARTED"
    if not job.started_at:
        job.started_at = datetime.utcnow()
    db.commit()
    return {"status": "success", "message": "Job started"}

@router.put("/{job_id}/reject")
def reject_job(job_id: int, reason: str = "No reason provided", db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    job = db.query(Job).filter(Job.id == job_id, Job.company_id == current_user.company_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    _verify_job_ownership(job, current_user, db)
        
    if job.status not in ["ASSIGNED", "ACCEPTED"]:
        raise HTTPException(status_code=400, detail="Job cannot be rejected from current state")
        
    job.status = "REJECTED"
    job.employee_id = None
    job.started_at = None
    
    # Trigger automatic re-assignment via AI
    from app.api.ai import recommend_assignment
    try:
        recommend_assignment(job.id, db, current_user)
    except Exception as e:
        # Fallback if no employee can be found
        pass

    db.commit()
    
    # Notify managers
    create_notification(db, current_user.company_id, "Job Rejected", f"Job #{job.id} was rejected. Automatic AI re-assignment triggered.", "WARNING")
    
    return {"status": "success", "message": "Job rejected and AI re-assignment triggered"}

@router.put("/{job_id}/complete")
def complete_job(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    job = db.query(Job).filter(Job.id == job_id, Job.company_id == current_user.company_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    _verify_job_ownership(job, current_user, db)
        
    if job.status not in ["ACCEPTED", "STARTED"]:
        raise HTTPException(status_code=400, detail="Job must be accepted before completing")
        
    if job.type == "PICKING":
        # Deduct reserved inventory completely
        from app.models.warehouse import Position
        from app.models.inventory import InventoryMovement
        for j_item in job.items:
            if j_item.status != "COMPLETED":
                inv = db.query(Inventory).filter(
                    Inventory.product_id == j_item.product_id,
                    Inventory.position_id == j_item.position_id,
                    Inventory.company_id == current_user.company_id
                ).first()
                if inv:
                    # Remove from reserved, remove from total quantity
                    inv.reserved_quantity -= j_item.quantity
                    inv.quantity -= j_item.quantity
                    
                    # Update position occupancy
                    if j_item.position_id:
                        pos = db.query(Position).filter(Position.id == j_item.position_id).with_for_update().first()
                        if pos:
                            pos.current_occupancy = max(0, pos.current_occupancy - j_item.quantity)
                            pos.available_capacity = pos.capacity - pos.current_occupancy
                            
                    # Record movement
                    movement = InventoryMovement(
                        company_id=current_user.company_id,
                        product_id=j_item.product_id,
                        source_position_id=j_item.position_id,
                        dest_position_id=None,
                        quantity=j_item.quantity,
                        employee_id=current_user.id,
                        reason="Picking Job Completed"
                    )
                    db.add(movement)
                        
                j_item.status = "COMPLETED"
    elif job.type in ["RECEIVING", "STORAGE", "PUT_AWAY"]:
        from app.models.warehouse import Position, Warehouse
        from app.models.inventory import InventoryMovement
        for j_item in job.items:
            if j_item.status != "COMPLETED":
                # Find staging inventory for this product
                staging_inv = db.query(Inventory).filter(
                    Inventory.product_id == j_item.product_id,
                    Inventory.position_id.is_(None),
                    Inventory.company_id == current_user.company_id
                ).first()
                
                # Check destination position
                if j_item.position_id:
                    pos = db.query(Position).filter(Position.id == j_item.position_id).with_for_update().first()
                    if not pos:
                        raise HTTPException(status_code=400, detail=f"Position {j_item.position_id} not found")
                        
                    if pos.available_capacity < j_item.quantity:
                        raise HTTPException(status_code=400, detail=f"Position {pos.position_code} exceeds capacity by {j_item.quantity - pos.available_capacity}")
                        
                    # Transfer from staging if available
                    if staging_inv and staging_inv.quantity >= j_item.quantity:
                        staging_inv.quantity -= j_item.quantity
                        staging_inv.available_quantity -= j_item.quantity
                        warehouse_id = staging_inv.warehouse_id
                    else:
                        warehouse_id = pos.row.rack.zone.warehouse_id
                        
                    # Add to destination inventory
                    dest_inv = db.query(Inventory).filter(
                        Inventory.product_id == j_item.product_id,
                        Inventory.position_id == j_item.position_id,
                        Inventory.company_id == current_user.company_id
                    ).first()
                    
                    if dest_inv:
                        dest_inv.quantity += j_item.quantity
                        dest_inv.available_quantity += j_item.quantity
                    else:
                        dest_inv = Inventory(
                            company_id=current_user.company_id,
                            product_id=j_item.product_id,
                            position_id=j_item.position_id,
                            quantity=j_item.quantity,
                            available_quantity=j_item.quantity,
                            reserved_quantity=0,
                            warehouse_id=warehouse_id
                        )
                        db.add(dest_inv)
                        
                    # Update position capacity
                    pos.current_occupancy += j_item.quantity
                    pos.available_capacity = pos.capacity - pos.current_occupancy
                    
                    # Record movement
                    movement = InventoryMovement(
                        company_id=current_user.company_id,
                        product_id=j_item.product_id,
                        source_position_id=None,
                        dest_position_id=pos.id,
                        quantity=j_item.quantity,
                        employee_id=current_user.id,
                        reason="Put-away Job Completed"
                    )
                    db.add(movement)
                        
                j_item.status = "COMPLETED"
    else:
        for j_item in job.items:
            j_item.status = "COMPLETED"
            
    job.status = "COMPLETED"
    job.completed_at = datetime.utcnow()
    db.commit() # save job status immediately
    
    # Notify managers
    create_notification(db, current_user.company_id, "Job Completed", f"Job #{job.id} ({job.type}) was completed.", "SUCCESS")
    
    # State Machine transitions for order
    if job.order_id:
        order = db.query(Order).filter(Order.id == job.order_id).first()
        if order:
            if job.type == "PICKING":
                picking_jobs = [j for j in order.jobs if j.type == "PICKING"]
                if all(j.status == "COMPLETED" for j in picking_jobs):
                    if not any(j.type == "PACKING" for j in order.jobs):
                        # Create PACKING job
                        new_job = Job(
                            company_id=current_user.company_id,
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
                        # Create DELIVERY job
                        new_job = Job(
                            company_id=current_user.company_id,
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
                    order.completed_at = datetime.utcnow()
                
    db.commit()
    return {"status": "success", "message": "Job completed"}
