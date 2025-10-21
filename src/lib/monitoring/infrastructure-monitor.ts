/**
 * Infrastructure Monitoring System
 * 
 * This module provides comprehensive infrastructure monitoring capabilities:
 * - Server resource usage (CPU, memory, disk)
 * - Database performance metrics
 * - Network latency monitoring
 * - WebSocket connection health
 * - Cache hit rates
 * - Queue processing times
 */

import { captureEnhancedError, addBreadcrumb, ErrorCategory } from './sentry';

// Server resource metrics interface
export interface ServerResourceMetrics {
  timestamp: Date;
  serverId: string;
  
  // CPU metrics
  cpuUsage: number; // Percentage
  cpuLoadAverage: number[]; // 1, 5, 15 minute averages
  cpuCores: number;
  cpuTemperature?: number;
  
  // Memory metrics
  memoryTotal: number; // MB
  memoryUsed: number; // MB
  memoryFree: number; // MB
  memoryCached: number; // MB
  memoryBuffers: number; // MB
  swapTotal: number; // MB
  swapUsed: number; // MB
  
  // Disk metrics
  diskTotal: number; // MB
  diskUsed: number; // MB
  diskFree: number; // MB
  diskReadRate: number; // MB/s
  diskWriteRate: number; // MB/s
  diskIOPS: number;
  
  // Network metrics
  networkBytesReceived: number; // MB
  networkBytesSent: number; // MB
  networkPacketsReceived: number;
  networkPacketsSent: number;
  networkErrorsIn: number;
  networkErrorsOut: number;
  networkDropIn: number;
  networkDropOut: number;
  
  // Process metrics
  processCount: number;
  runningProcesses: number;
  sleepingProcesses: number;
  zombieProcesses: number;
  
  // System metrics
  uptime: number; // seconds
  bootTime: Date;
  contextSwitches: number;
  interrupts: number;
}

// Database performance metrics interface
export interface DatabasePerformanceMetrics {
  timestamp: Date;
  databaseId: string;
  
  // Connection metrics
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  maxConnections: number;
  connectionErrors: number;
  
  // Query metrics
  queriesPerSecond: number;
  slowQueries: number;
  averageQueryTime: number; // ms
  queryCacheHitRate: number; // percentage
  
  // Transaction metrics
  transactionsPerSecond: number;
  activeTransactions: number;
  deadlocks: number;
  lockWaitTime: number; // ms
  
  // Replication metrics
  replicationLag?: number; // seconds
  replicationStatus?: 'active' | 'stopped' | 'error';
  
  // Resource metrics
  databaseSize: number; // MB
  indexSize: number; // MB
  temporaryFiles: number;
  temporaryFileSize: number; // MB
  
  // Performance metrics
  bufferPoolHitRate: number; // percentage
  tableLocks: number;
  fullTableScans: number;
  
  // Error metrics
  connectionTimeouts: number;
  queryTimeouts: number;
  errorRate: number; // percentage
}

// Network latency metrics interface
export interface NetworkLatencyMetrics {
  timestamp: Date;
  source: string;
  target: string;
  
  // Latency metrics
  latency: number; // ms
  jitter: number; // ms
  packetLoss: number; // percentage
  
  // Route metrics
  hopCount: number;
  route: string[];
  
  // Bandwidth metrics
  bandwidth: number; // Mbps
  availableBandwidth: number; // Mbps
  
  // Connection metrics
  connectionTime: number; // ms
  tlsHandshakeTime?: number; // ms
  dnsResolutionTime: number; // ms
  
  // Health metrics
  successRate: number; // percentage
  timeoutRate: number; // percentage
  errorRate: number; // percentage
}

// WebSocket connection health metrics interface
export interface WebSocketHealthMetrics {
  timestamp: Date;
  serverId: string;
  
  // Connection metrics
  activeConnections: number;
  totalConnections: number;
  newConnections: number;
  disconnections: number;
  
  // Connection quality metrics
  averageConnectionDuration: number; // seconds
  connectionErrors: number;
  reconnectionAttempts: number;
  successfulReconnections: number;
  
  // Message metrics
  messagesPerSecond: number;
  messagesReceived: number;
  messagesSent: number;
  messageErrors: number;
  
  // Performance metrics
  averageMessageLatency: number; // ms
  maxMessageLatency: number; // ms
  messageQueueSize: number;
  
  // Resource metrics
  memoryUsage: number; // MB
  cpuUsage: number; // percentage
  
  // Client metrics
  connectedClients: number;
  clientTypes: Record<string, number>;
  geographicDistribution: Record<string, number>;
}

