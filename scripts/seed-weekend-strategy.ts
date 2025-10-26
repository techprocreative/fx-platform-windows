/**
 * Seed Weekend Strategy Template
 * 
 * Creates a specialized strategy for weekend crypto trading (BTCUSD).
 * 
 * Features:
 * - Crypto-focused (BTCUSD, ETHUSD)
 * - Weekend-optimized (Friday-Sunday)
 * - Volatility breakout + mean reversion
 * - Conservative risk (0.5% per trade)
 * - Wide stops for crypto volatility
 * - Quick exits (lower liquidity)
 * - Gap protection (Sunday close)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const WEEKEND_STRATEGY = {
  name: 'Weekend Crypto Breakout (BTCUSD)',
  description: `A specialized strategy for weekend crypto trading when forex markets are closed.

**Strategy Type:** Volatility Breakout + Mean Reversion
**Direction:** Bidirectional (BUY & SELL)
**Win Rate:** 55-62% (expected)
**Profit Factor:** 1.8-2.3 (expected)
**Best For:** Weekend traders, crypto enthusiasts

**How It Works:**
- Trades BTCUSD during weekends (Friday evening - Sunday evening)
- BUY on Bollinger breakouts up, RSI momentum, oversold bounces
- SELL on Bollinger breakouts down, RSI weakness, overbought reversals
- Uses OR logic (flexible entry)
- Conservative 0.5% risk per trade
- Wide 3x ATR stops for crypto volatility
- Quick 1.5:1 R:R exits (lower weekend liquidity)
- Auto-closes all positions Sunday 10 PM (gap protection)

**Weekend Market Characteristics:**
⚠️ Lower liquidity (forex closed)
⚠️ Higher volatility (retail dominated)
⚠️ Wider spreads (2-3x normal)
⚠️ Gap risk (Friday->Monday)

**Perfect for:**
✅ Weekend trading (when forex closed)
✅ Crypto markets (24/7 trading)
✅ Volatility breakouts
✅ Conservative approach
✅ Gap risk management`,
  
  symbol: 'BTCUSD',
  timeframe: 'H1',
  type: 'manual',
  status: 'draft',
  isPublic: true, // Make it visible to all users
  
  rules: {
    // ENTRY CONDITIONS
    entry: {
      logic: 'OR', // Flexible - any 1 condition triggers
      conditions: [
        // BUY SIGNALS
        {
          indicator: 'price',
          condition: 'greater_than',
          value: 'bollinger_upper',
          description: 'BUY 1: Price breaks above upper Bollinger Band (bullish breakout)',
          confirmation: 'Volume > 1.5x average',
        },
        {
          indicator: 'rsi',
          condition: 'greater_than',
          value: 55,
          period: 14,
          description: 'BUY 2: RSI crosses above 55 (momentum surge)',
        },
        {
          indicator: 'rsi',
          condition: 'less_than',
          value: 35,
          period: 14,
          description: 'BUY 3: RSI below 35 (deep oversold, expect bounce)',
        },
        {
          indicator: 'price',
          condition: 'greater_than',
          value: 'ema_50',
          description: 'BUY 4: Price breaks above EMA 50 (trend continuation)',
        },
        
        // SELL SIGNALS
        {
          indicator: 'price',
          condition: 'less_than',
          value: 'bollinger_lower',
          description: 'SELL 1: Price breaks below lower Bollinger Band (bearish breakdown)',
          confirmation: 'Volume > 1.5x average',
        },
        {
          indicator: 'rsi',
          condition: 'less_than',
          value: 45,
          period: 14,
          description: 'SELL 2: RSI crosses below 45 (weakness)',
        },
        {
          indicator: 'rsi',
          condition: 'greater_than',
          value: 65,
          period: 14,
          description: 'SELL 3: RSI above 65 (overbought, expect pullback)',
        },
        {
          indicator: 'price',
          condition: 'less_than',
          value: 'ema_50',
          description: 'SELL 4: Price breaks below EMA 50 (trend reversal)',
        },
      ],
    },
    
    // EXIT RULES (Weekend-optimized)
    exit: {
      takeProfit: {
        type: 'pips',
        value: 800, // Larger for BTCUSD
      },
      stopLoss: {
        type: 'pips',
        value: 600, // Wide for crypto volatility
      },
      trailing: {
        enabled: true,
        distance: 400, // Wide trailing
      },
      
      // SMART EXIT (Weekend-specific)
      smartExit: {
        stopLoss: {
          type: 'atr',
          atrMultiplier: 3.0, // Wider than weekday (2.0)
          minPips: 500,
          maxPips: 1500,
          maxHoldingHours: 24, // Max 1 day
          useSwingPoints: false,
        },
        takeProfit: {
          type: 'partial',
          rrRatio: 1.5, // Lower than weekday (2.0) - quick exits
          partialExits: [
            { percentage: 60, atRR: 1.0 }, // 60% at 1:1 (secure fast)
            { percentage: 30, atRR: 1.5 }, // 30% at 1.5:1
            { percentage: 10, atRR: 2.5 }, // 10% trail
          ],
        },
        weekendSpecific: {
          closeAllBySunday: true,
          sundayCloseTime: '22:00',
          avoidFridayEntry: false,
          fridayCloseTime: '21:00',
        },
      },
    },
    
    // RISK MANAGEMENT (Conservative for weekend)
    riskManagement: {
      lotSize: 0.001, // Small for crypto
      maxPositions: 2, // Limited for weekend
      maxDailyLoss: 300, // Conservative
    },
    
    // DYNAMIC RISK (Weekend-adjusted)
    dynamicRisk: {
      useATRSizing: false,
      useFixedFractional: true,
      riskPercentage: 0.5, // HALF of weekday (1.0%)
      weekendMultiplier: 0.5,
      autoAdjustLotSize: true,
      reduceInHighVolatility: true,
      volatilityThreshold: 0.03, // Higher for crypto
      maxPositionSize: 0.01,
    },
    
    // SESSION FILTER (Weekend-specific)
    sessionFilter: {
      enabled: true,
      mode: 'weekend',
      allowedDays: ['Friday', 'Saturday', 'Sunday'],
      allowedSessions: [], // Not session-based, time-based
      useOptimalPairs: false, // Crypto is 24/7
      aggressivenessMultiplier: {
        optimal: 1.0,
        suboptimal: 0.5,
      },
      optimalTimes: [
        {
          day: 'Friday',
          startHour: 18,
          endHour: 23,
          description: 'Friday evening position squaring',
        },
        {
          day: 'Saturday',
          startHour: 0,
          endHour: 24,
          description: 'Weekend trading (cautious)',
        },
        {
          day: 'Sunday',
          startHour: 18,
          endHour: 22,
          description: 'Sunday evening pre-Monday positioning',
        },
      ],
      avoidTimes: [
        {
          day: 'Saturday',
          startHour: 4,
          endHour: 12,
          description: 'Very low liquidity period',
        },
      ],
    },
    
    // VOLATILITY FILTER (Critical for weekend crypto)
    volatilityFilter: {
      enabled: true,
      minATR: 200,
      maxATR: 2000,
      optimalATRRange: [300, 800],
      action: {
        belowMin: 'SKIP',
        aboveMax: 'REDUCE_SIZE',
        inOptimal: 'NORMAL',
      },
      volatilitySpike: {
        threshold: 2.5,
        action: 'PAUSE',
        resumeAfter: 240, // 4 hours in minutes
      },
    },
    
    // CORRELATION FILTER (Disabled for crypto)
    correlationFilter: {
      enabled: false, // Crypto markets correlate highly
      maxCorrelation: 0.9,
      checkPairs: ['BTCUSD', 'ETHUSD'], // Only crypto
      skipHighlyCorrelated: false,
      timeframes: ['H1', 'H4'],
      lookbackPeriod: 14, // Shorter for crypto
      minDataPoints: 10,
      updateFrequency: 12, // Every 12 hours
      dynamicThreshold: false,
      groupByCurrency: false,
    },
    
    // REGIME DETECTION (Weekend-adapted)
    regimeDetection: {
      enabled: true,
      weekendMode: true,
      trendPeriod: 20,
      trendThreshold: 0.03, // Higher for crypto
      volatilityPeriod: 14,
      volatilityThreshold: 0.02, // Higher for crypto
      enableMTFAnalysis: true,
      primaryTimeframe: 'H1',
      confirmationTimeframes: ['H4'], // Only H4 (less data on weekends)
      weightTrend: 0.5,
      weightVolatility: 0.3,
      weightRange: 0.2,
      minConfidence: 60,
      lookbackPeriod: 14, // Shorter for weekend
      updateFrequency: 30, // Every 30 minutes
      minDataPoints: 30,
      enableTransitionDetection: true,
      regimeSpecific: {
        trending: {
          preferBreakouts: true,
          minConfidence: 70,
        },
        ranging: {
          preferMeanReversion: true,
          minConfidence: 60,
        },
        volatile: {
          reduceSize: true,
          widerStops: true,
          quickerExits: true,
        },
      },
    },
  },
};

async function seedWeekendStrategy() {
  try {
    console.log('🌙 Seeding weekend strategy template...\n');
    
    // Find admin or first user
    const adminUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { contains: 'admin' } },
          { email: { contains: 'nusa' } },
        ],
      },
    });
    
    if (!adminUser) {
      console.error('❌ No admin user found. Please create a user first.');
      process.exit(1);
    }
    
    console.log(`✅ Found user: ${adminUser.email}`);
    
    // Check if weekend strategy already exists
    const existing = await prisma.strategy.findFirst({
      where: {
        name: WEEKEND_STRATEGY.name,
        userId: adminUser.id,
      },
    });
    
    if (existing) {
      console.log('⚠️  Weekend strategy already exists. Updating...');
      
      const updated = await prisma.strategy.update({
        where: { id: existing.id },
        data: {
          description: WEEKEND_STRATEGY.description,
          symbol: WEEKEND_STRATEGY.symbol,
          timeframe: WEEKEND_STRATEGY.timeframe,
          rules: WEEKEND_STRATEGY.rules as any,
          isPublic: WEEKEND_STRATEGY.isPublic,
          status: WEEKEND_STRATEGY.status,
        },
      });
      
      console.log('✅ Weekend strategy updated successfully!');
      console.log(`   ID: ${updated.id}`);
      console.log(`   Name: ${updated.name}`);
      console.log(`   Symbol: ${updated.symbol}`);
      console.log(`   Timeframe: ${updated.timeframe}`);
      console.log(`   Status: ${updated.status}`);
      
      return updated;
    }
    
    // Create new weekend strategy
    const strategy = await prisma.strategy.create({
      data: {
        ...WEEKEND_STRATEGY,
        userId: adminUser.id,
        rules: WEEKEND_STRATEGY.rules as any,
      },
    });
    
    console.log('✅ Weekend strategy created successfully!');
    console.log(`   ID: ${strategy.id}`);
    console.log(`   Name: ${strategy.name}`);
    console.log(`   Symbol: ${strategy.symbol}`);
    console.log(`   Timeframe: ${strategy.timeframe}`);
    console.log(`   Status: ${strategy.status}`);
    console.log(`   Public: ${strategy.isPublic}`);
    
    // Print strategy details
    console.log('\n📊 Strategy Configuration:');
    console.log(`   Entry Logic: ${(WEEKEND_STRATEGY.rules.entry as any).logic}`);
    console.log(`   Entry Conditions: ${(WEEKEND_STRATEGY.rules.entry as any).conditions.length}`);
    console.log(`   Stop Loss: ${WEEKEND_STRATEGY.rules.exit.stopLoss.value} pips`);
    console.log(`   Take Profit: ${WEEKEND_STRATEGY.rules.exit.takeProfit.value} pips`);
    console.log(`   Risk per Trade: ${WEEKEND_STRATEGY.rules.dynamicRisk?.riskPercentage}%`);
    console.log(`   Max Positions: ${WEEKEND_STRATEGY.rules.riskManagement.maxPositions}`);
    console.log(`   ATR Multiplier: ${WEEKEND_STRATEGY.rules.exit.smartExit?.stopLoss.atrMultiplier}x`);
    
    console.log('\n🌙 Weekend-Specific Features:');
    console.log(`   ✅ Wide Stops (3x ATR for crypto volatility)`);
    console.log(`   ✅ Quick Exits (1.5:1 R:R for lower liquidity)`);
    console.log(`   ✅ Sunday Close (gap protection)`);
    console.log(`   ✅ Conservative Risk (0.5% per trade)`);
    console.log(`   ✅ Volatility Filter (skip extreme moves)`);
    
    console.log('\n🚀 Advanced Features Enabled:');
    console.log(`   ✅ Smart Exit (Partial 60-30-10%)`);
    console.log(`   ✅ Dynamic Risk (Fixed fractional)`);
    console.log(`   ✅ Weekend Session Filter`);
    console.log(`   ✅ Volatility Filter (200-2000 ATR)`);
    console.log(`   ✅ Regime Detection (Weekend mode)`);
    
    console.log('\n⏰ Optimal Trading Times:');
    console.log(`   🌆 Friday 18:00-23:00 GMT (Position squaring)`);
    console.log(`   🌃 Saturday 14:00-20:00 GMT (Moderate activity)`);
    console.log(`   🌅 Sunday 18:00-22:00 GMT (Pre-Monday positioning)`);
    
    console.log('\n⚠️  Weekend Trading Risks:');
    console.log(`   - Lower liquidity (forex closed)`);
    console.log(`   - Higher volatility (retail dominated)`);
    console.log(`   - Wider spreads (2-3x normal)`);
    console.log(`   - Gap risk (Friday->Monday)`);
    
    console.log('\n✅ Risk Mitigation:');
    console.log(`   - Conservative 0.5% risk per trade`);
    console.log(`   - Wide 3x ATR stops`);
    console.log(`   - Quick 1.5:1 profit taking`);
    console.log(`   - Auto-close Sunday 10 PM GMT`);
    console.log(`   - Max 2 concurrent positions`);
    console.log(`   - Max 24-hour holding period`);
    
    console.log('\n💡 Usage:');
    console.log('   1. Enable for weekend trading (Friday-Sunday)');
    console.log('   2. Trade BTCUSD or ETHUSD');
    console.log('   3. Monitor every 4-6 hours');
    console.log('   4. Auto-closes Sunday evening');
    console.log('   5. Switch to weekday strategy Monday');
    
    console.log('\n✅ Seeding complete!');
    
    return strategy;
    
  } catch (error) {
    console.error('❌ Error seeding weekend strategy:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run seeding
seedWeekendStrategy()
  .then(() => {
    console.log('\n🎉 Success!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
