#!/usr/bin/env node

/**
 * Enhanced libzmq.dll Verification Script
 * Comprehensive checks for MT5 compatibility
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('='.repeat(70));
console.log('ENHANCED LIBZMQ DLL VERIFICATION');
console.log('='.repeat(70));

// Parse command line arguments
const args = process.argv.slice(2);
const dllArgIndex = args.indexOf('--dll');
const explicitPath = dllArgIndex >= 0 && args[dllArgIndex + 1] 
  ? path.resolve(args[dllArgIndex + 1])
  : path.join(__dirname, '..', 'resources', 'libs', 'libzmq-x64.dll');

const dllPath = explicitPath;

console.log(`\n📁 DLL Path: ${dllPath}\n`);

/**
 * Comprehensive verification of libzmq.dll
 */
async function comprehensiveVerification(dllPath) {
  const results = {
    fileExists: false,
    fileSize: 0,
    validPE: false,
    correctArch: false,
    hasRequiredExports: false,
    exportDetails: [],
    missingExports: [],
    recommendations: [],
    score: 0
  };
  
  // 1. File exists check
  console.log('📋 Step 1: File Existence Check');
  if (!fs.existsSync(dllPath)) {
    results.recommendations.push('❌ DLL file not found at specified path');
    console.log('  ❌ File does not exist\n');
    return results;
  }
  
  results.fileExists = true;
  const stats = fs.statSync(dllPath);
  results.fileSize = stats.size;
  
  console.log(`  ✅ File exists`);
  console.log(`  📊 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB (${stats.size.toLocaleString()} bytes)`);
  console.log(`  📅 Modified: ${stats.mtime.toISOString()}\n`);
  results.score += 20;
  
  // 2. PE header validation
  console.log('📋 Step 2: PE Header Validation');
  try {
    const buffer = Buffer.alloc(2);
    const fd = fs.openSync(dllPath, 'r');
    fs.readSync(fd, buffer, 0, 2, 0);
    fs.closeSync(fd);
    
    results.validPE = (buffer.toString('ascii') === 'MZ');
    
    if (results.validPE) {
      console.log('  ✅ Valid Windows PE executable format (MZ header)\n');
      results.score += 20;
    } else {
      console.log('  ❌ Invalid PE format - not a Windows executable\n');
      results.recommendations.push('❌ File is not a valid Windows DLL');
      return results;
    }
  } catch (error) {
    console.log(`  ❌ Error reading PE header: ${error.message}\n`);
    results.recommendations.push('❌ Cannot read file - may be corrupted');
    return results;
  }
  
  // 3. Architecture check
  console.log('📋 Step 3: Architecture Check');
  try {
    const fileBuffer = fs.readFileSync(dllPath);
    const peOffset = fileBuffer.readUInt32LE(0x3C);
    const machine = fileBuffer.readUInt16LE(peOffset + 4);
    
    if (machine === 0x8664) {
      results.correctArch = true;
      console.log('  ✅ Architecture: x64 (64-bit) - Compatible with 64-bit MT5\n');
      results.score += 20;
    } else if (machine === 0x014c) {
      console.log('  ⚠️ Architecture: x86 (32-bit) - May not work with 64-bit MT5\n');
      results.recommendations.push('⚠️ 32-bit DLL detected - need 64-bit for modern MT5');
      results.score += 10;
    } else {
      console.log(`  ❌ Unknown architecture: 0x${machine.toString(16)}\n`);
      results.recommendations.push('❌ Unknown or unsupported architecture');
    }
  } catch (archError) {
    console.log(`  ⚠️ Could not determine architecture: ${archError.message}\n`);
    results.recommendations.push('⚠️ Architecture verification failed');
  }
  
  // 4. Export verification
  console.log('📋 Step 4: Function Export Verification');
  
  const requiredExports = [
    'zmq_ctx_new',
    'zmq_ctx_destroy',
    'zmq_ctx_term',
    'zmq_socket',
    'zmq_close',
    'zmq_bind',
    'zmq_connect',
    'zmq_send',
    'zmq_recv',
    'zmq_msg_init',
    'zmq_msg_close',
    'zmq_msg_data',
    'zmq_msg_size',
    'zmq_setsockopt',
    'zmq_getsockopt',
    'zmq_poll',
    'zmq_version',
    'zmq_errno',
    'zmq_strerror'
  ];
  
  try {
    // Try using dumpbin (Visual Studio tool)
    try {
      const dumpbinPath = execSync('where dumpbin', { encoding: 'utf8', stdio: 'pipe' }).trim();
      console.log(`  ℹ️ Using dumpbin from: ${dumpbinPath.split('\n')[0]}\n`);
      
      const exports = execSync(`dumpbin /exports "${dllPath}"`, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      console.log('  📊 Checking for required MT5 functions:\n');
      
      requiredExports.forEach(funcName => {
        const found = exports.includes(funcName);
        results.exportDetails.push({ name: funcName, found });
        
        if (found) {
          console.log(`     ✅ ${funcName}`);
        } else {
          console.log(`     ❌ ${funcName} - NOT FOUND`);
          results.missingExports.push(funcName);
        }
      });
      
      const foundCount = results.exportDetails.filter(e => e.found).length;
      results.hasRequiredExports = (foundCount === requiredExports.length);
      
      if (results.hasRequiredExports) {
        console.log(`\n  ✅ All ${requiredExports.length} required functions found!\n`);
        results.score += 40;
      } else {
        console.log(`\n  ⚠️ Missing ${results.missingExports.length}/${requiredExports.length} functions\n`);
        results.recommendations.push(
          `❌ Missing critical functions: ${results.missingExports.slice(0, 5).join(', ')}${results.missingExports.length > 5 ? '...' : ''}`
        );
        results.score += Math.floor((foundCount / requiredExports.length) * 40);
      }
      
    } catch (dumpbinError) {
      console.log('  ⚠️ dumpbin not available, trying alternative method...\n');
      
      // Alternative: Use PowerShell
      const psScript = `
        Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        public class DllChecker {
          [DllImport("kernel32.dll", SetLastError = true)]
          static extern IntPtr LoadLibrary(string lpFileName);
          
          [DllImport("kernel32.dll", CharSet=CharSet.Ansi, SetLastError = true)]
          static extern IntPtr GetProcAddress(IntPtr hModule, string procName);
          
          [DllImport("kernel32.dll", SetLastError = true)]
          static extern bool FreeLibrary(IntPtr hModule);
          
          public static bool CheckFunction(string dllPath, string functionName) {
            IntPtr hModule = LoadLibrary(dllPath);
            if (hModule == IntPtr.Zero) return false;
            
            IntPtr procAddress = GetProcAddress(hModule, functionName);
            bool exists = procAddress != IntPtr.Zero;
            
            FreeLibrary(hModule);
            return exists;
          }
        }
"@
        
        $dllPath = "${dllPath.replace(/\\/g, '\\\\')}"
        $functions = @(${requiredExports.map(f => `'${f}'`).join(', ')})
        
        foreach ($func in $functions) {
          $exists = [DllChecker]::CheckFunction($dllPath, $func)
          if ($exists) {
            Write-Host "FOUND: $func"
          } else {
            Write-Host "MISSING: $func"
          }
        }
      `;
      
      try {
        const psResult = execSync(`powershell -Command "${psScript}"`, { 
          encoding: 'utf8',
          stdio: 'pipe'
        });
        
        console.log('  📊 PowerShell DLL Check Results:\n');
        
        const lines = psResult.split('\n').filter(l => l.trim());
        lines.forEach(line => {
          if (line.startsWith('FOUND:')) {
            const funcName = line.replace('FOUND:', '').trim();
            results.exportDetails.push({ name: funcName, found: true });
            console.log(`     ✅ ${funcName}`);
          } else if (line.startsWith('MISSING:')) {
            const funcName = line.replace('MISSING:', '').trim();
            results.exportDetails.push({ name: funcName, found: false });
            results.missingExports.push(funcName);
            console.log(`     ❌ ${funcName}`);
          }
        });
        
        const foundCount = results.exportDetails.filter(e => e.found).length;
        results.hasRequiredExports = (foundCount === requiredExports.length);
        
        if (foundCount === 0) {
          console.log('\n  ❌ Could not validate any exports\n');
          results.recommendations.push('❌ Unable to verify exports - manual check required');
        } else if (results.hasRequiredExports) {
          console.log(`\n  ✅ All ${foundCount} functions validated!\n`);
          results.score += 40;
        } else {
          console.log(`\n  ⚠️ ${foundCount}/${requiredExports.length} functions found\n`);
          results.recommendations.push(`⚠️ Missing ${results.missingExports.length} functions`);
          results.score += Math.floor((foundCount / requiredExports.length) * 40);
        }
        
      } catch (psError) {
        console.log(`  ❌ PowerShell check failed: ${psError.message}\n`);
        results.recommendations.push('❌ Could not verify exports - install Visual Studio Build Tools');
      }
    }
    
  } catch (error) {
    console.log(`  ❌ Error checking exports: ${error.message}\n`);
    results.recommendations.push('❌ Export verification failed');
  }
  
  return results;
}

/**
 * Main execution
 */
async function main() {
  try {
    const results = await comprehensiveVerification(dllPath);
    
    // Print summary
    console.log('='.repeat(70));
    console.log('VERIFICATION SUMMARY');
    console.log('='.repeat(70));
    console.log();
    
    console.log(`Overall Score: ${results.score}/100`);
    console.log();
    
    console.log('Checklist:');
    console.log(`  ${results.fileExists ? '✅' : '❌'} File exists`);
    console.log(`  ${results.validPE ? '✅' : '❌'} Valid PE format`);
    console.log(`  ${results.correctArch ? '✅' : '❌'} Correct architecture (x64)`);
    console.log(`  ${results.hasRequiredExports ? '✅' : '❌'} Has all required exports`);
    console.log();
    
    if (results.exportDetails.length > 0) {
      const foundCount = results.exportDetails.filter(e => e.found).length;
      console.log(`Export Statistics: ${foundCount}/${results.exportDetails.length} functions found`);
      console.log();
    }
    
    if (results.missingExports.length > 0) {
      console.log('⚠️ Missing Exports:');
      results.missingExports.forEach(exp => console.log(`   - ${exp}`));
      console.log();
    }
    
    if (results.recommendations.length > 0) {
      console.log('📋 RECOMMENDATIONS:');
      results.recommendations.forEach(rec => console.log(`   ${rec}`));
      console.log();
    }
    
    const passed = results.score >= 80;
    
    console.log('='.repeat(70));
    if (passed) {
      console.log('✅ VERIFICATION PASSED');
      console.log('   This DLL should be compatible with MT5!');
    } else {
      console.log('❌ VERIFICATION FAILED');
      console.log('   This DLL is NOT compatible with MT5!');
      console.log();
      console.log('💡 NEXT STEPS:');
      console.log('   1. Download correct libzmq.dll from:');
      console.log('      https://github.com/zeromq/libzmq/releases');
      console.log('   2. Look for: libzmq-v4.3.5-x64-msvc.zip');
      console.log('   3. Or run: npm run fix:libzmq');
    }
    console.log('='.repeat(70));
    
    process.exit(passed ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ VERIFICATION ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { comprehensiveVerification };
