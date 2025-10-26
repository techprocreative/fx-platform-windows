/**
 * Strategy Monitor Service
 * Continuous monitoring and signal generation for active strategies
 * This is where REAL signal generation happens (not on Web Platform)
 */

import { EventEmitter } from 'events';
import { Strategy, Signal, StrategyState } from '../types/strategy.types';
import { logger } from '../utils/logger';
import { IndicatorService } from './indicator.service';
import { MarketDataService } from './market-data.service';
import { ConditionEvaluatorService } from './condition-evaluator.service';
import { FilterEvaluatorService } from './filter-evaluator.service';
import { PositionSizingService } from './position-sizing.service';
import { SafetyValidatorService } from './safety-validator.service';
import { getPrimarySymbol } from '../utils/strategy-helpers';

interface MonitorThread {
  strategyId: string;
  strategy: Strategy;
  isActive: boolean;
  interval: NodeJS.Timeout | null;
  lastCheck: Date;
  lastSignalTime: Date | null;  // Track last signal time for cooldown
  signalCount: number;
  errorCount: number;
  hasOpenPosition: boolean;  // Track if position is open for this strategy
}

export class StrategyMonitor extends EventEmitter {
  private activeMonitors: Map<string, MonitorThread> = new Map();
  
  constructor(
    private indicatorService: IndicatorService,
    private marketDataService: MarketDataService,
    private conditionEvaluator: ConditionEvaluatorService,
    private filterEvaluator: FilterEvaluatorService,
    private positionSizingService: PositionSizingService,
    private safetyValidator: SafetyValidatorService
  ) {
    super();
  }

  /**
   * Start monitoring a strategy
   */
  async startMonitoring(strategy: Strategy): Promise<void> {
    if (this.activeMonitors.has(strategy.id)) {
      logger.warn(`[StrategyMonitor] Strategy ${strategy.id} already being monitored`);
      return;
    }

    logger.info(`[StrategyMonitor] Starting monitoring for strategy: ${strategy.name}`);

    const monitor: MonitorThread = {
      strategyId: strategy.id,
      strategy,
      isActive: true,
      interval: null,
      lastCheck: new Date(),
      lastSignalTime: null,
      signalCount: 0,
      errorCount: 0,
      hasOpenPosition: false,
    };

    this.activeMonitors.set(strategy.id, monitor);

    // Start the monitoring loop
    await this.runMonitoringLoop(monitor);
  }

  /**
   * Stop monitoring a strategy
   */
  async stopMonitoring(strategyId: string): Promise<void> {
    const monitor = this.activeMonitors.get(strategyId);
    
    if (!monitor) {
      logger.warn(`[StrategyMonitor] Strategy ${strategyId} not being monitored`);
      return;
    }

    logger.info(`[StrategyMonitor] Stopping monitoring for strategy: ${monitor.strategy.name}`);

    monitor.isActive = false;
    
    if (monitor.interval) {
      clearTimeout(monitor.interval);
      monitor.interval = null;
    }

    this.activeMonitors.delete(strategyId);
    this.emit('monitor:stopped', { strategyId });
  }

  /**
   * Stop all monitoring
   */
  async stopAll(): Promise<void> {
    logger.info('[StrategyMonitor] Stopping all strategy monitors...');
    
    const strategyIds = Array.from(this.activeMonitors.keys());
    
    for (const strategyId of strategyIds) {
      await this.stopMonitoring(strategyId);
    }
    
    logger.info('[StrategyMonitor] All monitors stopped');
  }

  /**
   * Get monitoring status
   */
  getStatus(strategyId: string): MonitorThread | null {
    return this.activeMonitors.get(strategyId) || null;
  }

  /**
   * Get all active monitors
   */
  getAllActive(): MonitorThread[] {
    return Array.from(this.activeMonitors.values());
  }

  /**
   * Mark position as closed for a strategy
   * Call this when a position is closed to allow new signals
   */
  markPositionClosed(strategyId: string): void {
    const monitor = this.activeMonitors.get(strategyId);
    if (monitor) {
      monitor.hasOpenPosition = false;
      logger.info(`[StrategyMonitor] Position closed for ${monitor.strategy.name}, ready for new signals`);
    }
  }

