# API Specification - NexusTrade Platform

## Base Information

**Base URL:** `https://api.nexustrade.com`  
**Version:** `v1`  
**Protocol:** `HTTPS only`  
**Format:** `JSON`  
**Authentication:** `Bearer Token (JWT)`

## Authentication

### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+6281234567890",
  "referralCode": "FRIEND123" // optional
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "userId": "usr_2KjL9mNpQr",
    "email": "user@example.com",
    "verificationRequired": true
  }
}
```

### POST /api/auth/login
Authenticate user and receive tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "twoFactorCode": "123456" // optional, if 2FA enabled
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "rft_9kL3mNpQrSt...",
    "expiresIn": 900,
    "user": {
      "id": "usr_2KjL9mNpQr",
      "email": "user@example.com",
      "subscriptionTier": "professional",
      "isActive": true
    }
  }
}
```

### POST /api/auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "rft_9kL3mNpQrSt..."
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}
```

### POST /api/auth/logout
Invalidate refresh token and logout.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## User Management

### GET /api/user/profile
Get current user profile.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "usr_2KjL9mNpQr",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+6281234567890",
    "createdAt": "2024-01-15T10:00:00Z",
    "subscription": {
      "tier": "professional",
      "status": "active",
      "expiresAt": "2024-02-15T10:00:00Z",
      "features": {
        "maxStrategies": 10,
        "maxBacktests": 100,
        "aiSupervision": true,
        "mobileApp": true
      }
    },
    "stats": {
      "totalTrades": 1543,
      "winRate": 0.68,
      "totalProfit": 15234.50,
      "activeStrategies": 3
    }
  }
}
```

### PUT /api/user/profile
Update user profile.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phoneNumber": "+6289876543210",
  "preferences": {
    "notifications": {
      "email": true,
      "push": false,
      "sms": true
    },
    "timezone": "Asia/Jakarta",
    "language": "id"
  }
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Profile updated successfully"
}
```

## Strategy Management

### POST /api/strategy/create
Create a new trading strategy.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Request Body:**
```json
{
  "name": "MACD Gold Strategy",
  "description": "Gold trading with MACD crossover",
  "symbol": "XAUUSD",
  "timeframe": "H1",
  "type": "manual", // or "ai_generated"
  "rules": {
    "entry": {
      "conditions": [
        {
          "indicator": "MACD",
          "condition": "crosses_above",
          "value": 0
        },
        {
          "indicator": "ADX",
          "condition": "greater_than",
          "value": 25
        }
      ],
      "logic": "AND"
    },
    "exit": {
      "takeProfit": {
        "type": "pips",
        "value": 50
      },
      "stopLoss": {
        "type": "pips",
        "value": 25
      },
      "trailing": {
        "enabled": true,
        "distance": 10
      }
    },
    "riskManagement": {
      "lotSize": 0.1,
      "maxPositions": 3,
      "maxDailyLoss": 100
    }
  }
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "strategyId": "stg_7kM9pQrSt",
    "name": "MACD Gold Strategy",
    "status": "draft",
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

### POST /api/strategy/generate
Generate strategy using AI from natural language.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Request Body:**
```json
{
  "prompt": "Create a strategy for EURUSD that buys when RSI is oversold below 30 and price is above 200 EMA. Use 1:2 risk reward ratio with 20 pip stop loss.",
  "symbol": "EURUSD",
  "timeframe": "H4",
  "riskProfile": "moderate" // low, moderate, aggressive
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "strategyId": "stg_8nP3qRtUv",
    "name": "AI Generated RSI-EMA Strategy",
    "generatedRules": {
      "entry": {
        "conditions": [
          {
            "indicator": "RSI",
            "period": 14,
            "condition": "less_than",
            "value": 30
          },
          {
            "indicator": "EMA",
            "period": 200,
            "condition": "price_above"
          }
        ],
        "logic": "AND"
      },
      "exit": {
        "takeProfit": {
          "type": "pips",
          "value": 40
        },
        "stopLoss": {
          "type": "pips",
          "value": 20
        }
      }
    },
    "aiExplanation": "This strategy combines oversold conditions with trend confirmation...",
    "estimatedWinRate": 0.65,
    "recommendedSettings": {
      "lotSize": 0.01,
      "maxPositions": 2
    }
  }
}
```

### GET /api/strategy/list
Get all strategies for current user.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- `status`: draft, active, paused, archived
- `symbol`: Trading symbol filter
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "strategies": [
      {
        "id": "stg_7kM9pQrSt",
        "name": "MACD Gold Strategy",
        "symbol": "XAUUSD",
        "timeframe": "H1",
        "status": "active",
        "performance": {
          "totalTrades": 234,
          "winRate": 0.72,
          "profitFactor": 2.1,
          "totalProfit": 3450.50
        },
        "createdAt": "2024-01-15T10:00:00Z",
        "lastExecuted": "2024-01-20T14:30:00Z"
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "pages": 1
    }
  }
}
```

### GET /api/strategy/{strategyId}
Get detailed strategy information.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "stg_7kM9pQrSt",
    "name": "MACD Gold Strategy",
    "description": "Gold trading with MACD crossover",
    "symbol": "XAUUSD",
    "timeframe": "H1",
    "status": "active",
    "version": 3,
    "rules": { /* Full rules object */ },
    "performance": {
      "totalTrades": 234,
      "winningTrades": 168,
      "losingTrades": 66,
      "winRate": 0.72,
      "avgWin": 45.20,
      "avgLoss": 22.10,
      "profitFactor": 2.1,
      "totalProfit": 3450.50,
      "maxDrawdown": 450.00,
      "sharpeRatio": 1.8,
      "monthlyReturns": [
        {"month": "2024-01", "return": 1250.50},
        {"month": "2023-12", "return": 980.00}
      ]
    },
    "recentTrades": [
      {
        "id": "trd_9mN4pRsT",
        "openTime": "2024-01-20T10:15:00Z",
        "closeTime": "2024-01-20T14:30:00Z",
        "type": "BUY",
        "lots": 0.1,
        "openPrice": 2024.50,
        "closePrice": 2029.30,
        "profit": 48.00
      }
    ],
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-18T09:00:00Z"
  }
}
```

