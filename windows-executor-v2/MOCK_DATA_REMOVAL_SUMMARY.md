# Mock Data Removal Summary
**Windows Executor V2 - Clean Real Data Implementation**

## 📊 Analysis Results

### ✅ Production Backend (CORRECT)

**File: `backend/main.py`** (used by installer via `start_backend.py`)
- ✅ No mock strategies
- ✅ No mock account data
- ✅ Only uses real data from:
  - MT5 connection (if available)
  - Web platform API
  - Local database (strategies that were started)

**Code verification:**
```python
# backend/api/strategies.py
@router.get("/", response_model=List[StrategyStatus], summary="Active strategies")
async def list_strategies():
    """List currently running strategies in executor."""
    return await strategy_executor.list_statuses()  # From memory, not mock

@router.get("/available", summary="Get available strategies from platform")
async def get_available_strategies() -> List[Dict[str, Any]]:
    """Fetch user's strategies from web platform."""
    strategies = await platform_api.fetch_user_strategies()  # Real API call
    return strategies
```

### ❌ Development/Backup Files (FIXED)

**File: `backend/backend_stable.py`**
- ❌ **HAD** mock data: "Demo Strategy 1", "Demo Strategy 2"
- ✅ **FIXED**: Removed mock data, now returns empty list

**Before:**
```python
# Add demo strategies if none found
if not strategies:
    strategies = [
        {"id": "1", "name": "Demo Strategy 1", "status": "inactive", "symbol": "EURUSD", "timeframe": "M5"},
        {"id": "2", "name": "Demo Strategy 2", "status": "inactive", "symbol": "GBPUSD", "timeframe": "M15"}
    ]
```

**After:**
```python
# DO NOT return mock data - return empty list if no strategies from database
return strategies
```

**File: `backend/backend_simple.py`**
- ❌ Has mock data (but NOT used in production build)
- ℹ️ Left as-is for development/testing purposes only

---

## 🔍 Why User Sees Mock Strategies

### Root Cause
User sees strategies in installed application NOT because of mock data in code, but because of **local database persistence**.

### How It Happens

1. **During development/testing:**
   ```
   User runs backend → Strategies created → Saved to local database
   ```

2. **Database location:**
   ```
   C:\Users\[USERNAME]\AppData\Local\WindowsExecutorV2\windows_executor_v2.db
   ```

3. **On app startup:**
   ```python
   # backend/api/strategies.py
   async def list_strategies():
       return await strategy_executor.list_statuses()
   
   # Reads from memory (active_strategies dict)
   # Which is populated from database on startup
   ```

4. **Database persistence code:**
   ```python
   # backend/core/strategy_executor.py
   async def start_strategy(self, strategy: StrategyConfig):
       # Stores strategy in memory
       self.active_strategies[strategy.id] = {...}
       
       # AND persists to database
       self._persist_strategy(strategy)  # ← Saves to SQLite
   ```

### The Difference

**Two separate endpoints:**

| Endpoint | Data Source | Purpose |
|----------|-------------|---------|
| `GET /api/strategies` | Local database + Memory | **Running strategies** in executor |
| `GET /api/strategies/available` | Web platform API | **Available strategies** from platform |

Frontend shows both:
- **"🟢 Running Strategies"** → From local database (old data persists)
- **"📚 Available Strategies"** → From web platform (always fresh)

---

## ✅ Solution for Users

### Quick Fix: Delete Local Database

**Option 1: PowerShell Script (Recommended)**
```powershell
# Run this script
powershell -ExecutionPolicy Bypass -File clean-user-executor-db.ps1
```

**Option 2: Manual Delete**
1. Close Windows Executor V2 completely
2. Press `Win + R`, type: `%LOCALAPPDATA%\WindowsExecutorV2`
3. Delete file: `windows_executor_v2.db`
4. Restart application

**Option 3: Command Line**
```batch
del /f "%LOCALAPPDATA%\WindowsExecutorV2\windows_executor_v2.db"
```

### Verify After Clean

