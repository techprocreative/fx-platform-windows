/**
 * Performance Monitoring Service
 * Tracks and reports system performance metrics
 */
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';
export class PerformanceMonitorService extends EventEmitter {
    constructor() {
        super();
        Object.defineProperty(this, "metrics", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "thresholds", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {
                slowEvaluationMs: 1000,
                highMemoryMB: 500,
                highErrorRate: 0.05,
                lowCacheHitRate: 0.5
            }
        });
        Object.defineProperty(this, "alertHistory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "maxAlertHistory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 100
        });
        this.metrics = {
            evaluationTimes: [],
            indicatorTimes: [],
            evaluationCount: 0,
            indicatorCount: 0,
            signalCount: 0,
            errorCount: 0,
            startTime: new Date()
        };
        // Start periodic monitoring
        this.startPeriodicMonitoring();
    }
    /**
     * Record strategy evaluation time
     */
    recordEvaluationTime(timeMs) {
        this.metrics.evaluationTimes.push(timeMs);
        this.metrics.evaluationCount++;
        // Keep only last 100 measurements
        if (this.metrics.evaluationTimes.length > 100) {
            this.metrics.evaluationTimes.shift();
        }
        // Check for slow evaluation
        if (timeMs > this.thresholds.slowEvaluationMs) {
            this.createAlert('warning', 'evaluation', `Slow evaluation detected: ${timeMs.toFixed(2)}ms`, timeMs, this.thresholds.slowEvaluationMs);
        }
    }
    /**
     * Record indicator calculation time
     */
    recordIndicatorTime(timeMs) {
        this.metrics.indicatorTimes.push(timeMs);
        this.metrics.indicatorCount++;
        if (this.metrics.indicatorTimes.length > 100) {
            this.metrics.indicatorTimes.shift();
        }
    }
    /**
     * Record signal generation
     */
    recordSignal() {
        this.metrics.signalCount++;
    }
    /**
     * Record error
     */
    recordError() {
        this.metrics.errorCount++;
    }
    /**
     * Get current performance metrics
     */
    getMetrics() {
        const now = Date.now();
        const uptimeMs = now - this.metrics.startTime.getTime();
        const uptimeMinutes = uptimeMs / 60000;
        const uptimeHours = uptimeMs / 3600000;
        // Calculate averages
        const avgEvalTime = this.metrics.evaluationTimes.length > 0
            ? this.metrics.evaluationTimes.reduce((a, b) => a + b, 0) / this.metrics.evaluationTimes.length
            : 0;
        const avgIndicatorTime = this.metrics.indicatorTimes.length > 0
            ? this.metrics.indicatorTimes.reduce((a, b) => a + b, 0) / this.metrics.indicatorTimes.length
            : 0;
        // Get min/max
        const slowestEval = this.metrics.evaluationTimes.length > 0
            ? Math.max(...this.metrics.evaluationTimes)
            : 0;
        const fastestEval = this.metrics.evaluationTimes.length > 0
            ? Math.min(...this.metrics.evaluationTimes)
            : 0;
        // Calculate rates
        const evaluationsPerMinute = uptimeMinutes > 0
            ? this.metrics.evaluationCount / uptimeMinutes
            : 0;
        const signalsPerHour = uptimeHours > 0
            ? this.metrics.signalCount / uptimeHours
            : 0;
        const errorRate = this.metrics.evaluationCount > 0
            ? this.metrics.errorCount / this.metrics.evaluationCount
            : 0;
        // System resources
        const memUsage = process.memoryUsage();
        const memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
        return {
            evaluationsPerMinute,
            averageEvaluationTime: avgEvalTime,
            slowestEvaluation: slowestEval,
            fastestEvaluation: fastestEval,
            indicatorCalculations: this.metrics.indicatorCount,
            indicatorCacheHitRate: 0, // To be filled by cache service
            averageIndicatorTime: avgIndicatorTime,
            signalsGenerated: this.metrics.signalCount,
            signalsPerHour,
            memoryUsage,
            cpuUsage: 0, // Requires additional library
            errorCount: this.metrics.errorCount,
            errorRate,
            timestamp: new Date()
        };
    }
    /**
     * Get performance summary
     */
    getSummary() {
        const metrics = this.getMetrics();
        return `
Performance Summary:
- Evaluations/min: ${metrics.evaluationsPerMinute.toFixed(2)}
- Avg evaluation: ${metrics.averageEvaluationTime.toFixed(2)}ms
- Signals/hour: ${metrics.signalsPerHour.toFixed(2)}
- Memory usage: ${metrics.memoryUsage.toFixed(2)}MB
- Error rate: ${(metrics.errorRate * 100).toFixed(2)}%
    `.trim();
    }
    /**
     * Get recent alerts
     */
    getAlerts(count = 10) {
        return this.alertHistory.slice(-count);
    }
    /**
     * Create performance alert
     */
    createAlert(level, category, message, value, threshold) {
        const alert = {
            level,
            category,
            message,
            value,
            threshold,
            timestamp: new Date()
        };
        this.alertHistory.push(alert);
        // Limit history size
        if (this.alertHistory.length > this.maxAlertHistory) {
            this.alertHistory.shift();
        }
        // Emit event
        this.emit('alert', alert);
        // Log based on level
        if (level === 'error') {
            logger.error(`[PerformanceMonitor] ${message}`);
        }
        else if (level === 'warning') {
            logger.warn(`[PerformanceMonitor] ${message}`);
        }
        else {
            logger.info(`[PerformanceMonitor] ${message}`);
        }
    }
    /**
     * Check system health
     */
    checkHealth() {
        const issues = [];
        const metrics = this.getMetrics();
        // Check evaluation time
        if (metrics.averageEvaluationTime > this.thresholds.slowEvaluationMs) {
            issues.push(`Slow evaluations: ${metrics.averageEvaluationTime.toFixed(2)}ms avg`);
        }
        // Check memory usage
        if (metrics.memoryUsage > this.thresholds.highMemoryMB) {
            issues.push(`High memory usage: ${metrics.memoryUsage.toFixed(2)}MB`);
        }
        // Check error rate
        if (metrics.errorRate > this.thresholds.highErrorRate) {
            issues.push(`High error rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
        }
        return {
            healthy: issues.length === 0,
            issues
        };
    }
    /**
     * Reset metrics
     */
    reset() {
        this.metrics = {
            evaluationTimes: [],
            indicatorTimes: [],
            evaluationCount: 0,
            indicatorCount: 0,
            signalCount: 0,
            errorCount: 0,
            startTime: new Date()
        };
        this.alertHistory = [];
        logger.info('[PerformanceMonitor] Metrics reset');
    }
    /**
     * Set threshold
     */
    setThreshold(key, value) {
        this.thresholds[key] = value;
        logger.info(`[PerformanceMonitor] Threshold ${key} set to ${value}`);
    }
    /**
     * Start periodic monitoring
     */
    startPeriodicMonitoring() {
        // Check health every minute
        setInterval(() => {
            const health = this.checkHealth();
            if (!health.healthy) {
                this.createAlert('warning', 'system', `Health check failed: ${health.issues.join(', ')}`, health.issues.length, 0);
            }
            // Log summary every 5 minutes
            if (this.metrics.evaluationCount % 300 === 0 && this.metrics.evaluationCount > 0) {
                logger.info('[PerformanceMonitor]', this.getSummary());
            }
        }, 60000); // Every minute
        logger.info('[PerformanceMonitor] Periodic monitoring started');
    }
    /**
     * Get uptime
     */
    getUptime() {
        const ms = Date.now() - this.metrics.startTime.getTime();
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const h = hours;
        const m = minutes % 60;
        const s = seconds % 60;
        return {
            milliseconds: ms,
            seconds,
            minutes,
            hours,
            formatted: `${h}h ${m}m ${s}s`
        };
    }
}
