/**
 * Comprehensive Position Sizing Calculator
 * 
 * This module provides advanced position sizing calculations with multiple methods
 * including fixed lot, percentage risk, ATR-based, volatility-based, Kelly criterion,
 * and account equity-based sizing.
 */

import {
  PositionSizingConfig,
  PositionSizingParams,
  PositionSizingResult,
  SizingMethod
} from '../../types';
import { logger } from '../monitoring/logger';

// Symbol information for calculations
interface SymbolInfo {
  symbol: string;
  point: number;
  contractSize: number;
  minLot: number;
  maxLot: number;
  lotStep: number;
  digits: number;
  spread: number;
}

/**
 * Position Sizing Calculator class
 */
export class PositionSizingCalculator {
  private symbolInfoCache: Map<string, SymbolInfo> = new Map();

  constructor() {
    logger.info('PositionSizingCalculator initialized');
  }

  /**
   * Calculate position size based on the configured method
   */
  async calculatePositionSize(params: PositionSizingParams): Promise<PositionSizingResult> {
    try {
      const { config, symbol, entryPrice, tradeType } = params;
      
      // Get symbol information
      const symbolInfo = this.getSymbolInfo(symbol);
      
      // Validate inputs
      this.validateInputs(params, symbolInfo);
      
      // Calculate based on method
      let result: PositionSizingResult;
      
      switch (config.method) {
        case 'fixed_lot':
          result = this.calculateFixedLot(params, symbolInfo);
          break;
        case 'percentage_risk':
          result = this.calculatePercentageRisk(params, symbolInfo);
          break;
        case 'atr_based':
          result = this.calculateATRBased(params, symbolInfo);
          break;
        case 'volatility_based':
          result = this.calculateVolatilityBased(params, symbolInfo);
          break;
        case 'kelly_criterion':
          result = this.calculateKellyCriterion(params, symbolInfo);
          break;
        case 'account_equity':
          result = this.calculateAccountEquity(params, symbolInfo);
          break;
        default:
          throw new Error(`Unsupported position sizing method: ${config.method}`);
      }
      
      // Apply common constraints and validations
      result = this.applyConstraints(result, config, symbolInfo);
      
      // Calculate risk metrics
      result = this.calculateRiskMetrics(result, params, symbolInfo);
      
      // Generate warnings and recommendations
      result.warnings = this.generateWarnings(result, params, config);
      
      // Calculate confidence score
      result.confidence = this.calculateConfidence(result, params, config);
      
      logger.debug(`Position size calculated`, {
        method: config.method,
        symbol,
        positionSize: result.positionSize,
        riskPercentage: result.riskPercentage,
        confidence: result.confidence
      });
      
      return result;
    } catch (error) {
      logger.error('Error calculating position size', error as Error, { params });
      throw error;
    }
  }

  /**
   * Fixed lot size calculation
   */
  private calculateFixedLot(params: PositionSizingParams, symbolInfo: SymbolInfo): PositionSizingResult {
    const { config, entryPrice, tradeType } = params;
    const lotSize = config.fixedLot?.lotSize || 0.01;
    
    // Calculate stop loss (default 2% risk)
    const stopLossPips = this.getDefaultStopLossPips(params);
    const stopLossPrice = this.calculateStopLossPrice(entryPrice, stopLossPips, tradeType, symbolInfo);
    
    return {
      positionSize: lotSize,
      riskAmount: this.calculateRiskAmount(lotSize, stopLossPips, symbolInfo),
      riskPercentage: (this.calculateRiskAmount(lotSize, stopLossPips, symbolInfo) / params.accountBalance) * 100,
      stopLossPips,
      stopLossPrice,
      riskRewardRatio: 0, // Will be calculated later
      confidence: 50,
      warnings: [],
      method: 'fixed_lot',
      metadata: {
        accountBalance: params.accountBalance,
        symbol: params.symbol,
        entryPrice,
        timestamp: new Date()
      }
    };
  }

