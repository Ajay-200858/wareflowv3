from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta

from app.database.connection import get_db
from app.core.security import verify_password, create_access_token
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.company import Company
from app.schemas.auth import Token, LoginRequest
from app.schemas.user import UserResponse, UserCreate
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings

router = APIRouter()

@router.post("/login", response_model=Token)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    company = db.query(Company).filter(Company.id == user.company_id).first()
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role, "company_id": user.company_id, "user_id": user.id},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": user,
        "role": user.role,
        "company": company
    }

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

class SetupRequest(BaseModel):
    company_name: str
    company_address: Optional[str] = None
    company_contact: Optional[str] = None
    
@router.put("/me/setup")
def update_setup(request: SetupRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == "MANAGER":
        company = db.query(Company).filter(Company.id == current_user.company_id).first()
        if company:
            if request.company_name:
                company.name = request.company_name
            # if we had address and contact, we'd update here
    
    current_user.setup_completed = True
    db.commit()
    db.refresh(current_user)
    return {"status": "success", "setup_completed": True}

@router.post("/register", response_model=Token)
def register(request: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    if db.query(User).filter(User.email == request.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
        
    # By default, new users registering are managers setting up their own company
    new_company = Company(name=request.company_name)
    db.add(new_company)
    db.flush() # get new_company.id

    new_user = User(
        email=request.email,
        hashed_password=get_password_hash(request.password),
        role="MANAGER",
        company_id=new_company.id,
        setup_completed=False
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": new_user.email, "role": new_user.role, "company_id": new_user.company_id, "user_id": new_user.id},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": new_user,
        "role": new_user.role,
        "company": new_company
    }

from datetime import datetime, timezone
from app.models.invitation import EmployeeInvitation
from app.models.employee import Employee
from app.schemas.auth import EmployeeRegisterRequest

@router.get("/invitation-info")
def get_invitation_info(code: str, db: Session = Depends(get_db)):
    if not code:
        raise HTTPException(status_code=400, detail="Invitation code is required")
    inv = db.query(EmployeeInvitation).filter(EmployeeInvitation.invitation_code == code.strip()).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation code not found")
    if inv.is_revoked:
        raise HTTPException(status_code=400, detail="This invitation code has been revoked")
    if inv.is_used:
        raise HTTPException(status_code=400, detail="This invitation code has already been used")
    if inv.expires_at:
        now_dt = datetime.now(timezone.utc) if inv.expires_at.tzinfo else datetime.utcnow()
        if inv.expires_at < now_dt:
            raise HTTPException(status_code=400, detail="This invitation code has expired")

    company = db.query(Company).filter(Company.id == inv.company_id).first()
    return {
        "valid": True,
        "company_name": company.name if company else "WareFlow Partner",
        "role_type": inv.role_type or "Picker",
        "target_email": inv.email
    }

@router.post("/employee-register", response_model=Token)
def employee_register(request: EmployeeRegisterRequest, db: Session = Depends(get_db)):
    email = request.email.strip().lower()
    full_name = request.full_name.strip()
    code = request.invitation_code.strip()

    if not full_name:
        raise HTTPException(status_code=400, detail="Full name is required")
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email address is required")
    if len(request.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    # 1. Check duplicate user email
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="An account with this email address already exists")

    # 2. Validate invitation
    inv = db.query(EmployeeInvitation).filter(EmployeeInvitation.invitation_code == code).first()
    if not inv:
        raise HTTPException(status_code=400, detail="Invalid invitation code")
    if inv.is_revoked:
        raise HTTPException(status_code=400, detail="Invitation code has been revoked")
    if inv.is_used:
        raise HTTPException(status_code=400, detail="Invitation code has already been used")
    if inv.expires_at:
        now_dt = datetime.now(timezone.utc) if inv.expires_at.tzinfo else datetime.utcnow()
        if inv.expires_at < now_dt:
            raise HTTPException(status_code=400, detail="Invitation code has expired")
    if inv.email and inv.email.strip().lower() != email:
        raise HTTPException(status_code=400, detail="This invitation code was assigned to a different email address")

    company = db.query(Company).filter(Company.id == inv.company_id).first()
    if not company:
        raise HTTPException(status_code=400, detail="Company associated with this invitation was not found")

    # 3. Create User account with strictly EMPLOYEE role
    new_user = User(
        email=email,
        hashed_password=get_password_hash(request.password),
        role="EMPLOYEE",
        company_id=inv.company_id,
        is_active=True,
        setup_completed=True
    )
    db.add(new_user)
    db.flush()

    # 4. Check or create Employee record
    name_parts = full_name.split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else "Staff"

    target_emp = None
    if request.employee_code:
        clean_code = request.employee_code.strip()
        matched = db.query(Employee).filter(
            Employee.company_id == inv.company_id,
            Employee.employee_code == clean_code
        ).first()
        if matched:
            if matched.user_id and matched.user_id != new_user.id:
                raise HTTPException(status_code=400, detail="Employee code is already linked to another account")
            target_emp = matched

    if not target_emp:
        # Check by unlinked employee with same name in same company
        unlinked = db.query(Employee).filter(
            Employee.company_id == inv.company_id,
            Employee.first_name == first_name,
            Employee.last_name == last_name,
            Employee.user_id.is_(None)
        ).first()
        if unlinked:
            target_emp = unlinked

    if target_emp:
        target_emp.user_id = new_user.id
        if not target_emp.warehouse_id and inv.warehouse_id:
            target_emp.warehouse_id = inv.warehouse_id
    else:
        target_emp = Employee(
            company_id=inv.company_id,
            user_id=new_user.id,
            first_name=first_name,
            last_name=last_name,
            role_type=inv.role_type or "Picker",
            warehouse_id=inv.warehouse_id,
            status="ACTIVE",
            current_workload=0.0
        )
        db.add(target_emp)
        db.flush()
        target_emp.employee_code = request.employee_code.strip() if request.employee_code else f"EMP-{target_emp.id:04d}"

    # 5. Mark invitation used
    inv.is_used = True
    inv.used_by_user_id = new_user.id
    inv.used_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(new_user)

    # 6. Issue Token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": new_user.email, "role": new_user.role, "company_id": new_user.company_id, "user_id": new_user.id},
        expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": new_user,
        "role": new_user.role,
        "company": company
    }
