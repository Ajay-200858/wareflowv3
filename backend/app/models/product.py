from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text, func
from app.database.connection import Base
from sqlalchemy.orm import relationship

class ProductCategory(Base):
    __tablename__ = "product_categories"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("product_categories.id"))
    sku = Column(String(100), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    unit = Column(String(50))
    weight = Column(Float)
    dimensions = Column(String(100))
    storage_requirements = Column(String(255))
    expiry_days = Column(Integer, default=0)
    status = Column(String(50), default="ACTIVE")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    company = relationship("Company")
    category = relationship("ProductCategory")
