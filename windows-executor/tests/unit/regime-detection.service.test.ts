/**
 * Unit Tests for Regime Detection Service
 */

import { RegimeDetectionService } from '../../src/services/regime-detection.service';
import { MarketRegime } from '../../src/types/strategy.types';
import { Bar } from '../../src/services/indicator.service';

describe('RegimeDetectionService', () => {
  let regimeService: RegimeDetectionService;

  beforeEach(() => {
    regimeService = new RegimeDetectionService();
  });

  describe('Bullish Trending Detection', () => {
    test('should detect bullish trending market', async () => {
      const trendingBars = generateTrendingBars(200, 'up', 0.0005);
      
      const result = await regimeService.detectRegime(trendingBars);

      expect(result.regime).toBe(MarketRegime.BULLISH_TRENDING);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.indicators.adx).toBeGreaterThan(25);
    });
  });

  describe('Bearish Trending Detection', () => {
    test('should detect bearish trending market', async () => {
      const trendingBars = generateTrendingBars(200, 'down', 0.0005);
      
      const result = await regimeService.detectRegime(trendingBars);

      expect(result.regime).toBe(MarketRegime.BEARISH_TRENDING);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.indicators.adx).toBeGreaterThan(25);
    });
  });

  describe('Ranging Detection', () => {
    test('should detect ranging market', async () => {
      const rangingBars = generateRangingBars(200, 1.1000, 0.0020);
      
      const result = await regimeService.detectRegime(rangingBars);

      expect(result.regime).toBe(MarketRegime.RANGING);
      expect(result.indicators.adx).toBeLessThan(25);
    });
  });

  describe('High Volatility Detection', () => {
    test('should detect high volatility regime', async () => {
      const volatileBars = generateVolatileBars(200, 0.01);
      
      const result = await regimeService.detectRegime(volatileBars);

      expect(result.regime).toBe(MarketRegime.HIGH_VOLATILITY);
      expect(result.strength).toBeGreaterThan(1);
    });
  });

  describe('Low Volatility Detection', () => {
    test('should detect low volatility regime', async () => {
      const calmBars = generateVolatileBars(200, 0.0001);
      
      const result = await regimeService.detectRegime(calmBars);

      expect(result.regime).toBe(MarketRegime.LOW_VOLATILITY);
    });
  });

  describe('Position Size Multipliers', () => {
    test('should return higher multiplier for trending markets', () => {
      const multiplier = regimeService.getPositionSizeMultiplier(MarketRegime.BULLISH_TRENDING);
      
      expect(multiplier).toBe(1.5);
    });

    test('should return lower multiplier for high volatility', () => {
      const multiplier = regimeService.getPositionSizeMultiplier(MarketRegime.HIGH_VOLATILITY);
      
      expect(multiplier).toBe(0.5);
    });

    test('should return reduced multiplier for ranging', () => {
      const multiplier = regimeService.getPositionSizeMultiplier(MarketRegime.RANGING);
      
      expect(multiplier).toBe(0.7);
    });
  });

  describe('Take Profit Multipliers', () => {
    test('should return higher TP for trending markets', () => {
      const multiplier = regimeService.getTakeProfitMultiplier(MarketRegime.BULLISH_TRENDING);
      
      expect(multiplier).toBe(2.0);
    });

    test('should return lower TP for ranging markets', () => {
      const multiplier = regimeService.getTakeProfitMultiplier(MarketRegime.RANGING);
      
      expect(multiplier).toBe(0.5);
    });
  });

  describe('Stop Loss Multipliers', () => {
    test('should return wider SL for high volatility', () => {
      const multiplier = regimeService.getStopLossMultiplier(MarketRegime.HIGH_VOLATILITY);
      
      expect(multiplier).toBe(1.5);
    });

    test('should return tighter SL for low volatility', () => {
      const multiplier = regimeService.getStopLossMultiplier(MarketRegime.LOW_VOLATILITY);
      
      expect(multiplier).toBe(0.7);
    });
  });

  describe('Regime Suitability', () => {
    test('should allow trading in allowed regimes', () => {
      const regimeResult = {
        regime: MarketRegime.BULLISH_TRENDING,
        confidence: 0.8,
        strength: 0.7,
        indicators: { adx: 30, atr: 0.0005, pricePosition: 2 },
        recommendations: []
      };

      const suitable = regimeService.isSuitableForTrading(
        regimeResult,
        [MarketRegime.BULLISH_TRENDING, MarketRegime.BEARISH_TRENDING]
      );

      expect(suitable).toBe(true);
    });

    test('should block trading in disallowed regimes', () => {
      const regimeResult = {
        regime: MarketRegime.RANGING,
        confidence: 0.8,
        strength: 0.5,
        indicators: { adx: 15, atr: 0.0003, pricePosition: 0 },
        recommendations: []
      };

      const suitable = regimeService.isSuitableForTrading(
        regimeResult,
        [MarketRegime.BULLISH_TRENDING]
      );

      expect(suitable).toBe(false);
    });
  });
});

// Helper functions
function generateTrendingBars(count: number, direction: 'up' | 'down', strength: number): Bar[] {
  const bars: Bar[] = [];
  let price = 1.1000;
  const trend = direction === 'up' ? strength : -strength;

  for (let i = 0; i < count; i++) {
    price += trend + (Math.random() - 0.5) * 0.0001;

    bars.push({
      time: new Date(Date.now() + i * 60000),
      open: price - trend / 2,
      high: price + Math.abs(trend),
      low: price - Math.abs(trend),
      close: price,
      volume: Math.floor(Math.random() * 1000) + 100
    });
  }

  return bars;
}

function generateRangingBars(count: number, centerPrice: number, range: number): Bar[] {
  const bars: Bar[] = [];

  for (let i = 0; i < count; i++) {
    const price = centerPrice + (Math.random() - 0.5) * range;

    bars.push({
      time: new Date(Date.now() + i * 60000),
      open: price,
      high: price + Math.random() * range * 0.2,
      low: price - Math.random() * range * 0.2,
      close: price + (Math.random() - 0.5) * range * 0.1,
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
