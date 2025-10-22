/**
 * Analytics Service
 * 
 * Provides analytics calculations for both real trades and backtests
 */

import { Trade as AnalyticsTrade } from './types';
import { BacktestResults } from '@/types/backtest';
import { filterClosedTrades, groupTradesByMonth, groupTradesByStrategy } from './adapters';

export interface MonthlyPerformance {
  month: string;
  profit: number;
  trades: number;
  winRate: number;
}

export interface StrategyPerformance {
  strategyId: string;
  name: string;
  profit: number;
  winRate: number;
  trades: number;
  profitFactor: number;
  averageProfit: number;
}

export interface EquityPoint {
  timestamp: string;
  equity: number;
  date: string;
}

export interface AnalyticsData {
  // Overall metrics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalProfit: number;
  winRate: number;
  profitFactor: number;
  
  // Risk metrics
  maxDrawdown: number;
  maxDrawdownPercent: number;
  
  // Trade metrics
  averageWin: number;
  averageLoss: number;
  averageTrade: number;
  sharpeRatio: number;
  
  // Breakdown
  monthlyData: MonthlyPerformance[];
  strategyPerformance: StrategyPerformance[];
  
  // Equity curve for charts
  equityCurve: EquityPoint[];
  
  // Source tracking
  source: 'trades' | 'backtests' | 'combined';
}

/**
 * Calculate analytics from real trades
 */
export function calculateTradeAnalytics(
  trades: AnalyticsTrade[],
  initialBalance: number = 10000
): AnalyticsData {
  const closedTrades = filterClosedTrades(trades);
  const totalTrades = closedTrades.length;
  
  if (totalTrades === 0) {
    return createEmptyAnalytics('trades');
  }
  
  // Basic metrics
  const winningTrades = closedTrades.filter(t => t.profit > 0);
  const losingTrades = closedTrades.filter(t => t.profit <= 0);
  
  const totalProfit = closedTrades.reduce((sum, t) => sum + t.profit, 0);
  const winRate = (winningTrades.length / totalTrades) * 100;
  
  // Win/Loss metrics
  const totalWinAmount = winningTrades.reduce((sum, t) => sum + t.profit, 0);
  const totalLossAmount = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));
  
  const averageWin = winningTrades.length > 0 ? totalWinAmount / winningTrades.length : 0;
  const averageLoss = losingTrades.length > 0 ? totalLossAmount / losingTrades.length : 0;
  const averageTrade = totalProfit / totalTrades;
  
  const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount > 0 ? Infinity : 0;
  
  // Drawdown calculation
  const { maxDrawdown, maxDrawdownPercent } = calculateDrawdown(closedTrades, initialBalance);
  
  // Sharpe ratio
  const sharpeRatio = calculateSharpeRatio(closedTrades, initialBalance);
  
  // Monthly breakdown
  const monthlyData = calculateMonthlyPerformance(closedTrades);
  
  // Equity curve
  const equityCurve = calculateEquityCurve(closedTrades, initialBalance);
  
  // Strategy performance - will be empty here, calculated separately
  const strategyPerformance: StrategyPerformance[] = [];
  
  return {
    totalTrades,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    totalProfit,
    winRate,
    profitFactor,
    maxDrawdown,
    maxDrawdownPercent,
    averageWin,
    averageLoss,
    averageTrade,
    sharpeRatio,
    monthlyData,
    strategyPerformance,
    equityCurve,
    source: 'trades',
  };
}

/**
 * Calculate analytics from backtest results
 */
