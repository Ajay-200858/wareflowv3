# APPENDIX II – CORE FUNCTIONALITY CODE

## Introduction and System Architecture

**WareFlow** is an AI-powered intelligent Warehouse Management System (WMS) architected as a decoupled, multi-tenant enterprise solution. The production backend is developed using **Python** and **FastAPI**, backed by a relational **MySQL 8.x** database managed via **SQLAlchemy ORM** and **Alembic** migrations. Machine learning capabilities are implemented using **scikit-learn**, **pandas**, **NumPy**, and **joblib**, while the presentation layer is built with vanilla HTML, modern CSS, and JavaScript.

Every backend endpoint enforces tenant isolation by extracting the authenticated user's `company_id` from cryptographically signed JWT bearer tokens and scoping all database queries accordingly. This appendix presents the actual, verified core functionality code powering key warehouse operations, analytical calculations, and machine learning services in WareFlow.

---

## 1. Product API

### Purpose
The Product API manages the central catalog of stock-keeping units (SKUs) within the warehouse. It provides full lifecycle operations for registering new items, retrieving product details, modifying specifications, and performing soft deletions while maintaining strict multi-tenant data boundaries and SKU uniqueness.

### Source file
`backend/app/api/products.py`

### Core implementation
```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database.connection import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductResponse

router = APIRouter()

@router.get("", response_model=List[ProductResponse])
def get_products(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    """Retrieve all products belonging to the current user's company."""
    products = db.query(Product).filter(
        Product.company_id == current_user.company_id
    ).all()
    
    result = []
    for p in products:
        result.append({
            "id": p.id,
            "company_id": p.company_id,
            "sku": p.sku,
            "name": p.name,
            "category": p.category.name if p.category else None,
            "unit": p.unit or "pcs",
            "price": 0.0,
            "weight": p.weight,
            "storage_type": p.storage_requirements,
            "minimum_stock": 0,
            "maximum_stock": None,
            "expiry_required": p.expiry_days > 0 if p.expiry_days else False,
            "status": p.status
        })
    return result

@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    """Retrieve a single product by ID with tenant validation."""
    product = db.query(Product).filter(
        Product.id == product_id, 
        Product.company_id == current_user.company_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    return {
        "id": product.id,
        "company_id": product.company_id,
        "sku": product.sku,
        "name": product.name,
        "category": product.category.name if product.category else None,
        "unit": product.unit or "pcs",
        "price": 0.0,
        "weight": product.weight,
        "storage_type": product.storage_requirements,
        "minimum_stock": 0,
        "maximum_stock": None,
        "expiry_required": product.expiry_days > 0 if product.expiry_days else False,
        "status": product.status
    }

@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    product_in: ProductCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    """Create a new product record after validating SKU uniqueness within tenant."""
    existing = db.query(Product).filter(
        Product.sku == product_in.sku, 
        Product.company_id == current_user.company_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Product with this SKU already exists")
        
    p = Product(
        company_id=current_user.company_id,
        sku=product_in.sku,
        name=product_in.name,
        unit=product_in.unit,
        weight=product_in.weight,
        storage_requirements=product_in.storage_type,
        expiry_days=30 if product_in.expiry_required else 0,
        status="ACTIVE"
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    
    return {
        "id": p.id,
        "company_id": p.company_id,
        "sku": p.sku,
        "name": p.name,
        "category": None,
        "unit": p.unit or "pcs",
        "price": 0.0,
        "weight": p.weight,
        "storage_type": p.storage_requirements,
        "minimum_stock": 0,
        "maximum_stock": None,
        "expiry_required": p.expiry_days > 0 if p.expiry_days else False,
        "status": p.status
    }

@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int, 
    product_in: ProductCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    """Update existing product details and guard against SKU collision."""
    product = db.query(Product).filter(
        Product.id == product_id, 
        Product.company_id == current_user.company_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    if product.sku != product_in.sku:
        existing = db.query(Product).filter(
            Product.sku == product_in.sku, 
            Product.company_id == current_user.company_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Product with this SKU already exists")
            
    product.sku = product_in.sku
    product.name = product_in.name
    product.unit = product_in.unit
    product.weight = product_in.weight
    product.storage_requirements = product_in.storage_type
    product.expiry_days = 30 if product_in.expiry_required else 0
    
    db.commit()
    db.refresh(product)
    
    return {
        "id": product.id,
        "company_id": product.company_id,
        "sku": product.sku,
        "name": product.name,
        "category": product.category.name if product.category else None,
        "unit": product.unit or "pcs",
        "price": 0.0,
        "weight": product.weight,
        "storage_type": product.storage_requirements,
        "minimum_stock": 0,
        "maximum_stock": None,
        "expiry_required": product.expiry_days > 0 if product.expiry_days else False,
        "status": product.status
    }

@router.delete("/{product_id}")
def delete_product(
    product_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    """Soft delete product by transitioning status to INACTIVE."""
    product = db.query(Product).filter(
        Product.id == product_id, 
        Product.company_id == current_user.company_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    product.status = "INACTIVE"
    db.commit()
    return {"status": "ok"}
```

