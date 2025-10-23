import { 
  MonitoringMetrics, 
  ConnectionStatus, 
  HealthCheckResult, 
  Alert, 
  AlertConfig,
  PerformanceMetrics,
  RecoveryAction
} from '../types/security.types';
import { createLogger, PerformanceLogger } from '../utils/logger';
import { DatabaseManager } from '../database/manager';
import { EventEmitter } from 'events';

const logger = createLogger('monitoring');

export class MonitoringService extends EventEmitter {
  private db: DatabaseManager;
  private metrics: MonitoringMetrics;
  private connections: Map<string, ConnectionStatus> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private alertConfig: AlertConfig;
  private recoveryActions: Map<string, RecoveryAction> = new Map();
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private startTime: Date = new Date();

  constructor(db: DatabaseManager) {
    super();
    this.db = db;
    this.metrics = this.initializeMetrics();
    this.alertConfig = this.getDefaultAlertConfig();
    this.initializeRecoveryActions();
  }

  private initializeMetrics(): MonitoringMetrics {
    return {
      system: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkLatency: 0,
      },
      trading: {
        dailyPnL: 0,
        openPositions: 0,
        totalTrades: 0,
        winRate: 0,
        averageTradeDuration: 0,
      },
      connections: {
        pusher: { connected: false, reconnectAttempts: 0 },
        zeromq: { connected: false, reconnectAttempts: 0 },
        mt5: { connected: false, reconnectAttempts: 0 },
        api: { connected: false, reconnectAttempts: 0 },
      },
      performance: {
        commandQueueSize: 0,
        averageExecutionTime: 0,
        errorRate: 0,
        uptime: 0,
      },
    };
  }

  private getDefaultAlertConfig(): AlertConfig {
    return {
      enabled: true,
      thresholds: {
        dailyLoss: 500,
        drawdown: 20,
        errorRate: 5, // 5%
        latency: 1000, // 1 second
        diskUsage: 80, // 80%
        memoryUsage: 85, // 85%
        cpuUsage: 90, // 90%
      },
      notifications: {
        email: [],
        inApp: true,
      },
    };
  }

  private initializeRecoveryActions(): void {
    const defaultRecoveryActions: RecoveryAction[] = [
      {
        id: 'reconnect-pusher',
        type: 'RECONNECT',
        condition: 'pusher_disconnected',
        enabled: true,
        maxRetries: 5,
        retryInterval: 30,
        successCount: 0,
        failureCount: 0,
      },
      {
        id: 'reconnect-zeromq',
        type: 'RECONNECT',
        condition: 'zeromq_disconnected',
        enabled: true,
        maxRetries: 5,
        retryInterval: 30,
        successCount: 0,
        failureCount: 0,
      },
      {
        id: 'clear-cache',
        type: 'CLEAR_CACHE',
        condition: 'high_memory_usage',
        enabled: true,
        maxRetries: 3,
        retryInterval: 60,
        successCount: 0,
        failureCount: 0,
      },
      {
        id: 'emergency-stop',
        type: 'EMERGENCY_STOP',
        condition: 'critical_security_breach',
        enabled: true,
        maxRetries: 1,
        retryInterval: 0,
        successCount: 0,
        failureCount: 0,
      },
    ];

    for (const action of defaultRecoveryActions) {
      this.recoveryActions.set(action.id, action);
    }
  }

  /**
   * Start monitoring
   */
  async startMonitoring(): Promise<boolean> {
    try {
      if (this.isMonitoring) {
        logger.warn('Monitoring is already active');
        return true;
      }

      logger.info('Starting monitoring service');
      
      // Load configuration from database
      await this.loadConfiguration();
      
      // Start system monitoring interval
      this.monitoringInterval = setInterval(() => {
        this.collectMetrics();
        this.checkAlerts();
        this.checkRecoveryActions();
      }, 30000); // Every 30 seconds
      
      // Initial metrics collection
      await this.collectMetrics();
      
      this.isMonitoring = true;
      logger.info('Monitoring service started successfully');
      
      this.emit('monitoringStarted', { timestamp: new Date() });
      
      return true;
    } catch (error) {
      logger.error('Failed to start monitoring service', { error });
      return false;
    }
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring(): Promise<void> {
    try {
      if (!this.isMonitoring) {
        logger.warn('Monitoring is not active');
        return;
      }

      logger.info('Stopping monitoring service');
      
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }
      
      this.isMonitoring = false;
      logger.info('Monitoring service stopped');
      
      this.emit('monitoringStopped', { timestamp: new Date() });
    } catch (error) {
      logger.error('Failed to stop monitoring service', { error });
    }
  }

  /**
   * Update connection status
   */
  updateConnectionStatus(service: string, status: Partial<ConnectionStatus>): void {
    try {
      const currentStatus = this.connections.get(service) || {
        connected: false,
        reconnectAttempts: 0,
      };
      
      const newStatus: ConnectionStatus = {
        ...currentStatus,
        ...status,
      };
      
      // Update timestamp
      if (status.connected !== undefined) {
        if (status.connected) {
          newStatus.lastConnected = new Date();
          newStatus.reconnectAttempts = 0;
        } else {
          newStatus.lastDisconnected = new Date();
        }
      }
      
      this.connections.set(service, newStatus);
      
      // Update metrics
      if (this.metrics.connections[service as keyof typeof this.metrics.connections]) {
        this.metrics.connections[service as keyof typeof this.metrics.connections] = newStatus;
      }
      
      logger.debug(`Connection status updated for ${service}`, { status: newStatus });
      
      // Emit connection status change
      this.emit('connectionStatusChanged', { service, status: newStatus });
      
      // Check for recovery actions
      if (!status.connected && newStatus.reconnectAttempts === 1) {
        this.checkRecoveryActions();
      }
    } catch (error) {
      logger.error('Failed to update connection status', { error, service, status });
    }
  }

  /**
   * Update trading metrics
   */
  updateTradingMetrics(metrics: Partial<MonitoringMetrics['trading']>): void {
    try {
      this.metrics.trading = { ...this.metrics.trading, ...metrics };
      logger.debug('Trading metrics updated', { metrics });
      
      this.emit('tradingMetricsUpdated', { metrics: this.metrics.trading });
      
      // Check alerts immediately for trading metrics
      this.checkAlerts();
    } catch (error) {
      logger.error('Failed to update trading metrics', { error, metrics });
    }
  }

  /**
   * Record performance metrics
   */
  async recordPerformanceMetrics(
    commandId: string,
    commandType: string,
    startTime: Date,
    endTime?: Date,
    success: boolean = true,
    error?: string,
    metadata?: any
  ): Promise<void> {
    try {
      const duration = endTime ? endTime.getTime() - startTime.getTime() : 0;
      
      const performanceMetric: PerformanceMetrics = {
        id: `perf_${Date.now()}_${commandId}`,
        commandId,
        commandType,
        startTime,
        endTime,
        duration,
        success,
        error,
        metadata,
      };
      
      // Save to database
      await this.db.savePerformanceMetrics(performanceMetric);
      
      // Update average metrics
      this.updateAveragePerformanceMetrics(performanceMetric);
      
      logger.debug('Performance metrics recorded', { 
        commandId, 
        commandType, 
        duration: `${duration}ms`,
        success 
      });
      
      this.emit('performanceMetricsRecorded', { metrics: performanceMetric });
    } catch (error) {
      logger.error('Failed to record performance metrics', { error, commandId });
    }
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): MonitoringMetrics {
    return { ...this.metrics };
  }

  /**
   * Get connection status
   */
  getConnectionStatus(service: string): ConnectionStatus | null {
    return this.connections.get(service) || null;
  }

  /**
   * Get all connection statuses
   */
  getAllConnectionStatuses(): Record<string, ConnectionStatus> {
    const result: Record<string, ConnectionStatus> = {};
    for (const [service, status] of this.connections.entries()) {
      result[service] = status;
    }
    return result;
  }

  /**
   * Perform health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    try {
      const perfLogger = new PerformanceLogger('health-check');
      
      const checks = {
        database: await this.checkDatabaseHealth(),
        connections: await this.checkConnectionsHealth(),
        diskSpace: await this.checkDiskSpaceHealth(),
        memory: await this.checkMemoryHealth(),
        safetyLimits: await this.checkSafetyLimitsHealth(),
      };
      
      const issues: string[] = [];
      const recommendations: string[] = [];
      
      // Determine overall status
      const allHealthy = Object.values(checks).every(check => check);
      const someHealthy = Object.values(checks).some(check => check);
      
      let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
      if (allHealthy) {
        status = 'HEALTHY';
      } else if (someHealthy) {
        status = 'DEGRADED';
      } else {
        status = 'UNHEALTHY';
      }
      
      // Generate issues and recommendations
      if (!checks.database) {
        issues.push('Database connection failed');
        recommendations.push('Check database configuration and restart service');
      }
      
      if (!checks.connections) {
        issues.push('Some connections are down');
        recommendations.push('Check network connectivity and external services');
      }
      
      if (!checks.diskSpace) {
        issues.push('Low disk space');
        recommendations.push('Clean up old logs and data files');
      }
      
      if (!checks.memory) {
        issues.push('High memory usage');
        recommendations.push('Restart application or increase memory limits');
      }
      
      if (!checks.safetyLimits) {
        issues.push('Safety limits exceeded');
        recommendations.push('Review trading activity and adjust limits');
      }
      
      const result: HealthCheckResult = {
        status,
        timestamp: new Date(),
        checks,
        issues,
        recommendations,
      };
      
      perfLogger.end();
      
      logger.info('Health check completed', { status, issuesCount: issues.length });
      
      this.emit('healthCheckCompleted', { result });
      
      return result;
    } catch (error) {
      logger.error('Failed to perform health check', { error });
      
      return {
        status: 'UNHEALTHY',
        timestamp: new Date(),
        checks: {
          database: false,
          connections: false,
          diskSpace: false,
          memory: false,
          safetyLimits: false,
        },
        issues: [`Health check failed: ${(error as Error).message}`],
        recommendations: ['Restart monitoring service'],
      };
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
    try {
      const alert = this.alerts.get(alertId);
      
      if (!alert) {
        logger.warn('Alert not found', { alertId });
        return false;
      }
      
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date();
      
      // Save to database (in a real implementation)
      logger.info('Alert acknowledged', { alertId, acknowledgedBy });
      
      this.emit('alertAcknowledged', { alert });
      
      return true;
    } catch (error) {
      logger.error('Failed to acknowledge alert', { error, alertId });
      return false;
    }
  }

  /**
   * Update alert configuration
   */
  updateAlertConfig(config: Partial<AlertConfig>): void {
    this.alertConfig = { ...this.alertConfig, ...config };
    logger.info('Alert configuration updated', { config });
    this.emit('alertConfigUpdated', { config: this.alertConfig });
  }

  /**
   * Collect system metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const perfLogger = new PerformanceLogger('collect-metrics');
      
      // Update uptime
      this.metrics.performance.uptime = Date.now() - this.startTime.getTime();
      
      // Collect system metrics (mock implementation)
      this.metrics.system = {
        cpuUsage: this.getCPUUsage(),
        memoryUsage: this.getMemoryUsage(),
        diskUsage: this.getDiskUsage(),
        networkLatency: await this.measureNetworkLatency(),
      };
      
      perfLogger.end();
      
      logger.debug('Metrics collected', { metrics: this.metrics });
      
      this.emit('metricsCollected', { metrics: this.metrics });
    } catch (error) {
      logger.error('Failed to collect metrics', { error });
    }
  }

  /**
   * Check for alerts
   */
  private checkAlerts(): void {
    try {
      if (!this.alertConfig.enabled) {
        return;
      }
      
      const alerts: Alert[] = [];
      
      // Check daily loss
      if (this.metrics.trading.dailyPnL <= -this.alertConfig.thresholds.dailyLoss) {
        alerts.push({
          id: `daily_loss_${Date.now()}`,
          type: 'DAILY_LOSS',
          severity: 'HIGH',
          message: `Daily loss exceeded: $${Math.abs(this.metrics.trading.dailyPnL).toFixed(2)}`,
          timestamp: new Date(),
          acknowledged: false,
          resolved: false,
        });
      }
      
      // Check error rate
      if (this.metrics.performance.errorRate > this.alertConfig.thresholds.errorRate) {
        alerts.push({
          id: `error_rate_${Date.now()}`,
          type: 'HIGH_ERROR_RATE',
          severity: 'MEDIUM',
          message: `Error rate high: ${this.metrics.performance.errorRate.toFixed(2)}%`,
          timestamp: new Date(),
          acknowledged: false,
          resolved: false,
        });
      }
      
      // Check memory usage
      if (this.metrics.system.memoryUsage > this.alertConfig.thresholds.memoryUsage) {
        alerts.push({
          id: `memory_usage_${Date.now()}`,
          type: 'MEMORY_USAGE',
          severity: 'MEDIUM',
          message: `Memory usage high: ${this.metrics.system.memoryUsage.toFixed(2)}%`,
          timestamp: new Date(),
          acknowledged: false,
          resolved: false,
        });
      }
      
      // Check disk usage
      if (this.metrics.system.diskUsage > this.alertConfig.thresholds.diskUsage) {
        alerts.push({
          id: `disk_usage_${Date.now()}`,
          type: 'DISK_SPACE',
          severity: 'HIGH',
          message: `Disk usage high: ${this.metrics.system.diskUsage.toFixed(2)}%`,
          timestamp: new Date(),
          acknowledged: false,
          resolved: false,
        });
      }
      
      // Check connection issues
      const disconnectedServices = Object.entries(this.metrics.connections)
        .filter(([_, status]) => !status.connected)
        .map(([service]) => service);
      
      if (disconnectedServices.length > 0) {
        alerts.push({
          id: `connection_lost_${Date.now()}`,
          type: 'CONNECTION_LOST',
          severity: 'HIGH',
          message: `Connections lost: ${disconnectedServices.join(', ')}`,
          timestamp: new Date(),
          acknowledged: false,
          resolved: false,
        });
      }
      
      // Add new alerts
      for (const alert of alerts) {
        this.alerts.set(alert.id, alert);
        this.emit('alertTriggered', { alert });
        
        logger.warn('Alert triggered', { 
          type: alert.type, 
          severity: alert.severity, 
          message: alert.message 
        });
      }
    } catch (error) {
      logger.error('Failed to check alerts', { error });
    }
  }

  /**
   * Check and execute recovery actions
   */
  private checkRecoveryActions(): void {
    try {
      for (const [id, action] of this.recoveryActions.entries()) {
        if (!action.enabled) {
          continue;
        }
        
        if (this.shouldExecuteRecoveryAction(action)) {
          this.executeRecoveryAction(action);
        }
      }
    } catch (error) {
      logger.error('Failed to check recovery actions', { error });
    }
  }

  /**
   * Determine if recovery action should be executed
   */
  private shouldExecuteRecoveryAction(action: RecoveryAction): boolean {
    const now = new Date();
    
    // Check if enough time has passed since last execution
    if (action.lastExecuted) {
      const timeSinceLastExecution = (now.getTime() - action.lastExecuted.getTime()) / 1000;
      if (timeSinceLastExecution < action.retryInterval) {
        return false;
      }
    }
    
    // Check if max retries exceeded
    if (action.failureCount >= action.maxRetries) {
      return false;
    }
    
    // Check condition
    switch (action.condition) {
      case 'pusher_disconnected':
        return !this.metrics.connections.pusher.connected;
      
      case 'zeromq_disconnected':
        return !this.metrics.connections.zeromq.connected;
      
      case 'high_memory_usage':
        return this.metrics.system.memoryUsage > 85;
      
      case 'critical_security_breach':
        // This would be triggered by security service
        return false;
      
      default:
        return false;
    }
  }

  /**
   * Execute recovery action
   */
  private async executeRecoveryAction(action: RecoveryAction): Promise<void> {
    try {
      logger.info('Executing recovery action', { id: action.id, type: action.type });
      
      action.lastExecuted = new Date();
      
      let success = false;
      
      switch (action.type) {
        case 'RECONNECT':
          // Emit reconnection request
          this.emit('reconnectRequested', { service: action.condition.replace('_disconnected', '') });
          success = true;
          break;
        
        case 'RESTART_SERVICE':
          // Emit restart request
          this.emit('restartRequested', { service: 'unknown' });
          success = true;
          break;
        
        case 'CLEAR_CACHE':
          // Clear internal caches
          this.alerts.clear();
          success = true;
          break;
        
        case 'EMERGENCY_STOP':
          // Emit emergency stop request
          this.emit('emergencyStopRequested', { reason: 'Critical security breach' });
          success = true;
          break;
      }
      
      if (success) {
        action.successCount++;
        logger.info('Recovery action executed successfully', { id: action.id });
      } else {
        action.failureCount++;
        logger.warn('Recovery action failed', { id: action.id });
      }
      
      this.emit('recoveryActionExecuted', { action, success });
    } catch (error) {
      action.failureCount++;
      logger.error('Failed to execute recovery action', { error, action });
    }
  }

  /**
   * Update average performance metrics
   */
  private updateAveragePerformanceMetrics(metric: PerformanceMetrics): void {
    // Simple implementation - in production, this would use more sophisticated averaging
    if (metric.success) {
      const currentAvg = this.metrics.performance.averageExecutionTime;
      const newDuration = metric.duration || 0;
      
      // Simple moving average
      this.metrics.performance.averageExecutionTime = (currentAvg * 0.9) + (newDuration * 0.1);
    }
  }

  /**
   * Load configuration from database
   */
  private async loadConfiguration(): Promise<void> {
    try {
      const alertConfig = await this.db.getConfig('alertConfig');
      if (alertConfig) {
        this.alertConfig = { ...this.alertConfig, ...alertConfig };
      }
    } catch (error) {
      logger.error('Failed to load monitoring configuration', { error });
    }
  }

  // Health check methods
  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      return this.db.isReady();
    } catch (error) {
      return false;
    }
  }

  private async checkConnectionsHealth(): Promise<boolean> {
    const connections = Object.values(this.metrics.connections);
    return connections.every(conn => conn.connected);
  }

  private async checkDiskSpaceHealth(): Promise<boolean> {
    return this.metrics.system.diskUsage < 90;
  }

  private async checkMemoryHealth(): Promise<boolean> {
    return this.metrics.system.memoryUsage < 90;
  }

  private async checkSafetyLimitsHealth(): Promise<boolean> {
    return this.metrics.trading.dailyPnL > -1000; // Simple check
  }

  // System metric collection methods (mock implementations)
  private getCPUUsage(): number {
    // Mock implementation - would use actual system metrics
    return Math.random() * 20; // 0-20% CPU usage
  }

  private getMemoryUsage(): number {
    // Mock implementation - would use actual system metrics
    return 30 + Math.random() * 40; // 30-70% memory usage
  }

  private getDiskUsage(): number {
    // Mock implementation - would use actual system metrics
    return 20 + Math.random() * 30; // 20-50% disk usage
  }

  private async measureNetworkLatency(): Promise<number> {
    try {
      const start = Date.now();
      // Simple ping to a known server
      // In production, this would be an actual network ping
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
      return Date.now() - start;
    } catch (error) {
      return 1000; // Default to 1 second on error
    }
  }
}

export default MonitoringService;