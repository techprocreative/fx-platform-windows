/**
 * Comprehensive Security Module
 * This module exports all security components and provides a unified interface
 * for configuring and managing security features.
 */

// Import functions needed internally in this file
import { securityHeadersMiddleware as _securityHeadersMiddleware } from "./security-headers";
import { corsMiddleware as _corsMiddleware } from "./cors-config";
import { createSessionMiddleware as _createSessionMiddleware } from "../auth/session-manager";
import {
  isRequestFromWhitelistedIP as _isRequestFromWhitelistedIP,
  logIPWhitelistViolation as _logIPWhitelistViolation,
  getClientIP as _getClientIP,
} from "./ip-whitelist";
import {
  createRateLimitMiddleware as _createRateLimitMiddleware,
  RateLimitType as _RateLimitType,
} from "./rate-limiter";
import { csrfProtection as _csrfMiddleware } from "./csrf-protection";
import { InputSanitizer as _InputSanitizer } from "./input-validation";
import {
  createAuditLogFromRequest as _createAuditLogFromRequest,
  AuditEventType as _AuditEventType,
} from "./audit-log";
import {
  validateEnv as _validateEnv,
  isEnvConfigured as _isEnvConfigured,
} from "./env-validator";
import {
  initializeCSRFProtection as _initializeCSRFProtection,
  cleanupExpiredCSRFTokens as _cleanupExpiredCSRFTokens,
} from "./csrf-protection";
import { cleanupExpiredSessions as _cleanupExpiredSessions } from "../auth/session-manager";
import { cleanupOldAuditLogs as _cleanupOldAuditLogs } from "./audit-log";
import {
  getDefaultSecurityConfig as _getDefaultSecurityConfig,
  getSecurityReport as _getSecurityReport,
} from "./security-headers";
import { getDefaultPasswordPolicy as _getDefaultPasswordPolicy } from "./password-policy";

// Import default exports for Security object
import envValidatorDefault from "./env-validator";
import rateLimiterDefault from "./rate-limiter";
import encryptionDefault from "./encryption";
import ipWhitelistDefault from "./ip-whitelist";
import auditLogDefault from "./audit-log";
import corsConfigDefault from "./cors-config";
import csrfProtectionDefault from "./csrf-protection";
import inputValidationDefault from "./input-validation";
import securityHeadersDefault from "./security-headers";
import passwordPolicyDefault from "./password-policy";
import twoFactorDefault from "../auth/two-factor";
import sessionManagerDefault from "../auth/session-manager";
import tradeConfirmationDefault from "../trading/trade-confirmation";

// Core security components - Re-export for external use
export {
  default as envValidator,
  validateEnv,
  getEnvVar,
  isEnvConfigured,
} from "./env-validator";

export {
  default as rateLimiter,
  checkRateLimit,
  getUserRateLimitTier,
  createRateLimitMiddleware,
  resetRateLimit,
  RateLimitTier,
  RateLimitType,
} from "./rate-limiter";

export {
  default as encryption,
  encrypt,
  decrypt,
  encryptApiKey,
  decryptApiKey,
  generateSecureRandom,
  hashPassword as hashPasswordSecure,
  verifyPassword as verifyPasswordSecure,
  sha256,
  hmacSha256,
  generateRSAKeyPair,
  rsaEncrypt,
  rsaDecrypt,
} from "./encryption";

export {
  default as ipWhitelist,
  isValidIPAddress,
  isIPInCIDR,
  getWhitelistedIPs,
  addIPToWhitelist,
  removeIPFromWhitelist,
  isIPWhitelisted,
  getClientIP,
  isRequestFromWhitelistedIP,
  logIPWhitelistViolation,
  createIPWhitelistEntry,
  getIPWhitelistEntries,
  deleteIPWhitelistEntry,
} from "./ip-whitelist";

export {
  default as auditLog,
  createAuditLog,
  createAuditLogFromRequest,
  verifyAuditLogIntegrity,
  getUserAuditLogs,
  getAuditLogsByEventType,
  getAuditLogsByDateRange,
  getSecurityEvents,
  searchAuditLogs,
  exportAuditLogsToCSV,
  cleanupOldAuditLogs,
  AuditEventType,
} from "./audit-log";

