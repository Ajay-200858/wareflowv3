from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class JobItemBase(BaseModel):
    product_id: int
    quantity: int
    position_id: Optional[int] = None

class JobCreate(BaseModel):
    order_id: Optional[int] = None
    job_type: str
    priority: str = "NORMAL"
    items: List[JobItemBase]
    estimated_minutes: Optional[int] = None

class JobResponse(BaseModel):
    id: int
    order_id: Optional[int]
    employee_id: Optional[int]
    job_type: str
    status: str
    priority: str
    estimated_minutes: Optional[int]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
