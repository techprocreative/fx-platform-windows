/**
 * Performance Analytics Processor
 * 
 * Advanced analytics processing for comprehensive performance metrics,
 * strategy comparison, trend analysis, and real-time monitoring.
 */

import {
  PerformanceMetrics,
  StrategyPerformanceData,
  MonthlyPerformanceData,
  SymbolPerformanceData,
  TimeframePerformanceData,
  DrawdownPeriod,
  EquityPoint,
  PerformanceTrend,
  RealTimePerformanceData,
  OpenPositionData,
  TradeData,
  MarketStatus,
  AnalyticsFilters,
  TimeFrame,
  AlertType,
  PerformanceAlert,
  StrategyScore
} from '@/types';
import { Trade as AnalyticsTrade } from './types';

import { 
  calculateTradeAnalytics, 
  calculateStrategyPerformance,
  AnalyticsData 
} from './analytics-service';

import { 
  adaptTradesFromDB, 
  filterClosedTrades,
  groupTradesByMonth,
  groupTradesByStrategy,
  groupTradesBySymbol
} from './adapters';

/**
 * Process comprehensive performance analytics
 */
export class PerformanceProcessor {
  private initialBalance: number = 10000;
  private riskFreeRate: number = 0.02; // 2% annual
  private periodsPerYear: number = 252; // Trading days

  constructor(initialBalance: number = 10000) {
    this.initialBalance = initialBalance;
  }

  /**
   * Process strategy performance data
   */
  async processStrategyPerformance(
    trades: AnalyticsTrade[],
    strategyName: string,
    filters?: AnalyticsFilters
  ): Promise<StrategyPerformanceData> {
    const filteredTrades = this.applyFilters(trades, filters);
    const closedTrades = filterClosedTrades(filteredTrades);
    
    // Calculate basic analytics
    const analytics = calculateTradeAnalytics(closedTrades, this.initialBalance);
    
    // Calculate advanced metrics
    const metrics = this.calculateAdvancedMetrics(closedTrades, analytics);
    
    // Calculate equity curve
    const equityCurve = this.calculateEquityCurve(closedTrades);
    
    // Calculate monthly performance
    const monthlyData = this.calculateMonthlyPerformance(closedTrades);
    
    // Calculate drawdown periods
    const drawdownPeriods = this.calculateDrawdownPeriods(equityCurve);
    
    // Calculate performance by symbol
    const tradesBySymbol = groupTradesBySymbol(closedTrades);
    const symbolPerformance = Array.from(tradesBySymbol.entries()).map(([symbol, symbolTrades]) =>
      this.calculateSymbolPerformance(symbol, symbolTrades)
    );
    
    // Calculate performance by timeframe
    const timeframePerformance = this.calculateTimeframePerformance(closedTrades);
    
    // Calculate strategy score
    const score = this.calculateStrategyScore(metrics);
    
    return {
      strategyId: trades[0]?.strategyId || '',
      strategyName,
      metrics,
      equityCurve,
      monthlyData,
      drawdownPeriods,
      tradesBySymbol: symbolPerformance,
      tradesByTimeframe: timeframePerformance,
      score,
      rank: 0 // Will be calculated when comparing multiple strategies
    };
  }

