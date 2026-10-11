# WAREFLOW DATABASE DESIGN

## 1. Purpose and Architecture
The WareFlow database (`wareflow`) is a normalized, relational MySQL database designed to support multi-tenant warehouse management, operational workflows, employee management, and machine learning integration. The architecture heavily enforces company isolation by associating almost every entity directly or indirectly with a `company_id`.

## 2. Company Isolation Strategy
- **Authentication & Authorization**: Handled via JWT tokens. A user's `company_id` is embedded in their JWT token. The backend application uses this token to retrieve and filter all data, ensuring that no tenant can access another tenant's records.
- **Data Model**: The `companies` table is the root entity. Most operational tables (e.g., `warehouses`, `products`, `orders`, `employees`) contain a foreign key `company_id` referencing `companies(id)`. 

## 3. Tables and Responsibilities

### A. Core and Authentication
- `companies`: The root tenant entity.
- `users`: Stores user credentials (hashed passwords) and roles (ADMIN, MANAGER, EMPLOYEE). Linked to `companies`.

### B. Warehouse Structure
- `warehouses`: Physical warehouse locations linked to a company.
- `zones`: Sub-divisions within a warehouse.
- `racks`: Storage racks within zones.
- `warehouse_rows`: Rows on a rack.
- `positions`: Individual storage bins/positions. Tracks `capacity` and `occupancy`. This hierarchy enables exact 2D/3D map rendering and storage validations.

### C. Products and Inventory
- `product_categories`: Categorization for items.
- `products`: Product master data.
- `inventory`: Current stock levels for a product at a specific `position`.
- `inventory_movements`: Transactional log of all stock changes (receiving, picking, moving) to ensure audibility and prevent invalid states.

### D. Orders and Fulfilment
- `customers`: Customer records per company.
- `orders`: Customer orders tracking fulfillment status.
- `order_items`: Line items for each order.
- `jobs`: Operational tasks (picking, packing, etc.) linked to an order. Assigned to employees.
- `job_items`: Specific items and quantities to be processed in a job.

### E. Employees and Workforce
- `employees`: Workforce profiles linked to users.
- `employee_availability` / `employee_shifts`: Tracks when employees are working.
- `employee_skills` / `employee_performance`: Data used by ML models for optimal job routing.
- `salary_rules`, `salary_records`, `salary_adjustments`: Configurable payroll management and historical tracking of payouts and adjustments.

### F. ML and Decision Support
- `model_versions` / `model_training_runs`: Metadata tracking for trained scikit-learn/XGBoost models (paths to file artifacts, metrics).
- `ai_recommendations`: ML-generated suggestions (e.g., storage location, employee assignment).
- `ai_feedback`: Human feedback (manager acceptance/rejection) on recommendations to improve future models.
- `sales_history`: Aggregated data for demand forecasting models.

### G. Notifications and Audit
- `notifications`: In-app alerts for users (e.g., low stock, job rejections).
- `activity_logs`: Durable audit trail of important actions and the actor responsible.

## 4. Important Constraints and Considerations
- **Transactions**: Inventory updates, order state transitions, and payroll processing are wrapped in database transactions by SQLAlchemy to prevent partial commits.
- **Data Integrity**: Foreign keys define `ON DELETE CASCADE` or `RESTRICT` as appropriate to prevent orphaned records.
- **Timestamps**: Most tables include `created_at` and `updated_at` columns.
