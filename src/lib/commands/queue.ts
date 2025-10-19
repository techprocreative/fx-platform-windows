/**
 * COMMAND QUEUE SERVICE
 * Manages trade commands between Brain (Web) and Executor (Windows)
 * DO NOT DELETE - CRITICAL ARCHITECTURE COMPONENT
 */

import Bull from 'bull';
import Redis from 'ioredis';
import { prisma } from '../prisma';

export interface TradeCommand {
  id: string;
  strategyId: string;
  executorId?: string;
  type: 'TRADE_SIGNAL' | 'RISK_UPDATE' | 'EMERGENCY_STOP' | 'STATUS_REQUEST';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  command: {
    action: 'OPEN_POSITION' | 'CLOSE_POSITION' | 'MODIFY_POSITION' | 'CLOSE_ALL';
    symbol?: string;
    type?: 'BUY' | 'SELL';
    volume?: number;
    ticket?: number;
    stopLoss?: number;
    takeProfit?: number;
    magicNumber?: number;
    comment?: string;
  };
  timestamp: Date;
  expiry?: number; // ms until command expires
  retryCount?: number;
  maxRetries?: number;
}

export interface CommandResult {
  commandId: string;
  success: boolean;
  executorId: string;
  result?: {
    ticket?: number;
    openPrice?: number;
    closePrice?: number;
    profit?: number;
    executionTime?: number;
    slippage?: number;
  };
  error?: {
    code: string;
    message: string;
  };
  timestamp: Date;
}

export class CommandQueueService {
  private commandQueue: Bull.Queue;
  private resultQueue: Bull.Queue;
  private redis: Redis;

