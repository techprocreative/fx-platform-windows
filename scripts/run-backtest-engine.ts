/**
 * Execute backtest engine for EMA Triple + CCI strategy
 */
import { PrismaClient } from '@prisma/client';
import { runBacktest } from '../src/lib/backtest/engine';

const prisma = new PrismaClient();

const BACKTEST_IDS = [
  'cmh7slyfr0001z85k9rglsq7g', // M15
  'cmh7slzbd0003z85kc2bfgyzd', // H1
  'cmh7sm0690005z85k5qyahuf5', // H4
];

async function executeBacktest(backtestId: string) {
  try {
    const backtest = await prisma.backtest.findUnique({
      where: { id: backtestId },
      include: { strategy: true },
    });
    
    if (!backtest) {
      throw new Error(`Backtest ${backtestId} not found`);
    }
    
    console.log(`\n🚀 Running backtest: ${backtest.id}`);
    console.log(`   Strategy: ${backtest.strategy.name}`);
    console.log(`   Timeframe: ${backtest.strategy.timeframe}`);
    console.log(`   Symbol: ${backtest.strategy.symbol}`);
    console.log(`   Period: ${backtest.dateFrom.toISOString().split('T')[0]} to ${backtest.dateTo.toISOString().split('T')[0]}`);
    
    // Update status to running
    await prisma.backtest.update({
      where: { id: backtestId },
      data: { status: 'running' },
    });
    
    // Run backtest
    const result = await runBacktest(backtest.strategyId, {
      dateFrom: backtest.dateFrom,
      dateTo: backtest.dateTo,
      initialBalance: backtest.initialBalance,
      ...backtest.settings as any,
    });
    
    // Save results
    await prisma.backtest.update({
      where: { id: backtestId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        results: result as any,
      },
    });
    
    console.log(`✅ Completed!`);
    console.log(`   Total Trades: ${result.totalTrades}`);
    console.log(`   Win Rate: ${result.winRate.toFixed(2)}%`);
    console.log(`   Profit Factor: ${result.profitFactor.toFixed(2)}`);
    console.log(`   Total Return: ${result.totalReturn.toFixed(2)}%`);
    console.log(`   Max Drawdown: ${result.maxDrawdown.toFixed(2)}%`);
    console.log(`   Sharpe Ratio: ${result.sharpeRatio?.toFixed(2) || 'N/A'}`);
    
    return result;
    
  } catch (error: any) {
    console.error(`❌ Error:`, error.message);
    
    await prisma.backtest.update({
      where: { id: backtestId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        results: { error: error.message } as any,
      },
    });
    
    throw error;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 EMA Triple + CCI Gold Strategy - Backtest Execution');
  console.log('═══════════════════════════════════════════════════════════');
  
  const results: any[] = [];
  
  for (const backtestId of BACKTEST_IDS) {
    try {
      const result = await executeBacktest(backtestId);
      results.push(result);
    } catch (error) {
      console.error(`Failed to run backtest ${backtestId}`);
    }
  }
  
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('📈 BACKTEST RESULTS SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (results.length > 0) {
    console.log('Timeframe Comparison:\n');
    
    const timeframes = ['M15', 'H1', 'H4'];
    results.forEach((result, index) => {
      console.log(`${timeframes[index]}:`);
      console.log(`  Win Rate: ${result.winRate.toFixed(2)}%`);
      console.log(`  Profit Factor: ${result.profitFactor.toFixed(2)}`);
      console.log(`  Total Return: ${result.totalReturn.toFixed(2)}%`);
      console.log(`  Max Drawdown: ${result.maxDrawdown.toFixed(2)}%`);
      console.log(`  Total Trades: ${result.totalTrades}`);
      console.log(`  Sharpe Ratio: ${result.sharpeRatio?.toFixed(2) || 'N/A'}`);
      console.log('');
    });
    
    // Find best timeframe
    const bestByReturn = results.reduce((best, current, index) => 
      current.totalReturn > best.totalReturn ? { ...current, timeframe: timeframes[index] } : best
    , { ...results[0], timeframe: timeframes[0] });
    
    const bestByWinRate = results.reduce((best, current, index) => 
      current.winRate > best.winRate ? { ...current, timeframe: timeframes[index] } : best
    , { ...results[0], timeframe: timeframes[0] });
    
    const bestByDrawdown = results.reduce((best, current, index) => 
      current.maxDrawdown < best.maxDrawdown ? { ...current, timeframe: timeframes[index] } : best
    , { ...results[0], timeframe: timeframes[0] });
    
    console.log('🏆 Best Performance:');
    console.log(`  Highest Return: ${bestByReturn.timeframe} (${bestByReturn.totalReturn.toFixed(2)}%)`);
    console.log(`  Best Win Rate: ${bestByWinRate.timeframe} (${bestByWinRate.winRate.toFixed(2)}%)`);
    console.log(`  Lowest Drawdown: ${bestByDrawdown.timeframe} (${bestByDrawdown.maxDrawdown.toFixed(2)}%)`);
    console.log('');
    
    console.log('💡 Recommendations:');
    console.log(`  - For aggressive trading: ${bestByReturn.timeframe}`);
    console.log(`  - For consistent wins: ${bestByWinRate.timeframe}`);
    console.log(`  - For risk-averse: ${bestByDrawdown.timeframe}`);
  }
}

main()
  .then(() => {
    console.log('\n🎉 All backtests completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