  /**
   * Calculate advanced performance metrics
   */
  private calculateAdvancedMetrics(trades: AnalyticsTrade[], analytics: AnalyticsData): PerformanceMetrics {
    if (trades.length === 0) {
      return this.getEmptyMetrics();
    }

    const closedTrades = filterClosedTrades(trades);
    
    // Basic metrics from analytics
    const basicMetrics: PerformanceMetrics = {
      totalTrades: analytics.totalTrades,
      winningTrades: analytics.winningTrades,
      losingTrades: analytics.losingTrades,
      winRate: analytics.winRate,
      totalProfit: analytics.totalProfit,
      totalProfitPercent: (analytics.totalProfit / this.initialBalance) * 100,
      maxDrawdown: analytics.maxDrawdown,
      maxDrawdownPercent: analytics.maxDrawdownPercent,
      sharpeRatio: analytics.sharpeRatio,
      sortinoRatio: this.calculateSortinoRatio(closedTrades),
      calmarRatio: this.calculateCalmarRatio(analytics),
      profitFactor: analytics.profitFactor,
      averageWin: analytics.averageWin,
      averageLoss: analytics.averageLoss,
      averageTrade: analytics.averageTrade,
      largestWin: this.calculateLargestWin(closedTrades),
      largestLoss: this.calculateLargestLoss(closedTrades),
      averageHoldingTime: this.calculateAverageHoldingTime(closedTrades),
      expectancy: this.calculateExpectancy(closedTrades),
      recoveryFactor: this.calculateRecoveryFactor(analytics),
      var95: this.calculateVaR(closedTrades, 0.95),
      cvar95: this.calculateCVaR(closedTrades, 0.95),
      riskOfRuin: this.calculateRiskOfRuin(closedTrades),
      kellyCriterion: this.calculateKellyCriterion(closedTrades),
      monthlyWinRate: 0, // Will be calculated below
      quarterlyWinRate: 0, // Will be calculated below
      yearlyWinRate: 0, // Will be calculated below
      winRateStability: this.calculateWinRateStability(closedTrades),
      profitConsistency: this.calculateProfitConsistency(closedTrades),
      tradesPerMonth: this.calculateTradesPerPeriod(closedTrades, 'month'),
      tradesPerWeek: this.calculateTradesPerPeriod(closedTrades, 'week'),
      tradesPerDay: this.calculateTradesPerPeriod(closedTrades, 'day'),
      bestDay: this.findBestDay(closedTrades),
      worstDay: this.findWorstDay(closedTrades),
      bestMonth: this.findBestMonth(closedTrades),
      worstMonth: this.findWorstMonth(closedTrades)
    };

    // Calculate time-based win rates
    const monthlyData = this.calculateMonthlyPerformance(closedTrades);
    if (monthlyData.length > 0) {
      basicMetrics.monthlyWinRate = this.calculateAverageWinRate(monthlyData.map(m => m.winRate));
      basicMetrics.quarterlyWinRate = this.calculateQuarterlyWinRate(monthlyData);
      basicMetrics.yearlyWinRate = this.calculateYearlyWinRate(monthlyData);
    }

    return basicMetrics;
  }

  /**
   * Calculate Sortino ratio
   */
  private calculateSortinoRatio(trades: AnalyticsTrade[]): number {
    if (trades.length < 2) return 0;

    const returns = trades.map(t => t.profit / this.initialBalance);
    const negativeReturns = returns.filter(r => r < 0);
    
    if (negativeReturns.length === 0) return Infinity;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const downwardDeviation = Math.sqrt(
      negativeReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / negativeReturns.length
    );
    
    return downwardDeviation === 0 ? 0 : (avgReturn / downwardDeviation) * Math.sqrt(this.periodsPerYear);
  }

  /**
   * Calculate Calmar ratio
   */
  private calculateCalmarRatio(analytics: AnalyticsData): number {
    if (analytics.maxDrawdownPercent === 0) return 0;
    
    const annualReturn = analytics.totalProfit * (this.periodsPerYear / analytics.totalTrades);
    return Math.abs(annualReturn / analytics.maxDrawdownPercent);
  }

  /**
   * Calculate largest win
   */
  private calculateLargestWin(trades: AnalyticsTrade[]): number {
    return trades.reduce((max, trade) => Math.max(max, trade.profit), 0);
  }

  /**
   * Calculate largest loss
   */
  private calculateLargestLoss(trades: AnalyticsTrade[]): number {
    return trades.reduce((min, trade) => Math.min(min, trade.profit), 0);
  }

  /**
   * Calculate average holding time
   */
  private calculateAverageHoldingTime(trades: AnalyticsTrade[]): number {
    const holdingTimes = trades
      .filter(t => t.exitTime)
      .map(t => (t.exitTime!.getTime() - t.entryTime.getTime()) / (1000 * 60 * 60)); // hours
    
    return holdingTimes.length > 0 ? holdingTimes.reduce((sum, time) => sum + time, 0) / holdingTimes.length : 0;
  }

