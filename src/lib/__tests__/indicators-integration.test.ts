/**
 * Integration test for Phase 1.1 Enhanced Indicators Library
 * Verifies that new indicators work alongside existing ones
 */

import { INDICATOR_CONFIGS } from '../../components/forms/StrategyForm';
import { IndicatorType } from '../../types';

describe('Enhanced Indicators Library Integration', () => {
  // Test that all indicators have proper configurations
  test('all indicators have valid configurations', () => {
    const expectedIndicators: IndicatorType[] = [
      "RSI", "MACD", "EMA", "SMA", "ADX", "Bollinger Bands", "Stochastic",
      "ATR", "Ichimoku", "VWAP", "CCI", "Williams %R", "OBV", "Volume MA"
    ];

    expectedIndicators.forEach(indicator => {
      const config = INDICATOR_CONFIGS[indicator as keyof typeof INDICATOR_CONFIGS];
      expect(config).toBeDefined();
      expect(config).toHaveProperty('periods');
      expect(config).toHaveProperty('description');
      expect(typeof config.description).toBe('string');
      expect(config.description.length).toBeGreaterThan(0);
    });
  });

  // Test that new indicators from Phase 1.1 are properly configured
  test('Phase 1.1 indicators have correct configurations', () => {
    const newIndicators = ["ATR", "Ichimoku", "VWAP", "CCI", "Williams %R", "OBV", "Volume MA"];
    
    newIndicators.forEach(indicator => {
      const config = INDICATOR_CONFIGS[indicator as keyof typeof INDICATOR_CONFIGS];
      expect(config).toBeDefined();
      
      // Verify specific configurations match STRATEGY_IMPROVEMENT_PLAN.md
      switch (indicator) {
        case "ATR":
          expect(config.periods).toEqual([14, 20]);
          expect(config.description).toBe("Volatility & stop loss");
          break;
        case "Ichimoku":
          expect(config.periods).toEqual([9, 26, 52]);
          expect(config.description).toBe("Trend & support/resistance");
          break;
        case "VWAP":
          expect(config.periods).toEqual([]);
          expect(config.description).toBe("Institutional levels");
          break;
        case "CCI":
          expect(config.periods).toEqual([14, 20]);
          expect(config.description).toBe("Overbought/oversold");
          break;
        case "Williams %R":
          expect(config.periods).toEqual([14]);
          expect(config.description).toBe("Momentum reversal");
          break;
        case "OBV":
          expect(config.periods).toEqual([]);
          expect(config.description).toBe("Volume confirmation");
          break;
        case "Volume MA":
          expect(config.periods).toEqual([20]);
          expect(config.description).toBe("Volume trends");
          break;
      }
    });
  });

  // Test that existing indicators still work
  test('existing indicators maintain compatibility', () => {
    const existingIndicators = ["RSI", "MACD", "EMA", "SMA", "ADX", "Bollinger Bands", "Stochastic"];
    
    existingIndicators.forEach(indicator => {
      const config = INDICATOR_CONFIGS[indicator as keyof typeof INDICATOR_CONFIGS];
      expect(config).toBeDefined();
      expect(config.periods.length).toBeGreaterThan(0); // All existing indicators should have periods
    });
  });

  // Test period validation for indicators that don't use periods
  test('indicators without periods are properly identified', () => {
    const noPeriodIndicators = ["VWAP", "OBV"];
    
    noPeriodIndicators.forEach(indicator => {
      const config = INDICATOR_CONFIGS[indicator as keyof typeof INDICATOR_CONFIGS];
      expect(config.periods).toEqual([]);
    });
  });
});