# Broker Connection API Documentation

## Overview

The Broker Connection API provides seamless integration with various trading brokers, primarily focusing on MetaTrader 5 (MT5). It handles account management, connection monitoring, and real-time data synchronization between the platform and broker systems.

## Base URL

```
/api/v1/broker
```

## Authentication

All endpoints require JWT authentication. See [API Overview](./README.md#authentication) for details.

## Supported Brokers

| Broker | Status | Features |
|--------|--------|----------|
| MetaTrader 5 | ✅ Full Support | Trading, Market Data, Account Management |
| MetaTrader 4 | 🔄 Planned | Trading, Market Data |
| cTrader | 📋 Planned | Trading, Market Data |
| Interactive Brokers | 📋 Planned | Trading, Market Data |

## Endpoints

### 1. Connect to Broker

Establish a connection to a broker account.

```http
POST /api/v1/broker/connect
```

#### Request Body
```json
{
  "brokerType": "MT5",
  "credentials": {
    "login": 12345678,
    "password": "encrypted_password",
    "server": "MetaQuotes-Demo",
    "path": "C:\\Program Files\\MetaTrader 5\\terminal64.exe"
  }
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "connectionId": "conn_123456",
    "brokerType": "MT5",
    "status": "CONNECTED",
    "connectedAt": "2024-01-01T00:00:00.000Z",
    "accountInfo": {
      "login": 12345678,
      "server": "MetaQuotes-Demo",
      "currency": "USD",
      "balance": 10000.0,
      "equity": 10050.0,
      "margin": 0.0,
      "freeMargin": 10050.0,
      "marginLevel": 0.0,
      "leverage": 100,
      "tradeMode": "DEMO"
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. Disconnect from Broker

Close the connection to a broker.

```http
POST /api/v1/broker/disconnect
```

#### Request Body
```json
{
  "connectionId": "conn_123456"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "connectionId": "conn_123456",
    "disconnectedAt": "2024-01-01T00:00:00.000Z",
    "reason": "USER_REQUESTED"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 3. Get Connection Status

Check the status of broker connections.

```http
GET /api/v1/broker/status
```

#### Response
```json
{
  "success": true,
  "data": {
    "connections": [
      {
        "connectionId": "conn_123456",
        "brokerType": "MT5",
        "status": "CONNECTED",
        "connectedAt": "2024-01-01T00:00:00.000Z",
        "lastHeartbeat": "2024-01-01T00:00:30.000Z",
        "uptime": 3600,
        "accountInfo": {
          "login": 12345678,
          "server": "MetaQuotes-Demo",
          "balance": 10000.0,
          "equity": 10050.0
        }
      }
    ],
    "totalConnections": 1,
    "activeConnections": 1
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 4. Get Account Information

Retrieve detailed account information.

```http
GET /api/v1/broker/account/{connectionId}
```

#### Response
```json
{
  "success": true,
  "data": {
    "login": 12345678,
    "server": "MetaQuotes-Demo",
    "currency": "USD",
    "balance": 10000.0,
    "equity": 10050.0,
    "margin": 0.0,
    "freeMargin": 10050.0,
    "marginLevel": 0.0,
    "leverage": 100,
    "tradeMode": "DEMO",
    "tradeAllowed": true,
    "limitOrders": true,
    "marginSOM": 50.0,
    "marginFree": 10050.0,
    "marginUsed": 0.0,
    "marginInitial": 0.0,
    "marginMaintenance": 0.0,
    "assets": 10000.0,
    "liabilities": 0.0,
    "commissionBlocked": 0.0,
    "name": "Demo Account",
    "company": "MetaQuotes Software Corp.",
    "stopoutMode": "PERCENT",
    "stopoutLevel": 20.0
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 5. Get Symbol Information

Retrieve information about a specific trading symbol.

```http
GET /api/v1/broker/symbols/{symbol}?connectionId={connectionId}
```

#### Response
```json
{
  "success": true,
  "data": {
    "symbol": "EURUSD",
    "description": "EUR/USD",
    "digits": 5,
    "point": 0.00001,
    "tickValue": 1.0,
    "tickSize": 0.00001,
    "contractSize": 100000.0,
    "volumeMin": 0.01,
    "volumeMax": 100.0,
    "volumeStep": 0.01,
    "spread": 1,
    "swapLong": -0.5,
    "swapShort": -0.25,
    "starting": 0.0,
    "expiration": 0,
    "tradeMode": "FULL",
    "currencyBase": "EUR",
    "currencyProfit": "USD",
    "currencyMargin": "EUR",
    "calcMode": "FOREX",
    "profitMode": "MONEY",
    "marginMode": "FOREX",
    "swapMode": "POINTS",
    "time": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 6. Get Current Price

Retrieve current bid/ask prices for a symbol.

```http
GET /api/v1/broker/price/{symbol}?connectionId={connectionId}
```

#### Response
```json
{
  "success": true,
  "data": {
    "symbol": "EURUSD",
    "time": "2024-01-01T00:00:00.000Z",
    "bid": 1.08500,
    "ask": 1.08501,
    "last": 1.08500,
    "volume": 100,
    "spread": 1,
    "spreadPoints": 1.0
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 7. Get Open Positions

Retrieve all open positions.

```http
GET /api/v1/broker/positions?connectionId={connectionId}
```

#### Response
```json
{
  "success": true,
  "data": {
    "positions": [
      {
        "ticket": 123456,
        "symbol": "EURUSD",
        "type": "BUY",
        "volume": 0.1,
        "openTime": "2024-01-01T00:00:00.000Z",
        "openPrice": 1.08500,
        "currentPrice": 1.08600,
        "stopLoss": 1.08000,
        "takeProfit": 1.09000,
        "profit": 10.0,
        "swap": 0.0,
        "commission": 0.0,
        "comment": "Strategy #123",
        "magic": 123,
        "reason": "CLIENT"
      }
    ],
    "totalCount": 1
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 8. Get Order History

Retrieve historical order data.

```http
GET /api/v1/broker/history?connectionId={connectionId}&from={fromDate}&to={toDate}
```

#### Query Parameters
- `connectionId` (string): Connection ID
- `from` (string): Start date (ISO 8601)
- `to` (string): End date (ISO 8601)
- `page` (number): Page number
- `limit` (number): Items per page

#### Response
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "ticket": 123456,
        "symbol": "EURUSD",
        "type": "BUY",
        "volume": 0.1,
        "openTime": "2024-01-01T00:00:00.000Z",
        "openPrice": 1.08500,
        "closeTime": "2024-01-01T01:00:00.000Z",
        "closePrice": 1.08600,
        "profit": 10.0,
        "swap": 0.0,
        "commission": 0.0,
        "commissionAgent": 0.0,
        "storage": 0.0,
        "comment": "Strategy #123",
        "magic": 123,
        "reason": "CLIENT",
        "positionId": 123456
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 9. Test Connection

Test the connection to a broker without establishing a persistent connection.

```http
POST /api/v1/broker/test-connection
```

#### Request Body
```json
{
  "brokerType": "MT5",
  "credentials": {
    "login": 12345678,
    "password": "encrypted_password",
    "server": "MetaQuotes-Demo"
  }
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "connected": true,
    "responseTime": 150,
    "accountInfo": {
      "login": 12345678,
      "server": "MetaQuotes-Demo",
      "balance": 10000.0,
      "equity": 10050.0
    },
    "serverTime": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 10. Reconnect

Reconnect to a broker after a disconnection.

```http
POST /api/v1/broker/reconnect
```

#### Request Body
```json
{
  "connectionId": "conn_123456"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "connectionId": "conn_123456",
    "status": "CONNECTED",
    "reconnectedAt": "2024-01-01T00:00:00.000Z",
    "downtime": 300
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Data Models

### BrokerCredentials
```typescript
interface BrokerCredentials {
  login: number;
  password: string; // Encrypted
  server: string;
  path?: string; // For MT5 terminal path
  timeout?: number;
}
```

### AccountInfo
```typescript
interface AccountInfo {
  login: number;
  server: string;
  currency: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  leverage: number;
  tradeMode: 'DEMO' | 'REAL' | 'CONTEST';
  tradeAllowed: boolean;
  limitOrders: boolean;
}
```

### SymbolInfo
```typescript
interface SymbolInfo {
  symbol: string;
  description: string;
  digits: number;
  point: number;
  tickValue: number;
  tickSize: number;
  contractSize: number;
  volumeMin: number;
  volumeMax: number;
  volumeStep: number;
  spread: number;
  swapLong: number;
  swapShort: number;
  tradeMode: string;
  currencyBase: string;
  currencyProfit: string;
  currencyMargin: string;
}
```

### Position
```typescript
interface Position {
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  openTime: Date;
  openPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  profit: number;
  swap: number;
  commission: number;
  comment: string;
  magic: number;
  reason: string;
}
```

## Error Codes

| Error Code | Description |
|------------|-------------|
| `BROKER_CONNECTION_FAILED` | Failed to connect to broker |
| `INVALID_CREDENTIALS` | Invalid broker credentials |
| `BROKER_SERVER_UNAVAILABLE` | Broker server is unavailable |
| `CONNECTION_TIMEOUT` | Connection timeout |
| `CONNECTION_LOST` | Connection to broker lost |
| `SYMBOL_NOT_FOUND` | Trading symbol not found |
| `MARKET_CLOSED` | Market is closed |
| `INVALID_SYMBOL` | Invalid trading symbol |
| `INSUFFICIENT_PERMISSIONS` | Insufficient permissions for operation |
| `BROKER_API_ERROR` | Broker API error |

## Rate Limits

| Endpoint | Requests per Minute |
|----------|---------------------|
| Connect | 5 |
| Disconnect | 5 |
| Get Account Info | 30 |
| Get Symbol Info | 60 |
| Get Current Price | 120 |
| Get Open Positions | 30 |
| Get Order History | 20 |
| Test Connection | 10 |

## SDK Examples

### JavaScript/TypeScript
```typescript
import { BrokerAPI } from 'fx-platform-sdk';

const brokerAPI = new BrokerAPI(client);

// Connect to MT5
const connection = await brokerAPI.connect({
  brokerType: 'MT5',
  credentials: {
    login: 12345678,
    password: 'encrypted_password',
    server: 'MetaQuotes-Demo'
  }
});

// Get account info
const accountInfo = await brokerAPI.getAccountInfo(connection.connectionId);

// Get current price
const price = await brokerAPI.getCurrentPrice('EURUSD', connection.connectionId);
```

### Python
```python
from fx_platform import BrokerAPI

broker_api = BrokerAPI(client)

# Connect to MT5
connection = broker_api.connect(
    broker_type='MT5',
    credentials={
        'login': 12345678,
        'password': 'encrypted_password',
        'server': 'MetaQuotes-Demo'
    }
)

# Get account info
account_info = broker_api.get_account_info(connection['connection_id'])

# Get current price
price = broker_api.get_current_price('EURUSD', connection['connection_id'])
```

## Webhooks

Receive real-time broker connection events:

```json
{
  "event": "broker.connection.status",
  "data": {
    "connectionId": "conn_123456",
    "status": "DISCONNECTED",
    "reason": "TIMEOUT",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

```json
{
  "event": "broker.price.update",
  "data": {
    "symbol": "EURUSD",
    "bid": 1.08500,
    "ask": 1.08501,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## Connection Management

### Heartbeat Monitoring

The platform maintains a heartbeat with broker connections:

- **Interval**: 30 seconds
- **Timeout**: 90 seconds
- **Retry Logic**: Exponential backoff with max 5 attempts

### Reconnection Strategy

Automatic reconnection is attempted when:

1. Connection is lost unexpectedly
2. Heartbeat fails
3. Broker server restarts

Reconnection attempts follow this pattern:
- Attempt 1: Immediate
- Attempt 2: 5 seconds delay
- Attempt 3: 15 seconds delay
- Attempt 4: 30 seconds delay
- Attempt 5: 60 seconds delay

### Failover Handling

If the primary broker connection fails:

1. Attempt reconnection (see above)
2. If all reconnection attempts fail, notify user
3. Pause all trading operations
4. Require manual reconnection

---

**Last Updated**: January 2024  
**API Version**: v1.0.0