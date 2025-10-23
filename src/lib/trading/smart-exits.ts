import {
  SmartExitRules,
  ExitCalculationParams,
  ExitCalculationResult,
  SwingPoint,
  SwingPointAnalysis,
  ExitExecution
} from '@/types';

/**
 * Smart Exit Calculator - Implements intelligent stop loss and take profit calculations
 * Based on ATR, swing points, support/resistance levels, and risk-reward ratios
 */

export class SmartExitCalculator {
  /**
   * Calculate optimal stop loss and take profit levels based on smart exit rules
   */
  static calculateExits(
    params: ExitCalculationParams,
    rules: SmartExitRules
  ): ExitCalculationResult {
    const stopLoss = this.calculateStopLoss(params, rules.stopLoss);
    const takeProfit = this.calculateTakeProfit(params, rules.takeProfit, stopLoss.price);
    const partialExits = this.calculatePartialExits(params, rules.takeProfit, stopLoss.price, takeProfit.price);
    
    const riskRewardRatio = Math.abs(takeProfit.distance / stopLoss.distance);
    const confidence = this.calculateConfidence(params, rules, riskRewardRatio);

    return {
      stopLoss,
      takeProfit,
      partialExits,
      riskRewardRatio,
      confidence
    };
  }

  /**
   * Calculate stop loss based on different methods
   */
  private static calculateStopLoss(
    params: ExitCalculationParams,
    stopLossRules: SmartExitRules['stopLoss']
  ) {
    const { entryPrice, tradeType, atr } = params;
    
    switch (stopLossRules.type) {
      case 'fixed':
        return this.calculateFixedStopLoss(params, stopLossRules);
      
      case 'atr':
        return this.calculateATRStopLoss(params, stopLossRules);
      
      case 'support':
        return this.calculateSupportStopLoss(params, stopLossRules);
      
      case 'trailing':
        return this.calculateTrailingStopLoss(params, stopLossRules);
      
      default:
        throw new Error(`Unknown stop loss type: ${stopLossRules.type}`);
    }
  }

  /**
   * Calculate take profit based on different methods
   */
  private static calculateTakeProfit(
    params: ExitCalculationParams,
    takeProfitRules: SmartExitRules['takeProfit'],
    stopLossPrice: number
  ) {
    switch (takeProfitRules.type) {
      case 'fixed':
        return this.calculateFixedTakeProfit(params, takeProfitRules);
      
      case 'rr_ratio':
        return this.calculateRRRatioTakeProfit(params, takeProfitRules, stopLossPrice);
      
      case 'resistance':
        return this.calculateResistanceTakeProfit(params, takeProfitRules);
      
      case 'partial':
        return this.calculatePartialTakeProfit(params, takeProfitRules, stopLossPrice);
      
      default:
        throw new Error(`Unknown take profit type: ${takeProfitRules.type}`);
    }
  }

  /**
   * Fixed stop loss calculation
   */
  private static calculateFixedStopLoss(
    params: ExitCalculationParams,
    rules: SmartExitRules['stopLoss']
  ) {
    const { entryPrice, tradeType } = params;
    const distance = rules.atrMultiplier || 20; // Default 20 pips
    
    const price = tradeType === 'BUY' 
      ? entryPrice - distance
      : entryPrice + distance;

    return {
      price,
      type: 'fixed',
      distance,
      reason: 'Fixed distance from entry'
    };
  }

  /**
   * ATR-based stop loss calculation
   */
  private static calculateATRStopLoss(
    params: ExitCalculationParams,
    rules: SmartExitRules['stopLoss']
  ) {
    const { entryPrice, tradeType, atr } = params;
    
    if (!atr) {
      throw new Error('ATR value required for ATR-based stop loss');
    }

    const multiplier = rules.atrMultiplier || 2.0;
    const distance = atr * multiplier;
    
    const price = tradeType === 'BUY' 
      ? entryPrice - distance
      : entryPrice + distance;

    return {
      price,
      type: 'atr',
      distance,
      reason: `${multiplier}x ATR from entry`
    };
  }

  /**
   * Support/Resistance-based stop loss calculation
   */
  private static calculateSupportStopLoss(
    params: ExitCalculationParams,
    rules: SmartExitRules['stopLoss']
  ) {
    const { entryPrice, tradeType, swingPoints } = params;
    
    if (!swingPoints || swingPoints.length === 0) {
      throw new Error('Swing points required for support-based stop loss');
    }

    const lookback = rules.swingLookback || 10;
    const relevantSwings = swingPoints
      .filter(sp => sp.type === (tradeType === 'BUY' ? 'low' : 'high'))
      .slice(-lookback);

    if (relevantSwings.length === 0) {
      throw new Error('No relevant swing points found');
    }

    const supportLevel = tradeType === 'BUY' 
      ? Math.max(...relevantSwings.map(sp => sp.price))
      : Math.min(...relevantSwings.map(sp => sp.price));

    const distance = Math.abs(entryPrice - supportLevel);
    const price = supportLevel;

    return {
      price,
      type: 'support',
      distance,
      reason: `Based on nearest ${tradeType === 'BUY' ? 'support' : 'resistance'} level`
    };
  }

