import { EnhancedMarketData } from '@/lib/backtest/engine';

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum cache size
  compressionEnabled: boolean;
}

export interface CacheKey {
  symbol: string;
  interval: string;
  startDate: string;
  endDate: string;
  source: 'twelvedata' | 'yahoo';
}

export interface CachedMarketData {
  data: EnhancedMarketData[];
  timestamp: number; // When data was cached
  source: string;
  expiresAt: number; // When cache expires
  metadata: {
    totalPoints: number;
    dateRange: {
      start: string;
      end: string;
    };
  };
}

// Cache configuration
const CACHE_CONFIG: CacheConfig = {
  ttl: 4 * 60 * 60, // 4 hours for hourly data
  maxSize: 1000, // Maximum number of cached datasets
  compressionEnabled: true,
};

const CACHE_KEYS = {
  PREFIX: 'fx_market_data:',
  METADATA: 'fx_cache_metadata',
  STATS: 'fx_cache_stats',
} as const;

// TTL configurations based on intervals (in seconds)
const INTERVAL_TTL: Record<string, number> = {
  '1min': 5 * 60, // 5 minutes - very short term
  '5min': 15 * 60, // 15 minutes
  '15min': 30 * 60, // 30 minutes
  '30min': 1 * 60 * 60, // 1 hour
  '1h': 4 * 60 * 60, // 4 hours
  '4h': 24 * 60 * 60, // 24 hours
  '1d': 7 * 24 * 60 * 60, // 7 days
  '1w': 30 * 24 * 60 * 60, // 30 days
};

