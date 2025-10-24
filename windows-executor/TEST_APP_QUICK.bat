@echo off
echo ========================================
echo  Testing FX Platform Executor
echo ========================================
echo.
echo Starting app from source (development mode)...
echo Press Ctrl+C to stop
echo.
echo Look for these console messages:
echo - "Loading index.html..."
echo - "Page finished loading"
echo - "IPC: get-mt5-installations called"
echo - "MT5 detection result: [...]"
echo.
pause
echo.

cd /d "%~dp0"
npm start
