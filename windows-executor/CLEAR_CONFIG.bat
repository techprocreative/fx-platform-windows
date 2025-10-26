@echo off
echo ====================================
echo FX Platform Executor - CLEAR CONFIG
echo ====================================
echo.
echo This will DELETE all configuration and start fresh.
echo.
echo You will need NEW credentials from web platform:
echo   - API Key
echo   - API Secret
echo   - Shared Secret (NEW FIELD)
echo.
echo ====================================
echo.
choice /C YN /M "Continue with clearing config"
if errorlevel 2 goto :cancel

echo.
echo [1/3] Closing running instances...
taskkill /F /IM "fx-platform-executor.exe" >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/3] Deleting configuration files...
if exist "%APPDATA%\fx-platform-executor" (
    rd /s /q "%APPDATA%\fx-platform-executor"
    echo     - Deleted: %APPDATA%\fx-platform-executor
)

if exist "%LOCALAPPDATA%\fx-platform-executor" (
    rd /s /q "%LOCALAPPDATA%\fx-platform-executor"
    echo     - Deleted: %LOCALAPPDATA%\fx-platform-executor
)

echo [3/3] Running cleanup script...
node scripts/clear-config.js

echo.
echo ====================================
echo CONFIGURATION CLEARED!
echo ====================================
echo.
echo Next steps:
echo   1. Launch Windows Executor
echo   2. You'll see Setup Wizard
echo   3. Enter credentials from web platform
echo   4. Don't forget the NEW Shared Secret field!
echo.
echo Get credentials from:
echo   https://fx.nusanexus.com/dashboard/executors
echo.
goto :end

:cancel
echo.
echo Cancelled. No changes made.
echo.

:end
pause
