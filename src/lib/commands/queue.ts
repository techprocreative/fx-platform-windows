/**
 * COMMAND QUEUE SERVICE
 * Manages trade commands between Brain (Web) and Executor (Windows)
 * DO NOT DELETE - CRITICAL ARCHITECTURE COMPONENT
 * Simplified for Upstash Redis compatibility
 */

import { prisma } from "../prisma";

export interface TradeCommand {
  id: string;
  strategyId: string;
  executorId?: string;
  type: "TRADE_SIGNAL" | "RISK_UPDATE" | "EMERGENCY_STOP" | "STATUS_REQUEST";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  command: {
    action:
      | "OPEN_POSITION"
      | "CLOSE_POSITION"
      | "MODIFY_POSITION"
      | "CLOSE_ALL";
    symbol?: string;
    type?: "BUY" | "SELL";
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
  strategyId?: string;
  userId?: string;
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
  private redis: any;
  private queueKey = "trade:commands";
  private resultKey = "command:results";

  constructor() {
    // Initialize Redis connection
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      // Use Upstash Redis for Vercel deployment
      if (
        process.env.UPSTASH_REDIS_REST_URL &&
        process.env.UPSTASH_REDIS_REST_TOKEN
      ) {
        const { Redis } = await import("@upstash/redis");
        this.redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });

        console.log(
          "✅ Upstash Redis initialized for simplified command queue",
        );
        return;
      }

