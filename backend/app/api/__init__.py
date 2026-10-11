from fastapi import APIRouter
from app.api import auth, dashboard, products, inventory, warehouse, orders, jobs, employees, ai, notifications

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
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
