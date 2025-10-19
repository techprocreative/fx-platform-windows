/**
 * LatencyTracker class for tracking system latency
 * Provides end-to-end latency measurement and component-level latency tracking
 */

import {
  LatencyMetrics,
  LatencyStatistics,
  ComponentLatencyBreakdown,
  HistoricalDataPoint,
  LatencyThresholds
} from './monitoring-types';

// Interface for latency measurement context
interface LatencyContext {
  id: string;
  startTime: number;
  componentStartTimes: Map<string, number>;
  metadata?: Record<string, any>;
}

// Default thresholds for latency monitoring
const DEFAULT_LATENCY_THRESHOLDS: LatencyThresholds = {
  endToEndLatency: 1000, // 1 second
  signalProcessingLatency: 100, // 100ms
  brokerApiLatency: 500, // 500ms
  orderValidationLatency: 50, // 50ms
  riskCheckLatency: 100, // 100ms
  networkLatency: 200 // 200ms
};

export class LatencyTracker {
  private activeContexts = new Map<string, LatencyContext>();
  private latencyHistory: LatencyMetrics[] = [];
  private componentLatencyHistory = new Map<string, number[]>();
  private thresholds: LatencyThresholds;
  private maxHistorySize: number;
  private enableDebugLogging: boolean;

  constructor(
    thresholds?: Partial<LatencyThresholds>,
    options?: {
      maxHistorySize?: number;
      enableDebugLogging?: boolean;
    }
  ) {
    this.thresholds = { ...DEFAULT_LATENCY_THRESHOLDS, ...thresholds };
    this.maxHistorySize = options?.maxHistorySize || 10000;
    this.enableDebugLogging = options?.enableDebugLogging || false;
  }

  /**
   * Start tracking a new latency measurement
   * @param id Unique identifier for this measurement
   * @param metadata Optional metadata to store with the measurement
   * @returns The context ID for this measurement
   */
  startMeasurement(id: string, metadata?: Record<string, any>): string {
    const context: LatencyContext = {
      id,
      startTime: Date.now(),
      componentStartTimes: new Map(),
      metadata
    };

    this.activeContexts.set(id, context);

    if (this.enableDebugLogging) {
      console.log(`[LatencyTracker] Started measurement ${id}`);
    }

    return id;
  }

  /**
   * Mark the start time for a specific component
   * @param measurementId The measurement ID
   * @param componentName The name of the component
   */
  startComponent(measurementId: string, componentName: string): void {
    const context = this.activeContexts.get(measurementId);
    if (!context) {
      if (this.enableDebugLogging) {
        console.warn(`[LatencyTracker] Measurement ${measurementId} not found`);
      }
      return;
    }

    context.componentStartTimes.set(componentName, Date.now());

    if (this.enableDebugLogging) {
      console.log(`[LatencyTracker] Started component ${componentName} for measurement ${measurementId}`);
    }
  }

  /**
   * Mark the end time for a specific component
   * @param measurementId The measurement ID
   * @param componentName The name of the component
   */
  endComponent(measurementId: string, componentName: string): void {
    const context = this.activeContexts.get(measurementId);
    if (!context) {
      if (this.enableDebugLogging) {
        console.warn(`[LatencyTracker] Measurement ${measurementId} not found`);
      }
      return;
    }

    const startTime = context.componentStartTimes.get(componentName);
    if (!startTime) {
      if (this.enableDebugLogging) {
        console.warn(`[LatencyTracker] Component ${componentName} not started for measurement ${measurementId}`);
      }
      return;
    }

    const latency = Date.now() - startTime;
    
    // Store component latency
    if (!this.componentLatencyHistory.has(componentName)) {
      this.componentLatencyHistory.set(componentName, []);
    }
    
    const componentHistory = this.componentLatencyHistory.get(componentName)!;
    componentHistory.push(latency);
    
    // Limit history size
    if (componentHistory.length > this.maxHistorySize) {
      componentHistory.shift();
    }

    if (this.enableDebugLogging) {
      console.log(`[LatencyTracker] Ended component ${componentName} for measurement ${measurementId}: ${latency}ms`);
    }
  }

  /**
   * End a latency measurement and record the metrics
   * @param measurementId The measurement ID
   * @param additionalData Additional data to include in the metrics
   * @returns The recorded latency metrics
   */
  endMeasurement(
    measurementId: string,
    additionalData?: Partial<LatencyMetrics>
  ): LatencyMetrics | null {
    const context = this.activeContexts.get(measurementId);
    if (!context) {
      if (this.enableDebugLogging) {
        console.warn(`[LatencyTracker] Measurement ${measurementId} not found`);
      }
      return null;
    }

    const endTime = Date.now();
    const endToEndLatency = endTime - context.startTime;

    // Create the metrics object
    const metrics: LatencyMetrics = {
      endToEndLatency,
      signalProcessingLatency: 0,
      brokerApiLatency: 0,
      orderValidationLatency: 0,
      riskCheckLatency: 0,
      networkLatency: 0,
      roundTripTime: endToEndLatency,
      signalTimestamp: new Date(context.startTime),
      processingStartTimestamp: new Date(context.startTime),
      executionTimestamp: new Date(endTime),
      ...additionalData,
      ...context.metadata
    };

    // Store the metrics
    this.latencyHistory.push(metrics);
    
    // Limit history size
    if (this.latencyHistory.length > this.maxHistorySize) {
      this.latencyHistory.shift();
    }

    // Clean up the context
    this.activeContexts.delete(measurementId);

    if (this.enableDebugLogging) {
      console.log(`[LatencyTracker] Ended measurement ${measurementId}: ${endToEndLatency}ms`);
    }

    return metrics;
  }

