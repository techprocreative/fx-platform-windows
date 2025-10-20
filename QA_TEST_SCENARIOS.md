# 🧪 TEST SCENARIOS & CHECKLIST - STRATEGIES & BACKTEST

## 📝 CRITICAL TEST SCENARIOS

### SCENARIO 1: Create Strategy dengan Template
**Priority:** HIGH  
**Module:** Strategies  

**Pre-conditions:**
- User sudah login
- Tidak ada strategy existing

**Test Steps:**
1. Navigate ke `/dashboard/strategies/new`
2. Pilih mode "Simple"
3. Select template "RSI Oversold Bounce"
4. Review pre-filled data
5. Click "Create Strategy"

**Expected Results:**
- ✅ Form ter-populate dengan data template
- ✅ Validation berjalan dengan benar
- ✅ Strategy tersimpan di database
- ✅ Redirect ke strategy detail page
- ✅ Toast notification success

**Edge Cases to Test:**
- [ ] Submit dengan empty name
- [ ] Submit dengan special characters di name
- [ ] Submit dengan duplicate name
- [ ] Submit dengan invalid symbol
- [ ] Double-click submit button
- [ ] Submit saat offline
- [ ] Submit dengan session expired

---

### SCENARIO 2: Run Backtest untuk Multiple Symbols
**Priority:** CRITICAL  
**Module:** Backtest  

**Test Data Matrix:**
| Symbol | Timeframe | Expected Pip Multiplier | Start Date | End Date |
|--------|-----------|------------------------|------------|----------|
| EURUSD | H1 | 0.0001 | 2024-01-01 | 2024-01-31 |
| USDJPY | H1 | 0.01 | 2024-01-01 | 2024-01-31 |
| XAUUSD | H1 | 0.1 | 2024-01-01 | 2024-01-31 |
| BTCUSD | D1 | 1 | 2024-01-01 | 2024-01-31 |
| US30 | H4 | 1 | 2024-01-01 | 2024-01-31 |

**Test Steps:**
1. Create strategy untuk setiap symbol
2. Navigate ke `/dashboard/backtest`
3. Click "New Backtest"
4. Select strategy
5. Verify symbol & timeframe auto-filled
6. Set date range
7. Submit backtest
8. Wait for completion
9. Verify results accuracy

**Critical Validations:**
- [ ] Pip calculations correct per symbol
- [ ] Date range validation works
- [ ] Concurrent backtest tidak crash
- [ ] Results mathematically accurate
- [ ] Memory usage stable
- [ ] API rate limits respected

---

### SCENARIO 3: Edit Strategy dengan Active Trades
**Priority:** HIGH  
**Module:** Strategies  

**Pre-conditions:**
- Strategy dengan status "active"
- Ada trades yang sedang open

**Test Steps:**
1. Navigate ke strategy edit page
2. Modify exit rules (TP/SL)
3. Save changes
4. Check impact on existing trades

**Expected Behavior:**
- [ ] Warning message displayed
- [ ] Option to apply to new trades only
- [ ] Version history maintained
- [ ] No data corruption

---

### SCENARIO 4: Stress Test - Multiple Concurrent Backtests
**Priority:** CRITICAL  
**Module:** Backtest, Performance  

**Test Steps:**
1. Prepare 10 different strategies
2. Submit 10 backtests simultaneously
3. Monitor system resources
4. Check for race conditions
5. Verify all results

**Acceptance Criteria:**
- [ ] No system crash
- [ ] Memory usage < 2GB
- [ ] All backtests complete successfully
- [ ] Results are accurate
- [ ] No data mixing between backtests

---

### SCENARIO 5: Authentication & Authorization Security
**Priority:** CRITICAL  
**Module:** Security  

**Test Matrix:**
| Action | User A | User B | Anonymous | Expected |
|--------|--------|--------|-----------|----------|
| View own strategy | ✅ | ❌ | ❌ | 200 / 403 / 401 |
| Edit own strategy | ✅ | ❌ | ❌ | 200 / 403 / 401 |
| Delete own strategy | ✅ | ❌ | ❌ | 200 / 403 / 401 |
| View other's strategy | ❌ | - | ❌ | 403 / 401 |
| Run backtest | ✅ | ✅ | ❌ | 200 / 401 |

