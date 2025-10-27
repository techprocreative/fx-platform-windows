import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyStrategyStatus() {
  try {
    console.log('🔍 Verifying XAUUSD M15 Scalping Pro strategy status...\n');
    
    // Find the strategy
    const strategy = await prisma.strategy.findFirst({
      where: {
        name: '⚡ XAUUSD M15 Scalping Pro - Advanced',
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
        assignments: {
          include: {
            executor: {
              select: {
                name: true,
                status: true,
              },
            },
          },
        },
      },
    });
    
    if (!strategy) {
      console.log('❌ Strategy not found!');
      return;
    }
    
    console.log('✅ Strategy found!\n');
    console.log('📊 Current Status:');
    console.log('================================');
    console.log('Strategy ID:', strategy.id);
    console.log('Name:', strategy.name);
    console.log('Status:', strategy.status);
    console.log('Owner:', strategy.user.email);
    console.log('Created:', strategy.createdAt);
    console.log('Updated:', strategy.updatedAt);
    
    // Check executor assignments
    console.log('\n🤖 Executor Assignments:');
    console.log('================================');
    if (strategy.assignments.length === 0) {
      console.log('⚠️ No executors assigned');
      console.log('❗ Strategy should remain in "draft" status');
      console.log('📝 Next steps:');
      console.log('   1. Assign an executor to this strategy');
      console.log('   2. Then change status to "active"');
    } else {
      strategy.assignments.forEach((assignment, index) => {
        console.log(`\n${index + 1}. Executor: ${assignment.executor.name}`);
        console.log('   Status:', assignment.executor.status);
        console.log('   Assignment Status:', assignment.status);
      });
      console.log('\n✅ Strategy has executor(s) assigned');
      console.log('✅ Safe to activate strategy');
    }
    
    // Status recommendations
    console.log('\n📋 Status Recommendations:');
    console.log('================================');
    if (strategy.status === 'active' && strategy.assignments.length === 0) {
      console.log('⚠️ WARNING: Strategy is ACTIVE but has NO executors!');
      console.log('❗ This may cause errors in the system');
      console.log('🔧 Recommendation: Change status to "draft" or "paused"');
    } else if (strategy.status === 'draft' && strategy.assignments.length === 0) {
      console.log('✅ Status is correct: "draft" with no executors');
      console.log('📝 Ready for executor assignment');
    } else if (strategy.status === 'draft' && strategy.assignments.length > 0) {
      console.log('📝 Strategy has executors but is still in "draft"');
      console.log('🔧 Recommendation: Change status to "active" to start trading');
    } else if (strategy.status === 'active' && strategy.assignments.length > 0) {
      console.log('✅ Status is correct: "active" with assigned executors');
      console.log('🚀 Ready for trading!');
    }
    
    // Safety check
    console.log('\n🛡️ Safety Check:');
    console.log('================================');
    const issues = [];
    
    if (strategy.status === 'active' && strategy.assignments.length === 0) {
      issues.push('❌ Active strategy without executors');
    }
    
    if (!strategy.rules || Object.keys(strategy.rules as object).length === 0) {
      issues.push('❌ No trading rules defined');
    }
    
    if (issues.length === 0) {
      console.log('✅ All safety checks passed');
    } else {
      console.log('⚠️ Issues found:');
      issues.forEach(issue => console.log('  ', issue));
    }
    
  } catch (error) {
    console.error('❌ Error verifying strategy:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyStrategyStatus();
