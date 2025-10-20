/**
 * Application Configuration
 * 
 * This file contains all configuration values for the FX Trading Platform.
 * It centralizes configuration to make it easier to manage across environments.
 */

// Environment detection
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// API Configuration
export const API_CONFIG = {
  // Base URLs
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || (isDevelopment ? 'http://localhost:3000/api' : 'https://api.nexustrade.com'),
  WEBSOCKET_URL: process.env.NEXT_PUBLIC_WS_URL || (isDevelopment ? 'ws://localhost:3000' : 'wss://api.nexustrade.com'),
  
  // Timeouts
  REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10), // 30 seconds
  WEBSOCKET_TIMEOUT: parseInt(process.env.WEBSOCKET_TIMEOUT || '10000', 10), // 10 seconds
  
  // Retry configuration
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '3', 10),
  RETRY_DELAY: parseInt(process.env.RETRY_DELAY || '1000', 10), // 1 second
  
  // Rate limiting
  RATE_LIMIT_REQUESTS: parseInt(process.env.RATE_LIMIT_REQUESTS || '100', 10),
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10), // 1 minute
} as const;

// Database Configuration
export const DB_CONFIG = {
  // Connection pool
  MIN_POOL_SIZE: parseInt(process.env.MIN_POOL_SIZE || '2', 10),
  MAX_POOL_SIZE: parseInt(process.env.MAX_POOL_SIZE || '10', 10),
  
  // Query timeouts
  QUERY_TIMEOUT: parseInt(process.env.QUERY_TIMEOUT || '30000', 10), // 30 seconds
  
  // Connection timeout
  CONNECTION_TIMEOUT: parseInt(process.env.CONNECTION_TIMEOUT || '10000', 10), // 10 seconds
} as const;

// Authentication Configuration
export const AUTH_CONFIG = {
  // JWT settings
  JWT_SECRET: process.env.JWT_SECRET || (isDevelopment ? 'dev-secret-key' : ''),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  
  // Session settings
  SESSION_MAX_AGE: parseInt(process.env.SESSION_MAX_AGE || '604800000', 10), // 7 days in ms
  SESSION_UPDATE_AGE: parseInt(process.env.SESSION_UPDATE_AGE || '86400000', 10), // 1 day in ms
  
  // Password settings
  PASSWORD_MIN_LENGTH: parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10),
  PASSWORD_REQUIRE_UPPERCASE: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
  PASSWORD_REQUIRE_LOWERCASE: process.env.PASSWORD_REQUIRE_LOWERCASE !== 'false',
  PASSWORD_REQUIRE_NUMBERS: process.env.PASSWORD_REQUIRE_NUMBERS !== 'false',
  PASSWORD_REQUIRE_SYMBOLS: process.env.PASSWORD_REQUIRE_SYMBOLS !== 'false',
  
  // 2FA settings
  TWO_FACTOR_ENABLED: process.env.TWO_FACTOR_ENABLED !== 'false',
  TWO_FACTOR_ISSUER: process.env.TWO_FACTOR_ISSUER || 'NexusTrade',
} as const;

// Trading Configuration
export const TRADING_CONFIG = {
  // Default values
  DEFAULT_LOT_SIZE: parseFloat(process.env.DEFAULT_LOT_SIZE || '0.01'),
  DEFAULT_LEVERAGE: parseInt(process.env.DEFAULT_LEVERAGE || '100', 10),
  DEFAULT_SPREAD: parseFloat(process.env.DEFAULT_SPREAD || '2'), // 2 pips
  
  // Risk management
  MAX_DAILY_LOSS_PERCENT: parseFloat(process.env.MAX_DAILY_LOSS_PERCENT || '5'), // 5%
  MAX_POSITION_SIZE_PERCENT: parseFloat(process.env.MAX_POSITION_SIZE_PERCENT || '2'), // 2%
  MAX_OPEN_POSITIONS: parseInt(process.env.MAX_OPEN_POSITIONS || '5', 10),
  
  // Backtesting
  DEFAULT_BACKTEST_BALANCE: parseFloat(process.env.DEFAULT_BACKTEST_BALANCE || '10000'),
  MAX_BACKTEST_DAYS: parseInt(process.env.MAX_BACKTEST_DAYS || '3650', 10), // 10 years
  
  // Symbols
  SUPPORTED_SYMBOLS: process.env.SUPPORTED_SYMBOLS?.split(',') || [
    'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
    'EURGBP', 'EURJPY', 'EURCHF', 'EURAUD', 'EURNZD', 'EURCAD',
    'GBPJPY', 'GBPCHF', 'GBPAUD', 'GBPNZD', 'GBPCAD',
    'USDJPY', 'USDCHF', 'USDCAD', 'USDAUD', 'USDNOK', 'USDSEK'
  ],
  
  // Timeframes
  SUPPORTED_TIMEFRAMES: process.env.SUPPORTED_TIMEFRAMES?.split(',') || [
    'M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'
  ],
} as const;

// UI Configuration
export const UI_CONFIG = {
  // Pagination
  DEFAULT_PAGE_SIZE: parseInt(process.env.DEFAULT_PAGE_SIZE || '20', 10),
  MAX_PAGE_SIZE: parseInt(process.env.MAX_PAGE_SIZE || '100', 10),
  
  // Tables
  TABLE_PAGE_SIZES: [10, 20, 50, 100],
  
  // Charts
  CHART_REFRESH_INTERVAL: parseInt(process.env.CHART_REFRESH_INTERVAL || '5000', 10), // 5 seconds
  DEFAULT_CHART_PERIOD: process.env.DEFAULT_CHART_PERIOD || 'D1',
  
  // Theme
  DEFAULT_THEME: process.env.DEFAULT_THEME || 'light',
  
  // Notifications
  NOTIFICATION_DURATION: parseInt(process.env.NOTIFICATION_DURATION || '5000', 10), // 5 seconds
  TOAST_POSITION: process.env.TOAST_POSITION || 'top-right',
} as const;

