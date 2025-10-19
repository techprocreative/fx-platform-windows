# Monitoring API Documentation

## Overview

The Monitoring API provides comprehensive system monitoring capabilities, including real-time position tracking, performance metrics, anomaly detection, and alert management. It ensures system health and provides insights into trading performance and system behavior.

## Base URL

```
/api/v1/monitoring
```

## Authentication

All endpoints require JWT authentication. See [API Overview](./README.md#authentication) for details.

## Monitoring Components

| Component | Description |
|-----------|-------------|
| Position Monitor | Real-time position tracking and P&L calculation |
| Performance Monitor | System performance metrics and resource usage |
| Anomaly Detector | Detection of unusual patterns and behaviors |
| Alert Manager | Alert generation and management |
| Health Monitor | System health checks and status |

## Endpoints

### 1. Get System Health

Get overall system health status.

```http
GET /api/v1/monitoring/health
```

#### Response
```json
{
  "success": true,
  "data": {
    "status": "HEALTHY",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "uptime": 86400,
    "version": "1.0.0",
    "components": {
      "database": {
        "status": "HEALTHY",
        "responseTime": 15,
        "lastCheck": "2024-01-01T00:00:00.000Z"
      },
      "redis": {
        "status": "HEALTHY",
        "responseTime": 5,
        "lastCheck": "2024-01-01T00:00:00.000Z"
      },
      "broker": {
        "status": "HEALTHY",
        "connections": 1,
        "lastCheck": "2024-01-01T00:00:00.000Z"
      },
      "pusher": {
        "status": "HEALTHY",
        "connections": 5,
        "lastCheck": "2024-01-01T00:00:00.000Z"
      }
    },
    "metrics": {
      "cpuUsage": 25.5,
      "memoryUsage": 60.2,
      "diskUsage": 45.8,
      "networkLatency": 50
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. Get Active Positions

Get real-time position monitoring data.

```http
GET /api/v1/monitoring/positions
```

#### Query Parameters
- `connectionId` (string): Filter by connection ID (optional)
- `symbol` (string): Filter by symbol (optional)

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
        "openPrice": 1.08500,
        "currentPrice": 1.08600,
        "stopLoss": 1.08000,
        "takeProfit": 1.09000,
        "profit": 10.0,
        "unrealizedPnL": 10.0,
        "realizedPnL": 0.0,
        "margin": 100.0,
        "marginLevel": 10050.0,
        "duration": 3600,
        "riskLevel": "LOW",
        "alerts": [],
        "lastUpdate": "2024-01-01T00:00:00.000Z"
      }
    ],
    "summary": {
      "totalPositions": 1,
      "totalVolume": 0.1,
      "totalUnrealizedPnL": 10.0,
      "totalRealizedPnL": 0.0,
      "totalMargin": 100.0,
      "averageMarginLevel": 10050.0,
      "riskDistribution": {
        "LOW": 1,
        "MEDIUM": 0,
        "HIGH": 0,
        "CRITICAL": 0
      }
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 3. Get Performance Metrics

Get system performance metrics.

```http
GET /api/v1/monitoring/performance
```

#### Query Parameters
- `period` (string): Time period (1h, 24h, 7d, 30d)
- `metric` (string): Specific metric (optional)

#### Response
```json
{
  "success": true,
  "data": {
    "period": "24h",
    "metrics": {
      "trading": {
        "totalTrades": 25,
        "winningTrades": 15,
        "losingTrades": 10,
        "winRate": 60.0,
        "totalProfit": 250.0,
        "totalLoss": -120.0,
        "netProfit": 130.0,
        "profitFactor": 2.08,
        "sharpeRatio": 1.25,
        "maxDrawdown": 30.0,
        "averageExecutionTime": 150
      },
      "system": {
        "averageResponseTime": 120,
        "peakResponseTime": 500,
        "errorRate": 0.5,
        "throughput": 1000,
        "uptime": 99.9,
        "cpuUsage": {
          "average": 25.5,
          "peak": 80.2,
          "current": 30.1
        },
        "memoryUsage": {
          "average": 60.2,
          "peak": 85.5,
          "current": 65.3
        }
      },
      "broker": {
        "connectionUptime": 99.8,
        "averageLatency": 50,
        "reconnectionCount": 2,
        "orderSuccessRate": 98.5,
        "averageSlippage": 0.5
      }
    },
    "timeline": [
      {
        "timestamp": "2024-01-01T00:00:00.000Z",
        "responseTime": 100,
        "cpuUsage": 20.5,
        "memoryUsage": 58.2,
        "activeTrades": 2
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 4. Get Anomalies

Get detected anomalies and unusual patterns.

```http
GET /api/v1/monitoring/anomalies
```

#### Query Parameters
- `severity` (string): Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)
- `status` (string): Filter by status (ACTIVE, RESOLVED, IGNORED)
- `from` (string): Start date (ISO 8601)
- `to` (string): End date (ISO 8601)

#### Response
```json
{
  "success": true,
  "data": {
    "anomalies": [
      {
        "id": "anomaly_123",
        "type": "UNUSUAL_LOSS_STREAK",
        "severity": "HIGH",
        "status": "ACTIVE",
        "description": "Detected unusual loss streak of 5 consecutive losing trades",
        "detectedAt": "2024-01-01T00:00:00.000Z",
        "affectedEntities": [
          {
            "type": "STRATEGY",
            "id": "strategy_456",
            "name": "EURUSD Scalper"
          }
        ],
        "metrics": {
          "consecutiveLosses": 5,
          "totalLoss": 150.0,
          "expectedLoss": 50.0,
          "deviation": 3.0
        },
        "recommendations": [
          "Consider pausing the strategy",
          "Review strategy parameters",
          "Check market conditions"
        ],
        "acknowledged": false,
        "acknowledgedBy": null,
        "acknowledgedAt": null
      }
    ],
    "summary": {
      "total": 1,
      "active": 1,
      "bySeverity": {
        "LOW": 0,
        "MEDIUM": 0,
        "HIGH": 1,
        "CRITICAL": 0
      }
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 5. Get Alerts

Get system alerts and notifications.

```http
GET /api/v1/monitoring/alerts
```

#### Query Parameters
- `type` (string): Filter by alert type
- `severity` (string): Filter by severity
- `status` (string): Filter by status (ACTIVE, ACKNOWLEDGED, RESOLVED)
- `page` (number): Page number
- `limit` (number): Items per page

#### Response
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "alert_123",
        "type": "RISK_LIMIT",
        "severity": "WARNING",
        "status": "ACTIVE",
        "title": "Daily Loss Limit Approaching",
        "message": "Daily loss has reached 80% of the maximum limit",
        "threshold": 80,
        "current": 80.5,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "entity": {
          "type": "USER",
          "id": "user_456",
          "name": "John Doe"
        },
        "metadata": {
          "dailyLoss": 480.0,
          "maxDailyLoss": 600.0,
          "remaining": 120.0
        },
        "actions": [
          {
            "type": "ACKNOWLEDGE",
            "label": "Acknowledge",
            "available": true
          },
          {
            "type": "VIEW_DETAILS",
            "label": "View Details",
            "available": true
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    },
    "summary": {
      "total": 5,
      "active": 3,
      "acknowledged": 1,
      "resolved": 1,
      "bySeverity": {
        "INFO": 1,
        "WARNING": 2,
        "ERROR": 1,
        "CRITICAL": 1
      }
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 6. Acknowledge Alert

Acknowledge an alert.

```http
POST /api/v1/monitoring/alerts/{alertId}/acknowledge
```

#### Request Body
```json
{
  "comment": "Aware of the situation, monitoring closely"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "alert_123",
    "status": "ACKNOWLEDGED",
    "acknowledgedAt": "2024-01-01T00:00:00.000Z",
    "acknowledgedBy": "user_456",
    "comment": "Aware of the situation, monitoring closely"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 7. Get Resource Usage

Get system resource usage statistics.

```http
GET /api/v1/monitoring/resources
```

#### Query Parameters
- `period` (string): Time period (1h, 24h, 7d, 30d)

#### Response
```json
{
  "success": true,
  "data": {
    "period": "24h",
    "current": {
      "cpu": {
        "usage": 30.1,
        "cores": 4,
        "loadAverage": [0.5, 0.8, 1.2]
      },
      "memory": {
        "used": 65.3,
        "total": 100.0,
        "available": 34.7,
        "swap": {
          "used": 10.2,
          "total": 50.0
        }
      },
      "disk": {
        "used": 45.8,
        "total": 100.0,
        "available": 54.2,
        "readSpeed": 150.5,
        "writeSpeed": 120.3
      },
      "network": {
        "bytesIn": 1048576,
        "bytesOut": 524288,
        "packetsIn": 1024,
        "packetsOut": 512,
        "latency": 50
      }
    },
    "averages": {
      "cpu": 25.5,
      "memory": 60.2,
      "disk": 45.8,
      "networkLatency": 45
    },
    "peaks": {
      "cpu": 80.2,
      "memory": 85.5,
      "disk": 50.1,
      "networkLatency": 120
    },
    "timeline": [
      {
        "timestamp": "2024-01-01T00:00:00.000Z",
        "cpu": 20.5,
        "memory": 58.2,
        "disk": 45.8,
        "networkLatency": 40
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 8. Get Execution Quality

Get trade execution quality metrics.

```http
GET /api/v1/monitoring/execution-quality
```

#### Query Parameters
- `from` (string): Start date (ISO 8601)
- `to` (string): End date (ISO 8601)
- `symbol` (string): Filter by symbol (optional)

#### Response
```json
{
  "success": true,
  "data": {
    "period": {
      "from": "2024-01-01T00:00:00.000Z",
      "to": "2024-01-02T00:00:00.000Z"
    },
    "metrics": {
      "totalTrades": 25,
      "averageExecutionTime": 150,
      "medianExecutionTime": 120,
      "p95ExecutionTime": 300,
      "maxExecutionTime": 500,
      "averageSlippage": 0.5,
      "medianSlippage": 0.3,
      "p95Slippage": 1.2,
      "maxSlippage": 2.5,
      "fillRate": 98.5,
      "rejectionRate": 1.5,
      "partialFillRate": 5.0
    },
    "bySymbol": [
      {
        "symbol": "EURUSD",
        "trades": 15,
        "averageExecutionTime": 140,
        "averageSlippage": 0.4,
        "fillRate": 99.0
      }
    ],
    "byHour": [
      {
        "hour": "00:00",
        "trades": 2,
        "averageExecutionTime": 160,
        "averageSlippage": 0.6
      }
    ],
    "issues": [
      {
        "type": "HIGH_SLIPPAGE",
        "count": 3,
        "description": "Trades with slippage > 2 pips",
        "affectedTrades": [123456, 123457, 123458]
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 9. Get Latency Metrics

Get system latency metrics.

```http
GET /api/v1/monitoring/latency
```

#### Query Parameters
- `period` (string): Time period (1h, 24h, 7d, 30d)
- `component` (string): Specific component (optional)

#### Response
```json
{
  "success": true,
  "data": {
    "period": "24h",
    "overall": {
      "averageLatency": 120,
      "medianLatency": 100,
      "p95Latency": 250,
      "maxLatency": 500
    },
    "components": [
      {
        "name": "database",
        "averageLatency": 15,
        "medianLatency": 12,
        "p95Latency": 30,
        "maxLatency": 80,
        "uptime": 99.9
      },
      {
        "name": "redis",
        "averageLatency": 5,
        "medianLatency": 4,
        "p95Latency": 10,
        "maxLatency": 25,
        "uptime": 99.95
      },
      {
        "name": "broker",
        "averageLatency": 50,
        "medianLatency": 45,
        "p95Latency": 100,
        "maxLatency": 200,
        "uptime": 99.8
      }
    ],
    "timeline": [
      {
        "timestamp": "2024-01-01T00:00:00.000Z",
        "database": 12,
        "redis": 4,
        "broker": 45,
        "overall": 100
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 10. Create Custom Alert

Create a custom monitoring alert.

```http
POST /api/v1/monitoring/alerts
```

#### Request Body
```json
{
  "type": "CUSTOM",
  "severity": "WARNING",
  "title": "Custom Alert",
  "message": "Custom alert message",
  "condition": {
    "metric": "cpu",
    "operator": ">",
    "threshold": 80,
    "duration": 300
  },
  "actions": [
    {
      "type": "EMAIL",
      "config": {
        "recipients": ["admin@example.com"]
      }
    },
    {
      "type": "WEBHOOK",
      "config": {
        "url": "https://example.com/webhook"
      }
    }
  ]
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "alert_456",
    "type": "CUSTOM",
    "severity": "WARNING",
    "title": "Custom Alert",
    "status": "ACTIVE",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "condition": {
      "metric": "cpu",
      "operator": ">",
      "threshold": 80,
      "duration": 300
    },
    "actions": [
      {
        "type": "EMAIL",
        "config": {
          "recipients": ["admin@example.com"]
        }
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Data Models

### SystemHealth
```typescript
interface SystemHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  timestamp: string;
  uptime: number;
  version: string;
  components: ComponentHealth[];
  metrics: SystemMetrics;
}
```

### PositionMonitor
```typescript
interface PositionMonitor {
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  openPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  profit: number;
  unrealizedPnL: number;
  realizedPnL: number;
  margin: number;
  marginLevel: number;
  duration: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  alerts: Alert[];
  lastUpdate: string;
}
```

### Anomaly
```typescript
interface Anomaly {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'ACTIVE' | 'RESOLVED' | 'IGNORED';
  description: string;
  detectedAt: string;
  affectedEntities: Entity[];
  metrics: Record<string, any>;
  recommendations: string[];
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}
```

### Alert
```typescript
interface Alert {
  id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  title: string;
  message: string;
  threshold?: number;
  current?: number;
  createdAt: string;
  updatedAt: string;
  entity: Entity;
  metadata: Record<string, any>;
  actions: AlertAction[];
}
```

## Error Codes

| Error Code | Description |
|------------|-------------|
| `MONITORING_UNAVAILABLE` | Monitoring service unavailable |
| `INVALID_TIME_RANGE` | Invalid time range specified |
| `METRIC_NOT_FOUND` | Requested metric not found |
| `ALERT_NOT_FOUND` | Alert not found |
| `ANOMALY_NOT_FOUND` | Anomaly not found |
| `INSUFFICIENT_PERMISSIONS` | Insufficient permissions |
| `INVALID_CONDITION` | Invalid alert condition |
| `DUPLICATE_ALERT` | Duplicate alert configuration |

## Rate Limits

| Endpoint | Requests per Minute |
|----------|---------------------|
| Get System Health | 60 |
| Get Active Positions | 30 |
| Get Performance Metrics | 20 |
| Get Anomalies | 30 |
| Get Alerts | 30 |
| Acknowledge Alert | 20 |
| Get Resource Usage | 20 |
| Get Execution Quality | 20 |
| Get Latency Metrics | 20 |
| Create Custom Alert | 10 |

## SDK Examples

### JavaScript/TypeScript
```typescript
import { MonitoringAPI } from 'fx-platform-sdk';

const monitoringAPI = new MonitoringAPI(client);

// Get system health
const health = await monitoringAPI.getSystemHealth();

// Get active positions
const positions = await monitoringAPI.getActivePositions();

// Get performance metrics
const performance = await monitoringAPI.getPerformanceMetrics('24h');

// Get alerts
const alerts = await monitoringAPI.getAlerts({
  severity: 'WARNING',
  status: 'ACTIVE'
});

// Acknowledge an alert
await monitoringAPI.acknowledgeAlert('alert_123', {
  comment: 'Investigating the issue'
});
```

### Python
```python
from fx_platform import MonitoringAPI

monitoring_api = MonitoringAPI(client)

# Get system health
health = monitoring_api.get_system_health()

# Get active positions
positions = monitoring_api.get_active_positions()

# Get performance metrics
performance = monitoring_api.get_performance_metrics('24h')

# Get alerts
alerts = monitoring_api.get_alerts(
    severity='WARNING',
    status='ACTIVE'
)

# Acknowledge an alert
monitoring_api.acknowledge_alert(
    'alert_123',
    comment='Investigating the issue'
)
```

## Webhooks

Receive real-time monitoring events:

```json
{
  "event": "system.health.change",
  "data": {
    "status": "DEGRADED",
    "previousStatus": "HEALTHY",
    "reason": "High CPU usage",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

```json
{
  "event": "position.alert",
  "data": {
    "ticket": 123456,
    "symbol": "EURUSD",
    "alertType": "STOP_LOSS_APPROACHING",
    "currentPrice": 1.0805,
    "stopLoss": 1.0800,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

```json
{
  "event": "anomaly.detected",
  "data": {
    "anomalyId": "anomaly_123",
    "type": "UNUSUAL_LOSS_STREAK",
    "severity": "HIGH",
    "description": "Detected unusual loss streak",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## Alert Types

| Type | Description | Default Severity |
|------|-------------|------------------|
| `RISK_LIMIT` | Risk limit breach | WARNING |
| `POSITION_ALERT` | Position-related alert | INFO |
| `SYSTEM_HEALTH` | System health issue | ERROR |
| `PERFORMANCE` | Performance degradation | WARNING |
| `EXECUTION_QUALITY` | Poor execution quality | WARNING |
| `ANOMALY` | Detected anomaly | HIGH |
| `RESOURCE_USAGE` | High resource usage | WARNING |
| `CONNECTION` | Connection issue | ERROR |
| `CUSTOM` | User-defined alert | Variable |

---

**Last Updated**: January 2024  
**API Version**: v1.0.0