/**
 * Symbol Mapper for Data Providers
 * Converts internal symbol format to provider-specific formats
 */

export interface SymbolMapping {
  internal: string;
  yahooFinance?: string;
  twelveData?: string;
  alphaVantage?: string;
}

/**
 * Symbol mappings for different data providers
 */
export const SYMBOL_MAPPINGS: Record<string, SymbolMapping> = {
  // Major Forex Pairs
  EURUSD: { internal: 'EURUSD', yahooFinance: 'EURUSD=X', twelveData: 'EUR/USD' },
  GBPUSD: { internal: 'GBPUSD', yahooFinance: 'GBPUSD=X', twelveData: 'GBP/USD' },
  USDJPY: { internal: 'USDJPY', yahooFinance: 'USDJPY=X', twelveData: 'USD/JPY' },
  USDCHF: { internal: 'USDCHF', yahooFinance: 'USDCHF=X', twelveData: 'USD/CHF' },
  AUDUSD: { internal: 'AUDUSD', yahooFinance: 'AUDUSD=X', twelveData: 'AUD/USD' },
  USDCAD: { internal: 'USDCAD', yahooFinance: 'USDCAD=X', twelveData: 'USD/CAD' },
  NZDUSD: { internal: 'NZDUSD', yahooFinance: 'NZDUSD=X', twelveData: 'NZD/USD' },

  // Minor Forex Pairs
  EURGBP: { internal: 'EURGBP', yahooFinance: 'EURGBP=X', twelveData: 'EUR/GBP' },
  EURJPY: { internal: 'EURJPY', yahooFinance: 'EURJPY=X', twelveData: 'EUR/JPY' },
  EURCHF: { internal: 'EURCHF', yahooFinance: 'EURCHF=X', twelveData: 'EUR/CHF' },
  EURAUD: { internal: 'EURAUD', yahooFinance: 'EURAUD=X', twelveData: 'EUR/AUD' },
  EURNZD: { internal: 'EURNZD', yahooFinance: 'EURNZD=X', twelveData: 'EUR/NZD' },
  EURCAD: { internal: 'EURCAD', yahooFinance: 'EURCAD=X', twelveData: 'EUR/CAD' },
  GBPJPY: { internal: 'GBPJPY', yahooFinance: 'GBPJPY=X', twelveData: 'GBP/JPY' },
  GBPCHF: { internal: 'GBPCHF', yahooFinance: 'GBPCHF=X', twelveData: 'GBP/CHF' },
  GBPAUD: { internal: 'GBPAUD', yahooFinance: 'GBPAUD=X', twelveData: 'GBP/AUD' },
  GBPNZD: { internal: 'GBPNZD', yahooFinance: 'GBPNZD=X', twelveData: 'GBP/NZD' },
  GBPCAD: { internal: 'GBPCAD', yahooFinance: 'GBPCAD=X', twelveData: 'GBP/CAD' },
  AUDJPY: { internal: 'AUDJPY', yahooFinance: 'AUDJPY=X', twelveData: 'AUD/JPY' },
  CHFJPY: { internal: 'CHFJPY', yahooFinance: 'CHFJPY=X', twelveData: 'CHF/JPY' },
  CADJPY: { internal: 'CADJPY', yahooFinance: 'CADJPY=X', twelveData: 'CAD/JPY' },
  NZDJPY: { internal: 'NZDJPY', yahooFinance: 'NZDJPY=X', twelveData: 'NZD/JPY' },

  // Exotic Forex Pairs
  USDNOK: { internal: 'USDNOK', yahooFinance: 'NOK=X', twelveData: 'USD/NOK' },
  USDSEK: { internal: 'USDSEK', yahooFinance: 'SEK=X', twelveData: 'USD/SEK' },
  USDSGD: { internal: 'USDSGD', yahooFinance: 'SGD=X', twelveData: 'USD/SGD' },
  USDHKD: { internal: 'USDHKD', yahooFinance: 'HKD=X', twelveData: 'USD/HKD' },
  USDZAR: { internal: 'USDZAR', yahooFinance: 'ZAR=X', twelveData: 'USD/ZAR' },
  USDTRY: { internal: 'USDTRY', yahooFinance: 'TRY=X', twelveData: 'USD/TRY' },
  USDMXN: { internal: 'USDMXN', yahooFinance: 'MXN=X', twelveData: 'USD/MXN' },

  // Precious Metals
  XAUUSD: { internal: 'XAUUSD', yahooFinance: 'GC=F', twelveData: 'XAU/USD' },
  XAGUSD: { internal: 'XAGUSD', yahooFinance: 'SI=F', twelveData: 'XAG/USD' },
  XPTUSD: { internal: 'XPTUSD', yahooFinance: 'PL=F', twelveData: 'XPT/USD' },
  XPDUSD: { internal: 'XPDUSD', yahooFinance: 'PA=F', twelveData: 'XPD/USD' },

  // Energy
  USOIL: { internal: 'USOIL', yahooFinance: 'CL=F', twelveData: 'WTI/USD' },
  UKOIL: { internal: 'UKOIL', yahooFinance: 'BZ=F', twelveData: 'BRENT/USD' },
  NGAS: { internal: 'NGAS', yahooFinance: 'NG=F', twelveData: 'NGAS/USD' },

  // Base Metals
  COPPER: { internal: 'COPPER', yahooFinance: 'HG=F', twelveData: 'COPPER/USD' },

  // Agricultural
  WHEAT: { internal: 'WHEAT', yahooFinance: 'ZW=F', twelveData: 'WHEAT/USD' },
  CORN: { internal: 'CORN', yahooFinance: 'ZC=F', twelveData: 'CORN/USD' },
  SOYBEAN: { internal: 'SOYBEAN', yahooFinance: 'ZS=F', twelveData: 'SOYBEAN/USD' },
  COFFEE: { internal: 'COFFEE', yahooFinance: 'KC=F', twelveData: 'COFFEE/USD' },
  SUGAR: { internal: 'SUGAR', yahooFinance: 'SB=F', twelveData: 'SUGAR/USD' },
  COTTON: { internal: 'COTTON', yahooFinance: 'CT=F', twelveData: 'COTTON/USD' },

  // Cryptocurrency
  BTCUSD: { internal: 'BTCUSD', yahooFinance: 'BTC-USD', twelveData: 'BTC/USD' },
  ETHUSD: { internal: 'ETHUSD', yahooFinance: 'ETH-USD', twelveData: 'ETH/USD' },
};

