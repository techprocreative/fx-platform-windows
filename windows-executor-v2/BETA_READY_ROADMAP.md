# 🚀 Windows Executor V2 - Beta Ready Roadmap
**Target: Production-Grade Beta with Full Platform Feature Parity**

---

## 📋 Executive Summary

This roadmap ensures Windows Executor V2 is **beta ready** with:
1. All critical security issues fixed
2. Advanced platform features fully implemented
3. Comprehensive error handling
4. Basic testing coverage (60%+)
5. Production-grade monitoring

**Timeline:** 2 weeks (10 working days)
**Priority:** All critical + advanced features

---

## 🔴 Phase 1: Critical Security Fixes (Days 1-2)

### 1.1 Fix CORS Configuration
**Priority: CRITICAL**

**Current Issue:**
```python
# backend/main.py - TOO PERMISSIVE
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ← DANGEROUS!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Fix:**
```python
# backend/main.py
from config import get_settings

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.platform_api_url,  # https://fx.nusanexus.com
        "http://localhost:3000",     # Development only
    ] if settings.debug else [settings.platform_api_url],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
```

### 1.2 Disable Debug Mode in Production
**Priority: CRITICAL**

```python
# backend/config.py
class Settings(BaseModel):
    environment: str = Field(default="production")  # Change default
    debug: bool = Field(default=False)  # Change default to False
    
    # ... rest of config

@lru_cache
def get_settings() -> Settings:
    return Settings(
        environment=os.getenv("WE_V2_ENV", "production"),
        debug=os.getenv("WE_V2_DEBUG", "false").lower() == "true",  # Default false
        # ...
    )
```

### 1.3 Encrypt API Credentials
**Priority: CRITICAL**

```python
# backend/utils/crypto.py
from cryptography.fernet import Fernet
import os
import base64

class CredentialManager:
    def __init__(self):
        # Generate or load encryption key
        key_file = Path.home() / '.windows-executor-v2' / 'key.bin'
        if key_file.exists():
            self.key = key_file.read_bytes()
        else:
            self.key = Fernet.generate_key()
            key_file.parent.mkdir(parents=True, exist_ok=True)
            key_file.write_bytes(self.key)
        self.cipher = Fernet(self.key)
    
    def encrypt(self, value: str) -> str:
        return self.cipher.encrypt(value.encode()).decode()
    
    def decrypt(self, encrypted: str) -> str:
        return self.cipher.decrypt(encrypted.encode()).decode()

# Usage in config.py
credential_mgr = CredentialManager()

@lru_cache
def get_settings() -> Settings:
    api_key = os.getenv("WE_V2_API_KEY")
    if api_key and api_key.startswith("encrypted:"):
        api_key = credential_mgr.decrypt(api_key[10:])
    
    return Settings(
        api_key=api_key,
        # ...
    )
```

### 1.4 Add Rate Limiting
**Priority: HIGH**

```python
# backend/middleware/rate_limiter.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

# In main.py
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Apply to routes
@router.post("/start")
@limiter.limit("5/minute")  # Max 5 strategy starts per minute
async def start_strategy(request: Request, strategy: StrategyConfig):
    # ...
```

---

## 🟡 Phase 2: Advanced Features Implementation (Days 3-7)

### 2.1 Enhanced Partial Exits System
**Priority: HIGH** - Platform has this, executor missing

**Current State:** Basic partial exits exist
**Required:** Full enhanced system from platform

**Implementation:**
```python
# backend/core/enhanced_partial_exits.py
from dataclasses import dataclass
from typing import List, Dict, Optional
from enum import Enum

class TriggerType(Enum):
    PROFIT = "profit"
    TIME = "time"
    PRICE = "price"
    ATR = "atr"
    TRAILING = "trailing"
    REGIME = "regime"

@dataclass
class PartialExitLevel:
    id: str
    name: str
    percentage: float  # 0-100
    trigger_type: TriggerType
    trigger_value: float
    priority: int = 99
    executed: bool = False
    
    # Profit-based
    profit_target: Optional[Dict] = None
    
    # Time-based
    time_target: Optional[Dict] = None
    
    # Trailing
    trailing_target: Optional[Dict] = None
    
    # Regime-based
    regime_target: Optional[Dict] = None

