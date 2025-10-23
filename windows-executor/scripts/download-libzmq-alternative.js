#!/usr/bin/env node

/**
 * Alternative ZeroMQ Library Downloader for FX Platform
 * This script provides multiple methods to obtain libzmq.dll files
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { execSync } = require("child_process");

const CONFIG = {
  outputDir: path.join(__dirname, "../resources/libs"),
  placeholderFiles: [
    {
      name: "libzmq-x64.dll",
      placeholderContent: "PLACEHOLDER_64BIT_DLL",
      manualDownloadUrl: "https://github.com/zeromq/libzmq/releases",
      instructions: `
        Manual Download Instructions for 64-bit DLL:
        1. Visit: https://github.com/zeromq/libzmq/releases
        2. Look for Windows binaries (usually named like libzmq-v14x-x64-*.zip)
        3. Download and extract the 64-bit DLL
        4. Rename it to 'libzmq-x64.dll'
        5. Place it in: resources/libs/
      `,
    },
    {
      name: "libzmq-x86.dll",
      placeholderContent: "PLACEHOLDER_32BIT_DLL",
      manualDownloadUrl: "https://github.com/zeromq/libzmq/releases",
      instructions: `
        Manual Download Instructions for 32-bit DLL:
        1. Visit: https://github.com/zeromq/libzmq/releases
        2. Look for Windows binaries (usually named like libzmq-v14x-Win32-*.zip)
        3. Download and extract the 32-bit DLL
        4. Rename it to 'libzmq-x86.dll'
        5. Place it in: resources/libs/
      `,
    },
  ],
  alternativeSources: [
    {
      name: "NuGet Package",
      description: "You can also get libzmq from NuGet packages",
      url: "https://www.nuget.org/packages/libzmq_vc140",
      instructions: `
        1. Download the .nupkg file
        2. Rename .nupkg to .zip
        3. Extract and find the DLL files in runtimes/win-x64/native/ or runtimes/win-x86/native/
      `,
    },
    {
      name: "vcpkg",
      description: "Install via vcpkg package manager",
      instructions: `
        1. Install vcpkg: git clone https://github.com/Microsoft/vcpkg.git
        2. Run: vcpkg install zeromq:x64-windows zeromq:x86-windows
        3. Find DLLs in vcpkg/installed/*/bin/
      `,
    },
    {
      name: "Pre-built binaries",
      description: "Community maintained pre-built binaries",
      url: "https://github.com/zeromq/libzmq/wiki/Windows-builds",
      instructions: `
        Visit the ZeroMQ Wiki for Windows builds information
      `,
    },
  ],
};

/**
 * Create placeholder DLL files with instructions
 */
function createPlaceholderFiles() {
  console.log("📁 Creating placeholder DLL files with instructions...\n");

  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    console.log(`✓ Created directory: ${CONFIG.outputDir}`);
  }

  CONFIG.placeholderFiles.forEach((file) => {
    const filePath = path.join(CONFIG.outputDir, file.name);

    // Create a text file with instructions (not a real DLL)
    const content = `
This is a PLACEHOLDER file for ${file.name}
===========================================

This file needs to be replaced with the actual ZeroMQ DLL.

${file.instructions}

Alternative Download Methods:
${CONFIG.alternativeSources
  .map(
    (src) => `
  ${src.name}:
  ${src.description}
  ${src.url || ""}
  ${src.instructions}
`,
  )
  .join("\n")}