### PUT /api/strategy/{strategyId}
Update strategy configuration.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Request Body:**
```json
{
  "name": "Updated MACD Strategy",
  "status": "paused",
  "rules": { /* Updated rules */ }
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Strategy updated successfully",
  "data": {
    "strategyId": "stg_7kM9pQrSt",
    "version": 4
  }
}
```

### DELETE /api/strategy/{strategyId}
Delete a strategy (archives it).

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Strategy archived successfully"
}
```

## Backtesting

### POST /api/backtest/run
Run backtest for a strategy.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Request Body:**
```json
{
  "strategyId": "stg_7kM9pQrSt",
  "dateRange": {
    "from": "2023-01-01",
    "to": "2023-12-31"
  },
  "initialBalance": 10000,
  "settings": {
    "spread": 2,
    "commission": 7,
    "slippage": 1,
    "includeSwap": true
  }
}
```

**Response:** `202 Accepted`
```json
{
  "success": true,
  "data": {
    "backtestId": "bkt_3pQ9rStU",
    "status": "queued",
    "estimatedTime": 30
  }
}
```

### GET /api/backtest/{backtestId}/status
Get backtest execution status.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "backtestId": "bkt_3pQ9rStU",
    "status": "completed", // queued, running, completed, failed
    "progress": 100,
    "completedAt": "2024-01-20T10:45:00Z"
  }
}
```

