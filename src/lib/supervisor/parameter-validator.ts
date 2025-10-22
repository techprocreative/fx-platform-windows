// Parameter Validator with Safety Limits
// Ensures all parameter changes stay within safe boundaries

export interface ParameterLimits {
  min: number;
  max: number;
  default: number;
  step?: number;
  criticalThreshold?: number;  // Warn if change exceeds this %
}

// Comprehensive parameter limits for trading strategies
export const PARAMETER_LIMITS: Record<string, ParameterLimits> = {
  // Stop Loss & Take Profit
  stopLossPips: { 
    min: 10, 
    max: 200, 
    default: 50,
    step: 5,
    criticalThreshold: 50  // Warn if change >50%
  },
  takeProfitPips: { 
    min: 10, 
    max: 500, 
    default: 100,
    step: 10,
    criticalThreshold: 50
  },
  trailingStopDistance: {
    min: 5,
    max: 100,
    default: 20,
    step: 5,
    criticalThreshold: 50
  },
  breakevenPips: {
    min: 5,
    max: 100,
    default: 20,
    step: 5,
    criticalThreshold: 50
  },
  
  // Position Sizing
  lotSize: { 
    min: 0.01, 
    max: 10.0, 
    default: 0.01,
    step: 0.01,
    criticalThreshold: 100  // Warn if doubling
  },
  riskPerTrade: { 
    min: 0.5, 
    max: 5.0, 
    default: 2.0,
    step: 0.5,
    criticalThreshold: 50
  },
  maxPositionSize: {
    min: 0.01,
    max: 20.0,
    default: 1.0,
    step: 0.1,
    criticalThreshold: 100
  },
  
  // Trade Management
  maxConcurrentTrades: { 
    min: 1, 
    max: 10, 
    default: 3,
    step: 1,
    criticalThreshold: 100
  },
  maxDailyTrades: { 
    min: 1, 
    max: 100, 
    default: 20,
    step: 5,
    criticalThreshold: 50
  },
  maxDailyLoss: { 
    min: 10, 
    max: 10000, 
    default: 500,
    step: 50,
    criticalThreshold: 50
  },
  
  // Entry Confidence & Filters
  entryConfidence: {
    min: 0.0,
    max: 1.0,
    default: 0.7,
    step: 0.1,
    criticalThreshold: 30
  },
  minVolume: {
    min: 0,
    max: 1000000,
    default: 100,
    step: 100,
    criticalThreshold: 100
  },
  maxSpread: {
    min: 1,
    max: 10,
    default: 3,
    step: 0.5,
    criticalThreshold: 50
  },
};

