// Test MT5 Detection
const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log(' MT5 Detection Test');
console.log('========================================');
console.log();

// Check standard paths
const standardPaths = [
  'C:\\Program Files\\MetaTrader 5',
  'C:\\Program Files (x86)\\MetaTrader 5',
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'MetaTrader 5'),
  'C:\\MetaTrader 5',
  'C:\\MT5',
];

console.log('Checking standard installation paths:');
console.log();

for (const basePath of standardPaths) {
  const terminal64 = path.join(basePath, 'terminal64.exe');
  const terminal32 = path.join(basePath, 'terminal.exe');
  
  if (fs.existsSync(terminal64)) {
    console.log('✓ FOUND (64-bit):', basePath);
    console.log('  Executable:', terminal64);
    
    // Check MQL5 folders
    const mql5Path = path.join(basePath, 'MQL5');
    if (fs.existsSync(mql5Path)) {
      console.log('  MQL5 folder: YES');
    } else {
      console.log('  MQL5 folder: NO (in base path)');
      
      // Check AppData for data path
      const appDataPath = process.env.APPDATA || '';
      const terminalDataPath = path.join(appDataPath, 'MetaQuotes', 'Terminal');
      if (fs.existsSync(terminalDataPath)) {
        console.log('  MQL5 might be in:', terminalDataPath);
      }
    }
    console.log();
  } else if (fs.existsSync(terminal32)) {
    console.log('✓ FOUND (32-bit):', basePath);
    console.log('  Executable:', terminal32);
    console.log();
  }
}

console.log('========================================');
console.log(' Data Folder Detection');
console.log('========================================');
console.log();

// Check AppData for data folders
const appDataPath = process.env.APPDATA || '';
const terminalDataPath = path.join(appDataPath, 'MetaQuotes', 'Terminal');

console.log('Checking:', terminalDataPath);
console.log();

if (fs.existsSync(terminalDataPath)) {
  console.log('✓ Terminal data folder exists');
  
  try {
    const terminals = fs.readdirSync(terminalDataPath);
    console.log(`  Found ${terminals.length} terminal data folder(s):`);
    
    for (const terminal of terminals) {
      const terminalDir = path.join(terminalDataPath, terminal);
      const originPath = path.join(terminalDir, 'origin.txt');
      
      if (fs.existsSync(originPath)) {
        try {
          const origin = fs.readFileSync(originPath, 'utf8').trim();
          console.log();
          console.log(`  Terminal: ${terminal.substring(0, 16)}...`);
          console.log(`  Linked to: ${origin}`);
          
          // Check for MQL5 folder
          const mql5Path = path.join(terminalDir, 'MQL5');
          if (fs.existsSync(mql5Path)) {
            console.log(`  MQL5 folder: YES`);
            console.log(`  Libraries: ${path.join(mql5Path, 'Libraries')}`);
            console.log(`  Experts: ${path.join(mql5Path, 'Experts')}`);
          }
        } catch (err) {
          console.log(`  Could not read origin.txt: ${err.message}`);
        }
      }
    }
  } catch (err) {
    console.log(`  Error reading terminal folders: ${err.message}`);
  }
} else {
  console.log('✗ Terminal data folder not found');
}

console.log();
console.log('========================================');
console.log(' Summary');
console.log('========================================');
console.log();
console.log('If MT5 is installed but not detected:');
console.log('1. Make sure MT5 is fully installed');
console.log('2. Run MT5 at least once to create data folders');
console.log('3. Check if MT5 is in custom location');
console.log('4. Provide manual path in Setup Wizard');
console.log();
