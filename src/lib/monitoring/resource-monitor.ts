/**
 * ResourceMonitor class for monitoring system resources
 * Tracks CPU usage, memory usage, disk I/O, and network usage
 */

import {
  ResourceUsage,
  HistoricalDataPoint,
  ResourceThresholds
} from './monitoring-types';

// Default thresholds for resource monitoring
const DEFAULT_RESOURCE_THRESHOLDS: ResourceThresholds = {
  maxCpuUsage: 80, // 80%
  maxMemoryUsage: 85, // 85%
  maxDiskUsage: 90, // 90%
  minDiskSpace: 1024, // 1GB
  maxNetworkErrorRate: 5 // 5%
};

// Previous resource usage for calculating rates
interface PreviousResourceUsage {
  timestamp: number;
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsSent: number;
  diskReads: number;
  diskWrites: number;
}

export class ResourceMonitor {
  private resourceHistory: ResourceUsage[] = [];
  private previousUsage?: PreviousResourceUsage;
  private thresholds: ResourceThresholds;
  private maxHistorySize: number;
  private enableDebugLogging: boolean;
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring: boolean = false;

  constructor(
    thresholds?: Partial<ResourceThresholds>,
    options?: {
      maxHistorySize?: number;
      enableDebugLogging?: boolean;
    }
  ) {
    this.thresholds = { ...DEFAULT_RESOURCE_THRESHOLDS, ...thresholds };
    this.maxHistorySize = options?.maxHistorySize || 1000;
    this.enableDebugLogging = options?.enableDebugLogging || false;
  }

  /**
   * Start monitoring system resources at a specified interval
   * @param intervalMs The monitoring interval in milliseconds
   */
  startMonitoring(intervalMs: number = 5000): void {
    if (this.isMonitoring) {
      if (this.enableDebugLogging) {
        console.warn('[ResourceMonitor] Monitoring already started');
      }
      return;
    }

    this.isMonitoring = true;
    
    // Collect initial metrics
    this.collectMetrics();
    
    // Set up interval for continuous monitoring
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    if (this.enableDebugLogging) {
      console.log(`[ResourceMonitor] Started monitoring with interval ${intervalMs}ms`);
    }
  }

  /**
   * Stop monitoring system resources
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      if (this.enableDebugLogging) {
        console.warn('[ResourceMonitor] Monitoring not started');
      }
      return;
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    if (this.enableDebugLogging) {
      console.log('[ResourceMonitor] Stopped monitoring');
    }
  }

  /**
   * Collect current resource metrics
   * @returns The current resource usage
   */
  collectMetrics(): ResourceUsage {
    const timestamp = new Date();
    
    // Collect CPU metrics
    const cpuMetrics = this.getCpuMetrics();
    
    // Collect memory metrics
    const memoryMetrics = this.getMemoryMetrics();
    
    // Collect disk metrics
    const diskMetrics = this.getDiskMetrics();
    
    // Collect network metrics
    const networkMetrics = this.getNetworkMetrics();
    
    // Collect process metrics
    const processMetrics = this.getProcessMetrics();
    
    // Create the resource usage object
    const resourceUsage: ResourceUsage = {
      timestamp,
      ...cpuMetrics,
      ...memoryMetrics,
      ...diskMetrics,
      ...networkMetrics,
      ...processMetrics
    };
    
    // Add to history
    this.resourceHistory.push(resourceUsage);
    
    // Limit history size
    if (this.resourceHistory.length > this.maxHistorySize) {
      this.resourceHistory.shift();
    }
    
    // Update previous usage for rate calculations
    this.updatePreviousUsage(resourceUsage, timestamp);
    
    if (this.enableDebugLogging) {
      console.log('[ResourceMonitor] Collected metrics:', {
        cpuUsage: resourceUsage.cpuUsage,
        memoryUsagePercent: resourceUsage.memoryUsagePercent,
        diskUsagePercent: resourceUsage.diskUsagePercent,
        activeTrades: resourceUsage.activeTrades
      });
    }
    
    return resourceUsage;
  }

