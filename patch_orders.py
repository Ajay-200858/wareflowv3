import sys
import re

with open(r'backend/app/api/orders.py', 'r', encoding='utf-8') as f:
    content = f.read()

imports_add = """from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import csv
import io

from app.database.connection import get_db
from app.core.dependencies import get_current_active_user, get_current_active_manager
from app.models.user import User
from app.models.order import Order, OrderItem
from app.models.customer import Customer
from app.models.inventory import Inventory, InventoryMovement
from app.models.job import Job, JobItem
from app.models.product import Product
from app.schemas.order import OrderCreate, OrderResponse

router = APIRouter()"""

content = re.sub(r'^.*?router = APIRouter\(\)', imports_add, content, flags=re.DOTALL)

import_logic = """

@router.post("/import")
async def import_orders(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_active_manager)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    content = await file.read()
    try:
        decoded = content.decode('utf-8-sig')
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file encoding")
        
    reader = csv.DictReader(io.StringIO(decoded))
    if reader.fieldnames:
        reader.fieldnames = [str(f).strip() for f in reader.fieldnames]

    errors = []
    skipped = 0
    created_orders = 0
    created_items = 0
    
    orders_map = {}
    for row_num, row in enumerate(reader, start=1):
        if not any(row.values()): continue
        
        ref = row.get('order_reference', '').strip()
        if not ref:
            errors.append(f"Row {row_num}: Missing order_reference")
            continue
            
        if ref not in orders_map:
            orders_map[ref] = []
        orders_map[ref].append({"row_num": row_num, "data": row})
        
    for ref, rows in orders_map.items():
        try:
            with db.begin_nested():
                customer_name = rows[0]["data"].get('customer_name', '').strip()
                delivery_address = rows[0]["data"].get('delivery_address', '').strip()
                priority = rows[0]["data"].get('priority', 'NORMAL').strip().upper()
                if priority not in ['LOW', 'NORMAL', 'HIGH', 'URGENT']: priority = 'NORMAL'
                
                customer_id = None
                if customer_name:
                    cust = db.query(Customer).filter_by(company_id=current_user.company_id, name=customer_name).first()
                    if not cust:
                        cust = Customer(company_id=current_user.company_id, name=customer_name)
                        db.add(cust)
                        db.flush()
                    customer_id = cust.id
                    
                items_to_create = []
                
                for row_dict in rows:
                    row_num = row_dict["row_num"]
                    row = row_dict["data"]
                    sku = row.get('product_sku', '').strip()
                    try: qty = int(row.get('quantity', 0))
                    except: qty = 0
                    
                    if not sku or qty <= 0:
                        raise ValueError(f"Row {row_num}: Invalid product_sku or quantity")
                        
                    prod = db.query(Product).filter_by(company_id=current_user.company_id, sku=sku).first()
                    if not prod:
                        raise ValueError(f"Row {row_num}: Unknown product SKU {sku}")
                        
                    inv_records = db.query(Inventory).filter(
                        Inventory.product_id == prod.id,
                        Inventory.company_id == current_user.company_id,
                        Inventory.available_quantity > 0
                    ).order_by(Inventory.available_quantity.desc()).all()
                    
                    total_available = sum(inv.available_quantity for inv in inv_records)
                    if total_available < qty:
                        raise ValueError(f"Row {row_num}: Insufficient stock for {sku}. Required: {qty}, Available: {total_available}")
                    
                    items_to_create.append({
                        "product_id": prod.id,
                        "quantity": qty,
                        "inv_records": inv_records
                    })
                    
                new_order = Order(
                    company_id=current_user.company_id,
                    customer_id=customer_id,
                    status="RESERVED",
                    priority=priority,
                    delivery_address=delivery_address
                )
                db.add(new_order)
                db.flush()
                
                job_items = []
                for item in items_to_create:
                    new_item = OrderItem(
                        order_id=new_order.id,
                        product_id=item["product_id"],
                        quantity=item["quantity"]
                    )
                    db.add(new_item)
                    created_items += 1
                    
                    remaining_to_reserve = item["quantity"]
                    for inv in item["inv_records"]:
                        if remaining_to_reserve <= 0: break
                        
                        reserve_amount = min(inv.available_quantity, remaining_to_reserve)
                        inv.available_quantity -= reserve_amount
                        inv.reserved_quantity += reserve_amount
                        remaining_to_reserve -= reserve_amount
                        
                        job_items.append({
                            "product_id": item["product_id"],
                            "position_id": inv.position_id,
                            "quantity": reserve_amount
                        })
                        
                new_job = Job(
                    company_id=current_user.company_id,
                    type="PICKING",
                    order_id=new_order.id,
                    status="PENDING",
                    priority=1 if priority in ["HIGH", "URGENT"] else 2,
                    estimated_duration=len(job_items) * 5
                )
                db.add(new_job)
                db.flush()
                
                for ji in job_items:
                    db.add(JobItem(
                        job_id=new_job.id,
                        product_id=ji["product_id"],
                        position_id=ji["position_id"],
                        quantity=ji["quantity"],
                        status="PENDING"
                    ))
            created_orders += 1
        except ValueError as ve:
            skipped += len(rows)
            errors.append(str(ve))
        except Exception as e:
            skipped += len(rows)
            errors.append(f"Unexpected error for order {ref}: {str(e)}")

    db.commit()
    
    return {
        "success": True,
        "message": f"Successfully created {created_orders} orders.",
        "created_orders": created_orders,
        "created_items": created_items,
        "errors": errors
    }
"""

content += import_logic

with open(r'backend/app/api/orders.py', 'w', encoding='utf-8') as f:
    f.write(content)
