# EA Symbol Error Fix - Error 4301

## Problem
```
2025.10.27 09:31:56.139	FX_NusaNexus_Beta (XAUUSDm,M15)	❌ Failed to copy rates: Error 4301
```

**Error 4301** = `ERR_UNKNOWN_SYMBOL` - Symbol tidak ditemukan di broker

## Root Cause
- EA mencoba mengakses data untuk "XAUUSDm" 
- Broker Anda mungkin menggunakan nama symbol yang berbeda:
  - `XAUUSD` (tanpa 'm')
  - `GOLD`
  - `XAUUSDmicro`
  - `GOLD.m`
  - dll.

## Solutions

### Solution 1: Check Symbol Name di Market Watch (RECOMMENDED)

1. **Buka MT5**
2. **Tekan Ctrl+U** untuk membuka Market Watch
3. **Cari GOLD/XAUUSD** di list
4. **Catat nama symbol yang PERSIS** (case-sensitive)

**Examples**:
- Exness: `XAUUSD`
- IC Markets: `XAUUSD`
- FBS: `GOLD`
- Tickmill: `XAUUSD.`
- XM: `GOLD`

### Solution 2: Update Strategy Symbol

Jika symbol di broker adalah `XAUUSD` (bukan `XAUUSDm`):

**Di Web Platform**:
1. Go to: `/dashboard/strategies`
2. Edit strategy yang menggunakan XAUUSDm
3. Change symbol dari `XAUUSDm` ke `XAUUSD` (atau nama yang benar)
4. Save strategy

### Solution 3: Add Symbol Validation (Patch EA)

Tambahkan validasi di EA sebelum CopyRates:

```mql5
//+------------------------------------------------------------------+
//| Get historical bars with symbol validation                       |
//+------------------------------------------------------------------+
string GetHistoricalBars(string request)
{
   // Parse parameters from JSON request
   string symbol = ParseStringParam(request, "symbol");
   string timeframeStr = ParseStringParam(request, "timeframe");
   int barsCount = (int)ParseNumberParam(request, "bars");
   
   // Default values if parsing fails
   if(symbol == "") symbol = Symbol();
   if(barsCount <= 0) barsCount = 100;
   
   // ===== NEW: Validate symbol exists =====
   if(!SymbolSelect(symbol, true))
   {
      // Try common variations
      string variations[];
      ArrayResize(variations, 5);
      variations[0] = symbol;  // Original
      variations[1] = StringSubstr(symbol, 0, StringLen(symbol)-1);  // Remove last char (XAUUSDm -> XAUUSD)
      variations[2] = symbol + ".";  // Add dot suffix
      variations[3] = "GOLD";  // Common alternative
      variations[4] = "XAUUSD";  // Standard name
      
      bool found = false;
      for(int i = 0; i < ArraySize(variations); i++)
      {
         if(SymbolSelect(variations[i], true))
         {
            Print("✓ Symbol found: ", variations[i], " (original: ", symbol, ")");
            symbol = variations[i];
            found = true;
            break;
         }
      }
      
      if(!found)
      {
         string errorMsg = "Symbol not found: " + symbol + ". Please check Market Watch.";
         Print("❌ ", errorMsg);
         return "{\"status\":\"ERROR\",\"message\":\"" + errorMsg + "\",\"error\":4301}";
      }
   }
   // ===== END NEW CODE =====
   
   // Convert timeframe string to ENUM_TIMEFRAMES
   ENUM_TIMEFRAMES timeframe = StringToTimeframe(timeframeStr);
   
   Print("📊 GET_BARS: ", symbol, " ", EnumToString(timeframe), " Bars=", barsCount);
   
   // Get bars from MT5
   MqlRates rates[];
   int copied = CopyRates(symbol, timeframe, 0, barsCount, rates);
   
   if(copied <= 0)
   {
      int error = GetLastError();
      string errorMsg = "Failed to copy rates: Error " + IntegerToString(error);
      Print("❌ ", errorMsg);
      Print("   Symbol: ", symbol, " | Timeframe: ", EnumToString(timeframe));
      Print("   Try adding symbol to Market Watch manually");
      return "{\"status\":\"ERROR\",\"message\":\"" + errorMsg + "\",\"error\":" + IntegerToString(error) + "}";
   }
   
   // ... rest of the function remains the same
}
```

### Solution 4: Quick Fix via MT5 Terminal

1. **Buka MT5**
2. **Tekan Ctrl+U** (Market Watch)
3. **Right-click** di Market Watch window
4. **Select: "Show All" or "Symbols"**
5. **Cari GOLD/XAUUSD** dan **enable** checkmark
6. **Close** symbols window
7. **Restart EA** (Remove dan attach lagi)

### Solution 5: Check Symbol Properties

Run this script di MT5 untuk cek available symbols:

```mql5
//+------------------------------------------------------------------+
//| Script: CheckGoldSymbols.mq5                                     |
//| Purpose: Find correct GOLD symbol name                           |
//+------------------------------------------------------------------+
void OnStart()
{
   Print("=== Searching for GOLD symbols ===");
   
   string symbols[];
   int total = SymbolsTotal(true);  // Selected symbols only
   
   Print("Total symbols in Market Watch: ", total);
   
   for(int i = 0; i < total; i++)
   {
      string symbol = SymbolName(i, true);
      
      // Check if symbol contains GOLD or XAU
      if(StringFind(symbol, "GOLD") >= 0 || StringFind(symbol, "XAU") >= 0)
      {
         Print("✓ Found: ", symbol);
         Print("   Description: ", SymbolInfoString(symbol, SYMBOL_DESCRIPTION));
         Print("   Path: ", SymbolInfoString(symbol, SYMBOL_PATH));
      }
   }
   
   Print("=== Done ===");
}
```

Save as `CheckGoldSymbols.mq5` → Compile → Run

## Common Broker Symbol Names

| Broker | GOLD Symbol |
|--------|-------------|
| Exness | `XAUUSD` |
| IC Markets | `XAUUSD` |
| FBS | `GOLD` |
| XM | `GOLD` |
| Tickmill | `XAUUSD.` |
| FxPro | `XAUUSD` |
| FXTM | `GOLD` |
| Admiral Markets | `XAUUSD` |
| Pepperstone | `XAUUSD` |
| HotForex | `XAUUSD` |

## Testing After Fix

1. **Restart EA** setelah fix
2. **Check logs** untuk konfirmasi:
   ```
   ✓ Symbol found: XAUUSD (original: XAUUSDm)
   📊 GET_BARS: XAUUSD M15 Bars=100
   ✅ Sent 100 bars for XAUUSD M15
   ```
3. **Test dengan command** dari Executor
4. **Verify** data diterima dengan benar

## Prevention

### For Future Strategies

Always use **exact broker symbol names**:
1. Check Market Watch first
2. Copy symbol name exactly (case-sensitive)
3. Test with small command before live trading

### Symbol Mapping (Recommended)

Create symbol mapping di platform untuk handle variations:
```typescript
const SYMBOL_MAP: Record<string, string[]> = {
  'XAUUSD': ['XAUUSDm', 'XAUUSD', 'GOLD', 'XAUUSD.'],
  'EURUSD': ['EURUSD', 'EURUSDm', 'EURUSD.'],
  // ... more mappings
};
```

## Status
- ❌ Current: EA fails with error 4301
- ✅ After Fix: EA validates and corrects symbol name automatically

## Date
2025-10-27
