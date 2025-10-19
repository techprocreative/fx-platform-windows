/**
 * AdvancedMonitor class for comprehensive system monitoring
 * Integrates latency, execution quality, slippage, and resource monitoring
 */

import {
  LatencyMetrics,
  ExecutionQuality,
  SlippageMetrics,
  SystemPerformance,
  ResourceUsage,
  MonitoringAlert,
  AlertType,
  AlertSeverity,
  AlertCategory,
  AlertStatus,
  AdvancedMonitoringConfig,
  HistoricalDataPoint,
  LatencyThresholds,
  ExecutionQualityThresholds,
  SlippageThresholds,
  ResourceThresholds
} from './monitoring-types';

import { LatencyTracker } from './latency-tracker';
import { ExecutionQualityTracker } from './execution-quality';
import { SlippageTracker } from './slippage-tracker';
import { ResourceMonitor } from './resource-monitor';

// Default configuration for advanced monitoring
const DEFAULT_CONFIG: AdvancedMonitoringConfig = {
  enableLatencyMonitoring: true,
  latencyThresholds: {
    endToEndLatency: 1000,
    signalProcessingLatency: 100,
    brokerApiLatency: 500,
    orderValidationLatency: 50,
    riskCheckLatency: 100,
    networkLatency: 200
  },
  latencyRetentionDays: 30,
  
  enableExecutionQualityMonitoring: true,
  executionQualityThresholds: {
    minFillRatio: 0.95,
    maxRejectionRate: 0.05,
    maxExecutionTime: 5000,
    minPriceImprovementRate: 0.1
  },
  executionQualityRetentionDays: 30,
  
  enableSlippageMonitoring: true,
  slippageThresholds: {
    maxNegativeSlippage: 3,
    maxNegativeSlippagePercent: 0.1,
    slippageTolerance: 2,
    slippageAnomalyThreshold: 2
  },
  slippageRetentionDays: 30,
  
  enableSystemPerformanceMonitoring: true,
  performanceThresholds: {
    maxApiResponseTime: 1000,
    maxErrorRate: 5,
    maxTimeoutRate: 2,
    maxQueueSize: 100,
    minSystemHealth: 'healthy'
  },
  performanceRetentionDays: 7,
  
  enableResourceMonitoring: true,
  resourceThresholds: {
    maxCpuUsage: 80,
    maxMemoryUsage: 85,
    maxDiskUsage: 90,
    minDiskSpace: 1024,
    maxNetworkErrorRate: 5
  },
  resourceRetentionDays: 7,
  
  enableAlerts: true,
  alertChannels: [],
  
  dataCollectionInterval: 5000,
  batchSize: 100,
  enableDebugLogging: false
};

export class AdvancedMonitor {
  private config: AdvancedMonitoringConfig;
  private latencyTracker: LatencyTracker;
  private executionQualityTracker: ExecutionQualityTracker;
  private slippageTracker: SlippageTracker;
  private resourceMonitor: ResourceMonitor;
  
  private alerts: MonitoringAlert[] = [];
  private alertIdCounter = 1;
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private systemPerformanceHistory: SystemPerformance[] = [];
  
  // Alert callbacks
  private alertCallbacks: ((alert: MonitoringAlert) => void)[] = [];

  constructor(config?: Partial<AdvancedMonitoringConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize monitoring components
    this.latencyTracker = new LatencyTracker(
      this.config.latencyThresholds,
      {
        maxHistorySize: this.config.batchSize * 100,
        enableDebugLogging: this.config.enableDebugLogging
      }
    );
    
    this.executionQualityTracker = new ExecutionQualityTracker(
      this.config.executionQualityThresholds,
      {
        maxHistorySize: this.config.batchSize * 100,
        enableDebugLogging: this.config.enableDebugLogging
      }
    );
    
    this.slippageTracker = new SlippageTracker(
      this.config.slippageThresholds,
      undefined,
      {
        maxHistorySize: this.config.batchSize * 100,
        enableDebugLogging: this.config.enableDebugLogging
      }
    );
    
    this.resourceMonitor = new ResourceMonitor(
      this.config.resourceThresholds,
      {
        maxHistorySize: this.config.batchSize * 100,
        enableDebugLogging: this.config.enableDebugLogging
      }
    );
  }

