/**
 * Symbol Configuration and Categorization
 * 
 * This file provides categorized symbols with metadata for the trading platform.
 * It helps organize symbols by type (Forex, Commodities) and provides useful
 * information for UI components.
 */

import { TRADING_CONFIG } from "@/lib/config";

export interface SymbolMetadata {
  symbol: string;
  name: string;
  type: 'forex' | 'commodity';
  category: 'major' | 'minor' | 'exotic' | 'precious-metals' | 'energy' | 'base-metals' | 'agricultural';
  description: string;
  pipSize?: number;
  tickSize?: number;
  minLotSize?: number;
  maxLotSize?: number;
  lotStep?: number;
}

export const SYMBOL_METADATA: Record<string, SymbolMetadata> = {
  // Major Forex Pairs
  EURUSD: {
    symbol: 'EURUSD',
    name: 'Euro vs US Dollar',
    type: 'forex',
    category: 'major',
    description: 'The most traded currency pair in the world',
    pipSize: 0.0001,
    minLotSize: 0.01,
    maxLotSize: 100,
    lotStep: 0.01,
  },
  GBPUSD: {
    symbol: 'GBPUSD',
    name: 'British Pound vs US Dollar',
    type: 'forex',
    category: 'major',
    description: 'The "Cable" - highly liquid major pair',
    pipSize: 0.0001,
    minLotSize: 0.01,
    maxLotSize: 100,
    lotStep: 0.01,
  },
  USDJPY: {
    symbol: 'USDJPY',
    name: 'US Dollar vs Japanese Yen',
    type: 'forex',
    category: 'major',
    description: 'Major pair representing USD and JPY',
    pipSize: 0.01,
    minLotSize: 0.01,
    maxLotSize: 100,
    lotStep: 0.01,
  },
  USDCHF: {
    symbol: 'USDCHF',
    name: 'US Dollar vs Swiss Franc',
    type: 'forex',
    category: 'major',
    description: 'The "Swissie" - safe haven currency pair',
    pipSize: 0.0001,
    minLotSize: 0.01,
    maxLotSize: 100,
    lotStep: 0.01,
  },
  AUDUSD: {
    symbol: 'AUDUSD',
    name: 'Australian Dollar vs US Dollar',
    type: 'forex',
    category: 'major',
    description: 'The "Aussie" - commodity-linked currency',
    pipSize: 0.0001,
    minLotSize: 0.01,
    maxLotSize: 100,
    lotStep: 0.01,
  },
  USDCAD: {
    symbol: 'USDCAD',
    name: 'US Dollar vs Canadian Dollar',
    type: 'forex',
    category: 'major',
    description: 'The "Loonie" - oil-correlated currency pair',
    pipSize: 0.0001,
    minLotSize: 0.01,
    maxLotSize: 100,
    lotStep: 0.01,
  },
  NZDUSD: {
    symbol: 'NZDUSD',
    name: 'New Zealand Dollar vs US Dollar',
    type: 'forex',
    category: 'major',
    description: 'The "Kiwi" - agricultural commodity currency',
    pipSize: 0.0001,
    minLotSize: 0.01,
    maxLotSize: 100,
    lotStep: 0.01,
  },

  // Precious Metals (Commodities)
  XAUUSD: {
    symbol: 'XAUUSD',
    name: 'Gold vs US Dollar',
    type: 'commodity',
    category: 'precious-metals',
    description: 'Gold spot price in USD - safe haven asset',
    pipSize: 0.01,
    tickSize: 0.01,
    minLotSize: 0.01,
    maxLotSize: 100,
    lotStep: 0.01,
  },
  XAGUSD: {
    symbol: 'XAGUSD',
    name: 'Silver vs US Dollar',
    type: 'commodity',
    category: 'precious-metals',
    description: 'Silver spot price in USD',
    pipSize: 0.001,
    tickSize: 0.001,
    minLotSize: 0.01,
    maxLotSize: 100,
    lotStep: 0.01,
  },
  XPTUSD: {
    symbol: 'XPTUSD',
    name: 'Platinum vs US Dollar',
    type: 'commodity',
    category: 'precious-metals',
    description: 'Platinum spot price in USD',
    pipSize: 0.01,
    tickSize: 0.01,
    minLotSize: 0.01,
    maxLotSize: 50,
    lotStep: 0.01,
  },
  XPDUSD: {
    symbol: 'XPDUSD',
    name: 'Palladium vs US Dollar',
    type: 'commodity',
    category: 'precious-metals',
    description: 'Palladium spot price in USD',
    pipSize: 0.01,
    tickSize: 0.01,
    minLotSize: 0.01,
    maxLotSize: 50,
    lotStep: 0.01,
  },

  // Energy (Commodities)
  USOIL: {
    symbol: 'USOIL',
    name: 'US Crude Oil (WTI)',
    type: 'commodity',
    category: 'energy',
    description: 'West Texas Intermediate crude oil',
    pipSize: 0.01,
    tickSize: 0.01,
    minLotSize: 0.01,
    maxLotSize: 100,
    lotStep: 0.01,
  },
  UKOIL: {
    symbol: 'UKOIL',
    name: 'UK Brent Oil',
    type: 'commodity',
    category: 'energy',
    description: 'Brent crude oil benchmark',
    pipSize: 0.01,
    tickSize: 0.01,
    minLotSize: 0.01,
    maxLotSize: 100,
    lotStep: 0.01,
  },
  NGAS: {
    symbol: 'NGAS',
    name: 'Natural Gas',
    type: 'commodity',
    category: 'energy',
    description: 'Natural gas futures',
    pipSize: 0.001,
    tickSize: 0.001,
    minLotSize: 0.01,
    maxLotSize: 50,
    lotStep: 0.01,
  },

  // Base Metals (Commodities)
  COPPER: {
    symbol: 'COPPER',
    name: 'Copper',
    type: 'commodity',
    category: 'base-metals',
    description: 'Copper futures - industrial metal',
    pipSize: 0.0001,
    tickSize: 0.0001,
    minLotSize: 0.01,
    maxLotSize: 50,
    lotStep: 0.01,
  },

  // Agricultural (Commodities)
  WHEAT: {
    symbol: 'WHEAT',
    name: 'Wheat',
    type: 'commodity',
    category: 'agricultural',
    description: 'Wheat futures',
    pipSize: 0.01,
    tickSize: 0.01,
    minLotSize: 0.01,
    maxLotSize: 50,
    lotStep: 0.01,
  },
  CORN: {
    symbol: 'CORN',
    name: 'Corn',
    type: 'commodity',
    category: 'agricultural',
    description: 'Corn futures',
    pipSize: 0.01,
    tickSize: 0.01,
    minLotSize: 0.01,
    maxLotSize: 50,
    lotStep: 0.01,
  },
  SOYBEAN: {
    symbol: 'SOYBEAN',
    name: 'Soybean',
    type: 'commodity',
    category: 'agricultural',
    description: 'Soybean futures',
    pipSize: 0.01,
    tickSize: 0.01,
    minLotSize: 0.01,
    maxLotSize: 50,
    lotStep: 0.01,
  },
  COFFEE: {
    symbol: 'COFFEE',
    name: 'Coffee',
    type: 'commodity',
    category: 'agricultural',
    description: 'Coffee futures',
    pipSize: 0.01,
    tickSize: 0.01,
    minLotSize: 0.01,
    maxLotSize: 50,
    lotStep: 0.01,
  },
  SUGAR: {
    symbol: 'SUGAR',
    name: 'Sugar',
    type: 'commodity',
    category: 'agricultural',
    description: 'Sugar futures',
    pipSize: 0.01,
    tickSize: 0.01,
    minLotSize: 0.01,
    maxLotSize: 50,
    lotStep: 0.01,
  },
  COTTON: {
    symbol: 'COTTON',
    name: 'Cotton',
    type: 'commodity',
    category: 'agricultural',
    description: 'Cotton futures',
    pipSize: 0.01,
    tickSize: 0.01,
    minLotSize: 0.01,
    maxLotSize: 50,
    lotStep: 0.01,
  },
};

