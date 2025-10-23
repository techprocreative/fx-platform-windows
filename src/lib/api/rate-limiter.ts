/**
 * API RATE LIMITING
 * Provides rate limiting functionality for API endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleRateLimitError } from './error-handler';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

/**
 * Rate limit entry
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastAccess: number;
}

/**
 * In-memory rate limit store (in production, use Redis or similar)
 */
class RateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  
  get(key: string): RateLimitEntry | undefined {
    return this.store.get(key);
  }
  
  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry);
  }
  
  delete(key: string): boolean {
    return this.store.delete(key);
  }
  
  // Get all entries (for statistics)
  getAllEntries(): Map<string, RateLimitEntry> {
    return new Map(this.store);
  }
  
  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

// Global rate limit store instance
const rateLimitStore = new RateLimitStore();

// Cleanup expired entries every minute
setInterval(() => rateLimitStore.cleanup(), 60 * 1000);

/**
 * Create rate limiter middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    const key = config.keyGenerator 
      ? config.keyGenerator(request)
      : generateDefaultKey(request);
    
    const now = Date.now();
    let entry = rateLimitStore.get(key);
    
    // Initialize or reset entry if needed
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + config.windowMs,
        lastAccess: now
      };
      rateLimitStore.set(key, entry);
    }
    
    // Increment request count
    entry.count++;
    entry.lastAccess = now;
    rateLimitStore.set(key, entry);
    
    // Check if rate limit exceeded
    if (entry.count > config.maxRequests) {
      const resetTime = new Date(entry.resetTime);
      return handleRateLimitError(resetTime);
    }
    
    // Add rate limit headers to response
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', config.maxRequests.toString());
    headers.set('X-RateLimit-Remaining', Math.max(0, config.maxRequests - entry.count).toString());
    headers.set('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString());
    
    return null; // Continue to the actual handler
  };
}

/**
 * Generate default rate limit key
 */
function generateDefaultKey(request: NextRequest): string {
  const url = new URL(request.url);
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  // Create a hash from IP and user agent for basic identification
  return `rate_limit_${ip}_${userAgent.substring(0, 50)}`;
}

/**
 * Predefined rate limit configurations
 */
export const RateLimitConfigs = {
  // Very restrictive for sensitive endpoints
  STRICT: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  } as RateLimitConfig,
  
  // Standard for most endpoints
  STANDARD: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  } as RateLimitConfig,
  
  // Lenient for data endpoints
  LENIENT: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 120,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  } as RateLimitConfig,
  
  // Very lenient for public endpoints
  PUBLIC: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 300,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  } as RateLimitConfig,
  
  // Based on user ID for authenticated users
  USER_BASED: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    keyGenerator: (request: NextRequest) => {
      // Try to get user ID from headers or auth token
      const userId = request.headers.get('x-user-id') || 'anonymous';
      return `user_rate_limit_${userId}`;
    },
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  } as RateLimitConfig
};

/**
 * Apply rate limiting to an API handler
 */
export function withRateLimit(
  config: RateLimitConfig,
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  const rateLimiter = createRateLimiter(config);
  
  return async (request: NextRequest): Promise<NextResponse> => {
    // Check rate limit
    const rateLimitResponse = await rateLimiter(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    // Execute the actual handler
    const response = await handler(request);
    
    // Add rate limit headers to the response
    const key = config.keyGenerator 
      ? config.keyGenerator(request)
      : generateDefaultKey(request);
    
    const entry = rateLimitStore.get(key);
    if (entry) {
      response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
      response.headers.set('X-RateLimit-Remaining', Math.max(0, config.maxRequests - entry.count).toString());
      response.headers.set('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString());
    }
    
    return response;
  };
}

/**
 * Check current rate limit status for a request
 */
export function getRateLimitStatus(request: NextRequest, config: RateLimitConfig): {
  limit: number;
  remaining: number;
  resetTime: Date;
  isExceeded: boolean;
} | null {
  const key = config.keyGenerator 
    ? config.keyGenerator(request)
    : generateDefaultKey(request);
  
  const entry = rateLimitStore.get(key);
  if (!entry) {
    return null;
  }
  
  return {
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetTime: new Date(entry.resetTime),
    isExceeded: entry.count > config.maxRequests
  };
}

/**
 * Reset rate limit for a specific key
 */
export function resetRateLimit(key: string): boolean {
  return rateLimitStore.delete(key);
}

/**
 * Get rate limit statistics
 */
export function getRateLimitStats(): {
  totalEntries: number;
  activeEntries: number;
  entriesByHour: Record<string, number>;
} {
  const now = Date.now();
  const entries = Array.from(rateLimitStore.getAllEntries().values());
  
  const totalEntries = entries.length;
  const activeEntries = entries.filter(entry => now < entry.resetTime).length;
  
  // Group entries by hour
  const entriesByHour: Record<string, number> = {};
  for (const entry of entries) {
    const hour = new Date(entry.lastAccess).getHours();
    entriesByHour[hour] = (entriesByHour[hour] || 0) + 1;
  }
  
  return {
    totalEntries,
    activeEntries,
    entriesByHour
  };
}