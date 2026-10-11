# WareFlow Final System Report

## 1. Project Title
WareFlow

## 2. Project Objective
To provide a complete, unified warehouse management system that integrates physical space mapping, workforce management, order fulfillment, and AI-assisted operational intelligence.

## 3. Problem Statement
Modern warehouses struggle with siloed systems, leading to inefficient inventory placement, unbalanced employee workloads, and reactive rather than proactive stock management.

## 4. Proposed Solution
A multi-tenant, cloud-ready SaaS application that tracks physical inventory, predicts demand, and algorithmically recommends storage locations and employee assignments to optimize warehouse operations.

## 5. System Architecture
A decoupled client-server architecture consisting of a stateless frontend SPA communicating with a RESTful backend API.

## 6. Technology Stack
- **Frontend:** Vanilla HTML, CSS, JavaScript
- **Backend:** Python, FastAPI, SQLAlchemy
- **Database:** MySQL
- **Machine Learning:** Scikit-Learn, Pandas, NumPy

## 7. Programming Languages
- Python 3.x
- JavaScript (ES6)
- HTML5 / CSS3

## 8. Frontend Technologies
- Plain HTML5 with Semantic Tags
- Custom CSS utilizing Flexbox, CSS Variables, and responsive design
- Vanilla JS (no heavy frameworks like React or Vue)
- Fetch API for network requests

## 9. Backend Technologies
- **FastAPI**: Core API framework.
- **Uvicorn**: ASGI web server.
- **SQLAlchemy**: ORM for database mapping.
- **Alembic**: Database migration management.

## 10. Database Technology
- **MySQL**: The primary and exclusive relational database used for all data storage.

## 11. Authentication/Security
- **JWT (JSON Web Tokens)**: Used for stateless API authentication.
- **Bcrypt**: Used for hashing user passwords.
- **Role-Based Access Control (RBAC)**: Defined roles (Admin, Manager, Employee) govern endpoint access.

## 12. Database Architecture
The database follows a relational design with rigorous foreign key constraints, cascading deletes, and a `company_id` column on almost all tables to enforce tenant isolation.

## 13. Warehouse Hierarchy
The physical space is modeled precisely:
**Warehouse → Zone → Rack → Row → Position**
Each position has a defined capacity and tracks current occupancy based on actual inventory records.

## 14. Product/Inventory Workflow
Products are defined with specific SKUs, categories, and storage requirements. Inventory represents physical instances of a product residing at a specific warehouse position with tracked quantities.

## 15. Order Workflow
Customers place orders containing multiple items (OrderItems). Upon order creation, inventory is verified, and picking jobs are generated to fulfill the order requirements.

## 16. Job/Picking Workflow
Jobs map directly to physical picking, packing, or putaway tasks. Jobs are assigned to employees, who can accept or reject them. Upon job completion, inventory is officially deducted, and order statuses are updated.

## 17. Employee Workflow
Employees have defined roles, shift schedules, and availability statuses. The system calculates current workloads based on active assignments.

## 18. Salary/Payroll Workflow
Calculated programmatically by multiplying completed jobs/hours against role-specific base rates and performance multipliers.

## 19. Notification Workflow
System events (e.g., employee rejecting a job, anomaly detected) trigger notifications written to the database, readable by managers in the UI.

## 20. CSV Import Workflow
The system supports batch imports via CSV for Warehouses, Products, Employees, Inventory, and Orders. Validations occur row-by-row, rolling back upon critical transaction failures.

## 21. AI Architecture
A hybrid approach utilizing a trained machine learning model for forecasting, and deterministic heuristics/statistical logic for other optimization tasks.

## 22. Demand Forecasting
Uses a trained Random Forest Regressor to predict 7-day and 30-day demand based on historical sales data. Falls back to simple moving averages if historical data is insufficient (< 10 records).

## 23. Storage Optimization
A deterministic heuristic algorithm. It queries the demand forecast; if a product is "Fast Moving" (predicted > 100 units/mo), it is assigned to prime/empty locations. If "Slow Moving", it is assigned to bulk storage.

## 24. Employee Assignment
A rule-based algorithm. It filters active, available employees matching the required job role, and selects the individual with the lowest active workload (minutes).

## 25. Anomaly Detection
A statistical (Z-score) algorithm. It calculates the mean and standard deviation of daily sales per product. Sales exceeding 2.0 standard deviations are flagged as anomalies.

## 26. Human-in-the-Loop AI
AI recommendations (storage, assignments) are staged as `PENDING` in the database. Managers review them in the UI and can ACCEPT, REJECT, or MODIFY the actions.

