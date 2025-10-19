# Trading API Documentation

## Overview

The Trading API provides comprehensive trade execution capabilities with built-in safety mechanisms, pre-execution validation, and post-execution verification. It ensures that all trades are executed safely and efficiently while maintaining strict risk controls.

## Base URL

```
/api/v1/trading
```

## Authentication

All endpoints require JWT authentication. See [API Overview](./README.md#authentication) for details.

## Trading Flow

```
1. Validate Trade Request → 2. Risk Check → 3. Pre-execution Validation → 
4. Execute Trade → 5. Verify Execution → 6. Record Trade → 7. Send Notification
```

## Endpoints

### 1. Execute Market Order

Execute a market order with full safety checks.

```http
POST /api/v1/trading/execute-market
```

#### Request Body
```json
{
  "symbol": "EURUSD",
  "action": "BUY",
  "volume": 0.1,
  "stopLoss": 1.0800,
  "takeProfit": 1.0900,
  "comment": "Strategy #123",
  "magic": 123,
  "connectionId": "conn_123456",
  "strategyId": "strategy_456",
  "slippage": 3
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "executionId": "exec_789",
    "ticket": 123456,
    "symbol": "EURUSD",
    "action": "BUY",
    "volume": 0.1,
    "openPrice": 1.08500,
    "stopLoss": 1.0800,
    "takeProfit": 1.0900,
    "spread": 1,
    "swap": 0,
    "commission": 0.5,
    "profit": 0,
    "executionTime": 150,
    "status": "FILLED",
    "filledAt": "2024-01-01T00:00:00.000Z",
    "brokerReference": "broker_ref_123",
    "validationResults": {
      "riskCheck": "PASSED",
      "marketHours": "OPEN",
      "spreadCheck": "ACCEPTABLE",
      "marginCheck": "SUFFICIENT"
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. Execute Pending Order

Place a pending order (limit, stop, etc.).

```http
POST /api/v1/trading/execute-pending
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
    "status": "PLACED",
    "placedAt": "2024-01-01T00:00:00.000Z",
    "brokerReference": "broker_ref_123"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 3. Close Position

Close an existing position.

```http
POST /api/v1/trading/close-position
```

#### Request Body
```json
{
  "ticket": 123456,
  "volume": 0.1,
  "connectionId": "conn_123456",
  "reason": "MANUAL"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "ticket": 123456,
    "symbol": "EURUSD",
    "type": "BUY",
    "volume": 0.1,
    "closePrice": 1.08600,
    "closeTime": "2024-01-01T00:00:00.000Z",
    "profit": 10.0,
    "commission": 0.5,
    "swap": 0,
    "executionTime": 120,
    "status": "CLOSED"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 4. Modify Position

Modify stop loss and take profit for an existing position.

```http
POST /api/v1/trading/modify-position
```

#### Request Body
```json
{
  "ticket": 123456,
  "stopLoss": 1.08200,
  "takeProfit": 1.09200,
  "connectionId": "conn_123456"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "ticket": 123456,
    "symbol": "EURUSD",
    "stopLoss": 1.08200,
    "takeProfit": 1.09200,
    "modifiedAt": "2024-01-01T00:00:00.000Z",
    "executionTime": 80
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 5. Cancel Pending Order

Cancel a pending order.

```http
POST /api/v1/trading/cancel-order
```

#### Request Body
```json
{
  "orderId": "order_789",
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
    "symbol": "EURUSD",
    "status": "CANCELLED",
    "cancelledAt": "2024-01-01T00:00:00.000Z",
    "reason": "USER_REQUEST"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 6. Get Execution Status

Check the status of a trade execution.

```http
GET /api/v1/trading/execution/{executionId}
```

#### Response
```json
{
  "success": true,
  "data": {
    "executionId": "exec_789",
    "status": "COMPLETED",
    "ticket": 123456,
    "symbol": "EURUSD",
    "action": "BUY",
    "volume": 0.1,
    "requestedPrice": 1.08500,
    "executedPrice": 1.08501,
    "slippage": 1,
    "spread": 1,
    "commission": 0.5,
    "swap": 0,
    "profit": 10.0,
    "executionTime": 150,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "completedAt": "2024-01-01T00:00:00.150Z",
    "validationResults": {
      "riskCheck": "PASSED",
      "marketHours": "OPEN",
      "spreadCheck": "ACCEPTABLE",
      "marginCheck": "SUFFICIENT"
    },
    "steps": [
      {
        "step": "VALIDATION",
        "status": "COMPLETED",
        "duration": 50,
        "timestamp": "2024-01-01T00:00:00.050Z"
      },
      {
        "step": "RISK_CHECK",
        "status": "COMPLETED",
        "duration": 30,
        "timestamp": "2024-01-01T00:00:00.080Z"
      },
      {
        "step": "EXECUTION",
        "status": "COMPLETED",
        "duration": 70,
        "timestamp": "2024-01-01T00:00:00.150Z"
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 7. Get Trading History

Retrieve trading execution history.

```http
GET /api/v1/trading/history
```

#### Query Parameters
- `from` (string): Start date (ISO 8601)
- `to` (string): End date (ISO 8601)
- `symbol` (string): Filter by symbol (optional)
- `status` (string): Filter by status (optional)
- `page` (number): Page number
- `limit` (number): Items per page

#### Response
```json
{
  "success": true,
  "data": {
    "executions": [
      {
        "executionId": "exec_789",
        "ticket": 123456,
        "symbol": "EURUSD",
        "action": "BUY",
        "volume": 0.1,
        "openPrice": 1.08500,
        "closePrice": 1.08600,
        "profit": 10.0,
        "status": "COMPLETED",
        "executedAt": "2024-01-01T00:00:00.000Z",
        "strategyId": "strategy_456",
        "connectionId": "conn_123456"
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

### 8. Validate Trade

Validate a trade without executing it.

```http
POST /api/v1/trading/validate
```

#### Request Body
```json
{
  "symbol": "EURUSD",
  "action": "BUY",
  "volume": 0.1,
  "stopLoss": 1.0800,
  "takeProfit": 1.0900,
  "connectionId": "conn_123456"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "valid": true,
    "errors": [],
    "warnings": [
      "Spread is wider than usual"
    ],
    "validationResults": {
      "riskCheck": {
        "status": "PASSED",
        "riskAmount": 20.0,
        "riskPercent": 2.0,
        "marginRequired": 100.0
      },
      "marketHours": {
        "status": "OPEN",
        "opensAt": "2024-01-01T00:00:00.000Z",
        "closesAt": "2024-01-01T22:00:00.000Z"
      },
      "spreadCheck": {
        "status": "ACCEPTABLE",
        "currentSpread": 1,
        "averageSpread": 0.8,
        "maxSpread": 3
      },
      "marginCheck": {
        "status": "SUFFICIENT",
        "required": 100.0,
        "available": 10050.0,
        "free": 10050.0
      },
      "symbolCheck": {
        "status": "VALID",
        "tradeable": true,
        "expired": false
      }
    },
    "estimatedExecution": {
      "estimatedPrice": 1.08500,
      "estimatedSpread": 1,
      "estimatedCommission": 0.5,
      "estimatedSlippage": 0.5
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 9. Get Market Hours

Get market hours for a symbol.

```http
GET /api/v1/trading/market-hours/{symbol}
```

#### Response
```json
{
  "success": true,
  "data": {
    "symbol": "EURUSD",
    "market": "FOREX",
    "timezone": "UTC",
    "schedule": [
      {
        "day": "MONDAY",
        "open": "00:00:00",
        "close": "23:59:59",
        "openTime": "2024-01-01T00:00:00.000Z",
        "closeTime": "2024-01-01T23:59:59.000Z"
      }
    ],
    "currentlyOpen": true,
    "nextOpen": "2024-01-02T00:00:00.000Z",
    "nextClose": "2024-01-01T23:59:59.000Z",
    "holidays": [
      {
        "date": "2024-01-01",
        "name": "New Year's Day",
        "status": "CLOSED"
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 10. Get Trading Statistics

Get trading performance statistics.

```http
GET /api/v1/trading/statistics
```

#### Query Parameters
- `period` (string): Period (day, week, month, year)
- `from` (string): Start date (ISO 8601)
- `to` (string): End date (ISO 8601)

#### Response
```json
{
  "success": true,
  "data": {
    "period": "WEEK",
    "totalTrades": 25,
    "winningTrades": 15,
    "losingTrades": 10,
    "winRate": 60.0,
    "totalProfit": 250.0,
    "totalLoss": -120.0,
    "netProfit": 130.0,
    "profitFactor": 2.08,
    "averageWin": 16.67,
    "averageLoss": -12.0,
    "largestWin": 50.0,
    "largestLoss": -25.0,
    "averageRiskReward": 1.39,
    "sharpeRatio": 1.25,
    "maxDrawdown": 30.0,
    "averageExecutionTime": 150,
    "totalCommission": 12.5,
    "totalSwap": 2.5,
    "bySymbol": [
      {
        "symbol": "EURUSD",
        "trades": 15,
        "profit": 100.0,
        "winRate": 66.67
      }
    ],
    "byStrategy": [
      {
        "strategyId": "strategy_456",
        "trades": 20,
        "profit": 120.0,
        "winRate": 65.0
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Data Models

### MarketOrderRequest
```typescript
interface MarketOrderRequest {
  symbol: string;
  action: 'BUY' | 'SELL';
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
  magic?: number;
  connectionId: string;
  strategyId?: string;
  slippage?: number;
}
```

### PendingOrderRequest
```typescript
interface PendingOrderRequest {
  symbol: string;
  orderType: 'BUY_LIMIT' | 'SELL_LIMIT' | 'BUY_STOP' | 'SELL_STOP';
  volume: number;
  price: number;
  stopLoss?: number;
  takeProfit?: number;
  expiration?: string;
  comment?: string;
  magic?: number;
  connectionId: string;
  strategyId?: string;
}
```

### ExecutionResult
```typescript
interface ExecutionResult {
  executionId: string;
  ticket: number;
  symbol: string;
  action: 'BUY' | 'SELL';
  volume: number;
  openPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  spread: number;
  swap: number;
  commission: number;
  profit: number;
  executionTime: number;
  status: 'FILLED' | 'PARTIALLY_FILLED' | 'REJECTED' | 'CANCELLED';
  filledAt: string;
  brokerReference: string;
  validationResults: ValidationResults;
}
```

### ValidationResults
```typescript
interface ValidationResults {
  riskCheck: {
    status: 'PASSED' | 'FAILED';
    riskAmount: number;
    riskPercent: number;
    marginRequired: number;
  };
  marketHours: {
    status: 'OPEN' | 'CLOSED';
    opensAt?: string;
    closesAt?: string;
  };
  spreadCheck: {
    status: 'ACCEPTABLE' | 'TOO_WIDE';
    currentSpread: number;
    averageSpread: number;
    maxSpread: number;
  };
  marginCheck: {
    status: 'SUFFICIENT' | 'INSUFFICIENT';
    required: number;
    available: number;
    free: number;
  };
  symbolCheck: {
    status: 'VALID' | 'INVALID';
    tradeable: boolean;
    expired: boolean;
  };
}
```

## Error Codes

| Error Code | Description |
|------------|-------------|
| `TRADE_EXECUTION_FAILED` | Trade execution failed |
| `INSUFFICIENT_MARGIN` | Insufficient margin for trade |
| `MARKET_CLOSED` | Market is closed for trading |
| `INVALID_SYMBOL` | Invalid trading symbol |
| `SPREAD_TOO_WIDE` | Spread exceeds maximum allowed |
| `SLIPPAGE_TOO_HIGH` | Slippage exceeds maximum allowed |
| `POSITION_NOT_FOUND` | Position not found |
| `ORDER_NOT_FOUND` | Order not found |
| `INVALID_VOLUME` | Invalid trade volume |
| `INVALID_PRICE` | Invalid price for order |
| `RISK_LIMIT_EXCEEDED` | Trade exceeds risk limits |
| `BROKER_REJECTION` | Order rejected by broker |
| `CONNECTION_LOST` | Connection to broker lost |
| `EXECUTION_TIMEOUT` | Trade execution timeout |

## Rate Limits

| Endpoint | Requests per Minute |
|----------|---------------------|
| Execute Market Order | 30 |
| Execute Pending Order | 20 |
| Close Position | 30 |
| Modify Position | 30 |
| Cancel Order | 20 |
| Get Execution Status | 60 |
| Get Trading History | 30 |
| Validate Trade | 50 |

## SDK Examples

### JavaScript/TypeScript
```typescript
import { TradingAPI } from 'fx-platform-sdk';

const tradingAPI = new TradingAPI(client);

// Execute market order
const result = await tradingAPI.executeMarketOrder({
  symbol: 'EURUSD',
  action: 'BUY',
  volume: 0.1,
  stopLoss: 1.0800,
  takeProfit: 1.0900,
  connectionId: 'conn_123456'
});

// Validate trade before execution
const validation = await tradingAPI.validateTrade({
  symbol: 'EURUSD',
  action: 'BUY',
  volume: 0.1,
  connectionId: 'conn_123456'
});

// Close position
const closeResult = await tradingAPI.closePosition({
  ticket: 123456,
  connectionId: 'conn_123456'
});
```

### Python
```python
from fx_platform import TradingAPI

trading_api = TradingAPI(client)

# Execute market order
result = trading_api.execute_market_order(
    symbol='EURUSD',
    action='BUY',
    volume=0.1,
    stop_loss=1.0800,
    take_profit=1.0900,
    connection_id='conn_123456'
)

# Validate trade before execution
validation = trading_api.validate_trade(
    symbol='EURUSD',
    action='BUY',
    volume=0.1,
    connection_id='conn_123456'
)

# Close position
close_result = trading_api.close_position(
    ticket=123456,
    connection_id='conn_123456'
)
```

## Webhooks

Receive real-time trading events:

```json
{
  "event": "trade.executed",
  "data": {
    "executionId": "exec_789",
    "ticket": 123456,
    "symbol": "EURUSD",
    "action": "BUY",
    "volume": 0.1,
    "openPrice": 1.08500,
    "status": "FILLED",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

```json
{
  "event": "trade.failed",
  "data": {
    "executionId": "exec_789",
    "error": "INSUFFICIENT_MARGIN",
    "message": "Insufficient margin for trade",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## Safety Mechanisms

### Pre-Execution Checks
1. **Market Hours Validation**: Verify market is open
2. **Symbol Validation**: Ensure symbol is tradeable
3. **Spread Check**: Verify spread is acceptable
4. **Connection Check**: Ensure broker connection is active
5. **Margin Check**: Verify sufficient margin
6. **Risk Validation**: Check against risk limits
7. **Price Validation**: Validate stop loss/take profit levels

### Execution Safety
1. **Retry Logic**: Automatic retry on temporary failures
2. **Slippage Protection**: Maximum slippage limits
3. **Partial Fill Handling**: Proper handling of partial fills
4. **Timeout Protection**: Maximum execution time limits

### Post-Execution Verification
1. **Execution Confirmation**: Verify trade was executed correctly
2. **Price Verification**: Confirm execution price is acceptable
3. **Position Sync**: Synchronize position with broker
4. **Audit Logging**: Complete audit trail of all actions

---

**Last Updated**: January 2024  
**API Version**: v1.0.0