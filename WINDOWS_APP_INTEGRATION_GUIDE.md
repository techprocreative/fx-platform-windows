# 📱 Windows App Integration Guide

## Panduan Lengkap Integrasi Windows App dengan Web Platform (Brain)

---

## 🎯 Quick Start

### 1. Start Web Platform dengan WebSocket
```bash
# Development
npm run dev:ws

# Production
npm run start:ws
```

### 2. Register Windows Executor
```bash
curl -X POST http://localhost:3000/api/ws \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{
    "name": "MT5 Executor 1",
    "platform": "MT5",
    "brokerServer": "broker.server.com",
    "accountNumber": "12345678"
  }'
```

**Response:**
```json
{
  "executor": {
    "id": "exec_123",
    "name": "MT5 Executor 1",
    "platform": "MT5"
  },
  "apiKey": "ntx_abc123...",
  "secretKey": "secret_xyz789...",
  "wsUrl": "ws://localhost:8080"
}
```

⚠️ **IMPORTANT**: Save `secretKey` securely! It won't be shown again.

---

## 💻 Windows App Implementation

### Required Dependencies
```json
{
  "dependencies": {
    "ws": "^8.14.0",
    "zeromq": "^6.0.0",
    "electron": "^27.0.0",
    "axios": "^1.6.0"
  }
}
```

### Basic WebSocket Client
```javascript
// windows-app/src/websocket-client.js
const WebSocket = require('ws');

class TradingExecutor {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.wsUrl = config.wsUrl || 'ws://localhost:8080';
    this.ws = null;
    this.reconnectInterval = 5000;
    this.isConnected = false;
  }

  connect() {
    const url = `${this.wsUrl}?apiKey=${this.apiKey}`;
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      console.log('Connected to Brain');
      this.isConnected = true;
      this.sendHeartbeat();
    });

    this.ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      this.handleMessage(message);
    });

    this.ws.on('close', () => {
      console.log('Disconnected from Brain');
      this.isConnected = false;
      this.reconnect();
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  handleMessage(message) {
    console.log('Message from Brain:', message.type);

    switch (message.type) {
      case 'TRADE_SIGNAL':
        this.executeTrade(message.payload);
        break;
      case 'EMERGENCY_STOP':
        this.emergencyStop(message.payload);
        break;
      case 'HEARTBEAT_ACK':
        // Heartbeat acknowledged
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  async executeTrade(command) {
    try {
      // Forward to MT5 via ZeroMQ
      const result = await this.sendToMT5(command);
      
      // Report back to Brain
      this.sendMessage({
        type: 'EXECUTION_RESULT',
        payload: {
          commandId: command.id,
          success: true,
          result: {
            ticket: result.ticket,
            openPrice: result.price,
            executionTime: Date.now()
          }
        }
      });
    } catch (error) {
      this.sendMessage({
        type: 'EXECUTION_RESULT',
        payload: {
          commandId: command.id,
          success: false,
          error: {
            code: 'EXECUTION_FAILED',
            message: error.message
          }
        }
      });
    }
  }

  sendMessage(message) {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({
        ...message,
        timestamp: new Date().toISOString()
      }));
    }
  }

  sendHeartbeat() {
    setInterval(() => {
      if (this.isConnected) {
        this.sendMessage({ type: 'HEARTBEAT' });
      }
    }, 30000);
  }

  reconnect() {
    setTimeout(() => {
      console.log('Attempting to reconnect...');
      this.connect();
    }, this.reconnectInterval);
  }
}

module.exports = TradingExecutor;
```

### ZeroMQ Bridge to MT5
```javascript
// windows-app/src/zeromq-bridge.js
const zmq = require('zeromq');

class MT5Bridge {
  constructor() {
    this.socket = new zmq.Request();
    this.connected = false;
  }

  async connect(address = 'tcp://127.0.0.1:5555') {
    await this.socket.connect(address);
    this.connected = true;
    console.log('Connected to MT5 via ZeroMQ');
  }

  async sendCommand(command) {
    if (!this.connected) {
      throw new Error('Not connected to MT5');
    }

    const message = JSON.stringify(command);
    await this.socket.send(message);
    
    const [response] = await this.socket.receive();
    return JSON.parse(response.toString());
  }

  async openPosition(params) {
    return this.sendCommand({
      action: 'OPEN_POSITION',
      symbol: params.symbol,
      type: params.type,
      volume: params.volume,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
      magicNumber: params.magicNumber,
      comment: params.comment
    });
  }

  async closePosition(ticket) {
    return this.sendCommand({
      action: 'CLOSE_POSITION',
      ticket: ticket
    });
  }

  async modifyPosition(ticket, stopLoss, takeProfit) {
    return this.sendCommand({
      action: 'MODIFY_POSITION',
      ticket: ticket,
      stopLoss: stopLoss,
      takeProfit: takeProfit
    });
  }

  async getAccountInfo() {
    return this.sendCommand({
      action: 'GET_ACCOUNT_INFO'
    });
  }

  disconnect() {
    if (this.connected) {
      this.socket.disconnect();
      this.connected = false;
    }
  }
}

module.exports = MT5Bridge;
```

