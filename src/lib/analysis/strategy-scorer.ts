import {
  StrategyScore,
  ScoringMetrics,
  ScoringWeights,
  StrategyScoreHistory,
  BenchmarkData,
  ScoringConfig,
  StrategyScoreCalculationParams,
  BacktestResults,
  BacktestResult,
  BacktestTrade,
} from '@/types';

// Define EquityCurvePoint interface locally since it's not exported
interface EquityCurvePoint {
  timestamp: Date;
  equity: number;
}

/**
 * Default scoring weights for different dimensions
 */
const DEFAULT_WEIGHTS: ScoringWeights = {
  profitability: 0.30, // 30% weight for profitability
  consistency: 0.25,   // 25% weight for consistency
  riskAdjusted: 0.25,  // 25% weight for risk-adjusted returns
  drawdown: 0.20,      // 20% weight for drawdown control
};

/**
 * Default scoring configuration
 */
const DEFAULT_CONFIG: ScoringConfig = {
  weights: DEFAULT_WEIGHTS,
  minimumTrades: 20,
  lookbackPeriod: 365, // 1 year
  enableHistoricalTracking: true,
};

/**
 * Strategy Performance Scoring Engine
 * 
 * This class provides comprehensive scoring of trading strategies across multiple dimensions:
 * - Profitability: Return metrics, profit factor, expectancy
 * - Consistency: Win rate stability, consecutive wins/losses
 * - Risk-Adjusted: Sharpe ratio, Sortino ratio, Calmar ratio
 * - Drawdown: Maximum drawdown, recovery factor
 */
export class StrategyScorer {
  private config: ScoringConfig;

