import { Redis } from 'ioredis';
import { getEnvVar } from './env-validator';

// Rate limit tiers based on user subscription or role
export enum RateLimitTier {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}

// Rate limit configurations for different tiers
const RATE_LIMIT_CONFIGS = {
  [RateLimitTier.FREE]: {
    api: { windowMs: 60000, maxRequests: 100 }, // 100 requests per minute
    login: { windowMs: 900000, maxRequests: 5 }, // 5 attempts per 15 minutes
    trading: { windowMs: 60000, maxRequests: 10 }, // 10 trades per minute
  },
  [RateLimitTier.BASIC]: {
    api: { windowMs: 60000, maxRequests: 500 }, // 500 requests per minute
    login: { windowMs: 900000, maxRequests: 10 }, // 10 attempts per 15 minutes
    trading: { windowMs: 60000, maxRequests: 20 }, // 20 trades per minute
  },
  [RateLimitTier.PREMIUM]: {
    api: { windowMs: 60000, maxRequests: 1000 }, // 1000 requests per minute
    login: { windowMs: 900000, maxRequests: 15 }, // 15 attempts per 15 minutes
    trading: { windowMs: 60000, maxRequests: 50 }, // 50 trades per minute
  },
  [RateLimitTier.ENTERPRISE]: {
    api: { windowMs: 60000, maxRequests: 5000 }, // 5000 requests per minute
    login: { windowMs: 900000, maxRequests: 20 }, // 20 attempts per 15 minutes
    trading: { windowMs: 60000, maxRequests: 100 }, // 100 trades per minute
  },
};

// Rate limit types
export enum RateLimitType {
  API = 'api',
  LOGIN = 'login',
  TRADING = 'trading',
}

// Rate limit result interface
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number; // Seconds to wait before retry
}

// Redis client instance
let redisClient: Redis | null = null;

/**
 * Initialize Redis connection for rate limiting
 */
function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = getEnvVar('REDIS_URL');
    const redisHost = getEnvVar('REDIS_HOST');
    const redisPort = getEnvVar('REDIS_PORT');
    const redisPassword = getEnvVar('REDIS_PASSWORD');
    const upstashUrl = getEnvVar('UPSTASH_REDIS_REST_URL');
    const upstashToken = getEnvVar('UPSTASH_REDIS_REST_TOKEN');

    if (upstashUrl && upstashToken) {
      // Use Upstash Redis (REST API)
      // Note: For production, you might want to use a proper Upstash client
      throw new Error('Upstash Redis REST API not implemented yet. Please use Redis URL instead.');
    } else if (redisUrl) {
      // Use Redis URL
      redisClient = new Redis(redisUrl);
    } else if (redisHost && redisPort) {
      // Use individual Redis connection parameters
      redisClient = new Redis({
        host: redisHost,
        port: parseInt(redisPort),
        password: redisPassword || undefined,
        maxRetriesPerRequest: 3,
      });
    } else {
      // Fallback to in-memory storage (not recommended for production)
      console.warn('Redis not configured, falling back to in-memory rate limiting');
      redisClient = null;
    }
  }

  return redisClient;
}

/**
 * Check if a request is within rate limits
 * @param identifier - Unique identifier (IP, userId, etc.)
 * @param type - Type of rate limit to check
 * @param tier - User's rate limit tier
 * @returns RateLimitResult
 */
