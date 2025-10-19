import { PrismaClient, Prisma } from '@prisma/client';
import { TransactionManager } from '../transaction-manager';
import { TransactionOptions, TransactionContext } from '../types';

// Mock Prisma Client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $transaction: jest.fn(),
    $queryRawUnsafe: jest.fn(),
    $executeRaw: jest.fn(),
    $disconnect: jest.fn(),
  })),
  Prisma: {
    TransactionIsolationLevel: {
      ReadUncommitted: 'ReadUncommitted',
      ReadCommitted: 'ReadCommitted',
      RepeatableRead: 'RepeatableRead',
      Serializable: 'Serializable',
    },
    PrismaClientKnownRequestError: jest.fn().mockImplementation((message, meta) => {
      const error = new Error(message) as any;
      error.code = meta.code;
      error.name = 'PrismaClientKnownRequestError';
      return error;
    }),
    PrismaClientUnknownRequestError: jest.fn().mockImplementation((message) => {
      const error = new Error(message) as any;
      error.name = 'PrismaClientUnknownRequestError';
      return error;
    }),
    PrismaClientRustPanicError: jest.fn().mockImplementation((message) => {
      const error = new Error(message) as any;
      error.name = 'PrismaClientRustPanicError';
      return error;
    }),
    PrismaClientInitializationError: jest.fn().mockImplementation((message) => {
      const error = new Error(message) as any;
      error.name = 'PrismaClientInitializationError';
      return error;
    }),
    PrismaClientValidationError: jest.fn().mockImplementation((message) => {
      const error = new Error(message) as any;
      error.name = 'PrismaClientValidationError';
      return error;
    }),
  },
}));

// Mock crypto for UUID generation
jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('test-uuid-12345'),
}));