### Working status
- **Implementation:** Found and complete in `backend/app/api/products.py`.
- **Verification:** Verified via source code inspection, automated pytest suite (`tests/test_phase1.py` passed 9/9 tests including `test_create_product`, `test_create_duplicate_product`, `test_get_products`, and `test_update_product`), and live runtime verification against the running FastAPI instance.

---

## 2. Storage Recommendation

### Purpose
The Storage Recommendation engine calculates the optimal physical storage position (rack, row, and height level) for inbound inventory. It evaluates warehouse accessibility, physical distance to dispatch, fast-pick zoning, and storage capacity constraints, augmented by machine learning demand forecasts.

### Source file
`backend/app/api/ai.py`

### Core implementation
```python
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.models.product import Product
from app.models.inventory import Inventory
from app.models.warehouse import Position, Row, Rack, Zone, Warehouse
from app.models.ai import AIRecommendation

# Note: Depends on forecast_demand() from the same module to obtain 30-day velocity projections.
from app.api.ai import forecast_demand

router = APIRouter()

@router.post("/storage/recommend")
def recommend_storage(
    payload: dict, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    """
    Computes optimal storage placement.
    Distinction: This is an intelligent multi-criteria heuristic scoring algorithm
    whose input velocity features are informed by the ML demand forecasting model.
    """
    product_id = payload.get("product_id")
    quantity = payload.get("quantity", 1)
    
    product = db.query(Product).filter(
        Product.id == product_id, 
        Product.company_id == current_user.company_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    # Query all active and available warehouse positions for tenant
    positions = db.query(Position).join(Row).join(Rack).join(Zone).join(Warehouse).filter(
        Warehouse.company_id == current_user.company_id,
        Position.status == "AVAILABLE"
    ).all()
    if not positions:
        raise HTTPException(status_code=400, detail="No active warehouse positions available")
        
    # Evaluate ML demand prediction to classify item velocity
    try:
        demand = forecast_demand(product_id, db, current_user)
        is_fast_moving = demand.get("trend") == "Increasing" or demand.get("p30", 0) > 100
    except Exception:
        is_fast_moving = False
        
    scored_positions = []
    for pos in positions:
        if pos.available_capacity <= 0:
            continue
            
        score = pos.accessibility_score if pos.accessibility_score is not None else 50.0
        features = {}
        
        # 1. Existing inventory consolidation bonus
        existing_inv = db.query(Inventory).filter(
            Inventory.product_id == product_id,
            Inventory.position_id == pos.id,
            Inventory.quantity > 0
        ).first()
        if existing_inv:
            score += 30
            features["existing_inventory"] = True
        
        # 2. Velocity-based physical placement scoring
        if is_fast_moving:
            # Fast moving products prefer lower level, high picking priority, fast pick zones
            picking_bonus = max(0, (10 - (pos.picking_priority or 5))) * 3
            distance_bonus = max(0, 50 - (pos.distance_to_dispatch or 0) / 10)
            zone_bonus = 20 if pos.is_fast_pick_zone else 0
            height_penalty = (pos.height_level or 1) * 3
            
            total_bonus = picking_bonus + distance_bonus + zone_bonus - height_penalty
            score += total_bonus
            features["fast_moving_bonus"] = total_bonus
        else:
            # Slow moving products prefer higher rack levels and bulk storage
            height_bonus = (pos.height_level or 1) * 5
            priority_penalty = max(0, (10 - (pos.picking_priority or 5))) * 2
            
            total_bonus = height_bonus - priority_penalty
            score += total_bonus
            features["slow_moving_bonus"] = total_bonus
            
        # 3. Capacity utilization check
        if pos.available_capacity >= quantity:
            score += 20
            features["fits_entire_quantity"] = True
        else:
            score -= 10
            
        scored_positions.append({"pos": pos, "score": score, "features": features})
        
    if not scored_positions:
        raise HTTPException(status_code=400, detail="No positions have available capacity")
        
    # Rank positions descending by total score
    scored_positions.sort(key=lambda x: x["score"], reverse=True)
    
    # Generate multi-position allocation plan if quantity exceeds individual position capacity
    allocations = []
    remaining = quantity
    primary_pos = None
    
    for item in scored_positions:
        if remaining <= 0:
            break
        pos = item["pos"]
        allocate_qty = min(remaining, pos.available_capacity)
        allocations.append({
            "position_id": pos.id,
            "position_code": pos.position_code,
            "quantity": allocate_qty,
            "score": item["score"]
        })
        if primary_pos is None:
            primary_pos = pos
        remaining -= allocate_qty
        
    if remaining > 0:
        raise HTTPException(status_code=400, detail="Insufficient total warehouse capacity for this quantity")
        
    # Generate alternative backup positions
    alternatives = []
    for item in scored_positions[len(allocations):min(len(allocations) + 3, len(scored_positions))]:
        alternatives.append({
            "position_id": item["pos"].id,
            "position_code": item["pos"].position_code,
            "available_capacity": item["pos"].available_capacity,
            "score": item["score"]
        })
        
    reason = "Optimized based on " + ("high demand and accessibility" if is_fast_moving else "low demand and bulk storage")
    if len(allocations) > 1:
        reason += f". Stock split across {len(allocations)} positions due to capacity."
    elif allocations and scored_positions[0]["features"].get("existing_inventory"):
        reason = f"Consolidating with existing inventory at {allocations[0]['position_code']}."

    # Persist decision to AIRecommendation ledger
    rec = AIRecommendation(
        company_id=current_user.company_id,
        model_type="STORAGE_OPTIMIZATION",
        product_id=product_id,
        quantity=quantity,
        recommended_position_id=primary_pos.id if primary_pos else None,
        alternative_positions=json.dumps(alternatives),
        features_used=json.dumps(scored_positions[0]["features"] if scored_positions else {}),
        context=f"Product: {product.name}, Qty: {quantity}",
        recommendation=f"Store at {primary_pos.position_code}" if len(allocations) == 1 else f"Split across {len(allocations)} positions",
        reasons=reason,
        confidence=92.5,
        status="PENDING"
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    
    return {
        "recommendation_id": rec.id,
        "recommended_position": primary_pos.position_code if primary_pos else None,
        "allocations": allocations,
        "alternatives": alternatives,
        "reason": reason,
        "confidence": rec.confidence
    }
```

