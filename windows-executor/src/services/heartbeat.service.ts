import { 
  HeartbeatData, 
  SystemMetrics, 
  QueueStats, 
  ConnectionStatus, 
  AppConfig,
  MT5Info 
} from '../types/command.types';
import { ZeroMQService } from './zeromq.service';
import { PusherService } from './pusher.service';
import { CommandService } from './command.service';
import { ApiService } from './api.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';

const execAsync = promisify(exec);

export class HeartbeatService {
  private config: AppConfig | null = null;
  private apiService: ApiService | null = null;
  private zeroMQService: ZeroMQService;
  private pusherService: PusherService;
  private commandService: CommandService;
  private heartbeatInterval: any = null;
  private systemMetricsInterval: any = null;
  private isRunning = false;
  private startTime: Date;
  private lastHeartbeat: Date | null = null;
  private missedHeartbeats = 0;
  private maxMissedHeartbeats = 3;
  private logger: (level: string, message: string, metadata?: any) => void;
  private eventHandlers: Map<string, Function[]> = new Map();
  private systemMetrics: SystemMetrics = {
    cpuUsage: 0,
    memoryUsage: 0,
    diskUsage: 0,
    networkLatency: 0,
    processesRunning: 0,
  };
  private mt5Info: MT5Info[] = [];

  constructor(
    zeroMQService: ZeroMQService,
    pusherService: PusherService,
    commandService: CommandService,
    logger?: (level: string, message: string, metadata?: any) => void,
    apiService?: ApiService
  ) {
    this.zeroMQService = zeroMQService;
    this.pusherService = pusherService;
    this.commandService = commandService;
    this.apiService = apiService || null;
    this.logger = logger || this.defaultLogger;
    this.startTime = new Date();
  }
  
  setApiService(apiService: ApiService): void {
    this.apiService = apiService;
  }

  private log(level: string, message: string, metadata?: any): void {
    this.logger(level, message, metadata);
  }

