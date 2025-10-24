@echo off
echo ========================================
echo  Create Portable Version (No Installer)
echo ========================================
echo.
echo This will create a portable version without installer.
echo NO administrator rights needed!
echo.
pause

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

REM Create simple portable package using electron-packager
echo Step 2: Creating portable package...
echo.

call npx electron-packager . "FX Platform Executor" --platform=win32 --arch=x64 --out=dist-portable --overwrite --icon=resources/icons/icon.ico

if errorlevel 1 (
    echo.
    echo Packaging failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo  SUCCESS!
echo ========================================
echo.
echo Portable application created in:
echo   dist-portable\FX Platform Executor-win32-x64\
echo.
echo Run: FX Platform Executor.exe
echo.
echo You can ZIP this folder and distribute it!
echo.
pause
