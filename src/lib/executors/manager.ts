/**
 * EXECUTOR MANAGER SERVICE
 * Manages Windows executor connections and command routing
 * DO NOT DELETE - CRITICAL ARCHITECTURE COMPONENT
 */

import { prisma } from '../prisma';
import { getWebSocketServer } from '../websocket/server';
import { getCommandQueue, TradeCommand } from '../commands/queue';
import crypto from 'crypto';

export interface Executor {
  id: string;
  name: string;
  apiKey: string;
  status: 'online' | 'offline' | 'error';
  platform: 'MT5' | 'MT4';
  lastHeartbeat: Date;
  capabilities?: {
    symbols: string[];
    maxPositions: number;
    allowedCommands: string[];
  };
}

export interface ExecutorStatus {
  executorId: string;
  isOnline: boolean;
  lastHeartbeat: Date;
  activePositions: number;
  pendingCommands: number;
  performance: {
    successRate: number;
    averageLatency: number;
    totalTrades: number;
  };
}

export class ExecutorManager {
  private wsServer = getWebSocketServer();
  private commandQueue = getCommandQueue();
  private executors: Map<string, Executor> = new Map();

  constructor() {
    this.loadExecutors();
    this.startMonitoring();
  }

  /**
   * Register new executor
   */
  async register(config: {
    name: string;
    platform: 'MT5' | 'MT4';
    userId: string;
    brokerServer?: string;
    accountNumber?: string;
  }): Promise<{ executor: Executor; apiKey: string; secretKey: string }> {
    try {
      // Generate API key and secret
      const apiKey = this.generateApiKey();
      const secretKey = this.generateSecretKey();
      const apiSecretHash = await this.hashSecret(secretKey);

      // Create executor in database
      const dbExecutor = await prisma.executor.create({
        data: {
          userId: config.userId,
          name: config.name,
          apiKey,
          apiSecretHash,
          platform: config.platform,
          brokerServer: config.brokerServer,
          accountNumber: config.accountNumber,
          status: 'offline',
        },
      });

      const executor: Executor = {
        id: dbExecutor.id,
        name: dbExecutor.name,
        apiKey: dbExecutor.apiKey,
        status: 'offline',
        platform: dbExecutor.platform as 'MT5' | 'MT4',
        lastHeartbeat: new Date(),
      };

      this.executors.set(executor.id, executor);

      console.log(`Executor registered: ${executor.name} (${executor.id})`);

      return {
        executor,
        apiKey,
        secretKey, // Return this ONCE to user, never stored in plain
      };
    } catch (error) {
      console.error('Failed to register executor:', error);
      throw error;
    }
  }

  /**
   * Get executor status
   */
  async getStatus(executorId: string): Promise<ExecutorStatus | null> {
    try {
      const executor = await prisma.executor.findUnique({
        where: { id: executorId },
        include: {
          trades: {
            where: {
              closeTime: null, // Active positions
            },
          },
          commands: {
            where: {
              status: 'pending',
            },
          },
        },
      });

      if (!executor) return null;

      // Calculate performance metrics
      const allTrades = await prisma.trade.findMany({
        where: { executorId },
      });

      const successfulTrades = allTrades.filter(t => t.profit && t.profit > 0).length;
      const successRate = allTrades.length > 0 
        ? (successfulTrades / allTrades.length) * 100 
        : 0;

      // Calculate average latency from commands
      const executedCommands = await prisma.command.findMany({
        where: {
          executorId,
          status: 'executed',
          executedAt: { not: null },
          acknowledgedAt: { not: null },
        },
      });

      let averageLatency = 0;
      if (executedCommands.length > 0) {
        const totalLatency = executedCommands.reduce((sum, cmd) => {
          if (cmd.executedAt && cmd.acknowledgedAt) {
            return sum + (cmd.executedAt.getTime() - cmd.acknowledgedAt.getTime());
          }
          return sum;
        }, 0);
        averageLatency = totalLatency / executedCommands.length;
      }

      const connectedExecutors = this.wsServer.getConnectedExecutors();
      const isOnline = connectedExecutors.some(e => e.executorId === executorId);

      return {
        executorId: executor.id,
        isOnline,
        lastHeartbeat: executor.lastHeartbeat || new Date(),
        activePositions: executor.trades.length,
        pendingCommands: executor.commands.length,
        performance: {
          successRate,
          averageLatency,
          totalTrades: allTrades.length,
        },
      };
    } catch (error) {
      console.error('Failed to get executor status:', error);
      return null;
    }
  }

