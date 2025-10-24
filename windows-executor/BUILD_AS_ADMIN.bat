@echo off
echo ====================================
echo FX Platform Executor - BUILD SCRIPT
echo ====================================
echo.
echo IMPORTANT: This script MUST be run as Administrator
echo.
echo Checking for Administrator privileges...
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ERROR: Not running as Administrator!
    echo.
    echo Please right-click this file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)
echo SUCCESS: Running with Administrator privileges
echo.
pause

cd /d "%~dp0"

echo.
echo [1/3] Cleaning previous build...
call npm run clean
if errorlevel 1 (
    echo ERROR: Clean failed
    pause
    exit /b 1
)

echo.
echo [2/3] Building application...
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo.
echo [3/3] Packaging installer...
call npm run package:win
if errorlevel 1 (
    echo.
    echo ERROR: Package failed
    echo.
    echo Common causes:
    echo - Not running as Administrator (but we already checked this)
    echo - Antivirus blocking electron-builder
    echo - Network issues downloading dependencies
    echo.
    echo Please check PACKAGING_GUIDE.md for troubleshooting
    pause
    exit /b 1
)

echo.
echo ====================================
echo BUILD COMPLETED SUCCESSFULLY!
echo ====================================
echo.
echo Output files are in: dist-electron\
echo.
dir /b dist-electron\*.exe 2>nul
echo.
echo Installer: dist-electron\FX Platform Executor-Setup-1.0.0.exe
echo Portable: dist-electron\win-unpacked\FX Platform Executor.exe
echo.
pause