export function calculateBacktestAnalytics(
  backtests: Array<{ results: any; strategyId: string; createdAt: Date }>
): AnalyticsData {
  if (backtests.length === 0) {
    return createEmptyAnalytics('backtests');
  }
  
  let totalTrades = 0;
  let winningBacktests = 0;
  let losingBacktests = 0;
  let totalReturn = 0;
  let totalWinAmount = 0;
  let totalLossAmount = 0;
  let maxDrawdownSum = 0;
  
  backtests.forEach(backtest => {
    const results = backtest.results as BacktestResults | null;
    if (results) {
      totalTrades += results.totalTrades || 0;
      totalReturn += results.totalReturn || 0;
      
      if ((results.returnPercentage || 0) > 0) {
        winningBacktests++;
        totalWinAmount += Math.abs(results.totalReturn || 0);
      } else {
        losingBacktests++;
        totalLossAmount += Math.abs(results.totalReturn || 0);
      }
      
      maxDrawdownSum += results.maxDrawdownPercent || 0;
    }
  });
  
  const winRate = backtests.length > 0 ? (winningBacktests / backtests.length) * 100 : 0;
  const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount > 0 ? Infinity : 0;
  const averageWin = winningBacktests > 0 ? totalWinAmount / winningBacktests : 0;
  const averageLoss = losingBacktests > 0 ? totalLossAmount / losingBacktests : 0;
  const averageReturn = backtests.length > 0 ? totalReturn / backtests.length : 0;
  const avgDrawdown = backtests.length > 0 ? maxDrawdownSum / backtests.length : 0;
  
  // For backtests, monthly data would be the backtest execution dates
  const monthlyData: MonthlyPerformance[] = [];
  
  // Equity curve for backtests (simplified - just show final results)
  const equityCurve: EquityPoint[] = backtests.map(backtest => {
    const results = backtest.results as BacktestResults | null;
    return {
      timestamp: backtest.createdAt.toISOString(),
      equity: results?.finalBalance || 0,
      date: backtest.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  });
  
  return {
    totalTrades,
    winningTrades: winningBacktests,
    losingTrades: losingBacktests,
    totalProfit: totalReturn,
    winRate,
    profitFactor,
    maxDrawdown: avgDrawdown,
    maxDrawdownPercent: avgDrawdown,
    averageWin,
    averageLoss,
    averageTrade: averageReturn,
    sharpeRatio: 0, // Would need to calculate from backtest equity curves
    monthlyData,
    strategyPerformance: [],
    equityCurve,
    source: 'backtests',
  };
}

/**
 * Calculate strategy performance from trades
 */
export function calculateStrategyPerformance(
  trades: AnalyticsTrade[],
  strategyNames: Map<string, string>
): StrategyPerformance[] {
  const closedTrades = filterClosedTrades(trades);
  const grouped = groupTradesByStrategy(closedTrades);
  
  const performance: StrategyPerformance[] = [];
  
  grouped.forEach((strategyTrades, strategyId) => {
    const stats = calculateBasicStrategyStats(strategyTrades);
    
    performance.push({
      strategyId,
      name: strategyNames.get(strategyId) || 'Unknown Strategy',
      profit: stats.totalProfit,
      winRate: stats.winRate,
      trades: stats.totalTrades,
      profitFactor: stats.profitFactor,
      averageProfit: stats.averageProfit,
    });
  });
  
  // Sort by profit (highest first)
  return performance.sort((a, b) => b.profit - a.profit);
}

/**
 * Calculate monthly performance from trades
 */
function calculateMonthlyPerformance(trades: AnalyticsTrade[]): MonthlyPerformance[] {
  const grouped = groupTradesByMonth(trades);
  const monthly: MonthlyPerformance[] = [];
  
  grouped.forEach((monthTrades, month) => {
    const profit = monthTrades.reduce((sum, t) => sum + t.profit, 0);
    const winning = monthTrades.filter(t => t.profit > 0).length;
    const winRate = monthTrades.length > 0 ? (winning / monthTrades.length) * 100 : 0;
    
    // Format month as "MMM YYYY"
    const date = new Date(month + '-01');
    const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    
    monthly.push({
      month: monthName,
      profit,
      trades: monthTrades.length,
      winRate,
    });
  });
  
  // Sort by month
  return monthly.sort((a, b) => {
    const dateA = new Date(a.month);
    const dateB = new Date(b.month);
    return dateA.getTime() - dateB.getTime();
  });
}

/**
 * Calculate drawdown from trades
 */
function calculateDrawdown(
  trades: AnalyticsTrade[],
  initialBalance: number
): { maxDrawdown: number; maxDrawdownPercent: number } {
  if (trades.length === 0) {
    return { maxDrawdown: 0, maxDrawdownPercent: 0 };
  }
  
  let balance = initialBalance;
  let peakBalance = initialBalance;
  let maxDrawdown = 0;
  
  // Sort trades by exit time
  const sortedTrades = [...trades].sort((a, b) => {
    if (!a.exitTime || !b.exitTime) return 0;
    return a.exitTime.getTime() - b.exitTime.getTime();
  });
  
  sortedTrades.forEach(trade => {
    balance += trade.profit;
    
    if (balance > peakBalance) {
      peakBalance = balance;
    }
    
    const drawdown = peakBalance - balance;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });
  
  const maxDrawdownPercent = peakBalance > 0 ? (maxDrawdown / peakBalance) * 100 : 0;
  
  return { maxDrawdown, maxDrawdownPercent };
}

/**
 * Calculate Sharpe ratio from trades
 */
function calculateSharpeRatio(
  trades: AnalyticsTrade[],
  initialBalance: number,
  riskFreeRate: number = 0.02, // 2% annual
  periodsPerYear: number = 252 // Trading days
): number {
  if (trades.length < 2) {
    return 0;
  }
  
  // Calculate returns for each trade
  const returns: number[] = [];
  let balance = initialBalance;
  
  // Sort trades by exit time
  const sortedTrades = [...trades].sort((a, b) => {
    if (!a.exitTime || !b.exitTime) return 0;
    return a.exitTime.getTime() - b.exitTime.getTime();
  });
  
  sortedTrades.forEach(trade => {
    const returnRate = balance > 0 ? trade.profit / balance : 0;
    returns.push(returnRate);
    balance += trade.profit;
  });
  
  if (returns.length === 0) {
    return 0;
  }
  
  // Calculate average return
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  
  // Calculate excess returns (returns - risk-free rate)
  const dailyRiskFreeRate = riskFreeRate / periodsPerYear;
  const excessReturns = returns.map(r => r - dailyRiskFreeRate);
  
  // Calculate standard deviation of excess returns
  const avgExcessReturn = excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length;
  const variance = excessReturns.reduce((sum, r) => sum + Math.pow(r - avgExcessReturn, 2), 0) / excessReturns.length;
  const stdDev = Math.sqrt(variance);
  
  // Calculate Sharpe ratio
  if (stdDev === 0) {
    return avgExcessReturn > 0 ? Infinity : 0;
  }
  
  const sharpeRatio = (avgExcessReturn / stdDev) * Math.sqrt(periodsPerYear);
  
  return sharpeRatio;
}

/**
 * Calculate basic strategy statistics
 */
function calculateBasicStrategyStats(trades: AnalyticsTrade[]) {
  const totalTrades = trades.length;
  
  if (totalTrades === 0) {
    return {
      totalTrades: 0,
      winRate: 0,
      totalProfit: 0,
      profitFactor: 0,
      averageProfit: 0,
    };
  }
  
  const winningTrades = trades.filter(t => t.profit > 0);
  const losingTrades = trades.filter(t => t.profit <= 0);
  
  const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0);
  const totalWinAmount = winningTrades.reduce((sum, t) => sum + t.profit, 0);
  const totalLossAmount = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));
  
  const winRate = (winningTrades.length / totalTrades) * 100;
  const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount > 0 ? Infinity : 0;
  const averageProfit = totalProfit / totalTrades;
  
  return {
    totalTrades,
    winRate,
    totalProfit,
    profitFactor,
    averageProfit,
  };
}

