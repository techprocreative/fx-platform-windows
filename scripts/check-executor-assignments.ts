import { prisma } from '../src/lib/prisma';

async function checkExecutorAssignments() {
  try {
    // Get all executors
    const executors = await prisma.executor.findMany({
      include: {
        user: true,
        assignments: {
          where: {
            status: 'active'
          },
          include: {
            strategy: true
          }
        }
      }
    });

    if (executors.length === 0) {
      console.log('❌ No executors found in the database');
      console.log('Create an executor first through the web platform');
      return;
    }

    console.log(`\n📊 EXECUTOR STATUS REPORT`);
    console.log('=' .repeat(80));

    for (const executor of executors) {
      console.log(`\n🖥️  Executor: ${executor.name}`);
      console.log(`   ID: ${executor.id}`);
      console.log(`   User: ${executor.user.email}`);
      console.log(`   Platform: ${executor.platform}`);
      console.log(`   Status: ${executor.status}`);
      console.log(`   API Key: ${executor.apiKey}`);
      console.log(`   Shared Secret: ${executor.sharedSecret || 'Not set'}`);
      console.log(`   Last Heartbeat: ${executor.lastHeartbeat || 'Never'}`);
      
      if (executor.assignments.length === 0) {
        console.log(`   ⚠️  No active strategies assigned`);
      } else {
        console.log(`\n   📈 Active Strategy Assignments (${executor.assignments.length}):`);
        
        executor.assignments.forEach((assignment, idx) => {
          const strategy = assignment.strategy;
          console.log(`\n   ${idx + 1}. ${strategy.name}`);
          console.log(`      Strategy ID: ${strategy.id}`);
          console.log(`      Symbol: ${strategy.symbol}`);
          console.log(`      Timeframe: ${strategy.timeframe}`);
          console.log(`      Status: ${strategy.status}`);
          console.log(`      Assignment Status: ${assignment.status}`);
          console.log(`      Assigned At: ${assignment.createdAt}`);
          console.log(`      Last Executed: ${assignment.lastExecutedAt || 'Never'}`);
          console.log(`      Trades Count: ${assignment.tradesCount}`);
          console.log(`      P/L: ${assignment.profitLoss}`);
          
          if (assignment.settings) {
            console.log(`      Settings: ${JSON.stringify(assignment.settings)}`);
          }
        });
      }
    }

    // Check for strategies without assignments
    console.log('\n' + '=' .repeat(80));
    console.log('\n📋 UNASSIGNED ACTIVE STRATEGIES:');
    
    const unassignedStrategies = await prisma.strategy.findMany({
      where: {
        status: 'active',
        assignments: {
          none: {
            status: 'active'
          }
        }
      }
    });

    if (unassignedStrategies.length === 0) {
      console.log('✅ All active strategies are assigned to executors');
    } else {
      console.log(`⚠️  Found ${unassignedStrategies.length} unassigned active strategies:`);
      unassignedStrategies.forEach((strategy, idx) => {
        console.log(`${idx + 1}. ${strategy.name} - ${strategy.symbol} ${strategy.timeframe}`);
      });
    }

    // API endpoint test
    console.log('\n' + '=' .repeat(80));
    console.log('\n🔌 API ENDPOINT TEST:');
    
    if (executors[0]) {
      const testExecutorId = executors[0].id;
      console.log(`Testing endpoint: /api/executor/${testExecutorId}/active-strategies`);
      
      // Direct database query to simulate what the API would return
      const apiResult = await prisma.strategyAssignment.findMany({
        where: {
          executorId: testExecutorId,
          status: 'active',
        },
        include: {
          strategy: true
        }
      });
      
      console.log(`Result: ${apiResult.length} active strategies would be returned`);
      
      if (apiResult.length > 0) {
        console.log('\nAPI Response Preview:');
        apiResult.forEach((assignment, idx) => {
          console.log(`${idx + 1}. ${assignment.strategy.name} (${assignment.strategy.id})`);
        });
      }
    }

    console.log('\n' + '=' .repeat(80));
    console.log('\n✅ Executor assignment check complete!\n');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the check
checkExecutorAssignments()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
