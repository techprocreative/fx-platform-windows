/**
 * Backtest EMA Triple + CCI Strategy on multiple timeframes
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STRATEGY_ID = 'cmh7slp95000140l3v43yevbb';
const TIMEFRAMES = ['M15', 'H1', 'H4'];

async function runBacktest(strategyId: string, timeframe: string) {
  console.log(`\n🚀 Running backtest for ${timeframe}...`);
  
  try {
    // Get strategy
    const strategy = await prisma.strategy.findUnique({
      where: { id: strategyId },
    });
    
    if (!strategy) {
      throw new Error('Strategy not found');
    }
    
    // Update timeframe
    await prisma.strategy.update({
      where: { id: strategyId },
      data: { timeframe },
    });
    
    console.log(`   Timeframe: ${timeframe}`);
    console.log(`   Symbol: ${strategy.symbol}`);
    
    // Create backtest request
    const backtest = await prisma.backtest.create({
      data: {
        userId: strategy.userId,
        strategyId: strategy.id,
        status: 'pending',
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-12-31'),
        initialBalance: 10000,
        settings: {
          timeframe,
          spread: 3.0,
          commission: 7.0,
          slippage: 2.0,
        },
      },
    });
    
    console.log(`✅ Backtest created: ${backtest.id}`);
    console.log(`   Status: ${backtest.status}`);
    console.log(`   Period: ${backtest.dateFrom.toISOString().split('T')[0]} to ${backtest.dateTo.toISOString().split('T')[0]}`);
    
    return backtest;
    
  } catch (error) {
    console.error(`❌ Error for ${timeframe}:`, error);
    throw error;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 EMA Triple + CCI Gold Strategy - Multi-Timeframe Backtest');
  console.log('═══════════════════════════════════════════════════════════');
  
  const results = [];
  
  for (const timeframe of TIMEFRAMES) {
    const result = await runBacktest(STRATEGY_ID, timeframe);
    results.push({ timeframe, backtestId: result.id });
    
    // Wait a bit between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ ALL BACKTESTS CREATED');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('Backtest IDs:');
  results.forEach(r => {
    console.log(`  ${r.timeframe}: ${r.backtestId}`);
  });
  
  console.log('\n🎯 Next Steps:');
  console.log('1. Go to dashboard → Backtest page');
  console.log('2. View results for each timeframe');
  console.log('3. Compare performance metrics');
  console.log('4. Choose best timeframe for your trading style\n');
  
  console.log('📈 What to look for:');
  console.log('  - Win Rate: Target 45-55%');
  console.log('  - Profit Factor: Target > 1.5');
  console.log('  - Max Drawdown: Target < 20%');
  console.log('  - Total Trades: More trades = more data');
  console.log('  - Sharpe Ratio: Target > 1.0\n');
}

main()
  .then(() => {
    console.log('🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
