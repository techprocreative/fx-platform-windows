/**
 * Comprehensive Security Module
 * This module exports all security components and provides a unified interface
 * for configuring and managing security features.
 */

// Core security components
export { default as envValidator, validateEnv, getEnvVar, isEnvConfigured } from './env-validator';
export { default as rateLimiter, checkRateLimit, getUserRateLimitTier, createRateLimitMiddleware, resetRateLimit, RateLimitTier, RateLimitType } from './rate-limiter';
export { default as encryption, encrypt, decrypt, encryptApiKey, decryptApiKey, generateSecureRandom, hashPassword as hashPasswordSecure, verifyPassword as verifyPasswordSecure, sha256, hmacSha256, generateRSAKeyPair, rsaEncrypt, rsaDecrypt } from './encryption';
export { default as ipWhitelist, isValidIPAddress, isIPInCIDR, getWhitelistedIPs, addIPToWhitelist, removeIPFromWhitelist, isIPWhitelisted, getClientIP, isRequestFromWhitelistedIP, logIPWhitelistViolation, createIPWhitelistEntry, getIPWhitelistEntries, deleteIPWhitelistEntry } from './ip-whitelist';
export { default as auditLog, createAuditLog, createAuditLogFromRequest, verifyAuditLogIntegrity, getUserAuditLogs, getAuditLogsByEventType, getAuditLogsByDateRange, getSecurityEvents, searchAuditLogs, exportAuditLogsToCSV, cleanupOldAuditLogs, AuditEventType } from './audit-log';
export { default as corsConfig, getCorsConfig, isOriginAllowed, getCorsHeaders, corsMiddleware, getApiCorsConfig, validateApiCors } from './cors-config';
export { default as csrfProtection, generateCSRFToken, verifyCSRFToken, cleanupExpiredCSRFTokens, csrfProtection as csrfMiddleware, setCSRFTokenCookie, getCSRFTokenFromCookie, generateCSRFTokenData, validateCSRFForAPI, provideCSRFToken, initializeCSRFProtection } from './csrf-protection';
export { default as inputValidation, commonSchemas, tradingSchemas, apiSchemas, InputSanitizer, validateRequest, customValidators } from './input-validation';
export { default as securityHeaders, getDefaultSecurityConfig, generateCSPNonce, buildCSPHeader, getSecurityHeaders, securityHeadersMiddleware, getAPISecurityHeaders, apiSecurityHeadersMiddleware, validateSecurityConfig, getSecurityReport } from './security-headers';
export { default as passwordPolicy, getDefaultPasswordPolicy, createPasswordSchema, validatePassword, generatePassword, hashPassword, verifyPassword, needsPasswordChange, validatePasswordMiddleware, isPasswordReused } from './password-policy';

// Authentication components
export { default as twoFactor, generateTOTPSecret, verifyTOTPToken, generateBackupCodes, hashBackupCodes, verifyBackupCode, generate2FASessionToken, verify2FASessionToken, is2FARequired, send2FAEmail, send2FASMS, generateVerificationCode, log2FAAttempt, hasExceeded2FALimits } from '../auth/two-factor';
export { default as sessionManager, createSession, validateSession, deleteSession, deleteAllUserSessions, getUserSessions, isSessionTwoFactorVerified, markSessionTwoFactorVerified, cleanupExpiredSessions, checkSuspiciousActivity, createSessionMiddleware } from '../auth/session-manager';

// Trading security components
export { default as tradeConfirmation, createTradeConfirmation, verifyTradeConfirmation, cancelTradeConfirmation, isTradeConfirmationRequired, cleanupExpiredConfirmations, getPendingConfirmations, ConfirmationType, ConfirmationStatus } from '../trading/trade-confirmation';

// Security middleware aggregator
export interface SecurityMiddlewareConfig {
  enableRateLimiting: boolean;
  enableCORS: boolean;
  enableCSRF: boolean;
  enableSecurityHeaders: boolean;
  enableInputValidation: boolean;
  enableSessionManagement: boolean;
  enableAuditLogging: boolean;
  enableIPWhitelist: boolean;
}

/**
 * Get default security middleware configuration
 * @returns Default security middleware configuration
 */
export function getDefaultSecurityMiddlewareConfig(): SecurityMiddlewareConfig {
  return {
    enableRateLimiting: true,
    enableCORS: true,
    enableCSRF: true,
    enableSecurityHeaders: true,
    enableInputValidation: true,
    enableSessionManagement: true,
    enableAuditLogging: true,
    enableIPWhitelist: true,
  };
}

/**
 * Create a comprehensive security middleware stack
 * @param config - Security middleware configuration
 * @returns Array of Express middleware functions
 */
