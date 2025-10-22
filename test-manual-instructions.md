# Manual Testing Instructions for Backtest Fix

## 🎯 Objective
Test if the backtest fix for different date ranges is working in production.

## 🔧 Problem Fixed
**Before:** Backtest with different date ranges (357 days vs 292 days) produced identical results:
- Total Return: 3.42% (same)
- Win Rate: 52.2% (same)  
- Total Trades: 2517 (same)

**After:** Backtest with different date ranges should produce different results.

## 📋 Testing Steps

### 1. Login to Production
1. Go to: https://fx.nusanexus.com
2. Login with: demo@nexustrade.com / Demo123!
3. Navigate to: Dashboard → Backtest

### 2. Test Case 1: Long Range (357 days)
1. Click "New Backtest"
2. Select any available strategy
3. Set parameters:
   - Start Date: 2024-11-01
   - End Date: 2025-10-23
   - Initial Balance: 10000
   - Data Source: TwelveData (Recommended)
4. Click "Run Backtest"
5. Wait for completion and note results:
   - Total Return: ____%
   - Win Rate: ____%
   - Total Trades: ____
   - Max Drawdown: ____%

### 3. Test Case 2: Shorter Range (292 days)
1. Click "New Backtest"
2. Select the same strategy
3. Set parameters:
   - Start Date: 2025-01-01
   - End Date: 2025-10-23
   - Initial Balance: 10000
   - Data Source: TwelveData (Recommended)
4. Click "Run Backtest"
5. Wait for completion and note results:
   - Total Return: ____%
   - Win Rate: ____%
   - Total Trades: ____
   - Max Drawdown: ____%

### 4. Test Case 3: Short Range (30 days)
1. Click "New Backtest"
2. Select the same strategy
3. Set parameters:
   - Start Date: 2025-09-23
   - End Date: 2025-10-23
   - Initial Balance: 10000
   - Data Source: TwelveData (Recommended)
4. Click "Run Backtest"
5. Wait for completion and note results:
   - Total Return: ____%
   - Win Rate: ____%
   - Total Trades: ____
   - Max Drawdown: ____%

## 📊 Expected Results

**✅ SUCCESS (Fix Working):**
- Different date ranges produce **DIFFERENT** results
- Total Trades should be different for each range
- Return percentages should be different
- Win rates should be different

**❌ ISSUE PERSISTS (Fix Not Working):**
- Different date ranges produce **IDENTICAL** results
- Total Trades: 2517 (same for all ranges)
- Return: 3.42% (same for all ranges)
- Win Rate: 52.2% (same for all ranges)

## 🔍 What to Check

### Data Points Difference
- 357 days should have more data points than 292 days
- 292 days should have more data points than 30 days
- More data points = more potential trades

### Trade Count Difference
- Longer ranges should have more trades than shorter ranges
- If all ranges have exactly 2517 trades, fix is not working

### Return Percentage Difference
- Different ranges should produce different returns
- Market conditions vary over time

## 🐛 Troubleshooting

If results are still identical:

1. **Check Data Source Field:**
   - Make sure "TwelveData (Recommended)" is selected
   - This field was added in the recent fix

2. **Check Browser Cache:**
   - Clear browser cache
   - Refresh page and try again

3. **Check Strategy:**
   - Try with a different strategy
   - Some strategies might have different behavior

4. **Check Date Format:**
   - Make sure dates are entered correctly
   - Use the date picker if available

## 📋 Report Results

Please report the following:

### Test Case 1 (357 days):
- Total Return: ____%
- Win Rate: ____%
- Total Trades: ____
- Max Drawdown: ____%

### Test Case 2 (292 days):
- Total Return: ____%
- Win Rate: ____%
- Total Trades: ____
- Max Drawdown: ____%

### Test Case 3 (30 days):
- Total Return: ____%
- Win Rate: ____%
- Total Trades: ____
- Max Drawdown: ____%

### Final Result:
- ✅ Fix is working (results are different)
- ❌ Fix is not working (results are identical)

## 🎯 Technical Details

The fix included:
1. **Environment Variable Fix:** TWELVEDATA_API_KEY configuration
2. **API Fix:** Removed hardcoded outputsize, added dynamic calculation
3. **Cache Fix:** Added validation to prevent cache pollution
4. **UI Fix:** Added Data Source field to backtest form
5. **Logging Fix:** Added comprehensive debugging logs

All changes have been deployed to production.