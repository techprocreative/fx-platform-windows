/**
 * Verification Script for libzmq DLL
 * Checks if libzmq.dll has the correct exports for MT5 compatibility
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('='.repeat(60));
console.log('LIBZMQ DLL VERIFICATION SCRIPT');
console.log('='.repeat(60));

// Path to the DLL
const args = process.argv.slice(2);
const dllArgIndex = args.indexOf('--dll');
const explicitPath = dllArgIndex >= 0 && args[dllArgIndex + 1] ? args[dllArgIndex + 1] : undefined;
const dllPath = explicitPath
  ? path.resolve(explicitPath)
  : path.join(__dirname, 'resources', 'libs', 'libzmq-x64.dll');

// Check if DLL exists
if (!fs.existsSync(dllPath)) {
  console.error(`❌ ERROR: DLL not found at ${dllPath}`);
  process.exit(1);
}

// Get file stats
const stats = fs.statSync(dllPath);
console.log(`\n📁 DLL Path: ${dllPath}`);
console.log(`📊 File Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB (${stats.size.toLocaleString()} bytes)`);
console.log(`📅 Last Modified: ${stats.mtime}`);

// Try to check exports using PowerShell (alternative to dumpbin)
console.log('\n🔍 Attempting to check DLL exports...');

let verificationPassed = true;

try {
  // First check if we can use dumpbin
  try {
    const dumpbinCheck = execSync('where dumpbin', { encoding: 'utf8', stdio: 'pipe' });
    console.log('✅ dumpbin found, using it to check exports...');
    
    const exports = execSync(`dumpbin /exports "${dllPath}"`, { encoding: 'utf8' });
    
    // Check for required functions
    const requiredFunctions = [
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
      'zmq_proxy',
      'zmq_version'
    ];
    
    console.log('\n📋 Checking for required MT5 functions:');
    const foundFunctions = [];
    const missingFunctions = [];
    
    requiredFunctions.forEach(func => {
      if (exports.includes(func)) {
        foundFunctions.push(func);
        console.log(`  ✅ ${func} - FOUND`);
      } else {
        missingFunctions.push(func);
        console.log(`  ❌ ${func} - NOT FOUND`);
      }
    });
    
    console.log('\n📊 Summary:');
    console.log(`  ✅ Functions found: ${foundFunctions.length}/${requiredFunctions.length}`);
    console.log(`  ❌ Functions missing: ${missingFunctions.length}/${requiredFunctions.length}`);
    
    if (missingFunctions.length > 0) {
      console.log('\n⚠️ WARNING: Missing critical functions for MT5 compatibility!');
      console.log('Missing:', missingFunctions.join(', '));
      verificationPassed = false;
    }
    
  } catch (dumpbinError) {
    console.log('⚠️ dumpbin not available, trying alternative method...');
    
    // Alternative: Use PowerShell to get DLL info
    const psCommand = `
      Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      using System.Reflection;
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
      $functions = @('zmq_ctx_new', 'zmq_ctx_destroy', 'zmq_socket', 'zmq_close', 'zmq_bind', 'zmq_connect', 'zmq_send', 'zmq_recv')
      
      foreach ($func in $functions) {
        $exists = [DllChecker]::CheckFunction($dllPath, $func)
        if ($exists) {
          Write-Host "FOUND: $func"
        } else {
          Write-Host "MISSING: $func"
        }
      }
    `;
    
    const psResult = execSync(`powershell -Command "${psCommand}"`, { encoding: 'utf8' });
    console.log('\n📋 PowerShell DLL Check Results:');
    console.log(psResult);
    
    // Parse results
    const lines = psResult.split('\n').filter(l => l.trim());
    const found = lines.filter(l => l.startsWith('FOUND:')).length;
    const missing = lines.filter(l => l.startsWith('MISSING:')).length;
    
    console.log('\n📊 Summary:');
    console.log(`  ✅ Functions found: ${found}`);
    console.log(`  ❌ Functions missing: ${missing}`);
    
    if (missing > 0) {
      console.log('\n⚠️ CRITICAL: DLL is missing required exports for MT5!');
      console.log('This confirms the MT5 error: "cannot find \'int libzmq::zmq_ctx_new()\' in module"');
      verificationPassed = false;
    } else if (found === 0) {
      console.log('\n⚠️ No exports could be validated. Ensure PowerShell has access to required functions.');
      verificationPassed = false;
    }
  }
  
} catch (error) {
  console.error('\n❌ Error checking DLL exports:', error.message);
  console.log('\n💡 Manual verification needed:');
  console.log('1. Install Visual Studio Build Tools for dumpbin');
  console.log('2. Or use Dependency Walker (depends.exe)');
  console.log('3. Or use a hex editor to check the export table');
  verificationPassed = false;
}

// Additional checks
console.log('\n🔧 Additional Verification:');

// Check if it's a valid Windows DLL
const buffer = Buffer.alloc(2);
const fd = fs.openSync(dllPath, 'r');
fs.readSync(fd, buffer, 0, 2, 0);
fs.closeSync(fd);

if (buffer.toString('ascii') === 'MZ') {
  console.log('✅ Valid Windows PE executable format (MZ header)');
} else {
  console.log('❌ Invalid DLL format - not a Windows PE file');
  verificationPassed = false;
}

// Check architecture
try {
  const fileBuffer = fs.readFileSync(dllPath);
  const peOffset = fileBuffer.readUInt32LE(0x3C);
  const machine = fileBuffer.readUInt16LE(peOffset + 4);
  
  if (machine === 0x8664) {
    console.log('✅ Architecture: x64 (64-bit) - Compatible with 64-bit MT5');
  } else if (machine === 0x014c) {
    console.log('⚠️ Architecture: x86 (32-bit) - May not work with 64-bit MT5');
    verificationPassed = false;
  } else {
    console.log(`⚠️ Unknown architecture: 0x${machine.toString(16)}`);
    verificationPassed = false;
  }
} catch (archError) {
  console.log('⚠️ Could not determine DLL architecture');
  verificationPassed = false;
}

console.log('\n' + '='.repeat(60));
console.log('RECOMMENDATIONS:');
console.log('='.repeat(60));
console.log('\n1. Download proper libzmq from official sources:');
console.log('   https://github.com/zeromq/libzmq/releases');
console.log('   Look for: libzmq-v4.3.5-x64.zip (with MSVC builds)');
console.log('\n2. Verify the DLL has C exports (not C++ mangled names)');
console.log('\n3. Test with this MT5 script snippet:');
console.log(`
#import "libzmq.dll"
   int zmq_ctx_new();
   int zmq_ctx_destroy(int context);
   int zmq_version(int &major, int &minor, int &patch);
#import

void OnStart() {
   int major, minor, patch;
   zmq_version(major, minor, patch);
   Print("ZeroMQ Version: ", major, ".", minor, ".", patch);
   
   int ctx = zmq_ctx_new();
   if (ctx != 0) {
      Print("Context created successfully!");
      zmq_ctx_destroy(ctx);
   } else {
      Print("Failed to create context!");
   }
}
`);

console.log('\n' + '='.repeat(60));
console.log('Verification complete.');

if (!verificationPassed) {
  process.exitCode = 1;
}