### GET /api/backtest/{backtestId}/results
Get backtest results.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "backtestId": "bkt_3pQ9rStU",
    "strategyId": "stg_7kM9pQrSt",
    "period": {
      "from": "2023-01-01",
      "to": "2023-12-31"
    },
    "statistics": {
      "initialBalance": 10000,
      "finalBalance": 14523.45,
      "totalReturn": 0.4523,
      "annualizedReturn": 0.4523,
      "totalTrades": 523,
      "winningTrades": 341,
      "losingTrades": 182,
      "winRate": 0.652,
      "profitFactor": 1.89,
      "expectancy": 8.73,
      "avgWin": 42.30,
      "avgLoss": 22.45,
      "maxWin": 125.60,
      "maxLoss": 48.90,
      "avgTradeDuration": "4h 23m",
      "maxDrawdown": 823.45,
      "maxDrawdownPercent": 0.0823,
      "sharpeRatio": 1.65,
      "sortinoRatio": 2.12,
      "calmarRatio": 5.49
    },
    "equityCurve": [
      {"date": "2023-01-01", "balance": 10000},
      {"date": "2023-01-15", "balance": 10234},
      // ... more data points
    ],
    "monthlyBreakdown": [
      {"month": "2023-01", "trades": 42, "profit": 234.50, "return": 0.0234},
      // ... more months
    ],
    "trades": [
      {
        "id": 1,
        "openTime": "2023-01-02T09:15:00Z",
        "closeTime": "2023-01-02T13:45:00Z",
        "type": "BUY",
        "lots": 0.1,
        "openPrice": 1.0832,
        "closePrice": 1.0845,
        "profit": 13.00,
        "pips": 13
      }
      // ... more trades
    ]
  }
}
```

## AI Supervision

### POST /api/ai/supervise
Get AI supervision recommendation for a trade.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Request Body:**
```json
{
  "strategyId": "stg_7kM9pQrSt",
  "signal": "BUY",
  "marketConditions": {
    "symbol": "EURUSD",
    "currentPrice": 1.0850,
    "spread": 1.2,
    "indicators": {
      "RSI": 45,
      "MACD": 0.0012,
      "ATR": 0.0065
    },
    "recentNews": [
      {
        "time": "2024-01-20T08:00:00Z",
        "impact": "HIGH",
        "title": "ECB Rate Decision"
      }
    ]
  },
  "accountState": {
    "balance": 10000,
    "equity": 10250,
    "margin": 250,
    "openPositions": 2,
    "dailyPL": 45.20
  }
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "recommendation": "PROCEED", // PROCEED, WAIT, CANCEL
    "confidence": 0.85,
    "reasoning": "Market conditions are favorable. RSI shows room for upward movement, no major news conflicts detected.",
    "riskAssessment": {
      "level": "LOW",
      "factors": [
        "Low volatility environment",
        "Positive trend alignment",
        "Adequate margin available"
      ]
    },
    "suggestions": {
      "lotSize": 0.08,
      "stopLoss": 25,
      "takeProfit": 50,
      "notes": "Consider tightening stop loss if volatility increases"
    }
  }
}
```

## Executor Management

### POST /api/executor/register
Register a new executor instance.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Request Body:**
```json
{
  "name": "Desktop PC - Main",
  "platform": "MT5",
  "brokerServer": "ICMarkets-Demo",
  "accountNumber": "50123456"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "executorId": "exc_5mN8pQrT",
    "apiKey": "ak_7j9KmNpQrStUvWxYz",
    "apiSecret": "as_9kL3mNpQrStUvWxYzAbCdEf"
  }
}
```

### GET /api/executor/list
Get all registered executors.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "executors": [
      {
        "id": "exc_5mN8pQrT",
        "name": "Desktop PC - Main",
        "platform": "MT5",
        "status": "online",
        "lastHeartbeat": "2024-01-20T10:45:30Z",
        "statistics": {
          "uptime": "48h 23m",
          "executedTrades": 145,
          "avgLatency": 23
        }
      }
    ]
  }
}
```

### POST /api/executor/heartbeat
Send heartbeat from executor.

**Headers:**
```
X-API-Key: ak_7j9KmNpQrStUvWxYz
X-API-Secret: as_9kL3mNpQrStUvWxYzAbCdEf
```

