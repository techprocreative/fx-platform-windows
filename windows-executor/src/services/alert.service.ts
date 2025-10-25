/**
 * Alert Service
 * Manages and sends alerts for regime changes and other events
 */

import { logger } from '../utils/logger';
import { EventEmitter } from 'events';
import { MarketRegime } from '../types/strategy.types';

export interface Alert {
  id: string;
  type: AlertType;
  level: AlertLevel;
  title: string;
  message: string;
  data?: any;
  timestamp: Date;
  acknowledged: boolean;
}

export type AlertType =
  | 'regime_change'
  | 'high_volatility'
  | 'low_volatility'
  | 'high_correlation'
  | 'drawdown_warning'
  | 'margin_warning'
  | 'performance_issue'
  | 'connection_lost'
  | 'signal_generated'
  | 'trade_executed'
  | 'custom';

export type AlertLevel = 'info' | 'warning' | 'error' | 'critical';

export class AlertService extends EventEmitter {
  private alerts: Alert[] = [];
  private maxAlerts: number = 500;
  private regimeHistory: Map<string, MarketRegime> = new Map();

  /**
   * Create and emit an alert
   */
  createAlert(
    type: AlertType,
    level: AlertLevel,
    title: string,
    message: string,
    data?: any
  ): Alert {
    
    const alert: Alert = {
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
  alertRegimeChange(
    symbol: string,
    previousRegime: MarketRegime,
    newRegime: MarketRegime,
    confidence: number
  ): Alert {
    
    return this.createAlert(
      'regime_change',
      'info',
      `Regime Change: ${symbol}`,
      `Market regime changed from ${previousRegime} to ${newRegime} (confidence: ${(confidence * 100).toFixed(1)}%)`,
      {
        symbol,
        previousRegime,
        newRegime,
        confidence
      }
    );
  }

  /**
   * Alert on high volatility
   */
  alertHighVolatility(
    symbol: string,
    atr: number,
    avgAtr: number,
    ratio: number
  ): Alert {
    
    return this.createAlert(
      'high_volatility',
      'warning',
      `High Volatility: ${symbol}`,
      `Volatility spike detected. ATR: ${atr.toFixed(5)} (${ratio.toFixed(1)}x average)`,
      { symbol, atr, avgAtr, ratio }
    );
  }

  /**
   * Alert on high correlation
   */
  alertHighCorrelation(
    symbol1: string,
    symbol2: string,
    correlation: number
  ): Alert {
    
    return this.createAlert(
      'high_correlation',
      'warning',
      'High Correlation Detected',
      `${symbol1} and ${symbol2} are highly correlated: ${(correlation * 100).toFixed(1)}%`,
      { symbol1, symbol2, correlation }
    );
  }

  /**
   * Alert on drawdown warning
   */
  alertDrawdown(
    currentDrawdown: number,
    maxDrawdown: number
  ): Alert {
    
    const percentage = (currentDrawdown / maxDrawdown) * 100;
    const level: AlertLevel = percentage > 80 ? 'error' : 'warning';

    return this.createAlert(
      'drawdown_warning',
      level,
      'Drawdown Warning',
      `Current drawdown: ${currentDrawdown.toFixed(2)}% (${percentage.toFixed(1)}% of max ${maxDrawdown}%)`,
      { currentDrawdown, maxDrawdown, percentage }
    );
  }

  /**
   * Alert on margin warning
   */
  alertMargin(
    marginLevel: number,
    freeMargin: number
  ): Alert {
    
    const level: AlertLevel = marginLevel < 100 ? 'critical' : marginLevel < 200 ? 'error' : 'warning';

    return this.createAlert(
      'margin_warning',
      level,
      'Margin Warning',
      `Margin level: ${marginLevel.toFixed(2)}%, Free margin: $${freeMargin.toFixed(2)}`,
      { marginLevel, freeMargin }
    );
  }

  /**
   * Alert on performance issue
   */
  alertPerformance(
    issue: string,
    value: number,
    threshold: number
  ): Alert {
    
    return this.createAlert(
      'performance_issue',
      'warning',
      'Performance Issue',
      `${issue}: ${value.toFixed(2)} (threshold: ${threshold})`,
      { issue, value, threshold }
    );
  }

  /**
   * Alert on connection lost
   */
  alertConnectionLost(
    service: string
  ): Alert {
    
    return this.createAlert(
      'connection_lost',
      'error',
      'Connection Lost',
      `Lost connection to ${service}`,
      { service }
    );
  }

  /**
   * Alert on signal generated
   */
  alertSignal(
    strategyName: string,
    symbol: string,
    type: 'BUY' | 'SELL',
    confidence: number
  ): Alert {
    
    return this.createAlert(
      'signal_generated',
      'info',
      'Signal Generated',
      `${strategyName}: ${type} ${symbol} (confidence: ${confidence}%)`,
      { strategyName, symbol, type, confidence }
    );
  }

  /**
   * Check regime change and alert if detected
   */
  checkRegimeChange(
    symbol: string,
    newRegime: MarketRegime,
    confidence: number
  ): Alert | null {
    
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
  getRecentAlerts(count: number = 50, level?: AlertLevel): Alert[] {
    let alerts = this.alerts.slice(-count);

    if (level) {
      alerts = alerts.filter(a => a.level === level);
    }

    return alerts.reverse(); // Most recent first
  }

  /**
   * Get unacknowledged alerts
   */
  getUnacknowledgedAlerts(level?: AlertLevel): Alert[] {
    let alerts = this.alerts.filter(a => !a.acknowledged);

    if (level) {
      alerts = alerts.filter(a => a.level === level);
    }

    return alerts;
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): boolean {
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
  acknowledgeAll(level?: AlertLevel): number {
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
  clearOldAlerts(olderThanMs: number = 86400000): number {
    const cutoff = Date.now() - olderThanMs;
    const before = this.alerts.length;

    this.alerts = this.alerts.filter(
      a => a.timestamp.getTime() > cutoff
    );

    const cleared = before - this.alerts.length;

    if (cleared > 0) {
      logger.info(`[AlertService] Cleared ${cleared} old alerts`);
    }

    return cleared;
  }

  /**
   * Get alert statistics
   */
  getStats(): {
    total: number;
    unacknowledged: number;
    byLevel: Record<AlertLevel, number>;
    byType: Record<AlertType, number>;
  } {
    
    const stats = {
      total: this.alerts.length,
      unacknowledged: this.alerts.filter(a => !a.acknowledged).length,
      byLevel: {
        info: 0,
        warning: 0,
        error: 0,
        critical: 0
      } as Record<AlertLevel, number>,
      byType: {} as Record<AlertType, number>
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
  exportAlerts(filter?: {
    level?: AlertLevel;
    type?: AlertType;
    startDate?: Date;
    endDate?: Date;
  }): Alert[] {
    
    let filtered = [...this.alerts];

    if (filter?.level) {
      filtered = filtered.filter(a => a.level === filter.level);
    }

    if (filter?.type) {
      filtered = filtered.filter(a => a.type === filter.type);
    }

    if (filter?.startDate) {
      filtered = filtered.filter(a => a.timestamp >= filter.startDate!);
    }

    if (filter?.endDate) {
      filtered = filtered.filter(a => a.timestamp <= filter.endDate!);
    }

    return filtered;
  }

  /**
   * Start periodic cleanup
   */
  startPeriodicCleanup(intervalMs: number = 3600000): void {
    setInterval(() => {
      this.clearOldAlerts();
    }, intervalMs);

    logger.info(`[AlertService] Periodic cleanup started (every ${intervalMs}ms)`);
  }
}
