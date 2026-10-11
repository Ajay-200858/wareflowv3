from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, func, Text
from app.database.connection import Base
from sqlalchemy.orm import relationship

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id")) # Nullable if for all managers
    title = Column(String(255))
    message = Column(Text)
    type = Column(String(50)) # INFO, WARNING, ERROR, AI_REVIEW
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company")
    user = relationship("User")
