# WebSocket Reliability Implementation

This module provides reliable WebSocket communication with auto-reconnection, message queuing, delivery confirmation, and heartbeat functionality for the FX trading platform.

## Features

- **Auto-reconnection with exponential backoff**: Automatically reconnects when connection is lost
- **Message queue with persistence**: Messages are queued when disconnected and delivered when reconnected
- **Delivery confirmation with acknowledgements**: Ensures critical messages are delivered
- **5-second heartbeat interval**: Monitors connection health with configurable heartbeat
- **Connection state management**: Tracks connection state and provides events for state changes
- **Message retry logic**: Retries failed message delivery with configurable limits
- **Priority queue**: Supports message prioritization for critical trading signals
- **Message expiration**: Automatically removes expired messages from queue
- **Storage adapters**: Supports both browser localStorage and memory storage

## Components

### 1. ReliableWebSocketClient

The main client class that provides reliable WebSocket communication.

```typescript
import { ReliableWebSocketClient } from './reliable-client';

const client = new ReliableWebSocketClient('ws://localhost:8080', {
  reconnect: true,
  reconnectInterval: 2000,
  maxReconnectAttempts: 10,
  heartbeatInterval: 5000,
  enableQueue: true,
  enablePersistence: true
});

await client.connect();
await client.sendWithAcknowledgement({ type: 'TRADE_SIGNAL', payload: signal });
```

### 2. MessageQueue

Handles message persistence and priority queuing.

```typescript
import { MessageQueue, BrowserStorageAdapter } from './message-queue';

const queue = new MessageQueue(
  {
    maxSize: 1000,
    enablePersistence: true,
    storageKey: 'trading_queue',
    defaultPriority: MessagePriority.NORMAL,
    defaultTTL: 300000 // 5 minutes
  },
  new BrowserStorageAdapter()
);
```

### 3. HeartbeatManager

Manages ping/pong messages for connection health monitoring.

```typescript
import { HeartbeatManager } from './heartbeat-manager';

const heartbeatManager = new HeartbeatManager(
  {
    interval: 5000,  // 5 seconds
    timeout: 3000,   // 3 seconds
    maxMissed: 3     // Allow 3 missed heartbeats
  },
  {
    onPing: () => console.log('Sending ping'),
    onPong: (latency) => console.log(`Pong received, latency: ${latency}ms`),
    onTimeout: (missedCount) => console.warn(`Heartbeat timeout: ${missedCount}`),
    onConnectionLost: () => console.error('Connection lost due to heartbeat timeout')
  }
);
```

## Usage Examples

### Basic Usage

```typescript
import { ReliableWebSocketClient } from './websocket';

const client = new ReliableWebSocketClient('ws://localhost:8080');

// Connect to server
await client.connect();

// Send message with acknowledgement
const result = await client.sendWithAcknowledgement({
  type: 'TRADE_SIGNAL',
  payload: { symbol: 'EURUSD', action: 'BUY' }
});

if (result.acknowledged) {
  console.log('Message delivered and acknowledged');
}

// Disconnect
await client.disconnect();
```

### Trading Client Integration

```typescript
import { TradingClient } from './websocket/integration-example';

const tradingClient = new TradingClient('ws://localhost:8080', 'your-api-key');

await tradingClient.connect();

// Send trade signal
await tradingClient.sendTradeSignal({
  symbol: 'EURUSD',
  action: 'BUY',
  volume: 0.1,
  stopLoss: 1.1800,
  takeProfit: 1.1900
});

// Get connection statistics
const stats = tradingClient.getStats();
console.log('Connection stats:', stats);
```

## Configuration Options

### ConnectionConfig

```typescript
interface ConnectionConfig {
  url: string;                    // WebSocket server URL
  protocols?: string[];           // WebSocket sub-protocols
  reconnect?: boolean;            // Enable auto-reconnection (default: true)
  reconnectInterval?: number;     // Initial reconnection delay in ms (default: 1000)
  maxReconnectAttempts?: number;  // Max reconnection attempts (default: 5)
  heartbeatInterval?: number;     // Heartbeat interval in ms (default: 5000)
  heartbeatTimeout?: number;      // Heartbeat timeout in ms (default: 3000)
  messageTimeout?: number;        // Message acknowledgement timeout in ms (default: 10000)
  enableQueue?: boolean;          // Enable message queuing (default: true)
  queueSize?: number;             // Maximum queue size (default: 1000)
  enablePersistence?: boolean;    // Enable queue persistence (default: true)
  storageKey?: string;            // Storage key for persistence (default: 'reliable_ws_client')
}
```

