import { z } from 'zod';

// Define the schema for all required environment variables
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "Database URL is required"),
  POSTGRES_PRISMA_URL: z.string().min(1, "Postgres Prisma URL is required"),
  
  // NextAuth
  NEXTAUTH_SECRET: z.string().min(32, "NextAuth secret must be at least 32 characters"),
  NEXTAUTH_URL: z.string().url("NextAuth URL must be a valid URL"),
  
  // Security Keys
  JWT_SECRET: z.string().min(32, "JWT secret must be at least 32 characters"),
  ENCRYPTION_KEY: z.string().min(32, "Encryption key must be at least 32 characters"),
  API_KEY_ENCRYPTION_KEY: z.string().min(32, "API key encryption key must be at least 32 characters"),
  
  // 2FA
  TOTP_SECRET: z.string().min(16, "TOTP secret must be at least 16 characters"),
  TOTP_ISSUER: z.string().min(1, "TOTP issuer is required"),
  
  // Session Management
  SESSION_SECRET: z.string().min(32, "Session secret must be at least 32 characters"),
  
  // CORS
  ALLOWED_ORIGINS: z.string().min(1, "Allowed origins is required"),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).pipe(z.number().positive()),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).pipe(z.number().positive()),
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS: z.string().transform(Number).pipe(z.number().positive()),
  TRADING_RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).pipe(z.number().positive()),
  API_RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).pipe(z.number().positive()),
  
  // Session Management
  SESSION_MAX_AGE: z.string().transform(Number).pipe(z.number().positive()),
  
  // Security Headers
  ENABLE_HELMET_MIDDLEWARE: z.string().transform(val => val === "true"),
  ENABLE_CSP: z.string().transform(val => val === "true"),
  CSP_NONCE_GENERATION: z.string().transform(val => val === "true"),
  
  // Trade Confirmation
  TRADE_CONFIRMATION_EMAIL_ENABLED: z.string().transform(val => val === "true"),
  TRADE_CONFIRMATION_SMS_ENABLED: z.string().transform(val => val === "true"),
  LARGE_TRADE_THRESHOLD: z.string().transform(Number).pipe(z.number().positive()),
  
  // Security Monitoring
  SECURITY_ALERT_EMAIL: z.string().email().optional(),
  FAILED_LOGIN_ALERT_THRESHOLD: z.string().transform(Number).pipe(z.number().positive()),
  SECURITY_EVENT_WEBHOOK_URL: z.string().url().optional(),
  
  // Password Policy
  MIN_PASSWORD_LENGTH: z.string().transform(Number).pipe(z.number().min(8)),
  PASSWORD_REQUIRE_UPPERCASE: z.string().transform(val => val === "true"),
  PASSWORD_REQUIRE_LOWERCASE: z.string().transform(val => val === "true"),
  PASSWORD_REQUIRE_NUMBERS: z.string().transform(val => val === "true"),
  PASSWORD_REQUIRE_SYMBOLS: z.string().transform(val => val === "true"),
  PASSWORD_MAX_AGE_DAYS: z.string().transform(Number).pipe(z.number().positive()),
  
  // Optional variables
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  
  // Email (required if trade confirmation email is enabled)
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
  
  // Payment Processing (optional)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  MIDTRANS_SERVER_KEY: z.string().optional(),
  MIDTRANS_CLIENT_KEY: z.string().optional(),
  
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
  
  // Environment
  NODE_ENV: z.enum(["development", "production", "test"]),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),
  NEXT_PUBLIC_ENV: z.string().optional(),
});

// Type for validated environment variables
export type Env = z.infer<typeof envSchema>;

let validatedEnv: Env | null = null;

/**
 * Validates all required environment variables
 * @returns {Env} Validated environment variables
 * @throws {Error} If validation fails
 */
export function validateEnv(): Env {
  if (validatedEnv) {
    return validatedEnv;
  }

  try {
    const result = envSchema.safeParse(process.env);
    
    if (!result.success) {
      const errors = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
    }
    
    validatedEnv = result.data;
    
    // Additional validation for conditional requirements
    if (validatedEnv.TRADE_CONFIRMATION_EMAIL_ENABLED && !validatedEnv.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is required when TRADE_CONFIRMATION_EMAIL_ENABLED is true");
    }
    
    if (validatedEnv.TRADE_CONFIRMATION_EMAIL_ENABLED && !validatedEnv.FROM_EMAIL) {
      throw new Error("FROM_EMAIL is required when TRADE_CONFIRMATION_EMAIL_ENABLED is true");
    }
    
    return validatedEnv;
  } catch (error) {
    console.error("❌ Environment validation failed:", error);
    throw error;
  }
}

/**
 * Get a validated environment variable
 * @param key - The environment variable key
 * @returns The validated value
 */
export function getEnvVar<K extends keyof Env>(key: K): Env[K] {
  const env = validateEnv();
  return env[key];
}

/**
 * Check if all required environment variables are set
 * @returns boolean indicating if environment is properly configured
 */
export function isEnvConfigured(): boolean {
  try {
    validateEnv();
    return true;
  } catch {
    return false;
  }
}

// Export default for convenience
export default validateEnv;