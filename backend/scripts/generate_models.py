import os

MODEL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'app', 'models'))

MODELS = {
    "__init__.py": "# Intentionally left blank\n",
    "activity.py": """from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, func
from app.database.connection import Base
from sqlalchemy.orm import relationship

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(255), nullable=False)
    entity_type = Column(String(100)) # e.g. 'Order', 'Job', 'Inventory'
    entity_id = Column(Integer)
    details = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company")
    user = relationship("User")
""",
    "ai.py": """from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text, Boolean, func
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

    company = relationship("Company")

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
""",
    "company.py": """from sqlalchemy import Column, Integer, String, DateTime, func, Enum
from app.database.connection import Base
import enum

class IndustryEnum(str, enum.Enum):
    WAREHOUSE = "Warehouse"
    DISTRIBUTION = "Distribution"
    RETAIL = "Retail"
    ECOMMERCE = "E-commerce"
    MANUFACTURING = "Manufacturing"
    WHOLESALE = "Wholesale"
    FOOD = "Food"
    PHARMA = "Pharmaceutical"
    ELECTRONICS = "Electronics"
    FASHION = "Fashion"
    OTHER = "Other"

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    industry = Column(Enum(IndustryEnum), default=IndustryEnum.OTHER)
    location = Column(String(255))
    size = Column(String(50))
    status = Column(String(50), default="ACTIVE")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
""",
    "employee.py": """from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float, func
from app.database.connection import Base
from sqlalchemy.orm import relationship

class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    role_type = Column(String(50)) # e.g. Picker, Packer, Driver
    status = Column(String(50), default="ACTIVE")
    current_workload = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company")
    user = relationship("User")
    skills = relationship("EmployeeSkill", back_populates="employee")
    shifts = relationship("EmployeeShift", back_populates="employee")
    performance = relationship("EmployeePerformance", back_populates="employee")

class EmployeeSkill(Base):
    __tablename__ = "employee_skills"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    skill_name = Column(String(100))
    level = Column(Integer, default=1)

    employee = relationship("Employee", back_populates="skills")

class EmployeeShift(Base):
    __tablename__ = "employee_shifts"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)

    employee = relationship("Employee", back_populates="shifts")

class EmployeeAvailability(Base):
    __tablename__ = "employee_availability"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    date = Column(DateTime(timezone=True))
    status = Column(String(50)) # AVAILABLE, ON_LEAVE, SICK

    employee = relationship("Employee")

class EmployeePerformance(Base):
    __tablename__ = "employee_performance"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    jobs_completed = Column(Integer, default=0)
    jobs_rejected = Column(Integer, default=0)
    on_time_rate = Column(Float, default=1.0)
    accuracy = Column(Float, default=1.0)
    overtime_hours = Column(Float, default=0.0)
    period = Column(String(50)) # e.g. '2023-10'

    employee = relationship("Employee", back_populates="performance")
""",
    "inventory.py": """from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, func
from app.database.connection import Base
from sqlalchemy.orm import relationship

class Inventory(Base):
    __tablename__ = "inventory"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"))
    zone_id = Column(Integer, ForeignKey("zones.id"))
    rack_id = Column(Integer, ForeignKey("racks.id"))
    row_id = Column(Integer, ForeignKey("warehouse_rows.id"))
    position_id = Column(Integer, ForeignKey("positions.id"))
    quantity = Column(Integer, default=0)
    reserved_quantity = Column(Integer, default=0)
    available_quantity = Column(Integer, default=0)
    expiry_date = Column(DateTime(timezone=True))
    status = Column(String(50), default="AVAILABLE")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    company = relationship("Company")
    product = relationship("Product")
    warehouse = relationship("Warehouse")
    position = relationship("Position")

class InventoryMovement(Base):
    __tablename__ = "inventory_movements"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    source_position_id = Column(Integer, ForeignKey("positions.id"), nullable=True)
    dest_position_id = Column(Integer, ForeignKey("positions.id"), nullable=True)
    quantity = Column(Integer, nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    reason = Column(String(255))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company")
    product = relationship("Product")
""",
    "job.py": """from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, func
from app.database.connection import Base
from sqlalchemy.orm import relationship

class Job(Base):
    __tablename__ = "jobs"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    type = Column(String(50), nullable=False) # PICKING, PACKING, DELIVERY, PUTAWAY
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    status = Column(String(50), default="PENDING") # PENDING, ASSIGNED, ACCEPTED, STARTED, COMPLETED, REJECTED
    priority = Column(Integer, default=1)
    estimated_duration = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))

    company = relationship("Company")
    order = relationship("Order", back_populates="jobs")
    employee = relationship("Employee")
    items = relationship("JobItem", back_populates="job")

class JobItem(Base):
    __tablename__ = "job_items"
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    position_id = Column(Integer, ForeignKey("positions.id"))
    quantity = Column(Integer, nullable=False)
    status = Column(String(50), default="PENDING")

    job = relationship("Job", back_populates="items")
    product = relationship("Product")
    position = relationship("Position")
""",
    "notification.py": """from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, func, Text
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
""",
    "order.py": """from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, func
from app.database.connection import Base
from sqlalchemy.orm import relationship

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(50))
    address = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    status = Column(String(50), default="PENDING") # PENDING, RESERVED, PICKING, PACKING, DELIVERY, COMPLETED
    priority = Column(String(50), default="NORMAL")
    delivery_address = Column(String(500))
    required_date = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))

    company = relationship("Company")
    customer = relationship("Customer")
    items = relationship("OrderItem", back_populates="order")
    jobs = relationship("Job", back_populates="order")

class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer, nullable=False)
    picked_quantity = Column(Integer, default=0)

    order = relationship("Order", back_populates="items")
    product = relationship("Product")
""",
    "product.py": """from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text, func
from app.database.connection import Base
from sqlalchemy.orm import relationship

class ProductCategory(Base):
    __tablename__ = "product_categories"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("product_categories.id"))
    sku = Column(String(100), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    unit = Column(String(50))
    weight = Column(Float)
    dimensions = Column(String(100))
    storage_requirements = Column(String(255))
    expiry_days = Column(Integer, default=0)
    status = Column(String(50), default="ACTIVE")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    company = relationship("Company")
    category = relationship("ProductCategory")
""",
    "salary.py": """from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, func, Text
from app.database.connection import Base
from sqlalchemy.orm import relationship

class SalaryRule(Base):
    __tablename__ = "salary_rules"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    role_type = Column(String(50))
    salary_model = Column(String(50)) # FIXED, WORK_BASED
    base_salary = Column(Float, default=0.0)
    picking_rate = Column(Float, default=0.0)
    packing_rate = Column(Float, default=0.0)
    delivery_rate = Column(Float, default=0.0)
    overtime_rate = Column(Float, default=0.0)

    company = relationship("Company")

class SalaryRecord(Base):
    __tablename__ = "salary_records"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    period = Column(String(50)) # e.g. '2023-10'
    base_amount = Column(Float, default=0.0)
    piece_rate_amount = Column(Float, default=0.0)
    overtime_amount = Column(Float, default=0.0)
    bonus = Column(Float, default=0.0)
    adjustments = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)
    status = Column(String(50), default="PENDING")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee")

class SalaryAdjustment(Base):
    __tablename__ = "salary_adjustments"
    id = Column(Integer, primary_key=True, index=True)
    salary_record_id = Column(Integer, ForeignKey("salary_records.id"))
    amount = Column(Float, nullable=False)
    reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    salary_record = relationship("SalaryRecord")
""",
    "sales.py": """from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, func
from app.database.connection import Base
from sqlalchemy.orm import relationship

class SalesHistory(Base):
    __tablename__ = "sales_history"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    date = Column(DateTime(timezone=True), nullable=False)
    quantity_sold = Column(Integer, default=0)
    price = Column(Float, default=0.0)
    
    company = relationship("Company")
    product = relationship("Product")
""",
    "user.py": """from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Boolean, func
from sqlalchemy.orm import relationship
from app.database.connection import Base
import enum

class RoleEnum(str, enum.Enum):
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    EMPLOYEE = "EMPLOYEE"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company")
""",
    "warehouse.py": """from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database.connection import Base

class Warehouse(Base):
    __tablename__ = "warehouses"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    name = Column(String(255), nullable=False)
    location = Column(String(255))
    type = Column(String(50))
    width = Column(Float, default=100.0)
    height = Column(Float, default=100.0)
    status = Column(String(50), default="ACTIVE")
    
    company = relationship("Company")
    zones = relationship("Zone", back_populates="warehouse", cascade="all, delete-orphan")

class Zone(Base):
    __tablename__ = "zones"
    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    name = Column(String(100), nullable=False)
    storage_type = Column(String(50))
    position_x = Column(Float, default=0.0)
    position_y = Column(Float, default=0.0)
    width = Column(Float, default=10.0)
    height = Column(Float, default=10.0)
    
    warehouse = relationship("Warehouse", back_populates="zones")
    racks = relationship("Rack", back_populates="zone", cascade="all, delete-orphan")

class Rack(Base):
    __tablename__ = "racks"
    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False)
    name = Column(String(100), nullable=False)
    rack_type = Column(String(50))
    position_x = Column(Float, default=0.0)
    position_y = Column(Float, default=0.0)
    rows_count = Column(Integer, default=1)
    positions_per_row = Column(Integer, default=1)
    status = Column(String(50), default="ACTIVE")
    
    zone = relationship("Zone", back_populates="racks")
    rows = relationship("Row", back_populates="rack", cascade="all, delete-orphan")

class Row(Base):
    __tablename__ = "warehouse_rows"
    id = Column(Integer, primary_key=True, index=True)
    rack_id = Column(Integer, ForeignKey("racks.id"), nullable=False)
    name = Column(String(100))
    row_number = Column(Integer, nullable=False)
    
    rack = relationship("Rack", back_populates="rows")
    positions = relationship("Position", back_populates="row", cascade="all, delete-orphan")

class Position(Base):
    __tablename__ = "positions"
    id = Column(Integer, primary_key=True, index=True)
    row_id = Column(Integer, ForeignKey("warehouse_rows.id"), nullable=False)
    position_code = Column(String(100), nullable=False)
    capacity = Column(Integer, default=100)
    current_occupancy = Column(Integer, default=0)
    available_capacity = Column(Integer, default=100)
    status = Column(String(50), default="AVAILABLE") # AVAILABLE, OCCUPIED, MAINTENANCE
    storage_type = Column(String(50))
    allowed_categories = Column(Text) # Comma separated
    x = Column(Float, default=0.0)
    y = Column(Float, default=0.0)
    
    row = relationship("Row", back_populates="positions")
"""
}

def write_models():
    for filename, content in MODELS.items():
        filepath = os.path.join(MODEL_DIR, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    print("Models written successfully.")

if __name__ == "__main__":
    write_models()
