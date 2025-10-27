# Balance Reading Analysis

## Current Status

### ✅ Balance IS Being Read Successfully

From logs (`combined.log`):
```log
[MT5AccountService] Account Info: Balance=$9998.91, Equity=$9980.02
[MT5AccountService] Account Info: Balance=$9998.91, Equity=$9979.24
[MT5AccountService] Account Info: Balance=$9998.91, Equity=$9979.37
```

**Balance**: $9998.91  
**Equity**: $9979.02 - $9980.02  
**Status**: ✅ Data is being retrieved successfully

---

## Implementation Flow

### 1. **MT5AccountService.getAccountInfo()**

Located: `src/services/mt5-account.service.ts`

**Process**:
```typescript
1. Check cache (5 second TTL)
2. If cache expired → fetchAccountInfoFromMT5()
3. Return account data
```

### 2. **fetchAccountInfoFromMT5() - Two Methods**

#### Method A: ZeroMQ Client Request (Primary)
```typescript
if (this.zeromqClient && this.zeromqClient.isConnected()) {
  const response = await this.zeromqClient.sendRequest({
    command: 'GET_ACCOUNT',  // Send to EA
    requestId: `account_${Date.now()}`
  }, 3000);
  
  if (response && response.status === 'OK') {
    return response.data; // Real data from MT5
  }
}
```

#### Method B: ZeroMQ Server Fallback (Secondary)
```typescript
const accountData = this.zeromqServer.getAccountInfo();

if (!accountData) {
  // Return zeros if no data
  return { balance: 0, equity: 0, ... };
}

return accountData; // Cached data from server
```

### 3. **EA Response** (`FX_NusaNexus_Beta.mq5`)

```mql5
string GetAccountInfoJSON()
{
   string json = "{\"status\":\"OK\",\"data\":{";
   json += "\"balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",";
   json += "\"equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + ",";
   json += "\"margin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN), 2) + ",";
   json += "\"freeMargin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_FREE), 2) + ",";
   json += "\"profit\":" + DoubleToString(AccountInfoDouble(ACCOUNT_PROFIT), 2);
   json += "}}";
   return json;
}
```

---

## Possible Issues

### Issue 1: Balance Shows $0 in UI (But Correct in Logs)

**Symptoms**:
- Logs show correct balance: `$9998.91`
- UI displays: `$0.00` or `N/A`

**Cause**:
- UI not updating from service
- Dashboard component not calling getAccountInfo()
- API endpoint not exposing balance

**Solution**: Check dashboard component

### Issue 2: Balance Not Updating (Stale Data)

**Symptoms**:
- Balance shows old/incorrect value
- Doesn't reflect recent trades

**Cause**:
- Cache not expiring (5 second TTL)
- EA not sending updated data
- ZeroMQ connection issue

**Solution**: 
```typescript
mt5AccountService.clearCache(); // Force refresh
```

### Issue 3: Balance Returns $0

**Symptoms**:
- Logs show: `Balance=$0.00`
- No data from MT5

**Cause**:
- EA not attached to MT5 chart
- ZeroMQ connection down
- No GET_ACCOUNT command handler in EA

**Current Status**: ❌ **NOT THIS ISSUE** (balance is $9998.91)

---

## Verification Checklist

Based on logs, balance IS being read. Check these:

### ✅ Backend (Working)
- [x] MT5 connection active
- [x] ZeroMQ server running
- [x] EA sending account data
- [x] Balance being logged: `$9998.91`

### ❓ Frontend (Need to Check)
- [ ] Dashboard component fetching balance
- [ ] API endpoint returning balance
- [ ] UI displaying balance correctly
- [ ] Real-time updates working

---

## Next Steps to Diagnose

### 1. Check UI Display

**Where is balance supposed to appear?**
- Dashboard top section?
- Account info widget?
- Header?

### 2. Check Dashboard Component

File: `src/app/pages/DashboardSimple.tsx`

Look for:
```typescript
// How balance is fetched
const [accountInfo, setAccountInfo] = useState<MT5AccountInfo | null>(null);

// API call
const fetchAccountInfo = async () => {
  const data = await mt5AccountService.getAccountInfo();
  setAccountInfo(data);
};
```

### 3. Check API Endpoint

Is there an API endpoint exposing balance?
```typescript
// Example: /api/account/balance
router.get('/account/balance', async (req, res) => {
  const accountInfo = await mt5AccountService.getAccountInfo();
  res.json(accountInfo);
});
```

### 4. Check Real-Time Updates

Is there a heartbeat updating balance periodically?
```typescript
setInterval(async () => {
  const accountInfo = await mt5AccountService.getAccountInfo();
  // Update UI
}, 5000); // Every 5 seconds
```

---

## Quick Fixes

### Fix 1: Force Refresh Balance

```typescript
// In dashboard component
useEffect(() => {
  const interval = setInterval(async () => {
    mt5AccountService.clearCache(); // Clear cache
    const data = await mt5AccountService.getAccountInfo();
    setAccountInfo(data);
  }, 5000);
  
  return () => clearInterval(interval);
}, []);
```

### Fix 2: Add Logging in UI

```typescript
const fetchBalance = async () => {
  console.log('Fetching balance...');
  const data = await mt5AccountService.getAccountInfo();
  console.log('Balance data:', data);
  setAccountInfo(data);
};
```

### Fix 3: Check Dashboard Component State

Add to `DashboardSimple.tsx`:
```typescript
console.log('Account Info State:', accountInfo);
console.log('Balance:', accountInfo?.balance);
```

---

## Summary

**Current Status**:
- ✅ Balance IS being retrieved from MT5: `$9998.91`
- ✅ Backend logging shows correct data
- ❓ Need to verify: Where user expects to see balance?

**Most Likely Issue**:
- UI component not fetching/displaying balance
- Dashboard not calling `getAccountInfo()`
- API endpoint missing or not connected to UI

**Next Action Required**:
1. Clarify where balance should appear (which screen/component?)
2. Check if it's showing $0 or not showing at all
3. Inspect dashboard component code
4. Add console logging to track data flow

---

## Date
2025-10-27

## Logs Checked
- `combined.log`: Shows balance $9998.91 ✅
- `error.log`: No balance-related errors ✅
- `trading.log`: Shows account info updates ✅
