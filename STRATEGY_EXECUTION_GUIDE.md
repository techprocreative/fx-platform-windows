# Strategy Execution System - Complete Guide

## 📋 Overview

The Strategy Execution System allows automated strategy execution on Windows Executor applications. When you activate a strategy in the dashboard, it's automatically deployed to selected executors via **real-time Pusher commands**.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        WEB DASHBOARD                            │
│                                                                 │
│  User Actions:                                                  │
│  1. Create Strategy (define rules, symbol, timeframe)          │
│  2. Click "Activate Strategy"                                   │
│  3. Select Executors (or auto-assign to all online)           │
│  4. Optionally override settings (lot size, risk, etc)         │
│                                                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND API (Next.js)                       │
│                                                                 │
│  Actions:                                                       │
│  1. Update strategy status → 'active'                          │
│  2. Create StrategyAssignment records                          │
│  3. Create START_STRATEGY commands                            │
│  4. Trigger Pusher events                                      │
│                                                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                     PUSHER (Real-time)                         │
│                                                                 │
│  Channel: private-executor-{executorId}                        │
│  Event: command-received                                       │
│  Payload: START_STRATEGY command with strategy rules          │
│                                                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              WINDOWS EXECUTOR APP (User's PC)                   │
│                                                                 │
│  Flow:                                                          │
│  1. Receive START_STRATEGY command                            │
│  2. Parse strategy rules                                       │
│  3. Initialize strategy monitor                                │
│  4. Start checking market conditions                           │
│  5. Execute trades when conditions met                         │
│  6. Report trades back to platform                            │
│  7. Continue monitoring until STOP_STRATEGY received          │
│                                                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    METATRADER 5 / MT4                          │
│                                                                 │
│  - Execute buy/sell orders                                     │
│  - Manage positions (SL, TP)                                   │
│  - Monitor open trades                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Command Types

### 1. START_STRATEGY

**Purpose:** Start executing a strategy

**Parameters:**
```json
{
  "strategyId": "clxxx...",
  "strategyName": "EMA Crossover",
  "symbol": "EURUSD",
  "timeframe": "H1",
  "rules": {
    "entry": {
      "type": "indicator_cross",
      "indicators": ["EMA_20", "EMA_50"],
      "direction": "above"
    },
    "exit": {
      "type": "opposite_signal",
      "stopLoss": 50,
      "takeProfit": 100
    },
    "risk": {
      "lotSize": 0.01,
      "maxRisk": 2,
      "maxDailyLoss": 5
    }
  },
  "settings": {
    "lotSize": 0.01,
    "maxRisk": 2,
    "maxDailyLoss": 5,
    "maxOpenTrades": 5
  }
}
```

**Executor Response:**
1. Validate strategy rules
2. Initialize strategy monitor thread
3. Start monitoring market
4. Report success/failure

### 2. STOP_STRATEGY

**Purpose:** Stop executing a strategy

**Parameters:**
```json
{
  "strategyId": "clxxx...",
  "strategyName": "EMA Crossover"
}
```

**Executor Response:**
1. Close all open positions for this strategy
2. Stop monitor thread
3. Remove from active strategies
4. Report success

### 3. PAUSE_STRATEGY

**Purpose:** Temporarily pause strategy (don't open new trades, keep existing)

**Parameters:**
```json
{
  "strategyId": "clxxx..."
}
```

### 4. RESUME_STRATEGY

**Purpose:** Resume paused strategy

**Parameters:**
```json
{
  "strategyId": "clxxx..."
}
```

### 5. UPDATE_STRATEGY

**Purpose:** Update strategy rules on running strategy

**Parameters:**
```json
{
  "strategyId": "clxxx...",
  "rules": { /* updated rules */ }
}
```

---

## 💻 Windows Executor Implementation

### Basic Structure

```python
import pusher_client
import threading
import time
import MetaTrader5 as mt5

# Global state
active_strategies = {}  # {strategyId: {...strategy_data}}
strategy_monitors = {}  # {strategyId: threading.Thread}

def handle_command(data):
    """Main command handler called by Pusher"""
    command = data['command']
    params = data['parameters']
    
    if command == 'START_STRATEGY':
        handle_start_strategy(data['id'], params)
    elif command == 'STOP_STRATEGY':
        handle_stop_strategy(data['id'], params)
    elif command == 'PAUSE_STRATEGY':
        handle_pause_strategy(data['id'], params)
    elif command == 'RESUME_STRATEGY':
        handle_resume_strategy(data['id'], params)
    elif command == 'UPDATE_STRATEGY':
        handle_update_strategy(data['id'], params)

def handle_start_strategy(command_id, params):
    """Handle START_STRATEGY command"""
    strategy_id = params['strategyId']
    strategy_name = params['strategyName']
    symbol = params['symbol']
    timeframe = params['timeframe']
    rules = params['rules']
    settings = params.get('settings', {})
    
    print(f"🚀 Starting strategy: {strategy_name} ({strategy_id})")
    
    try:
        # Validate rules
        if not validate_strategy_rules(rules):
            raise Exception("Invalid strategy rules")
        
        # Store strategy data
        active_strategies[strategy_id] = {
            'id': strategy_id,
            'name': strategy_name,
            'symbol': symbol,
            'timeframe': timeframe,
            'rules': rules,
            'settings': settings,
            'status': 'running',
            'start_time': time.time(),
            'trades': []
        }
        
        # Start monitor thread
        monitor_thread = threading.Thread(
            target=monitor_strategy,
            args=(strategy_id,),
            daemon=True
        )
        monitor_thread.start()
        strategy_monitors[strategy_id] = monitor_thread
        
        # Report success
        report_command_result(command_id, 'executed', {
            'success': True,
            'message': f'Strategy {strategy_name} started successfully',
            'strategyId': strategy_id
        })
        
        print(f"✅ Strategy {strategy_name} is now running")
        
    except Exception as e:
        # Report failure
        report_command_result(command_id, 'failed', {
            'success': False,
            'message': str(e),
            'strategyId': strategy_id
        })
        print(f"❌ Failed to start strategy: {str(e)}")

def monitor_strategy(strategy_id):
    """Main strategy monitoring loop"""
    
    strategy = active_strategies.get(strategy_id)
    if not strategy:
        return
    
    symbol = strategy['symbol']
    timeframe = strategy['timeframe']
    rules = strategy['rules']
    settings = strategy['settings']
    
    print(f"📊 Monitoring {strategy['name']} on {symbol} {timeframe}")
    
    # Convert timeframe to MT5 constant
    mt5_timeframe = get_mt5_timeframe(timeframe)
    
    while strategy_id in active_strategies:
        try:
            # Get current strategy status
            status = active_strategies[strategy_id]['status']
            
            # Skip if paused
            if status == 'paused':
                time.sleep(1)
                continue
            
            # Get market data
            rates = mt5.copy_rates_from_pos(symbol, mt5_timeframe, 0, 100)
            if rates is None or len(rates) == 0:
                time.sleep(1)
                continue
            
            # Check entry conditions
            if should_enter_trade(rates, rules['entry'], settings):
                # Calculate position size
                lot_size = calculate_lot_size(
                    symbol=symbol,
                    risk_percent=settings.get('maxRisk', 2),
                    stop_loss_pips=rules['exit'].get('stopLoss', 50)
                )
                
                # Determine trade direction
                direction = get_trade_direction(rates, rules['entry'])
                
                # Execute trade
                ticket = execute_trade(
                    symbol=symbol,
                    direction=direction,
                    lot_size=lot_size,
                    stop_loss=rules['exit'].get('stopLoss'),
                    take_profit=rules['exit'].get('takeProfit'),
                    magic_number=get_magic_number(strategy_id)
                )
                
                if ticket:
                    # Report trade to platform
                    report_trade_opened(strategy_id, ticket, {
                        'symbol': symbol,
                        'type': direction,
                        'lots': lot_size,
                        'strategy': strategy['name']
                    })
                    
                    # Add to strategy trades
                    active_strategies[strategy_id]['trades'].append({
                        'ticket': ticket,
                        'opened_at': time.time()
                    })
                    
                    print(f"✅ Trade opened: {ticket} ({direction} {lot_size} lots on {symbol})")
            
            # Check exit conditions for open trades
            check_exit_conditions(strategy_id, rates, rules['exit'])
            
            # Sleep before next check (adjust based on timeframe)
            time.sleep(get_check_interval(timeframe))
            
        except Exception as e:
            print(f"❌ Error in strategy monitor: {str(e)}")
            time.sleep(5)  # Wait before retry
    
    print(f"🛑 Strategy monitor stopped for {strategy['name']}")

def should_enter_trade(rates, entry_rules, settings):
    """Check if entry conditions are met"""
    
    # Check max open trades limit
    max_trades = settings.get('maxOpenTrades', 5)
    if get_open_positions_count() >= max_trades:
        return False
    
    # Check daily loss limit
    daily_loss = get_daily_loss()
    max_daily_loss = settings.get('maxDailyLoss', 5)
    if daily_loss >= max_daily_loss:
        print(f"⚠️ Daily loss limit reached: {daily_loss}%")
        return False
    
    # Parse entry rules
    entry_type = entry_rules.get('type')
    
    if entry_type == 'indicator_cross':
        # Example: EMA crossover
        indicators = entry_rules.get('indicators', [])
        direction = entry_rules.get('direction', 'above')
        
        # Calculate indicators
        ema_20 = calculate_ema(rates, 20)
        ema_50 = calculate_ema(rates, 50)
        
        # Check crossover
        if direction == 'above':
            # Bullish crossover: EMA20 crosses above EMA50
            if ema_20[-2] < ema_50[-2] and ema_20[-1] > ema_50[-1]:
                return True
        elif direction == 'below':
            # Bearish crossover: EMA20 crosses below EMA50
            if ema_20[-2] > ema_50[-2] and ema_20[-1] < ema_50[-1]:
                return True
    
    return False

def execute_trade(symbol, direction, lot_size, stop_loss=None, take_profit=None, magic_number=0):
    """Execute trade on MT5"""
    
    # Get current price
    tick = mt5.symbol_info_tick(symbol)
    if not tick:
        return None
    
    # Prepare request
    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": lot_size,
        "type": mt5.ORDER_TYPE_BUY if direction == 'BUY' else mt5.ORDER_TYPE_SELL,
        "price": tick.ask if direction == 'BUY' else tick.bid,
        "magic": magic_number,
        "comment": f"Strategy execution",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    
    # Add SL/TP if provided
    if stop_loss:
        if direction == 'BUY':
            request['sl'] = tick.ask - (stop_loss * mt5.symbol_info(symbol).point * 10)
        else:
            request['sl'] = tick.bid + (stop_loss * mt5.symbol_info(symbol).point * 10)
    
    if take_profit:
        if direction == 'BUY':
            request['tp'] = tick.ask + (take_profit * mt5.symbol_info(symbol).point * 10)
        else:
            request['tp'] = tick.bid - (take_profit * mt5.symbol_info(symbol).point * 10)
    
    # Send order
    result = mt5.order_send(request)
    
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        print(f"❌ Trade failed: {result.comment}")
        return None
    
    return result.order

def handle_stop_strategy(command_id, params):
    """Handle STOP_STRATEGY command"""
    strategy_id = params['strategyId']
    
    if strategy_id not in active_strategies:
        report_command_result(command_id, 'executed', {
            'success': True,
            'message': 'Strategy was not running'
        })
        return
    
    strategy_name = active_strategies[strategy_id]['name']
    
    print(f"🛑 Stopping strategy: {strategy_name}")
    
    try:
        # Close all open positions for this strategy
        closed_count = close_strategy_positions(strategy_id)
        
        # Remove from active strategies
        del active_strategies[strategy_id]
        
        # Monitor thread will stop automatically
        if strategy_id in strategy_monitors:
            del strategy_monitors[strategy_id]
        
        # Report success
        report_command_result(command_id, 'executed', {
            'success': True,
            'message': f'Strategy stopped. Closed {closed_count} position(s)',
            'strategyId': strategy_id,
            'closedPositions': closed_count
        })
        
        print(f"✅ Strategy {strategy_name} stopped")
        
    except Exception as e:
        report_command_result(command_id, 'failed', {
            'success': False,
            'message': str(e)
        })

def close_strategy_positions(strategy_id):
    """Close all positions opened by this strategy"""
    magic_number = get_magic_number(strategy_id)
    closed_count = 0
    
    # Get all open positions
    positions = mt5.positions_get()
    if positions is None:
        return 0
    
    for position in positions:
        if position.magic == magic_number:
            # Close position
            request = {
                "action": mt5.TRADE_ACTION_DEAL,
                "position": position.ticket,
                "symbol": position.symbol,
                "volume": position.volume,
                "type": mt5.ORDER_TYPE_SELL if position.type == 0 else mt5.ORDER_TYPE_BUY,
                "price": mt5.symbol_info_tick(position.symbol).bid if position.type == 0 else mt5.symbol_info_tick(position.symbol).ask,
                "magic": magic_number,
                "comment": "Strategy stopped",
            }
            
            result = mt5.order_send(request)
            if result.retcode == mt5.TRADE_RETCODE_DONE:
                closed_count += 1
    
    return closed_count

def report_trade_opened(strategy_id, ticket, trade_data):
    """Report trade opened to platform API"""
    import requests
    
    payload = {
        'strategyId': strategy_id,
        'ticket': str(ticket),
        'symbol': trade_data['symbol'],
        'type': trade_data['type'],
        'lots': trade_data['lots'],
        'openTime': time.time(),
        'openPrice': trade_data.get('openPrice'),
        'stopLoss': trade_data.get('stopLoss'),
        'takeProfit': trade_data.get('takeProfit'),
    }
    
    try:
        response = requests.post(
            f"{API_URL}/trade",
            json=payload,
            headers={
                'X-API-Key': API_KEY,
                'X-API-Secret': API_SECRET
            }
        )
        
        if response.ok:
            print(f"✅ Trade reported to platform: {ticket}")
        else:
            print(f"⚠️ Failed to report trade: {response.text}")
    
    except Exception as e:
        print(f"❌ Error reporting trade: {str(e)}")

# Helper functions
def get_mt5_timeframe(timeframe):
    """Convert string timeframe to MT5 constant"""
    mapping = {
        'M1': mt5.TIMEFRAME_M1,
        'M5': mt5.TIMEFRAME_M5,
        'M15': mt5.TIMEFRAME_M15,
        'M30': mt5.TIMEFRAME_M30,
        'H1': mt5.TIMEFRAME_H1,
        'H4': mt5.TIMEFRAME_H4,
        'D1': mt5.TIMEFRAME_D1,
        'W1': mt5.TIMEFRAME_W1,
    }
    return mapping.get(timeframe, mt5.TIMEFRAME_H1)

def get_check_interval(timeframe):
    """Get check interval in seconds based on timeframe"""
    intervals = {
        'M1': 1,
        'M5': 5,
        'M15': 15,
        'M30': 30,
        'H1': 60,
        'H4': 240,
        'D1': 300,
    }
    return intervals.get(timeframe, 60)

def get_magic_number(strategy_id):
    """Generate magic number from strategy ID"""
    # Use hash of strategy ID
    return hash(strategy_id) % 1000000

def calculate_ema(rates, period):
    """Calculate EMA indicator"""
    import pandas as pd
    closes = pd.Series([r['close'] for r in rates])
    return closes.ewm(span=period, adjust=False).mean().values
```

---

## 🚀 Quick Start for Developers

### Step 1: Setup

```bash
pip install pusher MetaTrader5 requests pandas
```

### Step 2: Configure

```python
# config.py
API_URL = "https://your-platform-url.com/api"
API_KEY = "exe_xxxxx"
API_SECRET = "xxxxx"
PUSHER_KEY = "xxxxx"
PUSHER_CLUSTER = "ap1"
EXECUTOR_ID = "clxxx..."
```

### Step 3: Run

```python
# main.py
from executor import WindowsExecutor

executor = WindowsExecutor(
    api_url=API_URL,
    api_key=API_KEY,
    api_secret=API_SECRET,
    pusher_key=PUSHER_KEY,
    pusher_cluster=PUSHER_CLUSTER,
    executor_id=EXECUTOR_ID
)

executor.start()
```

---

## 📊 Strategy Rules Format

```json
{
  "entry": {
    "type": "indicator_cross",
    "indicators": ["EMA_20", "EMA_50"],
    "direction": "above",
    "confirmation": {
      "type": "volume",
      "threshold": 1.5
    }
  },
  "exit": {
    "type": "opposite_signal",
    "stopLoss": 50,
    "takeProfit": 100,
    "trailingStop": true,
    "trailingStopDistance": 30
  },
  "risk": {
    "lotSize": 0.01,
    "maxRisk": 2,
    "maxDailyLoss": 5,
    "maxOpenTrades": 5,
    "riskRewardRatio": 2
  },
  "filters": {
    "timeRange": {
      "start": "08:00",
      "end": "20:00",
      "timezone": "UTC"
    },
    "daysOfWeek": [1, 2, 3, 4, 5]
  }
}
```

---

## 🎯 Best Practices

1. **Error Handling**
   - Always wrap MT5 operations in try-catch
   - Report errors back to platform
   - Log everything for debugging

2. **Resource Management**
   - Use threading for concurrent strategy monitoring
   - Implement proper cleanup on stop
   - Monitor memory usage

3. **Position Management**
   - Always use magic numbers to identify strategy trades
   - Close positions before stopping strategy
   - Track all open positions

4. **Risk Management**
   - Respect maxDailyLoss limit
   - Check maxOpenTrades before opening
   - Calculate position size based on risk percentage

5. **Performance**
   - Cache indicator calculations
   - Use appropriate check intervals
   - Optimize loops

6. **Communication**
   - Report all trades to platform
   - Send heartbeat every 60 seconds
   - Handle Pusher reconnection

---

## 🎉 Result

Once implemented, users can:

✅ Create strategies in dashboard
✅ Click "Activate Strategy"
✅ Strategy automatically runs on Windows executors
✅ Trades execute based on rules
✅ Monitor performance in real-time
✅ Pause/resume/stop anytime
✅ Track across multiple executors

**Full automation achieved!** 🚀
