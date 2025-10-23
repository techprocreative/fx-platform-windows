# FX Platform API Endpoints Reference

This document provides comprehensive documentation for all API endpoints in the FX Trading Platform.

## Table of Contents

1. [Authentication](#authentication)
2. [Strategy Management](#strategy-management)
3. [Market Analysis](#market-analysis)
4. [Trading & Risk Management](#trading--risk-management)
5. [Analytics & Reporting](#analytics--reporting)
6. [Multi-Timeframe Analysis](#multi-timeframe-analysis)
7. [WebSocket Connections](#websocket-connections)
8. [Error Handling](#error-handling)
9. [Rate Limiting](#rate-limiting)

---

## Authentication

All API endpoints require authentication using NextAuth.js session cookies.

### Headers
```
Cookie: next-auth.session-token=<session_token>
```

### Response Format
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": { ... },
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## Strategy Management

### Strategy Creation & Analysis

#### POST /api/strategy/analyze-market
Analyzes market conditions for AI strategy generation.

**Request Body:**
```json
{
  "symbol": "EURUSD",
  "timeframe": "H1",
  "strategyType": "day_trading",
  "timeframePreference": "medium_term",
  "riskTolerance": "moderate",
  "includeCorrelation": true,
  "includeRegime": true,
  "includeRecommendations": true,
  "lookbackDays": 90,
  "analysisDepth": "standard"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "EURUSD",
    "timeframe": "H1",
    "marketContext": { ... },
    "historicalData": { ... },
    "correlationAnalysis": { ... },
    "regimeAnalysis": { ... },
    "aiAnalysis": { ... },
    "strategyRecommendations": { ... }
  }
}
```

#### POST /api/strategy/optimize-exits
Optimizes exit levels for trading strategies.

**Request Body:**
```json
{
  "symbol": "EURUSD",
  "entryPrice": 1.0850,
  "tradeType": "BUY",
  "currentPrice": 1.0875,
  "atr": 0.0015,
  "optimizationType": "advanced",
  "riskTolerance": "moderate",
  "includePartialExits": true,
  "includeRegimeAdjustment": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "EURUSD",
    "entryPrice": 1.0850,
    "optimizedExitRules": { ... },
    "exitCalculation": { ... },
    "partialExitOptimization": { ... },
    "riskValidation": { ... },
    "summary": { ... }
  }
}
```

#### GET /api/strategy/score/:id
Calculates performance score for a strategy.

**Response:**
```json
{
  "success": true,
  "data": {
    "score": {
      "profitability": 75,
      "consistency": 80,
      "riskAdjusted": 70,
      "drawdown": 85,
      "overall": 77
    },
    "metrics": { ... }
  }
}
```

---

## Market Analysis

### Market Context & Regime Detection

#### POST /api/market/context
Provides comprehensive market context for strategy creation.

**Request Body:**
```json
{
  "symbol": "EURUSD",
  "timeframe": "H1",
  "atrPeriod": 14,
  "lookbackPeriods": 100,
  "includeAnalysis": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "marketContext": {
      "symbol": "EURUSD",
      "price": { ... },
      "volatility": { ... },
      "trend": { ... },
      "keyLevels": { ... },
      "session": { ... }
    },
    "analysis": { ... }
  }
}
```

#### GET /api/market/regime/[symbol]
Detects current market regime for a symbol.

**Query Parameters:**
- `timeframe`: Timeframe for analysis (default: H1)
- `lookbackDays`: Days of data to analyze (default: 30)
- `includeHistory`: Include regime history (default: false)
- `includeTransitions`: Include regime transitions (default: true)
- `includePredictions`: Include regime predictions (default: false)

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "EURUSD",
    "timeframe": "H1",
    "currentRegime": {
      "regime": "trending_up",
      "confidence": 85,
      "timestamp": "2024-01-01T00:00:00.000Z",
      "metadata": { ... }
    },
    "history": { ... },
    "transitions": { ... },
    "predictions": { ... },
    "recommendations": { ... }
  }
}
```

#### GET /api/market/correlation
Analyzes correlation between currency pairs.

**Query Parameters:**
- `action`: Analysis type (matrix, analyze, historical, recommendations, groups, validate)
- `symbols`: Symbols to analyze (for matrix action)
- `symbol`: Single symbol to analyze (for analyze action)
- `filter`: Correlation filter configuration (JSON string)

**Response:**
```json
{
  "success": true,
  "data": {
    "correlationMatrix": { ... },
    "analysis": { ... },
    "recommendedPairs": [ ... ]
  }
}
```

---

## Trading & Risk Management

### Position Sizing & Smart Exits

#### POST /api/trading/position-sizing
Calculates optimal position sizes based on various methods.

**Request Body:**
```json
{
  "accountBalance": 10000,
  "symbol": "EURUSD",
  "entryPrice": 1.0850,
  "tradeType": "BUY",
  "currentATR": 0.0015,
  "config": {
    "method": "percentage_risk",
    "percentageRisk": {
      "riskPercentage": 2,
      "maxRiskPerTrade": 200,
      "maxDailyRisk": 500
    },
    "maxPositionSize": 1.0,
    "minPositionSize": 0.01
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "positionSize": 0.15,
    "riskAmount": 150,
    "riskPercentage": 1.5,
    "stopLossPrice": 1.0835,
    "takeProfitPrice": 1.0880,
    "riskRewardRatio": 2.0,
    "confidence": 85
  }
}
```

#### POST /api/trading/smart-exits
Calculates smart exit levels based on market data and rules.

**Request Body:**
```json
{
  "entryPrice": 1.0850,
  "tradeType": "BUY",
  "atr": 0.0015,
  "swingPoints": [ ... ],
  "smartExitRules": {
    "stopLoss": {
      "type": "atr",
      "atrMultiplier": 2.0,
      "useSwingPoints": true
    },
    "takeProfit": {
      "type": "rr_ratio",
      "rrRatio": 2.0
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "exitCalculation": {
      "stopLoss": { ... },
      "takeProfit": { ... },
      "riskRewardRatio": 2.0
    },
    "riskValidation": { ... }
  }
}
```

---

## Analytics & Reporting

### Performance Analytics

#### GET /api/analytics/performance
Gets performance analytics for strategies and trades.

**Query Parameters:**
- `timeFrame`: Analysis period (1D, 1W, 1M, 3M, 6M, 1Y, ALL)
- `strategies`: Strategy IDs to analyze
- `symbols`: Currency symbols to analyze

**Response:**
```json
{
  "success": true,
  "data": {
    "metrics": {
      "totalTrades": 150,
      "winRate": 65,
      "totalProfit": 2500,
      "maxDrawdown": 5.2,
      "sharpeRatio": 1.8
    },
    "equityCurve": [ ... ],
    "monthlyData": [ ... ]
  }
}
```

#### GET /api/analytics/comparison
Compares performance between strategies or timeframes.

**Response:**
```json
{
  "success": true,
  "data": {
    "comparison": {
      "items": [ ... ],
      "metrics": [ ... ],
      "results": [ ... ]
    }
  }
}
```

---

## Multi-Timeframe Analysis

### MTF Strategy Analysis

#### POST /api/mtf/analysis
Performs multi-timeframe analysis for MTF strategies.

**Request Body:**
```json
{
  "strategy": {
    "id": "mtf_strategy_1",
    "symbol": "EURUSD",
    "primaryTimeframe": "H1",
    "confirmationTimeframes": ["H4", "D1"],
    "rules": { ... }
  },
  "dateRange": {
    "from": "2024-01-01",
    "to": "2024-01-31"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analysis": {
      "primarySignal": true,
      "confirmations": [ ... ],
      "overallSignal": true,
      "confidence": 85
    },
    "latestData": { ... },
    "summary": { ... }
  }
}
```

#### POST /api/mtf/backtest
Runs backtest for multi-timeframe strategies.

**Request Body:**
```json
{
  "strategy": { ... },
  "dateRange": { ... },
  "initialBalance": 10000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "backtestId": "bt_123456",
    "status": "completed",
    "initialBalance": 10000,
    "finalBalance": 11500,
    "totalReturn": 15.0,
    "trades": [ ... ],
    "equityCurve": [ ... ]
  }
}
```

---

## WebSocket Connections

### Real-time Data

#### GET /api/ws
WebSocket endpoint for real-time market data and trade updates.

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:3000/api/ws');
```

**Message Format:**
```json
{
  "type": "market_data",
  "data": {
    "symbol": "EURUSD",
    "bid": 1.0845,
    "ask": 1.0847,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## Error Handling

### Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| UNAUTHORIZED | Authentication required | 401 |
| FORBIDDEN | Access forbidden | 403 |
| VALIDATION_ERROR | Invalid request data | 400 |
| INVALID_REQUEST | Invalid request format | 400 |
| MISSING_PARAMETERS | Required parameters missing | 400 |
| INVALID_SYMBOL | Invalid trading symbol | 400 |
| NO_DATA | No data available | 404 |
| MARKET_DATA_ERROR | Failed to retrieve market data | 500 |
| EXTERNAL_SERVICE_ERROR | External service error | 502 |
| DETECTION_ERROR | Analysis detection failed | 500 |
| CALCULATION_ERROR | Calculation failed | 500 |
| INTERNAL_ERROR | Internal server error | 500 |
| RATE_LIMIT_EXCEEDED | Rate limit exceeded | 429 |
| SERVICE_UNAVAILABLE | Service unavailable | 503 |

### Error Response Example
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "errors": [
        {
          "field": "symbol",
          "message": "Invalid symbol format",
          "code": "invalid_string"
        }
      ]
    },
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## Rate Limiting

### Rate Limit Headers

All API responses include rate limiting headers:

- `X-RateLimit-Limit`: Maximum requests per time window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when rate limit resets

### Rate Limit Configurations

| Endpoint Type | Requests/Minute | Window |
|---------------|-----------------|--------|
| Sensitive (Auth, Admin) | 10 | 1 minute |
| Standard (Most APIs) | 60 | 1 minute |
| Data (Market data) | 120 | 1 minute |
| Public (Docs, Status) | 300 | 1 minute |

### Rate Limit Exceeded Response
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded",
    "details": {
      "resetTime": "2024-01-01T00:01:00.000Z"
    }
  }
}
```

---

## SDK & Integration Examples

### JavaScript/TypeScript Example

```typescript
// Market Analysis
const marketAnalysis = await fetch('/api/strategy/analyze-market', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': 'next-auth.session-token=<token>'
  },
  body: JSON.stringify({
    symbol: 'EURUSD',
    timeframe: 'H1',
    strategyType: 'day_trading',
    riskTolerance: 'moderate'
  })
});

const result = await marketAnalysis.json();
if (result.success) {
  console.log('Market analysis:', result.data);
} else {
  console.error('Error:', result.error);
}
```

### Python Example

```python
import requests

# Get market regime
response = requests.get(
    'https://api.fxplatform.com/api/market/regime/EURUSD',
    params={
        'timeframe': 'H1',
        'lookbackDays': 30,
        'includeHistory': True
    },
    cookies={
        'next-auth.session-token': '<token>'
    }
)

if response.status_code == 200:
    data = response.json()
    if data['success']:
        print(f"Current regime: {data['data']['currentRegime']['regime']}")
    else:
        print(f"Error: {data['error']['message']}")
```

---

## Best Practices

1. **Authentication**: Always include valid session cookies
2. **Error Handling**: Implement proper error handling for all error codes
3. **Rate Limiting**: Respect rate limits and implement backoff strategies
4. **Data Validation**: Validate request parameters before sending
5. **Caching**: Cache responses where appropriate to reduce API calls
6. **WebSocket**: Use WebSocket connections for real-time data instead of polling

---

## Support & Contact

For API support and questions:
- Documentation: https://docs.fxplatform.com
- Support: api-support@fxplatform.com
- Status: https://status.fxplatform.com

---

*Last Updated: January 2024*
*Version: 1.0.0*