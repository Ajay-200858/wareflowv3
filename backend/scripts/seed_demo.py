import os
import sys
import random
from datetime import datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.database.connection import SessionLocal
from app.core.security import get_password_hash
from app.models.company import Company, IndustryEnum
from app.models.user import User, RoleEnum
from app.models.warehouse import Warehouse, Zone, Rack, Row, Position
from app.models.product import Product, ProductCategory
from app.models.employee import Employee, EmployeePerformance
from app.models.inventory import Inventory
from app.models.order import Order, OrderItem, Customer
from app.models.job import Job
from app.models.sales import SalesHistory

def seed():
    db = SessionLocal()
    
    if db.query(Company).first():
        print("Database already seeded. Run reset_demo.py if you want to start fresh.")
        db.close()
        return

    print("Seeding Apex Distribution Pvt Ltd...")
    comp = Company(name="Apex Distribution Pvt Ltd", industry=IndustryEnum.DISTRIBUTION, location="Mumbai", size="Enterprise")
    db.add(comp)
    db.commit()
    db.refresh(comp)
    
    print("Creating Demo Users...")
    users = [
        User(company_id=comp.id, email="admin@wareflow.demo", hashed_password=get_password_hash("password123"), role=RoleEnum.ADMIN),
        User(company_id=comp.id, email="manager@wareflow.demo", hashed_password=get_password_hash("password123"), role=RoleEnum.MANAGER),
        User(company_id=comp.id, email="employee@wareflow.demo", hashed_password=get_password_hash("password123"), role=RoleEnum.EMPLOYEE),
    ]
    db.add_all(users)
    db.commit()
    
    print("Building Warehouse...")
    wh = Warehouse(company_id=comp.id, name="WH01", type="Cold Storage")
    db.add(wh)
    db.commit()
    db.refresh(wh)
    
    z_a = Zone(warehouse_id=wh.id, name="Zone A", storage_type="Fast Moving")
    z_b = Zone(warehouse_id=wh.id, name="Zone B", storage_type="Bulk")
    db.add_all([z_a, z_b])
    db.commit()
    
    positions = []
    for z in [z_a, z_b]:
        for i in range(1, 4):
            r = Rack(zone_id=z.id, name=f"Rack {i}", rack_type="Standard")
            db.add(r)
            db.commit()
            for j in range(1, 3):
                row = Row(rack_id=r.id, name=f"Row {j}", row_number=j)
                db.add(row)
                db.commit()
                for k in range(1, 10):
                    pos = Position(row_id=row.id, position_code=f"{z.name[5]}-R{i}-{j}-{k}", capacity=100, storage_type="Standard")
                    db.add(pos)
                    positions.append(pos)
    db.commit()

    print("Creating Categories...")
    cat_bev = ProductCategory(company_id=comp.id, name="Beverages")
    cat_snack = ProductCategory(company_id=comp.id, name="Snacks")
    db.add_all([cat_bev, cat_snack])
    db.commit()
    db.refresh(cat_bev)
    db.refresh(cat_snack)

    print("Creating Products...")
    prods = [
        Product(company_id=comp.id, category_id=cat_bev.id, sku="P-001", name="Coca-Cola 500ml", unit="Bottle", storage_requirements="Cold"),
        Product(company_id=comp.id, category_id=cat_snack.id, sku="P-002", name="Parle-G Biscuits", unit="Pack", storage_requirements="Dry"),
    ]
    db.add_all(prods)
    db.commit()
    
    print("Adding Inventory...")
    for p in prods:
        for _ in range(3):
            pos = random.choice(positions)
            inv = Inventory(
                company_id=comp.id, product_id=p.id, warehouse_id=wh.id,
                zone_id=pos.row.rack.zone.id, rack_id=pos.row.rack.id,
                row_id=pos.row.id, position_id=pos.id,
                quantity=random.randint(10, 50), available_quantity=0 # will set available
            )
            inv.available_quantity = inv.quantity
            pos.current_occupancy += inv.quantity
            pos.available_capacity = max(0, pos.capacity - pos.current_occupancy)
            db.add(inv)
    db.commit()

    print("Creating Employees...")
    emp_names = ["Arjun Kumar", "Priya N", "Karthik M", "Rahul S", "Divya R"]
    for i, name in enumerate(emp_names):
        emp = Employee(
            company_id=comp.id, first_name=name.split()[0], last_name=name.split()[1], 
            role_type="Picker", current_workload=random.randint(20, 80)
        )
        db.add(emp)
        db.commit()
        db.refresh(emp)
        perf = EmployeePerformance(
            employee_id=emp.id, jobs_completed=random.randint(10, 50), 
            accuracy=random.uniform(90.0, 100.0)
        )
        db.add(perf)
        
    print("Generating Synthetic Sales Data...")
    from generate_synthetic_data import generate_sales
    generate_sales(db, comp.id, [p.id for p in prods], [wh.id])
        
    db.commit()
    db.close()
    print("Seed complete.")

if __name__ == "__main__":
    seed()
