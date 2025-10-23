/**
 * Pusher Connection Test Script
 * Run with: node test-pusher.js
 */

require('dotenv').config({ path: '.env' });
const Pusher = require('pusher');

console.log('🔍 Testing Pusher Configuration...\n');

// Display configuration (masking sensitive data)
console.log('Configuration:');
console.log('  APP_ID:', process.env.PUSHER_APP_ID || '❌ MISSING');
console.log('  KEY:', process.env.NEXT_PUBLIC_PUSHER_KEY ? `${process.env.NEXT_PUBLIC_PUSHER_KEY.substring(0, 8)}...` : '❌ MISSING');
console.log('  SECRET:', process.env.PUSHER_SECRET ? '✓ SET' : '❌ MISSING');
console.log('  CLUSTER:', process.env.NEXT_PUBLIC_PUSHER_CLUSTER || '❌ MISSING');
console.log('');

// Check if all required variables are present
const appId = process.env.PUSHER_APP_ID;
const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
const secret = process.env.PUSHER_SECRET;
const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

if (!appId || !key || !secret || !cluster) {
  console.error('❌ ERROR: Missing required Pusher environment variables');
  process.exit(1);
}

// Initialize Pusher
console.log('Initializing Pusher...');
const pusher = new Pusher({
  appId,
  key,
  secret,
  cluster,
  useTLS: true,
});

console.log('✅ Pusher initialized successfully\n');

// Test trigger event
console.log('Testing event trigger...');
pusher.trigger('test-channel', 'test-event', {
  message: 'Hello from test script!',
  timestamp: new Date().toISOString(),
})
  .then(() => {
    console.log('✅ Event triggered successfully!');
    console.log('');
    console.log('🎉 Pusher is working correctly!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Start your development server: npm run dev');
    console.log('  2. Navigate to /dashboard/executors');
    console.log('  3. Click on "Real-time Monitor" tab');
    console.log('  4. Check the connection status indicator');
    console.log('');
  })
  .catch((error) => {
    console.error('❌ ERROR triggering event:');
    console.error(error.message);
    console.error('');
    console.error('Possible issues:');
    console.error('  - Check if your Pusher credentials are correct');
    console.error('  - Verify cluster is correct (ap1, eu, us2, etc.)');
    console.error('  - Ensure you have an active Pusher account');
    process.exit(1);
  });
