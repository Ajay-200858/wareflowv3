from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, func
from app.database.connection import Base
from sqlalchemy.orm import relationship

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(255), nullable=False)
    entity_type = Column(String(100)) # e.g. 'Order', 'Job', 'Inventory'
    entity_id = Column(Integer)
    details = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company")
    user = relationship("User")
