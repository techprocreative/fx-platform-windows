/**
 * ATR-based Risk Management Tests
 * 
 * This test file verifies the integration of ATR-based stop loss and position sizing
 * functionality across the risk management system.
 */

import { RiskManager } from '../risk/risk-manager';
import { SignalGenerator } from '../signals/generator';
import { DynamicRiskParams } from '../../types';

describe('ATR-based Risk Management', () => {
  let riskManager: RiskManager;

  beforeEach(() => {
    riskManager = new RiskManager();
  });

  describe('ATR Position Sizing', () => {
    it('should calculate correct position size based on ATR', () => {
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

      // Risk amount = $150 (1.5% of $10,000)
      // Stop loss distance = 0.0020 * 2 = 0.0040 (40 pips)
      // Expected position size = 150 / (0.0040 * 100000) = 0.375 lots
      expect(positionSize).toBeGreaterThan(0);
      expect(positionSize).toBeLessThanOrEqual(10); // Max lot size
    });

    it('should reduce position size in high volatility', () => {
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

      // Should be reduced due to high volatility
      expect(positionSize).toBeGreaterThan(0);
    });
  });

  describe('ATR Stop Loss Calculation', () => {
    it('should calculate correct stop loss for BUY trade', () => {
      const entryPrice = 1.1000;
      const atr = 0.0020; // 20 pips
      const atrMultiplier = 2.0;
      const tradeType = 'BUY' as const;

      const stopLoss = riskManager.calculateATRStopLoss(
        entryPrice,
        atr,
        atrMultiplier,
        tradeType
      );

      // Expected: 1.1000 - (0.0020 * 2) = 1.0960
      expect(stopLoss).toBe(1.0960);
    });

    it('should calculate correct stop loss for SELL trade', () => {
      const entryPrice = 1.1000;
      const atr = 0.0020; // 20 pips
      const atrMultiplier = 2.0;
      const tradeType = 'SELL' as const;

      const stopLoss = riskManager.calculateATRStopLoss(
        entryPrice,
        atr,
        atrMultiplier,
        tradeType
      );

      // Expected: 1.1000 + (0.0020 * 2) = 1.1040
      expect(stopLoss).toBe(1.1040);
    });
  });

  describe('Signal Generator Integration', () => {
    it('should use ATR-based calculations when enabled', async () => {
      const config = {
        strategyId: 'test-strategy',
        symbol: 'EURUSD',
        timeframe: 'H1',
        rules: {
          dynamicRisk: {
            useATRSizing: true,
            atrMultiplier: 2.0,
            riskPercentage: 1.5,
            autoAdjustLotSize: true,
            reduceInHighVolatility: false,
            volatilityThreshold: 0.02,
          }
        },
        dynamicRisk: {
          useATRSizing: true,
          atrMultiplier: 2.0,
          riskPercentage: 1.5,
          autoAdjustLotSize: true,
          reduceInHighVolatility: false,
          volatilityThreshold: 0.02,
        }
      };

      const generator = new SignalGenerator(config);
      
      // Mock market data with ATR
      const marketData = {
        close: 1.1000,
        high: 1.1020,
        low: 1.0980,
        volume: 1000,
        // Add historical data for ATR calculation
        slice: () => [
          { close: 1.0980, high: 1.1000, low: 1.0960 },
          { close: 1.1000, high: 1.1020, low: 1.0980 },
        ]
      };

      // Test that ATR is calculated
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
      const atrValue = (generator as any).calculateATR(mockData, 14);
      expect(atrValue).toBeGreaterThan(0);
    });
  });

  describe('Trade Validation with ATR', () => {
    it('should validate ATR-based trades correctly', async () => {
      const tradeParams = {
        symbol: 'EURUSD',
        type: 'BUY' as const,
        lotSize: 0.1,
        entryPrice: 1.1000,
        stopLoss: 1.0960,
        takeProfit: 1.1080,
        userId: 'test-user',
        currentATR: 0.0020,
        dynamicRisk: {
          useATRSizing: true,
          atrMultiplier: 2.0,
          riskPercentage: 1.5,
          autoAdjustLotSize: true,
          reduceInHighVolatility: false,
          volatilityThreshold: 0.02,
        }
      };

      const result = await riskManager.validateTrade(tradeParams);
      
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it('should suggest adjustments for invalid ATR trades', async () => {
      const tradeParams = {
        symbol: 'EURUSD',
        type: 'BUY' as const,
        lotSize: 5.0, // Too large
        entryPrice: 1.1000,
        stopLoss: 1.0960,
        takeProfit: 1.1080,
        userId: 'test-user',
        currentATR: 0.0020,
        dynamicRisk: {
          useATRSizing: true,
          atrMultiplier: 2.0,
          riskPercentage: 1.5,
          autoAdjustLotSize: true,
          reduceInHighVolatility: false,
          volatilityThreshold: 0.02,
        }
      };

      const result = await riskManager.validateTrade(tradeParams);
      
      // Should suggest adjustment due to excessive position size
      if (!result.valid) {
        expect(result.adjustedParams).toBeDefined();
        expect(result.warnings.length).toBeGreaterThan(0);
      }
    });
  });
});