"use strict";
/**
 * Smart Exit Service
 * Implements intelligent exit strategies including partial exits
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartExitService = void 0;
const indicator_service_1 = require("./indicator.service");
class SmartExitService {
    constructor() {
        this.indicatorService = new indicator_service_1.IndicatorService();
    }
    /**
     * Calculate smart exit recommendations
     */
    async calculateSmartExit(config, context) {
        if (!config.enabled) {
            return {
                shouldExit: false,
                reason: 'Smart exits disabled'
            };
        }
        const { position, bars } = context;
        let shouldExit = false;
        let newStopLoss;
        let reason = '';
        // Check time-based exit
        if (config.stopLoss.maxHoldingHours) {
            const hoursHeld = (Date.now() - position.openedAt.getTime()) / (1000 * 60 * 60);
            if (hoursHeld > config.stopLoss.maxHoldingHours) {
                shouldExit = true;
                reason = `Position held for ${hoursHeld.toFixed(1)} hours (max: ${config.stopLoss.maxHoldingHours})`;
            }
        }
        // Calculate ATR-based stop loss
        if (config.stopLoss.type === 'atr' && config.stopLoss.atrMultiplier) {
            const atrValues = this.indicatorService.calculateATR(bars, 14);
            if (atrValues.length > 0) {
                const atr = atrValues[atrValues.length - 1];
                const currentPrice = position.currentPrice;
                if (position.type === 'BUY') {
                    newStopLoss = currentPrice - (atr * config.stopLoss.atrMultiplier);
                }
                else {
                    newStopLoss = currentPrice + (atr * config.stopLoss.atrMultiplier);
                }
            }
        }
        // Check swing point-based stop loss
        if (config.stopLoss.useSwingPoints && config.stopLoss.swingLookback) {
            const swingLevel = this.findSwingPoint(bars, config.stopLoss.swingLookback, position.type);
            if (swingLevel) {
                newStopLoss = swingLevel;
                reason = 'Adjusted to swing point';
            }
        }
        return {
            shouldExit,
            newStopLoss,
            reason
        };
    }
    /**
     * Calculate partial exit recommendations
     */
    async calculatePartialExits(config, context) {
        if (!config.enabled) {
            return {
                shouldExit: false,
                recommendedExits: [],
                analysis: {
                    currentProfit: 0,
                    currentProfitPercentage: 0,
                    unrealizedProfit: 0,
                    riskExposure: 0
                },
                warnings: [],
                recommendations: []
            };
        }
        const { position, bars, currentRegime, currentSession } = context;
        const recommendedExits = [];
        const warnings = [];
        const recommendations = [];
        // Calculate current profit
        const currentProfit = position.profit;
        const currentProfitPips = Math.abs(position.currentPrice - position.openPrice) * 10000;
        const currentProfitPercentage = (currentProfit / (position.openPrice * position.volume)) * 100;
        // Calculate risk exposure
        const riskExposure = Math.abs(position.currentPrice - position.stopLoss) * position.volume * 10000;
        // Check each exit level
        for (const level of config.levels) {
            if (!level.isActive)
                continue;
            // Check conditions
            if (level.conditions) {
                if (!this.checkExitConditions(level.conditions, currentRegime, currentSession)) {
                    continue;
                }
            }
            // Check trigger
            let shouldTrigger = false;
            let triggerPrice = position.currentPrice;
            switch (level.triggerType) {
                case 'pips':
                    if (currentProfitPips >= level.triggerValue) {
                        shouldTrigger = true;
                    }
                    break;
                case 'rr':
                    const rrRatio = currentProfitPips / Math.abs(position.openPrice - position.stopLoss);
                    if (rrRatio >= level.triggerValue) {
                        shouldTrigger = true;
                    }
                    break;
                case 'atr':
                    const atrValues = this.indicatorService.calculateATR(bars, 14);
                    if (atrValues.length > 0) {
                        const atr = atrValues[atrValues.length - 1];
                        const atrDistance = Math.abs(position.currentPrice - position.openPrice);
                        if (atrDistance >= atr * level.triggerValue) {
                            shouldTrigger = true;
                        }
                    }
                    break;
                case 'swing':
                    const swingLevel = this.findSwingPoint(bars, 20, position.type);
                    if (swingLevel) {
                        const reachedSwing = position.type === 'BUY'
                            ? position.currentPrice >= swingLevel
                            : position.currentPrice <= swingLevel;
                        if (reachedSwing) {
                            shouldTrigger = true;
                            triggerPrice = swingLevel;
                        }
                    }
                    break;
                case 'time':
                    const minutesHeld = (Date.now() - position.openedAt.getTime()) / (1000 * 60);
                    if (minutesHeld >= level.triggerValue) {
                        shouldTrigger = true;
                    }
                    break;
            }
            if (shouldTrigger) {
                const exitQuantity = (position.volume * level.percentage) / 100;
                recommendedExits.push({
                    levelId: level.id,
                    levelName: level.name,
                    percentage: level.percentage,
                    quantity: exitQuantity,
                    price: triggerPrice,
                    reason: `${level.triggerType} trigger met at ${level.triggerValue}`,
                    confidence: 0.8,
                    urgency: currentProfitPercentage > 5 ? 'high' : 'medium'
                });
            }
        }
        // Check max total exit
        const totalExitPercentage = recommendedExits.reduce((sum, exit) => sum + exit.percentage, 0);
        if (totalExitPercentage > config.maxTotalExit) {
            warnings.push(`Total exit percentage (${totalExitPercentage}%) exceeds maximum (${config.maxTotalExit}%)`);
            // Adjust exits proportionally
            const adjustmentFactor = config.maxTotalExit / totalExitPercentage;
            recommendedExits.forEach(exit => {
                exit.percentage *= adjustmentFactor;
                exit.quantity *= adjustmentFactor;
            });
        }
        // Check minimum remaining
        const remainingPercentage = 100 - totalExitPercentage;
        if (remainingPercentage < config.minRemaining) {
            warnings.push(`Remaining position (${remainingPercentage}%) below minimum (${config.minRemaining}%)`);
        }
        // Add recommendations
        if (currentProfitPercentage > 3 && recommendedExits.length === 0) {
            recommendations.push('Consider taking partial profits at current levels');
        }
        if (currentProfitPercentage < -2) {
            recommendations.push('Consider closing position to limit losses');
        }
        return {
            shouldExit: recommendedExits.length > 0,
            recommendedExits,
            analysis: {
                currentProfit,
                currentProfitPercentage,
                unrealizedProfit: currentProfit,
                riskExposure
            },
            warnings,
            recommendations
        };
    }
    /**
     * Find swing point for support/resistance
     */
    findSwingPoint(bars, lookback, positionType) {
        if (bars.length < lookback) {
            return null;
        }
        const recentBars = bars.slice(-lookback);
        if (positionType === 'BUY') {
            // Find resistance (highest high)
            const highest = Math.max(...recentBars.map(b => b.high));
            return highest;
        }
        else {
            // Find support (lowest low)
            const lowest = Math.min(...recentBars.map(b => b.low));
            return lowest;
        }
    }
    /**
     * Check if exit conditions are met
     */
    checkExitConditions(conditions, currentRegime, currentSession) {
        // Check regime condition
        if (conditions.regime && currentRegime) {
            if (!conditions.regime.includes(currentRegime)) {
                return false;
            }
        }
        // Check session condition
        if (conditions.session && currentSession) {
            if (!conditions.session.includes(currentSession)) {
                return false;
            }
        }
        // Check time of day
        if (conditions.timeOfDay) {
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            if (currentTime < conditions.timeOfDay.start || currentTime > conditions.timeOfDay.end) {
                return false;
            }
        }
        return true;
    }
    /**
     * Calculate trailing stop adjustment after partial exits
     */
    calculateTrailingAfterExit(position, exitPercentage, config) {
        if (!config.trailingAfterExits?.enabled) {
            return null;
        }
        const { distance, adjustPerExit } = config.trailingAfterExits;
        let trailingDistance = distance;
        if (adjustPerExit) {
            // Tighten trailing stop based on exit percentage
            const tightenFactor = 1 - (exitPercentage / 200); // Reduce by half of exit %
            trailingDistance *= tightenFactor;
        }
        const pipDistance = trailingDistance / 10000;
        if (position.type === 'BUY') {
            return position.currentPrice - pipDistance;
        }
        else {
            return position.currentPrice + pipDistance;
        }
    }
    /**
     * Lock in profit by moving stop loss to breakeven
     */
    shouldLockInProfit(position, exitPercentage, config) {
        if (!config.lockInProfit) {
            return { shouldLock: false };
        }
        // Lock in profit if we've exited at least 25%
        if (exitPercentage >= 25) {
            return {
                shouldLock: true,
                newStopLoss: position.openPrice
            };
        }
        return { shouldLock: false };
    }
}
exports.SmartExitService = SmartExitService;