export async function checkRateLimit(
  identifier: string,
  type: RateLimitType,
  tier: RateLimitTier = RateLimitTier.FREE
): Promise<RateLimitResult> {
  const config = RATE_LIMIT_CONFIGS[tier][type];
  const key = `rate_limit:${type}:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    const redis = getRedisClient();
    
    if (redis) {
      // Use Redis for distributed rate limiting
      return await checkRateLimitWithRedis(redis, key, config, now);
    } else {
      // Fallback to in-memory rate limiting
      return checkRateLimitInMemory(key, config, now);
    }
  } catch (error) {
    console.error('Rate limiting error:', error);
    // Fail open - allow the request but log the error
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      resetTime: new Date(now + config.windowMs),
    };
  }
}

/**
 * Check rate limit using Redis
 */
async function checkRateLimitWithRedis(
  redis: Redis,
  key: string,
  config: { windowMs: number; maxRequests: number },
  now: number
): Promise<RateLimitResult> {
  const pipeline = redis.pipeline();
  
  // Remove expired entries
  pipeline.zremrangebyscore(key, 0, now - config.windowMs);
  
  // Count current requests
  pipeline.zcard(key);
  
  // Add current request
  pipeline.zadd(key, now, `${now}-${Math.random()}`);
  
  // Set expiration
  pipeline.expire(key, Math.ceil(config.windowMs / 1000));
  
  const results = await pipeline.exec();
  
  if (!results) {
    throw new Error('Redis pipeline execution failed');
  }
  
  const currentCount = results[1][1] as number;
  const isAllowed = currentCount < config.maxRequests;
  
  return {
    success: isAllowed,
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - currentCount - (isAllowed ? 1 : 0)),
    resetTime: new Date(now + config.windowMs),
    retryAfter: isAllowed ? undefined : Math.ceil(config.windowMs / 1000),
  };
}

// In-memory fallback storage
const inMemoryStore = new Map<string, { timestamps: number[]; lastReset: number }>();

/**
 * Check rate limit using in-memory storage
 */
function checkRateLimitInMemory(
  key: string,
  config: { windowMs: number; maxRequests: number },
  now: number
): RateLimitResult {
  const existing = inMemoryStore.get(key);
  
  if (!existing || now - existing.lastReset > config.windowMs) {
    // Reset the window
    inMemoryStore.set(key, {
      timestamps: [now],
      lastReset: now,
    });
    
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      resetTime: new Date(now + config.windowMs),
    };
  }
  
  // Remove expired timestamps
  const validTimestamps = existing.timestamps.filter(
    timestamp => now - timestamp < config.windowMs
  );
  
  const isAllowed = validTimestamps.length < config.maxRequests;
  
  if (isAllowed) {
    validTimestamps.push(now);
  }
  
  inMemoryStore.set(key, {
    timestamps: validTimestamps,
    lastReset: existing.lastReset,
  });
  
  return {
    success: isAllowed,
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - validTimestamps.length),
    resetTime: new Date(existing.lastReset + config.windowMs),
    retryAfter: isAllowed ? undefined : Math.ceil(config.windowMs / 1000),
  };
}

/**
 * Get user's rate limit tier based on their subscription
 * @param userId - User ID
 * @returns User's rate limit tier
 */
export async function getUserRateLimitTier(userId: string): Promise<RateLimitTier> {
  try {
    // In a real implementation, you would fetch the user's subscription from the database
    // For now, we'll default to PREMIUM tier
    return RateLimitTier.PREMIUM;
    
    // Example implementation:
    // const user = await prisma.user.findUnique({
    //   where: { id: userId },
    //   include: { subscription: true }
    // });
    // 
    // if (!user?.subscription) {
    //   return RateLimitTier.FREE;
    // }
    // 
    // switch (user.subscription.planId) {
    //   case 'basic':
    //     return RateLimitTier.BASIC;
    //   case 'premium':
    //     return RateLimitTier.PREMIUM;
    //   case 'enterprise':
    //     return RateLimitTier.ENTERPRISE;
    //   default:
    //     return RateLimitTier.FREE;
    // }
  } catch (error) {
    console.error('Error fetching user rate limit tier:', error);
    return RateLimitTier.FREE;
  }
}

/**
 * Express middleware for rate limiting
 * @param type - Type of rate limit to apply
 * @param getIdentifier - Function to extract identifier from request
 * @returns Express middleware function
 */
export function createRateLimitMiddleware(
  type: RateLimitType,
  getIdentifier: (req: any) => string | Promise<string>
) {
  return async (req: any, res: any, next: any) => {
    try {
      const identifier = await getIdentifier(req);
      const userId = req.user?.id;
      
      // Get user's rate limit tier
      const tier = userId ? await getUserRateLimitTier(userId) : RateLimitTier.FREE;
      
      // Check rate limit
      const result = await checkRateLimit(identifier, type, tier);
      
      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetTime.toISOString(),
      });
      
      if (!result.success) {
        res.set('Retry-After', result.retryAfter?.toString() || '60');
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter,
        });
      }
      
      next();
    } catch (error) {
      console.error('Rate limiting middleware error:', error);
      // Fail open - allow the request
      next();
    }
  };
}

/**
 * Reset rate limit for a specific identifier
 * @param identifier - Unique identifier
 * @param type - Type of rate limit to reset
 */
export async function resetRateLimit(
  identifier: string,
  type: RateLimitType
): Promise<void> {
  const key = `rate_limit:${type}:${identifier}`;
  
  try {
    const redis = getRedisClient();
    
    if (redis) {
      await redis.del(key);
    } else {
      inMemoryStore.delete(key);
    }
  } catch (error) {
    console.error('Error resetting rate limit:', error);
  }
}

export default {
  checkRateLimit,
  getUserRateLimitTier,
  createRateLimitMiddleware,
  resetRateLimit,
  RateLimitTier,
  RateLimitType,
};