  /**
   * Main monitoring loop - THIS IS THE CRITICAL CONTINUOUS MONITORING
   */
  private async runMonitoringLoop(monitor: MonitorThread): Promise<void> {
    const { strategy } = monitor;
    
    // Calculate check interval based on timeframe
    const interval = this.getCheckInterval(strategy.timeframe);
    
    logger.info(`[StrategyMonitor] Monitor loop started for ${strategy.name} (checking every ${interval}ms)`);

    const executeLoop = async () => {
      if (!monitor.isActive) {
        return;
      }

      try {
        monitor.lastCheck = new Date();

        // Get primary symbol from strategy
        const primarySymbol = getPrimarySymbol(strategy);

        // 1. Get latest market data
        const marketData = await this.marketDataService.getLatestData(
          primarySymbol,
          strategy.timeframe,
          100 // Get last 100 candles
        );

        if (!marketData || marketData.length === 0) {
          logger.warn(`[StrategyMonitor] No market data for ${primarySymbol}`);
          this.scheduleNext(monitor, interval);
          return;
        }

        // 2. Evaluate filters (sessions, time, etc)
        const filtersPassed = await this.filterEvaluator.evaluate(
          strategy.filters,
          { symbol: primarySymbol }
        );

        if (!filtersPassed) {
          logger.debug(`[StrategyMonitor] Filters not passed for ${strategy.name}`);
          this.scheduleNext(monitor, interval);
          return;
        }

        // 3. Check signal cooldown (prevent rapid-fire trading)
        const SIGNAL_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes minimum between signals
        const timeSinceLastSignal = monitor.lastSignalTime 
          ? Date.now() - monitor.lastSignalTime.getTime()
          : SIGNAL_COOLDOWN_MS + 1;
        
        if (timeSinceLastSignal < SIGNAL_COOLDOWN_MS) {
          const remainingCooldown = Math.ceil((SIGNAL_COOLDOWN_MS - timeSinceLastSignal) / 1000 / 60);
          logger.debug(`[StrategyMonitor] Signal cooldown active for ${strategy.name} (${remainingCooldown} minutes remaining)`);
          this.scheduleNext(monitor, interval);
          return;
        }

        // 4. Check if already has open position (prevent duplicates)
        if (monitor.hasOpenPosition) {
          logger.debug(`[StrategyMonitor] Position already open for ${strategy.name}, skipping entry signal`);
          this.scheduleNext(monitor, interval);
          return;
        }

        // 5. Evaluate entry conditions
        const entrySignal = await this.evaluateEntryConditions(strategy, marketData);

        if (entrySignal) {
          // 6. Validate safety before generating signal
          const safetyCheck = await this.safetyValidator.validateBeforeTrade(entrySignal);

          if (safetyCheck.canTrade) {
            // 7. Calculate position size
            const lotSize = await this.calculatePositionSize(strategy, entrySignal);
            entrySignal.volume = lotSize;

            // 8. Emit signal for execution
            monitor.signalCount++;
            monitor.lastSignalTime = new Date(); // Update last signal time
            monitor.hasOpenPosition = true; // Mark as having open position
            
            this.emit('signal:generated', {
              strategyId: strategy.id,
              signal: entrySignal,
            });

            logger.info(`[StrategyMonitor] ✅ Signal generated for ${strategy.name}: ${entrySignal.action} ${entrySignal.symbol} @ ${lotSize} lots`);
          } else {
            logger.warn(`[StrategyMonitor] ⚠️ Safety check failed: ${safetyCheck.failedChecks.map(c => c.reason).join(', ')}`);
          }
        }

        // 7. Check exit conditions for open positions
        await this.checkExitConditions(strategy);

        // Reset error count on success
        monitor.errorCount = 0;

      } catch (error) {
        monitor.errorCount++;
        logger.error(`[StrategyMonitor] Error in monitoring loop for ${strategy.name}:`, error);

        // Stop monitoring if too many errors
        if (monitor.errorCount > 10) {
          (logger as any).critical(`[StrategyMonitor] Too many errors, stopping monitor for ${strategy.name}`);
          await this.stopMonitoring(strategy.id);
          this.emit('monitor:error', { strategyId: strategy.id, error });
          return;
        }
      }

      // Schedule next check
      this.scheduleNext(monitor, interval);
    };

    // Start the loop
    await executeLoop();
  }

  /**
   * Schedule next monitoring check
   */
  private scheduleNext(monitor: MonitorThread, interval: number): void {
    if (monitor.isActive) {
      monitor.interval = setTimeout(async () => {
        await this.runMonitoringLoop(monitor);
      }, interval);
    }
  }

