/**
 * Position Sizing Simulator for Backtesting
 * 
 * This module provides simulation capabilities for testing different position sizing
 * methods on historical data to compare their performance characteristics.
 */

import {
  PositionSizingConfig,
  PositionSizingParams,
  PositionSizingResult,
  SizingMethod
} from '../../types';
import { positionSizingCalculator } from '../trading/position-sizing';
import { logger } from '../monitoring/logger';

// Trade data for simulation
export interface SimulatedTrade {
  timestamp: Date;
  entryPrice: number;
  exitPrice: number;
  tradeType: 'BUY' | 'SELL';
  pipMovement: number;
  profit: number;
  atr?: number;
  volatility?: number;
  holdingPeriod: number; // in hours
}

// Simulation parameters
export interface SimulationParams {
  /** Initial account balance */
  initialBalance: number;
  
  /** Position sizing configuration to test */
  config: PositionSizingConfig;
  
  /** Historical trades to simulate */
  trades: SimulatedTrade[];
  
  /** Symbol being traded */
  symbol: string;
  
  /** Maximum drawdown limit (percentage) */
  maxDrawdownLimit?: number;
  
  /** Daily loss limit (percentage) */
  dailyLossLimit?: number;
  
  /** Whether to enable compounding */
  enableCompounding?: boolean;
  
  /** Commission per trade */
  commission?: number;
  
  /** Spread in pips */
  spread?: number;
}

// Simulation results
export interface SimulationResults {
  /** Position sizing method used */
  method: SizingMethod;
  
  /** Performance metrics */
  performance: {
    initialBalance: number;
    finalBalance: number;
    totalReturn: number;
    totalReturnPercent: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    sharpeRatio: number;
    sortinoRatio: number;
    profitFactor: number;
    expectancy: number;
  };
  
  /** Trade statistics */
  trades: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    largestWin: number;
    largestLoss: number;
    avgHoldingPeriod: number;
  };
  
  /** Position sizing statistics */
  positionSizing: {
    avgPositionSize: number;
    maxPositionSize: number;
    minPositionSize: number;
    avgRiskPercentage: number;
    maxRiskPercentage: number;
    totalRiskTaken: number;
    riskEfficiency: number; // Return per unit of risk
  };
  
  /** Risk metrics */
  risk: {
    maxDailyLoss: number;
    maxDailyLossPercent: number;
    dailyLosses: Array<{ date: string; loss: number; lossPercent: number }>;
    consecutiveLosses: number;
    maxConsecutiveLosses: number;
    riskOfRuin: number; // Probability of losing 50% of capital
  };
  
  /** Equity curve data */
  equityCurve: Array<{
    date: string;
    balance: number;
    equity: number;
    drawdown: number;
    drawdownPercent: number;
  }>;
  
  /** Individual trade results */
  tradeResults: Array<{
    tradeNumber: number;
    timestamp: Date;
    entryPrice: number;
    exitPrice: number;
    positionSize: number;
    riskAmount: number;
    riskPercentage: number;
    profit: number;
    profitPercent: number;
    balance: number;
    confidence: number;
    warnings: string[];
  }>;
  
  /** Warnings and recommendations */
  warnings: string[];
  recommendations: string[];
}

/**
 * Position Sizing Simulator class
 */
export class PositionSizingSimulator {
  constructor() {
    logger.info('PositionSizingSimulator initialized');
  }

