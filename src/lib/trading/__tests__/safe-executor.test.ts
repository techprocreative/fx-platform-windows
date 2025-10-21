/**
 * Unit tests for SafeTradeExecutor
 * 
 * This file contains comprehensive unit tests for the SafeTradeExecutor class,
 * testing all major functionality including pre-execution validation, retry logic,
 * execution verification, database recording, notifications, and error handling.
 */

import { SafeTradeExecutor } from '../safe-executor';
import { TradeSignal, ExecutionResult } from '../types';
import { executionValidator } from '../execution-validator';
import { riskManager } from '../../risk/risk-manager';
import { logger } from '../../monitoring/logger';

// Mock dependencies
jest.mock('../execution-validator');
jest.mock('../../risk/risk-manager');
jest.mock('../../monitoring/logger');

// Mock logger implementation
const mockedLogger = logger as jest.Mocked<typeof logger>;
mockedLogger.info = jest.fn();
mockedLogger.debug = jest.fn();
mockedLogger.warn = jest.fn();
mockedLogger.error = jest.fn();

// Mock executionValidator implementation
const mockedExecutionValidator = executionValidator as jest.Mocked<typeof executionValidator>;
mockedExecutionValidator.validateExecution = jest.fn();

// Mock riskManager implementation
const mockedRiskManager = riskManager as jest.Mocked<typeof riskManager>;
mockedRiskManager.validateTrade = jest.fn();

