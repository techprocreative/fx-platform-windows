#!/usr/bin/env node

/**
 * Download and install a MetaTrader 5 compatible libzmq.dll
 *
 * The script will:
 * 1. Backup the existing DLL (if present)
 * 2. Download an official ZeroMQ release archive
 * 3. Extract the archive using PowerShell
 * 4. Locate a 64-bit DLL with the required C exports
 * 5. Replace resources/libs/libzmq-x64.dll
 * 6. Run the verification script to confirm required exports
 */

const fs = require('fs-extra');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const LIB_DIR = path.join(PROJECT_ROOT, 'resources', 'libs');
const TARGET_DLL = path.join(LIB_DIR, 'libzmq-x64.dll');
const TEMP_DIR = path.join(PROJECT_ROOT, '.tmp-libzmq');

const SOURCES = [
  {
    url: 'https://github.com/zeromq/libzmq/releases/download/v4.3.5/zeromq-4.3.5.zip',
    description: 'ZeroMQ 4.3.5 (official release zip)'
  },
  {
    url: 'https://github.com/zeromq/libzmq/releases/download/v4.3.4/libzmq-v4.3.4.zip',
    description: 'ZeroMQ 4.3.4 (fallback release zip)'
  }
];

function log(message) {
  console.log(`[libzmq-fix] ${message}`);
}

function downloadFile(url, destination) {
  log(`Downloading ${url}`);

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    const request = https.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        // Handle redirects
        file.close();
        fs.rmSync(destination, { force: true });
        return resolve(downloadFile(response.headers.location, destination));
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.rmSync(destination, { force: true });
        return reject(new Error(`Unexpected status code ${response.statusCode}`));
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    });

    request.on('error', (error) => {
      file.close();
      fs.rmSync(destination, { force: true });
      reject(error);
    });
  });
}

function extractArchive(archivePath, destination) {
  fs.ensureDirSync(destination);
  log(`Extracting ${path.basename(archivePath)} ...`);
  const command = `powershell -NoProfile -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destination}' -Force"`;
  execSync(command, { stdio: 'inherit' });
}

function findDll(startDir) {
  const entries = fs.readdirSync(startDir, { withFileTypes: true });

  for (const entry of entries) {
    const resolved = path.join(startDir, entry.name);

    if (entry.isDirectory()) {
      const hit = findDll(resolved);
      if (hit) {
        return hit;
      }
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.dll')) {
      const lower = entry.name.toLowerCase();
      if (lower.includes('libzmq') && lower.includes('x64') || lower.includes('mt-4_3') || lower === 'libzmq.dll') {
        return resolved;
      }
    }
  }

  return null;
}

function backupExistingDll() {
  if (!fs.existsSync(TARGET_DLL)) {
    return null;
  }

  const backupPath = `${TARGET_DLL}.backup-${Date.now()}`;
  fs.copyFileSync(TARGET_DLL, backupPath);
  log(`Backed up current DLL -> ${path.basename(backupPath)}`);
  return backupPath;
}

async function installDll() {
  fs.ensureDirSync(LIB_DIR);
  fs.ensureDirSync(TEMP_DIR);

  const backupPath = backupExistingDll();

  for (const source of SOURCES) {
    const archiveName = path.join(TEMP_DIR, path.basename(source.url));
    const extractDir = path.join(TEMP_DIR, path.basename(source.url, path.extname(source.url)));

    try {
      log(`Attempting source: ${source.description}`);
      await downloadFile(source.url, archiveName);
      extractArchive(archiveName, extractDir);

      const dllPath = findDll(extractDir);
      if (!dllPath) {
        throw new Error('No suitable DLL found in archive');
      }

      fs.copyFileSync(dllPath, TARGET_DLL);
      log(`Installed DLL from ${dllPath}`);

      return { backupPath };
    } catch (error) {
      log(`Source failed: ${error.message}`);
    }
  }

  throw new Error('Failed to download a compatible libzmq.dll');
}

function verifyDll() {
  const verifyScript = path.join(PROJECT_ROOT, 'verify-libzmq-dll.js');
  if (!fs.existsSync(verifyScript)) {
    log('Verification script not found, skipping verification step.');
    return;
  }

  try {
    log('Running libzmq verification script...');
    execSync(`node "${verifyScript}"`, { stdio: 'inherit', cwd: PROJECT_ROOT });
  } catch (error) {
    log('Verification reported an issue. Please review the output above.');
    throw error;
  }
}

async function main() {
  log('Starting MT5-compatible libzmq.dll installation');

  try {
    const { backupPath } = await installDll();
    verifyDll();

    log('libzmq.dll installation completed successfully.');
    if (backupPath) {
      log(`Previous DLL backup located at: ${backupPath}`);
    }
  } catch (error) {
    log(`ERROR: ${error.message}`);
    log('The previous DLL has been preserved if a backup was created.');
    process.exit(1);
  } finally {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
