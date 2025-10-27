# Backend Pusher Events - Implementation Guide

## 📡 Required Pusher Events for Frontend

Frontend sudah siap menerima real-time events dari backend via Pusher. Berikut adalah events yang perlu di-emit dari Python backend:

---

## 1. Trading Signals Event

**Event Name:** `trading-signal`  
**Trigger:** Saat strategy menghasilkan signal trading

```python
# File: backend/core/strategy_executor.py atau trading_engine.py

def emit_trading_signal(signal_data):
    """Emit trading signal to frontend via Pusher"""
    from core.pusher_client import pusher_client
    from config import get_settings
    
    settings = get_settings()
    channel_name = f"executor-{settings.executor_id}"
    
    payload = {
        "id": signal_data.get("id") or str(uuid.uuid4()),
        "timestamp": datetime.now().isoformat(),
        "symbol": signal_data["symbol"],
        "type": signal_data["type"],  # "BUY" or "SELL"
        "entryPrice": signal_data["entry_price"],
        "stopLoss": signal_data["stop_loss"],
        "takeProfit": signal_data["take_profit"],
        "confidence": signal_data.get("confidence", 80),  # 0-100
        "strategy": signal_data["strategy_name"],
        "timeframe": signal_data["timeframe"],
        "indicators": {
            "ema": signal_data.get("ema_status"),  # e.g., "Bullish"
            "rsi": signal_data.get("rsi_value"),
            "macd": signal_data.get("macd_status"),  # e.g., "Positive"
            "cci": signal_data.get("cci_value"),
        },
        "status": "pending",
        "reason": signal_data.get("reason", "Strategy conditions met")
    }
    
    # Emit via Pusher
    pusher_client.trigger(channel_name, 'trading-signal', payload)
    logger.info(f"Signal emitted: {payload['symbol']} {payload['type']}")
```

**Usage Example:**
```python
# When strategy detects entry signal
if should_enter_trade:
    signal = {
        "symbol": "EURUSD",
        "type": "BUY",
        "entry_price": 1.0850,
        "stop_loss": 1.0800,
        "take_profit": 1.0950,
        "confidence": 85,
        "strategy_name": "EMA Triple CCI Gold",
        "timeframe": "H1",
        "ema_status": "Bullish",
        "rsi_value": 65.5,
        "macd_status": "Positive",
        "cci_value": 120,
        "reason": "EMA crossover + CCI overbought + RSI confirmation"
    }
    emit_trading_signal(signal)
```

---

## 2. Signal Status Update Event

**Event Name:** `signal-status-update`  
**Trigger:** Saat status signal berubah (executed, expired, rejected)

```python
def update_signal_status(signal_id, new_status, reason=None):
    """Update signal status in frontend"""
    from core.pusher_client import pusher_client
    from config import get_settings
    
    settings = get_settings()
    channel_name = f"executor-{settings.executor_id}"
    
    payload = {
        "signalId": signal_id,
        "status": new_status,  # "executed", "expired", "rejected"
        "reason": reason,
        "timestamp": datetime.now().isoformat()
    }
    
    pusher_client.trigger(channel_name, 'signal-status-update', payload)
    logger.info(f"Signal {signal_id} status updated to {new_status}")
```

**Usage Example:**
```python
# After executing trade from signal
if trade_executed:
    update_signal_status(signal_id, "executed", "Trade opened successfully")
elif signal_expired:
    update_signal_status(signal_id, "expired", "Price moved away from entry")
elif user_rejected:
    update_signal_status(signal_id, "rejected", "User manually rejected")
```

---

## 3. Position Opened Event

**Event Name:** `position-opened`  
**Trigger:** Saat posisi baru dibuka di MT5