  /**
   * Calculate expectancy
   */
  private calculateExpectancy(trades: AnalyticsTrade[]): number {
    if (trades.length === 0) return 0;
    
    const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0);
    return totalProfit / trades.length;
  }

  /**
   * Calculate recovery factor
   */
  private calculateRecoveryFactor(analytics: AnalyticsData): number {
    if (analytics.maxDrawdown === 0) return 0;
    return analytics.totalProfit / analytics.maxDrawdown;
  }

  /**
   * Calculate Value at Risk (VaR)
   */
  private calculateVaR(trades: AnalyticsTrade[], confidenceLevel: number): number {
    const returns = trades.map(t => t.profit / this.initialBalance).sort((a, b) => a - b);
    const index = Math.floor((1 - confidenceLevel) * returns.length);
    return returns[index] * this.initialBalance;
  }

  /**
   * Calculate Conditional Value at Risk (CVaR)
   */
  private calculateCVaR(trades: AnalyticsTrade[], confidenceLevel: number): number {
    const returns = trades.map(t => t.profit / this.initialBalance).sort((a, b) => a - b);
    const index = Math.floor((1 - confidenceLevel) * returns.length);
    const tailReturns = returns.slice(0, index + 1);
    return tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length * this.initialBalance;
  }

  /**
   * Calculate risk of ruin
   */
  private calculateRiskOfRuin(trades: AnalyticsTrade[]): number {
    const winRate = trades.filter(t => t.profit > 0).length / trades.length;
    const avgWin = trades.filter(t => t.profit > 0).reduce((sum, t) => sum + t.profit, 0) / trades.filter(t => t.profit > 0).length;
    const avgLoss = Math.abs(trades.filter(t => t.profit <= 0).reduce((sum, t) => sum + t.profit, 0) / trades.filter(t => t.profit <= 0).length);
    
    if (avgLoss === 0) return 0;
    
    const z = (winRate * avgWin - (1 - winRate) * avgLoss) / Math.sqrt(winRate * Math.pow(avgWin, 2) + (1 - winRate) * Math.pow(avgLoss, 2));
    return 1 - this.normalCDF(z);
  }

  /**
   * Calculate Kelly criterion
   */
  private calculateKellyCriterion(trades: AnalyticsTrade[]): number {
    const winRate = trades.filter(t => t.profit > 0).length / trades.length;
    const avgWin = trades.filter(t => t.profit > 0).reduce((sum, t) => sum + t.profit, 0) / trades.filter(t => t.profit > 0).length;
    const avgLoss = Math.abs(trades.filter(t => t.profit <= 0).reduce((sum, t) => sum + t.profit, 0) / trades.filter(t => t.profit <= 0).length);
    
    if (avgLoss === 0) return 0;
    
    return winRate - ((1 - winRate) * (avgWin / avgLoss));
  }

  /**
   * Calculate win rate stability
   */
  private calculateWinRateStability(trades: AnalyticsTrade[]): number {
    const monthlyData = this.calculateMonthlyPerformance(trades);
    if (monthlyData.length < 2) return 0;
    
    const winRates = monthlyData.map(m => m.winRate);
    const avgWinRate = winRates.reduce((sum, wr) => sum + wr, 0) / winRates.length;
    const variance = winRates.reduce((sum, wr) => sum + Math.pow(wr - avgWinRate, 2), 0) / winRates.length;
    const stdDev = Math.sqrt(variance);
    
    return Math.max(0, 100 - stdDev);
  }

  /**
   * Calculate profit consistency
   */
  private calculateProfitConsistency(trades: AnalyticsTrade[]): number {
    const monthlyData = this.calculateMonthlyPerformance(trades);
    if (monthlyData.length < 2) return 0;
    
    const profits = monthlyData.map(m => m.profit);
    const profitableMonths = profits.filter(p => p > 0).length;
    return (profitableMonths / profits.length) * 100;
  }

  /**
   * Calculate trades per period
   */
  private calculateTradesPerPeriod(trades: AnalyticsTrade[], period: 'day' | 'week' | 'month'): number {
    if (trades.length === 0) return 0;
    
    const firstTrade = trades.reduce((earliest, trade) => 
      trade.entryTime < earliest.entryTime ? trade : earliest
    );
    const lastTrade = trades.reduce((latest, trade) => 
      trade.entryTime > latest.entryTime ? trade : latest
    );
    
    const diffMs = lastTrade.entryTime.getTime() - firstTrade.entryTime.getTime();
    const periods = {
      day: diffMs / (1000 * 60 * 60 * 24),
      week: diffMs / (1000 * 60 * 60 * 24 * 7),
      month: diffMs / (1000 * 60 * 60 * 24 * 30)
    };
    
    return trades.length / periods[period];
  }

  /**
   * Find best performing day
   */
  private findBestDay(trades: AnalyticsTrade[]): string {
    const profitsByDay = this.groupProfitsByDay(trades);
    return Object.entries(profitsByDay).reduce((best, [day, profit]) => 
      profit > best.profit ? { day, profit } : best, { day: '', profit: -Infinity }
    ).day;
  }

  /**
   * Find worst performing day
   */
  private findWorstDay(trades: AnalyticsTrade[]): string {
    const profitsByDay = this.groupProfitsByDay(trades);
    return Object.entries(profitsByDay).reduce((worst, [day, profit]) => 
      profit < worst.profit ? { day, profit } : worst, { day: '', profit: Infinity }
    ).day;
  }

  /**
   * Find best performing month
   */
  private findBestMonth(trades: AnalyticsTrade[]): string {
    const profitsByMonth = this.groupProfitsByMonth(trades);
    return Object.entries(profitsByMonth).reduce((best, [month, profit]) => 
      profit > best.profit ? { month, profit } : best, { month: '', profit: -Infinity }
    ).month;
  }

  /**
   * Find worst performing month
   */
  private findWorstMonth(trades: AnalyticsTrade[]): string {
    const profitsByMonth = this.groupProfitsByMonth(trades);
    return Object.entries(profitsByMonth).reduce((worst, [month, profit]) => 
      profit < worst.profit ? { month, profit } : worst, { month: '', profit: Infinity }
    ).month;
  }

  /**
   * Group profits by day of week
   */
  private groupProfitsByDay(trades: AnalyticsTrade[]): Record<string, number> {
    const profitsByDay: Record<string, number> = {};
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    days.forEach(day => profitsByDay[day] = 0);
    
    trades.forEach(trade => {
      const day = trade.entryTime.toLocaleDateString('en-US', { weekday: 'long' });
      profitsByDay[day] += trade.profit;
    });
    
    return profitsByDay;
  }

  /**
   * Group profits by month
   */
  private groupProfitsByMonth(trades: AnalyticsTrade[]): Record<string, number> {
    const profitsByMonth: Record<string, number> = {};
    
    trades.forEach(trade => {
      const month = trade.entryTime.toISOString().slice(0, 7); // YYYY-MM
      profitsByMonth[month] = (profitsByMonth[month] || 0) + trade.profit;
    });
    
    return profitsByMonth;
  }

  /**
   * Calculate average win rate from array
   */
  private calculateAverageWinRate(winRates: number[]): number {
    return winRates.length > 0 ? winRates.reduce((sum, wr) => sum + wr, 0) / winRates.length : 0;
  }

  /**
   * Calculate quarterly win rate
   */
  private calculateQuarterlyWinRate(monthlyData: MonthlyPerformanceData[]): number {
    const quarterlyData: Record<string, { wins: number; total: number }> = {};
    
    monthlyData.forEach(month => {
      const monthDate = new Date(month.year, this.getMonthFromString(month.month) - 1);
      const quarter = Math.floor((month.year * 12 + monthDate.getMonth()) / 3);
      if (!quarterlyData[quarter]) {
        quarterlyData[quarter] = { wins: 0, total: 0 };
      }
      quarterlyData[quarter].wins += (month.winRate / 100) * month.trades;
      quarterlyData[quarter].total += month.trades;
    });
    
    const quarterlyWinRates = Object.values(quarterlyData).map(q => 
      q.total > 0 ? (q.wins / q.total) * 100 : 0
    );
    
    return this.calculateAverageWinRate(quarterlyWinRates);
  }

  /**
   * Calculate yearly win rate
   */
  private calculateYearlyWinRate(monthlyData: MonthlyPerformanceData[]): number {
    const yearlyData: Record<number, { wins: number; total: number }> = {};
    
    monthlyData.forEach(month => {
      if (!yearlyData[month.year]) {
        yearlyData[month.year] = { wins: 0, total: 0 };
      }
      yearlyData[month.year].wins += (month.winRate / 100) * month.trades;
      yearlyData[month.year].total += month.trades;
    });
    
    const yearlyWinRates = Object.values(yearlyData).map(y => 
      y.total > 0 ? (y.wins / y.total) * 100 : 0
    );
    
    return this.calculateAverageWinRate(yearlyWinRates);
  }

  /**
   * Calculate equity curve
   */
  private calculateEquityCurve(trades: AnalyticsTrade[]): EquityPoint[] {
    const sortedTrades = trades
      .filter(t => t.exitTime)
      .sort((a, b) => a.exitTime!.getTime() - b.exitTime!.getTime());
    
    const equityCurve: EquityPoint[] = [];
    let currentEquity = this.initialBalance;
    
    // Add initial point
    equityCurve.push({
      timestamp: sortedTrades[0]?.entryTime || new Date(),
      equity: currentEquity,
      date: sortedTrades[0]?.entryTime.toLocaleDateString() || new Date().toLocaleDateString()
    });
    
    sortedTrades.forEach(trade => {
      currentEquity += trade.profit;
      equityCurve.push({
        timestamp: trade.exitTime!,
        equity: currentEquity,
        date: trade.exitTime!.toLocaleDateString(),
        profit: trade.profit
      });
    });
    
    return equityCurve;
  }

  /**
   * Calculate monthly performance
   */
  private calculateMonthlyPerformance(trades: AnalyticsTrade[]): MonthlyPerformanceData[] {
    const tradesByMonth = groupTradesByMonth(trades);
    const monthlyData: MonthlyPerformanceData[] = [];
    
    tradesByMonth.forEach((monthTrades, monthStr) => {
      const profit = monthTrades.reduce((sum, t) => sum + t.profit, 0);
      const winningTrades = monthTrades.filter(t => t.profit > 0);
      const winRate = monthTrades.length > 0 ? (winningTrades.length / monthTrades.length) * 100 : 0;
      
      const [year, month] = monthStr.split('-').map(Number);
      const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      monthlyData.push({
        month: monthStr,
        year,
        profit,
        profitPercent: (profit / this.initialBalance) * 100,
        trades: monthTrades.length,
        winRate,
        maxDrawdown: 0, // Will be calculated separately
        sharpeRatio: 0, // Will be calculated separately
        profitFactor: 0, // Will be calculated separately
        averageWin: 0, // Will be calculated separately
        averageLoss: 0 // Will be calculated separately
      });
    });
    
    return monthlyData.sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Calculate drawdown periods
   */
  private calculateDrawdownPeriods(equityCurve: EquityPoint[]): DrawdownPeriod[] {
    const drawdownPeriods: DrawdownPeriod[] = [];
    let peak = equityCurve[0]?.equity || this.initialBalance;
    let drawdownStart: EquityPoint | null = null;
    let maxDrawdown = 0;
    let id = 1;
    
    for (let i = 1; i < equityCurve.length; i++) {
      const point = equityCurve[i];
      
      if (point.equity > peak) {
        // New peak, check if we were in a drawdown
        if (drawdownStart) {
          const depth = peak - drawdownStart.equity;
          const depthPercent = (depth / peak) * 100;
          
          drawdownPeriods.push({
            id: `dd_${id++}`,
            startTime: drawdownStart.timestamp,
            endTime: point.timestamp,
            startEquity: drawdownStart.equity,
            endEquity: point.equity,
            depth,
            depthPercent,
            duration: (point.timestamp.getTime() - drawdownStart.timestamp.getTime()) / (1000 * 60 * 60 * 24),
            recovered: true,
            recoveryTime: (point.timestamp.getTime() - drawdownStart.timestamp.getTime()) / (1000 * 60 * 60 * 24)
          });
          
          drawdownStart = null;
        }
        peak = point.equity;
      } else {
        // We're in a drawdown
        const currentDrawdown = peak - point.equity;
        if (currentDrawdown > 0) {
          if (!drawdownStart) {
            drawdownStart = point;
          }
          maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
        }
      }
    }
    
    // Handle ongoing drawdown
    if (drawdownStart) {
      const depth = peak - drawdownStart.equity;
      const depthPercent = (depth / peak) * 100;
      
      drawdownPeriods.push({
        id: `dd_${id++}`,
        startTime: drawdownStart.timestamp,
        startEquity: drawdownStart.equity,
        endEquity: equityCurve[equityCurve.length - 1].equity,
        depth,
        depthPercent,
        duration: (new Date().getTime() - drawdownStart.timestamp.getTime()) / (1000 * 60 * 60 * 24),
        recovered: false
      });
    }
    
    return drawdownPeriods;
  }

  /**
   * Calculate symbol performance
   */
  private calculateSymbolPerformance(symbol: string, trades: AnalyticsTrade[]): SymbolPerformanceData {
    const profit = trades.reduce((sum, t) => sum + t.profit, 0);
    const winningTrades = trades.filter(t => t.profit > 0);
    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
    
    const totalWin = winningTrades.reduce((sum, t) => sum + t.profit, 0);
    const totalLoss = Math.abs(trades.filter(t => t.profit <= 0).reduce((sum, t) => sum + t.profit, 0));
    const profitFactor = totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0;
    
    const averageWin = winningTrades.length > 0 ? totalWin / winningTrades.length : 0;
    const averageLoss = trades.filter(t => t.profit <= 0).length > 0 
      ? totalLoss / trades.filter(t => t.profit <= 0).length 
      : 0;
    
    return {
      symbol,
      trades: trades.length,
      winRate,
      profit,
      profitPercent: (profit / this.initialBalance) * 100,
      profitFactor,
      averageWin,
      averageLoss,
      sharpeRatio: this.calculateSortinoRatio(trades), // Simplified
      maxDrawdown: 0 // Would need equity curve per symbol
    };
  }

  /**
   * Calculate timeframe performance
   */
  private calculateTimeframePerformance(trades: AnalyticsTrade[]): TimeframePerformanceData[] {
    const timeframes = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'];
    return timeframes.map(timeframe => {
      // In a real implementation, you'd filter trades by timeframe
      // For now, return empty data
      return {
        timeframe,
        trades: 0,
        winRate: 0,
        profit: 0,
        profitPercent: 0,
        profitFactor: 0,
        averageWin: 0,
        averageLoss: 0,
        sharpeRatio: 0,
        maxDrawdown: 0
      };
    });
  }

  /**
   * Calculate strategy score
   */
  private calculateStrategyScore(metrics: PerformanceMetrics): StrategyScore {
    const profitability = Math.min(100, (metrics.totalProfitPercent / 10) * 20); // 20% weight
    const consistency = metrics.winRateStability; // 20% weight
    const riskAdjusted = Math.min(100, (metrics.sharpeRatio / 2) * 30); // 30% weight
    const drawdown = Math.max(0, 100 - (metrics.maxDrawdownPercent * 2)); // 30% weight
    
    const overall = (profitability * 0.2) + (consistency * 0.2) + (riskAdjusted * 0.3) + (drawdown * 0.3);
    
    const recommendations: string[] = [];
    const warnings: string[] = [];
    
    if (metrics.winRate < 40) {
      warnings.push('Low win rate detected');
      recommendations.push('Consider reviewing entry criteria');
    }
    
    if (metrics.maxDrawdownPercent > 20) {
      warnings.push('High drawdown risk');
      recommendations.push('Reduce position sizes or improve stop loss');
    }
    
    if (metrics.sharpeRatio < 1) {
      warnings.push('Low risk-adjusted returns');
      recommendations.push('Focus on improving reward-to-risk ratio');
    }
    
    if (metrics.profitFactor < 1.5) {
      warnings.push('Low profit factor');
      recommendations.push('Improve exit strategy');
    }
    
    return {
      profitability,
      consistency,
      riskAdjusted,
      drawdown,
      overall,
      recommendations,
      warnings
    };
  }

  /**
   * Apply filters to trades
   */
  private applyFilters(trades: AnalyticsTrade[], filters?: AnalyticsFilters): AnalyticsTrade[] {
    if (!filters) return trades;
    
    return trades.filter(trade => {
      // Time filter
      if (filters.dateRange) {
        if (trade.entryTime < filters.dateRange.start || trade.entryTime > filters.dateRange.end) {
          return false;
        }
      }
      
      // Strategy filter
      if (filters.strategies.length > 0 && !filters.strategies.includes(trade.strategyId)) {
        return false;
      }
      
      // Symbol filter
      if (filters.symbols.length > 0 && !filters.symbols.includes(trade.symbol)) {
        return false;
      }
      
      // Trade type filter
      if (filters.tradeType && filters.tradeType !== 'ALL') {
        if (filters.tradeType === 'BUY' && trade.direction !== 'BUY') return false;
        if (filters.tradeType === 'SELL' && trade.direction !== 'SELL') return false;
      }
      
      // Profit filter
      if (filters.minProfit !== undefined && trade.profit < filters.minProfit) return false;
      if (filters.maxProfit !== undefined && trade.profit > filters.maxProfit) return false;
      
      return true;
    });
  }

  /**
   * Get empty metrics
   */
  private getEmptyMetrics(): PerformanceMetrics {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalProfit: 0,
      totalProfitPercent: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      profitFactor: 0,
      averageWin: 0,
      averageLoss: 0,
      averageTrade: 0,
      largestWin: 0,
      largestLoss: 0,
      averageHoldingTime: 0,
      expectancy: 0,
      recoveryFactor: 0,
      var95: 0,
      cvar95: 0,
      riskOfRuin: 0,
      kellyCriterion: 0,
      monthlyWinRate: 0,
      quarterlyWinRate: 0,
      yearlyWinRate: 0,
      winRateStability: 0,
      profitConsistency: 0,
      tradesPerMonth: 0,
      tradesPerWeek: 0,
      tradesPerDay: 0,
      bestDay: '',
      worstDay: '',
      bestMonth: '',
      worstMonth: ''
    };
  }

  /**
   * Normal cumulative distribution function
   */
  private normalCDF(x: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - prob : prob;
  }

  /**
   * Process real-time performance data
   */
  async processRealTimePerformance(
    openPositions: OpenPositionData[],
    closedTradesToday: TradeData[],
    currentEquity: number
  ): Promise<RealTimePerformanceData> {
    const dailyPnL = closedTradesToday.reduce((sum, trade) => sum + trade.profit, 0) +
                     openPositions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
    
    const dailyDrawdown = this.calculateDailyDrawdown(currentEquity, dailyPnL);
    
    const marketStatus = await this.getMarketStatus();
    
    const alerts = this.generatePerformanceAlerts({
      dailyPnL,
      dailyDrawdown,
      openPositions: openPositions.length,
      closedTrades: closedTradesToday.length
    });
    
    return {
      timestamp: new Date(),
      openPositions,
      closedTradesToday,
      currentEquity,
      dailyPnL,
      dailyDrawdown,
      activeStrategies: [...new Set(openPositions.map(p => p.strategyId))],
      marketStatus,
      alerts
    };
  }

  /**
   * Calculate daily drawdown
   */
  private calculateDailyDrawdown(currentEquity: number, dailyPnL: number): number {
    const startOfDayEquity = currentEquity - dailyPnL;
    return startOfDayEquity > 0 ? ((startOfDayEquity - currentEquity) / startOfDayEquity) * 100 : 0;
  }

  /**
   * Get market status
   */
  private async getMarketStatus(): Promise<MarketStatus> {
    const now = new Date();
    const hour = now.getUTCHours();
    const day = now.getUTCDay();
    
    // Simple market session detection
    let session: MarketStatus['session'] = 'closed';
    let isOpen = false;
    
    if (day >= 1 && day <= 5) { // Monday to Friday
      if (hour >= 22 || hour < 7) {
        session = 'sydney';
        isOpen = true;
      } else if (hour >= 0 && hour < 9) {
        session = 'tokyo';
        isOpen = true;
      } else if (hour >= 8 && hour < 17) {
        session = 'london';
        isOpen = true;
      } else if (hour >= 13 && hour < 22) {
        session = 'newyork';
        isOpen = true;
      }
    }
    
    const nextOpen = this.calculateNextOpen(now, session);
    const nextClose = this.calculateNextClose(now, session);
    
    return {
      session,
      isOpen,
      volatility: 'normal', // Would be calculated from market data
      spread: 0, // Would be fetched from market data
      nextOpen,
      nextClose
    };
  }

  /**
   * Calculate next market open time
   */
  private calculateNextOpen(now: Date, currentSession: string): Date {
    // Simplified calculation
    const nextOpen = new Date(now);
    nextOpen.setUTCHours(22, 0, 0, 0);
    if (nextOpen <= now) {
      nextOpen.setUTCDate(nextOpen.getUTCDate() + 1);
    }
    return nextOpen;
  }

  /**
   * Calculate next market close time
   */
  private calculateNextClose(now: Date, currentSession: string): Date {
    // Simplified calculation
    const nextClose = new Date(now);
    nextClose.setUTCHours(21, 0, 0, 0);
    if (nextClose <= now) {
      nextClose.setUTCDate(nextClose.getUTCDate() + 1);
    }
    return nextClose;
  }

  /**
   * Generate performance alerts
   */
  private generatePerformanceAlerts(metrics: {
    dailyPnL: number;
    dailyDrawdown: number;
    openPositions: number;
    closedTrades: number;
  }): PerformanceAlert[] {
    const alerts: PerformanceAlert[] = [];
    
    // Daily loss alert
    if (metrics.dailyPnL < -500) {
      alerts.push({
        id: `alert_${Date.now()}_daily_loss`,
        type: 'daily_loss',
        severity: metrics.dailyPnL < -1000 ? 'critical' : 'high',
        title: 'High Daily Loss',
        message: `Daily loss of $${Math.abs(metrics.dailyPnL).toFixed(2)} detected`,
        currentValue: metrics.dailyPnL,
        threshold: -500,
        triggeredAt: new Date(),
        acknowledged: false
      });
    }
    
    // Drawdown alert
    if (metrics.dailyDrawdown > 10) {
      alerts.push({
        id: `alert_${Date.now()}_drawdown`,
        type: 'drawdown',
        severity: metrics.dailyDrawdown > 20 ? 'critical' : 'medium',
        title: 'High Drawdown',
        message: `Drawdown of ${metrics.dailyDrawdown.toFixed(1)}% detected`,
        currentValue: metrics.dailyDrawdown,
        threshold: 10,
        triggeredAt: new Date(),
        acknowledged: false
      });
    }
    
    // Too many positions alert
    if (metrics.openPositions > 10) {
      alerts.push({
        id: `alert_${Date.now()}_positions`,
        type: 'position_size',
        severity: 'medium',
        title: 'High Position Count',
        message: `${metrics.openPositions} open positions detected`,
        currentValue: metrics.openPositions,
        threshold: 10,
        triggeredAt: new Date(),
        acknowledged: false
      });
    }
    
    return alerts;
  }

  /**
   * Get month number from month string
   */
  private getMonthFromString(monthStr: string): number {
    const months: Record<string, number> = {
      '01': 1, '02': 2, '03': 3, '04': 4, '05': 5, '06': 6,
      '07': 7, '08': 8, '09': 9, '10': 10, '11': 11, '12': 12,
      'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
      'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
    };
    return months[monthStr] || 1;
  }
}

// Export singleton instance
export const performanceProcessor = new PerformanceProcessor();