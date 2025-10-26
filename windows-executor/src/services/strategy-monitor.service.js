/**
 * Strategy Monitor Service
 * Continuous monitoring and signal generation for active strategies
 * This is where REAL signal generation happens (not on Web Platform)
 */
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { getPrimarySymbol } from '../utils/strategy-helpers';
export class StrategyMonitor extends EventEmitter {
    constructor(indicatorService, marketDataService, conditionEvaluator, filterEvaluator, positionSizingService, safetyValidator) {
        super();
        Object.defineProperty(this, "indicatorService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: indicatorService
        });
        Object.defineProperty(this, "marketDataService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: marketDataService
        });
        Object.defineProperty(this, "conditionEvaluator", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: conditionEvaluator
        });
        Object.defineProperty(this, "filterEvaluator", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: filterEvaluator
        });
        Object.defineProperty(this, "positionSizingService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: positionSizingService
        });
        Object.defineProperty(this, "safetyValidator", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: safetyValidator
        });
        Object.defineProperty(this, "activeMonitors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    /**
     * Start monitoring a strategy
     */
    async startMonitoring(strategy) {
        if (this.activeMonitors.has(strategy.id)) {
            logger.warn(`[StrategyMonitor] Strategy ${strategy.id} already being monitored`);
            return;
        }
        logger.info(`[StrategyMonitor] Starting monitoring for strategy: ${strategy.name}`);
        const monitor = {
            strategyId: strategy.id,
            strategy,
            isActive: true,
            interval: null,
            lastCheck: new Date(),
            signalCount: 0,
            errorCount: 0,
        };
        this.activeMonitors.set(strategy.id, monitor);
        // Start the monitoring loop
        await this.runMonitoringLoop(monitor);
    }
    /**
     * Stop monitoring a strategy
     */
    async stopMonitoring(strategyId) {
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
    async stopAll() {
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
    getStatus(strategyId) {
        return this.activeMonitors.get(strategyId) || null;
    }
    /**
     * Get all active monitors
     */
    getAllActive() {
        return Array.from(this.activeMonitors.values());
    }
    /**
     * Main monitoring loop - THIS IS THE CRITICAL CONTINUOUS MONITORING
     */
    async runMonitoringLoop(monitor) {
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
                const marketData = await this.marketDataService.getLatestData(primarySymbol, strategy.timeframe, 100 // Get last 100 candles
                );
                if (!marketData || marketData.length === 0) {
                    logger.warn(`[StrategyMonitor] No market data for ${primarySymbol}`);
                    this.scheduleNext(monitor, interval);
                    return;
                }
                // 2. Evaluate filters (sessions, time, etc)
                const filtersPassed = await this.filterEvaluator.evaluate(strategy.filters, { symbol: primarySymbol });
                if (!filtersPassed) {
                    logger.debug(`[StrategyMonitor] Filters not passed for ${strategy.name}`);
                    this.scheduleNext(monitor, interval);
                    return;
                }
                // 3. Evaluate entry conditions
                const entrySignal = await this.evaluateEntryConditions(strategy, marketData);
                if (entrySignal) {
                    // 4. Validate safety before generating signal
                    const safetyCheck = await this.safetyValidator.validateBeforeTrade(entrySignal);
                    if (safetyCheck.canTrade) {
                        // 5. Calculate position size
                        const lotSize = await this.calculatePositionSize(strategy, entrySignal);
                        entrySignal.volume = lotSize;
                        // 6. Emit signal for execution
                        monitor.signalCount++;
                        this.emit('signal:generated', {
                            strategyId: strategy.id,
                            signal: entrySignal,
                        });
                        logger.info(`[StrategyMonitor] Signal generated for ${strategy.name}: ${entrySignal.action} ${entrySignal.symbol}`);
                    }
                    else {
                        logger.warn(`[StrategyMonitor] Safety check failed: ${safetyCheck.failedChecks.map(c => c.reason).join(', ')}`);
                    }
                }
                // 7. Check exit conditions for open positions
                await this.checkExitConditions(strategy);
                // Reset error count on success
                monitor.errorCount = 0;
            }
            catch (error) {
                monitor.errorCount++;
                logger.error(`[StrategyMonitor] Error in monitoring loop for ${strategy.name}:`, error);
                // Stop monitoring if too many errors
                if (monitor.errorCount > 10) {
                    logger.critical(`[StrategyMonitor] Too many errors, stopping monitor for ${strategy.name}`);
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
    scheduleNext(monitor, interval) {
        if (monitor.isActive) {
            monitor.interval = setTimeout(async () => {
                await this.runMonitoringLoop(monitor);
            }, interval);
        }
    }
    /**
     * Evaluate entry conditions
     */
    async evaluateEntryConditions(strategy, marketData) {
        try {
            const conditions = strategy.entryConditions || [];
            const logic = strategy.entryLogic || 'AND';
            // Evaluate all conditions
            const results = await Promise.all(conditions.map(condition => this.conditionEvaluator.evaluate(condition, marketData)));
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
            const signal = {
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
        }
        catch (error) {
            logger.error('[StrategyMonitor] Error evaluating entry conditions:', error);
            return null;
        }
    }
    /**
     * Check exit conditions for open positions
     */
    async checkExitConditions(strategy) {
        // This will be handled by the trade management service
        // Emit event to check exits
        this.emit('check:exits', { strategyId: strategy.id });
    }
    /**
     * Calculate position size based on risk management
     */
    async calculatePositionSize(strategy, signal) {
        try {
            return await this.positionSizingService.calculate(strategy, signal);
        }
        catch (error) {
            logger.error('[StrategyMonitor] Error calculating position size:', error);
            return 0.01; // Default minimum lot size
        }
    }
    /**
     * Determine trade direction from condition results
     */
    determineDirection(strategy, results) {
        // Simple logic: if RSI < 30 or MACD bullish crossover -> BUY
        // if RSI > 70 or MACD bearish crossover -> SELL
        const firstCondition = strategy.entryConditions?.[0];
        if (!firstCondition)
            return 'BUY';
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
    calculateConfidence(results) {
        if (results.length === 0)
            return 0;
        const metCount = results.filter(r => r.met).length;
        return (metCount / results.length) * 100;
    }
    /**
     * Calculate stop loss price
     */
    calculateStopLoss(strategy, currentCandle) {
        const config = strategy.stopLoss;
        if (!config)
            return 0;
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
    calculateTakeProfit(strategy, currentCandle) {
        const config = strategy.takeProfit;
        if (!config)
            return 0;
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
    getCheckInterval(timeframe) {
        const intervals = {
            'M1': 1000, // 1 second
            'M5': 5000, // 5 seconds
            'M15': 15000, // 15 seconds
            'M30': 30000, // 30 seconds
            'H1': 60000, // 1 minute
            'H4': 240000, // 4 minutes
            'D1': 300000, // 5 minutes
        };
        return intervals[timeframe] || 60000;
    }
    /**
     * Helper methods
     */
    generateSignalId() {
        return `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    async getAccountBalance() {
        // Will be implemented with MT5 account service
        return 10000;
    }
    calculatePips(signal) {
        // Simple pip calculation
        return signal.stopLoss ? Math.abs(signal.stopLoss) * 10000 : 50;
    }
}