export class ParameterValidator {
  /**
   * Validate a single parameter value
   */
  static validateParameter(
    name: string, 
    value: number
  ): { valid: boolean; error?: string } {
    const limits = PARAMETER_LIMITS[name];
    
    if (!limits) {
      return { valid: false, error: `Unknown parameter: ${name}` };
    }
    
    if (value < limits.min) {
      return { 
        valid: false, 
        error: `${name} must be ≥ ${limits.min}` 
      };
    }
    
    if (value > limits.max) {
      return { 
        valid: false, 
        error: `${name} must be ≤ ${limits.max}` 
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Validate parameter change magnitude
   */
  static validateChange(
    name: string,
    oldValue: number,
    newValue: number
  ): { safe: boolean; warning?: string } {
    const limits = PARAMETER_LIMITS[name];
    
    if (!limits || !limits.criticalThreshold) {
      return { safe: true };
    }
    
    const changePercent = Math.abs((newValue - oldValue) / oldValue * 100);
    
    if (changePercent > limits.criticalThreshold) {
      return {
        safe: false,
        warning: `${name} change of ${changePercent.toFixed(1)}% exceeds ` +
                 `safe threshold of ${limits.criticalThreshold}%`
      };
    }
    
    return { safe: true };
  }
  
  /**
   * Validate entire parameter set
   */
  static validateParameterSet(
    oldParams: Record<string, any>,
    newParams: Record<string, any>
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate each parameter value
    for (const [name, value] of Object.entries(newParams)) {
      if (typeof value === 'number') {
        const validation = this.validateParameter(name, value);
        if (!validation.valid) {
          errors.push(validation.error!);
        }
      }
    }
    
    // Validate change magnitudes
    for (const [name, newValue] of Object.entries(newParams)) {
      if (typeof newValue === 'number') {
        const oldValue = oldParams[name];
        if (typeof oldValue === 'number' && oldValue !== newValue) {
          const changeValidation = this.validateChange(name, oldValue, newValue);
          if (!changeValidation.safe) {
            warnings.push(changeValidation.warning!);
          }
        }
      }
    }
    
    // Check total number of changes
    const changedParams = Object.keys(newParams).filter(
      name => oldParams[name] !== newParams[name]
    );
    
    if (changedParams.length > 3) {
      warnings.push(
        `Changing ${changedParams.length} parameters at once increases risk. ` +
        `Consider splitting into multiple optimizations.`
      );
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Simulate risk impact of new parameters on historical trades
   */
  static async simulateRiskImpact(
    strategyId: string,
    oldParams: Record<string, any>,
    newParams: Record<string, any>,
    recentTrades: any[]
  ): Promise<{
    acceptable: boolean;
    oldDrawdown: number;
    newDrawdown: number;
    drawdownIncrease: number;
    oldProfitFactor: number;
    newProfitFactor: number;
    details: string;
  }> {
    // Simulate trades with new parameters
    let oldDrawdown = 0;
    let newDrawdown = 0;
    let oldBalance = 10000;
    let newBalance = 10000;
    let oldPeak = 10000;
    let newPeak = 10000;
    
    let oldWins = 0;
    let oldLosses = 0;
    let oldTotalProfit = 0;
    let oldTotalLoss = 0;
    
    let newWins = 0;
    let newLosses = 0;
    let newTotalProfit = 0;
    let newTotalLoss = 0;
    
    for (const trade of recentTrades) {
      const oldProfit = trade.profit || 0;
      
      // Old params
      oldBalance += oldProfit;
      if (oldBalance > oldPeak) oldPeak = oldBalance;
      const oldDD = (oldPeak - oldBalance) / oldPeak * 100;
      if (oldDD > oldDrawdown) oldDrawdown = oldDD;
      
      if (oldProfit > 0) {
        oldWins++;
        oldTotalProfit += oldProfit;
      } else if (oldProfit < 0) {
        oldLosses++;
        oldTotalLoss += Math.abs(oldProfit);
      }
      
      // Simulate with new params
      let newProfit = oldProfit;
      
      // Adjust profit based on SL change
      if (newParams.stopLossPips && oldParams.stopLossPips) {
        const slRatio = newParams.stopLossPips / oldParams.stopLossPips;
        if (trade.profit < 0) {
          // Losses are affected by SL changes
          newProfit = trade.profit * slRatio;
        }
      }
      
      // Adjust profit based on TP change
      if (newParams.takeProfitPips && oldParams.takeProfitPips) {
        const tpRatio = newParams.takeProfitPips / oldParams.takeProfitPips;
        if (trade.profit > 0) {
          // Wins are affected by TP changes
          newProfit = trade.profit * tpRatio;
        }
      }
      
      // Adjust based on lot size changes
      if (newParams.lotSize && oldParams.lotSize) {
        const lotRatio = newParams.lotSize / oldParams.lotSize;
        newProfit = newProfit * lotRatio;
      }
      
      // New params
      newBalance += newProfit;
      if (newBalance > newPeak) newPeak = newBalance;
      const newDD = (newPeak - newBalance) / newPeak * 100;
      if (newDD > newDrawdown) newDrawdown = newDD;
      
      if (newProfit > 0) {
        newWins++;
        newTotalProfit += newProfit;
      } else if (newProfit < 0) {
        newLosses++;
        newTotalLoss += Math.abs(newProfit);
      }
    }
    
    const drawdownIncrease = oldDrawdown > 0 
      ? ((newDrawdown - oldDrawdown) / oldDrawdown * 100)
      : 0;
    
    const oldProfitFactor = oldTotalLoss > 0 ? oldTotalProfit / oldTotalLoss : oldTotalProfit;
    const newProfitFactor = newTotalLoss > 0 ? newTotalProfit / newTotalLoss : newTotalProfit;
    
    // Acceptable if:
    // 1. Drawdown doesn't increase more than 30%
    // 2. Profit factor doesn't decrease
    const acceptable = drawdownIncrease <= 30 && newProfitFactor >= oldProfitFactor * 0.9;
    
    return {
      acceptable,
      oldDrawdown: parseFloat(oldDrawdown.toFixed(2)),
      newDrawdown: parseFloat(newDrawdown.toFixed(2)),
      drawdownIncrease: parseFloat(drawdownIncrease.toFixed(2)),
      oldProfitFactor: parseFloat(oldProfitFactor.toFixed(2)),
      newProfitFactor: parseFloat(newProfitFactor.toFixed(2)),
      details: `Simulated on ${recentTrades.length} trades:\n` +
               `Drawdown: ${oldDrawdown.toFixed(1)}% → ${newDrawdown.toFixed(1)}% ` +
               `(${drawdownIncrease > 0 ? '+' : ''}${drawdownIncrease.toFixed(1)}%)\n` +
               `Profit Factor: ${oldProfitFactor.toFixed(2)} → ${newProfitFactor.toFixed(2)}`
    };
  }
  
  /**
   * Get parameter limits for a specific parameter
   */
  static getParameterLimits(name: string): ParameterLimits | null {
    return PARAMETER_LIMITS[name] || null;
  }
  
  /**
   * Check if a parameter exists in our limits
   */
  static isKnownParameter(name: string): boolean {
    return name in PARAMETER_LIMITS;
  }
  
  /**
   * Get all parameter names
   */
  static getAllParameterNames(): string[] {
    return Object.keys(PARAMETER_LIMITS);
  }
}
