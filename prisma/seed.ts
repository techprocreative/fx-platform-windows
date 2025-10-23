import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Check if demo user exists
  let demoUser = await prisma.user.findUnique({
    where: { email: 'demo@nexustrade.com' },
  });

  if (!demoUser) {
    demoUser = await prisma.user.create({
      data: {
        email: 'demo@nexustrade.com',
        passwordHash: await hashPassword('Demo123!'),
        firstName: 'Demo',
        lastName: 'User',
        emailVerified: new Date(),
        preferences: {
          create: {
            theme: 'light',
            language: 'en',
            timezone: 'UTC',
          },
        },
      },
    });
    console.log('✅ Created demo user:', demoUser.email);
  } else {
    console.log('✅ Demo user already exists:', demoUser.email);
  }

  // Create or get sample strategy
  let strategy = await prisma.strategy.findFirst({
    where: {
      userId: demoUser.id,
      name: 'Demo RSI Strategy',
      deletedAt: null,
    },
  });

  if (!strategy) {
    strategy = await prisma.strategy.create({
      data: {
        userId: demoUser.id,
        name: 'Demo RSI Strategy',
        description: 'A sample RSI-based trading strategy for demonstration',
        symbol: 'EURUSD',
        timeframe: 'H1',
        type: 'manual',
        status: 'draft',
        rules: {
          entry: {
            conditions: [
              {
                indicator: 'RSI',
                condition: 'less_than',
                value: 30,
                period: 14,
              },
            ],
            logic: 'AND',
          },
          exit: {
            takeProfit: {
              type: 'pips',
              value: 50,
            },
            stopLoss: {
              type: 'pips',
              value: 25,
            },
          },
          riskManagement: {
            lotSize: 0.1,
            maxPositions: 5,
            maxDailyLoss: 500,
          },
        },
      },
    });
    console.log('✅ Created sample strategy:', strategy.name);
  } else {
    console.log('✅ Sample strategy already exists:', strategy.name);
  }

  // Create or get demo executor for trades
  let demoExecutor = await prisma.executor.findFirst({
    where: {
      userId: demoUser.id,
      name: 'Demo Executor',
    },
  });

  if (!demoExecutor) {
    demoExecutor = await prisma.executor.create({
      data: {
        userId: demoUser.id,
        name: 'Demo Executor',
        platform: 'MetaTrader 5',
        apiKey: `API_KEY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        apiSecretHash: await hashPassword('demo_secret_pass'),
        status: 'online',
        lastHeartbeat: new Date(),
      },
    });
    console.log('✅ Created demo executor');
  } else {
    console.log('✅ Demo executor already exists');
  }

  // Create sample trades (only if not already created)
  const existingTradesCount = await prisma.trade.count({
    where: { userId: demoUser.id },
  });

  if (existingTradesCount === 0) {
    const sampleTrades = [
      {
        userId: demoUser.id,
        strategyId: strategy.id,
        executorId: demoExecutor.id,
        ticket: `TICKET_1760877500228_gioxe51wh`,
        symbol: 'EURUSD',
        type: 'BUY',
        lots: 0.1,
        openTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        openPrice: 1.0850,
        closeTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 2 hours later
        closePrice: 1.0900,
        stopLoss: 1.0800,
        takeProfit: 1.0950,
        profit: 50.00,
        commission: 0.50,
        swap: 0.00,
        netProfit: 49.50,
      },
      {
        userId: demoUser.id,
        strategyId: strategy.id,
        executorId: demoExecutor.id,
        ticket: `TICKET_1760877700228_tplx9k2qd`,
        symbol: 'EURUSD',
        type: 'SELL',
        lots: 0.1,
        openTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        openPrice: 1.0950,
        closeTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000), // 4 hours later
        closePrice: 1.0800,
        stopLoss: 1.1000,
        takeProfit: 1.0750,
        profit: 75.00,
        commission: 50,
        swap: 0.00,
        netProfit: 24.50,
      },
      {
        userId: demoUser.id,
        strategyId: strategy.id,
        executorId: demoExecutor.id,
        ticket: `TICKET_1760877900228_vhmn8s4lr`,
        symbol: 'EURUSD',
        type: 'BUY',
        lots: 0.1,
        openTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        openPrice: 1.0750,
        closeTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000), // 1 hour later
        closePrice: 1.0600,
        stopLoss: 1.0650,
        takeProfit: 1.0900,
        profit: -75.00,
        commission: 0.50,
        swap: 0.00,
      netProfit: -75.50,
    },
    ];

    for (const trade of sampleTrades) {
      await prisma.trade.create({ data: trade });
    }

    console.log('✅ Created 3 sample trades');
  } else {
    console.log('✅ Sample trades already exist');
  }

  // Create sample backtest (only if not already created)
  const existingBacktestsCount = await prisma.backtest.count({
    where: { userId: demoUser.id },
  });

  if (existingBacktestsCount === 0) {
    const sampleBacktest = {
      userId: demoUser.id,
      strategyId: strategy.id,
      status: 'completed',
      dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      dateTo: new Date(),
      initialBalance: 10000,
      settings: {
        spread: 1.0,
        commission: 0.5,
        slippage: 0.5,
      },
      results: {
        equity: [
          { timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), balance: 10000 },
          { timestamp: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), balance: 10050 },
          { timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), balance: 10120 },
          { timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), balance: 10185 },
          { timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), balance: 10160 },
          { timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), balance: 10230 },
          { timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), balance: 10250.50 },
          { timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), balance: 10300 },
        ],
        totalTrades: 3,
        totalReturn: 250.50,
        returnPercentage: 2.505,
        maxDrawdown: 3.2,
        winRate: 66.7,
        winningTrades: 2,
        losingTrades: 1,
        averageWin: 62.5,
        averageLoss: 75,
        profitFactor: 1.67,
        sharpeRatio: 1.45,
      },
      completedAt: new Date(),
    };

    await prisma.backtest.create({ data: sampleBacktest });
    console.log('✅ Created sample backtest');
  } else {
    console.log('✅ Sample backtest already exists');
  }

  // Create sample strategy performance data
  const existingPerformanceCount = await prisma.strategyPerformance.count({
    where: { strategyId: strategy.id },
  });

  if (existingPerformanceCount === 0) {
    const samplePerformanceData = [
      {
        strategyId: strategy.id,
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        trades: 5,
        winRate: 60.0,
        profitFactor: 1.8,
        regime: 'TRENDING_UP',
        totalReturn: 125.50,
        maxDrawdown: 2.5,
        sharpeRatio: 1.2,
        avgWin: 45.0,
        avgLoss: 25.0,
        expectancy: 12.0,
        volatilityLevel: 'MEDIUM',
        marketCondition: 'BULLISH',
      },
      {
        strategyId: strategy.id,
        date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
        trades: 8,
        winRate: 50.0,
        profitFactor: 1.5,
        regime: 'RANGING',
        totalReturn: 80.25,
        maxDrawdown: 4.2,
        sharpeRatio: 0.9,
        avgWin: 38.0,
        avgLoss: 32.0,
        expectancy: 3.0,
        volatilityLevel: 'LOW',
        marketCondition: 'SIDEWAYS',
      },
    ];

    for (const performance of samplePerformanceData) {
      await prisma.strategyPerformance.create({ data: performance });
    }

    console.log('✅ Created sample strategy performance data');
  } else {
    console.log('✅ Sample strategy performance data already exists');
  }

  // Create sample market regime history
  const existingRegimeCount = await prisma.marketRegimeHistory.count({
    where: { symbol: 'EURUSD' },
  });

  if (existingRegimeCount === 0) {
    const sampleRegimeData = [
      {
        symbol: 'EURUSD',
        timeframe: 'H1',
        regime: 'TRENDING_UP',
        confidence: 85.5,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        trendStrength: 7.2,
        volatility: 1.4,
        volume: 1250.0,
        indicators: {
          rsi: 65.5,
          macd: 0.025,
          ema_20: 1.0850,
          ema_50: 1.0820,
        },
        previousRegime: 'RANGING',
        transitionReason: 'Break above resistance',
      },
      {
        symbol: 'EURUSD',
        timeframe: 'H1',
        regime: 'RANGING',
        confidence: 72.0,
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        trendStrength: 2.1,
        volatility: 1.2,
        volume: 980.0,
        indicators: {
          rsi: 52.3,
          macd: -0.005,
          ema_20: 1.0835,
          ema_50: 1.0840,
        },
        previousRegime: 'TRENDING_DOWN',
        transitionReason: 'Loss of momentum',
      },
    ];

    for (const regime of sampleRegimeData) {
      await prisma.marketRegimeHistory.create({ data: regime });
    }

    console.log('✅ Created sample market regime history');
  } else {
    console.log('✅ Sample market regime history already exists');
  }

  // Create sample position sizing history
  const existingPositionSizingCount = await prisma.positionSizingHistory.count({
    where: { userId: demoUser.id },
  });

  if (existingPositionSizingCount === 0) {
    const samplePositionSizingData = [
      {
        userId: demoUser.id,
        strategyId: strategy.id,
        tradeId: 'TICKET_1760877500228_gioxe51wh',
        executorId: demoExecutor.id,
        method: 'percentage_risk',
        baseLotSize: 0.1,
        adjustedLotSize: 0.12,
        riskPercentage: 2.0,
        accountBalance: 10000.0,
        riskAmount: 200.0,
        atrValue: 0.0050,
        volatility: 1.4,
        stopLossPips: 50,
        confidence: 75.0,
        sessionMultiplier: 1.2,
        regimeMultiplier: 1.0,
        correlationMultiplier: 1.0,
        finalLotSize: 0.12,
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        userId: demoUser.id,
        strategyId: strategy.id,
        tradeId: 'TICKET_1760877700228_tplx9k2qd',
        executorId: demoExecutor.id,
        method: 'atr_based',
        baseLotSize: 0.1,
        adjustedLotSize: 0.08,
        riskPercentage: 1.5,
        accountBalance: 10250.0,
        riskAmount: 153.75,
        atrValue: 0.0065,
        volatility: 1.8,
        stopLossPips: 65,
        confidence: 60.0,
        sessionMultiplier: 0.8,
        regimeMultiplier: 1.0,
        correlationMultiplier: 1.0,
        finalLotSize: 0.08,
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
    ];

    for (const positionSizing of samplePositionSizingData) {
      await prisma.positionSizingHistory.create({ data: positionSizing });
    }

    console.log('✅ Created sample position sizing history');
  } else {
    console.log('✅ Sample position sizing history already exists');
  }

  // Create sample analytics data
  const existingAnalyticsCount = await prisma.analyticsData.count({
    where: { userId: demoUser.id },
  });

  if (existingAnalyticsCount === 0) {
    const sampleAnalyticsData = {
      userId: demoUser.id,
      strategyId: strategy.id,
      timeframe: 'H1',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
      totalReturn: 250.50,
      returnPercentage: 2.505,
      winRate: 66.7,
      profitFactor: 1.67,
      sharpeRatio: 1.45,
      maxDrawdown: 3.2,
      maxDrawdownPercent: 0.32,
      totalTrades: 3,
      winningTrades: 2,
      losingTrades: 1,
      avgWin: 62.5,
      avgLoss: 75,
      expectancy: 16.67,
      var95: 125.0,
      sortinoRatio: 2.1,
      calmarRatio: 0.78,
      skewness: -0.25,
      kurtosis: 2.8,
      marketRegime: 'MIXED',
      volatilityLevel: 'NORMAL',
      dataSource: 'trades',
      rawData: {
        equityCurve: [
          { timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), balance: 10000 },
          { timestamp: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), balance: 10050 },
          { timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), balance: 10120 },
          { timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), balance: 10185 },
          { timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), balance: 10160 },
          { timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), balance: 10230 },
          { timestamp: new Date(), balance: 10250.50 },
        ],
      },
    };

    await prisma.analyticsData.create({ data: sampleAnalyticsData });
    console.log('✅ Created sample analytics data');
  } else {
    console.log('✅ Sample analytics data already exists');
  }

  // Create sample correlation matrix
  const existingCorrelationCount = await prisma.correlationMatrix.count({
    where: { timeframe: 'H1' },
  });

  if (existingCorrelationCount === 0) {
    const correlationMatrix = await prisma.correlationMatrix.create({
      data: {
        timeframe: 'H1',
        lookbackPeriod: 100,
        totalPairs: 6,
        averageCorrelation: 0.35,
        highestCorrelation: 0.85,
        lowestCorrelation: -0.12,
        volatilityAdjusted: false,
        metadata: {
          symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD'],
          calculationMethod: 'pearson',
          confidenceInterval: 0.95,
        },
      },
    });

    // Create correlation entries
    const correlationEntries = [
      {
        matrixId: correlationMatrix.id,
        symbol1: 'EURUSD',
        symbol2: 'GBPUSD',
        correlation: 0.85,
        pValue: 0.001,
        sampleSize: 100,
        standardError: 0.05,
        confidenceLow: 0.75,
        confidenceHigh: 0.95,
        trend: 'stable',
        changeRate: 0.02,
      },
      {
        matrixId: correlationMatrix.id,
        symbol1: 'EURUSD',
        symbol2: 'USDJPY',
        correlation: -0.45,
        pValue: 0.01,
        sampleSize: 100,
        standardError: 0.08,
        confidenceLow: -0.61,
        confidenceHigh: -0.29,
        trend: 'decreasing',
        changeRate: -0.05,
      },
      {
        matrixId: correlationMatrix.id,
        symbol1: 'GBPUSD',
        symbol2: 'USDJPY',
        correlation: -0.35,
        pValue: 0.02,
        sampleSize: 100,
        standardError: 0.09,
        confidenceLow: -0.53,
        confidenceHigh: -0.17,
        trend: 'stable',
        changeRate: 0.01,
      },
    ];

    for (const entry of correlationEntries) {
      await prisma.correlationEntry.create({ data: entry });
    }

    console.log('✅ Created sample correlation matrix and entries');
  } else {
    console.log('✅ Sample correlation data already exists');
  }

  console.log('🎉 Database seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
