@echo off
echo ========================================
echo  FX Platform Windows Executor
echo ========================================
echo.
echo Starting FX Platform Executor...
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo ERROR: node_modules not found!
    echo Please run: npm install
    pause
    exit /b 1
)

REM Check if dist exists
if not exist "dist" (
    echo ERROR: dist folder not found!
    echo Please run: npm run build
    pause
    exit /b 1
)

REM Start the application
echo Launching application...
npm start

pause
