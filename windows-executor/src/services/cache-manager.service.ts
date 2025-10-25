/**
 * Cache Manager Service
 * High-performance caching for indicators, market data, and calculations
 */

import { logger } from '../utils/logger';

interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: Date;
  expiresAt: Date;
  hits: number;
  lastAccessed: Date;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  memoryUsage: number;
}

export class CacheManager<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private defaultTTL: number;
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor(options?: {
    maxSize?: number;
    defaultTTL?: number;
  }) {
    this.maxSize = options?.maxSize || 1000;
    this.defaultTTL = options?.defaultTTL || 5 * 60 * 1000; // 5 minutes

    logger.debug(`[CacheManager] Initialized (maxSize: ${this.maxSize}, TTL: ${this.defaultTTL}ms)`);
  }

  /**
   * Get value from cache or calculate if not cached
   */
  async get(
    key: string,
    calculator: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
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
  async set(key: string, value: T, ttl?: number): Promise<void> {
    const expiresAt = new Date(Date.now() + (ttl || this.defaultTTL));

    const entry: CacheEntry<T> = {
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
  has(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    
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
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    logger.info('[CacheManager] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
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
  evictExpired(): number {
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
  private evictLRU(): void {
    let oldestKey: string | null = null;
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

  private estimateMemoryUsage(): number {
    // Rough estimation
    return this.cache.size * 1024; // 1KB per entry estimate
  }

  /**
   * Start automatic cleanup
   */
  startAutoCleanup(intervalMs: number = 60000): void {
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
  private cache: CacheManager<any>;

  constructor() {
    this.cache = new CacheManager({
      maxSize: 1000,
      defaultTTL: 5 * 60 * 1000, // 5 minutes
    });
  }

  async getIndicator(
    indicator: string,
    symbol: string,
    timeframe: string,
    params: any,
    calculator: () => Promise<any>
  ): Promise<any> {
    const key = `${indicator}_${symbol}_${timeframe}_${JSON.stringify(params)}`;
    return await this.cache.get(key, calculator);
  }

  invalidate(symbol: string, timeframe: string): void {
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
  private cache: CacheManager<any>;

  constructor() {
    this.cache = new CacheManager({
      maxSize: 100,
      defaultTTL: 1 * 60 * 1000, // 1 minute
    });
  }

  async getMarketData(
    symbol: string,
    timeframe: string,
    bars: number,
    fetcher: () => Promise<any>
  ): Promise<any> {
    const key = `${symbol}_${timeframe}_${bars}`;
    return await this.cache.get(key, fetcher, 30000); // 30 seconds TTL for market data
  }

  getStats() {
    return this.cache.getStats();
  }
}