  constructor() {
    // Initialize Redis connection
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });

    // Initialize command queue
    this.commandQueue = new Bull('trade-commands', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    });

    // Initialize result queue
    this.resultQueue = new Bull('command-results', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    });

    this.setupQueueProcessors();
  }

  /**
   * Add command to queue
   */
  async push(command: TradeCommand): Promise<void> {
    try {
      // Save command to database
      await prisma.command.create({
        data: {
          id: command.id,
          userId: command.strategyId, // Will need to get userId from strategy
          executorId: command.executorId || '',
          command: command.type,
          parameters: command.command as any,
          priority: command.priority,
          status: 'pending',
        },
      });

      // Add to queue with priority
      const priority = this.getPriorityValue(command.priority);
      await this.commandQueue.add('process-command', command, {
        priority,
        attempts: command.maxRetries || 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: false,
        removeOnFail: false,
      });

      // Set expiry in Redis if specified
      if (command.expiry) {
        await this.redis.setex(
          `command:expiry:${command.id}`,
          Math.ceil(command.expiry / 1000),
          'expired'
        );
      }
    } catch (error) {
      console.error('Failed to push command:', error);
      throw error;
    }
  }

  /**
   * Get next command for executor
   */
  async pop(executorId: string): Promise<TradeCommand | null> {
    try {
      // Get jobs waiting in queue
      const waitingJobs = await this.commandQueue.getWaiting();
      
      for (const job of waitingJobs) {
        const command = job.data as TradeCommand;
        
        // Check if command is for this executor or any executor
        if (!command.executorId || command.executorId === executorId) {
          // Check if command has expired
          const isExpired = await this.redis.get(`command:expiry:${command.id}`);
          if (isExpired) {
            await this.markCommandFailed(command.id, 'Command expired');
            await job.remove();
            continue;
          }

          // Move job to active state
          await job.moveToCompleted('processing', true);
          
          // Update database
          await prisma.command.update({
            where: { id: command.id },
            data: {
              status: 'executing',
              executorId,
              acknowledgedAt: new Date(),
            },
          });

          return command;
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to pop command:', error);
      return null;
    }
  }

  /**
   * Acknowledge command execution
   */
  async acknowledge(commandId: string, result: CommandResult): Promise<void> {
    try {
      // Update command in database
      await prisma.command.update({
        where: { id: commandId },
        data: {
          status: result.success ? 'executed' : 'failed',
          result: result as any,
          executedAt: new Date(),
        },
      });

      // Add result to result queue for processing
      await this.resultQueue.add('process-result', result);

      // Clean up expiry key
      await this.redis.del(`command:expiry:${commandId}`);
    } catch (error) {
      console.error('Failed to acknowledge command:', error);
      throw error;
    }
  }

  /**
   * Retry failed command
   */
  async retry(commandId: string): Promise<void> {
    try {
      const command = await prisma.command.findUnique({
        where: { id: commandId },
      });

      if (!command) {
        throw new Error('Command not found');
      }

      const retryCommand: TradeCommand = {
        id: commandId,
        strategyId: command.userId, // Adjust based on your schema
        executorId: command.executorId || undefined,
        type: command.command as any,
        priority: command.priority as any,
        command: command.parameters as any,
        timestamp: new Date(),
        retryCount: (command.retry_count || 0) + 1,
        maxRetries: 3,
      };

      await this.push(retryCommand);
    } catch (error) {
      console.error('Failed to retry command:', error);
      throw error;
    }
  }

  /**
   * Get command status
   */
  async getStatus(commandId: string): Promise<any> {
    try {
      const command = await prisma.command.findUnique({
        where: { id: commandId },
      });

      return command;
    } catch (error) {
      console.error('Failed to get command status:', error);
      return null;
    }
  }

  /**
   * Cancel command
   */
  async cancel(commandId: string): Promise<void> {
    try {
      // Find job in queue
      const jobs = await this.commandQueue.getJobs(['waiting', 'delayed']);
      const job = jobs.find(j => j.data.id === commandId);
      
      if (job) {
        await job.remove();
      }

      // Update database
      await prisma.command.update({
        where: { id: commandId },
        data: {
          status: 'cancelled',
        },
      });

      // Clean up expiry key
      await this.redis.del(`command:expiry:${commandId}`);
    } catch (error) {
      console.error('Failed to cancel command:', error);
      throw error;
    }
  }

  /**
   * Get pending commands for executor
   */
  async getPendingCommands(executorId?: string): Promise<TradeCommand[]> {
    try {
      const jobs = await this.commandQueue.getWaiting();
      const commands: TradeCommand[] = [];

      for (const job of jobs) {
        const command = job.data as TradeCommand;
        if (!executorId || !command.executorId || command.executorId === executorId) {
          commands.push(command);
        }
      }

      return commands;
    } catch (error) {
      console.error('Failed to get pending commands:', error);
      return [];
    }
  }

  /**
   * Emergency stop all commands
   */
  async emergencyStop(reason: string): Promise<void> {
    try {
      // Clear all waiting jobs
      await this.commandQueue.empty();
      
      // Cancel all active jobs
      const activeJobs = await this.commandQueue.getActive();
      for (const job of activeJobs) {
        await job.moveToFailed({ message: `Emergency stop: ${reason}` }, true);
      }

      // Update all pending/executing commands in database
      await prisma.command.updateMany({
        where: {
          status: {
            in: ['pending', 'executing'],
          },
        },
        data: {
          status: 'cancelled',
          result: {
            error: {
              code: 'EMERGENCY_STOP',
              message: reason,
            },
          },
        },
      });

      console.log(`Emergency stop executed: ${reason}`);
    } catch (error) {
      console.error('Failed to execute emergency stop:', error);
      throw error;
    }
  }

  /**
   * Setup queue processors
   */
  private setupQueueProcessors(): void {
    // Process command results
    this.resultQueue.process('process-result', async (job) => {
      const result = job.data as CommandResult;
      
      // Update strategy performance metrics
      if (result.success && result.result?.profit !== undefined) {
        // Update strategy statistics
        await this.updateStrategyMetrics(result);
      }

      // Trigger any follow-up actions
      if (!result.success && result.error?.code === 'CONNECTION_LOST') {
        // Handle connection loss
        console.error('Executor connection lost:', result.executorId);
      }
    });

    // Handle failed commands
    this.commandQueue.on('failed', async (job, err) => {
      console.error(`Command ${job.data.id} failed:`, err);
      await this.markCommandFailed(job.data.id, err.message);
    });

    // Handle completed commands
    this.commandQueue.on('completed', async (job) => {
      console.log(`Command ${job.data.id} completed`);
    });
  }

  /**
   * Mark command as failed
   */
  private async markCommandFailed(commandId: string, reason: string): Promise<void> {
    await prisma.command.update({
      where: { id: commandId },
      data: {
        status: 'failed',
        result: {
          error: {
            message: reason,
          },
        },
      },
    });
  }

  /**
   * Update strategy metrics based on execution results
   */
  private async updateStrategyMetrics(result: CommandResult): Promise<void> {
    try {
      if (result.strategyId && result.success) {
        // Update strategy performance metrics
        await prisma.strategy.update({
          where: { id: result.strategyId },
          data: {
            lastTradeAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Log activity
        await prisma.activityLog.create({
          data: {
            userId: result.userId || 'system',
            eventType: 'TRADE_EXECUTED',
            metadata: {
              commandId: result.commandId,
              strategyId: result.strategyId,
              success: result.success,
              executionTime: result.timestamp,
            },
          },
        });
      }
    } catch (error) {
      console.error('Failed to update strategy metrics:', error);
    }
  }

  /**
   * Get priority value for queue ordering
   */
  private getPriorityValue(priority: string): number {
    switch (priority) {
      case 'URGENT': return 1;
      case 'HIGH': return 2;
      case 'NORMAL': return 3;
      case 'LOW': return 4;
      default: return 3;
    }
  }

  /**
   * Cleanup and close connections
   */
  async close(): Promise<void> {
    await this.commandQueue.close();
    await this.resultQueue.close();
    this.redis.disconnect();
  }
}

// Singleton instance
let queueService: CommandQueueService | null = null;

export function getCommandQueue(): CommandQueueService {
  if (!queueService) {
    queueService = new CommandQueueService();
  }
  return queueService;
}
