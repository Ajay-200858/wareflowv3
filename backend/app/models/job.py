from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, func
from app.database.connection import Base
from sqlalchemy.orm import relationship

class Job(Base):
    __tablename__ = "jobs"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    type = Column(String(50), nullable=False) # PICKING, PACKING, DELIVERY, PUTAWAY
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    status = Column(String(50), default="PENDING") # PENDING, ASSIGNED, ACCEPTED, STARTED, COMPLETED, REJECTED
    priority = Column(Integer, default=1)
    estimated_duration = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))

    company = relationship("Company")
    order = relationship("Order", back_populates="jobs")
    employee = relationship("Employee")
    items = relationship("JobItem", back_populates="job")

class JobItem(Base):
    __tablename__ = "job_items"
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    position_id = Column(Integer, ForeignKey("positions.id"))
    quantity = Column(Integer, nullable=False)
    status = Column(String(50), default="PENDING")

    job = relationship("Job", back_populates="items")
    product = relationship("Product")
    position = relationship("Position")
