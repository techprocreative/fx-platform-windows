"use strict";
/**
 * Position Sizing Service
 * Calculates position sizes based on various risk management methods
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PositionSizingService = void 0;
const logger_1 = require("../utils/logger");
const indicator_service_1 = require("./indicator.service");
class PositionSizingService {
    constructor() {
        this.indicatorService = new indicator_service_1.IndicatorService();
    }
    /**
     * Calculate position size (simple interface for strategy-monitor)
     */
    async calculate(strategy, signal, accountInfo) {
        const config = strategy.positionSizing || {
            method: 'percentage_risk',
            riskPercentage: 2,
            minPositionSize: 0.01,
            maxPositionSize: 1.0,
        };
        const account = accountInfo || {
            balance: 10000,
            equity: 10000,
            currency: 'USD',
        };
        const priceInfo = {
            symbol: signal.symbol,
            currentPrice: signal.entryPrice,
            stopLoss: signal.stopLoss,
            bars: [], // Would need actual bars for ATR calculation
        };
        const result = await this.calculatePositionSize(config, account, priceInfo);
        return result.recommendedSize;
    }
    /**
     * Calculate position size based on configuration (detailed interface)
     */
    async calculatePositionSize(config, accountInfo, priceInfo) {
        try {
            const stopLossDistance = Math.abs(priceInfo.currentPrice - priceInfo.stopLoss);
            let recommendedSize = 0.01;
            const reasoning = [];
            const adjustments = [];
            switch (config.method) {
                case 'fixed_lot':
                    recommendedSize = config.fixedLot || 0.01;
                    reasoning.push(`Using fixed lot size: ${recommendedSize}`);
                    break;
                case 'percentage_risk':
                    recommendedSize = this.calculatePercentageRisk(config.riskPercentage || 1, accountInfo.balance, stopLossDistance, priceInfo);
                    reasoning.push(`Risk ${config.riskPercentage}% of account balance`);
                    reasoning.push(`Account balance: $${accountInfo.balance}`);
                    reasoning.push(`Stop loss distance: ${stopLossDistance.toFixed(5)}`);
                    break;
                case 'atr_based':
                    if (config.atrBased) {
                        recommendedSize = await this.calculateATRBased(config.atrBased, accountInfo, priceInfo);
                        reasoning.push(`ATR-based position sizing`);
                        reasoning.push(`ATR multiplier: ${config.atrBased.atrMultiplier}x`);
                        reasoning.push(`Risk percentage: ${config.atrBased.riskPercentage}%`);
                    }
                    break;
                case 'volatility_based':
                    if (config.volatilityBased) {
                        recommendedSize = await this.calculateVolatilityBased(config.volatilityBased, priceInfo);
                        reasoning.push(`Volatility-based position sizing`);
                        reasoning.push(`Base size: ${config.volatilityBased.baseSize}`);
                    }
                    break;
                case 'kelly_criterion':
                    if (config.kellyCriterion) {
                        recommendedSize = this.calculateKellyCriterion(config.kellyCriterion);
                        reasoning.push(`Kelly Criterion position sizing`);
                        reasoning.push(`Win rate: ${config.kellyCriterion.winRate * 100}%`);
                        reasoning.push(`Kelly fraction: ${config.kellyCriterion.kellyFraction}`);
                    }
                    break;
                case 'account_equity':
                    recommendedSize = this.calculateEquityBased(accountInfo.equity, config.riskPercentage || 1, stopLossDistance);
                    reasoning.push(`Equity-based position sizing`);
                    reasoning.push(`Account equity: $${accountInfo.equity}`);
                    break;
                default:
                    logger_1.logger.warn(`Unknown sizing method: ${config.method}`);
                    recommendedSize = 0.01;
                    reasoning.push('Fallback to minimum lot size');
            }
            // Apply constraints
            const constraints = {
                min: config.minPositionSize || 0.01,
                max: config.maxPositionSize || 10,
                applied: false
            };
            if (recommendedSize < constraints.min) {
                adjustments.push(`Adjusted from ${recommendedSize.toFixed(2)} to minimum ${constraints.min}`);
                recommendedSize = constraints.min;
                constraints.applied = true;
            }
            if (recommendedSize > constraints.max) {
                adjustments.push(`Adjusted from ${recommendedSize.toFixed(2)} to maximum ${constraints.max}`);
                recommendedSize = constraints.max;
                constraints.applied = true;
            }
            // Round to 2 decimal places
            recommendedSize = Math.round(recommendedSize * 100) / 100;
            const riskAmount = this.calculateRiskAmount(recommendedSize, stopLossDistance, priceInfo);
            const riskPercentage = (riskAmount / accountInfo.balance) * 100;
            return {
                recommendedSize,
                method: config.method,
                riskAmount,
                riskPercentage,
                stopLossDistance,
                reasoning,
                adjustments,
                constraints
            };
        }
        catch (error) {
            logger_1.logger.error('[PositionSizingService] Error calculating position size:', error);
            throw error;
        }
    }
    /**
     * Calculate percentage risk position size
     */
    calculatePercentageRisk(riskPercentage, accountBalance, stopLossDistance, priceInfo) {
        const riskAmount = accountBalance * (riskPercentage / 100);
        // For forex: risk amount / (stop loss pips * pip value * lot size)
        // Simplified: risk amount / stop loss distance
        const pipValue = this.calculatePipValue(priceInfo.symbol);
        const stopLossPips = stopLossDistance * 10000; // Convert to pips
        const lotSize = riskAmount / (stopLossPips * pipValue);
        return Math.max(0.01, lotSize);
    }
    /**
     * Calculate ATR-based position size
     */
    async calculateATRBased(config, accountInfo, priceInfo) {
        const atrValues = this.indicatorService.calculateATR(priceInfo.bars, 14);
        if (atrValues.length === 0) {
            logger_1.logger.warn('[PositionSizingService] No ATR values available');
            return 0.01;
        }
        let atr = atrValues[atrValues.length - 1];
        // Apply ATR constraints
        if (config.minATR && atr < config.minATR) {
            atr = config.minATR;
        }
        if (config.maxATR && atr > config.maxATR) {
            atr = config.maxATR;
        }
        const stopLossDistance = atr * config.atrMultiplier;
        const riskAmount = accountInfo.balance * (config.riskPercentage / 100);
        const pipValue = this.calculatePipValue(priceInfo.symbol);
        const stopLossPips = stopLossDistance * 10000;
        let lotSize = riskAmount / (stopLossPips * pipValue);
        // Volatility adjustment
        if (config.volatilityAdjustment) {
            const avgATR = atrValues.reduce((a, b) => a + b, 0) / atrValues.length;
            const volatilityRatio = atr / avgATR;
            if (volatilityRatio > 1.5) {
                lotSize *= 0.7; // Reduce size in high volatility
            }
            else if (volatilityRatio < 0.7) {
                lotSize *= 1.2; // Increase size in low volatility
            }
        }
        return Math.max(0.01, lotSize);
    }
    /**
     * Calculate volatility-based position size
     */
    async calculateVolatilityBased(config, priceInfo) {
        const atrValues = this.indicatorService.calculateATR(priceInfo.bars, config.lookbackPeriod);
        if (atrValues.length === 0) {
            return config.baseSize;
        }
        const currentATR = atrValues[atrValues.length - 1];
        const avgATR = atrValues.reduce((a, b) => a + b, 0) / atrValues.length;
        const volatilityRatio = currentATR / avgATR;
        const adjustedSize = config.baseSize / (volatilityRatio * config.volatilityFactor);
        return Math.max(0.01, adjustedSize);
    }
    /**
     * Calculate Kelly Criterion position size
     */
    calculateKellyCriterion(config) {
        const { winRate, avgWin, avgLoss, kellyFraction, maxPositionSize } = config;
        // Kelly Formula: f = (p * b - q) / b
        // where p = win rate, q = 1 - p, b = avg win / avg loss
        const p = winRate;
        const q = 1 - winRate;
        const b = avgWin / avgLoss;
        const kellyPercentage = (p * b - q) / b;
        // Apply Kelly fraction (typically 0.25-0.5 for safety)
        let positionSize = kellyPercentage * kellyFraction;
        // Apply max constraint
        positionSize = Math.min(positionSize, maxPositionSize);
        // Convert to lot size (assuming base of 1.0 lot)
        return Math.max(0.01, positionSize);
    }
    /**
     * Calculate equity-based position size
     */
    calculateEquityBased(equity, riskPercentage, stopLossDistance) {
        const riskAmount = equity * (riskPercentage / 100);
        const lotSize = riskAmount / (stopLossDistance * 100000); // Simplified calculation
        return Math.max(0.01, lotSize);
    }
    /**
     * Calculate pip value for a symbol
     */
    calculatePipValue(symbol) {
        // Simplified pip value calculation
        // In real implementation, should use actual contract size and exchange rates
        if (symbol.includes('JPY')) {
            return 0.01; // JPY pairs have different pip value
        }
        return 10; // Standard pip value for most pairs with 0.01 lot
    }
    /**
     * Calculate risk amount based on position size
     */
    calculateRiskAmount(lotSize, stopLossDistance, priceInfo) {
        const pipValue = this.calculatePipValue(priceInfo.symbol);
        const stopLossPips = stopLossDistance * 10000;
        return lotSize * stopLossPips * pipValue;
    }
    /**
     * Adjust position size based on current drawdown
     */
    adjustForDrawdown(baseSize, currentDrawdown, maxDrawdown) {
        if (currentDrawdown <= 0) {
            return baseSize;
        }
        const drawdownRatio = currentDrawdown / maxDrawdown;
        if (drawdownRatio > 0.8) {
            return baseSize * 0.5; // Reduce to 50%
        }
        else if (drawdownRatio > 0.5) {
            return baseSize * 0.75; // Reduce to 75%
        }
        return baseSize;
    }
    /**
     * Adjust position size based on recent performance
     */
    adjustForPerformance(baseSize, recentWins, recentLosses) {
        const totalTrades = recentWins + recentLosses;
        if (totalTrades === 0) {
            return baseSize;
        }
        const winRate = recentWins / totalTrades;
        if (winRate > 0.7) {
            return baseSize * 1.2; // Increase by 20%
        }
        else if (winRate < 0.3) {
            return baseSize * 0.7; // Decrease by 30%
        }
        return baseSize;
    }
}
exports.PositionSizingService = PositionSizingService;
