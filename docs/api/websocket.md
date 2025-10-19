# WebSocket API Documentation

## Overview

The WebSocket API provides real-time data streaming for live trading updates, market data, position monitoring, and system notifications. It enables instant communication between the platform and clients, ensuring timely delivery of critical trading information.

## WebSocket Endpoint

```
wss://your-platform.vercel.app/api/ws
```

## Authentication

WebSocket connections require authentication via JWT token. Include the token in the connection URL or as a query parameter:

```
wss://your-platform.vercel.app/api/ws?token=<your-jwt-token>
```

Or include it in the connection headers:

```javascript
const ws = new WebSocket('wss://your-platform.vercel.app/api/ws', [], {
  headers: {
    'Authorization': 'Bearer <your-jwt-token>'
  }
});
```

## Connection Flow

```
1. Connect → 2. Authenticate → 3. Subscribe → 4. Receive Data → 5. Handle Events
```

## Message Format

All WebSocket messages follow a consistent JSON format:

```json
{
  "type": "message_type",
  "channel": "channel_name",
  "data": {
    // Message data
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "id": "unique_message_id"
}
```

## Channels

| Channel | Description | Authentication |
|---------|-------------|----------------|
| `trades` | Real-time trade executions | Required |
| `positions` | Position updates and P&L | Required |
| `orders` | Order status updates | Required |
| `market-data` | Live market prices | Required |
| `alerts` | System alerts and notifications | Required |
| `analytics` | Performance analytics updates | Required |
| `system` | System status and health | Required |

## API Endpoints

### 1. Connect to WebSocket

Establish a WebSocket connection.

```javascript
const ws = new WebSocket('wss://your-platform.vercel.app/api/ws?token=<jwt-token>');

ws.onopen = function(event) {
  console.log('Connected to WebSocket');
  
  // Subscribe to channels
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['trades', 'positions', 'orders']
  }));
};
```

#### Connection Response
```json
{
  "type": "connection",
  "status": "connected",
  "sessionId": "session_123",
  "userId": "user_456",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. Subscribe to Channels

Subscribe to specific data channels.

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: [
    {
      name: 'trades',
      filters: {
        symbol: 'EURUSD',
        strategyId: 'strategy_123'
      }
    },
    {
      name: 'positions',
      filters: {
        connectionId: 'conn_123456'
      }
    }
  ]
}));
```

