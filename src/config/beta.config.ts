/**
 * Beta Testing Configuration
 * Security and operational limits for beta phase
 */

export const BETA_CONFIG = {
  // Beta mode flag
  enabled: process.env.BETA_MODE === 'true',
  
  // Trading limits
  limits: {
    maxDailyTrades: 20,
    maxLotSize: 0.01, // Micro lots only
    maxPositions: 3,
    maxDailyLoss: 100, // USD
    maxDrawdown: 20, // Percentage
    
    // Symbol whitelist for beta testing
    allowedSymbols: [
      // Major Forex Pairs
      'EURUSD',
      'GBPUSD',
      'USDJPY',
      'AUDUSD',
      'NZDUSD',
      'USDCAD',
      'USDCHF',
      'EURJPY',
      'GBPJPY',
      
      // Crypto
      'BTCUSD',
      'ETHUSD',
      
      // Commodities
      'XAUUSD',  // Gold
      'XAGUSD',  // Silver
      'USOIL',   // Oil
    ],
  },
  
  // Account restrictions
  accounts: {
    requireDemoAccount: true, // Force demo accounts only
    maxActiveExecutors: 2,
    maxStrategiesPerUser: 5,
  },
  
  // Rate limiting
  rateLimits: {
    apiRequests: {
      windowMs: 60 * 1000, // 1 minute
      max: 30, // requests per window
    },
    tradeCommands: {
      windowMs: 60 * 1000, // 1 minute
      max: 10, // trades per minute
    },
  },
  
  // Monitoring
  monitoring: {
    enableDetailedLogging: true,
    logAllTrades: true,
    alertOnErrors: true,
    maxErrorsBeforeStop: 5,
  },
  
  // Testing phase
  phase: {
    current: 'internal', // 'internal' | 'limited' | 'open'
    maxTesters: 50,
    inviteOnly: true,
  },
};

export const getBetaLimits = () => {
  if (!BETA_CONFIG.enabled) {
    return null;
  }
  return BETA_CONFIG.limits;
};

export const isBetaMode = () => BETA_CONFIG.enabled;

export const validateBetaRestrictions = (action: string, data: any) => {
  if (!BETA_CONFIG.enabled) return { valid: true };
  
  const errors: string[] = [];
  
  switch (action) {
    case 'OPEN_POSITION':
      if (data.lotSize > BETA_CONFIG.limits.maxLotSize) {
        errors.push(`Lot size exceeds beta limit of ${BETA_CONFIG.limits.maxLotSize}`);
      }
      
      if (!BETA_CONFIG.limits.allowedSymbols.includes(data.symbol)) {
        errors.push(`Symbol ${data.symbol} not allowed in beta. Allowed: ${BETA_CONFIG.limits.allowedSymbols.join(', ')}`);
      }
      break;
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
};
