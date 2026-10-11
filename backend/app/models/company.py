from sqlalchemy import Column, Integer, String, DateTime, func, Enum
from app.database.connection import Base
import enum

class IndustryEnum(str, enum.Enum):
    WAREHOUSE = "Warehouse"
    DISTRIBUTION = "Distribution"
    RETAIL = "Retail"
    ECOMMERCE = "E-commerce"
    MANUFACTURING = "Manufacturing"
    WHOLESALE = "Wholesale"
    FOOD = "Food"
    PHARMA = "Pharmaceutical"
    ELECTRONICS = "Electronics"
    FASHION = "Fashion"
    OTHER = "Other"

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    industry = Column(Enum(IndustryEnum), default=IndustryEnum.OTHER)
    location = Column(String(255))
    size = Column(String(50))
    status = Column(String(50), default="ACTIVE")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
