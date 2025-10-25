"use strict";
/**
 * Indicator Cache Service
 * Caches calculated indicator values to improve performance
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndicatorCacheService = void 0;
const logger_1 = require("../utils/logger");
class IndicatorCacheService {
    constructor() {
        Object.defineProperty(this, "cache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "cacheLifetime", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 60000
        }); // 1 minute
        Object.defineProperty(this, "maxCacheSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1000
        });
        Object.defineProperty(this, "hits", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "misses", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
    }
    /**
     * Get cached indicator value
     */
    get(symbol, timeframe, indicator, params, currentBarCount) {
        const key = this.generateKey(symbol, timeframe, indicator, params);
        const entry = this.cache.get(key);
        if (!entry) {
            this.misses++;
            return null;
        }
        // Check if cache is expired
        const age = Date.now() - entry.timestamp;
        if (age > this.cacheLifetime) {
            this.cache.delete(key);
            this.misses++;
            return null;
        }
        // Check if bar count has changed (new data available)
        if (entry.barCount !== currentBarCount) {
            this.cache.delete(key);
            this.misses++;
            return null;
        }
        this.hits++;
        logger_1.logger.debug(`[IndicatorCache] HIT: ${key}`);
        return entry.value;
    }
    /**
     * Set cache value
     */
    set(symbol, timeframe, indicator, params, value, barCount) {
        const key = this.generateKey(symbol, timeframe, indicator, params);
        // Check cache size limit
        if (this.cache.size >= this.maxCacheSize) {
            this.evictOldest();
        }
        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            barCount
        });
        logger_1.logger.debug(`[IndicatorCache] SET: ${key}`);
    }
    /**
     * Clear cache for a specific symbol
     */
    clearSymbol(symbol) {
        let count = 0;
        for (const [key, _] of this.cache.entries()) {
            if (key.startsWith(symbol)) {
                this.cache.delete(key);
                count++;
            }
        }
        logger_1.logger.info(`[IndicatorCache] Cleared ${count} entries for ${symbol}`);
    }
    /**
     * Clear cache for a specific timeframe
     */
    clearTimeframe(timeframe) {
        let count = 0;
        for (const [key, _] of this.cache.entries()) {
            if (key.includes(`_${timeframe}_`)) {
                this.cache.delete(key);
                count++;
            }
        }
        logger_1.logger.info(`[IndicatorCache] Cleared ${count} entries for ${timeframe}`);
    }
    /**
     * Clear entire cache
     */
    clearAll() {
        const size = this.cache.size;
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
        logger_1.logger.info(`[IndicatorCache] Cleared ${size} entries`);
    }
    /**
     * Get cache statistics
     */
    getStats() {
        const total = this.hits + this.misses;
        const hitRate = total > 0 ? (this.hits / total) * 100 : 0;
        return {
            size: this.cache.size,
            hits: this.hits,
            misses: this.misses,
            hitRate,
            maxSize: this.maxCacheSize
        };
    }
    /**
     * Set cache lifetime
     */
    setCacheLifetime(milliseconds) {
        this.cacheLifetime = milliseconds;
        logger_1.logger.info(`[IndicatorCache] Cache lifetime set to ${milliseconds}ms`);
    }
    /**
     * Set max cache size
     */
    setMaxCacheSize(size) {
        this.maxCacheSize = size;
        logger_1.logger.info(`[IndicatorCache] Max cache size set to ${size}`);
    }
    /**
     * Generate cache key
     */
    generateKey(symbol, timeframe, indicator, params) {
        const paramsStr = JSON.stringify(params, Object.keys(params).sort());
        return `${symbol}_${timeframe}_${indicator}_${paramsStr}`;
    }
    /**
     * Evict oldest cache entry
     */
    evictOldest() {
        let oldestKey = null;
        let oldestTime = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this.cache.delete(oldestKey);
            logger_1.logger.debug(`[IndicatorCache] Evicted oldest entry: ${oldestKey}`);
        }
    }
    /**
     * Clean expired entries
     */
    cleanExpired() {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, entry] of this.cache.entries()) {
            const age = now - entry.timestamp;
            if (age > this.cacheLifetime) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            logger_1.logger.info(`[IndicatorCache] Cleaned ${cleaned} expired entries`);
        }
        return cleaned;
    }
    /**
     * Start periodic cleanup
     */
    startPeriodicCleanup(intervalMs = 300000) {
        setInterval(() => {
            this.cleanExpired();
        }, intervalMs);
        logger_1.logger.info(`[IndicatorCache] Periodic cleanup started (every ${intervalMs}ms)`);
    }
}
exports.IndicatorCacheService = IndicatorCacheService;
