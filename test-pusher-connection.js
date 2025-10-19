/**
 * TEST PUSHER CONNECTION
 * Verifikasi Pusher credential dan koneksi
 * Run: node test-pusher-connection.js
 */

require('dotenv').config();
const Pusher = require('pusher');
const PusherClient = require('pusher-js');

// Pusher Server Configuration
const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
  useTLS: true
});

// Pusher Client Configuration
const pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY, {
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
  forceTLS: true
});

console.log('🔧 Testing Pusher Connection...\n');

// Test 1: Send a test message from server
async function testServerPush() {
  try {
    console.log('📤 Test 1: Sending message from server...');
    const result = await pusherServer.trigger('test-channel', 'test-event', {
      message: 'Hello from FX Trading Platform!',
      timestamp: new Date().toISOString()
    });
    console.log('✅ Server push successful!\n');
    return true;
  } catch (error) {
    console.error('❌ Server push failed:', error.message);
    return false;
  }
}

// Test 2: Subscribe to channel from client
function testClientSubscription() {
  return new Promise((resolve) => {
    console.log('📥 Test 2: Subscribing to channel from client...');
    
    const channel = pusherClient.subscribe('test-channel');
    
    channel.bind('test-event', function(data) {
      console.log('✅ Received message:', data);
      console.log('✅ Client subscription successful!\n');
      pusherClient.disconnect();
      resolve(true);
    });

    channel.bind('pusher:subscription_succeeded', function() {
      console.log('✅ Successfully subscribed to test-channel');
      
      // Send a test message after subscription
      setTimeout(async () => {
        await pusherServer.trigger('test-channel', 'test-event', {
          message: 'Test message after subscription',
          timestamp: new Date().toISOString()
        });
      }, 1000);
    });

    channel.bind('pusher:subscription_error', function(error) {
      console.error('❌ Subscription failed:', error);
      pusherClient.disconnect();
      resolve(false);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      console.log('⏱️ Test timeout - disconnecting');
      pusherClient.disconnect();
      resolve(false);
    }, 10000);
  });
}

// Test 3: Test private channel authentication
async function testPrivateChannel() {
  try {
    console.log('🔒 Test 3: Testing private channel...');
    
    // Simulate auth response (in production this comes from /api/pusher/auth)
    const socketId = 'test-socket-id';
    const channel = 'private-executor-test';
    
    const auth = pusherServer.authorizeChannel(socketId, channel);
    console.log('✅ Private channel auth generated:', auth.auth ? 'Success' : 'Failed');
    
    return true;
  } catch (error) {
    console.error('❌ Private channel test failed:', error.message);
    return false;
  }
}

// Test 4: Send trading command simulation
async function testTradingCommand() {
  try {
    console.log('💼 Test 4: Sending trading command simulation...');
    
    const command = {
      id: `cmd_${Date.now()}`,
      type: 'TRADE_SIGNAL',
      command: {
        action: 'OPEN_POSITION',
        symbol: 'EURUSD',
        type: 'BUY',
        volume: 0.01,
        stopLoss: 1.0950,
        takeProfit: 1.1050
      },
      timestamp: new Date().toISOString()
    };
    
    await pusherServer.trigger('private-executor-demo', 'trade-command', command);
    console.log('✅ Trading command sent successfully!');
    console.log('📊 Command details:', JSON.stringify(command, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ Trading command failed:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('====================================');
  console.log('🚀 FX TRADING PLATFORM - PUSHER TEST');
  console.log('====================================\n');
  
  console.log('📋 Configuration:');
  console.log(`   App ID: ${process.env.PUSHER_APP_ID}`);
  console.log(`   Key: ${process.env.NEXT_PUBLIC_PUSHER_KEY}`);
  console.log(`   Cluster: ${process.env.NEXT_PUBLIC_PUSHER_CLUSTER}`);
  console.log(`   Endpoint: wss://ws-${process.env.NEXT_PUBLIC_PUSHER_CLUSTER}.pusher.com\n`);
  
  let allTestsPassed = true;
  
  // Run server push test
  const test1 = await testServerPush();
  allTestsPassed = allTestsPassed && test1;
  
  // Run client subscription test
  const test2 = await testClientSubscription();
  allTestsPassed = allTestsPassed && test2;
  
  // Run private channel test
  const test3 = await testPrivateChannel();
  allTestsPassed = allTestsPassed && test3;
  
  // Run trading command test
  const test4 = await testTradingCommand();
  allTestsPassed = allTestsPassed && test4;
  
  console.log('\n====================================');
  if (allTestsPassed) {
    console.log('✅ ALL TESTS PASSED!');
    console.log('🎉 Pusher is configured correctly!');
    console.log('🚀 Ready for Vercel deployment!');
  } else {
    console.log('⚠️ SOME TESTS FAILED');
    console.log('Please check your configuration');
  }
  console.log('====================================\n');
  
  // Info for Windows App
  console.log('📱 Windows App Connection Info:');
  console.log('```javascript');
  console.log(`const pusher = new Pusher("${process.env.NEXT_PUBLIC_PUSHER_KEY}", {`);
  console.log(`  cluster: "${process.env.NEXT_PUBLIC_PUSHER_CLUSTER}",`);
  console.log('  forceTLS: true');
  console.log('});');
  console.log('');
  console.log('// Subscribe to executor channel');
  console.log('const channel = pusher.subscribe("private-executor-{executorId}");');
  console.log('channel.bind("trade-command", (command) => {');
  console.log('  // Forward to MT5 via ZeroMQ');
  console.log('  executeTrade(command);');
  console.log('});');
  console.log('```\n');
  
  process.exit(0);
}

// Run the tests
runTests().catch(console.error);
