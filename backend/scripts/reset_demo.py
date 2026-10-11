import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from app.database.connection import SessionLocal, engine
from app.database.base import Base

def reset():
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("Re-creating all tables...")
    Base.metadata.create_all(bind=engine)
    print("Calling seed_demo...")
    import seed_demo
    seed_demo.seed()
    print("Database reset complete.")

if __name__ == "__main__":
    reset()
