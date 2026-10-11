from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.database.connection import get_db
from app.core.dependencies import get_current_active_user, get_current_active_manager
from app.models.user import User
from app.models.employee import Employee, EmployeeShift, EmployeeAvailability, EmployeePerformance
from app.models.salary import SalaryRule, SalaryRecord
from app.core.security import get_password_hash
from app.models.job import Job
from app.schemas.employee import (
    EmployeeBase, EmployeeCreate, EmployeeUpdate, EmployeeResponse,
    ShiftBase, ShiftCreate, ShiftResponse,
    AvailabilityBase, AvailabilityCreate, AvailabilityResponse,
    SalaryRuleCreate, SalaryRuleResponse, SalaryRecordResponse
)

router = APIRouter()

# --- EMPLOYEES CRUD ---

@router.get("", response_model=List[EmployeeResponse])
def get_employees(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    return db.query(Employee).filter(Employee.company_id == current_user.company_id).all()

@router.post("", response_model=EmployeeResponse, status_code=201)
def create_employee(employee: EmployeeCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_manager)):
    db_emp = Employee(**employee.model_dump(), company_id=current_user.company_id)
    db.add(db_emp)
    db.commit()
    db.refresh(db_emp)
    return db_emp

@router.put("/{emp_id}", response_model=EmployeeResponse)
def update_employee(emp_id: int, employee: EmployeeUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_manager)):
    db_emp = db.query(Employee).filter(Employee.id == emp_id, Employee.company_id == current_user.company_id).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    update_data = employee.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_emp, key, value)
        
    db.commit()
    db.refresh(db_emp)
    return db_emp

# --- WORKLOAD ---

@router.post("/{emp_id}/calculate_workload")
def calculate_workload(emp_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Workload = sum of estimated minutes of ASSIGNED, ACCEPTED, STARTED jobs
    db_emp = db.query(Employee).filter(Employee.id == emp_id, Employee.company_id == current_user.company_id).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    active_jobs = db.query(Job).filter(
        Job.employee_id == emp_id,
        Job.company_id == current_user.company_id,
        Job.status.in_(["ASSIGNED", "ACCEPTED", "STARTED"])
    ).all()
    
    total_minutes = sum(j.estimated_duration for j in active_jobs if j.estimated_duration)
    db_emp.current_workload = float(total_minutes)
    db.commit()
    
    return {"status": "success", "workload_minutes": total_minutes}

# --- SHIFTS ---

@router.get("/{emp_id}/shifts", response_model=List[ShiftResponse])
def get_employee_shifts(emp_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    db_emp = db.query(Employee).filter(Employee.id == emp_id, Employee.company_id == current_user.company_id).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return db.query(EmployeeShift).filter(EmployeeShift.employee_id == emp_id).all()

@router.post("/{emp_id}/shifts", response_model=ShiftResponse, status_code=201)
def create_shift(emp_id: int, shift: ShiftCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_manager)):
    db_emp = db.query(Employee).filter(Employee.id == emp_id, Employee.company_id == current_user.company_id).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Conflict check
    overlapping = db.query(EmployeeShift).filter(
        EmployeeShift.employee_id == emp_id,
        EmployeeShift.is_active == True,
        EmployeeShift.start_time < shift.end_time,
        EmployeeShift.end_time > shift.start_time
    ).first()
    
    if overlapping:
        raise HTTPException(status_code=400, detail="Shift overlaps with an existing shift")
        
    db_shift = EmployeeShift(**shift.model_dump())
    db_shift.employee_id = emp_id
    db.add(db_shift)
    db.commit()
    db.refresh(db_shift)
    return db_shift

from fastapi import File, UploadFile
import csv, io

@router.post("/import", status_code=200)
async def import_employees(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_active_manager)):
    if not file.filename.endswith('.csv'): 
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    content = await file.read()
    try: 
        decoded = content.decode('utf-8-sig')
    except Exception: 
        raise HTTPException(status_code=400, detail="Invalid file encoding")
        
    raw_reader = csv.DictReader(io.StringIO(decoded))
    if not raw_reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file is empty or missing headers")

    field_map = {col.strip().lower(): col for col in raw_reader.fieldnames if col}
    fn_col = field_map.get('first_name') or field_map.get('firstname') or field_map.get('name')
    ln_col = field_map.get('last_name') or field_map.get('lastname')
    email_col = field_map.get('email') or field_map.get('email_address')
    role_col = field_map.get('role') or field_map.get('role_type') or field_map.get('role_name')
    skills_col = field_map.get('skills') or field_map.get('skill')
    
    if not fn_col:
        raise HTTPException(status_code=400, detail="Missing required column: must include first_name")

    count = 0
    errors = []
    
    for row_num, raw_row in enumerate(raw_reader, start=1):
        try:
            r = {k.strip().lower(): v for k, v in raw_row.items() if k}
            first_name = (r.get(fn_col.strip().lower()) or '').strip()
            last_name = (r.get(ln_col.strip().lower()) or '').strip() if ln_col else ''
            
            # If name was a full name in first_name
            if not last_name and ' ' in first_name:
                parts = first_name.split(' ', 1)
                first_name = parts[0]
                last_name = parts[1]
                
            if not last_name:
                last_name = "Team"
                
            email = (r.get(email_col.strip().lower()) or '').strip() if email_col else ''
            # Auto-generate email if missing
            if not email:
                clean_fn = "".join(c for c in first_name if c.isalnum()).lower()
                clean_ln = "".join(c for c in last_name if c.isalnum()).lower()
                email = f"{clean_fn}.{clean_ln}@wareflow.demo"
                
            # Clean markdown links [email](mailto:email)
            if email.startswith('['):
                import re
                m = re.search(r'\[(.*?)\]', email)
                if m:
                    email = m.group(1).strip()
                    
            role_type = (r.get(role_col.strip().lower()) or 'EMPLOYEE').strip().upper() if role_col else 'EMPLOYEE'
            skills_str = (r.get(skills_col.strip().lower()) or 'WAREHOUSE').strip() if skills_col else 'WAREHOUSE'
            
            if not first_name:
                errors.append(f"Row {row_num}: Missing first name")
                continue
                
            if role_type not in ['ADMIN', 'MANAGER', 'EMPLOYEE', 'WAREHOUSE', 'STORAGE', 'PICKING', 'PACKING', 'DELIVERY']:
                role_type = 'EMPLOYEE'
                
            user_role = 'EMPLOYEE'
            if role_type in ['ADMIN', 'MANAGER']:
                user_role = role_type
                
            # Check for existing user by email
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
                    hashed_password=get_password_hash("password123"), # Default password
                    role=user_role,
                    is_active=True,
                    setup_completed=True
                )
                db.add(new_user)
                db.flush()
                user_id = new_user.id
            
            # Check if employee already exists by first_name, last_name in this company
            exists = db.query(Employee).filter_by(
                company_id=current_user.company_id, 
                first_name=first_name, 
                last_name=last_name
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
                status="ACTIVE"
            )
            db.add(db_emp)
            db.flush()
            
            # Add skills
            if skills_str:
                skill_list = [s.strip() for s in skills_str.split(',') if s.strip()]
                for s in skill_list:
                    from app.models.employee import EmployeeSkill
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
def set_availability(emp_id: int, avail: AvailabilityCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_manager)):
    db_emp = db.query(Employee).filter(Employee.id == emp_id, Employee.company_id == current_user.company_id).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    db_avail = EmployeeAvailability(**avail.model_dump())
    db_avail.employee_id = emp_id
    db.add(db_avail)
    db.commit()
    db.refresh(db_avail)
    return db_avail

