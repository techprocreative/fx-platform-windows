"use strict";
/**
 * Filter Evaluator Service
 * Evaluates strategy filters (time, session, spread, volatility, etc)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilterEvaluatorService = void 0;
const logger_1 = require("../utils/logger");
class FilterEvaluatorService {
    /**
     * Evaluate filters (simple interface for strategy-monitor)
     * Returns true if all filters pass
     */
    async evaluate(filters, context) {
        if (!filters || filters.length === 0) {
            return true;
        }
        // Create symbol info from context
        const symbolInfo = {
            symbol: context.symbol,
            bid: context.price || 0,
            ask: context.price || 0,
            spread: 0.0001, // Default 1 pip
            point: 0.00001, // Default for 5-digit pairs
        };
        const result = await this.evaluateFilters(filters, symbolInfo);
        return result.passed;
    }
    /**
     * Evaluate all filters (detailed interface)
     */
    async evaluateFilters(filters, symbolInfo, currentVolatility) {
        const results = [];
        for (const filter of filters) {
            if (!filter.enabled) {
                continue;
            }
            const result = await this.evaluateFilter(filter, symbolInfo, currentVolatility);
            results.push(result);
        }
        // All filters must pass
        const passed = results.length === 0 || results.every(r => r.passed);
        return { passed, results };
    }
    /**
     * Evaluate a single filter
     */
    async evaluateFilter(filter, symbolInfo, currentVolatility) {
        try {
            switch (filter.type) {
                case 'time':
                    return this.evaluateTimeFilter(filter);
                case 'session':
                    return this.evaluateSessionFilter(filter);
                case 'spread':
                    return this.evaluateSpreadFilter(filter, symbolInfo);
                case 'volatility':
                    return this.evaluateVolatilityFilter(filter, currentVolatility);
                case 'dayOfWeek':
                    return this.evaluateDayOfWeekFilter(filter);
                case 'news':
                    return this.evaluateNewsFilter(filter);
                default:
                    logger_1.logger.warn(`[FilterEvaluator] Unknown filter type: ${filter.type}`);
                    return {
                        filterType: filter.type,
                        passed: true,
                        reason: 'Unknown filter type - passing by default'
                    };
            }
        }
        catch (error) {
            logger_1.logger.error(`[FilterEvaluator] Error evaluating ${filter.type} filter:`, error);
            return {
                filterType: filter.type,
                passed: false,
                reason: `Error: ${error.message}`
            };
        }
    }
    /**
     * Evaluate time filter (trading hours)
     */
    evaluateTimeFilter(filter) {
        const now = new Date();
        const currentTime = now.toTimeString().substring(0, 5); // HH:MM
        const { startTime, endTime } = filter.config;
        if (!startTime || !endTime) {
            return {
                filterType: 'time',
                passed: true,
                reason: 'No time restrictions configured'
            };
        }
        const inRange = this.isTimeInRange(currentTime, startTime, endTime);
        return {
            filterType: 'time',
            passed: inRange,
            reason: inRange
                ? `Within trading hours (${startTime}-${endTime})`
                : `Outside trading hours (${startTime}-${endTime}), current: ${currentTime}`
        };
    }
    /**
     * Check if time is in range
     */
    isTimeInRange(time, start, end) {
        // Handle overnight ranges (e.g., 22:00 - 02:00)
        if (start <= end) {
            return time >= start && time <= end;
        }
        else {
            return time >= start || time <= end;
        }
    }
    /**
     * Evaluate session filter (ASIAN, LONDON, NEWYORK)
     */
    evaluateSessionFilter(filter) {
        const { sessions } = filter.config;
        if (!sessions || sessions.length === 0) {
            return {
                filterType: 'session',
                passed: true,
                reason: 'No session restrictions'
            };
        }
        const currentSession = this.getCurrentSession();
        const allowed = sessions.includes(currentSession);
        return {
            filterType: 'session',
            passed: allowed,
            reason: allowed
                ? `Current session (${currentSession}) is allowed`
                : `Current session (${currentSession}) not in allowed sessions: ${sessions.join(', ')}`
        };
    }
    /**
     * Get current trading session based on UTC time
     */
    getCurrentSession() {
        const now = new Date();
        const utcHour = now.getUTCHours();
        // Session times (UTC)
        // Asian: 00:00 - 09:00 UTC
        // London: 08:00 - 17:00 UTC
        // New York: 13:00 - 22:00 UTC
        if (utcHour >= 0 && utcHour < 9) {
            return 'ASIAN';
        }
        else if (utcHour >= 8 && utcHour < 17) {
            return 'LONDON';
        }
        else {
            return 'NEWYORK';
        }
    }
    /**
     * Evaluate spread filter
     */
    evaluateSpreadFilter(filter, symbolInfo) {
        const { maxSpread } = filter.config;
        if (!maxSpread) {
            return {
                filterType: 'spread',
                passed: true,
                reason: 'No spread limit configured'
            };
        }
        // Convert spread to pips
        const spreadPips = symbolInfo.spread / symbolInfo.point / 10;
        const passed = spreadPips <= maxSpread;
        return {
            filterType: 'spread',
            passed,
            reason: passed
                ? `Spread (${spreadPips.toFixed(1)} pips) within limit (${maxSpread} pips)`
                : `Spread too high: ${spreadPips.toFixed(1)} pips > ${maxSpread} pips`
        };
    }
    /**
     * Evaluate volatility filter
     */
    evaluateVolatilityFilter(filter, currentVolatility) {
        const { minVolatility, maxVolatility } = filter.config;
        if (!minVolatility && !maxVolatility) {
            return {
                filterType: 'volatility',
                passed: true,
                reason: 'No volatility restrictions'
            };
        }
        if (currentVolatility === undefined) {
            return {
                filterType: 'volatility',
                passed: true,
                reason: 'Volatility data not available'
            };
        }
        let passed = true;
        let reason = '';
        if (minVolatility && currentVolatility < minVolatility) {
            passed = false;
            reason = `Volatility too low: ${currentVolatility.toFixed(2)} < ${minVolatility}`;
        }
        else if (maxVolatility && currentVolatility > maxVolatility) {
            passed = false;
            reason = `Volatility too high: ${currentVolatility.toFixed(2)} > ${maxVolatility}`;
        }
        else {
            reason = `Volatility (${currentVolatility.toFixed(2)}) within range`;
        }
        return {
            filterType: 'volatility',
            passed,
            reason
        };
    }
    /**
     * Evaluate day of week filter
     */
    evaluateDayOfWeekFilter(filter) {
        const { allowedDays } = filter.config;
        if (!allowedDays || allowedDays.length === 0) {
            return {
                filterType: 'dayOfWeek',
                passed: true,
                reason: 'No day restrictions'
            };
        }
        const today = new Date().getDay(); // 0=Sunday, 6=Saturday
        const allowed = allowedDays.includes(today);
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return {
            filterType: 'dayOfWeek',
            passed: allowed,
            reason: allowed
                ? `${dayNames[today]} is allowed`
                : `${dayNames[today]} not in allowed days`
        };
    }
    /**
     * Evaluate news filter
     */
    evaluateNewsFilter(filter) {
        // TODO: Implement news calendar integration
        // - Check if high-impact news is scheduled soon
        // - Avoid trading during news events
        return {
            filterType: 'news',
            passed: true,
            reason: 'News filter not yet implemented'
        };
    }
}
exports.FilterEvaluatorService = FilterEvaluatorService;
