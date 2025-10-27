@echo off
echo ================================================
echo  Windows Executor V2 - Startup
echo ================================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found! Please install Python 3.11+ from https://python.org
    pause
    exit /b 1
)

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found! Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

:: Load environment variables if .env exists
if exist .env (
    echo Loading environment variables from .env...
    for /f "usebackq delims=" %%a in (".env") do (
        echo %%a | findstr /r "^[^#]" >nul && set %%a
    )
)

:: Start Backend
echo.
echo [1/3] Starting Python Backend...
cd backend
start "Windows Executor V2 - Backend" cmd /k "python -m uvicorn main:app --host 0.0.0.0 --port 8081 --reload"
cd ..

:: Wait for backend to start
echo Waiting for backend to start...
timeout /t 5 /nobreak >nul

:: Install frontend dependencies if needed
if not exist frontend\node_modules (
    echo.
    echo [2/3] Installing Frontend Dependencies...
    cd frontend
    call npm install
    cd ..
)

:: Start Electron Frontend
echo.
echo [3/3] Starting Electron Frontend...
cd frontend
start "Windows Executor V2 - Frontend" cmd /k "npm run electron"
cd ..

echo.
echo ================================================
echo  Windows Executor V2 is starting...
echo  Backend: http://localhost:8081
echo  Frontend: Electron window will open shortly
echo ================================================
echo.
echo Press any key to open logs directory...
pause >nul

:: Open logs directory
if exist logs (
    explorer logs
)
