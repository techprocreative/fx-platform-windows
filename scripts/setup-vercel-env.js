#!/usr/bin/env node

const crypto = require('crypto');

/**
 * Generate secure environment variables for Vercel deployment
 * Run this script to generate values for required environment variables
 */

function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('base64').slice(0, length);
}

function generateTOTPSecret() {
  return crypto.randomBytes(16).toString('base64').replace(/[^A-Z2-7]/g, '').slice(0, 16);
}

const envVars = {
  // Security Keys
  JWT_SECRET: generateSecret(32),
  ENCRYPTION_KEY: generateSecret(32),
  API_KEY_ENCRYPTION_KEY: generateSecret(32),
  NEXTAUTH_SECRET: generateSecret(32),
  SESSION_SECRET: generateSecret(32),

  // 2FA
  TOTP_SECRET: generateTOTPSecret(),
  TOTP_ISSUER: 'FX Platform Windows',

  // Session
  SESSION_MAX_AGE: '86400000',

  // CORS
  ALLOWED_ORIGINS: 'https://your-domain.vercel.app,https://localhost:3000',

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: '900000',
  RATE_LIMIT_MAX_REQUESTS: '100',
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS: '5',
  TRADING_RATE_LIMIT_MAX_REQUESTS: '50',
  API_RATE_LIMIT_MAX_REQUESTS: '1000',

  // Security Headers
  ENABLE_HELMET_MIDDLEWARE: 'true',
  ENABLE_CSP: 'true',
  CSP_NONCE_GENERATION: 'true',

  // Trade Confirmation
  TRADE_CONFIRMATION_EMAIL_ENABLED: 'false',
  TRADE_CONFIRMATION_SMS_ENABLED: 'false',
  LARGE_TRADE_THRESHOLD: '10000',

  // Security Monitoring
  FAILED_LOGIN_ALERT_THRESHOLD: '3',

  // Password Policy
  MIN_PASSWORD_LENGTH: '8',
  PASSWORD_REQUIRE_UPPERCASE: 'true',
  PASSWORD_REQUIRE_LOWERCASE: 'true',
  PASSWORD_REQUIRE_NUMBERS: 'true',
  PASSWORD_REQUIRE_SYMBOLS: 'true',
  PASSWORD_MAX_AGE_DAYS: '90',

  // Environment
  NODE_ENV: 'production',
  LOG_LEVEL: 'info',
  NEXT_PUBLIC_ENV: 'production',
};

console.log('🔐 Generated Environment Variables for Vercel Deployment\n');
console.log('Copy these to your Vercel Environment Variables:\n');

Object.entries(envVars).forEach(([key, value]) => {
  console.log(`${key}=${value}`);
});

console.log('\n⚠️  IMPORTANT:');
console.log('1. Replace your-domain.vercel.app with your actual Vercel domain');
console.log('2. Add your database connection strings');
console.log('3. Add your API keys for market data services');
console.log('4. Mark sensitive variables as "Secret" in Vercel');

console.log('\n📋 Required Manual Setup:');
console.log('- DATABASE_URL (PostgreSQL connection string)');
console.log('- POSTGRES_PRISMA_URL (Same as DATABASE_URL)');
console.log('- NEXTAUTH_URL (Your Vercel domain)');
console.log('- TWELVEDATA_API_KEY (Get from twelvedata.com)');
console.log('- YAHOO_FINANCE_API_KEY (Get from RapidAPI)');
console.log('- UPSTASH_REDIS_REST_URL (Optional, for caching)');
console.log('- UPSTASH_REDIS_REST_TOKEN (Optional, for caching)');