After cleanup, user should see:
- ✅ **"Running Strategies"** = Empty
- ✅ **"Available Strategies"** = Real strategies from web platform
- ✅ No mock/demo strategies

---

## 📋 Technical Details

### Database Schema

```python
class StoredStrategy(Base):
    __tablename__ = "strategies"
    
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    symbol = Column(String, nullable=False)
    timeframe = Column(String, nullable=False)
    payload = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
```

### Strategy Lifecycle

1. **Start Strategy:**
   ```
   Frontend → POST /api/strategies/start
   → strategy_executor.start_strategy()
   → Saved to memory (active_strategies)
   → Persisted to database (_persist_strategy)
   ```

2. **Stop Strategy:**
   ```
   Frontend → DELETE /api/strategies/{id}
   → strategy_executor.stop_strategy()
   → Status changed to "stopped" in memory
   → BUT NOT DELETED from database! ← ISSUE
   ```

3. **List Strategies:**
   ```
   Frontend → GET /api/strategies
   → strategy_executor.list_statuses()
   → Returns all strategies from memory
   → Memory populated from database on startup
   ```

### Why Old Data Persists

**Problem:** `stop_strategy()` does NOT delete from database

```python
# backend/core/strategy_executor.py
async def stop_strategy(self, strategy_id: str):
    data = self.active_strategies.get(strategy_id)
    if not data:
        return None
    data["status"] = "stopped"  # ← Only changes status
    # Does NOT call: session.delete(StoredStrategy)
    return self._build_status(strategy_id)
```

**Solution:** See `FIX_DELETE_ENDPOINT.md` for implementing proper delete

---

## 🛠️ Files Created for User

1. **`CLEAN_USER_DATABASE.md`**
   - Complete documentation
   - Multiple cleanup methods
   - Troubleshooting guide

2. **`clean-user-executor-db.ps1`**
   - Interactive PowerShell script
   - Safe deletion with confirmations
   - Process killing if needed
   - Logs cleanup option

3. **`FIX_DELETE_ENDPOINT.md`** (already exists)
   - How to add proper DELETE endpoint
   - Hard delete vs soft delete options
   - Migration scripts

---

## 🔄 Future Prevention

### Option 1: Disable Local Persistence

Edit `backend/core/strategy_executor.py`:

```python
def _persist_strategy(self, strategy: StrategyConfig) -> None:
    # Disabled - strategies only in memory, not persisted
    # This ensures clean state on every restart
    return
```

**Pros:**
- ✅ No old data persists
- ✅ Always clean state

**Cons:**
- ❌ Strategies don't survive backend restart
- ❌ Need to re-start strategies manually after crash

### Option 2: Auto-Clean Stopped Strategies

Add cleanup on shutdown:

```python
# backend/main.py
async def lifespan(app: FastAPI):
    try:
        yield
    finally:
        # Clean stopped strategies from database
        with session_scope() as session:
            session.query(StoredStrategy).filter(
                StoredStrategy.id.in_(
                    [sid for sid, data in strategy_executor.active_strategies.items()
                     if data["status"] == "stopped"]
                )
            ).delete()
```

### Option 3: Implement Proper DELETE Endpoint

See `FIX_DELETE_ENDPOINT.md` for full implementation.

---

## 📝 Summary

| Issue | Status | Solution |
|-------|--------|----------|
| Mock data in production code | ✅ No mock data | Verified `main.py` is clean |
| Mock data in backup files | ✅ Fixed | Removed from `backend_stable.py` |
| Old strategies persist | ✅ Documented | User cleanup script provided |
| No proper DELETE endpoint | ⚠️ Needs fix | See `FIX_DELETE_ENDPOINT.md` |

**For users seeing old strategies:**
1. Run `clean-user-executor-db.ps1`
2. Or manually delete `%LOCALAPPDATA%\WindowsExecutorV2\windows_executor_v2.db`
3. Restart application
4. ✅ Should show only real platform strategies

**For developers:**
1. ✅ Production backend (`main.py`) is clean
2. ✅ Backup files cleaned
3. ⚠️ Consider implementing proper DELETE endpoint
4. ⚠️ Consider auto-cleanup or disable persistence
