from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class EmployeeBase(BaseModel):
    first_name: str
    last_name: str
    role_type: str
    status: str = "ACTIVE"
    user_id: Optional[int] = None
    warehouse_id: Optional[int] = None
    employee_code: Optional[str] = None

class EmployeeCreate(EmployeeBase):
    pass

class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role_type: Optional[str] = None
    status: Optional[str] = None
    warehouse_id: Optional[int] = None
    employee_code: Optional[str] = None

class EmployeeResponse(EmployeeBase):
    id: int
    company_id: int
    current_workload: Optional[float] = 0.0
    email: Optional[str] = None
    warehouse_name: Optional[str] = None
    active_jobs_count: Optional[int] = 0
    completed_jobs_count: Optional[int] = 0
    accuracy: Optional[float] = 1.0
    on_time_rate: Optional[float] = 1.0
    salary_status: Optional[str] = "UNBILLED"
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class ShiftBase(BaseModel):
    employee_id: int
    start_time: datetime
    end_time: datetime
    is_active: bool = True

class ShiftCreate(ShiftBase):
    pass

class ShiftResponse(ShiftBase):
    id: int
    
    model_config = ConfigDict(from_attributes=True)

class SalaryRuleBase(BaseModel):
    role_type: str
    salary_model: str # FIXED, WORK_BASED
    base_salary: float = 0.0
    picking_rate: float = 0.0
    packing_rate: float = 0.0
    delivery_rate: float = 0.0
    overtime_rate: float = 0.0

class SalaryRuleCreate(SalaryRuleBase):
    pass

class SalaryRuleResponse(SalaryRuleBase):
    id: int
    company_id: int
    
    model_config = ConfigDict(from_attributes=True)

class SalaryRecordResponse(BaseModel):
    id: int
    employee_id: int
    period: str
    base_amount: float
    piece_rate_amount: float
    overtime_amount: float
    bonus: float
    adjustments: float
    total_amount: float
    status: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class SalaryAdjustmentCreate(BaseModel):
    amount: float
    reason: str

class SalaryStatusUpdate(BaseModel):
    status: str # DRAFT, FINALIZED, PAID

class AvailabilityBase(BaseModel):
    employee_id: int
    date: datetime
    status: str # AVAILABLE, ON_LEAVE, SICK

class AvailabilityCreate(AvailabilityBase):
    pass

class AvailabilityResponse(AvailabilityBase):
    id: int
    
    model_config = ConfigDict(from_attributes=True)

class InvitationCreate(BaseModel):
    role_type: str = "Picker"
    email: Optional[str] = None
    warehouse_id: Optional[int] = None
    expires_in_days: Optional[int] = 7

class InvitationResponse(BaseModel):
    id: int
    company_id: int
    invitation_code: str
    role_type: str
    email: Optional[str] = None
    warehouse_id: Optional[int] = None
    warehouse_name: Optional[str] = None
    is_used: bool
    is_revoked: bool
    expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    used_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