  /**
   * Record a complete latency measurement with all component latencies
   * @param metrics The complete latency metrics
   */
  recordLatency(metrics: LatencyMetrics): void {
    this.latencyHistory.push(metrics);
    
    // Limit history size
    if (this.latencyHistory.length > this.maxHistorySize) {
      this.latencyHistory.shift();
    }

    // Update component latency history
    const components = [
      { name: 'signalProcessing', value: metrics.signalProcessingLatency },
      { name: 'brokerApi', value: metrics.brokerApiLatency },
      { name: 'orderValidation', value: metrics.orderValidationLatency },
      { name: 'riskCheck', value: metrics.riskCheckLatency },
      { name: 'network', value: metrics.networkLatency }
    ];

    for (const component of components) {
      if (component.value > 0) {
        if (!this.componentLatencyHistory.has(component.name)) {
          this.componentLatencyHistory.set(component.name, []);
        }
        
        const componentHistory = this.componentLatencyHistory.get(component.name)!;
        componentHistory.push(component.value);
        
        // Limit history size
        if (componentHistory.length > this.maxHistorySize) {
          componentHistory.shift();
        }
      }
    }

    if (this.enableDebugLogging) {
      console.log(`[LatencyTracker] Recorded latency: ${metrics.endToEndLatency}ms`);
    }
  }

  /**
   * Get latency statistics for a specific time period
   * @param periodStart Start of the period
   * @param periodEnd End of the period
   * @returns Latency statistics for the period
   */
  getStatistics(periodStart?: Date, periodEnd?: Date): LatencyStatistics {
    // Filter metrics by time period
    let filteredMetrics = this.latencyHistory;
    
    if (periodStart || periodEnd) {
      filteredMetrics = this.latencyHistory.filter(metric => {
        const timestamp = metric.executionTimestamp;
        if (periodStart && timestamp < periodStart) return false;
        if (periodEnd && timestamp > periodEnd) return false;
        return true;
      });
    }

    if (filteredMetrics.length === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        standardDeviation: 0,
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        count: 0,
        sum: 0,
        variance: 0,
        periodStart: periodStart || new Date(),
        periodEnd: periodEnd || new Date(),
        componentBreakdown: []
      };
    }

    // Extract end-to-end latencies
    const latencies = filteredMetrics.map(m => m.endToEndLatency);
    
    // Sort for percentile calculations
    latencies.sort((a, b) => a - b);
    
    // Calculate basic statistics
    const count = latencies.length;
    const sum = latencies.reduce((acc, val) => acc + val, 0);
    const mean = sum / count;
    
    // Calculate median
    const median = count % 2 === 0
      ? (latencies[count / 2 - 1] + latencies[count / 2]) / 2
      : latencies[Math.floor(count / 2)];
    
    // Calculate percentiles
    const p50 = this.getPercentile(latencies, 50);
    const p75 = this.getPercentile(latencies, 75);
    const p90 = this.getPercentile(latencies, 90);
    const p95 = this.getPercentile(latencies, 95);
    const p99 = this.getPercentile(latencies, 99);
    
    // Calculate variance and standard deviation
    const variance = latencies.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
    const standardDeviation = Math.sqrt(variance);
    
    // Calculate component breakdown
    const componentBreakdown = this.getComponentBreakdown(filteredMetrics);
    
