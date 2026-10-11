from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database.connection import get_db
from app.core.dependencies import get_current_active_user, get_current_active_manager
from app.models.user import User
from app.models.warehouse import Warehouse, Zone, Rack, Row, Position
from app.models.inventory import Inventory
from app.schemas.warehouse import WarehouseResponse
from pydantic import BaseModel
from sqlalchemy.orm import joinedload

class WarehouseCreate(BaseModel):
    name: str
    address: Optional[str] = None
    capacity: Optional[int] = None
    unit: Optional[str] = None

router = APIRouter()

class PositionUpdate(BaseModel):
    capacity: int
    storage_type: Optional[str] = None
    allowed_categories: Optional[str] = None
    status: Optional[str] = None

class PositionCreate(BaseModel):
    row_id: int
    position_code: str
    capacity: int = 100
    storage_type: Optional[str] = None

class ZoneCreate(BaseModel):
    warehouse_id: int
    name: str
    storage_type: Optional[str] = None

class RackCreate(BaseModel):
    zone_id: int
    name: str
    rack_type: Optional[str] = None

class RowCreate(BaseModel):
    rack_id: int
    name: str
    row_number: int

@router.get("", response_model=List[WarehouseResponse])
def get_warehouses(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    warehouses = db.query(Warehouse).filter(Warehouse.company_id == current_user.company_id).all()
    return warehouses

@router.post("", response_model=WarehouseResponse, status_code=status.HTTP_201_CREATED)
def create_warehouse(payload: WarehouseCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_manager)):
    wh = Warehouse(
        name=payload.name,
        company_id=current_user.company_id
    )
    db.add(wh)
    db.flush()
    # Create default Zone, Rack, Row, Position to mimic the map layout
    zone = Zone(warehouse_id=wh.id, name="Main Zone")
    db.add(zone)
    db.flush()
    rack = Rack(zone_id=zone.id, name="Rack 1")
    db.add(rack)
    db.flush()
    row = Row(rack_id=rack.id, name="Row A", row_number=1)
    db.add(row)
    db.flush()
    pos = Position(row_id=row.id, position_code=f"POS-{payload.name[:3]}-1", capacity=payload.capacity or 100, available_capacity=payload.capacity or 100, current_occupancy=0, status="AVAILABLE")
    db.add(pos)
    db.commit()
    db.refresh(wh)
    return wh

