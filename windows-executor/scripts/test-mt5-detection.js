#!/usr/bin/env node

/**
 * MT5 Detection Test Script
 * Tests MT5 detection across different methods and paths
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;

const execAsync = promisify(exec);

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
  log(`  ${message}`, colors.gray);
}

// Check if path exists
async function pathExists(checkPath) {
  try {
    await fs.access(checkPath);
    return true;
  } catch {
    return false;
  }
}

// Method 1: Check standard paths
async function checkStandardPaths() {
  log('\n' + '='.repeat(60), colors.cyan);
  log('Method 1: Checking Standard Installation Paths', colors.cyan);
  log('='.repeat(60), colors.cyan);

  const paths = [];
  const found = [];

  // Program Files
  if (process.env.ProgramFiles) {
    paths.push(path.join(process.env.ProgramFiles, 'MetaTrader 5'));
  }

  // Program Files (x86)
  if (process.env['ProgramFiles(x86)']) {
    paths.push(path.join(process.env['ProgramFiles(x86)'], 'MetaTrader 5'));
  }

  // Local AppData
  if (process.env.LOCALAPPDATA) {
    paths.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'MetaTrader 5'));
  }

  // Common broker paths
  const brokerPaths = [
    'C:\\MetaTrader 5',
    'C:\\MT5',
    'C:\\Trading\\MetaTrader 5',
    'D:\\MetaTrader 5',
    'D:\\MT5',
  ];
  paths.push(...brokerPaths);

  // User paths
  if (process.env.USERPROFILE) {
    paths.push(path.join(process.env.USERPROFILE, 'Desktop', 'MetaTrader 5'));
    paths.push(path.join(process.env.USERPROFILE, 'Desktop', 'MT5'));
    paths.push(path.join(process.env.USERPROFILE, 'Documents', 'MetaTrader 5'));
    paths.push(path.join(process.env.USERPROFILE, 'Downloads', 'MetaTrader 5'));
  }

  log(`\nChecking ${paths.length} standard paths...`);

  for (const checkPath of paths) {
    const exists = await pathExists(checkPath);
    if (exists) {
      const terminal64 = path.join(checkPath, 'terminal64.exe');
      const terminal32 = path.join(checkPath, 'terminal.exe');

      if (await pathExists(terminal64)) {
        logSuccess(`Found: ${checkPath} (64-bit)`);
        found.push({ path: checkPath, arch: 'x64', exe: terminal64 });
      } else if (await pathExists(terminal32)) {
        logSuccess(`Found: ${checkPath} (32-bit)`);
        found.push({ path: checkPath, arch: 'x86', exe: terminal32 });
      } else {
        logWarning(`Directory exists but no terminal.exe: ${checkPath}`);
      }
    }
  }

  if (found.length === 0) {
    logError('No MT5 installations found in standard paths');
  } else {
    logInfo(`Found ${found.length} installation(s) in standard paths`);
  }

  return found;
}

// Method 2: Check Windows Registry
async function checkRegistry() {
  log('\n' + '='.repeat(60), colors.cyan);
  log('Method 2: Checking Windows Registry', colors.cyan);
  log('='.repeat(60), colors.cyan);

  if (process.platform !== 'win32') {
    logWarning('Not running on Windows, skipping registry check');
    return [];
  }

  const found = [];

  // PowerShell method
  log('\nTrying PowerShell registry query...');
  try {
    const psCommand = `
      Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" -ErrorAction SilentlyContinue |
      Where-Object { $_.DisplayName -like "*MetaTrader 5*" -or $_.DisplayName -like "*MT5*" } |
      Select-Object DisplayName, InstallLocation -ErrorAction SilentlyContinue
    `;

    const { stdout } = await execAsync(
      `powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`,
      { timeout: 10000 }
    );

    const lines = stdout.trim().split('\n');
    let currentEntry = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('DisplayName')) {
        const name = trimmed.replace('DisplayName', '').replace(/:/g, '').trim();
        if (name) currentEntry.name = name;
      } else if (trimmed.startsWith('InstallLocation')) {
        const location = trimmed.replace('InstallLocation', '').replace(/:/g, '').trim();
        if (location && location !== 'null' && location !== '') {
          currentEntry.location = location;
        }
      }

      if (currentEntry.name && currentEntry.location) {
        logSuccess(`Found in registry: ${currentEntry.name}`);
        logVerbose(`Location: ${currentEntry.location}`);
        found.push({ path: currentEntry.location, source: 'registry' });
        currentEntry = {};
      }
    }

    // Check Wow6432Node for 32-bit apps
    const psCommand32 = `
      Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" -ErrorAction SilentlyContinue |
      Where-Object { $_.DisplayName -like "*MetaTrader 5*" -or $_.DisplayName -like "*MT5*" } |
      Select-Object DisplayName, InstallLocation -ErrorAction SilentlyContinue
    `;

    const { stdout: stdout32 } = await execAsync(
      `powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand32}"`,
      { timeout: 10000 }
    );

    const lines32 = stdout32.trim().split('\n');
    let currentEntry32 = {};

    for (const line of lines32) {
      const trimmed = line.trim();
      if (trimmed.startsWith('DisplayName')) {
        const name = trimmed.replace('DisplayName', '').replace(/:/g, '').trim();
        if (name) currentEntry32.name = name;
      } else if (trimmed.startsWith('InstallLocation')) {
        const location = trimmed.replace('InstallLocation', '').replace(/:/g, '').trim();
        if (location && location !== 'null' && location !== '') {
          currentEntry32.location = location;
        }
      }

      if (currentEntry32.name && currentEntry32.location) {
        logSuccess(`Found in registry (32-bit): ${currentEntry32.name}`);
        logVerbose(`Location: ${currentEntry32.location}`);
        found.push({ path: currentEntry32.location, source: 'registry-32bit' });
        currentEntry32 = {};
      }
    }
  } catch (error) {
    logWarning(`PowerShell registry check failed: ${error.message}`);
  }

  // reg.exe fallback
  log('\nTrying reg.exe fallback...');
  try {
    const { stdout } = await execAsync(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall" /s /f "MetaTrader 5" /k',
      { timeout: 10000 }
    );

    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.includes('HKEY_LOCAL_MACHINE')) {
        try {
          const keyPath = line.trim();
          const { stdout: valueOut } = await execAsync(
            `reg query "${keyPath}" /v InstallLocation`,
            { timeout: 5000 }
          );
          const match = valueOut.match(/InstallLocation\s+REG_SZ\s+(.+)/);
          if (match && match[1]) {
            const location = match[1].trim();
            logSuccess(`Found via reg.exe: ${location}`);
            found.push({ path: location, source: 'reg.exe' });
          }
        } catch (e) {
          // Key might not have InstallLocation
        }
      }
    }
  } catch (error) {
    logWarning(`reg.exe check failed: ${error.message}`);
  }

  if (found.length === 0) {
    logError('No MT5 installations found in registry');
  } else {
    logInfo(`Found ${found.length} installation(s) in registry`);
  }

  return found;
}

// Method 3: Check portable installations via AppData
async function checkPortableInstallations() {
  log('\n' + '='.repeat(60), colors.cyan);
  log('Method 3: Checking Portable Installations (AppData)', colors.cyan);
  log('='.repeat(60), colors.cyan);

  const found = [];

  try {
    const appDataPath = process.env.APPDATA || '';
    if (!appDataPath) {
      logWarning('APPDATA environment variable not set');
      return found;
    }

    const terminalPath = path.join(appDataPath, 'MetaQuotes', 'Terminal');
    logVerbose(`Checking: ${terminalPath}`);

    if (!(await pathExists(terminalPath))) {
      logWarning('MetaQuotes Terminal folder not found');
      return found;
    }

    const terminals = await fs.readdir(terminalPath);
    log(`\nFound ${terminals.length} terminal data folder(s)`);

    for (const terminal of terminals) {
      const terminalDataPath = path.join(terminalPath, terminal);
      const originPath = path.join(terminalDataPath, 'origin.txt');

      if (await pathExists(originPath)) {
        try {
          const origin = await fs.readFile(originPath, 'utf-8');
          const originPathTrimmed = origin.trim();

          if (originPathTrimmed && (await pathExists(originPathTrimmed))) {
            logSuccess(`Found via origin.txt: ${originPathTrimmed}`);
            logVerbose(`Data path: ${terminalDataPath}`);
            found.push({
              path: originPathTrimmed,
              dataPath: terminalDataPath,
              source: 'portable',
            });
          } else {
            logWarning(`origin.txt points to non-existent path: ${originPathTrimmed}`);
          }
        } catch (error) {
          logWarning(`Could not read origin.txt for ${terminal}: ${error.message}`);
        }
      } else {
        // Check if it's a standalone data folder
        const mql5Path = path.join(terminalDataPath, 'MQL5');
        if (await pathExists(mql5Path)) {
          logInfo(`Found standalone data folder: ${terminal}`);
          logVerbose(`MQL5 path: ${mql5Path}`);
        }
      }
    }

    if (found.length === 0) {
      logWarning('No portable installations found via origin.txt');
    } else {
      logInfo(`Found ${found.length} portable installation(s)`);
    }
  } catch (error) {
    logError(`Error checking portable installations: ${error.message}`);
  }

  return found;
}

// Method 4: Check running processes
async function checkRunningProcesses() {
  log('\n' + '='.repeat(60), colors.cyan);
  log('Method 4: Checking Running MT5 Processes', colors.cyan);
  log('='.repeat(60), colors.cyan);

  if (process.platform !== 'win32') {
    logWarning('Not running on Windows, skipping process check');
    return [];
  }

  const found = [];

  // Method 4a: PowerShell Get-Process
  log('\nTrying PowerShell Get-Process...');
  try {
    const psCommand = `
      Get-Process -Name terminal64,terminal -ErrorAction SilentlyContinue |
      Select-Object Name, Path, Id
    `;

    const { stdout } = await execAsync(
      `powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`,
      { timeout: 5000 }
    );

    if (stdout.trim()) {
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes('terminal') && line.includes('\\')) {
          const match = line.match(/([A-Z]:\\[^\s]+terminal(?:64)?\.exe)/i);
          if (match) {
            const exePath = match[1];
            const dirPath = path.dirname(exePath);
            logSuccess(`Running process found: ${exePath}`);
            found.push({ path: dirPath, exe: exePath, source: 'running-process' });
          }
        }
      }
    } else {
      logWarning('No running MT5 processes found via PowerShell');
    }
  } catch (error) {
    logWarning(`PowerShell process check failed: ${error.message}`);
  }

  // Method 4b: tasklist
  log('\nTrying tasklist...');
  try {
    const { stdout } = await execAsync(
      'tasklist /FI "IMAGENAME eq terminal64.exe" /FO CSV /NH',
      { timeout: 5000 }
    );

    if (stdout.includes('terminal64.exe')) {
      logSuccess('terminal64.exe is running');
      logVerbose('(Path detection limited with tasklist)');
    } else {
      logInfo('terminal64.exe is not running');
    }

    const { stdout: stdout32 } = await execAsync(
      'tasklist /FI "IMAGENAME eq terminal.exe" /FO CSV /NH',
      { timeout: 5000 }
    );

    if (stdout32.includes('terminal.exe')) {
      logSuccess('terminal.exe is running');
      logVerbose('(Path detection limited with tasklist)');
    } else {
      logInfo('terminal.exe is not running');
    }
  } catch (error) {
    logWarning(`tasklist check failed: ${error.message}`);
  }

  // Method 4c: WMIC (deprecated but still works on older Windows)
  log('\nTrying WMIC...');
  try {
    const { stdout } = await execAsync(
      'wmic process where "name like \'%terminal%\'" get ProcessId,Name,ExecutablePath /format:csv',
      { timeout: 5000 }
    );

    const lines = stdout.trim().split('\n').slice(1); // Skip header
    for (const line of lines) {
      if (line.trim() && line.includes('terminal')) {
        const parts = line.split(',');
        if (parts.length >= 3) {
          const exePath = parts[2];
          if (exePath && exePath.length > 3) {
            const dirPath = path.dirname(exePath);
            logSuccess(`Found via WMIC: ${exePath}`);
            found.push({ path: dirPath, exe: exePath, source: 'wmic' });
          }
        }
      }
    }
  } catch (error) {
    logWarning(`WMIC check failed (might be disabled on Windows 11): ${error.message}`);
  }

  if (found.length === 0) {
    logWarning('No running MT5 processes detected');
  } else {
    logInfo(`Found ${found.length} running process(es)`);
  }

  return found;
}

// Validate installation
async function validateInstallation(installation) {
  const issues = [];

  // Check terminal executable
  const terminal64 = path.join(installation.path, 'terminal64.exe');
  const terminal32 = path.join(installation.path, 'terminal.exe');

  if (!(await pathExists(terminal64)) && !(await pathExists(terminal32))) {
    issues.push('No terminal.exe or terminal64.exe found');
  }

  // Check for MQL5 folder
  let mql5Path = path.join(installation.path, 'MQL5');
  if (!(await pathExists(mql5Path)) && installation.dataPath) {
    mql5Path = path.join(installation.dataPath, 'MQL5');
  }

  if (!(await pathExists(mql5Path))) {
    issues.push('MQL5 folder not found');
  } else {
    // Check subdirectories
    const librariesPath = path.join(mql5Path, 'Libraries');
    const expertsPath = path.join(mql5Path, 'Experts');

    if (!(await pathExists(librariesPath))) {
      issues.push('MQL5/Libraries folder not found');
    }
    if (!(await pathExists(expertsPath))) {
      issues.push('MQL5/Experts folder not found');
    }
  }

  return issues;
}

// Main function
async function main() {
  log('');
  log('╔═══════════════════════════════════════════════════════════╗', colors.bright + colors.cyan);
  log('║         MT5 Detection Test Script                        ║', colors.bright + colors.cyan);
  log('╚═══════════════════════════════════════════════════════════╝', colors.bright + colors.cyan);
  log('');

  const allFound = new Map(); // Use Map to deduplicate by path

  // Run all detection methods
  const results1 = await checkStandardPaths();
  results1.forEach((r) => allFound.set(r.path.toLowerCase(), r));

  const results2 = await checkRegistry();
  results2.forEach((r) => allFound.set(r.path.toLowerCase(), r));

  const results3 = await checkPortableInstallations();
  results3.forEach((r) => allFound.set(r.path.toLowerCase(), r));

  const results4 = await checkRunningProcesses();
  results4.forEach((r) => allFound.set(r.path.toLowerCase(), r));

  // Summary
  log('\n' + '='.repeat(60), colors.cyan);
  log('SUMMARY', colors.bright + colors.cyan);
  log('='.repeat(60), colors.cyan);

  const uniqueInstallations = Array.from(allFound.values());

  if (uniqueInstallations.length === 0) {
    log('');
    logError('No MT5 installations detected!');
    log('');
    logInfo('Possible reasons:');
    log('  • MT5 is not installed on this system', colors.gray);
    log('  • MT5 is installed in a non-standard location', colors.gray);
    log('  • Insufficient permissions to detect MT5', colors.gray);
    log('');
    logInfo('Manual verification:');
    log('  • Check if terminal64.exe exists in your MT5 folder', colors.gray);
    log('  • Try running this script as Administrator', colors.gray);
    log('');
    process.exit(1);
  }

  log(`\nTotal unique installations found: ${uniqueInstallations.length}`);
  log('');

  for (let i = 0; i < uniqueInstallations.length; i++) {
    const installation = uniqueInstallations[i];
    log(`${i + 1}. ${installation.path}`, colors.bright);
    logVerbose(`Source: ${installation.source || 'unknown'}`);

    if (installation.arch) {
      logVerbose(`Architecture: ${installation.arch}`);
    }

    if (installation.dataPath) {
      logVerbose(`Data Path: ${installation.dataPath}`);
    }

    // Validate
    const issues = await validateInstallation(installation);
    if (issues.length === 0) {
      logSuccess('Valid installation ✓');
    } else {
      logWarning('Issues detected:');
      issues.forEach((issue) => log(`    • ${issue}`, colors.yellow));
    }

    log('');
  }

  log('='.repeat(60), colors.cyan);
  log('');
  logSuccess('Detection test completed!');
  log('');

  // Save results to file
  const resultsFile = path.join(__dirname, '..', 'mt5-detection-results.json');
  try {
    await fs.writeFile(
      resultsFile,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          platform: process.platform,
          totalFound: uniqueInstallations.length,
          installations: uniqueInstallations,
        },
        null,
        2
      )
    );
    logInfo(`Results saved to: ${resultsFile}`);
  } catch (error) {
    logWarning(`Could not save results: ${error.message}`);
  }

  process.exit(0);
}

// Run main
if (require.main === module) {
  main().catch((error) => {
    logError(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  checkStandardPaths,
  checkRegistry,
  checkPortableInstallations,
  checkRunningProcesses,
  validateInstallation,
};
