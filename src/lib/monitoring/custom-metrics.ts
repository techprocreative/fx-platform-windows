/**
 * Custom Metrics Collection System
 * 
 * This module provides a flexible system for collecting custom metrics:
 * - Counter metrics
 * - Gauge metrics
 * - Histogram metrics
 * - Summary metrics
 * - Metric labels and dimensions
 * - Metric aggregation
 * - Metric export to various formats
 */

import { captureEnhancedError, addBreadcrumb, ErrorCategory } from './sentry';

// Metric types
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary'
}

// Metric value types
export type MetricValue = number | string | boolean;

// Metric interface
export interface Metric {
  name: string;
  type: MetricType;
  value: MetricValue;
  labels: Record<string, string>;
  timestamp: Date;
  help?: string;
}

// Counter metric interface
export interface CounterMetric extends Metric {
  type: MetricType.COUNTER;
  value: number;
}

// Gauge metric interface
export interface GaugeMetric extends Metric {
  type: MetricType.GAUGE;
  value: number;
}

// Histogram metric interface
export interface HistogramMetric extends Metric {
  type: MetricType.HISTOGRAM;
  value: number;
  buckets: Array<{ le: number; count: number }>;
  count: number;
  sum: number;
}

// Summary metric interface
export interface SummaryMetric extends Metric {
  type: MetricType.SUMMARY;
  value: number;
  quantiles: Array<{ quantile: number; value: number }>;
  count: number;
  sum: number;
}

// Metric registry interface
export interface MetricRegistry {
  counters: Map<string, CounterMetric>;
  gauges: Map<string, GaugeMetric>;
  histograms: Map<string, HistogramMetric>;
  summaries: Map<string, SummaryMetric>;
}

// Metric aggregation interface
export interface MetricAggregation {
  name: string;
  type: MetricType;
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count';
  labels: Record<string, string>;
  timeRange: {
    start: Date;
    end: Date;
  };
  result: number;
}

// Metric export format
export type MetricExportFormat = 'prometheus' | 'json' | 'influx' | 'statsd';

export class CustomMetricsCollector {
  private static instance: CustomMetricsCollector;
  private registry: MetricRegistry;
  private metricHistory: Map<string, Metric[]> = new Map();
  private maxHistorySize: number = 10000;
  private isCollecting: boolean = false;
  
  private constructor() {
    this.registry = {
      counters: new Map(),
      gauges: new Map(),
      histograms: new Map(),
      summaries: new Map()
    };
  }
  
  static getInstance(): CustomMetricsCollector {
    if (!CustomMetricsCollector.instance) {
      CustomMetricsCollector.instance = new CustomMetricsCollector();
    }
    return CustomMetricsCollector.instance;
  }
  
  /**
   * Start metrics collection
   */
  startCollection(): void {
    if (this.isCollecting) return;
    
    this.isCollecting = true;
    
    addBreadcrumb(
      'Custom metrics collection started',
      'custom_metrics',
      'info'
    );
  }
  
  /**
   * Stop metrics collection
   */
  stopCollection(): void {
    this.isCollecting = false;
    
    addBreadcrumb(
      'Custom metrics collection stopped',
      'custom_metrics',
      'info'
    );
  }
  
  /**
   * Create or increment a counter metric
   */
  incrementCounter(
    name: string,
    value: number = 1,
    labels: Record<string, string> = {},
    help?: string
  ): void {
    const key = this.getMetricKey(name, labels);
    const existing = this.registry.counters.get(key);
    
    if (existing) {
      existing.value += value;
      existing.timestamp = new Date();
    } else {
      const counter: CounterMetric = {
        name,
        type: MetricType.COUNTER,
        value,
        labels,
        timestamp: new Date(),
        help
      };
      
      this.registry.counters.set(key, counter);
    }
    
    // Add to history
    this.addToHistory(name, this.registry.counters.get(key)!);
  }
  
  /**
   * Set a gauge metric value
   */
  setGauge(
    name: string,
    value: number,
    labels: Record<string, string> = {},
    help?: string
  ): void {
    const key = this.getMetricKey(name, labels);
    const gauge: GaugeMetric = {
      name,
      type: MetricType.GAUGE,
      value,
      labels,
      timestamp: new Date(),
      help
    };
    
    this.registry.gauges.set(key, gauge);
    
    // Add to history
    this.addToHistory(name, gauge);
  }
  
