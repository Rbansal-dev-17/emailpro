#!/bin/bash

set -e

echo "🚀 Starting EmailPro Platform..."
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker to continue."
    exit 1
fi

# Start PostgreSQL
echo "📦 Starting PostgreSQL..."
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 3

# Setup Python backend
echo ""
echo "🐍 Setting up Python backend..."
cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -q -r requirements.txt

echo "✅ Backend ready!"
echo "🚀 Starting FastAPI server (http://localhost:8000)..."
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 &

BACKEND_PID=$!

# Setup Vite React frontend
cd ../frontend

if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Installing frontend dependencies (this may take a minute)..."
    npm install
fi

echo "✅ Frontend ready!"
echo "🚀 Starting Vite development server (http://localhost:3000)..."
npm run dev &

FRONTEND_PID=$!

echo ""
echo "=========================================="
echo "✅ EmailPro Platform is running!"
echo ""
echo "🌐 Frontend:  http://localhost:3000"
echo "📡 Backend:   http://localhost:8000"
echo "🗄️  Database:  localhost:5432"
echo ""
echo "📖 Full guide: See README.md"
echo ""
echo "Press Ctrl+C to stop all services"
echo "=========================================="

# Handle Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo ''; echo '🛑 Shutting down...'; docker-compose down" EXIT

# Keep the script running
wait