**SQL Injection Tests:**
```javascript
// Test payloads for strategy name
[
  "'; DROP TABLE strategies; --",
  "<script>alert('XSS')</script>",
  "{{7*7}}",
  "${7*7}",
  "' OR '1'='1",
  "../../../etc/passwd",
  "null",
  "undefined",
  "NaN",
  String.fromCharCode(0),
]
```

---

## ✅ REGRESSION TEST CHECKLIST

### Strategy Module
- [ ] **Create Strategy**
  - [ ] Simple mode with template
  - [ ] Advanced mode manual
  - [ ] AI mode generation
  - [ ] All fields validate correctly
  - [ ] Duplicate name prevention
  - [ ] Special characters handling
  - [ ] Maximum length validation
  - [ ] Required fields enforcement

- [ ] **List Strategies**
  - [ ] Pagination works (when implemented)
  - [ ] Filters work correctly
  - [ ] Sort functionality
  - [ ] Empty state display
  - [ ] Loading state
  - [ ] Error state

- [ ] **View Strategy Detail**
  - [ ] All data displayed correctly
  - [ ] Charts render properly
  - [ ] Statistics accurate
  - [ ] Actions buttons work
  - [ ] Responsive layout

- [ ] **Edit Strategy**
  - [ ] Form pre-populated
  - [ ] Changes saved correctly
  - [ ] Validation works
  - [ ] Cancel discards changes
  - [ ] Version tracking

- [ ] **Delete Strategy**
  - [ ] Confirmation dialog
  - [ ] Soft delete implemented
  - [ ] Related data handled
  - [ ] Cannot delete active strategy

### Backtest Module
- [ ] **Create Backtest**
  - [ ] Strategy selection
  - [ ] Auto-fill symbol/timeframe
  - [ ] Date range validation
  - [ ] Start < End date
  - [ ] Max period enforcement (365 days)
  - [ ] Initial balance validation
  - [ ] Submit button state management

- [ ] **Running Backtest**
  - [ ] Status updates real-time
  - [ ] Progress indicator
  - [ ] Can view partial results
  - [ ] Cancel functionality
  - [ ] Error handling

- [ ] **Completed Backtest**
  - [ ] All metrics calculated
  - [ ] Charts display correctly
  - [ ] Trade list accurate
  - [ ] Export functionality
  - [ ] Shareable link

- [ ] **Failed Backtest**
  - [ ] Error message clear
  - [ ] Retry option
  - [ ] Logs available
  - [ ] No partial data corruption

### Cross-Module Tests
- [ ] **Navigation**
  - [ ] All links work
  - [ ] Back button behavior
  - [ ] Breadcrumbs (if implemented)
  - [ ] Deep linking works

- [ ] **Data Consistency**
  - [ ] Strategy changes reflect in backtest
  - [ ] Delete strategy handles backtests
  - [ ] User data isolation
  - [ ] Timezone consistency

- [ ] **Performance**
  - [ ] Page load < 3s
  - [ ] API response < 500ms
  - [ ] Smooth scrolling
  - [ ] No memory leaks
  - [ ] Efficient re-renders

- [ ] **Accessibility**
  - [ ] Keyboard navigation
  - [ ] Screen reader compatible
  - [ ] Color contrast WCAG AA
  - [ ] Focus indicators
  - [ ] Alt text for images

- [ ] **Responsive Design**
  - [ ] Mobile (320px - 768px)
  - [ ] Tablet (768px - 1024px)
  - [ ] Desktop (1024px+)
  - [ ] Landscape orientation
  - [ ] Touch interactions

---

## 🔍 EXPLORATORY TEST AREAS

### Negative Testing
1. **Invalid Data Entry**
   - Negative numbers where not allowed
   - Extremely large numbers
   - Zero values
   - Empty strings
   - Null/undefined
   - Special characters
   - Unicode characters
   - Emoji in text fields

2. **Boundary Testing**
   - Min/max values for all inputs
   - Date ranges at extremes
   - Maximum strategy name length
   - Maximum description length
   - Lot size limits
   - Balance limits

3. **Network Conditions**
   - Slow 3G simulation
   - Intermittent connection
   - Request timeout
   - API errors (500, 503)
   - Rate limit exceeded

4. **Session Management**
   - Expired session handling
   - Multiple tabs/windows
   - Browser back/forward
   - Refresh during operation
   - Logout during operation

5. **Concurrency Issues**
   - Multiple users editing same strategy
   - Simultaneous backtests
   - Race conditions in status updates
   - Deadlock scenarios