class EnhancedPartialExitManager:
    """Advanced partial exit system matching platform capabilities"""
    
    def __init__(self, mt5_client, regime_detector):
        self.mt5_client = mt5_client
        self.regime_detector = regime_detector
        self.active_levels: Dict[int, List[PartialExitLevel]] = {}
    
    def setup_exit_levels(self, position: Dict, config: Dict) -> List[PartialExitLevel]:
        """Setup multi-trigger partial exit levels"""
        if not config.get("enabled", False):
            return []
        
        levels = []
        for level_config in config.get("levels", []):
            level = self._parse_exit_level(level_config, position)
            levels.append(level)
        
        # Sort by priority
        levels.sort(key=lambda x: x.priority)
        self.active_levels[position["ticket"]] = levels
        
        return levels
    
    def check_exit_triggers(self, position: Dict, current_price: float, 
                           current_time: datetime, market_data: Dict) -> List[Dict]:
        """Check all trigger types for exits"""
        levels = self.active_levels.get(position["ticket"], [])
        executions = []
        
        for level in levels:
            if level.executed:
                continue
            
            triggered = False
            trigger_reason = ""
            
            # Check profit-based triggers
            if level.trigger_type == TriggerType.PROFIT:
                triggered, trigger_reason = self._check_profit_trigger(
                    level, position, current_price
                )
            
            # Check time-based triggers
            elif level.trigger_type == TriggerType.TIME:
                triggered, trigger_reason = self._check_time_trigger(
                    level, position, current_time
                )
            
            # Check trailing triggers
            elif level.trigger_type == TriggerType.TRAILING:
                triggered, trigger_reason = self._check_trailing_trigger(
                    level, position, current_price
                )
            
            # Check ATR triggers
            elif level.trigger_type == TriggerType.ATR:
                triggered, trigger_reason = self._check_atr_trigger(
                    level, position, market_data
                )
            
            # Check regime-based triggers
            elif level.trigger_type == TriggerType.REGIME:
                triggered, trigger_reason = self._check_regime_trigger(
                    level, position
                )
            
            if triggered:
                result = self._execute_partial_exit(position, level, trigger_reason)
                if result.get("success"):
                    executions.append(result)
        
        return executions
    
    def _check_profit_trigger(self, level: PartialExitLevel, 
                              position: Dict, current_price: float) -> tuple[bool, str]:
        """Check if profit target reached"""
        if not level.profit_target:
            return False, ""
        
        entry_price = position.get("openPrice", 0)
        current_profit = (current_price - entry_price) if position["type"] == "BUY" else (entry_price - current_price)
        
        target_type = level.profit_target.get("type", "pips")
        target_value = level.profit_target.get("value", 0)
        
        if target_type == "pips":
            profit_pips = current_profit * 10000  # For 5-digit quotes
            if profit_pips >= target_value:
                return True, f"Profit target reached: {profit_pips:.1f} pips"
        
        elif target_type == "percentage":
            profit_pct = (current_profit / entry_price) * 100
            if profit_pct >= target_value:
                return True, f"Profit percentage reached: {profit_pct:.2f}%"
        
        elif target_type == "rr_ratio":
            stop_distance = abs(entry_price - position.get("stopLoss", entry_price))
            current_profit_abs = abs(current_profit)
            if stop_distance > 0:
                rr_ratio = current_profit_abs / stop_distance
                if rr_ratio >= target_value:
                    return True, f"Risk-reward ratio reached: {rr_ratio:.2f}:1"
        
        return False, ""
    
    def _check_trailing_trigger(self, level: PartialExitLevel,
                                 position: Dict, current_price: float) -> tuple[bool, str]:
        """Check trailing stop trigger"""
        if not level.trailing_target:
            return False, ""
        
        # Track highest/lowest price for trailing
        if "peak_price" not in position:
            position["peak_price"] = current_price
        
        if position["type"] == "BUY":
            if current_price > position["peak_price"]:
                position["peak_price"] = current_price
            
            distance = level.trailing_target.get("distance", 30)
            trigger_price = position["peak_price"] - (distance * 0.0001)
            
            if current_price <= trigger_price:
                return True, f"Trailing stop triggered at {current_price:.5f}"
        else:
            if current_price < position["peak_price"]:
                position["peak_price"] = current_price
            
            distance = level.trailing_target.get("distance", 30)
            trigger_price = position["peak_price"] + (distance * 0.0001)
            
            if current_price >= trigger_price:
                return True, f"Trailing stop triggered at {current_price:.5f}"
        
        return False, ""
    
    def _check_regime_trigger(self, level: PartialExitLevel, 
                              position: Dict) -> tuple[bool, str]:
        """Check if market regime changed"""
        if not level.regime_target:
            return False, ""
        
        current_regime = self.regime_detector.detect_regime(position["symbol"])
        target_regime = level.regime_target.get("regime")
        min_confidence = level.regime_target.get("confidence", 60)
        
        if current_regime.regime == target_regime and current_regime.confidence >= min_confidence:
            action = level.regime_target.get("action", "partial_exit")
            if action == "partial_exit":
                return True, f"Regime changed to {target_regime} (confidence: {current_regime.confidence}%)"
        
        return False, ""
    
    def _execute_partial_exit(self, position: Dict, level: PartialExitLevel,
                              reason: str) -> Dict:
        """Execute the partial exit"""
        try:
            exit_lots = position.get("volume", 0) * (level.percentage / 100)
            
            result = self.mt5_client.close_position_partial(
                ticket=position["ticket"],
                volume=exit_lots
            )
            
            if result.get("success"):
                level.executed = True
                return {
                    "success": True,
                    "level_id": level.id,
                    "level_name": level.name,
                    "exit_lots": exit_lots,
                    "percentage": level.percentage,
                    "trigger_type": level.trigger_type.value,
                    "reason": reason,
                    "timestamp": datetime.now().isoformat()
                }
            
            return {"success": False, "error": result.get("error")}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