// Cache performance metrics interface
export interface CachePerformanceMetrics {
  timestamp: Date;
  cacheId: string;
  cacheType: 'redis' | 'memcached' | 'memory' | 'disk';
  
  // Hit rate metrics
  hitRate: number; // percentage
  missRate: number; // percentage
  totalHits: number;
  totalMisses: number;
  
  // Performance metrics
  averageGetTime: number; // ms
  averageSetTime: number; // ms
  averageDeleteTime: number; // ms
  
  // Storage metrics
  memoryUsage: number; // MB
  memoryLimit: number; // MB
  keyCount: number;
  evictions: number;
  expirations: number;
  
  // Network metrics (for distributed cache)
  networkBytesIn: number; // MB
  networkBytesOut: number; // MB
  connectedClients: number;
  
  // Error metrics
  connectionErrors: number;
  timeoutErrors: number;
  errorRate: number; // percentage
}

// Queue processing metrics interface
export interface QueueProcessingMetrics {
  timestamp: Date;
  queueId: string;
  queueType: 'task' | 'message' | 'event' | 'job';
  
  // Queue size metrics
  queueSize: number;
  maxQueueSize: number;
  processingRate: number; // items/second
  
  // Processing metrics
  itemsProcessed: number;
  itemsFailed: number;
  itemsRetried: number;
  itemsAbandoned: number;
  
  // Performance metrics
  averageProcessingTime: number; // ms
  maxProcessingTime: number; // ms
  minProcessingTime: number; // ms
  
  // Worker metrics
  activeWorkers: number;
  totalWorkers: number;
  workerUtilization: number; // percentage
  
  // Error metrics
  errorRate: number; // percentage
  timeoutRate: number; // percentage
  retryRate: number; // percentage
  
  // Age metrics
  averageItemAge: number; // seconds
  maxItemAge: number; // seconds
  oldestItemAge: number; // seconds
}

// Infrastructure alert interface
export interface InfrastructureAlert {
  id: string;
  type: 'server_resource' | 'database_performance' | 'network_latency' | 'websocket_health' | 'cache_performance' | 'queue_processing';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
  context?: Record<string, any>;
}

export class InfrastructureMonitor {
  private static instance: InfrastructureMonitor;
  private serverMetrics: ServerResourceMetrics[] = [];
  private databaseMetrics: DatabasePerformanceMetrics[] = [];
  private networkMetrics: NetworkLatencyMetrics[] = [];
  private websocketMetrics: WebSocketHealthMetrics[] = [];
  private cacheMetrics: CachePerformanceMetrics[] = [];
  private queueMetrics: QueueProcessingMetrics[] = [];
  private infrastructureAlerts: InfrastructureAlert[] = [];
  private maxMetricsSize: number = 10000;
  private isMonitoring: boolean = false;
  private monitoringIntervals: NodeJS.Timeout[] = [];
  
  private constructor() {}
  
  static getInstance(): InfrastructureMonitor {
    if (!InfrastructureMonitor.instance) {
      InfrastructureMonitor.instance = new InfrastructureMonitor();
    }
    return InfrastructureMonitor.instance;
  }
  
  /**
   * Start infrastructure monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.schedulePeriodicCollection();
    
    addBreadcrumb(
      'Infrastructure monitoring started',
      'infrastructure',
      'info'
    );
  }
  
  /**
   * Stop infrastructure monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    
    // Clear all intervals
    this.monitoringIntervals.forEach(interval => clearInterval(interval));
    this.monitoringIntervals = [];
    
    addBreadcrumb(
      'Infrastructure monitoring stopped',
      'infrastructure',
      'info'
    );
  }
  
  /**
   * Record server resource metrics
   */
  recordServerResourceMetrics(metrics: ServerResourceMetrics): void {
    this.serverMetrics.push(metrics);
    
    // Limit array size
    if (this.serverMetrics.length > this.maxMetricsSize) {
      this.serverMetrics.shift();
    }
    
    this.checkServerResourceThresholds(metrics);
  }
  
  /**
   * Record database performance metrics
   */
  recordDatabasePerformanceMetrics(metrics: DatabasePerformanceMetrics): void {
    this.databaseMetrics.push(metrics);
    
    // Limit array size
    if (this.databaseMetrics.length > this.maxMetricsSize) {
      this.databaseMetrics.shift();
    }
    
    this.checkDatabasePerformanceThresholds(metrics);
  }
  
