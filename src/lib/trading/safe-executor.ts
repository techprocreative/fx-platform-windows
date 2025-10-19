/**
 * Safe Trade Executor
 * 
 * This module provides the SafeTradeExecutor class that handles trade execution with
 * comprehensive safety mechanisms, including pre-execution validation, retry logic,
 * execution verification, database recording, notifications, and error handling.
 */

import { 
  TradeSignal, 
  ExecutionResult, 
  ExtendedValidationResult, 
  RetryConfig, 
  NotificationConfig, 
  TradeRecord 
} from './types';
import { TradeParams, TradeResult } from '../risk/types';
import { MarketOrder } from '../brokers/types';
import { executionValidator } from './execution-validator';
import { riskManager } from '../risk/risk-manager';
import { logger } from '../monitoring/logger';

/**
 * SafeTradeExecutor class handles safe trade execution with comprehensive safety mechanisms
 */
export class SafeTradeExecutor {
  private defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    initialDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 10000,
    useJitter: true
  };

  private defaultNotificationConfig: NotificationConfig = {
    notifyOnSuccess: true,
    notifyOnFailure: true,
    channels: ['push']
  };

  /**
   * Execute a trade with comprehensive safety mechanisms
   * 
   * @param signal Trade signal to execute
   * @param retryConfig Optional retry configuration
   * @param notificationConfig Optional notification configuration
   * @returns Execution result
   */
  async executeTrade(
    signal: TradeSignal,
    retryConfig?: Partial<RetryConfig>,
    notificationConfig?: Partial<NotificationConfig>
  ): Promise<ExecutionResult> {
    const executionId = this.generateExecutionId();
    const startTime = Date.now();
    const finalRetryConfig = { ...this.defaultRetryConfig, ...retryConfig };
    const finalNotificationConfig = { ...this.defaultNotificationConfig, ...notificationConfig };

    logger.info(`Starting safe trade execution`, {
      executionId,
      signalId: signal.id,
      symbol: signal.symbol,
      type: signal.type,
      lotSize: signal.lotSize
    });

    try {
      // 1. Pre-execution validation
      const validation = await this.preExecutionChecks(signal);
      if (!validation.valid) {
        const errorMessage = `Pre-execution validation failed: ${validation.errors.join(', ')}`;
        logger.error(`Trade execution rejected`, new Error(errorMessage), {
          executionId,
          signalId: signal.id,
          errors: validation.errors
        });
        
        const result: ExecutionResult = {
          id: executionId,
          success: false,
          error: errorMessage,
          timestamp: new Date(),
          executionTime: Date.now() - startTime,
          retryAttempts: 0,
          signal
        };

        // Send failure notification
        await this.notifyExecution(result, finalNotificationConfig);
        return result;
      }

      // 2. Risk management check
      const riskCheck = await riskManager.validateTrade(signal);
      if (!riskCheck.valid) {
        const errorMessage = `Risk limits exceeded: ${riskCheck.errors.join(', ')}`;
        logger.error(`Trade execution rejected`, new Error(errorMessage), {
          executionId,
          signalId: signal.id,
          errors: riskCheck.errors
        });
        
        const result: ExecutionResult = {
          id: executionId,
          success: false,
          error: errorMessage,
          timestamp: new Date(),
          executionTime: Date.now() - startTime,
          retryAttempts: 0,
          signal
        };

        // Send failure notification
        await this.notifyExecution(result, finalNotificationConfig);
        return result;
      }

      // 3. Execute with retry logic
      const result = await this.executeWithRetry(signal, finalRetryConfig, executionId);

      // 4. Verify execution
      if (result.success) {
        await this.verifyExecution(result);
      }

      // 5. Store in database
      await this.recordTrade(result);

      // 6. Send notifications
      await this.notifyExecution(result, finalNotificationConfig);

      logger.info(`Trade execution completed`, {
        executionId,
        success: result.success,
        ticket: result.ticket,
        executionTime: result.executionTime,
        retryAttempts: result.retryAttempts
      });

      return result;
    } catch (error) {
      logger.error(`Trade execution failed`, error as Error, {
        executionId,
        signalId: signal.id
      });

      // Handle failure appropriately
      await this.handleExecutionFailure(signal, error as Error, executionId);

      const result: ExecutionResult = {
        id: executionId,
        success: false,
        error: (error as Error).message,
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        retryAttempts: finalRetryConfig.maxAttempts,
        signal
      };

      // Send failure notification
      await this.notifyExecution(result, finalNotificationConfig);

      return result;
    }
  }

  /**
   * Perform comprehensive pre-execution checks
   * 
   * @param signal Trade signal to validate
   * @returns Extended validation result
   */
  private async preExecutionChecks(signal: TradeSignal): Promise<ExtendedValidationResult> {
    logger.debug(`Performing pre-execution checks`, { signalId: signal.id });
    return await executionValidator.validateExecution(signal);
  }

  /**
   * Execute trade with retry logic
   * 
   * @param signal Trade signal to execute
   * @param retryConfig Retry configuration
   * @param executionId Execution ID for tracking
   * @returns Execution result
   */
  private async executeWithRetry(
    signal: TradeSignal,
    retryConfig: RetryConfig,
    executionId: string
  ): Promise<ExecutionResult> {
    let lastError: Error | null = null;
    let retryAttempts = 0;
    let delay = retryConfig.initialDelay;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        logger.debug(`Executing trade attempt ${attempt}/${retryConfig.maxAttempts}`, {
          executionId,
          signalId: signal.id
        });

        const result = await this.executeSingleTrade(signal, executionId);
        
        if (result.success) {
          return {
            ...result,
            id: executionId,
            retryAttempts: attempt - 1,
            signal
          };
        }

        // If execution failed but no exception thrown, treat as error
        lastError = new Error(result.error || 'Unknown execution error');
        retryAttempts = attempt;
      } catch (error) {
        lastError = error as Error;
        retryAttempts = attempt;
        
        logger.warn(`Trade execution attempt ${attempt} failed`, {
          executionId,
          signalId: signal.id,
          error: (error as Error).message
        });
      }

      // Don't wait after the last attempt
      if (attempt < retryConfig.maxAttempts) {
        // Calculate delay with exponential backoff
        const actualDelay = retryConfig.useJitter 
          ? this.addJitter(delay)
          : delay;
        
        logger.debug(`Waiting ${actualDelay}ms before retry`, {
          executionId,
          signalId: signal.id,
          attempt,
          nextAttempt: attempt + 1
        });
        
        await this.sleep(actualDelay);
        
        // Update delay for next attempt
        delay = Math.min(delay * retryConfig.backoffMultiplier, retryConfig.maxDelay);
      }
    }

    // All attempts failed
    return {
      id: executionId,
      success: false,
      error: lastError?.message || 'All execution attempts failed',
      timestamp: new Date(),
      executionTime: 0,
      retryAttempts,
      signal
    };
  }

  /**
   * Execute a single trade attempt
   * 
   * @param signal Trade signal to execute
   * @param executionId Execution ID for tracking
   * @returns Trade result
   */
  private async executeSingleTrade(signal: TradeSignal, executionId: string): Promise<TradeResult> {
    const startTime = Date.now();
    
    try {
      // Convert trade signal to market order
      const order: MarketOrder = {
        symbol: signal.symbol,
        type: signal.type === 'BUY' ? 0 : 1, // 0-buy, 1-sell
        volume: signal.lotSize,
        price: signal.entryPrice,
        sl: signal.stopLoss,
        tp: signal.takeProfit,
        comment: signal.comment || `SafeExecutor-${executionId}`,
        magic: signal.magicNumber
      };

      // Execute order through broker
      const brokerResult = await this.executeBrokerOrder(order);
      
      const executionTime = Date.now() - startTime;
      
      if (brokerResult.retcode === 10009) { // Trade request successful
        return {
          success: true,
          ticket: brokerResult.order,
          executionPrice: brokerResult.price,
          executedLotSize: brokerResult.volume,
          timestamp: new Date()
        };
      } else {
        return {
          success: false,
          error: `Broker error: ${brokerResult.comment} (code: ${brokerResult.retcode})`,
          timestamp: new Date()
        };
      }
    } catch (error) {
      logger.error(`Single trade execution failed`, error as Error, {
        executionId,
        signalId: signal.id
      });
      
      return {
        success: false,
        error: (error as Error).message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Verify trade execution after submission
   * 
   * @param result Execution result to verify
   */
  private async verifyExecution(result: ExecutionResult): Promise<void> {
    if (!result.success || !result.ticket) {
      logger.warn(`Skipping verification for failed execution`, {
        executionId: result.id,
        success: result.success,
        ticket: result.ticket
      });
      return;
    }

    try {
      logger.debug(`Verifying trade execution`, {
        executionId: result.id,
        ticket: result.ticket
      });

      // Get position details from broker
      const position = await this.getBrokerPosition(result.ticket);
      
      if (!position) {
        throw new Error(`Position not found for ticket ${result.ticket}`);
      }

      // Verify position details match execution result
      if (position.symbol !== result.signal.symbol) {
        throw new Error(`Symbol mismatch: expected ${result.signal.symbol}, got ${position.symbol}`);
      }

      if (Math.abs(position.volume - result.executedLotSize!) > 0.001) {
        throw new Error(`Volume mismatch: expected ${result.executedLotSize}, got ${position.volume}`);
      }

      // Calculate slippage
      const expectedPrice = result.signal.entryPrice;
      const actualPrice = result.executionPrice!;
      const symbolInfo = await this.getSymbolInfo(result.signal.symbol);
      const slippagePips = Math.abs(actualPrice - expectedPrice) / symbolInfo.point;
      
      // Update execution result with verification details
      result.slippage = slippagePips;
      
      logger.info(`Trade execution verified`, {
        executionId: result.id,
        ticket: result.ticket,
        slippage: slippagePips
      });
    } catch (error) {
      logger.error(`Trade execution verification failed`, error as Error, {
        executionId: result.id,
        ticket: result.ticket
      });
      
      // Don't throw error, just log it
      // Execution is still considered successful even if verification fails
    }
  }

  /**
   * Record trade in database
   * 
   * @param result Execution result to record
   */
  private async recordTrade(result: ExecutionResult): Promise<void> {
    try {
      logger.debug(`Recording trade in database`, {
        executionId: result.id,
        success: result.success
      });

      const tradeRecord: TradeRecord = {
        id: this.generateTradeId(),
        userId: result.signal.userId,
        strategyId: result.signal.strategyId,
        ticket: result.ticket,
        symbol: result.signal.symbol,
        type: result.signal.type,
        lotSize: result.signal.lotSize,
        entryPrice: result.executionPrice,
        stopLoss: result.signal.stopLoss,
        takeProfit: result.signal.takeProfit,
        status: result.success ? 'open' : 'failed',
        comment: result.signal.comment,
        magicNumber: result.signal.magicNumber,
        source: result.signal.source,
        executionTime: result.executionTime,
        retryAttempts: result.retryAttempts,
        error: result.error,
        metadata: {
          executionId: result.id,
          signalId: result.signal.id,
          confidence: result.signal.confidence,
          slippage: result.slippage,
          commission: result.commission,
          swap: result.swap
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to database (mock implementation)
      await this.saveTradeToDatabase(tradeRecord);
      
      logger.info(`Trade recorded in database`, {
        executionId: result.id,
        tradeId: tradeRecord.id,
        ticket: result.ticket
      });
    } catch (error) {
      logger.error(`Failed to record trade in database`, error as Error, {
        executionId: result.id
      });
      
      // Don't throw error, just log it
      // Trade execution is still considered successful even if recording fails
    }
  }

  /**
   * Send notifications for trade execution
   * 
   * @param result Execution result to notify about
   * @param config Notification configuration
   */
  private async notifyExecution(result: ExecutionResult, config: NotificationConfig): Promise<void> {
    try {
      const shouldNotify = result.success ? config.notifyOnSuccess : config.notifyOnFailure;
      
      if (!shouldNotify) {
        logger.debug(`Skipping notification`, {
          executionId: result.id,
          success: result.success,
          notifyOnSuccess: config.notifyOnSuccess,
          notifyOnFailure: config.notifyOnFailure
        });
        return;
      }

      logger.debug(`Sending trade execution notifications`, {
        executionId: result.id,
        success: result.success,
        channels: config.channels
      });

      const notificationData = {
        executionId: result.id,
        success: result.success,
        symbol: result.signal.symbol,
        type: result.signal.type,
        lotSize: result.signal.lotSize,
        ticket: result.ticket,
        error: result.error,
        timestamp: result.timestamp,
        executionTime: result.executionTime,
        retryAttempts: result.retryAttempts
      };

      // Send notifications through configured channels
      for (const channel of config.channels) {
        await this.sendNotification(channel, notificationData, result.signal.userId);
      }

      logger.info(`Trade execution notifications sent`, {
        executionId: result.id,
        channels: config.channels
      });
    } catch (error) {
      logger.error(`Failed to send trade execution notifications`, error as Error, {
        executionId: result.id
      });
      
      // Don't throw error, just log it
      // Trade execution is still considered successful even if notifications fail
    }
  }

  /**
   * Handle execution failure
   * 
   * @param signal Original trade signal
   * @param error Error that caused the failure
   * @param executionId Execution ID for tracking
   */
  private async handleExecutionFailure(signal: TradeSignal, error: Error, executionId: string): Promise<void> {
    try {
      logger.error(`Handling trade execution failure`, error, {
        executionId,
        signalId: signal.id,
        errorMessage: error.message
      });

      // Log the failure for audit purposes
      await this.logExecutionFailure(executionId, signal, error);

      // Check if emergency measures are needed
      const criticalErrors = [
        'INSUFFICIENT_MARGIN',
        'INVALID_SYMBOL',
        'MARKET_CLOSED',
        'CONNECTION_FAILED'
      ];

      const isCriticalError = criticalErrors.some(criticalError => 
        error.message.includes(criticalError)
      );

      if (isCriticalError) {
        logger.warn(`Critical error detected, checking emergency measures`, {
          executionId,
          errorType: 'CRITICAL',
          errorMessage: error.message
        });

        // Could trigger emergency procedures here
        // For example, disable trading, notify administrators, etc.
      }

      // Record the failed execution attempt
      const failedRecord: TradeRecord = {
        id: this.generateTradeId(),
        userId: signal.userId,
        strategyId: signal.strategyId,
        symbol: signal.symbol,
        type: signal.type,
        lotSize: signal.lotSize,
        entryPrice: signal.entryPrice,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        status: 'failed',
        comment: signal.comment,
        magicNumber: signal.magicNumber,
        source: signal.source,
        error: error.message,
        metadata: {
          executionId,
          signalId: signal.id,
          confidence: signal.confidence,
          failureReason: error.message
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.saveTradeToDatabase(failedRecord);
    } catch (handlingError) {
      logger.error(`Error handling execution failure`, handlingError as Error, {
        executionId,
        originalError: error.message
      });
    }
  }

  // Helper methods

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTradeId(): string {
    return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addJitter(delay: number): number {
    // Add random jitter of ±25%
    const jitterFactor = 0.25;
    const jitter = delay * jitterFactor * (Math.random() * 2 - 1);
    return Math.max(0, delay + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Mock implementations (would connect to real services)

  private async executeBrokerOrder(order: MarketOrder): Promise<any> {
    // Mock implementation - would execute through actual broker
    return {
      retcode: 10009, // Success
      order: 123456,
      price: order.price || 1.1000,
      volume: order.volume,
      comment: 'Trade executed successfully'
    };
  }

  private async getBrokerPosition(ticket: number): Promise<any> {
    // Mock implementation - would fetch from broker
    return {
      ticket,
      symbol: 'EURUSD',
      volume: 0.1,
      type: 0 // BUY
    };
  }

  private async getSymbolInfo(symbol: string): Promise<any> {
    // Mock implementation - would fetch from broker
    return {
      symbol,
      point: 0.0001,
      digits: 4
    };
  }

  private async saveTradeToDatabase(tradeRecord: TradeRecord): Promise<void> {
    // Mock implementation - would save to actual database
    logger.debug(`Saving trade to database`, { tradeId: tradeRecord.id });
  }

  private async sendNotification(channel: string, data: any, userId: string): Promise<void> {
    // Mock implementation - would send through actual notification service
    logger.debug(`Sending ${channel} notification`, { userId, data });
  }

  private async logExecutionFailure(executionId: string, signal: TradeSignal, error: Error): Promise<void> {
    // Mock implementation - would log to audit system
    logger.debug(`Logging execution failure`, { executionId, signalId: signal.id, error: error.message });
  }
}

// Export singleton instance
export const safeTradeExecutor = new SafeTradeExecutor();