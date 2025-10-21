import { PrismaClient } from '@prisma/client';
import { transactionManager } from './transaction-manager';
import {
  TradeExecutionParams,
  TradeCloseParams,
  TradeValidationResult,
  AccountMetricsUpdateParams,
  AuditTrailParams,
  TransactionResult,
  TransactionOptions
} from './types';

/**
 * Trade transaction functions for safe trade execution with proper transaction handling
 */

/**
 * Execute a trade safely within a database transaction
 * This function ensures atomicity of trade-related operations
 * @param params - Trade execution parameters
 * @param options - Transaction options
 * @returns Promise resolving to TransactionResult with trade ID
 */
export async function execute_trade_safely(
  params: TradeExecutionParams,
  options: TransactionOptions = {}
): Promise<TransactionResult<{ tradeId: string; auditId: string }>> {
  // Validate input parameters
  const validation = await validate_trade_parameters(params);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error || 'Trade validation failed',
      attempts: 0,
      duration: 0
    };
  }

  // Execute trade within a transaction
  return transactionManager.executeTransaction(
    async (tx, context) => {
      // Call the stored procedure for safe trade execution
      const result = await tx.$queryRawUnsafe(
        `SELECT * FROM execute_trade_safely(
          $1::VARCHAR,
          $2::VARCHAR,
          $3::VARCHAR,
          $4::VARCHAR,
          $5::VARCHAR,
          $6::FLOAT,
          $7::FLOAT,
          $8::FLOAT,
          $9::FLOAT,
          $10::INTEGER,
          $11::VARCHAR
        )`,
        params.userId,
        params.strategyId,
        params.executorId,
        params.symbol,
        params.type,
        params.lots,
        params.openPrice,
        params.stopLoss || null,
        params.takeProfit || null,
        params.magicNumber || null,
        params.comment || null
      );

      // Parse the result from the stored procedure
      const tradeResult = Array.isArray(result) && result.length > 0 ? result[0] : result;
      
      if (!tradeResult.success) {
        throw new Error(tradeResult.message || 'Trade execution failed');
      }

      return {
        tradeId: tradeResult.tradeId,
        auditId: tradeResult.auditId
      };
    },
    {
      isolationLevel: 'SERIALIZABLE',
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      ...options
    },
    {
      userId: params.userId,
      data: {
        operation: 'execute_trade_safely',
        params
      }
    }
  );
}

/**
 * Close a trade safely within a database transaction
 * @param params - Trade close parameters
 * @param options - Transaction options
 * @returns Promise resolving to TransactionResult
 */
export async function close_trade_safely(
  params: TradeCloseParams,
  options: TransactionOptions = {}
): Promise<TransactionResult<{ tradeId: string; auditId: string }>> {
  return transactionManager.executeTransaction(
    async (tx, context) => {
      // Call the stored procedure for safe trade closing
      const result = await tx.$queryRawUnsafe(
        `SELECT * FROM close_trade_safely(
          $1::VARCHAR,
          $2::FLOAT,
          $3::TIMESTAMP WITH TIME ZONE,
          $4::VARCHAR
        )`,
        params.tradeId,
        params.closePrice,
        params.closeTime || new Date(),
        params.userId
      );

      // Parse the result from the stored procedure
      const closeResult = Array.isArray(result) && result.length > 0 ? result[0] : result;
      
      if (!closeResult.success) {
        throw new Error(closeResult.message || 'Trade close failed');
      }

      return {
        tradeId: closeResult.tradeId,
        auditId: closeResult.auditId
      };
    },
    {
      isolationLevel: 'SERIALIZABLE',
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      ...options
    },
    {
      userId: params.userId,
      data: {
        operation: 'close_trade_safely',
        params
      }
    }
  );
}

/**
 * Update account metrics safely within a database transaction
 * @param params - Account metrics update parameters
 * @param options - Transaction options
 * @returns Promise resolving to TransactionResult
 */
