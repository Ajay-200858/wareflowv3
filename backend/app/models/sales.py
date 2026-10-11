from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, func
from app.database.connection import Base
from sqlalchemy.orm import relationship

class SalesHistory(Base):
    __tablename__ = "sales_history"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    date = Column(DateTime(timezone=True), nullable=False)
    quantity_sold = Column(Integer, default=0)
    price = Column(Float, default=0.0)
    
    company = relationship("Company")
    product = relationship("Product")
