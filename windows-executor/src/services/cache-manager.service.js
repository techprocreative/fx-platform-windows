/**
 * Cache Manager Service
 * High-performance caching for indicators, market data, and calculations
 */
import { logger } from '../utils/logger';
export class CacheManager {
    constructor(options) {
        Object.defineProperty(this, "cache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "maxSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "defaultTTL", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "stats", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {
                hits: 0,
                misses: 0,
            }
        });
        this.maxSize = options?.maxSize || 1000;
        this.defaultTTL = options?.defaultTTL || 5 * 60 * 1000; // 5 minutes
        logger.debug(`[CacheManager] Initialized (maxSize: ${this.maxSize}, TTL: ${this.defaultTTL}ms)`);
    }
    /**
     * Get value from cache or calculate if not cached
     */
    async get(key, calculator, ttl) {
        const cached = this.cache.get(key);
        // Check if cached and not expired
        if (cached && new Date() < cached.expiresAt) {
            this.stats.hits++;
            cached.hits++;
            cached.lastAccessed = new Date();
            logger.debug(`[CacheManager] Cache HIT: ${key} (hits: ${cached.hits})`);
            return cached.value;
        }
        // Cache miss - calculate
        this.stats.misses++;
        logger.debug(`[CacheManager] Cache MISS: ${key}`);
        const value = await calculator();
        await this.set(key, value, ttl);
        return value;
    }
    /**
     * Set value in cache
     */
    async set(key, value, ttl) {
        const expiresAt = new Date(Date.now() + (ttl || this.defaultTTL));
        const entry = {
            key,
            value,
            createdAt: new Date(),
            expiresAt,
            hits: 0,
            lastAccessed: new Date(),
        };
        // Check if need to evict
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evictLRU();
        }
        this.cache.set(key, entry);
        logger.debug(`[CacheManager] Cached: ${key} (expires: ${expiresAt.toISOString()})`);
    }
    /**
     * Check if key exists and is valid
     */
    has(key) {
        const cached = this.cache.get(key);
        if (!cached)
            return false;
        // Check if expired
        if (new Date() >= cached.expiresAt) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }
    /**
     * Delete a key
     */
    delete(key) {
        return this.cache.delete(key);
    }
    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
        logger.info('[CacheManager] Cache cleared');
    }
    /**
     * Get cache statistics
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0
            ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
            : 0;
        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate,
            size: this.cache.size,
            memoryUsage: this.estimateMemoryUsage(),
        };
    }
    /**
     * Evict expired entries
     */
    evictExpired() {
        const now = new Date();
        let evicted = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (now >= entry.expiresAt) {
                this.cache.delete(key);
                evicted++;
            }
        }
        if (evicted > 0) {
            logger.debug(`[CacheManager] Evicted ${evicted} expired entries`);
        }
        return evicted;
    }
    /**
     * Evict least recently used entry
     */
    evictLRU() {
        let oldestKey = null;
        let oldestTime = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (entry.lastAccessed.getTime() < oldestTime) {
                oldestTime = entry.lastAccessed.getTime();
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this.cache.delete(oldestKey);
            logger.debug(`[CacheManager] Evicted LRU entry: ${oldestKey}`);
        }
    }
    estimateMemoryUsage() {
        // Rough estimation
        return this.cache.size * 1024; // 1KB per entry estimate
    }
    /**
     * Start automatic cleanup
     */
    startAutoCleanup(intervalMs = 60000) {
        setInterval(() => {
            this.evictExpired();
        }, intervalMs);
        logger.info('[CacheManager] Auto cleanup started');
    }
}
/**
 * Specialized cache for indicators
 */
export class IndicatorCache {
    constructor() {
        Object.defineProperty(this, "cache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.cache = new CacheManager({
            maxSize: 1000,
            defaultTTL: 5 * 60 * 1000, // 5 minutes
        });
    }
    async getIndicator(indicator, symbol, timeframe, params, calculator) {
        const key = `${indicator}_${symbol}_${timeframe}_${JSON.stringify(params)}`;
        return await this.cache.get(key, calculator);
    }
    invalidate(symbol, timeframe) {
        // Invalidate all indicators for this symbol/timeframe
        for (const [key] of this.cache['cache'].entries()) {
            if (key.includes(`${symbol}_${timeframe}`)) {
                this.cache.delete(key);
            }
        }
    }
    getStats() {
        return this.cache.getStats();
    }
}
/**
 * Specialized cache for market data
 */
export class MarketDataCache {
    constructor() {
        Object.defineProperty(this, "cache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.cache = new CacheManager({
            maxSize: 100,
            defaultTTL: 1 * 60 * 1000, // 1 minute
        });
    }
    async getMarketData(symbol, timeframe, bars, fetcher) {
        const key = `${symbol}_${timeframe}_${bars}`;
        return await this.cache.get(key, fetcher, 30000); // 30 seconds TTL for market data
    }
    getStats() {
        return this.cache.getStats();
    }
}