### Performance Testing
1. **Load Testing Scenarios**
   - 10 concurrent users
   - 50 concurrent users
   - 100 concurrent users
   - 1000 strategies per user
   - 10000 backtest records

2. **Stress Points**
   - Large date ranges (365 days)
   - High-frequency timeframes (M1)
   - Multiple indicators
   - Complex rule combinations
   - Large historical data sets

3. **Memory Profiling**
   - Check for memory leaks
   - Monitor heap usage
   - Identify heavy components
   - Check cleanup on unmount

---

## 📊 TEST DATA REQUIREMENTS

### Valid Test Data
```javascript
// Strategies
{
  validStrategy: {
    name: "Test MA Crossover",
    description: "Test strategy for QA",
    symbol: "EURUSD",
    timeframe: "H1",
    type: "manual",
    rules: {
      entry: {
        conditions: [{
          indicator: "EMA",
          condition: "crosses_above",
          value: 50,
          period: 20
        }],
        logic: "AND"
      },
      exit: {
        takeProfit: { type: "pips", value: 50 },
        stopLoss: { type: "pips", value: 25 },
        trailing: { enabled: false, distance: 10 }
      },
      riskManagement: {
        lotSize: 0.01,
        maxPositions: 3,
        maxDailyLoss: 100
      }
    }
  }
}

// Backtests
{
  validBacktest: {
    strategyId: "{{strategy.id}}",
    symbol: "EURUSD",
    interval: "1h",
    startDate: "2024-01-01T00:00:00Z",
    endDate: "2024-01-31T23:59:59Z",
    initialBalance: 10000
  }
}
```

### Invalid Test Data
```javascript
// Edge cases untuk testing
{
  invalidCases: [
    { name: "", error: "Name is required" },
    { name: "a", error: "Name too short" },
    { name: "a".repeat(101), error: "Name too long" },
    { symbol: "INVALID", error: "Invalid symbol" },
    { timeframe: "M2", error: "Invalid timeframe" },
    { lotSize: -1, error: "Lot size must be positive" },
    { lotSize: 0, error: "Lot size cannot be zero" },
    { lotSize: 1000, error: "Lot size too large" },
    { maxPositions: 0, error: "Must allow at least 1 position" },
    { maxPositions: 101, error: "Max positions exceeded" },
    { initialBalance: 99, error: "Minimum balance is 100" },
    { initialBalance: 1000001, error: "Maximum balance exceeded" }
  ]
}
```

---

## 🚀 AUTOMATION RECOMMENDATIONS

### Priority 1 - Critical Paths
1. Strategy CRUD operations
2. Backtest execution flow
3. Authentication flow
4. Data validation

### Priority 2 - Regression Suite
1. Form validations
2. API endpoint testing
3. Error handling
4. Permission checks

### Priority 3 - UI/UX
1. Responsive design
2. Loading states
3. Error messages
4. Success flows

### Tools Recommended
- **E2E:** Playwright or Cypress
- **API:** Jest + Supertest
- **Unit:** Jest + React Testing Library
- **Performance:** k6 or JMeter
- **Security:** OWASP ZAP
- **Accessibility:** axe-core

---

## 📈 METRICS TO TRACK

### Quality Metrics
- Test Coverage: Target > 80%
- Bug Escape Rate: < 5%
- Mean Time to Detect: < 1 hour
- Mean Time to Resolve: < 4 hours
- Test Execution Time: < 30 minutes

### Performance Metrics
- Page Load Time: p95 < 3s
- API Response: p95 < 500ms
- Error Rate: < 0.1%
- Uptime: > 99.9%
- Concurrent Users: > 1000

---

**Document Version:** 1.0  
**Created:** 17 Januari 2025  
**Last Updated:** 17 Januari 2025  
**Next Review:** After Sprint 1  

---

## NOTES FOR QA TEAM

1. **Always test with multiple browsers:** Chrome, Firefox, Safari, Edge
2. **Test on real devices** when possible, not just browser DevTools
3. **Document all bugs** with screenshots/videos
4. **Include console logs** in bug reports
5. **Test with different user roles** if implemented
6. **Check for console errors** even if UI looks fine
7. **Verify API responses** in Network tab
8. **Test with VPN** for different geolocations
9. **Use browser extensions** to test (ad blockers, password managers)
10. **Clear cache/cookies** between test scenarios
