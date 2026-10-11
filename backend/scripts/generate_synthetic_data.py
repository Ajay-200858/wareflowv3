import random
from datetime import datetime, timedelta
from app.models.sales import SalesHistory

def generate_sales(db, comp_id, prod_ids, wh_ids, days=365):
    now = datetime.now()
    sales = []
    
    for _ in range(1000): # 1000 records
        d = now - timedelta(days=random.randint(0, days))
        p = random.choice(prod_ids)
        qty = random.randint(1, 50)
        
        # Simulate some seasonal trend for P-001 (Beverages)
        if p == prod_ids[0] and d.month in [4, 5, 6]:
            qty += random.randint(20, 100)
            
        sales.append(SalesHistory(
            company_id=comp_id,
            product_id=p,
            warehouse_id=random.choice(wh_ids),
            date=d,
            quantity_sold=qty,
            price=10.0 # simplified
        ))
        
    db.add_all(sales)
