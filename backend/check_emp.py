from app.database.connection import SessionLocal
from app.models.company import Company
from app.models.user import User
from app.models.employee import Employee

db = SessionLocal()
manager = db.query(User).filter(User.email == 'manager@wareflow.demo').first()
print("Manager:", manager.id, manager.company_id)

emps = db.query(Employee).limit(5).all()
for e in emps:
    print(f"Emp: {e.id}, {e.first_name}, {e.status}, {e.company_id}, user={e.user_id}")