IMPORTANT: After downloading the real DLL, replace this file!
    `;

    fs.writeFileSync(filePath + ".README.txt", content);
    console.log(`✓ Created placeholder instructions: ${file.name}.README.txt`);

    // Create dummy DLL file (1KB) so the build process doesn't fail completely
    const dummyBuffer = Buffer.alloc(1024);
    fs.writeFileSync(filePath, dummyBuffer);
    console.log(`✓ Created dummy file: ${file.name} (will need replacement)`);
  });
}

/**
 * Try to download using wget if available
 */
function tryWget() {
  try {
    console.log("🔍 Checking if wget is available...");
    execSync("which wget", { stdio: "ignore" });

    console.log("✓ wget is available\n");
    console.log("You can manually download the DLLs using these commands:\n");

    console.log("For 64-bit:");
    console.log(
      "wget -O temp.zip https://github.com/zeromq/libzmq/releases/download/v4.3.4/libzmq-v142-x64-4_3_4.zip",
    );
    console.log("unzip temp.zip");
    console.log(
      'find . -name "*.dll" -exec cp {} resources/libs/libzmq-x64.dll \\;\n',
    );

    console.log("For 32-bit:");
    console.log(
      "wget -O temp.zip https://github.com/zeromq/libzmq/releases/download/v4.3.4/libzmq-v142-Win32-4_3_4.zip",
    );
    console.log("unzip temp.zip");
    console.log(
      'find . -name "*.dll" -exec cp {} resources/libs/libzmq-x86.dll \\;\n',
    );

    return true;
  } catch (error) {
    console.log("ℹ️  wget not available");
    return false;
  }
}

/**
 * Try to download using curl if available
 */
function tryCurl() {
  try {
    console.log("🔍 Checking if curl is available...");
    execSync("which curl", { stdio: "ignore" });

    console.log("✓ curl is available\n");
    console.log("You can manually download the DLLs using these commands:\n");

    console.log("For 64-bit:");
    console.log(
      "curl -L -o temp.zip https://github.com/zeromq/libzmq/releases/download/v4.3.4/libzmq-v142-x64-4_3_4.zip",
    );
    console.log("unzip temp.zip");
    console.log(
      'find . -name "*.dll" -exec cp {} resources/libs/libzmq-x64.dll \\;\n',
    );

    console.log("For 32-bit:");
    console.log(
      "curl -L -o temp.zip https://github.com/zeromq/libzmq/releases/download/v4.3.4/libzmq-v142-Win32-4_3_4.zip",
    );
    console.log("unzip temp.zip");
    console.log(
      'find . -name "*.dll" -exec cp {} resources/libs/libzmq-x86.dll \\;\n',
    );

    return true;
  } catch (error) {
    console.log("ℹ️  curl not available");
    return false;
  }
}

/**
 * Create a download script for Windows
 */
function createWindowsDownloadScript() {
  const scriptPath = path.join(CONFIG.outputDir, "download-libzmq.bat");
  const scriptContent = `@echo off
echo Downloading ZeroMQ libraries for Windows...
echo.

REM Create temp directory
mkdir temp_libzmq 2>nul
cd temp_libzmq

REM Download 64-bit version
echo Downloading 64-bit libzmq...
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/zeromq/libzmq/releases/download/v4.3.4/libzmq-v142-x64-4_3_4.zip' -OutFile 'libzmq-x64.zip'"

REM Extract 64-bit
echo Extracting 64-bit libzmq...
powershell -Command "Expand-Archive -Path 'libzmq-x64.zip' -DestinationPath 'x64' -Force"

REM Download 32-bit version
echo Downloading 32-bit libzmq...
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/zeromq/libzmq/releases/download/v4.3.4/libzmq-v142-Win32-4_3_4.zip' -OutFile 'libzmq-x86.zip'"

REM Extract 32-bit
echo Extracting 32-bit libzmq...
powershell -Command "Expand-Archive -Path 'libzmq-x86.zip' -DestinationPath 'x86' -Force"

REM Find and copy DLLs
echo Copying DLL files...
for /r x64 %%i in (*.dll) do copy "%%i" "..\\libzmq-x64.dll" /Y
for /r x86 %%i in (*.dll) do copy "%%i" "..\\libzmq-x86.dll" /Y

REM Cleanup
cd ..
rmdir /s /q temp_libzmq

echo.
echo Done! Check if libzmq-x64.dll and libzmq-x86.dll are in the current directory.
pause
`;

  fs.writeFileSync(scriptPath, scriptContent);
  console.log(`✓ Created Windows batch script: ${scriptPath}`);
  console.log("  Run this script on Windows to download the DLLs\n");
}

/**
 * Create a PowerShell download script
 */
function createPowerShellScript() {
  const scriptPath = path.join(CONFIG.outputDir, "download-libzmq.ps1");
  const scriptContent = `# ZeroMQ Library Downloader for Windows
