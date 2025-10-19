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