  /**
   * Record network latency metrics
   */
  recordNetworkLatencyMetrics(metrics: NetworkLatencyMetrics): void {
    this.networkMetrics.push(metrics);
    
    // Limit array size
    if (this.networkMetrics.length > this.maxMetricsSize) {
      this.networkMetrics.shift();
    }
    
    this.checkNetworkLatencyThresholds(metrics);
  }
  
  /**
   * Record WebSocket health metrics
   */
  recordWebSocketHealthMetrics(metrics: WebSocketHealthMetrics): void {
    this.websocketMetrics.push(metrics);
    
    // Limit array size
    if (this.websocketMetrics.length > this.maxMetricsSize) {
      this.websocketMetrics.shift();
    }
    
    this.checkWebSocketHealthThresholds(metrics);
  }
  
  /**
   * Record cache performance metrics
   */
  recordCachePerformanceMetrics(metrics: CachePerformanceMetrics): void {
    this.cacheMetrics.push(metrics);
    
    // Limit array size
    if (this.cacheMetrics.length > this.maxMetricsSize) {
      this.cacheMetrics.shift();
    }
    
    this.checkCachePerformanceThresholds(metrics);
  }
  
  /**
   * Record queue processing metrics
   */
  recordQueueProcessingMetrics(metrics: QueueProcessingMetrics): void {
    this.queueMetrics.push(metrics);
    
    // Limit array size
    if (this.queueMetrics.length > this.maxMetricsSize) {
      this.queueMetrics.shift();
    }
    
    this.checkQueueProcessingThresholds(metrics);
  }
  
  /**
   * Get server resource summary
   */
  getServerResourceSummary(periodStart?: Date, periodEnd?: Date): {
    averageCpuUsage: number;
    averageMemoryUsage: number;
    averageDiskUsage: number;
    peakCpuUsage: number;
    peakMemoryUsage: number;
    peakDiskUsage: number;
    serverCount: number;
  } {
    let filteredMetrics = this.serverMetrics;
    
    if (periodStart || periodEnd) {
      filteredMetrics = this.serverMetrics.filter(m => {
        const timestamp = m.timestamp;
        if (periodStart && timestamp < periodStart) return false;
        if (periodEnd && timestamp > periodEnd) return false;
        return true;
      });
    }
    
    if (filteredMetrics.length === 0) {
      return {
        averageCpuUsage: 0,
        averageMemoryUsage: 0,
        averageDiskUsage: 0,
        peakCpuUsage: 0,
        peakMemoryUsage: 0,
        peakDiskUsage: 0,
        serverCount: 0
      };
    }
    
    const cpuUsages = filteredMetrics.map(m => m.cpuUsage);
    const memoryUsages = filteredMetrics.map(m => (m.memoryUsed / m.memoryTotal) * 100);
    const diskUsages = filteredMetrics.map(m => (m.diskUsed / m.diskTotal) * 100);
    
    return {
      averageCpuUsage: cpuUsages.reduce((sum, usage) => sum + usage, 0) / cpuUsages.length,
      averageMemoryUsage: memoryUsages.reduce((sum, usage) => sum + usage, 0) / memoryUsages.length,
      averageDiskUsage: diskUsages.reduce((sum, usage) => sum + usage, 0) / diskUsages.length,
      peakCpuUsage: Math.max(...cpuUsages),
      peakMemoryUsage: Math.max(...memoryUsages),
      peakDiskUsage: Math.max(...diskUsages),
      serverCount: new Set(filteredMetrics.map(m => m.serverId)).size
    };
  }
  
  /**
   * Get database performance summary
   */
  getDatabasePerformanceSummary(periodStart?: Date, periodEnd?: Date): {
    averageQueryTime: number;
    averageConnections: number;
    queryCacheHitRate: number;
    errorRate: number;
    databaseCount: number;
  } {
    let filteredMetrics = this.databaseMetrics;
    
    if (periodStart || periodEnd) {
      filteredMetrics = this.databaseMetrics.filter(m => {
        const timestamp = m.timestamp;
        if (periodStart && timestamp < periodStart) return false;
        if (periodEnd && timestamp > periodEnd) return false;
        return true;
      });
    }
    
    if (filteredMetrics.length === 0) {
      return {
        averageQueryTime: 0,
        averageConnections: 0,
        queryCacheHitRate: 0,
        errorRate: 0,
        databaseCount: 0
      };
    }
    
    const queryTimes = filteredMetrics.map(m => m.averageQueryTime);
    const connections = filteredMetrics.map(m => m.activeConnections);
    const cacheHitRates = filteredMetrics.map(m => m.queryCacheHitRate);
    const errorRates = filteredMetrics.map(m => m.errorRate);
    
    return {
      averageQueryTime: queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length,
      averageConnections: connections.reduce((sum, conn) => sum + conn, 0) / connections.length,
      queryCacheHitRate: cacheHitRates.reduce((sum, rate) => sum + rate, 0) / cacheHitRates.length,
      errorRate: errorRates.reduce((sum, rate) => sum + rate, 0) / errorRates.length,
      databaseCount: new Set(filteredMetrics.map(m => m.databaseId)).size
    };
  }
  
