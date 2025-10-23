#!/usr/bin/env node

/**
 * Yahoo Finance2 Library Limitation Test
 * 
 * Tests the actual data availability limitations for yahoo-finance2 library
 * to verify if the 60-day limitation for intraday data is accurate.
 */

import YahooFinance from 'yahoo-finance2';

// Create instance with suppress notices
const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical'] });

// Helper function to format date
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Helper function to calculate days
function daysBetween(date1, date2) {
  return Math.ceil((date2 - date1) / (1000 * 60 * 60 * 24));
}

// Test configuration
const TEST_SYMBOL = 'GC=F'; // Gold futures
const TEST_INTERVALS = [
  { name: '15min', value: '15m', description: 'Intraday 15min' },
  { name: '30min', value: '30m', description: 'Intraday 30min' },
  { name: '1hour', value: '1h', description: 'Intraday 1hour' },
  { name: 'daily', value: '1d', description: 'Daily' },
];

const TEST_RANGES = [
  { days: 7, description: 'Last 7 days' },
  { days: 30, description: 'Last 30 days' },
  { days: 60, description: 'Last 60 days' },
  { days: 90, description: 'Last 90 days' },
  { days: 120, description: 'Last 120 days' },
  { days: 180, description: 'Last 180 days' },
  { days: 365, description: 'Last 365 days' },
];

console.log('🧪 Yahoo Finance2 Library Limitation Test');
console.log('='.repeat(80));
console.log(`📊 Test Symbol: ${TEST_SYMBOL}`);
console.log(`📅 Test Date: ${formatDate(new Date())}`);
console.log('='.repeat(80));
console.log('');

// Store results
const results = [];

