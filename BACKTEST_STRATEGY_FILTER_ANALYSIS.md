# Backtest Strategy Filter Issue Analysis

**Date:** 2025-10-23  
**Issue:** Ada 3 strategi di database, tapi hanya 1 yang muncul di dropdown backtest

---

## Root Cause Identified

**File:** `src/app/(dashboard)/dashboard/backtest/page.tsx`  
**Lines:** 477-482

```typescript
{strategies
  .filter((s) => s.status === "draft" || s.status === "active")  // ← ISSUE HERE
  .map((strategy) => (
    <option key={strategy.id} value={strategy.id}>
      {strategy.name} ({strategy.symbol} {strategy.timeframe})
    </option>
  ))}
```

### Problem

The dropdown **ONLY shows strategies** with status:
- ✅ `draft`
- ✅ `active`

It **FILTERS OUT** strategies with other statuses like:
- ❌ `inactive`
- ❌ `archived`
- ❌ `paused`
- ❌ Any other status

---

## Why This Happens

### Database Reality

You likely have **3 strategies**:
1. **Strategy 1**: Status = `active` → ✅ Shows in dropdown
2. **Strategy 2**: Status = `inactive` → ❌ Hidden
3. **Strategy 3**: Status = `inactive` → ❌ Hidden

OR

1. **Strategy 1**: Status = `draft` → ✅ Shows in dropdown
2. **Strategy 2**: Status = `active` (but maybe archived?)
3. **Strategy 3**: Status = `active` (but maybe archived?)

---

## Investigation Steps

### 1. Check Strategy Statuses

Run this query to see actual statuses:

```sql
SELECT id, name, symbol, timeframe, status 
FROM "Strategy" 
ORDER BY "createdAt" DESC;
```

**Expected Output:**
```
id    | name                    | symbol  | timeframe | status
------|-------------------------|---------|-----------|----------
abc123| XAUUSD M15 Scalping     | XAUUSD  | M15       | active
def456| EURUSD H1 Trend         | EURUSD  | H1        | inactive
ghi789| GBPUSD M15 Breakout     | GBPUSD  | M15       | inactive
```

### 2. Check Prisma Schema

**File:** `prisma/schema.prisma`

Look for Strategy model:
```prisma
model Strategy {
  id        String   @id @default(cuid())
  name      String
  symbol    String
  timeframe String
  status    String   // What values are allowed?
  // ...
}
```

**Possible Status Values:**
- `draft` - Strategy being created
- `active` - Strategy activated and trading
- `inactive` - Strategy deactivated
- `archived` - Strategy archived
- `testing` - Strategy in testing phase

---

## Solutions

### Solution 1: Show All Strategies (Recommended) ⭐

**Remove the filter completely:**

```typescript
// BEFORE (Only shows draft/active)
{strategies
  .filter((s) => s.status === "draft" || s.status === "active")
  .map((strategy) => (...))}

// AFTER (Shows all strategies)
{strategies.map((strategy) => (
  <option key={strategy.id} value={strategy.id}>
    {strategy.name} ({strategy.symbol} {strategy.timeframe}) 
    {strategy.status !== 'active' && strategy.status !== 'draft' && 
      ` [${strategy.status}]`}
  </option>
))}
```

**Benefits:**
- ✅ All 3 strategies will show
- ✅ Users can backtest any strategy regardless of status
- ✅ Status is displayed in parentheses for clarity

---

### Solution 2: Add More Statuses to Filter

```typescript
{strategies
  .filter((s) => 
    s.status === "draft" || 
    s.status === "active" || 
    s.status === "inactive" ||
    s.status === "testing"
  )
  .map((strategy) => (...))}
```

**Benefits:**
- ✅ More strategies will show
- ❌ Still might exclude some statuses

---

### Solution 3: Exclude Only Specific Statuses

```typescript
{strategies
  .filter((s) => s.status !== "archived" && s.status !== "deleted")
  .map((strategy) => (...))}
```

**Benefits:**
- ✅ Shows most strategies
- ✅ Only hides truly unusable ones
- ✅ More flexible

---

## Why The Original Filter Exists

### Possible Reasons

1. **Business Logic:**
   - Original developer wanted to prevent backtesting inactive strategies
   - Thought: "Only active/draft strategies should be backtested"

2. **UI/UX Decision:**
   - Keep dropdown clean by hiding inactive strategies
   - Force users to activate strategies before backtesting

3. **Safety:**
   - Prevent backtesting of archived/deleted strategies
   - Ensure only "ready" strategies are tested

### Why It's Problematic

1. **Confusing for Users:**
   - User sees 3 strategies on strategies page
   - Only 1 shows in backtest dropdown
   - No explanation why

2. **Limits Functionality:**
   - Can't test inactive strategies before activating
   - Can't compare performance of different statuses
   - Can't test historical strategy versions

3. **No Visual Indication:**
   - No message saying "Some strategies are hidden"
   - No way to know why strategies are missing