  /**
   * Get current resource usage
   * @returns The current resource usage
   */
  getCurrentUsage(): ResourceUsage | null {
    return this.resourceHistory.length > 0
      ? this.resourceHistory[this.resourceHistory.length - 1]
      : null;
  }

  /**
   * Get resource usage history
   * @param periodStart Start of the period
   * @param periodEnd End of the period
   * @returns Array of resource usage data
   */
  getHistory(periodStart?: Date, periodEnd?: Date): ResourceUsage[] {
    let filteredHistory = this.resourceHistory;
    
    if (periodStart || periodEnd) {
      filteredHistory = this.resourceHistory.filter(usage => {
        const timestamp = usage.timestamp;
        if (periodStart && timestamp < periodStart) return false;
        if (periodEnd && timestamp > periodEnd) return false;
        return true;
      });
    }
    
    return filteredHistory;
  }

  /**
   * Get historical data for a specific metric
   * @param metric The metric to get data for
   * @param periodStart Start of the period
   * @param periodEnd End of the period
   * @returns Array of historical data points
   */
  getHistoricalData(
    metric: keyof ResourceUsage,
    periodStart?: Date,
    periodEnd?: Date
  ): HistoricalDataPoint<number>[] {
    const filteredHistory = this.getHistory(periodStart, periodEnd);
    
    return filteredHistory
      .map(usage => ({
        timestamp: usage.timestamp,
        value: usage[metric] as number
      }))
      .filter(point => typeof point.value === 'number')
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Check if resource usage exceeds thresholds
   * @param usage The resource usage to check
   * @returns Object with threshold violations
   */
  checkThresholds(usage: ResourceUsage): Record<string, boolean> {
    return {
      cpuUsage: usage.cpuUsage > this.thresholds.maxCpuUsage,
      memoryUsage: usage.memoryUsagePercent > this.thresholds.maxMemoryUsage,
      diskUsage: usage.diskUsagePercent > this.thresholds.maxDiskUsage,
      diskSpace: (usage.diskTotal - usage.diskUsed) < this.thresholds.minDiskSpace,
      networkErrorRate: usage.networkErrorRate > this.thresholds.maxNetworkErrorRate
    };
  }

  /**
   * Get resource usage statistics for a specific time period
   * @param metric The metric to get statistics for
   * @param periodStart Start of the period
   * @param periodEnd End of the period
   * @returns Statistics for the metric
   */
  getStatistics(
    metric: keyof ResourceUsage,
    periodStart?: Date,
    periodEnd?: Date
  ): {
    min: number;
    max: number;
    mean: number;
    median: number;
    standardDeviation: number;
    count: number;
  } {
    const historicalData = this.getHistoricalData(metric, periodStart, periodEnd);
    
    if (historicalData.length === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        standardDeviation: 0,
        count: 0
      };
    }
    
    const values = historicalData.map(d => d.value);
    values.sort((a, b) => a - b);
    
    const count = values.length;
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / count;
    
    // Calculate median
    const median = count % 2 === 0
      ? (values[count / 2 - 1] + values[count / 2]) / 2
      : values[Math.floor(count / 2)];
    
    // Calculate variance and standard deviation
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
    const standardDeviation = Math.sqrt(variance);
    
    return {
      min: values[0],
      max: values[count - 1],
      mean,
      median,
      standardDeviation,
      count
    };
  }

  /**
   * Clear all resource history
   */
  clearHistory(): void {
    this.resourceHistory = [];
    this.previousUsage = undefined;
    
    if (this.enableDebugLogging) {
      console.log('[ResourceMonitor] Cleared all history');
    }
  }

  /**
   * Get the current thresholds
   * @returns The current thresholds
   */
  getThresholds(): ResourceThresholds {
    return { ...this.thresholds };
  }