  /**
   * Start the advanced monitoring system
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      if (this.config.enableDebugLogging) {
        console.warn('[AdvancedMonitor] Monitoring already started');
      }
      return;
    }

    this.isMonitoring = true;
    
    // Start resource monitoring
    if (this.config.enableResourceMonitoring) {
      this.resourceMonitor.startMonitoring(this.config.dataCollectionInterval);
    }
    
    // Set up interval for system performance monitoring
    this.monitoringInterval = setInterval(() => {
      this.collectSystemPerformance();
      this.checkThresholds();
    }, this.config.dataCollectionInterval);

    if (this.config.enableDebugLogging) {
      console.log('[AdvancedMonitor] Started monitoring');
    }
  }

  /**
   * Stop the advanced monitoring system
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      if (this.config.enableDebugLogging) {
        console.warn('[AdvancedMonitor] Monitoring not started');
      }
      return;
    }

    this.isMonitoring = false;
    
    // Stop resource monitoring
    this.resourceMonitor.stopMonitoring();
    
    // Clear monitoring interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    if (this.config.enableDebugLogging) {
      console.log('[AdvancedMonitor] Stopped monitoring');
    }
  }

  /**
   * Record latency metrics
   * @param metrics The latency metrics to record
   */
  recordLatency(metrics: LatencyMetrics): void {
    if (!this.config.enableLatencyMonitoring) return;
    
    this.latencyTracker.recordLatency(metrics);
    
    // Check for latency alerts
    this.checkLatencyThresholds(metrics);
  }

  /**
   * Record execution quality metrics
   * @param execution The execution quality to record
   */
  recordExecutionQuality(execution: ExecutionQuality): void {
    if (!this.config.enableExecutionQualityMonitoring) return;
    
    this.executionQualityTracker.recordExecution(execution);
    
    // Check for execution quality alerts
    this.checkExecutionQualityThresholds(execution);
  }

  /**
   * Record slippage metrics
   * @param slippage The slippage metrics to record
   */
  recordSlippage(slippage: SlippageMetrics): void {
    if (!this.config.enableSlippageMonitoring) return;
    
    this.slippageTracker.recordSlippage(slippage);
    
    // Check for slippage alerts
    this.checkSlippageThresholds(slippage);
  }

  /**
   * Get latency statistics
   * @param periodStart Start of the period
   * @param periodEnd End of the period
   * @returns Latency statistics
   */
  getLatencyStatistics(periodStart?: Date, periodEnd?: Date) {
    return this.latencyTracker.getStatistics(periodStart, periodEnd);
  }

  /**
   * Get execution quality statistics
   * @param periodStart Start of the period
   * @param periodEnd End of the period
   * @param venue Optional venue to filter by
   * @returns Execution quality statistics
   */
  getExecutionQualityStatistics(periodStart?: Date, periodEnd?: Date, venue?: string) {
    return this.executionQualityTracker.getStatistics(periodStart, periodEnd, venue);
  }

  /**
   * Get slippage distribution
   * @param periodStart Start of the period
   * @param periodEnd End of the period
   * @param symbol Optional symbol to filter by
   * @returns Slippage distribution
   */
  getSlippageDistribution(periodStart?: Date, periodEnd?: Date, symbol?: string) {
    return this.slippageTracker.getSlippageDistribution(periodStart, periodEnd, symbol);
  }

  /**
   * Get current resource usage
   * @returns Current resource usage
   */
  getCurrentResourceUsage(): ResourceUsage | null {
    return this.resourceMonitor.getCurrentUsage();
  }

  /**
   * Get system performance history
   * @param periodStart Start of the period
   * @param periodEnd End of the period
   * @returns System performance history
   */
  getSystemPerformanceHistory(periodStart?: Date, periodEnd?: Date): SystemPerformance[] {
    let filteredHistory = this.systemPerformanceHistory;
    
    if (periodStart || periodEnd) {
      filteredHistory = this.systemPerformanceHistory.filter(performance => {
        const timestamp = performance.timestamp;
        if (periodStart && timestamp < periodStart) return false;
        if (periodEnd && timestamp > periodEnd) return false;
        return true;
      });
    }
    
    return filteredHistory;
  }

