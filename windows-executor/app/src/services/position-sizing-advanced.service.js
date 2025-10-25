"use strict";
/**
 * Advanced Position Sizing Service
 * Implements multiple position sizing methods
 * - Fixed lot
 * - Percentage risk
 * - ATR-based
 * - Kelly Criterion
 * - Volatility-based
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvancedPositionSizingService = void 0;
const logger_1 = require("../utils/logger");
class AdvancedPositionSizingService {
    constructor() {
        this.DEFAULT_RISK_PERCENTAGE = 1; // 1%
        this.DEFAULT_ATR_MULTIPLIER = 1.5;
        this.KELLY_FRACTION = 0.25; // Use 25% of Kelly for safety
        this.DEFAULT_MAX_LOT = 10.0;
        this.DEFAULT_MIN_LOT = 0.01;
    }
    /**
     * Calculate position size based on method
     */
    async calculatePositionSize(params) {
        logger_1.logger.info(`[PositionSizing] Calculating position size using ${params.method}`);
        const warnings = [];
        let lotSize = 0;
        let riskAmount = 0;
        let confidence = 100;
        try {
            switch (params.method) {
                case 'fixed_lot':
                    const fixedResult = this.fixedLotSizing(params);
                    lotSize = fixedResult.lotSize;
                    riskAmount = fixedResult.riskAmount;
                    break;
                case 'percentage_risk':
                    const percentResult = this.percentageRiskSizing(params);
                    lotSize = percentResult.lotSize;
                    riskAmount = percentResult.riskAmount;
                    confidence = percentResult.confidence;
                    warnings.push(...percentResult.warnings);
                    break;
                case 'atr_based':
                    const atrResult = this.atrBasedSizing(params);
                    lotSize = atrResult.lotSize;
                    riskAmount = atrResult.riskAmount;
                    confidence = atrResult.confidence;
                    warnings.push(...atrResult.warnings);
                    break;
                case 'kelly_criterion':
                    const kellyResult = this.kellyCriterionSizing(params);
                    lotSize = kellyResult.lotSize;
                    riskAmount = kellyResult.riskAmount;
                    confidence = kellyResult.confidence;
                    warnings.push(...kellyResult.warnings);
                    break;
                case 'volatility_based':
                    const volatilityResult = this.volatilityBasedSizing(params);
                    lotSize = volatilityResult.lotSize;
                    riskAmount = volatilityResult.riskAmount;
                    confidence = volatilityResult.confidence;
                    warnings.push(...volatilityResult.warnings);
                    break;
                case 'account_equity':
                    const equityResult = this.accountEquitySizing(params);
                    lotSize = equityResult.lotSize;
                    riskAmount = equityResult.riskAmount;
                    confidence = equityResult.confidence;
                    break;
                default:
                    throw new Error(`Unknown sizing method: ${params.method}`);
            }
            // Apply limits
            const maxLot = params.maxLotSize || this.DEFAULT_MAX_LOT;
            const minLot = params.minLotSize || this.DEFAULT_MIN_LOT;
            if (lotSize > maxLot) {
                warnings.push(`Lot size ${lotSize} exceeds maximum ${maxLot}, capping`);
                lotSize = maxLot;
            }
            if (lotSize < minLot) {
                warnings.push(`Lot size ${lotSize} below minimum ${minLot}, adjusting`);
                lotSize = minLot;
            }
            // Round to 2 decimal places
            lotSize = Math.round(lotSize * 100) / 100;
            logger_1.logger.info(`[PositionSizing] Calculated lot size: ${lotSize} (risk: ${riskAmount})`);
            return {
                lotSize,
                riskAmount,
                method: params.method,
                confidence,
                warnings,
                metadata: {
                    accountBalance: params.accountBalance,
                    riskPercentage: params.riskPercentage,
                    stopLossPips: params.stopLossPips,
                },
            };
        }
        catch (error) {
            logger_1.logger.error(`[PositionSizing] Error calculating position size:`, error);
            throw error;
        }
    }
    /**
     * Fixed lot sizing
     */
    fixedLotSizing(params) {
        const lotSize = params.fixedLot || 0.01;
        const riskAmount = this.calculateRiskAmount(params.symbol, lotSize, params.stopLossPips || 50);
        return { lotSize, riskAmount };
    }
    /**
     * Percentage risk sizing
     * Risk fixed percentage of account per trade
     */
    percentageRiskSizing(params) {
        const warnings = [];
        const riskPercentage = params.riskPercentage || this.DEFAULT_RISK_PERCENTAGE;
        const stopLossPips = params.stopLossPips;
        if (!stopLossPips) {
            warnings.push('Stop loss pips not provided, using default 50 pips');
        }
        const riskAmount = params.accountBalance * (riskPercentage / 100);
        const pipValue = this.getPipValue(params.symbol);
        const lotSize = riskAmount / ((stopLossPips || 50) * pipValue);
        const confidence = stopLossPips ? 100 : 70;
        return { lotSize, riskAmount, confidence, warnings };
    }
    /**
     * ATR-based sizing
     * Uses ATR to dynamically adjust position size based on volatility
     */
    atrBasedSizing(params) {
        const warnings = [];
        if (!params.atr) {
            throw new Error('ATR value is required for ATR-based sizing');
        }
        const riskPercentage = params.riskPercentage || this.DEFAULT_RISK_PERCENTAGE;
        const atrMultiplier = params.atrMultiplier || this.DEFAULT_ATR_MULTIPLIER;
        const riskAmount = params.accountBalance * (riskPercentage / 100);
        const stopLossPips = params.atr * atrMultiplier * 10000; // Convert to pips
        const pipValue = this.getPipValue(params.symbol);
        const lotSize = riskAmount / (stopLossPips * pipValue);
        if (stopLossPips > 200) {
            warnings.push('Very wide stop loss due to high ATR, consider reducing multiplier');
        }
        return { lotSize, riskAmount, confidence: 95, warnings };
    }
    /**
     * Kelly Criterion sizing
     * Optimal position sizing based on win rate and win/loss ratio
     */
    kellyCriterionSizing(params) {
        const warnings = [];
        if (!params.winRate || !params.avgWin || !params.avgLoss) {
            throw new Error('Win rate, average win, and average loss are required for Kelly Criterion');
        }
        // Kelly Formula: f = (p * b - q) / b
        // f = fraction to bet
        // p = probability of win
        // q = probability of loss (1-p)
        // b = ratio of win to loss
        const p = params.winRate;
        const q = 1 - p;
        const b = params.avgWin / params.avgLoss;
        let kellyFraction = (p * b - q) / b;
        // Validate Kelly fraction
        if (kellyFraction <= 0) {
            warnings.push('Negative Kelly fraction indicates unfavorable odds, using minimum lot');
            kellyFraction = 0.01;
        }
        else if (kellyFraction > 0.25) {
            warnings.push('Kelly fraction very high, capping at 25% for safety');
            kellyFraction = 0.25;
        }
        else {
            // Use fractional Kelly for safety
            kellyFraction *= this.KELLY_FRACTION;
        }
        const riskAmount = params.accountBalance * kellyFraction;
        const stopLossPips = params.stopLossPips || 50;
        const pipValue = this.getPipValue(params.symbol);
        const lotSize = riskAmount / (stopLossPips * pipValue);
        const confidence = (params.winRate * 100 > 55) ? 90 : 70;
        return { lotSize, riskAmount, confidence, warnings };
    }
    /**
     * Volatility-based sizing
     * Adjust position size inversely to market volatility
     */
    volatilityBasedSizing(params) {
        const warnings = [];
        if (!params.volatility) {
            throw new Error('Volatility measure is required for volatility-based sizing');
        }
        const riskPercentage = params.riskPercentage || this.DEFAULT_RISK_PERCENTAGE;
        // Adjust risk based on volatility
        // High volatility -> reduce position size
        // Low volatility -> increase position size
        const volatilityAdjustment = 1 / (1 + params.volatility);
        const adjustedRisk = riskPercentage * volatilityAdjustment;
        const riskAmount = params.accountBalance * (adjustedRisk / 100);
        const stopLossPips = params.stopLossPips || 50;
        const pipValue = this.getPipValue(params.symbol);
        const lotSize = riskAmount / (stopLossPips * pipValue);
        if (volatilityAdjustment < 0.5) {
            warnings.push('High volatility detected, position size significantly reduced');
        }
        return { lotSize, riskAmount, confidence: 85, warnings };
    }
    /**
     * Account equity curve-based sizing
     * Adjust position size based on account performance
     */
    accountEquitySizing(params) {
        // Simple implementation: increase/decrease lot size based on account growth
        const baseRisk = params.riskPercentage || this.DEFAULT_RISK_PERCENTAGE;
        // For now, use fixed lot as base
        const baseLot = params.fixedLot || 0.01;
        const accountGrowthFactor = params.accountBalance / 10000; // Assuming $10k base
        const lotSize = baseLot * Math.sqrt(accountGrowthFactor);
        const riskAmount = this.calculateRiskAmount(params.symbol, lotSize, params.stopLossPips || 50);
        return { lotSize, riskAmount, confidence: 80 };
    }
    // ============ HELPER METHODS ============
    /**
     * Get pip value for a symbol
     */
    getPipValue(symbol) {
        // Simplified pip values
        // In production, this should be fetched from MT5
        const pipValues = {
            'EURUSD': 10,
            'GBPUSD': 10,
            'USDJPY': 9.09,
            'USDCHF': 10,
            'AUDUSD': 10,
            'USDCAD': 7.69,
            'NZDUSD': 10,
            // Add more symbols as needed
        };
        return pipValues[symbol] || 10; // Default to $10 per pip for 1 lot
    }
    /**
     * Calculate risk amount in currency
     */
    calculateRiskAmount(symbol, lotSize, stopLossPips) {
        const pipValue = this.getPipValue(symbol);
        return lotSize * stopLossPips * pipValue;
    }
    /**
     * Calculate recommended lot size for live account
     * More conservative for live trading
     */
    calculateLiveAccountLot(baseLotSize, accountType) {
        if (accountType === 'live') {
            // Reduce lot size by 50% for live trading as safety measure
            return Math.max(baseLotSize * 0.5, this.DEFAULT_MIN_LOT);
        }
        return baseLotSize;
    }
}
exports.AdvancedPositionSizingService = AdvancedPositionSizingService;
