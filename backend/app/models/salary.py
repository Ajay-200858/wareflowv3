from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, func, Text
from app.database.connection import Base
from sqlalchemy.orm import relationship

class SalaryRule(Base):
    __tablename__ = "salary_rules"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    role_type = Column(String(50))
    salary_model = Column(String(50)) # FIXED, WORK_BASED
    base_salary = Column(Float, default=0.0)
    picking_rate = Column(Float, default=0.0)
    packing_rate = Column(Float, default=0.0)
    delivery_rate = Column(Float, default=0.0)
    overtime_rate = Column(Float, default=0.0)

    company = relationship("Company")

class SalaryRecord(Base):
    __tablename__ = "salary_records"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    period = Column(String(50)) # e.g. '2023-10'
    base_amount = Column(Float, default=0.0)
    piece_rate_amount = Column(Float, default=0.0)
    overtime_amount = Column(Float, default=0.0)
    bonus = Column(Float, default=0.0)
    adjustments = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)
    status = Column(String(50), default="PENDING")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee")

class SalaryAdjustment(Base):
    __tablename__ = "salary_adjustments"
    id = Column(Integer, primary_key=True, index=True)
    salary_record_id = Column(Integer, ForeignKey("salary_records.id"))
    amount = Column(Float, nullable=False)
    reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    salary_record = relationship("SalaryRecord")