  /**
   * Get infrastructure alerts
   */
  getInfrastructureAlerts(severity?: 'info' | 'warning' | 'critical'): InfrastructureAlert[] {
    let filteredAlerts = this.infrastructureAlerts;
    
    if (severity) {
      filteredAlerts = filteredAlerts.filter(alert => alert.severity === severity);
    }
    
    return filteredAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  
  /**
   * Schedule periodic collection
   */
  private schedulePeriodicCollection(): void {
    if (!this.isMonitoring) return;
    
    // Collect server metrics every 30 seconds
    const serverInterval = setInterval(() => {
      if (this.isMonitoring) {
        this.collectServerMetrics();
      }
    }, 30000);
    this.monitoringIntervals.push(serverInterval);
    
    // Collect database metrics every minute
    const databaseInterval = setInterval(() => {
      if (this.isMonitoring) {
        this.collectDatabaseMetrics();
      }
    }, 60000);
    this.monitoringIntervals.push(databaseInterval);
    
    // Collect WebSocket metrics every 30 seconds
    const websocketInterval = setInterval(() => {
      if (this.isMonitoring) {
        this.collectWebSocketMetrics();
      }
    }, 30000);
    this.monitoringIntervals.push(websocketInterval);
    
    // Collect cache metrics every minute
    const cacheInterval = setInterval(() => {
      if (this.isMonitoring) {
        this.collectCacheMetrics();
      }
    }, 60000);
    this.monitoringIntervals.push(cacheInterval);
    
    // Collect queue metrics every 30 seconds
    const queueInterval = setInterval(() => {
      if (this.isMonitoring) {
        this.collectQueueMetrics();
      }
    }, 30000);
    this.monitoringIntervals.push(queueInterval);
  }
  
  /**
   * Collect server metrics
   */
  private collectServerMetrics(): void {
    // This would typically collect actual system metrics
    // For now, we'll create placeholder metrics
    const metrics: ServerResourceMetrics = {
      timestamp: new Date(),
      serverId: 'server-1',
      cpuUsage: Math.random() * 100,
      cpuLoadAverage: [Math.random() * 2, Math.random() * 2, Math.random() * 2],
      cpuCores: 4,
      memoryTotal: 8192,
      memoryUsed: Math.random() * 8192,
      memoryFree: Math.random() * 1024,
      memoryCached: Math.random() * 2048,
      memoryBuffers: Math.random() * 512,
      swapTotal: 2048,
      swapUsed: Math.random() * 512,
      diskTotal: 102400,
      diskUsed: Math.random() * 51200,
      diskFree: Math.random() * 10240,
      diskReadRate: Math.random() * 100,
      diskWriteRate: Math.random() * 100,
      diskIOPS: Math.floor(Math.random() * 1000),
      networkBytesReceived: Math.random() * 1000,
      networkBytesSent: Math.random() * 1000,
      networkPacketsReceived: Math.floor(Math.random() * 10000),
      networkPacketsSent: Math.floor(Math.random() * 10000),
      networkErrorsIn: Math.floor(Math.random() * 10),
      networkErrorsOut: Math.floor(Math.random() * 10),
      networkDropIn: Math.floor(Math.random() * 5),
      networkDropOut: Math.floor(Math.random() * 5),
      processCount: Math.floor(Math.random() * 200) + 100,
      runningProcesses: Math.floor(Math.random() * 20) + 5,
      sleepingProcesses: Math.floor(Math.random() * 150) + 80,
      zombieProcesses: Math.floor(Math.random() * 5),
      uptime: Math.random() * 86400 * 30, // Up to 30 days
      bootTime: new Date(Date.now() - Math.random() * 86400 * 30 * 1000),
      contextSwitches: Math.floor(Math.random() * 1000000),
      interrupts: Math.floor(Math.random() * 1000000)
    };
    
    this.recordServerResourceMetrics(metrics);
  }
  
  /**
   * Collect database metrics
   */
  private collectDatabaseMetrics(): void {
    const metrics: DatabasePerformanceMetrics = {
      timestamp: new Date(),
      databaseId: 'postgres-main',
      activeConnections: Math.floor(Math.random() * 50) + 10,
      idleConnections: Math.floor(Math.random() * 20) + 5,
      totalConnections: Math.floor(Math.random() * 100) + 20,
      maxConnections: 200,
      connectionErrors: Math.floor(Math.random() * 5),
      queriesPerSecond: Math.random() * 1000,
      slowQueries: Math.floor(Math.random() * 10),
      averageQueryTime: Math.random() * 100,
      queryCacheHitRate: Math.random() * 100,
      transactionsPerSecond: Math.random() * 100,
      activeTransactions: Math.floor(Math.random() * 10),
      deadlocks: Math.floor(Math.random() * 3),
      lockWaitTime: Math.random() * 50,
      replicationLag: Math.random() * 10,
      replicationStatus: 'active',
      databaseSize: Math.random() * 10000 + 1000,
      indexSize: Math.random() * 2000 + 200,
      temporaryFiles: Math.floor(Math.random() * 10),
      temporaryFileSize: Math.random() * 100,
      bufferPoolHitRate: Math.random() * 100,
      tableLocks: Math.floor(Math.random() * 5),
      fullTableScans: Math.floor(Math.random() * 20),
      connectionTimeouts: Math.floor(Math.random() * 3),
      queryTimeouts: Math.floor(Math.random() * 5),
      errorRate: Math.random() * 2
    };
    
    this.recordDatabasePerformanceMetrics(metrics);
  }
  
  /**
   * Collect WebSocket metrics
   */
  private collectWebSocketMetrics(): void {
    const metrics: WebSocketHealthMetrics = {
      timestamp: new Date(),
      serverId: 'websocket-server-1',
      activeConnections: Math.floor(Math.random() * 1000) + 100,
      totalConnections: Math.floor(Math.random() * 5000) + 1000,
      newConnections: Math.floor(Math.random() * 50),
      disconnections: Math.floor(Math.random() * 30),
      averageConnectionDuration: Math.random() * 3600 + 300, // 5 minutes to 1 hour
      connectionErrors: Math.floor(Math.random() * 10),
      reconnectionAttempts: Math.floor(Math.random() * 20),
      successfulReconnections: Math.floor(Math.random() * 15),
      messagesPerSecond: Math.random() * 1000,
      messagesReceived: Math.floor(Math.random() * 10000),
      messagesSent: Math.floor(Math.random() * 10000),
      messageErrors: Math.floor(Math.random() * 50),
      averageMessageLatency: Math.random() * 100,
      maxMessageLatency: Math.random() * 500 + 100,
      messageQueueSize: Math.floor(Math.random() * 100),
      memoryUsage: Math.random() * 512 + 256,
      cpuUsage: Math.random() * 80 + 20,
      connectedClients: Math.floor(Math.random() * 1000) + 100,
      clientTypes: {
        web: Math.floor(Math.random() * 800) + 80,
        mobile: Math.floor(Math.random() * 150) + 15,
        api: Math.floor(Math.random() * 50) + 5
      },
      geographicDistribution: {
        'US': Math.floor(Math.random() * 400) + 40,
        'EU': Math.floor(Math.random() * 300) + 30,
        'ASIA': Math.floor(Math.random() * 200) + 20,
        'OTHER': Math.floor(Math.random() * 100) + 10
      }
    };
    
    this.recordWebSocketHealthMetrics(metrics);
  }
  
  /**
   * Collect cache metrics
   */
  private collectCacheMetrics(): void {
    const metrics: CachePerformanceMetrics = {
      timestamp: new Date(),
      cacheId: 'redis-main',
      cacheType: 'redis',
      hitRate: Math.random() * 100,
      missRate: Math.random() * 100,
      totalHits: Math.floor(Math.random() * 100000),
      totalMisses: Math.floor(Math.random() * 10000),
      averageGetTime: Math.random() * 10,
      averageSetTime: Math.random() * 15,
      averageDeleteTime: Math.random() * 5,
      memoryUsage: Math.random() * 1024 + 256,
      memoryLimit: 2048,
      keyCount: Math.floor(Math.random() * 50000) + 10000,
      evictions: Math.floor(Math.random() * 100),
      expirations: Math.floor(Math.random() * 1000),
      networkBytesIn: Math.random() * 100,
      networkBytesOut: Math.random() * 100,
      connectedClients: Math.floor(Math.random() * 50) + 10,
      connectionErrors: Math.floor(Math.random() * 5),
      timeoutErrors: Math.floor(Math.random() * 3),
      errorRate: Math.random() * 2
    };
    
    this.recordCachePerformanceMetrics(metrics);
  }
  
  /**
   * Collect queue metrics
   */
  private collectQueueMetrics(): void {
    const metrics: QueueProcessingMetrics = {
      timestamp: new Date(),
      queueId: 'task-queue-main',
      queueType: 'task',
      queueSize: Math.floor(Math.random() * 100),
      maxQueueSize: 1000,
      processingRate: Math.random() * 100,
      itemsProcessed: Math.floor(Math.random() * 10000),
      itemsFailed: Math.floor(Math.random() * 100),
      itemsRetried: Math.floor(Math.random() * 50),
      itemsAbandoned: Math.floor(Math.random() * 10),
      averageProcessingTime: Math.random() * 1000,
      maxProcessingTime: Math.random() * 5000 + 1000,
      minProcessingTime: Math.random() * 100,
      activeWorkers: Math.floor(Math.random() * 10) + 2,
      totalWorkers: 20,
      workerUtilization: Math.random() * 100,
      errorRate: Math.random() * 5,
      timeoutRate: Math.random() * 2,
      retryRate: Math.random() * 10,
      averageItemAge: Math.random() * 300, // seconds
      maxItemAge: Math.random() * 3600, // seconds
      oldestItemAge: Math.random() * 1800 // seconds
    };
    
    this.recordQueueProcessingMetrics(metrics);
  }
  
  /**
   * Check server resource thresholds
   */
  private checkServerResourceThresholds(metrics: ServerResourceMetrics): void {
    const cpuUsage = metrics.cpuUsage;
    const memoryUsage = (metrics.memoryUsed / metrics.memoryTotal) * 100;
    const diskUsage = (metrics.diskUsed / metrics.diskTotal) * 100;
    
    // CPU usage alert
    if (cpuUsage > 90) {
      this.createInfrastructureAlert(
        'server_resource',
        'critical',
        'High CPU Usage',
        `Server ${metrics.serverId} CPU usage is ${cpuUsage.toFixed(1)}%`,
        'cpuUsage',
        cpuUsage,
        90,
        {
          serverId: metrics.serverId,
          loadAverage: metrics.cpuLoadAverage
        }
      );
    } else if (cpuUsage > 80) {
      this.createInfrastructureAlert(
        'server_resource',
        'warning',
        'Elevated CPU Usage',
        `Server ${metrics.serverId} CPU usage is ${cpuUsage.toFixed(1)}%`,
        'cpuUsage',
        cpuUsage,
        80,
        {
          serverId: metrics.serverId,
          loadAverage: metrics.cpuLoadAverage
        }
      );
    }
    
    // Memory usage alert
    if (memoryUsage > 90) {
      this.createInfrastructureAlert(
        'server_resource',
        'critical',
        'High Memory Usage',
        `Server ${metrics.serverId} memory usage is ${memoryUsage.toFixed(1)}%`,
        'memoryUsage',
        memoryUsage,
        90,
        {
          serverId: metrics.serverId,
          memoryUsed: metrics.memoryUsed,
          memoryTotal: metrics.memoryTotal
        }
      );
    } else if (memoryUsage > 80) {
      this.createInfrastructureAlert(
        'server_resource',
        'warning',
        'Elevated Memory Usage',
        `Server ${metrics.serverId} memory usage is ${memoryUsage.toFixed(1)}%`,
        'memoryUsage',
        memoryUsage,
        80,
        {
          serverId: metrics.serverId,
          memoryUsed: metrics.memoryUsed,
          memoryTotal: metrics.memoryTotal
        }
      );
    }
    
    // Disk usage alert
    if (diskUsage > 95) {
      this.createInfrastructureAlert(
        'server_resource',
        'critical',
        'Critical Disk Usage',
        `Server ${metrics.serverId} disk usage is ${diskUsage.toFixed(1)}%`,
        'diskUsage',
        diskUsage,
        95,
        {
          serverId: metrics.serverId,
          diskUsed: metrics.diskUsed,
          diskTotal: metrics.diskTotal
        }
      );
    } else if (diskUsage > 85) {
      this.createInfrastructureAlert(
        'server_resource',
        'warning',
        'High Disk Usage',
        `Server ${metrics.serverId} disk usage is ${diskUsage.toFixed(1)}%`,
        'diskUsage',
        diskUsage,
        85,
        {
          serverId: metrics.serverId,
          diskUsed: metrics.diskUsed,
          diskTotal: metrics.diskTotal
        }
      );
    }
  }
  
  /**
   * Check database performance thresholds
   */
  private checkDatabasePerformanceThresholds(metrics: DatabasePerformanceMetrics): void {
    // Connection usage alert
    const connectionUsage = (metrics.activeConnections / metrics.maxConnections) * 100;
    if (connectionUsage > 90) {
      this.createInfrastructureAlert(
        'database_performance',
        'critical',
        'High Database Connection Usage',
        `Database ${metrics.databaseId} connection usage is ${connectionUsage.toFixed(1)}%`,
        'connectionUsage',
        connectionUsage,
        90,
        {
          databaseId: metrics.databaseId,
          activeConnections: metrics.activeConnections,
          maxConnections: metrics.maxConnections
        }
      );
    }
    
    // Slow query alert
    if (metrics.averageQueryTime > 1000) { // 1 second
      this.createInfrastructureAlert(
        'database_performance',
        'warning',
        'Slow Database Queries',
        `Database ${metrics.databaseId} average query time is ${metrics.averageQueryTime.toFixed(0)}ms`,
        'averageQueryTime',
        metrics.averageQueryTime,
        1000,
        {
          databaseId: metrics.databaseId,
          queriesPerSecond: metrics.queriesPerSecond,
          slowQueries: metrics.slowQueries
        }
      );
    }
    
    // Error rate alert
    if (metrics.errorRate > 5) {
      this.createInfrastructureAlert(
        'database_performance',
        'critical',
        'High Database Error Rate',
        `Database ${metrics.databaseId} error rate is ${metrics.errorRate.toFixed(1)}%`,
        'errorRate',
        metrics.errorRate,
        5,
        {
          databaseId: metrics.databaseId,
          connectionTimeouts: metrics.connectionTimeouts,
          queryTimeouts: metrics.queryTimeouts
        }
      );
    }
  }
  
  /**
   * Check network latency thresholds
   */
  private checkNetworkLatencyThresholds(metrics: NetworkLatencyMetrics): void {
    if (metrics.latency > 1000) { // 1 second
      this.createInfrastructureAlert(
        'network_latency',
        'critical',
        'High Network Latency',
        `Network latency from ${metrics.source} to ${metrics.target} is ${metrics.latency.toFixed(0)}ms`,
        'latency',
        metrics.latency,
        1000,
        {
          source: metrics.source,
          target: metrics.target,
          packetLoss: metrics.packetLoss
        }
      );
    } else if (metrics.latency > 500) { // 500ms
      this.createInfrastructureAlert(
        'network_latency',
        'warning',
        'Elevated Network Latency',
        `Network latency from ${metrics.source} to ${metrics.target} is ${metrics.latency.toFixed(0)}ms`,
        'latency',
        metrics.latency,
        500,
        {
          source: metrics.source,
          target: metrics.target,
          packetLoss: metrics.packetLoss
        }
      );
    }
    
    // Packet loss alert
    if (metrics.packetLoss > 5) {
      this.createInfrastructureAlert(
        'network_latency',
        'critical',
        'High Packet Loss',
        `Packet loss from ${metrics.source} to ${metrics.target} is ${metrics.packetLoss.toFixed(1)}%`,
        'packetLoss',
        metrics.packetLoss,
        5,
        {
          source: metrics.source,
          target: metrics.target,
          latency: metrics.latency
        }
      );
    }
  }
  
  /**
   * Check WebSocket health thresholds
   */
  private checkWebSocketHealthThresholds(metrics: WebSocketHealthMetrics): void {
    // Connection error rate
    const errorRate = metrics.connectionErrors / (metrics.newConnections + 1) * 100;
    if (errorRate > 10) {
      this.createInfrastructureAlert(
        'websocket_health',
        'warning',
        'High WebSocket Connection Error Rate',
        `WebSocket server ${metrics.serverId} connection error rate is ${errorRate.toFixed(1)}%`,
        'connectionErrorRate',
        errorRate,
        10,
        {
          serverId: metrics.serverId,
          connectionErrors: metrics.connectionErrors,
          newConnections: metrics.newConnections
        }
      );
    }
    
    // Message latency alert
    if (metrics.averageMessageLatency > 500) {
      this.createInfrastructureAlert(
        'websocket_health',
        'warning',
        'High WebSocket Message Latency',
        `WebSocket server ${metrics.serverId} average message latency is ${metrics.averageMessageLatency.toFixed(0)}ms`,
        'averageMessageLatency',
        metrics.averageMessageLatency,
        500,
        {
          serverId: metrics.serverId,
          messagesPerSecond: metrics.messagesPerSecond,
          messageQueueSize: metrics.messageQueueSize
        }
      );
    }
  }
  
  /**
   * Check cache performance thresholds
   */
  private checkCachePerformanceThresholds(metrics: CachePerformanceMetrics): void {
    // Low hit rate alert
    if (metrics.hitRate < 80) {
      this.createInfrastructureAlert(
        'cache_performance',
        'warning',
        'Low Cache Hit Rate',
        `Cache ${metrics.cacheId} hit rate is ${metrics.hitRate.toFixed(1)}%`,
        'hitRate',
        metrics.hitRate,
        80,
        {
          cacheId: metrics.cacheId,
          cacheType: metrics.cacheType,
          totalHits: metrics.totalHits,
          totalMisses: metrics.totalMisses
        }
      );
    }
    
    // Memory usage alert
    const memoryUsage = (metrics.memoryUsage / metrics.memoryLimit) * 100;
    if (memoryUsage > 90) {
      this.createInfrastructureAlert(
        'cache_performance',
        'critical',
        'High Cache Memory Usage',
        `Cache ${metrics.cacheId} memory usage is ${memoryUsage.toFixed(1)}%`,
        'memoryUsage',
        memoryUsage,
        90,
        {
          cacheId: metrics.cacheId,
          memoryUsage: metrics.memoryUsage,
          memoryLimit: metrics.memoryLimit
        }
      );
    }
  }
  
  /**
   * Check queue processing thresholds
   */
  private checkQueueProcessingThresholds(metrics: QueueProcessingMetrics): void {
    // Queue size alert
    const queueUsage = (metrics.queueSize / metrics.maxQueueSize) * 100;
    if (queueUsage > 80) {
      this.createInfrastructureAlert(
        'queue_processing',
        'warning',
        'High Queue Usage',
        `Queue ${metrics.queueId} usage is ${queueUsage.toFixed(1)}%`,
        'queueUsage',
        queueUsage,
        80,
        {
          queueId: metrics.queueId,
          queueSize: metrics.queueSize,
          maxQueueSize: metrics.maxQueueSize,
          processingRate: metrics.processingRate
        }
      );
    }
    
    // Error rate alert
    if (metrics.errorRate > 10) {
      this.createInfrastructureAlert(
        'queue_processing',
        'critical',
        'High Queue Error Rate',
        `Queue ${metrics.queueId} error rate is ${metrics.errorRate.toFixed(1)}%`,
        'errorRate',
        metrics.errorRate,
        10,
        {
          queueId: metrics.queueId,
          itemsProcessed: metrics.itemsProcessed,
          itemsFailed: metrics.itemsFailed
        }
      );
    }
    
    // Processing time alert
    if (metrics.averageProcessingTime > 5000) { // 5 seconds
      this.createInfrastructureAlert(
        'queue_processing',
        'warning',
        'Slow Queue Processing',
        `Queue ${metrics.queueId} average processing time is ${metrics.averageProcessingTime.toFixed(0)}ms`,
        'averageProcessingTime',
        metrics.averageProcessingTime,
        5000,
        {
          queueId: metrics.queueId,
          activeWorkers: metrics.activeWorkers,
          totalWorkers: metrics.totalWorkers
        }
      );
    }
  }
  
  /**
   * Create infrastructure alert
   */
  private createInfrastructureAlert(
    type: InfrastructureAlert['type'],
    severity: InfrastructureAlert['severity'],
    title: string,
    message: string,
    metric: string,
    value: number,
    threshold: number,
    context?: Record<string, any>
  ): void {
    const alert: InfrastructureAlert = {
      id: `infra_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      title,
      message,
      metric,
      value,
      threshold,
      timestamp: new Date(),
      context
    };
    
    this.infrastructureAlerts.push(alert);
    
    // Limit alerts size
    if (this.infrastructureAlerts.length > 1000) {
      this.infrastructureAlerts.shift();
    }
    
    // Send to Sentry
    captureEnhancedError(
      new Error(`Infrastructure Alert: ${title}`),
      {
        component: 'InfrastructureMonitor',
        action: 'infrastructure_alert',
        additionalData: {
          alertType: type,
          severity,
          metric,
          value,
          threshold,
          ...context
        }
      }
    );
  }
}

// Export singleton instance
export const infrastructureMonitor = InfrastructureMonitor.getInstance();

// Initialize infrastructure monitoring
if (typeof window !== 'undefined') {
  // Start monitoring after page load
  if (document.readyState === 'complete') {
    infrastructureMonitor.startMonitoring();
  } else {
    window.addEventListener('load', () => {
      infrastructureMonitor.startMonitoring();
    });
  }
}