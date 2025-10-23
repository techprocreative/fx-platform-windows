#!/usr/bin/env node

/**
 * LibZMQ Setup Script for FX Platform Windows Executor
 *
 * This script downloads pre-compiled libzmq.dll files for Windows (x86 and x64)
 * from multiple sources and validates them.
 *
 * Usage:
 *   node scripts/setup-libzmq.js
 *   node scripts/setup-libzmq.js --force
 *   node scripts/setup-libzmq.js --skip-x86
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const RESOURCES_DIR = path.join(__dirname, '..', 'resources', 'libs');
const TEMP_DIR = path.join(__dirname, '..', 'temp');

// Command line arguments
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const SKIP_X86 = args.includes('--skip-x86');
const VERBOSE = args.includes('--verbose');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.cyan);
}

function logVerbose(message) {
  if (VERBOSE) {
    log(`  ${message}`, colors.gray);
  }
}

// Download sources
const DOWNLOAD_SOURCES = {
  x64: [
    {
      name: 'vcpkg CDN',
      url: 'https://github.com/microsoft/vcpkg-tool/releases/download/2023-12-12/vcpkg.exe',
      type: 'vcpkg',
      description: 'Microsoft vcpkg package manager (will extract DLL)',
    },
    {
      name: 'NuGet libzmq',
      url: 'https://www.nuget.org/api/v2/package/libzmq_vc142/4.3.5',
      type: 'nuget',
      filename: 'libzmq.4.3.5.nupkg',
      dllPath: 'runtimes/win-x64/native/libzmq.dll',
      description: 'NuGet package for libzmq v4.3.5',
    },
    {
      name: 'GitHub Release Mirror',
      url: 'https://github.com/zeromq/libzmq/releases/download/v4.3.4/libzmq-v142-x64-4_3_4.zip',
      type: 'zip',
      dllPath: 'bin/libzmq-v142-mt-4_3_4.dll',
      description: 'Official GitHub release v4.3.4',
    },
  ],
  x86: [
    {
      name: 'NuGet libzmq x86',
      url: 'https://www.nuget.org/api/v2/package/libzmq_vc142/4.3.5',
      type: 'nuget',
      filename: 'libzmq.4.3.5.nupkg',
      dllPath: 'runtimes/win-x86/native/libzmq.dll',
      description: 'NuGet package for libzmq v4.3.5 (x86)',
    },
    {
      name: 'GitHub Release Mirror x86',
      url: 'https://github.com/zeromq/libzmq/releases/download/v4.3.4/libzmq-v142-x86-4_3_4.zip',
      type: 'zip',
      dllPath: 'bin/libzmq-v142-mt-4_3_4.dll',
      description: 'Official GitHub release v4.3.4 (x86)',
    },
  ],
};

// Ensure directories exist
function ensureDirectories() {
  if (!fs.existsSync(RESOURCES_DIR)) {
    fs.mkdirSync(RESOURCES_DIR, { recursive: true });
  }
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

// Download file with progress
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    logVerbose(`Downloading: ${url}`);

    const request = protocol.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        logVerbose(`Redirecting to: ${redirectUrl}`);
        downloadFile(redirectUrl, outputPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedSize = 0;

      const file = fs.createWriteStream(outputPath);

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize > 0 && VERBOSE) {
          const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
          process.stdout.write(`\r  Progress: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(2)} MB)`);
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        if (VERBOSE) {
          console.log(''); // New line after progress
        }
        resolve(outputPath);
      });
    });

    request.on('error', (error) => {
      fs.unlink(outputPath, () => {});
      reject(error);
    });

    request.setTimeout(60000, () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

// Extract DLL from NuGet package
function extractFromNuGet(nupkgPath, dllPath, outputPath) {
  try {
    logVerbose('Extracting from NuGet package...');

    // NuGet packages are just ZIP files
    const AdmZip = tryRequire('adm-zip');
    if (!AdmZip) {
      // Fallback: use system unzip if available
      const tempExtractDir = path.join(TEMP_DIR, 'extract_' + Date.now());
      fs.mkdirSync(tempExtractDir, { recursive: true });

      // Try PowerShell expand-archive
      try {
        execSync(`powershell -Command "Expand-Archive -Path '${nupkgPath}' -DestinationPath '${tempExtractDir}' -Force"`, {
          stdio: 'pipe',
        });

        const sourceDll = path.join(tempExtractDir, dllPath);
        if (fs.existsSync(sourceDll)) {
          fs.copyFileSync(sourceDll, outputPath);
          // Cleanup
          fs.rmSync(tempExtractDir, { recursive: true, force: true });
          return true;
        }
      } catch (e) {
        logVerbose(`PowerShell extraction failed: ${e.message}`);
      }

      return false;
    }

    const zip = new AdmZip(nupkgPath);
    const zipEntries = zip.getEntries();

    for (const entry of zipEntries) {
      if (entry.entryName === dllPath || entry.entryName.endsWith(dllPath)) {
        zip.extractEntryTo(entry, path.dirname(outputPath), false, true);
        const extractedPath = path.join(path.dirname(outputPath), path.basename(entry.entryName));
        if (extractedPath !== outputPath) {
          fs.renameSync(extractedPath, outputPath);
        }
        return true;
      }
    }

    return false;
  } catch (error) {
    logVerbose(`Extraction error: ${error.message}`);
    return false;
  }
}

// Extract DLL from ZIP archive
function extractFromZip(zipPath, dllPath, outputPath) {
  try {
    logVerbose('Extracting from ZIP archive...');

    const AdmZip = tryRequire('adm-zip');
    if (!AdmZip) {
      // Fallback: use PowerShell
      const tempExtractDir = path.join(TEMP_DIR, 'extract_' + Date.now());
      fs.mkdirSync(tempExtractDir, { recursive: true });

      try {
        execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempExtractDir}' -Force"`, {
          stdio: 'pipe',
        });

        const sourceDll = path.join(tempExtractDir, dllPath);
        if (fs.existsSync(sourceDll)) {
          fs.copyFileSync(sourceDll, outputPath);
          fs.rmSync(tempExtractDir, { recursive: true, force: true });
          return true;
        }
      } catch (e) {
        logVerbose(`PowerShell extraction failed: ${e.message}`);
      }

      return false;
    }

    const zip = new AdmZip(zipPath);
    zip.extractAllTo(path.join(TEMP_DIR, 'extracted'), true);

    const sourceDll = path.join(TEMP_DIR, 'extracted', dllPath);
    if (fs.existsSync(sourceDll)) {
      fs.copyFileSync(sourceDll, outputPath);
      return true;
    }

    return false;
  } catch (error) {
    logVerbose(`Extraction error: ${error.message}`);
    return false;
  }
}

// Try to require a module, return null if not available
function tryRequire(moduleName) {
  try {
    return require(moduleName);
  } catch (e) {
    return null;
  }
}

// Validate DLL file
function validateDLL(filePath) {
  if (!fs.existsSync(filePath)) {
    return { valid: false, reason: 'File does not exist' };
  }

  const stats = fs.statSync(filePath);
  const sizeKB = stats.size / 1024;

  if (sizeKB < 100) {
    return { valid: false, reason: `File too small (${sizeKB.toFixed(2)} KB)` };
  }

  // Check for PE header (basic validation)
  try {
    const buffer = Buffer.alloc(2);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 2, 0);
    fs.closeSync(fd);

    // Check for MZ header
    if (buffer.toString('ascii') !== 'MZ') {
      return { valid: false, reason: 'Not a valid Windows executable' };
    }
  } catch (e) {
    return { valid: false, reason: `Read error: ${e.message}` };
  }

  return { valid: true, size: sizeKB };
}

// Download and setup DLL for specific architecture
async function setupDLL(arch) {
  const targetFile = path.join(RESOURCES_DIR, `libzmq-${arch}.dll`);

  log('');
  log(`${'='.repeat(50)}`, colors.cyan);
  log(`  Setting up libzmq for ${arch.toUpperCase()}`, colors.cyan);
  log(`${'='.repeat(50)}`, colors.cyan);

  // Check if file already exists
  if (fs.existsSync(targetFile) && !FORCE) {
    const validation = validateDLL(targetFile);
    if (validation.valid) {
      logSuccess(`libzmq-${arch}.dll already exists and is valid (${validation.size.toFixed(2)} KB)`);
      logInfo('Use --force to re-download');
      return true;
    } else {
      logWarning(`Existing file is invalid: ${validation.reason}`);
      logInfo('Will attempt to download...');
    }
  }

  // Try each download source
  const sources = DOWNLOAD_SOURCES[arch] || [];

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    log('');
    logInfo(`[${i + 1}/${sources.length}] Trying: ${source.name}`);
    logVerbose(`Description: ${source.description}`);

    try {
      const downloadPath = path.join(TEMP_DIR, source.filename || `temp_${arch}_${Date.now()}.tmp`);

      // Download file
      await downloadFile(source.url, downloadPath);
      logVerbose(`Downloaded to: ${downloadPath}`);

      // Extract DLL based on type
      let success = false;

      if (source.type === 'nuget') {
        success = extractFromNuGet(downloadPath, source.dllPath, targetFile);
      } else if (source.type === 'zip') {
        success = extractFromZip(downloadPath, source.dllPath, targetFile);
      } else {
        // Direct DLL file
        fs.copyFileSync(downloadPath, targetFile);
        success = true;
      }

      // Validate
      if (success) {
        const validation = validateDLL(targetFile);
        if (validation.valid) {
          logSuccess(`Successfully downloaded and validated libzmq-${arch}.dll (${validation.size.toFixed(2)} KB)`);

          // Cleanup temp files
          try {
            fs.unlinkSync(downloadPath);
          } catch (e) {
            // Ignore cleanup errors
          }

          return true;
        } else {
          logWarning(`Downloaded file failed validation: ${validation.reason}`);
          fs.unlinkSync(targetFile);
        }
      } else {
        logWarning('Failed to extract DLL from package');
      }

      // Cleanup failed download
      try {
        fs.unlinkSync(downloadPath);
      } catch (e) {
        // Ignore
      }
    } catch (error) {
      logWarning(`Failed: ${error.message}`);
    }
  }

  logError(`Could not download libzmq-${arch}.dll from any source`);
  return false;
}

// Main function
async function main() {
  log('');
  log('╔═══════════════════════════════════════════════════════════╗', colors.bright + colors.cyan);
  log('║         LibZMQ Setup Script for FX Platform              ║', colors.bright + colors.cyan);
  log('╚═══════════════════════════════════════════════════════════╝', colors.bright + colors.cyan);
  log('');

  ensureDirectories();

  const results = {
    x64: false,
    x86: false,
  };

  // Setup x64 (always needed)
  results.x64 = await setupDLL('x64');

  // Setup x86 (optional)
  if (!SKIP_X86) {
    results.x86 = await setupDLL('x86');
  } else {
    logInfo('Skipping x86 build (--skip-x86 flag)');
  }

  // Cleanup temp directory
  try {
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  } catch (e) {
    // Ignore cleanup errors
  }

  // Print summary
  log('');
  log(`${'='.repeat(50)}`, colors.cyan);
  log('  Summary', colors.cyan);
  log(`${'='.repeat(50)}`, colors.cyan);
  log('');

  if (results.x64) {
    logSuccess('x64 (64-bit): Ready');
  } else {
    logError('x64 (64-bit): Failed');
  }

  if (!SKIP_X86) {
    if (results.x86) {
      logSuccess('x86 (32-bit): Ready');
    } else {
      logError('x86 (32-bit): Failed');
    }
  }

  log('');

  // Exit with appropriate code
  const allSuccessful = results.x64 && (SKIP_X86 || results.x86);

  if (!allSuccessful) {
    log('');
    logWarning('Some downloads failed. Manual installation options:');
    log('');
    log('Option 1: NuGet Package', colors.bright);
    log('  1. Visit: https://www.nuget.org/packages/libzmq_vc142/', colors.gray);
    log('  2. Download the .nupkg file', colors.gray);
    log('  3. Rename to .zip and extract', colors.gray);
    log('  4. Find DLLs in runtimes/win-x64/native/ and runtimes/win-x86/native/', colors.gray);
    log('');
    log('Option 2: vcpkg', colors.bright);
    log('  vcpkg install zeromq:x64-windows zeromq:x86-windows', colors.gray);
    log('  Find DLLs in vcpkg/installed/*/bin/', colors.gray);
    log('');
    log('Option 3: Build from Source', colors.bright);
    log('  1. Clone: git clone https://github.com/zeromq/libzmq.git', colors.gray);
    log('  2. Build with CMake and Visual Studio', colors.gray);
    log('');
    log('Note: The zeromq npm package will compile libzmq automatically', colors.yellow);
    log('      during "npm install". Pre-built DLLs are optional.', colors.yellow);
    log('');

    process.exit(1);
  }

  log('');
  logSuccess('All DLLs ready for deployment!');
  log('');
  logInfo('Next steps:');
  log('  1. Run: npm install', colors.gray);
  log('  2. Run: npm run rebuild (for Electron)', colors.gray);
  log('  3. Run: npm run build', colors.gray);
  log('  4. Run: npm run package:win', colors.gray);
  log('');

  process.exit(0);
}

// Run main function
if (require.main === module) {
  main().catch((error) => {
    logError(`Fatal error: ${error.message}`);
    if (VERBOSE) {
      console.error(error);
    }
    process.exit(1);
  });
}

module.exports = { setupDLL, validateDLL, downloadFile };
