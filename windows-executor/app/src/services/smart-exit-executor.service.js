"use strict";
/**
 * Smart Exit Executor Service
 * Manages intelligent exit strategies including:
 * - Partial exits
 * - Trailing stops
 * - Time-based exits
 * - Support/resistance exits
 * - Breakeven moves
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartExitExecutor = void 0;
const events_1 = require("events");
const logger_1 = require("../utils/logger");
class SmartExitExecutor extends events_1.EventEmitter {
    constructor() {
        super();
        this.positionStates = new Map();
        logger_1.logger.info('[SmartExitExecutor] Service initialized');
    }
    /**
     * Manage exits for a position
     */
    async manageExits(position, config, currentMarketData) {
        try {
            // Initialize state if not exists
            if (!this.positionStates.has(position.ticket)) {
                this.positionStates.set(position.ticket, {
                    maxProfit: position.profit || 0,
                    partialExitsExecuted: [],
                    breakevenMoved: false,
                });
            }
            const state = this.positionStates.get(position.ticket);
            // Update max profit
            if (position.profit && position.profit > state.maxProfit) {
                state.maxProfit = position.profit;
            }
            // 1. Check partial exits
            if (config.partialExits && config.partialExits.length > 0) {
                await this.handlePartialExits(position, config.partialExits, state);
            }
            // 2. Check breakeven move
            if (config.breakeven?.enabled && !state.breakevenMoved) {
                await this.checkBreakeven(position, config.breakeven, state);
            }
            // 3. Update trailing stop
            if (config.trailingStop?.enabled) {
                await this.updateTrailingStop(position, config.trailingStop, state);
            }
            // 4. Check time-based exit
            if (config.timeBasedExit?.enabled) {
                await this.checkTimeBasedExit(position, config.timeBasedExit);
            }
        }
        catch (error) {
            logger_1.logger.error('[SmartExitExecutor] Error managing exits:', error);
        }
    }
    /**
     * Handle partial exits
     */
    async handlePartialExits(position, partialExits, state) {
        // Sort by priority
        const sortedExits = [...partialExits].sort((a, b) => a.priority - b.priority);
        for (const exit of sortedExits) {
            // Skip if already executed
            if (state.partialExitsExecuted.includes(exit.id)) {
                continue;
            }
            // Check if should execute
            const shouldExecute = this.shouldExecutePartialExit(position, exit);
            if (shouldExecute) {
                await this.executePartialExit(position, exit, state);
            }
        }
    }
    /**
     * Check if should execute partial exit
     */
    shouldExecutePartialExit(position, exit) {
        if (!position.currentPrice || !position.openPrice) {
            return false;
        }
        const pips = this.calculatePips(position.openPrice, position.currentPrice, position.type);
        switch (exit.triggerType) {
            case 'pips':
                return pips >= exit.triggerValue;
            case 'rr':
                // Risk:Reward ratio
                const stopLossPips = position.stopLoss
                    ? this.calculatePips(position.openPrice, position.stopLoss, position.type === 'BUY' ? 'SELL' : 'BUY')
                    : 50;
                const rrRatio = pips / stopLossPips;
                return rrRatio >= exit.triggerValue;
            case 'price':
                if (position.type === 'BUY') {
                    return position.currentPrice >= exit.triggerValue;
                }
                else {
                    return position.currentPrice <= exit.triggerValue;
                }
            case 'time':
                const minutesOpen = (Date.now() - position.openTime.getTime()) / 1000 / 60;
                return minutesOpen >= exit.triggerValue;
            default:
                return false;
        }
    }
    /**
     * Execute partial exit
     */
    async executePartialExit(position, exit, state) {
        const closeVolume = position.volume * (exit.percentage / 100);
        logger_1.logger.info(`[SmartExitExecutor] Executing partial exit ${exit.name} for ${position.ticket}: ${closeVolume} lots`);
        // Emit event for execution
        this.emit('partial-exit', {
            ticket: position.ticket,
            exitName: exit.name,
            volume: closeVolume,
            percentage: exit.percentage,
            reason: `Partial exit ${exit.name} triggered`,
        });
        // Mark as executed
        state.partialExitsExecuted.push(exit.id);
        // Move to breakeven if configured
        if (exit.moveToBreakeven) {
            await this.moveToBreakeven(position, 0);
            state.breakevenMoved = true;
        }
    }
    /**
     * Check and move to breakeven
     */
    async checkBreakeven(position, config, state) {
        if (!position.currentPrice || !position.openPrice) {
            return;
        }
        const pips = this.calculatePips(position.openPrice, position.currentPrice, position.type);
        if (pips >= config.activationProfit) {
            const lockProfit = config.lockProfit || 0;
            await this.moveToBreakeven(position, lockProfit);
            state.breakevenMoved = true;
            logger_1.logger.info(`[SmartExitExecutor] Moved ${position.ticket} to breakeven + ${lockProfit} pips`);
        }
    }
    /**
     * Move stop loss to breakeven
     */
    async moveToBreakeven(position, lockProfit) {
        const pipValue = 0.0001; // Simplified
        let newStopLoss;
        if (position.type === 'BUY') {
            newStopLoss = position.openPrice + (lockProfit * pipValue);
        }
        else {
            newStopLoss = position.openPrice - (lockProfit * pipValue);
        }
        this.emit('modify-position', {
            ticket: position.ticket,
            stopLoss: newStopLoss,
            reason: `Breakeven + ${lockProfit} pips`,
        });
    }
    /**
     * Update trailing stop
     */
    async updateTrailingStop(position, config, state) {
        if (!position.currentPrice || !position.openPrice) {
            return;
        }
        const currentProfit = this.calculatePips(position.openPrice, position.currentPrice, position.type);
        // Check if should activate
        if (config.activationProfit && currentProfit < config.activationProfit) {
            return;
        }
        const pipValue = 0.0001; // Simplified
        let newStopLoss;
        if (position.type === 'BUY') {
            newStopLoss = position.currentPrice - (config.distance * pipValue);
            // Only move if better than current SL
            if (!position.stopLoss || newStopLoss > position.stopLoss) {
                this.emit('modify-position', {
                    ticket: position.ticket,
                    stopLoss: newStopLoss,
                    reason: `Trailing stop: ${config.distance} pips`,
                });
                state.trailingStopPrice = newStopLoss;
                logger_1.logger.debug(`[SmartExitExecutor] Trailing stop updated for ${position.ticket}: ${newStopLoss}`);
            }
        }
        else {
            newStopLoss = position.currentPrice + (config.distance * pipValue);
            // Only move if better than current SL
            if (!position.stopLoss || newStopLoss < position.stopLoss) {
                this.emit('modify-position', {
                    ticket: position.ticket,
                    stopLoss: newStopLoss,
                    reason: `Trailing stop: ${config.distance} pips`,
                });
                state.trailingStopPrice = newStopLoss;
                logger_1.logger.debug(`[SmartExitExecutor] Trailing stop updated for ${position.ticket}: ${newStopLoss}`);
            }
        }
    }
    /**
     * Check time-based exit
     */
    async checkTimeBasedExit(position, config) {
        const now = new Date();
        const minutesOpen = (now.getTime() - position.openTime.getTime()) / 1000 / 60;
        // Check max holding time
        if (config.maxHoldingMinutes && minutesOpen >= config.maxHoldingMinutes) {
            logger_1.logger.info(`[SmartExitExecutor] Time-based exit triggered for ${position.ticket}: ${minutesOpen} minutes`);
            this.emit('close-position', {
                ticket: position.ticket,
                reason: `Max holding time reached: ${config.maxHoldingMinutes} minutes`,
            });
            return;
        }
        if (config.maxHoldingHours && minutesOpen >= config.maxHoldingHours * 60) {
            logger_1.logger.info(`[SmartExitExecutor] Time-based exit triggered for ${position.ticket}: ${config.maxHoldingHours} hours`);
            this.emit('close-position', {
                ticket: position.ticket,
                reason: `Max holding time reached: ${config.maxHoldingHours} hours`,
            });
            return;
        }
        // Check specific time of day
        if (config.timeOfDay) {
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            if (currentHour === config.timeOfDay.hour && currentMinute >= config.timeOfDay.minute) {
                logger_1.logger.info(`[SmartExitExecutor] Time-of-day exit triggered for ${position.ticket}`);
                this.emit('close-position', {
                    ticket: position.ticket,
                    reason: `Scheduled exit at ${config.timeOfDay.hour}:${config.timeOfDay.minute}`,
                });
            }
        }
    }
    /**
     * Clean up position state
     */
    cleanupPosition(ticket) {
        this.positionStates.delete(ticket);
        logger_1.logger.debug(`[SmartExitExecutor] Cleaned up state for position ${ticket}`);
    }
    /**
     * Get position state
     */
    getPositionState(ticket) {
        return this.positionStates.get(ticket);
    }
    // ============ HELPER METHODS ============
    calculatePips(openPrice, currentPrice, type) {
        const pipValue = 0.0001; // Simplified for 4-digit pairs
        let pips;
        if (type === 'BUY') {
            pips = (currentPrice - openPrice) / pipValue;
        }
        else {
            pips = (openPrice - currentPrice) / pipValue;
        }
        return pips;
    }
}
exports.SmartExitExecutor = SmartExitExecutor;
