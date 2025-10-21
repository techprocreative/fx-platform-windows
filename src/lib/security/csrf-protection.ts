import crypto from 'crypto';
import { getEnvVar } from './env-validator';
import { createAuditLogFromRequest, AuditEventType } from './audit-log';

// CSRF token configuration
const CSRF_CONFIG = {
  tokenLength: 32,
  tokenExpiry: 60 * 60 * 1000, // 1 hour in milliseconds
  cookieName: 'csrf-token',
  headerName: 'x-csrf-token',
};

// In-memory store for CSRF tokens (in production, use Redis or database)
const csrfTokens = new Map<string, { token: string; expires: number; userId?: string }>();

/**
 * Generate a CSRF token
 * @param userId - Optional user ID to associate with the token
 * @returns CSRF token
 */
export function generateCSRFToken(userId?: string): string {
  const token = crypto.randomBytes(CSRF_CONFIG.tokenLength).toString('hex');
  const expires = Date.now() + CSRF_CONFIG.tokenExpiry;
  const tokenId = crypto.randomBytes(16).toString('hex');
  
  // Store the token
  csrfTokens.set(tokenId, { token, expires, userId });
  
  // Return the token ID (not the actual token)
  return tokenId;
}

/**
 * Verify a CSRF token
 * @param tokenId - Token ID from request
 * @param token - Token value from request
 * @param userId - Optional user ID to verify against
 * @returns Whether the token is valid
 */
export function verifyCSRFToken(tokenId: string, token: string, userId?: string): boolean {
  try {
    const storedData = csrfTokens.get(tokenId);
    
    if (!storedData) {
      return false;
    }
    
    // Check if token has expired
    if (Date.now() > storedData.expires) {
      csrfTokens.delete(tokenId);
      return false;
    }
    
    // Check if token matches
    if (storedData.token !== token) {
      return false;
    }
    
    // Check if user ID matches (if provided)
    if (userId && storedData.userId && storedData.userId !== userId) {
      return false;
    }
    
    // Token is valid, remove it to prevent reuse
    csrfTokens.delete(tokenId);
    
    return true;
  } catch (error) {
    console.error('Error verifying CSRF token:', error);
    return false;
  }
}

/**
 * Clean up expired CSRF tokens
 * @returns Number of cleaned up tokens
 */
export function cleanupExpiredCSRFTokens(): number {
  let cleaned = 0;
  const now = Date.now();
  
  for (const [tokenId, data] of csrfTokens.entries()) {
    if (now > data.expires) {
      csrfTokens.delete(tokenId);
      cleaned++;
    }
  }
  
  return cleaned;
}

/**
 * CSRF protection middleware for Express
 * @param options - Configuration options
 * @returns Express middleware function
 */
export function csrfProtection(options: {
  ignoreMethods?: string[];
  ignorePaths?: string[];
} = {}) {
  const { ignoreMethods = ['GET', 'HEAD', 'OPTIONS'], ignorePaths = [] } = options;
  
  return (req: any, res: any, next: any) => {
    try {
      // Skip CSRF protection for ignored methods
      if (ignoreMethods.includes(req.method)) {
        return next();
      }
      
      // Skip CSRF protection for ignored paths
      if (ignorePaths.some(path => req.path.startsWith(path))) {
        return next();
      }
      
      // Get CSRF token from header or request body
      const tokenId = req.headers[CSRF_CONFIG.headerName] || req.body?.csrfTokenId;
      const token = req.headers[`${CSRF_CONFIG.headerName}-value`] || req.body?.csrfToken;
      
      if (!tokenId || !token) {
        return res.status(403).json({
          error: 'CSRF Error',
          message: 'CSRF token missing',
        });
      }
      
      // Get user ID from session if available
      const userId = req.session?.userId;
      
      // Verify CSRF token
      if (!verifyCSRFToken(tokenId, token, userId)) {
        // Log CSRF violation
        createAuditLogFromRequest({
          userId,
          eventType: AuditEventType.SECURITY_VIOLATION,
          resource: 'CSRF',
          action: 'INVALID_TOKEN',
          result: 'BLOCKED',
          metadata: {
            tokenId,
            method: req.method,
            path: req.path,
          },
        }, req).catch(error => console.error('Error logging CSRF violation:', error));
        
        return res.status(403).json({
          error: 'CSRF Error',
          message: 'Invalid CSRF token',
        });
      }
      
      next();
    } catch (error) {
      console.error('CSRF protection middleware error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'CSRF validation failed',
      });
    }
  };
}

