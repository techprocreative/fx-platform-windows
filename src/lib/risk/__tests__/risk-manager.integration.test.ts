/**
 * Integration Tests for RiskManager
 * 
 * This file contains integration tests for the RiskManager class,
 * testing edge cases, various market conditions, and scenarios.
 * These tests use the test utilities and mock implementations.
 */

import { RiskManager } from '../risk-manager';
import { 
  RiskParameters, 
  TradeParams, 
  Position, 
  AccountInfo, 
  RiskViolation,
  RiskExposure
} from '../types';
import { 
  TestDataFactory, 
  TestEnvironmentHelper,
  PerformanceTestHelper,
  AsyncTestHelper,
  ErrorTestHelper
} from '../../testing/test-utils';

// Mock dependencies
jest.mock('../../monitoring/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }
}));

jest.mock('../../database/transaction-manager', () => ({
  transactionManager: {
    executeInTransaction: jest.fn(),
  }
}));

describe('RiskManager Integration Tests', () => {
  let riskManager: RiskManager;
  const testUserId = 'test-user-123';
  
  beforeEach(() => {
    riskManager = new RiskManager();
    jest.clearAllMocks();
    TestEnvironmentHelper.setupMockEnvironment();
  });

  describe('Position Sizing Edge Cases', () => {
    it('should handle extreme account sizes', () => {
      // Test with very small account
      const smallAccountSize = riskManager.calculatePositionSize(100, 2, 20, 'EURUSD');
      expect(smallAccountSize).toBeGreaterThanOrEqual(0.01);
      expect(smallAccountSize).toBeLessThanOrEqual(10.0);
      
      // Test with very large account
      const largeAccountSize = riskManager.calculatePositionSize(10000000, 2, 20, 'EURUSD');
      expect(largeAccountSize).toBeGreaterThanOrEqual(0.01);
      expect(largeAccountSize).toBeLessThanOrEqual(10.0);
    });

    it('should handle very tight stop losses', () => {
      const positionSize = riskManager.calculatePositionSize(10000, 2, 1, 'EURUSD');
      expect(positionSize).toBeGreaterThanOrEqual(0.01);
      expect(positionSize).toBeLessThanOrEqual(10.0);
    });

    it('should handle very wide stop losses', () => {
      const positionSize = riskManager.calculatePositionSize(10000, 2, 500, 'EURUSD');
      expect(positionSize).toBeGreaterThanOrEqual(0.01);
      expect(positionSize).toBeLessThanOrEqual(10.0);
    });

    it('should handle different symbol specifications', () => {
      // Test with different symbols that might have different pip values
      const eurusdSize = riskManager.calculatePositionSize(10000, 2, 20, 'EURUSD');
      const gbpusdSize = riskManager.calculatePositionSize(10000, 2, 20, 'GBPUSD');
      const usdjpySize = riskManager.calculatePositionSize(10000, 2, 20, 'USDJPY');
      
      // All should be valid lot sizes
      expect(eurusdSize).toBeGreaterThanOrEqual(0.01);
      expect(gbpusdSize).toBeGreaterThanOrEqual(0.01);
      expect(usdjpySize).toBeGreaterThanOrEqual(0.01);
      
      // All should be within limits
      expect(eurusdSize).toBeLessThanOrEqual(10.0);
      expect(gbpusdSize).toBeLessThanOrEqual(10.0);
      expect(usdjpySize).toBeLessThanOrEqual(10.0);
    });

    it('should handle maximum risk percentage', () => {
      const positionSize = riskManager.calculatePositionSize(10000, 100, 20, 'EURUSD');
      expect(positionSize).toBeGreaterThanOrEqual(0.01);
      expect(positionSize).toBeLessThanOrEqual(10.0);
    });

    it('should handle minimum risk percentage', () => {
      const positionSize = riskManager.calculatePositionSize(10000, 0.01, 20, 'EURUSD');
      expect(positionSize).toBeGreaterThanOrEqual(0.01);
      expect(positionSize).toBeLessThanOrEqual(10.0);
    });
  });

  describe('Trade Validation Edge Cases', () => {
    it('should validate trades with minimum lot size', async () => {
      const tradeParams = TestDataFactory.createTradeParams({
        lotSize: 0.01
      });
      
      const result = await riskManager.validateTrade(tradeParams);
      expect(result.valid).toBe(true);
    });

    it('should validate trades with maximum lot size', async () => {
      const tradeParams = TestDataFactory.createTradeParams({
        lotSize: 10.0
      });
      
      const result = await riskManager.validateTrade(tradeParams);
      expect(result.valid).toBe(true);
    });

    it('should reject trades with invalid stop loss levels', async () => {
      // Buy order with stop loss above entry price
      const invalidBuyTrade = TestDataFactory.createTradeParams({
        type: 'BUY',
        entryPrice: 1.1000,
        stopLoss: 1.1050 // Above entry for BUY
      });
      
      const result1 = await riskManager.validateTrade(invalidBuyTrade);
      expect(result1.valid).toBe(false);
      expect(result1.errors.some(e => e.includes('Stop loss must be below entry price for BUY orders'))).toBe(true);
      
      // Sell order with stop loss below entry price
      const invalidSellTrade = TestDataFactory.createTradeParams({
        type: 'SELL',
        entryPrice: 1.1000,
        stopLoss: 1.0950 // Below entry for SELL
      });
      
      const result2 = await riskManager.validateTrade(invalidSellTrade);
      expect(result2.valid).toBe(false);
      expect(result2.errors.some(e => e.includes('Stop loss must be above entry price for SELL orders'))).toBe(true);
    });

    it('should reject trades with invalid take profit levels', async () => {
      // Buy order with take profit below entry price
      const invalidBuyTrade = TestDataFactory.createTradeParams({
        type: 'BUY',
        entryPrice: 1.1000,
        takeProfit: 1.0950 // Below entry for BUY
      });
      
      const result1 = await riskManager.validateTrade(invalidBuyTrade);
      expect(result1.valid).toBe(false);
      expect(result1.errors.some(e => e.includes('Take profit must be above entry price for BUY orders'))).toBe(true);
      
      // Sell order with take profit above entry price
      const invalidSellTrade = TestDataFactory.createTradeParams({
        type: 'SELL',
        entryPrice: 1.1000,
        takeProfit: 1.1050 // Above entry for SELL
      });
      
      const result2 = await riskManager.validateTrade(invalidSellTrade);
      expect(result2.valid).toBe(false);
      expect(result2.errors.some(e => e.includes('Take profit must be below entry price for SELL orders'))).toBe(true);
    });

    it('should handle trades with very small stop loss distances', async () => {
      const tradeParams = TestDataFactory.createTradeParams({
        entryPrice: 1.1000,
        stopLoss: 1.0999, // Only 1 pip away
        lotSize: 0.01 // Small lot size to stay within risk limits
      });
      
      const result = await riskManager.validateTrade(tradeParams);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Stop loss distance'))).toBe(true);
    });

    it('should handle trades with very large lot sizes', async () => {
      const tradeParams = TestDataFactory.createTradeParams({
        lotSize: 100.0 // Very large lot size
      });
      
      const result = await riskManager.validateTrade(tradeParams);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('exceeds maximum'))).toBe(true);
    });

    it('should suggest adjusted parameters for high-risk trades', async () => {
      const tradeParams = TestDataFactory.createTradeParams({
        lotSize: 5.0, // High risk position
        entryPrice: 1.1000,
        stopLoss: 1.0900, // 100 pip stop loss
        takeProfit: 1.1200
      });
      
      const result = await riskManager.validateTrade(tradeParams);
      expect(result.valid).toBe(false);
      expect(result.adjustedParams).toBeDefined();
      expect(result.adjustedParams!.lotSize).toBeLessThan(5.0);
      expect(result.warnings.some(w => w.includes('Suggested lot size'))).toBe(true);
    });
  });

  describe('Risk Exposure Calculations', () => {
    it('should calculate risk exposure with multiple positions', async () => {
      // Mock multiple positions
      const positions = [
        TestDataFactory.createPosition({
          ticket: 1,
          symbol: 'EURUSD',
          type: 'BUY',
          lotSize: 1.0,
          profit: 100
        }),
        TestDataFactory.createPosition({
          ticket: 2,
          symbol: 'GBPUSD',
          type: 'SELL',
          lotSize: 0.5,
          profit: -50
        }),
        TestDataFactory.createPosition({
          ticket: 3,
          symbol: 'USDJPY',
          type: 'BUY',
          lotSize: 0.8,
          profit: 25
        })
      ];
      
      // Mock the getOpenPositions method
      jest.spyOn(riskManager as any, 'getOpenPositions').mockResolvedValue(positions);
      
      // Mock account info
      const accountInfo = TestDataFactory.createAccountInfo({
        balance: 10000,
        equity: 10075
      });
      jest.spyOn(riskManager as any, 'getAccountInfo').mockResolvedValue(accountInfo);
      
      const exposure = await riskManager.getRiskExposure(testUserId);
      
      expect(exposure.balance).toBe(10000);
      expect(exposure.totalRiskExposure).toBe(75); // 100 - 50 + 25
      expect(exposure.riskExposurePercent).toBe(0.75); // 75 / 10000 * 100
      expect(exposure.openPositions).toBe(3);
      expect(exposure.limitsExceeded).toBe(false);
    });

    it('should detect daily loss limit violation', async () => {
      // Mock losing positions
      const positions = [
        TestDataFactory.createPosition({
          ticket: 1,
          symbol: 'EURUSD',
          type: 'BUY',
          lotSize: 1.0,
          profit: -400 // 4% loss
        }),
        TestDataFactory.createPosition({
          ticket: 2,
          symbol: 'GBPUSD',
          type: 'SELL',
          lotSize: 1.0,
          profit: -300 // 3% loss
        })
      ];
      
      // Mock the getOpenPositions method
      jest.spyOn(riskManager as any, 'getOpenPositions').mockResolvedValue(positions);
      
      // Mock account info
      const accountInfo = TestDataFactory.createAccountInfo({
        balance: 10000,
        equity: 9300 // 7% loss total
      });
      jest.spyOn(riskManager as any, 'getAccountInfo').mockResolvedValue(accountInfo);
      
      const exposure = await riskManager.getRiskExposure(testUserId);
      
      expect(exposure.dailyLoss).toBe(700);
      expect(exposure.dailyLossPercent).toBe(7);
      expect(exposure.limitsExceeded).toBe(true);
      expect(exposure.violations.some(v => v.type === 'MAX_DAILY_LOSS')).toBe(true);
    });

    it('should detect drawdown violation', async () => {
      // Mock account with high drawdown
      jest.spyOn(riskManager as any, 'getOpenPositions').mockResolvedValue([]);
      
      const accountInfo = TestDataFactory.createAccountInfo({
        balance: 10000,
        equity: 7500 // 25% drawdown
      });
      jest.spyOn(riskManager as any, 'getAccountInfo').mockResolvedValue(accountInfo);
      
      const exposure = await riskManager.getRiskExposure(testUserId);
      
      expect(exposure.currentDrawdown).toBe(2500);
      expect(exposure.drawdownPercent).toBe(25);
      expect(exposure.limitsExceeded).toBe(true);
      expect(exposure.violations.some(v => v.type === 'MAX_DRAWDOWN')).toBe(true);
    });

    it('should detect max positions violation', async () => {
      // Mock maximum positions
      const positions = TestDataFactory.createMultiplePositions(7);
      jest.spyOn(riskManager as any, 'getOpenPositions').mockResolvedValue(positions);
      
      const accountInfo = TestDataFactory.createAccountInfo();
      jest.spyOn(riskManager as any, 'getAccountInfo').mockResolvedValue(accountInfo);
      
      const exposure = await riskManager.getRiskExposure(testUserId);
      
      expect(exposure.openPositions).toBe(7);
      expect(exposure.limitsExceeded).toBe(true);
      expect(exposure.violations.some(v => v.type === 'MAX_POSITIONS')).toBe(true);
    });
  });

  describe('Emergency Functions', () => {
    it('should close all positions in emergency', async () => {
      // Mock open positions
      const positions = TestDataFactory.createMultiplePositions(3);
      jest.spyOn(riskManager as any, 'getOpenPositions').mockResolvedValue(positions);
      
      // Mock close position method
      jest.spyOn(riskManager as any, 'closePosition').mockResolvedValue({
        success: true,
        ticket: 1,
        executionPrice: 1.1000,
        executedLotSize: 1.0,
        timestamp: new Date()
      });
      
      await expect(riskManager.emergencyCloseAll(testUserId, 'Test emergency')).resolves.not.toThrow();
      
      // Verify closePosition was called for each position
      expect((riskManager as any).closePosition).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures during emergency close', async () => {
      // Mock open positions
      const positions = TestDataFactory.createMultiplePositions(3);
      jest.spyOn(riskManager as any, 'getOpenPositions').mockResolvedValue(positions);
      
      // Mock close position method with partial failures
      jest.spyOn(riskManager as any, 'closePosition')
        .mockResolvedValueOnce({
          success: true,
          ticket: 1,
          executionPrice: 1.1000,
          executedLotSize: 1.0,
          timestamp: new Date()
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Connection timeout',
          timestamp: new Date()
        })
        .mockResolvedValueOnce({
          success: true,
          ticket: 3,
          executionPrice: 1.1000,
          executedLotSize: 1.0,
          timestamp: new Date()
        });
      
      await expect(riskManager.emergencyCloseAll(testUserId, 'Test emergency')).rejects.toThrow();
    });

    it('should handle no open positions in emergency close', async () => {
      // Mock no open positions
      jest.spyOn(riskManager as any, 'getOpenPositions').mockResolvedValue([]);
      
      await expect(riskManager.emergencyCloseAll(testUserId, 'Test emergency')).resolves.not.toThrow();
    });
  });

  describe('Performance Tests', () => {
    it('should calculate position size efficiently', async () => {
      const { averageTime, totalTime } = await PerformanceTestHelper.measureExecutionTime(
        () => riskManager.calculatePositionSize(10000, 2, 20, 'EURUSD'),
        1000
      );
      
      // Should complete within reasonable time
      expect(averageTime).toBeLessThan(1); // Less than 1ms per calculation
      expect(totalTime).toBeLessThan(100); // Less than 100ms total for 1000 calculations
    });

    it('should validate trades efficiently', async () => {
      const tradeParams = TestDataFactory.createTradeParams();
      
      const { averageTime, totalTime } = await PerformanceTestHelper.measureExecutionTime(
        () => riskManager.validateTrade(tradeParams),
        100
      );
      
      // Should complete within reasonable time
      expect(averageTime).toBeLessThan(10); // Less than 10ms per validation
      expect(totalTime).toBeLessThan(1000); // Less than 1 second total for 100 validations
    });

    it('should calculate risk exposure efficiently', async () => {
      // Mock the dependencies
      jest.spyOn(riskManager as any, 'getOpenPositions').mockResolvedValue(
        TestDataFactory.createMultiplePositions(5)
      );
      jest.spyOn(riskManager as any, 'getAccountInfo').mockResolvedValue(
        TestDataFactory.createAccountInfo()
      );
      
      const { averageTime, totalTime } = await PerformanceTestHelper.measureExecutionTime(
        () => riskManager.getRiskExposure(testUserId),
        100
      );
      
      // Should complete within reasonable time
      expect(averageTime).toBeLessThan(50); // Less than 50ms per calculation
      expect(totalTime).toBeLessThan(5000); // Less than 5 seconds total for 100 calculations
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent position size calculations', async () => {
      const promises = Array.from({ length: 100 }, () =>
        Promise.resolve(riskManager.calculatePositionSize(10000, 2, 20, 'EURUSD'))
      );
      
      const results = await Promise.all(promises);
      
      // All results should be valid
      results.forEach(result => {
        expect(result).toBeGreaterThanOrEqual(0.01);
        expect(result).toBeLessThanOrEqual(10.0);
      });
    });

    it('should handle concurrent trade validations', async () => {
      const tradeParams = TestDataFactory.createTradeParams();
      const promises = Array.from({ length: 50 }, () =>
        riskManager.validateTrade(tradeParams)
      );
      
      const results = await Promise.all(promises);
      
      // All results should be valid
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(typeof result.valid).toBe('boolean');
        expect(Array.isArray(result.errors)).toBe(true);
        expect(Array.isArray(result.warnings)).toBe(true);
      });
    });

    it('should handle concurrent risk exposure calculations', async () => {
      // Mock the dependencies
      jest.spyOn(riskManager as any, 'getOpenPositions').mockResolvedValue(
        TestDataFactory.createMultiplePositions(3)
      );
      jest.spyOn(riskManager as any, 'getAccountInfo').mockResolvedValue(
        TestDataFactory.createAccountInfo()
      );
      
      const promises = Array.from({ length: 20 }, () =>
        riskManager.getRiskExposure(testUserId)
      );
      
      const results = await Promise.all(promises);
      
      // All results should be valid
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(typeof result.balance).toBe('number');
        expect(typeof result.totalRiskExposure).toBe('number');
        expect(typeof result.limitsExceeded).toBe('boolean');
        expect(Array.isArray(result.violations)).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      jest.spyOn(riskManager as any, 'getOpenPositions').mockRejectedValue(
        new Error('Database connection failed')
      );
      
      await ErrorTestHelper.expectError(
        () => riskManager.getRiskExposure(testUserId),
        Error,
        'Database connection failed'
      );
    });

    it('should handle network errors gracefully', async () => {
      // Mock network error
      jest.spyOn(riskManager as any, 'closePosition').mockRejectedValue(
        new Error('Network timeout')
      );
      
      const positions = TestDataFactory.createMultiplePositions(1);
      jest.spyOn(riskManager as any, 'getOpenPositions').mockResolvedValue(positions);
      
      await ErrorTestHelper.expectError(
        () => riskManager.emergencyCloseAll(testUserId, 'Test emergency'),
        Error,
        'Network timeout'
      );
    });

    it('should handle invalid input gracefully', async () => {
      // Test with invalid trade parameters
      const invalidTradeParams = {
        symbol: '',
        type: 'INVALID',
        lotSize: -1,
        entryPrice: NaN,
        stopLoss: null,
        userId: ''
      };
      
      const result = await riskManager.validateTrade(invalidTradeParams as any);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Market Condition Scenarios', () => {
    it('should handle high volatility scenarios', async () => {
      // Mock high spread
      jest.spyOn(riskManager as any, 'getCurrentSpread').mockReturnValue(25);
      
      const tradeParams = TestDataFactory.createTradeParams();
      const result = await riskManager.validateTrade(tradeParams);
      
      expect(result.warnings.some(w => w.includes('High spread detected'))).toBe(true);
    });

    it('should handle low liquidity scenarios', async () => {
      // Mock low liquidity (wide spread, low volume)
      jest.spyOn(riskManager as any, 'getCurrentSpread').mockReturnValue(30);
      jest.spyOn(riskManager as any, 'getSymbolInfo').mockResolvedValue({
        volumeMax: 1.0,
        volumeMin: 0.01
      });
      
      const tradeParams = TestDataFactory.createTradeParams({
        lotSize: 2.0 // Request more than max volume
      });
      
      const result = await riskManager.validateTrade(tradeParams);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('exceeds maximum'))).toBe(true);
    });

    it('should handle news event scenarios', async () => {
      // Mock news event
      jest.spyOn(riskManager as any, 'isNewsEventTime').mockReturnValue(true);
      
      const tradeParams = TestDataFactory.createTradeParams();
      const result = await riskManager.validateTrade(tradeParams);
      
      expect(result.warnings.some(w => w.includes('High impact news event'))).toBe(true);
    });

    it('should handle weekend/holiday scenarios', async () => {
      // Mock closed market
      jest.spyOn(riskManager as any, 'isWithinTradingHours').mockReturnValue(false);
      
      const tradeParams = TestDataFactory.createTradeParams();
      const result = await riskManager.validateTrade(tradeParams);
      
      expect(result.warnings.some(w => w.includes('Market is closed'))).toBe(true);
    });
  });
});