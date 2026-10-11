from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.services.caspian_service import caspian_service

def create_notification(db: Session, company_id: int, title: str, message: str, type: str, user_id: int = None):
    # Prevent duplicate if same exact unread notification exists for user/company
    existing = db.query(Notification).filter(
        Notification.company_id == company_id,
        Notification.user_id == user_id,
        Notification.title == title,
        Notification.message == message,
        Notification.is_read == False
    ).first()
    
    if existing:
        return existing
        
    notif = Notification(
        company_id=company_id,
        user_id=user_id,
        title=title,
        message=message,
        type=type
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)

    # Outbound delivery attempt via Caspian gateway
    try:
        caspian_service.dispatch(title=title, message=message)
    except Exception as e:
        # Non-blocking: external dispatch failure must never crash core operations
        pass

    return notif
