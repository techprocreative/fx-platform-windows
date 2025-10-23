# Strategy Detail Page Enhancement Plan

## Current Issues

User feedback: "overview dari strategi detail di ui hanya menampilkan ini dan kurang jelas"

Current display shows:
```
Strategy Rules
Description: ...
Entry Conditions:
- cci gt -100
- price gt
- ema_20 lt
- price gte 4105

Exit Rules:
- Take Profit: 40 pips
- Stop Loss: 25 pips

Risk Management:
- Lot Size: 0.01
- Max Positions: 1
- Max Daily Loss: $100
```

## Problems

1. ❌ Entry conditions too cryptic ("gt", "lt", "gte")
2. ❌ No visual indicators
3. ❌ Missing R:R ratio
4. ❌ No indicator badges
5. ❌ No advanced features display
6. ❌ Plain text, no color coding
7. ❌ No explanations

## Proposed Enhancements

### 1. Extracted Indicators Section
```
📊 TECHNICAL INDICATORS
[CCI] [EMA_20] [PRICE]
```

### 2. Enhanced Entry Conditions
```
📍 ENTRY RULES (AND Logic - All must be true)

Condition 1: ✅ CCI > -100
└─ Commodity Channel Index must be greater than -100
  
Condition 2: ✅ Price > EMA 20
└─ Current price must be above 20-period Exponential Moving Average

Condition 3: ✅ EMA 20 < Price
└─ 20-period EMA must be below current price

Condition 4: ✅ Price ≥ 4105
└─ Price must be at or above 4105 level
```

### 3. Risk-Reward Ratio Card
```
🎯 RISK-REWARD RATIO: 1:1.60
For every $1 risked (25 pips), potential to gain $1.60 (40 pips)
```

### 4. Enhanced Exit Rules
```
🚪 EXIT STRATEGY

[Take Profit]          [Stop Loss]
  40 pips                25 pips
  $400 per lot           $250 per lot
  ✅ Good R:R            🛡️ Protected
```

### 5. Advanced Features Display
```
⭐ ADVANCED FEATURES
● Smart Exit Rules: ATR-based trailing stop
● Dynamic Risk: Volatility-adjusted position sizing
● Session Filter: London + NewYork only
● Regime Detection: Sideways market adaptation
```

### 6. Visual Improvements
- Color-coded cards (green=profit, red=loss, blue=info)
- Icons for each section
- Progress bars where applicable
- Explanatory tooltips
- Better spacing and hierarchy

## Implementation

File: `src/app/(dashboard)/dashboard/strategies/[id]/page.tsx`

Changes needed:
1. Add helper functions for formatting
2. Replace overview section (lines 471-560)
3. Add visual components
4. Extract and display indicators
5. Calculate and show R:R ratio
6. Display advanced features if present

Lines to add: ~200 lines
Complexity: Medium
Impact: High user clarity
