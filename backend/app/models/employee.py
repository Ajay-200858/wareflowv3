from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float, func
from app.database.connection import Base
from sqlalchemy.orm import relationship

class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    role_type = Column(String(50)) # e.g. Picker, Packer, Driver
    status = Column(String(50), default="ACTIVE")
    current_workload = Column(Float, default=0.0)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    employee_code = Column(String(50), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company")
    warehouse = relationship("Warehouse")
    user = relationship("User")
    skills = relationship("EmployeeSkill", back_populates="employee")
    shifts = relationship("EmployeeShift", back_populates="employee")
    performance = relationship("EmployeePerformance", back_populates="employee")
    attendance = relationship("EmployeeAttendance", back_populates="employee")

class EmployeeSkill(Base):
    __tablename__ = "employee_skills"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    skill_name = Column(String(100))
    level = Column(Integer, default=1)

    employee = relationship("Employee", back_populates="skills")

class EmployeeShift(Base):
    __tablename__ = "employee_shifts"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)

    employee = relationship("Employee", back_populates="shifts")

class EmployeeAvailability(Base):
    __tablename__ = "employee_availability"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    date = Column(DateTime(timezone=True))
    status = Column(String(50)) # AVAILABLE, ON_LEAVE, SICK

    employee = relationship("Employee")

class EmployeePerformance(Base):
    __tablename__ = "employee_performance"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    jobs_completed = Column(Integer, default=0)
    jobs_rejected = Column(Integer, default=0)
    on_time_rate = Column(Float, default=1.0)
    accuracy = Column(Float, default=1.0)
    overtime_hours = Column(Float, default=0.0)
    period = Column(String(50)) # e.g. '2023-10'

    employee = relationship("Employee", back_populates="performance")

class EmployeeAttendance(Base):
    __tablename__ = "employee_attendance"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    date = Column(DateTime(timezone=True), default=func.now())
    check_in = Column(DateTime(timezone=True), nullable=True)
    check_out = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), default="PRESENT") # PRESENT, LATE, HALF_DAY, ABSENT
    working_hours = Column(Float, default=0.0)
    notes = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee", back_populates="attendance")
    company = relationship("Company")