  /**
   * Trailing stop loss calculation
   */
  private static calculateTrailingStopLoss(
    params: ExitCalculationParams,
    rules: SmartExitRules['stopLoss']
  ) {
    const { entryPrice, tradeType, currentPrice, atr } = params;
    
    if (!currentPrice) {
      throw new Error('Current price required for trailing stop loss');
    }

    const distance = rules.atrMultiplier 
      ? (atr || 20) * rules.atrMultiplier
      : 20;

    let price: number;
    if (tradeType === 'BUY') {
      price = Math.max(entryPrice - distance, currentPrice - distance);
    } else {
      price = Math.min(entryPrice + distance, currentPrice + distance);
    }

    return {
      price,
      type: 'trailing',
      distance,
      reason: `Trailing stop with ${distance} pip distance`
    };
  }

  /**
   * Fixed take profit calculation
   */
  private static calculateFixedTakeProfit(
    params: ExitCalculationParams,
    rules: SmartExitRules['takeProfit']
  ) {
    const { entryPrice, tradeType } = params;
    const distance = rules.rrRatio || 40; // Default 40 pips
    
    const price = tradeType === 'BUY' 
      ? entryPrice + distance
      : entryPrice - distance;

    return {
      price,
      type: 'fixed',
      distance,
      reason: 'Fixed distance from entry'
    };
  }

  /**
   * Risk-Reward ratio take profit calculation
   */
  private static calculateRRRatioTakeProfit(
    params: ExitCalculationParams,
    rules: SmartExitRules['takeProfit'],
    stopLossPrice: number
  ) {
    const { entryPrice, tradeType } = params;
    const rrRatio = rules.rrRatio || 2.0;
    
    const stopLossDistance = Math.abs(entryPrice - stopLossPrice);
    const takeProfitDistance = stopLossDistance * rrRatio;
    
    const price = tradeType === 'BUY' 
      ? entryPrice + takeProfitDistance
      : entryPrice - takeProfitDistance;

    return {
      price,
      type: 'rr_ratio',
      distance: takeProfitDistance,
      reason: `${rrRatio}:1 risk-reward ratio`
    };
  }

  /**
   * Resistance-based take profit calculation
   */
  private static calculateResistanceTakeProfit(
    params: ExitCalculationParams,
    rules: SmartExitRules['takeProfit']
  ) {
    const { entryPrice, tradeType, swingPoints } = params;
    
    if (!swingPoints || swingPoints.length === 0) {
      throw new Error('Swing points required for resistance-based take profit');
    }

    const relevantSwings = swingPoints
      .filter(sp => sp.type === (tradeType === 'BUY' ? 'high' : 'low'))
      .slice(-10);

    if (relevantSwings.length === 0) {
      throw new Error('No relevant swing points found');
    }

    const resistanceLevel = tradeType === 'BUY' 
      ? Math.min(...relevantSwings.map(sp => sp.price))
      : Math.max(...relevantSwings.map(sp => sp.price));

    const distance = Math.abs(entryPrice - resistanceLevel);
    const price = resistanceLevel;

    return {
      price,
      type: 'resistance',
      distance,
      reason: `Based on nearest ${tradeType === 'BUY' ? 'resistance' : 'support'} level`
    };
  }

  /**
   * Partial take profit calculation
   */
  private static calculatePartialTakeProfit(
    params: ExitCalculationParams,
    rules: SmartExitRules['takeProfit'],
    stopLossPrice: number
  ) {
    const { entryPrice, tradeType } = params;
    const stopLossDistance = Math.abs(entryPrice - stopLossPrice);
    
    // Use first partial exit level as main take profit
    const firstPartial = rules.partialExits?.[0];
    if (!firstPartial) {
      throw new Error('Partial exits configuration required');
    }

    const takeProfitDistance = stopLossDistance * firstPartial.atRR;
    const price = tradeType === 'BUY' 
      ? entryPrice + takeProfitDistance
      : entryPrice - takeProfitDistance;

    return {
      price,
      type: 'partial',
      distance: takeProfitDistance,
      reason: `First partial exit at ${firstPartial.atRR}:1 RR`
    };
  }

  /**
   * Calculate partial exit levels
   */
  private static calculatePartialExits(
    params: ExitCalculationParams,
    takeProfitRules: SmartExitRules['takeProfit'],
    stopLossPrice: number,
    takeProfitPrice: number
  ) {
    if (takeProfitRules.type !== 'partial' || !takeProfitRules.partialExits) {
      return undefined;
    }

    const { entryPrice, tradeType } = params;
    const stopLossDistance = Math.abs(entryPrice - stopLossPrice);

    return takeProfitRules.partialExits.map(partial => {
      const distance = stopLossDistance * partial.atRR;
      const price = tradeType === 'BUY' 
        ? entryPrice + distance
        : entryPrice - distance;

      return {
        price,
        percentage: partial.percentage,
        atRR: partial.atRR
      };
    });
  }

