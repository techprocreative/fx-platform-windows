/**
 * Types and interfaces for the advanced monitoring system
 */

// Latency Metrics Interface
export interface LatencyMetrics {
  // End-to-end latency (from signal to execution)
  endToEndLatency: number;
  
  // Component-level latencies
  signalProcessingLatency: number;
  brokerApiLatency: number;
  orderValidationLatency: number;
  riskCheckLatency: number;
  
  // Network latencies
  networkLatency: number;
  roundTripTime: number;
  
  // Timestamps
  signalTimestamp: Date;
  processingStartTimestamp: Date;
  executionTimestamp: Date;
  
  // Additional metadata
  symbol?: string;
  orderType?: string;
  broker?: string;
  userId?: string;
}

// Execution Quality Interface
export interface ExecutionQuality {
  // Basic execution metrics
  orderId: string;
  symbol: string;
  requestedVolume: number;
  executedVolume: number;
  fillRatio: number;
  
  // Timing metrics
  orderTimestamp: Date;
  acknowledgementTimestamp?: Date;
  firstFillTimestamp?: Date;
  lastFillTimestamp?: Date;
  executionTime?: number;
  
  // Price metrics
  requestedPrice?: number;
  averageFillPrice: number;
  firstFillPrice?: number;
  lastFillPrice?: number;
  
  // Rejection metrics
  isRejected: boolean;
  rejectionReason?: string;
  rejectionTimestamp?: Date;
  
  // Venue information
  executionVenue?: string;
  liquidityProvider?: string;
  
  // Quality flags
  partialFill: boolean;
  lateExecution: boolean;
  priceImprovement: boolean;
  
  // User and strategy context
  userId: string;
  strategyId?: string;
}

// Slippage Metrics Interface
export interface SlippageMetrics {
  // Basic trade information
  orderId: string;
  symbol: string;
  orderType: 'market' | 'limit' | 'stop' | 'stop_limit';
  direction: 'buy' | 'sell';
  volume: number;
  
  // Price information
  expectedPrice: number;
  actualPrice: number;
  referencePrice?: number; // Mid price or VWAP at execution time
  slippage: number;
  slippagePips: number;
  slippagePercent: number;
  
  // Timing
  orderTimestamp: Date;
  executionTimestamp: Date;
  
  // Market context
  spreadAtExecution: number;
  volatilityAtExecution?: number;
  volumeAtExecution?: number;
  
  // Classification
  slippageType: 'positive' | 'negative' | 'neutral';
  isWithinTolerance: boolean;
  
  // Context
  broker?: string;
  executionVenue?: string;
  userId?: string;
}

// System Performance Interface
export interface SystemPerformance {
  // Timestamp
  timestamp: Date;
  
  // Response times
  apiResponseTime: number;
  databaseQueryTime: number;
  cacheHitTime: number;
  averageResponseTime: number;
  
  // Throughput metrics
  requestsPerSecond: number;
  tradesPerSecond: number;
  messagesPerSecond: number;
  
  // Error metrics
  errorRate: number;
  timeoutRate: number;
  rejectionRate: number;
  
  // Connection metrics
  activeConnections: number;
  brokerConnectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  databaseConnectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  
  // Queue metrics
  orderQueueSize: number;
  signalQueueSize: number;
  alertQueueSize: number;
  
  // Memory metrics
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  
  // CPU metrics
  cpuUsage: number;
  loadAverage: number[];
  
  // System health
  systemHealth: 'healthy' | 'degraded' | 'critical';
}

// Resource Usage Interface
export interface ResourceUsage {
  // Timestamp
  timestamp: Date;
  
  // CPU metrics
  cpuUsage: number; // Percentage
  cpuLoadAverage: number[];
  cpuCores: number;
  
  // Memory metrics
  memoryUsed: number; // In MB
  memoryTotal: number; // In MB
  memoryUsagePercent: number;
  heapUsed: number; // In MB
  heapTotal: number; // In MB
  heapUsagePercent: number;
  
  // Disk metrics
  diskUsed: number; // In MB
  diskTotal: number; // In MB
  diskUsagePercent: number;
  diskReadRate: number; // In MB/s
  diskWriteRate: number; // In MB/s
  
