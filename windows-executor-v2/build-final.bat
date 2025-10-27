@echo off
REM ================================================================
REM  Windows Executor V2 - Final Build Script with Simple Backend
REM ================================================================

echo ================================================================
echo  Windows Executor V2 - Final Build with Working Backend
echo ================================================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found! Please install Python 3.11 or higher
    pause
    exit /b 1
)

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found! Please install Node.js
    pause
    exit /b 1
)

REM Check PyInstaller
pyinstaller --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] PyInstaller not found! Installing...
    pip install pyinstaller
)

echo [OK] All prerequisites found
echo.

REM Step 1: Build Backend
echo ================================================================
echo [STEP 1/4] Building Backend (Simple Version)...
echo ================================================================
echo.

cd backend

echo Cleaning old builds...
if exist "dist" rmdir /S /Q dist
if exist "build" rmdir /S /Q build

echo Building backend executable...
REM Use logged backend for production
if exist "build-logged.spec" (
    echo Building backend with comprehensive logging...
    pyinstaller --clean --noconfirm build-logged.spec
) else if exist "build-real.spec" (
    echo Building REAL backend with all features...
    pyinstaller --clean --noconfirm build-real.spec
) else (
    pyinstaller --clean --noconfirm build-simple.spec
)

if errorlevel 1 (
    echo [ERROR] Backend build failed!
    cd ..
    pause
    exit /b 1
)

echo [OK] Backend built successfully
cd ..

REM Step 2: Copy Backend to Frontend
echo.
echo ================================================================
echo [STEP 2/4] Preparing Backend Resources...
echo ================================================================
echo.

if not exist "frontend\resources\backend" mkdir frontend\resources\backend

echo Copying backend executable...
copy /Y "backend\dist\WindowsExecutorV2Backend.exe" "frontend\resources\backend\WindowsExecutorV2Backend.exe"

if errorlevel 1 (
    echo [ERROR] Failed to copy backend!
    pause
    exit /b 1
)

echo [OK] Backend copied to resources
echo.

REM Copy .env.example
if exist ".env.example" (
    copy /Y ".env.example" "frontend\resources\.env.example"
    echo [OK] Copied .env.example
)

REM Copy documentation
if exist "SETUP_GUIDE.md" (
    copy /Y "SETUP_GUIDE.md" "frontend\resources\SETUP_GUIDE.md"
    echo [OK] Copied SETUP_GUIDE.md
)

REM Step 3: Build Frontend
echo ================================================================
echo [STEP 3/4] Building Frontend...
echo ================================================================
echo.

cd frontend

if not exist "node_modules" (
    echo Installing npm packages...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed!
        cd ..
        pause
        exit /b 1
    )
)

echo Building frontend...
call npm run build

if errorlevel 1 (
    echo [ERROR] Frontend build failed!
    cd ..
    pause
    exit /b 1
)

echo [OK] Frontend built successfully

REM Step 4: Create Installer
echo.
echo ================================================================
echo [STEP 4/4] Creating Windows Installer...
echo ================================================================
echo.

echo Building installer package...
call npm run dist

if errorlevel 1 (
    echo [ERROR] Installer creation failed!
    cd ..
    pause
    exit /b 1
)

cd ..

echo.
echo ================================================================
echo [SUCCESS] Build Complete!
echo ================================================================
echo.

REM Get installer size
for %%F in ("dist\Windows Executor V2-Setup-1.0.0.exe") do set size=%%~zF

echo Installer created successfully!
echo.
echo Location: dist\Windows Executor V2-Setup-1.0.0.exe
echo Size: %size% bytes
echo.
echo The installer is ready for distribution!
echo.

pause
