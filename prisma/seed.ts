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

  // Create sample strategy
  const strategy = await prisma.strategy.create({
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

  // First create a demo executor for the trades
  const demoExecutor = await prisma.executor.create({
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

  // Create sample trades
  const sampleTrades = [
    {
      userId: demoUser.id,
      strategyId: strategy.id,
      executorId: demoExecutor.id,
      ticket: `TICKET_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
      ticket: `TICKET_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
      ticket: `TICKET_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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

  // Create sample backtest
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
        { timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), balance: 10300 }, // Added completed date
      ],
      totalTrades: 3,
      totalReturn: 250.50,
      returnPercentage: 2.505,
      maxDrawdown: 3.2,
      winRate: 66.7,
      totalTrades: 3,
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