  /**
   * Percentage risk calculation
   */
  private calculatePercentageRisk(params: PositionSizingParams, symbolInfo: SymbolInfo): PositionSizingResult {
    const { config, accountBalance, entryPrice, tradeType } = params;
    const riskPercent = config.percentageRisk?.riskPercentage || 1.0;
    const riskAmount = accountBalance * (riskPercent / 100);
    
    // Calculate stop loss distance
    const stopLossPips = this.getDefaultStopLossPips(params);
    const stopLossPrice = this.calculateStopLossPrice(entryPrice, stopLossPips, tradeType, symbolInfo);
    
    // Calculate position size based on risk amount
    const pipValue = symbolInfo.contractSize * symbolInfo.point;
    const positionSize = riskAmount / (stopLossPips * pipValue);
    
    return {
      positionSize,
      riskAmount,
      riskPercentage: riskPercent,
      stopLossPips,
      stopLossPrice,
      riskRewardRatio: 0,
      confidence: 75,
      warnings: [],
      method: 'percentage_risk',
      metadata: {
        accountBalance,
        symbol: params.symbol,
        entryPrice,
        timestamp: new Date()
      }
    };
  }

  /**
   * ATR-based position sizing calculation
   */
  private calculateATRBased(params: PositionSizingParams, symbolInfo: SymbolInfo): PositionSizingResult {
    const { config, accountBalance, currentATR, entryPrice, tradeType } = params;
    
    if (!currentATR) {
      throw new Error('ATR value is required for ATR-based position sizing');
    }
    
    const atrConfig = config.atrBased!;
    const atrMultiplier = atrConfig.atrMultiplier;
    const riskPercent = atrConfig.riskPercentage;
    
    // Calculate stop loss distance using ATR
    const stopLossDistance = currentATR * atrMultiplier;
    const stopLossPips = stopLossDistance / symbolInfo.point;
    const stopLossPrice = this.calculateStopLossPrice(entryPrice, stopLossPips, tradeType, symbolInfo);
    
    // Calculate risk amount
    const riskAmount = accountBalance * (riskPercent / 100);
    
    // Calculate position size
    const positionSize = riskAmount / (stopLossDistance * symbolInfo.contractSize);
    
    // Apply volatility adjustment if enabled
    let adjustedSize = positionSize;
    if (atrConfig.volatilityAdjustment) {
      if (currentATR > atrConfig.maxATR) {
        adjustedSize *= 0.75; // Reduce by 25% in high volatility
      } else if (currentATR < atrConfig.minATR) {
        adjustedSize *= 1.25; // Increase by 25% in low volatility
      }
    }
    
    return {
      positionSize: adjustedSize,
      riskAmount,
      riskPercentage: riskPercent,
      stopLossPips,
      stopLossPrice,
      riskRewardRatio: 0,
      confidence: 85,
      warnings: [],
      method: 'atr_based',
      metadata: {
        accountBalance,
        symbol: params.symbol,
        entryPrice,
        currentATR,
        timestamp: new Date()
      }
    };
  }

  /**
   * Volatility-based position sizing calculation
   */
  private calculateVolatilityBased(params: PositionSizingParams, symbolInfo: SymbolInfo): PositionSizingResult {
    const { config, accountBalance, volatility, entryPrice, tradeType } = params;
    
    if (!volatility) {
      throw new Error('Volatility value is required for volatility-based position sizing');
    }
    
    const volConfig = config.volatilityBased!;
    const riskPercent = volConfig.riskPercentage;
    const volatilityMultiplier = volConfig.volatilityMultiplier;
    
    // Calculate stop loss based on volatility
    const stopLossDistance = volatility * volatilityMultiplier;
    const stopLossPips = stopLossDistance / symbolInfo.point;
    const stopLossPrice = this.calculateStopLossPrice(entryPrice, stopLossPips, tradeType, symbolInfo);
    
    // Calculate risk amount
    const riskAmount = accountBalance * (riskPercent / 100);
    
    // Calculate position size
    const positionSize = riskAmount / (stopLossDistance * symbolInfo.contractSize);
    
    // Apply volatility threshold
    let adjustedSize = positionSize;
    if (volatility > volConfig.maxVolatilityThreshold) {
      adjustedSize *= 0.5; // Reduce by 50% in extreme volatility
    }
    
    return {
      positionSize: adjustedSize,
      riskAmount,
      riskPercentage: riskPercent,
      stopLossPips,
      stopLossPrice,
      riskRewardRatio: 0,
      confidence: 80,
      warnings: [],
      method: 'volatility_based',
      metadata: {
        accountBalance,
        symbol: params.symbol,
        entryPrice,
        volatility,
        timestamp: new Date()
      }
    };
  }

