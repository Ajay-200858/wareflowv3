from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text, Boolean, func
from app.database.connection import Base
from sqlalchemy.orm import relationship

class ModelVersion(Base):
    __tablename__ = "model_versions"
    id = Column(Integer, primary_key=True, index=True)
    model_type = Column(String(50), nullable=False) # 'demand', 'storage', 'assignment'
    version = Column(String(50), nullable=False)
    metrics = Column(Text)
    path = Column(String(255))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ModelTrainingRun(Base):
    __tablename__ = "model_training_runs"
    id = Column(Integer, primary_key=True, index=True)
    model_type = Column(String(50))
    status = Column(String(50), default="PENDING")
    metrics = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))

class AIRecommendation(Base):
    __tablename__ = "ai_recommendations"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    model_type = Column(String(50)) # 'storage', 'assignment'
    model_version_id = Column(Integer, ForeignKey("model_versions.id"))
    context = Column(Text)
    recommendation = Column(Text)
    confidence = Column(Float)
    reasons = Column(Text)
    status = Column(String(50), default="PENDING") # PENDING, ACCEPTED, REJECTED, MODIFIED
    manager_decision = Column(String(50))
    decision_reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    decision_time = Column(DateTime(timezone=True))
    actual_outcome = Column(Text)
    
    # ML Placement Specific
    product_id = Column(Integer, ForeignKey("products.id"))
    recommended_position_id = Column(Integer, ForeignKey("positions.id"))
    actual_position_id = Column(Integer, ForeignKey("positions.id"))
    alternative_positions = Column(Text)
    features_used = Column(Text)
    quantity = Column(Integer)

    company = relationship("Company")
    product = relationship("Product")

class AIFeedback(Base):
    __tablename__ = "ai_feedback"
    id = Column(Integer, primary_key=True, index=True)
    recommendation_id = Column(Integer, ForeignKey("ai_recommendations.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    decision = Column(String(50))
    reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    recommendation = relationship("AIRecommendation")
    user = relationship("User")
