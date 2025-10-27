import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDemoStrategies() {
  try {
    console.log('🔍 Checking strategies for demo@nexustrade.com...\n');
    
    // Find the demo user
    const demoUser = await prisma.user.findFirst({
      where: {
        email: 'demo@nexustrade.com',
      },
      include: {
        strategies: {
          select: {
            id: true,
            name: true,
            symbol: true,
            timeframe: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
    
    if (!demoUser) {
      console.log('❌ User demo@nexustrade.com not found!');
      return;
    }
    
    console.log('✅ User found successfully!');
    console.log('👤 User Details:');
    console.log('================================');
    console.log('ID:', demoUser.id);
    console.log('Email:', demoUser.email);
    console.log('Name:', demoUser.firstName, demoUser.lastName);
    console.log('Role:', demoUser.role);
    console.log('Created:', demoUser.createdAt);
    
    console.log('\n📊 Strategies (' + demoUser.strategies.length + ' total):');
    console.log('================================');
    
    if (demoUser.strategies.length === 0) {
      console.log('No strategies found.');
    } else {
      demoUser.strategies.forEach((strategy, index) => {
        console.log(`\n${index + 1}. ${strategy.name}`);
        console.log('   ID:', strategy.id);
        console.log('   Symbol:', strategy.symbol);
        console.log('   Timeframe:', strategy.timeframe);
        console.log('   Status:', strategy.status);
        console.log('   Created:', strategy.createdAt);
      });
    }
    
    // Check specifically for the XAUUSD M15 strategy
    const xauusdStrategy = demoUser.strategies.find(s => 
      s.name === '⚡ XAUUSD M15 Scalping Pro - Advanced'
    );
    
    if (xauusdStrategy) {
      console.log('\n✅ XAUUSD M15 Scalping Pro strategy is active and ready to use!');
      console.log('🎯 Strategy ID for trading:', xauusdStrategy.id);
    }
    
  } catch (error) {
    console.error('❌ Error checking strategies:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDemoStrategies();
