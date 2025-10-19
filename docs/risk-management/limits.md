# Risk Limits Documentation

## Overview

This document provides a comprehensive explanation of all risk limits implemented in the FX Trading Platform. These limits are designed to protect traders from excessive losses while allowing for reasonable trading flexibility.

## Limit Categories

### 1. Account-Level Limits
These limits apply to the entire trading account.

#### 1.1 Daily Loss Limit
- **Limit**: 6% of account balance
- **Calculation**: Total losses for the current trading day
- **Enforcement**: Trading suspended when limit reached
- **Reset**: Daily at 00:00 UTC
- **Example**: $10,000 account → $600 maximum daily loss

#### 1.2 Maximum Drawdown Limit
- **Limit**: 20% of peak equity
- **Calculation**: Peak equity - current equity
- **Enforcement**: All positions closed when limit exceeded
- **Recovery**: Trading suspended until 50% of drawdown recovered
- **Example**: $10,000 peak → $8,000 minimum equity

#### 1.3 Weekly Loss Limit
- **Limit**: 15% of starting weekly balance
- **Calculation**: Total losses for the current week
- **Enforcement**: Trading suspended when limit reached
- **Reset**: Weekly on Monday 00:00 UTC
- **Example**: $10,000 account → $1,500 maximum weekly loss

#### 1.4 Monthly Loss Limit
- **Limit**: 25% of starting monthly balance
- **Calculation**: Total losses for the current month
- **Enforcement**: Trading suspended when limit reached
- **Reset**: Monthly on 1st at 00:00 UTC
- **Example**: $10,000 account → $2,500 maximum monthly loss

### 2. Position-Level Limits
These limits apply to individual positions.

#### 2.1 Maximum Risk Per Trade
- **Limit**: 2% of account balance
- **Calculation**: Position size × stop loss distance
- **Enforcement**: Trade rejected if risk exceeds limit
- **Adjustment**: Automatically calculates maximum position size
- **Example**: $10,000 account → $200 maximum risk per trade

#### 2.2 Maximum Position Size
- **Limit**: 10 lots
- **Calculation**: Total volume per position
- **Enforcement**: Trade rejected if size exceeds limit
- **Exception**: Can be increased with admin approval
- **Example**: Maximum 10 lots per trade

#### 2.3 Minimum Position Size
- **Limit**: 0.01 lots
- **Calculation**: Minimum volume per position
- **Enforcement**: Trade rejected if below minimum
- **Purpose**: Prevent micro-trades
- **Example**: Minimum 0.01 lots per trade

#### 2.4 Minimum Stop Loss Distance
- **Limit**: 10 pips
- **Calculation**: Distance from entry price to stop loss
- **Enforcement**: Trade rejected if stop loss too close
- **Purpose**: Prevent premature stop outs
- **Example**: Stop loss must be at least 10 pips from entry

#### 2.5 Maximum Stop Loss Distance
- **Limit**: 500 pips
- **Calculation**: Distance from entry price to stop loss
- **Enforcement**: Trade rejected if stop loss too far
- **Purpose**: Prevent excessive risk
- **Example**: Stop loss cannot exceed 500 pips from entry

### 3. Portfolio-Level Limits
These limits apply to the overall portfolio of positions.

#### 3.1 Maximum Number of Positions
- **Limit**: 5 concurrent positions
- **Calculation**: Count of open positions
- **Enforcement**: New trades rejected when limit reached
- **Includes**: Both market and pending orders
- **Example**: Maximum 5 open positions at any time

#### 3.2 Maximum Positions per Symbol
- **Limit**: 2 positions per symbol
- **Calculation**: Count of positions for same symbol
- **Enforcement**: New trades rejected when limit reached
- **Purpose**: Prevent over-concentration
- **Example**: Maximum 2 EURUSD positions

#### 3.3 Maximum Positions per Currency
- **Limit**: 3 positions per currency
- **Calculation**: Count of positions with same currency
- **Enforcement**: New trades rejected when limit reached
- **Purpose**: Prevent currency over-exposure
- **Example**: Maximum 3 USD positions

#### 3.4 Maximum Pending Orders
- **Limit**: 10 pending orders
- **Calculation**: Count of pending orders
- **Enforcement**: New orders rejected when limit reached
- **Purpose**: Prevent order spam
- **Example**: Maximum 10 pending orders

### 4. Exposure Limits
These limits control exposure to different market segments.

#### 4.1 Maximum Currency Exposure
- **Limit**: 50% of account balance
- **Calculation**: Total exposure to single currency
- **Enforcement**: New trades rejected if limit exceeded
- **Includes**: Both long and short positions
- **Example**: Maximum $5,000 USD exposure