  /**
   * Run position sizing simulation
   */
  async runSimulation(params: SimulationParams): Promise<SimulationResults> {
    try {
      logger.info('Starting position sizing simulation', {
        method: params.config.method,
        symbol: params.symbol,
        initialBalance: params.initialBalance,
        totalTrades: params.trades.length
      });

      let currentBalance = params.initialBalance;
      let currentEquity = params.initialBalance;
      let peakBalance = params.initialBalance;
      let maxDrawdown = 0;
      let maxDrawdownPercent = 0;

      const tradeResults: SimulationResults['tradeResults'] = [];
      const equityCurve: SimulationResults['equityCurve'] = [];
      const dailyLosses: SimulationResults['risk']['dailyLosses'] = [];

      let totalProfit = 0;
      let totalLoss = 0;
      let winningTrades = 0;
      let losingTrades = 0;
      let largestWin = 0;
      let largestLoss = 0;
      let consecutiveLosses = 0;
      let maxConsecutiveLosses = 0;

      let totalRiskTaken = 0;
      let totalPositionSize = 0;
      let maxPositionSize = 0;
      let minPositionSize = Infinity;
      let maxRiskPercentage = 0;

      // Process each trade
      for (let i = 0; i < params.trades.length; i++) {
        const trade = params.trades[i];
        const previousBalance = currentBalance;

        // Calculate position size for this trade
        const positionSizingParams: PositionSizingParams = {
          accountBalance: currentBalance,
          accountEquity: currentEquity,
          symbol: params.symbol,
          entryPrice: trade.entryPrice,
          tradeType: trade.tradeType,
          currentATR: trade.atr,
          volatility: trade.volatility,
          spread: params.spread,
          config: params.config,
          openPositions: [], // Simplified for simulation
          dailyPnL: 0 // Simplified for simulation
        };

        const positionResult = await positionSizingCalculator.calculatePositionSize(positionSizingParams);

        // Calculate trade profit/loss
        const commission = params.commission || 0;
        const spreadCost = (params.spread || 0) * positionResult.positionSize * 0.1; // Simplified spread calculation
        const grossProfit = trade.pipMovement * positionResult.positionSize * 10; // Simplified pip value
        const netProfit = grossProfit - commission - spreadCost;

        // Update balance and equity
        currentBalance += netProfit;
        currentEquity = currentBalance; // Simplified - no open positions in simulation

        // Update peak balance and drawdown
        if (currentBalance > peakBalance) {
          peakBalance = currentBalance;
        }
        const currentDrawdown = peakBalance - currentBalance;
        const currentDrawdownPercent = (currentDrawdown / peakBalance) * 100;
        
        if (currentDrawdown > maxDrawdown) {
          maxDrawdown = currentDrawdown;
        }
        if (currentDrawdownPercent > maxDrawdownPercent) {
          maxDrawdownPercent = currentDrawdownPercent;
        }

        // Update trade statistics
        totalPositionSize += positionResult.positionSize;
        maxPositionSize = Math.max(maxPositionSize, positionResult.positionSize);
        minPositionSize = Math.min(minPositionSize, positionResult.positionSize);
        maxRiskPercentage = Math.max(maxRiskPercentage, positionResult.riskPercentage);
        totalRiskTaken += positionResult.riskAmount;

        if (netProfit > 0) {
          totalProfit += netProfit;
          winningTrades++;
          largestWin = Math.max(largestWin, netProfit);
          consecutiveLosses = 0;
        } else {
          totalLoss += Math.abs(netProfit);
          losingTrades++;
          largestLoss = Math.max(largestLoss, Math.abs(netProfit));
          consecutiveLosses++;
          maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
        }

        // Store trade result
        tradeResults.push({
          tradeNumber: i + 1,
          timestamp: trade.timestamp,
          entryPrice: trade.entryPrice,
          exitPrice: trade.exitPrice,
          positionSize: positionResult.positionSize,
          riskAmount: positionResult.riskAmount,
          riskPercentage: positionResult.riskPercentage,
          profit: netProfit,
          profitPercent: (netProfit / previousBalance) * 100,
          balance: currentBalance,
          confidence: positionResult.confidence,
          warnings: positionResult.warnings
        });

        // Add to equity curve (daily points)
        const dateStr = trade.timestamp.toISOString().split('T')[0];
        const existingEquityPoint = equityCurve.find(point => point.date === dateStr);
        
        if (existingEquityPoint) {
          existingEquityPoint.balance = currentBalance;
          existingEquityPoint.equity = currentEquity;
          existingEquityPoint.drawdown = currentDrawdown;
          existingEquityPoint.drawdownPercent = currentDrawdownPercent;
        } else {
          equityCurve.push({
            date: dateStr,
            balance: currentBalance,
            equity: currentEquity,
            drawdown: currentDrawdown,
            drawdownPercent: currentDrawdownPercent
          });
        }

        // Check for risk limits
        if (params.maxDrawdownLimit && currentDrawdownPercent > params.maxDrawdownLimit) {
          logger.warn('Maximum drawdown limit reached', {
            drawdownPercent: currentDrawdownPercent,
            limit: params.maxDrawdownLimit,
            tradeNumber: i + 1
          });
          break;
        }
      }

      // Calculate performance metrics
      const totalReturn = currentBalance - params.initialBalance;
      const totalReturnPercent = (totalReturn / params.initialBalance) * 100;
      const avgWin = winningTrades > 0 ? totalProfit / winningTrades : 0;
      const avgLoss = losingTrades > 0 ? totalLoss / losingTrades : 0;
      const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : 0;
      const expectancy = (winningTrades * avgWin - losingTrades * avgLoss) / (winningTrades + losingTrades);

      // Calculate risk-adjusted returns
      const returns = tradeResults.map(trade => trade.profitPercent);
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const returnStdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
      const sharpeRatio = returnStdDev > 0 ? avgReturn / returnStdDev : 0;
      
      // Calculate Sortino ratio (downside deviation only)
      const negativeReturns = returns.filter(r => r < 0);
      const downsideDeviation = negativeReturns.length > 0 
        ? Math.sqrt(negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length)
        : 0;
      const sortinoRatio = downsideDeviation > 0 ? avgReturn / downsideDeviation : 0;

      // Calculate risk efficiency
      const riskEfficiency = totalRiskTaken > 0 ? totalReturn / totalRiskTaken : 0;

      // Calculate risk of ruin (simplified)
      const riskOfRuin = this.calculateRiskOfRuin(winningTrades, losingTrades, avgWin, avgLoss, params.initialBalance);

      // Generate warnings and recommendations
      const warnings = this.generateWarnings(params, {
        maxDrawdownPercent,
        maxConsecutiveLosses,
        profitFactor,
        avgPositionSize: totalPositionSize / tradeResults.length
      });

      const recommendations = this.generateRecommendations(params, {
        totalReturnPercent,
        maxDrawdownPercent,
        winRate: (winningTrades / tradeResults.length) * 100,
        sharpeRatio,
        riskEfficiency
      });

      const results: SimulationResults = {
        method: params.config.method,
        performance: {
          initialBalance: params.initialBalance,
          finalBalance: currentBalance,
          totalReturn,
          totalReturnPercent,
          maxDrawdown,
          maxDrawdownPercent,
          sharpeRatio,
          sortinoRatio,
          profitFactor,
          expectancy
        },
        trades: {
          totalTrades: tradeResults.length,
          winningTrades,
          losingTrades,
          winRate: (winningTrades / tradeResults.length) * 100,
          avgWin,
          avgLoss,
          largestWin,
          largestLoss,
          avgHoldingPeriod: params.trades.reduce((sum, trade) => sum + trade.holdingPeriod, 0) / params.trades.length
        },
        positionSizing: {
          avgPositionSize: totalPositionSize / tradeResults.length,
          maxPositionSize,
          minPositionSize: minPositionSize === Infinity ? 0 : minPositionSize,
          avgRiskPercentage: tradeResults.reduce((sum, trade) => sum + trade.riskPercentage, 0) / tradeResults.length,
          maxRiskPercentage,
          totalRiskTaken,
          riskEfficiency
        },
        risk: {
          maxDailyLoss: Math.min(...dailyLosses.map(d => d.loss)),
          maxDailyLossPercent: Math.min(...dailyLosses.map(d => d.lossPercent)),
          dailyLosses,
          consecutiveLosses,
          maxConsecutiveLosses,
          riskOfRuin
        },
        equityCurve,
        tradeResults,
        warnings,
        recommendations
      };

      logger.info('Position sizing simulation completed', {
        method: params.config.method,
        totalReturnPercent: results.performance.totalReturnPercent,
        maxDrawdownPercent: results.performance.maxDrawdownPercent,
        sharpeRatio: results.performance.sharpeRatio,
        winRate: results.trades.winRate
      });

      return results;
    } catch (error) {
      logger.error('Position sizing simulation failed', error as Error, { params });
      throw error;
    }
  }

