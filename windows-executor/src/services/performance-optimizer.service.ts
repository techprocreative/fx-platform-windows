/**
 * Performance Optimizer Service
 * Optimizes system performance through:
 * - Parallel processing
 * - Resource management
 * - Memory optimization
 * - CPU optimization
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { Strategy } from '../types/strategy.types';

export interface PerformanceMetrics {
  cpu: {
    usage: number;
    average: number;
    peak: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
  };
  latency: {
    average: number;
    p95: number;
    p99: number;
  };
  throughput: {
    strategiesPerSecond: number;
    signalsPerMinute: number;
    tradesPerHour: number;
  };
}

export class PerformanceOptimizer extends EventEmitter {
  private latencyHistory: number[] = [];
  private maxLatencyHistory = 1000;

  constructor() {
    super();
    logger.info('[PerformanceOptimizer] Service initialized');
  }

  /**
   * Evaluate multiple strategies in parallel
   */
  async evaluateStrategiesParallel(
    strategies: Strategy[],
    evaluator: (strategy: Strategy) => Promise<any>
  ): Promise<any[]> {
    const startTime = Date.now();

    logger.debug(`[PerformanceOptimizer] Evaluating ${strategies.length} strategies in parallel`);

    try {
      // Process in parallel with error handling
      const evaluationPromises = strategies.map(strategy =>
        evaluator(strategy)
          .catch(error => {
            logger.error(`[PerformanceOptimizer] Strategy ${strategy.id} evaluation failed:`, error);
            return null;
          })
      );

      const results = await Promise.all(evaluationPromises);

      const duration = Date.now() - startTime;
      this.recordLatency(duration);

      logger.info(`[PerformanceOptimizer] Evaluated ${strategies.length} strategies in ${duration}ms`);

      return results.filter(r => r !== null);

    } catch (error) {
      logger.error('[PerformanceOptimizer] Parallel evaluation failed:', error);
      throw error;
    }
  }

  /**
   * Check multiple exit conditions in parallel
   */
  async checkExitsParallel(
    positions: any[],
    checker: (position: any) => Promise<void>
  ): Promise<void> {
    logger.debug(`[PerformanceOptimizer] Checking exits for ${positions.length} positions in parallel`);

    const exitChecks = positions.map(position =>
      checker(position)
        .catch(error => {
          logger.error(`[PerformanceOptimizer] Exit check for position ${position.ticket} failed:`, error);
        })
    );

    await Promise.all(exitChecks);
  }

  /**
   * Batch process operations
   */
  async batchProcess<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number = 10
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(item => processor(item).catch(error => {
          logger.error('[PerformanceOptimizer] Batch processing error:', error);
          return null as any;
        }))
      );
      results.push(...batchResults.filter(r => r !== null));
    }

    return results;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      cpu: {
        usage: cpuUsage.user / 1000000, // Convert to seconds
        average: 0, // TODO: Track average
        peak: 0, // TODO: Track peak
      },
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        heapUsed: memUsage.heapUsed / 1024 / 1024, // MB
        heapTotal: memUsage.heapTotal / 1024 / 1024, // MB
      },
      latency: {
        average: this.calculateAverageLatency(),
        p95: this.calculatePercentile(95),
        p99: this.calculatePercentile(99),
      },
      throughput: {
        strategiesPerSecond: 0, // TODO: Calculate
        signalsPerMinute: 0, // TODO: Calculate
        tradesPerHour: 0, // TODO: Calculate
      },
    };
  }

  /**
   * Check if system is healthy
   */
  isHealthy(): { healthy: boolean; issues: string[] } {
    const metrics = this.getMetrics();
    const issues: string[] = [];

    // Check memory usage
    if (metrics.memory.percentage > 80) {
      issues.push(`High memory usage: ${metrics.memory.percentage.toFixed(1)}%`);
    }

    // Check latency
    if (metrics.latency.average > 1000) {
      issues.push(`High average latency: ${metrics.latency.average.toFixed(0)}ms`);
    }

    if (metrics.latency.p99 > 5000) {
      issues.push(`Very high P99 latency: ${metrics.latency.p99.toFixed(0)}ms`);
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  /**
   * Optimize memory usage
   */
  async optimizeMemory(): Promise<void> {
    logger.info('[PerformanceOptimizer] Optimizing memory usage...');

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      logger.info('[PerformanceOptimizer] Garbage collection triggered');
    }

    // Clear old latency history
    if (this.latencyHistory.length > this.maxLatencyHistory) {
      this.latencyHistory = this.latencyHistory.slice(-this.maxLatencyHistory / 2);
    }

    const memAfter = process.memoryUsage();
    logger.info(`[PerformanceOptimizer] Memory optimized: ${(memAfter.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  }

  /**
   * Record operation latency
   */
  recordLatency(latencyMs: number): void {
    this.latencyHistory.push(latencyMs);

    // Keep history size limited
    if (this.latencyHistory.length > this.maxLatencyHistory) {
      this.latencyHistory.shift();
    }
  }

  /**
   * Calculate average latency
   */
  private calculateAverageLatency(): number {
    if (this.latencyHistory.length === 0) return 0;

    const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
    return sum / this.latencyHistory.length;
  }

  /**
   * Calculate latency percentile
   */
  private calculatePercentile(percentile: number): number {
    if (this.latencyHistory.length === 0) return 0;

    const sorted = [...this.latencyHistory].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;

    return sorted[index];
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(intervalMs: number = 60000): void {
    setInterval(() => {
      const metrics = this.getMetrics();
      const health = this.isHealthy();

      logger.info('[PerformanceOptimizer] Performance metrics:', {
        memory: `${metrics.memory.heapUsed.toFixed(2)}MB`,
        latency: `${metrics.latency.average.toFixed(0)}ms`,
        healthy: health.healthy,
      });

      if (!health.healthy) {
        logger.warn('[PerformanceOptimizer] Performance issues detected:', health.issues);
        this.emit('performance-degraded', { metrics, issues: health.issues });
      }

      // Auto-optimize if memory high
      if (metrics.memory.percentage > 80) {
        this.optimizeMemory();
      }

    }, intervalMs);

    logger.info('[PerformanceOptimizer] Performance monitoring started');
  }
}

/**
 * Parallel Processor
 * Utility for parallel task execution with concurrency control
 */
export class ParallelProcessor {
  constructor(private maxConcurrency: number = 10) {}

  /**
   * Process items in parallel with concurrency limit
   */
  async process<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = [];
    const executing: Promise<void>[] = [];

    for (const item of items) {
      const promise = processor(item)
        .then(result => {
          results.push(result);
        })
        .catch(error => {
          logger.error('[ParallelProcessor] Processing error:', error);
        });

      executing.push(promise);

      if (executing.length >= this.maxConcurrency) {
        await Promise.race(executing);
        executing.splice(executing.findIndex(p => p === promise), 1);
      }
    }

    await Promise.all(executing);

    return results;
  }

  /**
   * Process with timeout
   */
  async processWithTimeout<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    timeoutMs: number
  ): Promise<R[]> {
    const results = await Promise.race([
      this.process(items, processor),
      new Promise<R[]>((_, reject) =>
        setTimeout(() => reject(new Error('Processing timeout')), timeoutMs)
      ),
    ]);

    return results;
  }
}