describe('SafeTradeExecutor', () => {
  let safeTradeExecutor: SafeTradeExecutor;
  let mockTradeSignal: TradeSignal;

  beforeEach(() => {
    // Create a new instance before each test
    safeTradeExecutor = new SafeTradeExecutor();
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create a mock trade signal for testing
    mockTradeSignal = {
      id: 'test-signal-123',
      symbol: 'EURUSD',
      type: 'BUY',
      lotSize: 0.1,
      entryPrice: 1.1000,
      stopLoss: 1.0900,
      takeProfit: 1.1100,
      userId: 'test-user-456',
      strategyId: 'test-strategy-789',
      confidence: 85,
      source: 'test',
      timestamp: new Date(),
      comment: 'Test trade signal'
    };
  });

  describe('executeTrade', () => {
    it('should successfully execute a trade with valid signal', async () => {
      // Mock successful validation
      mockedExecutionValidator.validateExecution.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        timestamp: new Date(),
        checks: [],
        riskScore: 30
      });

      // Mock successful risk validation
      mockedRiskManager.validateTrade.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Execute the trade
      const result = await safeTradeExecutor.executeTrade(mockTradeSignal);

      // Verify the result
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.ticket).toBeDefined();
      expect(result.executionPrice).toBeDefined();
      expect(result.executedLotSize).toBe(mockTradeSignal.lotSize);
      expect(result.retryAttempts).toBe(0);
      expect(result.signal).toBe(mockTradeSignal);

      // Verify validation was called
      expect(mockedExecutionValidator.validateExecution).toHaveBeenCalledWith(mockTradeSignal);
      expect(mockedRiskManager.validateTrade).toHaveBeenCalledWith(mockTradeSignal);

      // Verify logging
      expect(mockedLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting safe trade execution'),
        expect.any(Object)
      );
      expect(mockedLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Trade execution completed'),
        expect.any(Object)
      );
    });

    it('should reject trade when pre-execution validation fails', async () => {
      // Mock failed validation
      mockedExecutionValidator.validateExecution.mockResolvedValue({
        valid: false,
        errors: ['Market is closed'],
        warnings: [],
        timestamp: new Date(),
        checks: [],
        riskScore: 100
      });

      // Execute the trade
      const result = await safeTradeExecutor.executeTrade(mockTradeSignal);

      // Verify the result
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Pre-execution validation failed');
      expect(result.retryAttempts).toBe(0);

      // Verify validation was called but risk validation was not
      expect(mockedExecutionValidator.validateExecution).toHaveBeenCalledWith(mockTradeSignal);
      expect(mockedRiskManager.validateTrade).not.toHaveBeenCalled();

      // Verify error logging
      expect(mockedLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Trade execution rejected'),
        expect.any(Error),
        expect.any(Object)
      );
    });

    it('should reject trade when risk validation fails', async () => {
      // Mock successful pre-execution validation
      mockedExecutionValidator.validateExecution.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        timestamp: new Date(),
        checks: [],
        riskScore: 30
      });

      // Mock failed risk validation
      mockedRiskManager.validateTrade.mockResolvedValue({
        valid: false,
        errors: ['Risk limits exceeded'],
        warnings: []
      });

      // Execute the trade
      const result = await safeTradeExecutor.executeTrade(mockTradeSignal);

      // Verify the result
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Risk limits exceeded');
      expect(result.retryAttempts).toBe(0);

      // Verify both validations were called
      expect(mockedExecutionValidator.validateExecution).toHaveBeenCalledWith(mockTradeSignal);
      expect(mockedRiskManager.validateTrade).toHaveBeenCalledWith(mockTradeSignal);

      // Verify error logging
      expect(mockedLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Trade execution rejected'),
        expect.any(Error),
        expect.any(Object)
      );
    });

    it('should retry execution on failure', async () => {
      // Mock successful validation
      mockedExecutionValidator.validateExecution.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        timestamp: new Date(),
        checks: [],
        riskScore: 30
      });

      mockedRiskManager.validateTrade.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Mock the executeBrokerOrder method to fail first then succeed
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

      // Execute the trade with custom retry config
      const retryConfig = {
        maxAttempts: 3,
        initialDelay: 10, // Short delay for testing
        backoffMultiplier: 2,
        maxDelay: 100,
        useJitter: false
      };

      const result = await safeTradeExecutor.executeTrade(mockTradeSignal, retryConfig);

      // Verify the result
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.ticket).toBe(123456);
      expect(result.retryAttempts).toBe(1); // Should have retried once

      // Verify broker order was called twice
      expect(executor.executeBrokerOrder).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retry attempts', async () => {
      // Mock successful validation
      mockedExecutionValidator.validateExecution.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        timestamp: new Date(),
        checks: [],
        riskScore: 30
      });

      mockedRiskManager.validateTrade.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Mock the executeBrokerOrder method to always fail
      const executor = safeTradeExecutor as any;
      executor.executeBrokerOrder = jest.fn().mockResolvedValue({
        retcode: 10006, // Request rejected
        comment: 'Connection timeout'
      });

      // Execute the trade with custom retry config
      const retryConfig = {
        maxAttempts: 2,
        initialDelay: 10, // Short delay for testing
        backoffMultiplier: 2,
        maxDelay: 100,
        useJitter: false
      };

      const result = await safeTradeExecutor.executeTrade(mockTradeSignal, retryConfig);

      // Verify the result
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Broker error: Connection timeout');
      expect(result.retryAttempts).toBe(2); // Should have used all attempts

      // Verify broker order was called max attempts times
      expect(executor.executeBrokerOrder).toHaveBeenCalledTimes(2);
    });

    it('should handle exceptions during execution', async () => {
      // Mock successful validation
      mockedExecutionValidator.validateExecution.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        timestamp: new Date(),
        checks: [],
        riskScore: 30
      });

      mockedRiskManager.validateTrade.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Mock the executeBrokerOrder method to throw an exception
      const executor = safeTradeExecutor as any;
      executor.executeBrokerOrder = jest.fn().mockRejectedValue(
        new Error('Broker connection failed')
      );

      // Execute the trade
      const result = await safeTradeExecutor.executeTrade(mockTradeSignal);

      // Verify the result
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Broker connection failed');
      expect(result.retryAttempts).toBe(3); // Default max attempts

      // Verify error logging
      expect(mockedLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Single trade execution failed'),
        expect.any(Error),
        expect.any(Object)
      );
    });
  });

  describe('preExecutionChecks', () => {
    it('should call execution validator with correct parameters', async () => {
      // Mock the execution validator
      mockedExecutionValidator.validateExecution.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        timestamp: new Date(),
        checks: [],
        riskScore: 30
      });

      // Access private method using bracket notation
      const executor = safeTradeExecutor as any;
      await executor.preExecutionChecks(mockTradeSignal);

      // Verify the validator was called with the correct signal
      expect(mockedExecutionValidator.validateExecution).toHaveBeenCalledWith(mockTradeSignal);
    });
  });

  describe('executeWithRetry', () => {
    it('should return success on first attempt', async () => {
      // Mock the executeSingleTrade method to succeed
      const executor = safeTradeExecutor as any;
      executor.executeSingleTrade = jest.fn().mockResolvedValue({
        success: true,
        ticket: 123456,
        executionPrice: 1.1000,
        executedLotSize: 0.1,
        timestamp: new Date()
      });

      const retryConfig = {
        maxAttempts: 3,
        initialDelay: 10,
        backoffMultiplier: 2,
        maxDelay: 100,
        useJitter: false
      };

      const result = await executor.executeWithRetry(mockTradeSignal, retryConfig, 'test-execution-id');

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.ticket).toBe(123456);
      expect(result.retryAttempts).toBe(0);

      // Verify executeSingleTrade was called once
      expect(executor.executeSingleTrade).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff between retries', async () => {
      // Mock the executeSingleTrade method to fail first then succeed
      const executor = safeTradeExecutor as any;
      let callCount = 0;
      executor.executeSingleTrade = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            success: false,
            error: 'Temporary failure',
            timestamp: new Date()
          });
        } else {
          return Promise.resolve({
            success: true,
            ticket: 123456,
            executionPrice: 1.1000,
            executedLotSize: 0.1,
            timestamp: new Date()
          });
        }
      });

      // Mock the sleep method to track calls
      executor.sleep = jest.fn().mockResolvedValue(undefined);

      const retryConfig = {
        maxAttempts: 3,
        initialDelay: 10,
        backoffMultiplier: 2,
        maxDelay: 100,
        useJitter: false
      };

      const startTime = Date.now();
      const result = await executor.executeWithRetry(mockTradeSignal, retryConfig, 'test-execution-id');
      const endTime = Date.now();

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.retryAttempts).toBe(1);

      // Verify sleep was called with the correct delay
      expect(executor.sleep).toHaveBeenCalledWith(10); // initialDelay

      // Verify executeSingleTrade was called twice
      expect(executor.executeSingleTrade).toHaveBeenCalledTimes(2);
    });
  });

  describe('verifyExecution', () => {
    it('should skip verification for failed execution', async () => {
      const executor = safeTradeExecutor as any;
      const failedResult: ExecutionResult = {
        id: 'test-execution-id',
        success: false,
        error: 'Execution failed',
        timestamp: new Date(),
        executionTime: 100,
        retryAttempts: 1,
        signal: mockTradeSignal
      };

      // Mock getBrokerPosition to track if it's called
      executor.getBrokerPosition = jest.fn();

      await executor.verifyExecution(failedResult);

      // Verify getBrokerPosition was not called
      expect(executor.getBrokerPosition).not.toHaveBeenCalled();

      // Verify warning was logged
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Skipping verification for failed execution'),
        expect.any(Object)
      );
    });

    it('should verify successful execution', async () => {
      const executor = safeTradeExecutor as any;
      const successfulResult: ExecutionResult = {
        id: 'test-execution-id',
        success: true,
        ticket: 123456,
        executionPrice: 1.1000,
        executedLotSize: 0.1,
        timestamp: new Date(),
        executionTime: 100,
        retryAttempts: 0,
        signal: mockTradeSignal
      };

      // Mock getBrokerPosition and getSymbolInfo
      executor.getBrokerPosition = jest.fn().mockResolvedValue({
        ticket: 123456,
        symbol: 'EURUSD',
        volume: 0.1,
        type: 0
      });

      executor.getSymbolInfo = jest.fn().mockResolvedValue({
        symbol: 'EURUSD',
        point: 0.0001,
        digits: 4
      });

      await executor.verifyExecution(successfulResult);

      // Verify getBrokerPosition was called
      expect(executor.getBrokerPosition).toHaveBeenCalledWith(123456);

      // Verify getSymbolInfo was called
      expect(executor.getSymbolInfo).toHaveBeenCalledWith('EURUSD');

      // Verify slippage was calculated and added to result
      expect(successfulResult.slippage).toBeDefined();

      // Verify info was logged
      expect(mockedLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Trade execution verified'),
        expect.any(Object)
      );
    });

    it('should handle verification errors gracefully', async () => {
      const executor = safeTradeExecutor as any;
      const successfulResult: ExecutionResult = {
        id: 'test-execution-id',
        success: true,
        ticket: 123456,
        executionPrice: 1.1000,
        executedLotSize: 0.1,
        timestamp: new Date(),
        executionTime: 100,
        retryAttempts: 0,
        signal: mockTradeSignal
      };

      // Mock getBrokerPosition to throw an error
      executor.getBrokerPosition = jest.fn().mockRejectedValue(
        new Error('Position not found')
      );

      await executor.verifyExecution(successfulResult);

      // Verify error was logged but not thrown
      expect(mockedLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Trade execution verification failed'),
        expect.any(Error),
        expect.any(Object)
      );
    });
  });

  describe('recordTrade', () => {
    it('should record successful trade in database', async () => {
      const executor = safeTradeExecutor as any;
      const successfulResult: ExecutionResult = {
        id: 'test-execution-id',
        success: true,
        ticket: 123456,
        executionPrice: 1.1000,
        executedLotSize: 0.1,
        timestamp: new Date(),
        executionTime: 100,
        retryAttempts: 0,
        signal: mockTradeSignal
      };

      // Mock saveTradeToDatabase to track calls
      executor.saveTradeToDatabase = jest.fn().mockResolvedValue(undefined);

      await executor.recordTrade(successfulResult);

      // Verify saveTradeToDatabase was called
      expect(executor.saveTradeToDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockTradeSignal.userId,
          symbol: mockTradeSignal.symbol,
          type: mockTradeSignal.type,
          lotSize: mockTradeSignal.lotSize,
          ticket: 123456,
          status: 'open'
        })
      );

      // Verify info was logged
      expect(mockedLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Trade recorded in database'),
        expect.any(Object)
      );
    });

    it('should record failed trade in database', async () => {
      const executor = safeTradeExecutor as any;
      const failedResult: ExecutionResult = {
        id: 'test-execution-id',
        success: false,
        error: 'Execution failed',
        timestamp: new Date(),
        executionTime: 100,
        retryAttempts: 1,
        signal: mockTradeSignal
      };

      // Mock saveTradeToDatabase to track calls
      executor.saveTradeToDatabase = jest.fn().mockResolvedValue(undefined);

      await executor.recordTrade(failedResult);

      // Verify saveTradeToDatabase was called
      expect(executor.saveTradeToDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockTradeSignal.userId,
          symbol: mockTradeSignal.symbol,
          type: mockTradeSignal.type,
          lotSize: mockTradeSignal.lotSize,
          status: 'failed',
          error: 'Execution failed'
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      const executor = safeTradeExecutor as any;
      const successfulResult: ExecutionResult = {
        id: 'test-execution-id',
        success: true,
        ticket: 123456,
        executionPrice: 1.1000,
        executedLotSize: 0.1,
        timestamp: new Date(),
        executionTime: 100,
        retryAttempts: 0,
        signal: mockTradeSignal
      };

      // Mock saveTradeToDatabase to throw an error
      executor.saveTradeToDatabase = jest.fn().mockRejectedValue(
        new Error('Database connection failed')
      );

      await executor.recordTrade(successfulResult);

      // Verify error was logged but not thrown
      expect(mockedLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to record trade in database'),
        expect.any(Error),
        expect.any(Object)
      );
    });
  });

  describe('notifyExecution', () => {
    it('should send notifications for successful execution', async () => {
      const executor = safeTradeExecutor as any;
      const successfulResult: ExecutionResult = {
        id: 'test-execution-id',
        success: true,
        ticket: 123456,
        executionPrice: 1.1000,
        executedLotSize: 0.1,
        timestamp: new Date(),
        executionTime: 100,
        retryAttempts: 0,
        signal: mockTradeSignal
      };

      const notificationConfig = {
        notifyOnSuccess: true,
        notifyOnFailure: true,
        channels: ['email', 'push']
      };

      // Mock sendNotification to track calls
      executor.sendNotification = jest.fn().mockResolvedValue(undefined);

      await executor.notifyExecution(successfulResult, notificationConfig);

      // Verify sendNotification was called for each channel
      expect(executor.sendNotification).toHaveBeenCalledTimes(2);
      expect(executor.sendNotification).toHaveBeenCalledWith(
        'email',
        expect.any(Object),
        mockTradeSignal.userId
      );
      expect(executor.sendNotification).toHaveBeenCalledWith(
        'push',
        expect.any(Object),
        mockTradeSignal.userId
      );

      // Verify info was logged
      expect(mockedLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Trade execution notifications sent'),
        expect.any(Object)
      );
    });

    it('should skip notifications when disabled', async () => {
      const executor = safeTradeExecutor as any;
      const successfulResult: ExecutionResult = {
        id: 'test-execution-id',
        success: true,
        ticket: 123456,
        executionPrice: 1.1000,
        executedLotSize: 0.1,
        timestamp: new Date(),
        executionTime: 100,
        retryAttempts: 0,
        signal: mockTradeSignal
      };

      const notificationConfig = {
        notifyOnSuccess: false,
        notifyOnFailure: false,
        channels: ['email', 'push']
      };

      // Mock sendNotification to track calls
      executor.sendNotification = jest.fn().mockResolvedValue(undefined);

      await executor.notifyExecution(successfulResult, notificationConfig);

      // Verify sendNotification was not called
      expect(executor.sendNotification).not.toHaveBeenCalled();

      // Verify debug was logged
      expect(mockedLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Skipping notification'),
        expect.any(Object)
      );
    });

    it('should handle notification errors gracefully', async () => {
      const executor = safeTradeExecutor as any;
      const successfulResult: ExecutionResult = {
        id: 'test-execution-id',
        success: true,
        ticket: 123456,
        executionPrice: 1.1000,
        executedLotSize: 0.1,
        timestamp: new Date(),
        executionTime: 100,
        retryAttempts: 0,
        signal: mockTradeSignal
      };

      const notificationConfig = {
        notifyOnSuccess: true,
        notifyOnFailure: true,
        channels: ['email']
      };

      // Mock sendNotification to throw an error
      executor.sendNotification = jest.fn().mockRejectedValue(
        new Error('Email service unavailable')
      );

      await executor.notifyExecution(successfulResult, notificationConfig);

      // Verify error was logged but not thrown
      expect(mockedLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send trade execution notifications'),
        expect.any(Error),
        expect.any(Object)
      );
    });
  });

  describe('handleExecutionFailure', () => {
    it('should log execution failure and check for critical errors', async () => {
      const executor = safeTradeExecutor as any;
      const error = new Error('INSUFFICIENT_MARGIN');
      const executionId = 'test-execution-id';

      // Mock helper methods
      executor.logExecutionFailure = jest.fn().mockResolvedValue(undefined);
      executor.saveTradeToDatabase = jest.fn().mockResolvedValue(undefined);

      await executor.handleExecutionFailure(mockTradeSignal, error, executionId);

      // Verify logExecutionFailure was called
      expect(executor.logExecutionFailure).toHaveBeenCalledWith(
        executionId,
        mockTradeSignal,
        error
      );

      // Verify saveTradeToDatabase was called
      expect(executor.saveTradeToDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockTradeSignal.userId,
          symbol: mockTradeSignal.symbol,
          type: mockTradeSignal.type,
          lotSize: mockTradeSignal.lotSize,
          status: 'failed',
          error: 'INSUFFICIENT_MARGIN'
        })
      );

      // Verify warning was logged for critical error
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Critical error detected'),
        expect.any(Object)
      );
    });

    it('should handle errors during failure handling', async () => {
      const executor = safeTradeExecutor as any;
      const error = new Error('Some error');
      const executionId = 'test-execution-id';

      // Mock logExecutionFailure to throw an error
      executor.logExecutionFailure = jest.fn().mockRejectedValue(
        new Error('Logging failed')
      );
      executor.saveTradeToDatabase = jest.fn().mockResolvedValue(undefined);

      await executor.handleExecutionFailure(mockTradeSignal, error, executionId);

      // Verify error was logged but not thrown
      expect(mockedLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error handling execution failure'),
        expect.any(Error),
        expect.any(Object)
      );
    });
  });

  describe('helper methods', () => {
    it('should generate unique execution IDs', () => {
      const executor = safeTradeExecutor as any;
      const id1 = executor.generateExecutionId();
      const id2 = executor.generateExecutionId();

      // Verify IDs are strings and start with 'exec_'
      expect(typeof id1).toBe('string');
      expect(id1.startsWith('exec_')).toBe(true);
      expect(typeof id2).toBe('string');
      expect(id2.startsWith('exec_')).toBe(true);

      // Verify IDs are unique
      expect(id1).not.toBe(id2);
    });

    it('should generate unique trade IDs', () => {
      const executor = safeTradeExecutor as any;
      const id1 = executor.generateTradeId();
      const id2 = executor.generateTradeId();

      // Verify IDs are strings and start with 'trade_'
      expect(typeof id1).toBe('string');
      expect(id1.startsWith('trade_')).toBe(true);
      expect(typeof id2).toBe('string');
      expect(id2.startsWith('trade_')).toBe(true);

      // Verify IDs are unique
      expect(id1).not.toBe(id2);
    });

    it('should add jitter to delay', () => {
      const executor = safeTradeExecutor as any;
      const delay = 1000;
      const jitteredDelay = executor.addJitter(delay);

      // Verify jittered delay is a number
      expect(typeof jitteredDelay).toBe('number');

      // Verify jittered delay is within expected range (±25%)
      expect(jitteredDelay).toBeGreaterThanOrEqual(delay * 0.75);
      expect(jitteredDelay).toBeLessThanOrEqual(delay * 1.25);

      // Verify jittered delay is not negative
      expect(jitteredDelay).toBeGreaterThanOrEqual(0);
    });

    it('should sleep for the specified duration', async () => {
      const executor = safeTradeExecutor as any;
      const startTime = Date.now();
      await executor.sleep(100);
      const endTime = Date.now();

      // Verify at least 100ms have passed (with some tolerance)
      expect(endTime - startTime).toBeGreaterThanOrEqual(90);
    });
  });
});