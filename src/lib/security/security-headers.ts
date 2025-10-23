import crypto from "crypto";
import { getEnvVar } from "./env-validator";

// Security header configuration
export interface SecurityHeaderConfig {
  // Content Security Policy
  enableCSP: boolean;
  cspNonce: boolean;
  cspDirectives: Record<string, string[]>;

  // Other security headers
  enableHSTS: boolean;
  enableXFrameOptions: boolean;
  enableXContentTypeOptions: boolean;
  enableReferrerPolicy: boolean;
  enablePermissionsPolicy: boolean;

  // Custom headers
  customHeaders: Record<string, string>;
}

/**
 * Get default security header configuration
 * @returns Security header configuration
 */
export function getDefaultSecurityConfig(): SecurityHeaderConfig {
  const enableHelmet =
    (getEnvVar("ENABLE_HELMET_MIDDLEWARE") || "true") === "true";
  const enableCSP = (getEnvVar("ENABLE_CSP") || "true") === "true";
  const cspNonceGeneration =
    (getEnvVar("CSP_NONCE_GENERATION") || "true") === "true";

  return {
    // Content Security Policy
    enableCSP: enableCSP,
    cspNonce: cspNonceGeneration,
    cspDirectives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      "style-src": [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
      ],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "img-src": ["'self'", "data:", "https:"],
      "connect-src": ["'self'", "https://api.pusher.com"],
      "frame-src": ["'none'"],
      "object-src": ["'none'"],
      "media-src": ["'self'"],
      "manifest-src": ["'self'"],
      "worker-src": ["'self'"],
    },

    // Other security headers
    enableHSTS: enableHelmet,
    enableXFrameOptions: enableHelmet,
    enableXContentTypeOptions: enableHelmet,
    enableReferrerPolicy: enableHelmet,
    enablePermissionsPolicy: enableHelmet,

    // Custom headers
    customHeaders: {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    },
  };
}

/**
 * Generate a CSP nonce
 * @returns CSP nonce
 */
export function generateCSPNonce(): string {
  return Buffer.from(crypto.randomBytes(16)).toString("base64");
}

/**
 * Build CSP header value
 * @param directives - CSP directives
 * @param nonce - Optional nonce for script-src
 * @returns CSP header value
 */
export function buildCSPHeader(
  directives: Record<string, string[]>,
  nonce?: string,
): string {
  const cspDirectives = { ...directives };

  // Add nonce to script-src if provided
  if (nonce && cspDirectives["script-src"]) {
    cspDirectives["script-src"].push(`'nonce-${nonce}'`);
  }

  // Convert directives to CSP string
  return Object.entries(cspDirectives)
    .map(([directive, values]) => `${directive} ${values.join(" ")}`)
    .join("; ");
}

/**
 * Get security headers for a response
 * @param config - Security header configuration
 * @param nonce - Optional CSP nonce
 * @returns Security headers object
 */
export function getSecurityHeaders(
  config: SecurityHeaderConfig = getDefaultSecurityConfig(),
  nonce?: string,
): Record<string, string> {
  const headers: Record<string, string> = { ...config.customHeaders };

  // Add CSP header if enabled
  if (config.enableCSP) {
    headers["Content-Security-Policy"] = buildCSPHeader(
      config.cspDirectives,
      nonce,
    );
  }

  // Add HSTS header if enabled
  if (config.enableHSTS) {
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains; preload";
  }

  // Add other security headers if enabled
  if (config.enableXFrameOptions && !headers["X-Frame-Options"]) {
    headers["X-Frame-Options"] = "DENY";
  }

  if (config.enableXContentTypeOptions && !headers["X-Content-Type-Options"]) {
    headers["X-Content-Type-Options"] = "nosniff";
  }

  if (config.enableReferrerPolicy && !headers["Referrer-Policy"]) {
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
  }

  if (config.enablePermissionsPolicy && !headers["Permissions-Policy"]) {
    headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
  }

  return headers;
}

/**
 * Security headers middleware for Express
 * @param config - Optional security header configuration
 * @returns Express middleware function
 */
