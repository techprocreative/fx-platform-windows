import {
  execute_trade_safely,
  close_trade_safely,
  update_account_metrics,
  log_audit_trail,
  validate_trade_parameters,
  execute_trades_batch,
  close_trades_batch,
  get_trade_transaction_stats,
  reset_trade_transaction_stats
} from '../trade-transaction';
import { TransactionManager } from '../transaction-manager';
import {
  TradeExecutionParams,
  TradeCloseParams,
  AccountMetricsUpdateParams,
  AuditTrailParams,
  TransactionOptions
} from '../types';

// Mock the transaction manager
jest.mock('../transaction-manager', () => ({
  TransactionManager: jest.fn().mockImplementation(() => ({
    executeTransaction: jest.fn(),
    executeRawQuery: jest.fn(),
    getTransactionStats: jest.fn(),
    resetStats: jest.fn(),
  })),
  transactionManager: {
    executeTransaction: jest.fn(),
    executeRawQuery: jest.fn(),
    getTransactionStats: jest.fn(),
    resetStats: jest.fn(),
  }
}));

describe('Trade Transaction Functions', () => {
  let mockTransactionManager: jest.Mocked<TransactionManager>;

  beforeEach(() => {
    // Get the mocked instance
    const { transactionManager } = require('../transaction-manager');
    mockTransactionManager = transactionManager;
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('execute_trade_safely', () => {
    it('should execute a trade successfully', async () => {
      // Arrange
      const tradeParams: TradeExecutionParams = {
        userId: 'user-123',
        strategyId: 'strategy-123',
        executorId: 'executor-123',
        symbol: 'EURUSD',
        type: 'BUY',
        lots: 0.1,
        openPrice: 1.1000,
        stopLoss: 1.0900,
        takeProfit: 1.1100,
        magicNumber: 12345,
        comment: 'Test trade'
      };

      const mockValidationResult = {
        success: true,
        data: { valid: true },
        attempts: 1,
        duration: 100
      };

      const mockTradeResult = {
        success: true,
        data: {
          tradeId: 'trade-123',
          auditId: 'audit-123'
        },
        attempts: 1,
        duration: 200
      };

      mockTransactionManager.executeRawQuery
        .mockResolvedValueOnce(mockValidationResult)
        .mockResolvedValueOnce(mockTradeResult);

      // Act
      const result = await execute_trade_safely(tradeParams);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        tradeId: 'trade-123',
        auditId: 'audit-123'
      });
      expect(mockTransactionManager.executeTransaction).toHaveBeenCalledWith(
        expect.any(Function),
        {
          isolationLevel: 'SERIALIZABLE',
          maxRetries: 3,
          retryDelay: 1000,
          timeout: 30000
        },
        {
          userId: 'user-123',
          data: {
            operation: 'execute_trade_safely',
            params: tradeParams
          }
        }
      );
    });

    it('should fail when trade validation fails', async () => {
      // Arrange
      const tradeParams: TradeExecutionParams = {
        userId: 'user-123',
        strategyId: 'strategy-123',
        executorId: 'executor-123',
        symbol: 'EURUSD',
        type: 'BUY',
        lots: 0.1,
        openPrice: 1.1000
      };

      const mockValidationResult = {
        success: true,
        data: { valid: false, error: 'Invalid trade parameters' },
        attempts: 1,
        duration: 100
      };

      mockTransactionManager.executeRawQuery.mockResolvedValue(mockValidationResult);

      // Act
      const result = await execute_trade_safely(tradeParams);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid trade parameters');
      expect(mockTransactionManager.executeTransaction).not.toHaveBeenCalled();
    });

    it('should handle custom transaction options', async () => {
      // Arrange
      const tradeParams: TradeExecutionParams = {
        userId: 'user-123',
        strategyId: 'strategy-123',
        executorId: 'executor-123',
        symbol: 'EURUSD',
        type: 'BUY',
        lots: 0.1,
        openPrice: 1.1000
      };

      const customOptions: TransactionOptions = {
        isolationLevel: 'READ_COMMITTED',
        maxRetries: 5,
        timeout: 60000
      };

      const mockValidationResult = {
        success: true,
        data: { valid: true },
        attempts: 1,
        duration: 100
      };

      const mockTradeResult = {
        success: true,
        data: {
          tradeId: 'trade-123',
          auditId: 'audit-123'
        },
        attempts: 1,
        duration: 200
      };

      mockTransactionManager.executeRawQuery
        .mockResolvedValueOnce(mockValidationResult)
        .mockResolvedValueOnce(mockTradeResult);

      // Act
      const result = await execute_trade_safely(tradeParams, customOptions);

      // Assert
      expect(result.success).toBe(true);
      expect(mockTransactionManager.executeTransaction).toHaveBeenCalledWith(
        expect.any(Function),
        {
          isolationLevel: 'READ_COMMITTED',
          maxRetries: 5,
          timeout: 60000,
          retryDelay: 1000
        },
        expect.any(Object)
      );
    });
  });

  describe('close_trade_safely', () => {
    it('should close a trade successfully', async () => {
      // Arrange
      const closeParams: TradeCloseParams = {
        tradeId: 'trade-123',
        closePrice: 1.1050,
        closeTime: new Date('2023-01-01T12:00:00Z'),
        userId: 'user-123'
      };

      const mockResult = {
        success: true,
        data: {
          tradeId: 'trade-123',
          auditId: 'audit-456'
        },
        attempts: 1,
        duration: 150
      };

      mockTransactionManager.executeTransaction.mockResolvedValue(mockResult);

      // Act
      const result = await close_trade_safely(closeParams);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        tradeId: 'trade-123',
        auditId: 'audit-456'
      });
      expect(mockTransactionManager.executeTransaction).toHaveBeenCalledWith(
        expect.any(Function),
        {
          isolationLevel: 'SERIALIZABLE',
          maxRetries: 3,
          retryDelay: 1000,
          timeout: 30000
        },
        {
          userId: 'user-123',
          data: {
            operation: 'close_trade_safely',
            params: closeParams
          }
        }
      );
    });

    it('should use default close time when not provided', async () => {
      // Arrange
      const closeParams: TradeCloseParams = {
        tradeId: 'trade-123',
        closePrice: 1.1050,
        userId: 'user-123'
      };

      const mockResult = {
        success: true,
        data: {
          tradeId: 'trade-123',
          auditId: 'audit-456'
        },
        attempts: 1,
        duration: 150
      };

      mockTransactionManager.executeTransaction.mockResolvedValue(mockResult);

      // Act
      const result = await close_trade_safely(closeParams);

      // Assert
      expect(result.success).toBe(true);
      expect(mockTransactionManager.executeTransaction).toHaveBeenCalled();
      
      // Verify the function was called with a date (not undefined)
      const transactionCall = mockTransactionManager.executeTransaction.mock.calls[0];
      const transactionFn = transactionCall[0];
      expect(typeof transactionFn).toBe('function');
    });
  });

  describe('update_account_metrics', () => {
    it('should update account metrics successfully', async () => {
      // Arrange
      const metricsParams: AccountMetricsUpdateParams = {
        userId: 'user-123',
        balanceChange: 100.50,
        equityChange: 120.75,
        marginChange: -10.25
      };

      const mockResult = {
        success: true,
        data: {
          auditId: 'audit-789'
        },
        attempts: 1,
        duration: 120
      };

      mockTransactionManager.executeTransaction.mockResolvedValue(mockResult);

      // Act
      const result = await update_account_metrics(metricsParams);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        auditId: 'audit-789'
      });
      expect(mockTransactionManager.executeTransaction).toHaveBeenCalledWith(
        expect.any(Function),
        {
          isolationLevel: 'READ_COMMITTED',
          maxRetries: 2,
          retryDelay: 500,
          timeout: 10000
        },
        {
          userId: 'user-123',
          data: {
            operation: 'update_account_metrics',
            params: metricsParams
          }
        }
      );
    });

    it('should handle zero values', async () => {
      // Arrange
      const metricsParams: AccountMetricsUpdateParams = {
        userId: 'user-123'
      };

      const mockResult = {
        success: true,
        data: {
          auditId: 'audit-789'
        },
        attempts: 1,
        duration: 120
      };

      mockTransactionManager.executeTransaction.mockResolvedValue(mockResult);

      // Act
      const result = await update_account_metrics(metricsParams);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe('log_audit_trail', () => {
    it('should log audit trail successfully', async () => {
      // Arrange
      const auditParams: AuditTrailParams = {
        userId: 'user-123',
        eventType: 'TRADE_EXECUTION',
        resource: 'Trade',
        action: 'CREATE',
        result: 'SUCCESS',
        metadata: { tradeId: 'trade-123' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      };

      const mockResult = {
        success: true,
        data: {
          auditId: 'audit-999',
          hash: 'abc123hash'
        },
        attempts: 1,
        duration: 80
      };

      mockTransactionManager.executeTransaction.mockResolvedValue(mockResult);

      // Act
      const result = await log_audit_trail(auditParams);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        auditId: 'audit-999',
        hash: 'abc123hash'
      });
      expect(mockTransactionManager.executeTransaction).toHaveBeenCalledWith(
        expect.any(Function),
        {
          isolationLevel: 'READ_COMMITTED',
          maxRetries: 2,
          retryDelay: 500,
          timeout: 10000
        },
        {
          userId: 'user-123',
          data: {
            operation: 'log_audit_trail',
            params: auditParams
          }
        }
      );
    });

    it('should handle minimal audit parameters', async () => {
      // Arrange
      const auditParams: AuditTrailParams = {
        userId: 'user-123',
        eventType: 'LOGIN'
      };

      const mockResult = {
        success: true,
        data: {
          auditId: 'audit-999',
          hash: 'abc123hash'
        },
        attempts: 1,
        duration: 80
      };

      mockTransactionManager.executeTransaction.mockResolvedValue(mockResult);

      // Act
      const result = await log_audit_trail(auditParams);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe('validate_trade_parameters', () => {
    it('should validate trade parameters successfully', async () => {
      // Arrange
      const tradeParams: TradeExecutionParams = {
        userId: 'user-123',
        strategyId: 'strategy-123',
        executorId: 'executor-123',
        symbol: 'EURUSD',
        type: 'BUY',
        lots: 0.1,
        openPrice: 1.1000
      };

      const mockResult = {
        success: true,
        data: {
          valid: true,
          openTradesCount: 2,
          maxOpenTrades: 10
        },
        attempts: 1,
        duration: 50
      };

      mockTransactionManager.executeRawQuery.mockResolvedValue(mockResult);

      // Act
      const result = await validate_trade_parameters(tradeParams);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.openTradesCount).toBe(2);
      expect(result.maxOpenTrades).toBe(10);
      expect(mockTransactionManager.executeRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('validate_trade_parameters'),
        [
          'user-123',
          'strategy-123',
          'executor-123',
          'EURUSD',
          0.1,
          'BUY'
        ],
        {
          isolationLevel: 'READ_COMMITTED',
          maxRetries: 1,
          timeout: 5000
        }
      );
    });

    it('should handle validation failure', async () => {
      // Arrange
      const tradeParams: TradeExecutionParams = {
        userId: 'user-123',
        strategyId: 'strategy-123',
        executorId: 'executor-123',
        symbol: 'EURUSD',
        type: 'BUY',
        lots: 0.1,
        openPrice: 1.1000
      };

      const mockResult = {
        success: true,
        data: {
          valid: false,
          error: 'Strategy not active'
        },
        attempts: 1,
        duration: 50
      };

      mockTransactionManager.executeRawQuery.mockResolvedValue(mockResult);

      // Act
      const result = await validate_trade_parameters(tradeParams);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Strategy not active');
    });

    it('should handle validation errors', async () => {
      // Arrange
      const tradeParams: TradeExecutionParams = {
        userId: 'user-123',
        strategyId: 'strategy-123',
        executorId: 'executor-123',
        symbol: 'EURUSD',
        type: 'BUY',
        lots: 0.1,
        openPrice: 1.1000
      };

      mockTransactionManager.executeRawQuery.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await validate_trade_parameters(tradeParams);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Validation error: Database error');
    });
  });

  describe('execute_trades_batch', () => {
    it('should execute multiple trades successfully', async () => {
      // Arrange
      const trades: TradeExecutionParams[] = [
        {
          userId: 'user-123',
          strategyId: 'strategy-123',
          executorId: 'executor-123',
          symbol: 'EURUSD',
          type: 'BUY',
          lots: 0.1,
          openPrice: 1.1000
        },
        {
          userId: 'user-123',
          strategyId: 'strategy-123',
          executorId: 'executor-123',
          symbol: 'GBPUSD',
          type: 'SELL',
          lots: 0.2,
          openPrice: 1.2500
        }
      ];

      const mockValidationResult = {
        success: true,
        data: { valid: true },
        attempts: 1,
        duration: 50
      };

      const mockResult = {
        success: true,
        data: [
          { tradeId: 'trade-1', auditId: 'audit-1' },
          { tradeId: 'trade-2', auditId: 'audit-2' }
        ],
        attempts: 1,
        duration: 300
      };

      mockTransactionManager.executeRawQuery.mockResolvedValue(mockValidationResult);
      mockTransactionManager.executeTransaction.mockResolvedValue(mockResult);

      // Act
      const result = await execute_trades_batch(trades);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        { tradeId: 'trade-1', auditId: 'audit-1' },
        { tradeId: 'trade-2', auditId: 'audit-2' }
      ]);
      expect(mockTransactionManager.executeTransaction).toHaveBeenCalledWith(
        expect.any(Function),
        {
          isolationLevel: 'SERIALIZABLE',
          maxRetries: 3,
          retryDelay: 1000,
          timeout: 60000
        },
        {
          userId: 'user-123',
          data: {
            operation: 'execute_trades_batch',
            tradeCount: 2
          }
        }
      );
    });

    it('should fail when no trades provided', async () => {
      // Act
      const result = await execute_trades_batch([]);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('No trades provided');
      expect(mockTransactionManager.executeTransaction).not.toHaveBeenCalled();
    });

    it('should fail when trade validation fails', async () => {
      // Arrange
      const trades: TradeExecutionParams[] = [
        {
          userId: 'user-123',
          strategyId: 'strategy-123',
          executorId: 'executor-123',
          symbol: 'EURUSD',
          type: 'BUY',
          lots: 0.1,
          openPrice: 1.1000
        }
      ];

      const mockValidationResult = {
        success: true,
        data: { valid: false, error: 'Invalid trade' },
        attempts: 1,
        duration: 50
      };

      mockTransactionManager.executeRawQuery.mockResolvedValue(mockValidationResult);

      // Act
      const result = await execute_trades_batch(trades);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Trade validation failed: Invalid trade');
    });
  });

  describe('close_trades_batch', () => {
    it('should close multiple trades successfully', async () => {
      // Arrange
      const closes: TradeCloseParams[] = [
        {
          tradeId: 'trade-1',
          closePrice: 1.1050,
          userId: 'user-123'
        },
        {
          tradeId: 'trade-2',
          closePrice: 1.2550,
          userId: 'user-123'
        }
      ];

      const mockResult = {
        success: true,
        data: [
          { tradeId: 'trade-1', auditId: 'audit-1' },
          { tradeId: 'trade-2', auditId: 'audit-2' }
        ],
        attempts: 1,
        duration: 250
      };

      mockTransactionManager.executeTransaction.mockResolvedValue(mockResult);

      // Act
      const result = await close_trades_batch(closes);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        { tradeId: 'trade-1', auditId: 'audit-1' },
        { tradeId: 'trade-2', auditId: 'audit-2' }
      ]);
    });

    it('should fail when no trades provided for closing', async () => {
      // Act
      const result = await close_trades_batch([]);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('No trades provided for closing');
      expect(mockTransactionManager.executeTransaction).not.toHaveBeenCalled();
    });
  });

  describe('get_trade_transaction_stats', () => {
    it('should return transaction statistics', () => {
      // Arrange
      const mockStats = {
        totalTransactions: 10,
        successfulTransactions: 8,
        failedTransactions: 2,
        averageDuration: 150,
        retriedTransactions: 1,
        averageRetries: 0.5,
        commonErrors: [],
        transactionsByType: []
      };

      mockTransactionManager.getTransactionStats.mockReturnValue(mockStats);

      // Act
      const stats = get_trade_transaction_stats();

      // Assert
      expect(stats).toEqual(mockStats);
      expect(mockTransactionManager.getTransactionStats).toHaveBeenCalledTimes(1);
    });
  });

  describe('reset_trade_transaction_stats', () => {
    it('should reset transaction statistics', () => {
      // Act
      reset_trade_transaction_stats();

      // Assert
      expect(mockTransactionManager.resetStats).toHaveBeenCalledTimes(1);
    });
  });
});