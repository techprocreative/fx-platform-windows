import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyStrategy() {
  try {
    console.log('🔍 Verifying XAUUSD M15 Scalping Pro strategy...\n');
    
    // Find the strategy
    const strategy = await prisma.strategy.findFirst({
      where: {
        name: '⚡ XAUUSD M15 Scalping Pro - Advanced',
      },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    
    if (!strategy) {
      console.log('❌ Strategy not found!');
      return;
    }
    
    console.log('✅ Strategy found successfully!\n');
    console.log('📊 Strategy Details:');
    console.log('================================');
    console.log('ID:', strategy.id);
    console.log('Name:', strategy.name);
    console.log('Symbol:', strategy.symbol);
    console.log('Timeframe:', strategy.timeframe);
    console.log('Type:', strategy.type);
    console.log('Status:', strategy.status);
    console.log('Created:', strategy.createdAt);
    console.log('\n👤 Owner:');
    console.log('Email:', strategy.user.email);
    console.log('Name:', strategy.user.firstName, strategy.user.lastName);
    
    // Check advanced features
    const rules = strategy.rules as any;
    console.log('\n🎯 Advanced Features Configured:');
    console.log('================================');
    console.log('✅ Multi-Timeframe Analysis:', rules.multiTimeframe?.enabled ? 'Enabled' : 'Disabled');
    console.log('✅ AI Optimization:', rules.aiOptimization?.enabled ? 'Enabled' : 'Disabled');
    console.log('✅ Dynamic Adjustments:', rules.dynamicAdjustments?.useATRSizing ? 'Enabled' : 'Disabled');
    console.log('✅ Smart Exit:', rules.exit?.smartExit ? 'Configured' : 'Not configured');
    console.log('✅ Correlation Filter:', rules.filters?.correlationFilter?.enabled ? 'Enabled' : 'Disabled');
    console.log('✅ Market Regime Detection:', rules.dynamicAdjustments?.regimeAdjustment?.enabled ? 'Enabled' : 'Disabled');
    console.log('✅ News Filter:', rules.filters?.newsFilter?.enabled ? 'Enabled' : 'Disabled');
    console.log('✅ Session Optimization:', rules.dynamicAdjustments?.sessionAdjustment?.enabled ? 'Enabled' : 'Disabled');
    console.log('✅ Pattern Recognition:', rules.aiOptimization?.patternRecognition?.enabled ? 'Enabled' : 'Disabled');
    console.log('✅ Anomaly Detection:', rules.aiOptimization?.anomalyDetection?.enabled ? 'Enabled' : 'Disabled');
    
    // Check backtest results
    const backtestResults = strategy.backtestResults as any;
    if (backtestResults) {
      console.log('\n📈 Backtest Performance:');
      console.log('================================');
      console.log('Period:', backtestResults.period);
      console.log('Total Trades:', backtestResults.totalTrades);
      console.log('Win Rate:', backtestResults.winRate + '%');
      console.log('Profit Factor:', backtestResults.profitFactor);
      console.log('Total Return:', backtestResults.totalReturn + '%');
      console.log('Max Drawdown:', backtestResults.maxDrawdown + '%');
      console.log('Sharpe Ratio:', backtestResults.sharpeRatio);
      console.log('Expectancy:', backtestResults.expectancy + ' pips');
    }
    
    // Check entry conditions
    if (rules.entry?.groups) {
      console.log('\n📊 Entry Logic:');
      console.log('================================');
      console.log('Long Entry Conditions:', rules.entry.groups[0]?.conditions?.length || 0);
      console.log('Short Entry Conditions:', rules.entry.groups[1]?.conditions?.length || 0);
    }
    
    // Risk management
    if (rules.riskManagement) {
      console.log('\n🛡️ Risk Management:');
      console.log('================================');
      console.log('Risk Per Trade:', rules.riskManagement.riskPercentage + '%');
      console.log('Max Daily Loss:', rules.riskManagement.maxDailyLoss + '%');
      console.log('Max Weekly Loss:', rules.riskManagement.maxWeeklyLoss + '%');
      console.log('Max Monthly Loss:', rules.riskManagement.maxMonthlyLoss + '%');
      console.log('Max Positions:', rules.riskManagement.maxPositions);
    }
    
    console.log('\n✅ Strategy verification complete!');
    
  } catch (error) {
    console.error('❌ Error verifying strategy:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyStrategy();
