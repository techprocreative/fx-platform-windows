/**
 * Runtime Environment Variable Debugger
 * Helps diagnose environment variable loading issues in serverless functions
 */

interface EnvDebugInfo {
  key: string;
  exists: boolean;
  length: number;
  preview: string;
  type: string;
}

interface EnvDebugReport {
  timestamp: string;
  nodeEnv: string;
  vercelEnv?: string;
  region?: string;
  totalEnvVars: number;
  criticalVars: EnvDebugInfo[];
  marketDataVars: EnvDebugInfo[];
  redisVars: EnvDebugInfo[];
  allVarKeys: string[];
}

/**
 * Mask sensitive environment variable values
 */
function maskValue(value: string | undefined): string {
  if (!value) return 'NOT_SET';
  if (value.length <= 8) return '***';
  return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
}

/**
 * Get detailed info about an environment variable
 */
function getEnvVarInfo(key: string): EnvDebugInfo {
  const value = process.env[key];

  return {
    key,
    exists: !!value,
    length: value?.length || 0,
    preview: maskValue(value),
    type: typeof value,
  };
}

/**
 * Generate comprehensive environment debug report
 */
export function generateEnvDebugReport(): EnvDebugReport {
  // Critical environment variables
  const criticalKeys = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
  ];

  // Market data API keys
  const marketDataKeys = [
    'TWELVEDATA_API_KEY',
    'YAHOO_FINANCE_API_KEY',
    'YAHOO_FINANCE_RAPIDAPI_HOST',
  ];

  // Redis configuration
  const redisKeys = [
    'REDIS_URL',
    'REDIS_HOST',
    'REDIS_PORT',
    'REDIS_PASSWORD',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
  ];

  return {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV || 'unknown',
    vercelEnv: process.env.VERCEL_ENV,
    region: process.env.VERCEL_REGION,
    totalEnvVars: Object.keys(process.env).length,
    criticalVars: criticalKeys.map(getEnvVarInfo),
    marketDataVars: marketDataKeys.map(getEnvVarInfo),
    redisVars: redisKeys.map(getEnvVarInfo),
    allVarKeys: Object.keys(process.env).sort(),
  };
}

/**
 * Log environment debug info to console
 */
export function logEnvDebug(prefix = '🔍 ENV DEBUG'): void {
  const report = generateEnvDebugReport();

  console.log(`\n${prefix} - ${report.timestamp}`);
  console.log(`📊 Environment: ${report.nodeEnv} (Vercel: ${report.vercelEnv || 'N/A'})`);
  console.log(`🌍 Region: ${report.region || 'N/A'}`);
  console.log(`📦 Total env vars: ${report.totalEnvVars}`);

  console.log('\n🔐 Critical Variables:');
  report.criticalVars.forEach(v => {
    const status = v.exists ? '✅' : '❌';
    console.log(`  ${status} ${v.key}: ${v.preview} (length: ${v.length})`);
  });

  console.log('\n📈 Market Data Variables:');
  report.marketDataVars.forEach(v => {
    const status = v.exists ? '✅' : '❌';
    console.log(`  ${status} ${v.key}: ${v.preview} (length: ${v.length})`);
  });

  console.log('\n🗄️ Redis Variables:');
  report.redisVars.forEach(v => {
    const status = v.exists ? '✅' : '❌';
    console.log(`  ${status} ${v.key}: ${v.preview} (length: ${v.length})`);
  });
}

/**
 * Check if a specific environment variable is properly loaded
 */
export function checkEnvVar(key: string): {
  loaded: boolean;
  value?: string;
  preview?: string;
} {
  const value = process.env[key];

  if (!value) {
    console.error(`❌ Environment variable ${key} is NOT loaded`);
    return { loaded: false };
  }

  console.log(`✅ Environment variable ${key} is loaded: ${maskValue(value)}`);
  return {
    loaded: true,
    preview: maskValue(value),
  };
}

/**
 * Validate required environment variables
 */
export function validateRequiredEnvVars(requiredKeys: string[]): {
  valid: boolean;
  missing: string[];
  present: string[];
} {
  const missing: string[] = [];
  const present: string[] = [];

  requiredKeys.forEach(key => {
    if (process.env[key]) {
      present.push(key);
    } else {
      missing.push(key);
    }
  });

  const valid = missing.length === 0;

  if (!valid) {
    console.error('❌ Missing required environment variables:', missing);
  } else {
    console.log('✅ All required environment variables are present');
  }

  return { valid, missing, present };
}

/**
 * Get environment variable with fallback and logging
 */
export function getEnvWithFallback(
  key: string,
  fallback?: string,
  logWarning = true
): string {
  const value = process.env[key];

  if (!value) {
    if (logWarning && !fallback) {
      console.warn(`⚠️ Environment variable ${key} not found and no fallback provided`);
    }
    if (fallback && logWarning) {
      console.warn(`⚠️ Using fallback for ${key}`);
    }
    return fallback || '';
  }

  return value;
}

/**
 * Force reload environment variables (for debugging)
 * Note: This only works if variables are set at runtime
 */
export function forceReloadEnv(): void {
  console.log('🔄 Attempting to force reload environment variables...');

  // Log current state
  const before = Object.keys(process.env).length;
  console.log(`📊 Current env vars count: ${before}`);

  // In Vercel serverless, env vars are loaded at cold start
  // This function mainly helps with debugging
  console.log('ℹ️ Note: In Vercel serverless, env vars are loaded at cold start');
  console.log('ℹ️ If variables are missing, ensure they are set in Vercel dashboard');
  console.log('ℹ️ And that the deployment was triggered AFTER setting them');

  logEnvDebug('🔄 ENV RELOAD ATTEMPT');
}

/**
 * Export debug report as JSON string
 */
export function exportEnvDebugJSON(): string {
  const report = generateEnvDebugReport();
  return JSON.stringify(report, null, 2);
}

/**
 * Test API key by making a simple request
 */
export async function testTwelveDataKey(): Promise<{
  success: boolean;
  error?: string;
  keyExists: boolean;
}> {
  const apiKey = process.env.TWELVEDATA_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: 'API key not found in environment variables',
      keyExists: false,
    };
  }

  try {
    const response = await fetch(
      `https://api.twelvedata.com/time_series?symbol=EUR/USD&interval=1min&outputsize=1&apikey=${apiKey}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `API returned ${response.status}: ${errorText}`,
        keyExists: true,
      };
    }

    return {
      success: true,
      keyExists: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      keyExists: true,
    };
  }
}

export default {
  generateEnvDebugReport,
  logEnvDebug,
  checkEnvVar,
  validateRequiredEnvVars,
  getEnvWithFallback,
  forceReloadEnv,
  exportEnvDebugJSON,
  testTwelveDataKey,
};