export {
  default as corsConfig,
  getCorsConfig,
  isOriginAllowed,
  getCorsHeaders,
  corsMiddleware,
  getApiCorsConfig,
  validateApiCors,
} from "./cors-config";

export {
  default as csrfProtection,
  generateCSRFToken,
  verifyCSRFToken,
  cleanupExpiredCSRFTokens,
  csrfProtection as csrfMiddleware,
  setCSRFTokenCookie,
  getCSRFTokenFromCookie,
  generateCSRFTokenData,
  validateCSRFForAPI,
  provideCSRFToken,
  initializeCSRFProtection,
} from "./csrf-protection";

export {
  default as inputValidation,
  commonSchemas,
  tradingSchemas,
  apiSchemas,
  InputSanitizer,
  validateRequest,
  customValidators,
} from "./input-validation";

export {
  default as securityHeaders,
  getDefaultSecurityConfig,
  generateCSPNonce,
  buildCSPHeader,
  getSecurityHeaders,
  securityHeadersMiddleware,
  getAPISecurityHeaders,
  apiSecurityHeadersMiddleware,
  validateSecurityConfig,
  getSecurityReport,
} from "./security-headers";

export {
  default as passwordPolicy,
  getDefaultPasswordPolicy,
  createPasswordSchema,
  validatePassword,
  generatePassword,
  hashPassword,
  verifyPassword,
  needsPasswordChange,
  validatePasswordMiddleware,
  isPasswordReused,
} from "./password-policy";

// Authentication components
export {
  default as twoFactor,
  generateTOTPSecret,
  verifyTOTPToken,
  generateBackupCodes,
  hashBackupCodes,
  verifyBackupCode,
  generate2FASessionToken,
  verify2FASessionToken,
  is2FARequired,
  send2FAEmail,
  send2FASMS,
  generateVerificationCode,
  log2FAAttempt,
  hasExceeded2FALimits,
} from "../auth/two-factor";

export {
  default as sessionManager,
  createSession,
  validateSession,
  deleteSession,
  deleteAllUserSessions,
  getUserSessions,
  isSessionTwoFactorVerified,
  markSessionTwoFactorVerified,
  cleanupExpiredSessions,
  checkSuspiciousActivity,
  createSessionMiddleware,
} from "../auth/session-manager";

