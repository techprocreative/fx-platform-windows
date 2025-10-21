# Order Management API Documentation

## Overview

The Order Management API provides comprehensive order lifecycle management, including creation, tracking, modification, and cancellation of orders. It ensures reliable order processing with proper event handling and reconciliation mechanisms.

## Base URL

```
/api/v1/orders
```

## Authentication

All endpoints require JWT authentication. See [API Overview](./README.md#authentication) for details.

## Order Lifecycle

```
1. Create Order → 2. Validate → 3. Submit → 4. Track → 5. Execute/Fill → 
6. Confirm → 7. Record → 8. Notify
```

## Order Types

| Type | Description |
|------|-------------|
| MARKET | Immediate execution at current market price |
| BUY_LIMIT | Buy at specified price or lower |
| SELL_LIMIT | Sell at specified price or higher |
| BUY_STOP | Buy when price rises to specified level |
| SELL_STOP | Sell when price falls to specified level |

## Endpoints

### 1. Create Order

Create a new order with validation.

```http
POST /api/v1/orders/create
```

#### Request Body
```json
{
  "symbol": "EURUSD",
  "orderType": "BUY_LIMIT",
  "volume": 0.1,
  "price": 1.08200,
  "stopLoss": 1.07800,
  "takeProfit": 1.09200,
  "expiration": "2024-01-02T00:00:00.000Z",
  "comment": "Strategy #123",
  "magic": 123,
  "connectionId": "conn_123456",
  "strategyId": "strategy_456"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "orderId": "order_789",
    "ticket": 123456,
    "symbol": "EURUSD",
    "orderType": "BUY_LIMIT",
    "volume": 0.1,
    "price": 1.08200,
    "stopLoss": 1.07800,
    "takeProfit": 1.09200,
    "expiration": "2024-01-02T00:00:00.000Z",
    "status": "CREATED",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "validationResults": {
      "valid": true,
      "errors": [],
      "warnings": ["Price is far from current market"]
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. Submit Order

Submit a created order to the broker.

```http
POST /api/v1/orders/{orderId}/submit
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
    "orderId": "order_789",
    "ticket": 123456,
    "status": "SUBMITTED",
    "submittedAt": "2024-01-01T00:00:00.000Z",
    "brokerReference": "broker_ref_123",
    "submissionTime": 120
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 3. Cancel Order

Cancel a pending order.

```http
POST /api/v1/orders/{orderId}/cancel
```

#### Request Body
```json
{
  "reason": "USER_REQUEST",
  "connectionId": "conn_123456"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "orderId": "order_789",
    "ticket": 123456,
    "status": "CANCELLED",
    "cancelledAt": "2024-01-01T00:00:00.000Z",
    "reason": "USER_REQUEST",
    "cancellationTime": 80
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 4. Modify Order

Modify an existing pending order.

```http
POST /api/v1/orders/{orderId}/modify
```

#### Request Body
```json
{
  "price": 1.08300,
  "stopLoss": 1.07900,
  "takeProfit": 1.09300,
  "expiration": "2024-01-03T00:00:00.000Z",
  "connectionId": "conn_123456"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "orderId": "order_789",
    "ticket": 123456,
    "modifiedAt": "2024-01-01T00:00:00.000Z",
    "changes": {
      "price": {
        "old": 1.08200,
        "new": 1.08300
      },
      "stopLoss": {
        "old": 1.07800,
        "new": 1.07900
      }
    },
    "modificationTime": 100
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 5. Get Order Details

Retrieve detailed information about an order.

```http
GET /api/v1/orders/{orderId}
```

#### Response
```json
{
  "success": true,
  "data": {
    "orderId": "order_789",
    "ticket": 123456,
    "symbol": "EURUSD",
    "orderType": "BUY_LIMIT",
    "volume": 0.1,
    "price": 1.08200,
    "stopLoss": 1.07800,
    "takeProfit": 1.09200,
    "expiration": "2024-01-02T00:00:00.000Z",
    "status": "SUBMITTED",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "submittedAt": "2024-01-01T00:00:05.000Z",
    "comment": "Strategy #123",
    "magic": 123,
    "connectionId": "conn_123456",
    "strategyId": "strategy_456",
    "brokerReference": "broker_ref_123",
    "validationResults": {
      "valid": true,
      "errors": [],
      "warnings": []
    },
    "events": [
      {
        "eventType": "CREATED",
        "timestamp": "2024-01-01T00:00:00.000Z",
        "details": {
          "userId": "user_123",
          "source": "API"
        }
      },
      {
        "eventType": "SUBMITTED",
        "timestamp": "2024-01-01T00:00:05.000Z",
        "details": {
          "brokerReference": "broker_ref_123",
          "submissionTime": 120
        }
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 6. Get Active Orders

Retrieve all active orders for a user.

```http
GET /api/v1/orders/active
```

#### Query Parameters
- `connectionId` (string): Filter by connection ID (optional)
- `symbol` (string): Filter by symbol (optional)
- `orderType` (string): Filter by order type (optional)
- `page` (number): Page number
- `limit` (number): Items per page

#### Response
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "orderId": "order_789",
        "ticket": 123456,
        "symbol": "EURUSD",
        "orderType": "BUY_LIMIT",
        "volume": 0.1,
        "price": 1.08200,
        "status": "SUBMITTED",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "currentPrice": 1.08500,
        "distanceFromPrice": 30,
        "timeInMarket": 3600
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    },
    "summary": {
      "totalOrders": 5,
      "buyOrders": 3,
      "sellOrders": 2,
      "totalVolume": 0.5
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 7. Get Order History

Retrieve historical order data.

```http
GET /api/v1/orders/history
```

#### Query Parameters
- `from` (string): Start date (ISO 8601)
- `to` (string): End date (ISO 8601)
- `status` (string): Filter by status (optional)
- `symbol` (string): Filter by symbol (optional)
- `page` (number): Page number
- `limit` (number): Items per page

#### Response
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "orderId": "order_789",
        "ticket": 123456,
        "symbol": "EURUSD",
        "orderType": "BUY_LIMIT",
        "volume": 0.1,
        "price": 1.08200,
        "status": "FILLED",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "filledAt": "2024-01-01T02:30:00.000Z",
        "fillPrice": 1.08200,
        "commission": 0.5,
        "swap": 0,
        "profit": 10.0
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

### 8. Track Order Status

Track the real-time status of an order.

```http
GET /api/v1/orders/{orderId}/status
```

#### Response
```json
{
  "success": true,
  "data": {
    "orderId": "order_789",
    "ticket": 123456,
    "status": "SUBMITTED",
    "lastUpdate": "2024-01-01T00:00:30.000Z",
    "brokerStatus": "PENDING",
    "timeInStatus": 30,
    "estimatedFillTime": null,
    "currentPrice": 1.08500,
    "distanceFromPrice": 30,
    "probabilityOfFill": 0.15,
    "nextUpdate": "2024-01-01T00:01:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 9. Reconcile Orders

Reconcile orders with broker records.

```http
POST /api/v1/orders/reconcile
```

#### Request Body
```json
{
  "connectionId": "conn_123456",
  "force": false
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "reconciliationId": "recon_123",
    "status": "COMPLETED",
    "startedAt": "2024-01-01T00:00:00.000Z",
    "completedAt": "2024-01-01T00:00:05.000Z",
    "summary": {
      "totalOrders": 10,
      "matched": 8,
      "mismatched": 1,
      "missing": 1,
      "extra": 0
    },
    "discrepancies": [
      {
        "orderId": "order_789",
        "type": "STATUS_MISMATCH",
        "platformStatus": "SUBMITTED",
        "brokerStatus": "CANCELLED",
        "resolution": "UPDATED_PLATFORM"
      }
    ],
    "actions": [
      {
        "type": "STATUS_UPDATE",
        "orderId": "order_789",
        "oldStatus": "SUBMITTED",
        "newStatus": "CANCELLED",
        "timestamp": "2024-01-01T00:00:03.000Z"
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 10. Bulk Operations

Perform bulk operations on multiple orders.

```http
POST /api/v1/orders/bulk
```

#### Request Body
```json
{
  "operation": "CANCEL",
  "orderIds": ["order_789", "order_790", "order_791"],
  "connectionId": "conn_123456",
  "reason": "STRATEGY_STOP"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "bulkOperationId": "bulk_123",
    "operation": "CANCEL",
    "status": "COMPLETED",
    "startedAt": "2024-01-01T00:00:00.000Z",
    "completedAt": "2024-01-01T00:00:02.000Z",
    "results": [
      {
        "orderId": "order_789",
        "status": "SUCCESS",
        "cancelledAt": "2024-01-01T00:00:00.500Z"
      },
      {
        "orderId": "order_790",
        "status": "SUCCESS",
        "cancelledAt": "2024-01-01T00:00:00.800Z"
      },
      {
        "orderId": "order_791",
        "status": "FAILED",
        "error": "ORDER_ALREADY_FILLED",
        "timestamp": "2024-01-01T00:00:01.200Z"
      }
    ],
    "summary": {
      "total": 3,
      "successful": 2,
      "failed": 1
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Data Models

### OrderRequest
```typescript
interface OrderRequest {
  symbol: string;
  orderType: 'MARKET' | 'BUY_LIMIT' | 'SELL_LIMIT' | 'BUY_STOP' | 'SELL_STOP';
  volume: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  expiration?: string;
  comment?: string;
  magic?: number;
  connectionId: string;
  strategyId?: string;
}
```

### Order
```typescript
interface Order {
  orderId: string;
  ticket: number;
  symbol: string;
  orderType: string;
  volume: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  expiration?: string;
  status: 'CREATED' | 'SUBMITTED' | 'FILLED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED';
  createdAt: string;
  submittedAt?: string;
  filledAt?: string;
  cancelledAt?: string;
  comment?: string;
  magic?: number;
  connectionId: string;
  strategyId?: string;
  brokerReference?: string;
  validationResults?: ValidationResults;
}
```

### OrderEvent
```typescript
interface OrderEvent {
  eventType: 'CREATED' | 'SUBMITTED' | 'FILLED' | 'CANCELLED' | 'REJECTED' | 'MODIFIED' | 'EXPIRED';
  timestamp: string;
  details: Record<string, any>;
}
```

### ReconciliationReport
```typescript
interface ReconciliationReport {
  reconciliationId: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  completedAt?: string;
  summary: {
    totalOrders: number;
    matched: number;
    mismatched: number;
    missing: number;
    extra: number;
  };
  discrepancies: Discrepancy[];
  actions: ReconciliationAction[];
}
```

## Order Status Flow

```
CREATED → SUBMITTED → FILLED/CANCELLED/REJECTED/EXPIRED
    ↓
MODIFIED (can occur multiple times while SUBMITTED)
```

## Error Codes

| Error Code | Description |
|------------|-------------|
| `ORDER_NOT_FOUND` | Order not found |
| `ORDER_ALREADY_FILLED` | Order already filled |
| `ORDER_ALREADY_CANCELLED` | Order already cancelled |
| `INVALID_ORDER_TYPE` | Invalid order type |
| `INVALID_VOLUME` | Invalid order volume |
| `INVALID_PRICE` | Invalid order price |
| `ORDER_EXPIRED` | Order has expired |
| `INSUFFICIENT_PERMISSIONS` | Insufficient permissions |
| `BROKER_REJECTION` | Order rejected by broker |
| `CONNECTION_LOST` | Connection to broker lost |
| `RECONCILIATION_FAILED` | Order reconciliation failed |
| `BULK_OPERATION_FAILED` | Bulk operation failed |

## Rate Limits

| Endpoint | Requests per Minute |
|----------|---------------------|
| Create Order | 30 |
| Submit Order | 30 |
| Cancel Order | 30 |
| Modify Order | 20 |
| Get Order Details | 60 |
| Get Active Orders | 30 |
| Get Order History | 20 |
| Track Order Status | 60 |
| Reconcile Orders | 5 |
| Bulk Operations | 10 |

## SDK Examples

### JavaScript/TypeScript
```typescript
import { OrderAPI } from 'fx-platform-sdk';

const orderAPI = new OrderAPI(client);

// Create a limit order
const order = await orderAPI.createOrder({
  symbol: 'EURUSD',
  orderType: 'BUY_LIMIT',
  volume: 0.1,
  price: 1.08200,
  stopLoss: 1.07800,
  takeProfit: 1.09200,
  connectionId: 'conn_123456'
});

// Submit the order
const submission = await orderAPI.submitOrder(order.orderId, 'conn_123456');

// Track order status
const status = await orderAPI.trackOrderStatus(order.orderId);

// Cancel order
const cancellation = await orderAPI.cancelOrder(order.orderId, {
  reason: 'USER_REQUEST',
  connectionId: 'conn_123456'
});
```

### Python
```python
from fx_platform import OrderAPI

order_api = OrderAPI(client)

# Create a limit order
order = order_api.create_order(
    symbol='EURUSD',
    order_type='BUY_LIMIT',
    volume=0.1,
    price=1.08200,
    stop_loss=1.07800,
    take_profit=1.09200,
    connection_id='conn_123456'
)

# Submit the order
submission = order_api.submit_order(order['order_id'], 'conn_123456')

# Track order status
status = order_api.track_order_status(order['order_id'])

# Cancel order
cancellation = order_api.cancel_order(
    order['order_id'],
    reason='USER_REQUEST',
    connection_id='conn_123456'
)
```

## Webhooks

Receive real-time order events:

```json
{
  "event": "order.created",
  "data": {
    "orderId": "order_789",
    "ticket": 123456,
    "symbol": "EURUSD",
    "orderType": "BUY_LIMIT",
    "status": "CREATED",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

```json
{
  "event": "order.filled",
  "data": {
    "orderId": "order_789",
    "ticket": 123456,
    "symbol": "EURUSD",
    "fillPrice": 1.08200,
    "fillVolume": 0.1,
    "commission": 0.5,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

```json
{
  "event": "order.cancelled",
  "data": {
    "orderId": "order_789",
    "ticket": 123456,
    "reason": "USER_REQUEST",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## Order Reconciliation

Order reconciliation is automatically performed:

1. **Every 5 minutes** for active orders
2. **On connection restore** after disconnection
3. **On manual request** via API

Reconciliation ensures:
- Platform and broker order status synchronization
- Detection of missing or extra orders
- Automatic correction of discrepancies
- Complete audit trail of all changes

---

**Last Updated**: January 2024  
**API Version**: v1.0.0