  constructor(config: Partial<ScoringConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate comprehensive strategy score
   */
  public calculateStrategyScore(params: StrategyScoreCalculationParams): StrategyScore {
    const { backtestResults, config, benchmark, historicalScores } = params;
    
    // Use provided config or default
    const scoringConfig = { ...this.config, ...config };
    
    // Extract metrics from backtest results
    const metrics = this.extractMetrics(backtestResults);
    
    // Calculate individual dimension scores
    const profitabilityScore = this.scoreProfitability(metrics);
    const consistencyScore = this.scoreConsistency(metrics);
    const riskAdjustedScore = this.scoreRiskAdjusted(metrics);
    const drawdownScore = this.scoreDrawdown(metrics);
    
    // Calculate weighted overall score
    const overall = this.calculateWeightedScore(
      {
        profitability: profitabilityScore,
        consistency: consistencyScore,
        riskAdjusted: riskAdjustedScore,
        drawdown: drawdownScore,
      },
      scoringConfig.weights
    );
    
    // Generate recommendations and warnings
    const recommendations = this.generateRecommendations(metrics, {
      profitability: profitabilityScore,
      consistency: consistencyScore,
      riskAdjusted: riskAdjustedScore,
      drawdown: drawdownScore,
    });
    
    const warnings = this.identifyWeaknesses(metrics, {
      profitability: profitabilityScore,
      consistency: consistencyScore,
      riskAdjusted: riskAdjustedScore,
      drawdown: drawdownScore,
    });
    
    return {
      profitability: profitabilityScore,
      consistency: consistencyScore,
      riskAdjusted: riskAdjustedScore,
      drawdown: drawdownScore,
      overall,
      recommendations,
      warnings,
    };
  }

  /**
   * Extract comprehensive metrics from backtest results
   */
  private extractMetrics(backtestResults: BacktestResults | BacktestResult): ScoringMetrics {
    // Handle both BacktestResults and BacktestResult formats
    const results = this.normalizeBacktestResults(backtestResults);
    
    const trades = results.trades || [];
    const equityCurve = results.equityCurve || [];
    
    // Basic metrics - use type assertions to handle both interfaces
    const returnPercentage = (results as any).returnPercentage || 0;
    const profitFactor = (results as any).profitFactor || 0;
    const winRate = (results as any).winRate || 0;
    const maxDrawdown = (results as any).maxDrawdown || 0;
    const maxDrawdownPercent = (results as any).maxDrawdownPercent || maxDrawdown;
    const sharpeRatio = (results as any).sharpeRatio || 0;
    const totalTrades = (results as any).totalTrades || trades.length;
    
    // Get start and end dates from metadata or results
    const startDate = (results as any).startDate || (results as any).metadata?.executionTime || new Date();
    const endDate = (results as any).endDate || new Date();
    
    // Calculate additional metrics
    const winningTrades = trades.filter((t: BacktestTrade) => t.profit > 0);
    const losingTrades = trades.filter((t: BacktestTrade) => t.profit <= 0);
    
    const averageWin = winningTrades.length > 0
      ? winningTrades.reduce((sum: number, t: any) => sum + t.profit, 0) / winningTrades.length
      : 0;
    
    const averageLoss = losingTrades.length > 0
      ? losingTrades.reduce((sum: number, t: any) => sum + Math.abs(t.profit), 0) / losingTrades.length
      : 0;
    
    // Calculate expectancy
    const expectancy = (winRate / 100) * averageWin - ((100 - winRate) / 100) * averageLoss;
    
    // Calculate consistency metrics
    const winRateStability = this.calculateWinRateStability(trades);
    const { consecutiveWins, consecutiveLosses } = this.calculateConsecutiveRuns(trades);
    
    // Calculate additional risk metrics
    const sortinoRatio = this.calculateSortinoRatio(equityCurve);
    const calmarRatio = returnPercentage > 0 ? returnPercentage / Math.abs(maxDrawdownPercent) : 0;
    
    // Calculate drawdown metrics
    const { drawdownDuration, recoveryFactor } = this.analyzeDrawdown(equityCurve);
    
    // Calculate trading frequency metrics
    const tradesPerMonth = this.calculateTradesPerMonth(trades, startDate, endDate);
    const averageTradeDuration = this.calculateAverageTradeDuration(trades);
    
    // Calculate advanced risk metrics
    const { var95, skewness, kurtosis } = this.calculateAdvancedRiskMetrics(trades);
    
    return {
      returnPercentage,
      profitFactor,
      averageWin,
      averageLoss,
      expectancy,
      winRate,
      winRateStability,
      consecutiveWins,
      consecutiveLosses,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      maxDrawdown,
      maxDrawdownPercent,
      drawdownDuration,
      recoveryFactor,
      totalTrades,
      tradesPerMonth,
      averageTradeDuration,
      var95,
      skewness,
      kurtosis,
    };
  }

  /**
   * Normalize backtest results to a consistent format
   */
  private normalizeBacktestResults(results: BacktestResults | BacktestResult): any {
    // Handle BacktestResult format (from engine.ts)
    if ('status' in results) {
      const result = results as BacktestResult;
      return {
        backtestId: result.id,
        finalBalance: result.finalBalance,
        totalReturn: result.totalReturn,
        returnPercentage: result.returnPercentage,
        maxDrawdown: result.maxDrawdown,
        maxDrawdownPercent: result.maxDrawdown,
        winRate: result.winRate,
        totalTrades: result.totalTrades,
        winningTrades: result.winningTrades,
        losingTrades: result.losingTrades,
        averageWin: result.averageWin,
        averageLoss: result.averageLoss,
        profitFactor: result.profitFactor,
        sharpeRatio: result.sharpeRatio,
        trades: result.trades,
        equityCurve: result.equityCurve.map(point => ({
          timestamp: point.timestamp,
          equity: point.equity
        })),
        metadata: result.metadata,
        startDate: result.startDate,
        endDate: result.endDate,
      };
    }
    
    // Already in BacktestResults format - convert equity curve format if needed
    const backtestResults = results as any;
    return {
      ...backtestResults,
      equityCurve: backtestResults.equityCurve.map((point: any) => ({
        timestamp: point.timestamp || point.date,
        equity: point.equity || point.balance
      })),
    };
  }

  /**
   * Score profitability (0-100)
   */
  private scoreProfitability(metrics: ScoringMetrics): number {
    let score = 0;
    
    // Return percentage scoring (40% of profitability score)
    const returnScore = Math.min(100, Math.max(0, 
      metrics.returnPercentage > 0 ? Math.min(100, metrics.returnPercentage / 2) : 0
    ));
    score += returnScore * 0.4;
    
    // Profit factor scoring (30% of profitability score)
    const profitFactorScore = Math.min(100, Math.max(0,
      metrics.profitFactor > 1 ? Math.min(100, (metrics.profitFactor - 1) * 25) : 0
    ));
    score += profitFactorScore * 0.3;
    
    // Expectancy scoring (30% of profitability score)
    const expectancyScore = Math.min(100, Math.max(0,
      metrics.expectancy > 0 ? Math.min(100, metrics.expectancy * 1000) : 0
    ));
    score += expectancyScore * 0.3;
    
    return Math.round(score);
  }

  /**
   * Score consistency (0-100)
   */
  private scoreConsistency(metrics: ScoringMetrics): number {
    let score = 0;
    
    // Win rate scoring (40% of consistency score)
    const winRateScore = Math.min(100, Math.max(0, metrics.winRate));
    score += winRateScore * 0.4;
    
    // Win rate stability scoring (30% of consistency score)
    const stabilityScore = Math.min(100, Math.max(0, metrics.winRateStability * 100));
    score += stabilityScore * 0.3;
    
    // Consecutive wins vs losses ratio (30% of consistency score)
    const consecutiveRatio = metrics.consecutiveLosses > 0 
      ? metrics.consecutiveWins / metrics.consecutiveLosses 
      : metrics.consecutiveWins;
    const consecutiveScore = Math.min(100, Math.max(0, consecutiveRatio * 20));
    score += consecutiveScore * 0.3;
    
    return Math.round(score);
  }

  /**
   * Score risk-adjusted returns (0-100)
   */
  private scoreRiskAdjusted(metrics: ScoringMetrics): number {
    let score = 0;
    
    // Sharpe ratio scoring (40% of risk-adjusted score)
    const sharpeScore = Math.min(100, Math.max(0,
      metrics.sharpeRatio > 0 ? Math.min(100, metrics.sharpeRatio * 25) : 0
    ));
    score += sharpeScore * 0.4;
    
    // Sortino ratio scoring (30% of risk-adjusted score)
    const sortinoScore = Math.min(100, Math.max(0,
      metrics.sortinoRatio > 0 ? Math.min(100, metrics.sortinoRatio * 20) : 0
    ));
    score += sortinoScore * 0.3;
    
    // Calmar ratio scoring (30% of risk-adjusted score)
    const calmarScore = Math.min(100, Math.max(0,
      metrics.calmarRatio > 0 ? Math.min(100, metrics.calmarRatio * 10) : 0
    ));
    score += calmarScore * 0.3;
    
    return Math.round(score);
  }

  /**
   * Score drawdown control (0-100)
   */
  private scoreDrawdown(metrics: ScoringMetrics): number {
    let score = 0;
    
    // Max drawdown scoring (50% of drawdown score)
    const drawdownScore = Math.max(0, 100 - metrics.maxDrawdownPercent * 2);
    score += drawdownScore * 0.5;
    
    // Recovery factor scoring (30% of drawdown score)
    const recoveryScore = Math.min(100, Math.max(0,
      metrics.recoveryFactor > 0 ? Math.min(100, metrics.recoveryFactor * 10) : 0
    ));
    score += recoveryScore * 0.3;
    
    // Drawdown duration scoring (20% of drawdown score)
    const durationScore = Math.max(0, 100 - (metrics.drawdownDuration / 30) * 10); // Penalize long drawdowns
    score += durationScore * 0.2;
    
    return Math.round(score);
  }

  /**
   * Calculate weighted overall score
   */
  private calculateWeightedScore(
    scores: {
      profitability: number;
      consistency: number;
      riskAdjusted: number;
      drawdown: number;
    },
    weights: ScoringWeights
  ): number {
    const totalWeight = weights.profitability + weights.consistency + weights.riskAdjusted + weights.drawdown;
    
    const weightedScore = 
      (scores.profitability * weights.profitability +
       scores.consistency * weights.consistency +
       scores.riskAdjusted * weights.riskAdjusted +
       scores.drawdown * weights.drawdown) / totalWeight;
    
    return Math.round(weightedScore);
  }

  /**
   * Generate recommendations based on scores and metrics
   */
  private generateRecommendations(
    metrics: ScoringMetrics,
    scores: {
      profitability: number;
      consistency: number;
      riskAdjusted: number;
      drawdown: number;
    }
  ): string[] {
    const recommendations: string[] = [];
    
    // Profitability recommendations
    if (scores.profitability < 60) {
      if (metrics.returnPercentage < 10) {
        recommendations.push("Consider optimizing entry conditions to improve overall returns");
      }
      if (metrics.profitFactor < 1.5) {
        recommendations.push("Focus on improving risk-reward ratio or win rate to increase profit factor");
      }
      if (metrics.expectancy < 0) {
        recommendations.push("Strategy has negative expectancy - review exit conditions and position sizing");
      }
    }
    
    // Consistency recommendations
    if (scores.consistency < 60) {
      if (metrics.winRate < 40) {
        recommendations.push("Consider adding additional confirmation indicators to improve win rate");
      }
      if (metrics.winRateStability < 0.5) {
        recommendations.push("Win rate is inconsistent - consider market condition filters");
      }
      if (metrics.consecutiveLosses > metrics.consecutiveWins * 2) {
        recommendations.push("Implement consecutive loss protection or reduce position sizes during losing streaks");
      }
    }
    
    // Risk-adjusted recommendations
    if (scores.riskAdjusted < 60) {
      if (metrics.sharpeRatio < 1) {
        recommendations.push("Improve risk-adjusted returns by reducing volatility or increasing returns");
      }
      if (metrics.sortinoRatio < 1.5) {
        recommendations.push("Focus on reducing downside risk while maintaining upside potential");
      }
    }
    
    // Drawdown recommendations
    if (scores.drawdown < 60) {
      if (metrics.maxDrawdownPercent > 20) {
        recommendations.push("Implement tighter risk management to reduce maximum drawdown");
      }
      if (metrics.recoveryFactor < 2) {
        recommendations.push("Improve recovery factor by optimizing exit conditions");
      }
    }
    
    // Trading frequency recommendations
    if (metrics.tradesPerMonth < 5) {
      recommendations.push("Consider trading more frequently or analyzing multiple timeframes");
    } else if (metrics.tradesPerMonth > 50) {
      recommendations.push("High trading frequency may lead to overtrading - consider stricter entry criteria");
    }
    
    return recommendations;
  }

  /**
   * Identify weaknesses based on metrics and scores
   */
  private identifyWeaknesses(
    metrics: ScoringMetrics,
    scores: {
      profitability: number;
      consistency: number;
      riskAdjusted: number;
      drawdown: number;
    }
  ): string[] {
    const warnings: string[] = [];
    
    // Critical warnings
    if (metrics.totalTrades < this.config.minimumTrades) {
      warnings.push(`⚠️ Insufficient trade history: Only ${metrics.totalTrades} trades (minimum ${this.config.minimumTrades} required)`);
    }
    
    if (metrics.expectancy < 0) {
      warnings.push("🚨 Negative expectancy: Strategy loses money on average per trade");
    }
    
    if (metrics.profitFactor < 1) {
      warnings.push("🚨 Profit factor below 1: Strategy loses more than it gains");
    }
    
    if (metrics.maxDrawdownPercent > 30) {
      warnings.push(`🚨 High drawdown risk: ${metrics.maxDrawdownPercent.toFixed(1)}% maximum drawdown`);
    }
    
    if (metrics.winRate < 30) {
      warnings.push(`⚠️ Low win rate: ${metrics.winRate.toFixed(1)}% - consider strategy refinement`);
    }
    
    if (metrics.sharpeRatio < 0.5) {
      warnings.push("⚠️ Low risk-adjusted returns: Poor Sharpe ratio");
    }
    
    if (metrics.consecutiveLosses > 10) {
      warnings.push(`⚠️ High consecutive losses: ${metrics.consecutiveLosses} losing trades in a row`);
    }
    
    // Moderate warnings
    if (scores.profitability < 40) {
      warnings.push("Poor profitability performance");
    }
    
    if (scores.consistency < 40) {
      warnings.push("Inconsistent trading performance");
    }
    
    if (scores.riskAdjusted < 40) {
      warnings.push("Poor risk-adjusted returns");
    }
    
    if (scores.drawdown < 40) {
      warnings.push("Excessive drawdown risk");
    }
    
    return warnings;
  }

  /**
   * Calculate win rate stability
   */
  private calculateWinRateStability(trades: BacktestTrade[]): number {
    if (trades.length < 10) return 0;
    
    // Calculate rolling win rate over windows of 10 trades
    const windowSize = 10;
    const rollingWinRates: number[] = [];
    
    for (let i = windowSize; i < trades.length; i++) {
      const window = trades.slice(i - windowSize, i);
      const wins = window.filter(t => t.profit > 0).length;
      const winRate = wins / windowSize;
      rollingWinRates.push(winRate);
    }
    
    if (rollingWinRates.length === 0) return 0;
    
    // Calculate stability as 1 - coefficient of variation
    const mean = rollingWinRates.reduce((sum, wr) => sum + wr, 0) / rollingWinRates.length;
    const variance = rollingWinRates.reduce((sum, wr) => sum + Math.pow(wr - mean, 2), 0) / rollingWinRates.length;
    const stdDev = Math.sqrt(variance);
    
    return mean > 0 ? Math.max(0, 1 - (stdDev / mean)) : 0;
  }

  /**
   * Calculate consecutive wins and losses
   */
  private calculateConsecutiveRuns(trades: BacktestTrade[]): { consecutiveWins: number; consecutiveLosses: number } {
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;
    
    for (const trade of trades) {
      if (trade.profit > 0) {
        currentWins++;
        currentLosses = 0;
        maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins);
      } else {
        currentLosses++;
        currentWins = 0;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
      }
    }
    
    return {
      consecutiveWins: maxConsecutiveWins,
      consecutiveLosses: maxConsecutiveLosses,
    };
  }