  /**
   * Kelly criterion position sizing calculation
   */
  private calculateKellyCriterion(params: PositionSizingParams, symbolInfo: SymbolInfo): PositionSizingResult {
    const { config, accountBalance, historicalData, entryPrice, tradeType } = params;
    
    if (!historicalData) {
      throw new Error('Historical data is required for Kelly criterion position sizing');
    }
    
    const kellyConfig = config.kellyCriterion!;
    const { winRate, avgWin, avgLoss } = historicalData;
    
    // Calculate Kelly percentage
    const winProbability = winRate;
    const avgReturn = avgWin / Math.abs(avgLoss); // Average return as ratio
    const kellyPercentage = winProbability - ((1 - winProbability) / avgReturn);
    
    // Apply Kelly fraction for safety
    const adjustedKellyPercentage = kellyPercentage * kellyConfig.kellyFraction;
    
    // Calculate position size
    const riskAmount = accountBalance * Math.max(0, adjustedKellyPercentage);
    const stopLossPips = this.getDefaultStopLossPips(params);
    const stopLossPrice = this.calculateStopLossPrice(entryPrice, stopLossPips, tradeType, symbolInfo);
    
    const pipValue = symbolInfo.contractSize * symbolInfo.point;
    const positionSize = riskAmount / (stopLossPips * pipValue);
    
    // Apply maximum position size limit
    const finalPositionSize = Math.min(positionSize, kellyConfig.maxPositionSize);
    
    return {
      positionSize: finalPositionSize,
      riskAmount,
      riskPercentage: Math.abs(adjustedKellyPercentage) * 100,
      stopLossPips,
      stopLossPrice,
      riskRewardRatio: avgReturn,
      confidence: 70,
      warnings: [],
      method: 'kelly_criterion',
      metadata: {
        accountBalance,
        symbol: params.symbol,
        entryPrice,
        timestamp: new Date()
      }
    };
  }

  /**
   * Account equity-based position sizing calculation
   */
  private calculateAccountEquity(params: PositionSizingParams, symbolInfo: SymbolInfo): PositionSizingResult {
    const { config, accountBalance, accountEquity, dailyPnL, entryPrice, tradeType } = params;
    const equityConfig = config.accountEquity!;
    
    // Use account equity if available, otherwise use balance
    const currentEquity = accountEquity || accountBalance;
    const equityPercent = equityConfig.equityPercentage;
    
    // Calculate base position size
    let riskPercent = equityPercent;
    
    // Apply drawdown adjustment if enabled
    if (equityConfig.drawdownAdjustment) {
      const drawdownPercent = ((accountBalance - currentEquity) / accountBalance) * 100;
      if (drawdownPercent > 0) {
        // Reduce position size based on drawdown
        const drawdownMultiplier = Math.max(0.25, 1 - (drawdownPercent / equityConfig.maxDrawdown));
        riskPercent *= drawdownMultiplier;
      }
    }
    
    // Apply daily performance adjustment if enabled
    if (equityConfig.equityCurveAdjustment && dailyPnL) {
      const dailyPercent = (dailyPnL / accountBalance) * 100;
      if (dailyPercent < -2) {
        riskPercent *= 0.5; // Reduce by 50% on bad days
      } else if (dailyPercent > 2) {
        riskPercent *= 1.2; // Increase by 20% on good days
      }
    }
    
    const riskAmount = currentEquity * (riskPercent / 100);
    const stopLossPips = this.getDefaultStopLossPips(params);
    const stopLossPrice = this.calculateStopLossPrice(entryPrice, stopLossPips, tradeType, symbolInfo);
    
    const pipValue = symbolInfo.contractSize * symbolInfo.point;
    const positionSize = riskAmount / (stopLossPips * pipValue);
    
    return {
      positionSize,
      riskAmount,
      riskPercentage: riskPercent,
      stopLossPips,
      stopLossPrice,
      riskRewardRatio: 0,
      confidence: 75,
      warnings: [],
      method: 'account_equity',
      metadata: {
        accountBalance,
        symbol: params.symbol,
        entryPrice,
        timestamp: new Date()
      }
    };
  }

  /**
   * Apply common constraints and validations
   */
  private applyConstraints(
    result: PositionSizingResult,
    config: PositionSizingConfig,
    symbolInfo: SymbolInfo
  ): PositionSizingResult {
    let adjustedSize = result.positionSize;
    
    // Apply min/max position size constraints
    adjustedSize = Math.max(config.minPositionSize, adjustedSize);
    adjustedSize = Math.min(config.maxPositionSize, adjustedSize);
    
    // Round to valid lot size step
    const lotStep = symbolInfo.lotStep;
    adjustedSize = Math.round(adjustedSize / lotStep) * lotStep;
    
    // Ensure within symbol limits
    adjustedSize = Math.max(symbolInfo.minLot, adjustedSize);
    adjustedSize = Math.min(symbolInfo.maxLot, adjustedSize);
    
    // Recalculate risk amount based on adjusted position size
    const adjustedRiskAmount = result.riskAmount * (adjustedSize / result.positionSize);
    const adjustedRiskPercentage = (adjustedRiskAmount / result.metadata.accountBalance) * 100;
    
    return {
      ...result,
      positionSize: adjustedSize,
      riskAmount: adjustedRiskAmount,
      riskPercentage: adjustedRiskPercentage
    };
  }

