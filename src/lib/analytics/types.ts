/**
 * Performance Analytics Types
 * 
 * This file contains all the type definitions for the performance analytics system.
 * It includes interfaces for trade metrics, strategy metrics, risk-adjusted returns,
 * drawdown analysis, win rate statistics, and performance reports.
 */

// Base types for trade data
export interface Trade {
  id: string;
  strategyId: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice?: number;
  entryTime: Date;
  exitTime?: Date;
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
  commission: number;
  swap: number;
  profit: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  tags?: string[];
}

// Trade metrics interface
export interface TradeMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  averageTrade: number;
  profitFactor: number;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  averageHoldingTime: number; // in hours
  commissionPaid: number;
  swapPaid: number;
}

// Strategy metrics interface
export interface StrategyMetrics {
  strategyId: string;
  strategyName: string;
  totalTrades: number;
  winRate: number;
  netProfit: number;
  netProfitPercent: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  averageWin: number;
  averageLoss: number;
  recoveryFactor: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  averageHoldingTime: number;
  monthlyReturns: MonthlyReturn[];
  tradesBySymbol: SymbolMetrics[];
  tradesByMonth: MonthlyMetrics[];
}

// Monthly return data
export interface MonthlyReturn {
  month: string; // Format: "YYYY-MM"
  return: number;
  returnPercent: number;
  tradesCount: number;
}

// Symbol-specific metrics
export interface SymbolMetrics {
  symbol: string;
  tradesCount: number;
  winRate: number;
  netProfit: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
}

// Monthly metrics
export interface MonthlyMetrics {
  month: string;
  tradesCount: number;
  winRate: number;
  netProfit: number;
  maxDrawdown: number;
}

// Risk-adjusted returns interface
export interface RiskAdjustedReturns {
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  informationRatio?: number;
  beta?: number;
  alpha?: number;
  treynorRatio?: number;
  var95?: number; // Value at Risk at 95% confidence
  cvar95?: number; // Conditional Value at Risk at 95% confidence
  riskOfRuin?: number;
  kellyCriterion?: number;
}

// Drawdown analysis interface
export interface DrawdownAnalysis {
  currentDrawdown: number;
  currentDrawdownPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  maxDrawdownDuration: number; // in days
  maxDrawdownStart: Date;
  maxDrawdownEnd: Date;
  averageDrawdown: number;
  averageDrawdownDuration: number;
  drawdownPeriods: DrawdownPeriod[];
  recoveryFactor: number;
}

// Individual drawdown period
export interface DrawdownPeriod {
  startTime: Date;
  endTime?: Date;
  startEquity: number;
  endEquity: number;
  depth: number;
  depthPercent: number;
  duration: number; // in days
  recovered: boolean;
}

// Win rate statistics interface
export interface WinRateStats {
  overall: number;
  bySymbol: Record<string, number>;
  byMonth: Record<string, number>;
  byDayOfWeek: Record<string, number>;
  byHour: Record<string, number>;
  consecutiveWins: number;
  consecutiveLosses: number;
  averageWinStreak: number;
  averageLossStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
  winLossRatio: number;
}

// Performance report interface
export interface PerformanceReport {
  reportId: string;
  strategyId: string;
  strategyName: string;
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  summary: PerformanceSummary;
  tradeMetrics: TradeMetrics;
  strategyMetrics: StrategyMetrics;
  riskAdjustedReturns: RiskAdjustedReturns;
  drawdownAnalysis: DrawdownAnalysis;
  winRateStats: WinRateStats;
  monthlyBreakdown: MonthlyReturn[];
  symbolBreakdown: SymbolMetrics[];
  charts: ReportChart[];
}

// Performance summary
export interface PerformanceSummary {
  netProfit: number;
  netProfitPercent: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  averageTrade: number;
  averageHoldingTime: number;
}

// Report chart data
export interface ReportChart {
  type: 'EQUITY_CURVE' | 'DRAWDOWN' | 'MONTHLY_RETURNS' | 'PROFIT_DISTRIBUTION' | 'TRADE_DISTRIBUTION';
  title: string;
  data: ChartDataPoint[];
  config?: ChartConfig;
}

// Chart data point
export interface ChartDataPoint {
  x: string | number | Date;
  y: number;
  label?: string;
}

// Chart configuration
export interface ChartConfig {
  xAxisLabel?: string;
  yAxisLabel?: string;
  color?: string;
  showGrid?: boolean;
  showLegend?: boolean;
  height?: number;
  width?: number;
}

// Performance calculation options
export interface PerformanceCalculationOptions {
  includeCommissions?: boolean;
  includeSwap?: boolean;
  riskFreeRate?: number; // for Sharpe ratio calculation
  benchmarkReturns?: number[]; // for Information Ratio
  periodsPerYear?: number; // default: 252 for daily data
  confidenceLevel?: number; // for VaR calculation, default: 0.95
}

// Analytics filter options
export interface AnalyticsFilterOptions {
  symbol?: string | string[];
  direction?: 'BUY' | 'SELL' | 'BOTH';
  startDate?: Date;
  endDate?: Date;
  minProfit?: number;
  maxProfit?: number;
  minHoldingTime?: number;
  maxHoldingTime?: number;
  tags?: string[];
  status?: 'OPEN' | 'CLOSED' | 'CANCELLED' | 'ALL';
}

// Performance comparison interface
export interface PerformanceComparison {
  strategies: StrategyPerformanceComparison[];
  benchmark?: StrategyMetrics;
  comparisonPeriod: {
    start: Date;
    end: Date;
  };
}

// Strategy performance comparison
export interface StrategyPerformanceComparison {
  strategyId: string;
  strategyName: string;
  metrics: StrategyMetrics;
  rank: number;
  score: number;
}

// Performance alert
export interface PerformanceAlert {
  alertId: string;
  strategyId: string;
  alertType: 'DRAWDOWN' | 'WIN_RATE' | 'PROFIT_FACTOR' | 'SHARPE_RATIO';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  currentValue: number;
  threshold: number;
  triggeredAt: Date;
  acknowledged: boolean;
}

// Performance goal tracking
export interface PerformanceGoal {
  goalId: string;
  strategyId: string;
  goalType: 'PROFIT_TARGET' | 'WIN_RATE' | 'MAX_DRAWDOWN' | 'SHARPE_RATIO';
  targetValue: number;
  currentValue: number;
  progress: number; // percentage
  deadline: Date;
  achieved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Export options
export interface ExportOptions {
  format: 'JSON' | 'CSV' | 'PDF' | 'HTML';
  includeCharts: boolean;
  includeRawData: boolean;
  dateRange: {
    start: Date;
    end: Date;
  };
}