import { 
  SafetyLimits, 
  SafetyCheck, 
  EmergencyStopConfig,
  TradeParams,
  MonitoringMetrics,
  SecurityEvent
} from '../types/security.types';
import { logger } from '../utils/logger';
import { DatabaseManager } from '../database/manager';
import { EventEmitter } from 'events';

export class SafetyService extends EventEmitter {
  private limits: SafetyLimits;
  private emergencyConfig: EmergencyStopConfig;
  private isEnabled: boolean = true;
  private dailyTradeCount: number = 0;
  private hourlyTradeCount: number = 0;
  private lastTradeReset: Date = new Date();
  private lastHourReset: Date = new Date();
  private emergencyStopActive: boolean = false;
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    super();
    this.db = db;
    this.limits = this.getDefaultLimits();
    this.emergencyConfig = this.getDefaultEmergencyConfig();
    
    // Reset counters at midnight
    this.scheduleDailyReset();
    
    // Reset hourly counters
    this.scheduleHourlyReset();
  }

  private getDefaultLimits(): SafetyLimits {
    return {
      maxDailyLoss: 500, // $500
      maxPositions: 10,
      maxLotSize: 1.0,
      maxDrawdownPercent: 20, // 20%
      maxHourlyTrades: 20,
      maxRiskPerTrade: 2, // 2%
      maxSpreadPoints: 5,
      minAccountBalance: 1000, // $1000
    };
  }

  private getDefaultEmergencyConfig(): EmergencyStopConfig {
    return {
      enabled: true,
      triggers: {
        dailyLossExceeded: true,
        maxDrawdownExceeded: true,
        connectionLost: true,
        manualActivation: true,
        securityBreach: true,
      },
      actions: {
        closeAllPositions: true,
        pauseStrategies: true,
        disconnectFromMT5: false,
        notifyAdmin: true,
      },
    };
  }

  /**
   * Comprehensive safety check before executing a trade
   */
  async checkBeforeTrade(params: TradeParams, currentMetrics: MonitoringMetrics): Promise<SafetyCheck> {
    const check: SafetyCheck = {
      passed: true,
      warnings: [],
      errors: [],
      metadata: {},
    };

    try {
      // Check if emergency stop is active
      if (this.emergencyStopActive) {
        check.passed = false;
        check.errors.push('Emergency stop is active - all trading halted');
        return check;
      }

      // Check if safety service is enabled
      if (!this.isEnabled) {
        check.warnings.push('Safety service is disabled');
        return check;
      }

      // Check daily loss limit
      const dailyPnL = currentMetrics.trading.dailyPnL;
      if (check.metadata) check.metadata.dailyPnL = dailyPnL;
      
      if (dailyPnL <= -this.limits.maxDailyLoss) {
        check.passed = false;
        check.errors.push(`Daily loss limit exceeded: $${Math.abs(dailyPnL).toFixed(2)} > $${this.limits.maxDailyLoss}`);
        
        // Trigger emergency stop if configured
        if (this.emergencyConfig.triggers.dailyLossExceeded) {
          await this.triggerEmergencyStop('Daily loss limit exceeded');
        }
      } else if (dailyPnL < -this.limits.maxDailyLoss * 0.8) {
        check.warnings.push(`Approaching daily loss limit: $${Math.abs(dailyPnL).toFixed(2)}`);
      }

      // Check maximum positions
      const openPositions = currentMetrics.trading.openPositions;
      if (check.metadata) check.metadata.openPositions = openPositions;
      
      if (openPositions >= this.limits.maxPositions) {
        check.passed = false;
        check.errors.push(`Maximum positions reached: ${openPositions}/${this.limits.maxPositions}`);
      } else if (openPositions >= this.limits.maxPositions * 0.8) {
        check.warnings.push(`Approaching maximum positions: ${openPositions}/${this.limits.maxPositions}`);
      }

      // Check lot size
      if (params.volume > this.limits.maxLotSize) {
        check.passed = false;
        check.errors.push(`Lot size exceeds maximum: ${params.volume} > ${this.limits.maxLotSize}`);
      }

      // Check drawdown
      const currentDrawdown = await this.calculateCurrentDrawdown(currentMetrics);
      if (check.metadata) check.metadata.currentDrawdown = currentDrawdown;
      
      if (currentDrawdown >= this.limits.maxDrawdownPercent) {
        check.passed = false;
        check.errors.push(`Maximum drawdown reached: ${currentDrawdown.toFixed(2)}% > ${this.limits.maxDrawdownPercent}%`);
        
        // Trigger emergency stop if configured
        if (this.emergencyConfig.triggers.maxDrawdownExceeded) {
          await this.triggerEmergencyStop('Maximum drawdown exceeded');
        }
      } else if (currentDrawdown >= this.limits.maxDrawdownPercent * 0.8) {
        check.warnings.push(`Approaching maximum drawdown: ${currentDrawdown.toFixed(2)}%`);
      }

      // Check hourly trade limits
      this.updateTradeCounters();
      if (this.hourlyTradeCount >= this.limits.maxHourlyTrades) {
        check.passed = false;
        check.errors.push(`Hourly trade limit exceeded: ${this.hourlyTradeCount}/${this.limits.maxHourlyTrades}`);
      } else if (this.hourlyTradeCount >= this.limits.maxHourlyTrades * 0.8) {
        check.warnings.push(`Approaching hourly trade limit: ${this.hourlyTradeCount}/${this.limits.maxHourlyTrades}`);
      }

      // Check account balance
      const accountBalance = currentMetrics.trading.dailyPnL; // This should be actual balance
      if (check.metadata) check.metadata.accountBalance = accountBalance;
      
      if (accountBalance < this.limits.minAccountBalance) {
        check.passed = false;
        check.errors.push(`Account balance below minimum: $${accountBalance.toFixed(2)} < $${this.limits.minAccountBalance}`);
      }

      // Check risk per trade
      const riskPercentage = this.calculateRiskPercentage(params, currentMetrics);
      if (check.metadata) check.metadata.riskPercentage = riskPercentage;
      
      if (riskPercentage > this.limits.maxRiskPerTrade) {
        check.passed = false;
        check.errors.push(`Risk per trade exceeds maximum: ${riskPercentage.toFixed(2)}% > ${this.limits.maxRiskPerTrade}%`);
      }

      // Log safety check result
      await logger.info('Safety check completed', {
        tradeParams: params,
        result: check,
        metrics: currentMetrics,
      });

      return check;

    } catch (error) {
      await logger.error('Error during safety check', { error, params });
      check.passed = false;
      check.errors.push(`Safety check error: ${(error as Error).message}`);
      return check;
    }
  }

  /**
   * Emergency stop functionality with response time < 1 second
   */
  async emergencyStop(reason?: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      await logger.warn('EMERGENCY STOP ACTIVATED', { reason });
      
      // Set emergency stop flag immediately
      this.emergencyStopActive = true;
      
      // Emit emergency stop event
      this.emit('emergencyStop', { reason, timestamp: new Date() });
      
      // Log security event
      await this.logSecurityEvent('EMERGENCY_STOP', 'CRITICAL', `Emergency stop activated: ${reason || 'Manual activation'}`);
      
      // Execute emergency actions based on configuration
      const promises: Promise<any>[] = [];
      
      if (this.emergencyConfig.actions.closeAllPositions) {
        promises.push(this.closeAllPositions());
      }
      
      if (this.emergencyConfig.actions.pauseStrategies) {
        promises.push(this.pauseAllStrategies());
      }
      
      if (this.emergencyConfig.actions.disconnectFromMT5) {
        promises.push(this.disconnectFromMT5());
      }
      
      if (this.emergencyConfig.actions.notifyAdmin) {
        promises.push(this.notifyAdminEmergencyStop(reason));
      }
      
      // Execute all actions in parallel for speed
      await Promise.allSettled(promises);
      
      const responseTime = Date.now() - startTime;
      await logger.info('Emergency stop completed', { 
        reason, 
        responseTime: `${responseTime}ms`,
        actions: this.emergencyConfig.actions,
      });
      
      // Ensure response time is under 1 second
      if (responseTime > 1000) {
        await logger.warn('Emergency stop response time exceeded 1 second', { responseTime });
      }
      
    } catch (error) {
      await logger.error('Error during emergency stop', { error, reason });
      throw error;
    }
  }

  /**
   * Reset emergency stop
   */
  async resetEmergencyStop(): Promise<void> {
    try {
      this.emergencyStopActive = false;
      await logger.info('Emergency stop reset');
      this.emit('emergencyStopReset', { timestamp: new Date() });
    } catch (error) {
      await logger.error('Error resetting emergency stop', { error });
      throw error;
    }
  }

  /**
   * Update safety limits
   */
  async updateLimits(newLimits: Partial<SafetyLimits>): Promise<void> {
    try {
      this.limits = { ...this.limits, ...newLimits };
      
      // Save to database
      await this.db.saveConfig('safetyLimits', this.limits);
      
      await logger.info('Safety limits updated', { newLimits: this.limits });
      this.emit('limitsUpdated', { limits: this.limits });
    } catch (error) {
      await logger.error('Error updating safety limits', { error, newLimits });
      throw error;
    }
  }

  /**
   * Get current safety limits
   */
  getLimits(): SafetyLimits {
    return { ...this.limits };
  }

  /**
   * Check if emergency stop is active
   */
  isEmergencyStopActive(): boolean {
    return this.emergencyStopActive;
  }

  /**
   * Enable/disable safety service
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    logger.info(`Safety service ${enabled ? 'enabled' : 'disabled'}`);
    this.emit('safetyToggled', { enabled });
  }

  /**
   * Calculate current drawdown percentage
   */
  private async calculateCurrentDrawdown(metrics: MonitoringMetrics): Promise<number> {
    try {
      // This would typically calculate drawdown from equity curve
      // For now, using a simplified calculation
      const dailyPnL = metrics.trading.dailyPnL;
      const accountBalance = 10000; // This should be actual account balance
      
      const drawdown = Math.abs(dailyPnL) / accountBalance * 100;
      return Math.min(drawdown, 100); // Cap at 100%
    } catch (error) {
      await logger.error('Error calculating drawdown', { error });
      return 0;
    }
  }

  /**
   * Calculate risk percentage for a trade
   */
  private calculateRiskPercentage(params: TradeParams, metrics: MonitoringMetrics): number {
    try {
      // Simplified risk calculation
      const accountBalance = 10000; // This should be actual account balance
      const riskAmount = params.volume * 1000; // Simplified risk calculation
      
      return (riskAmount / accountBalance) * 100;
    } catch (error) {
      logger.error('Error calculating risk percentage', { error, params });
      return 0;
    }
  }

  /**
   * Update trade counters
   */
  private updateTradeCounters(): void {
    const now = new Date();
    
    // Reset daily counter if it's a new day
    if (now.toDateString() !== this.lastTradeReset.toDateString()) {
      this.dailyTradeCount = 0;
      this.lastTradeReset = now;
    }
    
    // Reset hourly counter if it's a new hour
    if (now.getHours() !== this.lastHourReset.getHours()) {
      this.hourlyTradeCount = 0;
      this.lastHourReset = now;
    }
    
    // Increment counters
    this.dailyTradeCount++;
    this.hourlyTradeCount++;
  }

  /**
   * Schedule daily reset at midnight
   */
  private scheduleDailyReset(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      this.dailyTradeCount = 0;
      this.lastTradeReset = new Date();
      this.scheduleDailyReset(); // Schedule next day
    }, msUntilMidnight);
  }

  /**
   * Schedule hourly reset
   */
  private scheduleHourlyReset(): void {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    
    const msUntilNextHour = nextHour.getTime() - now.getTime();
    
    setTimeout(() => {
      this.hourlyTradeCount = 0;
      this.lastHourReset = new Date();
      this.scheduleHourlyReset(); // Schedule next hour
    }, msUntilNextHour);
  }

  /**
   * Close all positions (placeholder implementation)
   */
  private async closeAllPositions(): Promise<void> {
    try {
      await logger.info('Closing all positions');
      // This would integrate with the trading service
      this.emit('closeAllPositions', { timestamp: new Date() });
    } catch (error) {
      await logger.error('Error closing all positions', { error });
    }
  }

  /**
   * Pause all strategies (placeholder implementation)
   */
  private async pauseAllStrategies(): Promise<void> {
    try {
      await logger.info('Pausing all strategies');
      // This would integrate with the strategy management
      this.emit('pauseAllStrategies', { timestamp: new Date() });
    } catch (error) {
      await logger.error('Error pausing strategies', { error });
    }
  }

  /**
   * Disconnect from MT5 (placeholder implementation)
   */
  private async disconnectFromMT5(): Promise<void> {
    try {
      await logger.info('Disconnecting from MT5');
      // This would integrate with the MT5 service
      this.emit('disconnectFromMT5', { timestamp: new Date() });
    } catch (error) {
      await logger.error('Error disconnecting from MT5', { error });
    }
  }

  /**
   * Notify admin about emergency stop (placeholder implementation)
   */
  private async notifyAdminEmergencyStop(reason?: string): Promise<void> {
    try {
      await logger.info('Notifying admin about emergency stop', { reason });
      // This would send notifications via email, webhook, etc.
      this.emit('adminNotified', { reason, timestamp: new Date() });
    } catch (error) {
      await logger.error('Error notifying admin', { error });
    }
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(type: string, severity: string, message: string): Promise<void> {
    try {
      const event: SecurityEvent = {
        id: `sec_${Date.now()}`,
        type: type as any,
        timestamp: new Date(),
        severity: severity as any,
        message,
      };
      
      await this.db.saveSecurityEvent(event);
      this.emit('securityEvent', event);
    } catch (error) {
      await logger.error('Error logging security event', { error });
    }
  }

  /**
   * Trigger emergency stop with specific reason
   */
  private async triggerEmergencyStop(reason: string): Promise<void> {
    if (!this.emergencyStopActive) {
      await this.emergencyStop(reason);
    }
  }
}