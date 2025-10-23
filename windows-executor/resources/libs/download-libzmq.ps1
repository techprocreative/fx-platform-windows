# Download LibZMQ DLLs for FX Platform Windows Executor
# This script downloads pre-compiled libzmq.dll files for Windows

param(
    [string]$OutputDir = $PSScriptRoot,
    [switch]$Force
)

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  LibZMQ Downloader for FX Platform" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$version = "4.3.5"
$files = @(
    @{
        Name = "libzmq-x64.dll"
        Url = "https://raw.githubusercontent.com/zeromq/libzmq/master/builds/msvc/vs2019/x64/Release/libzmq.dll"
        Size = 2MB
    }
)

# Alternative sources if primary fails
$alternativeSources = @{
    "libzmq-x64.dll" = @(
        "https://github.com/zeromq/libzmq/releases/download/v4.3.4/zeromq-4.3.4-x64.zip",
        "https://github.com/zeromq/libzmq/releases/download/v4.3.3/zeromq-4.3.3-x64.zip"
    )
}

function Download-File {
    param(
        [string]$Url,
        [string]$OutputPath
    )

    try {
        Write-Host "Downloading from: $Url" -ForegroundColor Yellow

        # Use WebClient for better progress reporting
        $webClient = New-Object System.Net.WebClient

        # Add User-Agent header
        $webClient.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

        # Download with progress
        $webClient.DownloadFile($Url, $OutputPath)

        if (Test-Path $OutputPath) {
            $fileSize = (Get-Item $OutputPath).Length / 1MB
            Write-Host "✓ Downloaded successfully ($([Math]::Round($fileSize, 2)) MB)" -ForegroundColor Green
            return $true
        }

        return $false
    }
    catch {
        Write-Host "✗ Download failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
    finally {
        if ($webClient) {
            $webClient.Dispose()
        }
    }
}

function Test-FileValid {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return $false
    }

    $file = Get-Item $Path
    if ($file.Length -lt 100KB) {
        Write-Host "⚠ File too small ($(($file.Length / 1KB)) KB), probably invalid" -ForegroundColor Yellow
        return $false
    }

    return $true
}

# Main execution
$totalFiles = $files.Count
$successCount = 0

foreach ($file in $files) {
    Write-Host ""
    Write-Host "Processing: $($file.Name)" -ForegroundColor Cyan
    Write-Host "----------------------------------------"

    $outputPath = Join-Path $OutputDir $file.Name

    # Check if file already exists
    if ((Test-Path $outputPath) -and -not $Force) {
        if (Test-FileValid $outputPath) {
            Write-Host "✓ File already exists and appears valid" -ForegroundColor Green
            Write-Host "  Use -Force to re-download" -ForegroundColor Gray
            $successCount++
            continue
        }
        else {
            Write-Host "⚠ Existing file is invalid, will re-download" -ForegroundColor Yellow
            Remove-Item $outputPath -Force
        }
    }

    # Try primary URL
    $success = Download-File -Url $file.Url -OutputPath $outputPath

    # Try alternative sources if primary fails
    if (-not $success -and $alternativeSources.ContainsKey($file.Name)) {
        Write-Host ""
        Write-Host "Trying alternative sources..." -ForegroundColor Yellow

        foreach ($altUrl in $alternativeSources[$file.Name]) {
            Write-Host "Attempting: $altUrl" -ForegroundColor Gray
            $success = Download-File -Url $altUrl -OutputPath $outputPath

            if ($success) {
                break
            }
        }
    }

    # Validate downloaded file
    if ($success -and (Test-FileValid $outputPath)) {
        $successCount++
        Write-Host "✓ $($file.Name) ready" -ForegroundColor Green
    }
    else {
        Write-Host "✗ Failed to download valid $($file.Name)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Download Summary" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Successful: $successCount / $totalFiles" -ForegroundColor $(if ($successCount -eq $totalFiles) { "Green" } else { "Yellow" })

if ($successCount -lt $totalFiles) {
    Write-Host ""
    Write-Host "⚠ Some downloads failed!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Manual installation instructions:" -ForegroundColor Cyan
    Write-Host "1. Download libzmq from: https://github.com/zeromq/libzmq/releases" -ForegroundColor White
    Write-Host "2. Extract the appropriate DLL files" -ForegroundColor White
    Write-Host "3. Copy to: $OutputDir" -ForegroundColor White
    Write-Host "4. Rename files to:" -ForegroundColor White
    Write-Host "   - libzmq-x64.dll (for 64-bit)" -ForegroundColor White
    Write-Host "   - libzmq-x86.dll (for 32-bit)" -ForegroundColor White
    Write-Host ""
    Write-Host "Alternative: Use vcpkg" -ForegroundColor Cyan
    Write-Host "  vcpkg install zeromq:x64-windows" -ForegroundColor White
    Write-Host "  vcpkg install zeromq:x86-windows" -ForegroundColor White
    Write-Host ""
    Write-Host "Note: The zeromq npm package includes libzmq and will" -ForegroundColor Gray
    Write-Host "      compile it automatically during 'npm install'." -ForegroundColor Gray
    Write-Host "      Pre-built DLLs are OPTIONAL for deployment." -ForegroundColor Gray
}
else {
    Write-Host ""
    Write-Host "🎉 All files downloaded successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Files are ready for deployment:" -ForegroundColor Cyan
    foreach ($file in $files) {
        $outputPath = Join-Path $OutputDir $file.Name
        if (Test-Path $outputPath) {
            $fileSize = (Get-Item $outputPath).Length / 1MB
            Write-Host "  ✓ $($file.Name) ($([Math]::Round($fileSize, 2)) MB)" -ForegroundColor Green
        }
    }
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Run 'npm install' to build zeromq package" -ForegroundColor White
Write-Host "2. Run 'npm run rebuild' for Electron compatibility" -ForegroundColor White
Write-Host "3. Run 'npm run test:zeromq' to verify installation" -ForegroundColor White
Write-Host ""

# Create a manifest file
$manifest = @{
    version = $version
    downloadedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    files = @()
    platform = "Windows"
    architecture = "x64"
}

foreach ($file in $files) {
    $outputPath = Join-Path $OutputDir $file.Name
    if (Test-Path $outputPath) {
        $fileInfo = Get-Item $outputPath
        $manifest.files += @{
            name = $file.Name
            size = $fileInfo.Length
            lastModified = $fileInfo.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
        }
    }
}

$manifestPath = Join-Path $OutputDir "manifest.json"
$manifest | ConvertTo-Json -Depth 10 | Out-File -FilePath $manifestPath -Encoding UTF8
Write-Host "Manifest created: $manifestPath" -ForegroundColor Gray

exit $(if ($successCount -eq $totalFiles) { 0 } else { 1 })