```

### 2.2 Smart Exit System Enhancement
**Priority: HIGH**

**Add missing features:**
- Breakeven moves
- Dynamic trailing based on volatility
- Time-based exits
- Session-based exit adjustments

```python
# backend/core/smart_exits_enhanced.py
class SmartExitManagerEnhanced(SmartExitManager):
    """Enhanced smart exits with all platform features"""
    
    def calculate_breakeven_trigger(self, position: Dict, config: Dict) -> Optional[float]:
        """Calculate when to move SL to breakeven"""
        if not config.get("moveToBreakeven", {}).get("enabled", False):
            return None
        
        entry_price = position.get("openPrice", 0)
        stop_loss = position.get("stopLoss", 0)
        stop_distance = abs(entry_price - stop_loss)
        
        trigger_ratio = config.get("moveToBreakeven", {}).get("triggerRatio", 1.0)
        buffer_pips = config.get("moveToBreakeven", {}).get("bufferPips", 2)
        
        trigger_distance = stop_distance * trigger_ratio
        buffer = buffer_pips * 0.0001
        
        if position["type"] == "BUY":
            return entry_price + trigger_distance + buffer
        else:
            return entry_price - trigger_distance - buffer
    
    def should_move_to_breakeven(self, position: Dict, current_price: float,
                                  config: Dict) -> bool:
        """Check if we should move SL to breakeven"""
        trigger_price = self.calculate_breakeven_trigger(position, config)
        if not trigger_price:
            return False
        
        if position["type"] == "BUY":
            return current_price >= trigger_price
        else:
            return current_price <= trigger_price
    
    def calculate_dynamic_trailing(self, position: Dict, current_price: float,
                                    atr: float, config: Dict) -> Optional[float]:
        """Dynamic trailing based on volatility (ATR)"""
        if not config.get("dynamicTrailing", {}).get("enabled", False):
            return None
        
        base_distance = config.get("dynamicTrailing", {}).get("baseDistance", 30)
        atr_multiplier = config.get("dynamicTrailing", {}).get("atrMultiplier", 1.5)
        
        # Adjust trailing distance based on volatility
        dynamic_distance = (base_distance * 0.0001) + (atr * atr_multiplier)
        
        if position["type"] == "BUY":
            new_stop = current_price - dynamic_distance
            if new_stop > position.get("stopLoss", 0):
                return new_stop
        else:
            new_stop = current_price + dynamic_distance
            if new_stop < position.get("stopLoss", 0):
                return new_stop
        
        return None
