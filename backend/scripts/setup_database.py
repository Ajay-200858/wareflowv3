import os
import sys
import pymysql

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.config import settings
from app.database.connection import engine, Base
from sqlalchemy import create_engine
import sqlalchemy

def setup_database():
    print("Checking MySQL connection and database...")
    # Connect to MySQL server without specifying the database
    # Construct URL without db name
    url = settings.database_url
    base_url = url.rsplit('/', 1)[0]
    db_name = settings.DB_NAME
    
    try:
        temp_engine = create_engine(base_url)
        with temp_engine.connect() as conn:
            conn.execute(sqlalchemy.text(f"CREATE DATABASE IF NOT EXISTS {db_name}"))
            print(f"Database '{db_name}' ensured.")
    except Exception as e:
        print(f"Error checking/creating database: {e}")
        return False
        
    print("Creating tables...")
    try:
        # Import all models to ensure they are registered with Base.metadata
        from app.models.company import Company
        from app.models.user import User
        from app.models.warehouse import Warehouse, Zone, Rack, Row, Position
        from app.models.product import Product
        from app.models.inventory import Inventory, InventoryMovement
        from app.models.order import Order, OrderItem
        from app.models.employee import Employee, EmployeeSkill, EmployeeAvailability, EmployeePerformance
        from app.models.job import Job, JobItem
        from app.models.salary import SalaryRecord, SalaryRule, SalaryAdjustment
        from app.models.ai import AIRecommendation, AIFeedback, ModelVersion, ModelTrainingRun
        from app.models.notification import Notification
        from app.models.activity import ActivityLog
        from app.models.sales import SalesHistory

        Base.metadata.create_all(bind=engine)
        print("Tables created successfully.")
    except Exception as e:
        print(f"Error creating tables: {e}")
        return False
        
    print("Database setup complete.")
    return True

if __name__ == "__main__":
    setup_database()
