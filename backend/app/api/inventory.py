from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.database.connection import get_db
from app.core.dependencies import get_current_active_user, get_current_active_manager
from app.models.user import User
from app.models.inventory import Inventory, InventoryMovement
from app.models.warehouse import Position, Warehouse
from app.schemas.inventory import InventoryResponse, InventoryMovementRequest
from app.services.notification_service import create_notification
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class ReceiveStockRequest(BaseModel):
    product_id: int
    warehouse_id: int
    quantity: int
    receipt_reference: Optional[str] = None

class DirectInventoryRequest(BaseModel):
    product_id: int
    position_id: int
    quantity: int

class InventoryUpdate(BaseModel):
    quantity: int

class AllocationItem(BaseModel):
    position_id: int
    quantity: int

class AllocationRequest(BaseModel):
    product_id: int
    allocations: List[AllocationItem]
    recommendation_id: Optional[int] = None
    manager_decision: Optional[str] = None
    reason: Optional[str] = None

@router.get("", response_model=List[InventoryResponse])
def get_inventory(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    items = db.query(Inventory).filter(Inventory.company_id == current_user.company_id).all()
    result = []
    for i in items:
        result.append({
            "id": i.id,
            "product_id": i.product_id,
            "warehouse_id": i.warehouse_id or 0,
            "position_id": i.position_id,
            "quantity": i.quantity,
            "available_quantity": i.available_quantity,
            "reserved_quantity": i.reserved_quantity
        })
    return result

@router.post("/direct", response_model=InventoryResponse)
def direct_inventory(payload: DirectInventoryRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    from app.models.product import Product
    from app.models.warehouse import Position, Row, Rack, Zone, Warehouse

    prod = db.query(Product).filter(Product.id == payload.product_id, Product.company_id == current_user.company_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    pos = db.query(Position).join(Row).join(Rack).join(Zone).join(Warehouse).filter(
        Position.id == payload.position_id,
        Warehouse.company_id == current_user.company_id
    ).first()
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")

    if pos.available_capacity < payload.quantity:
        raise HTTPException(status_code=400, detail=f"Cannot add {payload.quantity} units. Available capacity is {pos.available_capacity}")

    inv = db.query(Inventory).filter(
        Inventory.product_id == payload.product_id,
        Inventory.position_id == payload.position_id,
        Inventory.company_id == current_user.company_id
    ).first()

    warehouse_id = pos.row.rack.zone.warehouse_id if (pos.row and pos.row.rack and pos.row.rack.zone) else None
    zone_id = pos.row.rack.zone.id if (pos.row and pos.row.rack and pos.row.rack.zone) else None
    rack_id = pos.row.rack.id if (pos.row and pos.row.rack) else None
    row_id = pos.row.id if pos.row else None

    if inv:
        inv.quantity += payload.quantity
        inv.available_quantity += payload.quantity
    else:
        inv = Inventory(
            company_id=current_user.company_id,
            product_id=payload.product_id,
            warehouse_id=warehouse_id,
            zone_id=zone_id,
            rack_id=rack_id,
            row_id=row_id,
            position_id=payload.position_id,
            quantity=payload.quantity,
            available_quantity=payload.quantity,
            reserved_quantity=0,
            status="AVAILABLE"
        )
        db.add(inv)

    pos.current_occupancy += payload.quantity
    pos.available_capacity = max(0, pos.capacity - pos.current_occupancy)

    movement = InventoryMovement(
        company_id=current_user.company_id,
        product_id=payload.product_id,
        source_position_id=None,
        dest_position_id=pos.id,
        quantity=payload.quantity,
        employee_id=current_user.id,
        reason="Direct Stock Adjustment"
    )
    db.add(movement)
    db.commit()
    db.refresh(inv)

    return {
        "id": inv.id,
        "product_id": inv.product_id,
        "warehouse_id": inv.warehouse_id or 0,
        "position_id": inv.position_id,
        "quantity": inv.quantity,
        "available_quantity": inv.available_quantity,
        "reserved_quantity": inv.reserved_quantity
    }

@router.put("/{inventory_id}", response_model=InventoryResponse)
def update_inventory(inventory_id: int, payload: InventoryUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if payload.quantity < 0:
        raise HTTPException(status_code=400, detail="Quantity cannot be negative")
        
    inv = db.query(Inventory).filter(Inventory.id == inventory_id, Inventory.company_id == current_user.company_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Inventory record not found")
        
    diff = payload.quantity - inv.quantity
    
    # Update Position occupancy
    pos = db.query(Position).filter(Position.id == inv.position_id).first()
    if pos:
        pos.current_occupancy += diff
        pos.available_capacity = pos.capacity - pos.current_occupancy
        if pos.available_capacity < 0:
             raise HTTPException(status_code=400, detail="Cannot increase inventory beyond position capacity")
    
    # Log the movement
    movement = InventoryMovement(
        company_id=current_user.company_id,
        product_id=inv.product_id,
        source_position_id=inv.position_id if diff < 0 else None,
        dest_position_id=inv.position_id if diff > 0 else None,
        quantity=abs(diff),
        employee_id=current_user.id,
        reason="Manual Adjustment"
    )
    db.add(movement)
    
    inv.quantity = payload.quantity
    inv.available_quantity += diff
    if inv.available_quantity < 0:
         raise HTTPException(status_code=400, detail="Cannot reduce quantity below reserved quantity")
         
    db.commit()
    db.refresh(inv)
    
    if inv.available_quantity < 10:
        create_notification(db, current_user.company_id, "Low Stock Alert", f"Product ID {inv.product_id} is low in stock ({inv.available_quantity} available).", "WARNING")
        
    return {
        "id": inv.id,
        "product_id": inv.product_id,
        "warehouse_id": inv.warehouse_id or 0,
        "position_id": inv.position_id,
        "quantity": inv.quantity,
        "available_quantity": inv.available_quantity,
        "reserved_quantity": inv.reserved_quantity
    }

@router.post("/receive")
def receive_stock(payload: ReceiveStockRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_manager)):
    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")
        
    from app.models.product import Product
    product = db.query(Product).filter(Product.id == payload.product_id, Product.company_id == current_user.company_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    # Check if a staging inventory record exists for this product in this warehouse
    inv = db.query(Inventory).filter(
        Inventory.product_id == payload.product_id,
        Inventory.position_id.is_(None),
        Inventory.warehouse_id == payload.warehouse_id,
        Inventory.company_id == current_user.company_id
    ).first()
    
    if inv:
        inv.quantity += payload.quantity
        inv.available_quantity += payload.quantity
    else:
        inv = Inventory(
            company_id=current_user.company_id,
            product_id=payload.product_id,
            warehouse_id=payload.warehouse_id,
            position_id=None,
            quantity=payload.quantity,
            available_quantity=payload.quantity
        )
        db.add(inv)
        
    movement = InventoryMovement(
        company_id=current_user.company_id,
        product_id=payload.product_id,
        source_position_id=None,
        dest_position_id=None,
        quantity=payload.quantity,
        employee_id=current_user.id,
        reason=f"Stock Receipt: {payload.receipt_reference or 'N/A'}"
    )
    db.add(movement)
    db.commit()
    
    # Auto-generate AI Recommendation for put-away
    try:
        from app.api.ai import recommend_storage
        # recommend_storage takes a payload dict, db, and current_user
        recommend_storage({
            "product_id": payload.product_id, 
            "quantity": payload.quantity
        }, db, current_user)
    except Exception as e:
        print("Failed to auto-generate recommendation:", e)
    
    # Notify if needed
    create_notification(db, current_user.company_id, "Stock Received", f"Received {payload.quantity} units of {product.name}", "INFO")
    
    return {"status": "success", "message": "Stock received to staging and recommendation pending", "inventory_id": inv.id}

@router.post("/allocate")
def allocate_inventory(payload: AllocationRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    from app.models.ai import AIRecommendation
    
    # Validate product
    from app.models.product import Product
    product = db.query(Product).filter(Product.id == payload.product_id, Product.company_id == current_user.company_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    total_qty_to_add = sum(a.quantity for a in payload.allocations if a.quantity > 0)
    if total_qty_to_add <= 0:
        raise HTTPException(status_code=400, detail="Total quantity to allocate must be greater than 0")
        
    try:
        # Pre-validate all positions and capacities
        positions_map = {}
        for alloc in payload.allocations:
            if alloc.quantity <= 0:
                continue
            pos = db.query(Position).filter(Position.id == alloc.position_id).with_for_update().first()
            if not pos:
                raise HTTPException(status_code=404, detail=f"Position {alloc.position_id} not found")
            
            if pos.status == "INACTIVE":
                raise HTTPException(status_code=400, detail=f"Position {pos.position_code} is inactive")
                
            if pos.available_capacity < alloc.quantity:
                raise HTTPException(status_code=400, detail=f"Position {pos.position_code} exceeds capacity by {alloc.quantity - pos.available_capacity}")
                
            positions_map[alloc.position_id] = pos

        # Create PUT_AWAY job
        from app.models.job import Job, JobItem
        
        new_job = Job(
            company_id=current_user.company_id,
            type="PUT_AWAY",
            status="PENDING",
            priority=2,
            estimated_duration=len(payload.allocations) * 5
        )
        db.add(new_job)
        db.flush()
        
        for alloc in payload.allocations:
            if alloc.quantity <= 0:
                continue
            
            # Note: We do NOT update Position occupancy here.
            # We also do NOT update Inventory here.
            # This is handled when the PUT_AWAY job is completed.
            
            db.add(JobItem(
                job_id=new_job.id,
                product_id=payload.product_id,
                position_id=alloc.position_id,
                quantity=alloc.quantity,
                status="PENDING"
            ))

        # Update AI recommendation if provided
        if payload.recommendation_id:
            from datetime import datetime
            rec = db.query(AIRecommendation).filter(AIRecommendation.id == payload.recommendation_id).first()
            if rec:
                rec.status = payload.manager_decision or "ACCEPTED"
                rec.manager_decision = payload.manager_decision or "ACCEPTED"
                rec.decision_reason = payload.reason
                rec.decision_time = datetime.utcnow()
                rec.actual_position_id = payload.allocations[0].position_id if payload.allocations else None
                import json
                rec.actual_outcome = json.dumps([{"position_id": a.position_id, "quantity": a.quantity} for a in payload.allocations])

        db.commit()
        
        try:
            from app.api.ai import recommend_assignment
            recommend_assignment(new_job.id, db, current_user)
        except Exception as e:
            print(f"Failed to auto-generate employee assignment for job {new_job.id}:", e)
            
        return {"status": "success", "message": f"Successfully allocated {total_qty_to_add} units.", "job_id": new_job.id}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
@router.post("/movement")
def create_movement(payload: InventoryMovementRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")
        
    if payload.movement_type == "RECEIVE":
        # Instead of directly updating inventory, create a RECEIVING job
        pos = db.query(Position).filter(Position.id == payload.to_position).first()
        if pos:
            # We don't deduct capacity yet until the job completes
            pass
            
        from app.models.job import Job, JobItem
        
        new_job = Job(
            company_id=current_user.company_id,
            type="RECEIVING",
            status="PENDING",
            priority=2,
            estimated_duration=15
        )
        db.add(new_job)
        db.flush()
        
        db.add(JobItem(
            job_id=new_job.id,
            product_id=payload.product_id,
            position_id=payload.to_position,
            quantity=payload.quantity,
            status="PENDING"
        ))
        
        db.commit()
        return {"status": "success", "message": "Receiving job created"}
        
    elif payload.movement_type == "MOVE":
        # Subtract from from_position, add to to_position
        if not payload.from_position or not payload.to_position:
            raise HTTPException(status_code=400, detail="MOVE requires both from_position and to_position")
            
        from_inv = db.query(Inventory).filter(
            Inventory.product_id == payload.product_id, 
            Inventory.position_id == payload.from_position,
            Inventory.company_id == current_user.company_id
        ).first()
        
        if not from_inv or from_inv.available_quantity < payload.quantity:
            raise HTTPException(status_code=400, detail="Not enough available quantity at source position")
            
        from_pos = db.query(Position).filter(Position.id == payload.from_position).first()
        to_pos = db.query(Position).filter(Position.id == payload.to_position).first()
        
        if to_pos:
            to_pos.current_occupancy += payload.quantity
            to_pos.available_capacity = to_pos.capacity - to_pos.current_occupancy
            if to_pos.available_capacity < 0:
                raise HTTPException(status_code=400, detail="Not enough capacity at destination position")
                
        if from_pos:
            from_pos.current_occupancy -= payload.quantity
            from_pos.available_capacity = from_pos.capacity - from_pos.current_occupancy
            
        from_inv.quantity -= payload.quantity
        from_inv.available_quantity -= payload.quantity
        
        to_inv = db.query(Inventory).filter(
            Inventory.product_id == payload.product_id, 
            Inventory.position_id == payload.to_position,
            Inventory.company_id == current_user.company_id
        ).first()
        
        if not to_inv:
            to_inv = Inventory(
                company_id=current_user.company_id,
                product_id=payload.product_id,
                position_id=payload.to_position,
                quantity=payload.quantity,
                available_quantity=payload.quantity,
                reserved_quantity=0,
                warehouse_id=from_inv.warehouse_id
            )
            db.add(to_inv)
        else:
            to_inv.quantity += payload.quantity
            to_inv.available_quantity += payload.quantity
            
        movement = InventoryMovement(
            company_id=current_user.company_id,
            product_id=payload.product_id,
            source_position_id=payload.from_position,
            dest_position_id=payload.to_position,
            quantity=payload.quantity,
            employee_id=current_user.id,
            reason="Internal Move"
        )
        db.add(movement)
        
    else:
        raise HTTPException(status_code=400, detail="Unsupported movement type")
        
    db.commit()
    
    # Notify if source inventory is now low
    if payload.movement_type == "MOVE" and from_inv and from_inv.available_quantity < 10:
        create_notification(db, current_user.company_id, "Low Stock Alert", f"Product ID {payload.product_id} is low in stock ({from_inv.available_quantity} available) after move.", "WARNING")
        
    return {"status": "success"}

from fastapi import File, UploadFile
import csv, io

@router.post("/import", status_code=200)
async def import_inventory(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if not file.filename.endswith('.csv'): 
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    content = await file.read()
    try: 
        decoded = content.decode('utf-8-sig')
    except Exception: 
        raise HTTPException(status_code=400, detail="Invalid file encoding")
        
    raw_reader = csv.DictReader(io.StringIO(decoded))
    if not raw_reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file is empty or missing headers")

    # Normalize header mapping (strip whitespace, lowercase)
    field_map = {col.strip().lower(): col for col in raw_reader.fieldnames if col}
    
    # Check required columns with aliases
    sku_col = field_map.get('sku') or field_map.get('product_sku') or field_map.get('product_id')
    qty_col = field_map.get('quantity') or field_map.get('qty') or field_map.get('quantity_sold')
    wh_col = field_map.get('warehouse_code') or field_map.get('warehouse') or field_map.get('warehouse_id')
    pos_col = field_map.get('position_id') or field_map.get('position_code') or field_map.get('position')
    
    if not sku_col or not qty_col:
        raise HTTPException(status_code=400, detail="Missing required columns: must include sku (or product_id) and quantity")

    count = 0
    errors = []
    imported_items_for_ai = []
    
    from app.models.product import Product
    from app.models.warehouse import Warehouse, Position, Row, Rack, Zone
    from datetime import datetime
    
    default_wh = db.query(Warehouse).filter(Warehouse.company_id == current_user.company_id).first()
    
    for row_num, raw_row in enumerate(raw_reader, start=1):
        try:
            r = {k.strip().lower(): v for k, v in raw_row.items() if k}
            sku_val = (r.get(sku_col.strip().lower()) or '').strip()
            qty_val = (r.get(qty_col.strip().lower()) or '').strip()
            wh_val = (r.get(wh_col.strip().lower()) or '').strip() if wh_col else ''
            pos_val = (r.get(pos_col.strip().lower()) or '').strip() if pos_col else ''
            receipt_ref = r.get('receipt_reference', r.get('receipt_ref', '')).strip() or f"CSV-IMPORT-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

            if not sku_val or not qty_val:
                errors.append(f"Row {row_num}: Missing SKU or quantity")
                continue
                
            try:
                qty = int(float(qty_val))
            except ValueError:
                errors.append(f"Row {row_num}: Invalid quantity '{qty_val}'")
                continue

            if qty <= 0:
                errors.append(f"Row {row_num}: Quantity must be positive")
                continue

            # Resolve product by SKU or ID
            product = None
            if sku_val.isdigit():
                product = db.query(Product).filter(Product.id == int(sku_val), Product.company_id == current_user.company_id).first()
            if not product:
                product = db.query(Product).filter(Product.sku == sku_val, Product.company_id == current_user.company_id).first()
                
            if not product:
                errors.append(f"Row {row_num}: Product '{sku_val}' not found in database. Import products first.")
                continue

            # Resolve warehouse
            warehouse = None
            if wh_val:
                if wh_val.isdigit():
                    warehouse = db.query(Warehouse).filter(Warehouse.id == int(wh_val), Warehouse.company_id == current_user.company_id).first()
                if not warehouse:
                    warehouse = db.query(Warehouse).filter(Warehouse.name == wh_val, Warehouse.company_id == current_user.company_id).first()
            if not warehouse:
                warehouse = default_wh
                
            if not warehouse:
                errors.append(f"Row {row_num}: No warehouse found for company")
                continue

            # Resolve position if supplied
            target_pos = None
            if pos_val:
                if pos_val.isdigit():
                    target_pos = db.query(Position).join(Row).join(Rack).join(Zone).join(Warehouse).filter(
                        Position.id == int(pos_val),
                        Warehouse.company_id == current_user.company_id
                    ).first()
                if not target_pos:
                    target_pos = db.query(Position).join(Row).join(Rack).join(Zone).join(Warehouse).filter(
                        Position.position_code == pos_val,
                        Warehouse.company_id == current_user.company_id
                    ).first()

            if target_pos:
                # Direct placement into specified position
                inv = db.query(Inventory).filter_by(
                    product_id=product.id,
                    position_id=target_pos.id,
                    company_id=current_user.company_id
                ).first()
                
                warehouse_id = target_pos.row.rack.zone.warehouse_id if (target_pos.row and target_pos.row.rack and target_pos.row.rack.zone) else warehouse.id
                zone_id = target_pos.row.rack.zone.id if (target_pos.row and target_pos.row.rack and target_pos.row.rack.zone) else None
                rack_id = target_pos.row.rack.id if (target_pos.row and target_pos.row.rack) else None
                row_id = target_pos.row.id if target_pos.row else None
                
                if inv:
                    inv.quantity += qty
                    inv.available_quantity += qty
                else:
                    inv = Inventory(
                        company_id=current_user.company_id,
                        product_id=product.id,
                        warehouse_id=warehouse_id,
                        zone_id=zone_id,
                        rack_id=rack_id,
                        row_id=row_id,
                        position_id=target_pos.id,
                        quantity=qty,
                        available_quantity=qty,
                        reserved_quantity=0,
                        status="AVAILABLE"
                    )
                    db.add(inv)
                    
                target_pos.current_occupancy += qty
                target_pos.available_capacity = max(0, target_pos.capacity - target_pos.current_occupancy)
                
                movement = InventoryMovement(
                    company_id=current_user.company_id,
                    product_id=product.id,
                    source_position_id=None,
                    dest_position_id=target_pos.id,
                    quantity=qty,
                    employee_id=current_user.id,
                    reason=f"Opening Stock Allocation: {receipt_ref}"
                )
                db.add(movement)
            else:
                # Add to staging inventory (position_id is None)
                inv = db.query(Inventory).filter_by(
                    product_id=product.id, 
                    warehouse_id=warehouse.id,
                    position_id=None, 
                    company_id=current_user.company_id
                ).first()
                
                if inv:
                    inv.quantity += qty
                    inv.available_quantity += qty
                else:
                    inv = Inventory(
                        company_id=current_user.company_id,
                        product_id=product.id,
                        warehouse_id=warehouse.id,
                        position_id=None, 
                        quantity=qty,
                        available_quantity=qty,
                        reserved_quantity=0,
                        status="AVAILABLE"
                    )
                    db.add(inv)
                    
                movement = InventoryMovement(
                    company_id=current_user.company_id,
                    product_id=product.id,
                    source_position_id=None,
                    dest_position_id=None,
                    quantity=qty,
                    employee_id=current_user.id,
                    reason=f"Opening Stock (Staging): {receipt_ref}"
                )
                db.add(movement)
                imported_items_for_ai.append({"product_id": product.id, "quantity": qty})
                
            count += 1
        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")
            
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Database error during import: {str(e)}")
        
    # Auto-generate AI Recommendation for put-away for imported items
    try:
        from app.api.ai import recommend_storage
        for item in imported_items_for_ai:
            try:
                recommend_storage({
                    "product_id": item["product_id"], 
                    "quantity": item["quantity"]
                }, db, current_user)
            except Exception as e:
                print(f"Failed to auto-generate recommendation for {item['product_id']}:", e)
    except Exception as e:
        print("Failed to auto-generate recommendations during import:", e)
        
        
    return {"imported": count, "errors": errors, "skipped": len(errors)}

@router.get("/diagnostics/inventory-consistency")
def run_inventory_diagnostics(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    from app.models.product import Product
    
    inconsistencies = []
    
    # Check Position occupancy vs actual Inventory records
    positions = db.query(Position).join(Row).join(Rack).join(Zone).join(Warehouse).filter(Warehouse.company_id == current_user.company_id).all()
    inventory_items = db.query(Inventory).filter(Inventory.company_id == current_user.company_id).all()
    
    position_inv_map = {}
    for inv in inventory_items:
        position_inv_map[inv.position_id] = position_inv_map.get(inv.position_id, 0) + inv.quantity
        
    for pos in positions:
        actual_inv_sum = position_inv_map.get(pos.id, 0)
        
        if pos.current_occupancy != actual_inv_sum:
            inconsistencies.append({
                "type": "POSITION_OCCUPANCY_MISMATCH",
                "position_id": pos.id,
                "position_code": pos.position_code,
                "recorded_occupancy": pos.current_occupancy,
                "actual_inventory_sum": actual_inv_sum,
                "message": f"Position {pos.position_code} occupancy out of sync. Recorded {pos.current_occupancy}, but calculated {actual_inv_sum}."
            })
            
        if pos.current_occupancy > pos.capacity:
             inconsistencies.append({
                "type": "POSITION_CAPACITY_EXCEEDED",
                "position_id": pos.id,
                "position_code": pos.position_code,
                "capacity": pos.capacity,
                "recorded_occupancy": pos.current_occupancy,
                "message": f"Position {pos.position_code} has exceeded its capacity."
            })
            
    # Return report without modifying
    return {
        "status": "success",
        "inconsistencies_found": len(inconsistencies),
        "details": inconsistencies
    }