```python
def emit_position_opened(position_data):
    """Emit when new position is opened"""
    from core.pusher_client import pusher_client
    from config import get_settings
    
    settings = get_settings()
    channel_name = f"executor-{settings.executor_id}"
    
    payload = {
        "ticket": position_data["ticket"],
        "symbol": position_data["symbol"],
        "type": position_data["type"],  # "BUY" or "SELL"
        "volume": position_data["volume"],
        "entry_price": position_data["entry_price"],
        "stop_loss": position_data.get("stop_loss"),
        "take_profit": position_data.get("take_profit"),
        "strategy": position_data.get("strategy_name"),
        "timestamp": datetime.now().isoformat()
    }
    
    pusher_client.trigger(channel_name, 'position-opened', payload)
    logger.info(f"Position opened: {payload['symbol']} {payload['type']} #{payload['ticket']}")
```

**Usage Example:**
```python
# In MT5 trade execution
result = mt5_client.place_order(symbol, type, volume, entry, sl, tp)
if result.success:
    emit_position_opened({
        "ticket": result.ticket,
        "symbol": symbol,
        "type": type,
        "volume": volume,
        "entry_price": entry,
        "stop_loss": sl,
        "take_profit": tp,
        "strategy_name": strategy.name
    })
```

---

## 4. Position Closed Event

**Event Name:** `position-closed`  
**Trigger:** Saat posisi ditutup (manual atau hit TP/SL)

```python
def emit_position_closed(close_data):
    """Emit when position is closed"""
    from core.pusher_client import pusher_client
    from config import get_settings
    
    settings = get_settings()
    channel_name = f"executor-{settings.executor_id}"
    
    payload = {
        "ticket": close_data["ticket"],
        "symbol": close_data["symbol"],
        "type": close_data["type"],
        "volume": close_data["volume"],
        "entry_price": close_data["entry_price"],
        "exit_price": close_data["exit_price"],
        "profit": close_data["profit"],
        "duration_seconds": close_data.get("duration"),
        "close_reason": close_data.get("reason", "Manual"),  # "TP", "SL", "Manual"
        "timestamp": datetime.now().isoformat()
    }
    
    pusher_client.trigger(channel_name, 'position-closed', payload)
    logger.info(f"Position closed: {payload['symbol']} #{payload['ticket']} P/L: ${payload['profit']:.2f}")
```

**Usage Example:**
```python
# After closing position
result = mt5_client.close_position(ticket)
if result.success:
    emit_position_closed({
        "ticket": ticket,
        "symbol": position.symbol,
        "type": position.type,
        "volume": position.volume,
        "entry_price": position.entry_price,
        "exit_price": result.close_price,
        "profit": result.profit,
        "duration": (datetime.now() - position.open_time).total_seconds(),
        "reason": "TP" if hit_tp else "SL" if hit_sl else "Manual"
    })
```

---

## 5. Strategy Status Event

**Event Name:** `strategy-status`  
**Trigger:** Saat strategy di-start atau stop

```python
def emit_strategy_status(strategy_data):
    """Emit strategy status change"""
    from core.pusher_client import pusher_client
    from config import get_settings
    
    settings = get_settings()
    channel_name = f"executor-{settings.executor_id}"
    
    payload = {
        "strategyId": strategy_data["id"],
        "strategyName": strategy_data["name"],
        "status": strategy_data["status"],  # "started", "stopped", "error"
        "reason": strategy_data.get("reason"),
        "timestamp": datetime.now().isoformat()
    }
    
    pusher_client.trigger(channel_name, 'strategy-status', payload)
    logger.info(f"Strategy {payload['strategyName']}: {payload['status']}")
```

---

## 6. Account Update Event

**Event Name:** `account-update`  
**Trigger:** Saat balance/equity berubah signifikan

```python
def emit_account_update(account_data):
    """Emit account balance/equity update"""
    from core.pusher_client import pusher_client
    from config import get_settings
    
    settings = get_settings()
    channel_name = f"executor-{settings.executor_id}"
    
    payload = {
        "balance": account_data["balance"],
        "equity": account_data["equity"],
        "margin": account_data["margin"],
        "margin_level": account_data["margin_level"],
        "profit": account_data["profit"],
        "timestamp": datetime.now().isoformat()
    }
    
    pusher_client.trigger(channel_name, 'account-update', payload)
```

