import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getUserRateLimitTier, RateLimitType, RateLimitTier, RateLimitResult } from '@/lib/security/rate-limiter';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

/**
 * Apply rate limiting to API routes
 * @param request - NextRequest object
 * @param type - Type of rate limit to apply
 * @returns Promise<NextResponse | null> - Returns rate limit response if exceeded, null if allowed
 */
export async function applyRateLimit(
  request: NextRequest,
  type: RateLimitType
): Promise<NextResponse | null> {
  try {
    // Get client identifier (IP address)
    const ip = getClientIP(request);
    
    // Try to get user ID from session for user-specific rate limiting
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    
    // Get user's rate limit tier
    const tier = userId ? await getUserRateLimitTier(userId) : RateLimitTier.FREE;
    
    // Use user ID as identifier if available, otherwise use IP
    const identifier = userId || ip;
    
    // Check rate limit
    const result = await checkRateLimit(identifier, type, tier);
    
    // Create rate limit headers
    const headers = new Headers({
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.resetTime.toISOString(),
    });
    
    if (!result.success) {
      headers.set('Retry-After', (result.retryAfter || 60).toString());
      
      return new NextResponse(
        JSON.stringify({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter,
          type: type,
          limit: result.limit,
          resetTime: result.resetTime,
        }),
        {
          status: 429,
          headers,
        }
      );
    }
    
    // Add rate limit headers to the request for later use
    request.headers.set('X-RateLimit-Result', JSON.stringify(result));
    
    return null; // Allow request to proceed
  } catch (error) {
    console.error('Rate limiting error:', error);
    // Fail open - allow the request but log the error
    return null;
  }
}

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  // Check various headers for the real IP address
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  // Fallback to request IP
  return request.ip || 'unknown';
}

/**
 * Rate limit middleware wrapper for specific API types
 */
export const rateLimitMiddleware = {
  /**
   * Apply general API rate limiting
   */
  api: (request: NextRequest) => applyRateLimit(request, RateLimitType.API),
  
  /**
   * Apply login rate limiting
   */
  login: (request: NextRequest) => applyRateLimit(request, RateLimitType.LOGIN),
  
  /**
   * Apply trading rate limiting
   */
  trading: (request: NextRequest) => applyRateLimit(request, RateLimitType.TRADING),
};

/**
 * Higher-order function to wrap API handlers with rate limiting
 */
export function withRateLimit(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>,
  type: RateLimitType = RateLimitType.API
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    // Apply rate limiting
    const rateLimitResponse = await applyRateLimit(request, type);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    // Execute the original handler
    const response = await handler(request, ...args);
    
    // Add rate limit headers to the response if available
    const rateLimitResult = request.headers.get('X-RateLimit-Result');
    if (rateLimitResult) {
      try {
        const result: RateLimitResult = JSON.parse(rateLimitResult);
        response.headers.set('X-RateLimit-Limit', result.limit.toString());
        response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
        response.headers.set('X-RateLimit-Reset', result.resetTime.toISOString());
      } catch (error) {
        // Ignore parsing errors
      }
    }
    
    return response;
  };
}

/**
 * Apply rate limiting specifically to backtest endpoints
 */
export const backtestRateLimit = withRateLimit(
  async (request: NextRequest, ...args: any[]) => {
    // This will be replaced by the actual handler when wrapped
    return new NextResponse('Backtest rate limit middleware');
  },
  RateLimitType.API
);

/**
 * Apply rate limiting specifically to strategy endpoints
 */
export const strategyRateLimit = withRateLimit(
  async (request: NextRequest, ...args: any[]) => {
    // This will be replaced by the actual handler when wrapped
    return new NextResponse('Strategy rate limit middleware');
  },
  RateLimitType.API
);

/**
 * Apply rate limiting specifically to trading endpoints
 */
export const tradingRateLimit = withRateLimit(
  async (request: NextRequest, ...args: any[]) => {
    // This will be replaced by the actual handler when wrapped
    return new NextResponse('Trading rate limit middleware');
  },
  RateLimitType.TRADING
);

/**
 * Apply rate limiting specifically to auth endpoints
 */
export const authRateLimit = withRateLimit(
  async (request: NextRequest, ...args: any[]) => {
    // This will be replaced by the actual handler when wrapped
    return new NextResponse('Auth rate limit middleware');
  },
  RateLimitType.LOGIN
);