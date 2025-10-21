import { getPipConfig } from '../engine';

describe('Pip Conversion Logic', () => {
  describe('getPipConfig', () => {
    it('should return correct configuration for EURUSD', () => {
      const config = getPipConfig('EURUSD');
      expect(config).toEqual({
        pipMultiplier: 0.0001,
        minPips: 20,
        maxPips: 50,
      });
    });

    it('should return correct configuration for USDJPY', () => {
      const config = getPipConfig('USDJPY');
      expect(config).toEqual({
        pipMultiplier: 0.01,
        minPips: 20,
        maxPips: 50,
      });
    });

    it('should return correct configuration for XAUUSD', () => {
      const config = getPipConfig('XAUUSD');
      expect(config).toEqual({
        pipMultiplier: 0.1,
        minPips: 30,
        maxPips: 100,
      });
    });

    it('should return correct configuration for BTCUSD', () => {
      const config = getPipConfig('BTCUSD');
      expect(config).toEqual({
        pipMultiplier: 1,
        minPips: 100,
        maxPips: 500,
      });
    });

    it('should return correct configuration for US30', () => {
      const config = getPipConfig('US30');
      expect(config).toEqual({
        pipMultiplier: 1,
        minPips: 50,
        maxPips: 200,
      });
    });

    it('should return default configuration for unknown symbols', () => {
      const config = getPipConfig('UNKNOWN');
      expect(config).toEqual({
        pipMultiplier: 0.0001,
        minPips: 20,
        maxPips: 50,
      });
    });

    it('should handle case insensitive symbols', () => {
      const config1 = getPipConfig('eurusd');
      const config2 = getPipConfig('EURUSD');
      expect(config1).toEqual(config2);
    });

    it('should return consistent results for the same symbol', () => {
      const config1 = getPipConfig('GBPUSD');
      const config2 = getPipConfig('GBPUSD');
      expect(config1).toEqual(config2);
    });
  });

  describe('Pip Calculations', () => {
    it('should calculate profit correctly for EURUSD buy trade', () => {
      const config = getPipConfig('EURUSD');
      const openPrice = 1.1000;
      const closePrice = 1.1050;
      const size = 0.01;
      
      const priceDifference = closePrice - openPrice;
      const pips = priceDifference / config.pipMultiplier;
      const profit = pips * size * 10;
      
      expect(profit).toBe(50); // 50 pips * 0.01 * 10 = $5
    });

    it('should calculate profit correctly for USDJPY sell trade', () => {
      const config = getPipConfig('USDJPY');
      const openPrice = 150.00;
      const closePrice = 149.50;
      const size = 0.01;
      
      const priceDifference = openPrice - closePrice;
      const pips = priceDifference / config.pipMultiplier;
      const profit = pips * size * 10;
      
      expect(profit).toBe(50); // 50 pips * 0.01 * 10 = $5
    });

    it('should calculate profit correctly for XAUUSD', () => {
      const config = getPipConfig('XAUUSD');
      const openPrice = 2000.0;
      const closePrice = 2010.0;
      const size = 0.01;
      
      const priceDifference = closePrice - openPrice;
      const pips = priceDifference / config.pipMultiplier;
      const profit = pips * size * 10;
      
      expect(profit).toBe(100); // 100 pips * 0.01 * 10 = $10
    });

    it('should handle loss calculations correctly', () => {
      const config = getPipConfig('EURUSD');
      const openPrice = 1.1000;
      const closePrice = 1.0950; // Lower price = loss for buy trade
      const size = 0.01;
      
      const priceDifference = closePrice - openPrice;
      const pips = priceDifference / config.pipMultiplier;
      const profit = pips * size * 10;
      
      expect(profit).toBe(-50); // -50 pips * 0.01 * 10 = -$5
    });
  });
});