```

### 2.3 Proper DELETE Endpoint
**Priority: CRITICAL**

```python
# backend/api/strategies.py
@router.delete("/{strategy_id}/permanent", summary="Delete strategy permanently")
async def delete_strategy_permanent(strategy_id: str):
    """Permanently delete strategy from database and stop if running"""
    from database import session_scope
    from database.models import StoredStrategy, TradeLog
    
    # Stop strategy if running
    status = await strategy_executor.stop_strategy(strategy_id)
    was_running = status is not None
    
    # Delete from database
    try:
        with session_scope() as session:
            # Delete trade logs first (foreign key)
            logs_deleted = session.query(TradeLog).filter(
                TradeLog.strategy_id == strategy_id
            ).delete(synchronize_session=False)
            
            # Delete strategy
            strategy_deleted = session.query(StoredStrategy).filter(
                StoredStrategy.id == strategy_id
            ).delete(synchronize_session=False)
            
            if strategy_deleted == 0:
                raise HTTPException(
                    status_code=404,
                    detail="Strategy not found in database"
                )
        
        return {
            "success": True,
            "message": f"Strategy {strategy_id} deleted permanently",
            "strategy_deleted": strategy_deleted,
            "trade_logs_deleted": logs_deleted,
            "was_running": was_running
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete strategy: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete strategy: {str(e)}"
        )


@router.delete("/batch", summary="Delete multiple strategies")
async def delete_strategies_batch(strategy_ids: List[str]):
    """Delete multiple strategies at once"""
    from database import session_scope
    from database.models import StoredStrategy, TradeLog
    
    results = {
        "success": [],
        "failed": [],
        "total": len(strategy_ids)
    }
    
    for strategy_id in strategy_ids:
        try:
            # Stop if running
            await strategy_executor.stop_strategy(strategy_id)
            
            # Delete from database
            with session_scope() as session:
                session.query(TradeLog).filter(
                    TradeLog.strategy_id == strategy_id
                ).delete(synchronize_session=False)
                
                deleted = session.query(StoredStrategy).filter(
                    StoredStrategy.id == strategy_id
                ).delete(synchronize_session=False)
                
                if deleted > 0:
                    results["success"].append(strategy_id)
                else:
                    results["failed"].append({
                        "id": strategy_id,
                        "reason": "Not found"
                    })
        except Exception as e:
            results["failed"].append({
                "id": strategy_id,
                "reason": str(e)
            })
    
    return results