/**
 * Calculate equity curve from trades
 */
function calculateEquityCurve(
  trades: AnalyticsTrade[],
  initialBalance: number
): EquityPoint[] {
  if (trades.length === 0) {
    return [{
      timestamp: new Date().toISOString(),
      equity: initialBalance,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }];
  }
  
  const equityCurve: EquityPoint[] = [];
  let balance = initialBalance;
  
  // Add initial point
  equityCurve.push({
    timestamp: trades[0].entryTime.toISOString(),
    equity: initialBalance,
    date: trades[0].entryTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  });
  
  // Sort trades by exit time
  const sortedTrades = [...trades]
    .filter(t => t.exitTime)
    .sort((a, b) => {
      if (!a.exitTime || !b.exitTime) return 0;
      return a.exitTime.getTime() - b.exitTime.getTime();
    });
  
  // Calculate equity after each trade
  sortedTrades.forEach(trade => {
    balance += trade.profit;
    
    if (trade.exitTime) {
      equityCurve.push({
        timestamp: trade.exitTime.toISOString(),
        equity: balance,
        date: trade.exitTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      });
    }
  });
  
  return equityCurve;
}

/**
 * Create empty analytics data
 */
function createEmptyAnalytics(source: 'trades' | 'backtests' | 'combined'): AnalyticsData {
  return {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    totalProfit: 0,
    winRate: 0,
    profitFactor: 0,
    maxDrawdown: 0,
    maxDrawdownPercent: 0,
    averageWin: 0,
    averageLoss: 0,
    averageTrade: 0,
    sharpeRatio: 0,
    monthlyData: [],
    strategyPerformance: [],
    equityCurve: [],
    source,
  };
}

/**
 * Combine trade and backtest analytics intelligently
 */
export function combineAnalytics(
  tradeAnalytics: AnalyticsData,
  backtestAnalytics: AnalyticsData
): AnalyticsData {
  // For now, prioritize real trades if available
  // In the future, we might want more sophisticated combining logic
  if (tradeAnalytics.totalTrades > 0) {
    return { ...tradeAnalytics, source: 'combined' };
  }
  
  return { ...backtestAnalytics, source: 'combined' };
}