describe('TransactionManager', () => {
  let transactionManager: TransactionManager;
  let mockPrismaClient: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    // Create a fresh instance for each test
    mockPrismaClient = new PrismaClient() as jest.Mocked<PrismaClient>;
    transactionManager = new TransactionManager(mockPrismaClient);
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('executeTransaction', () => {
    it('should execute a transaction successfully', async () => {
      // Arrange
      const mockResult = { id: '1', name: 'Test' };
      const mockFunction = jest.fn().mockResolvedValue(mockResult);
      mockPrismaClient.$transaction.mockResolvedValue(mockResult);

      const options: TransactionOptions = {
        isolationLevel: 'READ_COMMITTED',
        maxRetries: 2,
      };

      // Act
      const result = await transactionManager.executeTransaction(mockFunction, options);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(result.attempts).toBe(1);
      expect(result.transactionId).toBe('test-uuid-12345');
      expect(mockPrismaClient.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrismaClient.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        {
          isolationLevel: 'ReadCommitted',
          timeout: 30000,
        }
      );
    });

    it('should retry on retryable errors', async () => {
      // Arrange
      const mockResult = { id: '1', name: 'Test' };
      const mockFunction = jest.fn().mockResolvedValue(mockResult);
      
      // First call fails with retryable error, second succeeds
      mockPrismaClient.$transaction
        .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('Connection timeout', { code: 'P2024' }))
        .mockResolvedValueOnce(mockResult);

      const options: TransactionOptions = {
        maxRetries: 2,
        retryDelay: 100, // Short delay for testing
      };

      // Act
      const result = await transactionManager.executeTransaction(mockFunction, options);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(result.attempts).toBe(2);
      expect(mockPrismaClient.$transaction).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries on retryable errors', async () => {
      // Arrange
      const mockFunction = jest.fn().mockResolvedValue({ id: '1' });
      const retryableError = new Prisma.PrismaClientKnownRequestError('Connection timeout', { code: 'P2024' });
      
      // All calls fail with retryable error
      mockPrismaClient.$transaction.mockRejectedValue(retryableError);

      const options: TransactionOptions = {
        maxRetries: 2,
        retryDelay: 10, // Very short delay for testing
      };

      // Act
      const result = await transactionManager.executeTransaction(mockFunction, options);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error (P2024): Connection timeout');
      expect(result.attempts).toBe(3); // 1 initial + 2 retries
      expect(mockPrismaClient.$transaction).toHaveBeenCalledTimes(3);
    });

    it('should fail immediately on non-retryable errors', async () => {
      // Arrange
      const mockFunction = jest.fn().mockResolvedValue({ id: '1' });
      const nonRetryableError = new Error('Validation failed');
      
      mockPrismaClient.$transaction.mockRejectedValue(nonRetryableError);

      const options: TransactionOptions = {
        maxRetries: 2,
        retryDelay: 10,
      };

      // Act
      const result = await transactionManager.executeTransaction(mockFunction, options);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation failed');
      expect(result.attempts).toBe(1);
      expect(mockPrismaClient.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should handle timeout errors', async () => {
      // Arrange
      const mockFunction = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 2000)) // Longer than timeout
      );
      
      mockPrismaClient.$transaction.mockImplementation((fn) => fn());

      const options: TransactionOptions = {
        timeout: 100, // Very short timeout for testing
      };

      // Act
      const result = await transactionManager.executeTransaction(mockFunction, options);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Transaction timeout after 100ms');
    });

    it('should use exponential backoff for retries', async () => {
      // Arrange
      const mockResult = { id: '1' };
      const mockFunction = jest.fn().mockResolvedValue(mockResult);
      
      // First two calls fail, third succeeds
      mockPrismaClient.$transaction
        .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('Connection timeout', { code: 'P2024' }))
        .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('Connection timeout', { code: 'P2024' }))
        .mockResolvedValueOnce(mockResult);

      const options: TransactionOptions = {
        maxRetries: 3,
        retryDelay: 10,
        exponentialBackoff: true,
      };

      const startTime = Date.now();

      // Act
      const result = await transactionManager.executeTransaction(mockFunction, options);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Assert
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      
      // With exponential backoff, delays should be: 10ms, 20ms
      // Total time should be at least 30ms for retries
      expect(duration).toBeGreaterThan(25);
      expect(mockPrismaClient.$transaction).toHaveBeenCalledTimes(3);
    });

    it('should update statistics on successful transaction', async () => {
      // Arrange
      const mockResult = { id: '1' };
      const mockFunction = jest.fn().mockResolvedValue(mockResult);
      mockPrismaClient.$transaction.mockResolvedValue(mockResult);

      // Act
      await transactionManager.executeTransaction(mockFunction);
      
      const stats = transactionManager.getTransactionStats();

      // Assert
      expect(stats.totalTransactions).toBe(1);
      expect(stats.successfulTransactions).toBe(1);
      expect(stats.failedTransactions).toBe(0);
    });

    it('should update statistics on failed transaction', async () => {
      // Arrange
      const mockFunction = jest.fn().mockResolvedValue({ id: '1' });
      mockPrismaClient.$transaction.mockRejectedValue(new Error('Test error'));

      // Act
      await transactionManager.executeTransaction(mockFunction);
      
      const stats = transactionManager.getTransactionStats();

      // Assert
      expect(stats.totalTransactions).toBe(1);
      expect(stats.successfulTransactions).toBe(0);
      expect(stats.failedTransactions).toBe(1);
    });
  });

  describe('executeRawQuery', () => {
    it('should execute a raw query successfully', async () => {
      // Arrange
      const mockResult = [{ id: '1', name: 'Test' }];
      mockPrismaClient.$transaction.mockImplementation(async (fn) => {
        const mockTx = {
          $queryRawUnsafe: jest.fn().mockResolvedValue(mockResult),
        } as any;
        return await fn(mockTx, {} as TransactionContext);
      });

      const query = 'SELECT * FROM "User" WHERE id = $1';
      const params = ['user-123'];

      // Act
      const result = await transactionManager.executeRawQuery(query, params);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
    });
  });

  describe('executeStoredProcedure', () => {
    it('should execute a stored procedure successfully', async () => {
      // Arrange
      const mockResult = [{ success: true, data: 'test' }];
      mockPrismaClient.$transaction.mockImplementation(async (fn) => {
        const mockTx = {
          $queryRawUnsafe: jest.fn().mockResolvedValue(mockResult),
        } as any;
        return await fn(mockTx, {} as TransactionContext);
      });

      const procedureName = 'test_procedure';
      const params = ['param1', 'param2'];

      // Act
      const result = await transactionManager.executeStoredProcedure(procedureName, params);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
    });
  });

  describe('getActiveTransactions', () => {
    it('should return active transactions', async () => {
      // Arrange
      const mockFunction = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ id: '1' }), 100))
      );
      
      mockPrismaClient.$transaction.mockImplementation((fn) => fn());

      // Start a transaction but don't await it
      const transactionPromise = transactionManager.executeTransaction(mockFunction, {
        timeout: 200
      });

      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Act
      const activeTransactions = transactionManager.getActiveTransactions();

      // Assert
      expect(activeTransactions).toHaveLength(1);
      expect(activeTransactions[0].transactionId).toBe('test-uuid-12345');

      // Wait for transaction to complete
      await transactionPromise;
    });
  });

  describe('getTransactionStats', () => {
    it('should return transaction statistics', () => {
      // Act
      const stats = transactionManager.getTransactionStats();

      // Assert
      expect(stats).toHaveProperty('totalTransactions');
      expect(stats).toHaveProperty('successfulTransactions');
      expect(stats).toHaveProperty('failedTransactions');
      expect(stats).toHaveProperty('averageDuration');
      expect(stats).toHaveProperty('retriedTransactions');
      expect(stats).toHaveProperty('averageRetries');
      expect(stats).toHaveProperty('commonErrors');
      expect(stats).toHaveProperty('transactionsByType');
    });
  });

  describe('resetStats', () => {
    it('should reset transaction statistics', async () => {
      // Arrange
      const mockFunction = jest.fn().mockResolvedValue({ id: '1' });
      mockPrismaClient.$transaction.mockResolvedValue({ id: '1' });
      
      // Execute a transaction to generate stats
      await transactionManager.executeTransaction(mockFunction);
      
      // Verify stats are not empty
      let stats = transactionManager.getTransactionStats();
      expect(stats.totalTransactions).toBe(1);

      // Act
      transactionManager.resetStats();
      
      // Assert
      stats = transactionManager.getTransactionStats();
      expect(stats.totalTransactions).toBe(0);
      expect(stats.successfulTransactions).toBe(0);
      expect(stats.failedTransactions).toBe(0);
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable Prisma errors', async () => {
      // Arrange
      const retryableErrors = [
        new Prisma.PrismaClientKnownRequestError('Connection timeout', 'P2024'),
        new Prisma.PrismaClientKnownRequestError('Connection lost', 'P0001'),
        new Prisma.PrismaClientKnownRequestError('Deadlock', 'P0002'),
      ];

      for (const error of retryableErrors) {
        mockPrismaClient.$transaction.mockRejectedValueOnce(error);
        
        // Act
        const result = await transactionManager.executeTransaction(jest.fn(), {
          maxRetries: 1,
          retryDelay: 10,
        });

        // Assert
        expect(result.attempts).toBe(2); // Should have retried
      }
    });

    it('should not retry non-retryable errors', async () => {
      // Arrange
      const nonRetryableErrors = [
        new Prisma.PrismaClientKnownRequestError('Unique constraint', 'P2002'),
        new Prisma.PrismaClientValidationError('Invalid data'),
        new Error('Application error'),
      ];

      for (const error of nonRetryableErrors) {
        mockPrismaClient.$transaction.mockRejectedValueOnce(error);
        
        // Act
        const result = await transactionManager.executeTransaction(jest.fn(), {
          maxRetries: 2,
          retryDelay: 10,
        });

        // Assert
        expect(result.attempts).toBe(1); // Should not have retried
      }
    });
  });

  describe('close', () => {
    it('should close the transaction manager and disconnect Prisma', async () => {
      // Act
      await transactionManager.close();

      // Assert
      expect(mockPrismaClient.$disconnect).toHaveBeenCalledTimes(1);
    });

    it('should wait for active transactions to complete before closing', async () => {
      // Arrange
      const mockFunction = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ id: '1' }), 50))
      );
      
      mockPrismaClient.$transaction.mockImplementation((fn) => fn());

      // Start a transaction
      const transactionPromise = transactionManager.executeTransaction(mockFunction, {
        timeout: 100
      });

      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Act - Start closing before transaction completes
      const closePromise = transactionManager.close();

      // Both should complete successfully
      await Promise.all([transactionPromise, closePromise]);

      // Assert
      expect(mockPrismaClient.$disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('error formatting', () => {
    it('should format different types of errors correctly', async () => {
      // Arrange
      const errors = [
        new Prisma.PrismaClientKnownRequestError('Known error', 'P2024'),
        new Prisma.PrismaClientUnknownRequestError('Unknown error'),
        new Prisma.PrismaClientRustPanicError('Panic error'),
        new Prisma.PrismaClientInitializationError('Init error'),
        new Prisma.PrismaClientValidationError('Validation error'),
        new Error('Generic error'),
      ];

      for (const error of errors) {
        mockPrismaClient.$transaction.mockRejectedValueOnce(error);
        
        // Act
        const result = await transactionManager.executeTransaction(jest.fn());

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error).not.toBe('');
      }
    });
  });
});