#### 4.2 Maximum Sector Exposure
- **Limit**: 30% of account balance
- **Calculation**: Total exposure to single sector
- **Enforcement**: New trades rejected if limit exceeded
- **Sectors**: Forex, Commodities, Indices, etc.
- **Example**: Maximum $3,000 Forex exposure

#### 4.3 Maximum Symbol Exposure
- **Limit**: 20% of account balance
- **Calculation**: Total exposure to single symbol
- **Enforcement**: New trades rejected if limit exceeded
- **Purpose**: Prevent symbol over-concentration
- **Example**: Maximum $2,000 EURUSD exposure

#### 4.4 Maximum Correlation Exposure
- **Limit**: 0.7 correlation coefficient
- **Calculation**: Correlation with existing positions
- **Enforcement**: New trades rejected if correlation too high
- **Purpose**: Prevent correlated risk
- **Example**: EURUSD and GBPUSD correlation limit

### 5. Leverage Limits
These limits control the amount of leverage used.

#### 5.1 Maximum Leverage
- **Limit**: 1:100
- **Calculation**: Total position value / account balance
- **Enforcement**: New trades rejected if leverage exceeded
- **Dynamic**: Reduced during high volatility
- **Example**: $10,000 account → $1,000,000 maximum position value

#### 5.2 Effective Leverage Limit
- **Limit**: 1:50 average
- **Calculation**: Average leverage across all positions
- **Enforcement**: Warning when approaching limit
- **Purpose**: Maintain reasonable leverage
- **Example**: Average leverage should not exceed 1:50

#### 5.3 Margin Level Limit
- **Limit**: 200% minimum
- **Calculation**: Equity / margin used × 100
- **Enforcement**: New trades rejected below limit
- **Purpose**: Maintain margin safety
- **Example**: Minimum 200% margin level required

### 6. Market Condition Limits
These limits adjust based on market conditions.

#### 6.1 Volatility Limit
- **Limit**: 3x average volatility
- **Calculation**: Current volatility / average volatility
- **Enforcement**: Trading suspended when limit exceeded
- **Duration**: Re-evaluated every 5 minutes
- **Example**: Trading suspended if volatility > 3x average

#### 6.2 Spread Limit
- **Limit**: 3x average spread
- **Calculation**: Current spread / average spread
- **Enforcement**: Trading suspended when limit exceeded
- **Duration**: Re-evaluated every 1 minute
- **Example**: Trading suspended if spread > 3x average

#### 6.3 Liquidity Limit
- **Limit**: Minimum $1,000,000 available
- **Calculation**: Available liquidity for symbol
- **Enforcement**: Trading suspended when limit exceeded
- **Purpose**: Ensure execution quality
- **Example**: Trading suspended if liquidity < $1M

#### 6.4 News Event Buffer
- **Limit**: 30 minutes before/after news
- **Calculation**: Time to high-impact news events
- **Enforcement**: Trading suspended during buffer
- **Events**: High-impact economic news
- **Example**: No trading 30 minutes around NFP

## Limit Calculations

### Position Size Calculation

```javascript
function calculatePositionSize(accountBalance, riskPercent, stopLossPips, pipValue) {
  const riskAmount = accountBalance * (riskPercent / 100);
  const positionSize = riskAmount / (stopLossPips * pipValue);
  
  // Apply limits
  const maxSize = Math.min(positionSize, MAX_POSITION_SIZE);
  const roundedSize = Math.round(maxSize * 100) / 100;
  
  return Math.max(MIN_POSITION_SIZE, roundedSize);
}
```

### Risk Exposure Calculation

```javascript
function calculateRiskExposure(positions, accountBalance) {
  const currencyExposure = {};
  const sectorExposure = {};
  const symbolExposure = {};
  
  positions.forEach(position => {
    const exposure = Math.abs(position.volume * position.currentPrice);
    
    // Currency exposure
    const currencies = getCurrencies(position.symbol);
    currencies.forEach(currency => {
      currencyExposure[currency] = (currencyExposure[currency] || 0) + exposure;
    });
    
    // Sector exposure
    const sector = getSector(position.symbol);
    sectorExposure[sector] = (sectorExposure[sector] || 0) + exposure;
    
    // Symbol exposure
    symbolExposure[position.symbol] = (symbolExposure[position.symbol] || 0) + exposure;
  });
  
  return {
    currency: currencyExposure,
    sector: sectorExposure,
    symbol: symbolExposure
  };
}
```

### Drawdown Calculation

