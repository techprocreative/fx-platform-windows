/**
 * Comprehensive Performance Monitoring System
 * 
 * This module provides advanced performance monitoring capabilities including:
 * - API response time tracking
 * - Database query performance monitoring
 * - Frontend performance metrics
 * - Real User Monitoring (RUM)
 * - Core Web Vitals tracking
 * - Performance budget monitoring
 */

import { CONFIG } from '../config';
import { captureEnhancedError, addBreadcrumb, ErrorCategory } from './sentry';

// Performance metrics interface
export interface PerformanceMetrics {
  // API performance
  apiResponseTime: number;
  apiEndpoint: string;
  apiMethod: string;
  apiStatus: number;
  
  // Database performance
  dbQueryTime: number;
  dbQueryType: string;
  dbTable?: string;
  
  // Frontend performance
  pageLoadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  firstInputDelay: number;
  cumulativeLayoutShift: number;
  
  // Memory performance
  memoryUsage: number;
  memoryLimit: number;
  
  // Network performance
  networkLatency: number;
  downloadTime: number;
  uploadTime: number;
  
  // Timestamps
  timestamp: Date;
  sessionId?: string;
  userId?: string;
  route?: string;
}

// Core Web Vitals interface
export interface CoreWebVitals {
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  fcp: number; // First Contentful Paint
  ttfb: number; // Time to First Byte
  timestamp: Date;
}

// Performance budget interface
export interface PerformanceBudget {
  pageLoadTime: number; // ms
  apiResponseTime: number; // ms
  dbQueryTime: number; // ms
  memoryUsage: number; // MB
  bundleSize: number; // KB
}

// Performance alert interface
export interface PerformanceAlert {
  id: string;
  type: 'slow_api' | 'slow_db' | 'slow_page' | 'memory_leak' | 'budget_exceeded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
  context?: Record<string, any>;
}

