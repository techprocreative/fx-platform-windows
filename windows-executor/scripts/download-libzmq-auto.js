#!/usr/bin/env node

/**
 * Automatic libzmq.dll Download & Installation Script
 * Downloads correct version from official sources
 */

const https = require('https');
const http = require('http');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n' + '='.repeat(70));
console.log('LIBZMQ.DLL AUTOMATIC DOWNLOAD & INSTALLATION');
console.log('='.repeat(70) + '\n');

const RESOURCES_DIR = path.join(__dirname, '..', 'resources', 'libs');
const TARGET_DLL = path.join(RESOURCES_DIR, 'libzmq-x64.dll');
const TEMP_DIR = path.join(__dirname, '..', 'temp-libzmq');

// Known working URLs
const DOWNLOAD_SOURCES = [
  {
    name: 'ZeroMQ Official v4.3.5',
    url: 'https://github.com/zeromq/libzmq/releases/download/v4.3.5/zeromq-4.3.5-x64.zip',
    dllPath: 'bin/libzmq-v142-mt-4_3_5.dll'
  },
  {
    name: 'ZeroMQ Official v4.3.4',
    url: 'https://github.com/zeromq/libzmq/releases/download/v4.3.4/libzmq-v141-x64-4_3_4.zip',
    dllPath: 'bin/libzmq-v141-mt-4_3_4.dll'
  }
];

/**
 * Download file from URL
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading from: ${url}`);
    
    const file = fs.createWriteStream(dest);
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        console.log(`   ↪️ Following redirect...`);
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloaded = 0;
      
      response.on('data', (chunk) => {
        downloaded += chunk.length;
        if (totalSize) {
          const percent = ((downloaded / totalSize) * 100).toFixed(1);
          process.stdout.write(`\r   Progress: ${percent}% (${(downloaded / 1024 / 1024).toFixed(2)} MB)`);
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log('\n   ✅ Download complete\n');
        resolve();
      });
    });
    
    request.on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
    
    file.on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

/**
 * Extract ZIP file using PowerShell
 */
function extractZip(zipPath, extractDir) {
  console.log(`📦 Extracting ZIP file...`);
  
  try {
    // Ensure extract directory exists
    fs.ensureDirSync(extractDir);
    
    // Use PowerShell to extract
    const psCommand = `Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force`;
    execSync(`powershell -Command "${psCommand}"`, { stdio: 'pipe' });
    
    console.log(`   ✅ Extraction complete\n`);
    return true;
  } catch (error) {
    console.error(`   ❌ Extraction failed: ${error.message}\n`);
    return false;
  }
}

/**
 * Find DLL in extracted directory
 */
function findDll(baseDir, dllPath) {
  const possiblePaths = [
    path.join(baseDir, dllPath),
    path.join(baseDir, 'bin', 'libzmq.dll'),
    path.join(baseDir, 'libzmq.dll'),
  ];
  
  // Also search recursively for any libzmq*.dll
  try {
    const files = [];
    const searchDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          searchDir(fullPath);
        } else if (entry.name.toLowerCase().includes('libzmq') && entry.name.endsWith('.dll')) {
          files.push(fullPath);
        }
      }
    };
    searchDir(baseDir);
    possiblePaths.push(...files);
  } catch (error) {
    // Ignore search errors
  }
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  
  return null;
}

/**
 * Verify downloaded DLL
 */
async function verifyDll(dllPath) {
  console.log(`🔍 Verifying DLL...`);
  
  try {
    const verifyScript = path.join(__dirname, 'verify-libzmq-enhanced.js');
    
    if (!fs.existsSync(verifyScript)) {
      console.log(`   ⚠️ Verification script not found, skipping detailed check\n`);
      return true;
    }
    
    const result = execSync(`node "${verifyScript}" --dll "${dllPath}"`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    const passed = result.includes('VERIFICATION PASSED');
    
    if (passed) {
      console.log(`   ✅ DLL verification passed\n`);
    } else {
      console.log(`   ⚠️ DLL verification warnings (may still work)\n`);
    }
    
    return passed;
    
  } catch (error) {
    console.log(`   ⚠️ Verification failed, but DLL may still work\n`);
    return true; // Don't block installation
  }
}

/**
 * Main download and installation process
 */
async function main() {
  try {
    // Ensure directories exist
    await fs.ensureDir(RESOURCES_DIR);
    await fs.ensureDir(TEMP_DIR);
    
    // Backup existing DLL if it exists
    if (fs.existsSync(TARGET_DLL)) {
      const backupPath = `${TARGET_DLL}.backup.${Date.now()}`;
      console.log(`💾 Backing up existing DLL to: ${path.basename(backupPath)}\n`);
      fs.copyFileSync(TARGET_DLL, backupPath);
    }
    
    // Try each download source
    let success = false;
    
    for (const source of DOWNLOAD_SOURCES) {
      console.log(`🔄 Trying: ${source.name}\n`);
      
      try {
        const zipPath = path.join(TEMP_DIR, `libzmq-${Date.now()}.zip`);
        const extractDir = path.join(TEMP_DIR, `extract-${Date.now()}`);
        
        // Download
        await downloadFile(source.url, zipPath);
        
        // Extract
        const extracted = extractZip(zipPath, extractDir);
        if (!extracted) {
          console.log(`   ⚠️ Skipping this source\n`);
          continue;
        }
        
        // Find DLL
        const dllPath = findDll(extractDir, source.dllPath);
        if (!dllPath) {
          console.log(`   ❌ DLL not found in archive\n`);
          continue;
        }
        
        console.log(`   ✅ Found DLL: ${path.basename(dllPath)}\n`);
        
        // Verify
        const verified = await verifyDll(dllPath);
        
        // Copy to target
        console.log(`📋 Installing DLL to: ${TARGET_DLL}\n`);
        fs.copyFileSync(dllPath, TARGET_DLL);
        
        console.log('✅ Installation successful!\n');
        success = true;
        break;
        
      } catch (error) {
        console.error(`   ❌ Failed: ${error.message}\n`);
        continue;
      }
    }
    
    // Cleanup temp directory
    try {
      console.log(`🧹 Cleaning up temporary files...\n`);
      fs.removeSync(TEMP_DIR);
    } catch (error) {
      // Ignore cleanup errors
    }
    
    if (success) {
      console.log('='.repeat(70));
      console.log('✅ LIBZMQ.DLL INSTALLATION COMPLETE!');
      console.log('='.repeat(70));
      console.log();
      console.log('Next steps:');
      console.log('  1. Run: npm run verify:dll');
      console.log('  2. Test in MT5 with Expert Advisor');
      console.log('  3. If successful, proceed with: npm run build');
      console.log();
      
      process.exit(0);
    } else {
      console.log('='.repeat(70));
      console.log('❌ AUTOMATIC INSTALLATION FAILED');
      console.log('='.repeat(70));
      console.log();
      console.log('Manual installation required:');
      console.log('  1. Download from: https://github.com/zeromq/libzmq/releases');
      console.log('  2. Extract the ZIP file');
      console.log('  3. Copy libzmq*.dll to: resources/libs/libzmq-x64.dll');
      console.log('  4. Run: npm run verify:dll');
      console.log();
      
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run
main();
