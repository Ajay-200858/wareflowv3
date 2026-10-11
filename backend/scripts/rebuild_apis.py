import os

API_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'app', 'api'))

APIS = {
    "__init__.py": """from fastapi import APIRouter
from app.api import auth, dashboard, products, inventory, warehouse, orders, jobs, employees, ai

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["inventory"])
api_router.include_router(warehouse.router, prefix="/warehouses", tags=["warehouses"])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(employees.router, prefix="/employees", tags=["employees"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
""",
    "dashboard.py": """from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.models.company import Company

router = APIRouter()

@router.get("/overview")
def get_overview(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    company = db.query(Company).filter(Company.id == current_user.company_id).first()
    return {
        "company": {
            "id": company.id,
            "name": company.name,
            "industry": company.industry.value,
            "status": company.status
        }
    }

@router.post("/reset")
def reset_demo(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Safely ignoring reset logic for now
    return {"status": "ok"}
""",
    "products.py": """from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.models.product import Product

router = APIRouter()

@router.get("")
def get_products(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    products = db.query(Product).filter(Product.company_id == current_user.company_id).all()
    return [{"id": p.id, "sku": p.sku, "name": p.name, "category": p.category.name if p.category else "Other", "price": 0, "storage_type": p.storage_requirements} for p in products]

@router.post("")
def create_product(product_in: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    p = Product(
        company_id=current_user.company_id,
        sku=product_in.get("sku"),
        name=product_in.get("name"),
        storage_requirements=product_in.get("storage_type")
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p
""",
    "inventory.py": """from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.models.inventory import Inventory

router = APIRouter()

@router.get("")
def get_inventory(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    items = db.query(Inventory).filter(Inventory.company_id == current_user.company_id).all()
    return [{"id": i.id, "product_id": i.product_id, "quantity": i.quantity, "available_quantity": i.available_quantity, "position_id": i.position_id} for i in items]
""",
    "orders.py": """from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.models.order import Order

router = APIRouter()

@router.get("")
def get_orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    orders = db.query(Order).filter(Order.company_id == current_user.company_id).all()
    return [{"id": o.id, "status": o.status, "priority": o.priority} for o in orders]
""",
    "jobs.py": """from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.models.job import Job

router = APIRouter()

@router.get("")
def get_jobs(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    jobs = db.query(Job).filter(Job.company_id == current_user.company_id).all()
    return [{"id": j.id, "type": j.type, "status": j.status, "employee_id": j.employee_id} for j in jobs]
""",
    "employees.py": """from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.models.employee import Employee

router = APIRouter()

@router.get("")
def get_employees(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    employees = db.query(Employee).filter(Employee.company_id == current_user.company_id).all()
    return [{"id": e.id, "name": f"{e.first_name} {e.last_name}", "role": e.role_type, "workload": e.current_workload} for e in employees]
""",
    "ai.py": """from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.models.ai import AIRecommendation

router = APIRouter()

@router.get("/recommendations")
def get_recommendations(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    recs = db.query(AIRecommendation).filter(AIRecommendation.company_id == current_user.company_id).all()
    return [{"id": r.id, "type": r.model_type, "recommendation": r.recommendation, "status": r.status} for r in recs]
"""
}

def write_apis():
    for filename, content in APIS.items():
        filepath = os.path.join(API_DIR, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    print("APIs written successfully.")

if __name__ == "__main__":
    write_apis()