    return {
      min: latencies[0],
      max: latencies[count - 1],
      mean,
      median,
      standardDeviation,
      p50,
      p75,
      p90,
      p95,
      p99,
      count,
      sum,
      variance,
      periodStart: periodStart || new Date(Math.min(...filteredMetrics.map(m => m.executionTimestamp.getTime()))),
      periodEnd: periodEnd || new Date(Math.max(...filteredMetrics.map(m => m.executionTimestamp.getTime()))),
      componentBreakdown
    };
  }

  /**
   * Get latency statistics for a specific component
   * @param componentName The name of the component
   * @param periodStart Start of the period
   * @param periodEnd End of the period
   * @returns Latency statistics for the component
   */
  getComponentStatistics(
    componentName: string,
    periodStart?: Date,
    periodEnd?: Date
  ): LatencyStatistics | null {
    const componentHistory = this.componentLatencyHistory.get(componentName);
    if (!componentHistory || componentHistory.length === 0) {
      return null;
    }

    // For component statistics, we don't have timestamps, so we'll use all available data
    const latencies = [...componentHistory];
    latencies.sort((a, b) => a - b);
    
    // Calculate basic statistics
    const count = latencies.length;
    const sum = latencies.reduce((acc, val) => acc + val, 0);
    const mean = sum / count;
    
    // Calculate median
    const median = count % 2 === 0
      ? (latencies[count / 2 - 1] + latencies[count / 2]) / 2
      : latencies[Math.floor(count / 2)];
    
    // Calculate percentiles
    const p50 = this.getPercentile(latencies, 50);
    const p75 = this.getPercentile(latencies, 75);
    const p90 = this.getPercentile(latencies, 90);
    const p95 = this.getPercentile(latencies, 95);
    const p99 = this.getPercentile(latencies, 99);
    
    // Calculate variance and standard deviation
    const variance = latencies.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
    const standardDeviation = Math.sqrt(variance);
    
    return {
      min: latencies[0],
      max: latencies[count - 1],
      mean,
      median,
      standardDeviation,
      p50,
      p75,
      p90,
      p95,
      p99,
      count,
      sum,
      variance,
      periodStart: periodStart || new Date(),
      periodEnd: periodEnd || new Date()
    };
  }

  /**
   * Check if latency exceeds thresholds
   * @param metrics The latency metrics to check
   * @returns Object with threshold violations
   */
  checkThresholds(metrics: LatencyMetrics): Record<string, boolean> {
    return {
      endToEndLatency: metrics.endToEndLatency > this.thresholds.endToEndLatency,
      signalProcessingLatency: metrics.signalProcessingLatency > this.thresholds.signalProcessingLatency,
      brokerApiLatency: metrics.brokerApiLatency > this.thresholds.brokerApiLatency,
      orderValidationLatency: metrics.orderValidationLatency > this.thresholds.orderValidationLatency,
      riskCheckLatency: metrics.riskCheckLatency > this.thresholds.riskCheckLatency,
      networkLatency: metrics.networkLatency > this.thresholds.networkLatency
    };
  }

  /**
   * Get historical latency data
   * @param periodStart Start of the period
   * @param periodEnd End of the period
   * @returns Array of historical data points
   */
  getHistoricalData(periodStart?: Date, periodEnd?: Date): HistoricalDataPoint<number>[] {
    let filteredMetrics = this.latencyHistory;
    
    if (periodStart || periodEnd) {
      filteredMetrics = this.latencyHistory.filter(metric => {
        const timestamp = metric.executionTimestamp;
        if (periodStart && timestamp < periodStart) return false;
        if (periodEnd && timestamp > periodEnd) return false;
        return true;
      });
    }

    return filteredMetrics.map(metric => ({
      timestamp: metric.executionTimestamp,
      value: metric.endToEndLatency,
      metadata: {
        symbol: metric.symbol,
        orderType: metric.orderType,
        broker: metric.broker
      }
    }));
  }

  /**
   * Clear all latency history
   */
  clearHistory(): void {
    this.latencyHistory = [];
    this.componentLatencyHistory.clear();
    
    if (this.enableDebugLogging) {
      console.log('[LatencyTracker] Cleared all history');
    }
  }

  /**
   * Get the current thresholds
   * @returns The current thresholds
   */
  getThresholds(): LatencyThresholds {
    return { ...this.thresholds };
  }

  /**
   * Update the thresholds
   * @param newThresholds The new thresholds
   */
  updateThresholds(newThresholds: Partial<LatencyThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    
    if (this.enableDebugLogging) {
      console.log('[LatencyTracker] Updated thresholds:', this.thresholds);
    }
  }

  /**
   * Calculate percentile from sorted array
   * @param sortedArray Sorted array of values
   * @param percentile Percentile to calculate (0-100)
   * @returns The percentile value
   */
  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower];
    }
    
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Calculate component breakdown for a set of metrics
   * @param metrics The latency metrics
   * @returns Array of component latency breakdowns
   */
  private getComponentBreakdown(metrics: LatencyMetrics[]): ComponentLatencyBreakdown[] {
    const components = [
      'signalProcessingLatency',
      'brokerApiLatency',
      'orderValidationLatency',
      'riskCheckLatency',
      'networkLatency'
    ];

    return components.map(componentName => {
      const values = metrics
        .map(m => (m as any)[componentName] as number)
        .filter(v => v > 0);
      
      if (values.length === 0) {
        return {
          component: componentName.replace('Latency', ''),
          min: 0,
          max: 0,
          mean: 0,
          p95: 0,
          contribution: 0
        };
      }

      values.sort((a, b) => a - b);
      
      const count = values.length;
      const sum = values.reduce((acc, val) => acc + val, 0);
      const mean = sum / count;
      const p95 = this.getPercentile(values, 95);
      
      // Calculate contribution to total latency
      const totalLatency = metrics.reduce((acc, m) => acc + m.endToEndLatency, 0);
      const componentTotal = values.reduce((acc, val) => acc + val, 0);
      const contribution = totalLatency > 0 ? (componentTotal / totalLatency) * 100 : 0;
      
      return {
        component: componentName.replace('Latency', ''),
        min: values[0],
        max: values[count - 1],
        mean,
        p95,
        contribution
      };
    });
  }
}