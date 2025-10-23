const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function validateSchemaChanges() {
  console.log('🔍 Validating schema changes...\n');

  try {
    // Test Strategy model with new fields
    console.log('1. Testing Strategy model with new fields...');
    const strategyCount = await prisma.strategy.count();
    console.log(`   ✅ Strategy model accessible (count: ${strategyCount})`);

    // Test new tables exist
    console.log('\n2. Testing new table accessibility...');
    
    const tables = [
      'strategyPerformance',
      'marketRegimeHistory', 
      'regimePerformanceStats',
      'positionSizingHistory',
      'positionSizingConfigHistory',
      'correlationMatrix',
      'correlationEntry',
      'historicalCorrelation',
      'correlationGroup',
      'correlationGroupMember',
      'correlationThreshold',
      'correlationAnalysisResult',
      'correlationConflict',
      'correlationCache',
      'analyticsData',
      'analyticsCache',
      'multiTimeframeAnalysis',
      'smartExitHistory',
      'partialExitHistory'
    ];

    for (const table of tables) {
      try {
        const count = await prisma[table].count();
        console.log(`   ✅ ${table} table accessible (count: ${count})`);
      } catch (error) {
        console.log(`   ❌ ${table} table error: ${error.message}`);
      }
    }

    // Test relationships
    console.log('\n3. Testing key relationships...');
    
    // Test Strategy to StrategyPerformance relationship
    try {
      const strategiesWithPerformance = await prisma.strategy.findMany({
        include: {
          performanceHistory: true,
          scores: true,
          latestScore: true
        },
        take: 1
      });
      console.log('   ✅ Strategy relationships working');
    } catch (error) {
      console.log(`   ❌ Strategy relationships error: ${error.message}`);
    }

    // Test correlation relationships
    try {
      const correlationMatrixWithEntries = await prisma.correlationMatrix.findMany({
        include: {
          correlationEntries: {
            include: {
              historicalData: true
            }
          }
        },
        take: 1
      });
      console.log('   ✅ Correlation relationships working');
    } catch (error) {
      console.log(`   ❌ Correlation relationships error: ${error.message}`);
    }

    console.log('\n🎉 Schema validation completed!');
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

validateSchemaChanges();