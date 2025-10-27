@echo off
echo ================================================================
echo  Windows Executor V2 - Complete Build Script (AUTO)
echo ================================================================
echo.
echo Building installer package...
echo.

:: Check prerequisites
echo [STEP 1/6] Checking prerequisites...
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found!
    exit /b 1
)
echo   [OK] Python found

node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found!
    exit /b 1
)
echo   [OK] Node.js found

pip show pyinstaller >nul 2>&1
if errorlevel 1 (
    echo Installing PyInstaller...
    pip install pyinstaller
)
echo   [OK] PyInstaller ready

echo.
echo ================================================================
echo [STEP 2/6] Building Python Backend...
echo ================================================================
echo.

cd backend

echo Building standalone backend executable...

REM Use simple backend spec for working single-file build
if exist "build-simple.spec" (
    echo Using simplified backend (single file)...
    pyinstaller build-simple.spec --clean --noconfirm
) else (
    pyinstaller build-backend.spec --clean --noconfirm
)

if errorlevel 1 (
    echo ERROR: Backend build failed!
    cd ..
    exit /b 1
)

echo   [OK] Backend built successfully

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

if not exist "node_modules" (
    echo Installing npm packages...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed!
        cd ..
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

echo Building React app...
call npm run build
if errorlevel 1 (
    echo ERROR: Frontend build failed!
    cd ..
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

echo Building Windows installer...
call npm run electron:build -- --win nsis
if errorlevel 1 (
    echo ERROR: Installer creation failed!
    cd ..
    exit /b 1
)

cd ..

echo.
echo ================================================================
echo [STEP 6/6] Build Complete!
echo ================================================================
echo.

if exist "dist\Windows Executor V2-Setup-1.0.0.exe" (
    echo BUILD SUCCESSFUL!
    echo.
    echo Installer: dist\Windows Executor V2-Setup-1.0.0.exe
    for %%F in ("dist\Windows Executor V2-Setup-1.0.0.exe") do echo Size: %%~zF bytes
    echo.
    explorer dist
) else (
    echo WARNING: Installer file not found!
    echo Check dist folder manually.
)

echo.
echo Build complete!
