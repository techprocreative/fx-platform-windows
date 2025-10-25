"use strict";
/**
 * Correlation Service
 * Analyzes correlation between currency pairs to prevent overexposure
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CorrelationService = void 0;
const logger_1 = require("../utils/logger");
class CorrelationService {
    constructor() {
        this.correlationCache = new Map();
        this.cacheExpiry = 3600000; // 1 hour
    }
    /**
     * Calculate correlation matrix for given pairs
     */
    async calculateCorrelationMatrix(pairsData, config) {
        const cacheKey = this.getCacheKey(pairsData.map(p => p.symbol), config);
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            logger_1.logger.info('[CorrelationService] Using cached correlation matrix');
            return cached;
        }
        const correlations = {};
        let totalCorrelation = 0;
        let count = 0;
        let highestCorrelation = 0;
        // Calculate pairwise correlations
        for (let i = 0; i < pairsData.length; i++) {
            const pair1 = pairsData[i];
            correlations[pair1.symbol] = {};
            for (let j = 0; j < pairsData.length; j++) {
                const pair2 = pairsData[j];
                if (i === j) {
                    correlations[pair1.symbol][pair2.symbol] = {
                        correlation: 1.0,
                        pValue: 0,
                        dataPoints: pair1.bars.length,
                        isSignificant: true,
                        lastUpdated: new Date()
                    };
                    continue;
                }
                const corrData = this.calculatePearsonCorrelation(pair1.bars, pair2.bars, config.lookbackPeriod || 100);
                correlations[pair1.symbol][pair2.symbol] = corrData;
                totalCorrelation += Math.abs(corrData.correlation);
                count++;
                if (Math.abs(corrData.correlation) > Math.abs(highestCorrelation)) {
                    highestCorrelation = corrData.correlation;
                }
            }
        }
        const matrix = {
            correlations,
            metadata: {
                totalPairs: pairsData.length,
                averageCorrelation: count > 0 ? totalCorrelation / count : 0,
                highestCorrelation,
                volatilityAdjusted: config.dynamicThreshold || false,
                lastUpdated: new Date()
            }
        };
        this.saveToCache(cacheKey, matrix);
        return matrix;
    }
    /**
     * Calculate Pearson correlation coefficient
     */
    calculatePearsonCorrelation(bars1, bars2, lookback) {
        const n = Math.min(bars1.length, bars2.length, lookback);
        if (n < 2) {
            return {
                correlation: 0,
                pValue: 1,
                dataPoints: n,
                isSignificant: false,
                lastUpdated: new Date()
            };
        }
        // Extract close prices
        const x = bars1.slice(-n).map(b => b.close);
        const y = bars2.slice(-n).map(b => b.close);
        // Calculate returns (percentage change)
        const xReturns = [];
        const yReturns = [];
        for (let i = 1; i < x.length; i++) {
            xReturns.push((x[i] - x[i - 1]) / x[i - 1]);
            yReturns.push((y[i] - y[i - 1]) / y[i - 1]);
        }
        // Calculate means
        const xMean = xReturns.reduce((a, b) => a + b, 0) / xReturns.length;
        const yMean = yReturns.reduce((a, b) => a + b, 0) / yReturns.length;
        // Calculate correlation
        let numerator = 0;
        let xSquared = 0;
        let ySquared = 0;
        for (let i = 0; i < xReturns.length; i++) {
            const xDiff = xReturns[i] - xMean;
            const yDiff = yReturns[i] - yMean;
            numerator += xDiff * yDiff;
            xSquared += xDiff * xDiff;
            ySquared += yDiff * yDiff;
        }
        const denominator = Math.sqrt(xSquared * ySquared);
        const correlation = denominator === 0 ? 0 : numerator / denominator;
        // Calculate p-value (simplified t-test)
        const t = correlation * Math.sqrt((n - 2) / (1 - correlation * correlation));
        const pValue = this.calculatePValue(t, n - 2);
        return {
            correlation,
            pValue,
            dataPoints: n,
            isSignificant: pValue < 0.05,
            lastUpdated: new Date()
        };
    }
    /**
     * Simplified p-value calculation
     */
    calculatePValue(t, df) {
        // Simplified calculation - in production should use proper statistical library
        const absT = Math.abs(t);
        if (absT > 3)
            return 0.001;
        if (absT > 2.5)
            return 0.01;
        if (absT > 2)
            return 0.05;
        if (absT > 1.5)
            return 0.1;
        return 0.2;
    }
    /**
     * Analyze if a new trade would create excessive correlation
     */
    async analyzeCorrelationRisk(targetSymbol, targetSize, openPositions, correlationMatrix, config) {
        if (!config.enabled) {
            return {
                shouldSkip: false,
                conflictingPositions: [],
                recommendedAction: 'proceed',
                confidence: 1.0
            };
        }
        const conflictingPositions = [];
        let highestCorrelation = 0;
        // Check correlation with existing positions
        for (const position of openPositions) {
            const corrData = correlationMatrix.correlations[targetSymbol]?.[position.symbol];
            if (!corrData)
                continue;
            const absCorrelation = Math.abs(corrData.correlation);
            if (absCorrelation > config.maxCorrelation) {
                conflictingPositions.push({
                    symbol: position.symbol,
                    correlation: corrData.correlation,
                    positionSize: position.volume
                });
                if (absCorrelation > highestCorrelation) {
                    highestCorrelation = absCorrelation;
                }
            }
        }
        // Determine action
        let recommendedAction = 'proceed';
        let shouldSkip = false;
        let reason;
        if (conflictingPositions.length > 0) {
            if (highestCorrelation > 0.9 && config.skipHighlyCorrelated) {
                recommendedAction = 'skip';
                shouldSkip = true;
                reason = `Extremely high correlation (${(highestCorrelation * 100).toFixed(1)}%) with ${conflictingPositions[0].symbol}`;
            }
            else if (highestCorrelation > 0.7) {
                recommendedAction = 'reduce_size';
                reason = `High correlation (${(highestCorrelation * 100).toFixed(1)}%) with existing positions`;
            }
        }
        // Calculate adjusted position size
        let adjustedPositionSize;
        if (recommendedAction === 'reduce_size') {
            const reductionFactor = 1 - (highestCorrelation - config.maxCorrelation);
            adjustedPositionSize = targetSize * Math.max(0.5, reductionFactor);
        }
        const confidence = 1 - (conflictingPositions.length * 0.1);
        return {
            shouldSkip,
            reason,
            conflictingPositions,
            recommendedAction,
            adjustedPositionSize,
            confidence: Math.max(0, Math.min(1, confidence))
        };
    }
    /**
     * Group pairs by currency
     */
    groupByCurrency(symbols) {
        const groups = {};
        for (const symbol of symbols) {
            // Extract base currency (first 3 chars)
            const base = symbol.substring(0, 3);
            if (!groups[base]) {
                groups[base] = [];
            }
            groups[base].push(symbol);
        }
        return groups;
    }
    /**
     * Calculate total exposure for a currency
     */
    calculateCurrencyExposure(currency, positions) {
        let totalExposure = 0;
        for (const position of positions) {
            const base = position.symbol.substring(0, 3);
            const quote = position.symbol.substring(3, 6);
            if (base === currency) {
                totalExposure += position.volume * (position.type === 'BUY' ? 1 : -1);
            }
            else if (quote === currency) {
                totalExposure += position.volume * (position.type === 'BUY' ? -1 : 1);
            }
        }
        return totalExposure;
    }
    /**
     * Get correlation between two specific pairs
     */
    getCorrelation(symbol1, symbol2, matrix) {
        return matrix.correlations[symbol1]?.[symbol2]?.correlation ?? null;
    }
    /**
     * Cache management
     */
    getCacheKey(symbols, config) {
        return `${symbols.sort().join('_')}_${config.lookbackPeriod || 100}`;
    }
    getFromCache(key) {
        const cached = this.correlationCache.get(key);
        if (!cached)
            return null;
        const age = Date.now() - cached.metadata.lastUpdated.getTime();
        if (age > this.cacheExpiry) {
            this.correlationCache.delete(key);
            return null;
        }
        return cached;
    }
    saveToCache(key, matrix) {
        this.correlationCache.set(key, matrix);
        // Limit cache size
        if (this.correlationCache.size > 100) {
            const firstKey = this.correlationCache.keys().next().value;
            if (firstKey) {
                this.correlationCache.delete(firstKey);
            }
        }
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.correlationCache.clear();
        logger_1.logger.info('[CorrelationService] Cache cleared');
    }
}
exports.CorrelationService = CorrelationService;
