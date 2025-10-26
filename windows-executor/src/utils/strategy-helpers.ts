/**
 * Strategy Helper Functions
 * Utilities to work with Strategy interface consistently
 */

import { Strategy } from '../types/strategy.types';

/**
 * Get primary symbol from strategy
 * Strategy has symbols array, this gets the first one
 * Also handles when strategy comes with single 'symbol' property from web platform
 */
export function getPrimarySymbol(strategy: Strategy | any): string {
  // Handle single symbol property from web platform
  if ((strategy as any).symbol && typeof (strategy as any).symbol === 'string') {
    return (strategy as any).symbol;
  }
  
  // Handle symbols array
  if (!strategy.symbols || strategy.symbols.length === 0) {
    return 'EURUSD'; // Default fallback
  }
  return strategy.symbols[0];
}

/**
 * Get all symbols from strategy
 */
export function getAllSymbols(strategy: Strategy | any): string[] {
  // Handle single symbol property from web platform
  if ((strategy as any).symbol && typeof (strategy as any).symbol === 'string') {
    return [(strategy as any).symbol];
  }
  
  return strategy.symbols || ['EURUSD'];
}

/**
 * Check if strategy has specific symbol
 */
export function hasSymbol(strategy: Strategy | any, symbol: string): boolean {
  // Handle single symbol property from web platform
  if ((strategy as any).symbol && typeof (strategy as any).symbol === 'string') {
    return (strategy as any).symbol === symbol;
  }
  
  return strategy.symbols?.includes(symbol) || false;
}

/**
 * Get risk management config
 * Strategy has positionSizing and dynamicRisk, this combines them
 */
export function getRiskConfig(strategy: Strategy): {
  riskPercentage: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  positionSizingMethod: string;
} {
  return {
    riskPercentage: strategy.riskPercent || strategy.positionSizing?.riskPercentage || 2,
    maxDailyLoss: strategy.dynamicRisk?.maxDailyLoss || 500,
    maxDrawdown: strategy.dynamicRisk?.maxDrawdown || 1000,
    positionSizingMethod: strategy.positionSizing?.method || 'percentage_risk',
  };
}

/**
 * Get position size config safely
 */
export function getPositionSizeConfig(strategy: Strategy) {
  return strategy.positionSizing || {
    method: 'percentage_risk',
    riskPercentage: 2,
    maxPositionSize: 1.0,
    minPositionSize: 0.01,
  };
}