  // Network metrics
  networkBytesReceived: number; // In MB
  networkBytesSent: number; // In MB
  networkPacketsReceived: number;
  networkPacketsSent: number;
  networkErrorRate: number;
  
  // Process metrics
  uptime: number; // In seconds
  fileDescriptors: number;
  threads: number;
  
  // Application-specific metrics
  activeTrades: number;
  activeUsers: number;
  activeStrategies: number;
  queuedTasks: number;
}

// Monitoring Alert Interface
export interface MonitoringAlert {
  // Alert identification
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  category: AlertCategory;
  
  // Alert content
  title: string;
  message: string;
  description?: string;
  
  // Timestamps
  timestamp: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  
  // Status
  status: AlertStatus;
  
  // Source information
  source: string;
  component?: string;
  userId?: string;
  symbol?: string;
  orderId?: string;
  
  // Metrics and thresholds
  currentValue?: number;
  thresholdValue?: number;
  unit?: string;
  
  // Actions
  actions?: AlertAction[];
  
  // Metadata
  metadata?: Record<string, any>;
  correlationId?: string;
}

// Alert Types
export enum AlertType {
  // Latency alerts
  HIGH_LATENCY = 'high_latency',
  LATENCY_SPIKE = 'latency_spike',
  
  // Execution quality alerts
  LOW_FILL_RATIO = 'low_fill_ratio',
  HIGH_REJECTION_RATE = 'high_rejection_rate',
  POOR_EXECUTION_QUALITY = 'poor_execution_quality',
  
  // Slippage alerts
  HIGH_SLIPPAGE = 'high_slippage',
  SLIPPAGE_ANOMALY = 'slippage_anomaly',
  
  // System performance alerts
  HIGH_ERROR_RATE = 'high_error_rate',
  SLOW_RESPONSE_TIME = 'slow_response_time',
  HIGH_CPU_USAGE = 'high_cpu_usage',
  HIGH_MEMORY_USAGE = 'high_memory_usage',
  LOW_DISK_SPACE = 'low_disk_space',
  
  // Connection alerts
  BROKER_DISCONNECT = 'broker_disconnect',
  DATABASE_DISCONNECT = 'database_disconnect',
  
  // Resource alerts
  RESOURCE_EXHAUSTION = 'resource_exhaustion',
  QUEUE_OVERFLOW = 'queue_overflow',
  
  // System health alerts
  SYSTEM_DEGRADED = 'system_degraded',
  SYSTEM_CRITICAL = 'system_critical'
}

// Alert Severity Levels
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// Alert Categories
export enum AlertCategory {
  LATENCY = 'latency',
  EXECUTION = 'execution',
  SLIPPAGE = 'slippage',
  PERFORMANCE = 'performance',
  RESOURCE = 'resource',
  CONNECTION = 'connection',
  SYSTEM = 'system'
}

// Alert Status
export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  SUPPRESSED = 'suppressed'
}

// Alert Action
export interface AlertAction {
  type: 'notify' | 'auto_resolve' | 'escalate' | 'restart_service' | 'stop_trading';
  description: string;
  executed: boolean;
  executedAt?: Date;
  result?: string;
  error?: string;
}

// Latency Statistics
export interface LatencyStatistics {
  // Basic statistics
  min: number;
  max: number;
  mean: number;
  median: number;
  standardDeviation: number;
  
  // Percentiles
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  
  // Additional metrics
  count: number;
  sum: number;
  variance: number;
  
  // Time period
  periodStart: Date;
  periodEnd: Date;
  
  // Component breakdown
  componentBreakdown?: ComponentLatencyBreakdown[];
}

// Component Latency Breakdown
export interface ComponentLatencyBreakdown {
  component: string;
  min: number;
  max: number;
  mean: number;
  p95: number;
  contribution: number; // Percentage of total latency
}

// Slippage Distribution
export interface SlippageDistribution {
  // Distribution buckets
  buckets: SlippageBucket[];
  
  // Statistics
  mean: number;
  median: number;
  standardDeviation: number;
  
  // Counts
  totalTrades: number;
  positiveSlippageCount: number;
  negativeSlippageCount: number;
  neutralSlippageCount: number;
  
