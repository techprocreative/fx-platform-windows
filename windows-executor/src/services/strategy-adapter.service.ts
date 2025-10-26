/**
 * Strategy Adapter Service
 * Converts database strategy format to executor format
 * 
 * Database Format (from web platform):
 * - rules.entry.conditions[]
 * - rules.entry.logic
 * - rules.exit.stopLoss
 * - rules.exit.takeProfit
 * 
 * Executor Format (expected by condition-evaluator):
 * - entryConditions[]
 * - entryLogic
 * - stopLoss
 * - takeProfit
 */

import { Strategy } from '../types/strategy.types';
import { logger } from '../utils/logger';

export class StrategyAdapterService {
  
  /**
   * Convert database strategy format to executor format
   */
  static convertStrategy(dbStrategy: any): Strategy | null {
    try {
      logger.info(`[StrategyAdapter] Converting strategy: ${dbStrategy.name}`);
      
      // Extract rules
      const rules = dbStrategy.rules || {};
      const entry = rules.entry || {};
      const exit = rules.exit || {};
      const riskManagement = rules.riskManagement || {};
      
      // Convert entry conditions
      const entryConditions = this.convertConditions(entry.conditions || []);
      const entryLogic = (entry.logic || 'AND').toUpperCase() as 'AND' | 'OR';
      
      // Convert exit conditions (if any)
      const exitConditions = this.convertConditions(exit.conditions || []);
      const exitLogic = (exit.logic || 'OR').toUpperCase() as 'AND' | 'OR';
      
      // Build executor-compatible strategy
      const executorStrategy: Strategy = {
        id: dbStrategy.id,
        name: dbStrategy.name,
        description: dbStrategy.description || '',
        version: String(dbStrategy.version || '1'),
        status: dbStrategy.status === 'active' ? 'active' : 'paused',
        
        // Trading parameters
        symbols: [dbStrategy.symbol], // Database has single symbol
        timeframe: this.convertTimeframe(dbStrategy.timeframe),
        maxPositions: riskManagement.maxPositions || 1,
        positionSize: riskManagement.lotSize || 0.01,
        riskPercent: rules.dynamicRisk?.riskPercentage || 1.0,
        
        // Entry/Exit conditions
        entryConditions,
        entryLogic,
        exitConditions,
        exitLogic,
        
        // Stop loss & take profit
        stopLoss: this.convertStopLoss(exit.stopLoss),
        takeProfit: this.convertTakeProfit(exit.takeProfit),
        
        // Trailing stop
        trailingStop: exit.trailing?.enabled ? {
          enabled: true,
          distance: exit.trailing.distance || 30,
          step: exit.trailing.step || 10,
        } : undefined,
        
        // Filters
        filters: this.convertFilters(rules),
        
        // Advanced features (use dynamicRisk directly, simpler)
        positionSizing: undefined, // Simplified - use dynamicRisk instead
        
        dynamicRisk: rules.dynamicRisk,
        smartExit: rules.smartExit,
        correlationFilter: rules.correlationFilter,
        regimeDetection: rules.regimeDetection,
        mtfSettings: rules.mtfSettings,
        
        // Metadata
        createdAt: new Date(dbStrategy.createdAt),
        updatedAt: new Date(dbStrategy.updatedAt),
        createdBy: dbStrategy.userId || 'system',
      };
      
      logger.info(`[StrategyAdapter] ✅ Converted: ${executorStrategy.name}`);
      logger.debug(`[StrategyAdapter] Entry conditions: ${entryConditions.length}, Logic: ${entryLogic}`);
      
      return executorStrategy;
      
    } catch (error) {
      logger.error(`[StrategyAdapter] ❌ Failed to convert strategy:`, error);
      logger.error(`[StrategyAdapter] Strategy data:`, JSON.stringify(dbStrategy, null, 2));
      return null;
    }
  }
  
