/**
 * Test Strategy API query logic
 */

import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function testStrategyQuery() {
  try {
    console.log('🔍 Testing strategy query for demo@nexustrade.com...\n');
    
    // Get demo user
    const demoUser = await prisma.user.findUnique({
      where: { email: 'demo@nexustrade.com' },
    });
    
    if (!demoUser) {
      console.log('❌ User not found');
      return;
    }
    
    console.log(`✅ User: ${demoUser.email} (ID: ${demoUser.id})\n`);
    
    // Simulate the exact query from the API
    const where: Prisma.StrategyWhereInput = {
      OR: [
        { userId: demoUser.id }, // User's own strategies
        { isSystemDefault: true, isPublic: true }, // System default strategies
      ],
      deletedAt: null,
    };
    
    const strategies = await prisma.strategy.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        symbol: true,
        timeframe: true,
        status: true,
        type: true,
        isSystemDefault: true,
        isPublic: true,
        userId: true,
        createdAt: true,
      },
    });
    
    console.log(`📊 Query should return ${strategies.length} strategies:\n`);
    
    const userStrategies = strategies.filter(s => s.userId === demoUser.id);
    const systemStrategies = strategies.filter(s => s.isSystemDefault);
    
    console.log(`✅ User's own strategies: ${userStrategies.length}`);
    userStrategies.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.name} (${s.symbol})`);
    });
    
    console.log(`\n✅ System default strategies: ${systemStrategies.length}`);
    systemStrategies.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.name} (${s.symbol})`);
    });
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\n📋 Total strategies that should appear in UI: ${strategies.length}`);
    
    if (systemStrategies.length === 0) {
      console.log('\n❌ PROBLEM: No system default strategies found!');
      console.log('   Check if isSystemDefault=true and isPublic=true');
    } else {
      console.log('\n✅ System default strategies ARE being returned by query');
      console.log('   If they don\'t appear in UI, check:');
      console.log('   1. Frontend is calling /api/strategy correctly');
      console.log('   2. Session is valid');
      console.log('   3. No frontend filtering');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testStrategyQuery();
