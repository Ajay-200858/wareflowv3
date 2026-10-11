from pydantic import BaseModel, ConfigDict
from typing import List, Optional

class PositionResponse(BaseModel):
    id: int
    row_id: int
    position_code: str
    capacity: int
    status: str
    model_config = ConfigDict(from_attributes=True)

class RowResponse(BaseModel):
    id: int
    name: str
    positions: List[PositionResponse] = []
    model_config = ConfigDict(from_attributes=True)

class RackResponse(BaseModel):
    id: int
    name: str
    rows: List[RowResponse] = []
    model_config = ConfigDict(from_attributes=True)

class ZoneResponse(BaseModel):
    id: int
    name: str
    racks: List[RackResponse] = []
    model_config = ConfigDict(from_attributes=True)

class WarehouseResponse(BaseModel):
    id: int
    name: str
    zones: List[ZoneResponse] = []
    model_config = ConfigDict(from_attributes=True)
