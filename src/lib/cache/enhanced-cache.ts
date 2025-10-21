import { unstable_cache } from 'next/cache';
import { revalidateTag } from 'next/cache';

// Enhanced cache configuration
interface CacheConfig {
  ttl: number; // Time to live in seconds
  tags: string[];
  revalidateOnFocus?: boolean;
  revalidateOnReconnect?: boolean;
}

// Cache configurations for different data types
const CACHE_CONFIGS = {
  // Market data - short TTL as it changes frequently
  marketData: {
    ttl: 60, // 1 minute
    tags: ['market-data'],
  },
  
  // Strategy performance - medium TTL
  strategyPerformance: {
    ttl: 300, // 5 minutes
    tags: ['strategy-performance'],
  },
  
  // User preferences - long TTL
  userPreferences: {
    ttl: 3600, // 1 hour
    tags: ['user-preferences'],
  },
  
  // Strategy list - medium TTL
  strategyList: {
    ttl: 180, // 3 minutes
    tags: ['strategy-list'],
  },
  
  // Backtest results - long TTL (historical data doesn't change)
  backtestResults: {
    ttl: 86400, // 24 hours
    tags: ['backtest-results'],
  },
  
  // System stats - short TTL
  systemStats: {
    ttl: 120, // 2 minutes
    tags: ['system-stats'],
  },
} as const;

type CacheKey = keyof typeof CACHE_CONFIGS;

// Enhanced cache wrapper with TTL and tagging
function createEnhancedCache<T>(
  key: CacheKey,
  fetcher: (...args: any[]) => Promise<T>,
  customConfig?: Partial<CacheConfig>
) {
  const config = { ...CACHE_CONFIGS[key], ...customConfig };
  
  return unstable_cache(
    async (...args: any[]) => {
      try {
        const result = await fetcher(...args);
        return result;
      } catch (error) {
        console.error(`Cache fetch error for ${key}:`, error);
        throw error;
      }
    },
    [key, ...config.tags],
    {
      revalidate: config.ttl,
      tags: [...config.tags],
    }
  );
}

// Market data cache functions
export const getCachedMarketData = createEnhancedCache(
  'marketData',
  async (symbol: string, timeframe: string, startDate: string, endDate: string) => {
    // This would typically fetch from your market data provider
    // For now, we'll simulate the fetch
    const response = await fetch(`/api/market-data?symbol=${symbol}&timeframe=${timeframe}&start=${startDate}&end=${endDate}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch market data: ${response.statusText}`);
    }
    return response.json();
  }
);

// Strategy performance cache functions
export const getCachedStrategyPerformance = createEnhancedCache(
  'strategyPerformance',
  async (strategyId: string, timeRange?: string) => {
    const response = await fetch(`/api/strategies/${strategyId}/performance${timeRange ? `?range=${timeRange}` : ''}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch strategy performance: ${response.statusText}`);
    }
    return response.json();
  }
);

// User preferences cache functions
export const getCachedUserPreferences = createEnhancedCache(
  'userPreferences',
  async (userId: string) => {
    const response = await fetch(`/api/user/preferences`);
    if (!response.ok) {
      throw new Error(`Failed to fetch user preferences: ${response.statusText}`);
    }
    return response.json();
  }
);

// Strategy list cache functions (enhanced version of the existing one)
export const getCachedStrategyListEnhanced = createEnhancedCache(
  'strategyList',
  async (userId: string, filters: {
    status?: string;
    symbol?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });
    
    const response = await fetch(`/api/strategy?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch strategy list: ${response.statusText}`);
    }
    return response.json();
  }
);

// Backtest results cache functions
export const getCachedBacktestResults = createEnhancedCache(
  'backtestResults',
  async (backtestId: string) => {
    const response = await fetch(`/api/backtest/${backtestId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch backtest results: ${response.statusText}`);
    }
    return response.json();
  }
);

// System stats cache functions
export const getCachedSystemStats = createEnhancedCache(
  'systemStats',
  async () => {
    const response = await fetch('/api/system/stats');
    if (!response.ok) {
      throw new Error(`Failed to fetch system stats: ${response.statusText}`);
    }
    return response.json();
  }
);

// Cache invalidation functions
export function invalidateMarketData(symbol?: string) {
  const tags = ['market-data'];
  if (symbol) {
    tags.push(`market-data:${symbol}`);
  }
  tags.forEach(tag => revalidateTag(tag));
}

export function invalidateStrategyPerformance(strategyId?: string) {
  const tags = ['strategy-performance'];
  if (strategyId) {
    tags.push(`strategy-performance:${strategyId}`);
  }
  tags.forEach(tag => revalidateTag(tag));
}

export function invalidateUserPreferences(userId: string) {
  revalidateTag('user-preferences');
  revalidateTag(`user-preferences:${userId}`);
}

export function invalidateStrategyList(userId: string) {
  revalidateTag('strategy-list');
  revalidateTag(`strategy-list:${userId}`);
}

export function invalidateBacktestResults(backtestId?: string) {
  const tags = ['backtest-results'];
  if (backtestId) {
    tags.push(`backtest-results:${backtestId}`);
  }
  tags.forEach(tag => revalidateTag(tag));
}

export function invalidateSystemStats() {
  revalidateTag('system-stats');
}

// Batch invalidation function
export function invalidateCache(tags: string[]) {
  tags.forEach(tag => revalidateTag(tag));
}

// Memory cache for frequently accessed data (fallback)
class MemoryCache {
  private cache = new Map<string, { data: any; expiry: number }>();
  
  set(key: string, data: any, ttl: number = 300): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl * 1000,
    });
  }
  
  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

// Global memory cache instance
export const memoryCache = new MemoryCache();

// Clean up memory cache periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    memoryCache.cleanup();
  }, 60000); // Clean up every minute
}

// Hybrid cache function that tries memory cache first, then persistent cache
export async function getHybridCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 300,
  persistentCacheKey?: CacheKey
): Promise<T> {
  // Try memory cache first
  const memoryResult = memoryCache.get(key);
  if (memoryResult !== null) {
    return memoryResult;
  }
  
  // Try persistent cache
  if (persistentCacheKey) {
    try {
      const persistentFetcher = createEnhancedCache(persistentCacheKey, fetcher);
      const result = await persistentFetcher();
      
      // Store in memory cache for faster access
      memoryCache.set(key, result, Math.min(ttl, CACHE_CONFIGS[persistentCacheKey].ttl));
      
      return result;
    } catch (error) {
      console.error('Persistent cache error, falling back to direct fetch:', error);
    }
  }
  
  // Fallback to direct fetch
  const result = await fetcher();
  memoryCache.set(key, result, ttl);
  return result;
}