## 27. Dataset Details
- **Dataset filename:** Generative via `backend/scripts/generate_synthetic_data.py`.
- **Dataset source:** Synthetic generation injected into MySQL.
- **Dataset type:** Time-series sales data.
- **Number of records:** 1000 per synthetic batch generation.
- **Number of products:** Bound to the products created for a company.
- **Date range:** Rolling 365 days from execution date.

## 28. Data Preprocessing
Historical sales data is fetched via SQLAlchemy, converted to a Pandas DataFrame, and sorted chronologically.

## 29. Feature Engineering
The exact date is decomposed into distinct features: `day_of_year`, `day_of_week`, and `month`.

## 30. Model Training
- **Algorithm:** `RandomForestRegressor(n_estimators=100, random_state=42)`
- **Target Variable:** `quantity_sold`
- **Features:** `product_id`, `day_of_year`, `day_of_week`, `month`.
- **Training Data:** 80% of data (chronological split).
- **Testing/Validation Data:** 20% of data (chronological split).

## 31. Model Evaluation
Evaluated using Mean Absolute Error (MAE) and Root Mean Squared Error (RMSE).

## 32. Model Storage
Models are serialized using `joblib` and saved to the local file system (`./ml_models`). Metadata and metrics are stored in the database's `ModelVersion` table.

## 33. API Architecture
RESTful design. Endpoints are grouped by domain (`/api/products`, `/api/orders`, etc.). Responses follow a standardized JSON format.

## 34. Frontend Architecture
Modular JavaScript. `apiClient.js` centralizes network calls. Page-specific modules (`inventory.js`, `orders.js`) handle DOM manipulation and event binding.

## 35. Role Permissions
FastAPI dependencies (`get_current_active_user`, `verify_manager`) restrict access. Employees cannot access management dashboards or payroll endpoints.

## 36. Company Isolation
The fundamental security principle. Every SQLAlchemy query filters by `company_id = current_user.company_id`.

## 37. End-to-End Workflow
Registration -> Setup Warehouse -> Import Products -> Map Inventory -> Generate/Import Orders -> AI Recommends Assignments -> Manager Approves -> Employee Completes Job -> Inventory Deducts -> Dashboard Updates.

## 38. Error Handling
Global exception handlers in FastAPI return clean JSON error details. The frontend catches these and displays UI toasts.

## 39. Testing
A comprehensive Pytest suite containing 54 tests covering Auth, Tenancy, CRUD ops, CSV Import logic, AI algorithms, and Workflow constraints.

## 40. Limitations
- ML models require explicit API calls or scripts to retrain.
- CSV imports have strict format requirements and fail entirely on malformed headers.

## 41. Future Improvements
- Automated background tasks (e.g., Celery) for nightly ML retraining.
- WebSockets for live dashboard updates instead of manual refreshes.
- Support for PostgreSQL/cloud databases.

## 42. Exact Current Implementation Status
The system is fully operational locally. The core backend logic, database persistence, ML training pipeline, API endpoints, and frontend integration are complete and functional.

---

## A. WHAT IS ACTUALLY IMPLEMENTED
- A robust FastAPI backend with strict multi-tenant isolation via MySQL.
- Full CRUD APIs for the warehouse hierarchy, products, inventory, employees, and orders.
- A functional ML training pipeline saving `RandomForestRegressor` models.
- Statistical anomaly detection and heuristic storage/assignment algorithms.
- Complete frontend integration using vanilla JS and HTML/CSS.
- Secure JWT-based authentication.
- Comprehensive CSV import functionality for all major data models.

## B. WHAT WAS FIXED DURING THIS TASK
- Replaced a misleading static string on the frontend (`index.html`) that falsely claimed data remained in the browser, accurately reflecting its integration with the live backend.

## C. WHAT WAS VERIFIED
- Execution of the full Pytest suite (54/54 tests passed).
- The exact algorithms and libraries used in the AI layer.
- The use of MySQL as the exclusive database engine.
- Proper functionality of JWT auth and company isolation.
- The synthetic dataset generation and its structural properties.

## D. WHAT IS STILL MISSING
- Production deployment scripts (e.g., Dockerfiles, CI/CD pipelines).
- Automated background scheduling for AI model retraining.

## E. WHAT SHOULD NOT BE CLAIMED
- **Do not claim** the anomaly detection is machine learning; it is purely statistical (Z-score).
- **Do not claim** storage optimization and employee assignment are machine learning; they are deterministic, rule-based heuristics.
- **Do not claim** the model achieves high real-world accuracy; it is trained on randomly generated synthetic data.
