@echo off
setlocal enabledelayedexpansion

echo 🚀 Starting EmailPro Platform...
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker not found. Please install Docker Desktop to continue.
    pause
    exit /b 1
)

REM Start PostgreSQL
echo 📦 Starting PostgreSQL...
docker-compose up -d

REM Wait for PostgreSQL
echo ⏳ Waiting for PostgreSQL to be ready...
timeout /t 3

REM Setup Python backend
echo.
echo 🐍 Setting up Python backend...
cd backend

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install dependencies
pip install -q -r requirements.txt

echo ✅ Backend ready!
echo 🚀 Starting FastAPI server (http://localhost:8000)...
start "EmailPro Backend" python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

REM Setup Vite React frontend
cd ..\frontend

if not exist "node_modules" (
    echo.
    echo 📦 Installing frontend dependencies ^(this may take a minute^)...
    call npm install
)

echo ✅ Frontend ready!
echo 🚀 Starting Vite development server (http://localhost:3000)...
start "EmailPro Frontend" npm run dev

echo.
echo ==========================================
echo ✅ EmailPro Platform is running!
echo.
echo 🌐 Frontend:  http://localhost:3000
echo 📡 Backend:   http://localhost:8000
echo 🗄️  Database:  localhost:5432
echo.
echo 📖 Full guide: See README.md
echo.
echo Close these windows to stop the services
echo ==========================================

timeout /t -1
