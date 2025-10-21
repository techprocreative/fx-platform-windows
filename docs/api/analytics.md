# Analytics API Documentation

## Overview

The Analytics API provides comprehensive performance analytics, reporting capabilities, and insights for trading strategies and overall portfolio performance. It offers detailed metrics, trend analysis, and customizable reports to help users evaluate and optimize their trading activities.

## Base URL

```
/api/v1/analytics
```

## Authentication

All endpoints require JWT authentication. See [API Overview](./README.md#authentication) for details.

## Analytics Categories

| Category | Description |
|----------|-------------|
| Performance Analytics | Trading performance metrics and statistics |
| Strategy Analytics | Strategy-specific performance analysis |
| Risk Analytics | Risk metrics and exposure analysis |
| Portfolio Analytics | Portfolio-level performance and composition |
| Market Analytics | Market condition analysis and correlation |
| Custom Reports | User-defined custom analytics reports |

## Endpoints

### 1. Get Performance Overview

Get overall trading performance overview.

```http
GET /api/v1/analytics/performance/overview
```

#### Query Parameters
- `period` (string): Time period (day, week, month, quarter, year)
- `from` (string): Start date (ISO 8601)
- `to` (string): End date (ISO 8601)

#### Response
```json
{
  "success": true,
  "data": {
    "period": "MONTH",
    "from": "2024-01-01T00:00:00.000Z",
    "to": "2024-01-31T23:59:59.999Z",
    "summary": {
      "totalTrades": 125,
      "winningTrades": 75,
      "losingTrades": 50,
      "winRate": 60.0,
      "totalProfit": 2500.0,
      "totalLoss": -1200.0,
      "netProfit": 1300.0,
      "profitFactor": 2.08,
      "averageWin": 33.33,
      "averageLoss": -24.0,
      "largestWin": 200.0,
      "largestLoss": -100.0,
      "averageRiskReward": 1.39,
      "sharpeRatio": 1.45,
      "sortinoRatio": 2.1,
      "maxDrawdown": 300.0,
      "maxDrawdownPercent": 5.2,
      "averageDrawdown": 50.0,
      "recoveryFactor": 4.33,
      "calmarRatio": 0.43,
      "totalCommission": 125.0,
      "totalSwap": 25.0,
      "netProfitAfterCosts": 1150.0
    },
    "monthlyComparison": {
      "currentMonth": {
        "netProfit": 1300.0,
        "winRate": 60.0,
        "maxDrawdown": 300.0
      },
      "previousMonth": {
        "netProfit": 1100.0,
        "winRate": 58.0,
        "maxDrawdown": 250.0
      },
      "change": {
        "netProfit": 18.18,
        "winRate": 3.45,
        "maxDrawdown": 20.0
      }
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. Get Strategy Performance

Get performance analytics for specific strategies.

```http
GET /api/v1/analytics/strategies/{strategyId}/performance
```

#### Query Parameters
- `period` (string): Time period (day, week, month, quarter, year)
- `from` (string): Start date (ISO 8601)
- `to` (string): End date (ISO 8601)
- `benchmark` (string): Benchmark symbol for comparison (optional)

#### Response
```json
{
  "success": true,
  "data": {
    "strategyId": "strategy_123",
    "strategyName": "EURUSD Scalper",
    "period": "MONTH",
    "performance": {
      "totalTrades": 50,
      "winRate": 65.0,
      "netProfit": 650.0,
      "profitFactor": 2.5,
      "sharpeRatio": 1.8,
      "maxDrawdown": 120.0,
      "averageWin": 25.0,
      "averageLoss": -15.0,
      "averageTradeDuration": 1800,
      "averageRiskReward": 1.67
    },
    "benchmark": {
      "symbol": "EURUSD",
      "return": 1.2,
      "volatility": 0.8,
      "sharpeRatio": 1.5
    },
    "comparison": {
      "alpha": 0.3,
      "beta": 0.8,
      "correlation": 0.65,
      "trackingError": 0.2,
      "informationRatio": 1.5
    },
    "bySymbol": [
      {
        "symbol": "EURUSD",
        "trades": 30,
        "winRate": 70.0,
        "netProfit": 400.0,
        "contribution": 61.5
      },
      {
        "symbol": "GBPUSD",
        "trades": 20,
        "winRate": 55.0,
        "netProfit": 250.0,
        "contribution": 38.5
      }
    ],
    "byTimeOfDay": [
      {
        "hour": "08:00",
        "trades": 10,
        "winRate": 80.0,
        "netProfit": 200.0
      },
      {
        "hour": "14:00",
        "trades": 8,
        "winRate": 62.5,
        "netProfit": 150.0
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 3. Get Risk Analytics

Get detailed risk analysis and metrics.

```http
GET /api/v1/analytics/risk/metrics
```

#### Query Parameters
- `period` (string): Time period (day, week, month, quarter, year)
- `from` (string): Start date (ISO 8601)
- `to` (string): End date (ISO 8601)
- `confidenceLevel` (number): Confidence level for VaR (default: 0.95)

#### Response
```json
{
  "success": true,
  "data": {
    "period": "MONTH",
    "riskMetrics": {
      "valueAtRisk": {
        "daily": {
          "var95": 150.0,
          "var99": 250.0,
          "cvar95": 200.0,
          "cvar99": 350.0
        },
        "monthly": {
          "var95": 800.0,
          "var99": 1200.0,
          "cvar95": 1000.0,
          "cvar99": 1500.0
        }
      },
      "volatility": {
        "daily": 1.2,
        "monthly": 5.5,
        "annualized": 19.0
      },
      "correlationMatrix": {
        "EURUSD": {
          "EURUSD": 1.0,
          "GBPUSD": 0.65,
          "USDJPY": -0.45
        },
        "GBPUSD": {
          "EURUSD": 0.65,
          "GBPUSD": 1.0,
          "USDJPY": -0.35
        }
      },
      "beta": {
        "EURUSD": 0.8,
        "GBPUSD": 1.1,
        "USDJPY": 0.6
      },
      "riskContribution": [
        {
          "symbol": "EURUSD",
          "contribution": 45.0,
          "percentage": 45.0
        },
        {
          "symbol": "GBPUSD",
          "contribution": 35.0,
          "percentage": 35.0
        }
      ]
    },
    "drawdownAnalysis": {
      "currentDrawdown": 50.0,
      "maxDrawdown": 300.0,
      "averageDrawdown": 80.0,
      "drawdownDuration": {
        "current": 5,
        "average": 10,
        "max": 30
      },
      "recoveryTime": {
        "average": 15,
        "max": 45
      }
    },
    "riskAdjustedReturns": {
      "sharpeRatio": 1.45,
      "sortinoRatio": 2.1,
      "calmarRatio": 0.43,
      "informationRatio": 0.8,
      "treynorRatio": 1.8
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 4. Get Portfolio Analytics

Get portfolio-level analytics and composition.

```http
GET /api/v1/analytics/portfolio/composition
```

#### Query Parameters
- `asOf` (string): As of date (ISO 8601, default: now)
- `groupBy` (string): Group by (symbol, sector, strategy, currency)

#### Response
```json
{
  "success": true,
  "data": {
    "asOf": "2024-01-01T00:00:00.000Z",
    "totalValue": 10000.0,
    "totalPnL": 1300.0,
    "totalReturn": 13.0,
    "composition": {
      "bySymbol": [
        {
          "symbol": "EURUSD",
          "value": 4000.0,
          "percentage": 40.0,
          "pnl": 500.0,
          "return": 12.5,
          "weight": 0.4
        },
        {
          "symbol": "GBPUSD",
          "value": 3000.0,
          "percentage": 30.0,
          "pnl": 400.0,
          "return": 13.3,
          "weight": 0.3
        }
      ],
      "byCurrency": [
        {
          "currency": "USD",
          "value": 7000.0,
          "percentage": 70.0,
          "pnl": 900.0
        },
        {
          "currency": "EUR",
          "value": 3000.0,
          "percentage": 30.0,
          "pnl": 400.0
        }
      ],
      "byStrategy": [
        {
          "strategyId": "strategy_123",
          "strategyName": "EURUSD Scalper",
          "value": 5000.0,
          "percentage": 50.0,
          "pnl": 650.0,
          "return": 13.0
        }
      ]
    },
    "diversification": {
      "effectiveNumberOfBets": 3.2,
      "concentrationRatio": 0.65,
      "herfindahlIndex": 0.28,
      "diversificationRatio": 1.5
    },
    "attribution": {
      "assetAllocation": 200.0,
      "securitySelection": 800.0,
      "interaction": 300.0,
      "total": 1300.0
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 5. Get Trade Analysis

Get detailed trade-level analysis.

```http
GET /api/v1/analytics/trades/analysis
```

#### Query Parameters
- `from` (string): Start date (ISO 8601)
- `to` (string): End date (ISO 8601)
- `symbol` (string): Filter by symbol (optional)
- `strategyId` (string): Filter by strategy (optional)
- `groupBy` (string): Group by (day, week, month, symbol, strategy)

#### Response
```json
{
  "success": true,
  "data": {
    "period": {
      "from": "2024-01-01T00:00:00.000Z",
      "to": "2024-01-31T23:59:59.999Z"
    },
    "tradeAnalysis": {
      "entryAnalysis": {
        "averageEntryPrice": 1.08500,
        "bestEntryPrice": 1.08200,
        "worstEntryPrice": 1.09000,
        "entryEfficiency": 65.0,
        "averageSlippage": 0.5
      },
      "exitAnalysis": {
        "averageExitPrice": 1.08700,
        "bestExitPrice": 1.09200,
        "worstExitPrice": 1.08000,
        "exitEfficiency": 70.0,
        "averageSlippage": 0.4
      },
      "durationAnalysis": {
        "averageDuration": 3600,
        "medianDuration": 2400,
        "shortestDuration": 300,
        "longestDuration": 14400,
        "profitableTradesDuration": 2400,
        "losingTradesDuration": 4800
      },
      "sizeAnalysis": {
        "averageSize": 0.1,
        "medianSize": 0.1,
        "minSize": 0.01,
        "maxSize": 0.5,
        "sizeDistribution": {
          "small": 60,
          "medium": 30,
          "large": 10
        }
      },
      "timingAnalysis": {
        "bestTradingHour": "14:00",
        "worstTradingHour": "22:00",
        "bestTradingDay": "Tuesday",
        "worstTradingDay": "Friday",
        "byHour": [
          {
            "hour": "08:00",
            "trades": 15,
            "winRate": 70.0,
            "averageProfit": 25.0
          }
        ]
      }
    },
    "patterns": [
      {
        "pattern": "MOMENTUM_CONTINUATION",
        "frequency": 25,
        "successRate": 70.0,
        "averageProfit": 30.0,
        "description": "Trades that continue in the direction of the initial move"
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 6. Generate Custom Report

Generate a custom analytics report.

```http
POST /api/v1/analytics/reports/generate
```

#### Request Body
```json
{
  "name": "Monthly Performance Report",
  "description": "Comprehensive monthly performance analysis",
  "template": "PERFORMANCE_OVERVIEW",
  "parameters": {
    "period": "MONTH",
    "from": "2024-01-01T00:00:00.000Z",
    "to": "2024-01-31T23:59:59.999Z",
    "includeCharts": true,
    "includeBenchmark": true,
    "benchmarkSymbol": "EURUSD",
    "confidenceLevel": 0.95
  },
  "sections": [
    "PERFORMANCE_SUMMARY",
    "RISK_ANALYSIS",
    "TRADE_ANALYSIS",
    "STRATEGY_BREAKDOWN",
    "PORTFOLIO_COMPOSITION"
  ],
  "format": "PDF",
  "delivery": {
    "type": "EMAIL",
    "recipients": ["user@example.com"],
    "subject": "Monthly Performance Report - January 2024"
  }
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "reportId": "report_123",
    "name": "Monthly Performance Report",
    "status": "GENERATING",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "estimatedCompletion": "2024-01-01T00:05:00.000Z",
    "format": "PDF",
    "delivery": {
      "type": "EMAIL",
      "recipients": ["user@example.com"]
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 7. Get Report Status

Check the status of a generated report.

```http
GET /api/v1/analytics/reports/{reportId}
```

#### Response
```json
{
  "success": true,
  "data": {
    "reportId": "report_123",
    "name": "Monthly Performance Report",
    "status": "COMPLETED",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "completedAt": "2024-01-01T00:04:30.000Z",
    "format": "PDF",
    "size": 2048576,
    "downloadUrl": "https://example.com/reports/report_123.pdf",
    "delivery": {
      "type": "EMAIL",
      "status": "DELIVERED",
      "deliveredAt": "2024-01-01T00:05:00.000Z",
      "recipients": ["user@example.com"]
    },
    "expiresAt": "2024-01-08T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 8. Get Market Correlation

Get market correlation analysis.

```http
GET /api/v1/analytics/market/correlation
```

#### Query Parameters
- `symbols` (array): List of symbols to analyze
- `period` (string): Time period (day, week, month, quarter, year)
- `method` (string): Correlation method (pearson, spearman, kendall)

#### Response
```json
{
  "success": true,
  "data": {
    "period": "MONTH",
    "method": "pearson",
    "symbols": ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD"],
    "correlationMatrix": {
      "EURUSD": {
        "EURUSD": 1.0,
        "GBPUSD": 0.65,
        "USDJPY": -0.45,
        "AUDUSD": 0.55
      },
      "GBPUSD": {
        "EURUSD": 0.65,
        "GBPUSD": 1.0,
        "USDJPY": -0.35,
        "AUDUSD": 0.45
      }
    },
    "eigenvalues": [2.1, 0.8, 0.6, 0.5],
    "eigenvectors": [
      {
        "vector": [0.5, 0.5, -0.5, 0.5],
        "explainedVariance": 52.5
      }
    ],
    "clusters": [
      {
        "name": "European Pairs",
        "symbols": ["EURUSD", "GBPUSD"],
        "correlation": 0.65
      },
      {
        "name": "Commodity Pairs",
        "symbols": ["AUDUSD"],
        "correlation": 0.55
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 9. Get Performance Attribution

Get performance attribution analysis.

```http
GET /api/v1/analytics/performance/attribution
```

#### Query Parameters
- `period` (string): Time period (day, week, month, quarter, year)
- `from` (string): Start date (ISO 8601)
- `to` (string): End date (ISO 8601)
- `benchmark` (string): Benchmark symbol (optional)

#### Response
```json
{
  "success": true,
  "data": {
    "period": "MONTH",
    "totalReturn": 13.0,
    "benchmarkReturn": 8.5,
    "activeReturn": 4.5,
    "attribution": {
      "assetAllocation": {
        "contribution": 2.0,
        "percentage": 44.4,
        "breakdown": [
          {
            "asset": "EURUSD",
            "allocation": 0.4,
            "benchmarkAllocation": 0.3,
            "return": 12.5,
            "contribution": 1.25
          }
        ]
      },
      "securitySelection": {
        "contribution": 1.8,
        "percentage": 40.0,
        "breakdown": [
          {
            "security": "EURUSD",
            "return": 12.5,
            "benchmarkReturn": 10.0,
            "contribution": 1.0
          }
        ]
      },
      "interaction": {
        "contribution": 0.7,
        "percentage": 15.6
      }
    },
    "riskAttribution": {
      "totalRisk": 15.0,
      "systematicRisk": 12.0,
      "idiosyncraticRisk": 3.0,
      "trackingError": 5.5,
      "informationRatio": 0.82
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 10. Get Rolling Returns

Get rolling returns analysis.

```http
GET /api/v1/analytics/performance/rolling-returns
```

#### Query Parameters
- `period` (string): Time period (day, week, month, quarter, year)
- `window` (number): Rolling window in days
- `from` (string): Start date (ISO 8601)
- `to` (string): End date (ISO 8601)

#### Response
```json
{
  "success": true,
  "data": {
    "period": "YEAR",
    "window": 30,
    "rollingReturns": [
      {
        "date": "2024-01-01T00:00:00.000Z",
        "return": 2.5,
        "annualized": 30.0,
        "volatility": 15.0,
        "sharpeRatio": 2.0
      }
    ],
    "statistics": {
      "averageReturn": 2.0,
      "medianReturn": 1.8,
      "standardDeviation": 1.5,
      "minReturn": -2.0,
      "maxReturn": 5.0,
      "skewness": 0.3,
      "kurtosis": 2.5,
      "winRate": 75.0
    },
    "percentiles": {
      "p5": -1.5,
      "p10": -1.0,
      "p25": 0.5,
      "p50": 1.8,
      "p75": 3.0,
      "p90": 4.0,
      "p95": 4.5
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Data Models

### PerformanceOverview
```typescript
interface PerformanceOverview {
  period: string;
  from: string;
  to: string;
  summary: {
    totalTrades: number;
    winRate: number;
    netProfit: number;
    profitFactor: number;
    sharpeRatio: number;
    maxDrawdown: number;
    // ... other metrics
  };
  monthlyComparison?: {
    currentMonth: PerformanceMetrics;
    previousMonth: PerformanceMetrics;
    change: PerformanceChange;
  };
}
```

### RiskMetrics
```typescript
interface RiskMetrics {
  valueAtRisk: {
    daily: VaRData;
    monthly: VaRData;
  };
  volatility: {
    daily: number;
    monthly: number;
    annualized: number;
  };
  correlationMatrix: Record<string, Record<string, number>>;
  beta: Record<string, number>;
  riskContribution: RiskContribution[];
}
```

### PortfolioComposition
```typescript
interface PortfolioComposition {
  asOf: string;
  totalValue: number;
  totalPnL: number;
  totalReturn: number;
  composition: {
    bySymbol: AssetAllocation[];
    byCurrency: CurrencyAllocation[];
    byStrategy: StrategyAllocation[];
  };
  diversification: DiversificationMetrics;
  attribution: AttributionData;
}
```

## Error Codes

| Error Code | Description |
|------------|-------------|
| `ANALYTICS_UNAVAILABLE` | Analytics service unavailable |
| `INVALID_TIME_RANGE` | Invalid time range specified |
| `INSUFFICIENT_DATA` | Insufficient data for analysis |
| `STRATEGY_NOT_FOUND` | Strategy not found |
| `REPORT_GENERATION_FAILED` | Report generation failed |
| `REPORT_NOT_FOUND` | Report not found |
| `INVALID_PARAMETERS` | Invalid analysis parameters |
| `CALCULATION_ERROR` | Error in calculations |

## Rate Limits

| Endpoint | Requests per Minute |
|----------|---------------------|
| Get Performance Overview | 20 |
| Get Strategy Performance | 30 |
| Get Risk Analytics | 20 |
| Get Portfolio Analytics | 20 |
| Get Trade Analysis | 20 |
| Generate Custom Report | 5 |
| Get Report Status | 30 |
| Get Market Correlation | 10 |
| Get Performance Attribution | 20 |
| Get Rolling Returns | 20 |

## SDK Examples

### JavaScript/TypeScript
```typescript
import { AnalyticsAPI } from 'fx-platform-sdk';

const analyticsAPI = new AnalyticsAPI(client);

// Get performance overview
const performance = await analyticsAPI.getPerformanceOverview({
  period: 'MONTH'
});

// Get strategy performance
const strategyPerf = await analyticsAPI.getStrategyPerformance('strategy_123', {
  period: 'MONTH',
  benchmark: 'EURUSD'
});

// Get risk metrics
const riskMetrics = await analyticsAPI.getRiskMetrics({
  period: 'MONTH',
  confidenceLevel: 0.95
});

// Generate custom report
const report = await analyticsAPI.generateReport({
  name: 'Monthly Performance Report',
  template: 'PERFORMANCE_OVERVIEW',
  parameters: {
    period: 'MONTH',
    includeCharts: true
  },
  format: 'PDF'
});
```

### Python
```python
from fx_platform import AnalyticsAPI

analytics_api = AnalyticsAPI(client)

# Get performance overview
performance = analytics_api.get_performance_overview(
    period='MONTH'
)

# Get strategy performance
strategy_perf = analytics_api.get_strategy_performance(
    'strategy_123',
    period='MONTH',
    benchmark='EURUSD'
)

# Get risk metrics
risk_metrics = analytics_api.get_risk_metrics(
    period='MONTH',
    confidence_level=0.95
)

# Generate custom report
report = analytics_api.generate_report(
    name='Monthly Performance Report',
    template='PERFORMANCE_OVERVIEW',
    parameters={
        'period': 'MONTH',
        'include_charts': True
    },
    format='PDF'
)
```

## Report Templates

| Template | Description | Sections |
|----------|-------------|----------|
| `PERFORMANCE_OVERVIEW` | Comprehensive performance analysis | Summary, Risk, Attribution |
| `STRATEGY_ANALYSIS` | Strategy-specific analysis | Performance, Risk, Comparison |
| `RISK_REPORT` | Detailed risk analysis | VaR, Drawdown, Correlation |
| `PORTFOLIO_REPORT` | Portfolio composition and analysis | Allocation, Diversification |
| `TRADE_ANALYSIS` | Trade-level analysis | Entry/Exit, Duration, Patterns |
| `CUSTOM` | User-defined report | Configurable |

---

**Last Updated**: January 2024  
**API Version**: v1.0.0