  /**
   * Calculate Sortino ratio
   */
  private calculateSortinoRatio(equityCurve: { timestamp: Date; equity: number }[]): number {
    if (equityCurve.length < 2) return 0;
    
    const returns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const returnRate = (equityCurve[i].equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity;
      returns.push(returnRate);
    }
    
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    
    // Calculate downside deviation
    const negativeReturns = returns.filter(r => r < 0);
    if (negativeReturns.length === 0) return avgReturn > 0 ? 10 : 0; // High score if no negative returns
    
    const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length;
    const downsideDeviation = Math.sqrt(downsideVariance);
    
    return downsideDeviation > 0 ? (avgReturn / downsideDeviation) * Math.sqrt(252) : 0; // Annualized
  }

  /**
   * Analyze drawdown duration and recovery factor
   */
  private analyzeDrawdown(equityCurve: { timestamp: Date; equity: number }[]): { drawdownDuration: number; recoveryFactor: number } {
    if (equityCurve.length < 2) {
      return { drawdownDuration: 0, recoveryFactor: 0 };
    }
    
    let maxDrawdownDuration = 0;
    let currentDrawdownDuration = 0;
    let peakEquity = equityCurve[0].equity;
    let maxDrawdown = 0;
    let totalDrawdown = 0;
    let drawdownCount = 0;
    
    for (let i = 1; i < equityCurve.length; i++) {
      const currentEquity = equityCurve[i].equity;
      
      if (currentEquity > peakEquity) {
        // New peak - reset drawdown
        peakEquity = currentEquity;
        if (currentDrawdownDuration > 0) {
          maxDrawdownDuration = Math.max(maxDrawdownDuration, currentDrawdownDuration);
          currentDrawdownDuration = 0;
        }
      } else {
        // In drawdown
        const drawdown = peakEquity - currentEquity;
        const drawdownPercent = (drawdown / peakEquity) * 100;
        
        if (drawdownPercent > 0) {
          currentDrawdownDuration++;
          maxDrawdown = Math.max(maxDrawdown, drawdownPercent);
          totalDrawdown += drawdownPercent;
          drawdownCount++;
        }
      }
    }
    
    // Calculate recovery factor (average return / average drawdown)
    const totalReturn = (equityCurve[equityCurve.length - 1].equity - equityCurve[0].equity) / equityCurve[0].equity * 100;
    const avgDrawdown = drawdownCount > 0 ? totalDrawdown / drawdownCount : 0;
    const recoveryFactor = avgDrawdown > 0 ? totalReturn / avgDrawdown : (totalReturn > 0 ? 10 : 0);
    
    return {
      drawdownDuration: maxDrawdownDuration,
      recoveryFactor,
    };
  }

