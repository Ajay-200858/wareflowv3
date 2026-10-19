
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# Connect securely to Aiven MySQL using SSL.
# PyMySQL accepts ssl={} to request an encrypted connection.
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    connect_args={
        "ssl": {},
    },
)

# Create database sessions
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# Base class for SQLAlchemy models
Base = declarative_base()


# Dependency used by FastAPI endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
