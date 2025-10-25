/**
 * Unit Tests for Position Sizing Service
 */

import { PositionSizingService, AccountInfo, PriceInfo } from '../../src/services/position-sizing.service';
import { PositionSizingConfig } from '../../src/types/strategy.types';
import { Bar } from '../../src/services/indicator.service';

describe('PositionSizingService', () => {
  let positionSizingService: PositionSizingService;
  let accountInfo: AccountInfo;
  let priceInfo: PriceInfo;

  beforeEach(() => {
    positionSizingService = new PositionSizingService();
    
    accountInfo = {
      balance: 10000,
      equity: 10000,
      currency: 'USD'
    };

    priceInfo = {
      symbol: 'EURUSD',
      currentPrice: 1.1000,
      stopLoss: 1.0950,
      bars: generateSampleBars(100)
    };
  });

  describe('Fixed Lot Sizing', () => {
    test('should return fixed lot size', async () => {
      const config: PositionSizingConfig = {
        method: 'fixed_lot',
        fixedLot: 0.5
      };

      const result = await positionSizingService.calculatePositionSize(
        config,
        accountInfo,
        priceInfo
      );

      expect(result.recommendedSize).toBe(0.5);
      expect(result.method).toBe('fixed_lot');
    });
  });

  describe('Percentage Risk Sizing', () => {
    test('should calculate size based on risk percentage', async () => {
      const config: PositionSizingConfig = {
        method: 'percentage_risk',
        riskPercentage: 2
      };

      const result = await positionSizingService.calculatePositionSize(
        config,
        accountInfo,
        priceInfo
      );

      expect(result.recommendedSize).toBeGreaterThan(0);
      expect(result.riskPercentage).toBeCloseTo(2, 1);
      expect(result.method).toBe('percentage_risk');
    });

    test('should adjust risk amount based on account balance', async () => {
      const config: PositionSizingConfig = {
        method: 'percentage_risk',
        riskPercentage: 1
      };

      const largeAccount = { ...accountInfo, balance: 50000 };
      
      const result = await positionSizingService.calculatePositionSize(
        config,
        largeAccount,
        priceInfo
      );

      // Larger account should have larger position size
      expect(result.recommendedSize).toBeGreaterThan(0.5);
    });
  });

  describe('ATR-Based Sizing', () => {
    test('should calculate size based on ATR', async () => {
      const config: PositionSizingConfig = {
        method: 'atr_based',
        atrBased: {
          atrMultiplier: 2,
          riskPercentage: 1.5,
          volatilityAdjustment: true
        }
      };

      const result = await positionSizingService.calculatePositionSize(
        config,
        accountInfo,
        priceInfo
      );

      expect(result.recommendedSize).toBeGreaterThan(0);
      expect(result.method).toBe('atr_based');
      expect(result.reasoning).toContain('ATR-based position sizing');
    });

    test('should reduce size in high volatility', async () => {
      const config: PositionSizingConfig = {
        method: 'atr_based',
        atrBased: {
          atrMultiplier: 2,
          riskPercentage: 2,
          volatilityAdjustment: true
        }
      };

      // High volatility bars
      const highVolBars = generateVolatileBars(100, 0.01);
      const highVolPrice: PriceInfo = {
        ...priceInfo,
        bars: highVolBars
      };

      const result = await positionSizingService.calculatePositionSize(
        config,
        accountInfo,
        highVolPrice
      );

      expect(result.recommendedSize).toBeGreaterThan(0);
      // Size should be adjusted for volatility
    });
  });

  describe('Kelly Criterion', () => {
    test('should calculate size using Kelly formula', async () => {
      const config: PositionSizingConfig = {
        method: 'kelly_criterion',
        kellyCriterion: {
          winRate: 0.55,
          avgWin: 150,
          avgLoss: 100,
          kellyFraction: 0.5,
          maxPositionSize: 2.0
        }
      };

      const result = await positionSizingService.calculatePositionSize(
        config,
        accountInfo,
        priceInfo
      );

      expect(result.recommendedSize).toBeGreaterThan(0);
      expect(result.recommendedSize).toBeLessThanOrEqual(2.0);
      expect(result.method).toBe('kelly_criterion');
    });

    test('should limit position size to maximum', async () => {
      const config: PositionSizingConfig = {
        method: 'kelly_criterion',
        kellyCriterion: {
          winRate: 0.7,
          avgWin: 200,
          avgLoss: 50,
          kellyFraction: 1.0,
          maxPositionSize: 1.0
        }
      };

      const result = await positionSizingService.calculatePositionSize(
        config,
        accountInfo,
        priceInfo
      );

      expect(result.recommendedSize).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Constraints', () => {
    test('should apply minimum position size constraint', async () => {
      const config: PositionSizingConfig = {
        method: 'fixed_lot',
        fixedLot: 0.005,
        minPositionSize: 0.01
      };

      const result = await positionSizingService.calculatePositionSize(
        config,
        accountInfo,
        priceInfo
      );

      expect(result.recommendedSize).toBe(0.01);
      expect(result.constraints.applied).toBe(true);
    });

    test('should apply maximum position size constraint', async () => {
      const config: PositionSizingConfig = {
        method: 'fixed_lot',
        fixedLot: 5.0,
        maxPositionSize: 2.0
      };

      const result = await positionSizingService.calculatePositionSize(
        config,
        accountInfo,
        priceInfo
      );

      expect(result.recommendedSize).toBe(2.0);
      expect(result.constraints.applied).toBe(true);
    });
  });

  describe('Drawdown Adjustment', () => {
    test('should reduce size during drawdown', () => {
      const baseSize = 1.0;
      const currentDrawdown = 8;
      const maxDrawdown = 10;

      const adjustedSize = positionSizingService.adjustForDrawdown(
        baseSize,
        currentDrawdown,
        maxDrawdown
      );

      expect(adjustedSize).toBeLessThan(baseSize);
      expect(adjustedSize).toBe(0.75);
    });

    test('should maintain size with no drawdown', () => {
      const baseSize = 1.0;
      const currentDrawdown = 0;
      const maxDrawdown = 10;

      const adjustedSize = positionSizingService.adjustForDrawdown(
        baseSize,
        currentDrawdown,
        maxDrawdown
      );

      expect(adjustedSize).toBe(baseSize);
    });
  });

  describe('Performance Adjustment', () => {
    test('should increase size after wins', () => {
      const baseSize = 1.0;
      const recentWins = 7;
      const recentLosses = 3;

      const adjustedSize = positionSizingService.adjustForPerformance(
        baseSize,
        recentWins,
        recentLosses
      );

      expect(adjustedSize).toBeGreaterThan(baseSize);
      expect(adjustedSize).toBe(1.2);
    });

    test('should reduce size after losses', () => {
      const baseSize = 1.0;
      const recentWins = 2;
      const recentLosses = 8;

      const adjustedSize = positionSizingService.adjustForPerformance(
        baseSize,
        recentWins,
        recentLosses
      );

      expect(adjustedSize).toBeLessThan(baseSize);
      expect(adjustedSize).toBe(0.7);
    });
  });
});

// Helper functions
function generateSampleBars(count: number): Bar[] {
  const bars: Bar[] = [];
  let price = 1.1000;
  
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 0.0005;
    price += change;
    
    bars.push({
      time: new Date(Date.now() + i * 60000),
      open: price,
      high: price + Math.random() * 0.0002,
      low: price - Math.random() * 0.0002,
      close: price + change,
      volume: Math.floor(Math.random() * 1000) + 100
    });
  }
  
  return bars;
}

function generateVolatileBars(count: number, volatility: number): Bar[] {
  const bars: Bar[] = [];
  let price = 1.1000;
  
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * volatility;
    price += change;
    
    bars.push({
      time: new Date(Date.now() + i * 60000),
      open: price,
      high: price + Math.random() * volatility,
      low: price - Math.random() * volatility,
      close: price + change,
      volume: Math.floor(Math.random() * 1000) + 100
    });
  }
  
  return bars;
}
