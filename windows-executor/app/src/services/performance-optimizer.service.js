"use strict";
/**
 * Performance Optimizer Service
 * Optimizes system performance through:
 * - Parallel processing
 * - Resource management
 * - Memory optimization
 * - CPU optimization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParallelProcessor = exports.PerformanceOptimizer = void 0;
const events_1 = require("events");
const logger_1 = require("../utils/logger");
class PerformanceOptimizer extends events_1.EventEmitter {
    constructor() {
        super();
        this.latencyHistory = [];
        this.maxLatencyHistory = 1000;
        logger_1.logger.info('[PerformanceOptimizer] Service initialized');
    }
    /**
     * Evaluate multiple strategies in parallel
     */
    async evaluateStrategiesParallel(strategies, evaluator) {
        const startTime = Date.now();
        logger_1.logger.debug(`[PerformanceOptimizer] Evaluating ${strategies.length} strategies in parallel`);
        try {
            // Process in parallel with error handling
            const evaluationPromises = strategies.map(strategy => evaluator(strategy)
                .catch(error => {
                logger_1.logger.error(`[PerformanceOptimizer] Strategy ${strategy.id} evaluation failed:`, error);
                return null;
            }));
            const results = await Promise.all(evaluationPromises);
            const duration = Date.now() - startTime;
            this.recordLatency(duration);
            logger_1.logger.info(`[PerformanceOptimizer] Evaluated ${strategies.length} strategies in ${duration}ms`);
            return results.filter(r => r !== null);
        }
        catch (error) {
            logger_1.logger.error('[PerformanceOptimizer] Parallel evaluation failed:', error);
            throw error;
        }
    }
    /**
     * Check multiple exit conditions in parallel
     */
    async checkExitsParallel(positions, checker) {
        logger_1.logger.debug(`[PerformanceOptimizer] Checking exits for ${positions.length} positions in parallel`);
        const exitChecks = positions.map(position => checker(position)
            .catch(error => {
            logger_1.logger.error(`[PerformanceOptimizer] Exit check for position ${position.ticket} failed:`, error);
        }));
        await Promise.all(exitChecks);
    }
    /**
     * Batch process operations
     */
    async batchProcess(items, processor, batchSize = 10) {
        const results = [];
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(item => processor(item).catch(error => {
                logger_1.logger.error('[PerformanceOptimizer] Batch processing error:', error);
                return null;
            })));
            results.push(...batchResults.filter(r => r !== null));
        }
        return results;
    }
    /**
     * Get current performance metrics
     */
    getMetrics() {
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
    isHealthy() {
        const metrics = this.getMetrics();
        const issues = [];
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
    async optimizeMemory() {
        logger_1.logger.info('[PerformanceOptimizer] Optimizing memory usage...');
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
            logger_1.logger.info('[PerformanceOptimizer] Garbage collection triggered');
        }
        // Clear old latency history
        if (this.latencyHistory.length > this.maxLatencyHistory) {
            this.latencyHistory = this.latencyHistory.slice(-this.maxLatencyHistory / 2);
        }
        const memAfter = process.memoryUsage();
        logger_1.logger.info(`[PerformanceOptimizer] Memory optimized: ${(memAfter.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    }
    /**
     * Record operation latency
     */
    recordLatency(latencyMs) {
        this.latencyHistory.push(latencyMs);
        // Keep history size limited
        if (this.latencyHistory.length > this.maxLatencyHistory) {
            this.latencyHistory.shift();
        }
    }
    /**
     * Calculate average latency
     */
    calculateAverageLatency() {
        if (this.latencyHistory.length === 0)
            return 0;
        const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
        return sum / this.latencyHistory.length;
    }
    /**
     * Calculate latency percentile
     */
    calculatePercentile(percentile) {
        if (this.latencyHistory.length === 0)
            return 0;
        const sorted = [...this.latencyHistory].sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[index];
    }
    /**
     * Start performance monitoring
     */
    startMonitoring(intervalMs = 60000) {
        setInterval(() => {
            const metrics = this.getMetrics();
            const health = this.isHealthy();
            logger_1.logger.info('[PerformanceOptimizer] Performance metrics:', {
                memory: `${metrics.memory.heapUsed.toFixed(2)}MB`,
                latency: `${metrics.latency.average.toFixed(0)}ms`,
                healthy: health.healthy,
            });
            if (!health.healthy) {
                logger_1.logger.warn('[PerformanceOptimizer] Performance issues detected:', health.issues);
                this.emit('performance-degraded', { metrics, issues: health.issues });
            }
            // Auto-optimize if memory high
            if (metrics.memory.percentage > 80) {
                this.optimizeMemory();
            }
        }, intervalMs);
        logger_1.logger.info('[PerformanceOptimizer] Performance monitoring started');
    }
}
exports.PerformanceOptimizer = PerformanceOptimizer;
/**
 * Parallel Processor
 * Utility for parallel task execution with concurrency control
 */
class ParallelProcessor {
    constructor(maxConcurrency = 10) {
        this.maxConcurrency = maxConcurrency;
    }
    /**
     * Process items in parallel with concurrency limit
     */
    async process(items, processor) {
        const results = [];
        const executing = [];
        for (const item of items) {
            const promise = processor(item)
                .then(result => {
                results.push(result);
            })
                .catch(error => {
                logger_1.logger.error('[ParallelProcessor] Processing error:', error);
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
    async processWithTimeout(items, processor, timeoutMs) {
        const results = await Promise.race([
            this.process(items, processor),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Processing timeout')), timeoutMs)),
        ]);
        return results;
    }
}
exports.ParallelProcessor = ParallelProcessor;
