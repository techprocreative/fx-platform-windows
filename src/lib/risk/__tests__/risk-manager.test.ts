/**
 * Unit Tests for RiskManager
 * 
 * This file contains comprehensive unit tests for the RiskManager class,
 * covering all methods and edge cases to ensure robust risk management.
 */

import { RiskManager } from '../risk-manager';
import { 
  RiskParameters, 
  TradeParams, 
  Position, 
  AccountInfo, 
  RiskViolation 
} from '../types';

// Mock the logger to avoid console output during tests
jest.mock('../../monitoring/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }
}));

describe('RiskManager', () => {
  let riskManager: RiskManager;
  const testUserId = 'test-user-123';
  
  beforeEach(() => {
    riskManager = new RiskManager();
    jest.clearAllMocks();
  });

  describe('calculatePositionSize', () => {
    it('should calculate correct position size based on risk percentage and stop loss', () => {
      const balance = 10000;
      const riskPercent = 2; // 2%
      const stopLossPips = 20;
      const symbol = 'EURUSD';
      
      const positionSize = riskManager.calculatePositionSize(balance, riskPercent, stopLossPips, symbol);
      
      // With 2% risk on $10,000 = $200 risk
      // With 20 pips stop loss and standard lot (100,000 units), each pip is worth $10
      // So position size should be $200 / (20 * $10) = 1 lot
      expect(positionSize).toBe(1.0);
    });

    it('should round position size to valid lot size', () => {
      const balance = 10000;
      const riskPercent = 2;
      const stopLossPips = 15; // Will result in uneven lot size
      const symbol = 'EURUSD';
      
      const positionSize = riskManager.calculatePositionSize(balance, riskPercent, stopLossPips, symbol);
      
      // Should be rounded to 2 decimal places (standard lot step)
      expect(positionSize).toBeCloseTo(1.33, 2);
    });

    it('should not exceed maximum lot size', () => {
      const balance = 100000;
      const riskPercent = 10;
      const stopLossPips = 5;
      const symbol = 'EURUSD';
      
      const positionSize = riskManager.calculatePositionSize(balance, riskPercent, stopLossPips, symbol);
      
      // Should be capped at max lot size (100)
      expect(positionSize).toBeLessThanOrEqual(100);
    });

    it('should not be below minimum lot size', () => {
      const balance = 100;
      const riskPercent = 1;
      const stopLossPips = 50;
      const symbol = 'EURUSD';
      
      const positionSize = riskManager.calculatePositionSize(balance, riskPercent, stopLossPips, symbol);
      
      // Should be at least min lot size (0.01)
      expect(positionSize).toBeGreaterThanOrEqual(0.01);
    });

    it('should throw error for invalid balance', () => {
      expect(() => {
        riskManager.calculatePositionSize(0, 2, 20, 'EURUSD');
      }).toThrow('Balance must be greater than 0');
    });

    it('should throw error for invalid risk percent', () => {
      expect(() => {
        riskManager.calculatePositionSize(10000, 0, 20, 'EURUSD');
      }).toThrow('Risk percent must be between 0 and 100');
      
      expect(() => {
        riskManager.calculatePositionSize(10000, 101, 20, 'EURUSD');
      }).toThrow('Risk percent must be between 0 and 100');
    });

    it('should throw error for invalid stop loss', () => {
      expect(() => {
        riskManager.calculatePositionSize(10000, 2, 0, 'EURUSD');
      }).toThrow('Stop loss pips must be greater than 0');
    });
  });

  describe('setRiskParameters and getRiskParameters', () => {
    it('should set and get custom risk parameters', async () => {
      const customParams: Partial<RiskParameters> = {
        maxRiskPerTrade: 3.0,
        maxDailyLoss: 8.0,
        maxPositions: 10
      };
      
      await riskManager.setRiskParameters(testUserId, customParams);
      const params = await (riskManager as any).getRiskParameters(testUserId);
      
      expect(params.maxRiskPerTrade).toBe(3.0);
      expect(params.maxDailyLoss).toBe(8.0);
      expect(params.maxPositions).toBe(10);
      // Unchanged parameters should remain at default values
      expect(params.maxDrawdown).toBe(20.0);
    });

    it('should use default parameters when none are set', async () => {
      const params = await (riskManager as any).getRiskParameters(testUserId);
      
      expect(params.maxRiskPerTrade).toBe(2.0);
      expect(params.maxDailyLoss).toBe(6.0);
      expect(params.maxDrawdown).toBe(20.0);
      expect(params.maxPositions).toBe(5);
      expect(params.maxLeverage).toBe(100);
      expect(params.minStopLossDistance).toBe(10);
      expect(params.maxLotSize).toBe(10.0);
    });
  });

  describe('validateTrade', () => {
    const validTradeParams: TradeParams = {
      symbol: 'EURUSD',
      type: 'BUY',
      lotSize: 0.1, // Smaller lot size to keep risk within limits
      entryPrice: 1.1000,
      stopLoss: 1.0980, // 20 pips stop loss
      takeProfit: 1.1020,
      userId: testUserId
    };

    it('should validate a correct trade', async () => {
      const result = await riskManager.validateTrade(validTradeParams);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject trade with lot size below minimum', async () => {
      const invalidParams = { ...validTradeParams, lotSize: 0.001 };
      
      const result = await riskManager.validateTrade(invalidParams);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Lot size 0.001 is below minimum 0.01');
    });

    it('should reject trade with lot size above maximum', async () => {
      const invalidParams = { ...validTradeParams, lotSize: 200 };
      
      const result = await riskManager.validateTrade(invalidParams);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('exceeds maximum'))).toBe(true);
    });

    it('should reject trade with stop loss too close', async () => {
      const invalidParams = { ...validTradeParams, stopLoss: 1.0995 }; // Only 5 pips away
      
      const result = await riskManager.validateTrade(invalidParams);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Stop loss distance 5.00 pips is below minimum 10 pips');
    });

    it('should reject trade with excessive risk', async () => {
      const highRiskParams = { ...validTradeParams, lotSize: 5.0 }; // High risk position
      
      const result = await riskManager.validateTrade(highRiskParams);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('exceeds maximum'))).toBe(true);
    });

    it('should suggest adjusted lot size when risk is too high', async () => {
      const highRiskParams = { ...validTradeParams, lotSize: 5.0 };
      
      const result = await riskManager.validateTrade(highRiskParams);
      
      expect(result.valid).toBe(false);
      expect(result.adjustedParams).toBeDefined();
      expect(result.adjustedParams!.lotSize).toBeLessThan(5.0);
      expect(result.warnings.some(w => w.includes('Suggested lot size'))).toBe(true);
    });

    it('should add warning for high spread', async () => {
      // Mock high spread
      jest.spyOn(riskManager as any, 'getCurrentSpread').mockReturnValue(25);
      
      const result = await riskManager.validateTrade(validTradeParams);
      
      expect(result.warnings.some(w => w.includes('High spread detected'))).toBe(true);
    });

    it('should add warning for outside trading hours', async () => {
      // Mock closed market
      jest.spyOn(riskManager as any, 'isWithinTradingHours').mockReturnValue(false);
      
      const result = await riskManager.validateTrade(validTradeParams);
      
      expect(result.warnings.some(w => w.includes('Market is closed'))).toBe(true);
    });
  });

  describe('canOpenPosition', () => {
    it('should allow opening position when within limits', async () => {
      // Mock no open positions and good account status
      jest.spyOn(riskManager as any, 'getOpenPositions').mockResolvedValue([]);
      jest.spyOn(riskManager as any, 'getAccountInfo').mockResolvedValue({
        balance: 10000,
        equity: 10000,
        margin: 0,
        freeMargin: 10000,
        marginLevel: 0,
        leverage: 100
      });
      
      const canOpen = await riskManager.canOpenPosition(testUserId);
      
      expect(canOpen).toBe(true);
    });

    it('should prevent opening position when max positions reached', async () => {
      // Mock max positions already open
      const positions: Position[] = Array(5).fill(null).map((_, i) => ({
        ticket: i + 1,
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 1.0,
        openPrice: 1.1000,
        currentPrice: 1.1050,
        profit: 50,
        swap: 0,
        openTime: new Date(),
        userId: testUserId
      }));
      
      jest.spyOn(riskManager as any, 'getOpenPositions').mockResolvedValue(positions);
      
      const canOpen = await riskManager.canOpenPosition(testUserId);
      
      expect(canOpen).toBe(false);
    });

    it('should prevent opening position when daily loss limit exceeded', async () => {
      // Mock positions with high daily loss
      const losingPosition: Position = {
        ticket: 1,
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 1.0,
        openPrice: 1.1000,
        currentPrice: 1.0800,
        profit: -700, // 7% loss on $10,000 account
        swap: 0,
        openTime: new Date(),
        userId: testUserId
      };
      
      jest.spyOn(riskManager as any, 'getOpenPositions').mockResolvedValue([losingPosition]);
      jest.spyOn(riskManager as any, 'getAccountInfo').mockResolvedValue({
        balance: 10000,
        equity: 9300,
        margin: 0,
        freeMargin: 9300,
        marginLevel: 0,
        leverage: 100
      });
      
      const canOpen = await riskManager.canOpenPosition(testUserId);
      
      expect(canOpen).toBe(false);
    });

    it('should prevent opening position when no available margin', async () => {
      // Mock account with no free margin
      jest.spyOn(riskManager as any, 'getOpenPositions').mockResolvedValue([]);
      jest.spyOn(riskManager as any, 'getAccountInfo').mockResolvedValue({
        balance: 10000,
        equity: 10000,
        margin: 10000,
        freeMargin: 0,
        marginLevel: 100,
        leverage: 100
      });
      
      const canOpen = await riskManager.canOpenPosition(testUserId);
      
      expect(canOpen).toBe(false);
    });
  });

  describe('getRiskExposure', () => {
    it('should calculate correct risk exposure with no positions', async () => {
      // Mock no open positions
      jest.spyOn(riskManager as any, 'getOpenPositions').mockResolvedValue([]);
      jest.spyOn(riskManager as any, 'getAccountInfo').mockResolvedValue({
        balance: 10000,
        equity: 10000,
        margin: 0,
        freeMargin: 10000,
        marginLevel: 0,
        leverage: 100
      });
      
      const exposure = await riskManager.getRiskExposure(testUserId);
      
      expect(exposure.balance).toBe(10000);
      expect(exposure.totalRiskExposure).toBe(0);
      expect(exposure.riskExposurePercent).toBe(0);
      expect(exposure.openPositions).toBe(0);
      expect(exposure.dailyLoss).toBe(0);
      expect(exposure.dailyLossPercent).toBe(0);
      expect(exposure.currentDrawdown).toBe(0);
      expect(exposure.drawdownPercent).toBe(0);
      expect(exposure.limitsExceeded).toBe(false);
      expect(exposure.violations).toHaveLength(0);
    });

    it('should calculate correct risk exposure with open positions', async () => {
      // Mock open positions
      const positions: Position[] = [
        {
          ticket: 1,
          symbol: 'EURUSD',
          type: 'BUY',
          lotSize: 1.0,
          openPrice: 1.1000,
          currentPrice: 1.1050,
          profit: 50,
          swap: 0,
          openTime: new Date(),
          userId: testUserId
        },
        {
          ticket: 2,
          symbol: 'GBPUSD',
          type: 'SELL',
          lotSize: 0.5,
          openPrice: 1.3000,
          currentPrice: 1.2950,
          profit: 25,
          swap: 0,
          openTime: new Date(),
          userId: testUserId
        }
      ];
      
      jest.spyOn(riskManager as any, 'getOpenPositions').mockResolvedValue(positions);
      jest.spyOn(riskManager as any, 'getAccountInfo').mockResolvedValue({
        balance: 10000,
        equity: 10075,
        margin: 500,
        freeMargin: 9575,
        marginLevel: 201.5,
        leverage: 100
      });
      
      const exposure = await riskManager.getRiskExposure(testUserId);
      
      expect(exposure.balance).toBe(10000);
      expect(exposure.totalRiskExposure).toBe(75); // 50 + 25
      expect(exposure.riskExposurePercent).toBe(0.75); // 75 / 10000 * 100
      expect(exposure.openPositions).toBe(2);
      expect(exposure.limitsExceeded).toBe(false);
    });

    it('should detect daily loss violation', async () => {
      // Mock losing position
      const losingPosition: Position = {
        ticket: 1,
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 1.0,
        openPrice: 1.1000,
        currentPrice: 1.0400, // 600 pip loss = $6000 loss
        profit: -6000,
        swap: 0,
        openTime: new Date(),
        userId: testUserId
      };
      
      jest.spyOn(riskManager as any, 'getOpenPositions').mockResolvedValue([losingPosition]);
      jest.spyOn(riskManager as any, 'getAccountInfo').mockResolvedValue({
        balance: 10000,
        equity: 4000,
        margin: 0,
        freeMargin: 4000,
        marginLevel: 0,
        leverage: 100
      });
      
      const exposure = await riskManager.getRiskExposure(testUserId);
      
      expect(exposure.dailyLoss).toBe(6000);
      expect(exposure.dailyLossPercent).toBe(60); // 6000 / 10000 * 100
      expect(exposure.limitsExceeded).toBe(true);
      expect(exposure.violations.some(v => v.type === 'MAX_DAILY_LOSS')).toBe(true);
    });

    it('should detect drawdown violation', async () => {
      // Mock account with high drawdown
      jest.spyOn(riskManager as any, 'getOpenPositions').mockResolvedValue([]);
      jest.spyOn(riskManager as any, 'getAccountInfo').mockResolvedValue({
        balance: 10000,
        equity: 7500, // 25% drawdown
        margin: 0,
        freeMargin: 7500,
        marginLevel: 0,
        leverage: 100
      });
      
      const exposure = await riskManager.getRiskExposure(testUserId);
      
      expect(exposure.currentDrawdown).toBe(2500); // 10000 - 7500
      expect(exposure.drawdownPercent).toBe(25); // 2500 / 10000 * 100
      expect(exposure.limitsExceeded).toBe(true);
      expect(exposure.violations.some(v => v.type === 'MAX_DRAWDOWN')).toBe(true);
    });

    it('should detect max positions violation', async () => {
      // Mock maximum positions
      const positions: Position[] = Array(7).fill(null).map((_, i) => ({
        ticket: i + 1,
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 1.0,
        openPrice: 1.1000,
        currentPrice: 1.1050,
        profit: 50,
        swap: 0,
        openTime: new Date(),
        userId: testUserId
      }));
      
      jest.spyOn(riskManager as any, 'getOpenPositions').mockResolvedValue(positions);
      jest.spyOn(riskManager as any, 'getAccountInfo').mockResolvedValue({
        balance: 10000,
        equity: 10350,
        margin: 700,
        freeMargin: 9650,
        marginLevel: 147.86,
        leverage: 100
      });
      
      const exposure = await riskManager.getRiskExposure(testUserId);
      
      expect(exposure.openPositions).toBe(7);
      expect(exposure.limitsExceeded).toBe(true);
      expect(exposure.violations.some(v => v.type === 'MAX_POSITIONS')).toBe(true);
    });
  });

  describe('emergencyCloseAll', () => {
    it('should close all open positions successfully', async () => {
      // Mock open positions
      const positions: Position[] = [
        {
          ticket: 1,
          symbol: 'EURUSD',
          type: 'BUY',
          lotSize: 1.0,
          openPrice: 1.1000,
          currentPrice: 1.1050,
          profit: 50,
          swap: 0,
          openTime: new Date(),
          userId: testUserId
        },
        {
          ticket: 2,
          symbol: 'GBPUSD',
          type: 'SELL',
          lotSize: 0.5,
          openPrice: 1.3000,
          currentPrice: 1.2950,
          profit: 25,
          swap: 0,
          openTime: new Date(),
          userId: testUserId
        }
      ];
      
      jest.spyOn(riskManager as any, 'getOpenPositions').mockResolvedValue(positions);
      jest.spyOn(riskManager as any, 'closePosition').mockResolvedValue({
        success: true,
        ticket: 1,
        executionPrice: 1.1050,
        executedLotSize: 1.0,
        timestamp: new Date()
      });
      
      await expect(riskManager.emergencyCloseAll(testUserId, 'Test emergency close')).resolves.not.toThrow();
    });

    it('should handle no open positions gracefully', async () => {
      jest.spyOn(riskManager as any, 'getOpenPositions').mockResolvedValue([]);
      
      await expect(riskManager.emergencyCloseAll(testUserId, 'Test emergency close')).resolves.not.toThrow();
    });

    it('should handle partial failures gracefully', async () => {
      // Mock positions where one fails to close
      const positions: Position[] = [
        {
          ticket: 1,
          symbol: 'EURUSD',
          type: 'BUY',
          lotSize: 1.0,
          openPrice: 1.1000,
          currentPrice: 1.1050,
          profit: 50,
          swap: 0,
          openTime: new Date(),
          userId: testUserId
        },
        {
          ticket: 2,
          symbol: 'GBPUSD',
          type: 'SELL',
          lotSize: 0.5,
          openPrice: 1.3000,
          currentPrice: 1.2950,
          profit: 25,
          swap: 0,
          openTime: new Date(),
          userId: testUserId
        }
      ];
      
      jest.spyOn(riskManager as any, 'getOpenPositions').mockResolvedValue(positions);
      jest.spyOn(riskManager as any, 'closePosition')
        .mockResolvedValueOnce({
          success: true,
          ticket: 1,
          executionPrice: 1.1050,
          executedLotSize: 1.0,
          timestamp: new Date()
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Connection timeout',
          timestamp: new Date()
        });
      
      await expect(riskManager.emergencyCloseAll(testUserId, 'Test emergency close')).rejects.toThrow();
    });
  });
});