  /**
   * Evaluate entry conditions
   */
  private async evaluateEntryConditions(
    strategy: Strategy,
    marketData: any[]
  ): Promise<Signal | null> {
    try {
      const conditions = strategy.entryConditions || [];
      const logic = strategy.entryLogic || 'AND';

      // Evaluate all conditions
      const results = await Promise.all(
        conditions.map(condition =>
          this.conditionEvaluator.evaluate(condition, marketData)
        )
      );

      // Check if conditions met based on logic
      const conditionsMet = logic === 'AND'
        ? results.every(r => r === true)
        : results.some(r => r === true);

      if (!conditionsMet) {
        return null;
      }

      // Determine direction (BUY or SELL)
      const direction = this.determineDirection(strategy, results);

      // Create signal
      const primarySymbol = getPrimarySymbol(strategy);
      const lastBar = marketData[marketData.length - 1];
      
      const signal: Signal = {
        id: this.generateSignalId(),
        strategyId: strategy.id,
        symbol: primarySymbol,
        type: direction === 'BUY' ? 'BUY' : 'SELL',
        action: direction === 'BUY' ? 'BUY' : 'SELL',
        timeframe: strategy.timeframe,
        entryPrice: lastBar.close,
        stopLoss: 0, // Will be calculated below
        takeProfit: 0, // Will be calculated below
        volume: strategy.positionSize || 0.01,
        confidence: 80, // Default confidence
        reasons: [`Entry conditions met (${logic})`],
        conditionsMet: conditions.map(c => `${c.indicator}`),
        timestamp: new Date(),
      };

      // Add stop loss and take profit
      if (strategy.stopLoss) {
        signal.stopLoss = this.calculateStopLoss(strategy, marketData[marketData.length - 1]);
      }

      if (strategy.takeProfit) {
        signal.takeProfit = this.calculateTakeProfit(strategy, marketData[marketData.length - 1]);
      }

      return signal;

    } catch (error) {
      logger.error('[StrategyMonitor] Error evaluating entry conditions:', error);
      return null;
    }
  }

  /**
   * Check exit conditions for open positions
   */
  private async checkExitConditions(strategy: Strategy): Promise<void> {
    // This will be handled by the trade management service
    // Emit event to check exits
    this.emit('check:exits', { strategyId: strategy.id });
  }

  /**
   * Calculate position size based on risk management
   */
  private async calculatePositionSize(strategy: Strategy, signal: Signal): Promise<number> {
    try {
      return await this.positionSizingService.calculate(strategy, signal);
    } catch (error) {
      logger.error('[StrategyMonitor] Error calculating position size:', error);
      return 0.01; // Default minimum lot size
    }
  }

  /**
   * Determine trade direction from condition results
   */
  private determineDirection(strategy: Strategy, results: any[]): 'BUY' | 'SELL' {
    // Simple logic: if RSI < 30 or MACD bullish crossover -> BUY
    // if RSI > 70 or MACD bearish crossover -> SELL
    
    const firstCondition = strategy.entryConditions?.[0];
    if (!firstCondition) return 'BUY';

    // Check indicator values
    const values = results[0]?.values || {};
    
    if (values.rsi) {
      return values.rsi < 50 ? 'BUY' : 'SELL';
    }

    if (values.macdHistogram) {
      return values.macdHistogram > 0 ? 'BUY' : 'SELL';
    }

    return 'BUY'; // Default
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(results: any[]): number {
    if (results.length === 0) return 0;
    
    const metCount = results.filter(r => r.met).length;
    return (metCount / results.length) * 100;
  }

  /**
   * Calculate stop loss price
   */
  private calculateStopLoss(strategy: Strategy, currentCandle: any): number {
    const config = strategy.stopLoss;
    if (!config) return 0;

    const currentPrice = currentCandle.close;

    switch (config.type) {
      case 'fixed':
        return currentPrice - (config.value || 50) * 0.0001;
      
      case 'percent':
        return currentPrice * (1 - (config.value || 1) / 100);
      
      case 'atr':
        // Will be implemented with ATR indicator
        return currentPrice - (config.value || 1.5) * 0.001;
      
      default:
        return currentPrice - 50 * 0.0001;
    }
  }

  /**
   * Calculate take profit price
   */
  private calculateTakeProfit(strategy: Strategy, currentCandle: any): number {
    const config = strategy.takeProfit;
    if (!config) return 0;

    const currentPrice = currentCandle.close;

    switch (config.type) {
      case 'fixed':
        return currentPrice + (config.value || 100) * 0.0001;
      
      case 'percent':
        return currentPrice * (1 + (config.value || 2) / 100);
      
      case 'ratio':
        const sl = this.calculateStopLoss(strategy, currentCandle);
        const risk = Math.abs(currentPrice - sl);
        return currentPrice + risk * (config.ratio || 2);
      
      default:
        return currentPrice + 100 * 0.0001;
    }
  }

  /**
   * Get check interval based on timeframe
   */
  private getCheckInterval(timeframe: string): number {
    const intervals: Record<string, number> = {
      'M1': 1000,        // 1 second
      'M5': 5000,        // 5 seconds
      'M15': 15000,      // 15 seconds
      'M30': 30000,      // 30 seconds
      'H1': 60000,       // 1 minute
      'H4': 240000,      // 4 minutes
      'D1': 300000,      // 5 minutes
    };

    return intervals[timeframe] || 60000;
  }

  /**
   * Helper methods
   */
  private generateSignalId(): string {
    return `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getAccountBalance(): Promise<number> {
    // Will be implemented with MT5 account service
    return 10000;
  }

  private calculatePips(signal: Signal): number {
    // Simple pip calculation
    return signal.stopLoss ? Math.abs(signal.stopLoss) * 10000 : 50;
  }
}
