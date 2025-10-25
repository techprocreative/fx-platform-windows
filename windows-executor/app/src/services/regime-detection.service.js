"use strict";
/**
 * Regime Detection Service
 * Detects market regimes (trending/ranging) and adapts strategy parameters
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegimeDetectionService = void 0;
const logger_1 = require("../utils/logger");
const strategy_types_1 = require("../types/strategy.types");
const indicator_service_1 = require("./indicator.service");
class RegimeDetectionService {
    constructor() {
        this.indicatorService = new indicator_service_1.IndicatorService();
    }
    /**
     * Detect current market regime
     */
    async detectRegime(bars) {
        if (bars.length < 200) {
            logger_1.logger.warn('[RegimeDetectionService] Insufficient data for regime detection');
            return {
                regime: strategy_types_1.MarketRegime.RANGING,
                confidence: 0.5,
                strength: 0,
                indicators: {
                    adx: 0,
                    atr: 0,
                    pricePosition: 0
                },
                recommendations: ['Need more historical data for accurate regime detection']
            };
        }
        // Calculate key indicators
        const adxResult = this.indicatorService.calculateADX(bars, 14);
        const atrValues = this.indicatorService.calculateATR(bars, 14);
        const ema200 = this.indicatorService.calculateMA(bars, 200, 'EMA');
        const currentPrice = bars[bars.length - 1].close;
        const adx = adxResult.adx.length > 0 ? adxResult.adx[adxResult.adx.length - 1] : 0;
        const plusDI = adxResult.plusDI.length > 0 ? adxResult.plusDI[adxResult.plusDI.length - 1] : 0;
        const minusDI = adxResult.minusDI.length > 0 ? adxResult.minusDI[adxResult.minusDI.length - 1] : 0;
        const atr = atrValues.length > 0 ? atrValues[atrValues.length - 1] : 0;
        const ema = ema200.length > 0 ? ema200[ema200.length - 1] : currentPrice;
        const pricePosition = ((currentPrice - ema) / ema) * 100;
        // Calculate average ATR for volatility comparison
        const avgATR = atrValues.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const volatilityRatio = atr / avgATR;
        // Detect regime
        let regime;
        let confidence;
        let strength;
        const recommendations = [];
        // High volatility regime
        if (volatilityRatio > 1.5) {
            regime = strategy_types_1.MarketRegime.HIGH_VOLATILITY;
            confidence = Math.min(0.9, volatilityRatio / 2);
            strength = volatilityRatio;
            recommendations.push('High volatility detected - reduce position sizes');
            recommendations.push('Use wider stop losses');
            recommendations.push('Consider shorter holding periods');
        }
        // Low volatility regime
        else if (volatilityRatio < 0.7) {
            regime = strategy_types_1.MarketRegime.LOW_VOLATILITY;
            confidence = Math.min(0.9, 1 - volatilityRatio);
            strength = 1 - volatilityRatio;
            recommendations.push('Low volatility environment - expect ranging conditions');
            recommendations.push('Use tighter stop losses');
            recommendations.push('Consider breakout strategies');
        }
        // Trending regimes
        else if (adx > 25) {
            strength = adx / 100;
            // Bullish trending
            if (plusDI > minusDI && pricePosition > 0) {
                regime = strategy_types_1.MarketRegime.BULLISH_TRENDING;
                confidence = Math.min(0.95, adx / 100 + 0.3);
                recommendations.push('Strong bullish trend detected');
                recommendations.push('Consider trend-following strategies');
                recommendations.push('Use trailing stops to maximize profits');
                recommendations.push('Avoid counter-trend trades');
            }
            // Bearish trending
            else if (minusDI > plusDI && pricePosition < 0) {
                regime = strategy_types_1.MarketRegime.BEARISH_TRENDING;
                confidence = Math.min(0.95, adx / 100 + 0.3);
                recommendations.push('Strong bearish trend detected');
                recommendations.push('Consider short positions');
                recommendations.push('Use trailing stops');
                recommendations.push('Avoid counter-trend longs');
            }
            // Mixed signals
            else {
                regime = strategy_types_1.MarketRegime.RANGING;
                confidence = 0.6;
                strength = 1 - (adx / 100);
                recommendations.push('Mixed trend signals - trade cautiously');
            }
        }
        // Potential breakout
        else if (adx > 15 && adx < 25 && volatilityRatio < 0.8) {
            regime = strategy_types_1.MarketRegime.BREAKOUT;
            confidence = 0.7;
            strength = adx / 25;
            recommendations.push('Potential breakout forming');
            recommendations.push('Watch for volume confirmation');
            recommendations.push('Set alerts at key support/resistance levels');
            recommendations.push('Be ready to enter on breakout confirmation');
        }
        // Ranging market
        else {
            regime = strategy_types_1.MarketRegime.RANGING;
            confidence = Math.min(0.9, 1 - (adx / 25));
            strength = 1 - (adx / 25);
            recommendations.push('Ranging market detected');
            recommendations.push('Use support/resistance trading');
            recommendations.push('Take profits at range extremes');
            recommendations.push('Avoid breakout strategies');
        }
        logger_1.logger.info(`[RegimeDetectionService] Detected regime: ${regime} (confidence: ${(confidence * 100).toFixed(1)}%)`);
        return {
            regime,
            confidence,
            strength,
            indicators: {
                adx,
                atr,
                pricePosition
            },
            recommendations
        };
    }
    /**
     * Adapt strategy parameters based on regime
     */
    adaptStrategyForRegime(baseStrategy, regimeResult, config) {
        if (!config.enabled || !config.adaptStrategy || !config.regimeSettings) {
            return baseStrategy;
        }
        const adapted = { ...baseStrategy };
        const regimeSettings = config.regimeSettings[regimeResult.regime];
        if (!regimeSettings || !regimeSettings.enabled) {
            return adapted;
        }
        logger_1.logger.info(`[RegimeDetectionService] Adapting strategy for ${regimeResult.regime}`);
        // Adjust position size
        if (regimeSettings.positionSizeMultiplier !== 1.0) {
            adapted.positionSize *= regimeSettings.positionSizeMultiplier;
            logger_1.logger.info(`[RegimeDetectionService] Position size adjusted to ${adapted.positionSize} (${regimeSettings.positionSizeMultiplier}x)`);
        }
        // Adjust take profit
        if (adapted.takeProfit && regimeSettings.takeProfitMultiplier !== 1.0) {
            if (adapted.takeProfit.type === 'fixed') {
                adapted.takeProfit.value *= regimeSettings.takeProfitMultiplier;
            }
            else if (adapted.takeProfit.type === 'ratio') {
                adapted.takeProfit.ratio = (adapted.takeProfit.ratio || 2) * regimeSettings.takeProfitMultiplier;
            }
            logger_1.logger.info(`[RegimeDetectionService] Take profit adjusted (${regimeSettings.takeProfitMultiplier}x)`);
        }
        // Adjust stop loss
        if (adapted.stopLoss && regimeSettings.stopLossMultiplier && regimeSettings.stopLossMultiplier !== 1.0) {
            if (adapted.stopLoss.type === 'fixed') {
                adapted.stopLoss.value *= regimeSettings.stopLossMultiplier;
            }
            logger_1.logger.info(`[RegimeDetectionService] Stop loss adjusted (${regimeSettings.stopLossMultiplier}x)`);
        }
        return adapted;
    }
    /**
     * Check if regime is suitable for trading
     */
    isSuitableForTrading(regimeResult, allowedRegimes) {
        if (!allowedRegimes || allowedRegimes.length === 0) {
            return true;
        }
        const isAllowed = allowedRegimes.includes(regimeResult.regime);
        if (!isAllowed) {
            logger_1.logger.info(`[RegimeDetectionService] Current regime ${regimeResult.regime} not in allowed regimes`);
        }
        return isAllowed;
    }
    /**
     * Get recommended position size multiplier for regime
     */
    getPositionSizeMultiplier(regime) {
        switch (regime) {
            case strategy_types_1.MarketRegime.BULLISH_TRENDING:
            case strategy_types_1.MarketRegime.BEARISH_TRENDING:
                return 1.5; // Increase size in strong trends
            case strategy_types_1.MarketRegime.HIGH_VOLATILITY:
                return 0.5; // Reduce size in high volatility
            case strategy_types_1.MarketRegime.LOW_VOLATILITY:
                return 0.8; // Slightly reduce size in low volatility
            case strategy_types_1.MarketRegime.RANGING:
                return 0.7; // Reduce size in ranging markets
            case strategy_types_1.MarketRegime.BREAKOUT:
                return 1.0; // Normal size for breakouts
            default:
                return 1.0;
        }
    }
    /**
     * Get recommended take profit multiplier for regime
     */
    getTakeProfitMultiplier(regime) {
        switch (regime) {
            case strategy_types_1.MarketRegime.BULLISH_TRENDING:
            case strategy_types_1.MarketRegime.BEARISH_TRENDING:
                return 2.0; // Wider TP in trends
            case strategy_types_1.MarketRegime.HIGH_VOLATILITY:
                return 1.5; // Wider TP in volatility
            case strategy_types_1.MarketRegime.LOW_VOLATILITY:
            case strategy_types_1.MarketRegime.RANGING:
                return 0.5; // Tighter TP in ranging
            case strategy_types_1.MarketRegime.BREAKOUT:
                return 1.5; // Wider TP for breakouts
            default:
                return 1.0;
        }
    }
    /**
     * Get recommended stop loss multiplier for regime
     */
    getStopLossMultiplier(regime) {
        switch (regime) {
            case strategy_types_1.MarketRegime.HIGH_VOLATILITY:
                return 1.5; // Wider SL in high volatility
            case strategy_types_1.MarketRegime.LOW_VOLATILITY:
            case strategy_types_1.MarketRegime.RANGING:
                return 0.7; // Tighter SL in low volatility
            case strategy_types_1.MarketRegime.BULLISH_TRENDING:
            case strategy_types_1.MarketRegime.BEARISH_TRENDING:
                return 1.2; // Slightly wider SL in trends
            case strategy_types_1.MarketRegime.BREAKOUT:
                return 1.0; // Normal SL for breakouts
            default:
                return 1.0;
        }
    }
    /**
     * Calculate regime transition probability
     */
    calculateTransitionProbability(currentRegime, indicators) {
        const probabilities = {
            [strategy_types_1.MarketRegime.BULLISH_TRENDING]: 0,
            [strategy_types_1.MarketRegime.BEARISH_TRENDING]: 0,
            [strategy_types_1.MarketRegime.RANGING]: 0,
            [strategy_types_1.MarketRegime.HIGH_VOLATILITY]: 0,
            [strategy_types_1.MarketRegime.LOW_VOLATILITY]: 0,
            [strategy_types_1.MarketRegime.BREAKOUT]: 0
        };
        // Simplified transition probability model
        switch (currentRegime) {
            case strategy_types_1.MarketRegime.RANGING:
                probabilities[strategy_types_1.MarketRegime.BREAKOUT] = indicators.adx > 15 ? 0.4 : 0.2;
                probabilities[strategy_types_1.MarketRegime.LOW_VOLATILITY] = 0.3;
                probabilities[strategy_types_1.MarketRegime.RANGING] = 0.3;
                break;
            case strategy_types_1.MarketRegime.BREAKOUT:
                probabilities[strategy_types_1.MarketRegime.BULLISH_TRENDING] = 0.35;
                probabilities[strategy_types_1.MarketRegime.BEARISH_TRENDING] = 0.35;
                probabilities[strategy_types_1.MarketRegime.RANGING] = 0.3;
                break;
            case strategy_types_1.MarketRegime.BULLISH_TRENDING:
            case strategy_types_1.MarketRegime.BEARISH_TRENDING:
                probabilities[strategy_types_1.MarketRegime.RANGING] = indicators.adx < 20 ? 0.4 : 0.2;
                probabilities[currentRegime] = 0.6;
                break;
            default:
                probabilities[strategy_types_1.MarketRegime.RANGING] = 0.5;
                probabilities[strategy_types_1.MarketRegime.BREAKOUT] = 0.3;
                probabilities[strategy_types_1.MarketRegime.HIGH_VOLATILITY] = 0.2;
        }
        return probabilities;
    }
}
exports.RegimeDetectionService = RegimeDetectionService;