  /**
   * Calculate risk metrics
   */
  private calculateRiskMetrics(
    result: PositionSizingResult,
    params: PositionSizingParams,
    symbolInfo: SymbolInfo
  ): PositionSizingResult {
    // Calculate take profit price (default 2:1 risk-reward)
    const takeProfitPips = result.stopLossPips * 2;
    const takeProfitPrice = params.tradeType === 'BUY'
      ? params.entryPrice + (takeProfitPips * symbolInfo.point)
      : params.entryPrice - (takeProfitPips * symbolInfo.point);
    
    return {
      ...result,
      takeProfitPrice,
      riskRewardRatio: 2.0 // Default 2:1
    };
  }

  /**
   * Generate warnings and recommendations
   */
  private generateWarnings(
    result: PositionSizingResult,
    params: PositionSizingParams,
    config: PositionSizingConfig
  ): string[] {
    const warnings: string[] = [];
    
    // Risk percentage warnings
    if (result.riskPercentage > 3) {
      warnings.push('High risk percentage detected (>3%). Consider reducing position size.');
    } else if (result.riskPercentage < 0.5) {
      warnings.push('Very low risk percentage (<0.5%). Position may be too small to be meaningful.');
    }
    
    // Position size warnings
    if (result.positionSize > 1.0) {
      warnings.push('Large position size (>1 lot). Ensure this aligns with your risk tolerance.');
    }
    
    // Method-specific warnings
    switch (config.method) {
      case 'atr_based':
        if (!params.currentATR) {
          warnings.push('ATR value not available. Using default stop loss.');
        }
        break;
      case 'volatility_based':
        if (!params.volatility) {
          warnings.push('Volatility value not available. Using default stop loss.');
        }
        break;
      case 'kelly_criterion':
        if (!params.historicalData || params.historicalData.totalTrades < 50) {
          warnings.push('Insufficient historical data for Kelly criterion. Results may be unreliable.');
        }
        break;
    }
    
    // Account balance warnings
    if (params.accountBalance < 1000) {
      warnings.push('Low account balance. Consider higher risk percentage or micro lots.');
    }
    
    return warnings;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    result: PositionSizingResult,
    params: PositionSizingParams,
    config: PositionSizingConfig
  ): number {
    let confidence = 50; // Base confidence
    
    // Method confidence
    const methodConfidence: Record<SizingMethod, number> = {
      'fixed_lot': 40,
      'percentage_risk': 70,
      'atr_based': 85,
      'volatility_based': 80,
      'kelly_criterion': 60,
      'account_equity': 75
    };
    
    confidence += methodConfidence[config.method] || 50;
    
    // Data availability confidence
    if (config.method === 'atr_based' && params.currentATR) {
      confidence += 10;
    }
    if (config.method === 'volatility_based' && params.volatility) {
      confidence += 10;
    }
    if (config.method === 'kelly_criterion' && params.historicalData && params.historicalData.totalTrades > 100) {
      confidence += 15;
    }
    
    // Risk level confidence
    if (result.riskPercentage >= 1 && result.riskPercentage <= 2) {
      confidence += 10;
    } else if (result.riskPercentage > 3) {
      confidence -= 15;
    }
    
    return Math.min(100, Math.max(0, confidence));
  }

  /**
   * Validate input parameters
   */
  private validateInputs(params: PositionSizingParams, symbolInfo: SymbolInfo): void {
    if (params.accountBalance <= 0) {
      throw new Error('Account balance must be greater than 0');
    }
    
    if (params.entryPrice <= 0) {
      throw new Error('Entry price must be greater than 0');
    }
    
    if (!params.symbol) {
      throw new Error('Symbol is required');
    }
    
    if (!['BUY', 'SELL'].includes(params.tradeType)) {
      throw new Error('Trade type must be BUY or SELL');
    }
  }

