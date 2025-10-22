// Direct test script untuk backtest engine tanpa perlu server
// Script ini akan langsung test BacktestEngine class

// Import modules secara langsung
const { BacktestEngine, runBacktest } = require('./src/lib/backtest/engine');

async function testBacktestDirectly() {
  console.log('🧪 TESTING BACKTEST FIX (DIRECT)');
  console.log('=' .repeat(60));

  // Test strategy sederhana
  const testStrategy = {
    id: 'test_strategy_direct',
    name: 'Direct Test Strategy',
    symbol: 'XAUUSD',
    rules: [
      {
        name: 'Test Entry',
        conditions: [
          {
            indicator: 'price',
            operator: 'gt',
            value: 0,
            timeframes: ['15min'],
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
            timeframes: ['15min'],
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

  // Test cases dengan range waktu berbeda
  const testCases = [
    {
      name: 'Test 1: 30 days (short range)',
      startDate: new Date('2024-09-01'),
      endDate: new Date('2024-10-01'),
      expectedDays: 30,
    },
    {
      name: 'Test 2: 60 days (medium range)',
      startDate: new Date('2024-08-01'),
      endDate: new Date('2024-10-01'),
      expectedDays: 61,
    },
    {
      name: 'Test 3: 90 days (long range)',
      startDate: new Date('2024-07-01'),
      endDate: new Date('2024-10-01'),
      expectedDays: 92,
    },
  ];

  const results = [];

  for (const testCase of testCases) {
    console.log(`\n🔍 ${testCase.name}`);
    console.log(`   Symbol: XAUUSD`);
    console.log(`   Interval: 15min`);
    console.log(`   Date Range: ${testCase.startDate.toISOString().split('T')[0]} to ${testCase.endDate.toISOString().split('T')[0]}`);
    console.log(`   Expected Days: ${testCase.expectedDays}`);

    try {
      const engine = new BacktestEngine(10000);
      
      // Load data dengan logging yang sudah ditambah
      await engine.loadData(
        'XAUUSD',
        '15min',
        testCase.startDate,
        testCase.endDate,
        'twelvedata'
      );

      // Run backtest
      const result = await engine.runBacktest(testStrategy);
      
      const actualDays = Math.ceil((result.endDate.getTime() - result.startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      const summary = {
        testCase: testCase.name,
        expectedDays: testCase.expectedDays,
        actualDays: actualDays,
        requestedStart: testCase.startDate.toISOString(),
        requestedEnd: testCase.endDate.toISOString(),
        actualStart: result.startDate.toISOString(),
        actualEnd: result.endDate.toISOString(),
        dataPoints: result.metadata.totalDataPoints,
        totalTrades: result.totalTrades,
        finalBalance: result.finalBalance,
        returnPercentage: result.returnPercentage,
        winRate: result.winRate,
        maxDrawdown: result.maxDrawdown,
      };

      results.push(summary);
      
      console.log(`✅ Backtest completed:`);
      console.log(`   Actual Days: ${summary.actualDays} (expected: ${summary.expectedDays})`);
      console.log(`   Data Points: ${summary.dataPoints}`);
      console.log(`   Total Trades: ${summary.totalTrades}`);
      console.log(`   Return: ${summary.returnPercentage.toFixed(2)}%`);
      console.log(`   Win Rate: ${summary.winRate.toFixed(1)}%`);
      console.log(`   Max Drawdown: ${summary.maxDrawdown.toFixed(1)}%`);

      // Check if date range matches
      const dayDiff = Math.abs(summary.actualDays - summary.expectedDays);
      if (dayDiff > 7) {
        console.warn(`⚠️ WARNING: Actual days (${summary.actualDays}) very different from expected (${summary.expectedDays})`);
      }

    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
      results.push({
        testCase: testCase.name,
        error: error.message,
        stack: error.stack,
      });
    }

    // Wait between tests to avoid rate limiting
    if (testCases.indexOf(testCase) < testCases.length - 1) {
      console.log('⏳ Waiting 3 seconds before next test...');
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
    console.log('   - Missing TWELVEDATA_API_KEY environment variable');
    console.log('   - Network connectivity issues');
    console.log('   - API rate limiting');
    console.log('   - Invalid date ranges (weekends/holidays)');
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
    console.log('❌ Possible causes:');
    console.log('   - API plan limitations');
    console.log('   - Date range format issues');
    console.log('   - Weekend/holiday adjustments causing same effective range');
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
    console.log(`   Date Range: ${result.actualStart.split('T')[0]} to ${result.actualEnd.split('T')[0]}`);
  });

  if (successfulResults.length === 0) {
    console.log('\n❌ ALL TESTS FAILED');
    console.log('Please check:');
    console.log('1. TWELVEDATA_API_KEY environment variable is set');
    console.log('2. Network connectivity to TwelveData API');
    console.log('3. API key is valid and has sufficient quota');
  }
}

// Check environment variables first
console.log('🔍 Checking environment variables...');
console.log(`TWELVEDATA_API_KEY: ${process.env.TWELVEDATA_API_KEY ? '✅ Set' : '❌ Not set'}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);

// Load environment variables from .env file if exists
try {
  require('dotenv').config();
  console.log('✅ Environment variables loaded from .env file');
  console.log(`TWELVEDATA_API_KEY after dotenv: ${process.env.TWELVEDATA_API_KEY ? '✅ Set' : '❌ Still not set'}`);
} catch (error) {
  console.log('⚠️ Could not load .env file (dotenv not available)');
}

// Run the test
console.log('\n🚀 Starting direct backtest fix validation...');
testBacktestDirectly().catch(console.error);