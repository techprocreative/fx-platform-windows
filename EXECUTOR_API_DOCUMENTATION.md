# 🤖 Executor API Documentation

## Overview

This documentation provides comprehensive details for integrating MT5/MT4 executors with the FX Trading Platform. Executors are Windows applications that connect to the platform to receive trading commands and report back status and trade results.

---

## 🔑 Authentication

All API requests must include authentication headers:

```http
X-API-Key: exe_xxxxxxxxxxxxxxxxxxxxxxxx
X-API-Secret: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**How to get credentials:**
1. Log in to the platform
2. Navigate to Dashboard > Executors
3. Click "Add Executor"
4. Fill in the form and submit
5. **Save the credentials immediately** - they will only be shown once!

---

## 📡 API Endpoints

### Base URL
```
Production: https://your-domain.com/api
Development: http://localhost:3000/api
```

---

## 1. Heartbeat (Keep-Alive)

Executors must send heartbeat signals every **60 seconds** to maintain "online" status.

### Endpoint
```http
POST /api/executor/{executorId}/heartbeat
```

### Headers
```http
Content-Type: application/json
X-API-Key: YOUR_API_KEY
X-API-Secret: YOUR_API_SECRET
```

### Request Body (Optional)
```json
{
  "status": "online",
  "metadata": {
    "version": "1.0.0",
    "platform": "MT5",
    "accountBalance": 10000.00,
    "accountEquity": 10500.00,
    "openPositions": 3,
    "cpuUsage": 45.2,
    "memoryUsage": 512.5
  }
}
```

### Response (200 OK)
```json
{
  "success": true,
  "executor": {
    "id": "clxxx...",
    "name": "My MT5 Executor",
    "status": "online",
    "lastHeartbeat": "2024-01-15T10:30:00Z"
  },
  "pendingCommands": [
    {
      "id": "cmd_xxx",
      "command": "PAUSE",
      "parameters": {},
      "priority": "HIGH",
      "createdAt": "2024-01-15T10:29:30Z"
    }
  ],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Error Response (401 Unauthorized)
```json
{
  "error": "Invalid API credentials",
  "code": "INVALID_CREDENTIALS"
}
```

---

## 2. Command Execution Flow

### Command Types

| Command | Description | Parameters |
|---------|-------------|------------|
| `GET_STATUS` | Request current executor status | None |
| `PAUSE` | Pause all trading activities | None |
| `RESUME` | Resume trading activities | None |
| `STOP_ALL` | Stop all strategies and close positions | None |
| `CLOSE_ALL_POSITIONS` | Close all open positions immediately | None |
| `CLOSE_POSITION` | Close a specific position | `{ "ticket": "12345678" }` |
| `OPEN_POSITION` | Open a new position | `{ "symbol": "EURUSD", "type": "BUY", "lots": 0.01, "sl": 1.0900, "tp": 1.1000 }` |
| `MODIFY_POSITION` | Modify an existing position | `{ "ticket": "12345678", "sl": 1.0900, "tp": 1.1000 }` |
| `RESTART` | Restart the executor application | None |

### Command Priority Levels
- `LOW`: Non-urgent commands
- `NORMAL`: Standard commands (default)
- `HIGH`: Important commands
- `URGENT`: Critical commands (execute immediately)

### Processing Commands

**Step 1:** Receive commands via heartbeat response
```json
{
  "pendingCommands": [
    {
      "id": "cmd_xxx",
      "command": "CLOSE_ALL_POSITIONS",
      "parameters": {},
      "priority": "URGENT",
      "createdAt": "2024-01-15T10:29:30Z"
    }
  ]
}
```

**Step 2:** Execute the command in your MT5/MT4 application

**Step 3:** Report back the result

### Reporting Command Result

```http
PATCH /api/executor/{executorId}/command
```

### Request Body
```json
{
  "commandId": "cmd_xxx",
  "status": "executed",
  "result": {
    "success": true,
    "message": "All positions closed successfully",
    "details": {
      "closedPositions": 3,
      "totalProfit": 150.50
    }
  }
}
```

**Status values:**
- `executed`: Command completed successfully
- `failed`: Command execution failed

### Response
```json
{
  "success": true,
  "command": {
    "id": "cmd_xxx",
    "status": "executed",
    "executedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

## 3. Reporting Trades

When a trade is executed by your strategy, report it to the platform.

### Endpoint
```http
POST /api/trade
```

### Headers
```http
Content-Type: application/json
X-API-Key: YOUR_API_KEY
X-API-Secret: YOUR_API_SECRET
```

### Request Body (Trade Open)
```json
{
  "executorId": "clxxx...",
  "strategyId": "strat_xxx",
  "ticket": "12345678",
  "symbol": "EURUSD",
  "type": "BUY",
  "lots": 0.01,
  "openTime": "2024-01-15T10:30:00Z",
  "openPrice": 1.0950,
  "stopLoss": 1.0900,
  "takeProfit": 1.1000,
  "magicNumber": 12345,
  "comment": "Strategy: Scalper v1"
}
```

### Request Body (Trade Close)
```json
{
  "executorId": "clxxx...",
  "ticket": "12345678",
  "closeTime": "2024-01-15T11:30:00Z",
  "closePrice": 1.0980,
  "commission": 0.50,
  "swap": 0.10,
  "profit": 30.00,
  "pips": 30
}
```

### Response
```json
{
  "success": true,
  "trade": {
    "id": "trade_xxx",
    "ticket": "12345678",
    "status": "open"
  }
}
```

---

## 4. Error Handling

### Error Response Format
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

| Code | HTTP Status | Description | Solution |
|------|-------------|-------------|----------|
| `INVALID_CREDENTIALS` | 401 | API key or secret is invalid | Check your credentials |
| `EXECUTOR_NOT_FOUND` | 404 | Executor ID not found | Verify executor ID |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Wait and retry |
| `VALIDATION_ERROR` | 400 | Request data is invalid | Check request format |
| `EXECUTOR_OFFLINE` | 400 | Executor is not connected | Send heartbeat first |

---

## 5. Best Practices

### ✅ Heartbeat Implementation
```python
import time
import requests
from datetime import datetime

EXECUTOR_ID = "clxxx..."
API_KEY = "exe_xxx..."
API_SECRET = "xxx..."
BASE_URL = "https://your-domain.com/api"

def send_heartbeat():
    """Send heartbeat every 60 seconds"""
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
        "X-API-Secret": API_SECRET,
    }
    
    payload = {
        "status": "online",
        "metadata": {
            "version": "1.0.0",
            "platform": "MT5",
            "accountBalance": get_account_balance(),
            "accountEquity": get_account_equity(),
            "openPositions": get_open_positions_count(),
        }
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/executor/{EXECUTOR_ID}/heartbeat",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Process pending commands
            for command in data.get("pendingCommands", []):
                execute_command(command)
                
            print(f"Heartbeat sent successfully at {datetime.now()}")
            return True
        else:
            print(f"Heartbeat failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"Heartbeat error: {str(e)}")
        return False

def main():
    """Main loop"""
    while True:
        send_heartbeat()
        time.sleep(60)  # Wait 60 seconds

if __name__ == "__main__":
    main()
```

### ✅ Command Execution
```python
def execute_command(command):
    """Execute a command from the platform"""
    command_id = command["id"]
    command_type = command["command"]
    parameters = command.get("parameters", {})
    
    try:
        if command_type == "PAUSE":
            # Pause trading logic
            result = pause_trading()
        elif command_type == "RESUME":
            # Resume trading logic
            result = resume_trading()
        elif command_type == "CLOSE_ALL_POSITIONS":
            # Close all positions
            result = close_all_positions()
        elif command_type == "GET_STATUS":
            # Get current status
            result = get_executor_status()
        else:
            result = {"success": False, "message": "Unknown command"}
        
        # Report result back to platform
        report_command_result(command_id, "executed", result)
        
    except Exception as e:
        # Report failure
        report_command_result(command_id, "failed", {
            "success": False,
            "message": str(e)
        })

def report_command_result(command_id, status, result):
    """Report command execution result"""
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
        "X-API-Secret": API_SECRET,
    }
    
    payload = {
        "commandId": command_id,
        "status": status,
        "result": result
    }
    
    requests.patch(
        f"{BASE_URL}/executor/{EXECUTOR_ID}/command",
        json=payload,
        headers=headers
    )
```

### ✅ Retry Logic
```python
import time
from functools import wraps

def retry_on_failure(max_retries=3, delay=5):
    """Decorator for retry logic"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt < max_retries - 1:
                        print(f"Attempt {attempt + 1} failed: {e}. Retrying in {delay}s...")
                        time.sleep(delay)
                    else:
                        print(f"All {max_retries} attempts failed")
                        raise
        return wrapper
    return decorator

@retry_on_failure(max_retries=3, delay=5)
def send_heartbeat_with_retry():
    """Send heartbeat with automatic retry"""
    return send_heartbeat()
```

---

## 6. Security Considerations

### ✅ DO's
- ✅ Store API credentials securely (encrypted config file)
- ✅ Use HTTPS in production
- ✅ Implement connection timeout (10-30 seconds)
- ✅ Validate all incoming commands before execution
- ✅ Log all API interactions for audit
- ✅ Implement rate limiting on your side

### ❌ DON'Ts
- ❌ Never hardcode API credentials in source code
- ❌ Never log API secrets
- ❌ Never share credentials between executors
- ❌ Don't ignore SSL certificate errors in production
- ❌ Don't execute commands without validation

---

## 7. Testing

### Development Environment
```bash
# Use development server for testing
BASE_URL="http://localhost:3000/api"
```

### Test Heartbeat
```bash
curl -X POST "http://localhost:3000/api/executor/{executorId}/heartbeat" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: exe_xxx..." \
  -H "X-API-Secret: xxx..." \
  -d '{
    "status": "online",
    "metadata": {
      "version": "1.0.0",
      "platform": "MT5"
    }
  }'
```

### Test Command
```bash
curl -X PATCH "http://localhost:3000/api/executor/{executorId}/command" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: exe_xxx..." \
  -H "X-API-Secret: xxx..." \
  -d '{
    "commandId": "cmd_xxx",
    "status": "executed",
    "result": {
      "success": true,
      "message": "Command executed successfully"
    }
  }'
```

---

## 8. Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Heartbeat | 120 requests | 60 seconds |
| Commands | 60 requests | 60 seconds |
| Trades | 300 requests | 60 seconds |

**When rate limit is exceeded:**
```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 30
}
```

---

## 9. Monitoring & Troubleshooting

### Connection Status
- **Online**: Last heartbeat < 5 minutes ago
- **Offline**: Last heartbeat >= 5 minutes ago or never

### Common Issues

**Issue: Executor showing offline**
- ✅ Check internet connection
- ✅ Verify API credentials
- ✅ Ensure heartbeat is sent every 60 seconds
- ✅ Check firewall settings

**Issue: Commands not executing**
- ✅ Verify executor is online
- ✅ Check command implementation
- ✅ Review executor logs
- ✅ Ensure command reporting is working

**Issue: API authentication errors**
- ✅ Verify API credentials are correct
- ✅ Check for typos in API key/secret
- ✅ Ensure credentials haven't been regenerated
- ✅ Check HTTP headers format

---

## 10. Support

### Platform Dashboard
Monitor your executor status at:
```
https://your-domain.com/dashboard/executors
```

### API Status
Check API health at:
```
https://your-domain.com/api/health
```

### Getting Help
1. Check executor logs
2. Review API documentation
3. Test with curl/Postman
4. Contact support with executor ID and error details

---

## 📝 Changelog

### Version 1.0.0 (2024-01-15)
- Initial API release
- Heartbeat endpoint
- Command system
- Trade reporting

---

## License
© 2024 FX Trading Platform. All rights reserved.
