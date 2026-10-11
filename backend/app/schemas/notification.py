from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class NotificationResponse(BaseModel):
    id: int
    company_id: int
    user_id: Optional[int]
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
