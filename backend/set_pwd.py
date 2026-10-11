from app.database.connection import SessionLocal
from sqlalchemy import text
db = SessionLocal()
db.execute(text("UPDATE users SET hashed_password = (SELECT hashed_password FROM (SELECT hashed_password FROM users WHERE email='manager@wareflow.demo') AS temp) WHERE email='ajayselva5802008@gmail.com'"))
db.commit()
print("Success")
