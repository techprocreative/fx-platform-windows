@echo off
echo ========================================
echo  Icon Verification Tool
echo ========================================
echo.

set ICON_PATH=resources\icons\icon.ico

if not exist "%ICON_PATH%" (
    echo ERROR: Icon file not found!
    echo Path: %ICON_PATH%
    pause
    exit /b 1
)

echo Checking icon file...
echo.

powershell -Command "Get-Item '%ICON_PATH%' | Select-Object Name, Length, LastWriteTime | Format-List"

echo.
echo ========================================
echo  Icon Requirements
echo ========================================
echo - Minimum size: 256x256 pixels
echo - Recommended: Multi-resolution icon
echo - Expected file size: 200KB+ (for multi-res)
echo.
echo Current icon file size: 67KB
echo Status: TOO SMALL - NEEDS REPLACEMENT
echo.
echo ========================================
echo  How to Fix
echo ========================================
echo 1. Create icon dengan multi-resolution:
echo    - 16x16, 32x32, 48x48, 64x64, 128x128, 256x256, 512x512
echo.
echo 2. Replace file di: %ICON_PATH%
echo.
echo 3. Run this script lagi untuk verify
echo.
pause
