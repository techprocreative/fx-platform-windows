import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixStrategyStatus() {
  try {
    console.log('🔧 Fixing strategy statuses for unassigned strategies...\n');
    
    // Find all XAUUSD M15 Scalping strategies
    const strategies = await prisma.strategy.findMany({
      where: {
        name: '⚡ XAUUSD M15 Scalping Pro - Advanced',
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
        assignments: true,
      },
    });
    
    console.log(`Found ${strategies.length} strategies to check\n`);
    
    for (const strategy of strategies) {
      console.log(`📊 Checking: ${strategy.name}`);
      console.log(`   ID: ${strategy.id}`);
      console.log(`   Owner: ${strategy.user.email}`);
      console.log(`   Current Status: ${strategy.status}`);
      console.log(`   Executors: ${strategy.assignments.length}`);
      
      // If strategy is active but has no executors, change to draft
      if (strategy.status === 'active' && strategy.assignments.length === 0) {
        console.log(`   ⚠️ ISSUE: Active without executors`);
        console.log(`   🔧 Fixing: Changing status to "draft"...`);
        
        await prisma.strategy.update({
          where: { id: strategy.id },
          data: { status: 'draft' },
        });
        
        console.log(`   ✅ Fixed: Status changed to "draft"`);
      } else if (strategy.status === 'draft' && strategy.assignments.length === 0) {
        console.log(`   ✅ OK: Draft status with no executors`);
      } else if (strategy.status === 'active' && strategy.assignments.length > 0) {
        console.log(`   ✅ OK: Active with ${strategy.assignments.length} executor(s)`);
      }
      console.log('');
    }
    
    // Also check for any other active strategies without executors
    console.log('🔍 Checking all active strategies without executors...\n');
    
    const problematicStrategies = await prisma.strategy.findMany({
      where: {
        status: 'active',
        assignments: {
          none: {},
        },
      },
      select: {
        id: true,
        name: true,
        symbol: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });
    
    if (problematicStrategies.length > 0) {
      console.log(`⚠️ Found ${problematicStrategies.length} active strategies without executors:\n`);
      
      for (const strategy of problematicStrategies) {
        console.log(`   - ${strategy.name} (${strategy.symbol}) - ${strategy.user.email}`);
        
        // Fix them
        await prisma.strategy.update({
          where: { id: strategy.id },
          data: { status: 'draft' },
        });
        
        console.log(`     ✅ Changed to "draft"`);
      }
    } else {
      console.log('✅ No problematic strategies found');
    }
    
    console.log('\n✅ All strategy statuses fixed!');
    console.log('📝 Strategies without executors are now in "draft" status');
    
  } catch (error) {
    console.error('❌ Error fixing strategy statuses:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixStrategyStatus();