```

### 2.4 Advanced Risk Management
**Priority: HIGH**

```python
# backend/core/advanced_risk_manager.py
class AdvancedRiskManager(RiskManager):
    """Enhanced risk management with all platform features"""
    
    def __init__(self):
        super().__init__()
        self.daily_trades = {}
        self.daily_loss = {}
        self.drawdown_tracker = {}
    
    def can_open_position(self, account_info: Dict, risk_rules: Dict,
                          symbol: str, current_positions: List[Dict]) -> tuple[bool, str]:
        """Comprehensive risk checks"""
        
        # Check max positions
        max_positions = risk_rules.get("maxPositions", 3)
        if len(current_positions) >= max_positions:
            return False, f"Max positions reached ({max_positions})"
        
        # Check max daily loss
        max_daily_loss = risk_rules.get("maxDailyLoss", 0)
        if max_daily_loss > 0:
            today = datetime.now().date()
            daily_loss = self.daily_loss.get(today, 0)
            if daily_loss >= max_daily_loss:
                return False, f"Max daily loss reached (${daily_loss:.2f})"
        
        # Check max trades per day
        max_daily_trades = risk_rules.get("maxDailyTrades", 0)
        if max_daily_trades > 0:
            today = datetime.now().date()
            trades_today = self.daily_trades.get(today, 0)
            if trades_today >= max_daily_trades:
                return False, f"Max daily trades reached ({trades_today})"
        
        # Check max drawdown
        max_drawdown = risk_rules.get("maxDrawdown", 0)
        if max_drawdown > 0:
            current_dd = self._calculate_current_drawdown(account_info)
            if current_dd >= max_drawdown:
                return False, f"Max drawdown reached ({current_dd:.2f}%)"
        
        # Check symbol exposure
        max_per_symbol = risk_rules.get("maxPositionsPerSymbol", 2)
        symbol_positions = [p for p in current_positions if p.get("symbol") == symbol]
        if len(symbol_positions) >= max_per_symbol:
            return False, f"Max positions for {symbol} reached ({max_per_symbol})"
        
        # Check correlation risk
        if risk_rules.get("correlationCheck", {}).get("enabled", False):
            correlation_risk = self._check_correlation_risk(
                symbol, current_positions, risk_rules.get("correlationCheck", {})
            )
            if not correlation_risk["passed"]:
                return False, correlation_risk["reason"]
        
        return True, "All risk checks passed"
    
    def register_trade(self, symbol: str, profit: float):
        """Track trades for daily limits"""
        today = datetime.now().date()
        
        # Update trade count
        self.daily_trades[today] = self.daily_trades.get(today, 0) + 1
        
        # Update loss tracking
        if profit < 0:
            self.daily_loss[today] = self.daily_loss.get(today, 0) + abs(profit)
        
        # Cleanup old days
        self._cleanup_old_data()
    
    def _calculate_current_drawdown(self, account_info: Dict) -> float:
        """Calculate current drawdown percentage"""
        balance = account_info.get("balance", 0)
        equity = account_info.get("equity", 0)
        
        if balance <= 0:
            return 0.0
        
        drawdown = ((balance - equity) / balance) * 100
        return max(0, drawdown)
    
    def _check_correlation_risk(self, symbol: str, current_positions: List[Dict],
                                 config: Dict) -> Dict:
        """Check correlation with existing positions"""
        max_correlated = config.get("maxCorrelatedPositions", 2)
        correlation_threshold = config.get("threshold", 0.7)
        
        # Simplified correlation check (should use actual correlation data)
        same_base = [p for p in current_positions 
                     if p.get("symbol", "")[:3] == symbol[:3]]
        
        if len(same_base) >= max_correlated:
            return {
                "passed": False,
                "reason": f"Too many correlated positions ({len(same_base)})"
            }
        
        return {"passed": True}
    
    def _cleanup_old_data(self):
        """Remove data older than 7 days"""
        cutoff = datetime.now().date() - timedelta(days=7)
        
        self.daily_trades = {
            date: count for date, count in self.daily_trades.items()
            if date >= cutoff
        }
        
        self.daily_loss = {
            date: loss for date, loss in self.daily_loss.items()
            if date >= cutoff
        }
```

---

## 🟢 Phase 3: Error Handling & Retry Mechanisms (Days 8-9)

### 3.1 Circuit Breaker Pattern
**Priority: HIGH**

```python
# backend/utils/circuit_breaker.py
from enum import Enum
from datetime import datetime, timedelta
from collections import deque

class CircuitState(Enum):
    CLOSED = "closed"  # Normal operation
    OPEN = "open"      # Blocking calls
    HALF_OPEN = "half_open"  # Testing recovery

class CircuitBreaker:
    """Circuit breaker pattern for external service calls"""
    
    def __init__(self, failure_threshold=5, timeout=60, name="default"):
        self.failure_threshold = failure_threshold
        self.timeout = timeout  # seconds
        self.name = name
        
        self.failure_count = 0
        self.last_failure_time = None
        self.state = CircuitState.CLOSED
        self.failure_window = deque(maxlen=10)
    
    def call(self, func, *args, **kwargs):
        """Execute function with circuit breaker protection"""
        if self.state == CircuitState.OPEN:
            if self._should_attempt_reset():
                self.state = CircuitState.HALF_OPEN
                logger.info(f"Circuit {self.name} entering HALF_OPEN state")
            else:
                raise CircuitBreakerError(
                    f"Circuit {self.name} is OPEN. Service unavailable."
                )
        
        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise
    
    def _on_success(self):
        """Record successful call"""
        self.failure_count = 0
        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.CLOSED
            logger.info(f"Circuit {self.name} recovered to CLOSED state")
    
    def _on_failure(self):
        """Record failed call"""
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        self.failure_window.append(datetime.now())
        
        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN
            logger.warning(f"Circuit {self.name} opened after {self.failure_count} failures")
    
    def _should_attempt_reset(self) -> bool:
        """Check if enough time passed to attempt reset"""
        if not self.last_failure_time:
            return True
        
        elapsed = (datetime.now() - self.last_failure_time).total_seconds()
        return elapsed >= self.timeout

