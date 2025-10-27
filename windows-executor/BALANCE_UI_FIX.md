# Balance UI Display Fix - $0.00 Issue

## Problem

**User Report**:
- Balance shows `$0.00` in UI
- Positions show `0` in dashboard
- BUT backend logs show correct balance: `$9998.91`
- There ARE open positions

## Root Cause Found

### Issue Location
`src/app/main-controller.ts` line 1575-1590

### Original Code (Problematic):
```typescript
async getMT5AccountInfo() {
  try {
    const accountInfo = this.zeromqServer.getAccountInfo();
    if (accountInfo) {
      return accountInfo;
    }
    return await this.mt5AccountService.getAccountInfo();
  } catch (error) {
    return null;  // ❌ PROBLEM: Returns null
  }
}
```

### Problems:
1. **Order of Checks**: Checks ZeroMQ first (often empty initially)
2. **No Validation**: Doesn't verify if data actually has balance
3. **Returns Null**: UI receives `null`, can't display balance
4. **No Default Values**: No fallback data structure

---

## Data Flow Analysis

```
MT5 EA → ZeroMQ → mt5AccountService → mainController → electronAPI → UI
         (stores)    (fetches)         (getMT5AccountInfo)  (preload)   (Dashboard)
```

### Where It Breaks:

**Scenario A**: ZeroMQ has stale/empty data
```
zeromqServer.getAccountInfo() → { balance: 0, equity: 0 }
Returns immediately with zeros ❌
Never calls mt5AccountService.getAccountInfo()
UI shows $0.00
```

**Scenario B**: Both fail
```
zeromqServer.getAccountInfo() → null
mt5AccountService.getAccountInfo() → throws error
Returns null ❌
UI receives null, shows $0.00
```

**Scenario C**: Timing issue
```
UI loads BEFORE MT5 data fetched
First call returns null/zeros
UI never retries
Shows $0.00 forever
```

---

## Solution Implemented

### Fixed Code:
```typescript
async getMT5AccountInfo() {
  try {
    // 1. Try MT5AccountService FIRST (most reliable)
    try {
      const accountInfo = await this.mt5AccountService.getAccountInfo();
      if (accountInfo && (accountInfo.balance > 0 || accountInfo.equity > 0)) {
        logger.debug('[MainController] Account info from MT5AccountService:', { 
          balance: accountInfo.balance, 
          equity: accountInfo.equity 
        });
        return accountInfo;
      }
    } catch (serviceError) {
      logger.warn('[MainController] MT5AccountService failed:', serviceError);
    }
    
    // 2. Fallback to ZeroMQ server data
    const zmqAccountInfo = this.zeromqServer.getAccountInfo();
    if (zmqAccountInfo && (zmqAccountInfo.balance > 0 || zmqAccountInfo.equity > 0)) {
      logger.debug('[MainController] Account info from ZeroMQ:', { 
        balance: zmqAccountInfo.balance, 
        equity: zmqAccountInfo.equity 
      });
      return zmqAccountInfo;
    }
    
    // 3. Return default structure (NOT null)
    logger.warn('[MainController] No account info available, returning defaults');
    return {
      balance: 0,
      equity: 0,
      margin: 0,
      freeMargin: 0,
      marginLevel: 0,
      profit: 0,
      currency: 'USD',
      leverage: 100,
      accountNumber: 'N/A',
      server: 'N/A',
      company: 'N/A',
      openPositions: 0
    };
  } catch (error) {
    // Return default structure instead of null
    return { balance: 0, equity: 0, ... };
  }
}
```

### Key Improvements:
1. ✅ **Check MT5AccountService FIRST** (most reliable, has caching)
2. ✅ **Validate Data**: Only return if `balance > 0 OR equity > 0`
3. ✅ **ZeroMQ as Fallback**: Use ZMQ data if service fails
4. ✅ **Never Return Null**: Always return proper object structure
5. ✅ **Better Logging**: Debug logs for troubleshooting
6. ✅ **Default Values**: UI always gets valid data structure

---

## Testing Steps

### 1. Rebuild Application
```bash
cd windows-executor
npm run build
```

### 2. Restart Executor
- Close Windows Executor
- Start Windows Executor

### 3. Verify in Dashboard
- Check balance section (should show actual balance)
- Check positions count (should show open positions)
- Check equity (should match MT5)

### 4. Check Logs
```
[MainController] Account info from MT5AccountService: { balance: 9998.91, equity: 9980.02 }
```

Should see this instead of returning zeros.

---

## Expected Behavior

### Before Fix:
```
UI Request → getMT5AccountInfo() → null
Dashboard shows: Balance: $0.00, Equity: $0.00, Positions: 0
```

### After Fix:
```
UI Request → getMT5AccountInfo() → { balance: 9998.91, equity: 9980.02, ... }
Dashboard shows: Balance: $9,998.91, Equity: $9,980.02, Positions: [actual count]
```

---

## Additional Improvements (Optional)

### 1. Force Refresh Button

Add to dashboard:
```typescript
const handleForceRefresh = async () => {
  // Clear cache
  await window.electronAPI.clearAccountCache();
  // Reload
  await loadDashboardData();
};
```

### 2. Real-Time Updates

Replace 30-second polling with real-time updates:
```typescript
useEffect(() => {
  // Listen for account updates
  const unsubscribe = window.electronAPI.onAccountInfoUpdated((data) => {
    setAccountInfo(data);
  });
  
  return unsubscribe;
}, []);
```

### 3. Error Display

Show error state in UI:
```typescript
{!accountInfo && (
  <div className="text-red-600">
    ⚠️ Account data unavailable. Check MT5 connection.
  </div>
)}
```

---

## Troubleshooting

### If Balance Still Shows $0 After Fix:

#### 1. Check EA is Running
```
MT5 → Experts tab → Look for "FX_NusaNexus_Beta"
Should see: "✅ NusaNexus Bridge initialized successfully"
```

#### 2. Check Logs
```
windows-executor/logs/combined.log
Look for: "[MT5AccountService] Account Info: Balance=$..."
```

#### 3. Force Cache Clear
```typescript
// In browser console
await window.electronAPI.clearAccountCache?.();
location.reload();
```

#### 4. Verify Service Order
The new code checks MT5AccountService FIRST because:
- It has 5-second cache (efficient)
- It requests data from EA via ZMQ client (most reliable)
- ZeroMQ server data can be stale

---

## Files Modified

1. ✅ `windows-executor/src/app/main-controller.ts` - Fixed getMT5AccountInfo()

---

## Status

- ✅ Root cause identified
- ✅ Fix implemented
- ⏳ Needs rebuild
- ⏳ Needs testing
- ⏳ Needs verification

---

## Date
2025-10-27

## Related Issues
- Backend logs show correct balance ($9998.91)
- UI shows $0.00
- Open positions not displayed
- Performance issues (separate issue)
