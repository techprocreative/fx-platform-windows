/**
 * Simple ATR Integration Test
 * 
 * This is a basic test to verify our ATR-based risk management implementation
 * without the complex Jest setup issues.
 */

import { RiskManager } from '../risk/risk-manager';
import { SignalGenerator } from '../signals/generator';
import { DynamicRiskParams } from '../../types';

// Simple test runner
function runTests() {
  console.log('🧪 Running ATR-based Risk Management Integration Tests...\n');

  let testsPassed = 0;
  let testsTotal = 0;

  function test(name: string, fn: () => boolean | void) {
    testsTotal++;
    try {
      const result = fn();
      if (result === false) {
        console.log(`❌ ${name}`);
        return;
      }
      console.log(`✅ ${name}`);
      testsPassed++;
    } catch (error) {
      console.log(`❌ ${name} - Error: ${(error as Error).message}`);
    }
  }

  // Initialize risk manager
  const riskManager = new RiskManager();

  // Test 1: ATR Position Sizing Calculation
  test('ATR Position Sizing Calculation', () => {
    const balance = 10000;
    const riskPercent = 1.5;
    const atr = 0.0020; // 20 pips
    const atrMultiplier = 2.0;
    const symbol = 'EURUSD';

    const positionSize = riskManager.calculateATRPositionSize(
      balance,
      riskPercent,
      atr,
      atrMultiplier,
      symbol
    );

    console.log(`   Calculated position size: ${positionSize} lots`);
    
    // Basic validations
    if (positionSize <= 0) {
      throw new Error('Position size should be greater than 0');
    }
    if (positionSize > 10) {
      throw new Error('Position size should not exceed maximum lot size');
    }
  });

  // Test 2: ATR Stop Loss Calculation
  test('ATR Stop Loss Calculation', () => {
    const entryPrice = 1.1000;
    const atr = 0.0020; // 20 pips
    const atrMultiplier = 2.0;

    // Test BUY trade
    const buyStopLoss = riskManager.calculateATRStopLoss(
      entryPrice,
      atr,
      atrMultiplier,
      'BUY'
    );
    
    // Test SELL trade
    const sellStopLoss = riskManager.calculateATRStopLoss(
      entryPrice,
      atr,
      atrMultiplier,
      'SELL'
    );

    console.log(`   BUY stop loss: ${buyStopLoss}`);
    console.log(`   SELL stop loss: ${sellStopLoss}`);

    // Validations
    if (buyStopLoss >= entryPrice) {
      throw new Error('BUY stop loss should be below entry price');
    }
    if (sellStopLoss <= entryPrice) {
      throw new Error('SELL stop loss should be above entry price');
    }
  });

  // Test 3: Signal Generator with ATR
  test('Signal Generator ATR Integration', () => {
    const dynamicRisk: DynamicRiskParams = {
      useATRSizing: true,
      atrMultiplier: 2.0,
      riskPercentage: 1.5,
      autoAdjustLotSize: true,
      reduceInHighVolatility: false,
      volatilityThreshold: 0.02,
    };

    const config = {
      strategyId: 'test-strategy',
      symbol: 'EURUSD',
      timeframe: 'H1',
      rules: {
        dynamicRisk
      },
      dynamicRisk
    };

    const generator = new SignalGenerator(config);
    
    // Test ATR calculation
    const mockData = [
      { close: 1.0980, high: 1.1000, low: 1.0960 },
      { close: 1.1000, high: 1.1020, low: 1.0980 },
      { close: 1.1020, high: 1.1040, low: 1.1000 },
      { close: 1.1040, high: 1.1060, low: 1.1020 },
      { close: 1.1060, high: 1.1080, low: 1.1040 },
      { close: 1.1080, high: 1.1100, low: 1.1060 },
      { close: 1.1100, high: 1.1120, low: 1.1080 },
      { close: 1.1120, high: 1.1140, low: 1.1100 },
      { close: 1.1140, high: 1.1160, low: 1.1120 },
      { close: 1.1160, high: 1.1180, low: 1.1140 },
      { close: 1.1180, high: 1.1200, low: 1.1160 },
      { close: 1.1200, high: 1.1220, low: 1.1180 },
      { close: 1.1220, high: 1.1240, low: 1.1200 },
      { close: 1.1240, high: 1.1260, low: 1.1220 },
      { close: 1.1260, high: 1.1280, low: 1.1240 },
    ];

    // Access private method for testing
    const atrValue = (generator as any).calculateATR(mockData, 14);
    console.log(`   Calculated ATR: ${atrValue}`);

    if (atrValue <= 0) {
      throw new Error('ATR should be greater than 0');
    }
  });

  // Test 4: Volatility Adjustment
  test('Volatility Adjustment in High Volatility', () => {
    const balance = 10000;
    const riskPercent = 1.5;
    const atr = 0.0030; // 30 pips (high volatility)
    const atrMultiplier = 2.0;
    const symbol = 'EURUSD';
    
    const dynamicRisk: DynamicRiskParams = {
      useATRSizing: true,
      atrMultiplier: 2.0,
      riskPercentage: 1.5,
      autoAdjustLotSize: true,
      reduceInHighVolatility: true,
      volatilityThreshold: 0.0025, // 25 pips threshold
    };

    const positionSize = riskManager.calculateATRPositionSize(
      balance,
      riskPercent,
      atr,
      atrMultiplier,
      symbol,
      dynamicRisk
    );

    console.log(`   Position size with volatility adjustment: ${positionSize} lots`);
    
    if (positionSize <= 0) {
      throw new Error('Position size should be greater than 0 even with volatility adjustment');
    }
  });

  // Test Results
  console.log(`\n📊 Test Results: ${testsPassed}/${testsTotal} tests passed`);
  
  if (testsPassed === testsTotal) {
    console.log('🎉 All tests passed! ATR-based risk management is working correctly.');
    return true;
  } else {
    console.log('⚠️ Some tests failed. Please check the implementation.');
    return false;
  }
}

// Export for manual testing
export { runTests };

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}