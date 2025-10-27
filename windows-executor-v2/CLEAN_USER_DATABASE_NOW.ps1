# ========================================
# WINDOWS EXECUTOR V2 - CLEANUP DATABASE
# ========================================
# Run this to remove old/fake data

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Windows Executor V2 - Database Cleanup" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Database location
$dbPath = "$env:LOCALAPPDATA\WindowsExecutorV2\windows_executor_v2.db"
$logPath = "$env:LOCALAPPDATA\WindowsExecutorV2\logs"
$portPath = "$env:LOCALAPPDATA\WindowsExecutorV2\backend_port.txt"

Write-Host "Checking for old data..." -ForegroundColor White
Write-Host ""

# Check if database exists
if (Test-Path $dbPath) {
    $size = (Get-Item $dbPath).Length / 1KB
    Write-Host "[FOUND] Old database detected!" -ForegroundColor Red
    Write-Host "  Location: $dbPath" -ForegroundColor Gray
    Write-Host "  Size: $([math]::Round($size, 2)) KB" -ForegroundColor Gray
    Write-Host ""
    Write-Host "This database contains OLD data from previous testing:" -ForegroundColor Yellow
    Write-Host "  - Old strategies (not from platform)" -ForegroundColor Yellow
    Write-Host "  - Fake positions (EURUSD demo data)" -ForegroundColor Yellow
    Write-Host "  - Test trade logs" -ForegroundColor Yellow
    Write-Host ""
    
    # Check if app is running
    $appRunning = Get-Process | Where-Object { $_.ProcessName -like "*WindowsExecutor*" }
    if ($appRunning) {
        Write-Host "[WARNING] Application is currently running!" -ForegroundColor Red
        Write-Host "  Please close Windows Executor V2 first." -ForegroundColor Yellow
        Write-Host ""
        
        $killConfirm = Read-Host "Kill the application now? (yes/no)"
        if ($killConfirm -eq "yes") {
            $appRunning | Stop-Process -Force
            Write-Host "[OK] Application closed" -ForegroundColor Green
            Start-Sleep -Seconds 2
        } else {
            Write-Host "[CANCELLED] Please close the app manually and run this script again." -ForegroundColor Yellow
            exit 0
        }
    }
    
    Write-Host "Ready to delete old database..." -ForegroundColor Green
    Write-Host ""
    $confirm = Read-Host "Type 'DELETE' to confirm (or anything else to cancel)"
    
    if ($confirm -eq "DELETE") {
        try {
            Remove-Item $dbPath -Force
            Write-Host ""
            Write-Host "[SUCCESS] Database deleted!" -ForegroundColor Green
            
            # Also remove port file
            if (Test-Path $portPath) {
                Remove-Item $portPath -Force
            }
            
        } catch {
            Write-Host ""
            Write-Host "[ERROR] Failed to delete: $_" -ForegroundColor Red
            Write-Host "  Try running as Administrator" -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host ""
        Write-Host "[CANCELLED] Database not deleted" -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "[OK] No old database found - already clean!" -ForegroundColor Green
    Write-Host "  Expected location: $dbPath" -ForegroundColor Gray
}

Write-Host ""

# Check logs
if (Test-Path $logPath) {
    $logFiles = Get-ChildItem $logPath -File | Measure-Object
    $logSize = (Get-ChildItem $logPath -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB
    
    Write-Host "[FOUND] Log files" -ForegroundColor Yellow
    Write-Host "  Files: $($logFiles.Count)" -ForegroundColor Gray
    Write-Host "  Size: $([math]::Round($logSize, 2)) MB" -ForegroundColor Gray
    Write-Host ""
    
    $cleanLogs = Read-Host "Delete logs too? (yes/no)"
    if ($cleanLogs -eq "yes") {
        try {
            Remove-Item $logPath -Recurse -Force
            Write-Host "[OK] Logs deleted" -ForegroundColor Green
        } catch {
            Write-Host "[ERROR] Failed to delete logs: $_" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CLEANUP COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Start Windows Executor V2" -ForegroundColor Gray
Write-Host "  2. Configure .env with your API credentials" -ForegroundColor Gray
Write-Host "  3. Fresh start with NO old/fake data!" -ForegroundColor Gray
Write-Host ""
Write-Host "You should now see:" -ForegroundColor Cyan
Write-Host "  - Running Strategies: EMPTY" -ForegroundColor Gray
Write-Host "  - Available Strategies: FROM PLATFORM" -ForegroundColor Gray
Write-Host "  - Positions: NONE (until you start trading)" -ForegroundColor Gray
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor White
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
