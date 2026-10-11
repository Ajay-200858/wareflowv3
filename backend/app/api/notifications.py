from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database.connection import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.models.notification import Notification
from app.schemas.notification import NotificationResponse

router = APIRouter()

@router.get("", response_model=List[NotificationResponse])
def get_notifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Get notifications either directly assigned to the user or globally for the company if user is manager
    if current_user.role in ["MANAGER", "ADMIN"]:
        notifications = db.query(Notification).filter(
            Notification.company_id == current_user.company_id
        ).order_by(Notification.created_at.desc()).limit(50).all()
    else:
        notifications = db.query(Notification).filter(
            Notification.company_id == current_user.company_id,
            Notification.user_id == current_user.id
        ).order_by(Notification.created_at.desc()).limit(50).all()
    return notifications

@router.get("/unread-count")
def get_unread_count(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role in ["MANAGER", "ADMIN"]:
        count = db.query(Notification).filter(
            Notification.company_id == current_user.company_id,
            Notification.is_read == False
        ).count()
    else:
        count = db.query(Notification).filter(
            Notification.company_id == current_user.company_id,
            Notification.user_id == current_user.id,
            Notification.is_read == False
        ).count()
    return {"count": count}

@router.post("/{notification_id}/read")
def mark_as_read(notification_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    notif = db.query(Notification).filter(Notification.id == notification_id, Notification.company_id == current_user.company_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"status": "success"}

@router.post("/read-all")
def mark_all_as_read(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role in ["MANAGER", "ADMIN"]:
        db.query(Notification).filter(
            Notification.company_id == current_user.company_id,
            Notification.is_read == False
        ).update({"is_read": True})
    else:
        db.query(Notification).filter(
            Notification.company_id == current_user.company_id,
            Notification.user_id == current_user.id,
            Notification.is_read == False
        ).update({"is_read": True})
    db.commit()
    return {"status": "success"}

@router.get("/caspian-status")
def get_caspian_status(current_user: User = Depends(get_current_active_user)):
    from app.services.caspian_service import caspian_service
    return caspian_service.get_status()

@router.post("/test-caspian")
def test_caspian_delivery(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    from app.services.caspian_service import caspian_service
    from app.services.notification_service import create_notification
    
    # 1. Create in-app notification in DB
    in_app_notif = create_notification(
        db,
        current_user.company_id,
        "Caspian Test Notification",
        "Verification probe sent to test Caspian integration lifecycle.",
        "INFO",
        current_user.id
    )

    # 2. Perform controlled external dispatch test
    dispatch_report = caspian_service.dispatch(
        title="Caspian Integration Test",
        message="Verifying outbound notification delivery through Caspian gateway."
    )

    return {
        "in_app_notification_id": in_app_notif.id,
        "in_app_created": True,
        "caspian_dispatch": dispatch_report
    }
