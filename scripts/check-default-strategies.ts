/**
 * Check default strategies in database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDefaultStrategies() {
  try {
    console.log('🔍 Checking default strategies in database...\n');
    
    // Check all strategies with isSystemDefault = true
    const systemStrategies = await prisma.strategy.findMany({
      where: {
        isSystemDefault: true,
      },
      select: {
        id: true,
        name: true,
        symbol: true,
        timeframe: true,
        status: true,
        isSystemDefault: true,
        isPublic: true,
        systemDefaultType: true,
        userId: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });
    
    console.log(`Found ${systemStrategies.length} system default strategies:\n`);
    
    systemStrategies.forEach((s, i) => {
      console.log(`${i + 1}. ${s.name}`);
      console.log(`   ID: ${s.id}`);
      console.log(`   Symbol: ${s.symbol}`);
      console.log(`   Timeframe: ${s.timeframe}`);
      console.log(`   Status: ${s.status}`);
      console.log(`   Type: ${s.systemDefaultType}`);
      console.log(`   isSystemDefault: ${s.isSystemDefault}`);
      console.log(`   isPublic: ${s.isPublic}`);
      console.log(`   Owner: ${s.user.email}`);
      console.log('');
    });
    
    // Check demo@nexustrade.com user
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    const demoUser = await prisma.user.findUnique({
      where: {
        email: 'demo@nexustrade.com',
      },
    });
    
    if (demoUser) {
      console.log(`✅ Found user: ${demoUser.email} (ID: ${demoUser.id})\n`);
      
      const userStrategies = await prisma.strategy.findMany({
        where: {
          userId: demoUser.id,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          symbol: true,
          status: true,
          isSystemDefault: true,
        },
      });
      
      console.log(`User has ${userStrategies.length} strategies:\n`);
      userStrategies.forEach((s, i) => {
        console.log(`${i + 1}. ${s.name} (${s.symbol}) - ${s.status}`);
      });
    } else {
      console.log('❌ User demo@nexustrade.com not found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDefaultStrategies();
