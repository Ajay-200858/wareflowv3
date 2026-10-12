from pydantic import BaseModel
from typing import Optional
from app.schemas.user import UserResponse
from app.schemas.company import CompanyResponse

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse
    role: str
    company: CompanyResponse

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    company_id: Optional[int] = None
    user_id: Optional[int] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class EmployeeRegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str
    invitation_code: str
    employee_code: Optional[str] = None