  /**
   * Record a value in a histogram metric
   */
  recordHistogram(
    name: string,
    value: number,
    labels: Record<string, string> = {},
    buckets: number[] = [0.1, 0.5, 1, 2.5, 5, 10],
    help?: string
  ): void {
    const key = this.getMetricKey(name, labels);
    const existing = this.registry.histograms.get(key);
    
    if (existing) {
      // Update existing histogram
      existing.value = value;
      existing.timestamp = new Date();
      existing.count++;
      existing.sum += value;
      
      // Update buckets
      for (const bucket of existing.buckets) {
        if (value <= bucket.le) {
          bucket.count++;
        }
      }
    } else {
      // Create new histogram
      const histogramBuckets = buckets.map(le => ({ le, count: 0 }));
      
      // Find appropriate bucket
      for (const bucket of histogramBuckets) {
        if (value <= bucket.le) {
          bucket.count++;
        }
      }
      
      const histogram: HistogramMetric = {
        name,
        type: MetricType.HISTOGRAM,
        value,
        labels,
        timestamp: new Date(),
        buckets: histogramBuckets,
        count: 1,
        sum: value,
        help
      };
      
      this.registry.histograms.set(key, histogram);
    }
    
    // Add to history
    this.addToHistory(name, this.registry.histograms.get(key)!);
  }
  
  /**
   * Record a value in a summary metric
   */
  recordSummary(
    name: string,
    value: number,
    labels: Record<string, string> = {},
    quantiles: number[] = [0.5, 0.9, 0.95, 0.99],
    help?: string
  ): void {
    const key = this.getMetricKey(name, labels);
    const existing = this.registry.summaries.get(key);
    
    if (existing) {
      // Update existing summary
      existing.value = value;
      existing.timestamp = new Date();
      existing.count++;
      existing.sum += value;
      
      // Update quantiles (simplified - would need proper calculation in real implementation)
      existing.quantiles = quantiles.map(q => ({
        quantile: q,
        value: q * existing.sum / existing.count // Simplified calculation
      }));
    } else {
      // Create new summary
      const summaryQuantiles = quantiles.map(q => ({
        quantile: q,
        value: q * value // Simplified calculation
      }));
      
      const summary: SummaryMetric = {
        name,
        type: MetricType.SUMMARY,
        value,
        labels,
        timestamp: new Date(),
        quantiles: summaryQuantiles,
        count: 1,
        sum: value,
        help
      };
      
      this.registry.summaries.set(key, summary);
    }
    
    // Add to history
    this.addToHistory(name, this.registry.summaries.get(key)!);
  }
  
  /**
   * Get a counter metric
   */
  getCounter(name: string, labels: Record<string, string> = {}): CounterMetric | undefined {
    const key = this.getMetricKey(name, labels);
    return this.registry.counters.get(key);
  }
  
  /**
   * Get a gauge metric
   */
  getGauge(name: string, labels: Record<string, string> = {}): GaugeMetric | undefined {
    const key = this.getMetricKey(name, labels);
    return this.registry.gauges.get(key);
  }
  
  /**
   * Get a histogram metric
   */
  getHistogram(name: string, labels: Record<string, string> = {}): HistogramMetric | undefined {
    const key = this.getMetricKey(name, labels);
    return this.registry.histograms.get(key);
  }
  
  /**
   * Get a summary metric
   */
  getSummary(name: string, labels: Record<string, string> = {}): SummaryMetric | undefined {
    const key = this.getMetricKey(name, labels);
    return this.registry.summaries.get(key);
  }
  
  /**
   * Get all metrics
   */
  getAllMetrics(): Metric[] {
    const metrics: Metric[] = [];
    
    // Add counters
    for (const counter of this.registry.counters.values()) {
      metrics.push(counter);
    }
    
    // Add gauges
    for (const gauge of this.registry.gauges.values()) {
      metrics.push(gauge);
    }
    
    // Add histograms
    for (const histogram of this.registry.histograms.values()) {
      metrics.push(histogram);
    }
    
    // Add summaries
    for (const summary of this.registry.summaries.values()) {
      metrics.push(summary);
    }
    
    return metrics;
  }
  
