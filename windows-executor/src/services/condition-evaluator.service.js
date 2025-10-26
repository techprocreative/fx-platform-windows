/**
 * Condition Evaluator Service
 * Evaluates strategy conditions and determines if they are met
 */
import { logger } from '../utils/logger';
export class ConditionEvaluatorService {
    constructor(indicatorService) {
        Object.defineProperty(this, "indicatorService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: indicatorService
        });
    }
    /**
     * Evaluate condition (simple interface for strategy-monitor)
     * Returns true if condition is met
     */
    async evaluate(condition, marketData) {
        const currentPrice = marketData.bars?.[marketData.bars.length - 1]?.close || 0;
        const result = await this.evaluateCondition(condition, marketData, currentPrice);
        return result.met;
    }
    /**
     * Evaluate a single condition (detailed interface)
     */
    async evaluateCondition(condition, marketData, currentPrice) {
        if (!condition.enabled) {
            return {
                conditionId: condition.id,
                indicator: condition.indicator,
                currentValue: 0,
                expectedValue: condition.value,
                comparison: condition.comparison,
                met: false,
                reason: 'Condition is disabled'
            };
        }
        try {
            // Get indicator current value
            const indicatorValue = await this.getIndicatorValue(condition.indicator, condition.params, marketData);
            if (indicatorValue === null) {
                return {
                    conditionId: condition.id,
                    indicator: condition.indicator,
                    currentValue: 'N/A',
                    expectedValue: condition.value,
                    comparison: condition.comparison,
                    met: false,
                    reason: `Failed to calculate ${condition.indicator}`
                };
            }
            // Get comparison value
            const comparisonValue = await this.getComparisonValue(condition.value, condition.indicator, condition.params, marketData, currentPrice);
            // Perform comparison
            const met = this.performComparison(indicatorValue, comparisonValue, condition.comparison, marketData, condition.indicator);
            return {
                conditionId: condition.id,
                indicator: condition.indicator,
                currentValue: indicatorValue,
                expectedValue: comparisonValue,
                comparison: condition.comparison,
                met,
                reason: this.generateReason(condition.indicator, indicatorValue, comparisonValue, condition.comparison, met)
            };
        }
        catch (error) {
            logger.error('[ConditionEvaluator] Error evaluating condition:', error);
            return {
                conditionId: condition.id,
                indicator: condition.indicator,
                currentValue: 'ERROR',
                expectedValue: condition.value,
                comparison: condition.comparison,
                met: false,
                reason: `Error: ${error.message}`
            };
        }
    }
    /**
     * Evaluate multiple conditions with logic (AND/OR)
     */
    async evaluateConditions(conditions, logic, marketData, currentPrice) {
        const results = [];
        // Evaluate all conditions
        for (const condition of conditions) {
            const result = await this.evaluateCondition(condition, marketData, currentPrice);
            results.push(result);
        }
        // Apply logic
        let met;
        if (logic === 'AND') {
            met = results.every(r => r.met);
        }
        else { // OR
            met = results.some(r => r.met);
        }
        return { met, results };
    }
    /**
     * Get indicator value
     */
    async getIndicatorValue(indicatorType, params, marketData) {
        return await this.indicatorService.getIndicatorValue(marketData, indicatorType, params);
    }
    /**
     * Get comparison value (can be number, price, or another indicator)
     */
    async getComparisonValue(value, indicatorType, params, marketData, currentPrice) {
        // If it's a number, return it
        if (typeof value === 'number') {
            return value;
        }
        // If it's 'price', return current price
        if (value === 'price') {
            return currentPrice;
        }
        // If it's another indicator name, calculate it
        // Example: "MA_50" or "EMA_20"
        const indicatorMatch = value.match(/^([A-Z]+)_(\d+)$/);
        if (indicatorMatch) {
            const [, indicator, period] = indicatorMatch;
            const indicatorValue = await this.indicatorService.getIndicatorValue(marketData, indicator, { period: parseInt(period) });
            return indicatorValue || 0;
        }
        // Default to 0 if can't parse
        logger.warn(`[ConditionEvaluator] Unknown comparison value: ${value}`);
        return 0;
    }
    /**
     * Perform comparison between two values
     */
    performComparison(value1, value2, operator, marketData, indicator) {
        switch (operator) {
            case 'greater_than':
                return value1 > value2;
            case 'less_than':
                return value1 < value2;
            case 'equals':
                return Math.abs(value1 - value2) < 0.0001; // Floating point comparison
            case 'greater_or_equal':
                return value1 >= value2;
            case 'less_or_equal':
                return value1 <= value2;
            case 'crosses_above':
                return this.checkCrossAbove(indicator, value2, marketData);
            case 'crosses_below':
                return this.checkCrossBelow(indicator, value2, marketData);
            case 'between':
                // For 'between', value2 should be an array [min, max]
                // But we simplified it here
                return false;
            case 'outside':
                return false;
            default:
                logger.warn(`[ConditionEvaluator] Unknown operator: ${operator}`);
                return false;
        }
    }
    /**
     * Check if indicator crossed above a value
     */
    checkCrossAbove(indicator, value, marketData) {
        // Need at least 2 bars to check cross
        if (marketData.bars.length < 2) {
            return false;
        }
        // For price crossing MA
        if (indicator === 'price') {
            const currentPrice = marketData.bars[marketData.bars.length - 1].close;
            const previousPrice = marketData.bars[marketData.bars.length - 2].close;
            return previousPrice <= value && currentPrice > value;
        }
        // For indicator values, we would need historical indicator values
        // This is simplified - in real implementation, calculate indicator for previous bars
        return false;
    }
    /**
     * Check if indicator crossed below a value
     */
    checkCrossBelow(indicator, value, marketData) {
        if (marketData.bars.length < 2) {
            return false;
        }
        if (indicator === 'price') {
            const currentPrice = marketData.bars[marketData.bars.length - 1].close;
            const previousPrice = marketData.bars[marketData.bars.length - 2].close;
            return previousPrice >= value && currentPrice < value;
        }
        return false;
    }
    /**
     * Generate human-readable reason
     */
    generateReason(indicator, currentValue, expectedValue, comparison, met) {
        const comparisonText = {
            'greater_than': '>',
            'less_than': '<',
            'equals': '=',
            'greater_or_equal': '>=',
            'less_or_equal': '<=',
            'crosses_above': 'crosses above',
            'crosses_below': 'crosses below',
            'between': 'between',
            'outside': 'outside'
        };
        const op = comparisonText[comparison] || comparison;
        const status = met ? '✓' : '✗';
        return `${status} ${indicator}(${currentValue.toFixed(2)}) ${op} ${expectedValue.toFixed(2)}`;
    }
}