  /**
   * Compare multiple position sizing methods
   */
  async compareMethods(
    baseParams: Omit<SimulationParams, 'config'>,
    methods: SizingMethod[]
  ): Promise<{ method: SizingMethod; results: SimulationResults }[]> {
    try {
      const comparisonResults: { method: SizingMethod; results: SimulationResults }[] = [];

      for (const method of methods) {
        const { PositionSizingCalculator } = await import('../trading/position-sizing');
        const config = PositionSizingCalculator.getDefaultConfig(method);
        const params: SimulationParams = {
          ...baseParams,
          config
        };

        const results = await this.runSimulation(params);
        comparisonResults.push({ method, results });
      }

      // Sort by total return (descending)
      comparisonResults.sort((a, b) => b.results.performance.totalReturnPercent - a.results.performance.totalReturnPercent);

      logger.info('Position sizing methods comparison completed', {
        methods,
        bestMethod: comparisonResults[0].method,
        bestReturn: comparisonResults[0].results.performance.totalReturnPercent
      });

      return comparisonResults;
    } catch (error) {
      logger.error('Position sizing methods comparison failed', error as Error, { baseParams, methods });
      throw error;
    }
  }

  /**
   * Calculate risk of ruin probability
   */
  private calculateRiskOfRuin(
    wins: number,
    losses: number,
    avgWin: number,
    avgLoss: number,
    initialBalance: number
  ): number {
    if (losses === 0 || avgLoss === 0) return 0;
    if (wins === 0 || avgWin === 0) return 1;

    const winRate = wins / (wins + losses);
    const loseRate = 1 - winRate;
    const avgReturn = avgWin / avgLoss;

    // Simplified risk of ruin formula
    const riskOfRuin = Math.pow((loseRate / winRate), Math.log(2) / Math.log(avgReturn));
    
    return Math.min(1, Math.max(0, riskOfRuin));
  }

