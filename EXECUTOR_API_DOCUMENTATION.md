# 🤖 Executor API Documentation

## Overview

This documentation provides comprehensive details for integrating MT5/MT4 executors with the FX Trading Platform. Executors are Windows applications that connect to the platform to receive trading commands and report back status and trade results.

---

## 🔑 Authentication

All API requests must include authentication headers:

```http
X-API-Key: exe_xxxxxxxxxxxxxxxxxxxxxxxx
X-API-Secret: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**How to get credentials:**
1. Log in to the platform
2. Navigate to Dashboard > Executors
3. Click "Add Executor"
4. Fill in the form and submit
5. **Save the credentials immediately** - they will only be shown once!

---

## 📡 Real-time Communication Architecture

### For Serverless Environments (Vercel)

Since the platform is deployed on Vercel (serverless), **WebSocket connections cannot be maintained directly**. Therefore, we use **Pusher** for real-time bi-directional communication.

**Architecture:**
```
Windows Executor App
├── REST API Client (for heartbeat & responses)
└── Pusher Client (for receiving commands in real-time)
    └── Subscribe to: private-executor-{executorId}
```

### How It Works (Auto-Provisioning)

**OLD FLOW (❌ Problematic):**
```
User manually inputs:
- API Key
- API Secret
- Pusher Key (where do I get this?)
- Pusher Cluster (what does this mean?)
- Platform URL
- ... more technical details
❌ Complex, error-prone, requires technical knowledge
```

**NEW FLOW (✅ User-Friendly):**
```
User inputs ONLY:
1. Platform URL (optional, defaults to https://platform.com)
2. API Key (from dashboard)
3. API Secret (from dashboard)
   ↓
Executor calls: GET /api/executor/config
   ↓
Server responds with COMPLETE configuration including:
- Pusher Key ✅ AUTO-PROVISIONED
- Pusher Cluster ✅ AUTO-PROVISIONED
- ZeroMQ settings
- Heartbeat config
- Feature flags
- Everything else needed!
   ↓
Executor automatically connects to:
- Pusher with provisioned credentials
- ZeroMQ bridge
- REST API
✅ 100% automatic, zero manual config!
```

---

## 🚀 Getting Started (For Executor Developers)

### Installation Flow

1. **User downloads & installs** FX Platform Executor
2. **Auto-detection** of MT5 installations
3. **Auto-installation** of libzmq.dll and Expert Advisor
4. **Setup Wizard appears** with 3 simple steps:

   **Step 1:** Auto-Install Components
   - Detects MT5 installations ✅
   - Installs libzmq.dll ✅
   - Installs Expert Advisor ✅

   **Step 2:** Enter API Credentials (ONLY 2 THINGS!)
   - Platform URL (optional)
   - API Key
   - API Secret
   - ↓ Click "Next"
   - ↓ **Auto-fetches Pusher config from platform** ✅

   **Step 3:** Verify & Start
   - Shows all auto-provisioned settings
   - Test connection button
   - Click "Start Executor"

---

## 📚 API Endpoints

### 1. Configuration Provisioning Endpoint

**Purpose:** Auto-provision Pusher credentials and platform configuration

#### Endpoint
```http
GET /api/executor/config
```

#### Headers
```http
X-API-Key: exe_xxxxxxxxxxxxxxxxxxxxxxxx
X-API-Secret: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
```

#### Request Example
```bash
curl -X GET https://your-platform.com/api/executor/config \
  -H "X-API-Key: exe_test_key_123" \
  -H "X-API-Secret: test_secret_456"
```

#### Response (200 OK)
```json
{
  "success": true,
  "config": {
    "executorId": "clxxxxxxxxxxxxx",
    "executorName": "My Trading Bot",
    "platformUrl": "https://your-platform.com",
    
    "pusherKey": "your-pusher-key-auto-filled",
    "pusherCluster": "ap1",
    
    "zmqPort": 5555,
    "zmqHost": "tcp://localhost",
    
    "heartbeatInterval": 60,
    "heartbeatTimeout": 120,
    "commandTimeout": 30000,
    "connectionTimeout": 10000,
    
    "autoReconnect": true,
    "retryAttempts": 5,
    "retryBackoffMs": 2000,
    "maxReconnectAttempts": 10,
    
    "features": {
      "autoInstallEA": true,
      "autoAttachEA": true,
      "safetyChecks": true,
      "monitoring": true,
      "logging": true
    },
    
    "serverTime": "2024-01-15T10:30:00.000Z",
    "executorCreatedAt": "2024-01-10T08:00:00.000Z",
    "executorStatus": "online"
  },
  "metadata": {
    "requestProcessingTime": 45,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Error Responses

**400 Bad Request - Invalid API Key Format**
```json
{
  "error": "Invalid API key format. Executor keys should start with \"exe_\"",
  "code": "INVALID_API_KEY_FORMAT"
}
```

**401 Unauthorized - Invalid Credentials**
```json
{
  "error": "Invalid API secret",
  "code": "INVALID_CREDENTIALS"
}
```

**404 Not Found - Executor Not Found**
```json
{
  "error": "Executor not found or invalid API key",
  "code": "EXECUTOR_NOT_FOUND"
}
```

**429 Too Many Requests - Rate Limited**
```json
{
  "error": "Too many config requests. Please wait before trying again.",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

#### Rate Limiting
- **Limit:** 10 requests per 60 seconds per executor
- **Reset:** Automatic after 60 second window

#### Implementation in Windows Executor
```typescript
// In windows-executor setup wizard
const platformUrl = 'https://platform.com';
const apiKey = 'exe_xxxxx';
const apiSecret = 'secret_xxxxx';

// Fetch configuration from platform
const response = await fetch(`${platformUrl}/api/executor/config`, {
  method: 'GET',
  headers: {
    'X-API-Key': apiKey,
    'X-API-Secret': apiSecret,
    'Content-Type': 'application/json',
  },
});

const data = await response.json();

// Now executor has COMPLETE configuration!
const config = data.config;

// Use Pusher credentials (auto-provisioned):
const pusher = new Pusher(config.pusherKey, {
  cluster: config.pusherCluster,
  // ... rest of config
});
```

---

### 2. Pusher Authentication Endpoint

**Purpose:** Authenticate executor (or web user) for private Pusher channel subscription

#### Endpoint
```http
POST /api/pusher/auth
```

#### Headers (FOR EXECUTOR AUTH)
```http
Content-Type: application/x-www-form-urlencoded
X-API-Key: exe_xxxxxxxxxxxxxxxxxxxxxxxx
X-API-Secret: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### Form Data
```
socket_id=socket-id-from-pusher&channel_name=private-executor-{executorId}
```

#### Response (200 OK)
```json
{
  "auth": "pusher-auth-signature",
  "channel_data": "{\"user_id\":\"user-123\",\"user_info\":{\"authType\":\"api-key\",\"executorId\":\"exec-123\"}}"
}
```

#### How Pusher Auth Works

**When Executor subscribes to channel:**

1. Pusher.js client initiates subscription
2. Before completing, Pusher requests auth from your platform
3. Your platform can use either:
   - **Session-based auth** (for web users)
   - **API Key-based auth** (for executors) ← **NEW!**
4. Platform validates and returns auth response
5. Pusher completes subscription

**Auth Methods Supported:**

**Method 1: Session-Based (Web Users)**
```typescript
// Web user already has NextAuth session
POST /api/pusher/auth
// No custom headers needed, session is automatic
```

**Method 2: API Key-Based (Executors)** ← **NEW!**
```typescript
// Executor sends API credentials
POST /api/pusher/auth
headers: {
  'X-API-Key': 'exe_xxxxx',
  'X-API-Secret': 'secret_xxxxx'
}
```

---

### 3. Heartbeat (Keep-Alive)

Executors must send heartbeat signals every **60 seconds** to maintain "online" status.

#### Endpoint
```http
POST /api/executor/{executorId}/heartbeat
```

#### Headers
```http
Content-Type: application/json
X-API-Key: YOUR_API_KEY
X-API-Secret: YOUR_API_SECRET
```

#### Request Body (Optional)
```json
{
  "status": "online",
  "metadata": {
    "version": "1.0.0",
    "platform": "MT5",
    "accountBalance": 10000.00,
    "accountEquity": 10500.00,
    "openPositions": 3,
    "cpuUsage": 45.2,
    "memoryUsage": 512.5
  }
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "executor": {
    "id": "clxxxxxxxxxxxxx",
    "name": "My Trading Bot",
    "status": "online",
    "lastHeartbeat": "2024-01-15T10:30:00.000Z"
  },
  "pendingCommands": [
    {
      "id": "cmd-123",
      "command": "OPEN_POSITION",
      "parameters": {
        "symbol": "EURUSD",
        "type": "BUY",
        "volume": 0.1
      },
      "priority": "HIGH",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### 4. Command Response

After executing a command, executor sends back results.

#### Endpoint
```http
POST /api/executor/{executorId}/command/{commandId}/result
```

#### Headers
```http
Content-Type: application/json
X-API-Key: YOUR_API_KEY
X-API-Secret: YOUR_API_SECRET
```

#### Request Body
```json
{
  "status": "completed",
  "result": {
    "success": true,
    "ticket": 123456,
    "symbol": "EURUSD",
    "type": "BUY",
    "volume": 0.1,
    "openPrice": 1.0850,
    "openTime": "2024-01-15T10:30:00.000Z",
    "commission": -1.50
  },
  "executionTime": 245
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "commandId": "cmd-123",
  "receivedAt": "2024-01-15T10:30:00.000Z"
}
```

---

## 🔐 Security Implementation

### Credential Storage (Windows Executor)

```typescript
import Store from 'electron-store';
import { safeStorage } from 'electron';

const store = new Store();

// Encrypt and save API secret
function saveConfig(config) {
  const encrypted = safeStorage.encryptString(config.apiSecret);
  store.set('config', {
    ...config,
    apiSecret: encrypted.toString('base64'),
  });
}

// Decrypt when loading
function loadConfig() {
  const stored = store.get('config');
  const encrypted = Buffer.from(stored.apiSecret, 'base64');
  const decrypted = safeStorage.decryptString(encrypted);
  return {
    ...stored,
    apiSecret: decrypted,
  };
}
```

### API Communication

All API requests use:
- ✅ HTTPS/TLS encryption
- ✅ API Key in `X-API-Key` header
- ✅ API Secret in `X-API-Secret` header (encrypted in transit)
- ✅ Request validation
- ✅ Rate limiting

### Local Storage Security

- ✅ API Secret encrypted with Windows Credential Manager (electron.safeStorage)
- ✅ Credentials stored locally only
- ✅ Not sent in logs or error messages
- ✅ Automatic encryption/decryption

---

## 🧪 Testing Your Integration

### Test Configuration Endpoint

```bash
# 1. Get your credentials from dashboard
API_KEY="exe_xxxxx"
API_SECRET="secret_xxxxx"

# 2. Test config endpoint
curl -X GET https://your-platform.com/api/executor/config \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Secret: $API_SECRET"

# Expected: 200 OK with full configuration
```

### Test Pusher Authentication

```bash
# 1. Create socket_id and channel_name
SOCKET_ID="socket-123"
CHANNEL="private-executor-clxxxxxxxxxxxxx"

# 2. Test auth endpoint
curl -X POST https://your-platform.com/api/pusher/auth \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Secret: $API_SECRET" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "socket_id=$SOCKET_ID&channel_name=$CHANNEL"

# Expected: 200 OK with auth response
```

### Test Heartbeat

```bash
curl -X POST https://your-platform.com/api/executor/clxxxxxxxxxxxxx/heartbeat \
  -H "X-API-Key: $API_KEY" \
  -H "X-API-Secret: $API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "online",
    "metadata": {
      "version": "1.0.0",
      "platform": "MT5"
    }
  }'

# Expected: 200 OK with pending commands
```

---

## 📊 Complete Integration Flow

### Step-by-Step Setup

```
1. USER INSTALLS EXECUTOR
   ↓
2. AUTO-DETECT MT5
   ├─ Found MT5 at C:\Program Files\MetaTrader 5
   ✅ Ready to install components
   ↓
3. AUTO-INSTALL COMPONENTS
   ├─ Install libzmq-x64.dll → C:\Program Files\MetaTrader 5\MQL5\Libraries
   ├─ Install libzmq-x86.dll → C:\Program Files\MetaTrader 5\MQL5\Libraries
   ├─ Install ZeroMQBridge.ex5 → C:\Program Files\MetaTrader 5\MQL5\Experts
   ✅ All components installed
   ↓
4. USER ENTERS CREDENTIALS
   ├─ Platform URL: https://platform.com
   ├─ API Key: exe_xxxxx
   ├─ API Secret: secret_xxxxx
   ✅ Ready to fetch config
   ↓
5. EXECUTOR CALLS GET /api/executor/config
   ├─ Sends: X-API-Key, X-API-Secret
   ├─ Receives: pusherKey, pusherCluster, zmqPort, etc.
   ✅ Configuration auto-provisioned
   ↓
6. EXECUTOR STARTS SERVICES
   ├─ Initialize Pusher with auto-provisioned credentials
   ├─ Connect to ZeroMQ bridge
   ├─ Start heartbeat (every 60 seconds)
   ├─ Subscribe to private-executor-{id} channel
   ✅ All connected and ready
   ↓
7. EXECUTOR READY FOR TRADING
   ├─ Waits for commands via Pusher
   ├─ Executes trades via ZeroMQ
   ├─ Sends heartbeat every 60 seconds
   ├─ Reports results back to platform
   ✅ System operational!
```

---

## 🎯 Success Criteria

Your integration is successful when:

- ✅ User can install executor with single download
- ✅ MT5 auto-detected and configured
- ✅ User inputs ONLY API Key & Secret (nothing else!)
- ✅ Pusher credentials auto-provisioned from server
- ✅ Executor connects to Pusher successfully
- ✅ Executor receives real-time commands via Pusher
- ✅ Commands executed via ZeroMQ to MT5
- ✅ Results reported back to platform
- ✅ Heartbeat maintains connection
- ✅ All done automatically!

---

## 🚨 Troubleshooting

### Configuration Endpoint Returns 401

**Problem:** Invalid API credentials

**Solution:**
1. Copy credentials again from dashboard (case-sensitive!)
2. Verify API Key starts with `exe_`
3. Ensure no extra spaces in headers
4. Check API Secret hasn't been rotated

### Pusher Connection Fails

**Problem:** Cannot subscribe to private channel

**Solution:**
1. Verify Pusher auth endpoint is accessible
2. Check executor is sending API credentials in headers
3. Verify executor ID matches channel name
4. Check Pusher credentials are in config response

### Heartbeat Not Received

**Problem:** Server doesn't receive heartbeat signals

**Solution:**
1. Verify heartbeat endpoint is configured correctly
2. Check firewall isn't blocking outbound requests
3. Verify API credentials are being sent
4. Check executor isn't crashing silently
5. Review logs for connection errors

---

## 📞 Support

For issues or questions:
- Check logs: `%APPDATA%/FX Platform Executor/logs/`
- Enable debug mode in settings
- Review troubleshooting section above
- Contact support: support@fxplatform.com

---

**Last Updated:** January 2024
**Version:** 2.0 (Auto-Provisioning Release)