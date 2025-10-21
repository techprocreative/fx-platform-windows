import { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  TransactionOptions,
  TransactionResult,
  TransactionContext,
  DatabaseError,
  RetryOptions,
  TransactionStats
} from './types';

/**
 * TransactionManager class for managing database transactions with Prisma
 * Provides retry logic, error handling, and transaction safety
 */
export class TransactionManager {
  private prisma: PrismaClient;
  private stats: TransactionStats = {
    totalTransactions: 0,
    successfulTransactions: 0,
    failedTransactions: 0,
    averageDuration: 0,
    retriedTransactions: 0,
    averageRetries: 0,
    commonErrors: [],
    transactionsByType: []
  };
  private activeTransactions: Map<string, TransactionContext> = new Map();

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient({
      log: ['error', 'warn'],
    });
  }

  /**
   * Execute a function within a database transaction with retry logic
   * @param fn - Function to execute within the transaction
   * @param options - Transaction options
   * @param context - Additional context for the transaction
   * @returns Promise resolving to TransactionResult
   */
  async executeTransaction<T>(
    fn: (tx: Prisma.TransactionClient, context: TransactionContext) => Promise<T>,
    options: TransactionOptions = {},
    context?: Partial<TransactionContext>
  ): Promise<TransactionResult<T>> {
    const transactionId = context?.transactionId || randomUUID();
    const startTime = new Date();
    const maxRetries = options.maxRetries || 3;
    const baseDelay = options.retryDelay || 1000;
    const useExponentialBackoff = options.exponentialBackoff !== false;
    const timeout = options.timeout || 30000;

    // Create transaction context
    const txContext: TransactionContext = {
      transactionId,
      userId: context?.userId,
      startTime,
      attempt: 1,
      maxAttempts: maxRetries + 1,
      options: {
        isolationLevel: 'READ_COMMITTED',
        lockTimeout: 5000,
        maxRetries: 3,
        retryDelay: 1000,
        exponentialBackoff: true,
        timeout: 30000,
        ...options
      },
      data: context?.data
    };

    // Track active transaction
    this.activeTransactions.set(transactionId, txContext);
    this.stats.totalTransactions++;

    let lastError: any;
    let attempts = 0;

    try {
      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        attempts = attempt;
        txContext.attempt = attempt;

        try {
          // Execute transaction with timeout
          const result = await this.executeWithTimeout<T>(
            async () => {
              return await this.prisma.$transaction(
                async (tx) => {
                  // Set isolation level if specified
                  if (options.isolationLevel && options.isolationLevel !== 'READ_COMMITTED') {
                    await tx.$executeRaw`SET TRANSACTION ISOLATION LEVEL ${Prisma.raw(options.isolationLevel)}`;
                  }

                  // Set lock timeout if specified
                  if (options.lockTimeout) {
                    await tx.$executeRaw`SET LOCAL lock_timeout = ${options.lockTimeout}`;
                  }

                  // Execute the user function
                  return await fn(tx, txContext);
                },
                {
                  timeout: timeout,
                  isolationLevel: options.isolationLevel as Prisma.TransactionIsolationLevel
                }
              );
            },
            timeout
          );

          // Update stats on success
          const duration = Date.now() - startTime.getTime();
          this.updateStatsOnSuccess(duration, attempts > 1, attempts - 1);

          // Remove from active transactions
          this.activeTransactions.delete(transactionId);

          return {
            success: true,
            data: result,
            attempts,
            duration,
            transactionId,
            metadata: {
              isolationLevel: options.isolationLevel,
              lockTimeout: options.lockTimeout
            }
          };
        } catch (error) {
          lastError = error;
          
          // Check if error is retryable
          if (attempt <= maxRetries && this.isRetryableError(error)) {
            const delay = this.calculateDelay(
              baseDelay,
              attempt,
              useExponentialBackoff
            );
            
            // Log retry attempt
            console.warn(
              `Transaction ${transactionId} failed (attempt ${attempt}/${maxRetries + 1}), retrying in ${delay}ms:`,
              error
            );
            
            // Wait before retry
            await this.sleep(delay);
            continue;
          }
          
          // Not retryable or max attempts reached
          break;
        }
      }

      // All attempts failed
      const duration = Date.now() - startTime.getTime();
      this.updateStatsOnFailure(lastError);
      
      // Remove from active transactions
      this.activeTransactions.delete(transactionId);

      return {
        success: false,
        error: this.formatError(lastError),
        attempts,
        duration,
        transactionId
      };
    } catch (error) {
      // Unexpected error
      const duration = Date.now() - startTime.getTime();
      this.updateStatsOnFailure(error);
      
      // Remove from active transactions
      this.activeTransactions.delete(transactionId);

      return {
        success: false,
        error: this.formatError(error),
        attempts,
        duration,
        transactionId
      };
    }
  }

  /**
   * Execute a raw SQL query within a transaction
   * @param query - SQL query to execute
   * @param params - Query parameters
   * @param options - Transaction options
   * @returns Promise resolving to TransactionResult
   */
  async executeRawQuery<T = any>(
    query: string,
    params: any[] = [],
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T>> {
    return this.executeTransaction<T>(
      async (tx) => {
        const result = await tx.$queryRawUnsafe<T>(query, ...params);
        return result;
      },
      options,
      { data: { query, params } }
    );
  }

  /**
   * Execute a stored procedure
   * @param procedureName - Name of the stored procedure
   * @param params - Parameters for the stored procedure
   * @param options - Transaction options
   * @returns Promise resolving to TransactionResult
   */
  async executeStoredProcedure<T = any>(
    procedureName: string,
    params: any[] = [],
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T>> {
    const paramPlaceholders = params.map((_, index) => `$${index + 1}`).join(', ');
    const query = `SELECT * FROM ${procedureName}(${paramPlaceholders})`;
    
    return this.executeTransaction<T>(
      async (tx) => {
        const result = await tx.$queryRawUnsafe<T>(query, ...params);
        return result;
      },
      options,
      { data: { procedure: procedureName, params } }
    );
  }

  /**
   * Begin a manual transaction (for complex operations)
   * @param options - Transaction options
   * @returns Promise resolving to transaction context and client
   */
  async beginTransaction(
    options: TransactionOptions = {}
  ): Promise<{
    context: TransactionContext;
    tx: Prisma.TransactionClient;
    commit: () => Promise<void>;
    rollback: () => Promise<void>;
  }> {
    const transactionId = randomUUID();
    const startTime = new Date();
    
    const context: TransactionContext = {
      transactionId,
      startTime,
      attempt: 1,
      maxAttempts: 1,
      options: {
        isolationLevel: 'READ_COMMITTED',
        lockTimeout: 5000,
        maxRetries: 0,
        retryDelay: 1000,
        exponentialBackoff: true,
        timeout: 30000,
        ...options
      }
    };

    this.activeTransactions.set(transactionId, context);
    this.stats.totalTransactions++;

    try {
      // Prisma doesn't have a direct $begin method, so we'll use $transaction with a manual handler
      let txRef: Prisma.TransactionClient | null = null;
      let committed = false;
      let rolledBack = false;
      
      const result = await this.prisma.$transaction(async (tx) => {
        txRef = tx;
        // Wait for manual commit/rollback
        return new Promise<void>((resolve, reject) => {
          const checkStatus = () => {
            if (committed) {
              resolve();
            } else if (rolledBack) {
              reject(new Error('Transaction rolled back'));
            } else {
              setTimeout(checkStatus, 100);
            }
          };
          checkStatus();
        });
      });
      
      return {
        context,
        tx: txRef!,
        commit: async () => {
          committed = true;
          this.activeTransactions.delete(transactionId);
          this.stats.successfulTransactions++;
        },
        rollback: async () => {
          rolledBack = true;
          this.activeTransactions.delete(transactionId);
          this.stats.failedTransactions++;
        }
      };
    } catch (error) {
      this.activeTransactions.delete(transactionId);
      this.stats.failedTransactions++;
      throw error;
    }
  }

  /**
   * Get information about active transactions
   * @returns Array of active transaction contexts
   */
  getActiveTransactions(): TransactionContext[] {
    return Array.from(this.activeTransactions.values());
  }

  /**
   * Get transaction statistics
   * @returns TransactionStats object
   */
  getTransactionStats(): TransactionStats {
    return { ...this.stats };
  }

  /**
   * Reset transaction statistics
   */
  resetStats(): void {
    this.stats = {
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      averageDuration: 0,
      retriedTransactions: 0,
      averageRetries: 0,
      commonErrors: [],
      transactionsByType: []
    };
  }

  /**
   * Check if a transaction error is retryable
   * @param error - Error to check
   * @returns Boolean indicating if error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Prisma transaction errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Retryable error codes
      const retryableCodes = [
        'P0001', // Transaction rollback
        'P0002', // No data found
        'P0003', // Too many connections
        'P0004', // Connection timeout
        'P2002', // Unique constraint violation (might be transient)
        'P2024', // Connection timed out
        'P2025', // Record not found
      ];
      return retryableCodes.includes(error.code);
    }

    // Network errors
    if (error.name === 'ConnectionError' || 
        error.name === 'TimeoutError' ||
        error.message?.includes('connection') ||
        error.message?.includes('timeout')) {
      return true;
    }

    // Deadlock errors
    if (error.message?.includes('deadlock') ||
        error.message?.includes('lock timeout')) {
      return true;
    }

    // Database connection errors
    if (error.message?.includes('database') &&
        error.message?.includes('connection')) {
      return true;
    }

    return false;
  }

  /**
   * Calculate delay between retries with optional exponential backoff
   * @param baseDelay - Base delay in milliseconds
   * @param attempt - Current attempt number
   * @param exponentialBackoff - Whether to use exponential backoff
   * @returns Delay in milliseconds
   */
  private calculateDelay(
    baseDelay: number,
    attempt: number,
    exponentialBackoff: boolean
  ): number {
    if (exponentialBackoff) {
      // Exponential backoff with jitter
      const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
      return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
    }
    return baseDelay;
  }

  /**
   * Execute a function with timeout
   * @param fn - Function to execute
   * @param timeout - Timeout in milliseconds
   * @returns Promise resolving to function result
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Transaction timeout after ${timeout}ms`));
      }, timeout);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Sleep for specified milliseconds
   * @param ms - Milliseconds to sleep
   * @returns Promise that resolves after specified time
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Format error for consistent output
   * @param error - Error to format
   * @returns Formatted error message
   */
  private formatError(error: any): string {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return `Database error (${error.code}): ${error.message}`;
    }
    
    if (error instanceof Prisma.PrismaClientUnknownRequestError) {
      return `Unknown database error: ${error.message}`;
    }
    
    if (error instanceof Prisma.PrismaClientRustPanicError) {
      return `Database panic: ${error.message}`;
    }
    
    if (error instanceof Prisma.PrismaClientInitializationError) {
      return `Database initialization error: ${error.message}`;
    }
    
    if (error instanceof Prisma.PrismaClientValidationError) {
      return `Database validation error: ${error.message}`;
    }
    
    return error?.message || error?.toString() || 'Unknown error';
  }

  /**
   * Update statistics on successful transaction
   * @param duration - Transaction duration in milliseconds
   * @param wasRetried - Whether transaction was retried
   * @param retryCount - Number of retries
   */
  private updateStatsOnSuccess(duration: number, wasRetried: boolean, retryCount: number): void {
    this.stats.successfulTransactions++;
    
    // Update average duration
    const totalDuration = this.stats.averageDuration * (this.stats.successfulTransactions - 1) + duration;
    this.stats.averageDuration = totalDuration / this.stats.successfulTransactions;
    
    // Update retry stats
    if (wasRetried) {
      this.stats.retriedTransactions++;
      
      // Update average retries
      const totalRetries = this.stats.averageRetries * (this.stats.retriedTransactions - 1) + retryCount;
      this.stats.averageRetries = totalRetries / this.stats.retriedTransactions;
    }
  }

  /**
   * Update statistics on failed transaction
   * @param error - Error that caused the failure
   */
  private updateStatsOnFailure(error: any): void {
    this.stats.failedTransactions++;
    
    // Track common errors
    const errorMessage = this.formatError(error);
    const existingError = this.stats.commonErrors.find(e => e.error === errorMessage);
    
    if (existingError) {
      existingError.count++;
    } else {
      this.stats.commonErrors.push({ error: errorMessage, count: 1 });
    }
    
    // Keep only top 10 errors
    this.stats.commonErrors.sort((a, b) => b.count - a.count);
    if (this.stats.commonErrors.length > 10) {
      this.stats.commonErrors = this.stats.commonErrors.slice(0, 10);
    }
  }

  /**
   * Close the transaction manager and clean up resources
   */
  async close(): Promise<void> {
    // Wait for all active transactions to complete or timeout
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.activeTransactions.size > 0 && Date.now() - startTime < maxWaitTime) {
      await this.sleep(1000);
    }
    
    // Force close remaining transactions
    if (this.activeTransactions.size > 0) {
      console.warn(`Force closing ${this.activeTransactions.size} active transactions`);
      this.activeTransactions.clear();
    }
    
    // Disconnect Prisma client if we created it
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
  }
}

// Export singleton instance
export const transactionManager = new TransactionManager();