```javascript
function calculateDrawdown(equityCurve) {
  let peak = equityCurve[0];
  let maxDrawdown = 0;
  let currentDrawdown = 0;
  
  for (let i = 1; i < equityCurve.length; i++) {
    if (equityCurve[i] > peak) {
      peak = equityCurve[i];
      currentDrawdown = 0;
    } else {
      currentDrawdown = (peak - equityCurve[i]) / peak;
      maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
    }
  }
  
  return maxDrawdown;
}
```

## Limit Enforcement

### Enforcement Hierarchy

1. **Critical Limits** (Immediate enforcement)
   - Daily loss limit
   - Maximum drawdown limit
   - Margin call level

2. **Hard Limits** (Trade rejection)
   - Maximum risk per trade
   - Maximum position size
   - Exposure limits

3. **Soft Limits** (Warning + confirmation)
   - High correlation
   - Approaching exposure limits
   - Elevated market risk

4. **Advisory Limits** (Notification only)
   - High volatility warning
   - Spread warning
   - Liquidity warning

### Enforcement Actions

| Limit Type | Action | Recovery |
|------------|--------|----------|
| Daily Loss | Trading suspended | Next day |
| Max Drawdown | Close all positions | 50% recovery |
| Margin Call | Close high-risk positions | Margin restored |
| Position Limits | Trade rejection | Position closed |
| Exposure Limits | Trade rejection | Exposure reduced |
| Market Conditions | Trading suspended | Conditions improve |

## Limit Configuration

### Default Configuration

```json
{
  "accountLimits": {
    "maxDailyLossPercent": 6.0,
    "maxDrawdownPercent": 20.0,
    "maxWeeklyLossPercent": 15.0,
    "maxMonthlyLossPercent": 25.0
  },
  "positionLimits": {
    "maxRiskPerTradePercent": 2.0,
    "maxPositionSize": 10.0,
    "minPositionSize": 0.01,
    "minStopLossPips": 10,
    "maxStopLossPips": 500
  },
  "portfolioLimits": {
    "maxPositions": 5,
    "maxPositionsPerSymbol": 2,
    "maxPositionsPerCurrency": 3,
    "maxPendingOrders": 10
  },
  "exposureLimits": {
    "maxCurrencyExposurePercent": 50.0,
    "maxSectorExposurePercent": 30.0,
    "maxSymbolExposurePercent": 20.0,
    "maxCorrelation": 0.7
  },
  "leverageLimits": {
    "maxLeverage": 100,
    "avgLeverageLimit": 50,
    "minMarginLevelPercent": 200
  },
  "marketLimits": {
    "maxVolatilityMultiplier": 3.0,
    "maxSpreadMultiplier": 3.0,
    "minLiquidity": 1000000,
    "newsEventBufferMinutes": 30
  }
}
```

### User-Specific Adjustments

Administrators can adjust limits for specific users:

```json
{
  "userId": "user_123",
  "adjustments": {
    "maxRiskPerTradePercent": 1.5,
    "maxPositions": 3,
    "maxLeverage": 50
  },
  "reason": "New trader with limited experience",
  "expires": "2024-12-31T23:59:59.999Z",
  "approvedBy": "admin_456"
}
```

## Limit Monitoring

### Real-Time Monitoring

All limits are monitored in real-time with:

- **Continuous Calculation**: Limits recalculated on every tick
- **Pre-Trade Validation**: All limits checked before trade execution
- **Post-Trade Monitoring**: Limits monitored after trade execution
- **Alert System**: Notifications when limits approached

### Monitoring Dashboard

The risk dashboard displays:

- Current limit utilization
- Distance to limit breaches
- Limit breach history
- Limit adjustment requests
- System limit status

### Reporting

Daily, weekly, and monthly reports include:

- Limit utilization statistics
- Limit breach incidents
- Limit adjustment history
- Limit effectiveness analysis

## Limit Best Practices

### For Traders

1. **Know Your Limits**
   - Understand all applicable limits
   - Monitor your limit utilization
   - Plan trades within limits

2. **Stay Conservative**
   - Use lower risk than maximum allowed
   - Maintain buffer from limits
   - Adjust limits based on experience

3. **Monitor Regularly**
   - Check limit utilization daily
   - Review limit breach alerts
   - Adjust strategy as needed

### For Administrators

1. **Set Appropriate Limits**
   - Consider trader experience
   - Adjust based on performance
   - Review limits regularly

2. **Monitor Effectiveness**
   - Track limit breaches
   - Analyze limit impact
   - Optimize limit settings

3. **Educate Users**
   - Explain limit purpose
   - Provide limit training
   - Share best practices

---

**Last Updated**: January 2024  
**Version**: 1.0.0