/**
 * Generate and set CSRF token cookie
 * @param res - Express response object
 * @param userId - Optional user ID
 * @returns CSRF token ID
 */
export function setCSRFTokenCookie(res: any, userId?: string): string {
  const tokenId = generateCSRFToken(userId);
  
  // Set the token ID as a cookie
  res.cookie(CSRF_CONFIG.cookieName, tokenId, {
    httpOnly: false, // Client needs to access this for AJAX requests
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_CONFIG.tokenExpiry,
  });
  
  return tokenId;
}

/**
 * Get CSRF token from cookie
 * @param req - Express request object
 * @returns CSRF token ID from cookie
 */
export function getCSRFTokenFromCookie(req: any): string | undefined {
  return req.cookies?.[CSRF_CONFIG.cookieName];
}

/**
 * Generate CSRF token for API responses
 * @param userId - Optional user ID
 * @returns CSRF token data
 */
export function generateCSRFTokenData(userId?: string): {
  tokenId: string;
  token: string;
  headerName: string;
} {
  const tokenId = generateCSRFToken(userId);
  const tokenData = csrfTokens.get(tokenId);
  
  return {
    tokenId,
    token: tokenData?.token || '',
    headerName: CSRF_CONFIG.headerName,
  };
}

/**
 * Validate CSRF token for API routes
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function validateCSRFForAPI(req: any, res: any, next: any) {
  try {
    // Get CSRF token from header
    const tokenId = req.headers[CSRF_CONFIG.headerName];
    const token = req.headers[`${CSRF_CONFIG.headerName}-value`];
    
    if (!tokenId || !token) {
      return res.status(403).json({
        error: 'CSRF Error',
        message: 'CSRF token missing from headers',
      });
    }
    
    // Get user ID from session if available
    const userId = req.session?.userId;
    
    // Verify CSRF token
    if (!verifyCSRFToken(tokenId as string, token as string, userId)) {
      // Log CSRF violation
      createAuditLogFromRequest({
        userId,
        eventType: AuditEventType.SECURITY_VIOLATION,
        resource: 'CSRF',
        action: 'INVALID_TOKEN_API',
        result: 'BLOCKED',
        metadata: {
          tokenId,
          method: req.method,
          path: req.path,
        },
      }, req).catch(error => console.error('Error logging CSRF violation:', error));
      
      return res.status(403).json({
        error: 'CSRF Error',
        message: 'Invalid CSRF token',
      });
    }
    
    next();
  } catch (error) {
    console.error('CSRF validation error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'CSRF validation failed',
    });
  }
}

/**
 * Middleware to provide CSRF token to client
 * @returns Express middleware function
 */
export function provideCSRFToken() {
  return (req: any, res: any, next: any) => {
    try {
      // Only generate token for authenticated users
      if (req.session?.userId) {
        const csrfData = generateCSRFTokenData(req.session.userId);
        
        // Set CSRF token cookie
        setCSRFTokenCookie(res, req.session.userId);
        
        // Add CSRF data to response locals for templates
        res.locals.csrf = csrfData;
      }
      
      next();
    } catch (error) {
      console.error('Error providing CSRF token:', error);
      next();
    }
  };
}

/**
 * Initialize CSRF protection with cleanup interval
 * @param intervalMs - Cleanup interval in milliseconds (default: 5 minutes)
 */
export function initializeCSRFProtection(intervalMs: number = 5 * 60 * 1000) {
  // Set up periodic cleanup of expired tokens
  setInterval(() => {
    const cleaned = cleanupExpiredCSRFTokens();
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} expired CSRF tokens`);
    }
  }, intervalMs);
}

export default {
  generateCSRFToken,
  verifyCSRFToken,
  cleanupExpiredCSRFTokens,
  csrfProtection,
  setCSRFTokenCookie,
  getCSRFTokenFromCookie,
  generateCSRFTokenData,
  validateCSRFForAPI,
  provideCSRFToken,
  initializeCSRFProtection,
  CSRF_CONFIG,
};