  // Percentages
  positiveSlippagePercent: number;
  negativeSlippagePercent: number;
  neutralSlippagePercent: number;
  
  // Time period
  periodStart: Date;
  periodEnd: Date;
}

// Slippage Bucket
export interface SlippageBucket {
  minSlippage: number;
  maxSlippage: number;
  count: number;
  percentage: number;
}

// Execution Quality Statistics
export interface ExecutionQualityStatistics {
  // Fill ratio metrics
  averageFillRatio: number;
  medianFillRatio: number;
  minFillRatio: number;
  maxFillRatio: number;
  
  // Rejection metrics
  rejectionRate: number;
  rejectionReasons: RejectionReasonCount[];
  
  // Timing metrics
  averageExecutionTime: number;
  medianExecutionTime: number;
  
  // Price improvement metrics
  priceImprovementRate: number;
  averagePriceImprovement: number;
  
  // Counts
  totalOrders: number;
  filledOrders: number;
  rejectedOrders: number;
  partiallyFilledOrders: number;
  
  // Time period
  periodStart: Date;
  periodEnd: Date;
}

// Rejection Reason Count
export interface RejectionReasonCount {
  reason: string;
  count: number;
  percentage: number;
}

// Historical Data Point
export interface HistoricalDataPoint<T> {
  timestamp: Date;
  value: T;
  metadata?: Record<string, any>;
}

// Monitoring Configuration
export interface AdvancedMonitoringConfig {
  // Latency monitoring
  enableLatencyMonitoring: boolean;
  latencyThresholds: LatencyThresholds;
  latencyRetentionDays: number;
  
  // Execution quality monitoring
  enableExecutionQualityMonitoring: boolean;
  executionQualityThresholds: ExecutionQualityThresholds;
  executionQualityRetentionDays: number;
  
  // Slippage monitoring
  enableSlippageMonitoring: boolean;
  slippageThresholds: SlippageThresholds;
  slippageRetentionDays: number;
  
  // System performance monitoring
  enableSystemPerformanceMonitoring: boolean;
  performanceThresholds: PerformanceThresholds;
  performanceRetentionDays: number;
  
  // Resource monitoring
  enableResourceMonitoring: boolean;
  resourceThresholds: ResourceThresholds;
  resourceRetentionDays: number;
  
  // Alerting
  enableAlerts: boolean;
  alertChannels: AlertChannel[];
  
  // Data collection
  dataCollectionInterval: number; // In milliseconds
  batchSize: number;
  
  // General
  enableDebugLogging: boolean;
}

// Latency Thresholds
export interface LatencyThresholds {
  endToEndLatency: number; // In milliseconds
  signalProcessingLatency: number;
  brokerApiLatency: number;
  orderValidationLatency: number;
  riskCheckLatency: number;
  networkLatency: number;
}

// Execution Quality Thresholds
export interface ExecutionQualityThresholds {
  minFillRatio: number;
  maxRejectionRate: number;
  maxExecutionTime: number; // In milliseconds
  minPriceImprovementRate: number;
}

// Slippage Thresholds
export interface SlippageThresholds {
  maxNegativeSlippage: number; // In pips
  maxNegativeSlippagePercent: number;
  slippageTolerance: number; // In pips
  slippageAnomalyThreshold: number; // Standard deviations from mean
}

// Performance Thresholds
export interface PerformanceThresholds {
  maxApiResponseTime: number; // In milliseconds
  maxErrorRate: number; // Percentage
  maxTimeoutRate: number; // Percentage
  maxQueueSize: number;
  minSystemHealth: 'healthy' | 'degraded';
}

// Resource Thresholds
export interface ResourceThresholds {
  maxCpuUsage: number; // Percentage
  maxMemoryUsage: number; // Percentage
  maxDiskUsage: number; // Percentage
  minDiskSpace: number; // In MB
  maxNetworkErrorRate: number; // Percentage
}

// Alert Channel
export interface AlertChannel {
  id: string;
  type: 'email' | 'sms' | 'push' | 'webhook' | 'slack';
  enabled: boolean;
  config: Record<string, any>;
  filters: AlertFilter[];
}

// Alert Filter
export interface AlertFilter {
  type: AlertType;
  severity: AlertSeverity;
  enabled: boolean;
}