export function createSecurityMiddlewareStack(
  config: SecurityMiddlewareConfig = getDefaultSecurityMiddlewareConfig()
) {
  const middlewares: any[] = [];
  
  // Security headers (should be first)
  if (config.enableSecurityHeaders) {
    middlewares.push(securityHeadersMiddleware());
  }
  
  // CORS configuration
  if (config.enableCORS) {
    middlewares.push(corsMiddleware());
  }
  
  // Session management
  if (config.enableSessionManagement) {
    middlewares.push(createSessionMiddleware());
  }
  
  // IP whitelist
  if (config.enableIPWhitelist) {
    middlewares.push(async (req: any, res: any, next: any) => {
      if (req.session?.userId) {
        const isAllowed = await isRequestFromWhitelistedIP(req, req.session.userId);
        if (!isAllowed) {
          await logIPWhitelistViolation(req.session.userId, getClientIP(req), req.headers['user-agent'], req.path);
          return res.status(403).json({
            error: 'Access Denied',
            message: 'Your IP address is not whitelisted',
          });
        }
      }
      next();
    });
  }
  
  // Rate limiting
  if (config.enableRateLimiting) {
    middlewares.push(createRateLimitMiddleware(RateLimitType.API, async (req) => {
      return req.ip || getClientIP(req);
    }));
  }
  
  // CSRF protection
  if (config.enableCSRF) {
    middlewares.push(csrfMiddleware());
  }
  
  // Input validation
  if (config.enableInputValidation) {
    middlewares.push(async (req: any, res: any, next: any) => {
      // Sanitize request body
      if (req.body) {
        req.body = InputSanitizer.sanitizeObject(req.body);
      }
      
      // Sanitize query parameters
      if (req.query) {
        req.query = InputSanitizer.sanitizeObject(req.query);
      }
      
      next();
    });
  }
  
  // Audit logging
  if (config.enableAuditLogging) {
    middlewares.push(async (req: any, res: any, next: any) => {
      // Store original res.json to log responses
      const originalJson = res.json;
      res.json = function(data: any) {
        // Log the response
        if (req.session?.userId) {
          createAuditLogFromRequest({
            userId: req.session.userId,
            eventType: 'API_REQUEST',
            resource: req.path,
            action: req.method,
            result: res.statusCode < 400 ? 'SUCCESS' : 'FAILED',
            metadata: {
              statusCode: res.statusCode,
              responseSize: JSON.stringify(data).length,
            },
          }, req).catch(error => console.error('Error logging API request:', error));
        }
        
        return originalJson.call(this, data);
      };
      
      next();
    });
  }
  
  return middlewares;
}

/**
 * Initialize all security features
 * @param config - Security middleware configuration
 */
export function initializeSecurity(
  config: SecurityMiddlewareConfig = getDefaultSecurityMiddlewareConfig()
) {
  // Validate environment variables
  try {
    validateEnv();
    console.log('✅ Environment variables validated');
  } catch (error) {
    console.error('❌ Environment validation failed:', error);
    throw error;
  }
  
  // Initialize CSRF protection
  if (config.enableCSRF) {
    initializeCSRFProtection();
    console.log('✅ CSRF protection initialized');
  }
  
  // Set up periodic cleanup tasks
  if (config.enableSessionManagement) {
    // Clean up expired sessions every 5 minutes
    setInterval(async () => {
      try {
        const cleaned = await cleanupExpiredSessions();
        if (cleaned > 0) {
          console.log(`Cleaned up ${cleaned} expired sessions`);
        }
      } catch (error) {
        console.error('Error cleaning up expired sessions:', error);
      }
    }, 5 * 60 * 1000);
  }
  
  if (config.enableCSRF) {
    // Clean up expired CSRF tokens every 5 minutes
    setInterval(async () => {
      try {
        const cleaned = cleanupExpiredCSRFTokens();
        if (cleaned > 0) {
          console.log(`Cleaned up ${cleaned} expired CSRF tokens`);
        }
      } catch (error) {
        console.error('Error cleaning up expired CSRF tokens:', error);
      }
    }, 5 * 60 * 1000);
  }
  
  if (config.enableAuditLogging) {
    // Clean up old audit logs daily
    setInterval(async () => {
      try {
        const cleaned = await cleanupOldAuditLogs(365); // Keep logs for 1 year
        if (cleaned > 0) {
          console.log(`Cleaned up ${cleaned} old audit logs`);
        }
      } catch (error) {
        console.error('Error cleaning up old audit logs:', error);
      }
    }, 24 * 60 * 60 * 1000);
  }
  
  console.log('🔐 Security features initialized');
}

/**
 * Get security status report
 * @returns Security status report
 */
export function getSecurityStatusReport() {
  const envConfigured = isEnvConfigured();
  const securityConfig = getDefaultSecurityConfig();
  const passwordPolicy = getDefaultPasswordPolicy();
  
  return {
    environment: {
      configured: envConfigured,
      nodeEnv: process.env.NODE_ENV,
    },
    headers: {
      enabled: securityConfig.enableHSTS,
      csp: securityConfig.enableCSP,
      recommendations: getSecurityReport().recommendations,
    },
    passwordPolicy: {
      minLength: passwordPolicy.minLength,
      requireUppercase: passwordPolicy.requireUppercase,
      requireLowercase: passwordPolicy.requireLowercase,
      requireNumbers: passwordPolicy.requireNumbers,
      requireSymbols: passwordPolicy.requireSymbols,
      maxAge: passwordPolicy.maxAge,
    },
    features: {
      rateLimiting: true,
      csrf: true,
      ipWhitelist: true,
      twoFactor: true,
      auditLogging: true,
      encryption: true,
    },
  };
}

// Export all security components as a single object for convenience
export const Security = {
  // Core components
  env: envValidator,
  rateLimit: rateLimiter,
  encryption: encryption,
  ipWhitelist: ipWhitelist,
  auditLog: auditLog,
  cors: corsConfig,
  csrf: csrfProtection,
  inputValidation: inputValidation,
  headers: securityHeaders,
  passwordPolicy: passwordPolicy,
  
  // Authentication
  twoFactor: twoFactor,
  session: sessionManager,
  
  // Trading
  tradeConfirmation: tradeConfirmation,
  
  // Middleware
  createMiddlewareStack: createSecurityMiddlewareStack,
  initialize: initializeSecurity,
  getStatusReport: getSecurityStatusReport,
};

export default Security;