  /**
   * Generate warnings based on simulation results
   */
  private generateWarnings(
    params: SimulationParams,
    metrics: {
      maxDrawdownPercent: number;
      maxConsecutiveLosses: number;
      profitFactor: number;
      avgPositionSize: number;
    }
  ): string[] {
    const warnings: string[] = [];

    if (metrics.maxDrawdownPercent > 25) {
      warnings.push(`Very high maximum drawdown (${metrics.maxDrawdownPercent.toFixed(1)}%). Consider reducing risk.`);
    } else if (metrics.maxDrawdownPercent > 15) {
      warnings.push(`High maximum drawdown (${metrics.maxDrawdownPercent.toFixed(1)}%). Monitor risk carefully.`);
    }

    if (metrics.maxConsecutiveLosses > 10) {
      warnings.push(`Long losing streak (${metrics.maxConsecutiveLosses} trades). Review strategy logic.`);
    }

    if (metrics.profitFactor < 1.0) {
      warnings.push(`Profit factor below 1.0 (${metrics.profitFactor.toFixed(2)}). Strategy is losing money.`);
    } else if (metrics.profitFactor < 1.5) {
      warnings.push(`Low profit factor (${metrics.profitFactor.toFixed(2)}). Consider improving entry/exit rules.`);
    }

    if (metrics.avgPositionSize > params.initialBalance * 0.1) {
      warnings.push(`Large average position size (${metrics.avgPositionSize.toFixed(2)}). High risk exposure.`);
    }

    return warnings;
  }

  /**
   * Generate recommendations based on simulation results
   */
  private generateRecommendations(
    params: SimulationParams,
    metrics: {
      totalReturnPercent: number;
      maxDrawdownPercent: number;
      winRate: number;
      sharpeRatio: number;
      riskEfficiency: number;
    }
  ): string[] {
    const recommendations: string[] = [];

    if (metrics.totalReturnPercent > 20) {
      recommendations.push('Excellent returns! Consider increasing position size slightly if risk is acceptable.');
    } else if (metrics.totalReturnPercent < 5) {
      recommendations.push('Low returns. Review strategy logic or consider more aggressive position sizing.');
    }

    if (metrics.maxDrawdownPercent > 20) {
      recommendations.push('Reduce maximum risk per trade to lower drawdown.');
    } else if (metrics.maxDrawdownPercent < 5) {
      recommendations.push('Low drawdown indicates conservative approach. Consider increasing risk for better returns.');
    }

    if (metrics.winRate < 40) {
      recommendations.push('Low win rate. Focus on improving entry conditions or risk-reward ratio.');
    } else if (metrics.winRate > 60) {
      recommendations.push('High win rate! Consider taking more trades or increasing position size.');
    }

    if (metrics.sharpeRatio < 0.5) {
      recommendations.push('Low risk-adjusted returns. Focus on consistency and risk management.');
    } else if (metrics.sharpeRatio > 1.5) {
      recommendations.push('Excellent risk-adjusted returns. Strategy is well-balanced.');
    }

    if (metrics.riskEfficiency < 1.0) {
      recommendations.push('Low risk efficiency. Improve risk-reward ratios or reduce risk per trade.');
    }

    return recommendations;
  }
}

// Export singleton instance
export const positionSizingSimulator = new PositionSizingSimulator();