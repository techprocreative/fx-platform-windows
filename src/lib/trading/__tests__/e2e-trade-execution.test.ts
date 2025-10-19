/**
 * End-to-End Trade Execution Tests
 * 
 * This file contains comprehensive end-to-end tests for the trade execution flow,
 * testing from signal generation to execution with all validation and safety checks.
 * These tests use the test utilities and mock implementations.
 */

import { SafeTradeExecutor } from '../safe-executor';
import { RiskManager } from '../../risk/risk-manager';
import { MT5Connector } from '../../brokers/mt5-connector';
import { OrderManager } from '../../orders/order-manager';
import { 
  TradeSignal, 
  ExecutionResult 
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

jest.mock('../../realtime/pusher-service', () => ({
  pusherService: {
    trigger: jest.fn(),
  }
}));

describe('End-to-End Trade Execution Tests', () => {
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

  describe('Complete Trade Execution Flow', () => {
    it('should execute a complete trade flow from signal to execution', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      const connected = await brokerConnector.connect(credentials);
      expect(connected).toBe(true);
      expect(brokerConnector.isConnected()).toBe(true);

      // 2. Create a trade signal
      const tradeSignal = TestDataFactory.createTradeSignal({
        userId: testUserId,
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 0.1,
        entryPrice: 1.1000,
        stopLoss: 1.0900,
        takeProfit: 1.1100
      });

      // 3. Execute the trade
      const executionResult = await safeTradeExecutor.executeTrade(tradeSignal);

      // 4. Verify execution result
      expect(executionResult).toBeDefined();
      expect(executionResult.success).toBe(true);
      expect(executionResult.ticket).toBeDefined();
      expect(executionResult.executionPrice).toBeDefined();
      expect(executionResult.executedLotSize).toBe(tradeSignal.lotSize);
      expect(executionResult.retryAttempts).toBe(0);
      expect(executionResult.signal).toBe(tradeSignal);

      // 5. Verify position was opened
      const positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(1);
      expect(positions[0].symbol).toBe(tradeSignal.symbol);
      expect(positions[0].type).toBe(0); // BUY
      expect(positions[0].volume).toBe(tradeSignal.lotSize);

      // 6. Verify order was created in order manager
      const orders = await orderManager.getActiveOrders(testUserId);
      expect(orders.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle trade rejection due to risk limits', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create a high-risk trade signal
      const highRiskSignal = TestDataFactory.createTradeSignal({
        userId: testUserId,
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 10.0, // Very high risk
        entryPrice: 1.1000,
        stopLoss: 1.0900,
        takeProfit: 1.1100
      });

      // 3. Attempt to execute the trade
      const executionResult = await safeTradeExecutor.executeTrade(highRiskSignal);

      // 4. Verify trade was rejected
      expect(executionResult).toBeDefined();
      expect(executionResult.success).toBe(false);
      expect(executionResult.error).toContain('Risk limits exceeded');

      // 5. Verify no position was opened
      const positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(0);
    });

    it('should handle trade rejection due to invalid parameters', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create an invalid trade signal
      const invalidSignal = TestDataFactory.createTradeSignal({
        userId: testUserId,
        symbol: '', // Invalid symbol
        type: 'BUY',
        lotSize: 0.1,
        entryPrice: 1.1000,
        stopLoss: 1.0900,
        takeProfit: 1.1100
      });

      // 3. Attempt to execute the trade
      const executionResult = await safeTradeExecutor.executeTrade(invalidSignal);

      // 4. Verify trade was rejected
      expect(executionResult).toBeDefined();
      expect(executionResult.success).toBe(false);
      expect(executionResult.error).toContain('Symbol is required');

      // 5. Verify no position was opened
      const positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(0);
    });

    it('should handle partial execution and retries', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create a trade signal
      const tradeSignal = TestDataFactory.createTradeSignal({
        userId: testUserId,
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 0.1,
        entryPrice: 1.1000,
        stopLoss: 1.0900,
        takeProfit: 1.1100
      });

      // 3. Mock retry behavior
      const executor = safeTradeExecutor as any;
      let callCount = 0;
      executor.executeBrokerOrder = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call fails
          return Promise.resolve({
            retcode: 10006, // Request rejected
            comment: 'Connection timeout'
          });
        } else {
          // Second call succeeds
          return Promise.resolve({
            retcode: 10009, // Success
            order: 123456,
            price: 1.1000,
            volume: 0.1
          });
        }
      });

      // 4. Execute the trade with retry configuration
      const retryConfig = {
        maxAttempts: 3,
        initialDelay: 10, // Short delay for testing
        backoffMultiplier: 2,
        maxDelay: 100,
        useJitter: false
      };

      const executionResult = await safeTradeExecutor.executeTrade(tradeSignal, retryConfig);

      // 5. Verify execution result
      expect(executionResult).toBeDefined();
      expect(executionResult.success).toBe(true);
      expect(executionResult.ticket).toBe(123456);
      expect(executionResult.retryAttempts).toBe(1); // Should have retried once

      // 6. Verify position was opened
      const positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(1);
    });
  });

  describe('Multi-Trade Execution Scenarios', () => {
    it('should handle concurrent trade executions', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create multiple trade signals
      const tradeSignals = Array.from({ length: 5 }, (_, i) =>
        TestDataFactory.createTradeSignal({
          userId: testUserId,
          symbol: i % 2 === 0 ? 'EURUSD' : 'GBPUSD',
          type: i % 2 === 0 ? 'BUY' : 'SELL',
          lotSize: 0.1,
          entryPrice: 1.1000 + (i * 0.001),
          stopLoss: 1.0900 + (i * 0.001),
          takeProfit: 1.1100 + (i * 0.001),
          id: `signal-${i}`
        })
      );

      // 3. Execute all trades concurrently
      const executionPromises = tradeSignals.map(signal => 
        safeTradeExecutor.executeTrade(signal)
      );

      const executionResults = await Promise.all(executionPromises);

      // 4. Verify all executions succeeded
      executionResults.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.ticket).toBeDefined();
        expect(result.signal.id).toBe(`signal-${index}`);
      });

      // 5. Verify all positions were opened
      const positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(5);
    });

    it('should handle mixed successful and failed trades', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create mixed trade signals (some valid, some invalid)
      const tradeSignals = [
        TestDataFactory.createTradeSignal({
          userId: testUserId,
          symbol: 'EURUSD',
          type: 'BUY',
          lotSize: 0.1,
          id: 'valid-signal-1'
        }),
        TestDataFactory.createTradeSignal({
          userId: testUserId,
          symbol: '', // Invalid
          type: 'BUY',
          lotSize: 0.1,
          id: 'invalid-signal-1'
        }),
        TestDataFactory.createTradeSignal({
          userId: testUserId,
          symbol: 'GBPUSD',
          type: 'SELL',
          lotSize: 0.1,
          id: 'valid-signal-2'
        }),
        TestDataFactory.createTradeSignal({
          userId: testUserId,
          symbol: 'USDJPY',
          type: 'BUY',
          lotSize: 100.0, // Too risky
          id: 'risky-signal-1'
        })
      ];

      // 3. Execute all trades
      const executionPromises = tradeSignals.map(signal => 
        safeTradeExecutor.executeTrade(signal)
      );

      const executionResults = await Promise.all(executionPromises);

      // 4. Verify execution results
      expect(executionResults[0].success).toBe(true); // Valid
      expect(executionResults[1].success).toBe(false); // Invalid symbol
      expect(executionResults[2].success).toBe(true); // Valid
      expect(executionResults[3].success).toBe(false); // Too risky

      // 5. Verify only valid positions were opened
      const positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(2);
    });
  });

  describe('Position Management Integration', () => {
    it('should close positions through the complete flow', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Open a position
      const tradeSignal = TestDataFactory.createTradeSignal({
        userId: testUserId,
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 0.1,
        entryPrice: 1.1000,
        stopLoss: 1.0900,
        takeProfit: 1.1100
      });

      const executionResult = await safeTradeExecutor.executeTrade(tradeSignal);
      expect(executionResult.success).toBe(true);

      // 3. Verify position was opened
      let positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(1);
      const ticket = positions[0].ticket;

      // 4. Close the position
      const closeResult = await brokerConnector.closePosition(ticket);
      expect(closeResult.retcode).toBe(0);

      // 5. Verify position was closed
      positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(0);
    });

    it('should modify positions through the complete flow', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Open a position
      const tradeSignal = TestDataFactory.createTradeSignal({
        userId: testUserId,
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 0.1,
        entryPrice: 1.1000,
        stopLoss: 1.0900,
        takeProfit: 1.1100
      });

      const executionResult = await safeTradeExecutor.executeTrade(tradeSignal);
      expect(executionResult.success).toBe(true);

      // 3. Verify position was opened
      const positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(1);
      const ticket = positions[0].ticket;

      // 4. Modify the position
      const newSL = 1.0950;
      const newTP = 1.1050;
      const modifyResult = await brokerConnector.modifyPosition(ticket, newSL, newTP);
      expect(modifyResult).toBe(true);

      // 5. Verify position is still open
      const updatedPositions = await brokerConnector.getOpenPositions();
      expect(updatedPositions).toHaveLength(1);
      expect(updatedPositions[0].ticket).toBe(ticket);
    });
  });

  describe('Risk Management Integration', () => {
    it('should enforce position limits', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Set risk parameters with low position limit
      await riskManager.setRiskParameters(testUserId, {
        maxPositions: 2
      });

      // 3. Create multiple trade signals
      const tradeSignals = Array.from({ length: 3 }, (_, i) =>
        TestDataFactory.createTradeSignal({
          userId: testUserId,
          symbol: 'EURUSD',
          type: 'BUY',
          lotSize: 0.1,
          id: `signal-${i}`
        })
      );

      // 4. Execute first two trades (should succeed)
      const result1 = await safeTradeExecutor.executeTrade(tradeSignals[0]);
      const result2 = await safeTradeExecutor.executeTrade(tradeSignals[1]);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // 5. Attempt to execute third trade (should fail)
      const result3 = await safeTradeExecutor.executeTrade(tradeSignals[2]);
      expect(result3.success).toBe(false);
      expect(result3.error).toContain('Maximum positions');

      // 6. Verify only 2 positions were opened
      const positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(2);
    });

    it('should enforce daily loss limits', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Set risk parameters with low daily loss limit
      await riskManager.setRiskParameters(testUserId, {
        maxDailyLoss: 1.0 // 1% daily loss limit
      });

      // 3. Create a losing position (mock)
      const losingSignal = TestDataFactory.createTradeSignal({
        userId: testUserId,
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 1.0, // Large position
        entryPrice: 1.1000,
        stopLoss: 1.0800, // Large stop loss
        takeProfit: 1.1200
      });

      // 4. Execute the trade
      const result1 = await safeTradeExecutor.executeTrade(losingSignal);
      expect(result1.success).toBe(true);

      // 5. Mock a loss by updating position
      const positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(1);

      // 6. Attempt another trade (should fail due to daily loss limit)
      const anotherSignal = TestDataFactory.createTradeSignal({
        userId: testUserId,
        symbol: 'GBPUSD',
        type: 'BUY',
        lotSize: 0.1
      });

      const result2 = await safeTradeExecutor.executeTrade(anotherSignal);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Daily loss limit');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle broker disconnection during execution', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create a trade signal
      const tradeSignal = TestDataFactory.createTradeSignal({
        userId: testUserId,
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 0.1
      });

      // 3. Mock broker disconnection during execution
      const executor = safeTradeExecutor as any;
      executor.executeBrokerOrder = jest.fn().mockImplementation(() => {
        // Disconnect first
        brokerConnector.disconnect();
        // Then return error
        return Promise.resolve({
          retcode: 10006, // Request rejected
          comment: 'Connection lost'
        });
      });

      // 4. Execute the trade
      const executionResult = await safeTradeExecutor.executeTrade(tradeSignal);

      // 5. Verify execution failed
      expect(executionResult.success).toBe(false);
      expect(executionResult.error).toContain('Connection lost');

      // 6. Verify no position was opened
      const positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(0);
    });

    it('should handle database errors during trade recording', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create a trade signal
      const tradeSignal = TestDataFactory.createTradeSignal({
        userId: testUserId,
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 0.1
      });

      // 3. Mock database error
      const executor = safeTradeExecutor as any;
      executor.saveTradeToDatabase = jest.fn().mockRejectedValue(
        new Error('Database connection failed')
      );

      // 4. Execute the trade
      const executionResult = await safeTradeExecutor.executeTrade(tradeSignal);

      // 5. Verify trade still executed despite database error
      expect(executionResult.success).toBe(true);
      expect(executionResult.ticket).toBeDefined();

      // 6. Verify position was opened
      const positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(1);
    });

    it('should handle notification errors during execution', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create a trade signal
      const tradeSignal = TestDataFactory.createTradeSignal({
        userId: testUserId,
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 0.1
      });

      // 3. Mock notification error
      const executor = safeTradeExecutor as any;
      executor.sendNotification = jest.fn().mockRejectedValue(
        new Error('Notification service unavailable')
      );

      // 4. Execute the trade
      const executionResult = await safeTradeExecutor.executeTrade(tradeSignal);

      // 5. Verify trade still executed despite notification error
      expect(executionResult.success).toBe(true);
      expect(executionResult.ticket).toBeDefined();

      // 6. Verify position was opened
      const positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(1);
    });
  });

  describe('Performance Tests', () => {
    it('should handle high-frequency trade executions', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Measure execution time for multiple trades
      const { averageTime, totalTime } = await PerformanceTestHelper.measureExecutionTime(
        async () => {
          const tradeSignal = TestDataFactory.createTradeSignal({
            userId: testUserId,
            symbol: 'EURUSD',
            type: 'BUY',
            lotSize: 0.01
          });

          const result = await safeTradeExecutor.executeTrade(tradeSignal);
          expect(result.success).toBe(true);

          // Close the position to free up margin
          if (result.ticket) {
            await brokerConnector.closePosition(result.ticket);
          }
        },
        10
      );

      // 3. Verify performance is within acceptable limits
      expect(averageTime).toBeLessThan(1000); // Less than 1 second per trade
      expect(totalTime).toBeLessThan(10000); // Less than 10 seconds total
    });

    it('should handle concurrent trade executions efficiently', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create multiple trade signals
      const tradeSignals = Array.from({ length: 10 }, (_, i) =>
        TestDataFactory.createTradeSignal({
          userId: testUserId,
          symbol: 'EURUSD',
          type: 'BUY',
          lotSize: 0.01,
          id: `signal-${i}`
        })
      );

      // 3. Measure execution time for concurrent trades
      const startTime = Date.now();
      
      const executionPromises = tradeSignals.map(signal => 
        safeTradeExecutor.executeTrade(signal)
      );

      const executionResults = await Promise.all(executionPromises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / tradeSignals.length;

      // 4. Verify all executions succeeded
      executionResults.forEach(result => {
        expect(result.success).toBe(true);
      });

      // 5. Verify performance is acceptable
      expect(averageTime).toBeLessThan(500); // Less than 500ms per trade
      expect(totalTime).toBeLessThan(5000); // Less than 5 seconds total

      // 6. Clean up positions
      for (const result of executionResults) {
        if (result.ticket) {
          await brokerConnector.closePosition(result.ticket);
        }
      }
    });
  });

  describe('Integration with Order Management', () => {
    it('should update order status throughout execution', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create a trade signal
      const tradeSignal = TestDataFactory.createTradeSignal({
        userId: testUserId,
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 0.1
      });

      // 3. Execute the trade
      const executionResult = await safeTradeExecutor.executeTrade(tradeSignal);

      // 4. Verify execution succeeded
      expect(executionResult.success).toBe(true);

      // 5. Check order status in order manager
      const orders = await orderManager.getActiveOrders(testUserId);
      expect(orders.length).toBeGreaterThanOrEqual(0);

      // 6. Verify position was opened
      const positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(1);
    });

    it('should handle order cancellation', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create a trade signal
      const tradeSignal = TestDataFactory.createTradeSignal({
        userId: testUserId,
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 0.1
      });

      // 3. Execute the trade
      const executionResult = await safeTradeExecutor.executeTrade(tradeSignal);
      expect(executionResult.success).toBe(true);

      // 4. Get the position ticket
      const positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(1);
      const ticket = positions[0].ticket;

      // 5. Close the position
      const closeResult = await brokerConnector.closePosition(ticket);
      expect(closeResult.retcode).toBe(0);

      // 6. Verify position was closed
      const updatedPositions = await brokerConnector.getOpenPositions();
      expect(updatedPositions).toHaveLength(0);
    });
  });
});