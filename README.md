# WareFlow · Warehouse Operational Intelligence Platform

WareFlow is a warehouse operational intelligence platform featuring real-time inventory tracking, physical warehouse spatial mapping (digital twin), intelligent job queues, dynamic workforce allocation, and demand forecasting.

---

## 🌐 Live GitHub Pages Demo

- **URL:** [https://Ajay-200858.github.io/wareflowv3/](https://Ajay-200858.github.io/wareflowv3/)
- **Repository:** `Ajay-200858/wareflowv3`

### What Works in the GitHub Pages Preview:
- **Interactive Landing Page:** Responsive design system, feature breakdowns, and capabilities showcase.
- **Facility Digital Twin Simulation:** Real-time multi-depth storage rack and transit corridor simulation running directly in client-side SVG/Canvas.
- **Backend Status Indicator:** Detects whether a local FastAPI backend is active or offline and presents clear feedback.

### Why Full Operations Require the Local Backend:
WareFlow's workspace functionality (manager authentication, employee registration, multi-tenant company isolation, inventory mutations, CSV imports, and machine learning models) is powered by a Python FastAPI backend and a MySQL database running on your local machine (`http://localhost:8000`).

---

## 🚀 Running WareFlow Locally

### 1. Prerequisites
- Python 3.10+
- MySQL Server (e.g., MySQL 8.0 or XAMPP)
- Modern web browser (Chrome, Edge, Firefox, Safari)

### 2. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Linux / macOS:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables (copy example)
cp .env.example .env
# Edit .env with your MySQL credentials

# Run database setup & migrations
python scripts/setup_database.py
alembic upgrade head

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```
The backend API will be available at: `http://localhost:8000`  
API Swagger Docs: `http://localhost:8000/docs`  
Health check: `http://localhost:8000/api/health`

### 3. Frontend Setup
Because WareFlow's frontend is built with vanilla HTML, CSS, and JavaScript, no build tools or package managers are required!

```bash
# From the repository root or frontend directory:
# Option A: Python HTTP server
python -m http.server 3000 --directory frontend

# Option B: Node http-server or serve
npx serve frontend -l 3000
```
Open `http://localhost:3000` in your browser.

---

## ⚙️ GitHub Pages Deployment Configuration

This repository is configured for GitHub Pages via:
1. **GitHub Actions Workflow (`.github/workflows/deploy-pages.yml`):**
   - Automatically builds and deploys static assets from `frontend/` on every push to `main`.
   - Leaves backend source files, environment variables, and databases completely private.
2. **Fallback Root Entrypoint (`index.html`):**
   - If deploying using classic "Deploy from a branch (`main` / root)", root `index.html` seamlessly redirects to `frontend/index.html`.
3. **`.nojekyll`:**
   - Ensures GitHub Pages serves all static assets without Jekyll filtering.