  /**
   * Get metrics by name
   */
  getMetricsByName(name: string): Metric[] {
    const metrics: Metric[] = [];
    
    // Check counters
    for (const [key, counter] of this.registry.counters.entries()) {
      if (key.startsWith(name + ':')) {
        metrics.push(counter);
      }
    }
    
    // Check gauges
    for (const [key, gauge] of this.registry.gauges.entries()) {
      if (key.startsWith(name + ':')) {
        metrics.push(gauge);
      }
    }
    
    // Check histograms
    for (const [key, histogram] of this.registry.histograms.entries()) {
      if (key.startsWith(name + ':')) {
        metrics.push(histogram);
      }
    }
    
    // Check summaries
    for (const [key, summary] of this.registry.summaries.entries()) {
      if (key.startsWith(name + ':')) {
        metrics.push(summary);
      }
    }
    
    return metrics;
  }
  
  /**
   * Get metric history
   */
  getMetricHistory(
    name: string,
    labels: Record<string, string> = {},
    timeRange?: { start: Date; end: Date }
  ): Metric[] {
    const key = this.getMetricKey(name, labels);
    const history = this.metricHistory.get(key) || [];
    
    if (!timeRange) {
      return history;
    }
    
    return history.filter(metric => 
      metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end
    );
  }
  
  /**
   * Aggregate metrics
   */
  aggregateMetric(
    name: string,
    aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count',
    labels: Record<string, string> = {},
    timeRange?: { start: Date; end: Date }
  ): MetricAggregation {
    const history = this.getMetricHistory(name, labels, timeRange);
    
    if (history.length === 0) {
      return {
        name,
        type: MetricType.COUNTER, // Default type
        aggregation,
        labels,
        timeRange: timeRange || { start: new Date(), end: new Date() },
        result: 0
      };
    }
    
    // Get metric type from first entry
    const metricType = history[0].type;
    
    // Extract values
    const values = history.map(metric => {
      if (metricType === MetricType.HISTOGRAM) {
        return (metric as HistogramMetric).sum / (metric as HistogramMetric).count;
      } else if (metricType === MetricType.SUMMARY) {
        return (metric as SummaryMetric).sum / (metric as SummaryMetric).count;
      } else {
        return metric.value as number;
      }
    }).filter(value => typeof value === 'number') as number[];
    
    // Calculate aggregation
    let result = 0;
    
    switch (aggregation) {
      case 'sum':
        result = values.reduce((sum, value) => sum + value, 0);
        break;
      case 'avg':
        result = values.reduce((sum, value) => sum + value, 0) / values.length;
        break;
      case 'min':
        result = Math.min(...values);
        break;
      case 'max':
        result = Math.max(...values);
        break;
      case 'count':
        result = values.length;
        break;
    }
    
    return {
      name,
      type: metricType,
      aggregation,
      labels,
      timeRange: timeRange || { start: new Date(), end: new Date() },
      result
    };
  }
  
  /**
   * Export metrics in specified format
   */
  exportMetrics(format: MetricExportFormat = 'json'): string {
    const metrics = this.getAllMetrics();
    
    switch (format) {
      case 'prometheus':
        return this.exportPrometheus(metrics);
      case 'json':
        return this.exportJson(metrics);
      case 'influx':
        return this.exportInflux(metrics);
      case 'statsd':
        return this.exportStatsd(metrics);
      default:
        return this.exportJson(metrics);
    }
  }
  
  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.registry.counters.clear();
    this.registry.gauges.clear();
    this.registry.histograms.clear();
    this.registry.summaries.clear();
    this.metricHistory.clear();
    