// Test each combination
async function runTests() {
  for (const interval of TEST_INTERVALS) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 Testing Interval: ${interval.description} (${interval.value})`);
    console.log('='.repeat(80));
    
    for (const range of TEST_RANGES) {
      const testName = `${interval.name}_${range.days}days`;
      console.log(`\n📋 Test: ${range.description} with ${interval.description}`);
      
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - range.days);
        
        console.log(`   Start: ${formatDate(startDate)}`);
        console.log(`   End: ${formatDate(endDate)}`);
        console.log(`   Days: ${range.days}`);
        
        const result = await yahooFinance.chart(TEST_SYMBOL, {
          period1: startDate,
          period2: endDate,
          interval: interval.value,
        });
        
        const dataPoints = result?.quotes?.length || 0;
        const validPoints = result?.quotes?.filter(q => q.close != null).length || 0;
        
        if (dataPoints === 0) {
          console.log(`   ❌ Status: NO DATA`);
          console.log(`   📊 Data Points: 0`);
          results.push({
            interval: interval.name,
            range: range.days,
            status: 'NO_DATA',
            dataPoints: 0,
            validPoints: 0,
          });
        } else {
          const firstDate = result.quotes[0].date;
          const lastDate = result.quotes[dataPoints - 1].date;
          const actualDays = daysBetween(new Date(firstDate), new Date(lastDate));
          const coverage = (actualDays / range.days * 100).toFixed(1);
          
          console.log(`   ✅ Status: SUCCESS`);
          console.log(`   📊 Data Points: ${dataPoints}`);
          console.log(`   ✔️  Valid Points: ${validPoints} (${(validPoints/dataPoints*100).toFixed(1)}%)`);
          console.log(`   📅 First Date: ${formatDate(new Date(firstDate))}`);
          console.log(`   📅 Last Date: ${formatDate(new Date(lastDate))}`);
          console.log(`   📏 Actual Days: ${actualDays} (${coverage}% coverage)`);
          
          // Sample data points
          const firstPrice = result.quotes[0].close;
          const lastPrice = result.quotes[dataPoints - 1].close;
          const priceChange = ((lastPrice - firstPrice) / firstPrice * 100).toFixed(2);
          console.log(`   💰 First Price: $${firstPrice?.toFixed(2) || 'N/A'}`);
          console.log(`   💰 Last Price: $${lastPrice?.toFixed(2) || 'N/A'}`);
          console.log(`   📈 Price Change: ${priceChange}%`);
          
          results.push({
            interval: interval.name,
            range: range.days,
            status: 'SUCCESS',
            dataPoints,
            validPoints,
            actualDays,
            coverage: parseFloat(coverage),
            firstDate: formatDate(new Date(firstDate)),
            lastDate: formatDate(new Date(lastDate)),
          });
        }
      } catch (error) {
        console.log(`   ❌ Status: ERROR`);
        console.log(`   ⚠️  Error: ${error.message}`);
        results.push({
          interval: interval.name,
          range: range.days,
          status: 'ERROR',
          error: error.message,
        });
      }
    }
  }
}

// Generate summary report
function generateSummary() {
  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('📊 SUMMARY REPORT - YAHOO FINANCE2 LIMITATIONS');
  console.log('='.repeat(80));
  console.log('');
  
  // Group by interval
  const byInterval = {};
  results.forEach(r => {
    if (!byInterval[r.interval]) {
      byInterval[r.interval] = [];
    }
    byInterval[r.interval].push(r);
  });
  
  for (const [interval, tests] of Object.entries(byInterval)) {
    console.log(`\n📊 Interval: ${interval.toUpperCase()}`);
    console.log('-'.repeat(80));
    
    const successful = tests.filter(t => t.status === 'SUCCESS');
    const failed = tests.filter(t => t.status === 'NO_DATA' || t.status === 'ERROR');
    
    console.log(`   ✅ Successful Tests: ${successful.length}/${tests.length}`);
    console.log(`   ❌ Failed Tests: ${failed.length}/${tests.length}`);
    
    if (successful.length > 0) {
      const maxRange = Math.max(...successful.map(t => t.range));
      const minCoverage = Math.min(...successful.map(t => t.coverage || 0));
      const avgDataPoints = (successful.reduce((sum, t) => sum + t.dataPoints, 0) / successful.length).toFixed(0);
      
      console.log(`   📏 Maximum Working Range: ${maxRange} days`);
      console.log(`   📊 Average Data Points: ${avgDataPoints}`);
      console.log(`   📈 Minimum Coverage: ${minCoverage.toFixed(1)}%`);
    }
    
    if (failed.length > 0) {
      const minFailedRange = Math.min(...failed.map(t => t.range));
      console.log(`   ⚠️  First Failure At: ${minFailedRange} days`);
    }
    
    console.log('\n   Detailed Results:');
    tests.forEach(test => {
      const status = test.status === 'SUCCESS' ? '✅' : '❌';
      const points = test.dataPoints ? ` - ${test.dataPoints} points` : '';
      const coverage = test.coverage ? ` (${test.coverage.toFixed(0)}% coverage)` : '';
      console.log(`     ${status} ${test.range} days${points}${coverage}`);
    });
  }
  
  // Final recommendations
  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('💡 RECOMMENDATIONS');
  console.log('='.repeat(80));
  console.log('');
  
  // Analyze intraday limitations
  const intradayIntervals = ['15min', '30min', '1hour'];
  let intradayLimit = 0;
  
  intradayIntervals.forEach(interval => {
    const tests = byInterval[interval] || [];
    const successful = tests.filter(t => t.status === 'SUCCESS');
    if (successful.length > 0) {
      const maxRange = Math.max(...successful.map(t => t.range));
      intradayLimit = Math.max(intradayLimit, maxRange);
    }
  });
  
  console.log(`1. 📊 Intraday Data Limitation:`);
  console.log(`   - Maximum reliable range: ${intradayLimit} days`);
  console.log(`   - Recommended UI validation: ${intradayLimit} days`);
  console.log('');
  
  // Analyze daily limitation
  const dailyTests = byInterval['daily'] || [];
  const dailySuccessful = dailyTests.filter(t => t.status === 'SUCCESS');
  if (dailySuccessful.length > 0) {
    const maxDailyRange = Math.max(...dailySuccessful.map(t => t.range));
    console.log(`2. 📊 Daily Data Limitation:`);
    console.log(`   - Maximum reliable range: ${maxDailyRange}+ days`);
    console.log(`   - Recommended UI: Allow longer ranges for daily interval`);
    console.log('');
  }
  
  console.log(`3. 🔧 UI Validation Updates Needed:`);
  if (intradayLimit !== 60) {
    console.log(`   ⚠️  Current UI assumes 60 days, actual limit is ${intradayLimit} days`);
    console.log(`   ✏️  Update validation in src/app/(dashboard)/dashboard/backtest/page.tsx`);
  } else {
    console.log(`   ✅ Current UI validation (60 days) is correct`);
  }
  console.log('');
  
  console.log(`4. 📝 Documentation Updates:`);
  console.log(`   - Update YAHOO_FINANCE2_MIGRATION.md with actual limitations`);
  console.log(`   - Update UI_UPDATES_YAHOO_FINANCE.md with test results`);
  console.log(`   - Update test-yahoo-finance-production.md with accurate expectations`);
  console.log('');
}

// Run all tests
console.log('Starting tests...\n');
await runTests();
generateSummary();

console.log('\n='.repeat(80));
console.log('✅ All tests completed!');
console.log('='.repeat(80));