  /**
   * Calculate trades per month
   */
  private calculateTradesPerMonth(
    trades: BacktestTrade[],
    startDate: Date,
    endDate: Date
  ): number {
    if (trades.length === 0) return 0;
    
    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const monthsDiff = daysDiff / 30.44; // Average month length
    
    return trades.length / monthsDiff;
  }

  /**
   * Calculate average trade duration in hours
   */
  private calculateAverageTradeDuration(trades: BacktestTrade[]): number {
    if (trades.length === 0) return 0;
    
    const totalDuration = trades.reduce((sum, trade) => {
      // Handle both string and number duration formats
      if (typeof (trade as any).duration === 'number') {
        return sum + (trade as any).duration;
      } else if ((trade as any).entryTime && (trade as any).exitTime) {
        const entryTime = new Date((trade as any).entryTime).getTime();
        const exitTime = new Date((trade as any).exitTime).getTime();
        return sum + (exitTime - entryTime);
      }
      return sum;
    }, 0);
    
    return (totalDuration / trades.length) / (1000 * 60 * 60); // Convert to hours
  }

  /**
   * Calculate advanced risk metrics (VaR, skewness, kurtosis)
   */
  private calculateAdvancedRiskMetrics(trades: BacktestTrade[]): { var95: number; skewness: number; kurtosis: number } {
    if (trades.length < 10) {
      return { var95: 0, skewness: 0, kurtosis: 0 };
    }
    
    const returns = trades.map(t => t.profit);
    
    // Sort returns for VaR calculation
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const var95Index = Math.floor(returns.length * 0.05);
    const var95 = Math.abs(sortedReturns[var95Index] || 0);
    
    // Calculate mean and standard deviation for skewness and kurtosis
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) {
      return { var95, skewness: 0, kurtosis: 0 };
    }
    
