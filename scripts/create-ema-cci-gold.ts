/**
 * EMA 50/110/200 + CCI Strategy for XAUUSD
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STRATEGY = {
  name: '💰 EMA Triple + CCI Gold',
  description: `Gold strategy: EMA 50/110/200 + CCI(20) range -100 to 0
  
**Entry:**
- LONG: EMA 50>110>200, Price>EMA50, CCI crosses above -100
- SHORT: EMA 50<110<200, Price<EMA50, CCI crosses below 100

**Exit:**
- SL: 2 pips below EMA 200 (150-400 pips)
- TP: 1:3 Risk/Reward
- Partial: 50% at 1:2, 50% at 1:3

**Timeframes:** 15M, 1H, 4H`,
  
  symbol: 'XAUUSD',
  timeframe: 'H1',
  type: 'manual',
  status: 'draft',
  isPublic: false,
  
  rules: {
    entry: {
      logic: 'AND',
      conditions: [
        // LONG
        { indicator: 'ema_50', condition: 'greater_than', value: 'ema_110' },
        { indicator: 'ema_110', condition: 'greater_than', value: 'ema_200' },
        { indicator: 'price', condition: 'greater_than', value: 'ema_50' },
        { indicator: 'cci', period: 20, condition: 'crosses_above', value: -100 },
        // SHORT
        { indicator: 'ema_50', condition: 'less_than', value: 'ema_110' },
        { indicator: 'ema_110', condition: 'less_than', value: 'ema_200' },
        { indicator: 'price', condition: 'less_than', value: 'ema_50' },
        { indicator: 'cci', period: 20, condition: 'crosses_below', value: 100 },
      ],
    },
    exit: {
      stopLoss: { type: 'pips', value: 200 },
      takeProfit: { type: 'pips', value: 600 },
      trailing: { enabled: true, distance: 100 },
      smartExit: {
        stopLoss: { type: 'fixed', fixedPips: 200, minPips: 150, maxPips: 400 },
        takeProfit: {
          type: 'partial',
          rrRatio: 3.0,
          partialExits: [
            { percentage: 50, atRR: 2.0 },
            { percentage: 50, atRR: 3.0 },
          ],
        },
      },
    },
    riskManagement: { lotSize: 0.01, maxPositions: 1, maxDailyLoss: 500 },
    parameters: {
      stopLoss: 0.01, // 1% or 200 pips for gold
      takeProfit: 0.03, // 3% or 600 pips for gold
      maxPositions: 1,
      maxDailyLoss: 500,
    },
    dynamicRisk: {
      useATRSizing: false,
      riskPercentage: 1.0,
      autoAdjustLotSize: true,
      reduceInHighVolatility: true,
      volatilityThreshold: 0.03,
    },
    sessionFilter: {
      enabled: true,
      allowedSessions: ['London', 'NewYork'],
      aggressivenessMultiplier: { optimal: 1.0, suboptimal: 0.0 },
    },
    spreadFilter: { enabled: true, maxSpread: 5.0, action: 'SKIP' },
    volatilityFilter: {
      enabled: true,
      minATR: 40,
      maxATR: 120,
      optimalATRRange: [60, 100],
      action: { belowMin: 'SKIP', aboveMax: 'REDUCE_SIZE', inOptimal: 'NORMAL' },
    },
  },
};

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) throw new Error('No user found');
  
  const strategy = await prisma.strategy.upsert({
    where: { id: 'dummy' },
    create: { ...STRATEGY, userId: user.id, rules: STRATEGY.rules as any },
    update: { ...STRATEGY, rules: STRATEGY.rules as any },
  }).catch(() => 
    prisma.strategy.create({
      data: { ...STRATEGY, userId: user.id, rules: STRATEGY.rules as any },
    })
  );
  
  console.log('✅ Strategy created:', strategy.id);
  return strategy;
}

main().then(() => process.exit(0)).catch(console.error);
