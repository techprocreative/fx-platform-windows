// Test script untuk validasi fix backtest
// Script ini akan men-test backtest dengan range waktu berbeda setelah fix

async function testBacktestFix() {
  console.log('🧪 TESTING BACKTEST FIX');
  console.log('=' .repeat(60));

  // Test cases yang sama seperti sebelumnya untuk validasi
  const testCases = [
    {
      name: 'Test 1: 294 days (original problem case)',
      strategyId: 'test_strategy_1',
      symbol: 'XAUUSD',
      interval: '15min',
      startDate: '2024-01-01',
      endDate: '2024-10-21', // ~294 days
      initialBalance: 10000,
    },
    {
      name: 'Test 2: 113 days (original problem case)',
      strategyId: 'test_strategy_2', 
      symbol: 'XAUUSD',
      interval: '15min',
      startDate: '2024-07-01',
      endDate: '2024-10-21', // ~113 days
      initialBalance: 10000,
    },
    {
      name: 'Test 3: 30 days (new test case)',
      strategyId: 'test_strategy_3',
      symbol: 'XAUUSD', 
      interval: '15min',
      startDate: '2024-09-01',
      endDate: '2024-10-01', // ~30 days
      initialBalance: 10000,
    },
  ];

  const results = [];

  // Step 1: Clear cache untuk XAUUSD
  console.log('\n🗑️ Step 1: Clearing cache for XAUUSD...');
  try {
    const clearResponse = await fetch('http://localhost:3000/api/debug/clear-cache', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        symbol: 'XAUUSD',
        interval: '15min'
      })
    });
    
    if (clearResponse.ok) {
      const clearResult = await clearResponse.json();
      console.log('✅ Cache cleared:', clearResult.message);
    } else {
      console.log('⚠️ Could not clear cache (endpoint might not be available)');
    }
  } catch (error) {
    console.log('⚠️ Could not clear cache (server might not be running)');
  }

  // Step 2: Run backtest untuk setiap test case
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n🔍 ${testCase.name}`);
    console.log(`   Symbol: ${testCase.symbol}`);
    console.log(`   Interval: ${testCase.interval}`);
    console.log(`   Date Range: ${testCase.startDate} to ${testCase.endDate}`);
    console.log(`   Days: ${Math.ceil((new Date(testCase.endDate) - new Date(testCase.startDate)) / (1000 * 60 * 60 * 24))}`);

    try {
      // Create simple strategy untuk test
      const strategyResponse = await fetch('http://localhost:3000/api/ai/generate-strategy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `Test Strategy ${i + 1}`,
          description: 'Simple test strategy for debugging',
          symbol: testCase.symbol,
          timeframe: testCase.interval,
          riskManagement: {
            lotSize: 0.01,
            maxPositions: 1,
            stopLoss: 25,
            takeProfit: 50,
          },
          entryConditions: [
            {
              indicator: 'RSI',
              condition: 'less_than',
              value: 30,
            }
          ],
          exitConditions: [
            {
              indicator: 'RSI', 
              condition: 'greater_than',
              value: 70,
            }
          ]
        })
      });

      let strategyId;
      if (strategyResponse.ok) {
        const strategy = await strategyResponse.json();
        strategyId = strategy.strategy?.id;
        console.log(`✅ Strategy created: ${strategyId}`);
      } else {
        console.log('⚠️ Could not create strategy, using test ID');
        strategyId = testCase.strategyId;
      }

      // Run backtest
      const backtestResponse = await fetch('http://localhost:3000/api/backtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          strategyId: strategyId,
          symbol: testCase.symbol,
          interval: testCase.interval,
          startDate: new Date(testCase.startDate).toISOString(),
          endDate: new Date(testCase.endDate).toISOString(),
          initialBalance: testCase.initialBalance,
          preferredDataSource: 'twelvedata'
        })
      });

      if (backtestResponse.ok) {
        const backtest = await backtestResponse.json();
        const result = backtest.result;
        
        const summary = {
          testCase: testCase.name,
          requestedDays: Math.ceil((new Date(testCase.endDate) - new Date(testCase.startDate)) / (1000 * 60 * 60 * 24)),
          actualStart: result.startDate,
          actualEnd: result.endDate,
          actualDays: Math.ceil((new Date(result.endDate) - new Date(result.startDate)) / (1000 * 60 * 60 * 24)),
          dataPoints: result.metadata.totalDataPoints,
          totalTrades: result.totalTrades,
          finalBalance: result.finalBalance,
          returnPercentage: result.returnPercentage,
          winRate: result.winRate,
          maxDrawdown: result.maxDrawdown,
        };

        results.push(summary);
        
        console.log(`✅ Backtest completed:`);
        console.log(`   Actual Days: ${summary.actualDays}`);
        console.log(`   Data Points: ${summary.dataPoints}`);
        console.log(`   Total Trades: ${summary.totalTrades}`);
        console.log(`   Return: ${summary.returnPercentage.toFixed(2)}%`);
        console.log(`   Win Rate: ${summary.winRate.toFixed(1)}%`);
        console.log(`   Max Drawdown: ${summary.maxDrawdown.toFixed(1)}%`);

      } else {
        const error = await backtestResponse.text();
        console.error(`❌ Backtest failed: ${error}`);
        results.push({
          testCase: testCase.name,
          error: error,
        });
      }

    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
      results.push({
        testCase: testCase.name,
        error: error.message,
      });
    }

    // Wait between tests to avoid rate limiting
    if (i < testCases.length - 1) {
      console.log('⏳ Waiting 2 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Step 3: Compare results
  console.log('\n📊 RESULTS COMPARISON');
  console.log('=' .repeat(60));
  
  const successfulResults = results.filter(r => !r.error);
  
  if (successfulResults.length < 2) {
    console.log('❌ Not enough successful tests to compare');
    return;
  }

  console.log('\n🔍 Checking if results are now DIFFERENT (expected):');
  
  let allDifferent = true;
  for (let i = 1; i < successfulResults.length; i++) {
    const prev = successfulResults[i-1];
    const curr = successfulResults[i];
    
    const sameTrades = prev.totalTrades === curr.totalTrades;
    const sameReturn = Math.abs(prev.returnPercentage - curr.returnPercentage) < 0.01;
    const sameWinRate = Math.abs(prev.winRate - curr.winRate) < 0.1;
    const sameDrawdown = Math.abs(prev.maxDrawdown - curr.maxDrawdown) < 0.01;
    
    console.log(`\n${prev.testCase} vs ${curr.testCase}:`);
    console.log(`   Requested Days: ${prev.requestedDays} vs ${curr.requestedDays}`);
    console.log(`   Actual Days: ${prev.actualDays} vs ${curr.actualDays}`);
    console.log(`   Data Points: ${prev.dataPoints} vs ${curr.dataPoints}`);
    console.log(`   Total Trades: ${prev.totalTrades} vs ${curr.totalTrades} ${sameTrades ? '❌ SAME' : '✅ DIFFERENT'}`);
    console.log(`   Return: ${prev.returnPercentage.toFixed(2)}% vs ${curr.returnPercentage.toFixed(2)}% ${sameReturn ? '❌ SAME' : '✅ DIFFERENT'}`);
    console.log(`   Win Rate: ${prev.winRate.toFixed(1)}% vs ${curr.winRate.toFixed(1)}% ${sameWinRate ? '❌ SAME' : '✅ DIFFERENT'}`);
    console.log(`   Max DD: ${prev.maxDrawdown.toFixed(1)}% vs ${curr.maxDrawdown.toFixed(1)}% ${sameDrawdown ? '❌ SAME' : '✅ DIFFERENT'}`);
    
    if (sameTrades && sameReturn && sameWinRate && sameDrawdown) {
      console.log(`   🚨 STILL IDENTICAL - Fix might not be working`);
      allDifferent = false;
    } else {
      console.log(`   ✅ RESULTS ARE DIFFERENT - Fix is working!`);
    }
  }

  // Final diagnosis
  console.log('\n🎯 FINAL DIAGNOSIS:');
  if (allDifferent && successfulResults.length > 1) {
    console.log('✅ SUCCESS: Fix is working! Results are now different for different date ranges.');
    console.log('✅ The TwelveData API and cache issues have been resolved.');
  } else {
    console.log('❌ ISSUE PERSISTS: Results are still identical.');
    console.log('❌ Further investigation needed for:');
    if (successfulResults.some(r => r.actualDays === r.requestedDays)) {
      console.log('   - TwelveData API still not respecting date ranges');
    }
    if (successfulResults.some(r => r.dataPoints === successfulResults[0].dataPoints)) {
      console.log('   - Cache still returning same data');
    }
    console.log('   - Check server logs for detailed debugging information');
  }

  console.log('\n📋 DETAILED RESULTS:');
  successfulResults.forEach(result => {
    console.log(`\n${result.testCase}:`);
    console.log(`   Requested: ${result.requestedDays} days`);
    console.log(`   Actual: ${result.actualDays} days (${result.dataPoints} data points)`);
    console.log(`   Trades: ${result.totalTrades}, Return: ${result.returnPercentage.toFixed(2)}%`);
    console.log(`   Win Rate: ${result.winRate.toFixed(1)}%, Max DD: ${result.maxDrawdown.toFixed(1)}%`);
  });
}

// Run the test
console.log('🚀 Starting backtest fix validation...');
console.log('Make sure the development server is running on http://localhost:3000');
testBacktestFix().catch(console.error);