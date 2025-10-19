/**
 * Performance Analytics
 * 
 * This module provides the PerformanceAnalytics class which serves as the main interface
 * for calculating and analyzing trading performance metrics. It integrates with the
 * MetricsCalculator to provide comprehensive performance analysis.
 */

import {
  Trade,
  TradeMetrics,
  StrategyMetrics,
  RiskAdjustedReturns,
  DrawdownAnalysis,
  WinRateStats,
  PerformanceReport,
  PerformanceSummary,
  PerformanceCalculationOptions,
  AnalyticsFilterOptions,
  PerformanceComparison,
  PerformanceAlert,
  PerformanceGoal,
  MonthlyReturn,
  SymbolMetrics,
  MonthlyMetrics
} from './types';

import { MetricsCalculator } from './metrics-calculator';
import { logger } from '../monitoring/logger';

export class PerformanceAnalytics {
  private metricsCalculator: MetricsCalculator;
  private tradesCache: Map<string, Trade[]> = new Map();
  private cacheExpiry: Map<string, Date> = new Map();
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.metricsCalculator = new MetricsCalculator();
  }

  /**
   * Calculate comprehensive trade performance metrics
   */
  async calculateTradeMetrics(
    trades: Trade[], 
    options?: PerformanceCalculationOptions
  ): Promise<TradeMetrics> {
    try {
      logger.info('Calculating trade metrics', { 
        tradeCount: trades.length, 
        options 
      });
      
      const filteredTrades = this.applyFilters(trades);
      const metrics = this.metricsCalculator.calculateTradeMetrics(filteredTrades, options);
      
      logger.info('Trade metrics calculated successfully', { 
        totalTrades: metrics.totalTrades,
        winRate: metrics.winRate,
        netProfit: metrics.netProfit
      });
      
      return metrics;
    } catch (error) {
      logger.error('Error calculating trade metrics', error instanceof Error ? error : new Error(String(error)), { tradesCount: trades.length });
      throw new Error(`Failed to calculate trade metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Track strategy performance over time
   */
  async calculateStrategyMetrics(
    strategyId: string,
    strategyName: string,
    trades: Trade[],
    initialBalance: number = 10000,
    options?: PerformanceCalculationOptions
  ): Promise<StrategyMetrics> {
    try {
      logger.info('Calculating strategy metrics', { 
        strategyId, 
        strategyName, 
        tradeCount: trades.length 
      });
      
      const filteredTrades = this.applyFilters(trades);
      const tradeMetrics = this.metricsCalculator.calculateTradeMetrics(filteredTrades, options);
      const riskAdjustedReturns = this.metricsCalculator.calculateRiskAdjustedReturns(
        filteredTrades, 
        initialBalance, 
        options
      );
      const drawdownAnalysis = this.metricsCalculator.calculateDrawdownAnalysis(
        filteredTrades, 
        initialBalance
      );
      
      const monthlyReturns = this.metricsCalculator.calculateMonthlyReturns(filteredTrades, initialBalance);
      const tradesBySymbol = this.metricsCalculator.calculateSymbolMetrics(filteredTrades);
      const tradesByMonth = this.calculateMonthlyMetrics(filteredTrades);
      
      const netProfitPercent = initialBalance > 0 ? (tradeMetrics.netProfit / initialBalance) * 100 : 0;
      const recoveryFactor = drawdownAnalysis.maxDrawdown > 0 ? 
        Math.abs(tradeMetrics.netProfit / drawdownAnalysis.maxDrawdown) : 0;

      const strategyMetrics: StrategyMetrics = {
        strategyId,
        strategyName,
        totalTrades: tradeMetrics.totalTrades,
        winRate: tradeMetrics.winRate,
        netProfit: tradeMetrics.netProfit,
        netProfitPercent,
        grossProfit: tradeMetrics.totalProfit,
        grossLoss: tradeMetrics.totalLoss,
        profitFactor: tradeMetrics.profitFactor,
        maxDrawdown: drawdownAnalysis.maxDrawdown,
        maxDrawdownPercent: drawdownAnalysis.maxDrawdownPercent,
        averageWin: tradeMetrics.averageWin,
        averageLoss: tradeMetrics.averageLoss,
        recoveryFactor,
        sharpeRatio: riskAdjustedReturns.sharpeRatio,
        sortinoRatio: riskAdjustedReturns.sortinoRatio,
        calmarRatio: riskAdjustedReturns.calmarRatio,
        averageHoldingTime: tradeMetrics.averageHoldingTime,
        monthlyReturns,
        tradesBySymbol,
        tradesByMonth
      };
      
      logger.info('Strategy metrics calculated successfully', { 
        strategyId,
        netProfit: strategyMetrics.netProfit,
        winRate: strategyMetrics.winRate,
        sharpeRatio: strategyMetrics.sharpeRatio
      });
      
      return strategyMetrics;
    } catch (error) {
      logger.error('Error calculating strategy metrics', error instanceof Error ? error : new Error(String(error)), {
        strategyId,
        tradesCount: trades.length
      });
      throw new Error(`Failed to calculate strategy metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate risk-adjusted returns
   */
  async calculateRiskAdjustedReturns(
    trades: Trade[], 
    initialBalance: number = 10000,
    options?: PerformanceCalculationOptions
  ): Promise<RiskAdjustedReturns> {
    try {
      logger.info('Calculating risk-adjusted returns', { 
        tradeCount: trades.length, 
        initialBalance 
      });
      
      const filteredTrades = this.applyFilters(trades);
      const riskAdjustedReturns = this.metricsCalculator.calculateRiskAdjustedReturns(
        filteredTrades, 
        initialBalance, 
        options
      );
      
      logger.info('Risk-adjusted returns calculated successfully', { 
        sharpeRatio: riskAdjustedReturns.sharpeRatio,
        sortinoRatio: riskAdjustedReturns.sortinoRatio,
        calmarRatio: riskAdjustedReturns.calmarRatio
      });
      
      return riskAdjustedReturns;
    } catch (error) {
      logger.error('Error calculating risk-adjusted returns', error instanceof Error ? error : new Error(String(error)), {
        tradesCount: trades.length
      });
      throw new Error(`Failed to calculate risk-adjusted returns: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform drawdown analysis
   */
  async performDrawdownAnalysis(
    trades: Trade[], 
    initialBalance: number = 10000
  ): Promise<DrawdownAnalysis> {
    try {
      logger.info('Performing drawdown analysis', { 
        tradeCount: trades.length, 
        initialBalance 
      });
      
      const filteredTrades = this.applyFilters(trades);
      const drawdownAnalysis = this.metricsCalculator.calculateDrawdownAnalysis(
        filteredTrades, 
        initialBalance
      );
      
      logger.info('Drawdown analysis completed successfully', { 
        maxDrawdown: drawdownAnalysis.maxDrawdown,
        maxDrawdownPercent: drawdownAnalysis.maxDrawdownPercent,
        currentDrawdown: drawdownAnalysis.currentDrawdown
      });
      
      return drawdownAnalysis;
    } catch (error) {
      logger.error('Error performing drawdown analysis', error instanceof Error ? error : new Error(String(error)), {
        tradesCount: trades.length
      });
      throw new Error(`Failed to perform drawdown analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate win rate statistics
   */
  async calculateWinRateStats(trades: Trade[]): Promise<WinRateStats> {
    try {
      logger.info('Calculating win rate statistics', { tradeCount: trades.length });
      
      const filteredTrades = this.applyFilters(trades);
      const winRateStats = this.metricsCalculator.calculateWinRateStats(filteredTrades);
      
      logger.info('Win rate statistics calculated successfully', { 
        overall: winRateStats.overall,
        longestWinStreak: winRateStats.longestWinStreak,
        longestLossStreak: winRateStats.longestLossStreak
      });
      
      return winRateStats;
    } catch (error) {
      logger.error('Error calculating win rate statistics', error instanceof Error ? error : new Error(String(error)), {
        tradesCount: trades.length
      });
      throw new Error(`Failed to calculate win rate statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a comprehensive performance report
   */
  async generatePerformanceReport(
    strategyId: string,
    strategyName: string,
    trades: Trade[],
    periodStart: Date,
    periodEnd: Date,
    initialBalance: number = 10000,
    options?: PerformanceCalculationOptions
  ): Promise<PerformanceReport> {
    try {
      logger.info('Generating performance report', { 
        strategyId, 
        strategyName, 
        periodStart, 
        periodEnd,
        tradeCount: trades.length 
      });
      
      const filteredTrades = this.applyDateRangeFilter(trades, periodStart, periodEnd);
      
      const tradeMetrics = this.metricsCalculator.calculateTradeMetrics(filteredTrades, options);
      const strategyMetrics = await this.calculateStrategyMetrics(
        strategyId, 
        strategyName, 
        filteredTrades, 
        initialBalance, 
        options
      );
      const riskAdjustedReturns = this.metricsCalculator.calculateRiskAdjustedReturns(
        filteredTrades, 
        initialBalance, 
        options
      );
      const drawdownAnalysis = this.metricsCalculator.calculateDrawdownAnalysis(
        filteredTrades, 
        initialBalance
      );
      const winRateStats = this.metricsCalculator.calculateWinRateStats(filteredTrades);
      
      const monthlyBreakdown = this.metricsCalculator.calculateMonthlyReturns(
        filteredTrades, 
        initialBalance
      );
      const symbolBreakdown = this.metricsCalculator.calculateSymbolMetrics(filteredTrades);
      
      const summary: PerformanceSummary = {
        netProfit: tradeMetrics.netProfit,
        netProfitPercent: initialBalance > 0 ? (tradeMetrics.netProfit / initialBalance) * 100 : 0,
        totalTrades: tradeMetrics.totalTrades,
        winRate: tradeMetrics.winRate,
        profitFactor: tradeMetrics.profitFactor,
        maxDrawdown: drawdownAnalysis.maxDrawdown,
        maxDrawdownPercent: drawdownAnalysis.maxDrawdownPercent,
        sharpeRatio: riskAdjustedReturns.sharpeRatio,
        averageTrade: tradeMetrics.averageTrade,
        averageHoldingTime: tradeMetrics.averageHoldingTime
      };
      
      const report: PerformanceReport = {
        reportId: this.generateReportId(),
        strategyId,
        strategyName,
        generatedAt: new Date(),
        periodStart,
        periodEnd,
        summary,
        tradeMetrics,
        strategyMetrics,
        riskAdjustedReturns,
        drawdownAnalysis,
        winRateStats,
        monthlyBreakdown,
        symbolBreakdown,
        charts: [] // Charts will be generated by ReportGenerator
      };
      
      logger.info('Performance report generated successfully', { 
        reportId: report.reportId,
        strategyId,
        netProfit: summary.netProfit,
        winRate: summary.winRate
      });
      
      return report;
    } catch (error) {
      logger.error('Error generating performance report', error instanceof Error ? error : new Error(String(error)), {
        strategyId,
        tradesCount: trades.length
      });
      throw new Error(`Failed to generate performance report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Compare performance between multiple strategies
   */
  async compareStrategies(
    strategies: Array<{id: string; name: string; trades: Trade[]}>,
    periodStart: Date,
    periodEnd: Date,
    initialBalance: number = 10000,
    options?: PerformanceCalculationOptions
  ): Promise<PerformanceComparison> {
    try {
      logger.info('Comparing strategies', { 
        strategyCount: strategies.length,
        periodStart,
        periodEnd
      });
      
      const strategyMetrics = await Promise.all(
        strategies.map(async (strategy) => {
          const filteredTrades = this.applyDateRangeFilter(
            strategy.trades, 
            periodStart, 
            periodEnd
          );
          
          const metrics = await this.calculateStrategyMetrics(
            strategy.id,
            strategy.name,
            filteredTrades,
            initialBalance,
            options
          );
          
          return {
            strategyId: strategy.id,
            strategyName: strategy.name,
            metrics,
            rank: 0, // Will be calculated after all metrics are available
            score: 0  // Will be calculated after all metrics are available
          };
        })
      );
      
      // Calculate scores and ranks
      const scoredStrategies = this.calculateStrategyScores(strategyMetrics);
      
      const comparison: PerformanceComparison = {
        strategies: scoredStrategies,
        comparisonPeriod: {
          start: periodStart,
          end: periodEnd
        }
      };
      
      logger.info('Strategy comparison completed', { 
        strategyCount: strategies.length,
        topPerformer: scoredStrategies[0]?.strategyName
      });
      
      return comparison;
    } catch (error) {
      logger.error('Error comparing strategies', error instanceof Error ? error : new Error(String(error)), {
        strategyCount: strategies.length
      });
      throw new Error(`Failed to compare strategies: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check for performance alerts based on thresholds
   */
  async checkPerformanceAlerts(
    strategyId: string,
    strategyName: string,
    trades: Trade[],
    thresholds: {
      maxDrawdownPercent?: number;
      minWinRate?: number;
      minProfitFactor?: number;
      minSharpeRatio?: number;
    }
  ): Promise<PerformanceAlert[]> {
    try {
      logger.info('Checking performance alerts', { 
        strategyId, 
        thresholds 
      });
      
      const alerts: PerformanceAlert[] = [];
      const filteredTrades = this.applyFilters(trades);
      
      if (filteredTrades.length === 0) {
        return alerts;
      }
      
      const strategyMetrics = await this.calculateStrategyMetrics(
        strategyId,
        strategyName,
        filteredTrades
      );
      
      // Check drawdown threshold
      if (thresholds.maxDrawdownPercent && 
          strategyMetrics.maxDrawdownPercent > thresholds.maxDrawdownPercent) {
        alerts.push({
          alertId: this.generateAlertId(),
          strategyId,
          alertType: 'DRAWDOWN',
          severity: this.getAlertSeverity(
            strategyMetrics.maxDrawdownPercent, 
            thresholds.maxDrawdownPercent
          ),
          message: `Maximum drawdown of ${strategyMetrics.maxDrawdownPercent.toFixed(2)}% exceeds threshold of ${thresholds.maxDrawdownPercent}%`,
          currentValue: strategyMetrics.maxDrawdownPercent,
          threshold: thresholds.maxDrawdownPercent,
          triggeredAt: new Date(),
          acknowledged: false
        });
      }
      
      // Check win rate threshold
      if (thresholds.minWinRate && 
          strategyMetrics.winRate < thresholds.minWinRate) {
        alerts.push({
          alertId: this.generateAlertId(),
          strategyId,
          alertType: 'WIN_RATE',
          severity: this.getAlertSeverity(
            thresholds.minWinRate - strategyMetrics.winRate, 
            thresholds.minWinRate * 0.2
          ),
          message: `Win rate of ${strategyMetrics.winRate.toFixed(2)}% below threshold of ${thresholds.minWinRate}%`,
          currentValue: strategyMetrics.winRate,
          threshold: thresholds.minWinRate,
          triggeredAt: new Date(),
          acknowledged: false
        });
      }
      
      // Check profit factor threshold
      if (thresholds.minProfitFactor && 
          strategyMetrics.profitFactor < thresholds.minProfitFactor) {
        alerts.push({
          alertId: this.generateAlertId(),
          strategyId,
          alertType: 'PROFIT_FACTOR',
          severity: this.getAlertSeverity(
            thresholds.minProfitFactor - strategyMetrics.profitFactor, 
            thresholds.minProfitFactor * 0.2
          ),
          message: `Profit factor of ${strategyMetrics.profitFactor.toFixed(2)} below threshold of ${thresholds.minProfitFactor}`,
          currentValue: strategyMetrics.profitFactor,
          threshold: thresholds.minProfitFactor,
          triggeredAt: new Date(),
          acknowledged: false
        });
      }
      
      // Check Sharpe ratio threshold
      if (thresholds.minSharpeRatio && 
          strategyMetrics.sharpeRatio < thresholds.minSharpeRatio) {
        alerts.push({
          alertId: this.generateAlertId(),
          strategyId,
          alertType: 'SHARPE_RATIO',
          severity: this.getAlertSeverity(
            thresholds.minSharpeRatio - strategyMetrics.sharpeRatio, 
            thresholds.minSharpeRatio * 0.3
          ),
          message: `Sharpe ratio of ${strategyMetrics.sharpeRatio.toFixed(2)} below threshold of ${thresholds.minSharpeRatio}`,
          currentValue: strategyMetrics.sharpeRatio,
          threshold: thresholds.minSharpeRatio,
          triggeredAt: new Date(),
          acknowledged: false
        });
      }
      
      logger.info('Performance alerts check completed', { 
        strategyId,
        alertCount: alerts.length
      });
      
      return alerts;
    } catch (error) {
      logger.error('Error checking performance alerts', error instanceof Error ? error : new Error(String(error)), {
        strategyId
      });
      throw new Error(`Failed to check performance alerts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Track progress towards performance goals
   */
  async trackPerformanceGoals(
    strategyId: string,
    trades: Trade[],
    goals: PerformanceGoal[]
  ): Promise<PerformanceGoal[]> {
    try {
      logger.info('Tracking performance goals', { 
        strategyId, 
        goalCount: goals.length 
      });
      
      const filteredTrades = this.applyFilters(trades);
      
      if (filteredTrades.length === 0) {
        return goals.map(goal => ({
          ...goal,
          currentValue: 0,
          progress: 0,
          achieved: false
        }));
      }
      
      const strategyMetrics = await this.calculateStrategyMetrics(
        strategyId,
        '', // Strategy name not needed for goal tracking
        filteredTrades
      );
      
      const updatedGoals = goals.map(goal => {
        let currentValue = 0;
        
        switch (goal.goalType) {
          case 'PROFIT_TARGET':
            currentValue = strategyMetrics.netProfit;
            break;
          case 'WIN_RATE':
            currentValue = strategyMetrics.winRate;
            break;
          case 'MAX_DRAWDOWN':
            currentValue = strategyMetrics.maxDrawdownPercent;
            break;
          case 'SHARPE_RATIO':
            currentValue = strategyMetrics.sharpeRatio;
            break;
        }
        
        const progress = this.calculateGoalProgress(goal, currentValue);
        const achieved = this.isGoalAchieved(goal, currentValue);
        
        return {
          ...goal,
          currentValue,
          progress,
          updatedAt: new Date(),
          achieved
        };
      });
      
      logger.info('Performance goals tracking completed', { 
        strategyId,
        achievedCount: updatedGoals.filter(g => g.achieved).length
      });
      
      return updatedGoals;
    } catch (error) {
      logger.error('Error tracking performance goals', error instanceof Error ? error : new Error(String(error)), {
        strategyId
      });
      throw new Error(`Failed to track performance goals: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Private helper methods

  private applyFilters(trades: Trade[], filters?: AnalyticsFilterOptions): Trade[] {
    if (!filters) return trades;
    
    return trades.filter(trade => {
      // Symbol filter
      if (filters.symbol) {
        if (Array.isArray(filters.symbol)) {
          if (!filters.symbol.includes(trade.symbol)) return false;
        } else if (trade.symbol !== filters.symbol) {
          return false;
        }
      }
      
      // Direction filter
      if (filters.direction && filters.direction !== 'BOTH') {
        if (trade.direction !== filters.direction) return false;
      }
      
      // Date range filter
      if (filters.startDate && trade.entryTime < filters.startDate) return false;
      if (filters.endDate && trade.entryTime > filters.endDate) return false;
      
      // Profit filter
      if (filters.minProfit !== undefined && trade.profit < filters.minProfit) return false;
      if (filters.maxProfit !== undefined && trade.profit > filters.maxProfit) return false;
      
      // Status filter
      if (filters.status && filters.status !== 'ALL' && trade.status !== filters.status) return false;
      
      return true;
    });
  }

  private applyDateRangeFilter(trades: Trade[], startDate: Date, endDate: Date): Trade[] {
    return trades.filter(trade => 
      trade.entryTime >= startDate && trade.entryTime <= endDate
    );
  }

  private calculateMonthlyMetrics(trades: Trade[]): MonthlyMetrics[] {
    const monthlyGroups = new Map<string, Trade[]>();
    
    trades.forEach(trade => {
      if (trade.exitTime) {
        const month = trade.exitTime.toISOString().substring(0, 7); // "YYYY-MM"
        if (!monthlyGroups.has(month)) {
          monthlyGroups.set(month, []);
        }
        monthlyGroups.get(month)!.push(trade);
      }
    });
    
    return Array.from(monthlyGroups.entries())
      .map(([month, monthTrades]) => {
        const metrics = this.metricsCalculator.calculateTradeMetrics(monthTrades);
        const drawdownAnalysis = this.metricsCalculator.calculateDrawdownAnalysis(monthTrades);
        
        return {
          month,
          tradesCount: metrics.totalTrades,
          winRate: metrics.winRate,
          netProfit: metrics.netProfit,
          maxDrawdown: drawdownAnalysis.maxDrawdown
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  private calculateStrategyScores(strategies: Array<{
    strategyId: string;
    strategyName: string;
    metrics: StrategyMetrics;
    rank: number;
    score: number;
  }>): Array<{
    strategyId: string;
    strategyName: string;
    metrics: StrategyMetrics;
    rank: number;
    score: number;
  }> {
    // Calculate a composite score for each strategy
    const scoredStrategies = strategies.map(strategy => {
      let score = 0;
      
      // Weight factors for different metrics
      const weights = {
        netProfit: 0.3,
        sharpeRatio: 0.25,
        winRate: 0.2,
        profitFactor: 0.15,
        maxDrawdown: 0.1
      };
      
      // Normalize metrics to 0-100 scale
      const normalizedNetProfit = Math.min(strategy.metrics.netProfitPercent / 100, 1) * 100;
      const normalizedSharpeRatio = Math.min(Math.max(strategy.metrics.sharpeRatio, 0) / 3, 1) * 100;
      const normalizedWinRate = strategy.metrics.winRate;
      const normalizedProfitFactor = Math.min(strategy.metrics.profitFactor / 3, 1) * 100;
      const normalizedDrawdown = Math.max(0, 100 - strategy.metrics.maxDrawdownPercent);
      
      // Calculate weighted score
      score = 
        normalizedNetProfit * weights.netProfit +
        normalizedSharpeRatio * weights.sharpeRatio +
        normalizedWinRate * weights.winRate +
        normalizedProfitFactor * weights.profitFactor +
        normalizedDrawdown * weights.maxDrawdown;
      
      return {
        ...strategy,
        score
      };
    });
    
    // Sort by score and assign ranks
    scoredStrategies.sort((a, b) => b.score - a.score);
    
    return scoredStrategies.map((strategy, index) => ({
      ...strategy,
      rank: index + 1
    }));
  }

  private getAlertSeverity(currentValue: number, threshold: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const ratio = currentValue / threshold;
    
    if (ratio < 1.2) return 'LOW';
    if (ratio < 1.5) return 'MEDIUM';
    if (ratio < 2) return 'HIGH';
    return 'CRITICAL';
  }

  private calculateGoalProgress(goal: PerformanceGoal, currentValue: number): number {
    if (goal.goalType === 'MAX_DRAWDOWN') {
      // For drawdown, lower is better
      return Math.max(0, Math.min(100, ((goal.targetValue - currentValue) / goal.targetValue) * 100));
    } else {
      // For other metrics, higher is better
      return Math.max(0, Math.min(100, (currentValue / goal.targetValue) * 100));
    }
  }

  private isGoalAchieved(goal: PerformanceGoal, currentValue: number): boolean {
    if (goal.goalType === 'MAX_DRAWDOWN') {
      return currentValue <= goal.targetValue;
    } else {
      return currentValue >= goal.targetValue;
    }
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}