# --- SALARIES & PAYROLL ---

@router.post("/salary-rules", response_model=SalaryRuleResponse)
def create_salary_rule(rule: SalaryRuleCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_manager)):
    db_rule = SalaryRule(**rule.model_dump(), company_id=current_user.company_id)
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule

@router.post("/{emp_id}/calculate-salary")
def calculate_salary(emp_id: int, period: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_manager)):
    db_emp = db.query(Employee).filter(Employee.id == emp_id, Employee.company_id == current_user.company_id).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    # Prevent duplicate records for same period
    existing = db.query(SalaryRecord).filter(SalaryRecord.employee_id == emp_id, SalaryRecord.period == period).first()
    if existing:
        raise HTTPException(status_code=400, detail="Salary record for this period already exists")
        
    rule = db.query(SalaryRule).filter(SalaryRule.company_id == current_user.company_id, SalaryRule.role_type == db_emp.role_type).first()
    if not rule:
        raise HTTPException(status_code=400, detail="No salary rule defined for this role")
        
    record = SalaryRecord(
        employee_id=emp_id,
        period=period,
        status="PENDING",
        base_amount=0.0,
        piece_rate_amount=0.0,
        total_amount=0.0
    )
    
    if rule.salary_model == "FIXED":
        record.base_amount = rule.base_salary
        record.total_amount = record.base_amount
    elif rule.salary_model == "WORK_BASED":
        # Calculate from completed jobs in this period
        year, month = map(int, period.split('-'))
        
        jobs = db.query(Job).filter(
            Job.employee_id == emp_id,
            Job.status == "COMPLETED",
            Job.company_id == current_user.company_id
        ).all()
        
        period_jobs = [j for j in jobs if j.completed_at and j.completed_at.year == year and j.completed_at.month == month]
        
        picking = sum(1 for j in period_jobs if j.type == "PICKING")
        packing = sum(1 for j in period_jobs if j.type == "PACKING")
        delivery = sum(1 for j in period_jobs if j.type == "DELIVERY")
        
        record.piece_rate_amount = (picking * rule.picking_rate) + (packing * rule.packing_rate) + (delivery * rule.delivery_rate)
        record.total_amount = record.piece_rate_amount
        
    db.add(record)
    db.commit()
    db.refresh(record)
    
    return record