### Main Application
```javascript
// windows-app/src/main.js
const TradingExecutor = require('./websocket-client');
const MT5Bridge = require('./zeromq-bridge');

class WindowsTraderApp {
  constructor(config) {
    this.executor = new TradingExecutor({
      apiKey: config.apiKey,
      wsUrl: config.wsUrl
    });
    
    this.mt5Bridge = new MT5Bridge();
  }

  async start() {
    // Connect to MT5
    await this.mt5Bridge.connect();
    
    // Connect to Brain (Web Platform)
    this.executor.connect();
    
    // Override executor's sendToMT5 method
    this.executor.sendToMT5 = async (command) => {
      return await this.mt5Bridge.openPosition(command.command);
    };
    
    console.log('Windows Trader App started');
  }

  async stop() {
    this.mt5Bridge.disconnect();
    if (this.executor.ws) {
      this.executor.ws.close();
    }
    console.log('Windows Trader App stopped');
  }
}

// Start the app
const app = new WindowsTraderApp({
  apiKey: process.env.EXECUTOR_API_KEY,
  wsUrl: process.env.WS_URL || 'ws://localhost:8080'
});

app.start().catch(console.error);

// Graceful shutdown
process.on('SIGINT', async () => {
  await app.stop();
  process.exit(0);
});
```

---

## 🔧 MT5 Expert Advisor (MQL5)

### ZeroMQ Server EA
```mql5
// MT5/Experts/ZeroMQServer.mq5
#include <Zmq/Zmq.mqh>

input string ZMQ_ADDRESS = "tcp://127.0.0.1:5555";
input int MAGIC_NUMBER = 123456;

Context *context;
Socket *socket;

int OnInit() {
   context = new Context();
   socket = new Socket(context, ZMQ_REP);
   
   if(!socket.bind(ZMQ_ADDRESS)) {
      Print("Failed to bind ZeroMQ socket");
      return INIT_FAILED;
   }
   
   Print("ZeroMQ server started on ", ZMQ_ADDRESS);
   return INIT_SUCCEEDED;
}

void OnTick() {
   string request = "";
   
   // Check for incoming messages (non-blocking)
   if(socket.recv(request, ZMQ_DONTWAIT)) {
      string response = ProcessCommand(request);
      socket.send(response);
   }
}

string ProcessCommand(string jsonCommand) {
   // Parse JSON command
   JSONValue *json = new JSONValue();
   json.Deserialize(jsonCommand);
   
   string action = json["action"].ToString();
   string response = "";
   
   if(action == "OPEN_POSITION") {
      string symbol = json["symbol"].ToString();
      string type = json["type"].ToString();
      double volume = json["volume"].ToDouble();
      double sl = json["stopLoss"].ToDouble();
      double tp = json["takeProfit"].ToDouble();
      
      int ticket = OpenPosition(symbol, type, volume, sl, tp);
      
      response = StringFormat(
         "{\"success\":%s,\"ticket\":%d,\"price\":%.5f}",
         ticket > 0 ? "true" : "false",
         ticket,
         SymbolInfoDouble(symbol, SYMBOL_BID)
      );
   }
   else if(action == "CLOSE_POSITION") {
      int ticket = (int)json["ticket"].ToInt();
      bool success = ClosePosition(ticket);
      
      response = StringFormat(
         "{\"success\":%s}",
         success ? "true" : "false"
      );
   }
   else if(action == "GET_ACCOUNT_INFO") {
      response = GetAccountInfo();
   }
   
   delete json;
   return response;
}

int OpenPosition(string symbol, string type, double volume, double sl, double tp) {
   MqlTradeRequest request = {};
   MqlTradeResult result = {};
   
   request.action = TRADE_ACTION_DEAL;
   request.symbol = symbol;
   request.volume = volume;
   request.magic = MAGIC_NUMBER;
   
   if(type == "BUY") {
      request.type = ORDER_TYPE_BUY;
      request.price = SymbolInfoDouble(symbol, SYMBOL_ASK);
   } else {
      request.type = ORDER_TYPE_SELL;
      request.price = SymbolInfoDouble(symbol, SYMBOL_BID);
   }
   
   request.sl = sl;
   request.tp = tp;
   request.deviation = 10;
   request.type_filling = ORDER_FILLING_IOC;
   
   if(!OrderSend(request, result)) {
      Print("OrderSend error: ", result.comment);
      return -1;
   }
   
   return (int)result.order;
}

bool ClosePosition(int ticket) {
   return PositionSelectByTicket(ticket) && PositionClose(ticket);
}

string GetAccountInfo() {
   return StringFormat(
      "{\"balance\":%.2f,\"equity\":%.2f,\"margin\":%.2f,\"freeMargin\":%.2f}",
      AccountInfoDouble(ACCOUNT_BALANCE),
      AccountInfoDouble(ACCOUNT_EQUITY),
      AccountInfoDouble(ACCOUNT_MARGIN),
      AccountInfoDouble(ACCOUNT_MARGIN_FREE)
   );
}

void OnDeinit(const int reason) {
   delete socket;
   delete context;
   Print("ZeroMQ server stopped");
}
```

