from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class CompanyBase(BaseModel):
    name: str
    industry: Optional[str] = "Other"
    location: Optional[str] = None
    size: Optional[str] = None

class CompanyCreate(CompanyBase):
    pass

class CompanyResponse(CompanyBase):
    id: int
    status: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