@router.get("/{warehouse_id}", response_model=WarehouseResponse)
def get_warehouse(warehouse_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    wh = db.query(Warehouse).filter(Warehouse.company_id == current_user.company_id, Warehouse.id == warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    return wh

@router.get("/{warehouse_id}/map")
def get_warehouse_map(warehouse_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    wh = db.query(Warehouse).filter(Warehouse.company_id == current_user.company_id, Warehouse.id == warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
        
    return {
        "id": wh.id,
        "name": wh.name,
        "zones": [
            {
                "id": z.id,
                "name": z.name,
                "storage_type": z.storage_type,
                "racks": [
                    {
                        "id": rack.id,
                        "name": rack.name,
                        "rack_type": rack.rack_type,
                        "rows_count": rack.rows_count or len(rack.rows),
                        "positions_per_row": rack.positions_per_row or (max([len(r.positions) for r in rack.rows]) if rack.rows else 1),
                        "rows": [
                            {
                                "id": row.id,
                                "name": row.name,
                                "row_number": row.row_number,
                                "positions": [
                                    {
                                        "id": pos.id,
                                        "code": pos.position_code,
                                        "status": pos.status,
                                        "capacity": pos.capacity,
                                        "current_occupancy": pos.current_occupancy,
                                        "available_capacity": pos.available_capacity,
                                        "storage_type": pos.storage_type,
                                        "x": pos.x,
                                        "y": pos.y,
                                        "inventory": [
                                            {
                                                "id": inv.id,
                                                "product_id": inv.product_id,
                                                "product_name": inv.product.name if inv.product else "Unknown",
                                                "product_sku": inv.product.sku if inv.product else "Unknown",
                                                "quantity": inv.quantity,
                                                "expiry_date": inv.expiry_date.strftime("%Y-%m-%d") if inv.expiry_date else None,
                                                "status": inv.status
                                            } for inv in db.query(Inventory).filter(Inventory.position_id == pos.id).all() if inv.quantity > 0
                                        ]
                                    } for pos in row.positions
                                ]
                            } for row in rack.rows
                        ]
                    } for rack in z.racks
                ]
            } for z in wh.zones
        ]
    }

@router.post("/zones", status_code=status.HTTP_201_CREATED)
def create_zone(payload: ZoneCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_manager)):
    wh = db.query(Warehouse).filter_by(id=payload.warehouse_id, company_id=current_user.company_id).first()
    if not wh: raise HTTPException(status_code=404, detail="Warehouse not found")
    zone = Zone(warehouse_id=wh.id, name=payload.name, storage_type=payload.storage_type)
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return {"id": zone.id, "name": zone.name}

@router.post("/racks", status_code=status.HTTP_201_CREATED)
def create_rack(payload: RackCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_manager)):
    zone = db.query(Zone).join(Warehouse).filter(Zone.id == payload.zone_id, Warehouse.company_id == current_user.company_id).first()
    if not zone: raise HTTPException(status_code=404, detail="Zone not found")
    rack = Rack(zone_id=zone.id, name=payload.name, rack_type=payload.rack_type)
    db.add(rack)
    db.commit()
    db.refresh(rack)
    return {"id": rack.id, "name": rack.name}

@router.post("/rows", status_code=status.HTTP_201_CREATED)
def create_row(payload: RowCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_manager)):
    rack = db.query(Rack).join(Zone).join(Warehouse).filter(Rack.id == payload.rack_id, Warehouse.company_id == current_user.company_id).first()
    if not rack: raise HTTPException(status_code=404, detail="Rack not found")
    row = Row(rack_id=rack.id, name=payload.name, row_number=payload.row_number)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "name": row.name}

@router.post("/positions", status_code=status.HTTP_201_CREATED)
def create_position(payload: PositionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_manager)):
    # Verify row exists and belongs to company
    row = db.query(Row).join(Rack).join(Zone).join(Warehouse).filter(
        Row.id == payload.row_id,
        Warehouse.company_id == current_user.company_id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Row not found")
        
    pos = Position(
        row_id=row.id,
        position_code=payload.position_code,
        capacity=payload.capacity,
        available_capacity=payload.capacity,
        current_occupancy=0,
        status="AVAILABLE",
        storage_type=payload.storage_type
    )
    db.add(pos)
    db.commit()
    db.refresh(pos)
    return pos

@router.put("/positions/{position_id}")
def update_position(position_id: int, payload: PositionUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_manager)):
    pos = db.query(Position).join(Row).join(Rack).join(Zone).join(Warehouse).filter(
        Position.id == position_id,
        Warehouse.company_id == current_user.company_id
    ).first()
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")
        
    # Validation: capacity cannot be less than current_occupancy
    if payload.capacity < pos.current_occupancy:
        raise HTTPException(status_code=400, detail="Capacity cannot be less than currently occupied capacity.")
        
    pos.capacity = payload.capacity
    pos.available_capacity = pos.capacity - pos.current_occupancy
    if payload.storage_type is not None:
        pos.storage_type = payload.storage_type
    if payload.allowed_categories is not None:
        pos.allowed_categories = payload.allowed_categories
    if payload.status is not None:
        pos.status = payload.status
        
    db.commit()
    db.refresh(pos)
    return pos

from fastapi import File, UploadFile
import csv, io