**Request Body:**
```json
{
  "executorId": "exc_5mN8pQrT",
  "status": "running",
  "systemInfo": {
    "cpuUsage": 23,
    "memoryUsage": 45,
    "networkLatency": 12
  },
  "tradingInfo": {
    "balance": 10250.45,
    "equity": 10280.20,
    "openPositions": 3,
    "connectionStatus": "connected"
  }
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "serverTime": "2024-01-20T10:45:30Z",
    "nextHeartbeat": 30
  }
}
```

## Commands & Remote Control

### POST /api/command/send
Send command to executor.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Request Body:**
```json
{
  "executorId": "exc_5mN8pQrT",
  "command": "STOP_ALL", // STOP_ALL, CLOSE_ALL, PAUSE, RESUME, UPDATE_STRATEGY
  "parameters": {
    "reason": "Manual intervention",
    "closePositions": true
  },
  "priority": "HIGH" // LOW, NORMAL, HIGH, URGENT
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "commandId": "cmd_8pQ3rStU",
    "status": "queued",
    "estimatedDelivery": "2024-01-20T10:46:00Z"
  }
}
```

### GET /api/command/pending
Get pending commands for executor.

**Headers:**
```
X-API-Key: ak_7j9KmNpQrStUvWxYz
X-API-Secret: as_9kL3mNpQrStUvWxYzAbCdEf
```

**Query Parameters:**
- `executorId`: Executor ID
- `limit`: Max commands to return (default: 10)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "commands": [
      {
        "id": "cmd_8pQ3rStU",
        "command": "STOP_ALL",
        "parameters": {
          "reason": "Manual intervention",
          "closePositions": true
        },
        "priority": "HIGH",
        "createdAt": "2024-01-20T10:45:00Z"
      }
    ]
  }
}
```

### POST /api/command/acknowledge
Acknowledge command execution.

**Headers:**
```
X-API-Key: ak_7j9KmNpQrStUvWxYz
X-API-Secret: as_9kL3mNpQrStUvWxYzAbCdEf
```

**Request Body:**
```json
{
  "commandId": "cmd_8pQ3rStU",
  "status": "completed", // completed, failed
  "result": {
    "success": true,
    "message": "All positions closed successfully",
    "closedPositions": 3,
    "totalPL": -45.20
  }
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Command acknowledged"
}
```

## Trading Reports

### POST /api/report/trade
Report trade execution.

**Headers:**
```
X-API-Key: ak_7j9KmNpQrStUvWxYz
X-API-Secret: as_9kL3mNpQrStUvWxYzAbCdEf
```

**Request Body:**
```json
{
  "executorId": "exc_5mN8pQrT",
  "strategyId": "stg_7kM9pQrSt",
  "trade": {
    "ticket": "123456789",
    "symbol": "EURUSD",
    "type": "BUY",
    "lots": 0.1,
    "openTime": "2024-01-20T10:15:00Z",
    "openPrice": 1.0850,
    "closeTime": "2024-01-20T14:30:00Z",
    "closePrice": 1.0865,
    "profit": 15.00,
    "commission": -7.00,
    "swap": -0.50,
    "netProfit": 7.50,
    "stopLoss": 1.0825,
    "takeProfit": 1.0875,
    "magicNumber": 12345,
    "comment": "Strategy execution"
  }
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "tradeId": "trd_9mN4pRsT",
    "recorded": true
  }
}
```

### GET /api/report/performance
Get performance report.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- `strategyId`: Filter by strategy (optional)
- `executorId`: Filter by executor (optional)
- `from`: Start date (YYYY-MM-DD)
- `to`: End date (YYYY-MM-DD)
- `groupBy`: day, week, month

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "period": {
      "from": "2024-01-01",
      "to": "2024-01-20"
    },
    "summary": {
      "totalTrades": 145,
      "winningTrades": 98,
      "losingTrades": 47,
      "winRate": 0.676,
      "grossProfit": 2450.30,
      "grossLoss": -1123.45,
      "netProfit": 1326.85,
      "profitFactor": 2.18,
      "expectancy": 9.15,
      "maxDrawdown": 234.50,
      "returnOnInvestment": 0.1327
    },
    "daily": [
      {
        "date": "2024-01-20",
        "trades": 8,
        "profit": 125.40,
        "winRate": 0.75
      }
      // ... more days
    ],
    "byStrategy": [
      {
        "strategyId": "stg_7kM9pQrSt",
        "name": "MACD Gold Strategy",
        "trades": 67,
        "profit": 823.45,
        "winRate": 0.701
      }
      // ... more strategies
    ]
  }
}
```

