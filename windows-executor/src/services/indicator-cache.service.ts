/**
 * Indicator Cache Service
 * Caches calculated indicator values to improve performance
 */

import { logger } from '../utils/logger';
import { IndicatorType, IndicatorParams, Timeframe } from '../types/strategy.types';

interface CacheKey {
  symbol: string;
  timeframe: Timeframe;
  indicator: IndicatorType;
  params: string; // JSON stringified params
}

interface CacheEntry {
  value: number | any;
  timestamp: number;
  barCount: number;
}

export class IndicatorCacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private cacheLifetime: number = 60000; // 1 minute
  private maxCacheSize: number = 1000;
  private hits: number = 0;
  private misses: number = 0;

  /**
   * Get cached indicator value
   */
  get(
    symbol: string,
    timeframe: Timeframe,
    indicator: IndicatorType,
    params: IndicatorParams,
    currentBarCount: number
  ): number | any | null {
    
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
    logger.debug(`[IndicatorCache] HIT: ${key}`);
    
    return entry.value;
  }

  /**
   * Set cache value
   */
  set(
    symbol: string,
    timeframe: Timeframe,
    indicator: IndicatorType,
    params: IndicatorParams,
    value: number | any,
    barCount: number
  ): void {
    
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

    logger.debug(`[IndicatorCache] SET: ${key}`);
  }

  /**
   * Clear cache for a specific symbol
   */
  clearSymbol(symbol: string): void {
    let count = 0;

    for (const [key, _] of this.cache.entries()) {
      if (key.startsWith(symbol)) {
        this.cache.delete(key);
        count++;
      }
    }

    logger.info(`[IndicatorCache] Cleared ${count} entries for ${symbol}`);
  }

  /**
   * Clear cache for a specific timeframe
   */
  clearTimeframe(timeframe: Timeframe): void {
    let count = 0;

    for (const [key, _] of this.cache.entries()) {
      if (key.includes(`_${timeframe}_`)) {
        this.cache.delete(key);
        count++;
      }
    }

    logger.info(`[IndicatorCache] Cleared ${count} entries for ${timeframe}`);
  }

  /**
   * Clear entire cache
   */
  clearAll(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;

    logger.info(`[IndicatorCache] Cleared ${size} entries`);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
    maxSize: number;
  } {
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
  setCacheLifetime(milliseconds: number): void {
    this.cacheLifetime = milliseconds;
    logger.info(`[IndicatorCache] Cache lifetime set to ${milliseconds}ms`);
  }

  /**
   * Set max cache size
   */
  setMaxCacheSize(size: number): void {
    this.maxCacheSize = size;
    logger.info(`[IndicatorCache] Max cache size set to ${size}`);
  }

  /**
   * Generate cache key
   */
  private generateKey(
    symbol: string,
    timeframe: Timeframe,
    indicator: IndicatorType,
    params: IndicatorParams
  ): string {
    const paramsStr = JSON.stringify(params, Object.keys(params).sort());
    return `${symbol}_${timeframe}_${indicator}_${paramsStr}`;
  }

  /**
   * Evict oldest cache entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug(`[IndicatorCache] Evicted oldest entry: ${oldestKey}`);
    }
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): number {
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
      logger.info(`[IndicatorCache] Cleaned ${cleaned} expired entries`);
    }

    return cleaned;
  }

  /**
   * Start periodic cleanup
   */
  startPeriodicCleanup(intervalMs: number = 300000): void {
    setInterval(() => {
      this.cleanExpired();
    }, intervalMs);

    logger.info(`[IndicatorCache] Periodic cleanup started (every ${intervalMs}ms)`);
  }
}
