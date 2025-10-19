# Risk Management API Documentation

## Overview

The Risk Management API provides comprehensive risk assessment, position sizing, and limit enforcement for all trading activities. It ensures that all trades comply with predefined risk parameters and protects against excessive losses.

## Base URL

```
/api/v1/risk
```

## Authentication

All endpoints require JWT authentication. See [API Overview](./README.md#authentication) for details.

## Endpoints

### 1. Get Risk Parameters

Retrieve the current risk parameters for a user.

```http
GET /api/v1/risk/parameters
```

#### Response
```json
{
  "success": true,
  "data": {
    "maxRiskPerTrade": 2.0,
    "maxDailyLoss": 6.0,
    "maxDrawdown": 20.0,
    "maxPositions": 5,
    "maxLeverage": 100,
    "minStopLossDistance": 10,
    "maxLotSize": 10.0,
    "correlationLimit": 0.7,
    "sectorExposureLimit": 30.0,
    "currencyExposureLimit": 50.0
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. Update Risk Parameters

Update risk parameters for a user (admin only).

```http
PUT /api/v1/risk/parameters
```

#### Request Body
```json
{
  "maxRiskPerTrade": 2.0,
  "maxDailyLoss": 6.0,
  "maxDrawdown": 20.0,
  "maxPositions": 5,
  "maxLeverage": 100,
  "minStopLossDistance": 10,
  "maxLotSize": 10.0,
  "correlationLimit": 0.7,
  "sectorExposureLimit": 30.0,
  "currencyExposureLimit": 50.0
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "risk_params_123",
    "userId": "user_456",
    "parameters": { /* updated parameters */ },
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 3. Calculate Position Size

Calculate the safe position size based on risk parameters.

```http
POST /api/v1/risk/calculate-position-size
```

#### Request Body
```json
{
  "balance": 10000,
  "riskPercent": 2.0,
  "stopLossPips": 20,
  "symbol": "EURUSD",
  "accountCurrency": "USD"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "positionSize": 0.1,
    "riskAmount": 20.0,
    "pipValue": 1.0,
    "marginRequired": 100.0,
    "maxPositionSize": 1.0,
    "recommendedSize": 0.1
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 4. Validate Trade

Validate a trade before execution.

```http
POST /api/v1/risk/validate-trade
```

#### Request Body
```json
{
  "symbol": "EURUSD",
  "action": "BUY",
  "volume": 0.1,
  "stopLoss": 1.0800,
  "takeProfit": 1.0900,
  "price": 1.0850,
  "strategyId": "strategy_123"
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
      "Position size is below recommended minimum"
    ],
    "adjustedParams": {
      "volume": 0.1,
      "stopLoss": 1.0800,
      "takeProfit": 1.0900
    },
    "riskMetrics": {
      "riskAmount": 20.0,
      "riskPercent": 2.0,
      "marginRequired": 100.0,
      "potentialReward": 100.0,
      "riskRewardRatio": 1.0
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 5. Check Position Opening Permission

Check if a user can open a new position.

```http
GET /api/v1/risk/can-open-position
```

#### Query Parameters
- `symbol` (string): Trading symbol
- `volume` (number): Position size

#### Response
```json
{
  "success": true,
  "data": {
    "canOpen": true,
    "reason": null,
    "currentPositions": 2,
    "maxPositions": 5,
    "dailyLoss": 50.0,
    "maxDailyLoss": 600.0,
    "currentDrawdown": 5.0,
    "maxDrawdown": 20.0
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 6. Get Risk Exposure

Get current risk exposure for a user.

```http
GET /api/v1/risk/exposure
```

#### Response
```json
{
  "success": true,
  "data": {
    "totalExposure": 5000.0,
    "totalRisk": 100.0,
    "riskPercent": 1.0,
    "positions": [
      {
        "symbol": "EURUSD",
        "volume": 0.1,
        "exposure": 10850.0,
        "risk": 20.0,
        "riskPercent": 0.2
      }
    ],
    "currencyExposure": {
      "USD": 5000.0,
      "EUR": 4500.0,
      "GBP": 3000.0
    },
    "sectorExposure": {
      "Forex": 100.0,
      "Commodities": 0.0,
      "Indices": 0.0
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 7. Emergency Close All

Emergency close all positions for a user (admin only).

```http
POST /api/v1/risk/emergency-close-all
```

#### Request Body
```json
{
  "userId": "user_456",
  "reason": "Maximum drawdown exceeded"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "closedPositions": 3,
    "totalPnL": -250.0,
    "executionTime": 1500,
    "positions": [
      {
        "ticket": 12345,
        "symbol": "EURUSD",
        "volume": 0.1,
        "closePrice": 1.0820,
        "pnl": -30.0
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 8. Get Risk Alerts

Get current risk alerts for a user.

```http
GET /api/v1/risk/alerts
```

#### Response
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "alert_123",
        "type": "WARNING",
        "message": "Daily loss approaching limit",
        "threshold": 80,
        "current": 75,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "acknowledged": false
      }
    ],
    "totalCount": 1,
    "unacknowledgedCount": 1
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 9. Acknowledge Risk Alert

Acknowledge a risk alert.

```http
POST /api/v1/risk/alerts/{alertId}/acknowledge
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "alert_123",
    "acknowledged": true,
    "acknowledgedAt": "2024-01-01T00:00:00.000Z",
    "acknowledgedBy": "user_456"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 10. Get Risk History

Get risk assessment history.

```http
GET /api/v1/risk/history
```

#### Query Parameters
- `from` (string): Start date (ISO 8601)
- `to` (string): End date (ISO 8601)
- `page` (number): Page number
- `limit` (number): Items per page

#### Response
```json
{
  "success": true,
  "data": {
    "assessments": [
      {
        "id": "assessment_123",
        "timestamp": "2024-01-01T00:00:00.000Z",
        "type": "TRADE_VALIDATION",
        "result": "APPROVED",
        "riskScore": 2.5,
        "details": {
          "symbol": "EURUSD",
          "volume": 0.1,
          "riskAmount": 20.0
        }
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

## Data Models

### RiskParameters
```typescript
interface RiskParameters {
  maxRiskPerTrade: number;      // Maximum risk per trade (% of balance)
  maxDailyLoss: number;          // Maximum daily loss (% of balance)
  maxDrawdown: number;           // Maximum drawdown (% of balance)
  maxPositions: number;          // Maximum concurrent positions
  maxLeverage: number;           // Maximum leverage (1:X)
  minStopLossDistance: number;   // Minimum stop loss distance (pips)
  maxLotSize: number;            // Maximum position size (lots)
  correlationLimit: number;      // Maximum correlation between positions
  sectorExposureLimit: number;   // Maximum sector exposure (%)
  currencyExposureLimit: number; // Maximum currency exposure (%)
}
```

### TradeValidationRequest
```typescript
interface TradeValidationRequest {
  symbol: string;
  action: 'BUY' | 'SELL';
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
  price?: number;
  strategyId?: string;
}
```

### TradeValidationResponse
```typescript
interface TradeValidationResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
  adjustedParams?: Partial<TradeValidationRequest>;
  riskMetrics: {
    riskAmount: number;
    riskPercent: number;
    marginRequired: number;
    potentialReward: number;
    riskRewardRatio: number;
  };
}
```

### RiskExposure
```typescript
interface RiskExposure {
  totalExposure: number;
  totalRisk: number;
  riskPercent: number;
  positions: PositionRisk[];
  currencyExposure: Record<string, number>;
  sectorExposure: Record<string, number>;
}
```

## Error Codes

| Error Code | Description |
|------------|-------------|
| `RISK_LIMIT_EXCEEDED` | Trade exceeds risk limits |
| `INSUFFICIENT_MARGIN` | Insufficient margin for trade |
| `MAX_POSITIONS_EXCEEDED` | Maximum number of positions exceeded |
| `DAILY_LOSS_EXCEEDED` | Daily loss limit exceeded |
| `DRAWDOWN_EXCEEDED` | Maximum drawdown exceeded |
| `INVALID_RISK_PARAMETERS` | Invalid risk parameters |
| `CORRELATION_TOO_HIGH` | Position correlation too high |
| `EXPOSURE_LIMIT_EXCEEDED` | Exposure limit exceeded |

## Rate Limits

| Endpoint | Requests per Minute |
|----------|---------------------|
| Calculate Position Size | 30 |
| Validate Trade | 50 |
| Get Risk Exposure | 30 |
| Emergency Close All | 5 |

## SDK Examples

### JavaScript/TypeScript
```typescript
import { RiskManagementAPI } from 'fx-platform-sdk';

const riskAPI = new RiskManagementAPI(client);

// Calculate position size
const positionSize = await riskAPI.calculatePositionSize({
  balance: 10000,
  riskPercent: 2.0,
  stopLossPips: 20,
  symbol: 'EURUSD'
});

// Validate trade
const validation = await riskAPI.validateTrade({
  symbol: 'EURUSD',
  action: 'BUY',
  volume: 0.1,
  stopLoss: 1.0800,
  takeProfit: 1.0900
});
```

### Python
```python
from fx_platform import RiskManagementAPI

risk_api = RiskManagementAPI(client)

# Calculate position size
position_size = risk_api.calculate_position_size(
    balance=10000,
    risk_percent=2.0,
    stop_loss_pips=20,
    symbol='EURUSD'
)

# Validate trade
validation = risk_api.validate_trade(
    symbol='EURUSD',
    action='BUY',
    volume=0.1,
    stop_loss=1.0800,
    take_profit=1.0900
)
```

## Webhooks

Receive real-time risk alerts via webhooks:

```json
{
  "event": "risk.alert",
  "data": {
    "alertId": "alert_123",
    "type": "WARNING",
    "message": "Daily loss approaching limit",
    "userId": "user_456",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

---

**Last Updated**: January 2024  
**API Version**: v1.0.0