  /**
   * Start heartbeat service
   */
  async start(config: AppConfig): Promise<boolean> {
    try {
      if (this.isRunning) {
        this.log('warn', 'Heartbeat service already running');
        return true;
      }

      this.config = config;
      this.isRunning = true;
      this.startTime = new Date();
      
      this.log('info', 'Starting heartbeat service', {
        interval: config.heartbeatInterval * 1000,
      });

      // Start heartbeat interval
      this.heartbeatInterval = setInterval(
        () => this.sendHeartbeat(),
        config.heartbeatInterval * 1000
      );

      // Start system metrics collection (more frequent)
      this.systemMetricsInterval = setInterval(
        () => this.updateSystemMetrics(),
        30000 // Every 30 seconds
      );

      // Initial system metrics update
      await this.updateSystemMetrics();
      
      // Send initial heartbeat
      await this.sendHeartbeat();

      this.log('info', 'Heartbeat service started successfully');
      this.emitEvent('heartbeat-started', { timestamp: new Date().toISOString() });
      
      return true;
    } catch (error) {
      this.log('error', 'Failed to start heartbeat service', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Stop heartbeat service
   */
  stop(): void {
    if (!this.isRunning) {
      this.log('warn', 'Heartbeat service not running');
      return;
    }

    this.log('info', 'Stopping heartbeat service...');

    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
      this.systemMetricsInterval = null;
    }

    this.isRunning = false;
    this.lastHeartbeat = null;
    this.missedHeartbeats = 0;

    this.log('info', 'Heartbeat service stopped');
    this.emitEvent('heartbeat-stopped', { timestamp: new Date().toISOString() });
  }

  /**
   * Send heartbeat to platform
   */
  private async sendHeartbeat(): Promise<void> {
    if (!this.config || !this.isRunning) {
      return;
    }

    try {
      const heartbeatData = await this.createHeartbeatData();
      
      // Send via API Service (primary)
      if (this.apiService) {
        try {
          const response = await this.apiService.sendHeartbeat({
            status: 'online',
            metadata: {
              version: '1.0.0',
              platform: 'windows',
              accountBalance: heartbeatData.mt5Status?.accountBalance,
              accountEquity: heartbeatData.mt5Status?.accountEquity,
              openPositions: heartbeatData.mt5Status?.openPositions,
              cpuUsage: this.systemMetrics.cpuUsage,
              memoryUsage: this.systemMetrics.memoryUsage,
              timestamp: new Date().toISOString(),
            },
          });

          // Check for pending commands
          if (response.pendingCommands && response.pendingCommands.length > 0) {
            this.log('info', 'Received pending commands', {
              count: response.pendingCommands.length,
            });
            // TODO: Pass to command service
          }
        } catch (apiError) {
          this.log('warn', 'Failed to send heartbeat via API, falling back to Pusher', {
            error: (apiError as Error).message,
          });
        }
      }
      
      // Send via Pusher (fallback or redundant)
      await this.pusherService.sendCommandResult('heartbeat', {
        type: 'heartbeat',
        data: heartbeatData,
      });

      this.lastHeartbeat = new Date();
      this.missedHeartbeats = 0;

      this.log('debug', 'Heartbeat sent successfully', {
        uptime: heartbeatData.uptime,
        activeCommands: heartbeatData.activeCommands,
      });

      this.emitEvent('heartbeat-sent', {
        timestamp: heartbeatData.timestamp,
        uptime: heartbeatData.uptime,
      });

    } catch (error) {
      this.missedHeartbeats++;
      
      this.log('error', 'Failed to send heartbeat', {
        error: (error as Error).message,
        missedHeartbeats: this.missedHeartbeats,
      });

      this.emitEvent('heartbeat-failed', {
        error: (error as Error).message,
        missedHeartbeats: this.missedHeartbeats,
        timestamp: new Date().toISOString(),
      });

      // Check if we've exceeded max missed heartbeats
      if (this.missedHeartbeats >= this.maxMissedHeartbeats) {
        this.log('error', 'Max missed heartbeats reached, triggering recovery');
        this.emitEvent('heartbeat-timeout', {
          missedHeartbeats: this.missedHeartbeats,
          maxMissedHeartbeats: this.maxMissedHeartbeats,
          timestamp: new Date().toISOString(),
        });

        // Trigger recovery mechanism
        await this.triggerRecovery();
      }
    }
  }

  /**
   * Create heartbeat data
   */
  private async createHeartbeatData(): Promise<HeartbeatData> {
    if (!this.config) {
      throw new Error('Heartbeat service not configured');
    }

    const uptime = Date.now() - this.startTime.getTime();
    const connections = this.getConnectionStatus();
    const queueStats = this.getQueueStats();
    const activeCommands = this.commandService.getQueueStats().processing.activeCommands;

    return {
      executorId: this.config.executorId,
      timestamp: new Date().toISOString(),
      uptime,
      connections,
      mt5Info: this.mt5Info,
      systemMetrics: this.systemMetrics,
      queueStats,
      activeCommands,
      lastCommandExecution: this.getLastCommandExecution(),
    };
  }

  /**
   * Get connection status for all services
   */
  private getConnectionStatus(): ConnectionStatus {
    return {
      pusher: this.pusherService.getConnectionStatus(),
      zeromq: this.zeroMQService.getConnectionStatus(),
      api: 'connected', // Would need actual API service
      mt5: this.zeroMQService.isConnected() ? 'connected' : 'disconnected',
      lastUpdate: new Date().toISOString(),
    };
  }

  /**
   * Get queue statistics
   */
  private getQueueStats(): QueueStats {
    const stats = this.commandService.getQueueStats();
    
    return {
      pending: stats.queue.processable || 0,
      processing: stats.processing.activeCommands,
      completed: stats.history.total,
      failed: stats.history.failed,
      averageProcessingTime: stats.history.averageExecutionTime,
    };
  }

  /**
   * Get last command execution time
   */
  private getLastCommandExecution(): string | undefined {
    // This would need to be implemented in CommandService
    // For now, return undefined
    return undefined;
  }

  /**
   * Update system metrics
   */
  private async updateSystemMetrics(): Promise<void> {
    try {
      const metrics = await this.collectSystemMetrics();
      this.systemMetrics = metrics;
      
      this.emitEvent('system-metrics-updated', {
        metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.log('error', 'Failed to update system metrics', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const metrics: SystemMetrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      networkLatency: 0,
      processesRunning: 0,
    };

    try {
      // CPU Usage (simplified)
      const cpus = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;
      
      cpus.forEach((cpu: any) => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type as keyof typeof cpu.times];
        }
        totalIdle += cpu.times.idle;
      });
      
      metrics.cpuUsage = 100 - (totalIdle / totalTick * 100);

      // Memory Usage
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      metrics.memoryUsage = ((totalMem - freeMem) / totalMem) * 100;

      // Disk Usage (Windows specific)
      // Simplified platform check - assume Windows for this executor
      const isWindows = true;
      
      if (isWindows) {
        try {
          const { stdout } = await execAsync('wmic logicaldisk get size,freespace /format:csv');
          const lines = stdout.split('\n').filter((line: any) => line.trim() && !line.includes('Node'));
          
          if (lines.length > 0) {
            const line = lines[0];
            const parts = line.split(',');
            if (parts.length >= 3) {
              const freeSpace = parseInt(parts[1]) || 0;
              const size = parseInt(parts[2]) || 0;
              metrics.diskUsage = ((size - freeSpace) / size) * 100;
            }
          }
        } catch (error) {
          // Fallback to 0 if disk check fails
          metrics.diskUsage = 0;
        }
      }

      // Network Latency (simplified ping to localhost)
      try {
        const start = Date.now();
        await execAsync('ping -n 1 127.0.0.1');
        metrics.networkLatency = Date.now() - start;
      } catch (error) {
        metrics.networkLatency = 0;
      }

      // Processes Running
      if (isWindows) {
        try {
          const { stdout } = await execAsync('tasklist | find /c "exe"');
          metrics.processesRunning = parseInt(stdout.trim()) || 0;
        } catch (error) {
          metrics.processesRunning = 0;
        }
      }

    } catch (error) {
      this.log('error', 'Error collecting system metrics', {
        error: (error as Error).message,
      });
    }

    return metrics;
  }

  /**
   * Trigger recovery mechanism
   */
  private async triggerRecovery(): Promise<void> {
    this.log('info', 'Triggering recovery mechanism');

    try {
      // Check each service and attempt recovery
      const recoveryResults = {
        pusher: await this.recoverPusher(),
        zeromq: await this.recoverZeroMQ(),
        system: await this.recoverSystem(),
      };

      this.log('info', 'Recovery results', recoveryResults);
      this.emitEvent('recovery-attempted', {
        results: recoveryResults,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.log('error', 'Recovery mechanism failed', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Recover Pusher connection
   */
  private async recoverPusher(): Promise<boolean> {
    try {
      if (this.pusherService.getConnectionStatus() !== 'connected') {
        this.log('info', 'Attempting to recover Pusher connection');
        return await this.pusherService.forceReconnect();
      }
      return true;
    } catch (error) {
      this.log('error', 'Pusher recovery failed', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Recover ZeroMQ connection
   */
  private async recoverZeroMQ(): Promise<boolean> {
    try {
      if (!this.zeroMQService.isConnected()) {
        this.log('info', 'Attempting to recover ZeroMQ connection');
        return await this.zeroMQService.forceReconnect();
      }
      return true;
    } catch (error) {
      this.log('error', 'ZeroMQ recovery failed', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Recover system resources
   */
  private async recoverSystem(): Promise<boolean> {
    try {
      this.log('info', 'Attempting system recovery');
      
      // Garbage collection
      // Manual garbage collection if available
      try {
        // Skip garbage collection for now
      } catch (error) {
        // Ignore if gc is not available
      }

      // Update system metrics
      await this.updateSystemMetrics();
      
      return true;
    } catch (error) {
      this.log('error', 'System recovery failed', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Update MT5 information
   */
  updateMT5Info(mt5Info: MT5Info[]): void {
    this.mt5Info = mt5Info;
    this.log('debug', 'MT5 info updated', {
      installations: mt5Info.length,
    });
  }

  /**
   * Get current system metrics
   */
  getSystemMetrics(): SystemMetrics {
    return { ...this.systemMetrics };
  }

  /**
   * Get heartbeat status
   */
  getHeartbeatStatus() {
    return {
      isRunning: this.isRunning,
      startTime: this.startTime.toISOString(),
      lastHeartbeat: this.lastHeartbeat?.toISOString() || null,
      missedHeartbeats: this.missedHeartbeats,
      maxMissedHeartbeats: this.maxMissedHeartbeats,
      uptime: this.isRunning ? Date.now() - this.startTime.getTime() : 0,
      interval: this.config?.heartbeatInterval || 60,
    };
  }

  /**
   * Force heartbeat
   */
  async forceHeartbeat(): Promise<boolean> {
    try {
      await this.sendHeartbeat();
      return true;
    } catch (error) {
      this.log('error', 'Force heartbeat failed', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Event emitter functionality
   */
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler?: Function): void {
    if (!this.eventHandlers.has(event)) {
      return;
    }

    if (handler) {
      const handlers = this.eventHandlers.get(event)!;
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    } else {
      this.eventHandlers.delete(event);
    }
  }

  private emitEvent(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          this.log('error', `Error in event handler for ${event}`, { 
            error: (error as Error).message 
          });
        }
      });
    }
  }

  /**
   * Default logger implementation
   */
  private defaultLogger(level: string, message: string, metadata?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      service: 'HeartbeatService',
      message,
      metadata,
    };

    (console as any)[level] ? (console as any)[level](`[${timestamp}] [${level}] [HeartbeatService] ${message}`, metadata) : console.log(logEntry);
  }

  /**
   * Set custom logger
   */
  setLogger(logger: (level: string, message: string, metadata?: any) => void): void {
    this.logger = logger;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AppConfig>): void {
    if (this.config) {
      this.config = { ...this.config, ...config };
      
      // Restart heartbeat if interval changed
      if (config.heartbeatInterval && this.isRunning) {
        this.stop();
        this.start(this.config);
      }
      
      this.log('info', 'Heartbeat configuration updated', { config });
    }
  }

  /**
   * Get detailed health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    details: any;
    timestamp: string;
  }> {
    const heartbeatStatus = this.getHeartbeatStatus();
    const systemMetrics = this.getSystemMetrics();
    const connections = this.getConnectionStatus();
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    const issues: string[] = [];

    // Check heartbeat
    if (heartbeatStatus.missedHeartbeats > 0) {
      status = 'warning';
      issues.push(`Missed heartbeats: ${heartbeatStatus.missedHeartbeats}`);
    }

    // Check connections
    Object.entries(connections).forEach(([service, connStatus]) => {
      if (connStatus === 'error' || connStatus === 'disconnected') {
        status = 'critical';
        issues.push(`${service} connection: ${connStatus}`);
      }
    });

    // Check system metrics
    if (systemMetrics.cpuUsage > 90) {
      if (status === 'healthy' && issues.length > 0) {
        status = 'warning';
      }
      issues.push(`High CPU usage: ${systemMetrics.cpuUsage.toFixed(1)}%`);
    }

    if (systemMetrics.memoryUsage > 90) {
      if (status === 'healthy' && issues.length > 0) {
        status = 'warning';
      }
      issues.push(`High memory usage: ${systemMetrics.memoryUsage.toFixed(1)}%`);
    }

    if (systemMetrics.diskUsage > 95) {
      status = 'critical';
      issues.push(`High disk usage: ${systemMetrics.diskUsage.toFixed(1)}%`);
    }

    return {
      status,
      details: {
        heartbeat: heartbeatStatus,
        systemMetrics,
        connections,
        issues,
      },
      timestamp: new Date().toISOString(),
    };
  }
}