// Trading security components
export {
  default as tradeConfirmation,
  createTradeConfirmation,
  verifyTradeConfirmation,
  cancelTradeConfirmation,
  isTradeConfirmationRequired,
  cleanupExpiredConfirmations,
  getPendingConfirmations,
  ConfirmationType,
  ConfirmationStatus,
} from "../trading/trade-confirmation";

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
  config: SecurityMiddlewareConfig = getDefaultSecurityMiddlewareConfig(),
) {
  const middlewares: any[] = [];

  // Security headers (should be first)
  if (config.enableSecurityHeaders) {
    middlewares.push(_securityHeadersMiddleware());
  }

  // CORS configuration
  if (config.enableCORS) {
    middlewares.push(_corsMiddleware());
  }

  // Session management
  if (config.enableSessionManagement) {
    middlewares.push(_createSessionMiddleware());
  }

  // IP whitelist
  if (config.enableIPWhitelist) {
    middlewares.push(async (req: any, res: any, next: any) => {
      if (req.session?.userId) {
        const isAllowed = await _isRequestFromWhitelistedIP(
          req,
          req.session.userId,
        );
        if (!isAllowed) {
          await _logIPWhitelistViolation(
            req.session.userId,
            _getClientIP(req),
            req.headers["user-agent"],
            req.path,
          );
          return res.status(403).json({
            error: "Access Denied",
            message: "Your IP address is not whitelisted",
          });
        }
      }
      next();
    });
  }

  // Rate limiting
  if (config.enableRateLimiting) {
    middlewares.push(
      _createRateLimitMiddleware(_RateLimitType.API, async (req: any) => {
        return req.ip || _getClientIP(req);
      }),
    );
  }

  // CSRF protection
  if (config.enableCSRF) {
    middlewares.push(_csrfMiddleware());
  }

  // Input validation
  if (config.enableInputValidation) {
    middlewares.push(async (req: any, res: any, next: any) => {
      // Sanitize request body
      if (req.body) {
        req.body = _InputSanitizer.sanitizeObject(req.body);
      }

      // Sanitize query parameters
      if (req.query) {
        req.query = _InputSanitizer.sanitizeObject(req.query);
      }

      next();
    });
  }

  // Audit logging
  if (config.enableAuditLogging) {
    middlewares.push(async (req: any, res: any, next: any) => {
      // Store original res.json to log responses
      const originalJson = res.json;
      res.json = function (data: any) {
        // Log the response
        if (req.session?.userId) {
          _createAuditLogFromRequest(
            {
              userId: req.session.userId,
              eventType: _AuditEventType.API_KEY_USED,
              resource: req.path,
              action: req.method,
              result: res.statusCode < 400 ? "SUCCESS" : "FAILED",
              metadata: {
                statusCode: res.statusCode,
                responseSize: JSON.stringify(data).length,
              },
            },
            req,
          ).catch((error: any) =>
            console.error("Error logging API request:", error),
          );
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
  config: SecurityMiddlewareConfig = getDefaultSecurityMiddlewareConfig(),
) {
  // Validate environment variables
  try {
    _validateEnv();
    console.log("✅ Environment variables validated");
  } catch (error) {
    console.error("❌ Environment validation failed:", error);
    throw error;
  }

  // Initialize CSRF protection
  if (config.enableCSRF) {
    _initializeCSRFProtection();
    console.log("✅ CSRF protection initialized");
  }

  // Set up periodic cleanup tasks
  if (config.enableSessionManagement) {
    // Clean up expired sessions every 5 minutes
    setInterval(
      async () => {
        try {
          const cleaned = await _cleanupExpiredSessions();
          if (cleaned > 0) {
            console.log(`Cleaned up ${cleaned} expired sessions`);
          }
        } catch (error) {
          console.error("Error cleaning up expired sessions:", error);
        }
      },
      5 * 60 * 1000,
    );
  }

  if (config.enableCSRF) {
    // Clean up expired CSRF tokens every 5 minutes
    setInterval(
      async () => {
        try {
          const cleaned = _cleanupExpiredCSRFTokens();
          if (cleaned > 0) {
            console.log(`Cleaned up ${cleaned} expired CSRF tokens`);
          }
        } catch (error) {
          console.error("Error cleaning up expired CSRF tokens:", error);
        }
      },
      5 * 60 * 1000,
    );
  }

  if (config.enableAuditLogging) {
    // Clean up old audit logs daily
    setInterval(
      async () => {
        try {
          const cleaned = await _cleanupOldAuditLogs(365); // Keep logs for 1 year
          if (cleaned > 0) {
            console.log(`Cleaned up ${cleaned} old audit logs`);
          }
        } catch (error) {
          console.error("Error cleaning up old audit logs:", error);
        }
      },
      24 * 60 * 60 * 1000,
    );
  }

  console.log("🔐 Security features initialized");
}

/**
 * Get security status report
 * @returns Security status report
 */
export function getSecurityStatusReport() {
  const envConfigured = _isEnvConfigured();
  const securityConfig = _getDefaultSecurityConfig();
  const passwordPolicy = _getDefaultPasswordPolicy();

  return {
    environment: {
      configured: envConfigured,
      nodeEnv: process.env.NODE_ENV,
    },
    headers: {
      enabled: securityConfig.enableHSTS,
      csp: securityConfig.enableCSP,
      recommendations: _getSecurityReport().recommendations,
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
  env: envValidatorDefault,
  rateLimit: rateLimiterDefault,
  encryption: encryptionDefault,
  ipWhitelist: ipWhitelistDefault,
  auditLog: auditLogDefault,
  cors: corsConfigDefault,
  csrf: csrfProtectionDefault,
  inputValidation: inputValidationDefault,
  headers: securityHeadersDefault,
  passwordPolicy: passwordPolicyDefault,

  // Authentication
  twoFactor: twoFactorDefault,
  session: sessionManagerDefault,

  // Trading
  tradeConfirmation: tradeConfirmationDefault,

  // Middleware
  createMiddlewareStack: createSecurityMiddlewareStack,
  initialize: initializeSecurity,
  getStatusReport: getSecurityStatusReport,
};

export default Security;
