/**
 * Load Testing Suite
 * 
 * This file contains comprehensive load tests for the trading platform,
 * testing system performance under high load with multiple concurrent operations.
 * These tests use the test utilities and mock implementations.
 */

import { SafeTradeExecutor } from '../trading/safe-executor';
import { RiskManager } from '../risk/risk-manager';
import { MT5Connector } from '../brokers/mt5-connector';
import { OrderManager } from '../orders/order-manager';
import { 
  TradeSignal, 
  ExecutionResult 
} from '../trading/types';
import { 
  TestDataFactory, 
  TestEnvironmentHelper,
  PerformanceTestHelper,
  AsyncTestHelper
} from '../testing/test-utils';

// Mock dependencies
jest.mock('../monitoring/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }
}));

jest.mock('../database/transaction-manager', () => ({
  transactionManager: {
    executeInTransaction: jest.fn(),
  }
}));

jest.mock('../realtime/pusher-service', () => ({
  pusherService: {
    trigger: jest.fn(),
  }
}));

describe('Load Testing Suite', () => {
  let safeTradeExecutor: SafeTradeExecutor;
  let riskManager: RiskManager;
  let brokerConnector: MT5Connector;
  let orderManager: OrderManager;
  let testUserId: string;

  beforeEach(() => {
    // Initialize components
    safeTradeExecutor = new SafeTradeExecutor();
    riskManager = new RiskManager();
    brokerConnector = new MT5Connector();
    orderManager = new OrderManager(brokerConnector);
    
    // Enable mock mode for broker connector
    brokerConnector.enableMockMode();
    
    testUserId = 'test-user-123';
    
    // Clear all mocks
    jest.clearAllMocks();
    TestEnvironmentHelper.setupMockEnvironment();
  });

  afterEach(async () => {
    // Clean up connections
    if (brokerConnector.isConnected()) {
      await brokerConnector.disconnect();
    }
  });

  describe('High Volume Trade Execution', () => {
    it('should handle 100 concurrent trade executions', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create 100 trade signals
      const tradeSignals = Array.from({ length: 100 }, (_, i) =>
        TestDataFactory.createTradeSignal({
          userId: testUserId,
          symbol: i % 3 === 0 ? 'EURUSD' : i % 3 === 1 ? 'GBPUSD' : 'USDJPY',
          type: i % 2 === 0 ? 'BUY' : 'SELL',
          lotSize: 0.01,
          id: `signal-${i}`
        })
      );

      // 3. Measure execution time
      const startTime = Date.now();
      
      // 4. Execute all trades concurrently
      const executionPromises = tradeSignals.map(signal => 
        safeTradeExecutor.executeTrade(signal)
      );

      const executionResults = await Promise.all(executionPromises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / tradeSignals.length;

      // 5. Verify performance metrics
      expect(averageTime).toBeLessThan(100); // Less than 100ms per trade
      expect(totalTime).toBeLessThan(10000); // Less than 10 seconds total

      // 6. Verify all executions succeeded
      const successCount = executionResults.filter(r => r.success).length;
      expect(successCount).toBe(100); // All should succeed

      // 7. Verify all positions were opened
      const positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(100);

      // 8. Clean up positions
      for (const result of executionResults) {
        if (result.ticket) {
          await brokerConnector.closePosition(result.ticket);
        }
      }
    });

    it('should handle 500 concurrent trade executions', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create 500 trade signals
      const tradeSignals = Array.from({ length: 500 }, (_, i) =>
        TestDataFactory.createTradeSignal({
          userId: testUserId,
          symbol: i % 5 === 0 ? 'EURUSD' : 
                 i % 5 === 1 ? 'GBPUSD' : 
                 i % 5 === 2 ? 'USDJPY' : 
                 i % 5 === 3 ? 'AUDUSD' : 'USDCAD',
          type: i % 2 === 0 ? 'BUY' : 'SELL',
          lotSize: 0.01,
          id: `signal-${i}`
        })
      );

      // 3. Measure execution time
      const startTime = Date.now();
      
      // 4. Execute all trades concurrently
      const executionPromises = tradeSignals.map(signal => 
        safeTradeExecutor.executeTrade(signal)
      );

      const executionResults = await Promise.all(executionPromises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / tradeSignals.length;

      // 5. Verify performance metrics
      expect(averageTime).toBeLessThan(200); // Less than 200ms per trade
      expect(totalTime).toBeLessThan(30000); // Less than 30 seconds total

      // 6. Verify most executions succeeded
      const successCount = executionResults.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(450); // At least 90% success rate

      // 7. Clean up positions
      for (const result of executionResults) {
        if (result.ticket) {
          await brokerConnector.closePosition(result.ticket);
        }
      }
    });

    it('should handle sustained high volume over time', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Measure sustained performance over multiple batches
      const batchCount = 10;
      const batchSize = 50;
      const results = {
        totalTime: 0,
        totalTrades: 0,
        successCount: 0
      };

      for (let batch = 0; batch < batchCount; batch++) {
        // Create trade signals for this batch
        const tradeSignals = Array.from({ length: batchSize }, (_, i) =>
          TestDataFactory.createTradeSignal({
            userId: testUserId,
            symbol: 'EURUSD',
            type: 'BUY',
            lotSize: 0.01,
            id: `batch-${batch}-signal-${i}`
          })
        );

        // Measure execution time for this batch
        const startTime = Date.now();
        
        // Execute all trades in this batch concurrently
        const executionPromises = tradeSignals.map(signal => 
          safeTradeExecutor.executeTrade(signal)
        );

        const executionResults = await Promise.all(executionPromises);
        
        const endTime = Date.now();
        const batchTime = endTime - startTime;

        // Update metrics
        results.totalTime += batchTime;
        results.totalTrades += batchSize;
        results.successCount += executionResults.filter(r => r.success).length;

        // Brief pause between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Verify performance metrics
      const averageTime = results.totalTime / results.totalTrades;
      const successRate = (results.successCount / results.totalTrades) * 100;

      expect(averageTime).toBeLessThan(150); // Less than 150ms per trade
      expect(successRate).toBeGreaterThan(95); // At least 95% success rate
      expect(results.totalTime).toBeLessThan(60000); // Less than 1 minute total
    });
  });

  describe('Risk Management Under Load', () => {
    it('should handle 1000 concurrent risk validations', async () => {
      // 1. Create 1000 trade parameters
      const tradeParams = Array.from({ length: 1000 }, (_, i) =>
        TestDataFactory.createTradeParams({
          symbol: i % 3 === 0 ? 'EURUSD' : i % 3 === 1 ? 'GBPUSD' : 'USDJPY',
          type: i % 2 === 0 ? 'BUY' : 'SELL',
          lotSize: 0.01,
          userId: testUserId
        })
      );

      // 2. Measure execution time
      const startTime = Date.now();
      
      // 3. Validate all trades concurrently
      const validationPromises = tradeParams.map(params => 
        riskManager.validateTrade(params)
      );

      const validationResults = await Promise.all(validationPromises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / tradeParams.length;

      // 4. Verify performance metrics
      expect(averageTime).toBeLessThan(10); // Less than 10ms per validation
      expect(totalTime).toBeLessThan(5000); // Less than 5 seconds total

      // 5. Verify all validations succeeded
      const successCount = validationResults.filter(r => r.valid).length;
      expect(successCount).toBe(1000); // All should succeed
    });

    it('should handle 500 concurrent position size calculations', async () => {
      // 1. Create 500 calculation parameters
      const calcParams = Array.from({ length: 500 }, (_, i) => ({
        balance: 10000,
        riskPercent: 2,
        stopLossPips: 20,
        symbol: i % 3 === 0 ? 'EURUSD' : i % 3 === 1 ? 'GBPUSD' : 'USDJPY'
      }));

      // 2. Measure execution time
      const startTime = Date.now();
      
      // 3. Calculate all position sizes concurrently
      const calcPromises = calcParams.map(params => 
        riskManager.calculatePositionSize(
          params.balance,
          params.riskPercent,
          params.stopLossPips,
          params.symbol
        )
      );

      const calcResults = await Promise.all(calcPromises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / calcParams.length;

      // 4. Verify performance metrics
      expect(averageTime).toBeLessThan(5); // Less than 5ms per calculation
      expect(totalTime).toBeLessThan(1000); // Less than 1 second total

      // 5. Verify all calculations succeeded
      calcResults.forEach(result => {
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThanOrEqual(10);
      });
    });

    it('should handle 200 concurrent risk exposure calculations', async () => {
      // 1. Mock dependencies
      jest.spyOn(riskManager as any, 'getOpenPositions').mockResolvedValue(
        TestDataFactory.createMultiplePositions(5)
      );
      jest.spyOn(riskManager as any, 'getAccountInfo').mockResolvedValue(
        TestDataFactory.createAccountInfo()
      );

      // 2. Measure execution time
      const startTime = Date.now();
      
      // 3. Calculate risk exposure concurrently
      const exposurePromises = Array.from({ length: 200 }, () =>
        riskManager.getRiskExposure(testUserId)
      );

      const exposureResults = await Promise.all(exposurePromises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / exposureResults.length;

      // 4. Verify performance metrics
      expect(averageTime).toBeLessThan(50); // Less than 50ms per calculation
      expect(totalTime).toBeLessThan(5000); // Less than 5 seconds total

      // 5. Verify all calculations succeeded
      exposureResults.forEach(result => {
        expect(result).toBeDefined();
        expect(typeof result.balance).toBe('number');
        expect(typeof result.limitsExceeded).toBe('boolean');
      });
    });
  });

  describe('Broker Connection Under Load', () => {
    it('should handle 100 concurrent market data requests', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create 100 market data requests
      const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD'];
      const requests = Array.from({ length: 100 }, (_, i) => {
        const symbol = symbols[i % symbols.length];
        return {
          symbol,
          type: i % 2 === 0 ? 'price' : 'info'
        };
      });

      // 3. Measure execution time
      const startTime = Date.now();
      
      // 4. Execute all requests concurrently
      const requestPromises = requests.map(req => {
        if (req.type === 'price') {
          return brokerConnector.getCurrentPrice(req.symbol);
        } else {
          return brokerConnector.getSymbolInfo(req.symbol);
        }
      });

      const requestResults = await Promise.all(requestPromises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / requests.length;

      // 5. Verify performance metrics
      expect(averageTime).toBeLessThan(50); // Less than 50ms per request
      expect(totalTime).toBeLessThan(2000); // Less than 2 seconds total

      // 6. Verify all requests succeeded
      requestResults.forEach((result, index) => {
        expect(result).toBeDefined();
        if (requests[index].type === 'price') {
          const price = result as { bid: number; ask: number };
          expect(price.bid).toBeGreaterThan(0);
          expect(price.ask).toBeGreaterThan(price.bid);
        } else {
          const symbolInfo = result as { symbol: string; digits: number };
          expect(symbolInfo.symbol).toBeTruthy();
          expect(symbolInfo.digits).toBeGreaterThan(0);
        }
      });
    });

    it('should handle 50 concurrent position management operations', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Open 50 positions
      const openPromises = Array.from({ length: 50 }, (_, i) => {
        const order = TestDataFactory.createMarketOrder({
          symbol: i % 3 === 0 ? 'EURUSD' : i % 3 === 1 ? 'GBPUSD' : 'USDJPY',
          type: i % 2 === 0 ? 0 : 1, // BUY or SELL
          volume: 0.01
        });
        return brokerConnector.openPosition(order);
      });

      const openResults = await Promise.all(openPromises);
      
      // 3. Verify all positions were opened
      const successCount = openResults.filter(r => r.retcode === 0).length;
      expect(successCount).toBe(50);

      // 4. Get all open positions
      const positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(50);

      // 5. Close all positions concurrently
      const closePromises = positions.map(pos => 
        brokerConnector.closePosition(pos.ticket)
      );

      const closeResults = await Promise.all(closePromises);
      
      // 6. Verify all positions were closed
      const closeSuccessCount = closeResults.filter(r => r.retcode === 0).length;
      expect(closeSuccessCount).toBe(50);

      // 7. Verify no positions remain
      const finalPositions = await brokerConnector.getOpenPositions();
      expect(finalPositions).toHaveLength(0);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should maintain memory usage under high load', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Measure initial memory usage
      const initialMemory = process.memoryUsage().heapUsed;

      // 3. Execute 1000 trades in batches
      const batchSize = 100;
      const batchCount = 10;

      for (let batch = 0; batch < batchCount; batch++) {
        // Create trade signals for this batch
        const tradeSignals = Array.from({ length: batchSize }, (_, i) =>
          TestDataFactory.createTradeSignal({
            userId: testUserId,
            symbol: 'EURUSD',
            type: 'BUY',
            lotSize: 0.01,
            id: `memory-test-${batch}-${i}`
          })
        );

        // Execute all trades in this batch concurrently
        const executionPromises = tradeSignals.map(signal => 
          safeTradeExecutor.executeTrade(signal)
        );

        const executionResults = await Promise.all(executionPromises);

        // Close positions to free memory
        for (const result of executionResults) {
          if (result.ticket) {
            await brokerConnector.closePosition(result.ticket);
          }
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      // 4. Measure final memory usage
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // 5. Verify memory usage is reasonable
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
    });

    it('should handle resource cleanup under high load', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Execute 500 trades and clean up
      const tradeCount = 500;
      const batchSize = 50;

      for (let i = 0; i < tradeCount; i += batchSize) {
        // Create trade signals for this batch
        const tradeSignals = Array.from({ length: batchSize }, (_, j) =>
          TestDataFactory.createTradeSignal({
            userId: testUserId,
            symbol: 'EURUSD',
            type: 'BUY',
            lotSize: 0.01,
            id: `cleanup-test-${i}-${j}`
          })
        );

        // Execute all trades in this batch concurrently
        const executionPromises = tradeSignals.map(signal => 
          safeTradeExecutor.executeTrade(signal)
        );

        const executionResults = await Promise.all(executionPromises);

        // Close positions to free resources
        for (const result of executionResults) {
          if (result.ticket) {
            await brokerConnector.closePosition(result.ticket);
          }
        }
      }

      // 3. Verify no positions remain
      const positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(0);

      // 4. Verify system is still responsive
      const testSignal = TestDataFactory.createTradeSignal({
        userId: testUserId,
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 0.01
      });

      const testResult = await safeTradeExecutor.executeTrade(testSignal);
      expect(testResult.success).toBe(true);

      // Clean up test position
      if (testResult.ticket) {
        await brokerConnector.closePosition(testResult.ticket);
      }
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance benchmarks for trade execution', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Define performance benchmarks
      const benchmarks = {
        maxAverageTime: 100, // 100ms per trade
        maxTotalTime: 10000, // 10 seconds for 100 trades
        minSuccessRate: 99, // 99% success rate
        maxMemoryIncrease: 50 * 1024 * 1024 // 50MB memory increase
      };

      // 3. Measure initial memory
      const initialMemory = process.memoryUsage().heapUsed;

      // 4. Execute 100 trades
      const tradeSignals = Array.from({ length: 100 }, (_, i) =>
        TestDataFactory.createTradeSignal({
          userId: testUserId,
          symbol: 'EURUSD',
          type: 'BUY',
          lotSize: 0.01,
          id: `benchmark-${i}`
        })
      );

      const startTime = Date.now();
      
      const executionPromises = tradeSignals.map(signal => 
        safeTradeExecutor.executeTrade(signal)
      );

      const executionResults = await Promise.all(executionPromises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / tradeSignals.length;

      // 5. Measure final memory
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // 6. Calculate metrics
      const successCount = executionResults.filter(r => r.success).length;
      const successRate = (successCount / executionResults.length) * 100;

      // 7. Verify benchmarks
      expect(averageTime).toBeLessThan(benchmarks.maxAverageTime);
      expect(totalTime).toBeLessThan(benchmarks.maxTotalTime);
      expect(successRate).toBeGreaterThan(benchmarks.minSuccessRate);
      expect(memoryIncrease).toBeLessThan(benchmarks.maxMemoryIncrease);

      // 8. Clean up positions
      for (const result of executionResults) {
        if (result.ticket) {
          await brokerConnector.closePosition(result.ticket);
        }
      }
    });

    it('should meet performance benchmarks for risk management', async () => {
      // 1. Define performance benchmarks
      const benchmarks = {
        maxAverageValidationTime: 10, // 10ms per validation
        maxTotalValidationTime: 1000, // 1 second for 100 validations
        maxAverageCalcTime: 5, // 5ms per calculation
        maxTotalCalcTime: 500, // 500ms for 100 calculations
        minSuccessRate: 100 // 100% success rate
      };

      // 2. Test trade validation performance
      const tradeParams = Array.from({ length: 100 }, (_, i) =>
        TestDataFactory.createTradeParams({
          symbol: 'EURUSD',
          type: 'BUY',
          lotSize: 0.01,
          userId: testUserId
        })
      );

      const validationStartTime = Date.now();
      
      const validationPromises = tradeParams.map(params => 
        riskManager.validateTrade(params)
      );

      const validationResults = await Promise.all(validationPromises);
      
      const validationEndTime = Date.now();
      const validationTotalTime = validationEndTime - validationStartTime;
      const validationAverageTime = validationTotalTime / tradeParams.length;

      // 3. Test position size calculation performance
      const calcParams = Array.from({ length: 100 }, () => ({
        balance: 10000,
        riskPercent: 2,
        stopLossPips: 20,
        symbol: 'EURUSD'
      }));

      const calcStartTime = Date.now();
      
      const calcPromises = calcParams.map(params => 
        riskManager.calculatePositionSize(
          params.balance,
          params.riskPercent,
          params.stopLossPips,
          params.symbol
        )
      );

      const calcResults = await Promise.all(calcPromises);
      
      const calcEndTime = Date.now();
      const calcTotalTime = calcEndTime - calcStartTime;
      const calcAverageTime = calcTotalTime / calcParams.length;

      // 4. Calculate success rates
      const validationSuccessCount = validationResults.filter(r => r.valid).length;
      const validationSuccessRate = (validationSuccessCount / validationResults.length) * 100;

      // 5. Verify benchmarks
      expect(validationAverageTime).toBeLessThan(benchmarks.maxAverageValidationTime);
      expect(validationTotalTime).toBeLessThan(benchmarks.maxTotalValidationTime);
      expect(calcAverageTime).toBeLessThan(benchmarks.maxAverageCalcTime);
      expect(calcTotalTime).toBeLessThan(benchmarks.maxTotalCalcTime);
      expect(validationSuccessRate).toBe(benchmarks.minSuccessRate);
    });
  });
});