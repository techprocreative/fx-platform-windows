@echo off
echo ================================================================
echo  Windows Executor V2 - Complete Build Script
echo ================================================================
echo.
echo This will create a complete installer package with:
echo   - Electron UI
echo   - Python Backend (standalone .exe)
echo   - All dependencies
echo   - Auto-start scripts
echo.
echo ================================================================
pause

:: Check prerequisites
echo.
echo [STEP 1/6] Checking prerequisites...
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found! Install Python 3.11+ from https://python.org
    pause
    exit /b 1
)
echo   [OK] Python found

node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found! Install Node.js from https://nodejs.org
    pause
    exit /b 1
)
echo   [OK] Node.js found

npm --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm not found!
    pause
    exit /b 1
)
echo   [OK] npm found

:: Install PyInstaller if not present
pip show pyinstaller >nul 2>&1
if errorlevel 1 (
    echo.
    echo [INFO] Installing PyInstaller...
    pip install pyinstaller
)
echo   [OK] PyInstaller ready

echo.
echo ================================================================
echo [STEP 2/6] Building Python Backend with PyInstaller...
echo ================================================================
echo.

cd backend

:: Create requirements file without dev dependencies
echo Creating optimized requirements...
pip freeze > requirements-full.txt

:: Build with PyInstaller
echo Building standalone backend executable...
pyinstaller build-backend.spec --clean --noconfirm

if errorlevel 1 (
    echo.
    echo ERROR: Backend build failed!
    cd ..
    pause
    exit /b 1
)

echo   [OK] Backend built successfully

:: Copy to distribution directory
echo Copying backend to distribution folder...
if not exist "..\backend-dist" mkdir "..\backend-dist"
xcopy /E /I /Y dist\WindowsExecutorV2Backend "..\backend-dist" >nul

cd ..

echo.
echo ================================================================
echo [STEP 3/6] Installing Frontend Dependencies...
echo ================================================================
echo.

cd frontend

:: Install dependencies if needed
if not exist "node_modules" (
    echo Installing npm packages...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed!
        cd ..
        pause
        exit /b 1
    )
) else (
    echo   [SKIP] Dependencies already installed
)

echo.
echo ================================================================
echo [STEP 4/6] Building Electron Frontend...
echo ================================================================
echo.

:: Build frontend
echo Building React app...
call npm run build
if errorlevel 1 (
    echo ERROR: Frontend build failed!
    cd ..
    pause
    exit /b 1
)

echo   [OK] Frontend built successfully

cd ..

echo.
echo ================================================================
echo [STEP 5/6] Creating Installer Package...
echo ================================================================
echo.

cd frontend

:: Create installer with electron-builder
echo Building Windows installer...
call npm run electron:build -- --win nsis
if errorlevel 1 (
    echo ERROR: Installer creation failed!
    cd ..
    pause
    exit /b 1
)

cd ..

echo.
echo ================================================================
echo [STEP 6/6] Finalizing...
echo ================================================================
echo.

:: Show results
if exist "dist\Windows Executor V2-Setup-1.0.0.exe" (
    echo.
    echo ================================================================
    echo  BUILD SUCCESSFUL!
    echo ================================================================
    echo.
    echo Installer created:
    echo   Location: dist\Windows Executor V2-Setup-1.0.0.exe
    echo   Size: 
    for %%F in ("dist\Windows Executor V2-Setup-1.0.0.exe") do echo   %%~zF bytes
    echo.
    echo What's included:
    echo   [OK] Electron UI
    echo   [OK] Python Backend (standalone)
    echo   [OK] All dependencies
    echo   [OK] SQLite database
    echo   [OK] Configuration templates
    echo.
    echo Next steps:
    echo   1. Test the installer on a clean Windows machine
    echo   2. Distribute to users
    echo   3. Users just run the installer and configure 3 settings!
    echo.
    echo ================================================================
    
    :: Open dist folder
    echo Opening dist folder...
    explorer dist
) else (
    echo.
    echo WARNING: Installer file not found at expected location!
    echo Check dist folder manually.
    pause
)

echo.
echo Press any key to exit...
pause >nul
