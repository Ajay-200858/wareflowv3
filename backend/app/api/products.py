from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from typing import List
import csv
import io
from app.database.connection import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.models.product import Product, ProductCategory
from app.schemas.product import ProductCreate, ProductResponse

router = APIRouter()

@router.get("", response_model=List[ProductResponse])
def get_products(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    products = db.query(Product).filter(Product.company_id == current_user.company_id).all()
    # Need to map to ProductResponse properly since schema has different fields
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
def get_product(product_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    product = db.query(Product).filter(Product.id == product_id, Product.company_id == current_user.company_id).first()
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
def create_product(product_in: ProductCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Check if SKU exists
    existing = db.query(Product).filter(Product.sku == product_in.sku, Product.company_id == current_user.company_id).first()
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
def update_product(product_id: int, product_in: ProductCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    product = db.query(Product).filter(Product.id == product_id, Product.company_id == current_user.company_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    # Check SKU collision if changed
    if product.sku != product_in.sku:
        existing = db.query(Product).filter(Product.sku == product_in.sku, Product.company_id == current_user.company_id).first()
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
def delete_product(product_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    product = db.query(Product).filter(Product.id == product_id, Product.company_id == current_user.company_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    product.status = "INACTIVE"
    db.commit()
    return {"status": "ok"}

@router.post("/import", status_code=200)
async def import_products(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
        
    content = await file.read()
    try:
        decoded = content.decode('utf-8-sig')
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file encoding")
        
    csv_reader = csv.DictReader(io.StringIO(decoded))
    if not csv_reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file is empty or missing headers")

    field_map = {col.strip().lower(): col for col in csv_reader.fieldnames if col}
    sku_col = field_map.get('sku') or field_map.get('product_sku') or field_map.get('item_code')
    name_col = field_map.get('name') or field_map.get('product_name') or field_map.get('title')
    cat_col = field_map.get('category') or field_map.get('category_name')
    unit_col = field_map.get('unit') or field_map.get('unit_type')
    dim_col = field_map.get('dimensions') or field_map.get('size')
    wt_col = field_map.get('weight')
    
    if not sku_col or not name_col:
        raise HTTPException(status_code=400, detail="Missing required columns: must include sku and name")

    imported_count = 0
    updated_count = 0
    errors = []
    
    for row_num, raw_row in enumerate(csv_reader, start=1):
        try:
            r = {k.strip().lower(): v for k, v in raw_row.items() if k}
            sku = (r.get(sku_col.strip().lower()) or '').strip()
            name = (r.get(name_col.strip().lower()) or '').strip()
            category_name = (r.get(cat_col.strip().lower()) or '').strip() if cat_col else ''
            
            if not sku or not name:
                errors.append(f"Row {row_num}: Missing sku or name")
                continue
                
            try:
                weight = float(r.get(wt_col.strip().lower(), 0)) if wt_col else 0.0
            except ValueError:
                weight = 0.0
                
            unit_val = (r.get(unit_col.strip().lower()) or 'pcs').strip() if unit_col else 'pcs'
            dim_val = (r.get(dim_col.strip().lower()) or '').strip() if dim_col else ''
                
            # Handle category
            category_id = None
            if category_name:
                cat = db.query(ProductCategory).filter(
                    ProductCategory.name == category_name, 
                    ProductCategory.company_id == current_user.company_id
                ).first()
                if not cat:
                    cat = ProductCategory(name=category_name, company_id=current_user.company_id)
                    db.add(cat)
                    db.flush()
                category_id = cat.id
                
            existing = db.query(Product).filter(Product.sku == sku, Product.company_id == current_user.company_id).first()
            if existing:
                existing.name = name
                if category_id:
                    existing.category_id = category_id
                existing.unit = unit_val
                existing.weight = weight
                existing.dimensions = dim_val
                updated_count += 1
            else:
                p = Product(
                    company_id=current_user.company_id,
                    category_id=category_id,
                    sku=sku,
                    name=name,
                    unit=unit_val,
                    weight=weight,
                    dimensions=dim_val,
                    storage_requirements="STANDARD",
                    status="ACTIVE"
                )
                db.add(p)
                imported_count += 1
        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")
            
    db.commit()
    return {"imported": imported_count, "updated": updated_count, "errors": errors, "skipped": len(errors)}
