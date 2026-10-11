from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import csv
import io

from app.database.connection import get_db
from app.core.dependencies import get_current_active_user, get_current_active_manager
from app.models.user import User
from app.models.order import Order, OrderItem, Customer
from app.models.inventory import Inventory, InventoryMovement
from app.models.job import Job, JobItem
from app.models.product import Product
from app.schemas.order import OrderCreate, OrderResponse

router = APIRouter()

@router.get("", response_model=List[OrderResponse])
def get_orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    orders = db.query(Order).filter(Order.company_id == current_user.company_id).all()
    result = []
    for o in orders:
        items = []
        for i in o.items:
            items.append({
                "id": i.id,
                "product_id": i.product_id,
                "quantity": i.quantity,
                "picked_quantity": i.picked_quantity,
                "packed_quantity": 0
            })
        result.append({
            "id": o.id,
            "status": o.status,
            "customer_id": o.customer_id,
            "delivery_address": o.delivery_address or "",
            "required_by": o.required_date,
            "created_at": o.created_at or datetime.utcnow(),
            "items": items
        })
    return result

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
    jobs_to_assign = []
    
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
                jobs_to_assign.append(new_job.id)
            created_orders += 1
        except ValueError as ve:
            skipped += len(rows)
            errors.append(str(ve))
        except Exception as e:
            skipped += len(rows)
            errors.append(f"Unexpected error for order {ref}: {str(e)}")

    db.commit()
    
    try:
        from app.api.ai import recommend_assignment
        for j_id in jobs_to_assign:
            try:
                recommend_assignment(j_id, db, current_user)
            except Exception as e:
                print(f"Failed to auto-generate employee assignment for imported job {j_id}:", e)
    except Exception as e:
        print("Failed to auto-generate employee assignments during order import:", e)
    
    return {
        "success": True,
        "message": f"Successfully created {created_orders} orders.",
        "created_orders": created_orders,
        "created_items": created_items,
        "skipped": skipped,
        "errors": errors
    }

@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    o = db.query(Order).filter(Order.id == order_id, Order.company_id == current_user.company_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
        
    items = []
    for i in o.items:
        items.append({
            "id": i.id,
            "product_id": i.product_id,
            "quantity": i.quantity,
            "picked_quantity": i.picked_quantity,
            "packed_quantity": 0
        })
    return {
        "id": o.id,
        "status": o.status,
        "customer_id": o.customer_id,
        "delivery_address": o.delivery_address or "",
        "required_by": o.required_date,
        "created_at": o.created_at or datetime.utcnow(),
        "items": items
    }

@router.post("", response_model=OrderResponse, status_code=201)
def create_order(payload: OrderCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # 1. Validate items
    if not payload.items:
        raise HTTPException(status_code=400, detail="Order must have at least one item")
        
    # 2. Check stock availability
    for item in payload.items:
        if item.quantity <= 0:
            raise HTTPException(status_code=400, detail="Item quantity must be positive")
            
        inv_records = db.query(Inventory).filter(
            Inventory.product_id == item.product_id,
            Inventory.company_id == current_user.company_id,
            Inventory.available_quantity > 0
        ).order_by(Inventory.available_quantity.desc()).all()
        
        total_available = sum(inv.available_quantity for inv in inv_records)
        if total_available < item.quantity:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient stock for product {item.product_id}. Required: {item.quantity}, Available: {total_available}"
            )
            
    # 3. Create Order
    new_order = Order(
        company_id=current_user.company_id,
        customer_id=payload.customer_id,
        status="RESERVED",
        priority=payload.priority,
        delivery_address=payload.delivery_address,
        required_date=payload.required_by
    )
    db.add(new_order)
    db.flush() # get new_order.id
    
    # 4. Reserve stock and create Job Items
    job_items = []
    for item in payload.items:
        # Create Order Item
        new_item = OrderItem(
            order_id=new_order.id,
            product_id=item.product_id,
            quantity=item.quantity
        )
        db.add(new_item)
        
        # Reserve stock
        remaining_to_reserve = item.quantity
        inv_records = db.query(Inventory).filter(
            Inventory.product_id == item.product_id,
            Inventory.company_id == current_user.company_id,
            Inventory.available_quantity > 0
        ).order_by(Inventory.available_quantity.desc()).all()
        
        for inv in inv_records:
            if remaining_to_reserve <= 0:
                break
                
            reserve_amount = min(inv.available_quantity, remaining_to_reserve)
            inv.available_quantity -= reserve_amount
            inv.reserved_quantity += reserve_amount
            remaining_to_reserve -= reserve_amount
            
            # Log reservation (optional) but we need to create job item for this position
            job_items.append({
                "product_id": item.product_id,
                "position_id": inv.position_id,
                "quantity": reserve_amount
            })
            
    # 5. Create Picking Job automatically
    new_job = Job(
        company_id=current_user.company_id,
        type="PICKING",
        order_id=new_order.id,
        status="PENDING",
        priority=1 if payload.priority == "HIGH" else 2,
        estimated_duration=len(job_items) * 5 # simple estimate
    )
    db.add(new_job)
    db.flush()
    
    for ji in job_items:
        db.add(JobItem(
            job_id=new_job.id,
            product_id=ji["product_id"],
            position_id=ji["position_id"],
            quantity=ji["quantity"]
        ))
        
    db.commit()
    db.refresh(new_order)
    
    try:
        from app.api.ai import recommend_assignment
        recommend_assignment(new_job.id, db, current_user)
    except Exception as e:
        print(f"Failed to auto-generate employee assignment for job {new_job.id}:", e)
    
    # Build response manually to avoid DetachedInstanceError or missing relationships
    items_resp = []
    for i in new_order.items:
        items_resp.append({
            "id": i.id,
            "product_id": i.product_id,
            "quantity": i.quantity,
            "picked_quantity": i.picked_quantity,
            "packed_quantity": 0
        })
        
    return {
        "id": new_order.id,
        "status": new_order.status,
        "customer_id": new_order.customer_id,
        "delivery_address": new_order.delivery_address or "",
        "required_by": new_order.required_date,
        "created_at": new_order.created_at or datetime.utcnow(),
        "items": items_resp
    }

@router.delete("/{order_id}", response_model=dict)
def cancel_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    order = db.query(Order).filter(Order.id == order_id, Order.company_id == current_user.company_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if order.status in ["COMPLETED", "DELIVERY", "CANCELLED"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel order in {order.status} status")
        
    # Release reservations
    # We find the job items to know which inventory positions were reserved
    jobs = db.query(Job).filter(Job.order_id == order.id).all()
    for job in jobs:
        if job.status not in ["COMPLETED", "REJECTED", "CANCELLED"]:
            for j_item in job.items:
                # Find matching inventory and release it
                inv = db.query(Inventory).filter(
                    Inventory.product_id == j_item.product_id,
                    Inventory.position_id == j_item.position_id,
                    Inventory.company_id == current_user.company_id
                ).first()
                if inv and j_item.status != "COMPLETED":
                    # Release reserved quantity
                    inv.reserved_quantity -= j_item.quantity
                    inv.available_quantity += j_item.quantity
            job.status = "CANCELLED"
            
    order.status = "CANCELLED"
    db.commit()
    
    return {"status": "success", "message": "Order cancelled and reservations released"}


