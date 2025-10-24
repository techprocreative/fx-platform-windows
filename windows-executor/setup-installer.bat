@echo off
REM FX Platform Executor - Automated Setup Installer (Batch Wrapper)
REM This runs the PowerShell setup script

echo.
echo =========================================================
echo   FX PLATFORM EXECUTOR - AUTOMATED SETUP
echo   Version 1.0.0
echo =========================================================
echo.

REM Check if PowerShell is available
where powershell >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: PowerShell is not installed or not in PATH
    echo Please install PowerShell or run setup-installer.ps1 manually
    pause
    exit /b 1
)

echo Running automated setup...
echo.

REM Run PowerShell script with execution policy bypass
powershell.exe -ExecutionPolicy Bypass -File "%~dp0setup-installer.ps1"

if %ERRORLEVEL% equ 0 (
    echo.
    echo Setup completed successfully!
) else (
    echo.
    echo Setup encountered errors. Please check the output above.
)

echo.
pause