      throw new Error("Upstash Redis configuration not found");
    } catch (error) {
      console.error(
        "Failed to initialize command queue with Upstash Redis:",
        error,
      );
      throw error;
    }
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
          executorId: command.executorId || "",
          command: command.type,
          parameters: command.command as any,
          priority: command.priority,
          status: "pending",
        },
      });

      // Add to Redis list with priority (using sorted set)
      const priority = this.getPriorityValue(command.priority);
      await this.redis.zadd(this.queueKey, priority, JSON.stringify(command));

      // Set expiry in Redis if specified
      if (command.expiry) {
        await this.redis.setex(
          `command:expiry:${command.id}`,
          Math.ceil(command.expiry / 1000),
          "expired",
        );
      }
    } catch (error) {
      console.error("Failed to push command:", error);
      throw error;
    }
  }

  /**
   * Get next command for executor
   */
  async pop(executorId: string): Promise<TradeCommand | null> {
    try {
      // Get command with lowest priority (highest priority number = lowest priority)
      const commands = await this.redis.zrange(this.queueKey, 0, 0);

      if (commands.length === 0) {
        return null;
      }

      const commandStr = commands[0];
      const command = JSON.parse(commandStr) as TradeCommand;

      // Check if command is for this executor or any executor
      if (!command.executorId || command.executorId === executorId) {
        // Check if command has expired
        const isExpired = await this.redis.get(`command:expiry:${command.id}`);
        if (isExpired) {
          await this.markCommandFailed(command.id, "Command expired");
          await this.redis.zrem(this.queueKey, commandStr);
          return await this.pop(executorId); // Try next command
        }

        // Remove from queue
        await this.redis.zrem(this.queueKey, commandStr);

        // Update database
        await prisma.command.update({
          where: { id: command.id },
          data: {
            status: "executing",
            executorId,
            acknowledgedAt: new Date(),
          },
        });

        return command;
      }

      return null;
    } catch (error) {
      console.error("Failed to pop command:", error);
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
          status: result.success ? "executed" : "failed",
          result: result as any,
          executedAt: new Date(),
        },
      });

      // Add result to Redis list for processing
      await this.redis.lpush(this.resultKey, JSON.stringify(result));

      // Clean up expiry key
      await this.redis.del(`command:expiry:${commandId}`);
    } catch (error) {
      console.error("Failed to acknowledge command:", error);
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
        throw new Error("Command not found");
      }

      const retryCommand: TradeCommand = {
        id: commandId,
        strategyId: command.userId, // Adjust based on your schema
        executorId: command.executorId || undefined,
        type: command.command as any,
        priority: command.priority as any,
        command: command.parameters as any,
        timestamp: new Date(),
        retryCount: ((command as any).retry_count || 0) + 1,
        maxRetries: 3,
      };

      await this.push(retryCommand);
    } catch (error) {
      console.error("Failed to retry command:", error);
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
      console.error("Failed to get command status:", error);
      return null;
    }
  }

  /**
   * Cancel command
   */
  async cancel(commandId: string): Promise<void> {
    try {
      // Find and remove command from Redis queue
      const commands = await this.redis.zrange(this.queueKey, 0, -1);
      for (const commandStr of commands) {
        const command = JSON.parse(commandStr) as TradeCommand;
        if (command.id === commandId) {
          await this.redis.zrem(this.queueKey, commandStr);
          break;
        }
      }

      // Update database
      await prisma.command.update({
        where: { id: commandId },
        data: {
          status: "cancelled",
        },
      });

      // Clean up expiry key
      await this.redis.del(`command:expiry:${commandId}`);
    } catch (error) {
      console.error("Failed to cancel command:", error);
      throw error;
    }
  }

  /**
   * Get pending commands for executor
   */
  async getPendingCommands(executorId?: string): Promise<TradeCommand[]> {
    try {
      const commands = await this.redis.zrange(this.queueKey, 0, -1);
      const pendingCommands: TradeCommand[] = [];

      for (const commandStr of commands) {
        const command = JSON.parse(commandStr) as TradeCommand;
        if (
          !executorId ||
          !command.executorId ||
          command.executorId === executorId
        ) {
          pendingCommands.push(command);
        }
      }

      return pendingCommands;
    } catch (error) {
      console.error("Failed to get pending commands:", error);
      return [];
    }
  }

  /**
   * Emergency stop all commands
   */
  async emergencyStop(reason: string): Promise<void> {
    try {
      // Clear all commands from Redis queue
      await this.redis.del(this.queueKey);

      // Update all pending/executing commands in database
      await prisma.command.updateMany({
        where: {
          status: {
            in: ["pending", "executing"],
          },
        },
        data: {
          status: "cancelled",
          result: {
            error: {
              code: "EMERGENCY_STOP",
              message: reason,
            },
          },
        },
      });

      console.log(`Emergency stop executed: ${reason}`);
    } catch (error) {
      console.error("Failed to execute emergency stop:", error);
      throw error;
    }
  }

  /**
   * Process results (simplified)
   */
  async processResults(): Promise<void> {
    try {
      // Get results from Redis list
      const results = await this.redis.lrange(this.resultKey, 0, -1);

      for (const resultStr of results) {
        const result = JSON.parse(resultStr) as CommandResult;

        // Update strategy performance metrics
        if (result.success && result.result?.profit !== undefined) {
          await this.updateStrategyMetrics(result);
        }

        // Trigger any follow-up actions
        if (!result.success && result.error?.code === "CONNECTION_LOST") {
          console.error("Executor connection lost:", result.executorId);
        }
      }

      // Clear processed results
      await this.redis.del(this.resultKey);
    } catch (error) {
      console.error("Failed to process results:", error);
    }
  }

  /**
   * Mark command as failed
   */
  private async markCommandFailed(
    commandId: string,
    reason: string,
  ): Promise<void> {
    await prisma.command.update({
      where: { id: commandId },
      data: {
        status: "failed",
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
      if ((result as any).strategyId && result.success) {
        // Update strategy performance metrics
        await prisma.strategy.update({
          where: { id: (result as any).strategyId },
          data: {
            updatedAt: new Date(),
          },
        });

        // Log activity
        await prisma.activityLog.create({
          data: {
            userId: (result as any).userId || "system",
            eventType: "TRADE_EXECUTED",
            metadata: {
              commandId: result.commandId,
              strategyId: (result as any).strategyId,
              success: result.success,
              executionTime: result.timestamp,
            },
          },
        });
      }
    } catch (error) {
      console.error("Failed to update strategy metrics:", error);
    }
  }

  /**
   * Get priority value for queue ordering
   */
  private getPriorityValue(priority: string): number {
    switch (priority) {
      case "URGENT":
        return 1;
      case "HIGH":
        return 2;
      case "NORMAL":
        return 3;
      case "LOW":
        return 4;
      default:
        return 3;
    }
  }

  /**
   * Cleanup and close connections
   */
  async close(): Promise<void> {
    // Upstash Redis doesn't need manual disconnect
    console.log("Command queue service closed");
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
