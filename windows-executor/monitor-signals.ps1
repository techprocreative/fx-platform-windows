# Signal Monitor Script
# Monitors executor logs for signal generation

$logFile = "$env:APPDATA\fx-platform-executor\logs\combined.log"
$lastCheckTime = Get-Date

Write-Host "=================================" -ForegroundColor Cyan
Write-Host "🔍 SIGNAL MONITOR STARTED" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Monitoring: $logFile"
Write-Host "Started at: $(Get-Date -Format 'HH:mm:ss')"
Write-Host "Press Ctrl+C to stop"
Write-Host ""
Write-Host "Checking for signals every 15 seconds..." -ForegroundColor Yellow
Write-Host ""

$signalCount = 0
$loopCount = 0

while ($true) {
    $loopCount++
    $currentTime = Get-Date
    
    # Get logs from last check
    $recentLogs = Get-Content $logFile -Tail 100 | Where-Object {
        $_ -match "Signal generated|SafetyValidator.*Validating|openPosition.*BUY|openPosition.*SELL|trade.*success.*true"
    }
    
    if ($recentLogs) {
        Write-Host "⚡ [$($currentTime.ToString('HH:mm:ss'))] SIGNAL DETECTED!" -ForegroundColor Green
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
        
        foreach ($log in $recentLogs) {
            # Parse JSON
            try {
                $logObj = $log | ConvertFrom-Json
                $timestamp = $logObj.timestamp
                $message = $logObj.message
                
                if ($message -match "Signal generated") {
                    $signalCount++
                    Write-Host "📊 SIGNAL #$signalCount" -ForegroundColor Cyan
                    Write-Host "   Time: $timestamp" -ForegroundColor White
                    Write-Host "   $message" -ForegroundColor Yellow
                }
                elseif ($message -match "SafetyValidator.*Validating") {
                    Write-Host "🛡️  Safety Check: $message" -ForegroundColor Magenta
                }
                elseif ($message -match "openPosition|trade.*execut") {
                    Write-Host "🎯 Execution: $message" -ForegroundColor Cyan
                    if ($log -match "success.*true") {
                        Write-Host "   ✅ SUCCESS!" -ForegroundColor Green
                    } else {
                        Write-Host "   ❌ FAILED" -ForegroundColor Red
                    }
                }
            }
            catch {
                # Not JSON, print as-is
                Write-Host "   $log" -ForegroundColor Gray
            }
        }
        
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
        Write-Host ""
    }
    else {
        # No signal - show status
        if ($loopCount % 4 -eq 0) {
            # Show status every 60 seconds (4 x 15s)
            $elapsed = $currentTime - $lastCheckTime
            Write-Host "[$($currentTime.ToString('HH:mm:ss'))] ⏳ Waiting for signal... (Checked $loopCount times, $signalCount signals found)" -ForegroundColor DarkGray
        }
    }
    
    # Wait 15 seconds
    Start-Sleep -Seconds 15
}