/**
 * Get all supported symbols from config
 */
export const getAllSymbols = (): string[] => {
  return TRADING_CONFIG.SUPPORTED_SYMBOLS;
};

/**
 * Get symbols by type
 */
export const getSymbolsByType = (type: 'forex' | 'commodity'): string[] => {
  return Object.values(SYMBOL_METADATA)
    .filter(meta => meta.type === type)
    .map(meta => meta.symbol);
};

/**
 * Get symbols by category
 */
export const getSymbolsByCategory = (category: SymbolMetadata['category']): string[] => {
  return Object.values(SYMBOL_METADATA)
    .filter(meta => meta.category === category)
    .map(meta => meta.symbol);
};

/**
 * Get symbol metadata
 */
export const getSymbolMetadata = (symbol: string): SymbolMetadata | undefined => {
  return SYMBOL_METADATA[symbol];
};

/**
 * Check if symbol is a commodity
 */
export const isCommodity = (symbol: string): boolean => {
  const metadata = SYMBOL_METADATA[symbol];
  return metadata?.type === 'commodity';
};

/**
 * Check if symbol is forex
 */
export const isForex = (symbol: string): boolean => {
  const metadata = SYMBOL_METADATA[symbol];
  return metadata?.type === 'forex';
};

/**
 * Get symbol display name
 */
export const getSymbolDisplayName = (symbol: string): string => {
  const metadata = SYMBOL_METADATA[symbol];
  return metadata?.name || symbol;
};

/**
 * Get categorized symbols for UI dropdowns
 */
export const getCategorizedSymbols = () => {
  return {
    forex: {
      major: getSymbolsByCategory('major'),
      minor: getSymbolsByCategory('minor'),
      exotic: getSymbolsByCategory('exotic'),
    },
    commodities: {
      preciousMetals: getSymbolsByCategory('precious-metals'),
      energy: getSymbolsByCategory('energy'),
      baseMetals: getSymbolsByCategory('base-metals'),
      agricultural: getSymbolsByCategory('agricultural'),
    },
  };
};

/**
 * Validate if symbol is supported
 */
export const isSymbolSupported = (symbol: string): boolean => {
  return TRADING_CONFIG.SUPPORTED_SYMBOLS.includes(symbol);
};
