# Wareflow Frontend API Connection Map

## Route Mappings

| Frontend Route | JS Module | FastAPI Endpoint | HTTP Method | Data Models Involved | Operation |
|---|---|---|---|---|---|
| `#overview` | `overview.js` | `/api/dashboard/overview` | `GET` | All | Read |
| `#inventory` | `inventory.js` | `/api/inventory` | `GET`, `POST` | `InventoryItem`, `Product` | Read, Create |
| `#products` | `products.js` | `/api/products` | `GET`, `POST` | `Product` | Read, Create |
| `#warehouse` | `warehouse.js` | `/api/warehouses` <br> `/api/warehouses/{id}/map` | `GET` | `Warehouse`, `Zone`, `Rack`, `Row`, `Position` | Read |
| `#orders` | `orders.js` | `/api/orders` | `GET`, `POST` | `Order`, `OrderItem`, `InventoryItem` | Read, Create (w/ Stock check) |
| `#jobs` | `jobs.js` | `/api/jobs` <br> `/api/jobs/{id}/assign` etc. | `GET`, `PUT` | `Job`, `Employee` | Read, Update |
| `#employees` | `employees.js` | `/api/employees` | `GET`, `POST` | `Employee` | Read, Create |
| `#import` | `import.js` | (See Import Section Below) | `POST` | All | Create (Bulk) |
| `#aidecisions` | `aiDecisions.js` | `/api/ai/recommendations` <br> `/api/ai/feedback` | `GET`, `POST` | `AIRecommendation` | Read, Create |
| `#notifications` | `notifications.js` | `/api/notifications` <br> `/api/notifications/unread-count` | `GET` | `Notification` | Read |
| `#reports` | `reports.js` | N/A (Client-side rendering from Overview data) | N/A | N/A | Read |
| `#employeeportal`| `extra.js` | `/api/dashboard/overview` | `GET` | All | Read |

## CSV Import Endpoints

| Feature | Endpoint | Columns Required | Action |
|---|---|---|---|
| Warehouse | `/api/warehouses/1/import` | warehouse, zone, rack, row, position, capacity | Inserts hierarchy |
| Employees | `/api/employees/import` | first_name, last_name, email, role, skills | Inserts employees |
| Products | `/api/products/import` | sku, name, category, unit, dimensions, weight, base_price | Inserts products |
| Inventory | `/api/inventory/import` | product_sku, position_code, quantity | Inserts inventory records |
| History | `/api/ai/import-historical` | date, product_sku, quantity, total_value | Feeds training dataset |

*Note: All endpoints enforce `@get_current_active_user` and map automatically via the JWT token to the correct `company_id`.*
