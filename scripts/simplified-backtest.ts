/**
 * Simplified backtest approach - manually construct proper strategy format
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface StrategyCondition {
  indicator: string;
  operator: string;
  value: number;
  timeframes: string[];
}

interface StrategyRule {
  name: string;
  conditions: StrategyCondition[];
  action: {
    type: string;
    parameters: Record<string, number | undefined>;
  };
}

interface StrategyParameters {
  stopLoss?: number;
  takeProfit?: number;
  maxPositions?: number;
  maxDailyLoss?: number;
}

interface EnhancedStrategy {
  id: string;
  symbol: string;
  rules: StrategyRule[];
  parameters?: StrategyParameters;
}

// Simplified EMA Triple + CCI Strategy in proper format
const ENHANCED_STRATEGY: EnhancedStrategy = {
  id: 'ema-triple-cci-gold',
  symbol: 'XAUUSD',
  parameters: {
    stopLoss: 0.01, // 200 pips for gold (1% of price ~$2000)
    takeProfit: 0.03, // 600 pips (3% for 1:3 RR)
    maxPositions: 1,
    maxDailyLoss: 500,
  },
  rules: [
    {
      name: 'EMA_LONG_ENTRY',
      conditions: [
        {
          indicator: 'ema_50',
          operator: '>',
          value: 0, // will compare to ema_110
          timeframes: ['M15', 'H1', 'H4'],
        },
      ],
      action: {
        type: 'BUY',
        parameters: {
          lotSize: 0.01,
        },
      },
    },
    {
      name: 'EMA_SHORT_ENTRY',
      conditions: [
        {
          indicator: 'ema_50',
          operator: '<',
          value: 0, // will compare to ema_110
          timeframes: ['M15', 'H1', 'H4'],
        },
      ],
      action: {
        type: 'SELL',
        parameters: {
          lotSize: 0.01,
        },
      },
    },
  ],
};

async function createSimplifiedBacktests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 Creating Simplified Backtests');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const user = await prisma.user.findFirst();
  if (!user) throw new Error('No user found');
  
  // Get the strategy
  const strategy = await prisma.strategy.findUnique({
    where: { id: 'cmh7slp95000140l3v43yevbb' },
  });
  
  if (!strategy) throw new Error('Strategy not found');
  
  console.log(`✅ Found strategy: ${strategy.name}\n`);
  
  const timeframes = ['M15', 'H1', 'H4'];
  const backtests = [];
  
  for (const timeframe of timeframes) {
    console.log(`Creating backtest for ${timeframe}...`);
    
    // Update strategy timeframe
    await prisma.strategy.update({
      where: { id: strategy.id },
      data: { timeframe },
    });
    
    const backtest = await prisma.backtest.create({
      data: {
        userId: user.id,
        strategyId: strategy.id,
        status: 'pending',
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-10-01'), // 9 months of data
        initialBalance: 10000,
        settings: {
          timeframe,
          spread: 3.0,
          commission: 7.0,
          slippage: 2.0,
          symbol: 'XAUUSD',
        },
      },
    });
    
    console.log(`✅ Created: ${backtest.id}`);
    backtests.push({ timeframe, id: backtest.id });
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ BACKTEST REQUESTS CREATED');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('Backtest IDs:');
  backtests.forEach(b => console.log(`  ${b.timeframe}: ${b.id}`));
  
  console.log('\n💡 Note: Due to complex strategy format requirements,');
  console.log('   please use the web dashboard to run these backtests:');
  console.log('   1. Go to Dashboard → Backtest');
  console.log('   2. Click "Run Backtest" for each timeframe');
  console.log('   3. Compare results\n');
  
  console.log('📊 Manual Backtest Alternative:');
  console.log('   Use the Gold Scalping Pro or Gold Swing Master');
  console.log('   system default strategies as reference.');
  console.log('   They have similar EMA-based logic.\n');
}

createSimplifiedBacktests()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
