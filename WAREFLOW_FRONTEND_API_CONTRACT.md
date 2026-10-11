# WAREFLOW FRONTEND API CONTRACT

This document outlines the API specifications required for Phase C (Frontend Redesign). The frontend must strictly adhere to this contract; the backend design will not be modified to accommodate frontend deviations.

## 1. Global Requirements
- **Base URL**: `http://127.0.0.1:8000/api`
- **Authentication**: All protected routes require an `Authorization` header formatted as `Bearer <JWT_TOKEN>`.
- **Content-Type**: `application/json` for all POST/PUT requests.
- **Tenancy**: The frontend MUST NOT send a `company_id` in request bodies. The backend derives this securely from the JWT.

## 2. Core Endpoints
### Authentication
- `POST /auth/login` (Body: `email`, `password`) -> Returns `access_token`, `role`.
- `POST /auth/register` (Body: `email`, `password`, `company_name`, `role`) -> Returns `access_token`.

### Warehouse & Inventory
- `GET /warehouses` -> Returns list of warehouses.
- `GET /warehouses/{id}/map` -> Returns 2D array representation of zones, racks, and positions.
- `POST /inventory/movement` (Body: `product_id`, `quantity`, `movement_type`, `to_position`) -> Records movement.

### AI & Intelligence
- `GET /ai/demand/product/{id}` -> Returns `p7` and `p30` forecast data.
- `POST /ai/storage/recommend` (Body: `product_id`, `quantity`) -> Returns optimal storage position.

### Notifications
- `GET /notifications` -> Returns list of user's notifications.

## 3. Error Handling
- **401 Unauthorized**: Token is missing, invalid, or expired. Frontend must redirect to `/login`.
- **404 Not Found**: Entity missing or belongs to a different company.
- **400 Bad Request**: Invalid transition (e.g. overcapacity). Check the `detail` string for the UI alert message.