---

## Recommended Implementation

### Enhanced Solution with Visual Indicators

```typescript
<select
  value={formData.strategyId}
  onChange={(e) => handleStrategyChange(e.target.value)}
  className="w-full rounded-lg border border-neutral-300 px-4 py-2"
>
  <option value="">Select a strategy</option>
  
  {/* Group strategies by status */}
  {strategies.filter(s => s.status === 'active').length > 0 && (
    <optgroup label="Active Strategies">
      {strategies
        .filter(s => s.status === 'active')
        .map((strategy) => (
          <option key={strategy.id} value={strategy.id}>
            {strategy.name} ({strategy.symbol} {strategy.timeframe})
          </option>
        ))}
    </optgroup>
  )}
  
  {strategies.filter(s => s.status === 'draft').length > 0 && (
    <optgroup label="Draft Strategies">
      {strategies
        .filter(s => s.status === 'draft')
        .map((strategy) => (
          <option key={strategy.id} value={strategy.id}>
            {strategy.name} ({strategy.symbol} {strategy.timeframe})
          </option>
        ))}
    </optgroup>
  )}
  
  {strategies.filter(s => s.status === 'inactive').length > 0 && (
    <optgroup label="Inactive Strategies">
      {strategies
        .filter(s => s.status === 'inactive')
        .map((strategy) => (
          <option key={strategy.id} value={strategy.id}>
            {strategy.name} ({strategy.symbol} {strategy.timeframe})
          </option>
        ))}
    </optgroup>
  )}
</select>
```

**Benefits:**
- ✅ Shows ALL strategies
- ✅ Grouped by status for clarity
- ✅ Users know what they're selecting
- ✅ Professional organization

---

## Impact Analysis

### Current Impact (With Filter)

**Positive:**
- Clean dropdown (only relevant strategies)
- Encourages proper strategy workflow

**Negative:**
- ❌ User confusion (missing strategies)
- ❌ Can't backtest inactive strategies
- ❌ No explanation provided
- ❌ Limits testing flexibility

### After Fix (Without Filter)

**Positive:**
- ✅ All strategies accessible
- ✅ More testing flexibility
- ✅ Clear status indication
- ✅ No user confusion

**Negative:**
- Slightly longer dropdown
- Need to distinguish between statuses

---

## Testing Steps

### 1. Verify Current Behavior

```bash
# Check all strategies
curl -X GET http://localhost:3000/api/strategy \
  -H "Cookie: ..."

# Look for status field in each strategy
```

### 2. After Removing Filter

1. Create 3 strategies with different statuses:
   - Strategy A: `active`
   - Strategy B: `inactive`
   - Strategy C: `draft`

2. Go to backtest page
3. Open strategy dropdown
4. Verify all 3 strategies appear

### 3. Edge Cases to Test

- [ ] Strategy with no status (null)
- [ ] Archived strategies
- [ ] Deleted strategies (should they show?)
- [ ] Very long strategy names
- [ ] Strategies with same name but different status

---

## Recommended Fix

### Quick Fix (Simple)

**Remove filter entirely:**

```typescript
{strategies.map((strategy) => (
  <option key={strategy.id} value={strategy.id}>
    {strategy.name} ({strategy.symbol} {strategy.timeframe})
    {strategy.status !== 'active' && ` [${strategy.status}]`}
  </option>
))}
```

**Time:** 1 minute  
**Impact:** All strategies will show

---

### Better Fix (Enhanced UX)

**Add grouped dropdown + info message:**

1. Group strategies by status
2. Add helper text explaining why some are inactive
3. Add visual indicators (icons or colors)
4. Add "Why can't I see my strategy?" FAQ link

**Time:** 15 minutes  
**Impact:** Better UX + all strategies visible

---

## Alternative: Add Filter Toggle

```typescript
const [showAllStrategies, setShowAllStrategies] = useState(false);

// In render:
<div className="flex items-center justify-between mb-2">
  <label className="block text-sm font-medium text-neutral-700">
    Strategy *
  </label>
  <button
    type="button"
    onClick={() => setShowAllStrategies(!showAllStrategies)}
    className="text-xs text-primary-600 hover:text-primary-700"
  >
    {showAllStrategies ? 'Show active only' : 'Show all strategies'}
  </button>
</div>

<select...>
  {strategies
    .filter(s => showAllStrategies || s.status === 'active' || s.status === 'draft')
    .map(...)}
</select>
```

**Benefits:**
- ✅ User control
- ✅ Clean by default
- ✅ Flexibility when needed

---

## Conclusion

**Problem:** Filter on line 478 hides strategies that aren't `draft` or `active`  
**Solution:** Remove filter or enhance with grouping  
**Recommendation:** Remove filter and add status badges  
**Time to Fix:** 1-15 minutes depending on approach  
**Impact:** High - solves user confusion immediately

---

**Document Version:** 1.0  
**Last Updated:** 2025-10-23  
**Author:** Droid (Factory AI)
