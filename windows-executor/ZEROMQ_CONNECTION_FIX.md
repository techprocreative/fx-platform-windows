# ZeroMQ Connection Issue - Root Cause & Fix

## Problem Identified
**"ZeroMQ Not Connected"** error meskipun EA sudah di-attach di MT5.

## Root Cause Analysis

### Architecture Conflict ❌
Windows Executor menjalankan **2 ZeroMQ services pada port yang sama (5555)**:

1. **ZeroMQServerService** (Server Mode)
   - Type: Reply socket
   - Action: Bind to `tcp://127.0.0.1:5555`
   - Purpose: Listen for connections from MT5 EA
   - Status: ✅ Running correctly

2. **ZeroMQService** (Client Mode) 
   - Type: Request socket
   - Action: Try to connect to `tcp://localhost:5555`
   - Purpose: Send requests to MT5
   - Status: ❌ FAILS - Port already bound by server!

3. **MT5 EA** (Client Mode)
   - Type: Request socket  
   - Action: Connect to `tcp://localhost:5555`
   - Purpose: Send data to Windows Executor
   - Status: ❌ FAILS - Conflicts with architecture!

### The Conflict
```
Port 5555:
├── ZeroMQServerService (bind)     ← Already using port
├── ZeroMQService (connect)        ← Can't connect, port bound!
└── MT5 EA (connect)               ← Can't connect properly!
```

Both services cannot use the same port with conflicting patterns!

---

## Applied Fix

### 1. Disabled ZeroMQService Client Connection
```typescript
// main-controller.ts - Line 918
// DISABLED - Architecture conflict with server on same port
this.addLog('info', 'MAIN', 'Step 5.5: ZeroMQ Client DISABLED (architecture conflict with server)');
```

### 2. Added Connection Check in MarketDataService
```typescript
// market-data.service.ts
if (!this.zeromqService.isConnected()) {
  logger.warn('[MarketDataService] ZeroMQ not connected - cannot fetch market data');
  return { symbol, timeframe, bars: [] };
}
```

### 3. Prevented Crashes
- Added safety checks before attempting ZeroMQ operations
- Return empty data instead of throwing errors
- Log warnings for debugging

---

## Current Status

### ✅ What Works
- Application starts without crashes
- ZeroMQServerService runs on port 5555
- Ready to receive connections from MT5 EA
- Strategy persistence and monitoring work

### ⚠️ What Doesn't Work Yet
- Cannot fetch market data (ZeroMQService disabled)
- EA connection may need reconfiguration
- Bidirectional communication not functional

---

## Proper Architecture Solution

### Option 1: Use Different Ports
```typescript
// Windows Executor
ZeroMQServerService: Bind to tcp://127.0.0.1:5555    // Receive from EA
ZeroMQService: Connect to tcp://127.0.0.1:5556       // Send to EA

// MT5 EA
Socket1: Connect to tcp://localhost:5555  // Send to Executor
Socket2: Bind to tcp://*:5556            // Receive from Executor
```

### Option 2: Single Server Mode (Recommended)
```typescript
// Windows Executor
ZeroMQServerService only - Port 5555
- Receives all data from EA (market data, account info, etc.)
- Sends commands back to EA in response

// MT5 EA  
Client only - Connect to port 5555
- Pushes market data periodically
- Receives and executes commands
```

### Option 3: Proper Request-Reply Pattern
```typescript
// Windows Executor
Reply socket - Port 5555
- Wait for requests
- Process and reply

// MT5 EA
Request socket - Connect to 5555
- Send request (with data or command)
- Wait for reply
```

---

## Testing the Fix

### 1. Check Server is Running
Look for log: `✅ ZeroMQ Server listening on tcp://127.0.0.1:5555`

### 2. Check EA Connection
In MT5 Expert tab:
- Should show: "Successfully connected to server: tcp://localhost:5555"
- If not, check EA settings and ensure port 5555 is not blocked

### 3. Monitor Logs
```
[ZMQServer] Message loop started - waiting for MT5 requests...
[ZMQServer] Received request from MT5: {...}
```

### 4. Test with Simple Ping
EA should send periodic heartbeats. Check if server receives them.

---

## Next Steps

1. **Test Current Fix**
   - Install new build
   - Check if EA can connect to server
   - Monitor logs for communication

2. **Fix EA Side (if needed)**
   - Ensure EA is compiled with latest code
   - Check ZeroMQ DLL files are in MT5 directory
   - Verify EA settings match server config

3. **Implement Proper Architecture**
   - Choose one of the solutions above
   - Update both Executor and EA code
   - Test bidirectional communication

4. **Add Reconnection Logic**
   - Auto-reconnect on disconnection
   - Retry mechanism with backoff
   - Connection status monitoring

---

## Files Modified

1. **src/app/main-controller.ts**
   - Disabled ZeroMQService client connection (line 918-940)

2. **src/services/market-data.service.ts**
   - Added connection check before operations (line 40-50, 109-114)

3. **Build Output**
   - New build created with fixes
   - Ready for testing

---

## Logs to Monitor

### Success Indicators ✅
```
[ZMQServer] ✅ ZeroMQ Server listening on tcp://127.0.0.1:5555
[ZMQServer] Message loop started - waiting for MT5 requests...
[ZMQServer] Received request from MT5: {action: "HEARTBEAT"}
```

### Error Indicators ❌
```
[MarketDataService] ZeroMQ not connected - cannot fetch market data
[CommandService] Safety check failed: ZeroMQ not connected
Error: EADDRINUSE - Port 5555 already in use
```

---

## Contact for Help

If issue persists after testing:
1. Share MT5 Expert tab logs
2. Share Windows Executor console logs
3. Check if port 5555 is accessible (not blocked by firewall)
4. Verify ZeroMQ DLLs are in correct location