  /**
   * Get symbol information
   */
  private getSymbolInfo(symbol: string): SymbolInfo {
    if (this.symbolInfoCache.has(symbol)) {
      return this.symbolInfoCache.get(symbol)!;
    }
    
    // Mock symbol info - in real implementation, this would come from broker
    const symbolInfo: SymbolInfo = {
      symbol,
      point: symbol.includes('JPY') ? 0.001 : 0.0001,
      contractSize: 100000,
      minLot: 0.01,
      maxLot: 100,
      lotStep: 0.01,
      digits: symbol.includes('JPY') ? 3 : 5,
      spread: 2
    };
    
    this.symbolInfoCache.set(symbol, symbolInfo);
    return symbolInfo;
  }

  /**
   * Get default stop loss in pips
   */
  private getDefaultStopLossPips(params: PositionSizingParams): number {
    // Default stop loss based on ATR if available, otherwise use symbol-specific defaults
    if (params.currentATR) {
      const symbolInfo = this.getSymbolInfo(params.symbol);
      return params.currentATR / symbolInfo.point;
    }
    
    // Symbol-specific default stop losses
    const defaults: Record<string, number> = {
      'EURUSD': 20,
      'GBPUSD': 25,
      'USDJPY': 20,
      'AUDUSD': 20,
      'USDCAD': 20,
      'NZDUSD': 20,
      'EURJPY': 25,
      'GBPJPY': 30,
      'EURGBP': 20,
      'XAUUSD': 200,
      'XAGUSD': 50
    };
    
    return defaults[params.symbol] || 20;
  }

  /**
   * Calculate stop loss price
   */
  private calculateStopLossPrice(
    entryPrice: number,
    stopLossPips: number,
    tradeType: 'BUY' | 'SELL',
    symbolInfo: SymbolInfo
  ): number {
    const stopLossDistance = stopLossPips * symbolInfo.point;
    
    if (tradeType === 'BUY') {
      return entryPrice - stopLossDistance;
    } else {
      return entryPrice + stopLossDistance;
    }
  }

  /**
   * Calculate risk amount
   */
  private calculateRiskAmount(lotSize: number, stopLossPips: number, symbolInfo: SymbolInfo): number {
    const pipValue = symbolInfo.contractSize * symbolInfo.point;
    return lotSize * stopLossPips * pipValue;
  }

  /**
   * Get default configuration for a method
   */
  static getDefaultConfig(method: SizingMethod): PositionSizingConfig {
    const baseConfig = {
      maxPositionSize: 10.0,
      minPositionSize: 0.01,
      positionSizeStep: 0.01,
      maxDailyLoss: 6.0,
      maxDrawdown: 20.0,
      maxTotalExposure: 50.0
    };

    switch (method) {
      case 'fixed_lot':
        return {
          method: 'fixed_lot',
          fixedLot: {
            lotSize: 0.1,
            maxPositions: 5
          },
          ...baseConfig
        };

      case 'percentage_risk':
        return {
          method: 'percentage_risk',
          percentageRisk: {
            riskPercentage: 1.5,
            maxRiskPerTrade: 2.0,
            maxDailyRisk: 6.0
          },
          ...baseConfig
        };

      case 'atr_based':
        return {
          method: 'atr_based',
          atrBased: {
            atrMultiplier: 2.0,
            riskPercentage: 1.5,
            volatilityAdjustment: true,
            minATR: 0.0005,
            maxATR: 0.005
          },
          ...baseConfig
        };

      case 'volatility_based':
        return {
          method: 'volatility_based',
          volatilityBased: {
            volatilityPeriod: 14,
            volatilityMultiplier: 2.0,
            riskPercentage: 1.5,
            maxVolatilityThreshold: 0.03
          },
          ...baseConfig
        };

      case 'kelly_criterion':
        return {
          method: 'kelly_criterion',
          kellyCriterion: {
            winRate: 0.55,
            avgWin: 100,
            avgLoss: 50,
            kellyFraction: 0.25,
            maxPositionSize: 2.0
          },
          ...baseConfig
        };

      case 'account_equity':
        return {
          method: 'account_equity',
          accountEquity: {
            equityPercentage: 1.5,
            drawdownAdjustment: true,
            maxDrawdown: 20.0,
            equityCurveAdjustment: true
          },
          ...baseConfig
        };

      default:
        throw new Error(`Unknown position sizing method: ${method}`);
    }
  }
}

// Export singleton instance
export const positionSizingCalculator = new PositionSizingCalculator();