# FX Trading Platform - API Documentation

## Overview

The FX Trading Platform provides a comprehensive RESTful API for managing trading strategies, executing trades, monitoring positions, and analyzing performance. The API is designed with security, scalability, and ease of use in mind.

## Base URL

```
Production: https://your-platform.vercel.app/api
Development: http://localhost:3000/api
```

## Authentication

All API endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```http
Authorization: Bearer <your-jwt-token>
```

## API Rate Limiting

- **Standard endpoints**: 100 requests per minute
- **Trading endpoints**: 50 requests per minute
- **Analytics endpoints**: 30 requests per minute

Rate limits are enforced per user/IP combination.

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional error details
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## API Endpoints

### Core Trading APIs

| API | Description | Endpoints |
|-----|-------------|-----------|
| [Risk Management](./risk-management.md) | Risk assessment and limit enforcement | `/api/risk/*` |
| [Broker Connection](./broker-connection.md) | Broker integration and account management | `/api/broker/*` |
| [Trading](./trading.md) | Trade execution and management | `/api/trading/*` |
| [Orders](./orders.md) | Order lifecycle management | `/api/orders/*` |
| [Monitoring](./monitoring.md) | System monitoring and alerts | `/api/monitoring/*` |
| [Analytics](./analytics.md) | Performance analytics and reporting | `/api/analytics/*` |
| [WebSocket](./websocket.md) | Real-time data streaming | `/api/ws/*` |

### Supporting APIs

| API | Description | Endpoints |
|-----|-------------|-----------|
| Authentication | User authentication and session management | `/api/auth/*` |
| Strategies | Trading strategy management | `/api/strategy/*` |
| Backtesting | Strategy backtesting and validation | `/api/backtest/*` |
| Signals | Trading signal generation | `/api/signals/*` |
| User Management | User profile and preferences | `/api/user/*` |

## HTTP Status Codes

| Status | Meaning |
|--------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid request parameters |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource conflict |
| 422 | Unprocessable Entity - Validation failed |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |

## Error Codes

| Error Code | Description |
|------------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `AUTHENTICATION_ERROR` | Authentication failed |
| `AUTHORIZATION_ERROR` | Insufficient permissions |
| `RATE_LIMIT_EXCEEDED` | API rate limit exceeded |
| `RESOURCE_NOT_FOUND` | Requested resource not found |
| `RESOURCE_CONFLICT` | Resource conflict |
| `BROKER_CONNECTION_ERROR` | Broker connection failed |
| `RISK_LIMIT_EXCEEDED` | Risk limits exceeded |
| `INSUFFICIENT_MARGIN` | Insufficient margin for trade |
| `MARKET_CLOSED` | Market is closed for trading |
| `INVALID_SYMBOL` | Invalid trading symbol |
| `ORDER_REJECTED` | Order rejected by broker |
| `SYSTEM_ERROR` | Internal system error |

## SDKs and Libraries

### JavaScript/TypeScript
```bash
npm install fx-platform-sdk
```

```typescript
import { FXPlatform } from 'fx-platform-sdk';

const client = new FXPlatform({
  apiKey: 'your-api-key',
  baseUrl: 'https://your-platform.vercel.app/api'
});

// Example: Get account balance
const balance = await client.account.getBalance();
```

### Python
```bash
pip install fx-platform-python
```

```python
from fx_platform import FXPlatform

client = FXPlatform(
    api_key='your-api-key',
    base_url='https://your-platform.vercel.app/api'
)

# Example: Get account balance
balance = client.account.get_balance()
```

## API Versioning

The API uses semantic versioning. The current version is v1. Include the version in the URL:

```
/api/v1/strategy
```

## Pagination

List endpoints support pagination using the following parameters:

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

```http
GET /api/v1/strategies?page=2&limit=10
```

Response includes pagination metadata:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 10,
    "total": 45,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": true
  }
}
```

## Filtering and Sorting

List endpoints support filtering and sorting:

- `sort`: Field to sort by (e.g., `createdAt:desc`)
- `filter`: Filter criteria (e.g., `status:active`)

```http
GET /api/v1/trades?sort=createdAt:desc&filter=status:closed
```

## Webhooks

Configure webhooks to receive real-time notifications:

```json
{
  "url": "https://your-app.com/webhook",
  "events": ["trade.executed", "order.filled", "risk.alert"],
  "secret": "your-webhook-secret"
}
```

## Testing

Use the API test endpoints for development:

```http
GET /api/health
```

## Support

For API support:
- Documentation: [API Reference](./)
- Issues: [GitHub Issues](https://github.com/your-repo/issues)
- Email: api-support@fxplatform.com

---

**Last Updated**: January 2024  
**API Version**: v1.0.0