// Monitoring Configuration
export const MONITORING_CONFIG = {
  // Error reporting
  SENTRY_DSN: process.env.SENTRY_DSN || '',
  SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT || (isDevelopment ? 'development' : 'production'),
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  LOG_MAX_FILES: parseInt(process.env.LOG_MAX_FILES || '10', 10),
  LOG_MAX_SIZE: process.env.LOG_MAX_SIZE || '10m',
  
  // Performance monitoring
  PERFORMANCE_MONITORING_ENABLED: process.env.PERFORMANCE_MONITORING_ENABLED !== 'false',
  SLOW_QUERY_THRESHOLD: parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000', 10), // 1 second
} as const;

// Feature Flags
export const FEATURE_FLAGS = {
  // Enable/disable features
  AI_STRATEGY_GENERATION: process.env.FEATURE_AI_STRATEGY_GENERATION !== 'false',
  SOCIAL_TRADING: process.env.FEATURE_SOCIAL_TRADING === 'true',
  ADVANCED_CHARTING: process.env.FEATURE_ADVANCED_CHARTING !== 'false',
  PAPER_TRADING: process.env.FEATURE_PAPER_TRADING !== 'false',
  MOBILE_APP: process.env.FEATURE_MOBILE_APP === 'true',
  
  // Beta features
  BETA_FEATURES_ENABLED: process.env.BETA_FEATURES_ENABLED === 'true',
  NEW_DASHBOARD: process.env.FEATURE_NEW_DASHBOARD === 'true',
} as const;

// External Service Configuration
export const EXTERNAL_SERVICES = {
  // Data providers
  TWELVE_DATA_API_KEY: process.env.TWELVE_DATA_API_KEY || '',
  TWELVE_DATA_BASE_URL: process.env.TWELVE_DATA_BASE_URL || 'https://api.twelvedata.com',
  
  // Payment processing
  STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  
  // Email service
  EMAIL_SERVICE: process.env.EMAIL_SERVICE || 'resend',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  FROM_EMAIL: process.env.FROM_EMAIL || 'noreply@nexustrade.com',
  
  // File storage
  BLOB_STORAGE_URL: process.env.BLOB_STORAGE_URL || '',
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN || '',
} as const;

// Cache Configuration
export const CACHE_CONFIG = {
  // Redis
  REDIS_URL: process.env.REDIS_URL || (isDevelopment ? 'redis://localhost:6379' : ''),
  REDIS_PREFIX: process.env.REDIS_PREFIX || 'nexustrade:',
  REDIS_TTL: parseInt(process.env.REDIS_TTL || '3600', 10), // 1 hour
  
  // HTTP cache
  HTTP_CACHE_MAX_AGE: parseInt(process.env.HTTP_CACHE_MAX_AGE || '300', 10), // 5 minutes
  HTTP_CACHE_STALE_WHILE_REVALIDATE: parseInt(process.env.HTTP_CACHE_STALE_WHILE_REVALIDATE || '60', 10), // 1 minute
} as const;

// Security Configuration
export const SECURITY_CONFIG = {
  // CORS
  CORS_ORIGINS: process.env.CORS_ORIGINS?.split(',') || (isDevelopment ? ['http://localhost:3000'] : ['https://nexustrade.com']),
  CORS_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  CORS_CREDENTIALS: true,
  
  // Rate limiting
  RATE_LIMIT_STRICT: process.env.RATE_LIMIT_STRICT === 'true',
  RATE_LIMIT_GLOBAL_MAX: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || '1000', 10),
  RATE_LIMIT_GLOBAL_WINDOW: parseInt(process.env.RATE_LIMIT_GLOBAL_WINDOW || '60000', 10), // 1 minute
  
  // Security headers
  SECURITY_HEADERS_ENABLED: process.env.SECURITY_HEADERS_ENABLED !== 'false',
  CSP_ENABLED: process.env.CSP_ENABLED !== 'false',
} as const;

// Export all configurations
export const CONFIG = {
  ENVIRONMENT: process.env.NODE_ENV || 'development',
  isDevelopment,
  isProduction,
  isTest,
  API: API_CONFIG,
  DB: DB_CONFIG,
  AUTH: AUTH_CONFIG,
  TRADING: TRADING_CONFIG,
  UI: UI_CONFIG,
  MONITORING: MONITORING_CONFIG,
  FEATURES: FEATURE_FLAGS,
  EXTERNAL: EXTERNAL_SERVICES,
  CACHE: CACHE_CONFIG,
  SECURITY: SECURITY_CONFIG,
} as const;

// Type exports for TypeScript
export type ConfigType = typeof CONFIG;
export type APIConfigType = typeof API_CONFIG;
export type DBConfigType = typeof DB_CONFIG;
export type AuthConfigType = typeof AUTH_CONFIG;
export type TradingConfigType = typeof TRADING_CONFIG;
export type UIConfigType = typeof UI_CONFIG;
export type MonitoringConfigType = typeof MONITORING_CONFIG;
export type FeatureFlagsType = typeof FEATURE_FLAGS;
export type ExternalServicesType = typeof EXTERNAL_SERVICES;
export type CacheConfigType = typeof CACHE_CONFIG;
export type SecurityConfigType = typeof SECURITY_CONFIG;