## Subscription & Billing

### GET /api/billing/plans
Get available subscription plans.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "id": "plan_basic",
        "name": "Basic",
        "price": 29.99,
        "currency": "USD",
        "interval": "monthly",
        "features": {
          "maxStrategies": 3,
          "maxBacktests": 20,
          "aiSupervision": false,
          "mobileApp": false,
          "support": "email"
        }
      },
      {
        "id": "plan_professional",
        "name": "Professional",
        "price": 99.99,
        "currency": "USD",
        "interval": "monthly",
        "features": {
          "maxStrategies": 10,
          "maxBacktests": 100,
          "aiSupervision": true,
          "mobileApp": true,
          "support": "priority"
        }
      },
      {
        "id": "plan_enterprise",
        "name": "Enterprise",
        "price": 299.99,
        "currency": "USD",
        "interval": "monthly",
        "features": {
          "maxStrategies": "unlimited",
          "maxBacktests": "unlimited",
          "aiSupervision": true,
          "mobileApp": true,
          "support": "dedicated",
          "customIntegration": true
        }
      }
    ]
  }
}
```

### POST /api/billing/subscribe
Create subscription.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Request Body:**
```json
{
  "planId": "plan_professional",
  "paymentMethod": "stripe", // stripe, midtrans
  "paymentToken": "tok_visa" // from Stripe.js or payment gateway
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_8kN3pQrT",
    "status": "active",
    "currentPeriodEnd": "2024-02-20T10:00:00Z",
    "paymentStatus": "succeeded"
  }
}
```

## WebSocket Events

### Connection
```javascript
const ws = new WebSocket('wss://api.nexustrade.com/ws');
ws.send(JSON.stringify({
  type: 'auth',
  token: 'eyJhbGciOiJIUzI1NiIs...'
}));
```

### Subscribe to Events
```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: ['trades', 'commands', 'alerts']
}));
```

### Event Types

**Trade Execution:**
```json
{
  "type": "trade",
  "data": {
    "executorId": "exc_5mN8pQrT",
    "strategyId": "stg_7kM9pQrSt",
    "action": "opened", // opened, closed, modified
    "trade": { /* trade details */ }
  }
}
```

**Command Update:**
```json
{
  "type": "command",
  "data": {
    "commandId": "cmd_8pQ3rStU",
    "status": "executed",
    "result": { /* execution result */ }
  }
}
```

**System Alert:**
```json
{
  "type": "alert",
  "data": {
    "level": "warning", // info, warning, error, critical
    "message": "High drawdown detected",
    "strategyId": "stg_7kM9pQrSt",
    "timestamp": "2024-01-20T10:45:00Z"
  }
}
```

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "The provided credentials are invalid",
    "details": {
      "field": "password",
      "hint": "Password must be at least 8 characters"
    }
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INSUFFICIENT_CREDITS` | 402 | Subscription limit reached |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

## Rate Limiting

Rate limits are enforced per API key:

| Endpoint Category | Limit | Window |
|-------------------|-------|---------|
| Authentication | 5 requests | 1 minute |
| Strategy Generation | 10 requests | 1 hour |
| Backtesting | 50 requests | 1 hour |
| General API | 1000 requests | 1 minute |
| WebSocket Messages | 100 messages | 1 minute |

Rate limit information is included in response headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642680000
```

## Versioning

The API uses URL versioning. Current version is `v1`.

Breaking changes will result in a new version. Non-breaking changes may be added to the current version.

Deprecated endpoints will be marked with a `Deprecation` header and supported for at least 6 months.
