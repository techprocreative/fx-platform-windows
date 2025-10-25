/**
 * Integration Tests for Strategy Execution
 */

import { StrategyService } from '../../src/services/strategy.service';
import { IndicatorService } from '../../src/services/indicator.service';
import { MarketDataService } from '../../src/services/market-data.service';
import { Strategy, MarketRegime } from '../../src/types/strategy.types';

describe('Strategy Execution Integration Tests', () => {
  let strategyService: StrategyService;
  let indicatorService: IndicatorService;
  let marketDataService: MarketDataService;

  beforeEach(() => {
    indicatorService = new IndicatorService();
    marketDataService = new MarketDataService('tcp://localhost:5555');
    strategyService = new StrategyService(
      'http://localhost:3000',
      'test-executor',
      indicatorService,
      marketDataService
    );
  });

  afterEach(async () => {
    await strategyService.shutdown();
  });

  describe('Strategy Loading', () => {
    test('should load and validate strategy', async () => {
      const strategy = createTestStrategy();

      await expect(
        strategyService.loadStrategy(strategy)
      ).resolves.not.toThrow();

      const loaded = strategyService.getStrategy(strategy.id);
      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe(strategy.id);
    });

    test('should reject invalid strategy', async () => {
      const invalidStrategy = {
        id: 'test-invalid',
        name: 'Invalid Strategy'
        // Missing required fields
      } as any;

      await expect(
        strategyService.loadStrategy(invalidStrategy)
      ).rejects.toThrow();
    });
  });

  describe('Strategy Evaluation', () => {
    test('should evaluate strategy with position sizing', async () => {
      const strategy = createTestStrategy({
        positionSizing: {
          method: 'percentage_risk',
          riskPercentage: 2
        }
      });

      await strategyService.loadStrategy(strategy);

      const results = await strategyService.evaluateStrategy(strategy.id);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    test('should evaluate with regime detection', async () => {
      const strategy = createTestStrategy({
        regimeDetection: {
          enabled: true,
          adaptStrategy: true,
          regimeSettings: {
            [MarketRegime.BULLISH_TRENDING]: {
              positionSizeMultiplier: 1.5,
              takeProfitMultiplier: 2.0,
              enabled: true
            }
          }
        }
      });

      await strategyService.loadStrategy(strategy);

      const results = await strategyService.evaluateStrategy(strategy.id);

      expect(results).toBeDefined();
    });

    test('should evaluate with correlation filter', async () => {
      const strategy = createTestStrategy({
        correlationFilter: {
          enabled: true,
          maxCorrelation: 0.7,
          checkPairs: ['EURUSD', 'GBPUSD'],
          skipHighlyCorrelated: true
        }
      });

      await strategyService.loadStrategy(strategy);

      const results = await strategyService.evaluateStrategy(strategy.id);

      expect(results).toBeDefined();
    });
  });

  describe('Signal Generation', () => {
    test('should generate signal when conditions met', (done) => {
      const strategy = createTestStrategy();

      strategyService.on('signal:generated', (signal) => {
        expect(signal).toBeDefined();
        expect(signal.strategyId).toBe(strategy.id);
        expect(['BUY', 'SELL']).toContain(signal.type);
        done();
      });

      strategyService.loadStrategy(strategy);
      strategyService.startStrategy(strategy.id);
    });

    test('should include position size in signal', (done) => {
      const strategy = createTestStrategy({
        positionSizing: {
          method: 'fixed_lot',
          fixedLot: 0.5
        }
      });

      strategyService.on('signal:generated', (signal) => {
        expect(signal.volume).toBeGreaterThan(0);
        done();
      });

      strategyService.loadStrategy(strategy);
      strategyService.startStrategy(strategy.id);
    });
  });

  describe('Strategy Lifecycle', () => {
    test('should start and stop strategy', async () => {
      const strategy = createTestStrategy();

      await strategyService.loadStrategy(strategy);
      await strategyService.startStrategy(strategy.id);

      const state = strategyService.getStrategyState(strategy.id);
      expect(state?.status).toBe('running');

      await strategyService.stopStrategy(strategy.id);

      const stoppedState = strategyService.getStrategyState(strategy.id);
      expect(stoppedState?.status).toBe('stopped');
    });

    test('should handle multiple strategies', async () => {
      const strategy1 = createTestStrategy({ id: 'test-1', name: 'Strategy 1' });
      const strategy2 = createTestStrategy({ id: 'test-2', name: 'Strategy 2' });

      await strategyService.loadStrategy(strategy1);
      await strategyService.loadStrategy(strategy2);

      const strategies = strategyService.getStrategies();
      expect(strategies.length).toBe(2);
    });
  });

  describe('Performance', () => {
    test('should evaluate multiple symbols efficiently', async () => {
      const strategy = createTestStrategy({
        symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD']
      });

      await strategyService.loadStrategy(strategy);

      const startTime = Date.now();
      await strategyService.evaluateStrategy(strategy.id);
      const duration = Date.now() - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds
    });
  });

  describe('Error Handling', () => {
    test('should handle evaluation errors gracefully', async () => {
      const strategy = createTestStrategy({
        symbols: ['INVALID_SYMBOL']
      });

      await strategyService.loadStrategy(strategy);

      await expect(
        strategyService.evaluateStrategy(strategy.id)
      ).resolves.not.toThrow();

      const state = strategyService.getStrategyState(strategy.id);
      expect(state?.errorCount).toBeGreaterThan(0);
    });
  });
});

// Helper functions

function createTestStrategy(overrides?: Partial<Strategy>): Strategy {
  return {
    id: overrides?.id || 'test-strategy-1',
    name: overrides?.name || 'Test Strategy',
    description: 'Integration test strategy',
    version: '1.0.0',
    status: 'active',
    symbols: overrides?.symbols || ['EURUSD'],
    timeframe: 'M15',
    maxPositions: 3,
    positionSize: 0.1,
    riskPercent: 2,
    entryConditions: [
      {
        id: 'cond-1',
        type: 'indicator',
        indicator: 'RSI',
        params: { period: 14 },
        comparison: 'less_than',
        value: 30,
        enabled: true
      }
    ],
    entryLogic: 'AND',
    exitConditions: [
      {
        id: 'cond-2',
        type: 'indicator',
        indicator: 'RSI',
        params: { period: 14 },
        comparison: 'greater_than',
        value: 70,
        enabled: true
      }
    ],
    exitLogic: 'OR',
    stopLoss: {
      type: 'fixed',
      value: 50
    },
    takeProfit: {
      type: 'fixed',
      value: 100
    },
    filters: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'test-user',
    ...overrides
  } as Strategy;
}
