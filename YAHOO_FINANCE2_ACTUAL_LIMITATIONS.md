# Yahoo Finance2 Library - Actual Limitations (Test Results)

**Test Date:** October 22, 2025  
**Library Version:** yahoo-finance2 v3.10.0  
**Test Symbol:** GC=F (Gold Futures)  
**Node Version:** 20.19.4

## 🎯 Executive Summary

After comprehensive testing, we discovered that **Yahoo Finance2 limitations differ by interval**:

| Interval | 60 Days | 90 Days | 120 Days | 180 Days | 365 Days | Status |
|----------|---------|---------|----------|----------|----------|--------|
| **15min** | ✅ Works | ❌ Failed | ❌ Failed | ❌ Failed | ❌ Failed | **Max 60 days** |
| **30min** | ✅ Works | ❌ Failed | ❌ Failed | ❌ Failed | ❌ Failed | **Max 60 days** |
| **1hour** | ✅ Works | ✅ Works | ✅ Works | ✅ Works | ✅ Works | **365+ days!** |
| **Daily** | ✅ Works | ✅ Works | ✅ Works | ✅ Works | ✅ Works | **365+ days!** |

---

## 📊 Detailed Test Results

### 1. 15min Interval

**Test Results:**
- ✅ **7 days**: 578 data points (114% coverage)
- ✅ **30 days**: 2,498 data points (103% coverage)  
- ✅ **60 days**: 4,728 data points (98% coverage)
- ❌ **90+ days**: API error - "15m data not available... must be within the last 60 days"

**Error Message:**
```
15m data not available for startTime=1753328564 and endTime=1761104564. 
The requested range must be within the last 60 days.
```

**Conclusion:** ⚠️ **STRICT 60-DAY LIMIT**

---

### 2. 30min Interval

**Test Results:**
- ✅ **7 days**: 290 data points (114% coverage)
- ✅ **30 days**: 1,250 data points (103% coverage)
- ✅ **60 days**: 2,365 data points (98% coverage)
- ❌ **90+ days**: API error - "30m data not available... must be within the last 60 days"

**Error Message:**
```
30m data not available for startTime=1753328565 and endTime=1761104565. 
The requested range must be within the last 60 days.
```

**Conclusion:** ⚠️ **STRICT 60-DAY LIMIT**

---

### 3. 1hour Interval ⭐

**Test Results:**
- ✅ **7 days**: 146 data points (114% coverage)
- ✅ **30 days**: 626 data points (103% coverage)
- ✅ **60 days**: 1,183 data points (98% coverage)
- ✅ **90 days**: 1,826 data points (101% coverage) ✨
- ✅ **120 days**: 2,445 data points (101% coverage) ✨
- ✅ **180 days**: 3,669 data points (101% coverage) ✨
- ✅ **365 days**: 7,322 data points (100% coverage) ✨

**Data Quality:**
- Valid data points: 78-80%
- Price range tested: $2,745 - $4,394 (50%+ movement)
- Coverage: 98-101% (excellent)

**Conclusion:** ✅ **NO 60-DAY LIMIT! Works up to 365+ days!**

---

### 4. Daily Interval

**Test Results:**
- ✅ **7 days**: 5 data points (100% coverage)
- ✅ **30 days**: 22 data points (100% coverage)
- ✅ **60 days**: 41 data points (97% coverage)
- ✅ **90 days**: 63 data points (100% coverage)
- ✅ **120 days**: 85 data points (100% coverage)
- ✅ **180 days**: 127 data points (100% coverage)
- ✅ **365 days**: 254 data points (100% coverage)

**Data Quality:**
- Valid data points: 98-100% (excellent)
- Price range tested: $2,744 - $4,135 (50%+ movement)
- Coverage: 97-100% (excellent)

**Conclusion:** ✅ **Works for 365+ days, likely supports multi-year**

---

## 🔍 Key Findings

### Finding #1: 1hour Interval Has No 60-Day Limit! 🎉

**Previously assumed:**
- All intraday intervals (15min, 30min, 1h) limited to 60 days

**Actual reality:**
- Only 15min and 30min have 60-day limit
- **1hour interval works up to 365+ days!**
- This is a HUGE advantage for backtesting

**Impact:**
- Users can run longer historical backtests with 1h data
- No need to switch to daily for 90-365 day backtests
- More granular data available for longer periods

---

### Finding #2: Error Messages Are Clear

When limits are exceeded, Yahoo Finance2 returns clear error messages:

```
15m data not available for startTime=X and endTime=Y. 
The requested range must be within the last 60 days.
```

This makes it easy to:
- Detect when limits are hit
- Provide helpful user messages
- Implement proper fallback logic

---

### Finding #3: Data Quality Is Consistent

Across all working ranges:
- **Intraday (1h):** 78-80% valid data points
- **Daily:** 98-100% valid data points
- Coverage: 97-114% of requested range
- Price movements are realistic and different for different ranges

---

