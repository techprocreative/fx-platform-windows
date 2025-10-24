# FX Platform Windows Executor - API Endpoints Reference

## Base Configuration

**Platform URL**: `https://fx.nusanexus.com`

All API endpoints are configured to use relative paths with the base URL set in the configuration.

## Configuration Update (2025-10-24)

✅ Updated default platform URL to: `https://fx.nusanexus.com`

### Files Updated:
1. `src/stores/config.store.ts` - Default config
2. `src/app/pages/Setup.tsx` - Setup wizard default
3. `src/app/pages/Settings.tsx` - Settings page default

---

## API Endpoints Used by Windows Executor

### 1. Configuration & Authentication

#### **GET** `/api/executor/config`
Fetch executor configuration from platform (auto-provisioning)
- **Headers**: `X-API-Key`, `X-API-Secret`
- **Response**: Executor config including Pusher credentials
- **Used in**: `config.store.ts`

---

### 2. Executor Management

#### **POST** `/api/executor/register`
Register new executor with platform
- **Body**: `{ executorId, name, mt5Version, mt5Build, broker }`
- **Used in**: `api.service.ts`

#### **PATCH** `/api/executor/{executorId}`
Update executor status
- **Body**: `{ status, timestamp }`
- **Status values**: `online`, `offline`, `error`, `maintenance`
- **Used in**: `api.service.ts`

#### **GET** `/api/executor/{executorId}/ping`
Test connection to platform
- **Response**: `{ success: boolean }`
- **Used in**: `api.service.ts`

---

### 3. Heartbeat System

#### **POST** `/api/executor/{executorId}/heartbeat`
Send periodic heartbeat with metrics
- **Body**:
  ```json
  {
    "status": "online|offline|error",
    "metadata": {
      "version": "string",
      "platform": "string",
      "accountBalance": "number",
      "accountEquity": "number",
      "openPositions": "number",
      "cpuUsage": "number",
      "memoryUsage": "number",
      "timestamp": "ISO8601"
    }
  }
  ```
- **Response**: `{ success, pendingCommands, serverTime }`
- **Used in**: `api.service.ts`

---

### 4. Command Management

#### **GET** `/api/executor/{executorId}/commands/pending`
Fetch pending commands from platform
- **Response**: Array of Command objects
- **Used in**: `api.service.ts`

#### **PATCH** `/api/executor/{executorId}/command`
Report command execution result
- **Body**:
  ```json
  {
    "commandId": "string",
    "status": "received|executing|executed|failed|cancelled",
    "result": "any",
    "timestamp": "ISO8601"
  }
  ```
- **Used in**: `api.service.ts`

---

### 5. Trade Reporting

#### **POST** `/api/trades`
Report new trade opened
- **Body**:
  ```json
  {
    "executorId": "string",
    "ticket": "string",
    "symbol": "string",
    "type": "BUY|SELL",
    "volume": "number",
    "openPrice": "number",
    "openTime": "ISO8601",
    "stopLoss": "number",
    "takeProfit": "number",
    "comment": "string",
    "timestamp": "ISO8601"
  }
  ```
- **Used in**: `api.service.ts`

#### **PATCH** `/api/trades/{ticket}`
Report trade closure
- **Body**:
  ```json
  {
    "executorId": "string",
    "closePrice": "number",
    "closeTime": "ISO8601",
    "profit": "number",
    "timestamp": "ISO8601"
  }
  ```
- **Used in**: `api.service.ts`

---

### 6. Alerts & Events

#### **POST** `/api/alerts`
Report safety alerts or security events
- **Body**:
  ```json
  {
    "executorId": "string",
    "category": "safety|security",
    "type": "string",
    "severity": "low|medium|high|critical",
    "message": "string",
    "metadata": "object",
    "timestamp": "ISO8601"
  }
  ```
- **Used in**: `api.service.ts`

---

### 7. Error Reporting

#### **POST** `/api/errors/report`
Report application errors to platform
- **Body**:
  ```json
  {
    "executorId": "string",
    "type": "string",
    "message": "string",
    "stack": "string",
    "metadata": "object",
    "timestamp": "ISO8601"
  }
  ```
- **Used in**: `api.service.ts`

---

### 8. Pusher Authentication

#### **POST** `/api/pusher/auth`
Authenticate private Pusher channel
- **Headers**: `X-API-Key`, `X-API-Secret`, `Content-Type: application/json`
- **Used by**: Pusher client for private channel subscription
- **Channel format**: `private-executor-{executorId}`
- **Used in**: `pusher.service.ts`

---

## Pusher Real-time Events

### Channel: `private-executor-{executorId}`

**Events received:**
- `command-received` - New command from platform
- `command-cancel` - Command cancellation
- `emergency-stop` - Emergency stop trigger
- `executor-config-update` - Configuration update

**Events sent (client-triggered):**
- `client-command-result` - Command execution result

---

## HTTP Headers Used

All API requests include:
```
Content-Type: application/json
User-Agent: FX-Executor/1.0.0
X-API-Key: {apiKey}
X-API-Secret: {apiSecret}
X-Executor-Id: {executorId}
```

---

## Connection Flow

```
1. User enters credentials in Setup Wizard
   ├─ API Key
   ├─ API Secret
   └─ Platform URL (default: https://fx.nusanexus.com)

2. Executor fetches config from platform
   └─ GET /api/executor/config
       └─ Returns: executorId, pusherKey, pusherCluster, etc.

3. Services start with fetched config
   ├─ API Service → Tests connection with /ping
   ├─ Pusher Service → Connects & subscribes to private channel
   └─ Heartbeat Service → Starts periodic heartbeats

4. Executor becomes operational
   ├─ Receives commands via Pusher
   ├─ Sends heartbeats every N seconds
   └─ Reports trades, alerts, and errors
```

---

## Error Handling

All API calls include:
- **Timeout**: 30 seconds
- **Retry logic**: Handled by services
- **Error logging**: All errors logged to local database
- **Status codes handled**:
  - `401` - Invalid credentials
  - `404` - Executor not found
  - `429` - Rate limit exceeded
  - `500+` - Server errors

---

## Security Notes

1. **Credentials are encrypted** locally using Windows DPAPI
2. **API Secret** is never logged in plain text
3. **All connections** use HTTPS/WSS (TLS)
4. **Pusher auth** is handled server-side
5. **Command validation** on every received command

---

## Configuration Store

Default configuration in `config.store.ts`:
```typescript
{
  platformUrl: "https://fx.nusanexus.com",
  pusherCluster: "mt1",
  zmqPort: 5555,
  zmqHost: "tcp://localhost",
  heartbeatInterval: 60,
  autoReconnect: true
}
```

---

## Testing Endpoints

The following test files use mock URLs (no changes needed):
- `src/tests/communication-services.test.ts`
- `src/tests/integration/main-controller.integration.test.ts`

---

## Summary

✅ **All production endpoints use relative paths**
✅ **Base URL configurable via config store**
✅ **Default platform URL set to `https://fx.nusanexus.com`**
✅ **All services use centralized API client**
✅ **Pusher authentication integrated with platform API**

**No hardcoded URLs in production code** - All URLs are configuration-driven.
