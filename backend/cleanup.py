from app.database.connection import SessionLocal
from app.models.company import Company
from app.models.user import User
from app.models.employee import Employee

db = SessionLocal()
users_to_delete = db.query(User).filter(User.email.like('%example.com%')).all()
for u in users_to_delete:
    emps = db.query(Employee).filter(Employee.user_id == u.id).all()
    for e in emps:
        db.delete(e)
    db.delete(u)
db.commit()
print(f"Deleted {len(users_to_delete)} users")
print(f"Deleted {len(users_to_delete)} users")