    addBreadcrumb(
      'All custom metrics reset',
      'custom_metrics',
      'info'
    );
  }
  
  /**
   * Reset a specific metric
   */
  resetMetric(name: string): void {
    // Remove from all registries
    for (const [key, counter] of this.registry.counters.entries()) {
      if (key.startsWith(name + ':')) {
        this.registry.counters.delete(key);
      }
    }
    
    for (const [key, gauge] of this.registry.gauges.entries()) {
      if (key.startsWith(name + ':')) {
        this.registry.gauges.delete(key);
      }
    }
    
    for (const [key, histogram] of this.registry.histograms.entries()) {
      if (key.startsWith(name + ':')) {
        this.registry.histograms.delete(key);
      }
    }
    
    for (const [key, summary] of this.registry.summaries.entries()) {
      if (key.startsWith(name + ':')) {
        this.registry.summaries.delete(key);
      }
    }
    
    // Remove from history
    for (const [key, history] of this.metricHistory.entries()) {
      if (key.startsWith(name + ':')) {
        this.metricHistory.delete(key);
      }
    }
    
    addBreadcrumb(
      `Custom metric reset: ${name}`,
      'custom_metrics',
      'info',
      { metricName: name }
    );
  }
  
  /**
   * Get metric key from name and labels
   */
  private getMetricKey(name: string, labels: Record<string, string>): string {
    const labelPairs = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`);
    
    return labelPairs.length > 0 
      ? `${name}:{${labelPairs.join(',')}}`
      : name;
  }
  
  /**
   * Add metric to history
   */
  private addToHistory(name: string, metric: Metric): void {
    const key = this.getMetricKey(name, metric.labels);
    
    if (!this.metricHistory.has(key)) {
      this.metricHistory.set(key, []);
    }
    
    const history = this.metricHistory.get(key)!;
    history.push({ ...metric });
    
    // Limit history size
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }
  
  /**
   * Export metrics in Prometheus format
   */
  private exportPrometheus(metrics: Metric[]): string {
    const lines: string[] = [];
    
    // Group metrics by name
    const metricsByName = new Map<string, Metric[]>();
    
    for (const metric of metrics) {
      if (!metricsByName.has(metric.name)) {
        metricsByName.set(metric.name, []);
      }
      metricsByName.get(metric.name)!.push(metric);
    }
    
    // Export each metric group
    for (const [name, metricGroup] of metricsByName.entries()) {
      // Add help text if available
      if (metricGroup.length > 0 && metricGroup[0].help) {
        lines.push(`# HELP ${name} ${metricGroup[0].help}`);
      }
      
      // Add type text
      const metricType = metricGroup[0].type;
      lines.push(`# TYPE ${name} ${metricType}`);
      
      // Add metric values
      for (const metric of metricGroup) {
        const labelPairs = Object.entries(metric.labels)
          .map(([k, v]) => `${k}="${v}"`);
        
        const labelStr = labelPairs.length > 0 
          ? `{${labelPairs.join(',')}}`
          : '';
        
        if (metricType === MetricType.HISTOGRAM) {
          const histogram = metric as HistogramMetric;
          
          // Add bucket metrics
          for (const bucket of histogram.buckets) {
            const bucketLabels = {
              ...metric.labels,
              le: bucket.le.toString()
            };
            
            const bucketLabelPairs = Object.entries(bucketLabels)
              .map(([k, v]) => `${k}="${v}"`);
            
            const bucketLabelStr = `{${bucketLabelPairs.join(',')}}`;
            lines.push(`${name}_bucket${bucketLabelStr} ${bucket.count}`);
          }
          
          // Add count and sum
          const countLabels = Object.entries(metric.labels)
            .map(([k, v]) => `${k}="${v}"`);
          
          const countLabelStr = countLabels.length > 0 
            ? `{${countLabels.join(',')}}`
            : '';
            
          lines.push(`${name}_count${countLabelStr} ${histogram.count}`);
          lines.push(`${name}_sum${countLabelStr} ${histogram.sum}`);
        } else if (metricType === MetricType.SUMMARY) {
          const summary = metric as SummaryMetric;
          
          // Add quantile metrics
          for (const quantile of summary.quantiles) {
            const quantileLabels = {
              ...metric.labels,
              quantile: quantile.quantile.toString()
            };
            
            const quantileLabelPairs = Object.entries(quantileLabels)
              .map(([k, v]) => `${k}="${v}"`);
            
            const quantileLabelStr = `{${quantileLabelPairs.join(',')}}`;
            lines.push(`${name}${quantileLabelStr} ${quantile.value}`);
          }
          
          // Add count and sum
          const countLabels = Object.entries(metric.labels)
            .map(([k, v]) => `${k}="${v}"`);
          
          const countLabelStr = countLabels.length > 0 
            ? `{${countLabels.join(',')}}`
            : '';
            
          lines.push(`${name}_count${countLabelStr} ${summary.count}`);
          lines.push(`${name}_sum${countLabelStr} ${summary.sum}`);
        } else {
          lines.push(`${name}${labelStr} ${metric.value}`);
        }
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * Export metrics in JSON format
   */
  private exportJson(metrics: Metric[]): string {
    return JSON.stringify(metrics, null, 2);
  }
  
  /**
   * Export metrics in InfluxDB format
   */
  private exportInflux(metrics: Metric[]): string {
    const lines: string[] = [];
    
    for (const metric of metrics) {
      // Escape measurement name
      const measurement = metric.name.replace(/ /g, '\\ ').replace(/,/g, '\\,');
      
      // Format tags
      const tags = Object.entries(metric.labels)
        .map(([k, v]) => `${k.replace(/ /g, '\\ ').replace(/,/g, '\\,')}=${v.replace(/ /g, '\\ ').replace(/,/g, '\\,')}`)
        .join(',');
      
      // Format fields
      let fields = '';
      
      if (metric.type === MetricType.HISTOGRAM) {
        const histogram = metric as HistogramMetric;
        fields = `count=${histogram.count},sum=${histogram.sum}`;
      } else if (metric.type === MetricType.SUMMARY) {
        const summary = metric as SummaryMetric;
        fields = `count=${summary.count},sum=${summary.sum}`;
        
        // Add quantiles
        for (const quantile of summary.quantiles) {
          fields += `,quantile_${quantile.quantile}=${quantile.value}`;
        }
      } else {
        fields = `value=${metric.value}`;
      }
      
      // Create line
      const line = `${measurement}${tags ? ',' + tags : ''} ${fields} ${metric.timestamp.getTime() * 1000000}`; // Nanosecond precision
      lines.push(line);
    }
    
    return lines.join('\n');
  }
  
  /**
   * Export metrics in StatsD format
   */
  private exportStatsd(metrics: Metric[]): string {
    const lines: string[] = [];
    
    for (const metric of metrics) {
      // Format tags
      const tags = Object.entries(metric.labels)
        .map(([k, v]) => `${k}:${v}`)
        .join(',');
      
      // Create metric key
      const key = tags ? `${metric.name}#${tags}` : metric.name;
      
      // Format value based on type
      let value = '';
      let suffix = '';
      
      if (metric.type === MetricType.COUNTER) {
        value = metric.value.toString();
        suffix = '|c'; // Counter
      } else if (metric.type === MetricType.GAUGE) {
        value = metric.value.toString();
        suffix = '|g'; // Gauge
      } else if (metric.type === MetricType.HISTOGRAM) {
        const histogram = metric as HistogramMetric;
        value = histogram.sum.toString();
        suffix = '|ms'; // Histogram (timing)
      } else if (metric.type === MetricType.SUMMARY) {
        const summary = metric as SummaryMetric;
        value = summary.sum.toString();
        suffix = '|ms'; // Summary (timing)
      }
      
      // Create line
      const line = `${key}:${value}${suffix}`;
      lines.push(line);
    }
    
    return lines.join('\n');
  }
}

