# WAREFLOW GAP ANALYSIS

## OVERALL ARCHITECTURE
**Current:**
Frontend uses a fake data store (`dataService.js`) relying on `localStorage` (`wareflow_db`).
Some `apiClient.js` endpoints exist but are either incomplete or point to a FastAPI backend that has some basic endpoints stubbed out but lacks complete models and the actual MySQL database setup. ML is currently fake (e.g. `Math.random()` in `aiService.js`).

**Missing:**
- Complete SQLAlchemy models matching the requested structure.
- Actual MySQL database (`wareflow`) with tables and relationships.
- Real ML models using scikit-learn.
- End-to-end integration where the frontend *only* uses `apiClient.js` to fetch from the backend instead of `localStorage`.

**Priority:** Critical

---

## DATABASE
**Current:**
No actual database exists yet. There is an `.env` file waiting for configuration.
`models/__init__.py` is empty. 
Basic model files might exist but need complete definitions.

**Missing:**
- MySQL database creation (`wareflow`).
- Tables: `companies`, `users`, `roles`, `warehouses`, `zones`, `racks`, `warehouse_rows`, `positions`, `products`, `product_categories`, `inventory`, `inventory_movements`, `customers`, `orders`, `order_items`, `employees`, `employee_skills`, `employee_shifts`, `employee_availability`, `jobs`, `job_items`, `salary_rules`, `salary_records`, `salary_adjustments`, `employee_performance`, `sales_history`, `ai_recommendations`, `ai_feedback`, `ai_decisions`, `model_versions`, `model_training_runs`, `model_metrics`, `notifications`, `activity_logs`.
- Alembic migrations.

**Priority:** Critical

---

## AUTHENTICATION
**Current:**
Frontend has a `wf_session_data` check. The backend has a stub in `auth.py`. 

**Missing:**
- Proper hashing (e.g., passlib/bcrypt) and JWT verification in `dependencies.py` need full verification.
- Complete Company multi-tenancy enforcement (managers can only access their company's data).

**Priority:** Critical

---

## MACHINE LEARNING
**Current:**
`aiService.js` uses `Math.random()` to generate pseudo-predictions for demand forecasting and employee assignment.

**Missing:**
- Real Python ML layer using scikit-learn.
- Demand Forecasting Model (e.g., RandomForestRegressor).
- Storage Optimization scoring system.
- Employee Assignment matching algorithm.
- AI Decision History and Model Metrics tables to track actual performance and manager feedback.
- Scripts to generate training data and train the models.

**Priority:** High

---

## FRONTEND STATE & DATA LAYER
**Current:**
`dataService.js` is acting as the local database.

**Required:**
- Replace `dataService.js` usages across frontend files (e.g., `dashboard.js`, `inventory.js`, `products.js`, `warehouse.js`, `jobs.js`, `orders.js`, `employees.js`, `aiDecisions.js`) with `apiClient.js` calls.
- Make sure data updates flow through FastAPI to MySQL.
- Refresh UI upon successful API responses instead of relying on local array updates.

**Priority:** Critical

---

## DASHBOARD & REPORTS
**Current:**
Hardcoded values or local storage based.

**Missing:**
- Real aggregation queries in FastAPI.
- Live data feeding the charts.

**Priority:** High

---

## WAREHOUSE 2D MAP & STRUCTURE
**Current:**
Visually functional on the frontend but not backed by database rows.

**Missing:**
- Hierarchical database structure (Warehouse -> Zone -> Rack -> Row -> Position).
- Map rendering logic fetching from backend API.

**Priority:** High

---

## NOTIFICATIONS & ACTIVITY LOGS
**Current:**
`addNotification` and `logActivity` just append to a local array in `dataService.js`.

**Missing:**
- Backend tables and API endpoints to record events inside transactions.
- Webhooks or simple API polling to fetch new notifications.

**Priority:** Medium

---

## SETUP & SEEDING SCRIPTS
**Current:**
`seed_demo.py` and other scripts exist but likely aren't fully featured for the complex required schema and ML training.

**Missing:**
- `setup_database.py`: To check MySQL, create DB, run migrations.
- `seed_demo.py`: Fully functional realistic data (1 company, 2 warehouses, 200+ products, 500+ inventory, etc.).
- `generate_synthetic_data.py`: To generate 12-24 months of sales history for ML training.
- `train_models.py`: To train and save scikit-learn models.

**Priority:** High
