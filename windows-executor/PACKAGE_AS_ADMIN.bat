@echo off
echo ========================================
echo  FX Platform Executor - Package Builder
echo ========================================
echo.
echo This script will package the application.
echo.
echo NOTE: This needs to run as ADMINISTRATOR
echo       to create installer properly.
echo.
pause

REM Clear cache first
echo Clearing electron-builder cache...
rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign" 2>nul
echo Cache cleared.
echo.

REM Build first
echo Step 1: Building application...
call npm run build
if errorlevel 1 (
    echo Build failed!
    pause
    exit /b 1
)
echo Build complete!
echo.

REM Package
echo Step 2: Packaging application...
echo This may take a few minutes...
echo.
call npm run package:win

if errorlevel 1 (
    echo.
    echo ========================================
    echo  PACKAGE FAILED
    echo ========================================
    echo.
    echo Possible solutions:
    echo 1. Right-click this BAT file and "Run as Administrator"
    echo 2. Or use portable version instead (see below)
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo  PACKAGE SUCCESS!
echo ========================================
echo.
echo Output files:
dir /b dist\*.exe 2>nul
echo.
echo Location: dist\
echo.
pause