/**
 * Convert internal symbol to provider-specific format
 */
export function convertToProviderSymbol(
  internalSymbol: string,
  provider: 'yahooFinance' | 'twelveData' | 'alphaVantage'
): string {
  const mapping = SYMBOL_MAPPINGS[internalSymbol];
  
  if (!mapping) {
    // If no mapping found, return original symbol
    console.warn(`No symbol mapping found for ${internalSymbol}, using original`);
    return internalSymbol;
  }

  const providerSymbol = mapping[provider];
  
  if (!providerSymbol) {
    console.warn(`Provider ${provider} not supported for ${internalSymbol}, using original`);
    return internalSymbol;
  }

  return providerSymbol;
}

/**
 * Convert provider-specific symbol back to internal format
 */
export function convertFromProviderSymbol(
  providerSymbol: string,
  provider: 'yahooFinance' | 'twelveData' | 'alphaVantage'
): string {
  for (const [internal, mapping] of Object.entries(SYMBOL_MAPPINGS)) {
    if (mapping[provider] === providerSymbol) {
      return internal;
    }
  }

  // If no mapping found, return original symbol
  console.warn(`No internal mapping found for provider symbol ${providerSymbol}`);
  return providerSymbol;
}

/**
 * Check if symbol is supported by provider
 */
export function isSymbolSupportedByProvider(
  internalSymbol: string,
  provider: 'yahooFinance' | 'twelveData' | 'alphaVantage'
): boolean {
  const mapping = SYMBOL_MAPPINGS[internalSymbol];
  return mapping !== undefined && mapping[provider] !== undefined;
}

/**
 * Get all symbols supported by a provider
 */
export function getSupportedSymbols(
  provider: 'yahooFinance' | 'twelveData' | 'alphaVantage'
): string[] {
  return Object.entries(SYMBOL_MAPPINGS)
    .filter(([_, mapping]) => mapping[provider] !== undefined)
    .map(([internal, _]) => internal);
}
