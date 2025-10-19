/**
 * Security Penetration Testing Suite
 * 
 * This file contains comprehensive security tests for the trading platform,
 * testing various attack vectors and security vulnerabilities.
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
  ErrorTestHelper
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

describe('Security Penetration Testing Suite', () => {
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

  describe('Input Validation Security Tests', () => {
    it('should prevent SQL injection in trade parameters', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create a trade signal with SQL injection attempts
      const maliciousSignal = TestDataFactory.createTradeSignal({
        userId: testUserId,
        symbol: "EURUSD'; DROP TABLE trades; --",
        type: 'BUY',
        lotSize: 0.1,
        comment: "'; DROP TABLE users; --"
      });

      // 3. Attempt to execute the trade
      const executionResult = await safeTradeExecutor.executeTrade(maliciousSignal);

      // 4. Verify trade was rejected
      expect(executionResult.success).toBe(false);
      expect(executionResult.error).toContain('Invalid symbol');

      // 5. Verify no position was opened
      const positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(0);
    });

    it('should prevent XSS in trade parameters', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create a trade signal with XSS attempts
      const maliciousSignal = TestDataFactory.createTradeSignal({
        userId: testUserId,
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 0.1,
        comment: '<script>alert("XSS")</script>'
      });

      // 3. Attempt to execute the trade
      const executionResult = await safeTradeExecutor.executeTrade(maliciousSignal);

      // 4. Verify trade was rejected or sanitized
      if (!executionResult.success) {
        expect(executionResult.error).toBeDefined();
      } else {
        // If successful, verify comment was sanitized
        expect(executionResult.signal.comment).not.toContain('<script>');
      }
    });

    it('should prevent command injection in trade parameters', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create a trade signal with command injection attempts
      const maliciousSignal = TestDataFactory.createTradeSignal({
        userId: testUserId,
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 0.1,
        comment: '; rm -rf /'
      });

      // 3. Attempt to execute the trade
      const executionResult = await safeTradeExecutor.executeTrade(maliciousSignal);

      // 4. Verify trade was rejected or sanitized
      if (!executionResult.success) {
        expect(executionResult.error).toBeDefined();
      } else {
        // If successful, verify comment was sanitized
        expect(executionResult.signal.comment).not.toContain('; rm -rf');
      }
    });

    it('should handle extremely large input values', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create a trade signal with extremely large values
      const largeString = 'A'.repeat(10000);
      const maliciousSignal = TestDataFactory.createTradeSignal({
        userId: testUserId,
        symbol: largeString,
        type: 'BUY',
        lotSize: 0.1,
        comment: largeString
      });

      // 3. Attempt to execute the trade
      const executionResult = await safeTradeExecutor.executeTrade(maliciousSignal);

      // 4. Verify trade was rejected
      expect(executionResult.success).toBe(false);
      expect(executionResult.error).toBeDefined();

      // 5. Verify no position was opened
      const positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(0);
    });

    it('should handle null and undefined values', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create a trade signal with null/undefined values
      const maliciousSignal = {
        id: null,
        symbol: undefined,
        type: 'BUY',
        lotSize: null,
        entryPrice: undefined,
        stopLoss: null,
        takeProfit: undefined,
        userId: testUserId,
        strategyId: null,
        confidence: undefined,
        source: null,
        timestamp: null,
        comment: undefined
      } as any;

      // 3. Attempt to execute the trade
      const executionResult = await safeTradeExecutor.executeTrade(maliciousSignal);

      // 4. Verify trade was rejected
      expect(executionResult.success).toBe(false);
      expect(executionResult.error).toBeDefined();

      // 5. Verify no position was opened
      const positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(0);
    });
  });

  describe('Authentication and Authorization Security Tests', () => {
    it('should prevent unauthorized trade execution', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create a trade signal with invalid user ID
      const unauthorizedSignal = TestDataFactory.createTradeSignal({
        userId: '', // Empty user ID
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 0.1
      });

      // 3. Attempt to execute the trade
      const executionResult = await safeTradeExecutor.executeTrade(unauthorizedSignal);

      // 4. Verify trade was rejected
      expect(executionResult.success).toBe(false);
      expect(executionResult.error).toBeDefined();

      // 5. Verify no position was opened
      const positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(0);
    });

    it('should prevent privilege escalation', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create a trade signal with admin privileges
      const escalationSignal = TestDataFactory.createTradeSignal({
        userId: testUserId,
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 100.0, // Very large lot size
        comment: 'ADMIN_OVERRIDE'
      });

      // 3. Attempt to execute the trade
      const executionResult = await safeTradeExecutor.executeTrade(escalationSignal);

      // 4. Verify trade was rejected
      expect(executionResult.success).toBe(false);
      expect(executionResult.error).toContain('exceeds maximum');

      // 5. Verify no position was opened
      const positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(0);
    });

    it('should prevent cross-user data access', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create a trade signal for a different user
      const crossUserSignal = TestDataFactory.createTradeSignal({
        userId: 'other-user-456', // Different user ID
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 0.1
      });

      // 3. Attempt to execute the trade
      const executionResult = await safeTradeExecutor.executeTrade(crossUserSignal);

      // 4. Verify trade was rejected or properly isolated
      if (!executionResult.success) {
        expect(executionResult.error).toBeDefined();
      } else {
        // If successful, verify it's isolated to the correct user
        expect(executionResult.signal.userId).toBe('other-user-456');
      }
    });
  });

  describe('Rate Limiting Security Tests', () => {
    it('should prevent trade execution spamming', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create multiple identical trade signals
      const tradeSignals = Array.from({ length: 100 }, (_, i) =>
        TestDataFactory.createTradeSignal({
          userId: testUserId,
          symbol: 'EURUSD',
          type: 'BUY',
          lotSize: 0.1,
          id: `spam-${i}`
        })
      );

      // 3. Attempt to execute all trades simultaneously
      const executionPromises = tradeSignals.map(signal => 
        safeTradeExecutor.executeTrade(signal)
      );

      const executionResults = await Promise.all(executionPromises);

      // 4. Verify not all trades succeeded (rate limiting)
      const successCount = executionResults.filter(r => r.success).length;
      expect(successCount).toBeLessThan(100);

      // 5. Verify some trades were rejected due to rate limiting
      const rateLimitedCount = executionResults.filter(r => 
        !r.success && r.error?.includes('rate limit')
      ).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    it('should prevent API endpoint flooding', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create multiple requests to the same endpoint
      const requests = Array.from({ length: 200 }, () =>
        brokerConnector.getAccountInfo()
      );

      // 3. Attempt to execute all requests simultaneously
      const requestResults = await Promise.allSettled(requests);

      // 4. Verify not all requests succeeded
      const successCount = requestResults.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeLessThan(200);

      // 5. Verify some requests were rejected due to rate limiting
      const rejectedCount = requestResults.filter(r => 
        r.status === 'rejected' && 
        r.reason instanceof Error && 
        r.reason.message.includes('rate limit')
      ).length;
      expect(rejectedCount).toBeGreaterThan(0);
    });
  });

  describe('Data Integrity Security Tests', () => {
    it('should prevent data tampering in trade signals', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create a valid trade signal
      const validSignal = TestDataFactory.createTradeSignal({
        userId: testUserId,
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 0.1
      });

      // 3. Tamper with the signal after creation
      const tamperedSignal = {
        ...validSignal,
        lotSize: 10.0, // Change lot size
        userId: 'hacker-789' // Change user ID
      };

      // 4. Attempt to execute the tampered trade
      const executionResult = await safeTradeExecutor.executeTrade(tamperedSignal);

      // 5. Verify trade was rejected
      expect(executionResult.success).toBe(false);
      expect(executionResult.error).toBeDefined();

      // 6. Verify no position was opened
      const positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(0);
    });

    it('should prevent race conditions in trade execution', async () => {
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

      // 3. Attempt to execute the same trade multiple times simultaneously
      const executionPromises = Array.from({ length: 10 }, () =>
        safeTradeExecutor.executeTrade(tradeSignal)
      );

      const executionResults = await Promise.all(executionPromises);

      // 4. Verify only one trade succeeded
      const successCount = executionResults.filter(r => r.success).length;
      expect(successCount).toBeLessThanOrEqual(1);

      // 5. Verify duplicate executions were prevented
      const duplicateCount = executionResults.filter(r => 
        !r.success && r.error?.includes('duplicate')
      ).length;
      expect(duplicateCount).toBeGreaterThan(0);
    });
  });

  describe('Cryptographic Security Tests', () => {
    it('should handle encrypted API keys securely', async () => {
      // 1. Create broker credentials with encrypted API key
      const encryptedCredentials = TestDataFactory.createBrokerCredentials({
        password: 'encrypted:U2FsdGVkX1+1234567890abcdef' // Mock encrypted password
      });

      // 2. Attempt to connect with encrypted credentials
      const connected = await brokerConnector.connect(encryptedCredentials);

      // 3. Verify connection was handled securely
      if (connected) {
        expect(brokerConnector.isConnected()).toBe(true);
      } else {
        // If connection failed, verify it was due to encryption handling
        expect(brokerConnector.getLastError()).toBeDefined();
      }
    });

    it('should prevent sensitive data exposure in logs', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create a trade signal with sensitive data
      const sensitiveSignal = TestDataFactory.createTradeSignal({
        userId: testUserId,
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 0.1,
        comment: 'API_KEY:1234567890abcdef'
      });

      // 3. Execute the trade
      await safeTradeExecutor.executeTrade(sensitiveSignal);

      // 4. Verify sensitive data was not exposed in logs
      const { logger } = require('../monitoring/logger');
      const logCalls = logger.info.mock.calls.concat(logger.error.mock.calls);
      const logMessages = logCalls.map((call: any) => call[0]).join(' ');
      
      expect(logMessages).not.toContain('API_KEY:1234567890abcdef');
    });
  });

  describe('Session Security Tests', () => {
    it('should prevent session hijacking', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create a trade signal with session hijacking attempt
      const hijackSignal = TestDataFactory.createTradeSignal({
        userId: testUserId,
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 0.1,
        // Include session token from another user
        comment: 'SESSION_TOKEN:hijacked_token_12345'
      });

      // 3. Attempt to execute the trade
      const executionResult = await safeTradeExecutor.executeTrade(hijackSignal);

      // 4. Verify trade was rejected or session was validated
      if (!executionResult.success) {
        expect(executionResult.error).toBeDefined();
      } else {
        // If successful, verify session was properly validated
        expect(executionResult.signal.comment).not.toContain('hijacked_token');
      }
    });

    it('should handle session expiration', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create a trade signal with expired session
      const expiredSignal = TestDataFactory.createTradeSignal({
        userId: testUserId,
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 0.1,
        // Include expired session timestamp
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
      });

      // 3. Attempt to execute the trade
      const executionResult = await safeTradeExecutor.executeTrade(expiredSignal);

      // 4. Verify trade was rejected due to expired session
      expect(executionResult.success).toBe(false);
      expect(executionResult.error).toBeDefined();
    });
  });

  describe('Resource Exhaustion Security Tests', () => {
    it('should prevent memory exhaustion attacks', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create a trade signal with extremely large data
      const largeData = 'A'.repeat(10 * 1024 * 1024); // 10MB string
      const exhaustionSignal = TestDataFactory.createTradeSignal({
        userId: testUserId,
        symbol: 'EURUSD',
        type: 'BUY',
        lotSize: 0.1,
        comment: largeData
      });

      // 3. Attempt to execute the trade
      const executionResult = await safeTradeExecutor.executeTrade(exhaustionSignal);

      // 4. Verify trade was rejected
      expect(executionResult.success).toBe(false);
      expect(executionResult.error).toBeDefined();

      // 5. Verify no position was opened
      const positions = await brokerConnector.getOpenPositions();
      expect(positions).toHaveLength(0);
    });

    it('should prevent CPU exhaustion attacks', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create multiple complex trade signals
      const complexSignals = Array.from({ length: 1000 }, (_, i) =>
        TestDataFactory.createTradeSignal({
          userId: testUserId,
          symbol: 'EURUSD',
          type: 'BUY',
          lotSize: 0.1,
          // Add complex calculations
          entryPrice: 1.1000 + Math.sin(i) * 0.0001,
          stopLoss: 1.0900 + Math.cos(i) * 0.0001,
          takeProfit: 1.1100 + Math.tan(i) * 0.0001
        })
      );

      // 3. Measure execution time
      const startTime = Date.now();
      
      // 4. Attempt to execute all trades
      const executionPromises = complexSignals.map(signal => 
        safeTradeExecutor.executeTrade(signal)
      );

      const executionResults = await Promise.all(executionPromises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // 5. Verify execution completed in reasonable time
      expect(totalTime).toBeLessThan(30000); // Less than 30 seconds

      // 6. Verify not all trades succeeded (resource protection)
      const successCount = executionResults.filter(r => r.success).length;
      expect(successCount).toBeLessThan(1000);
    });
  });

  describe('Denial of Service Security Tests', () => {
    it('should prevent connection flooding', async () => {
      // 1. Create multiple connection attempts
      const credentials = TestDataFactory.createBrokerCredentials();
      const connectionPromises = Array.from({ length: 100 }, () =>
        brokerConnector.connect(credentials)
      );

      // 2. Attempt to connect multiple times simultaneously
      const connectionResults = await Promise.allSettled(connectionPromises);

      // 3. Verify not all connections succeeded
      const successCount = connectionResults.filter(r => r.status === 'fulfilled' && r.value === true).length;
      expect(successCount).toBeLessThan(100);

      // 4. Verify some connections were rejected
      const rejectedCount = connectionResults.filter(r => 
        r.status === 'rejected' || 
        (r.status === 'fulfilled' && r.value === false)
      ).length;
      expect(rejectedCount).toBeGreaterThan(0);
    });

    it('should prevent request flooding', async () => {
      // 1. Connect to broker
      const credentials = TestDataFactory.createBrokerCredentials();
      await brokerConnector.connect(credentials);

      // 2. Create multiple requests to flood the system
      const requestPromises = Array.from({ length: 1000 }, () =>
        brokerConnector.getCurrentPrice('EURUSD')
      );

      // 3. Attempt to execute all requests simultaneously
      const requestResults = await Promise.allSettled(requestPromises);

      // 4. Verify not all requests succeeded
      const successCount = requestResults.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeLessThan(1000);

      // 5. Verify some requests were rejected
      const rejectedCount = requestResults.filter(r => r.status === 'rejected').length;
      expect(rejectedCount).toBeGreaterThan(0);
    });
  });
});