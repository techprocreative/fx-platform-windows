/**
 * Metrics Calculator
 * 
 * This module provides the MetricsCalculator class for calculating various performance metrics
 * including Sharpe ratio, Sortino ratio, maximum drawdown, win rate, profit factor, and more.
 */

import { 
  Trade, 
  TradeMetrics, 
  RiskAdjustedReturns, 
  DrawdownAnalysis, 
  DrawdownPeriod,
  WinRateStats,
  PerformanceCalculationOptions,
  MonthlyReturn,
  SymbolMetrics
} from './types';

export class MetricsCalculator {
  private defaultOptions: PerformanceCalculationOptions = {
    includeCommissions: true,
    includeSwap: true,
    riskFreeRate: 0.02, // 2% annual risk-free rate
    periodsPerYear: 252, // Trading days per year
    confidenceLevel: 0.95
  };

  /**
   * Calculate comprehensive trade metrics
   */
  calculateTradeMetrics(trades: Trade[], options?: PerformanceCalculationOptions): TradeMetrics {
    const opts = { ...this.defaultOptions, ...options };
    const closedTrades = trades.filter(trade => trade.status === 'CLOSED');
    
    if (closedTrades.length === 0) {
      return this.getEmptyTradeMetrics();
    }

    const profits = closedTrades.map(trade => this.calculateTradeProfit(trade, opts));
    const winningTrades = profits.filter(profit => profit > 0);
    const losingTrades = profits.filter(profit => profit < 0);
    
    const totalProfit = winningTrades.reduce((sum, profit) => sum + profit, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, profit) => sum + profit, 0));
    
    const commissionPaid = opts.includeCommissions 
      ? closedTrades.reduce((sum, trade) => sum + trade.commission, 0)
      : 0;
    
    const swapPaid = opts.includeSwap 
      ? closedTrades.reduce((sum, trade) => sum + trade.swap, 0)
      : 0;

    return {
      totalTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: (winningTrades.length / closedTrades.length) * 100,
      averageWin: winningTrades.length > 0 ? totalProfit / winningTrades.length : 0,
      averageLoss: losingTrades.length > 0 ? totalLoss / losingTrades.length : 0,
      largestWin: winningTrades.length > 0 ? Math.max(...winningTrades) : 0,
      largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades) : 0,
      averageTrade: profits.reduce((sum, profit) => sum + profit, 0) / profits.length,
      profitFactor: totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0,
      totalProfit,
      totalLoss,
      netProfit: totalProfit - totalLoss,
      commissionPaid,
      swapPaid,
      averageHoldingTime: this.calculateAverageHoldingTime(closedTrades)
    };
  }

  /**
   * Calculate risk-adjusted returns
   */
  calculateRiskAdjustedReturns(
    trades: Trade[], 
    initialBalance: number = 10000,
    options?: PerformanceCalculationOptions
  ): RiskAdjustedReturns {
    const opts = { ...this.defaultOptions, ...options };
    const closedTrades = trades.filter(trade => trade.status === 'CLOSED');
    
    if (closedTrades.length === 0) {
      return this.getEmptyRiskAdjustedReturns();
    }

    const returns = this.calculateReturns(closedTrades, initialBalance, opts);
    const riskFreeRate = opts.riskFreeRate! / opts.periodsPerYear!;

    return {
      sharpeRatio: this.calculateSharpeRatio(returns, riskFreeRate),
      sortinoRatio: this.calculateSortinoRatio(returns, riskFreeRate),
      calmarRatio: this.calculateCalmarRatio(returns, initialBalance),
      var95: this.calculateVaR(returns, opts.confidenceLevel!),
      cvar95: this.calculateCVaR(returns, opts.confidenceLevel!),
      riskOfRuin: this.calculateRiskOfRuin(closedTrades),
      kellyCriterion: this.calculateKellyCriterion(closedTrades)
    };
  }

  /**
   * Perform drawdown analysis
   */
  calculateDrawdownAnalysis(
    trades: Trade[], 
    initialBalance: number = 10000
  ): DrawdownAnalysis {
    const closedTrades = trades
      .filter(trade => trade.status === 'CLOSED')
      .sort((a, b) => a.exitTime!.getTime() - b.exitTime!.getTime());
    
    if (closedTrades.length === 0) {
      return this.getEmptyDrawdownAnalysis();
    }

    const equityCurve = this.calculateEquityCurve(closedTrades, initialBalance);
    const drawdownPeriods = this.identifyDrawdownPeriods(equityCurve);
    
    const maxDrawdownPeriod = drawdownPeriods.reduce((max, period) => 
      period.depthPercent > max.depthPercent ? period : max, 
      drawdownPeriods[0]
    );

    const currentDrawdown = this.calculateCurrentDrawdown(equityCurve);
    const averageDrawdown = drawdownPeriods.reduce((sum, period) => 
      sum + period.depthPercent, 0) / drawdownPeriods.length;
    
    const averageDrawdownDuration = drawdownPeriods.reduce((sum, period) => 
      sum + period.duration, 0) / drawdownPeriods.length;

    return {
      currentDrawdown: currentDrawdown.depth,
      currentDrawdownPercent: currentDrawdown.depthPercent,
      maxDrawdown: maxDrawdownPeriod.depth,
      maxDrawdownPercent: maxDrawdownPeriod.depthPercent,
      maxDrawdownDuration: maxDrawdownPeriod.duration,
      maxDrawdownStart: maxDrawdownPeriod.startTime,
      maxDrawdownEnd: maxDrawdownPeriod.endTime || new Date(),
      averageDrawdown,
      averageDrawdownDuration,
      drawdownPeriods,
      recoveryFactor: this.calculateRecoveryFactor(equityCurve, maxDrawdownPeriod)
    };
  }

  /**
   * Calculate win rate statistics
   */
  calculateWinRateStats(trades: Trade[]): WinRateStats {
    const closedTrades = trades.filter(trade => trade.status === 'CLOSED');
    
    if (closedTrades.length === 0) {
      return this.getEmptyWinRateStats();
    }

    const overallWinRate = (closedTrades.filter(trade => trade.profit > 0).length / closedTrades.length) * 100;
    
    const bySymbol = this.calculateWinRateBySymbol(closedTrades);
    const byMonth = this.calculateWinRateByMonth(closedTrades);
    const byDayOfWeek = this.calculateWinRateByDayOfWeek(closedTrades);
    const byHour = this.calculateWinRateByHour(closedTrades);
    
    const streaks = this.calculateWinLossStreaks(closedTrades);

    return {
      overall: overallWinRate,
      bySymbol,
      byMonth,
      byDayOfWeek,
      byHour,
      consecutiveWins: streaks.currentWinStreak,
      consecutiveLosses: streaks.currentLossStreak,
      averageWinStreak: streaks.averageWinStreak,
      averageLossStreak: streaks.averageLossStreak,
      longestWinStreak: streaks.longestWinStreak,
      longestLossStreak: streaks.longestLossStreak,
      winLossRatio: streaks.winLossRatio
    };
  }

  /**
   * Calculate monthly returns
   */
  calculateMonthlyReturns(trades: Trade[], initialBalance: number = 10000): MonthlyReturn[] {
    const closedTrades = trades
      .filter(trade => trade.status === 'CLOSED')
      .sort((a, b) => a.exitTime!.getTime() - b.exitTime!.getTime());
    
    const monthlyReturns: Map<string, { profit: number; tradesCount: number }> = new Map();
    
    closedTrades.forEach(trade => {
      const month = trade.exitTime!.toISOString().substring(0, 7); // "YYYY-MM"
      const current = monthlyReturns.get(month) || { profit: 0, tradesCount: 0 };
      monthlyReturns.set(month, {
        profit: current.profit + trade.profit,
        tradesCount: current.tradesCount + 1
      });
    });

    let runningBalance = initialBalance;
    const result: MonthlyReturn[] = [];
    
    Array.from(monthlyReturns.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([month, data]) => {
        const returnAmount = data.profit;
        const returnPercent = (returnAmount / runningBalance) * 100;
        runningBalance += returnAmount;
        
        result.push({
          month,
          return: returnAmount,
          returnPercent,
          tradesCount: data.tradesCount
        });
      });

    return result;
  }

  /**
   * Calculate symbol-specific metrics
   */
  calculateSymbolMetrics(trades: Trade[]): SymbolMetrics[] {
    const closedTrades = trades.filter(trade => trade.status === 'CLOSED');
    const symbolGroups = new Map<string, Trade[]>();
    
    closedTrades.forEach(trade => {
      const symbol = trade.symbol;
      if (!symbolGroups.has(symbol)) {
        symbolGroups.set(symbol, []);
      }
      symbolGroups.get(symbol)!.push(trade);
    });

    return Array.from(symbolGroups.entries()).map(([symbol, symbolTrades]) => {
      const metrics = this.calculateTradeMetrics(symbolTrades);
      return {
        symbol,
        tradesCount: metrics.totalTrades,
        winRate: metrics.winRate,
        netProfit: metrics.netProfit,
        profitFactor: metrics.profitFactor,
        averageWin: metrics.averageWin,
        averageLoss: metrics.averageLoss
      };
    });
  }

  // Private helper methods

  private calculateTradeProfit(trade: Trade, options: PerformanceCalculationOptions): number {
    let profit = trade.profit;
    
    if (options.includeCommissions) {
      profit -= trade.commission;
    }
    
    if (options.includeSwap) {
      profit -= trade.swap;
    }
    
    return profit;
  }

  private calculateAverageHoldingTime(trades: Trade[]): number {
    if (trades.length === 0) return 0;
    
    const totalHoldingTime = trades.reduce((sum, trade) => {
      if (trade.exitTime) {
        return sum + (trade.exitTime.getTime() - trade.entryTime.getTime());
      }
      return sum;
    }, 0);
    
    return totalHoldingTime / trades.length / (1000 * 60 * 60); // Convert to hours
  }

  private calculateReturns(trades: Trade[], initialBalance: number, options: PerformanceCalculationOptions): number[] {
    const returns: number[] = [];
    let currentBalance = initialBalance;
    
    trades.forEach(trade => {
      const profit = this.calculateTradeProfit(trade, options);
      const returnRate = profit / currentBalance;
      returns.push(returnRate);
      currentBalance += profit;
    });
    
    return returns;
  }

  private calculateSharpeRatio(returns: number[], riskFreeRate: number): number {
    if (returns.length === 0) return 0;
    
    const excessReturns = returns.map(r => r - riskFreeRate);
    const meanExcessReturn = excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length;
    const standardDeviation = this.calculateStandardDeviation(excessReturns);
    
    return standardDeviation === 0 ? 0 : meanExcessReturn / standardDeviation;
  }

  private calculateSortinoRatio(returns: number[], riskFreeRate: number): number {
    if (returns.length === 0) return 0;
    
    const excessReturns = returns.map(r => r - riskFreeRate);
    const meanExcessReturn = excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length;
    const negativeReturns = excessReturns.filter(r => r < 0);
    const downsideDeviation = this.calculateStandardDeviation(negativeReturns);
    
    return downsideDeviation === 0 ? 0 : meanExcessReturn / downsideDeviation;
  }

  private calculateCalmarRatio(returns: number[], initialBalance: number): number {
    if (returns.length === 0) return 0;
    
    const totalReturn = returns.reduce((sum, r) => sum + r, 0);
    const annualizedReturn = totalReturn * (252 / returns.length); // Annualize
    const maxDrawdown = this.calculateMaxDrawdownFromReturns(returns);
    
    return maxDrawdown === 0 ? 0 : annualizedReturn / Math.abs(maxDrawdown);
  }

  private calculateVaR(returns: number[], confidenceLevel: number): number {
    if (returns.length === 0) return 0;
    
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidenceLevel) * sortedReturns.length);
    
    return sortedReturns[index] || 0;
  }

  private calculateCVaR(returns: number[], confidenceLevel: number): number {
    if (returns.length === 0) return 0;
    
    const varValue = this.calculateVaR(returns, confidenceLevel);
    const tailReturns = returns.filter(r => r <= varValue);
    
    if (tailReturns.length === 0) return 0;
    
    return tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;
  }

  private calculateRiskOfRuin(trades: Trade[]): number {
    const wins = trades.filter(trade => trade.profit > 0).length;
    const losses = trades.filter(trade => trade.profit < 0).length;
    const total = trades.length;
    
    if (total === 0) return 0;
    
    const winRate = wins / total;
    const avgWin = wins > 0 
      ? trades.filter(t => t.profit > 0).reduce((sum, t) => sum + t.profit, 0) / wins
      : 0;
    const avgLoss = losses > 0
      ? Math.abs(trades.filter(t => t.profit < 0).reduce((sum, t) => sum + t.profit, 0) / losses)
      : 1;
    
    if (avgLoss === 0) return 0;
    
    // Risk of ruin formula
    const z = Math.log(winRate) - Math.log(1 - winRate) - Math.log(avgWin / avgLoss);
    return winRate <= 0.5 || avgWin <= avgLoss ? 1 : Math.exp(z);
  }

  private calculateKellyCriterion(trades: Trade[]): number {
    const wins = trades.filter(trade => trade.profit > 0).length;
    const losses = trades.filter(trade => trade.profit < 0).length;
    const total = trades.length;
    
    if (total === 0) return 0;
    
    const winRate = wins / total;
    const avgWin = wins > 0 
      ? trades.filter(t => t.profit > 0).reduce((sum, t) => sum + t.profit, 0) / wins
      : 0;
    const avgLoss = losses > 0
      ? Math.abs(trades.filter(t => t.profit < 0).reduce((sum, t) => sum + t.profit, 0) / losses)
      : 1;
    
    if (avgLoss === 0) return 0;
    
    // Kelly Criterion: f* = p - q/b where p=win rate, q=loss rate, b=win/loss ratio
    return winRate - (1 - winRate) * (avgLoss / avgWin);
  }

  private calculateEquityCurve(trades: Trade[], initialBalance: number): Array<{date: Date; equity: number}> {
    const equityCurve: Array<{date: Date; equity: number}> = [];
    let currentEquity = initialBalance;
    
    // Add starting point
    if (trades.length > 0) {
      equityCurve.push({
        date: new Date(trades[0].entryTime.getTime() - 24 * 60 * 60 * 1000), // One day before first trade
        equity: currentEquity
      });
    }
    
    trades.forEach(trade => {
      currentEquity += trade.profit;
      equityCurve.push({
        date: trade.exitTime!,
        equity: currentEquity
      });
    });
    
    return equityCurve;
  }

  private identifyDrawdownPeriods(equityCurve: Array<{date: Date; equity: number}>): DrawdownPeriod[] {
    const drawdownPeriods: DrawdownPeriod[] = [];
    let peak = equityCurve[0]?.equity || 0;
    let peakDate = equityCurve[0]?.date || new Date();
    let inDrawdown = false;
    let drawdownStart: Date | null = null;
    let drawdownStartEquity = 0;
    
    for (let i = 1; i < equityCurve.length; i++) {
      const current = equityCurve[i];
      
      if (current.equity > peak) {
        // New peak reached
        if (inDrawdown) {
          // End current drawdown period
          drawdownPeriods.push({
            startTime: drawdownStart!,
            endTime: current.date,
            startEquity: drawdownStartEquity,
            endEquity: current.equity,
            depth: peak - drawdownStartEquity,
            depthPercent: ((peak - drawdownStartEquity) / peak) * 100,
            duration: (current.date.getTime() - drawdownStart!.getTime()) / (1000 * 60 * 60 * 24),
            recovered: true
          });
          inDrawdown = false;
        }
        
        peak = current.equity;
        peakDate = current.date;
      } else {
        // Drawdown condition
        if (!inDrawdown) {
          inDrawdown = true;
          drawdownStart = current.date;
          drawdownStartEquity = current.equity;
        }
      }
    }
    
    // Handle ongoing drawdown
    if (inDrawdown) {
      const lastPoint = equityCurve[equityCurve.length - 1];
      drawdownPeriods.push({
        startTime: drawdownStart!,
        endTime: undefined,
        startEquity: drawdownStartEquity,
        endEquity: lastPoint.equity,
        depth: peak - drawdownStartEquity,
        depthPercent: ((peak - drawdownStartEquity) / peak) * 100,
        duration: (lastPoint.date.getTime() - drawdownStart!.getTime()) / (1000 * 60 * 60 * 24),
        recovered: false
      });
    }
    
    return drawdownPeriods;
  }

  private calculateCurrentDrawdown(equityCurve: Array<{date: Date; equity: number}>): {depth: number; depthPercent: number} {
    if (equityCurve.length === 0) return { depth: 0, depthPercent: 0 };
    
    let peak = equityCurve[0].equity;
    let maxDrawdown = 0;
    
    for (let i = 1; i < equityCurve.length; i++) {
      const current = equityCurve[i];
      
      if (current.equity > peak) {
        peak = current.equity;
      } else {
        const drawdown = peak - current.equity;
        const drawdownPercent = (drawdown / peak) * 100;
        
        if (drawdownPercent > maxDrawdown) {
          maxDrawdown = drawdownPercent;
        }
      }
    }
    
    const currentEquity = equityCurve[equityCurve.length - 1].equity;
    const currentDrawdown = peak - currentEquity;
    const currentDrawdownPercent = (currentDrawdown / peak) * 100;
    
    return { depth: currentDrawdown, depthPercent: currentDrawdownPercent };
  }

  private calculateRecoveryFactor(equityCurve: Array<{date: Date; equity: number}>, maxDrawdown: DrawdownPeriod): number {
    if (maxDrawdown.depth === 0 || equityCurve.length === 0) return 0;
    
    const initialEquity = equityCurve[0].equity;
    const finalEquity = equityCurve[equityCurve.length - 1].equity;
    const netProfit = finalEquity - initialEquity;
    
    return netProfit / maxDrawdown.depth;
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDifferences.reduce((sum, diff) => sum + diff, 0) / values.length;
    
    return Math.sqrt(variance);
  }

  private calculateMaxDrawdownFromReturns(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    let peak = 0;
    let maxDrawdown = 0;
    let cumulativeReturn = 0;
    
    for (const returnRate of returns) {
      cumulativeReturn += returnRate;
      
      if (cumulativeReturn > peak) {
        peak = cumulativeReturn;
      } else {
        const drawdown = peak - cumulativeReturn;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }
    }
    
    return maxDrawdown;
  }

  private calculateWinRateBySymbol(trades: Trade[]): Record<string, number> {
    const symbolGroups = new Map<string, Trade[]>();
    
    trades.forEach(trade => {
      if (!symbolGroups.has(trade.symbol)) {
        symbolGroups.set(trade.symbol, []);
      }
      symbolGroups.get(trade.symbol)!.push(trade);
    });
    
    const result: Record<string, number> = {};
    
    symbolGroups.forEach((symbolTrades, symbol) => {
      const wins = symbolTrades.filter(trade => trade.profit > 0).length;
      result[symbol] = (wins / symbolTrades.length) * 100;
    });
    
    return result;
  }

  private calculateWinRateByMonth(trades: Trade[]): Record<string, number> {
    const monthGroups = new Map<string, Trade[]>();
    
    trades.forEach(trade => {
      if (trade.exitTime) {
        const month = trade.exitTime.toISOString().substring(0, 7); // "YYYY-MM"
        if (!monthGroups.has(month)) {
          monthGroups.set(month, []);
        }
        monthGroups.get(month)!.push(trade);
      }
    });
    
    const result: Record<string, number> = {};
    
    monthGroups.forEach((monthTrades, month) => {
      const wins = monthTrades.filter(trade => trade.profit > 0).length;
      result[month] = (wins / monthTrades.length) * 100;
    });
    
    return result;
  }

  private calculateWinRateByDayOfWeek(trades: Trade[]): Record<string, number> {
    const dayGroups = new Map<string, Trade[]>();
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    trades.forEach(trade => {
      if (trade.exitTime) {
        const dayOfWeek = daysOfWeek[trade.exitTime.getDay()];
        if (!dayGroups.has(dayOfWeek)) {
          dayGroups.set(dayOfWeek, []);
        }
        dayGroups.get(dayOfWeek)!.push(trade);
      }
    });
    
    const result: Record<string, number> = {};
    
    dayGroups.forEach((dayTrades, day) => {
      const wins = dayTrades.filter(trade => trade.profit > 0).length;
      result[day] = (wins / dayTrades.length) * 100;
    });
    
    return result;
  }

  private calculateWinRateByHour(trades: Trade[]): Record<string, number> {
    const hourGroups = new Map<string, Trade[]>();
    
    trades.forEach(trade => {
      if (trade.exitTime) {
        const hour = trade.exitTime.getHours().toString();
        if (!hourGroups.has(hour)) {
          hourGroups.set(hour, []);
        }
        hourGroups.get(hour)!.push(trade);
      }
    });
    
    const result: Record<string, number> = {};
    
    hourGroups.forEach((hourTrades, hour) => {
      const wins = hourTrades.filter(trade => trade.profit > 0).length;
      result[hour] = (wins / hourTrades.length) * 100;
    });
    
    return result;
  }

  private calculateWinLossStreaks(trades: Trade[]): {
    currentWinStreak: number;
    currentLossStreak: number;
    averageWinStreak: number;
    averageLossStreak: number;
    longestWinStreak: number;
    longestLossStreak: number;
    winLossRatio: number;
  } {
    const sortedTrades = trades
      .filter(trade => trade.status === 'CLOSED')
      .sort((a, b) => a.exitTime!.getTime() - b.exitTime!.getTime());
    
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let longestWinStreak = 0;
    let longestLossStreak = 0;
    let totalWinStreaks = 0;
    let totalLossStreaks = 0;
    let sumWinStreaks = 0;
    let sumLossStreaks = 0;
    
    // Determine current streaks from the end
    for (let i = sortedTrades.length - 1; i >= 0; i--) {
      const trade = sortedTrades[i];
      
      if (trade.profit > 0) {
        if (currentLossStreak > 0) break;
        currentWinStreak++;
      } else {
        if (currentWinStreak > 0) break;
        currentLossStreak++;
      }
    }
    
    // Calculate all streaks
    let currentStreak = 0;
    let isWinStreak = false;
    
    for (const trade of sortedTrades) {
      if (trade.profit > 0) {
        if (isWinStreak) {
          currentStreak++;
        } else {
          if (currentStreak > 0) {
            totalLossStreaks++;
            sumLossStreaks += currentStreak;
            longestLossStreak = Math.max(longestLossStreak, currentStreak);
          }
          currentStreak = 1;
          isWinStreak = true;
        }
      } else {
        if (!isWinStreak) {
          currentStreak++;
        } else {
          totalWinStreaks++;
          sumWinStreaks += currentStreak;
          longestWinStreak = Math.max(longestWinStreak, currentStreak);
          currentStreak = 1;
          isWinStreak = false;
        }
      }
    }
    
    // Handle the last streak
    if (currentStreak > 0) {
      if (isWinStreak) {
        totalWinStreaks++;
        sumWinStreaks += currentStreak;
        longestWinStreak = Math.max(longestWinStreak, currentStreak);
      } else {
        totalLossStreaks++;
        sumLossStreaks += currentStreak;
        longestLossStreak = Math.max(longestLossStreak, currentStreak);
      }
    }
    
    return {
      currentWinStreak,
      currentLossStreak,
      averageWinStreak: totalWinStreaks > 0 ? sumWinStreaks / totalWinStreaks : 0,
      averageLossStreak: totalLossStreaks > 0 ? sumLossStreaks / totalLossStreaks : 0,
      longestWinStreak,
      longestLossStreak,
      winLossRatio: longestLossStreak > 0 ? longestWinStreak / longestLossStreak : 
                 longestWinStreak > 0 ? Infinity : 0
    };
  }

  // Empty/default return methods
  private getEmptyTradeMetrics(): TradeMetrics {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      averageWin: 0,
      averageLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      averageTrade: 0,
      profitFactor: 0,
      totalProfit: 0,
      totalLoss: 0,
      netProfit: 0,
      averageHoldingTime: 0,
      commissionPaid: 0,
      swapPaid: 0
    };
  }

  private getEmptyRiskAdjustedReturns(): RiskAdjustedReturns {
    return {
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      var95: 0,
      cvar95: 0,
      riskOfRuin: 0,
      kellyCriterion: 0
    };
  }

  private getEmptyDrawdownAnalysis(): DrawdownAnalysis {
    return {
      currentDrawdown: 0,
      currentDrawdownPercent: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      maxDrawdownDuration: 0,
      maxDrawdownStart: new Date(),
      maxDrawdownEnd: new Date(),
      averageDrawdown: 0,
      averageDrawdownDuration: 0,
      drawdownPeriods: [],
      recoveryFactor: 0
    };
  }

  private getEmptyWinRateStats(): WinRateStats {
    return {
      overall: 0,
      bySymbol: {},
      byMonth: {},
      byDayOfWeek: {},
      byHour: {},
      consecutiveWins: 0,
      consecutiveLosses: 0,
      averageWinStreak: 0,
      averageLossStreak: 0,
      longestWinStreak: 0,
      longestLossStreak: 0,
      winLossRatio: 0
    };
  }
}