  /**
   * Get active alerts
   * @param status Optional status to filter by
   * @param category Optional category to filter by
   * @returns Array of alerts
   */
  getAlerts(status?: AlertStatus, category?: AlertCategory): MonitoringAlert[] {
    let filteredAlerts = this.alerts;
    
    if (status) {
      filteredAlerts = filteredAlerts.filter(alert => alert.status === status);
    }
    
    if (category) {
      filteredAlerts = filteredAlerts.filter(alert => alert.category === category);
    }
    
    return filteredAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Acknowledge an alert
   * @param alertId The ID of the alert to acknowledge
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && alert.status === AlertStatus.ACTIVE) {
      alert.status = AlertStatus.ACKNOWLEDGED;
      alert.acknowledgedAt = new Date();
      
      if (this.config.enableDebugLogging) {
        console.log(`[AdvancedMonitor] Acknowledged alert ${alertId}`);
      }
    }
  }

  /**
   * Resolve an alert
   * @param alertId The ID of the alert to resolve
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && (alert.status === AlertStatus.ACTIVE || alert.status === AlertStatus.ACKNOWLEDGED)) {
      alert.status = AlertStatus.RESOLVED;
      alert.resolvedAt = new Date();
      
      if (this.config.enableDebugLogging) {
        console.log(`[AdvancedMonitor] Resolved alert ${alertId}`);
      }
    }
  }

  /**
   * Register a callback for alert notifications
   * @param callback The callback function
   */
  onAlert(callback: (alert: MonitoringAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Get monitoring configuration
   * @returns The current configuration
   */
  getConfig(): AdvancedMonitoringConfig {
    return { ...this.config };
  }

  /**
   * Update monitoring configuration
   * @param newConfig The new configuration
   */
  updateConfig(newConfig: Partial<AdvancedMonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update component configurations
    if (newConfig.latencyThresholds) {
      this.latencyTracker.updateThresholds(newConfig.latencyThresholds);
    }
    
    if (newConfig.executionQualityThresholds) {
      this.executionQualityTracker.updateThresholds(newConfig.executionQualityThresholds);
    }
    
    if (newConfig.slippageThresholds) {
      this.slippageTracker.updateThresholds(newConfig.slippageThresholds);
    }
    
    if (newConfig.resourceThresholds) {
      this.resourceMonitor.updateThresholds(newConfig.resourceThresholds);
    }
    
    if (this.config.enableDebugLogging) {
      console.log('[AdvancedMonitor] Updated configuration');
    }
  }

  /**
   * Clear all monitoring history
   */
  clearHistory(): void {
    this.latencyTracker.clearHistory();
    this.executionQualityTracker.clearHistory();
    this.slippageTracker.clearHistory();
    this.resourceMonitor.clearHistory();
    this.systemPerformanceHistory = [];
    
    if (this.config.enableDebugLogging) {
      console.log('[AdvancedMonitor] Cleared all history');
    }
  }

  /**
   * Check if monitoring is active
   * @returns True if monitoring is active
   */
  isActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Collect system performance metrics
   */
  private collectSystemPerformance(): void {
    if (!this.config.enableSystemPerformanceMonitoring) return;
    
    const timestamp = new Date();
    
    // Get current resource usage
    const resourceUsage = this.resourceMonitor.getCurrentUsage();
    
    if (!resourceUsage) return;
    
    // Create system performance metrics
    const systemPerformance: SystemPerformance = {
      timestamp,
      
      // Response times (simplified)
      apiResponseTime: Math.random() * 1000,
      databaseQueryTime: Math.random() * 500,
      cacheHitTime: Math.random() * 50,
      averageResponseTime: Math.random() * 800,
      
      // Throughput metrics (simplified)
      requestsPerSecond: Math.random() * 100,
      tradesPerSecond: Math.random() * 10,
      messagesPerSecond: Math.random() * 50,
      
      // Error metrics (simplified)
      errorRate: Math.random() * 5,
      timeoutRate: Math.random() * 2,
      rejectionRate: Math.random() * 1,
      
      // Connection metrics (simplified)
      activeConnections: Math.floor(Math.random() * 100),
      brokerConnectionStatus: 'connected',
      databaseConnectionStatus: 'connected',
      
      // Queue metrics (simplified)
      orderQueueSize: Math.floor(Math.random() * 10),
      signalQueueSize: Math.floor(Math.random() * 5),
      alertQueueSize: this.alerts.filter(a => a.status === AlertStatus.ACTIVE).length,
      
      // Memory metrics
      heapUsed: resourceUsage.heapUsed,
      heapTotal: resourceUsage.heapTotal,
      rss: resourceUsage.memoryUsed,
      external: 0,
      
      // CPU metrics
      cpuUsage: resourceUsage.cpuUsage,
      loadAverage: resourceUsage.cpuLoadAverage,
      
      // System health
      systemHealth: this.calculateSystemHealth(resourceUsage)
    };
    
    // Add to history
    this.systemPerformanceHistory.push(systemPerformance);
    
    // Limit history size
    const maxHistorySize = this.config.batchSize * 100;
    if (this.systemPerformanceHistory.length > maxHistorySize) {
      this.systemPerformanceHistory.shift();
    }
  }

  /**
   * Calculate system health based on resource usage
   * @param resourceUsage The current resource usage
   * @returns System health status
   */
  private calculateSystemHealth(resourceUsage: ResourceUsage): 'healthy' | 'degraded' | 'critical' {
    const { cpuUsage, memoryUsagePercent, diskUsagePercent } = resourceUsage;
    
    if (cpuUsage > 90 || memoryUsagePercent > 95 || diskUsagePercent > 95) {
      return 'critical';
    }
    
    if (cpuUsage > 70 || memoryUsagePercent > 80 || diskUsagePercent > 85) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * Check all thresholds and generate alerts
   */
  private checkThresholds(): void {
    // Check resource thresholds
    const resourceUsage = this.resourceMonitor.getCurrentUsage();
    if (resourceUsage) {
      const resourceViolations = this.resourceMonitor.checkThresholds(resourceUsage);
      
      for (const [metric, violated] of Object.entries(resourceViolations)) {
        if (violated) {
          this.createAlert(
            this.getAlertTypeForResourceMetric(metric),
            this.getAlertSeverityForResourceMetric(metric),
            AlertCategory.RESOURCE,
            `Resource threshold exceeded for ${metric}`,
            `Current value: ${resourceUsage[metric as keyof ResourceUsage]}`,
            {
              currentValue: resourceUsage[metric as keyof ResourceUsage] as number,
              thresholdValue: this.config.resourceThresholds[metric as keyof ResourceThresholds],
              unit: this.getUnitForResourceMetric(metric)
            }
          );
        }
      }
    }
    
    // Check system performance thresholds
    if (this.systemPerformanceHistory.length > 0) {
      const latestPerformance = this.systemPerformanceHistory[this.systemPerformanceHistory.length - 1];
      
      if (latestPerformance.systemHealth === 'critical') {
        this.createAlert(
          AlertType.SYSTEM_CRITICAL,
          AlertSeverity.CRITICAL,
          AlertCategory.SYSTEM,
          'System health is critical',
          'System resources are critically low',
          {
            currentValue: 0,
            thresholdValue: 0,
            unit: 'status'
          }
        );
      } else if (latestPerformance.systemHealth === 'degraded') {
        this.createAlert(
          AlertType.SYSTEM_DEGRADED,
          AlertSeverity.WARNING,
          AlertCategory.SYSTEM,
          'System health is degraded',
          'System resources are running low',
          {
            currentValue: 0,
            thresholdValue: 0,
            unit: 'status'
          }
        );
      }
    }
  }

  /**
   * Check latency thresholds
   * @param metrics The latency metrics to check
   */
  private checkLatencyThresholds(metrics: LatencyMetrics): void {
    const violations = this.latencyTracker.checkThresholds(metrics);
    
    for (const [metric, violated] of Object.entries(violations)) {
      if (violated) {
        this.createAlert(
          AlertType.HIGH_LATENCY,
          AlertSeverity.WARNING,
          AlertCategory.LATENCY,
          `High latency detected for ${metric}`,
          `Latency exceeded threshold for ${metric}: ${metrics[metric as keyof LatencyMetrics]}ms`,
          {
            currentValue: metrics[metric as keyof LatencyMetrics] as number,
            thresholdValue: this.getLatencyThresholdValue(metric),
            unit: 'ms'
          }
        );
      }
    }
  }

  /**
   * Check execution quality thresholds
   * @param execution The execution quality to check
   */
  private checkExecutionQualityThresholds(execution: ExecutionQuality): void {
    const violations = this.executionQualityTracker.checkThresholds(execution);
    
    for (const [metric, violated] of Object.entries(violations)) {
      if (violated) {
        this.createAlert(
          this.getAlertTypeForExecutionQualityMetric(metric),
          AlertSeverity.WARNING,
          AlertCategory.EXECUTION,
          `Execution quality issue: ${metric}`,
          `Execution quality threshold exceeded for ${metric}`,
          {
            currentValue: execution[metric as keyof ExecutionQuality] as number,
            thresholdValue: this.getExecutionQualityThresholdValue(metric),
            unit: this.getUnitForExecutionQualityMetric(metric)
          }
        );
      }
    }
  }

  /**
   * Check slippage thresholds
   * @param slippage The slippage metrics to check
   */
  private checkSlippageThresholds(slippage: SlippageMetrics): void {
    const violations = this.slippageTracker.checkThresholds(slippage);
    
    for (const [metric, violated] of Object.entries(violations)) {
      if (violated) {
        this.createAlert(
          AlertType.HIGH_SLIPPAGE,
          AlertSeverity.WARNING,
          AlertCategory.SLIPPAGE,
          `High slippage detected: ${metric}`,
          `Slippage threshold exceeded for ${metric}`,
          {
            currentValue: slippage[metric as keyof SlippageMetrics] as number,
            thresholdValue: this.getSlippageThresholdValue(metric),
            unit: this.getUnitForSlippageMetric(metric)
          }
        );
      }
    }
  }

  /**
   * Create a new alert
   * @param type The alert type
   * @param severity The alert severity
   * @param category The alert category
   * @param title The alert title
   * @param message The alert message
   * @param metrics Optional metrics data
   */
  private createAlert(
    type: AlertType,
    severity: AlertSeverity,
    category: AlertCategory,
    title: string,
    message: string,
    metrics?: {
      currentValue?: number;
      thresholdValue?: number;
      unit?: string;
      orderId?: string;
      symbol?: string;
    }
  ): void {
    if (!this.config.enableAlerts) return;
    
    const alert: MonitoringAlert = {
      id: `alert-${this.alertIdCounter++}`,
      type,
      severity,
      category,
      title,
      message,
      timestamp: new Date(),
      status: AlertStatus.ACTIVE,
      source: 'AdvancedMonitor',
      currentValue: metrics?.currentValue,
      thresholdValue: metrics?.thresholdValue,
      unit: metrics?.unit,
      orderId: metrics?.orderId,
      symbol: metrics?.symbol
    };
    
    // Add to alerts
    this.alerts.push(alert);
    
    // Limit alerts history
    if (this.alerts.length > 1000) {
      this.alerts.shift();
    }
    
    // Notify callbacks
    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (error) {
        if (this.config.enableDebugLogging) {
          console.error('[AdvancedMonitor] Error in alert callback:', error);
        }
      }
    }
    
    if (this.config.enableDebugLogging) {
      console.log(`[AdvancedMonitor] Created alert: ${title}`);
    }
  }

  /**
   * Get alert type for a resource metric
   * @param metric The resource metric
   * @returns The alert type
   */
  private getAlertTypeForResourceMetric(metric: string): AlertType {
    switch (metric) {
      case 'cpuUsage':
        return AlertType.HIGH_CPU_USAGE;
      case 'memoryUsage':
        return AlertType.HIGH_MEMORY_USAGE;
      case 'diskUsage':
        return AlertType.LOW_DISK_SPACE;
      case 'networkErrorRate':
        return AlertType.HIGH_ERROR_RATE;
      default:
        return AlertType.RESOURCE_EXHAUSTION;
    }
  }

  /**
   * Get alert severity for a resource metric
   * @param metric The resource metric
   * @returns The alert severity
   */
  private getAlertSeverityForResourceMetric(metric: string): AlertSeverity {
    switch (metric) {
      case 'cpuUsage':
      case 'memoryUsage':
        return AlertSeverity.WARNING;
      case 'diskUsage':
        return AlertSeverity.ERROR;
      case 'networkErrorRate':
        return AlertSeverity.WARNING;
      default:
        return AlertSeverity.WARNING;
    }
  }

  /**
   * Get unit for a resource metric
   * @param metric The resource metric
   * @returns The unit
   */
  private getUnitForResourceMetric(metric: string): string {
    switch (metric) {
      case 'cpuUsage':
      case 'memoryUsage':
      case 'diskUsage':
      case 'networkErrorRate':
        return '%';
      case 'diskSpace':
        return 'MB';
      default:
        return '';
    }
  }

  /**
   * Get alert type for an execution quality metric
   * @param metric The execution quality metric
   * @returns The alert type
   */
  private getAlertTypeForExecutionQualityMetric(metric: string): AlertType {
    switch (metric) {
      case 'fillRatio':
        return AlertType.LOW_FILL_RATIO;
      case 'executionTime':
        return AlertType.SLOW_RESPONSE_TIME;
      case 'lateExecution':
        return AlertType.POOR_EXECUTION_QUALITY;
      default:
        return AlertType.POOR_EXECUTION_QUALITY;
    }
  }

  /**
   * Get unit for an execution quality metric
   * @param metric The execution quality metric
   * @returns The unit
   */
  private getUnitForExecutionQualityMetric(metric: string): string {
    switch (metric) {
      case 'fillRatio':
        return '%';
      case 'executionTime':
        return 'ms';
      default:
        return '';
    }
  }

  /**
   * Get unit for a slippage metric
   * @param metric The slippage metric
   * @returns The unit
   */
  private getUnitForSlippageMetric(metric: string): string {
    switch (metric) {
      case 'maxNegativeSlippage':
        return 'pips';
      case 'maxNegativeSlippagePercent':
        return '%';
      default:
        return '';
    }
  }

  /**
   * Get alert type for a latency metric
   * @param metric The latency metric
   * @returns The alert type
   */
  private getAlertTypeForLatencyMetric(metric: string): AlertType {
    return AlertType.HIGH_LATENCY;
  }

  /**
   * Get threshold value for a resource metric
   * @param metric The resource metric
   * @returns The threshold value
   */
  private getResourceThresholdValue(metric: string): number {
    switch (metric) {
      case 'cpuUsage':
        return this.config.resourceThresholds.maxCpuUsage;
      case 'memoryUsage':
        return this.config.resourceThresholds.maxMemoryUsage;
      case 'diskUsage':
        return this.config.resourceThresholds.maxDiskUsage;
      case 'networkErrorRate':
        return this.config.resourceThresholds.maxNetworkErrorRate;
      default:
        return 0;
    }
  }

  /**
   * Get threshold value for a latency metric
   * @param metric The latency metric
   * @returns The threshold value
   */
  private getLatencyThresholdValue(metric: string): number {
    switch (metric) {
      case 'endToEndLatency':
        return this.config.latencyThresholds.endToEndLatency;
      case 'signalProcessingLatency':
        return this.config.latencyThresholds.signalProcessingLatency;
      case 'brokerApiLatency':
        return this.config.latencyThresholds.brokerApiLatency;
      case 'orderValidationLatency':
        return this.config.latencyThresholds.orderValidationLatency;
      case 'riskCheckLatency':
        return this.config.latencyThresholds.riskCheckLatency;
      case 'networkLatency':
        return this.config.latencyThresholds.networkLatency;
      default:
        return 0;
    }
  }

  /**
   * Get threshold value for an execution quality metric
   * @param metric The execution quality metric
   * @returns The threshold value
   */
  private getExecutionQualityThresholdValue(metric: string): number {
    switch (metric) {
      case 'fillRatio':
        return this.config.executionQualityThresholds.minFillRatio;
      case 'executionTime':
        return this.config.executionQualityThresholds.maxExecutionTime;
      default:
        return 0;
    }
  }

  /**
   * Get threshold value for a slippage metric
   * @param metric The slippage metric
   * @returns The threshold value
   */
  private getSlippageThresholdValue(metric: string): number {
    switch (metric) {
      case 'maxNegativeSlippage':
        return this.config.slippageThresholds.maxNegativeSlippage;
      case 'maxNegativeSlippagePercent':
        return this.config.slippageThresholds.maxNegativeSlippagePercent;
      default:
        return 0;
    }
  }
}