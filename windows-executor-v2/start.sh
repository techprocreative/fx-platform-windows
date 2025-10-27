#!/bin/bash

echo "================================================"
echo " Windows Executor V2 - Startup"
echo "================================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python not found! Please install Python 3.11+"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js not found! Please install Node.js from https://nodejs.org"
    exit 1
fi

# Load environment variables if .env exists
if [ -f .env ]; then
    echo "Loading environment variables from .env..."
    export $(grep -v '^#' .env | xargs)
fi

# Start Backend
echo ""
echo "[1/3] Starting Python Backend..."
cd backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8081 --reload &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "Waiting for backend to start..."
sleep 5

# Install frontend dependencies if needed
if [ ! -d "frontend/node_modules" ]; then
    echo ""
    echo "[2/3] Installing Frontend Dependencies..."
    cd frontend
    npm install
    cd ..
fi

# Start Electron Frontend
echo ""
echo "[3/3] Starting Electron Frontend..."
cd frontend
npm run electron &
FRONTEND_PID=$!
cd ..

echo ""
echo "================================================"
echo " Windows Executor V2 is running!"
echo " Backend: http://localhost:8081"
echo " Backend PID: $BACKEND_PID"
echo " Frontend PID: $FRONTEND_PID"
echo "================================================"
echo ""
echo "Press Ctrl+C to stop all services..."

# Wait for user interrupt
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# Keep script running
wait