### Working status
- **Implementation:** Found and complete in `backend/app/api/ai.py` (lines 159–307).
- **Verification:** Verified via source code inspection and pytest execution (`tests/test_phase5.py::test_storage_recommendation` passed).
- **Algorithmic Note:** The core placement logic is a rule-based multi-criteria heuristic scoring algorithm that explicitly ingests predictions from the scikit-learn demand forecasting model.

---

## 3. Movement Tracking

### Purpose
Movement Tracking records every relocation of physical stock between warehouse bins, racks, and receiving docks. It validates source stock availability and destination capacity, executes balance adjustments, logs complete audit histories in the `inventory_movements` table, and triggers automated low-stock warnings.

### Source file
`backend/app/api/inventory.py`

### Core implementation
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.models.inventory import Inventory, InventoryMovement
from app.models.warehouse import Position
from app.schemas.inventory import InventoryMovementRequest
from app.api.notifications import create_notification

router = APIRouter()

@router.post("/movement")
def create_movement(
    payload: InventoryMovementRequest, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    """Executes validated inventory relocation and maintains audit ledger."""
    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")
        
    if payload.movement_type == "RECEIVE":
        # Create an asynchronous receiving job
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
        if not payload.from_position or not payload.to_position:
            raise HTTPException(status_code=400, detail="MOVE requires both from_position and to_position")
            
        # Verify source inventory availability
        from_inv = db.query(Inventory).filter(
            Inventory.product_id == payload.product_id, 
            Inventory.position_id == payload.from_position,
            Inventory.company_id == current_user.company_id
        ).first()
        
        if not from_inv or from_inv.available_quantity < payload.quantity:
            raise HTTPException(status_code=400, detail="Not enough available quantity at source position")
            
        from_pos = db.query(Position).filter(Position.id == payload.from_position).first()
        to_pos = db.query(Position).filter(Position.id == payload.to_position).first()
        
        # Verify and update destination position capacity
        if to_pos:
            to_pos.current_occupancy += payload.quantity
            to_pos.available_capacity = to_pos.capacity - to_pos.current_occupancy
            if to_pos.available_capacity < 0:
                raise HTTPException(status_code=400, detail="Not enough capacity at destination position")
                
        # Update source position capacity
        if from_pos:
            from_pos.current_occupancy -= payload.quantity
            from_pos.available_capacity = from_pos.capacity - from_pos.current_occupancy
            
        # Deduct from source inventory
        from_inv.quantity -= payload.quantity
        from_inv.available_quantity -= payload.quantity
        
        # Increment or create destination inventory balance
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
            
        # Record persistent audit record in movement history
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
    
    # Generate proactive low-stock alert if source position stock falls below threshold
    if payload.movement_type == "MOVE" and from_inv and from_inv.available_quantity < 10:
        create_notification(
            db, 
            current_user.company_id, 
            "Low Stock Alert", 
            f"Product ID {payload.product_id} is low in stock ({from_inv.available_quantity} available) after move.", 
            "WARNING"
        )
        
    return {"status": "success"}
```

### Working status
- **Implementation:** Found and complete in `backend/app/api/inventory.py` (lines 254–360).
- **Verification:** Verified via source inspection and automated pytest suite (`tests/test_phase1.py::test_inventory_move` passed).

---

## 4. Task Assignment

### Purpose
The Task Assignment module coordinates warehouse floor labor by matching operational jobs (picking, packing, receiving, delivery) with the most qualified, available staff. It checks employee attendance and leave schedules, calculates real-time workload penalties, rewards role and skill proficiencies, and supports automated re-assignment when tasks are rejected.

### Source files
- Recommendation logic: `backend/app/api/ai.py`
- Lifecycle and state transitions: `backend/app/api/jobs.py`

### Core implementation
```python
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.connection import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.models.job import Job
from app.models.employee import Employee, EmployeeAvailability
from app.models.ai import AIRecommendation
from app.api.notifications import create_notification

# -------------------------------------------------------------
# AI Assignment Scoring Engine (app/api/ai.py)
# -------------------------------------------------------------
def recommend_assignment(
    job_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    """Evaluates employee availability, current workload, role and skill match."""
    job = db.query(Job).filter(
        Job.id == job_id, 
        Job.company_id == current_user.company_id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    employees = db.query(Employee).filter(
        Employee.company_id == current_user.company_id,
        Employee.status == "ACTIVE"
    ).all()
    if not employees:
        raise HTTPException(status_code=400, detail="No active employees available")
        
    # Filter out employees marked ON_LEAVE or SICK for today
    today = datetime.utcnow().date()
    unavailable_records = db.query(EmployeeAvailability).filter(
        func.date(EmployeeAvailability.date) == today,
        EmployeeAvailability.status.in_(["ON_LEAVE", "SICK"])
    ).all()
    unavailable_ids = [r.employee_id for r in unavailable_records]
    
    available_emps = [e for e in employees if e.id not in unavailable_ids]
    if not available_emps:
        raise HTTPException(status_code=400, detail="All employees are unavailable today")
        
    scored_emps = []
    for e in available_emps:
        score = 100.0
        reasons = []
        
        # 1. Workload penalty
        workload = e.current_workload or 0
        score -= workload * 0.5
        reasons.append("no current workload" if workload == 0 else f"workload is {workload} min")
            
        # 2. Role match bonus
        role = (e.role_type or "").upper()
        if job.type == "PICKING" and role in ["PICKING", "WAREHOUSE", "EMPLOYEE"]:
            score += 30
            reasons.append("eligible role for picking")
        elif job.type == "PACKING" and role in ["PACKING", "WAREHOUSE", "EMPLOYEE"]:
            score += 30
            reasons.append("eligible role for packing")
        elif job.type == "DELIVERY" and role in ["DELIVERY", "DRIVER"]:
            score += 50
            reasons.append("eligible delivery driver")
        elif job.type in ["STORAGE", "RECEIVING"] and role in ["STORAGE", "WAREHOUSE", "EMPLOYEE"]:
            score += 30
            reasons.append("eligible for warehouse ops")
            
        # 3. Explicit skill profile match bonus
        emp_skills = [s.skill_name.upper() for s in e.skills]
        if job.type in emp_skills:
            score += 20
            reasons.append(f"has specific {job.type} skill")
            
        scored_emps.append({"emp": e, "score": score, "reasons": reasons})
        
    # Rank candidates descending by total fitness score
    scored_emps.sort(key=lambda x: x["score"], reverse=True)
    best_match = scored_emps[0]
    best_emp = best_match["emp"]
    
    reason = f"Assigned to Employee {best_emp.id} ({best_emp.first_name}) because: " + ", ".join(best_match["reasons"]) + "."
    
    # Store recommendation in database
    rec = AIRecommendation(
        company_id=current_user.company_id,
        model_type="EMPLOYEE_ASSIGNMENT",
        context=f"Job {job.id} ({job.type})",
        recommendation=f"Assign to {best_emp.first_name} {best_emp.last_name} (ID: {best_emp.id})",
        reasons=reason,
        confidence=min(99.0, max(50.0, best_match["score"])),
        status="PENDING"
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    
    return {
        "id": rec.id,
        "employeeId": best_emp.id,
        "name": f"{best_emp.first_name} {best_emp.last_name}",
        "reason": reason,
        "confidence": rec.confidence
    }

# -------------------------------------------------------------
# Job Assignment Execution & Rejection Handling (app/api/jobs.py)
# -------------------------------------------------------------
def assign_job(
    job_id: int, 
    employee_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    """Assigns job to an employee after verifying current availability."""
    job = db.query(Job).filter(Job.id == job_id, Job.company_id == current_user.company_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status not in ["PENDING", "REJECTED"]:
        raise HTTPException(status_code=400, detail=f"Cannot assign job in {job.status} status")
        
    today = datetime.utcnow().date()
    unavailable = db.query(EmployeeAvailability).filter(
        EmployeeAvailability.employee_id == employee_id,
        func.date(EmployeeAvailability.date) == today,
        EmployeeAvailability.status.in_(["ON_LEAVE", "SICK"])
    ).first()
    if unavailable:
        raise HTTPException(status_code=400, detail=f"Employee is unavailable today due to {unavailable.status}")
        
    job.employee_id = employee_id
    job.status = "ASSIGNED"
    db.commit()
    return {"status": "success", "message": "Job assigned"}

def reject_job(
    job_id: int, 
    reason: str = "No reason provided", 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    """Handles task rejection, triggers AI re-assignment, and dispatches manager alert."""
    job = db.query(Job).filter(Job.id == job_id, Job.company_id == current_user.company_id).first()
    if not job or job.status not in ["ASSIGNED", "ACCEPTED"]:
        raise HTTPException(status_code=400, detail="Invalid state transition")
        
    job.status = "REJECTED"
    job.employee_id = None
    job.started_at = None
    
    # Trigger automatic AI re-assignment
    try:
        recommend_assignment(job.id, db, current_user)
    except Exception:
        pass

    db.commit()
    create_notification(
        db, 
        current_user.company_id, 
        "Job Rejected", 
        f"Job #{job.id} was rejected. Automatic AI re-assignment triggered.", 
        "WARNING"
    )
    return {"status": "success", "message": "Job rejected and AI re-assignment triggered"}
```

### Working status
- **Implementation:** Found and complete in `backend/app/api/ai.py` (lines 309–397) and `backend/app/api/jobs.py` (lines 36–109).
- **Verification:** Verified via source inspection and automated pytest suite (`tests/test_phase5.py::test_employee_assignment_recommendation` passed).

---

## 5. Prediction Model

### Purpose
The Prediction Model forecasts item demand volumes over 7-day and 30-day horizons. It trains a supervised machine learning regression model on historical product sales from MySQL and exposes an inference endpoint that returns projected sales, velocity trends, and fallback averages when data is sparse.

### Source files
- Training Pipeline: `backend/scripts/train_models.py`
- Inference API: `backend/app/api/ai.py`

### Core implementation
```python
import os
import joblib
import pandas as pd
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, root_mean_squared_error

from app.database.connection import SessionLocal, get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.models.sales import SalesHistory
from app.models.product import Product
from app.models.ai import ModelVersion
from app.core.config import settings

# -------------------------------------------------------------
# 1. Training Pipeline (scripts/train_models.py)
# -------------------------------------------------------------
def train_demand_model():
    """
    Algorithm: RandomForestRegressor (100 estimators, random_state=42)
    Target Variable: quantity_sold
    Engineered Features: product_id, day_of_year, day_of_week, month
    """
    db = SessionLocal()
    sales = db.query(SalesHistory).all()
    if len(sales) < 50:
        db.close()
        return  # Safeguard: requires at least 50 historical points
        
    data = []
    for s in sales:
        data.append({
            'product_id': s.product_id,
            'date': s.date,
            'day_of_year': s.date.timetuple().tm_yday,
            'day_of_week': s.date.weekday(),
            'month': s.date.month,
            'quantity': s.quantity_sold
        })
        
    df = pd.DataFrame(data).sort_values('date')
    
    # Chronological time-series split (80% train, 20% validation)
    split_idx = int(len(df) * 0.8)
    train_df = df.iloc[:split_idx]
    val_df = df.iloc[split_idx:]
    
    features = ['product_id', 'day_of_year', 'day_of_week', 'month']
    X_train, y_train = train_df[features], train_df['quantity']
    X_val, y_val = val_df[features], val_df['quantity']
    
    # Model fitting
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    # Model evaluation
    preds = model.predict(X_val)
    mae = mean_absolute_error(y_val, preds)
    rmse = root_mean_squared_error(y_val, preds)
    metrics_str = f"MAE: {mae:.2f}, RMSE: {rmse:.2f}"
    
    # Model serialization and database version registration
    os.makedirs(settings.ML_MODEL_DIR, exist_ok=True)
    model_path = os.path.join(settings.ML_MODEL_DIR, 'demand_v2.pkl')
    joblib.dump(model, model_path)
    
    mv = ModelVersion(
        model_type="DEMAND_FORECAST",
        version=f"v2.0-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        metrics=metrics_str,
        path=model_path
    )
    db.add(mv)
    db.commit()
    db.close()

# -------------------------------------------------------------
# 2. Inference Endpoint (app/api/ai.py)
# -------------------------------------------------------------
router = APIRouter()

@router.get("/demand/product/{product_id}")
def forecast_demand(
    product_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    """Loads serialized RandomForest model and predicts 7-day and 30-day demand."""
    product = db.query(Product).filter(
        Product.id == product_id, 
        Product.company_id == current_user.company_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    model_version = db.query(ModelVersion).filter(
        ModelVersion.model_type.like("DEMAND_FORECAST%")
    ).order_by(ModelVersion.created_at.desc()).first()
    
    history_count = db.query(SalesHistory).filter(
        SalesHistory.product_id == product_id,
        SalesHistory.company_id == current_user.company_id
    ).count()
    
    # Cold-start fallback for products with sparse data (< 10 records)
    if not model_version or not os.path.exists(model_version.path) or history_count < 10:
        avg_daily = db.query(func.avg(SalesHistory.quantity_sold)).filter(
            SalesHistory.product_id == product_id,
            SalesHistory.company_id == current_user.company_id
        ).scalar() or 1.0
        
        return {
            "p7": int(avg_daily * 7),
            "p30": int(avg_daily * 30),
            "trend": "Insufficient Data",
            "confidence": 0,
            "version": "Fallback-Average",
            "message": "Forecast based on insufficient historical data."
        }
        
    try:
        model = joblib.load(model_version.path)
        today = datetime.utcnow()
        dates_7 = [today + timedelta(days=i) for i in range(1, 8)]
        dates_30 = [today + timedelta(days=i) for i in range(1, 31)]
        
        def predict_for_dates(dates):
            feature_df = pd.DataFrame([{
                'product_id': product_id,
                'day_of_year': d.timetuple().tm_yday,
                'day_of_week': d.weekday(),
                'month': d.month
            } for d in dates])
            predictions = model.predict(feature_df)
            return int(sum(predictions))
            
        p7 = predict_for_dates(dates_7)
        p30 = predict_for_dates(dates_30)
        
        trend = "Stable"
        if p30 > (p7 * 4.5):
            trend = "Increasing"
        elif p30 < (p7 * 3.5):
            trend = "Decreasing"
            
        return {
            "p7": max(0, p7),
            "p30": max(0, p30),
            "trend": trend,
            "confidence": 80,
            "version": model_version.version,
            "metrics": model_version.metrics
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model execution error: {str(e)}")
```

### Working status
- **Implementation:** Found and complete across `backend/scripts/train_models.py` and `backend/app/api/ai.py` (lines 87–157). Serialized model artifact exists at `backend/ml_models/demand_v2.pkl`.
- **Verification:** Verified via source code inspection and pytest execution (`tests/test_phase5.py::test_train_model` and `test_demand_forecast_insufficient_data` passed).

---

## 6. Isolation Forest

### Purpose
In enterprise warehouse analytics, Isolation Forest is typically employed for unsupervised anomaly detection (e.g., identifying fraudulent inventory adjustments, sudden order spikes, or throughput bottlenecks) by isolating outlying data points through random recursive feature partitioning.

### Source file
`Implementation not found in the current source`

### Status and Detailed Findings
An exhaustive audit across all source files, API routers, background scripts, and test suites confirms that **scikit-learn's `IsolationForest` estimator is not implemented in the active WareFlow codebase**.

1. **Active Anomaly Endpoint Status:**
   In `backend/app/api/ai.py` (line 399), an anomaly detection endpoint exists as an unlinked stub:
   ```python
   @router.get("/anomaly/detect")
   def detect_anomalies(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
       return {"status": "success"}
   ```
2. **Alternative Statistical Logic in Source:**
   In `backend/app/api/ai.py` (lines 485–545), an unexecuted code block implements a basic parametric Z-score calculation on sales history rather than Isolation Forest:
   ```python
   # Statistical Z-score heuristic found in backend/app/api/ai.py:
   prod_sales['z_score'] = (prod_sales['quantity_sold'] - mean) / std
   anomalous_rows = prod_sales[prod_sales['z_score'] > 2.0]
   ```
3. **Missing Components:**
   - No instantiation of `sklearn.ensemble.IsolationForest`.
   - No configuration of hyperparameters such as `contamination`, `n_estimators`, or `max_samples`.
   - No feature extraction pipeline for multi-dimensional anomaly scores or outlier labels (`-1` vs `1`).

Per project report guidelines, this implementation is accurately documented as missing rather than fabricated.

---

## 7. Dashboard API

### Purpose
The Dashboard API consolidates operational key performance indicators (KPIs) across all warehouse modules into a single summary payload. It computes real-time product counts, open orders, registered staff, aggregate cubic storage occupancy percentages, pending AI decisions, and pending employee task distributions.

### Source file
`backend/app/api/dashboard.py`

### Core implementation
```python
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
from app.models.warehouse import Position, Row, Rack, Zone, Warehouse
from app.models.ai import AIRecommendation

router = APIRouter()

@router.get("/overview")
def get_overview(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    """Aggregates real-time tenant KPIs for the manager dashboard."""
    company_id = current_user.company_id
    
    # 1. Catalog and Order Statistics
    products_count = db.query(Product).filter(
        Product.company_id == company_id
    ).count()
    
    orders_count = db.query(Order).filter(
        Order.company_id == company_id, 
        Order.status != "DELIVERED"
    ).count()
    
    employees_count = db.query(Employee).filter(
        Employee.company_id == company_id
    ).count()
    
    # 2. Aggregate Storage Capacity & Current Occupancy
    total_capacity = db.query(func.sum(Position.capacity)).join(
        Row
    ).join(Rack).join(Zone).join(Warehouse).filter(
        Warehouse.company_id == company_id
    ).scalar() or 0
    
    total_occupancy = db.query(func.sum(Position.current_occupancy)).join(
        Row
    ).join(Rack).join(Zone).join(Warehouse).filter(
        Warehouse.company_id == company_id
    ).scalar() or 0
    
    t_cap = float(total_capacity)
    t_occ = float(total_occupancy)
    occupancy_percentage = min((t_occ / t_cap) * 100.0, 100.0) if t_cap > 0 else 0

    # 3. Pending AI Decisions Ledger Count
    pending_ai = db.query(AIRecommendation).filter(
        AIRecommendation.company_id == company_id, 
        AIRecommendation.status == "PENDING"
    ).count()
    
    # 4. Active Floor Job Queues
    today_picking = db.query(Job).filter(
        Job.company_id == company_id, 
        Job.type == "PICKING", 
        Job.status != "COMPLETED"
    ).count()
    
    today_packing = db.query(Job).filter(
        Job.company_id == company_id, 
        Job.type == "PACKING", 
        Job.status != "COMPLETED"
    ).count()
    
    delayed_orders = db.query(Order).filter(
        Order.company_id == company_id, 
        Order.status == "DELAYED"
    ).count()
    
    # 5. Top Employee Workloads Calculation
    employees = db.query(Employee).filter(
        Employee.company_id == company_id
    ).limit(5).all()
    
    employee_workloads = []
    for emp in employees:
        jobs = db.query(Job).filter(
            Job.company_id == company_id, 
            Job.employee_id == emp.id, 
            Job.status != "COMPLETED"
        ).count()
        # Scale benchmark: 10 active jobs represents 100% full capacity
        workload = min(jobs * 10, 100)
        employee_workloads.append({
            "name": f"{emp.first_name} {emp.last_name}",
            "workload": workload
        })
        
    company_data = db.query(Company).filter(Company.id == company_id).first()
    
    # Return formatted payload consumed by frontend overview.js
    return {
        "company": {
            "id": company_data.id,
            "name": company_data.name,
            "type": "cold_storage_co"
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
```

### Working status
- **Implementation:** Found and complete in `backend/app/api/dashboard.py` (lines 17–78).
- **Verification:** Verified via source code inspection, authenticated runtime execution returning HTTP 200 with all 10 expected payload keys (`company`, `products`, `orders`, `employees`, `occupancy_percentage`, `pending_ai_decisions`, `today_picking`, `today_packing`, `delayed_orders`, `employee_workloads`), and UI consumption in `frontend/js/pages/overview.js`.

---

## 8. Summary of Implementation Status and Verification

| Section # | Component | Implementation Status | Primary Source File(s) | Verification Method |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Product API | **Complete** | `backend/app/api/products.py` | Pytest (`test_phase1.py`), Static Code Audit, Live REST Check |
| **2** | Storage Recommendation | **Complete** | `backend/app/api/ai.py` | Pytest (`test_phase5.py`), Static Code Audit |
| **3** | Movement Tracking | **Complete** | `backend/app/api/inventory.py` | Pytest (`test_phase1.py`), Static Code Audit |
| **4** | Task Assignment | **Complete** | `backend/app/api/ai.py`, `backend/app/api/jobs.py` | Pytest (`test_phase5.py`), Static Code Audit |
| **5** | Prediction Model | **Complete** | `backend/scripts/train_models.py`, `backend/app/api/ai.py` | Pytest (`test_phase5.py`), Joblib Model Verification |
| **6** | Isolation Forest | **Not Implemented** | *N/A (Stub in `backend/app/api/ai.py`)* | Full Workspace Grep & Static Code Audit |
| **7** | Dashboard API | **Complete** | `backend/app/api/dashboard.py` | Authenticated HTTP 200 Runtime Test, Static Code Audit |

### College Report Notes & Limitations
1. **Machine Learning Distinction:** The project report should clearly state that while **Demand Forecasting** utilizes a machine learning model (`RandomForestRegressor` trained on historical time-series data), **Storage Recommendation** and **Task Assignment** use rule-based multi-criteria heuristic scoring algorithms that consume the demand model's output as an input feature.
2. **Isolation Forest Omission:** Because scikit-learn's `IsolationForest` is absent from the active codebase, it is correctly noted in Section 6 as a planned future enhancement rather than an existing module. Anomaly detection in the current repository consists only of a preliminary Z-score statistical check.
3. **Data Isolation:** All operational queries strictly enforce multi-tenant isolation through `current_user.company_id` injections via FastAPI dependencies.