export class MarketDataCache {
  private redis: any;
  private isRedisAvailable: boolean = false;

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      // Try Upstash Redis first (recommended for Vercel)
      if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        const { Redis } = await import('@upstash/redis');
        this.redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        this.isRedisAvailable = true;
        console.log('✅ Upstash Redis initialized for market data cache');
        console.log(`🔗 Cache endpoint: ${process.env.UPSTASH_REDIS_REST_URL}`);
        return;
      }

      // Fallback to standard Redis
      if (process.env.REDIS_URL) {
        const redis = await import('redis');
        this.redis = redis.createClient({
          url: process.env.REDIS_URL,
        });
        await this.redis.connect();
        this.isRedisAvailable = true;
        console.log('✅ Redis initialized for market data cache');
        return;
      }

      console.log('⚠️  No Redis configuration found. Using in-memory cache fallback.');
    } catch (error) {
      console.error('Redis initialization failed:', error);
      console.log('⚠️  Using in-memory cache fallback');
    }
  }

  // Generate cache key
  private generateCacheKey(key: CacheKey): string {
    const keyString = `${key.symbol}_${key.interval}_${key.startDate}_${key.endDate}_${key.source}`;
    return `${CACHE_KEYS.PREFIX}${Buffer.from(keyString).toString('base64')}`;
  }

  // Parse cache key back to components (for debugging)
  private parseCacheKey(cacheKey: string): CacheKey | null {
    try {
      const encoded = cacheKey.replace(CACHE_KEYS.PREFIX, '');
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      const [symbol, interval, startDate, endDate, source] = decoded.split('_');
      
      return {
        symbol,
        interval,
        startDate,
        endDate,
        source: source as 'twelvedata' | 'yahoo',
      };
    } catch {
      return null;
    }
  }

  // Compress data for storage
  private compressData(data: EnhancedMarketData[]): string {
    if (!CACHE_CONFIG.compressionEnabled) {
      return JSON.stringify(data);
    }

    // Simple compression by removing redundant fields and precision
    const compressed = data.map(candle => ({
      t: candle.timestamp.getTime(), // timestamp
      o: candle.open,
      h: candle.high,
      l: candle.low,
      c: candle.close,
      v: candle.volume,
      s: candle.symbol,
      i: candle.interval,
    }));

    return JSON.stringify(compressed);
  }

  // Decompress data from storage
  private decompressData(compressed: string): EnhancedMarketData[] {
    const data = JSON.parse(compressed);
    
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && 't' in data[0]) {
      // Decompressed format
      return data.map((item: any) => ({
        timestamp: new Date(item.t),
        open: item.o,
        high: item.h,
        low: item.l,
        close: item.c,
        volume: item.v,
        symbol: item.s,
        interval: item.i,
        currency: 'USD',
        exchange: 'CACHED',
      }));
    }
    
    // Original format (not compressed)
    return data.map((item: any) => ({
      ...item,
      timestamp: new Date(item.timestamp),
      currency: item.currency || 'USD',
      exchange: item.exchange || 'CACHED',
    }));
  }

  // Get TTL based on interval
  private getTTL(interval: string): number {
    return INTERVAL_TTL[interval] || CACHE_CONFIG.ttl;
  }

  // Store market data in cache
  async set(
    key: CacheKey,
    data: EnhancedMarketData[],
    source: string
  ): Promise<void> {
    if (!this.isRedisAvailable) {
      console.log('Cache not available, skipping cache set');
      return;
    }

    try {
      const cacheKey = this.generateCacheKey(key);
      const ttl = this.getTTL(key.interval);
      const now = Date.now();
      
      const cacheData: CachedMarketData = {
        data,
        timestamp: now,
        source,
        expiresAt: now + (ttl * 1000),
        metadata: {
          totalPoints: data.length,
          dateRange: {
            start: key.startDate,
            end: key.endDate,
          },
        },
      };

      const compressedData = this.compressData(data);
      
      await this.redis.setex(
        cacheKey,
        ttl,
        JSON.stringify({
          cached: cacheData,
          compressed: compressedData,
        })
      );

      // Update cache metadata
      await this.updateCacheStats('set', key.interval, data.length);
      
      console.log(`🎯 Cached ${data.length} data points for ${key.symbol} ${key.interval} (TTL: ${ttl}s)`);
      
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  // Retrieve market data from cache
  async get(key: CacheKey): Promise<EnhancedMarketData[] | null> {
    if (!this.isRedisAvailable) {
      console.log('Cache not available, returning null');
      return null;
    }

    try {
      const cacheKey = this.generateCacheKey(key);
      
      const cached = await this.redis.get(cacheKey);
      
      if (!cached) {
        console.log(`💨 Cache miss for ${key.symbol} ${key.interval}`);
        return null;
      }

      const parsed = JSON.parse(cached);
      const cacheData: CachedMarketData = parsed.cached;
      
      // Check if cache is expired
      if (Date.now() > cacheData.expiresAt) {
        console.log(`⏰ Cache expired for ${key.symbol} ${key.interval}`);
        await this.delete(key);
        return null;
      }

      const data = this.decompressData(parsed.compressed);
      
      console.log(`🎯 Cache hit: ${cacheData.metadata.totalPoints} data points for ${key.symbol} ${key.interval}`);
      
      // Update cache stats
      await this.updateCacheStats('get', key.interval, data.length);
      
      return data;
      
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  // Delete cache entry
  async delete(key: CacheKey): Promise<void> {
    if (!this.isRedisAvailable) return;

    try {
      const cacheKey = this.generateCacheKey(key);
      await this.redis.del(cacheKey);
      console.log(`🗑️  Deleted cache: ${key.symbol} ${key.interval}`);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  // Clear all cache
  async clear(): Promise<void> {
    if (!this.isRedisAvailable) return;

    try {
      const pattern = `${CACHE_KEYS.PREFIX}*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`🗑️  Cleared ${keys.length} cache entries`);
      }
      
      // Reset stats
      await this.redis.del(CACHE_KEYS.STATS);
      
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  // Update cache statistics
  private async updateCacheStats(operation: 'set' | 'get', interval: string, dataPoints: number): Promise<void> {
    if (!this.isRedisAvailable) return;

    try {
      const statsKey = `${CACHE_KEYS.STATS}:${interval}`;
      const current = await this.redis.hgetall(statsKey);
      
      if (operation === 'set') {
        await this.redis.hincrby(statsKey, 'sets', 1);
        await this.redis.hincrby(statsKey, 'total_data_points', dataPoints);
      } else {
        await this.redis.hincrby(statsKey, 'gets', 1);
        await this.redis.hincrby(statsKey, 'cache_hits', 1);
      }
      
      await this.redis.hset(statsKey, 'last_updated', Date.now());
    } catch (error) {
      console.error('Cache stats update error:', error);
    }
  }

  // Get cache statistics
  async getStats(): Promise<any> {
    if (!this.isRedisAvailable) {
      return { message: 'Cache not available' };
    }

    try {
      const pattern = `${CACHE_KEYS.STATS}:*`;
      const keys = await this.redis.keys(pattern);
      const stats: any = {};

      for (const key of keys) {
        const interval = key.replace(`${CACHE_KEYS.STATS}:`, '');
        stats[interval] = await this.redis.hgetall(key);
      }

      // Get total cache size
      const allKeys = await this.redis.keys(`${CACHE_KEYS.PREFIX}*`);
      const totalSize = allKeys.length;

      return {
        totalEntries: totalSize,
        maxEntries: CACHE_CONFIG.maxSize,
        intervals: stats,
        cacheEnabled: this.isRedisAvailable,
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return { error: 'Failed to get cache stats' };
    }
  }

  // Check cache availability
  isAvailable(): boolean {
    return this.isRedisAvailable;
  }

  // Preload common data (optional)
  async preloadCommonData(): Promise<void> {
    if (!this.isRedisAvailable) return;

    console.log('🚀 Preloading common market data...');
    
    const commonPairs = [
      { symbol: 'EUR/USD', interval: '1h', days: 30 },
      { symbol: 'GBP/USD', interval: '1h', days: 30 },
      { symbol: 'USD/JPY', interval: '1h', days: 30 },
      { symbol: 'EUR/USD', interval: '4h', days: 90 },
      { symbol: 'GBP/USD', interval: '4h', days: 90 },
    ];

    for (const pair of commonPairs) {
      console.log(`Preloading ${pair.symbol} ${pair.interval}...`);
      // This would trigger fetching and caching via the main data fetcher
      // Implementation would depend on how you want to trigger the fetch
    }
    
    console.log('✅ Preloading completed');
  }
}

// Singleton instance
export const marketDataCache = new MarketDataCache();
