# WAREFLOW DATABASE SETUP

## 1. Prerequisites
- **Database Server**: MySQL 8.0+ (or a compatible MariaDB version).
- **Backend Environment**: Python 3.9+ with virtual environment configured.
- **Dependencies**: Listed in `backend/requirements.txt` (FastAPI, SQLAlchemy, Alembic, PyMySQL, etc.).

## 2. Configuration
The database connection is managed via environment variables. Create or modify the `backend/.env` file:

```env
APP_ENV=development
API_V1_STR=/api

# MySQL Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=wareflow
DB_USER=root
# DB_PASSWORD is provided in your secure environment
```
*Note: Never commit actual passwords or JWT secrets to source control. Use `.env.example` as a template.*

## 3. Database Initialization
The `wareflow` database must be created in MySQL if it doesn't already exist.
```sql
CREATE DATABASE IF NOT EXISTS wareflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 4. Applying Migrations
The application uses **Alembic** to manage the database schema.
To apply the schema to a fresh database or update an existing one, run:

```bash
cd backend
venv\Scripts\activate  # On Windows
alembic upgrade head
```

This will automatically create all tables, foreign keys, and indexes defined in the SQLAlchemy models.

## 5. Verification
To verify the database setup:
1. **Check Migrations**: Run `alembic current`. It should output the latest revision ID.
2. **Check Database**: Connect to MySQL (`mysql -u root -p`) and run `USE wareflow; SHOW TABLES;` to see the created schema.
3. **Run API Health Checks**: If the backend is running (`uvicorn app.main:app --reload`), visit `http://127.0.0.1:8000/api/health` to confirm the DB connection is healthy.
4. **Run Unit Tests**: Execute `pytest tests/` in the backend directory to run all configured database unit tests.

## 6. Troubleshooting
- **Connection Refused**: Ensure the MySQL service is running on `DB_PORT` (default 3306).
- **Access Denied**: Verify the `DB_USER` and `DB_PASSWORD` in `.env` are correct.
- **ModuleNotFoundError for Alembic**: Ensure you have activated the virtual environment and installed `requirements.txt`.
