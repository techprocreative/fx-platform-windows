/**
 * Types for Database Transaction Safety System
 * Provides interfaces for transaction management, trade execution, and audit logging
 */

export interface TransactionOptions {
  /**
   * Transaction isolation level
   * @default 'READ_COMMITTED'
   */
  isolationLevel?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
  
  /**
   * Maximum time to wait for a lock
   * @default 5000 (5 seconds)
   */
  lockTimeout?: number;
  
  /**
   * Number of retry attempts for transient failures
   * @default 3
   */
  maxRetries?: number;
  
  /**
   * Base delay between retries in milliseconds
   * @default 1000 (1 second)
   */
  retryDelay?: number;
  
  /**
   * Whether to use exponential backoff for retries
   * @default true
   */
  exponentialBackoff?: boolean;
  
  /**
   * Maximum time for transaction to complete
   * @default 30000 (30 seconds)
   */
  timeout?: number;
}

export interface TransactionResult<T = any> {
  /**
   * Whether the transaction was successful
   */
  success: boolean;
  
  /**
   * Result data if successful
   */
  data?: T;
  
  /**
   * Error message if failed
   */
  error?: string;
  
  /**
   * Number of attempts made
   */
  attempts: number;
  
  /**
   * Time taken in milliseconds
   */
  duration: number;
  
  /**
   * Transaction ID for tracking
   */
  transactionId?: string;
  
  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;
}

export interface AuditLog {
  /**
   * Unique identifier for the audit log
   */
  id: string;
  
  /**
   * User ID who performed the action
   */
  userId: string;
  
  /**
   * Type of event (e.g., 'TRADE_EXECUTION', 'ACCOUNT_UPDATE')
   */
  eventType: string;
  
  /**
   * Resource type (e.g., 'Trade', 'User', 'Strategy')
   */
  resource?: string;
  
  /**
   * Action performed (e.g., 'CREATE', 'UPDATE', 'DELETE')
   */
  action?: string;
  
  /**
   * Result of the action (e.g., 'SUCCESS', 'FAILED')
   */
  result?: string;
  
  /**
   * Additional metadata as JSON
   */
  metadata?: Record<string, any>;
  
  /**
   * IP address of the client
   */
  ipAddress?: string;
  
  /**
   * User agent string
   */
  userAgent?: string;
  
  /**
   * Tamper-proof hash
   */
  hash?: string;
  
  /**
   * Timestamp of the event
   */
  timestamp: Date;
}

export interface TradeExecutionParams {
  /**
   * User ID
   */
  userId: string;
  
  /**
   * Strategy ID
   */
  strategyId: string;
  
  /**
   * Executor ID
   */
  executorId: string;
  
  /**
   * Trading symbol (e.g., 'EURUSD')
   */
  symbol: string;
  
  /**
   * Trade type ('BUY' or 'SELL')
   */
  type: 'BUY' | 'SELL';
  
  /**
   * Trade volume in lots
   */
  lots: number;
  
  /**
   * Open price
   */
  openPrice: number;
  
  /**
   * Stop loss price
   */
  stopLoss?: number;
  
  /**
   * Take profit price
   */
  takeProfit?: number;
  
  /**
   * Magic number for trade identification
   */
  magicNumber?: number;
  
  /**
   * Trade comment
   */
  comment?: string;
}

export interface TradeCloseParams {
  /**
   * Trade ID to close
   */
  tradeId: string;
  
  /**
   * Close price
   */
  closePrice: number;
  
  /**
   * Close time (defaults to now)
   */
  closeTime?: Date;
  
  /**
   * User ID for verification
   */
  userId: string;
}

export interface TradeValidationResult {
  /**
   * Whether the parameters are valid
   */
  valid: boolean;
  
  /**
   * Error message if invalid
   */
  error?: string;
  
  /**
   * Current number of open trades
   */
  openTradesCount?: number;
  
  /**
   * Maximum allowed open trades
   */
  maxOpenTrades?: number;
  
  /**
   * Additional validation details
   */
  details?: Record<string, any>;
}

export interface AccountMetricsUpdateParams {
  /**
   * User ID
   */
  userId: string;
  
  /**
   * Change in balance
   */
  balanceChange?: number;
  
