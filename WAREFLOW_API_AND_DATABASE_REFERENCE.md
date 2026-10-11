# WAREFLOW API AND DATABASE REFERENCE

## 1. API Structure
The API is served under the `/api` prefix.

### Core Endpoints:
- `POST /api/auth/login`: Authenticate user and return JWT.
- `POST /api/auth/register`: Register new company and manager.
- `GET /api/warehouses`: List company warehouses.
- `GET /api/warehouses/{id}/map`: Fetch the complete 2D warehouse capacity map.
- `POST /api/products`: Create a product.
- `POST /api/inventory/movement`: Move stock between positions.
- `GET /api/jobs`: List available or assigned jobs.
- `POST /api/jobs/{id}/complete`: Complete a task.
- `GET /api/notifications`: Retrieve in-app notifications.

## 2. Database Mapping
The database consists of 32 tables. Key entity mappings include:
- `users`, `companies` -> Authentication and Tenancy.
- `warehouses`, `zones`, `racks`, `warehouse_rows`, `positions` -> Storage Grid.
- `products`, `inventory`, `inventory_movements` -> Stock Management.
- `orders`, `order_items`, `jobs`, `job_items` -> Fulfillment Workflow.
- `notifications`, `activity_logs` -> Audit and Alerts.

Refer to `WAREFLOW_DATABASE_DESIGN.md` for strict relationship details.