### MessageQueueConfig

```typescript
interface MessageQueueConfig {
  maxSize: number;              // Maximum number of messages in queue
  enablePersistence: boolean;   // Enable queue persistence to storage
  storageKey: string;           // Storage key for persistence
  defaultPriority: MessagePriority; // Default message priority
  defaultTTL: number;           // Default time-to-live for messages in ms
}
```

### HeartbeatConfig

```typescript
interface HeartbeatConfig {
  interval: number;   // Heartbeat interval in ms
  timeout: number;    // Heartbeat timeout in ms
  maxMissed: number;  // Maximum missed heartbeats before considering connection lost
}
```

## Message Types

```typescript
enum MessageType {
  DATA = 'data',              // Regular data message
  COMMAND = 'command',        // Command message
  RESPONSE = 'response',      // Response message
  ACK = 'ack',                // Acknowledgement message
  NACK = 'nack',              // Negative acknowledgement
  HEARTBEAT = 'heartbeat',    // Heartbeat ping
  HEARTBEAT_ACK = 'heartbeat_ack', // Heartbeat pong
  CONNECT = 'connect',        // Connection request
  DISCONNECT = 'disconnect',  // Disconnection request
  RECONNECT = 'reconnect'     // Reconnection request
}
```

## Message Priority

```typescript
enum MessagePriority {
  LOW = 0,       // Low priority messages
  NORMAL = 1,    // Normal priority messages
  HIGH = 2,      // High priority messages
  CRITICAL = 3   // Critical messages (highest priority)
}
```

## Connection States

```typescript
enum ConnectionState {
  DISCONNECTED = 'disconnected',  // Not connected
  CONNECTING = 'connecting',      // Connection in progress
  CONNECTED = 'connected',        // Successfully connected
  RECONNECTING = 'reconnecting',  // Reconnection in progress
  DISCONNECTING = 'disconnecting', // Disconnection in progress
  ERROR = 'error'                 // Connection error
}
```

## Events

The ReliableWebSocketClient emits various events that can be listened to:

```typescript
// Connection events
client.addEventListener('open', (event) => console.log('Connected'));
client.addEventListener('close', (event) => console.log('Disconnected'));
client.addEventListener('error', (event) => console.error('Error:', event));

// Reliability events
client.addEventListener('reconnecting', (event) => console.log('Reconnecting...'));
client.addEventListener('messageQueued', (event) => console.log('Message queued'));
client.addEventListener('messageAcknowledged', (event) => console.log('Message acknowledged'));
client.addEventListener('heartbeatTimeout', (event) => console.warn('Heartbeat timeout'));
```

## Testing

The module includes comprehensive unit tests covering:

- Connection management
- Message handling and queuing
- Heartbeat functionality
- Error scenarios
- Integration tests

Run tests with:

```bash
npm test -- src/lib/websocket/__tests__/reliable-client.test.ts
```

## Integration with Existing Server

The implementation is designed to work with the existing WebSocket server (`src/lib/websocket/server.ts`). The server already handles:

- Authentication via API keys
- Message routing
- Heartbeat responses
- Command processing

The reliable client enhances this by adding:

- Client-side reliability features
- Message persistence
- Auto-reconnection
- Delivery confirmation

## Security Considerations

- API keys should be transmitted securely (e.g., via HTTPS or as part of the WebSocket URL)
- Message payloads should be validated on both client and server
- Connection limits should be enforced on the server side
- Sensitive data should be encrypted before transmission

## Performance Considerations

- Message queue size should be limited to prevent memory issues
- Expired messages should be cleaned up regularly
- Heartbeat intervals should be balanced between responsiveness and resource usage
- Storage operations should be optimized to avoid blocking the main thread