---

## 📡 Testing the Integration

### 1. Test WebSocket Connection
```javascript
// test-connection.js
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080?apiKey=YOUR_API_KEY');

ws.on('open', () => {
  console.log('✅ Connected to Brain');
  
  // Request command
  ws.send(JSON.stringify({
    type: 'REQUEST_COMMAND'
  }));
});

ws.on('message', (data) => {
  console.log('📨 Message:', JSON.parse(data.toString()));
});

ws.on('error', (error) => {
  console.error('❌ Error:', error);
});
```

### 2. Test Trade Execution
```bash
# Send test command via API
curl -X POST http://localhost:3000/api/commands \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{
    "strategyId": "your_strategy_id",
    "executorId": "exec_123",
    "type": "TRADE_SIGNAL",
    "priority": "HIGH",
    "command": {
      "action": "OPEN_POSITION",
      "symbol": "EURUSD",
      "type": "BUY",
      "volume": 0.01,
      "stopLoss": 1.0950,
      "takeProfit": 1.1050
    }
  }'
```

---

## 🔐 Security Configuration

### Windows App .env
```env
# Web Platform Connection
EXECUTOR_API_KEY=ntx_your_api_key_here
WS_URL=ws://localhost:8080

# MT5 Connection
MT5_ZEROMQ_ADDRESS=tcp://127.0.0.1:5555

# Security
MAX_POSITIONS=10
MAX_LOT_SIZE=1.0
DAILY_LOSS_LIMIT=1000
```

---

## 📊 Monitoring

### Check Executor Status
```bash
curl http://localhost:3000/api/ws \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

### View Command Queue
```bash
curl http://localhost:3000/api/commands \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

### Emergency Stop
```bash
curl -X PUT http://localhost:3000/api/commands \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{
    "action": "emergency_stop",
    "reason": "Manual intervention required"
  }'
```

---

## ⚡ Performance Tips

1. **Keep connection alive** - Use heartbeat every 30s
2. **Queue offline commands** - Store locally when disconnected
3. **Validate before sending** - Check parameters locally first
4. **Log everything** - For debugging and audit
5. **Handle reconnection** - Auto-reconnect on disconnect

---

## 🚨 Troubleshooting

### WebSocket Connection Failed
- Check API key is correct
- Verify WS_PORT (default: 8080)
- Check firewall settings
- Verify web platform is running

### MT5 Connection Failed
- Install ZeroMQ library in MT5
- Check EA is running
- Verify ZeroMQ port (default: 5555)
- Check Windows firewall

### Commands Not Executing
- Check executor status (online/offline)
- Verify command format
- Check error logs
- Test with manual command

---

## 📚 Additional Resources

- [ZeroMQ for MT5](https://github.com/dingmaotu/mql-zmq)
- [Electron Documentation](https://www.electronjs.org/)
- [WebSocket Client Docs](https://github.com/websockets/ws)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)

---

**Ready to build your Windows Trading Executor! 🚀**
