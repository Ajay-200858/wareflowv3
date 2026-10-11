# WAREFLOW ML AND DATA PIPELINE

## 1. Scope
The ML and Decision Support pipeline is implemented in `app/api/ai.py` and supports features like Demand Forecasting, Storage Optimization, and Employee Assignment.

## 2. Implementations & Fallbacks
- **Demand Forecasting**: Uses `SalesHistory` data. The system checks if sufficient historical data exists (> 10 records). If available, it loads a pre-trained scikit-learn model via `joblib`. If insufficient data is found, it automatically falls back to a rule-based moving average algorithm to prevent system failure.
- **Storage Optimization**: Evaluates product velocity (fast-moving vs. slow-moving) and recommends optimal positions (e.g., prime locations for fast-moving items, bulk storage for slow-moving items) while validating remaining position capacity.
- **Employee Assignment**: Evaluates employee skills, daily availability, and current active workload (minutes) to route jobs optimally.

## 3. Human-in-Control
All AI recommendations generate a pending record in `ai_recommendations`. Managers review the recommendation (via `/api/ai/feedback`) and explicitly accept or reject it. The business logic executes only upon manual acceptance.
