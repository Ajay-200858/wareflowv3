from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class InventoryMovementRequest(BaseModel):
    product_id: int
    quantity: int
    from_position: Optional[int] = None
    to_position: Optional[int] = None
    movement_type: str # RECEIVE, PICK, MOVE, ADJUST, etc.

class InventoryResponse(BaseModel):
    id: int
    product_id: int
    warehouse_id: int
    position_id: Optional[int] = None
    quantity: int
    available_quantity: int
    reserved_quantity: int
    
    model_config = ConfigDict(from_attributes=True)
