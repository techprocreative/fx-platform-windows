// Debug script untuk testing backtest dengan range waktu berbeda
const { BacktestEngine } = require('./src/lib/backtest/engine');

async function testBacktestWithDifferentRanges() {
  console.log('🧪 TESTING BACKTEST WITH DIFFERENT DATE RANGES');
  console.log('=' .repeat(60));

  // Test strategy sederhana
  const testStrategy = {
    id: 'debug_strategy',
    name: 'Debug Strategy',
    symbol: 'EURUSD',
    rules: [
      {
        name: 'Test Entry',
        conditions: [
          {
            indicator: 'price',
            operator: 'gt',
            value: 0,
            timeframes: ['1h'],
          },
        ],
        action: {
          type: 'buy',
          parameters: { size: 0.01 },
        },
      },
      {
        name: 'Test Exit',
        conditions: [
          {
            indicator: 'price',
            operator: 'gt',
            value: 999999,
            timeframes: ['1h'],
          },
        ],
        action: {
          type: 'close',
          parameters: {},
        },
      },
    ],
    parameters: {
      stopLoss: 0.002,
      takeProfit: 0.004,
      maxPositions: 1,
      maxDailyLoss: 100,
    },
  };

  // Test dengan 3 range waktu berbeda
  const testCases = [
    {
      name: 'Range 1: 1 hari',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-02'),
    },
    {
      name: 'Range 2: 7 hari',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-08'),
    },
    {
      name: 'Range 3: 30 hari',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
    },
  ];

  const results = [];

  for (const testCase of testCases) {
    console.log(`\n🔍 ${testCase.name}`);
    console.log(`   Start: ${testCase.startDate.toISOString()}`);
    console.log(`   End: ${testCase.endDate.toISOString()}`);
    console.log(`   Days: ${(testCase.endDate.getTime() - testCase.startDate.getTime()) / (1000 * 60 * 60 * 24)}`);

    try {
      const engine = new BacktestEngine(10000);
      
      await engine.loadData(
        'EURUSD',
        '1h',
        testCase.startDate,
        testCase.endDate,
        'twelvedata'
      );

      const result = await engine.runBacktest(testStrategy);
      
      const summary = {
        testCase: testCase.name,
        requestedStart: testCase.startDate.toISOString(),
        requestedEnd: testCase.endDate.toISOString(),
        actualStart: result.startDate.toISOString(),
        actualEnd: result.endDate.toISOString(),
        dataPoints: result.metadata.totalDataPoints,
        totalTrades: result.totalTrades,
        finalBalance: result.finalBalance,
        returnPercentage: result.returnPercentage,
      };

      results.push(summary);
      
      console.log(`✅ Result:`);
      console.log(`   Actual Start: ${summary.actualStart}`);
      console.log(`   Actual End: ${summary.actualEnd}`);
      console.log(`   Data Points: ${summary.dataPoints}`);
      console.log(`   Total Trades: ${summary.totalTrades}`);
      console.log(`   Final Balance: $${summary.finalBalance.toFixed(2)}`);
      console.log(`   Return: ${summary.returnPercentage.toFixed(2)}%`);

    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      results.push({
        testCase: testCase.name,
        error: error.message,
      });
    }
  }

  // Compare results
  console.log('\n📊 COMPARISON RESULTS');
  console.log('=' .repeat(60));
  
  const successfulResults = results.filter(r => !r.error);
  
  if (successfulResults.length > 1) {
    console.log('\n🔍 Checking for identical results:');
    
    for (let i = 1; i < successfulResults.length; i++) {
      const prev = successfulResults[i-1];
      const curr = successfulResults[i];
      
      const sameDataPoints = prev.dataPoints === curr.dataPoints;
      const sameTrades = prev.totalTrades === curr.totalTrades;
      const sameReturn = Math.abs(prev.returnPercentage - curr.returnPercentage) < 0.01;
      const sameBalance = Math.abs(prev.finalBalance - curr.finalBalance) < 0.01;
      
      console.log(`\n${prev.testCase} vs ${curr.testCase}:`);
      console.log(`   Same Data Points: ${sameDataPoints ? '❌ YES' : '✅ NO'}`);
      console.log(`   Same Trades: ${sameTrades ? '❌ YES' : '✅ NO'}`);
      console.log(`   Same Return: ${sameReturn ? '❌ YES' : '✅ NO'}`);
      console.log(`   Same Balance: ${sameBalance ? '❌ YES' : '✅ NO'}`);
      
      if (sameDataPoints && sameTrades && sameReturn && sameBalance) {
        console.log(`   🚨 PROBLEM: Results are IDENTICAL!`);
      } else {
        console.log(`   ✅ Results are different as expected`);
      }
    }
  }

  console.log('\n📋 DETAILED RESULTS:');
  results.forEach(result => {
    console.log(`\n${result.testCase}:`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    } else {
      console.log(`   Requested: ${result.requestedStart} to ${result.requestedEnd}`);
      console.log(`   Actual: ${result.actualStart} to ${result.actualEnd}`);
      console.log(`   Data Points: ${result.dataPoints}`);
      console.log(`   Trades: ${result.totalTrades}`);
      console.log(`   Return: ${result.returnPercentage.toFixed(2)}%`);
    }
  });

  console.log('\n🎯 DIAGNOSIS:');
  console.log('1. If all results are IDENTICAL -> Cache pollution or API returning same data');
  console.log('2. If data points are SAME -> API limitation or date range ignored');
  console.log('3. If results are DIFFERENT -> System working correctly');
}

// Run the test
testBacktestWithDifferentRanges().catch(console.error);