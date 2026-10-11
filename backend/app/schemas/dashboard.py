from pydantic import BaseModel
from typing import List, Dict, Any

class DashboardOverview(BaseModel):
    products: int
    orders: int
    employees: int
    storage_capacity: int
    storage_occupancy: int
    occupancy_percentage: float
    pending_ai_decisions: int
    today_picking: int
    today_packing: int
    today_deliveries: int
    delayed_orders: int
    alerts: List[str]
    employee_workloads: List[Dict[str, Any]]