  /**
   * Calculate confidence score for the exit levels
   */
  private static calculateConfidence(
    params: ExitCalculationParams,
    rules: SmartExitRules,
    riskRewardRatio: number
  ): number {
    let confidence = 50; // Base confidence

    // ATR-based stops get higher confidence
    if (rules.stopLoss.type === 'atr' && params.atr) {
      confidence += 15;
    }

    // Support/resistance-based exits get higher confidence
    if (rules.stopLoss.type === 'support' && params.swingPoints) {
      confidence += 20;
    }

    if (rules.takeProfit.type === 'resistance' && params.swingPoints) {
      confidence += 20;
    }

    // Good risk-reward ratios get higher confidence
    if (riskRewardRatio >= 2.0) {
      confidence += 15;
    } else if (riskRewardRatio >= 1.5) {
      confidence += 10;
    }

    // Multiple exit strategies increase confidence
    if (rules.takeProfit.type === 'partial' && rules.takeProfit.partialExits) {
      confidence += 10;
    }

    return Math.min(confidence, 100);
  }

  /**
   * Detect swing points from price data
   */
  static detectSwingPoints(
    prices: Array<{ high: number; low: number; timestamp: Date }>,
    lookback: number = 5,
    strength: number = 2
  ): SwingPoint[] {
    const swingPoints: SwingPoint[] = [];

    for (let i = lookback; i < prices.length - lookback; i++) {
      const current = prices[i];
      const leftHighs = prices.slice(i - lookback, i).map(p => p.high);
      const rightHighs = prices.slice(i + 1, i + lookback + 1).map(p => p.high);
      const leftLows = prices.slice(i - lookback, i).map(p => p.low);
      const rightLows = prices.slice(i + 1, i + lookback + 1).map(p => p.low);

      // Check for swing high
      if (current.high > Math.max(...leftHighs) && 
          current.high > Math.max(...rightHighs)) {
        swingPoints.push({
          timestamp: current.timestamp,
          price: current.high,
          type: 'high',
          strength
        });
      }

      // Check for swing low
      if (current.low < Math.min(...leftLows) && 
          current.low < Math.min(...rightLows)) {
        swingPoints.push({
          timestamp: current.timestamp,
          price: current.low,
          type: 'low',
          strength
        });
      }
    }

    return swingPoints;
  }

  /**
   * Analyze swing points to find support and resistance levels
   */
  static analyzeSwingPoints(swingPoints: SwingPoint[]): SwingPointAnalysis {
    const highs = swingPoints.filter(sp => sp.type === 'high');
    const lows = swingPoints.filter(sp => sp.type === 'low');

    // Find current support levels (recent swing lows)
    const currentSupport = [...new Set(lows
      .slice(-10)
      .map(sp => Math.round(sp.price * 100) / 100))]
      .sort((a, b) => b - a)
      .slice(0, 3);

    // Find current resistance levels (recent swing highs)
    const currentResistance = [...new Set(highs
      .slice(-10)
      .map(sp => Math.round(sp.price * 100) / 100))]
      .sort((a, b) => a - b)
      .slice(0, 3);

    const nearestSupport = currentSupport[0] || 0;
    const nearestResistance = currentResistance[0] || 0;

    return {
      swingPoints,
      currentSupport,
      currentResistance,
      nearestSupport,
      nearestResistance
    };
  }

  /**
   * Check if exit should be triggered
   */
  static shouldTriggerExit(
    currentPrice: number,
    exitExecution: ExitExecution,
    tradeType: 'BUY' | 'SELL'
  ): boolean {
    const { price, type } = exitExecution;

    switch (type) {
      case 'STOP_LOSS':
        return tradeType === 'BUY' ? currentPrice <= price : currentPrice >= price;
      
      case 'TAKE_PROFIT':
        return tradeType === 'BUY' ? currentPrice >= price : currentPrice <= price;
      
      case 'PARTIAL':
        return tradeType === 'BUY' ? currentPrice >= price : currentPrice <= price;
      
      default:
        return false;
    }
  }

  /**
   * Update trailing stop loss
   */
  static updateTrailingStop(
    currentPrice: number,
    trailingStop: ExitExecution,
    tradeType: 'BUY' | 'SELL',
    distance: number
  ): ExitExecution | null {
    let newStopPrice: number;

    if (tradeType === 'BUY') {
      newStopPrice = currentPrice - distance;
      if (newStopPrice <= trailingStop.price) {
        return null; // Don't move stop loss down
      }
    } else {
      newStopPrice = currentPrice + distance;
      if (newStopPrice >= trailingStop.price) {
        return null; // Don't move stop loss up
      }
    }

    return {
      ...trailingStop,
      price: newStopPrice
    };
  }
}