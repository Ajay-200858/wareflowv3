from pydantic import BaseModel, ConfigDict
from typing import List, Optional

class ProductBase(BaseModel):
    sku: str
    name: str
    category: Optional[str] = None
    unit: str
    price: float
    weight: Optional[float] = None
    storage_type: Optional[str] = None
    minimum_stock: int = 0
    maximum_stock: Optional[int] = None
    expiry_required: bool = False

class ProductCreate(ProductBase):
    pass

class ProductResponse(ProductBase):
    id: int
    company_id: int
    status: str
    
    model_config = ConfigDict(from_attributes=True)
