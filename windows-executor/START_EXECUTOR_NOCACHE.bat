@echo off
echo ========================================
echo  FX Platform Windows Executor (NO CACHE)
echo ========================================
echo.
echo Starting with cache disabled...
echo.

REM Disable Node.js require cache
set NODE_OPTIONS=--no-warnings
set ELECTRON_DISABLE_SECURITY_WARNINGS=true

REM Clear any cached modules
echo Clearing module cache...
del /F /Q node_modules\.cache\* 2>nul

REM Start the application
echo Launching application...
npm start

pause