  /**
   * Send command to specific executor
   */
  async sendCommand(executorId: string, command: TradeCommand): Promise<boolean> {
    try {
      // Check if executor is online
      const status = await this.getStatus(executorId);
      if (!status || !status.isOnline) {
        console.error(`Executor ${executorId} is offline`);
        return false;
      }

      // Add to command queue
      command.executorId = executorId;
      await this.commandQueue.push(command);

      // Try to send immediately via WebSocket
      const sent = this.wsServer.sendCommand(executorId, command);
      
      if (sent) {
        console.log(`Command sent to executor ${executorId}: ${command.id}`);
      } else {
        console.log(`Command queued for executor ${executorId}: ${command.id}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to send command:', error);
      return false;
    }
  }

  /**
   * Broadcast command to all online executors
   */
  async broadcastCommand(command: TradeCommand): Promise<void> {
    const onlineExecutors = this.wsServer.getConnectedExecutors();
    
    for (const executor of onlineExecutors) {
      await this.sendCommand(executor.executorId, { ...command });
    }
  }

  /**
   * Handle executor disconnection
   */
  async handleDisconnection(executorId: string): Promise<void> {
    try {
      // Update status in database
      await prisma.executor.update({
        where: { id: executorId },
        data: {
          status: 'offline',
        },
      });

      // Update local cache
      const executor = this.executors.get(executorId);
      if (executor) {
        executor.status = 'offline';
      }

      // Check for critical positions
      const activePositions = await prisma.trade.findMany({
        where: {
          executorId,
          closeTime: null,
        },
      });

      if (activePositions.length > 0) {
        // Alert: Executor disconnected with open positions
        console.error(`ALERT: Executor ${executorId} disconnected with ${activePositions.length} open positions!`);
        
        // Could trigger emergency notifications here
        await this.sendDisconnectionAlert(executorId, activePositions.length);
      }
    } catch (error) {
      console.error('Failed to handle disconnection:', error);
    }
  }

  /**
   * Emergency stop for specific executor
   */
  async emergencyStop(executorId: string, reason: string): Promise<void> {
    try {
      // Send emergency stop command
      const command: TradeCommand = {
        id: `emg_${Date.now()}`,
        strategyId: 'SYSTEM',
        executorId,
        type: 'EMERGENCY_STOP',
        priority: 'URGENT',
        command: {
          action: 'CLOSE_ALL',
        },
        timestamp: new Date(),
      };

      await this.sendCommand(executorId, command);

      // Log emergency stop
      await prisma.auditLog.create({
        data: {
          userId: executorId,
          eventType: 'EMERGENCY_STOP',
          action: 'CLOSE_ALL',
          result: 'initiated',
          metadata: { reason },
          timestamp: new Date(),
        },
      });

      console.log(`Emergency stop initiated for executor ${executorId}: ${reason}`);
    } catch (error) {
      console.error('Failed to initiate emergency stop:', error);
      throw error;
    }
  }

  /**
   * Emergency stop all executors
   */
  async emergencyStopAll(reason: string): Promise<void> {
    // Send via WebSocket to all connected executors
    this.wsServer.emergencyStopAll(reason);

    // Also queue emergency stop commands
    const executors = await prisma.executor.findMany({
      where: { status: 'online' },
    });

    for (const executor of executors) {
      await this.emergencyStop(executor.id, reason);
    }

    // Queue emergency stop in command queue
    await this.commandQueue.emergencyStop(reason);
  }

  /**
   * Get all executors
   */
  async getAllExecutors(userId?: string): Promise<Executor[]> {
    try {
      const where = userId ? { userId } : {};
      const executors = await prisma.executor.findMany({
        where,
      });

      return executors.map(e => ({
        id: e.id,
        name: e.name,
        apiKey: e.apiKey,
        status: e.status as 'online' | 'offline' | 'error',
        platform: e.platform as 'MT5' | 'MT4',
        lastHeartbeat: e.lastHeartbeat || new Date(),
      }));
    } catch (error) {
      console.error('Failed to get executors:', error);
      return [];
    }
  }

  /**
   * Remove executor
   */
  async remove(executorId: string): Promise<boolean> {
    try {
      // Check for active positions
      const activePositions = await prisma.trade.count({
        where: {
          executorId,
          closeTime: null,
        },
      });

      if (activePositions > 0) {
        throw new Error(`Cannot remove executor with ${activePositions} active positions`);
      }

      // Soft delete executor
      await prisma.executor.update({
        where: { id: executorId },
        data: {
          deletedAt: new Date(),
          status: 'offline',
        },
      });

      // Remove from cache
      this.executors.delete(executorId);

      console.log(`Executor removed: ${executorId}`);
      return true;
    } catch (error) {
      console.error('Failed to remove executor:', error);
      return false;
    }
  }

  /**
   * Load executors from database
   */
  private async loadExecutors(): Promise<void> {
    try {
      const executors = await prisma.executor.findMany({
        where: {
          deletedAt: null,
        },
      });

      for (const executor of executors) {
        this.executors.set(executor.id, {
          id: executor.id,
          name: executor.name,
          apiKey: executor.apiKey,
          status: executor.status as 'online' | 'offline' | 'error',
          platform: executor.platform as 'MT5' | 'MT4',
          lastHeartbeat: executor.lastHeartbeat || new Date(),
        });
      }

      console.log(`Loaded ${executors.length} executors`);
    } catch (error) {
      console.error('Failed to load executors:', error);
    }
  }

  /**
   * Start monitoring executors
   */
  private startMonitoring(): void {
    // Check executor health every minute
    setInterval(async () => {
      const connectedExecutors = this.wsServer.getConnectedExecutors();
      
      for (const [id, executor] of this.executors) {
        const isConnected = connectedExecutors.some(e => e.executorId === id);
        
        if (executor.status === 'online' && !isConnected) {
          // Executor went offline
          executor.status = 'offline';
          await this.handleDisconnection(id);
        } else if (executor.status === 'offline' && isConnected) {
          // Executor came online
          executor.status = 'online';
          await prisma.executor.update({
            where: { id },
            data: { status: 'online' },
          });
        }
      }
    }, 60000); // Every minute
  }

  /**
   * Send disconnection alert
   */
  private async sendDisconnectionAlert(executorId: string, openPositions: number): Promise<void> {
    // In production, send email/SMS/push notification
    console.error(`CRITICAL ALERT: Executor ${executorId} disconnected with ${openPositions} open positions!`);
    
    // Log critical event
    await prisma.auditLog.create({
      data: {
        userId: executorId,
        action: 'CRITICAL_DISCONNECTION',
        eventType: 'CRITICAL_DISCONNECTION',
        result: 'alert_sent',
        metadata: {
          openPositions,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      },
    });
  }

  /**
   * Generate API key
   */
  private generateApiKey(): string {
    return `ntx_${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Generate secret key
   */
  private generateSecretKey(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Hash secret key
   */
  private async hashSecret(secret: string): Promise<string> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.hash(secret, 12);
  }
}

// Singleton instance
let executorManager: ExecutorManager | null = null;

export function getExecutorManager(): ExecutorManager {
  if (!executorManager) {
    executorManager = new ExecutorManager();
  }
  return executorManager;
}