class CircuitBreakerError(Exception):
    pass

# Usage in platform_api.py
mt5_circuit = CircuitBreaker(failure_threshold=5, timeout=60, name="mt5")
platform_circuit = CircuitBreaker(failure_threshold=3, timeout=30, name="platform")

async def fetch_with_circuit_breaker(url: str, **kwargs):
    return platform_circuit.call(
        lambda: httpx.get(url, **kwargs)
    )
```

### 3.2 Retry with Exponential Backoff
**Priority: HIGH**

```python
# backend/utils/retry.py
import asyncio
from functools import wraps
from typing import Callable, Type, Tuple

def async_retry(
    max_attempts: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
    on_retry: Callable = None
):
    """Retry decorator with exponential backoff"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            delay = initial_delay
            last_exception = None
            
            for attempt in range(1, max_attempts + 1):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    
                    if attempt == max_attempts:
                        logger.error(
                            f"Failed after {max_attempts} attempts: {func.__name__}",
                            exc_info=True
                        )
                        raise
                    
                    logger.warning(
                        f"Attempt {attempt}/{max_attempts} failed for {func.__name__}: {e}. "
                        f"Retrying in {delay}s..."
                    )
                    
                    if on_retry:
                        on_retry(attempt, delay, e)
                    
                    await asyncio.sleep(delay)
                    delay = min(delay * exponential_base, max_delay)
            
            raise last_exception
        
        return wrapper
    return decorator

# Usage
@async_retry(max_attempts=3, initial_delay=1.0, exceptions=(httpx.HTTPError,))
async def fetch_strategy_from_platform(strategy_id: str):
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{platform_url}/api/strategies/{strategy_id}")
        response.raise_for_status()
        return response.json()
```

---

## 🔵 Phase 4: Testing & Documentation (Day 10)

### 4.1 Unit Tests (Target: 60% coverage)

```python
# backend/tests/test_advanced_features.py
import pytest
from backend.core.enhanced_partial_exits import EnhancedPartialExitManager, TriggerType
from backend.core.advanced_risk_manager import AdvancedRiskManager

class TestEnhancedPartialExits:
    def test_profit_trigger(self):
        manager = EnhancedPartialExitManager(mock_mt5, mock_regime)
        position = {
            "ticket": 123,
            "type": "BUY",
            "openPrice": 1.1000,
            "volume": 1.0
        }
        
        level = PartialExitLevel(
            id="1",
            name="First Exit",
            percentage=50,
            trigger_type=TriggerType.PROFIT,
            profit_target={"type": "pips", "value": 30}
        )
        
        # Should trigger at 1.1030
        triggered, reason = manager._check_profit_trigger(level, position, 1.1030)
        assert triggered == True
        assert "30" in reason
    
    def test_trailing_trigger(self):
        # Test trailing stop logic
        pass
    
    def test_regime_trigger(self):
        # Test regime-based exits
        pass

class TestAdvancedRiskManager:
    def test_daily_loss_limit(self):
        risk_mgr = AdvancedRiskManager()
        account = {"balance": 10000, "equity": 10000}
        rules = {"maxDailyLoss": 200}
        
        # Register losing trade
        risk_mgr.register_trade("EURUSD", -150)
        
        # Should still allow
        can_trade, reason = risk_mgr.can_open_position(account, rules, "EURUSD", [])
        assert can_trade == True
        
        # Register another loss
        risk_mgr.register_trade("GBPUSD", -60)
        
        # Should block now
        can_trade, reason = risk_mgr.can_open_position(account, rules, "EURUSD", [])
        assert can_trade == False
        assert "daily loss" in reason.lower()
    
    def test_max_positions_per_symbol(self):
        # Test symbol exposure limits
        pass
```

### 4.2 Integration Tests

```python
# backend/tests/test_api_integration.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_strategy_lifecycle():
    """Test complete strategy lifecycle"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # 1. Start strategy
        response = await client.post("/api/strategies/start", json={
            "strategyId": "test-123",
            "strategyName": "Test Strategy",
            "symbol": "EURUSD",
            "timeframe": "H1",
            "rules": {...}
        })
        assert response.status_code == 200
        
        # 2. Check status
        response = await client.get("/api/strategies")
        assert len(response.json()) == 1
        
        # 3. Stop strategy
        response = await client.post("/api/strategies/stop/test-123")
        assert response.status_code == 200
        
        # 4. Delete permanently
        response = await client.delete("/api/strategies/test-123/permanent")
        assert response.status_code == 200
        assert response.json()["success"] == True
        
        # 5. Verify deleted
        response = await client.get("/api/strategies")
        assert len(response.json()) == 0