  /**
   * Update the thresholds
   * @param newThresholds The new thresholds
   */
  updateThresholds(newThresholds: Partial<ResourceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    
    if (this.enableDebugLogging) {
      console.log('[ResourceMonitor] Updated thresholds:', this.thresholds);
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
   * Get CPU metrics
   * @returns CPU metrics object
   */
  private getCpuMetrics(): {
    cpuUsage: number;
    cpuLoadAverage: number[];
    cpuCores: number;
  } {
    try {
      // Use Node.js process.cpuUsage() for CPU usage
      const cpuUsage = process.cpuUsage();
      const totalUsage = cpuUsage.user + cpuUsage.system;
      
      // Convert to percentage (this is a simplified calculation)
      // In a real implementation, you would use a library like systeminformation
      const cpuUsagePercent = Math.min(100, (totalUsage / 1000000) * 10); // Rough approximation
      
      // Get load average (Node.js provides this)
      const loadAverage = require('os').loadavg();
      
      // Get CPU cores
      const cpuCores = require('os').cpus().length;
      
      return {
        cpuUsage: cpuUsagePercent,
        cpuLoadAverage: loadAverage,
        cpuCores
      };
    } catch (error) {
      if (this.enableDebugLogging) {
        console.error('[ResourceMonitor] Error getting CPU metrics:', error);
      }
      
      return {
        cpuUsage: 0,
        cpuLoadAverage: [0, 0, 0],
        cpuCores: 1
      };
    }
  }

  /**
   * Get memory metrics
   * @returns Memory metrics object
   */
  private getMemoryMetrics(): {
    memoryUsed: number;
    memoryTotal: number;
    memoryUsagePercent: number;
    heapUsed: number;
    heapTotal: number;
    heapUsagePercent: number;
  } {
    try {
      // Get process memory usage
      const memoryUsage = process.memoryUsage();
      const os = require('os');
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      
      return {
        memoryUsed: Math.round(usedMemory / 1024 / 1024), // In MB
        memoryTotal: Math.round(totalMemory / 1024 / 1024), // In MB
        memoryUsagePercent: (usedMemory / totalMemory) * 100,
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // In MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // In MB
        heapUsagePercent: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      };
    } catch (error) {
      if (this.enableDebugLogging) {
        console.error('[ResourceMonitor] Error getting memory metrics:', error);
      }
      
      return {
        memoryUsed: 0,
        memoryTotal: 0,
        memoryUsagePercent: 0,
        heapUsed: 0,
        heapTotal: 0,
        heapUsagePercent: 0
      };
    }
  }

  /**
   * Get disk metrics
   * @returns Disk metrics object
   */
  private getDiskMetrics(): {
    diskUsed: number;
    diskTotal: number;
    diskUsagePercent: number;
    diskReadRate: number;
    diskWriteRate: number;
  } {
    try {
      // In a real implementation, you would use a library like systeminformation
      // For now, we'll return placeholder values
      
      // For demonstration, we'll simulate disk usage
      const diskTotal = 100000; // 100GB in MB
      const diskUsed = diskTotal * 0.6; // 60% used
      const diskUsagePercent = (diskUsed / diskTotal) * 100;
      
      // Calculate disk I/O rates if we have previous data
      let diskReadRate = 0;
      let diskWriteRate = 0;
      
      if (this.previousUsage) {
        const timeDiff = (Date.now() - this.previousUsage.timestamp) / 1000; // In seconds
        
        if (timeDiff > 0) {
          // Simulate some disk activity
          diskReadRate = Math.random() * 10; // In MB/s
          diskWriteRate = Math.random() * 10; // In MB/s
        }
      }
      
      return {
        diskUsed: Math.round(diskUsed),
        diskTotal: Math.round(diskTotal),
        diskUsagePercent,
        diskReadRate,
        diskWriteRate
      };
    } catch (error) {
      if (this.enableDebugLogging) {
        console.error('[ResourceMonitor] Error getting disk metrics:', error);
      }
      
      return {
        diskUsed: 0,
        diskTotal: 0,
        diskUsagePercent: 0,
        diskReadRate: 0,
        diskWriteRate: 0
      };
    }
  }

  /**
   * Get network metrics
   * @returns Network metrics object
   */
  private getNetworkMetrics(): {
    networkBytesReceived: number;
    networkBytesSent: number;
    networkPacketsReceived: number;
    networkPacketsSent: number;
    networkErrorRate: number;
  } {
    try {
      // In a real implementation, you would use a library like systeminformation
      // For now, we'll return placeholder values
      
      // Simulate network activity
      const bytesReceived = Math.floor(Math.random() * 1000000); // In MB
      const bytesSent = Math.floor(Math.random() * 1000000); // In MB
      const packetsReceived = Math.floor(Math.random() * 10000);
      const packetsSent = Math.floor(Math.random() * 10000);
      
      // Calculate network error rate
      const totalPackets = packetsReceived + packetsSent;
      const errorPackets = Math.floor(totalPackets * 0.01); // 1% error rate
      const networkErrorRate = totalPackets > 0 ? (errorPackets / totalPackets) * 100 : 0;
      
      return {
        networkBytesReceived: Math.round(bytesReceived / 1024 / 1024), // In MB
        networkBytesSent: Math.round(bytesSent / 1024 / 1024), // In MB
        networkPacketsReceived: packetsReceived,
        networkPacketsSent: packetsSent,
        networkErrorRate
      };
    } catch (error) {
      if (this.enableDebugLogging) {
        console.error('[ResourceMonitor] Error getting network metrics:', error);
      }
      
      return {
        networkBytesReceived: 0,
        networkBytesSent: 0,
        networkPacketsReceived: 0,
        networkPacketsSent: 0,
        networkErrorRate: 0
      };
    }
  }

  /**
   * Get process metrics
   * @returns Process metrics object
   */
  private getProcessMetrics(): {
    uptime: number;
    fileDescriptors: number;
    threads: number;
    activeTrades: number;
    activeUsers: number;
    activeStrategies: number;
    queuedTasks: number;
  } {
    try {
      // Get process uptime
      const uptime = Math.round(process.uptime());
      
      // In a real implementation, you would get these values from your application state
      // For now, we'll return placeholder values
      const activeTrades = Math.floor(Math.random() * 10);
      const activeUsers = Math.floor(Math.random() * 50);
      const activeStrategies = Math.floor(Math.random() * 20);
      const queuedTasks = Math.floor(Math.random() * 5);
      
      return {
        uptime,
        fileDescriptors: 0, // Not available in Node.js by default
        threads: 0, // Not available in Node.js by default
        activeTrades,
        activeUsers,
        activeStrategies,
        queuedTasks
      };
    } catch (error) {
      if (this.enableDebugLogging) {
        console.error('[ResourceMonitor] Error getting process metrics:', error);
      }
      
      return {
        uptime: 0,
        fileDescriptors: 0,
        threads: 0,
        activeTrades: 0,
        activeUsers: 0,
        activeStrategies: 0,
        queuedTasks: 0
      };
    }
  }

  /**
   * Update the previous usage for rate calculations
   * @param usage The current resource usage
   * @param timestamp The current timestamp
   */
  private updatePreviousUsage(usage: ResourceUsage, timestamp: Date): void {
    this.previousUsage = {
      timestamp: timestamp.getTime(),
      bytesReceived: usage.networkBytesReceived,
      bytesSent: usage.networkBytesSent,
      packetsReceived: usage.networkPacketsReceived,
      packetsSent: usage.networkPacketsSent,
      diskReads: usage.diskReadRate,
      diskWrites: usage.diskWriteRate
    };
  }
}