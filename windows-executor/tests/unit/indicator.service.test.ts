/**
 * Unit Tests for Indicator Service
 */

import { IndicatorService, Bar } from '../../src/services/indicator.service';

describe('IndicatorService', () => {
  let indicatorService: IndicatorService;
  let sampleBars: Bar[];

  beforeEach(() => {
    indicatorService = new IndicatorService();
    
    // Generate sample bar data
    sampleBars = generateSampleBars(100);
  });

  describe('Moving Averages', () => {
    test('should calculate SMA correctly', () => {
      const result = indicatorService.calculateMA(sampleBars, 20);
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBe(sampleBars.length - 19);
    });

    test('should calculate EMA correctly', () => {
      const result = indicatorService.calculateMA(sampleBars, 20, 'EMA');
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    test('should return empty array for insufficient data', () => {
      const shortBars = sampleBars.slice(0, 5);
      const result = indicatorService.calculateMA(shortBars, 20);
      
      expect(result).toEqual([]);
    });
  });

  describe('RSI', () => {
    test('should calculate RSI correctly', () => {
      const result = indicatorService.calculateRSI(sampleBars, 14);
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      
      // RSI should be between 0 and 100
      result.forEach(rsi => {
        expect(rsi).toBeGreaterThanOrEqual(0);
        expect(rsi).toBeLessThanOrEqual(100);
      });
    });

    test('should handle overbought conditions', () => {
      const overboughtBars = generateTrendingBars(50, 'up');
      const result = indicatorService.calculateRSI(overboughtBars, 14);
      
      const lastRSI = result[result.length - 1];
      expect(lastRSI).toBeGreaterThan(50);
    });

    test('should handle oversold conditions', () => {
      const oversoldBars = generateTrendingBars(50, 'down');
      const result = indicatorService.calculateRSI(oversoldBars, 14);
      
      const lastRSI = result[result.length - 1];
      expect(lastRSI).toBeLessThan(50);
    });
  });

  describe('MACD', () => {
    test('should calculate MACD correctly', () => {
      const result = indicatorService.calculateMACD(sampleBars, 12, 26, 9);
      
      expect(result.macd).toBeDefined();
      expect(result.signal).toBeDefined();
      expect(result.histogram).toBeDefined();
      
      expect(result.macd.length).toBeGreaterThan(0);
      expect(result.signal.length).toBeGreaterThan(0);
      expect(result.histogram.length).toBeGreaterThan(0);
    });
  });

  describe('ATR', () => {
    test('should calculate ATR correctly', () => {
      const result = indicatorService.calculateATR(sampleBars, 14);
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      
      // ATR should be positive
      result.forEach(atr => {
        expect(atr).toBeGreaterThan(0);
      });
    });
  });

  describe('Bollinger Bands', () => {
    test('should calculate Bollinger Bands correctly', () => {
      const result = indicatorService.calculateBollingerBands(sampleBars, 20, 2);
      
      expect(result.upper).toBeDefined();
      expect(result.middle).toBeDefined();
      expect(result.lower).toBeDefined();
      
      expect(result.upper.length).toBe(result.middle.length);
      expect(result.middle.length).toBe(result.lower.length);
      
      // Upper should be above middle, middle above lower
      for (let i = 0; i < result.upper.length; i++) {
        expect(result.upper[i]).toBeGreaterThan(result.middle[i]);
        expect(result.middle[i]).toBeGreaterThan(result.lower[i]);
      }
    });
  });

  describe('Stochastic', () => {
    test('should calculate Stochastic correctly', () => {
      const result = indicatorService.calculateStochastic(sampleBars, 14, 3, 3);
      
      expect(result.k).toBeDefined();
      expect(result.d).toBeDefined();
      
      // Values should be between 0 and 100
      result.k.forEach(k => {
        expect(k).toBeGreaterThanOrEqual(0);
        expect(k).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('ADX', () => {
    test('should calculate ADX correctly', () => {
      const result = indicatorService.calculateADX(sampleBars, 14);
      
      expect(result.adx).toBeDefined();
      expect(result.plusDI).toBeDefined();
      expect(result.minusDI).toBeDefined();
      
      // ADX should be between 0 and 100
      result.adx.forEach(adx => {
        expect(adx).toBeGreaterThanOrEqual(0);
        expect(adx).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('CCI', () => {
    test('should calculate CCI correctly', () => {
      const result = indicatorService.calculateCCI(sampleBars, 20);
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Williams %R', () => {
    test('should calculate Williams %R correctly', () => {
      const result = indicatorService.calculateWilliamsR(sampleBars, 14);
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      
      // Williams %R should be between -100 and 0
      result.forEach(wr => {
        expect(wr).toBeLessThanOrEqual(0);
        expect(wr).toBeGreaterThanOrEqual(-100);
      });
    });
  });

  describe('VWAP', () => {
    test('should calculate VWAP correctly', () => {
      const result = indicatorService.calculateVWAP(sampleBars);
      
      expect(result).toBeDefined();
      expect(result.length).toBe(sampleBars.length);
      
      // VWAP should be positive
      result.forEach(vwap => {
        expect(vwap).toBeGreaterThan(0);
      });
    });
  });

  describe('OBV', () => {
    test('should calculate OBV correctly', () => {
      const result = indicatorService.calculateOBV(sampleBars);
      
      expect(result).toBeDefined();
      expect(result.length).toBe(sampleBars.length);
    });
  });
});

// Helper functions

function generateSampleBars(count: number): Bar[] {
  const bars: Bar[] = [];
  let price = 1.1000;
  
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 0.001;
    price += change;
    
    const open = price;
    const high = price + Math.random() * 0.0005;
    const low = price - Math.random() * 0.0005;
    const close = price + (Math.random() - 0.5) * 0.0003;
    
    bars.push({
      time: new Date(Date.now() + i * 60000),
      open,
      high,
      low,
      close,
      volume: Math.floor(Math.random() * 1000) + 100
    });
  }
  
  return bars;
}

function generateTrendingBars(count: number, direction: 'up' | 'down'): Bar[] {
  const bars: Bar[] = [];
  let price = 1.1000;
  const trend = direction === 'up' ? 0.0002 : -0.0002;
  
  for (let i = 0; i < count; i++) {
    price += trend;
    
    const open = price;
    const high = price + Math.random() * 0.0003;
    const low = price - Math.random() * 0.0003;
    const close = price + trend;
    
    bars.push({
      time: new Date(Date.now() + i * 60000),
      open,
      high,
      low,
      close,
      volume: Math.floor(Math.random() * 1000) + 100
    });
  }
  
  return bars;
}