Write-Host "Downloading ZeroMQ libraries..." -ForegroundColor Green

$outputDir = $PSScriptRoot

# Function to download and extract
function Download-AndExtract {
    param(
        [string]$url,
        [string]$outputFile,
        [string]$dllName
    )

    Write-Host "Downloading from: $url" -ForegroundColor Yellow
    $tempZip = Join-Path $outputDir "temp_$outputFile.zip"
    $tempExtract = Join-Path $outputDir "temp_extract_$outputFile"

    try {
        # Download
        Invoke-WebRequest -Uri $url -OutFile $tempZip -UseBasicParsing

        # Extract
        Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force

        # Find and copy DLL
        $dll = Get-ChildItem -Path $tempExtract -Filter "*.dll" -Recurse | Select-Object -First 1
        if ($dll) {
            Copy-Item -Path $dll.FullName -Destination (Join-Path $outputDir $dllName) -Force
            Write-Host "✓ Successfully created: $dllName" -ForegroundColor Green
        } else {
            Write-Host "✗ DLL not found in archive" -ForegroundColor Red
        }
    } catch {
        Write-Host "✗ Error: $_" -ForegroundColor Red
    } finally {
        # Cleanup
        if (Test-Path $tempZip) { Remove-Item $tempZip -Force }
        if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force }
    }
}

# Download both versions
Download-AndExtract -url "https://github.com/zeromq/libzmq/releases/download/v4.3.4/libzmq-v142-x64-4_3_4.zip" -outputFile "x64" -dllName "libzmq-x64.dll"

Download-AndExtract -url "https://github.com/zeromq/libzmq/releases/download/v4.3.4/libzmq-v142-Win32-4_3_4.zip" -outputFile "x86" -dllName "libzmq-x86.dll"

Write-Host "Done! Check the current directory for libzmq-x64.dll and libzmq-x86.dll" -ForegroundColor Green
`;

  fs.writeFileSync(scriptPath, scriptContent);
  console.log(`✓ Created PowerShell script: ${scriptPath}`);
  console.log(
    "  Run this script on Windows: powershell -ExecutionPolicy Bypass -File download-libzmq.ps1\n",
  );
}

/**
 * Main function
 */
function main() {
  console.log("🚀 Alternative ZeroMQ Library Setup for FX Platform");
  console.log("=".repeat(60));
  console.log("");

  // Create placeholder files
  createPlaceholderFiles();

  console.log("\n" + "=".repeat(60));
  console.log("📋 MANUAL DOWNLOAD OPTIONS:");
  console.log("=".repeat(60) + "\n");

  // Check for download tools
  const hasWget = tryWget();
  const hasCurl = tryCurl();

  if (!hasWget && !hasCurl) {
    console.log("ℹ️  No command-line download tools found.\n");
  }

  // Create Windows scripts
  console.log("=".repeat(60));
  console.log("🪟 WINDOWS SCRIPTS:");
  console.log("=".repeat(60) + "\n");

  createWindowsDownloadScript();
  createPowerShellScript();

  // Final instructions
  console.log("=".repeat(60));
  console.log("📌 NEXT STEPS:");
  console.log("=".repeat(60) + "\n");

  console.log("Since you are on Linux, you have several options:\n");
  console.log(
    "1. Transfer the Windows scripts to a Windows machine and run them there",
  );
  console.log("2. Download the DLLs manually from a Windows machine");
  console.log("3. Use Wine to run Windows binaries on Linux (advanced)");
  console.log("4. Use pre-compiled DLLs from the community\n");

  console.log(
    "The placeholder files have been created so the build process can continue.",
  );
  console.log(
    "Remember to replace them with real DLL files before final deployment!\n",
  );

  console.log("For immediate testing purposes, the dummy DLL files will allow");
  console.log(
    "the build process to complete, but the application won't function",
  );
  console.log("properly until real libzmq DLL files are in place.\n");

  console.log(
    "✅ Setup complete! Check the README files in resources/libs/ for detailed instructions.",
  );
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main, CONFIG };
