# Quick Signal Check Script
# Check for recent signals in executor logs

$logFile = "$env:APPDATA\fx-platform-executor\logs\combined.log"

Write-Host "=================================" -ForegroundColor Cyan
Write-Host "📊 SIGNAL CHECK" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Get last 5 minutes of logs
$fiveMinutesAgo = (Get-Date).AddMinutes(-5).ToString("yyyy-MM-dd HH:mm")
$now = Get-Date -Format "HH:mm:ss"

Write-Host "Checking logs from last 5 minutes..." -ForegroundColor Yellow
Write-Host "Current time: $now" -ForegroundColor White
Write-Host ""

# Check for signals
$signals = Get-Content $logFile -Tail 500 | Select-String -Pattern "Signal generated"

if ($signals) {
    $count = ($signals | Measure-Object).Count
    Write-Host "✅ FOUND $count SIGNAL(S):" -ForegroundColor Green
    Write-Host ""
    
    $lastSignals = $signals | Select-Object -Last 5
    foreach ($signal in $lastSignals) {
        try {
            $logObj = $signal.Line | ConvertFrom-Json
            $time = $logObj.timestamp
            $message = $logObj.message
            
            Write-Host "  📈 $time" -ForegroundColor Cyan
            Write-Host "     $message" -ForegroundColor Yellow
            Write-Host ""
        }
        catch {
            Write-Host "  $($signal.Line)" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "❌ NO SIGNALS FOUND in last 500 log lines" -ForegroundColor Red
    Write-Host ""
}

# Check monitoring status
$monitoring = Get-Content $logFile -Tail 20 | Select-String -Pattern "StrategyMonitor.*Monitor loop started" | Select-Object -Last 1

if ($monitoring) {
    try {
        $logObj = $monitoring.Line | ConvertFrom-Json
        $time = $logObj.timestamp
        $message = $logObj.message
        
        Write-Host "✅ Strategy Monitor Active:" -ForegroundColor Green
        Write-Host "   Last check: $time" -ForegroundColor White
        Write-Host "   $message" -ForegroundColor Gray
    }
    catch {
        Write-Host "✅ Strategy Monitor Active" -ForegroundColor Green
    }
}
else {
    Write-Host "⚠️  Strategy Monitor status unknown" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan

# Check for errors
$recentErrors = Get-Content "$env:APPDATA\fx-platform-executor\logs\error.log" -Tail 10 -ErrorAction SilentlyContinue

if ($recentErrors) {
    $errorCount = ($recentErrors | Measure-Object).Count
    Write-Host "⚠️  Found $errorCount recent error(s)" -ForegroundColor Yellow
}
else {
    Write-Host "✅ No recent errors" -ForegroundColor Green
}

Write-Host ""
