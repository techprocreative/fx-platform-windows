# 🚀 Windows App Development Quickstart

## 📋 Prerequisites

- Web platform deployed and running
- Executor registered in web platform
- API credentials (API Key + Secret)
- Node.js 18+ or Python 3.9+
- MT5 terminal installed

---

## 🏗️ Architecture Reminder

```
Web Platform (Brain) ←→ Windows App (Executor) ←→ MT5 Terminal
     [Pusher]                  [ZeroMQ]
```

---

## ⚡ Quick Setup (Node.js)

### 1. Install Dependencies

```bash
npm install pusher-js zeromq dotenv
```

### 2. Create Configuration

Create `.env` file:
```env
API_KEY=ntx_your_api_key_here
API_SECRET=your_secret_here
EXECUTOR_ID=your_executor_id
WEB_PLATFORM_URL=https://nexustrade-steel.vercel.app
NEXT_PUBLIC_PUSHER_KEY=your_pusher_key
NEXT_PUBLIC_PUSHER_CLUSTER=ap1
MT5_ZEROMQ_HOST=localhost
MT5_ZEROMQ_PORT=5555
```

### 3. Basic Implementation

```javascript
const Pusher = require('pusher-js');
const zmq = require('zeromq');
require('dotenv').config();

// Connect to Pusher
const pusher = new Pusher(process.env.PUSHER_KEY, {
  cluster: process.env.PUSHER_CLUSTER,
  forceTLS: true,
  authEndpoint: `${process.env.WEB_PLATFORM_URL}/api/pusher/auth`,
  auth: {
    headers: {
      'x-api-key': process.env.API_KEY,
      'x-api-secret': process.env.API_SECRET
    }
  }
});

// Subscribe to executor channel
const channel = pusher.subscribe(`private-executor-${process.env.EXECUTOR_ID}`);

// Listen for trade commands
channel.bind('trade-command', async (command) => {
  console.log('📥 Received command:', command);
  
  // Execute via MT5
  const result = await executeOnMT5(command);
  
  // Report back to platform
  await reportResult(result);
});

// MT5 ZeroMQ communication
async function executeOnMT5(command) {
  const sock = new zmq.Request();
  sock.connect(`tcp://${process.env.MT5_ZEROMQ_HOST}:${process.env.MT5_ZEROMQ_PORT}`);
  
  await sock.send(JSON.stringify(command));
  const [result] = await sock.receive();
  
  return JSON.parse(result.toString());
}

// Report execution result
async function reportResult(result) {
  const response = await fetch(`${process.env.WEB_PLATFORM_URL}/api/commands/result`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.API_KEY,
      'x-api-secret': process.env.API_SECRET
    },
    body: JSON.stringify(result)
  });
  
  return response.json();
}

console.log('✅ Windows Executor started');
```

### 4. Run

```bash
node executor.js
```

---

## 🔧 MT5 Expert Advisor (ZeroMQ Server)

### Install ZeroMQ Library in MT5

1. Download MQL-ZMQ: https://github.com/dingmaotu/mql-zmq
2. Copy to `MetaTrader 5/MQL5/Include/Zmq/`
3. Enable DLL imports in MT5

### Basic EA Code

```mql5
#include <Zmq/Zmq.mqh>

Context context;
Socket socket(context, ZMQ_REP);

int OnInit() {
   socket.bind("tcp://*:5555");
   Print("ZeroMQ server started on port 5555");
   return(INIT_SUCCEEDED);
}

void OnTick() {
   ZmqMsg request;
   
   if(socket.recv(request, true)) {
      string cmd = request.getData();
      string response = ExecuteCommand(cmd);
      
      ZmqMsg reply(response);
      socket.send(reply);
   }
}

string ExecuteCommand(string command) {
   // Parse JSON command
   // Execute trade
   // Return result as JSON
   
   int ticket = OrderSend(
      Symbol(),           // symbol
      OP_BUY,            // operation
      0.01,              // volume
      Ask,               // price
      3,                 // slippage
      Bid - 50*Point,    // stop loss
      Bid + 100*Point,   // take profit
      "Test Order",      // comment
      12345,             // magic number
      0,                 // expiration
      clrGreen           // arrow color
   );
   
   if(ticket > 0) {
      return "{\"success\": true, \"ticket\": " + IntegerToString(ticket) + "}";
   } else {
      return "{\"success\": false, \"error\": " + IntegerToString(GetLastError()) + "}";
   }
}
```

---

## 📡 Command Types

### Open Position
```json
{
  "action": "OPEN",
  "symbol": "EURUSD",
  "type": "BUY",
  "volume": 0.01,
  "stopLoss": 1.0950,
  "takeProfit": 1.1050
}
```

### Close Position
```json
{
  "action": "CLOSE",
  "ticket": 12345678
}
```

### Modify Position
```json
{
  "action": "MODIFY",
  "ticket": 12345678,
  "stopLoss": 1.0960,
  "takeProfit": 1.1040
}
```

---

## 🛡️ Safety Mechanisms

### Must Implement:

1. **Emergency Stop**
```javascript
let emergencyStop = false;

channel.bind('emergency-stop', () => {
  emergencyStop = true;
  closeAllPositions();
});
```

2. **Daily Loss Limit**
```javascript
const MAX_DAILY_LOSS = -100; // USD
let dailyPnL = 0;

if(dailyPnL <= MAX_DAILY_LOSS) {
  console.log('⛔ Daily loss limit reached');
  return; // Don't execute
}
```

3. **Position Limit**
```javascript
const MAX_POSITIONS = 5;
let activePositions = await getActivePositions();

if(activePositions.length >= MAX_POSITIONS) {
  console.log('⛔ Max positions reached');
  return;
}
```

---

## 🧪 Testing

### Test Pusher Connection
```bash
node test-pusher-connection.js
```

### Test MT5 Connection
```javascript
const zmq = require('zeromq');
const sock = new zmq.Request();

sock.connect('tcp://localhost:5555');
sock.send('{"action":"PING"}');
sock.on('message', (msg) => {
  console.log('MT5 Response:', msg.toString());
});
```

---

## 📊 Monitoring

### Send Heartbeat
```javascript
setInterval(async () => {
  await fetch(`${process.env.WEB_PLATFORM_URL}/api/executors/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.API_KEY
    },
    body: JSON.stringify({
      executorId: process.env.EXECUTOR_ID,
      status: 'online',
      activePositions: await getActivePositions()
    })
  });
}, 30000); // Every 30 seconds
```

---

## 🐛 Common Issues

### Pusher Not Connecting
- Check API credentials
- Verify executor ID
- Check auth endpoint URL

### ZeroMQ Not Working
- Enable DLL imports in MT5
- Check firewall settings
- Verify port 5555 is open

### Orders Not Executing
- Check MT5 auto-trading is enabled
- Verify account balance
- Check symbol name format

---

## 📚 Full Examples

See complete implementation:
- `windows-app-pusher-example.js` - Full Node.js implementation
- `WINDOWS_APP_INTEGRATION_GUIDE.md` - Detailed guide
- `FINAL_ARCHITECTURE.md` - System architecture

---

## 🚀 Next Steps

1. ✅ Get credentials from web platform
2. ✅ Setup development environment
3. ✅ Test Pusher connection
4. ✅ Install MT5 ZeroMQ EA
5. ✅ Test with demo account
6. ✅ Implement safety mechanisms
7. ✅ Deploy to production

**Start with demo account first!** ⚠️