  /**
   * Convert database conditions to executor format
   */
  private static convertConditions(dbConditions: any[]): any[] {
    return dbConditions.map((cond, index) => {
      // Database format: { indicator: 'rsi', condition: 'greater_than', value: 70 }
      // Executor format: { id, type, indicator, params, comparison, value, enabled }
      
      return {
        id: `cond_${index}`,
        type: 'indicator' as const,
        indicator: this.convertIndicatorName(cond.indicator),
        params: this.extractIndicatorParams(cond),
        comparison: this.convertComparison(cond.condition),
        value: this.convertValue(cond.value),
        enabled: cond.enabled !== false,
      };
    });
  }
  
  /**
   * Convert indicator names from database to executor format
   */
  private static convertIndicatorName(dbIndicator: string): string {
    const mapping: Record<string, string> = {
      'rsi': 'RSI',
      'macd': 'MACD',
      'macd_signal': 'MACD_SIGNAL',
      'ema_9': 'EMA',
      'ema_21': 'EMA',
      'ema_50': 'EMA',
      'ema_200': 'EMA',
      'sma_20': 'SMA',
      'sma_50': 'SMA',
      'sma_200': 'SMA',
      'bb_upper': 'BB_UPPER',
      'bb_lower': 'BB_LOWER',
      'bb_middle': 'BB_MIDDLE',
      'atr': 'ATR',
      'stochastic_k': 'STOCHASTIC_K',
      'stochastic_d': 'STOCHASTIC_D',
      'adx': 'ADX',
      'price': 'PRICE',
      'volume': 'VOLUME',
    };
    
    // Extract base indicator (e.g., 'ema' from 'ema_9')
    const base = dbIndicator.split('_')[0];
    return mapping[dbIndicator] || mapping[base] || dbIndicator.toUpperCase();
  }
  
  /**
   * Extract indicator parameters from condition
   */
  private static extractIndicatorParams(cond: any): any {
    const params: any = {};
    
    // Extract period from indicator name (e.g., 'ema_9' -> period: 9)
    const match = cond.indicator.match(/_(\d+)$/);
    if (match) {
      params.period = parseInt(match[1]);
    }
    
    // Add explicit period if provided
    if (cond.period) {
      params.period = cond.period;
    }
    
    // MACD parameters
    if (cond.indicator.startsWith('macd')) {
      params.fastPeriod = cond.fastPeriod || 12;
      params.slowPeriod = cond.slowPeriod || 26;
      params.signalPeriod = cond.signalPeriod || 9;
    }
    
    // Bollinger Bands
    if (cond.indicator.startsWith('bb_')) {
      params.period = cond.period || 20;
      params.stdDev = cond.stdDev || 2;
    }
    
    // Stochastic
    if (cond.indicator.startsWith('stochastic')) {
      params.kPeriod = cond.kPeriod || 14;
      params.dPeriod = cond.dPeriod || 3;
      params.slowing = cond.slowing || 3;
    }
    
    return params;
  }
  
  /**
   * Convert comparison operators
   */
  private static convertComparison(dbComparison: string): string {
    const mapping: Record<string, string> = {
      'greater_than': 'GREATER_THAN',
      'less_than': 'LESS_THAN',
      'greater_than_or_equal': 'GREATER_THAN_OR_EQUAL',
      'less_than_or_equal': 'LESS_THAN_OR_EQUAL',
      'equal': 'EQUAL',
      'crosses_above': 'CROSSES_ABOVE',
      'crosses_below': 'CROSSES_BELOW',
      'breaks_above': 'BREAKS_ABOVE',
      'breaks_below': 'BREAKS_BELOW',
      'gt': 'GREATER_THAN',
      'lt': 'LESS_THAN',
      'gte': 'GREATER_THAN_OR_EQUAL',
      'lte': 'LESS_THAN_OR_EQUAL',
      'eq': 'EQUAL',
    };
    
    return mapping[dbComparison] || dbComparison.toUpperCase();
  }
  