export async function update_account_metrics(
  params: AccountMetricsUpdateParams,
  options: TransactionOptions = {}
): Promise<TransactionResult<{ auditId: string }>> {
  return transactionManager.executeTransaction(
    async (tx, context) => {
      // Call the stored procedure for safe account metrics update
      const result = await tx.$queryRawUnsafe(
        `SELECT * FROM update_account_metrics(
          $1::VARCHAR,
          $2::FLOAT,
          $3::FLOAT,
          $4::FLOAT
        )`,
        params.userId,
        params.balanceChange || 0,
        params.equityChange || 0,
        params.marginChange || 0
      );

      // Parse the result from the stored procedure
      const updateResult = Array.isArray(result) && result.length > 0 ? result[0] : result;
      
      if (!updateResult.success) {
        throw new Error(updateResult.message || 'Account metrics update failed');
      }

      return {
        auditId: updateResult.auditId
      };
    },
    {
      isolationLevel: 'READ_COMMITTED',
      maxRetries: 2,
      retryDelay: 500,
      timeout: 10000,
      ...options
    },
    {
      userId: params.userId,
      data: {
        operation: 'update_account_metrics',
        params
      }
    }
  );
}

/**
 * Log audit trail with tamper protection
 * @param params - Audit trail parameters
 * @param options - Transaction options
 * @returns Promise resolving to TransactionResult
 */
export async function log_audit_trail(
  params: AuditTrailParams,
  options: TransactionOptions = {}
): Promise<TransactionResult<{ auditId: string; hash: string }>> {
  return transactionManager.executeTransaction(
    async (tx, context) => {
      // Call the stored procedure for audit trail logging
      const result = await tx.$queryRawUnsafe(
        `SELECT * FROM log_audit_trail(
          $1::VARCHAR,
          $2::VARCHAR,
          $3::VARCHAR,
          $4::VARCHAR,
          $5::VARCHAR,
          $6::JSONB,
          $7::VARCHAR,
          $8::VARCHAR
        )`,
        params.userId,
        params.eventType,
        params.resource || null,
        params.action || null,
        params.result || null,
        JSON.stringify(params.metadata || {}),
        params.ipAddress || null,
        params.userAgent || null
      );

      // Parse the result from the stored procedure
      const logResult = Array.isArray(result) && result.length > 0 ? result[0] : result;
      
      if (!logResult.success) {
        throw new Error(logResult.message || 'Audit trail logging failed');
      }

      return {
        auditId: logResult.auditId,
        hash: logResult.hash
      };
    },
    {
      isolationLevel: 'READ_COMMITTED',
      maxRetries: 2,
      retryDelay: 500,
      timeout: 10000,
      ...options
    },
    {
      userId: params.userId,
      data: {
        operation: 'log_audit_trail',
        params
      }
    }
  );
}

/**
 * Validate trade parameters before execution
 * @param params - Trade execution parameters
 * @returns Promise resolving to TradeValidationResult
 */