export function securityHeadersMiddleware(config?: SecurityHeaderConfig) {
  const securityConfig = config || getDefaultSecurityConfig();

  return (req: any, res: any, next: any) => {
    try {
      // Generate nonce if needed
      let nonce: string | undefined;
      if (securityConfig.cspNonce) {
        nonce = generateCSPNonce();
        // Store nonce in response locals for use in templates
        res.locals.cspNonce = nonce;
      }

      // Get security headers
      const headers = getSecurityHeaders(securityConfig, nonce);

      // Set headers
      Object.entries(headers).forEach(([name, value]) => {
        res.setHeader(name, value);
      });

      next();
    } catch (error) {
      console.error("Security headers middleware error:", error);
      next();
    }
  };
}

/**
 * API-specific security headers
 * @param apiRoute - API route path
 * @returns Security headers for API routes
 */
export function getAPISecurityHeaders(
  apiRoute: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "no-referrer",
  };

  // Add stricter CSP for API routes
  headers["Content-Security-Policy"] = "default-src 'none'";

  // Add HSTS for production
  if (process.env.NODE_ENV === "production") {
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains; preload";
  }

  // Route-specific headers
  if (apiRoute.startsWith("/api/auth")) {
    headers["Cache-Control"] =
      "no-store, no-cache, must-revalidate, proxy-revalidate";
    headers["Pragma"] = "no-cache";
    headers["Expires"] = "0";
  }

  if (apiRoute.startsWith("/api/trade")) {
    headers["Cache-Control"] = "no-store, no-cache, must-revalidate";
    headers["X-Trade-API"] = "restricted";
  }

  return headers;
}

/**
 * API security headers middleware
 * @returns Express middleware function
 */
export function apiSecurityHeadersMiddleware() {
  return (req: any, res: any, next: any) => {
    try {
      const headers = getAPISecurityHeaders(req.path);

      // Set headers
      Object.entries(headers).forEach(([name, value]) => {
        res.setHeader(name, value);
      });

      next();
    } catch (error) {
      console.error("API security headers middleware error:", error);
      next();
    }
  };
}

/**
 * Validate security headers configuration
 * @param config - Security header configuration
 * @returns Whether the configuration is valid
 */
export function validateSecurityConfig(config: SecurityHeaderConfig): boolean {
  try {
    // Check CSP directives
    if (config.enableCSP) {
      if (
        !config.cspDirectives ||
        Object.keys(config.cspDirectives).length === 0
      ) {
        console.error("CSP enabled but no directives provided");
        return false;
      }

      // Check for potentially unsafe directives
      if (config.cspDirectives["script-src"]?.includes("'unsafe-inline'")) {
        console.warn("Unsafe inline scripts allowed in CSP");
      }

      if (config.cspDirectives["script-src"]?.includes("'unsafe-eval'")) {
        console.warn("Unsafe eval allowed in CSP");
      }
    }

    // Check custom headers
    for (const [name, value] of Object.entries(config.customHeaders)) {
      if (!name || !value) {
        console.error(`Invalid header: ${name}=${value}`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error("Error validating security config:", error);
    return false;
  }
}

/**
 * Get security report for monitoring
 * @returns Security report
 */
export function getSecurityReport(): {
  config: SecurityHeaderConfig;
  environment: string;
  recommendations: string[];
} {
  const config = getDefaultSecurityConfig();
  const recommendations: string[] = [];

  // Check environment
  const environment = process.env.NODE_ENV || "development";

  // Generate recommendations
  if (!config.enableCSP) {
    recommendations.push("Enable Content Security Policy (CSP)");
  }

  if (!config.enableHSTS && environment === "production") {
    recommendations.push(
      "Enable HTTP Strict Transport Security (HSTS) in production",
    );
  }

  if (config.cspDirectives["script-src"]?.includes("'unsafe-inline'")) {
    recommendations.push("Remove unsafe-inline from script-src in CSP");
  }

  if (config.cspDirectives["script-src"]?.includes("'unsafe-eval'")) {
    recommendations.push("Remove unsafe-eval from script-src in CSP");
  }

  return {
    config,
    environment,
    recommendations,
  };
}

export default {
  getDefaultSecurityConfig,
  generateCSPNonce,
  buildCSPHeader,
  getSecurityHeaders,
  securityHeadersMiddleware,
  getAPISecurityHeaders,
  apiSecurityHeadersMiddleware,
  validateSecurityConfig,
  getSecurityReport,
};