## 💡 Recommendations

### 1. UI Validation Updates

**Current implementation:**
```typescript
// ❌ OLD - Incorrectly assumes all intraday limited to 60 days
const intradayIntervals = ['1min', '5min', '15min', '30min', '1h'];
if (intradayIntervals.includes(interval)) {
  if (daysFromToday > 60) {
    return "⚠️ Limited to 60 days...";
  }
}
```

**Updated implementation:**
```typescript
// ✅ NEW - Only 15min/30min limited, 1h can go to 365+ days
const limitedIntradayIntervals = ['1min', '5min', '15min', '30min'];
if (limitedIntradayIntervals.includes(interval)) {
  if (daysFromToday > 60) {
    return "⚠️ Yahoo Finance limits ${interval} to 60 days. Use 1h or daily interval for longer periods.";
  }
}
```

**Status:** ✅ **IMPLEMENTED**

---

### 2. Info Banner Updates

**Current banner:**
> Intraday intervals (15min, 30min, 1h) are limited to the last 60 days

**Updated banner:**
> 15min and 30min intervals are limited to 60 days. 1h interval supports up to 365 days. Daily supports historical data beyond 365 days.

**Status:** ✅ **IMPLEMENTED**

---

### 3. Strategy Recommendations

**For 7-60 day backtests:**
- ✅ Use 15min for highest granularity
- ✅ Use 30min for good balance
- ✅ Use 1h for faster execution

**For 60-365 day backtests:**
- ⚠️ Cannot use 15min or 30min
- ✅ **Use 1h interval** - works perfectly!
- ✅ Use daily for even longer periods

**For 365+ day backtests:**
- ❌ Cannot use 15min or 30min
- ⚠️ Not tested for 1h beyond 365 days
- ✅ **Use daily interval**

---

## 📋 Updated Documentation Matrix

| Use Case | Recommended Interval | Max Range | Data Points/Day | Notes |
|----------|---------------------|-----------|-----------------|-------|
| **Short-term strategy (1-7 days)** | 15min | 60 days | ~32 | Highest granularity |
| **Medium-term strategy (7-30 days)** | 30min | 60 days | ~16 | Good balance |
| **Medium-term strategy (30-60 days)** | 1h | 365 days | ~8 | Flexible range |
| **Long-term strategy (60-180 days)** | 1h | 365 days | ~8 | ⭐ Best option! |
| **Long-term strategy (180-365 days)** | 1h or daily | 365+ days | ~8 or 1 | Both work well |
| **Historical analysis (1+ years)** | daily | Multi-year | 1 | Daily only |

---

## 🧪 Test Script

The comprehensive test script is available at:
```
test-yf2-limitations.mjs
```

**Run tests:**
```bash
node test-yf2-limitations.mjs
```

**Test coverage:**
- 4 intervals (15min, 30min, 1h, daily)
- 7 date ranges (7, 30, 60, 90, 120, 180, 365 days)
- Total: 28 test cases
- Symbol: GC=F (Gold futures)

---

## 📊 Comparison: Before vs After

### Before (Assumed)
```
15min: ⚠️ 60 days max
30min: ⚠️ 60 days max  
1hour: ⚠️ 60 days max  ← WRONG!
daily: ✅ 365+ days
```

### After (Tested)
```
15min: ⚠️ 60 days max
30min: ⚠️ 60 days max
1hour: ✅ 365 days max  ← CORRECT!
daily: ✅ 365+ days
```

---

## 🎯 Production Impact

### User Benefits:
1. **More flexibility**: 1h interval now usable for 60-365 day backtests
2. **Better validation**: Clear error messages prevent frustration
3. **Accurate expectations**: UI reflects actual limitations
4. **Optimized strategy**: Can choose best interval for date range

### Technical Benefits:
1. **Accurate validation**: Prevent unnecessary API errors
2. **Better UX**: Suggest 1h interval as alternative to daily
3. **Reduced support**: Clear limitations reduce user confusion
4. **Optimized API usage**: Use appropriate intervals for range

---

## ✅ Action Items

- [x] Run comprehensive limitation tests
- [x] Document actual findings
- [x] Update UI validation logic
- [x] Update info banner text
- [x] Update warning messages with "use 1h" suggestion
- [ ] Update production testing guide
- [ ] Deploy to staging for verification
- [ ] Deploy to production
- [ ] Monitor for any edge cases

---

## 🚀 Conclusion

**Key Takeaway:** The **1hour interval is much more flexible than initially assumed**, supporting up to 365 days of historical data. This makes it an excellent choice for medium-to-long-term backtesting strategies.

**Recommendation:** Promote 1h interval as the "sweet spot" for backtests between 60-365 days, offering good granularity without the 60-day limitation of 15min/30min intervals.

**Status:** ✅ **Ready for Production**

---

**Last Updated:** October 22, 2025  
**Test Results:** `test-yf2-limitations.mjs`  
**Implementation:** ✅ Complete
