/**
 * EMA 50/110/200 + CCI Strategy for XAUUSD (Gold)
 * 
 * Strategi investor menggunakan:
 * - EMA 50, EMA 110, EMA 200 untuk trend confirmation
 * - Commodity Channel Index (CCI) 20 periode (range -100 to 0.00)
 * - Stop Loss: 2 point under EMA 200
 * - Risk/Reward: 1:3
 * - Timeframes: 15M, 1H, 4H
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EMA_CCI_GOLD_STRATEGY = {
  name: '💰 EMA Triple + CCI Gold Strategy',
  description: `Advanced gold trading strategy using triple EMA confirmation and CCI oversold signals.

**Strategy Type:** Gold Swing/Position Trading
**Entry Setup:** Triple EMA alignment + CCI oversold
**Stop Loss:** 2 pips below EMA 200 (dynamic)
**Risk/Reward:** 1:3 (Conservative)
**Recommended Timeframes:** 15M, 1H, 4H

**Strategy Logic:**

📈 **LONG Entry (BUY):**
1. Price above EMA 50 > EMA 110 > EMA 200 (trending up)
2. CCI (20) in oversold zone: -100 to 0.00
3. Wait for CCI to cross above -100 (momentum confirmation)
4. Enter on price bounce from EMA 50 or EMA 110

🛑 **Stop Loss:**
- 2 pips below EMA 200 (dynamic with market movement)
- Minimum 150 pips, maximum 400 pips for gold volatility

🎯 **Take Profit:**
- Primary target: 1:3 Risk/Reward ratio
- Partial exits: 50% at 1:2, 50% at 1:3
- Trail stop at 1:2 RR reached

📉 **SHORT Entry (SELL):**
1. Price below EMA 50 < EMA 110 < EMA 200 (trending down)
2. CCI (20) in overbought zone: 0.00 to 100
3. Wait for CCI to cross below 100 (momentum confirmation)
4. Enter on price rejection from EMA 50 or EMA 110

**Filters:**
✅ Session filter: London + New York (best volatility)
✅ Spread filter: Max 5 pips
✅ Volatility filter: ATR 40-120 pips optimal
✅ News filter: Pause 30 min before/after major events

**Advantages:**
✅ Triple EMA provides strong trend confirmation
✅ CCI identifies quality oversold/overbought entries
✅ Dynamic stop loss follows market structure
✅ High reward-to-risk ratio (1:3)
✅ Filters reduce false signals in choppy markets

**Best For:**
✅ Patient traders who wait for quality setups
✅ Multiple timeframe analysis (15M, 1H, 4H)
✅ Gold market with high volatility
✅ Economic news-driven movements`,
  
  symbol: 'XAUUSD',
  timeframe: 'H1', // Default, akan dijalankan di 15M, 1H, 4H
  type: 'manual',
  status: 'draft',
  isPublic: false,
  isSystemDefault: false,
  
  rules: {
    entry: {
      logic: 'AND',
      conditions: [
        // === LONG SETUP (BUY) ===
        {
          indicator: 'ema_50',
          condition: 'greater_than',
          value: 'ema_110',
          description: 'BUY: EMA 50 > EMA 110',
        },
        {
          indicator: 'ema_110',
          condition: 'greater_than',
          value: 'ema_200',
          description: 'BUY: EMA 110 > EMA 200',
        },
        {
          indicator: 'price',
          condition: 'greater_than',
          value: 'ema_50',
          description: 'BUY: Price > EMA 50 (above trend)',
        },
        {
          indicator: 'cci',
          period: 20,
          condition: 'crosses_above',
          value: -100,
          description: 'BUY: CCI crosses above -100 (exit oversold)',
        },
        {
          indicator: 'price',
          condition: 'bounces_from',
          value: 'ema_50',
          tolerance: 10,
          description: 'BUY: Price bounces from EMA 50 ±10 pips',
        },
        
        // === SHORT SETUP (SELL) ===
        {
          indicator: 'ema_50',
          condition: 'less_than',
          value: 'ema_110',
          description: 'SELL: EMA 50 < EMA 110',
        },
        {
          indicator: 'ema_110',
          condition: 'less_than',
          value: 'ema_200',
          description: 'SELL: EMA 110 < EMA 200',
        },
        {
          indicator: 'price',
          condition: 'less_than',
          value: 'ema_50',
          description: 'SELL: Price < EMA 50 (below trend)',
        },
        {
          indicator: 'cci',
          period: 20,
          condition: 'crosses_below',
          value: 100,
          description: 'SELL: CCI crosses below 100 (exit overbought)',
        },
        {
          indicator: 'price',
          condition: 'rejects_from',
          value: 'ema_50',
          tolerance: 10,
          description: 'SELL: Price rejects from EMA 50 ±10 pips',
        },
      ],
    },
    
    exit: {
      stopLoss: { 
        type: 'dynamic',
        value: 'ema_200_minus_2',
        minPips: 150,
        maxPips: 400,
      },
      takeProfit: { 
        type: 'rr_ratio',
        value: 3.0,
      },
      trailing: { 
        enabled: true,
        activateAtRR: 2.0,
        distance: 100, // 100 pips trail
      },
      smartExit: {
        stopLoss: {
          type: 'ema',
          emaReference: 'ema_200',
          distancePips: 2,
          minPips: 150,
          maxPips: 400,
          updateOnCandle: true,
          maxHoldingHours: 48, // Max 2 days hold
        },
        takeProfit: {
          type: 'partial',
          rrRatio: 3.0,
          partialExits: [
            { percentage: 50, atRR: 2.0 }, // Take 50% profit at 1:2 RR
            { percentage: 50, atRR: 3.0 }, // Take remaining at 1:3 RR
          ],
        },
      },
    },
    
    riskManagement: {
      lotSize: 0.01,
      maxPositions: 1, // Only 1 position at a time
      maxDailyLoss: 500, // Max 500 pips loss per day
    },
    
    dynamicRisk: {
      useATRSizing: false,
      useFixedFractional: true,
      riskPercentage: 1.0, // Risk 1% per trade
      autoAdjustLotSize: true,
      reduceInHighVolatility: true,
      volatilityThreshold: 0.03,
    },
    
    // Gold-specific filters
    sessionFilter: {
      enabled: true,
      allowedSessions: ['London', 'NewYork'],
      useOptimalPairs: false,
      aggressivenessMultiplier: {
        optimal: 1.0,
        suboptimal: 0.0,
      },
    },
    
    spreadFilter: {
      enabled: true,
      maxSpread: 5.0, // Max 5 pips spread
      action: 'SKIP',
    },
    
    volatilityFilter: {
      enabled: true,
      minATR: 40,
      maxATR: 120,
      optimalATRRange: [60, 100],
      action: {
        belowMin: 'SKIP',
        aboveMax: 'REDUCE_SIZE',
        inOptimal: 'NORMAL',
      },
    },
    
    newsFilter: {
      enabled: true,
      pauseBeforeMinutes: 30,
      pauseAfterMinutes: 30,
      highImpactOnly: true,
      majorEvents: [
        'FOMC',
        'NFP',
        'CPI',
        'GDP',
        'Gold Inventory',
        'USD Index',
      ],
    },
    
    // Multi-timeframe confirmation
    regimeDetection: {
      enabled: true,
      enableMTFAnalysis: true,
      primaryTimeframe: 'H1',
      confirmationTimeframes: ['H4', 'D1'],
      weightTrend: 0.7,
      weightVolatility: 0.2,
      weightRange: 0.1,
      minConfidence: 70,
      preferredRegimes: ['TRENDING'],
    },
  },
};

async function createStrategy() {
  try {
    console.log('🚀 Creating EMA Triple + CCI Gold Strategy...\n');
    
    // Find user
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { contains: 'admin' } },
          { email: { contains: 'nusa' } },
        ],
      },
    });
    
    if (!user) {
      console.error('❌ No user found. Please create a user first.');
      process.exit(1);
    }
    
    console.log(`✅ Found user: ${user.email}\n`);
    
    // Check if exists
    const existing = await prisma.strategy.findFirst({
      where: {
        userId: user.id,
        name: EMA_CCI_GOLD_STRATEGY.name,
      },
    });
    
    let strategy;
    
    if (existing) {
      console.log('⚠️  Strategy already exists. Updating...\n');
      
      strategy = await prisma.strategy.update({
        where: { id: existing.id },
        data: {
          ...EMA_CCI_GOLD_STRATEGY,
          rules: EMA_CCI_GOLD_STRATEGY.rules as any,
        },
      });
      
      console.log(`✅ Updated: ${strategy.name}`);
    } else {
      strategy = await prisma.strategy.create({
        data: {
          ...EMA_CCI_GOLD_STRATEGY,
          userId: user.id,
          rules: EMA_CCI_GOLD_STRATEGY.rules as any,
        },
      });
      
      console.log(`✅ Created: ${strategy.name}`);
    }
    
    console.log(`   ID: ${strategy.id}`);
    console.log(`   Symbol: ${strategy.symbol}`);
    console.log(`   Timeframe: ${strategy.timeframe}`);
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ STRATEGY CREATED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('📊 Strategy Details:');
    console.log('   - Triple EMA: 50, 110, 200');
    console.log('   - CCI Period: 20 (range -100 to 0)');
    console.log('   - Stop Loss: 2 pips below EMA 200');
    console.log('   - Risk/Reward: 1:3');
    console.log('   - Partial exits: 50% at 1:2, 50% at 1:3\n');
    
    console.log('🎯 Next Steps:');
    console.log('   1. Run backtest on 15M timeframe');
    console.log('   2. Run backtest on 1H timeframe');
    console.log('   3. Run backtest on 4H timeframe');
    console.log('   4. Compare results and choose best timeframe\n');
    
    console.log(`Strategy ID: ${strategy.id}`);
    console.log('Use this ID for backtesting.\n');
    
    return strategy;
    
  } catch (error) {
    console.error('\n❌ Error creating strategy:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run creation
createStrategy()
  .then(() => {
    console.log('🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
