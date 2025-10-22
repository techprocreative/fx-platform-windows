// Simple test script untuk backtest via API
// Script ini akan test backtest melalui API endpoint yang sudah ada

require('dotenv').config();

async function testBacktestViaAPI() {
  console.log('🧪 TESTING BACKTEST FIX (VIA API)');
  console.log('=' .repeat(60));

  const API_BASE = 'http://localhost:3000/api';
  
  // Test cases dengan range waktu berbeda
  const testCases = [
    {
      name: 'Test 1: 30 days (short range)',
      startDate: '2024-09-01T00:00:00.000Z',
      endDate: '2024-10-01T00:00:00.000Z',
      expectedDays: 30,
    },
    {
      name: 'Test 2: 60 days (medium range)',
      startDate: '2024-08-01T00:00:00.000Z',
      endDate: '2024-10-01T00:00:00.000Z',
      expectedDays: 61,
    },
    {
      name: 'Test 3: 90 days (long range)',
      startDate: '2024-07-01T00:00:00.000Z',
      endDate: '2024-10-01T00:00:00.000Z',
      expectedDays: 92,
    },
  ];

  // Check if server is running
  console.log('\n🔍 Checking if server is running...');
  try {
    const response = await fetch(`${API_BASE}/backtest`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.status === 401) {
      console.log('✅ Server is running (authentication required)');
    } else if (response.ok) {
      console.log('✅ Server is running and accessible');
    } else {
      console.log('⚠️ Server responded with:', response.status);
    }
  } catch (error) {
    console.log('❌ Server is not running or not accessible');
    console.log('   Please start the development server with: npm run dev');
    console.log('   Then run this script again');
    return;
  }

  const results = [];

  for (const testCase of testCases) {
    console.log(`\n🔍 ${testCase.name}`);
    console.log(`   Symbol: XAUUSD`);
    console.log(`   Interval: 15min`);
    console.log(`   Date Range: ${testCase.startDate.split('T')[0]} to ${testCase.endDate.split('T')[0]}`);
    console.log(`   Expected Days: ${testCase.expectedDays}`);

    try {
      // Create a simple test strategy first
      console.log('   Creating test strategy...');
      const strategyResponse = await fetch(`${API_BASE}/ai/generate-strategy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `Test Strategy ${Date.now()}`,
          description: 'Simple test strategy for debugging',
          symbol: 'XAUUSD',
          timeframe: '15min',
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
        console.log(`   ✅ Strategy created: ${strategyId}`);
      } else {
        console.log('   ⚠️ Could not create strategy, using fallback');
        strategyId = 'fallback_strategy_' + Date.now();
      }

      // Run backtest
      console.log('   Running backtest...');
      const backtestResponse = await fetch(`${API_BASE}/backtest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          strategyId: strategyId,
          symbol: 'XAUUSD',
          interval: '15min',
          startDate: testCase.startDate,
          endDate: testCase.endDate,
          initialBalance: 10000,
          preferredDataSource: 'twelvedata'
        })
      });

      if (backtestResponse.ok) {
        const backtest = await backtestResponse.json();
        const result = backtest.result;
        
        const actualDays = Math.ceil((new Date(result.endDate) - new Date(result.startDate)) / (1000 * 60 * 60 * 24));
        
        const summary = {
          testCase: testCase.name,
          expectedDays: testCase.expectedDays,
          actualDays: actualDays,
          requestedStart: testCase.startDate,
          requestedEnd: testCase.endDate,
          actualStart: result.startDate,
          actualEnd: result.endDate,
          dataPoints: result.metadata.totalDataPoints,
          totalTrades: result.totalTrades,
          finalBalance: result.finalBalance,
          returnPercentage: result.returnPercentage,
          winRate: result.winRate,
          maxDrawdown: result.maxDrawdown,
        };

        results.push(summary);
        
        console.log(`   ✅ Backtest completed:`);
        console.log(`   Actual Days: ${summary.actualDays} (expected: ${summary.expectedDays})`);
        console.log(`   Data Points: ${summary.dataPoints}`);
        console.log(`   Total Trades: ${summary.totalTrades}`);
        console.log(`   Return: ${summary.returnPercentage.toFixed(2)}%`);
        console.log(`   Win Rate: ${summary.winRate.toFixed(1)}%`);
        console.log(`   Max Drawdown: ${summary.maxDrawdown.toFixed(1)}%`);

      } else {
        const errorText = await backtestResponse.text();
        console.error(`   ❌ Backtest failed: ${backtestResponse.status} - ${errorText}`);
        results.push({
          testCase: testCase.name,
          error: `${backtestResponse.status} - ${errorText}`,
        });
      }

    } catch (error) {
      console.error(`   ❌ Test failed: ${error.message}`);
      results.push({
        testCase: testCase.name,
        error: error.message,
      });
    }

    // Wait between tests to avoid rate limiting
    if (testCases.indexOf(testCase) < testCases.length - 1) {
      console.log('   ⏳ Waiting 3 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Compare results
  console.log('\n📊 RESULTS COMPARISON');
  console.log('=' .repeat(60));
  
  const successfulResults = results.filter(r => !r.error);
  
  if (successfulResults.length < 2) {
    console.log('❌ Not enough successful tests to compare');
    console.log('   This might be due to:');
    console.log('   - Authentication issues');
    console.log('   - Missing TWELVEDATA_API_KEY');
    console.log('   - Network connectivity issues');
    console.log('   - API rate limiting');
    return;
  }

  console.log('\n🔍 Checking if results are now DIFFERENT (expected):');
  
  let allDifferent = true;
  let allSameDataPoints = true;
  
  for (let i = 1; i < successfulResults.length; i++) {
    const prev = successfulResults[i-1];
    const curr = successfulResults[i];
    
    const sameTrades = prev.totalTrades === curr.totalTrades;
    const sameReturn = Math.abs(prev.returnPercentage - curr.returnPercentage) < 0.01;
    const sameWinRate = Math.abs(prev.winRate - curr.winRate) < 0.1;
    const sameDrawdown = Math.abs(prev.maxDrawdown - curr.maxDrawdown) < 0.01;
    const sameDataPoints = prev.dataPoints === curr.dataPoints;
    
    if (!sameDataPoints) {
      allSameDataPoints = false;
    }
    
    console.log(`\n${prev.testCase} vs ${curr.testCase}:`);
    console.log(`   Expected Days: ${prev.expectedDays} vs ${curr.expectedDays}`);
    console.log(`   Actual Days: ${prev.actualDays} vs ${curr.actualDays}`);
    console.log(`   Data Points: ${prev.dataPoints} vs ${curr.dataPoints} ${sameDataPoints ? '❌ SAME' : '✅ DIFFERENT'}`);
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
  } else if (allSameDataPoints) {
    console.log('❌ ISSUE PERSISTS: Data points are still identical.');
    console.log('❌ This suggests TwelveData API is still returning the same data regardless of date range.');
    console.log('❌ Check server logs for detailed debugging information.');
  } else {
    console.log('🤔 MIXED RESULTS: Some differences detected but not complete.');
    console.log('🤔 This might indicate partial fix or other issues.');
  }

  console.log('\n📋 DETAILED RESULTS:');
  successfulResults.forEach(result => {
    console.log(`\n${result.testCase}:`);
    console.log(`   Expected: ${result.expectedDays} days`);
    console.log(`   Actual: ${result.actualDays} days (${result.dataPoints} data points)`);
    console.log(`   Trades: ${result.totalTrades}, Return: ${result.returnPercentage.toFixed(2)}%`);
    console.log(`   Win Rate: ${result.winRate.toFixed(1)}%, Max DD: ${result.maxDrawdown.toFixed(1)}%`);
  });

  if (successfulResults.length === 0) {
    console.log('\n❌ ALL TESTS FAILED');
    console.log('Please check:');
    console.log('1. Development server is running (npm run dev)');
    console.log('2. TWELVEDATA_API_KEY environment variable is set');
    console.log('3. Network connectivity to TwelveData API');
  }
}

// Check environment variables
console.log('🔍 Checking environment variables...');
console.log(`TWELVEDATA_API_KEY: ${process.env.TWELVEDATA_API_KEY ? '✅ Set' : '❌ Not set'}`);
console.log(`NEXTAUTH_SECRET: ${process.env.NEXTAUTH_SECRET ? '✅ Set' : '❌ Not set'}`);

// Run the test
console.log('\n🚀 Starting API backtest fix validation...');
console.log('Make sure the development server is running with: npm run dev');
testBacktestViaAPI().catch(console.error);