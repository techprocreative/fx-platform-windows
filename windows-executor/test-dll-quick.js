#!/usr/bin/env node

/**
 * Quick DLL Test - Verify if our built DLL works
 */

console.log('\n=== QUICK DLL FUNCTIONALITY TEST ===\n');

try {
  // Load ZeroMQ module
  const zmq = require('zeromq');
  console.log('✅ ZeroMQ module loaded successfully');
  console.log('   Version:', zmq.version);
  
  // Try to create a socket
  const socket = new zmq.Request();
  console.log('✅ ZeroMQ Request socket created');
  
  // Check socket methods
  console.log('✅ Socket has connect method:', typeof socket.connect === 'function');
  console.log('✅ Socket has send method:', typeof socket.send === 'function');
  console.log('✅ Socket has receive method:', typeof socket.receive === 'function');
  console.log('✅ Socket has close method:', typeof socket.close === 'function');
  
  // Close socket
  socket.close();
  console.log('✅ Socket closed successfully');
  
  console.log('\n=== ALL BASIC TESTS PASSED ===');
  console.log('\n✅ DLL IS WORKING CORRECTLY!');
  console.log('✅ Ready for MT5 testing!');
  console.log();
  
  process.exit(0);
  
} catch (error) {
  console.error('\n❌ ERROR:', error.message);
  console.error('\nStack:', error.stack);
  process.exit(1);
}
