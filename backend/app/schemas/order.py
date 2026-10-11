from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime

class OrderItemBase(BaseModel):
    product_id: int
    quantity: int

class OrderCreate(BaseModel):
    customer_id: Optional[int] = None
    delivery_address: str
    required_by: Optional[datetime] = None
    priority: str = "NORMAL"
    items: List[OrderItemBase]

class OrderItemResponse(OrderItemBase):
    id: int
    picked_quantity: int
    packed_quantity: Optional[int] = 0
    model_config = ConfigDict(from_attributes=True)

class OrderResponse(BaseModel):
    id: int
    status: str
    customer_id: Optional[int]
    delivery_address: str
    required_by: Optional[datetime]
    created_at: datetime
    items: List[OrderItemResponse]
    model_config = ConfigDict(from_attributes=True)
