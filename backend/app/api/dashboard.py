from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database.connection import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.models.company import Company
from app.models.order import Order
from app.models.product import Product
from app.models.job import Job
from app.models.employee import Employee
from app.models.warehouse import Position
from app.models.ai import AIRecommendation

router = APIRouter()

@router.get("/overview")
def get_overview(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    company_id = current_user.company_id
    
    # Products
    products_count = db.query(Product).filter(Product.company_id == company_id).count()
    
    # Orders
    orders_count = db.query(Order).filter(Order.company_id == company_id, Order.status != "DELIVERED").count()
    
    # Employees
    employees_count = db.query(Employee).filter(Employee.company_id == company_id).count()
    
    # Occupancy
    from app.models.warehouse import Row, Rack, Zone, Warehouse
    total_capacity = db.query(func.sum(Position.capacity)).join(Row).join(Rack).join(Zone).join(Warehouse).filter(Warehouse.company_id == company_id).scalar() or 0
    total_occupancy = db.query(func.sum(Position.current_occupancy)).join(Row).join(Rack).join(Zone).join(Warehouse).filter(Warehouse.company_id == company_id).scalar() or 0
    
    # Cast to float to avoid decimal vs float TypeError
    t_cap = float(total_capacity)
    t_occ = float(total_occupancy)
    
    occupancy_percentage = min((t_occ / t_cap) * 100.0, 100.0) if t_cap > 0 else 0

    # AI Decisions
    pending_ai = db.query(AIRecommendation).filter(AIRecommendation.company_id == company_id, AIRecommendation.status == "PENDING").count()
    
    # Jobs today
    today_picking = db.query(Job).filter(Job.company_id == company_id, Job.type == "PICKING", Job.status != "COMPLETED").count()
    today_packing = db.query(Job).filter(Job.company_id == company_id, Job.type == "PACKING", Job.status != "COMPLETED").count()
    delayed_orders = db.query(Order).filter(Order.company_id == company_id, Order.status == "DELAYED").count()
    
    # Employee workloads (mocked slightly based on assigned jobs)
    employees = db.query(Employee).filter(Employee.company_id == company_id).limit(5).all()
    employee_workloads = []
    for emp in employees:
        jobs = db.query(Job).filter(Job.company_id == company_id, Job.employee_id == emp.id, Job.status != "COMPLETED").count()
        # Assume 10 jobs is 100% workload
        workload = min(jobs * 10, 100)
        employee_workloads.append({
            "name": f"{emp.first_name} {emp.last_name}",
            "workload": workload
        })
        
    company_data = db.query(Company).filter(Company.id == company_id).first()
    
    return {
        "company": {
            "id": company_data.id,
            "name": company_data.name,
            "type": "cold_storage_co" # default type
        } if company_data else None,
        "products": products_count,
        "orders": orders_count,
        "employees": employees_count,
        "occupancy_percentage": occupancy_percentage,
        "pending_ai_decisions": pending_ai,
        "today_picking": today_picking,
        "today_packing": today_packing,
        "delayed_orders": delayed_orders,
        "employee_workloads": employee_workloads
    }
