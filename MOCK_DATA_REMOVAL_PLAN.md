# Mock Data Removal Plan

## Summary
Remove all mock data fallbacks from production code. API routes already use real Prisma database queries.

## Files to Clean

### Dashboard Pages (3 files)
1. **src/app/(dashboard)/dashboard/alerts/page.tsx**
   - Remove: mockAlerts (lines ~100-160)
   - Remove: mockRules (lines ~172-220)
   - Keep: API calls to /api/alerts
   - Action: Show error message if API fails instead of mock data

2. **src/app/(dashboard)/dashboard/positions/page.tsx**
   - Remove: mockPositions (lines ~65-130)
   - Keep: API calls to /api/positions
   - Action: Show error message if API fails

3. **src/app/(dashboard)/dashboard/risk/page.tsx**
   - Remove: mockRiskExposure (lines ~64-110)
   - Remove: mockRiskHistory (lines ~111-120)
   - Remove: mockRiskAlerts (lines ~121-140)
   - Keep: API calls to /api/risk/exposure
   - Action: Show error message if API fails

## API Routes Status
✅ All API routes already use real data from Prisma:
- `/api/alerts` - Uses AuditLog table
- `/api/positions` - Uses Trade + Executor tables
- `/api/risk/exposure` - Uses Trade + Executor tables with calculations

## Implementation Strategy

### Error Handling Pattern
Replace mock data fallback with:
```typescript
} catch (error) {
  console.error('Error fetching data:', error);
  setError('Failed to load data. Please try again.');
}
```

### Empty State Pattern
```typescript
{!loading && data.length === 0 && (
  <EmptyState 
    title="No data available" 
    description="Start trading to see data here"
  />
)}
```

### Loading State Pattern
```typescript
{loading && <LoadingSpinner />}
{error && <ErrorMessage message={error} onRetry={fetchData} />}
{!loading && !error && data && <DataDisplay data={data} />}
```

## Benefits
1. No confusion between real and fake data
2. Easier debugging (errors visible to users)
3. Cleaner codebase
4. Forces API fixes instead of hiding issues
5. Accurate testing - only real data flows

## Completion Status

### ✅ Completed (2025-10-23)
1. **Alerts Page** - Removed ~70 lines of mock data
   - Removed mockAlerts array (5 mock alerts)
   - Removed mockRules array (3 mock rules)
   - Added error state management
   
2. **Positions Page** - Removed ~110 lines of mock data
   - Removed mockPositions array (3 mock positions)
   - Removed mockPnlReport calculation
   - Added error state management

3. **Risk Page** - Removed ~60 lines of mock data
   - Removed mockRiskExposure object
   - Removed mockRiskHistory array
   - Removed mockRiskAlerts array
   - Added error state management

### Total Impact
- **~240 lines of mock data removed**
- **3 dashboard pages cleaned**
- **All pages now use real Prisma database data**
- **Proper error handling implemented**

## Testing Checklist
After cleanup:
- [ ] Test alerts page with no data
- [ ] Test alerts page with real alerts
- [ ] Test positions page with no positions
- [ ] Test positions page with open positions
- [ ] Test risk page with no exposure
- [ ] Test risk page with active trades
- [ ] Test error handling when API unavailable
- [ ] Test loading states
- [ ] Test empty states
