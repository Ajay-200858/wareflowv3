from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class AIRecommendationBase(BaseModel):
    model_type: str
    entity_type: str
    entity_id: int
    recommendation: str
    confidence: float
    explanation: str
    expires_at: Optional[datetime] = None

class AIRecommendationResponse(AIRecommendationBase):
    id: int
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class AIFeedbackCreate(BaseModel):
    recommendation_id: int
    decision: str
    reason: str
    actual_result: Optional[str] = None
