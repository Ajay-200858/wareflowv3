from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, func
from app.database.connection import Base
from sqlalchemy.orm import relationship

class EmployeeInvitation(Base):
    __tablename__ = "employee_invitations"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    invitation_code = Column(String(64), unique=True, index=True, nullable=False)
    email = Column(String(255), nullable=True)
    role_type = Column(String(50), default="Picker")
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    is_used = Column(Boolean, default=False)
    is_revoked = Column(Boolean, default=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    used_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    used_at = Column(DateTime(timezone=True), nullable=True)

    company = relationship("Company")
    warehouse = relationship("Warehouse")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    used_by = relationship("User", foreign_keys=[used_by_user_id])
