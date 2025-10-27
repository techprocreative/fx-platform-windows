import { prisma } from '../src/lib/prisma';

async function assignStrategyToExecutor() {
  try {
    // Get the user ID (you can change this to your actual user ID)
    const user = await prisma.user.findFirst({
      where: { email: 'demo@nexustrade.com' } // Change this to your email
    });

    if (!user) {
      console.error('❌ User not found');
      return;
    }

    // Get the executor
    const executor = await prisma.executor.findFirst({
      where: { 
        userId: user.id,
        // You can add more specific conditions if you have multiple executors
      }
    });

    if (!executor) {
      console.error('❌ No executor found for user');
      console.log('Create an executor first in the platform');
      return;
    }

    console.log(`✅ Found executor: ${executor.name} (${executor.id})`);

    // Get active strategies for the user
    const strategies = await prisma.strategy.findMany({
      where: {
        userId: user.id,
        status: 'active',
      }
    });

    if (strategies.length === 0) {
      console.error('❌ No active strategies found');
      return;
    }

    console.log(`✅ Found ${strategies.length} active strategies`);
    
    // Assign each strategy to the executor
    for (const strategy of strategies) {
      // Check if already assigned
      const existing = await prisma.strategyAssignment.findUnique({
        where: {
          strategyId_executorId: {
            strategyId: strategy.id,
            executorId: executor.id,
          }
        }
      });

      if (existing) {
        // Update to ensure it's active
        if (existing.status !== 'active') {
          await prisma.strategyAssignment.update({
            where: { id: existing.id },
            data: { status: 'active' }
          });
          console.log(`✅ Reactivated strategy assignment: ${strategy.name}`);
        } else {
          console.log(`⏭️  Strategy already assigned: ${strategy.name}`);
        }
      } else {
        // Create new assignment
        const assignment = await prisma.strategyAssignment.create({
          data: {
            strategyId: strategy.id,
            executorId: executor.id,
            status: 'active',
            settings: {
              positionSize: 0.01,
              maxRiskPerTrade: 1,
              maxOpenPositions: 1,
            }
          }
        });
        console.log(`✅ Assigned strategy to executor: ${strategy.name}`);
      }
    }

    // Show summary
    const assignments = await prisma.strategyAssignment.findMany({
      where: {
        executorId: executor.id,
        status: 'active',
      },
      include: {
        strategy: true,
      }
    });

    console.log('\n📊 Strategy Assignment Summary:');
    console.log(`Executor: ${executor.name} (${executor.id})`);
    console.log(`API Key: ${executor.apiKey}`);
    console.log(`Status: ${executor.status}`);
    console.log(`\nActive Strategies (${assignments.length}):`);
    
    assignments.forEach((assignment, idx) => {
      console.log(`${idx + 1}. ${assignment.strategy.name} - ${assignment.strategy.symbol} ${assignment.strategy.timeframe}`);
    });

    console.log('\n✅ Strategy assignment complete!');
    console.log('The Windows Executor will automatically sync these strategies on startup.');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the assignment
assignStrategyToExecutor()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