// Export singleton instance
export const customMetrics = CustomMetricsCollector.getInstance();

// Initialize custom metrics collection
if (typeof window !== 'undefined') {
  // Start collection after page load
  if (document.readyState === 'complete') {
    customMetrics.startCollection();
  } else {
    window.addEventListener('load', () => {
      customMetrics.startCollection();
    });
  }
}

// Convenience functions for common metrics
export const metrics = {
  // Counter metrics
  incrementCounter: (name: string, value?: number, labels?: Record<string, string>) => {
    customMetrics.incrementCounter(name, value, labels);
  },
  
  // Gauge metrics
  setGauge: (name: string, value: number, labels?: Record<string, string>) => {
    customMetrics.setGauge(name, value, labels);
  },
  
  // Histogram metrics
  recordHistogram: (name: string, value: number, labels?: Record<string, string>) => {
    customMetrics.recordHistogram(name, value, labels);
  },
  
  // Summary metrics
  recordSummary: (name: string, value: number, labels?: Record<string, string>) => {
    customMetrics.recordSummary(name, value, labels);
  },
  
  // Get metrics
  getMetric: (name: string, labels?: Record<string, string>) => {
    // Try to get as counter first
    let metric = customMetrics.getCounter(name, labels);
    if (metric) return metric;
    
    // Try to get as gauge
    const gaugeMetric = customMetrics.getGauge(name, labels);
    if (gaugeMetric) return gaugeMetric;
    
    // Try to get as histogram
    const histogramMetric = customMetrics.getHistogram(name, labels);
    if (histogramMetric) return histogramMetric;
    
    // Try to get as summary
    const summaryMetric = customMetrics.getSummary(name, labels);
    return summaryMetric;
  },
  
  // Export metrics
  export: (format?: MetricExportFormat) => {
    return customMetrics.exportMetrics(format);
  }
};