export async function validate_trade_parameters(
  params: TradeExecutionParams
): Promise<TradeValidationResult> {
  try {
    // Call the validation stored procedure
    const result = await transactionManager.executeRawQuery(
      `SELECT * FROM validate_trade_parameters(
        $1::VARCHAR,
        $2::VARCHAR,
        $3::VARCHAR,
        $4::VARCHAR,
        $5::FLOAT,
        $6::VARCHAR
      )`,
      [
        params.userId,
        params.strategyId,
        params.executorId,
        params.symbol,
        params.lots,
        params.type
      ],
      {
        isolationLevel: 'READ_COMMITTED',
        maxRetries: 1,
        timeout: 5000
      }
    );

    // Parse the result from the stored procedure
    const validationResult = Array.isArray(result.data) && result.data.length > 0 
      ? result.data[0] 
      : result.data;

    if (!validationResult.valid) {
      return {
        valid: false,
        error: validationResult.error
      };
    }

    return {
      valid: true,
      openTradesCount: validationResult.openTradesCount,
      maxOpenTrades: validationResult.maxOpenTrades,
      details: validationResult
    };
  } catch (error) {
    return {
      valid: false,
      error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Execute multiple trades in a batch with transaction safety
 * @param trades - Array of trade execution parameters
 * @param options - Transaction options
 * @returns Promise resolving to TransactionResult with array of trade results
 */
export async function execute_trades_batch(
  trades: TradeExecutionParams[],
  options: TransactionOptions = {}
): Promise<TransactionResult<Array<{ tradeId: string; auditId: string }>>> {
  if (trades.length === 0) {
    return {
      success: false,
      error: 'No trades provided',
      attempts: 0,
      duration: 0
    };
  }

  return transactionManager.executeTransaction(
    async (tx, context) => {
      const results: Array<{ tradeId: string; auditId: string }> = [];
      
      // Execute each trade in sequence within the same transaction
      for (const tradeParams of trades) {
        // Validate trade parameters
        const validation = await validate_trade_parameters(tradeParams);
        if (!validation.valid) {
          throw new Error(`Trade validation failed: ${validation.error}`);
        }

        // Execute trade
        const result = await tx.$queryRawUnsafe(
          `SELECT * FROM execute_trade_safely(
            $1::VARCHAR,
            $2::VARCHAR,
            $3::VARCHAR,
            $4::VARCHAR,
            $5::VARCHAR,
            $6::FLOAT,
            $7::FLOAT,
            $8::FLOAT,
            $9::FLOAT,
            $10::INTEGER,
            $11::VARCHAR
          )`,
          tradeParams.userId,
          tradeParams.strategyId,
          tradeParams.executorId,
          tradeParams.symbol,
          tradeParams.type,
          tradeParams.lots,
          tradeParams.openPrice,
          tradeParams.stopLoss || null,
          tradeParams.takeProfit || null,
          tradeParams.magicNumber || null,
          tradeParams.comment || null
        );

        // Parse the result
        const tradeResult = Array.isArray(result) && result.length > 0 ? result[0] : result;
        
        if (!tradeResult.success) {
          throw new Error(`Trade execution failed: ${tradeResult.message}`);
        }

        results.push({
          tradeId: tradeResult.tradeId,
          auditId: tradeResult.auditId
        });
      }

      return results;
    },
    {
      isolationLevel: 'SERIALIZABLE',
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 60000, // Longer timeout for batch operations
      ...options
    },
    {
      userId: trades[0].userId, // Use first trade's user ID
      data: {
        operation: 'execute_trades_batch',
        tradeCount: trades.length
      }
    }
  );
}

/**
 * Close multiple trades in a batch with transaction safety
 * @param closes - Array of trade close parameters
 * @param options - Transaction options
 * @returns Promise resolving to TransactionResult with array of close results
 */
export async function close_trades_batch(
  closes: TradeCloseParams[],
  options: TransactionOptions = {}
): Promise<TransactionResult<Array<{ tradeId: string; auditId: string }>>> {
  if (closes.length === 0) {
    return {
      success: false,
      error: 'No trades provided for closing',
      attempts: 0,
      duration: 0
    };
  }

  return transactionManager.executeTransaction(
    async (tx, context) => {
      const results: Array<{ tradeId: string; auditId: string }> = [];
      
      // Close each trade in sequence within the same transaction
      for (const closeParams of closes) {
        const result = await tx.$queryRawUnsafe(
          `SELECT * FROM close_trade_safely(
            $1::VARCHAR,
            $2::FLOAT,
            $3::TIMESTAMP WITH TIME ZONE,
            $4::VARCHAR
          )`,
          closeParams.tradeId,
          closeParams.closePrice,
          closeParams.closeTime || new Date(),
          closeParams.userId
        );

        // Parse the result
        const closeResult = Array.isArray(result) && result.length > 0 ? result[0] : result;
        
        if (!closeResult.success) {
          throw new Error(`Trade close failed: ${closeResult.message}`);
        }

        results.push({
          tradeId: closeResult.tradeId,
          auditId: closeResult.auditId
        });
      }

      return results;
    },
    {
      isolationLevel: 'SERIALIZABLE',
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 60000, // Longer timeout for batch operations
      ...options
    },
    {
      userId: closes[0].userId, // Use first close's user ID
      data: {
        operation: 'close_trades_batch',
        tradeCount: closes.length
      }
    }
  );
}

/**
 * Get transaction statistics for trade operations
 * @returns Transaction statistics
 */
export function get_trade_transaction_stats() {
  return transactionManager.getTransactionStats();
}

/**
 * Reset transaction statistics for trade operations
 */
export function reset_trade_transaction_stats() {
  transactionManager.resetStats();
}