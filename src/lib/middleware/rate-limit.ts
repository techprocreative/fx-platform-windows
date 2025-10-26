import { NextRequest, NextResponse } from 'next/server';
import { BETA_CONFIG } from '@/config/beta.config';

/**
 * Simple in-memory rate limiter
 * For production, use Redis or similar
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private records: Map<string, RateLimitRecord> = new Map();
  
  constructor(
    private windowMs: number,
    private maxRequests: number
  ) {
    // Cleanup old records every minute
    setInterval(() => this.cleanup(), 60000);
  }
  
  check(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const record = this.records.get(identifier);
    
    // No record or expired
    if (!record || now > record.resetTime) {
      const newRecord: RateLimitRecord = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      this.records.set(identifier, newRecord);
      
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: newRecord.resetTime,
      };
    }
    
    // Check if limit exceeded
    if (record.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
      };
    }
    
    // Increment count
    record.count++;
    
    return {
      allowed: true,
      remaining: this.maxRequests - record.count,
      resetTime: record.resetTime,
    };
  }
  
  private cleanup() {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      if (now > record.resetTime) {
        this.records.delete(key);
      }
    }
  }
}

// Create rate limiters
const apiLimiter = new RateLimiter(
  BETA_CONFIG.rateLimits.apiRequests.windowMs,
  BETA_CONFIG.rateLimits.apiRequests.max
);

const tradeLimiter = new RateLimiter(
  BETA_CONFIG.rateLimits.tradeCommands.windowMs,
  BETA_CONFIG.rateLimits.tradeCommands.max
);

/**
 * Rate limit middleware for API routes
 */
export async function rateLimit(
  req: NextRequest,
  identifier?: string,
  limiter: RateLimiter = apiLimiter
): Promise<NextResponse | null> {
  if (!BETA_CONFIG.enabled) {
    return null; // No rate limiting in production mode
  }
  
  // Use provided identifier or IP address
  const id = identifier || req.ip || req.headers.get('x-forwarded-for') || 'unknown';
  
  const result = limiter.check(id);
  
  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
    
    return NextResponse.json(
      {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': BETA_CONFIG.rateLimits.apiRequests.max.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
        },
      }
    );
  }
  
  // Add rate limit headers to response
  return null; // Allow request to continue
}

/**
 * Rate limit for trade commands (stricter)
 */
export async function tradeRateLimit(
  req: NextRequest,
  identifier?: string
): Promise<NextResponse | null> {
  return rateLimit(req, identifier, tradeLimiter);
}

/**
 * Decorator for easy rate limiting
 */
export function withRateLimit(handler: Function, type: 'api' | 'trade' = 'api') {
  return async (req: NextRequest, ...args: any[]) => {
    const limiter = type === 'trade' ? tradeLimiter : apiLimiter;
    const rateLimitResponse = await rateLimit(req, undefined, limiter);
    
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    return handler(req, ...args);
  };
}
