/**
 * Alert Service
 * Manages and sends alerts for regime changes and other events
 */
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';
export class AlertService extends EventEmitter {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "alerts", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "maxAlerts", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 500
        });
        Object.defineProperty(this, "regimeHistory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    /**
     * Create and emit an alert
     */
    createAlert(type, level, title, message, data) {
        const alert = {
            id: `alert-${Date.now()}-${Math.random()}`,
            type,
            level,
            title,
            message,
            data,
            timestamp: new Date(),
            acknowledged: false
        };
        // Add to history
        this.alerts.push(alert);
        // Limit history size
        if (this.alerts.length > this.maxAlerts) {
            this.alerts.shift();
        }
        // Emit event
        this.emit('alert', alert);
        // Log based on level
        const logMessage = `[Alert] ${title}: ${message}`;
        switch (level) {
            case 'critical':
            case 'error':
                logger.error(logMessage);
                break;
            case 'warning':
                logger.warn(logMessage);
                break;
            case 'info':
                logger.info(logMessage);
                break;
        }
        return alert;
    }
    /**
     * Alert on regime change
     */
    alertRegimeChange(symbol, previousRegime, newRegime, confidence) {
        return this.createAlert('regime_change', 'info', `Regime Change: ${symbol}`, `Market regime changed from ${previousRegime} to ${newRegime} (confidence: ${(confidence * 100).toFixed(1)}%)`, {
            symbol,
            previousRegime,
            newRegime,
            confidence
        });
    }
    /**
     * Alert on high volatility
     */
    alertHighVolatility(symbol, atr, avgAtr, ratio) {
        return this.createAlert('high_volatility', 'warning', `High Volatility: ${symbol}`, `Volatility spike detected. ATR: ${atr.toFixed(5)} (${ratio.toFixed(1)}x average)`, { symbol, atr, avgAtr, ratio });
    }
    /**
     * Alert on high correlation
     */
    alertHighCorrelation(symbol1, symbol2, correlation) {
        return this.createAlert('high_correlation', 'warning', 'High Correlation Detected', `${symbol1} and ${symbol2} are highly correlated: ${(correlation * 100).toFixed(1)}%`, { symbol1, symbol2, correlation });
    }
    /**
     * Alert on drawdown warning
     */
    alertDrawdown(currentDrawdown, maxDrawdown) {
        const percentage = (currentDrawdown / maxDrawdown) * 100;
        const level = percentage > 80 ? 'error' : 'warning';
        return this.createAlert('drawdown_warning', level, 'Drawdown Warning', `Current drawdown: ${currentDrawdown.toFixed(2)}% (${percentage.toFixed(1)}% of max ${maxDrawdown}%)`, { currentDrawdown, maxDrawdown, percentage });
    }
    /**
     * Alert on margin warning
     */
    alertMargin(marginLevel, freeMargin) {
        const level = marginLevel < 100 ? 'critical' : marginLevel < 200 ? 'error' : 'warning';
        return this.createAlert('margin_warning', level, 'Margin Warning', `Margin level: ${marginLevel.toFixed(2)}%, Free margin: $${freeMargin.toFixed(2)}`, { marginLevel, freeMargin });
    }
    /**
     * Alert on performance issue
     */
    alertPerformance(issue, value, threshold) {
        return this.createAlert('performance_issue', 'warning', 'Performance Issue', `${issue}: ${value.toFixed(2)} (threshold: ${threshold})`, { issue, value, threshold });
    }
    /**
     * Alert on connection lost
     */
    alertConnectionLost(service) {
        return this.createAlert('connection_lost', 'error', 'Connection Lost', `Lost connection to ${service}`, { service });
    }
    /**
     * Alert on signal generated
     */
    alertSignal(strategyName, symbol, type, confidence) {
        return this.createAlert('signal_generated', 'info', 'Signal Generated', `${strategyName}: ${type} ${symbol} (confidence: ${confidence}%)`, { strategyName, symbol, type, confidence });
    }
    /**
     * Check regime change and alert if detected
     */
    checkRegimeChange(symbol, newRegime, confidence) {
        const previousRegime = this.regimeHistory.get(symbol);
        if (previousRegime && previousRegime !== newRegime) {
            this.regimeHistory.set(symbol, newRegime);
            return this.alertRegimeChange(symbol, previousRegime, newRegime, confidence);
        }
        // Store current regime
        if (!previousRegime) {
            this.regimeHistory.set(symbol, newRegime);
        }
        return null;
    }
    /**
     * Get recent alerts
     */
    getRecentAlerts(count = 50, level) {
        let alerts = this.alerts.slice(-count);
        if (level) {
            alerts = alerts.filter(a => a.level === level);
        }
        return alerts.reverse(); // Most recent first
    }
    /**
     * Get unacknowledged alerts
     */
    getUnacknowledgedAlerts(level) {
        let alerts = this.alerts.filter(a => !a.acknowledged);
        if (level) {
            alerts = alerts.filter(a => a.level === level);
        }
        return alerts;
    }
    /**
     * Acknowledge alert
     */
    acknowledgeAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
            logger.info(`[AlertService] Alert acknowledged: ${alertId}`);
            this.emit('alert:acknowledged', alert);
            return true;
        }
        return false;
    }
    /**
     * Acknowledge all alerts
     */
    acknowledgeAll(level) {
        let count = 0;
        for (const alert of this.alerts) {
            if (!alert.acknowledged && (!level || alert.level === level)) {
                alert.acknowledged = true;
                count++;
            }
        }
        if (count > 0) {
            logger.info(`[AlertService] Acknowledged ${count} alerts`);
            this.emit('alerts:acknowledged:bulk', count);
        }
        return count;
    }
    /**
     * Clear old alerts
     */
    clearOldAlerts(olderThanMs = 86400000) {
        const cutoff = Date.now() - olderThanMs;
        const before = this.alerts.length;
        this.alerts = this.alerts.filter(a => a.timestamp.getTime() > cutoff);
        const cleared = before - this.alerts.length;
        if (cleared > 0) {
            logger.info(`[AlertService] Cleared ${cleared} old alerts`);
        }
        return cleared;
    }
    /**
     * Get alert statistics
     */
    getStats() {
        const stats = {
            total: this.alerts.length,
            unacknowledged: this.alerts.filter(a => !a.acknowledged).length,
            byLevel: {
                info: 0,
                warning: 0,
                error: 0,
                critical: 0
            },
            byType: {}
        };
        for (const alert of this.alerts) {
            stats.byLevel[alert.level]++;
            stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
        }
        return stats;
    }
    /**
     * Export alerts as JSON
     */
    exportAlerts(filter) {
        let filtered = [...this.alerts];
        if (filter?.level) {
            filtered = filtered.filter(a => a.level === filter.level);
        }
        if (filter?.type) {
            filtered = filtered.filter(a => a.type === filter.type);
        }
        if (filter?.startDate) {
            filtered = filtered.filter(a => a.timestamp >= filter.startDate);
        }
        if (filter?.endDate) {
            filtered = filtered.filter(a => a.timestamp <= filter.endDate);
        }
        return filtered;
    }
    /**
     * Start periodic cleanup
     */
    startPeriodicCleanup(intervalMs = 3600000) {
        setInterval(() => {
            this.clearOldAlerts();
        }, intervalMs);
        logger.info(`[AlertService] Periodic cleanup started (every ${intervalMs}ms)`);
    }
}
