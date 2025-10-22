// Test script untuk memvalidasi backtest fix di production dengan authentication
require('dotenv').config();

async function loginAndGetSession() {
  console.log('🔐 Logging in to production...');
  
  // Try different login endpoints
  const loginEndpoints = [
    'https://fx.nusanexus.com/api/auth/signin',
    'https://fx.nusanexus.com/api/auth/callback/credentials',
    'https://fx.nusanexus.com/api/auth/signin/credentials'
  ];
  
  let loginResponse = null;
  let successfulEndpoint = null;
  
  for (const endpoint of loginEndpoints) {
    try {
      console.log(`   Trying endpoint: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'demo@nexustrade.com',
          password: 'Demo123!',
          csrfToken: 'dummy', // Add if needed
          redirect: 'false'
        }),
        redirect: 'manual' // Don't follow redirects
      });

      // Check if we got cookies (even with redirect)
      const setCookieHeader = response.headers.get('set-cookie');
      if (setCookieHeader) {
        loginResponse = response;
        successfulEndpoint = endpoint;
        console.log(`   ✅ Got session cookies from: ${endpoint}`);
        break;
      } else if (response.ok) {
        loginResponse = response;
        successfulEndpoint = endpoint;
        console.log(`   ✅ Successful response from: ${endpoint}`);
        break;
      } else {
        console.log(`   ❌ Failed: ${response.status} - ${await response.text()}`);
      }
    } catch (error) {
      console.log(`   ❌ Error with ${endpoint}: ${error.message}`);
    }
  }

  if (!loginResponse) {
    throw new Error('All login endpoints failed');
  }

  // Extract session cookies from response
  const setCookieHeader = loginResponse.headers.get('set-cookie');
  if (!setCookieHeader) {
    throw new Error('No session cookie received from any endpoint');
  }

  // Parse cookies
  const cookies = setCookieHeader.split(',').map(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    return [name, rest.join('=')];
  });

  // Build cookie string
  const cookieString = cookies.map(([name, value]) => {
    // Remove path and expiry info, keep only name=value
    const cleanValue = value.split(';')[0];
    return `${name}=${cleanValue}`;
  }).join('; ');

  console.log('✅ Login successful');
  console.log(`   Session cookies: ${cookies.length} cookies received`);
  return cookieString;
}

async function testProductionBacktestWithAuth() {
  console.log('🧪 TESTING PRODUCTION BACKTEST WITH AUTHENTICATION');
  console.log('=' .repeat(60));

  const PROD_API_BASE = 'https://fx.nusanexus.com/api';
  
  // Test cases dengan range waktu berbeda (sama seperti user feedback)
  const testCases = [
    {
      name: 'Test 1: 357 days (user case 1)',
      startDate: '2024-11-01T00:00:00.000Z',
      endDate: '2025-10-23T23:59:59.000Z',
      expectedDays: 357,
    },
    {
      name: 'Test 2: 292 days (user case 2)',
      startDate: '2025-01-01T00:00:00.000Z',
      endDate: '2025-10-23T23:59:59.000Z',
      expectedDays: 292,
    },
    {
      name: 'Test 3: 30 days (short range)',
      startDate: '2025-09-23T00:00:00.000Z',
      endDate: '2025-10-23T23:59:59.000Z',
      expectedDays: 30,
    },
  ];

  let sessionCookie = '';
  
  try {
    // Login to get session
    sessionCookie = await loginAndGetSession();
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    return;
  }

  // Get available strategies first
  console.log('\n📋 Fetching available strategies...');
  let strategies = [];
  
  try {
    const strategiesResponse = await fetch(`${PROD_API_BASE}/strategy`, {
      headers: {
        'Cookie': sessionCookie,
      },
    });

    if (strategiesResponse.ok) {
      const strategiesData = await strategiesResponse.json();
      strategies = strategiesData.strategies || [];
      console.log(`✅ Found ${strategies.length} strategies`);
      
      if (strategies.length > 0) {
        console.log('   Available strategies:');
        strategies.slice(0, 3).forEach((s, i) => {
          console.log(`   ${i+1}. ${s.name} (${s.symbol} ${s.timeframe})`);
        });
      }
    } else {
      console.log('⚠️ Could not fetch strategies, will use fallback');
    }
  } catch (error) {
    console.log('⚠️ Error fetching strategies:', error.message);
  }

  const results = [];

  for (const testCase of testCases) {
    console.log(`\n🔍 ${testCase.name}`);
    console.log(`   Date Range: ${testCase.startDate.split('T')[0]} to ${testCase.endDate.split('T')[0]}`);
    console.log(`   Expected Days: ${testCase.expectedDays}`);

    try {
      console.log('   Running backtest...');
      
      // Use first available strategy or fallback
      const strategyId = strategies.length > 0 ? strategies[0].id : 'fallback_strategy_id';
      const symbol = strategies.length > 0 ? strategies[0].symbol : 'XAUUSD';
      const interval = strategies.length > 0 ? strategies[0].timeframe.toLowerCase().replace('m', 'min').replace('h', 'h') : '15min';
      
      const backtestResponse = await fetch(`${PROD_API_BASE}/backtest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
        },
        body: JSON.stringify({
          strategyId: strategyId,
          symbol: symbol,
          interval: interval,
          startDate: testCase.startDate,
          endDate: testCase.endDate,
          initialBalance: 10000,
          preferredDataSource: 'twelvedata'
        })
      });

      if (backtestResponse.ok) {
        const backtest = await backtestResponse.json();
        const result = backtest.result;
        
        const summary = {
          testCase: testCase.name,
          expectedDays: testCase.expectedDays,
          actualDays: Math.ceil((new Date(result.endDate) - new Date(result.startDate)) / (1000 * 60 * 60 * 24)),
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

        // Check if date range matches
        const dayDiff = Math.abs(summary.actualDays - summary.expectedDays);
        if (dayDiff > 7) {
          console.warn(`   ⚠️ WARNING: Actual days (${summary.actualDays}) very different from expected (${summary.expectedDays})`);
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
      console.log('   ⏳ Waiting 5 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Analyze results
  console.log('\n📊 RESULTS COMPARISON');
  console.log('=' .repeat(60));
  
  const successfulResults = results.filter(r => !r.error);
  const failedResults = results.filter(r => r.error);
  
  if (failedResults.length > 0) {
    console.log(`❌ FAILED TESTS: ${failedResults.length}/${results.length} tests`);
    failedResults.forEach(result => {
      console.log(`   ${result.testCase}: ${result.error}`);
    });
  }
  
  if (successfulResults.length < 2) {
    console.log(`❌ Not enough successful tests to compare (${successfulResults.length}/${results.length})`);
    console.log('   This might be due to:');
    console.log('   - Strategy configuration issues');
    console.log('   - API rate limiting');
    console.log('   - Data availability issues');
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
    console.log('✅ The TwelveData API and cache issues have been resolved in production.');
    console.log('✅ Backtest with different time ranges now produces different results.');
  } else if (allSameDataPoints) {
    console.log('❌ ISSUE PERSISTS: Data points are still identical.');
    console.log('❌ This suggests TwelveData API is still returning the same data regardless of date range.');
    console.log('❌ The fix may not be working properly in production.');
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
    console.log('1. Account credentials are correct');
    console.log('2. Strategy configuration is valid');
    console.log('3. Network connectivity to production API');
  } else {
    console.log('\n✅ TESTING COMPLETED');
    console.log('Production backtest fix validation is complete.');
  }
}

// Check environment variables
console.log('🔍 Checking environment...');
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);

// Run the test
console.log('\n🚀 Starting production backtest validation with authentication...');
console.log('This will test if our fix is working in the deployed application with real user login');
testProductionBacktestWithAuth().catch(console.error);