#### Subscription Response
```json
{
  "type": "subscription",
  "status": "success",
  "channels": [
    {
      "name": "trades",
      "subscribed": true,
      "filters": {
        "symbol": "EURUSD",
        "strategyId": "strategy_123"
      }
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 3. Unsubscribe from Channels

Unsubscribe from specific channels.

```javascript
ws.send(JSON.stringify({
  type: 'unsubscribe',
  channels: ['trades']
}));
```

#### Unsubscription Response
```json
{
  "type": "unsubscription",
  "status": "success",
  "channels": ["trades"],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 4. Trade Executions

Receive real-time trade execution updates.

#### Trade Execution Message
```json
{
  "type": "trade",
  "channel": "trades",
  "data": {
    "executionId": "exec_123",
    "ticket": 123456,
    "symbol": "EURUSD",
    "action": "BUY",
    "volume": 0.1,
    "openPrice": 1.08500,
    "stopLoss": 1.08000,
    "takeProfit": 1.09000,
    "profit": 0,
    "commission": 0.5,
    "swap": 0,
    "status": "FILLED",
    "executedAt": "2024-01-01T00:00:00.000Z",
    "strategyId": "strategy_123",
    "connectionId": "conn_456"
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "id": "msg_789"
}
```

### 5. Position Updates

Receive real-time position updates and P&L changes.

#### Position Update Message
```json
{
  "type": "position",
  "channel": "positions",
  "data": {
    "ticket": 123456,
    "symbol": "EURUSD",
    "type": "BUY",
    "volume": 0.1,
    "openPrice": 1.08500,
    "currentPrice": 1.08600,
    "stopLoss": 1.08000,
    "takeProfit": 1.09000,
    "profit": 10.0,
    "unrealizedPnL": 10.0,
    "margin": 100.0,
    "marginLevel": 10050.0,
    "duration": 3600,
    "lastUpdate": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "id": "msg_790"
}
```

### 6. Order Status Updates

Receive real-time order status updates.

#### Order Update Message
```json
{
  "type": "order",
  "channel": "orders",
  "data": {
    "orderId": "order_123",
    "ticket": 123456,
    "symbol": "EURUSD",
    "orderType": "BUY_LIMIT",
    "volume": 0.1,
    "price": 1.08200,
    "status": "FILLED",
    "filledAt": "2024-01-01T00:00:00.000Z",
    "fillPrice": 1.08200,
    "filledVolume": 0.1,
    "remainingVolume": 0.0,
    "strategyId": "strategy_123"
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "id": "msg_791"
}
```

### 7. Market Data

Receive real-time market price updates.

#### Market Data Message
```json
{
  "type": "market_data",
  "channel": "market-data",
  "data": {
    "symbol": "EURUSD",
    "bid": 1.08500,
    "ask": 1.08501,
    "last": 1.08500,
    "volume": 100,
    "spread": 1,
    "timestamp": "2024-01-01T00:00:00.000Z",
    "change": 0.00010,
    "changePercent": 0.0092,
    "dayHigh": 1.08600,
    "dayLow": 1.08200,
    "open": 1.08300,
    "close": 1.08490
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "id": "msg_792"
}
```

### 8. System Alerts

Receive real-time system alerts and notifications.

#### Alert Message
```json
{
  "type": "alert",
  "channel": "alerts",
  "data": {
    "alertId": "alert_123",
    "type": "RISK_LIMIT",
    "severity": "WARNING",
    "title": "Daily Loss Limit Approaching",
    "message": "Daily loss has reached 80% of the maximum limit",
    "threshold": 80,
    "current": 80.5,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "entity": {
      "type": "USER",
      "id": "user_456"
    },
    "actions": ["ACKNOWLEDGE", "VIEW_DETAILS"]
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "id": "msg_793"
}
```

### 9. Analytics Updates

Receive real-time analytics updates.

#### Analytics Message
```json
{
  "type": "analytics",
  "channel": "analytics",
  "data": {
    "type": "PERFORMANCE_UPDATE",
    "period": "DAY",
    "metrics": {
      "totalTrades": 15,
      "winRate": 66.7,
      "netProfit": 150.0,
      "currentDrawdown": 25.0
    },
    "timestamp": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "id": "msg_794"
}
```

### 10. System Status

Receive system status updates.

#### System Status Message
```json
{
  "type": "system",
  "channel": "system",
  "data": {
    "status": "HEALTHY",
    "components": {
      "database": "HEALTHY",
      "redis": "HEALTHY",
      "broker": "DEGRADED",
      "pusher": "HEALTHY"
    },
    "message": "Broker connection experiencing high latency",
    "timestamp": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "id": "msg_795"
}
```

## Client Implementation

### JavaScript/TypeScript Example

```typescript
class FXPlatformWebSocket {
  private ws: WebSocket | null = null;
  private subscriptions: Set<string> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(private token: string, private url: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(`${this.url}?token=${this.token}`);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.handleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect();
      }, delay);
    }
  }

  subscribe(channels: string | string[], filters?: Record<string, any>): void {
    const channelArray = Array.isArray(channels) ? channels : [channels];
    
    channelArray.forEach(channel => {
      this.subscriptions.add(channel);
    });

    this.send({
      type: 'subscribe',
      channels: channelArray.map(name => ({
        name,
        filters
      }))
    });
  }

  unsubscribe(channels: string | string[]): void {
    const channelArray = Array.isArray(channels) ? channels : [channels];
    
    channelArray.forEach(channel => {
      this.subscriptions.delete(channel);
    });

    this.send({
      type: 'unsubscribe',
      channels: channelArray
    });
  }

  send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private handleMessage(message: any): void {
    const { type, channel, data } = message;

    switch (type) {
      case 'trade':
        this.onTrade(data);
        break;
      case 'position':
        this.onPosition(data);
        break;
      case 'order':
        this.onOrder(data);
        break;
      case 'market_data':
        this.onMarketData(data);
        break;
      case 'alert':
        this.onAlert(data);
        break;
      case 'analytics':
        this.onAnalytics(data);
        break;
      case 'system':
        this.onSystem(data);
        break;
      default:
        console.log('Unknown message type:', type);
    }
  }

  // Event handlers
  private onTrade(data: any): void {
    console.log('Trade executed:', data);
  }

  private onPosition(data: any): void {
    console.log('Position updated:', data);
  }

  private onOrder(data: any): void {
    console.log('Order updated:', data);
  }

  private onMarketData(data: any): void {
    console.log('Market data:', data);
  }

  private onAlert(data: any): void {
    console.log('Alert:', data);
  }

  private onAnalytics(data: any): void {
    console.log('Analytics:', data);
  }

  private onSystem(data: any): void {
    console.log('System status:', data);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Usage
const client = new FXPlatformWebSocket('jwt-token', 'wss://your-platform.vercel.app/api/ws');

client.connect().then(() => {
  client.subscribe(['trades', 'positions', 'orders'], {
    symbol: 'EURUSD'
  });
});
```

### Python Example

```python
import websocket
import json
import threading
import time

class FXPlatformWebSocket:
    def __init__(self, token, url):
        self.token = token
        self.url = f"{url}?token={token}"
        self.ws = None
        self.subscriptions = set()
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 5
        self.reconnect_delay = 1

    def connect(self):
        self.ws = websocket.WebSocketApp(
            self.url,
            on_open=self.on_open,
            on_message=self.on_message,
            on_close=self.on_close,
            on_error=self.on_error
        )
        
        # Run in a separate thread
        wst = threading.Thread(target=self.ws.run_forever)
        wst.daemon = True
        wst.start()

    def on_open(self, ws):
        print("WebSocket connected")
        self.reconnect_attempts = 0

    def on_message(self, ws, message):
        data = json.loads(message)
        self.handle_message(data)

    def on_close(self, ws, close_status_code, close_msg):
        print("WebSocket disconnected")
        self.handle_reconnect()

    def on_error(self, ws, error):
        print(f"WebSocket error: {error}")

    def handle_reconnect(self):
        if self.reconnect_attempts < self.max_reconnect_attempts:
            self.reconnect_attempts += 1
            delay = self.reconnect_delay * (2 ** (self.reconnect_attempts - 1))
            
            time.sleep(delay)
            print(f"Attempting to reconnect ({self.reconnect_attempts}/{self.max_reconnect_attempts})")
            self.connect()

    def subscribe(self, channels, filters=None):
        if isinstance(channels, str):
            channels = [channels]
        
        for channel in channels:
            self.subscriptions.add(channel)

        message = {
            "type": "subscribe",
            "channels": [
                {
                    "name": channel,
                    "filters": filters or {}
                }
                for channel in channels
            ]
        }
        
        self.send(message)

    def unsubscribe(self, channels):
        if isinstance(channels, str):
            channels = [channels]
        
        for channel in channels:
            self.subscriptions.discard(channel)

        message = {
            "type": "unsubscribe",
            "channels": channels
        }
        
        self.send(message)

    def send(self, message):
        if self.ws and self.ws.sock and self.ws.sock.connected:
            self.ws.send(json.dumps(message))

    def handle_message(self, message):
        msg_type = message.get('type')
        channel = message.get('channel')
        data = message.get('data')

        if msg_type == 'trade':
            self.on_trade(data)
        elif msg_type == 'position':
            self.on_position(data)
        elif msg_type == 'order':
            self.on_order(data)
        elif msg_type == 'market_data':
            self.on_market_data(data)
        elif msg_type == 'alert':
            self.on_alert(data)
        elif msg_type == 'analytics':
            self.on_analytics(data)
        elif msg_type == 'system':
            self.on_system(data)
        else:
            print(f"Unknown message type: {msg_type}")

    # Event handlers
    def on_trade(self, data):
        print(f"Trade executed: {data}")

    def on_position(self, data):
        print(f"Position updated: {data}")

    def on_order(self, data):
        print(f"Order updated: {data}")

    def on_market_data(self, data):
        print(f"Market data: {data}")

    def on_alert(self, data):
        print(f"Alert: {data}")

    def on_analytics(self, data):
        print(f"Analytics: {data}")

    def on_system(self, data):
        print(f"System status: {data}")

    def disconnect(self):
        if self.ws:
            self.ws.close()

# Usage
client = FXPlatformWebSocket('jwt-token', 'wss://your-platform.vercel.app/api/ws')
client.connect()
time.sleep(1)  # Wait for connection
client.subscribe(['trades', 'positions', 'orders'], {'symbol': 'EURUSD'})
```

## Error Handling

### Connection Errors

| Error | Description | Resolution |
|-------|-------------|------------|
| `Authentication failed` | Invalid or expired JWT token | Refresh token and reconnect |
| `Connection refused` | Server unavailable | Retry with exponential backoff |
| `Rate limit exceeded` | Too many connection attempts | Wait before retrying |

### Message Errors

| Error | Description | Resolution |
|-------|-------------|------------|
| `Invalid channel` | Channel not recognized | Check channel name |
| `Permission denied` | Insufficient permissions | Verify user permissions |
| `Invalid subscription` | Invalid subscription format | Check subscription parameters |

## Rate Limits

| Operation | Limit |
|-----------|-------|
| Connections per minute | 10 |
| Subscriptions per connection | 50 |
| Messages per second | 100 |
| Reconnection attempts | 5 |

## Best Practices

1. **Connection Management**
   - Implement exponential backoff for reconnections
   - Limit reconnection attempts
   - Handle connection timeouts gracefully

2. **Subscription Management**
   - Subscribe only to necessary channels
   - Use filters to reduce data volume
   - Unsubscribe from unused channels

3. **Message Handling**
   - Process messages asynchronously
   - Implement message queuing for high volume
   - Handle malformed messages gracefully

4. **Performance**
   - Use message batching where possible
   - Implement client-side caching
   - Monitor connection health

5. **Security**
   - Use secure WebSocket connections (WSS)
   - Validate all incoming messages
   - Implement token refresh mechanism

---

**Last Updated**: January 2024  
**API Version**: v1.0.0