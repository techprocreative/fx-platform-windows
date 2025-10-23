#!/usr/bin/env node

/**
 * Test ZeroMQ Installation
 * This script verifies that zeromq is properly installed and can be loaded
 */

console.log('🧪 Testing ZeroMQ Installation...\n');

// Test 1: Check if zeromq package is installed
console.log('Test 1: Checking package installation...');
try {
  const packageJson = require('../package.json');
  const zmqVersion = packageJson.dependencies.zeromq;
  console.log(`✓ zeromq package found in dependencies: ${zmqVersion}`);
} catch (error) {
  console.error('✗ Failed to read package.json:', error.message);
  process.exit(1);
}

// Test 2: Try to require zeromq
console.log('\nTest 2: Loading zeromq module...');
try {
  const zmq = require('zeromq');
  console.log('✓ zeromq module loaded successfully');

  // Check version
  if (zmq.version) {
    console.log(`  Version: ${zmq.version}`);
  }

  // Check available socket types
  console.log('  Available features:');
  console.log('    - Request socket:', typeof zmq.Request !== 'undefined' ? '✓' : '✗');
  console.log('    - Reply socket:', typeof zmq.Reply !== 'undefined' ? '✓' : '✗');
  console.log('    - Publisher socket:', typeof zmq.Publisher !== 'undefined' ? '✓' : '✗');
  console.log('    - Subscriber socket:', typeof zmq.Subscriber !== 'undefined' ? '✓' : '✗');

} catch (error) {
  console.error('✗ Failed to load zeromq module:', error.message);
  console.error('\nPossible solutions:');
  console.error('  1. Run: npm install');
  console.error('  2. Run: npm rebuild zeromq');
  console.error('  3. Run: npm run rebuild');
  console.error('  4. Check if Visual Studio Build Tools is installed (Windows)');
  process.exit(1);
}

// Test 3: Try to create a socket
console.log('\nTest 3: Creating test socket...');
try {
  const zmq = require('zeromq');
  const socket = new zmq.Request();
  console.log('✓ Request socket created successfully');

  // Close socket
  socket.close();
  console.log('✓ Socket closed successfully');

} catch (error) {
  console.error('✗ Failed to create socket:', error.message);
  process.exit(1);
}

// Test 4: Check native binary
console.log('\nTest 4: Checking native binary...');
try {
  const fs = require('fs');
  const path = require('path');

  const possiblePaths = [
    path.join(__dirname, '../node_modules/zeromq/build/Release/zeromq.node'),
    path.join(__dirname, '../node_modules/zeromq/prebuilds'),
  ];

  let found = false;
  for (const nativePath of possiblePaths) {
    if (fs.existsSync(nativePath)) {
      console.log(`✓ Native binary found: ${nativePath}`);

      // Get file size
      const stats = fs.statSync(nativePath);
      if (stats.isFile()) {
        console.log(`  Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      } else if (stats.isDirectory()) {
        const files = fs.readdirSync(nativePath);
        console.log(`  Prebuilds available: ${files.length} files`);
      }
      found = true;
      break;
    }
  }

  if (!found) {
    console.log('⚠ Native binary not found in expected locations');
    console.log('  This might be OK if using prebuilds or different structure');
  }

} catch (error) {
  console.log('⚠ Could not check native binary:', error.message);
}

// Test 5: Check for libzmq DLLs (optional)
console.log('\nTest 5: Checking for libzmq DLLs (optional)...');
try {
  const fs = require('fs');
  const path = require('path');

  const dllPath = path.join(__dirname, '../resources/libs');

  if (fs.existsSync(dllPath)) {
    const files = fs.readdirSync(dllPath).filter(f => f.endsWith('.dll'));
    if (files.length > 0) {
      console.log(`✓ Found ${files.length} DLL file(s) in resources/libs/`);
      files.forEach(file => {
        const stats = fs.statSync(path.join(dllPath, file));
        console.log(`  - ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      });
    } else {
      console.log('ℹ No DLL files found in resources/libs/');
      console.log('  This is OK - zeromq package includes libzmq');
    }
  } else {
    console.log('ℹ resources/libs/ directory not found');
    console.log('  This is OK - zeromq package includes libzmq');
  }

} catch (error) {
  console.log('⚠ Could not check DLLs:', error.message);
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('🎉 ZeroMQ Installation Test Complete!\n');
console.log('Summary:');
console.log('  ✓ Package installed');
console.log('  ✓ Module can be loaded');
console.log('  ✓ Sockets can be created');
console.log('\nZeroMQ is ready to use!');
console.log('\nNext steps:');
console.log('  1. Configure ZeroMQ settings in app config');
console.log('  2. Ensure MT5 Expert Advisor is running');
console.log('  3. Start the Windows Executor application');
console.log('='.repeat(50));

process.exit(0);
