from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, func
from app.database.connection import Base
from sqlalchemy.orm import relationship

class Inventory(Base):
    __tablename__ = "inventory"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"))
    zone_id = Column(Integer, ForeignKey("zones.id"))
    rack_id = Column(Integer, ForeignKey("racks.id"))
    row_id = Column(Integer, ForeignKey("warehouse_rows.id"))
    position_id = Column(Integer, ForeignKey("positions.id"))
    quantity = Column(Integer, default=0)
    reserved_quantity = Column(Integer, default=0)
    available_quantity = Column(Integer, default=0)
    expiry_date = Column(DateTime(timezone=True))
    status = Column(String(50), default="AVAILABLE")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    company = relationship("Company")
    product = relationship("Product")
    warehouse = relationship("Warehouse")
    position = relationship("Position")

class InventoryMovement(Base):
    __tablename__ = "inventory_movements"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    source_position_id = Column(Integer, ForeignKey("positions.id"), nullable=True)
    dest_position_id = Column(Integer, ForeignKey("positions.id"), nullable=True)
    quantity = Column(Integer, nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    reason = Column(String(255))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company")
    product = relationship("Product")