  /**
   * Change in equity
   */
  equityChange?: number;
  
  /**
   * Change in margin
   */
  marginChange?: number;
}

export interface AuditTrailParams {
  /**
   * User ID
   */
  userId: string;
  
  /**
   * Event type
   */
  eventType: string;
  
  /**
   * Resource type
   */
  resource?: string;
  
  /**
   * Action performed
   */
  action?: string;
  
  /**
   * Result of the action
   */
  result?: string;
  
  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;
  
  /**
   * IP address
   */
  ipAddress?: string;
  
  /**
   * User agent
   */
  userAgent?: string;
}

export interface TransactionContext {
  /**
   * Unique transaction ID
   */
  transactionId: string;
  
  /**
   * User ID associated with the transaction
   */
  userId?: string;
  
  /**
   * Start time of the transaction
   */
  startTime: Date;
  
  /**
   * Current attempt number
   */
  attempt: number;
  
  /**
   * Maximum allowed attempts
   */
  maxAttempts: number;
  
  /**
   * Transaction options
   */
  options: TransactionOptions;
  
  /**
   * Additional context data
   */
  data?: Record<string, any>;
}

export interface DatabaseError extends Error {
  /**
   * Error code from the database
   */
  code?: string;
  
  /**
   * Severity of the error
   */
  severity?: string;
  
  /**
   * Detail message from the database
   */
  detail?: string;
  
  /**
   * Hint for resolving the error
   */
  hint?: string;
  
  /**
   * Position in the query where error occurred
   */
  position?: string;
  
  /**
   * Internal query that caused the error
   */
  internalQuery?: string;
  
  /**
   * Internal position in the query
   */
  internalPosition?: string;
  
  /**
   * Schema where error occurred
   */
  schema?: string;
  
  /**
   * Table where error occurred
   */
  table?: string;
  
  /**
   * Column where error occurred
   */
  column?: string;
  
  /**
   * Data type name if related to type error
   */
  dataType?: string;
  
  /**
   * Constraint name if constraint violation
   */
  constraint?: string;
  
  /**
   * File where error occurred in PostgreSQL source
   */
  file?: string;
  
  /**
   * Line number in PostgreSQL source
   */
  line?: string;
  
  /**
   * Routine name in PostgreSQL source
   */
  routine?: string;
}

export interface RetryOptions {
  /**
   * Maximum number of retry attempts
   */
  maxAttempts: number;
  
  /**
   * Base delay between retries in milliseconds
   */
  baseDelay: number;
  
  /**
   * Whether to use exponential backoff
   */
  exponentialBackoff: boolean;
  
  /**
   * Maximum delay between retries in milliseconds
   */
  maxDelay?: number;
  
  /**
   * Jitter factor to add randomness to delays
   */
  jitterFactor?: number;
  
  /**
   * Function to determine if an error is retryable
   */
  isRetryable?: (error: any) => boolean;
}

export interface IsolationLevel {
  /**
   * Read uncommitted - lowest isolation level
   */
  READ_UNCOMMITTED: 'READ_UNCOMMITTED';
  
  /**
   * Read committed - default isolation level
   */
  READ_COMMITTED: 'READ_COMMITTED';
  
  /**
   * Repeatable read - ensures consistent reads within transaction
   */
  REPEATABLE_READ: 'REPEATABLE_READ';
  
  /**
   * Serializable - highest isolation level
   */
  SERIALIZABLE: 'SERIALIZABLE';
}

export interface TransactionStats {
  /**
   * Total number of transactions
   */
  totalTransactions: number;
  
  /**
   * Number of successful transactions
   */
  successfulTransactions: number;
  
  /**
   * Number of failed transactions
   */
  failedTransactions: number;
  
  /**
   * Average transaction duration in milliseconds
   */
  averageDuration: number;
  
  /**
   * Number of transactions that required retries
   */
  retriedTransactions: number;
  
  /**
   * Average number of retries per transaction
   */
  averageRetries: number;
  
  /**
   * Most common error types
   */
  commonErrors: Array<{
    error: string;
    count: number;
  }>;
  
  /**
   * Transactions by type
   */
  transactionsByType: Array<{
    type: string;
    count: number;
    successRate: number;
  }>;
}