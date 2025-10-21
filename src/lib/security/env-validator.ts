import { z } from "zod";

// Simplified environment schema - only critical variables required
const envSchema = z.object({
  // Database - Critical
  DATABASE_URL: z.string().min(1, "Database URL is required"),
  POSTGRES_PRISMA_URL: z.string().optional().default(""),

  // NextAuth - Critical
  NEXTAUTH_SECRET: z
    .string()
    .min(32, "NextAuth secret must be at least 32 characters"),
  NEXTAUTH_URL: z.string().optional().default("http://localhost:3000"),

  // Security Keys - Optional with defaults
  JWT_SECRET: z
    .string()
    .optional()
    .default("default-jwt-secret-change-in-production"),
  ENCRYPTION_KEY: z
    .string()
    .optional()
    .default("default-encryption-key-change-in-production"),
  API_KEY_ENCRYPTION_KEY: z
    .string()
    .optional()
    .default("default-api-key-encryption-change-in-production"),

  // 2FA - Optional with defaults
  TOTP_SECRET: z.string().optional().default("JBSWY3DPEHPK3PXP"),
  TOTP_ISSUER: z.string().optional().default("FX Platform Windows"),

  // Session Management - Optional with defaults
  SESSION_SECRET: z
    .string()
    .optional()
    .default("default-session-secret-change-in-production"),
  SESSION_MAX_AGE: z.string().optional().default("86400000"),

  // CORS - Optional with defaults
  ALLOWED_ORIGINS: z
    .string()
    .optional()
    .default("http://localhost:3000,https://localhost:3000"),

  // Rate Limiting - Optional with sensible defaults
  RATE_LIMIT_WINDOW_MS: z.string().optional().default("900000"),
  RATE_LIMIT_MAX_REQUESTS: z.string().optional().default("100"),
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS: z.string().optional().default("5"),
  TRADING_RATE_LIMIT_MAX_REQUESTS: z.string().optional().default("50"),
  API_RATE_LIMIT_MAX_REQUESTS: z.string().optional().default("1000"),

  // Security Headers - Optional with defaults
  ENABLE_HELMET_MIDDLEWARE: z.string().optional().default("true"),
  ENABLE_CSP: z.string().optional().default("false"),
  CSP_NONCE_GENERATION: z.string().optional().default("false"),

  // Trade Confirmation - Optional with defaults
  TRADE_CONFIRMATION_EMAIL_ENABLED: z.string().optional().default("false"),
  TRADE_CONFIRMATION_SMS_ENABLED: z.string().optional().default("false"),
  LARGE_TRADE_THRESHOLD: z.string().optional().default("10000"),

  // Security Monitoring - Optional with defaults
  SECURITY_ALERT_EMAIL: z.string().email().optional(),
  FAILED_LOGIN_ALERT_THRESHOLD: z.string().optional().default("3"),
  SECURITY_EVENT_WEBHOOK_URL: z.string().url().optional(),

  // Password Policy - Optional with defaults
  MIN_PASSWORD_LENGTH: z.string().optional().default("8"),
  PASSWORD_REQUIRE_UPPERCASE: z.string().optional().default("true"),
  PASSWORD_REQUIRE_LOWERCASE: z.string().optional().default("true"),
  PASSWORD_REQUIRE_NUMBERS: z.string().optional().default("true"),
  PASSWORD_REQUIRE_SYMBOLS: z.string().optional().default("false"),
  PASSWORD_MAX_AGE_DAYS: z.string().optional().default("90"),

  // Optional external services
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Email (optional)
  RESEND_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().optional(),

  // OAuth providers (optional)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  // AI Integration (optional)
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().optional(),

  // Market Data (optional)
  TWELVEDATA_API_KEY: z.string().optional(),
  YAHOO_FINANCE_API_KEY: z.string().optional(),
  YAHOO_FINANCE_RAPIDAPI_HOST: z.string().optional(),

  // External Services (optional)
  SENTRY_DSN: z.string().optional(),
  DATADOG_API_KEY: z.string().optional(),

  // Realtime Configuration (optional)
  PUSHER_APP_ID: z.string().optional(),
  NEXT_PUBLIC_PUSHER_KEY: z.string().optional(),
  PUSHER_SECRET: z.string().optional(),
  NEXT_PUBLIC_PUSHER_CLUSTER: z.string().optional(),
  ABLY_API_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),

  // Environment - Optional with defaults
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .optional()
    .default("development"),
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .optional()
    .default("info"),
  NEXT_PUBLIC_ENV: z.string().optional().default("development"),
});

// Type for validated environment variables
export type Env = z.infer<typeof envSchema>;

let validatedEnv: Env | null = null;

/**
 * Validates environment variables with sensible defaults
 * Returns environment variables without throwing errors for missing optional vars
 */
export function validateEnv(): Env {
  if (validatedEnv) {
    return validatedEnv;
  }

  try {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
      // Log errors but don't fail for non-critical variables
      const errors = result.error.errors.map(
        (err) => `${err.path.join(".")}: ${err.message}`,
      );

      // Check if critical variables are missing
      const criticalErrors = errors.filter(
        (err) =>
          err.includes("DATABASE_URL") || err.includes("NEXTAUTH_SECRET"),
      );

      if (criticalErrors.length > 0) {
        console.error(
          "❌ Critical environment validation failed:",
          criticalErrors.join("\n"),
        );
        throw new Error(
          `Critical environment validation failed:\n${criticalErrors.join("\n")}`,
        );
      }

      // Log warnings for non-critical variables
      console.warn(
        "⚠️  Non-critical environment variables missing:",
        errors.join("\n"),
      );
    }

    validatedEnv = result.success ? result.data : envSchema.parse(process.env);
    return validatedEnv;
  } catch (error) {
    console.error("❌ Environment validation failed:", error);
    throw error;
  }
}

/**
 * Get a validated environment variable with fallback
 */
export function getEnvVar<K extends keyof Env>(key: K): Env[K] {
  try {
    const env = validateEnv();
    return env[key];
  } catch (error) {
    // Return default values for common cases
    const defaults: Partial<Env> = {
      NEXTAUTH_URL: "http://localhost:3000",
      JWT_SECRET: "default-jwt-secret-change-in-production",
      ENCRYPTION_KEY: "default-encryption-key-change-in-production",
      SESSION_SECRET: "default-session-secret-change-in-production",
      NODE_ENV: "development",
      LOG_LEVEL: "info",
    };

    return defaults[key] as Env[K];
  }
}

/**
 * Check if critical environment variables are configured
 */
export function isEnvConfigured(): boolean {
  try {
    const env = validateEnv();
    return !!(env.DATABASE_URL && env.NEXTAUTH_SECRET);
  } catch {
    return false;
  }
}

/**
 * Get environment-specific configuration
 */
export function getEnvConfig() {
  const env = validateEnv();

  return {
    isProduction: env.NODE_ENV === "production",
    isDevelopment: env.NODE_ENV === "development",
    databaseUrl: env.DATABASE_URL,
    nextAuthSecret: env.NEXTAUTH_SECRET,
    nextAuthUrl: env.NEXTAUTH_URL,
    // Add commonly used configurations
    rateLimiting: {
      windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
      maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS) || 100,
    },
    session: {
      maxAge: parseInt(env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000,
    },
    security: {
      enableHelmet: env.ENABLE_HELMET_MIDDLEWARE === "true",
      enableCSP: env.ENABLE_CSP === "true",
    },
  };
}

// Export default for convenience
export default validateEnv;