  /**
   * Convert value (could be number, string like 'price', or indicator reference)
   */
  private static convertValue(dbValue: any): any {
    if (typeof dbValue === 'number') {
      return dbValue;
    }
    
    if (typeof dbValue === 'string') {
      // Check if it's an indicator reference
      if (dbValue.includes('ema_') || dbValue.includes('sma_') || 
          dbValue === 'price' || dbValue === 'support' || dbValue === 'resistance') {
        return dbValue;
      }
      
      // Try to parse as number
      const num = parseFloat(dbValue);
      if (!isNaN(num)) {
        return num;
      }
    }
    
    return dbValue;
  }
  
  /**
   * Convert timeframe format
   */
  private static convertTimeframe(dbTimeframe: string): any {
    // Database: 'M15', 'H1', 'H4', 'D1'
    // Executor expects same format, so just validate
    const valid = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'];
    
    if (valid.includes(dbTimeframe)) {
      return dbTimeframe;
    }
    
    logger.warn(`[StrategyAdapter] Invalid timeframe: ${dbTimeframe}, defaulting to M15`);
    return 'M15';
  }
  
  /**
   * Convert stop loss configuration
   */
  private static convertStopLoss(dbStopLoss: any): any {
    if (!dbStopLoss) return undefined;
    
    return {
      type: dbStopLoss.type || 'pips',
      value: dbStopLoss.value || 50,
      atrMultiplier: dbStopLoss.atrMultiplier,
    };
  }
  
  /**
   * Convert take profit configuration
   */
  private static convertTakeProfit(dbTakeProfit: any): any {
    if (!dbTakeProfit) return undefined;
    
    return {
      type: dbTakeProfit.type || 'pips',
      value: dbTakeProfit.value || 100,
      rrRatio: dbTakeProfit.rrRatio,
    };
  }
  
  /**
   * Convert filters from rules to executor format
   */
  private static convertFilters(rules: any): any[] {
    const filters: any[] = [];
    
    // Session filter
    if (rules.sessionFilter?.enabled) {
      filters.push({
        type: 'SESSION',
        enabled: true,
        params: {
          allowedSessions: rules.sessionFilter.allowedSessions || ['London', 'NewYork'],
        },
      });
    }
    
    // Spread filter
    if (rules.spreadFilter?.enabled) {
      filters.push({
        type: 'SPREAD',
        enabled: true,
        params: {
          maxSpread: rules.spreadFilter.maxSpread || 2.0,
          action: rules.spreadFilter.action || 'SKIP',
        },
      });
    }
    
    // Volatility filter
    if (rules.volatilityFilter?.enabled) {
      filters.push({
        type: 'VOLATILITY',
        enabled: true,
        params: {
          minATR: rules.volatilityFilter.minATR,
          maxATR: rules.volatilityFilter.maxATR,
        },
      });
    }
    
    // News filter
    if (rules.newsFilter?.enabled) {
      filters.push({
        type: 'NEWS',
        enabled: true,
        params: {
          pauseBeforeMinutes: rules.newsFilter.pauseBeforeMinutes || 30,
          pauseAfterMinutes: rules.newsFilter.pauseAfterMinutes || 30,
          highImpactOnly: rules.newsFilter.highImpactOnly !== false,
        },
      });
    }
    
    return filters;
  }
  
  /**
   * Validate converted strategy
   */
  static validateStrategy(strategy: Strategy): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check required fields
    if (!strategy.id) errors.push('Missing strategy ID');
    if (!strategy.name) errors.push('Missing strategy name');
    if (!strategy.symbols || strategy.symbols.length === 0) errors.push('Missing symbols');
    if (!strategy.timeframe) errors.push('Missing timeframe');
    if (!strategy.entryConditions || strategy.entryConditions.length === 0) {
      errors.push('Missing entry conditions');
    }
    
    // Check conditions format
    for (const cond of strategy.entryConditions || []) {
      if (!cond.indicator) errors.push(`Condition missing indicator`);
      if (!cond.comparison) errors.push(`Condition missing comparison`);
      if (cond.value === undefined) errors.push(`Condition missing value`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
