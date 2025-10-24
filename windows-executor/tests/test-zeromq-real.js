#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function main() {
  console.log('='.repeat(60));
  console.log('ZeroMQ Real Environment Verification');
  console.log('='.repeat(60));

  const dllPath = path.join(__dirname, '..', 'resources', 'libs', 'libzmq-x64.dll');
  if (!fs.existsSync(dllPath)) {
    console.error('libzmq-x64.dll is missing. Run npm run fix:libzmq first.');
    process.exit(1);
  }
  console.log('✓ libzmq-x64.dll present');

  let zmq;
  try {
    zmq = require('zeromq');
  } catch (error) {
    console.error('Failed to load zeromq module:', error.message);
    console.error('Run npm run rebuild:native to rebuild native modules.');
    process.exit(1);
  }

  console.log(`✓ zeromq module loaded (version ${zmq.version || 'unknown'})`);

  const socket = new zmq.Request();
  const endpoint = process.env.ZEROMQ_ENDPOINT || 'tcp://127.0.0.1:5555';

  try {
    await socket.connect(endpoint);
    console.log(`Attempting ping via ${endpoint} ...`);

    await socket.send('PING');
    const [reply] = await Promise.race([
      socket.receive(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for reply')), 3000)),
    ]);

    console.log('Received reply:', reply.toString());
    console.log('✓ ZeroMQ round-trip succeeded');
    process.exit(0);
  } catch (error) {
    console.error('ZeroMQ request failed:', error.message);
    console.error('Ensure MT5 is running with the Expert Advisor attached and listening.');
    process.exit(1);
  } finally {
    socket.close();
  }
}

main();
