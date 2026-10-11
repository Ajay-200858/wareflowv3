from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import api_router

app = FastAPI(
    title="WareFlow API",
    description="Backend for WareFlow Warehouse Management System",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/api/health")
def health_check():
    from app.database.connection import engine
    from sqlalchemy import text
    db_status = "disconnected"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            db_status = "connected"
    except Exception:
        pass

    return {
        "status": "ok",
        "database": db_status,
        "models": {
            "demand": "active",
            "storage": "active",
            "assignment": "active",
            "workload": "active"
        },
        "version": "1.0.0"
    }
