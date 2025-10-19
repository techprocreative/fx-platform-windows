import { getEnvVar } from './env-validator';

/**
 * Get CORS configuration based on environment variables
 * @returns CORS configuration object
 */
export function getCorsConfig() {
  try {
    const allowedOrigins = getEnvVar('ALLOWED_ORIGINS').split(',').map(origin => origin.trim());
    
    return {
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Check if the origin is in the allowed list
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'), false);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Session-Token',
        'X-CSRF-Token',
        'X-API-Key',
      ],
      exposedHeaders: [
        'X-Total-Count',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'Retry-After',
      ],
      maxAge: 86400, // 24 hours
    };
  } catch (error) {
    console.error('Error getting CORS configuration:', error);
    
    // Fallback configuration
    return {
      origin: false, // Disallow CORS by default
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Session-Token',
        'X-CSRF-Token',
        'X-API-Key',
      ],
    };
  }
}

/**
 * Validate if an origin is allowed based on CORS configuration
 * @param origin - Origin to validate
 * @returns Whether the origin is allowed
 */
export function isOriginAllowed(origin: string): boolean {
  try {
    const allowedOrigins = getEnvVar('ALLOWED_ORIGINS').split(',').map(o => o.trim());
    
    // Allow all origins if wildcard is specified
    if (allowedOrigins.includes('*')) {
      return true;
    }
    
    // Check if the origin is in the allowed list
    return allowedOrigins.includes(origin);
  } catch (error) {
    console.error('Error validating origin:', error);
    return false;
  }
}

/**
 * Get CORS headers for a response
 * @param origin - Request origin
 * @returns CORS headers object
 */
export function getCorsHeaders(origin?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Session-Token, X-CSRF-Token, X-API-Key',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': 'X-Total-Count, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After',
  };
  
  if (origin && isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  
  return headers;
}

/**
 * CORS middleware for Express
 * @returns Express middleware function
 */
export function corsMiddleware() {
  return (req: any, res: any, next: any) => {
    const origin = req.headers.origin;
    
    // Set CORS headers
    const headers = getCorsHeaders(origin);
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    next();
  };
}

/**
 * Dynamic CORS configuration for API routes
 * @param apiRoute - API route path
 * @returns CORS configuration for the route
 */
export function getApiCorsConfig(apiRoute: string) {
  // Default CORS configuration
  const defaultConfig = getCorsConfig();
  
  // Route-specific configurations
  const routeConfigs: Record<string, Partial<typeof defaultConfig>> = {
    '/api/auth': {
      // More restrictive for auth endpoints
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) return callback(null, false);
        
        const allowedOrigins = getEnvVar('ALLOWED_ORIGINS').split(',').map(o => o.trim());
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS for auth endpoints'), false);
        }
      },
    },
    '/api/trade': {
      // More restrictive for trading endpoints
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) return callback(null, false);
        
        const allowedOrigins = getEnvVar('ALLOWED_ORIGINS').split(',').map(o => o.trim());
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS for trading endpoints'), false);
        }
      },
    },
  };
  
  // Find matching route configuration
  for (const [route, config] of Object.entries(routeConfigs)) {
    if (apiRoute.startsWith(route)) {
      return { ...defaultConfig, ...config };
    }
  }
  
  return defaultConfig;
}

/**
 * Validate CORS for API routes
 * @param req - Request object
 * @param res - Response object
 * @param next - Next function
 */
export function validateApiCors(req: any, res: any, next: any) {
  const origin = req.headers.origin;
  const apiRoute = req.path;
  
  // Get route-specific CORS configuration
  const corsConfig = getApiCorsConfig(apiRoute);
  
  // Set CORS headers
  const headers = getCorsHeaders(origin);
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Check if origin is allowed
  if (origin && !isOriginAllowed(origin)) {
    return res.status(403).json({
      error: 'CORS Error',
      message: 'Origin not allowed',
    });
  }
  
  next();
}

export default {
  getCorsConfig,
  isOriginAllowed,
  getCorsHeaders,
  corsMiddleware,
  getApiCorsConfig,
  validateApiCors,
};