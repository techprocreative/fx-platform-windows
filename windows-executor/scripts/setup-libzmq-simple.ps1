# LibZMQ Simple Setup Script for Windows
# Downloads pre-compiled libzmq.dll for x86 and x64

param(
    [switch]$Force,
    [switch]$SkipX86,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ResourcesDir = Join-Path $ScriptDir ".." "resources" "libs"
$TempDir = Join-Path $ScriptDir ".." "temp"

# Colors
function Write-Color {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Success { Write-Color "✓ $args" "Green" }
function Write-Warning { Write-Color "⚠ $args" "Yellow" }
function Write-Error { Write-Color "✗ $args" "Red" }
function Write-Info { Write-Color "ℹ $args" "Cyan" }
function Write-Verbose2 { if ($Verbose) { Write-Color "  $args" "Gray" } }

# Create directories
New-Item -ItemType Directory -Force -Path $ResourcesDir | Out-Null
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

Write-Host ""
Write-Color "╔═══════════════════════════════════════════════════════════╗" "Cyan"
Write-Color "║         LibZMQ Setup Script for FX Platform              ║" "Cyan"
Write-Color "╚═══════════════════════════════════════════════════════════╝" "Cyan"
Write-Host ""

# Download sources for x64
$sources_x64 = @(
    @{
        Name = "NuGet libzmq x64"
        Url = "https://www.nuget.org/api/v2/package/libzmq_vc142/4.3.5"
        Filename = "libzmq_x64.nupkg"
        DllPath = "runtimes/win-x64/native/libzmq.dll"
    },
    @{
        Name = "NuGet libzmq (alternative)"
        Url = "https://globalcdn.nuget.org/packages/libzmq_vc142.4.3.5.nupkg"
        Filename = "libzmq_x64_alt.nupkg"
        DllPath = "runtimes/win-x64/native/libzmq.dll"
    }
)

# Download sources for x86
$sources_x86 = @(
    @{
        Name = "NuGet libzmq x86"
        Url = "https://www.nuget.org/api/v2/package/libzmq_vc142/4.3.5"
        Filename = "libzmq_x86.nupkg"
        DllPath = "runtimes/win-x86/native/libzmq.dll"
    },
    @{
        Name = "NuGet libzmq (alternative)"
        Url = "https://globalcdn.nuget.org/packages/libzmq_vc142.4.3.5.nupkg"
        Filename = "libzmq_x86_alt.nupkg"
        DllPath = "runtimes/win-x86/native/libzmq.dll"
    }
)

function Test-DllValid {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return @{ Valid = $false; Reason = "File does not exist" }
    }

    $file = Get-Item $Path
    $sizeKB = $file.Length / 1KB

    if ($sizeKB -lt 100) {
        return @{ Valid = $false; Reason = "File too small ($([Math]::Round($sizeKB, 2)) KB)" }
    }

    # Check for MZ header (PE executable)
    try {
        $bytes = [System.IO.File]::ReadAllBytes($Path)
        if ($bytes.Length -lt 2 -or $bytes[0] -ne 0x4D -or $bytes[1] -ne 0x5A) {
            return @{ Valid = $false; Reason = "Not a valid Windows executable (no MZ header)" }
        }
    }
    catch {
        return @{ Valid = $false; Reason = "Read error: $($_.Exception.Message)" }
    }

    return @{ Valid = $true; Size = $sizeKB }
}

function Download-File {
    param(
        [string]$Url,
        [string]$OutputPath
    )

    try {
        Write-Verbose2 "Downloading: $Url"

        $webClient = New-Object System.Net.WebClient
        $webClient.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

        # Download with progress
        $webClient.DownloadFile($Url, $OutputPath)
        $webClient.Dispose()

        if (Test-Path $OutputPath) {
            $fileSize = (Get-Item $OutputPath).Length / 1MB
            Write-Verbose2 "Downloaded: $([Math]::Round($fileSize, 2)) MB"
            return $true
        }

        return $false
    }
    catch {
        Write-Verbose2 "Download failed: $($_.Exception.Message)"
        return $false
    }
}

function Extract-DllFromNupkg {
    param(
        [string]$NupkgPath,
        [string]$DllPath,
        [string]$OutputPath
    )

    try {
        Write-Verbose2 "Extracting DLL from NuGet package..."

        # NuGet packages are ZIP files
        $extractDir = Join-Path $TempDir "extract_$(Get-Random)"
        New-Item -ItemType Directory -Force -Path $extractDir | Out-Null

        # Use PowerShell to extract
        Expand-Archive -Path $NupkgPath -DestinationPath $extractDir -Force

        $sourceDll = Join-Path $extractDir $DllPath

        if (Test-Path $sourceDll) {
            Copy-Item $sourceDll $OutputPath -Force

            # Cleanup
            Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue

            return $true
        }
        else {
            Write-Verbose2 "DLL not found in package at: $DllPath"
            # List contents for debugging
            if ($Verbose) {
                Write-Verbose2 "Package contents:"
                Get-ChildItem $extractDir -Recurse | Where-Object { $_.Extension -eq ".dll" } | ForEach-Object {
                    Write-Verbose2 "  - $($_.FullName.Replace($extractDir, ''))"
                }
            }
            Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
            return $false
        }
    }
    catch {
        Write-Verbose2 "Extraction error: $($_.Exception.Message)"
        return $false
    }
}

function Setup-Dll {
    param(
        [string]$Arch,
        [array]$Sources
    )

    $targetFile = Join-Path $ResourcesDir "libzmq-$Arch.dll"

    Write-Host ""
    Write-Color "═══════════════════════════════════════════════════════" "Cyan"
    Write-Color "  Setting up libzmq for $($Arch.ToUpper())" "Cyan"
    Write-Color "═══════════════════════════════════════════════════════" "Cyan"
    Write-Host ""

    # Check if file already exists
    if ((Test-Path $targetFile) -and -not $Force) {
        $validation = Test-DllValid -Path $targetFile
        if ($validation.Valid) {
            Write-Success "libzmq-$Arch.dll already exists and is valid ($([Math]::Round($validation.Size, 2)) KB)"
            Write-Info "Use -Force to re-download"
            return $true
        }
        else {
            Write-Warning "Existing file is invalid: $($validation.Reason)"
            Write-Info "Will attempt to download..."
        }
    }

    # Try each source
    $index = 0
    foreach ($source in $Sources) {
        $index++
        Write-Host ""
        Write-Info "[$index/$($Sources.Count)] Trying: $($source.Name)"

        try {
            $downloadPath = Join-Path $TempDir $source.Filename

            # Download
            $downloaded = Download-File -Url $source.Url -OutputPath $downloadPath

            if (-not $downloaded) {
                Write-Warning "Download failed"
                continue
            }

            # Extract
            $extracted = Extract-DllFromNupkg -NupkgPath $downloadPath -DllPath $source.DllPath -OutputPath $targetFile

            if (-not $extracted) {
                Write-Warning "Extraction failed"
                Remove-Item $downloadPath -Force -ErrorAction SilentlyContinue
                continue
            }

            # Validate
            $validation = Test-DllValid -Path $targetFile

            if ($validation.Valid) {
                Write-Success "Successfully downloaded and validated libzmq-$Arch.dll ($([Math]::Round($validation.Size, 2)) KB)"
                Remove-Item $downloadPath -Force -ErrorAction SilentlyContinue
                return $true
            }
            else {
                Write-Warning "Validation failed: $($validation.Reason)"
                Remove-Item $targetFile -Force -ErrorAction SilentlyContinue
            }

            Remove-Item $downloadPath -Force -ErrorAction SilentlyContinue
        }
        catch {
            Write-Warning "Error: $($_.Exception.Message)"
        }
    }

    Write-Error "Could not download libzmq-$Arch.dll from any source"
    return $false
}

# Main execution
$results = @{
    x64 = $false
    x86 = $false
}

# Setup x64 (always needed)
$results.x64 = Setup-Dll -Arch "x64" -Sources $sources_x64

# Setup x86 (optional)
if (-not $SkipX86) {
    $results.x86 = Setup-Dll -Arch "x86" -Sources $sources_x86
}
else {
    Write-Info "Skipping x86 build (-SkipX86 flag)"
}

# Cleanup temp directory
if (Test-Path $TempDir) {
    Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
}

# Summary
Write-Host ""
Write-Color "═══════════════════════════════════════════════════════" "Cyan"
Write-Color "  Summary" "Cyan"
Write-Color "═══════════════════════════════════════════════════════" "Cyan"
Write-Host ""

if ($results.x64) {
    Write-Success "x64 (64-bit): Ready"
}
else {
    Write-Error "x64 (64-bit): Failed"
}

if (-not $SkipX86) {
    if ($results.x86) {
        Write-Success "x86 (32-bit): Ready"
    }
    else {
        Write-Error "x86 (32-bit): Failed"
    }
}

Write-Host ""

# Exit with appropriate code
$allSuccessful = $results.x64 -and ($SkipX86 -or $results.x86)

if (-not $allSuccessful) {
    Write-Host ""
    Write-Warning "Some downloads failed. Manual installation options:"
    Write-Host ""
    Write-Color "Option 1: Manual NuGet Download" "White"
    Write-Color "  1. Visit: https://www.nuget.org/packages/libzmq_vc142/" "Gray"
    Write-Color "  2. Click 'Download package' on the right side" "Gray"
    Write-Color "  3. Rename .nupkg to .zip" "Gray"
    Write-Color "  4. Extract and find DLLs in:" "Gray"
    Write-Color "     - runtimes/win-x64/native/libzmq.dll" "Gray"
    Write-Color "     - runtimes/win-x86/native/libzmq.dll" "Gray"
    Write-Color "  5. Copy to: $ResourcesDir" "Gray"
    Write-Color "  6. Rename to libzmq-x64.dll and libzmq-x86.dll" "Gray"
    Write-Host ""
    Write-Color "Option 2: vcpkg" "White"
    Write-Color "  vcpkg install zeromq:x64-windows zeromq:x86-windows" "Gray"
    Write-Color "  Copy from: vcpkg/installed/*/bin/libzmq.dll" "Gray"
    Write-Host ""
    Write-Color "Option 3: Direct Download (Community builds)" "White"
    Write-Color "  Visit: https://github.com/zeromq/libzmq/releases" "Gray"
    Write-Host ""
    Write-Color "Note: The zeromq npm package will compile libzmq automatically" "Yellow"
    Write-Color "      during 'npm install'. Pre-built DLLs are optional for" "Yellow"
    Write-Color "      distribution packages only." "Yellow"
    Write-Host ""

    exit 1
}

Write-Host ""
Write-Success "All DLLs ready for deployment!"
Write-Host ""
Write-Info "Next steps:"
Write-Color "  1. Run: npm install" "Gray"
Write-Color "  2. Run: npm run rebuild (for Electron)" "Gray"
Write-Color "  3. Run: npm run build" "Gray"
Write-Color "  4. Run: npm run package:win" "Gray"
Write-Host ""

# Create a simple manifest
$manifest = @{
    timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    platform = "Windows"
    files = @()
}

if ($results.x64) {
    $x64File = Join-Path $ResourcesDir "libzmq-x64.dll"
    $x64Info = Get-Item $x64File
    $manifest.files += @{
        name = "libzmq-x64.dll"
        size = $x64Info.Length
        sizeKB = [Math]::Round($x64Info.Length / 1KB, 2)
        arch = "x64"
    }
}

if ($results.x86) {
    $x86File = Join-Path $ResourcesDir "libzmq-x86.dll"
    $x86Info = Get-Item $x86File
    $manifest.files += @{
        name = "libzmq-x86.dll"
        size = $x86Info.Length
        sizeKB = [Math]::Round($x86Info.Length / 1KB, 2)
        arch = "x86"
    }
}

$manifestPath = Join-Path $ResourcesDir "libzmq-manifest.json"
$manifest | ConvertTo-Json -Depth 10 | Out-File -FilePath $manifestPath -Encoding UTF8
Write-Verbose2 "Manifest saved: $manifestPath"

exit 0