    // Calculate skewness (measure of asymmetry)
    const skewness = returns.reduce((sum, r) => sum + Math.pow((r - mean) / stdDev, 3), 0) / returns.length;
    
    // Calculate kurtosis (measure of tail heaviness)
    const kurtosis = returns.reduce((sum, r) => sum + Math.pow((r - mean) / stdDev, 4), 0) / returns.length - 3;
    
    return { var95, skewness, kurtosis };
  }

  /**
   * Compare strategy with benchmark
   */
  public compareWithBenchmark(
    strategyScore: StrategyScore,
    benchmark: BenchmarkData
  ): {
    alpha: number;
    beta: number;
    informationRatio: number;
    outperformance: number;
  } {
    // This is a simplified benchmark comparison
    // In a real implementation, you'd calculate these using regression analysis
    
    const alpha = strategyScore.overall - 50; // Simplified alpha calculation
    const beta = 1.0; // Simplified beta (would need market correlation data)
    const informationRatio = alpha / 15; // Simplified IR
    const outperformance = strategyScore.overall - 50; // Simplified outperformance
    
    return {
      alpha,
      beta,
      informationRatio,
      outperformance,
    };
  }
}

/**
 * Convenience function to calculate strategy score
 */
export function calculateStrategyScore(params: StrategyScoreCalculationParams): StrategyScore {
  const scorer = new StrategyScorer(params.config);
  return scorer.calculateStrategyScore(params);
}

/**
 * Create a strategy scorer with custom configuration
 */
export function createStrategyScorer(config: Partial<ScoringConfig> = {}): StrategyScorer {
  return new StrategyScorer(config);
}