@router.post("/import", status_code=200)
async def import_warehouses(preview: bool = False, file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_active_manager)):
    if not file.filename.endswith('.csv'): raise HTTPException(status_code=400, detail="Only CSV files are supported")
    content = await file.read()
    try: decoded = content.decode('utf-8-sig')
    except Exception: raise HTTPException(status_code=400, detail="Invalid file encoding")
    reader = csv.DictReader(io.StringIO(decoded))
    
    stats = {
        "warehouses": 0,
        "zones": 0,
        "racks": 0,
        "rows": 0,
        "positions": 0,
        "updated": 0
    }
    skipped = 0
    errors = []
    
    field_map = {col.strip().lower(): col for col in reader.fieldnames if col} if reader.fieldnames else {}
    wh_col = field_map.get('warehouse') or field_map.get('warehouse_name') or field_map.get('warehouse_code')
    z_col = field_map.get('zone') or field_map.get('zone_name') or field_map.get('zone_code')
    rk_col = field_map.get('rack') or field_map.get('rack_name') or field_map.get('rack_code')
    rw_col = field_map.get('row') or field_map.get('row_name')
    pos_col = field_map.get('position') or field_map.get('position_code')
    cap_col = field_map.get('capacity')
    st_col = field_map.get('status')

    try:
        for row_num, raw_r in enumerate(reader, start=1):
            if not any(raw_r.values()):
                continue
                
            r = {k.strip().lower(): v for k, v in raw_r.items() if k}
            wh_name = (r.get(wh_col.strip().lower()) or '').strip() if wh_col else ''
            z_name = (r.get(z_col.strip().lower()) or '').strip() if z_col else ''
            rk_name = (r.get(rk_col.strip().lower()) or '').strip() if rk_col else ''
            rw_name = (r.get(rw_col.strip().lower()) or '').strip() if rw_col else ''
            p_code = (r.get(pos_col.strip().lower()) or '').strip() if pos_col else ''
            
            try: cap = int(r.get(cap_col.strip().lower(), 100)) if cap_col else 100
            except: cap = 100
            
            if not wh_name:
                wh_name = 'Main Warehouse'
            if not p_code:
                errors.append(f"Row {row_num}: Missing warehouse or position code")
                continue
                
            wh = db.query(Warehouse).filter_by(name=wh_name, company_id=current_user.company_id).first()
            if not wh:
                wh = Warehouse(name=wh_name, company_id=current_user.company_id)
                db.add(wh)
                db.flush()
                stats["warehouses"] += 1
                
            z = db.query(Zone).filter_by(warehouse_id=wh.id, name=z_name or 'Main Zone').first()
            if not z:
                z = Zone(warehouse_id=wh.id, name=z_name or 'Main Zone')
                db.add(z)
                db.flush()
                stats["zones"] += 1
                
            rk = db.query(Rack).filter_by(zone_id=z.id, name=rk_name or 'Rack 1').first()
            if not rk:
                rk = Rack(zone_id=z.id, name=rk_name or 'Rack 1')
                db.add(rk)
                db.flush()
                stats["racks"] += 1
                
            rw = db.query(Row).filter_by(rack_id=rk.id, name=rw_name or 'Row A').first()
            if not rw:
                rw = Row(rack_id=rk.id, name=rw_name or 'Row A', row_number=1)
                db.add(rw)
                db.flush()
                stats["rows"] += 1
                
            pos = db.query(Position).filter_by(row_id=rw.id, position_code=p_code).first()
            st = r.get('status', '').strip().upper()
            if not pos:
                pos = Position(
                    row_id=rw.id, 
                    position_code=p_code, 
                    capacity=cap, 
                    available_capacity=cap, 
                    current_occupancy=0, 
                    status=st or 'AVAILABLE'
                )
                db.add(pos)
                stats["positions"] += 1
            else:
                updated = False
                if cap != pos.capacity:
                    if cap < pos.current_occupancy:
                        errors.append(f"Row {row_num}: Cannot reduce capacity to {cap}. Current inventory is {pos.current_occupancy}.")
                    else:
                        pos.capacity = cap
                        pos.available_capacity = cap - pos.current_occupancy
                        updated = True
                
                if st and st != pos.status:
                    pos.status = st
                    updated = True
                
                if updated:
                    stats["updated"] += 1
                else:
                    skipped += 1
                
        if preview:
            db.rollback()
        else:
            db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Transaction rolled back due to error: {str(e)}")
        
    return {
        "success": True,
        "preview": preview,
        "created": stats,
        "skipped": skipped,
        "errors": errors
    }

