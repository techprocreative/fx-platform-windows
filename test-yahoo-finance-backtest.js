// Test script untuk memvalidasi backtest dengan Yahoo Finance API
require('dotenv').config();

async function testYahooFinanceBacktest() {
  console.log('🧪 TESTING YAHOO FINANCE BACKTEST');
  console.log('=' .repeat(60));

  const API_BASE = 'http://localhost:3000/api/debug/test-backtest';
  
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

  // Check environment variables
  console.log('\n🔍 Checking Yahoo Finance API configuration...');
  console.log(`YAHOO_FINANCE_API_KEY: ${process.env.YAHOO_FINANCE_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`YAHOO_FINANCE_RAPIDAPI_HOST: ${process.env.YAHOO_FINANCE_RAPIDAPI_HOST ? '✅ Set' : '❌ Not set'}`);

  // Check if server is running
  console.log('\n🔍 Checking if server is running...');
  try {
    const response = await fetch(`${API_BASE}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const info = await response.json();
      console.log('✅ Debug endpoint is accessible');
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
    console.log(`   Data Source: Yahoo Finance`);

    try {
      console.log('   Running backtest...');
      const backtestResponse = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol: 'XAUUSD',
          interval: '15min',
          startDate: testCase.startDate,
          endDate: testCase.endDate,
          initialBalance: 10000,
          preferredDataSource: 'yahoo'
        })
      });

      if (backtestResponse.ok) {
        const backtest = await backtestResponse.json();
        const result = backtest.result;
        const debug = backtest.debug;
        
        const summary = {
          testCase: testCase.name,
          expectedDays: testCase.expectedDays,
          actualDays: debug.actualDays,
          requestedStart: testCase.startDate,
          requestedEnd: testCase.endDate,
          actualStart: result.startDate,
          actualEnd: result.endDate,
          dataPoints: debug.dataPoints,
          totalTrades: debug.trades,
          finalBalance: result.finalBalance,
          returnPercentage: debug.return,
          winRate: debug.winRate,
          maxDrawdown: debug.maxDrawdown,
        };

        results.push(summary);
        
        console.log(`   ✅ Backtest completed:`);
        console.log(`   Actual Days: ${summary.actualDays} (expected: ${summary.expectedDays})`);
        console.log(`   Data Points: ${summary.dataPoints}`);
        console.log(`   Total Trades: ${summary.totalTrades}`);
        console.log(`   Return: ${summary.returnPercentage.toFixed(2)}%`);
        console.log(`   Win Rate: ${summary.winRate.toFixed(1)}%`);
        console.log(`   Max Drawdown: ${summary.maxDrawdown.toFixed(1)}%`);

        // Check if date range matches
        const dayDiff = Math.abs(summary.actualDays - summary.expectedDays);
        if (dayDiff > 7) {
          console.warn(`   ⚠️ WARNING: Actual days (${summary.actualDays}) very different from expected (${summary.expectedDays})`);
        }

        // Check if we have reasonable data points
        const expectedDataPoints = summary.expectedDays * 24 * 4; // 15min = 4 per hour
        if (summary.dataPoints < expectedDataPoints * 0.5) {
          console.warn(`   ⚠️ WARNING: Data points (${summary.dataPoints}) lower than expected (~${expectedDataPoints})`);
        }

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
  console.log('\n📊 YAHOO FINANCE RESULTS COMPARISON');
  console.log('=' .repeat(60));
  
  const successfulResults = results.filter(r => !r.error);
  
  if (successfulResults.length < 2) {
    console.log('❌ Not enough successful tests to compare');
    console.log('   This might be due to:');
    console.log('   - Missing YAHOO_FINANCE_API_KEY');
    console.log('   - Network connectivity issues');
    console.log('   - API rate limiting');
    console.log('   - Invalid date ranges (weekends/holidays)');
    console.log('   - Yahoo Finance API limitations');
    return;
  }

  console.log('\n🔍 Checking if Yahoo Finance results are DIFFERENT (expected):');
  
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
      console.log(`   🚨 STILL IDENTICAL - Yahoo Finance might have similar issues`);
      allDifferent = false;
    } else {
      console.log(`   ✅ RESULTS ARE DIFFERENT - Yahoo Finance is working!`);
    }
  }

  // Final diagnosis
  console.log('\n🎯 YAHOO FINANCE FINAL DIAGNOSIS:');
  if (allDifferent && successfulResults.length > 1) {
    console.log('✅ SUCCESS: Yahoo Finance is working! Results are different for different date ranges.');
    console.log('✅ Yahoo Finance provides a good alternative to TwelveData.');
  } else if (allSameDataPoints) {
    console.log('❌ ISSUE PERSISTS: Yahoo Finance data points are still identical.');
    console.log('❌ This suggests Yahoo Finance API is also returning the same data regardless of date range.');
    console.log('❌ The issue might be in the backtest engine itself, not the data source.');
  } else {
    console.log('🤔 MIXED RESULTS: Some differences detected but not complete.');
    console.log('🤔 Yahoo Finance might have different behavior than TwelveData.');
  }

  console.log('\n📋 YAHOO FINANCE DETAILED RESULTS:');
  successfulResults.forEach(result => {
    console.log(`\n${result.testCase}:`);
    console.log(`   Expected: ${result.expectedDays} days`);
    console.log(`   Actual: ${result.actualDays} days (${result.dataPoints} data points)`);
    console.log(`   Trades: ${result.totalTrades}, Return: ${result.returnPercentage.toFixed(2)}%`);
    console.log(`   Win Rate: ${result.winRate.toFixed(1)}%, Max DD: ${result.maxDrawdown.toFixed(1)}%`);
  });

  if (successfulResults.length === 0) {
    console.log('\n❌ ALL YAHOO FINANCE TESTS FAILED');
    console.log('Please check:');
    console.log('1. YAHOO_FINANCE_API_KEY environment variable is set');
    console.log('2. YAHOO_FINANCE_RAPIDAPI_HOST environment variable is set');
    console.log('3. Network connectivity to Yahoo Finance API');
    console.log('4. Check server logs for detailed error information');
  } else {
    console.log('\n✅ YAHOO FINANCE TESTING COMPLETED');
    console.log('Yahoo Finance backtest validation is complete.');
  }
}

// Run the test
console.log('\n🚀 Starting Yahoo Finance backtest validation...');
console.log('This will test if Yahoo Finance API provides different results for different date ranges');
testYahooFinanceBacktest().catch(console.error);