```

---

## 📦 Phase 5: Build & Deployment (Final Check)

### 5.1 Update .env Template

```bash
# .env.example
# Platform URL (HARDCODED - DO NOT CHANGE)
WE_V2_PLATFORM_URL=https://fx.nusanexus.com

# REQUIRED: Your API Credentials
WE_V2_API_KEY=your_api_key_here
WE_V2_API_SECRET=your_api_secret_here
WE_V2_EXECUTOR_ID=executor_001

# Optional: MT5 Terminal Path (auto-detect if empty)
WE_V2_MT5_PATH=

# Network Settings
WE_V2_API_HOST=127.0.0.1
WE_V2_API_PORT=8081

# Production Settings (IMPORTANT!)
WE_V2_ENV=production
WE_V2_DEBUG=false  # MUST be false for production

# Security (Advanced)
WE_V2_RATE_LIMIT_ENABLED=true
WE_V2_MAX_REQUESTS_PER_MINUTE=60
```

### 5.2 Build Scripts Update

```batch
REM build-for-beta.bat
@echo off
echo ========================================
echo Windows Executor V2 - Beta Build
echo ========================================
echo.

REM Set production environment
set WE_V2_ENV=production
set WE_V2_DEBUG=false

echo [1/4] Running tests...
pytest backend/tests --cov=backend --cov-report=html

echo.
echo [2/4] Building backend...
cd backend
pyinstaller build-backend.spec
cd ..

echo.
echo [3/4] Building frontend...
cd frontend
npm run build
cd ..

echo.
echo [4/4] Creating installer...
npm run build:installer

echo.
echo ========================================
echo Beta build complete!
echo ========================================
pause
```

---

## ✅ Beta Ready Checklist

### Critical (Must Have)
- [ ] CORS fixed to specific origins
- [ ] Debug mode disabled by default
- [ ] API credentials encrypted
- [ ] Rate limiting implemented
- [ ] DELETE endpoint implemented
- [ ] Enhanced partial exits system
- [ ] Advanced risk management
- [ ] Circuit breaker pattern
- [ ] Retry mechanisms
- [ ] Unit tests (60%+ coverage)

### Important (Should Have)
- [ ] Integration tests
- [ ] Smart exits enhancements
- [ ] Breakeven moves
- [ ] Dynamic trailing
- [ ] Error reporting to platform
- [ ] Performance monitoring
- [ ] Comprehensive logging

### Nice to Have (Can Defer)
- [ ] PostgreSQL migration
- [ ] Load testing results
- [ ] APM integration
- [ ] A/B testing framework

---

## 🚀 Deployment Strategy

### Beta Release Phases

**Phase 1: Internal Testing (Week 1)**
- Deploy to 3-5 internal testers
- Monitor logs daily
- Fix critical bugs immediately

**Phase 2: Limited Beta (Week 2)**
- Deploy to 10 beta users
- Collect feedback
- Monitor performance

**Phase 3: Public Beta (Week 3+)**
- Deploy to 20-50 users
- Full monitoring active
- Regular updates

---

## 📊 Success Metrics

### Performance Targets
- API response time: < 200ms (p95)
- Strategy execution time: < 1s
- Database query time: < 50ms
- Uptime: > 99.5%

### Quality Targets
- Test coverage: > 60%
- Critical bugs: 0
- Security vulnerabilities: 0
- User-reported issues: < 5/week

---

**Timeline Summary:**
- Days 1-2: Critical security fixes
- Days 3-7: Advanced features implementation
- Days 8-9: Error handling & testing
- Day 10: Final testing & deployment prep

**Total: 2 weeks to beta-ready production grade**
