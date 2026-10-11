from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database.connection import Base

class Warehouse(Base):
    __tablename__ = "warehouses"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    name = Column(String(255), nullable=False)
    location = Column(String(255))
    type = Column(String(50))
    width = Column(Float, default=100.0)
    height = Column(Float, default=100.0)
    status = Column(String(50), default="ACTIVE")
    
    company = relationship("Company")
    zones = relationship("Zone", back_populates="warehouse", cascade="all, delete-orphan")

class Zone(Base):
    __tablename__ = "zones"
    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    name = Column(String(100), nullable=False)
    storage_type = Column(String(50))
    position_x = Column(Float, default=0.0)
    position_y = Column(Float, default=0.0)
    width = Column(Float, default=10.0)
    height = Column(Float, default=10.0)
    
    warehouse = relationship("Warehouse", back_populates="zones")
    racks = relationship("Rack", back_populates="zone", cascade="all, delete-orphan")

class Rack(Base):
    __tablename__ = "racks"
    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False)
    name = Column(String(100), nullable=False)
    rack_type = Column(String(50))
    position_x = Column(Float, default=0.0)
    position_y = Column(Float, default=0.0)
    rows_count = Column(Integer, default=1)
    positions_per_row = Column(Integer, default=1)
    status = Column(String(50), default="ACTIVE")
    
    zone = relationship("Zone", back_populates="racks")
    rows = relationship("Row", back_populates="rack", cascade="all, delete-orphan")

class Row(Base):
    __tablename__ = "warehouse_rows"
    id = Column(Integer, primary_key=True, index=True)
    rack_id = Column(Integer, ForeignKey("racks.id"), nullable=False)
    name = Column(String(100))
    row_number = Column(Integer, nullable=False)
    
    rack = relationship("Rack", back_populates="rows")
    positions = relationship("Position", back_populates="row", cascade="all, delete-orphan")

class Position(Base):
    __tablename__ = "positions"
    id = Column(Integer, primary_key=True, index=True)
    row_id = Column(Integer, ForeignKey("warehouse_rows.id"), nullable=False)
    position_code = Column(String(100), nullable=False)
    capacity = Column(Integer, default=100)
    current_occupancy = Column(Integer, default=0)
    available_capacity = Column(Integer, default=100)
    status = Column(String(50), default="AVAILABLE") # AVAILABLE, OCCUPIED, MAINTENANCE
    storage_type = Column(String(50))
    allowed_categories = Column(Text) # Comma separated
    x = Column(Float, default=0.0)
    y = Column(Float, default=0.0)
    
    # ML Placement Features
    accessibility_score = Column(Float, default=50.0)
    picking_priority = Column(Integer, default=5) # 1=Highest
    distance_to_dispatch = Column(Float, default=100.0) # meters
    height_level = Column(Integer, default=1) # 1=Ground
    is_fast_pick_zone = Column(Integer, default=0) # boolean 0/1
    
    row = relationship("Row", back_populates="positions")