// Default performance budgets
const DEFAULT_PERFORMANCE_BUDGET: PerformanceBudget = {
  pageLoadTime: 3000, // 3 seconds
  apiResponseTime: 1000, // 1 second
  dbQueryTime: 500, // 500ms
  memoryUsage: 512, // 512MB
  bundleSize: 1024 // 1MB
};

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private coreWebVitals: CoreWebVitals[] = [];
  private alerts: PerformanceAlert[] = [];
  private budget: PerformanceBudget;
  private maxMetricsSize: number = 10000;
  private isMonitoring: boolean = false;
  private observers: PerformanceObserver[] = [];
  
  private constructor() {
    this.budget = { ...DEFAULT_PERFORMANCE_BUDGET };
    this.initializeObservers();
  }
  
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }
  
  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.setupPerformanceObservers();
    this.startMemoryMonitoring();
    this.startNetworkMonitoring();
    
    addBreadcrumb(
      'Performance monitoring started',
      'performance',
      'info'
    );
  }
  
  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    this.disconnectObservers();
    
    addBreadcrumb(
      'Performance monitoring stopped',
      'performance',
      'info'
    );
  }
  
  /**
   * Record API performance metrics
   */
  recordApiPerformance(
    endpoint: string,
    method: string,
    responseTime: number,
    status: number,
    context?: { userId?: string; sessionId?: string; route?: string }
  ): void {
    const metric: PerformanceMetrics = {
      apiResponseTime: responseTime,
      apiEndpoint: endpoint,
      apiMethod: method,
      apiStatus: status,
      dbQueryTime: 0,
      dbQueryType: '',
      pageLoadTime: 0,
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
      firstInputDelay: 0,
      cumulativeLayoutShift: 0,
      memoryUsage: 0,
      memoryLimit: 0,
      networkLatency: 0,
      downloadTime: 0,
      uploadTime: 0,
      timestamp: new Date(),
      ...context
    };
    
    this.addMetric(metric);
    this.checkApiPerformanceThresholds(metric);
  }
  
  /**
   * Record database query performance
   */
  recordDatabasePerformance(
    queryType: string,
    queryTime: number,
    table?: string,
    context?: { userId?: string; sessionId?: string }
  ): void {
    const metric: PerformanceMetrics = {
      apiResponseTime: 0,
      apiEndpoint: '',
      apiMethod: '',
      apiStatus: 0,
      dbQueryTime: queryTime,
      dbQueryType: queryType,
      dbTable: table,
      pageLoadTime: 0,
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
      firstInputDelay: 0,
      cumulativeLayoutShift: 0,
      memoryUsage: 0,
      memoryLimit: 0,
      networkLatency: 0,
      downloadTime: 0,
      uploadTime: 0,
      timestamp: new Date(),
      ...context
    };
    
    this.addMetric(metric);
    this.checkDatabasePerformanceThresholds(metric);
  }
  
  /**
   * Record page load performance
   */
  recordPageLoadPerformance(
    route: string,
    loadTime: number,
    context?: { userId?: string; sessionId?: string }
  ): void {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    const metric: PerformanceMetrics = {
      apiResponseTime: 0,
      apiEndpoint: '',
      apiMethod: '',
      apiStatus: 0,
      dbQueryTime: 0,
      dbQueryType: '',
      pageLoadTime: loadTime,
      firstContentfulPaint: navigation ? navigation.responseStart - navigation.requestStart : 0,
      largestContentfulPaint: 0,
      firstInputDelay: 0,
      cumulativeLayoutShift: 0,
      memoryUsage: 0,
      memoryLimit: 0,
      networkLatency: navigation ? navigation.responseStart - navigation.requestStart : 0,
      downloadTime: navigation ? navigation.responseEnd - navigation.responseStart : 0,
      uploadTime: 0,
      timestamp: new Date(),
      route,
      ...context
    };
    
    this.addMetric(metric);
    this.checkPageLoadThresholds(metric);
  }
  
  /**
   * Get performance statistics
   */
  getPerformanceStatistics(
    metricType: keyof PerformanceMetrics,
    periodStart?: Date,
    periodEnd?: Date
  ): {
    min: number;
    max: number;
    mean: number;
    median: number;
    p95: number;
    p99: number;
    count: number;
  } {
    let filteredMetrics = this.metrics;
    
    if (periodStart || periodEnd) {
      filteredMetrics = this.metrics.filter(metric => {
        const timestamp = metric.timestamp;
        if (periodStart && timestamp < periodStart) return false;
        if (periodEnd && timestamp > periodEnd) return false;
        return true;
      });
    }
    
    const values = filteredMetrics
      .map(m => m[metricType] as number)
      .filter(v => v > 0)
      .sort((a, b) => a - b);
    
    if (values.length === 0) {
      return { min: 0, max: 0, mean: 0, median: 0, p95: 0, p99: 0, count: 0 };
    }
    
    const count = values.length;
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / count;
    const median = count % 2 === 0
      ? (values[count / 2 - 1] + values[count / 2]) / 2
      : values[Math.floor(count / 2)];
    
    const p95 = this.getPercentile(values, 95);
    const p99 = this.getPercentile(values, 99);
    
    return {
      min: values[0],
      max: values[count - 1],
      mean,
      median,
      p95,
      p99,
      count
    };
  }
  
  /**
   * Get Core Web Vitals
   */
  getCoreWebVitals(): CoreWebVitals[] {
    return [...this.coreWebVitals];
  }
  
  /**
   * Get performance alerts
   */
  getPerformanceAlerts(severity?: 'low' | 'medium' | 'high' | 'critical'): PerformanceAlert[] {
    let filteredAlerts = this.alerts;
    
    if (severity) {
      filteredAlerts = filteredAlerts.filter(alert => alert.severity === severity);
    }
    
    return filteredAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  
  /**
   * Update performance budget
   */
  updatePerformanceBudget(newBudget: Partial<PerformanceBudget>): void {
    this.budget = { ...this.budget, ...newBudget };
  }
  
  /**
   * Get current performance budget
   */
  getPerformanceBudget(): PerformanceBudget {
    return { ...this.budget };
  }
  
  /**
   * Check performance budget compliance
   */
  checkBudgetCompliance(): {
    compliant: boolean;
    violations: Array<{ metric: string; current: number; budget: number; percentage: number }>;
  } {
    const violations: Array<{ metric: string; current: number; budget: number; percentage: number }> = [];
    
    // Check API response time
    const apiStats = this.getPerformanceStatistics('apiResponseTime');
    if (apiStats.p95 > this.budget.apiResponseTime) {
      violations.push({
        metric: 'API Response Time (p95)',
        current: apiStats.p95,
        budget: this.budget.apiResponseTime,
        percentage: (apiStats.p95 / this.budget.apiResponseTime) * 100
      });
    }
    
    // Check database query time
    const dbStats = this.getPerformanceStatistics('dbQueryTime');
    if (dbStats.p95 > this.budget.dbQueryTime) {
      violations.push({
        metric: 'Database Query Time (p95)',
        current: dbStats.p95,
        budget: this.budget.dbQueryTime,
        percentage: (dbStats.p95 / this.budget.dbQueryTime) * 100
      });
    }
    
    // Check page load time
    const pageStats = this.getPerformanceStatistics('pageLoadTime');
    if (pageStats.p95 > this.budget.pageLoadTime) {
      violations.push({
        metric: 'Page Load Time (p95)',
        current: pageStats.p95,
        budget: this.budget.pageLoadTime,
        percentage: (pageStats.p95 / this.budget.pageLoadTime) * 100
      });
    }
    
    return {
      compliant: violations.length === 0,
      violations
    };
  }
  
  /**
   * Initialize performance observers
   */
  private initializeObservers(): void {
    if (typeof window === 'undefined') return;
    
    // Largest Contentful Paint
    if ('PerformanceObserver' in window) {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        
        this.recordCoreWebVital('lcp', lastEntry.startTime);
      });
      
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);
    }
    
    // First Input Delay
    if ('PerformanceObserver' in window) {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.recordCoreWebVital('fid', entry.processingStart - entry.startTime);
        });
      });
      
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);
    }
    
    // Cumulative Layout Shift
    if ('PerformanceObserver' in window) {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            this.recordCoreWebVital('cls', clsValue);
          }
        });
      });
      
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);
    }
  }
  
  /**
   * Setup performance observers
   */
  private setupPerformanceObservers(): void {
    // Observe resource timing
    if ('PerformanceObserver' in window) {
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const resourceEntry = entry as PerformanceResourceTiming;
          if (resourceEntry.initiatorType === 'fetch' || resourceEntry.initiatorType === 'xmlhttprequest') {
            this.recordApiPerformance(
              resourceEntry.name,
              'GET', // Default method, might not be accurate
              resourceEntry.responseEnd - resourceEntry.requestStart,
              200, // Default status, might not be accurate
              {
                route: window.location.pathname
              }
            );
          }
        });
      });
      
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);
    }
  }
  
  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    if (typeof window === 'undefined' || !(performance as any).memory) return;
    
    const monitorMemory = () => {
      if (!this.isMonitoring) return;
      
      const memory = (performance as any).memory;
      const usage = memory.usedJSHeapSize / 1024 / 1024; // MB
      
      this.checkMemoryThresholds(usage, memory.jsHeapSizeLimit / 1024 / 1024);
      
      setTimeout(monitorMemory, 30000); // Check every 30 seconds
    };
    
    monitorMemory();
  }
  
  /**
   * Start network monitoring
   */
  private startNetworkMonitoring(): void {
    if (typeof window === 'undefined') return;
    
    // Monitor network connection
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      const monitorNetwork = () => {
        if (!this.isMonitoring) return;
        
        // Record network quality metrics
        addBreadcrumb(
          `Network quality: ${connection.effectiveType}, downlink: ${connection.downlink}Mbps`,
          'network',
          'info',
          {
            effectiveType: connection.effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt
          }
        );
        
        setTimeout(monitorNetwork, 60000); // Check every minute
      };
      
      monitorNetwork();
    }
  }
  
  /**
   * Record Core Web Vital
   */
  private recordCoreWebVital(vital: keyof CoreWebVitals, value: number): void {
    const existingVital = this.coreWebVitals[this.coreWebVitals.length - 1];
    
    if (existingVital && existingVital.timestamp.getTime() > Date.now() - 5000) {
      // Update existing vital if it's recent
      (existingVital as any)[vital] = value;
    } else {
      // Create new vital entry
      const newVital: CoreWebVitals = {
        lcp: 0,
        fid: 0,
        cls: 0,
        fcp: 0,
        ttfb: 0,
        timestamp: new Date(),
        [vital]: value
      };
      
      this.coreWebVitals.push(newVital);
    }
    
    // Keep only recent vitals
    if (this.coreWebVitals.length > 100) {
      this.coreWebVitals.shift();
    }
  }
  
  /**
   * Add metric to collection
   */
  private addMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
    
    // Limit metrics size
    if (this.metrics.length > this.maxMetricsSize) {
      this.metrics.shift();
    }
  }
  
  /**
   * Check API performance thresholds
   */
  private checkApiPerformanceThresholds(metric: PerformanceMetrics): void {
    if (metric.apiResponseTime > this.budget.apiResponseTime) {
      this.createAlert(
        'slow_api',
        this.getAlertSeverity(metric.apiResponseTime, this.budget.apiResponseTime),
        'apiResponseTime',
        metric.apiResponseTime,
        this.budget.apiResponseTime,
        {
          endpoint: metric.apiEndpoint,
          method: metric.apiMethod,
          status: metric.apiStatus
        }
      );
    }
  }
  
  /**
   * Check database performance thresholds
   */
  private checkDatabasePerformanceThresholds(metric: PerformanceMetrics): void {
    if (metric.dbQueryTime > this.budget.dbQueryTime) {
      this.createAlert(
        'slow_db',
        this.getAlertSeverity(metric.dbQueryTime, this.budget.dbQueryTime),
        'dbQueryTime',
        metric.dbQueryTime,
        this.budget.dbQueryTime,
        {
          queryType: metric.dbQueryType,
          table: metric.dbTable
        }
      );
    }
  }
  
  /**
   * Check page load thresholds
   */
  private checkPageLoadThresholds(metric: PerformanceMetrics): void {
    if (metric.pageLoadTime > this.budget.pageLoadTime) {
      this.createAlert(
        'slow_page',
        this.getAlertSeverity(metric.pageLoadTime, this.budget.pageLoadTime),
        'pageLoadTime',
        metric.pageLoadTime,
        this.budget.pageLoadTime,
        {
          route: metric.route
        }
      );
    }
  }
  
  /**
   * Check memory thresholds
   */
  private checkMemoryThresholds(usage: number, limit: number): void {
    if (usage > this.budget.memoryUsage) {
      this.createAlert(
        'memory_leak',
        this.getAlertSeverity(usage, this.budget.memoryUsage),
        'memoryUsage',
        usage,
        this.budget.memoryUsage,
        {
          usage,
          limit
        }
      );
    }
  }
  
  /**
   * Create performance alert
   */
  private createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    metric: string,
    value: number,
    threshold: number,
    context?: Record<string, any>
  ): void {
    const alert: PerformanceAlert = {
      id: `perf_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      metric,
      value,
      threshold,
      timestamp: new Date(),
      context
    };
    
    this.alerts.push(alert);
    
    // Limit alerts size
    if (this.alerts.length > 1000) {
      this.alerts.shift();
    }
    
    // Send to Sentry
    captureEnhancedError(
      new Error(`Performance alert: ${metric} exceeded threshold`),
      {
        component: 'PerformanceMonitor',
        action: 'threshold_exceeded',
        additionalData: {
          alertType: type,
          severity,
          metric,
          value,
          threshold,
          percentage: (value / threshold) * 100,
          ...context
        }
      }
    );
  }
  
  /**
   * Get alert severity based on threshold exceedance
   */
  private getAlertSeverity(value: number, threshold: number): PerformanceAlert['severity'] {
    const percentage = (value / threshold) * 100;
    
    if (percentage > 200) return 'critical';
    if (percentage > 150) return 'high';
    if (percentage > 120) return 'medium';
    return 'low';
  }
  
  /**
   * Calculate percentile from sorted array
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
   * Disconnect all observers
   */
  private disconnectObservers(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Performance tracking utility functions
export function trackApiCall<T>(
  endpoint: string,
  method: string,
  apiCall: () => Promise<T>,
  context?: { userId?: string; sessionId?: string; route?: string }
): Promise<T> {
  const startTime = Date.now();
  
  return apiCall()
    .then(result => {
      const responseTime = Date.now() - startTime;
      performanceMonitor.recordApiPerformance(endpoint, method, responseTime, 200, context);
      return result;
    })
    .catch(error => {
      const responseTime = Date.now() - startTime;
      performanceMonitor.recordApiPerformance(endpoint, method, responseTime, 500, context);
      
      captureEnhancedError(
        error instanceof Error ? error : new Error('API call failed'),
        {
          component: 'APITracker',
          action: 'api_call_failed',
          route: context?.route,
          additionalData: {
            endpoint,
            method,
            responseTime
          }
        }
      );
      
      throw error;
    });
}

export function trackDatabaseQuery<T>(
  queryType: string,
  query: () => Promise<T>,
  table?: string,
  context?: { userId?: string; sessionId?: string }
): Promise<T> {
  const startTime = Date.now();
  
  return query()
    .then(result => {
      const queryTime = Date.now() - startTime;
      performanceMonitor.recordDatabasePerformance(queryType, queryTime, table, context);
      return result;
    })
    .catch(error => {
      const queryTime = Date.now() - startTime;
      performanceMonitor.recordDatabasePerformance(queryType, queryTime, table, context);
      
      captureEnhancedError(
        error instanceof Error ? error : new Error('Database query failed'),
        {
          component: 'DatabaseTracker',
          action: 'query_failed',
          additionalData: {
            queryType,
            table,
            queryTime
          }
        }
      );
      
      throw error;
    });
}

// Initialize performance monitoring
if (typeof window !== 'undefined') {
  // Start monitoring after page load
  if (document.readyState === 'complete') {
    performanceMonitor.startMonitoring();
  } else {
    window.addEventListener('load', () => {
      performanceMonitor.startMonitoring();
    });
  }
}