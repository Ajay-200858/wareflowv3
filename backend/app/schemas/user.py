from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    role: str

class UserCreate(UserBase):
    password: str
    company_name: str
    industry: Optional[str] = "Other"

class UserResponse(UserBase):
    id: int
    company_id: int
    is_active: bool
    setup_completed: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
