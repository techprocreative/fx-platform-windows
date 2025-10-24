@echo off
echo ========================================
echo  MT5 Location Checker
echo ========================================
echo.
echo Checking common MT5 installation locations...
echo.

REM Check Program Files
if exist "%ProgramFiles%\MetaTrader 5\terminal64.exe" (
    echo [FOUND] %ProgramFiles%\MetaTrader 5\
)
if exist "%ProgramFiles%\MetaTrader 5\terminal.exe" (
    echo [FOUND] %ProgramFiles%\MetaTrader 5\
)

REM Check Program Files (x86)
if exist "%ProgramFiles(x86)%\MetaTrader 5\terminal64.exe" (
    echo [FOUND] %ProgramFiles(x86)%\MetaTrader 5\
)
if exist "%ProgramFiles(x86)%\MetaTrader 5\terminal.exe" (
    echo [FOUND] %ProgramFiles(x86)%\MetaTrader 5\
)

REM Check Local AppData
if exist "%LOCALAPPDATA%\Programs\MetaTrader 5\terminal64.exe" (
    echo [FOUND] %LOCALAPPDATA%\Programs\MetaTrader 5\
)
if exist "%LOCALAPPDATA%\Programs\MetaTrader 5\terminal.exe" (
    echo [FOUND] %LOCALAPPDATA%\Programs\MetaTrader 5\
)

REM Check C drive
if exist "C:\MetaTrader 5\terminal64.exe" (
    echo [FOUND] C:\MetaTrader 5\
)
if exist "C:\MetaTrader 5\terminal.exe" (
    echo [FOUND] C:\MetaTrader 5\
)

if exist "C:\MT5\terminal64.exe" (
    echo [FOUND] C:\MT5\
)
if exist "C:\MT5\terminal.exe" (
    echo [FOUND] C:\MT5\
)

echo.
echo ========================================
echo  Searching via Registry...
echo ========================================
echo.

powershell -Command "Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*' | Where-Object { $_.DisplayName -like '*MetaTrader*' -or $_.DisplayName -like '*MT5*' } | Select-Object DisplayName, InstallLocation | Format-Table -AutoSize"

echo.
echo ========================================
echo  Searching for running MT5 processes...
echo ========================================
echo.

powershell -Command "Get-Process -Name terminal64,terminal -ErrorAction SilentlyContinue | Select-Object Name, Path | Format-Table -AutoSize"

echo.
echo ========================================
echo  If MT5 is installed in custom location:
echo ========================================
echo Please provide the full path where MT5 is installed.
echo Example: D:\Trading\MetaTrader 5
echo.
echo You can manually add this path in Setup Wizard.
echo.
pause
