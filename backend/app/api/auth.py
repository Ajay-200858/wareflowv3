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