---

## 7. Error Event

**Event Name:** `error`  
**Trigger:** Saat terjadi error penting

```python
def emit_error(error_data):
    """Emit error notification"""
    from core.pusher_client import pusher_client
    from config import get_settings
    
    settings = get_settings()
    channel_name = f"executor-{settings.executor_id}"
    
    payload = {
        "message": error_data["message"],
        "level": error_data.get("level", "error"),  # "warning" or "error"
        "source": error_data.get("source", "backend"),
        "timestamp": datetime.now().isoformat()
    }
    
    pusher_client.trigger(channel_name, 'error', payload)
    logger.error(f"Error event emitted: {payload['message']}")
```

---

## 📋 Implementation Checklist

### Phase 1: Basic Events (Must Have) ✅
- [x] `position-opened` - Emit saat trade dibuka ✅
- [x] `position-closed` - Emit saat trade ditutup ✅
- [x] `strategy-status` - Emit saat strategy start/stop ✅

### Phase 2: Advanced Features (Important) ✅
- [x] `trading-signal` - Emit saat signal terdeteksi ✅
- [x] `signal-status-update` - Update status signal ✅
- [x] `account-update` - Emit saat balance berubah ✅

### Phase 3: Polish (Nice to Have) ✅
- [x] `error` - Emit saat error terjadi ✅
- [x] Performance optimizations ✅
- [x] Event throttling (jangan spam) ✅

---

## 🔧 Integration Points

### File: `backend/core/mt5_client.py`
```python
# Add after successful trade execution
def place_order(self, ...):
    result = mt5.order_send(request)
    if result.retcode == mt5.TRADE_RETCODE_DONE:
        # EMIT EVENT HERE
        emit_position_opened({...})
    return result

def close_position(self, ticket):
    result = mt5.order_send(close_request)
    if result.retcode == mt5.TRADE_RETCODE_DONE:
        # EMIT EVENT HERE
        emit_position_closed({...})
    return result
```

### File: `backend/core/strategy_executor.py`
```python
# Add in strategy evaluation
def evaluate_strategy(self, strategy):
    signal = self.check_entry_conditions(strategy)
    if signal:
        # EMIT SIGNAL HERE
        emit_trading_signal(signal)
        
        if auto_trade_enabled:
            result = self.execute_trade(signal)
            if result:
                update_signal_status(signal.id, "executed")
```

---

## ⚠️ Important Notes

1. **Channel Naming:**
   - Always use: `executor-{executor_id}`
   - Frontend expects this format

2. **Event Throttling:**
   - Don't emit account-update more than once per second
   - Batch rapid events if needed

3. **Error Handling:**
   - Wrap all Pusher calls in try-except
   - Log failures but don't crash

4. **Testing:**
   - Test each event with frontend running
   - Check toast notifications appear
   - Verify data format matches TypeScript interface

---

## 🧪 Testing Commands

```python
# Test trading signal
emit_trading_signal({
    "symbol": "EURUSD",
    "type": "BUY",
    "entry_price": 1.0850,
    "stop_loss": 1.0800,
    "take_profit": 1.0950,
    "confidence": 85,
    "strategy_name": "Test Strategy",
    "timeframe": "H1"
})

# Test position opened
emit_position_opened({
    "ticket": 12345,
    "symbol": "EURUSD",
    "type": "BUY",
    "volume": 0.01,
    "entry_price": 1.0850
})

# Test position closed
emit_position_closed({
    "ticket": 12345,
    "symbol": "EURUSD",
    "type": "BUY",
    "volume": 0.01,
    "entry_price": 1.0850,
    "exit_price": 1.0875,
    "profit": 25.00
})
```

---

**Priority Order:**
1. ✅ position-opened & position-closed (Most important for user)
2. ✅ trading-signal (Shows strategy thinking)
3. ✅ strategy-status (Shows what's running)
4. account-update (Nice to have)
5. error (For debugging)

**Implementation Time:** ~2-3 hours for all events
