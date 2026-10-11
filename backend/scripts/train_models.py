import os
import sys
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, root_mean_squared_error
import joblib
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.database.connection import SessionLocal
import app.database.base  # Ensures all models are registered
from app.models.sales import SalesHistory
from app.models.ai import ModelVersion
from app.core.config import settings
from sqlalchemy import func

def train_demand_model():
    print("Fetching training data from MySQL...")
    db = SessionLocal()
    sales = db.query(SalesHistory).all()
    
    if len(sales) < 50:
        print("Not enough historical data to train ML. Need at least 50 records. Currently have:", len(sales))
        db.close()
        return
        
    data = []
    for s in sales:
        data.append({
            'product_id': s.product_id,
            'date': s.date,
            'day_of_year': s.date.timetuple().tm_yday,
            'day_of_week': s.date.weekday(),
            'month': s.date.month,
            'quantity': s.quantity_sold
        })
        
    df = pd.DataFrame(data)
    df = df.sort_values('date') # Sort by date for time-series split
    
    print("Training RandomForestRegressor...")
    # Time-based split: Use 80% of earliest data for training, 20% for validation
    split_idx = int(len(df) * 0.8)
    train_df = df.iloc[:split_idx]
    val_df = df.iloc[split_idx:]
    
    features = ['product_id', 'day_of_year', 'day_of_week', 'month']
    
    X_train = train_df[features]
    y_train = train_df['quantity']
    
    X_val = val_df[features]
    y_val = val_df['quantity']
    
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    # Validation
    preds = model.predict(X_val)
    mae = mean_absolute_error(y_val, preds)
    rmse = root_mean_squared_error(y_val, preds)
    
    metrics_str = f"MAE: {mae:.2f}, RMSE: {rmse:.2f}"
    print(f"Validation Metrics: {metrics_str}")
    
    # Save model
    os.makedirs(settings.ML_MODEL_DIR, exist_ok=True)
    model_path = os.path.join(settings.ML_MODEL_DIR, 'demand_v2.pkl')
    joblib.dump(model, model_path)
    
    print("Saving model version to DB...")
    mv = ModelVersion(
        model_type="DEMAND_FORECAST",
        version=f"v2.0-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        metrics=metrics_str,
        path=model_path
    )
    db.add(mv)
    db.commit()
    db.close()
    
    print("Model trained and saved successfully.")

if __name__ == "__main__":
    train_demand_model()
