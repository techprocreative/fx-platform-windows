# PowerShell script to bundle the FastAPI backend into a single executable using PyInstaller

param(
    [string]$OutputDir = "dist-backend",
    [string]$ExecutableName = "backend-service"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Building backend executable..." -ForegroundColor Cyan

pushd $PSScriptRoot

if (!(Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$pyinstallerArgs = @(
    "--noconfirm",
    "--onefile",
    "--name", $ExecutableName,
    "--add-data", "requirements.txt;.",
    "--hidden-import", "pydantic_settings",
    "--hidden-import", "MetaTrader5",
    "--collect-data", "MetaTrader5",
    "__main__.py"
)

pyinstaller @pyinstallerArgs

if (!(Test-Path "dist/$ExecutableName.exe")) {
    throw "PyInstaller failed to produce executable"
}

Copy-Item "dist/$ExecutableName.exe" "$OutputDir/$ExecutableName.exe" -Force

Write-Host "✅ Backend executable built at $OutputDir/$ExecutableName.exe" -ForegroundColor Green

popd
