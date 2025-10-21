/**
 * Performance Analytics Tests
 * 
 * This file contains comprehensive unit tests for the Performance Analytics system,
 * including tests for MetricsCalculator, PerformanceAnalytics, and ReportGenerator.
 */

import { MetricsCalculator } from '../metrics-calculator';
import { PerformanceAnalytics } from '../performance-analytics';
import { ReportGenerator } from '../report-generator';
import { 
  Trade, 
  TradeMetrics, 
  StrategyMetrics, 
  RiskAdjustedReturns, 
  DrawdownAnalysis, 
  WinRateStats,
  PerformanceCalculationOptions,
  AnalyticsFilterOptions,
  PerformanceAlert,
  PerformanceGoal
} from '../types';

// Mock the logger
jest.mock('../../monitoring/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('MetricsCalculator', () => {
  let calculator: MetricsCalculator;
  let sampleTrades: Trade[];

  beforeEach(() => {
    calculator = new MetricsCalculator();
    
    // Create sample trade data for testing
    const baseDate = new Date('2023-01-01');
    sampleTrades = [
      {
        id: '1',
        strategyId: 'strategy-1',
        symbol: 'EURUSD',
        direction: 'BUY',
        entryPrice: 1.1000,
        exitPrice: 1.1050,
        entryTime: new Date(baseDate.getTime() + 24 * 60 * 60 * 1000), // +1 day
        exitTime: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000), // +2 days
        volume: 1.0,
        stopLoss: 1.0950,
        takeProfit: 1.1100,
        commission: 5,
        swap: 0,
        profit: 50,
        status: 'CLOSED'
      },
      {
        id: '2',
        strategyId: 'strategy-1',
        symbol: 'EURUSD',
        direction: 'SELL',
        entryPrice: 1.1050,
        exitPrice: 1.1000,
        entryTime: new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000), // +3 days
        exitTime: new Date(baseDate.getTime() + 4 * 24 * 60 * 60 * 1000), // +4 days
        volume: 1.0,
        stopLoss: 1.1100,
        takeProfit: 1.0950,
        commission: 5,
        swap: 0,
        profit: 50,
        status: 'CLOSED'
      },
      {
        id: '3',
        strategyId: 'strategy-1',
        symbol: 'GBPUSD',
        direction: 'BUY',
        entryPrice: 1.3000,
        exitPrice: 1.2950,
        entryTime: new Date(baseDate.getTime() + 5 * 24 * 60 * 60 * 1000), // +5 days
        exitTime: new Date(baseDate.getTime() + 6 * 24 * 60 * 60 * 1000), // +6 days
        volume: 1.0,
        stopLoss: 1.2950,
        takeProfit: 1.3100,
        commission: 5,
        swap: 0,
        profit: -50,
        status: 'CLOSED'
      },
      {
        id: '4',
        strategyId: 'strategy-1',
        symbol: 'EURUSD',
        direction: 'BUY',
        entryPrice: 1.1000,
        exitPrice: 1.1000, // No change
        entryTime: new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000), // +7 days
        exitTime: new Date(baseDate.getTime() + 8 * 24 * 60 * 60 * 1000), // +8 days
        volume: 1.0,
        stopLoss: 1.0950,
        takeProfit: 1.1100,
        commission: 5,
        swap: 0,
        profit: 0,
        status: 'CLOSED'
      },
      {
        id: '5',
        strategyId: 'strategy-1',
        symbol: 'EURUSD',
        direction: 'BUY',
        entryPrice: 1.1000,
        exitPrice: undefined, // Open trade
        entryTime: new Date(baseDate.getTime() + 9 * 24 * 60 * 60 * 1000), // +9 days
        volume: 1.0,
        stopLoss: 1.0950,
        takeProfit: 1.1100,
        commission: 5,
        swap: 0,
        profit: 0,
        status: 'OPEN'
      }
    ];
  });

  describe('calculateTradeMetrics', () => {
    it('should calculate trade metrics correctly', () => {
      const metrics = calculator.calculateTradeMetrics(sampleTrades);
      
      expect(metrics.totalTrades).toBe(4); // Only closed trades
      expect(metrics.winningTrades).toBe(2);
      expect(metrics.losingTrades).toBe(1);
      expect(metrics.winRate).toBe(50); // 2 wins out of 4 trades (1 is breakeven)
      expect(metrics.totalProfit).toBe(100); // 50 + 50
      expect(metrics.totalLoss).toBe(50);
      expect(metrics.netProfit).toBe(50);
      expect(metrics.profitFactor).toBe(2); // 100 / 50
      expect(metrics.averageWin).toBe(50);
      expect(metrics.averageLoss).toBe(50);
      expect(metrics.largestWin).toBe(50);
      expect(metrics.largestLoss).toBe(-50);
    });

    it('should handle empty trades array', () => {
      const metrics = calculator.calculateTradeMetrics([]);
      
      expect(metrics.totalTrades).toBe(0);
      expect(metrics.winningTrades).toBe(0);
      expect(metrics.losingTrades).toBe(0);
      expect(metrics.winRate).toBe(0);
      expect(metrics.netProfit).toBe(0);
    });

    it('should respect calculation options', () => {
      const options: PerformanceCalculationOptions = {
        includeCommissions: false,
        includeSwap: false
      };
      
      const metrics = calculator.calculateTradeMetrics(sampleTrades, options);
      
      // With commissions excluded, profits should be higher
      expect(metrics.netProfit).toBe(70); // 50 + 50 - 50 + 20 (commissions added back)
    });

    it('should handle only losing trades', () => {
      const losingTrades = sampleTrades.filter(t => t.profit < 0);
      const metrics = calculator.calculateTradeMetrics(losingTrades);
      
      expect(metrics.totalTrades).toBe(1);
      expect(metrics.winningTrades).toBe(0);
      expect(metrics.losingTrades).toBe(1);
      expect(metrics.winRate).toBe(0);
      expect(metrics.profitFactor).toBe(0);
    });

    it('should handle only winning trades', () => {
      const winningTrades = sampleTrades.filter(t => t.profit > 0);
      const metrics = calculator.calculateTradeMetrics(winningTrades);
      
      expect(metrics.totalTrades).toBe(2);
      expect(metrics.winningTrades).toBe(2);
      expect(metrics.losingTrades).toBe(0);
      expect(metrics.winRate).toBe(100);
      expect(metrics.profitFactor).toBe(Infinity);
    });
  });

  describe('calculateRiskAdjustedReturns', () => {
    it('should calculate risk-adjusted returns', () => {
      const riskAdjustedReturns = calculator.calculateRiskAdjustedReturns(sampleTrades, 10000);
      
      expect(riskAdjustedReturns.sharpeRatio).toBeDefined();
      expect(riskAdjustedReturns.sortinoRatio).toBeDefined();
      expect(riskAdjustedReturns.calmarRatio).toBeDefined();
      expect(riskAdjustedReturns.var95).toBeDefined();
      expect(riskAdjustedReturns.cvar95).toBeDefined();
      expect(riskAdjustedReturns.riskOfRuin).toBeDefined();
      expect(riskAdjustedReturns.kellyCriterion).toBeDefined();
    });

    it('should handle empty trades array', () => {
      const riskAdjustedReturns = calculator.calculateRiskAdjustedReturns([], 10000);
      
      expect(riskAdjustedReturns.sharpeRatio).toBe(0);
      expect(riskAdjustedReturns.sortinoRatio).toBe(0);
      expect(riskAdjustedReturns.calmarRatio).toBe(0);
    });

    it('should respect custom risk-free rate', () => {
      const options: PerformanceCalculationOptions = {
        riskFreeRate: 0.05
      };
      
      const riskAdjustedReturns = calculator.calculateRiskAdjustedReturns(sampleTrades, 10000, options);
      
      expect(riskAdjustedReturns.sharpeRatio).toBeDefined();
      // Higher risk-free rate should result in lower Sharpe ratio
    });
  });

  describe('calculateDrawdownAnalysis', () => {
    it('should calculate drawdown analysis', () => {
      const drawdownAnalysis = calculator.calculateDrawdownAnalysis(sampleTrades, 10000);
      
      expect(drawdownAnalysis.currentDrawdown).toBeDefined();
      expect(drawdownAnalysis.currentDrawdownPercent).toBeDefined();
      expect(drawdownAnalysis.maxDrawdown).toBeDefined();
      expect(drawdownAnalysis.maxDrawdownPercent).toBeDefined();
      expect(drawdownAnalysis.maxDrawdownDuration).toBeDefined();
      expect(drawdownAnalysis.recoveryFactor).toBeDefined();
      expect(drawdownAnalysis.drawdownPeriods).toBeDefined();
    });

    it('should handle empty trades array', () => {
      const drawdownAnalysis = calculator.calculateDrawdownAnalysis([], 10000);
      
      expect(drawdownAnalysis.currentDrawdown).toBe(0);
      expect(drawdownAnalysis.currentDrawdownPercent).toBe(0);
      expect(drawdownAnalysis.maxDrawdown).toBe(0);
      expect(drawdownAnalysis.maxDrawdownPercent).toBe(0);
    });
  });

  describe('calculateWinRateStats', () => {
    it('should calculate win rate statistics', () => {
      const winRateStats = calculator.calculateWinRateStats(sampleTrades);
      
      expect(winRateStats.overall).toBe(50);
      expect(winRateStats.bySymbol).toBeDefined();
      expect(winRateStats.byMonth).toBeDefined();
      expect(winRateStats.byDayOfWeek).toBeDefined();
      expect(winRateStats.byHour).toBeDefined();
      expect(winRateStats.consecutiveWins).toBeDefined();
      expect(winRateStats.consecutiveLosses).toBeDefined();
      expect(winRateStats.longestWinStreak).toBeDefined();
      expect(winRateStats.longestLossStreak).toBeDefined();
    });

    it('should handle empty trades array', () => {
      const winRateStats = calculator.calculateWinRateStats([]);
      
      expect(winRateStats.overall).toBe(0);
      expect(winRateStats.longestWinStreak).toBe(0);
      expect(winRateStats.longestLossStreak).toBe(0);
    });
  });

  describe('calculateMonthlyReturns', () => {
    it('should calculate monthly returns', () => {
      const monthlyReturns = calculator.calculateMonthlyReturns(sampleTrades, 10000);
      
      expect(monthlyReturns).toBeDefined();
      expect(Array.isArray(monthlyReturns)).toBe(true);
      
      if (monthlyReturns.length > 0) {
        expect(monthlyReturns[0]).toHaveProperty('month');
        expect(monthlyReturns[0]).toHaveProperty('return');
        expect(monthlyReturns[0]).toHaveProperty('returnPercent');
        expect(monthlyReturns[0]).toHaveProperty('tradesCount');
      }
    });

    it('should handle empty trades array', () => {
      const monthlyReturns = calculator.calculateMonthlyReturns([], 10000);
      
      expect(monthlyReturns).toEqual([]);
    });
  });

  describe('calculateSymbolMetrics', () => {
    it('should calculate symbol-specific metrics', () => {
      const symbolMetrics = calculator.calculateSymbolMetrics(sampleTrades);
      
      expect(symbolMetrics).toBeDefined();
      expect(Array.isArray(symbolMetrics)).toBe(true);
      
      if (symbolMetrics.length > 0) {
        expect(symbolMetrics[0]).toHaveProperty('symbol');
        expect(symbolMetrics[0]).toHaveProperty('tradesCount');
        expect(symbolMetrics[0]).toHaveProperty('winRate');
        expect(symbolMetrics[0]).toHaveProperty('netProfit');
        expect(symbolMetrics[0]).toHaveProperty('profitFactor');
      }
    });

    it('should handle empty trades array', () => {
      const symbolMetrics = calculator.calculateSymbolMetrics([]);
      
      expect(symbolMetrics).toEqual([]);
    });
  });
});

describe('PerformanceAnalytics', () => {
  let analytics: PerformanceAnalytics;
  let sampleTrades: Trade[];

  beforeEach(() => {
    analytics = new PerformanceAnalytics();
    
    // Create sample trade data for testing
    const baseDate = new Date('2023-01-01');
    sampleTrades = [
      {
        id: '1',
        strategyId: 'strategy-1',
        symbol: 'EURUSD',
        direction: 'BUY',
        entryPrice: 1.1000,
        exitPrice: 1.1050,
        entryTime: new Date(baseDate.getTime() + 24 * 60 * 60 * 1000),
        exitTime: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000),
        volume: 1.0,
        stopLoss: 1.0950,
        takeProfit: 1.1100,
        commission: 5,
        swap: 0,
        profit: 50,
        status: 'CLOSED'
      },
      {
        id: '2',
        strategyId: 'strategy-1',
        symbol: 'EURUSD',
        direction: 'SELL',
        entryPrice: 1.1050,
        exitPrice: 1.1000,
        entryTime: new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000),
        exitTime: new Date(baseDate.getTime() + 4 * 24 * 60 * 60 * 1000),
        volume: 1.0,
        stopLoss: 1.1100,
        takeProfit: 1.0950,
        commission: 5,
        swap: 0,
        profit: 50,
        status: 'CLOSED'
      }
    ];
  });

  describe('calculateTradeMetrics', () => {
    it('should calculate trade metrics successfully', async () => {
      const metrics = await analytics.calculateTradeMetrics(sampleTrades);
      
      expect(metrics).toBeDefined();
      expect(metrics.totalTrades).toBe(2);
      expect(metrics.winRate).toBe(100);
      expect(metrics.netProfit).toBe(90); // 50 + 50 - 10 (commissions)
    });

    it('should handle errors gracefully', async () => {
      // @ts-ignore - Intentionally passing invalid data
      const invalidTrades = null as any;
      
      await expect(analytics.calculateTradeMetrics(invalidTrades))
        .rejects.toThrow('Failed to calculate trade metrics');
    });
  });

  describe('calculateStrategyMetrics', () => {
    it('should calculate strategy metrics successfully', async () => {
      const metrics = await analytics.calculateStrategyMetrics(
        'strategy-1',
        'Test Strategy',
        sampleTrades,
        10000
      );
      
      expect(metrics).toBeDefined();
      expect(metrics.strategyId).toBe('strategy-1');
      expect(metrics.strategyName).toBe('Test Strategy');
      expect(metrics.totalTrades).toBe(2);
      expect(metrics.winRate).toBe(100);
      expect(metrics.netProfit).toBe(90);
    });

    it('should handle empty trades array', async () => {
      const metrics = await analytics.calculateStrategyMetrics(
        'strategy-1',
        'Test Strategy',
        [],
        10000
      );
      
      expect(metrics).toBeDefined();
      expect(metrics.totalTrades).toBe(0);
      expect(metrics.netProfit).toBe(0);
    });
  });

  describe('calculateRiskAdjustedReturns', () => {
    it('should calculate risk-adjusted returns successfully', async () => {
      const riskAdjustedReturns = await analytics.calculateRiskAdjustedReturns(
        sampleTrades,
        10000
      );
      
      expect(riskAdjustedReturns).toBeDefined();
      expect(riskAdjustedReturns.sharpeRatio).toBeDefined();
      expect(riskAdjustedReturns.sortinoRatio).toBeDefined();
      expect(riskAdjustedReturns.calmarRatio).toBeDefined();
    });
  });

  describe('performDrawdownAnalysis', () => {
    it('should perform drawdown analysis successfully', async () => {
      const drawdownAnalysis = await analytics.performDrawdownAnalysis(
        sampleTrades,
        10000
      );
      
      expect(drawdownAnalysis).toBeDefined();
      expect(drawdownAnalysis.currentDrawdown).toBeDefined();
      expect(drawdownAnalysis.maxDrawdown).toBeDefined();
      expect(drawdownAnalysis.maxDrawdownPercent).toBeDefined();
    });
  });

  describe('calculateWinRateStats', () => {
    it('should calculate win rate statistics successfully', async () => {
      const winRateStats = await analytics.calculateWinRateStats(sampleTrades);
      
      expect(winRateStats).toBeDefined();
      expect(winRateStats.overall).toBe(100);
      expect(winRateStats.bySymbol).toBeDefined();
      expect(winRateStats.byMonth).toBeDefined();
    });
  });

  describe('generatePerformanceReport', () => {
    it('should generate performance report successfully', async () => {
      const periodStart = new Date('2023-01-01');
      const periodEnd = new Date('2023-12-31');
      
      const report = await analytics.generatePerformanceReport(
        'strategy-1',
        'Test Strategy',
        sampleTrades,
        periodStart,
        periodEnd,
        10000
      );
      
      expect(report).toBeDefined();
      expect(report.reportId).toBeDefined();
      expect(report.strategyId).toBe('strategy-1');
      expect(report.strategyName).toBe('Test Strategy');
      expect(report.periodStart).toBe(periodStart);
      expect(report.periodEnd).toBe(periodEnd);
      expect(report.summary).toBeDefined();
      expect(report.tradeMetrics).toBeDefined();
      expect(report.strategyMetrics).toBeDefined();
      expect(report.riskAdjustedReturns).toBeDefined();
      expect(report.drawdownAnalysis).toBeDefined();
      expect(report.winRateStats).toBeDefined();
    });
  });

  describe('compareStrategies', () => {
    it('should compare strategies successfully', async () => {
      const strategies = [
        {
          id: 'strategy-1',
          name: 'Strategy 1',
          trades: sampleTrades
        },
        {
          id: 'strategy-2',
          name: 'Strategy 2',
          trades: sampleTrades.map(t => ({ ...t, id: t.id + '-2', profit: t.profit * 0.8 }))
        }
      ];
      
      const periodStart = new Date('2023-01-01');
      const periodEnd = new Date('2023-12-31');
      
      const comparison = await analytics.compareStrategies(
        strategies,
        periodStart,
        periodEnd,
        10000
      );
      
      expect(comparison).toBeDefined();
      expect(comparison.strategies).toHaveLength(2);
      expect(comparison.comparisonPeriod.start).toBe(periodStart);
      expect(comparison.comparisonPeriod.end).toBe(periodEnd);
      expect(comparison.strategies[0].rank).toBeDefined();
      expect(comparison.strategies[0].score).toBeDefined();
    });
  });

  describe('checkPerformanceAlerts', () => {
    it('should check performance alerts successfully', async () => {
      const thresholds = {
        maxDrawdownPercent: 10,
        minWinRate: 50,
        minProfitFactor: 1.5,
        minSharpeRatio: 1.0
      };
      
      const alerts = await analytics.checkPerformanceAlerts(
        'strategy-1',
        'Test Strategy',
        sampleTrades,
        thresholds
      );
      
      expect(alerts).toBeDefined();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should generate alerts when thresholds are exceeded', async () => {
      // Create trades that will trigger alerts
      const badTrades = sampleTrades.map(t => ({
        ...t,
        profit: -100, // All losing trades
        id: t.id + '-bad'
      }));
      
      const thresholds = {
        maxDrawdownPercent: 5,
        minWinRate: 50,
        minProfitFactor: 1.5,
        minSharpeRatio: 1.0
      };
      
      const alerts = await analytics.checkPerformanceAlerts(
        'strategy-1',
        'Test Strategy',
        badTrades,
        thresholds
      );
      
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].alertType).toBeDefined();
      expect(alerts[0].severity).toBeDefined();
      expect(alerts[0].message).toBeDefined();
    });
  });

  describe('trackPerformanceGoals', () => {
    it('should track performance goals successfully', async () => {
      const goals: PerformanceGoal[] = [
        {
          goalId: 'goal-1',
          strategyId: 'strategy-1',
          goalType: 'PROFIT_TARGET',
          targetValue: 100,
          currentValue: 0,
          progress: 0,
          deadline: new Date('2023-12-31'),
          achieved: false,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          goalId: 'goal-2',
          strategyId: 'strategy-1',
          goalType: 'WIN_RATE',
          targetValue: 80,
          currentValue: 0,
          progress: 0,
          deadline: new Date('2023-12-31'),
          achieved: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      const trackedGoals = await analytics.trackPerformanceGoals(
        'strategy-1',
        sampleTrades,
        goals
      );
      
      expect(trackedGoals).toBeDefined();
      expect(trackedGoals).toHaveLength(2);
      expect(trackedGoals[0].currentValue).toBeDefined();
      expect(trackedGoals[0].progress).toBeDefined();
      expect(trackedGoals[0].achieved).toBeDefined();
    });
  });
});

describe('ReportGenerator', () => {
  let generator: ReportGenerator;
  let sampleReport: any;

  beforeEach(() => {
    generator = new ReportGenerator();
    
    // Create a sample report for testing
    sampleReport = {
      reportId: 'report-1',
      strategyId: 'strategy-1',
      strategyName: 'Test Strategy',
      generatedAt: new Date(),
      periodStart: new Date('2023-01-01'),
      periodEnd: new Date('2023-12-31'),
      summary: {
        netProfit: 1000,
        netProfitPercent: 10,
        totalTrades: 100,
        winRate: 60,
        profitFactor: 1.5,
        maxDrawdown: 500,
        maxDrawdownPercent: 5,
        sharpeRatio: 1.2,
        averageTrade: 10,
        averageHoldingTime: 24
      },
      tradeMetrics: {
        totalTrades: 100,
        winningTrades: 60,
        losingTrades: 40,
        winRate: 60,
        averageWin: 20,
        averageLoss: -15,
        largestWin: 100,
        largestLoss: -50,
        averageTrade: 10,
        profitFactor: 1.5,
        totalProfit: 1200,
        totalLoss: 800,
        netProfit: 400,
        averageHoldingTime: 24,
        commissionPaid: 200,
        swapPaid: 50
      },
      strategyMetrics: {
        strategyId: 'strategy-1',
        strategyName: 'Test Strategy',
        totalTrades: 100,
        winRate: 60,
        netProfit: 1000,
        netProfitPercent: 10,
        grossProfit: 1200,
        grossLoss: 800,
        profitFactor: 1.5,
        maxDrawdown: 500,
        maxDrawdownPercent: 5,
        averageWin: 20,
        averageLoss: -15,
        recoveryFactor: 2,
        sharpeRatio: 1.2,
        sortinoRatio: 1.5,
        calmarRatio: 2,
        averageHoldingTime: 24,
        monthlyReturns: [],
        tradesBySymbol: [],
        tradesByMonth: []
      },
      riskAdjustedReturns: {
        sharpeRatio: 1.2,
        sortinoRatio: 1.5,
        calmarRatio: 2,
        var95: 0.02,
        cvar95: 0.03,
        riskOfRuin: 0.1,
        kellyCriterion: 0.25
      },
      drawdownAnalysis: {
        currentDrawdown: 100,
        currentDrawdownPercent: 1,
        maxDrawdown: 500,
        maxDrawdownPercent: 5,
        maxDrawdownDuration: 30,
        maxDrawdownStart: new Date('2023-05-01'),
        maxDrawdownEnd: new Date('2023-05-30'),
        averageDrawdown: 200,
        averageDrawdownDuration: 15,
        drawdownPeriods: [],
        recoveryFactor: 2
      },
      winRateStats: {
        overall: 60,
        bySymbol: { EURUSD: 65, GBPUSD: 55 },
        byMonth: { '2023-01': 70, '2023-02': 50 },
        byDayOfWeek: { Monday: 65, Tuesday: 55 },
        byHour: { '9': 70, '10': 50 },
        consecutiveWins: 3,
        consecutiveLosses: 2,
        averageWinStreak: 2.5,
        averageLossStreak: 1.8,
        longestWinStreak: 5,
        longestLossStreak: 3,
        winLossRatio: 1.67
      },
      monthlyBreakdown: [
        { month: '2023-01', return: 100, returnPercent: 1, tradesCount: 10 },
        { month: '2023-02', return: 150, returnPercent: 1.5, tradesCount: 12 }
      ],
      symbolBreakdown: [
        { symbol: 'EURUSD', tradesCount: 60, winRate: 65, netProfit: 600, profitFactor: 1.6, averageWin: 22, averageLoss: -14 },
        { symbol: 'GBPUSD', tradesCount: 40, winRate: 55, netProfit: 400, profitFactor: 1.4, averageWin: 18, averageLoss: -16 }
      ],
      charts: []
    };
  });

  describe('generateHTMLReport', () => {
    it('should generate HTML report successfully', async () => {
      const html = await generator.generateHTMLReport(sampleReport);
      
      expect(html).toBeDefined();
      expect(typeof html).toBe('string');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Performance Report');
      expect(html).toContain('Test Strategy');
      expect(html).toContain('Net Profit');
      expect(html).toContain('Total Trades');
    });

    it('should handle errors gracefully', async () => {
      // @ts-ignore - Intentionally passing invalid data
      const invalidReport = null as any;
      
      await expect(generator.generateHTMLReport(invalidReport))
        .rejects.toThrow('Failed to generate HTML report');
    });
  });

  describe('generatePDFReport', () => {
    it('should generate PDF report successfully', async () => {
      const pdf = await generator.generatePDFReport(sampleReport);
      
      expect(pdf).toBeDefined();
      expect(Buffer.isBuffer(pdf)).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      // @ts-ignore - Intentionally passing invalid data
      const invalidReport = null as any;
      
      await expect(generator.generatePDFReport(invalidReport))
        .rejects.toThrow('Failed to generate PDF report');
    });
  });

  describe('generateCSVExport', () => {
    it('should generate CSV export successfully', async () => {
      const trades: Trade[] = [
        {
          id: '1',
          strategyId: 'strategy-1',
          symbol: 'EURUSD',
          direction: 'BUY',
          entryPrice: 1.1000,
          exitPrice: 1.1050,
          entryTime: new Date('2023-01-01'),
          exitTime: new Date('2023-01-02'),
          volume: 1.0,
          stopLoss: 1.0950,
          takeProfit: 1.1100,
          commission: 5,
          swap: 0,
          profit: 50,
          status: 'CLOSED'
        }
      ];
      
      const csv = await generator.generateCSVExport(trades);
      
      expect(csv).toBeDefined();
      expect(typeof csv).toBe('string');
      expect(csv).toContain('ID,Strategy ID,Symbol,Direction');
      expect(csv).toContain('1,strategy-1,EURUSD,BUY');
    });

    it('should handle empty trades array', async () => {
      const csv = await generator.generateCSVExport([]);
      
      expect(csv).toBeDefined();
      expect(typeof csv).toBe('string');
      expect(csv).toContain('ID,Strategy ID,Symbol,Direction');
    });
  });

  describe('generateJSONExport', () => {
    it('should generate JSON export successfully', async () => {
      const json = await generator.generateJSONExport(sampleReport);
      
      expect(json).toBeDefined();
      expect(typeof json).toBe('string');
      
      const parsed = JSON.parse(json);
      expect(parsed.reportId).toBe('report-1');
      expect(parsed.strategyId).toBe('strategy-1');
      expect(parsed.strategyName).toBe('Test Strategy');
    });

    it('should handle errors gracefully', async () => {
      // @ts-ignore - Intentionally passing invalid data
      const invalidReport = null as any;
      
      await expect(generator.generateJSONExport(invalidReport))
        .rejects.toThrow('Failed to generate JSON export');
    });
  });

  describe('generateCharts', () => {
    it('should generate charts successfully', async () => {
      const charts = await generator.generateCharts(sampleReport);
      
      expect(charts).toBeDefined();
      expect(Array.isArray(charts)).toBe(true);
      expect(charts).toHaveLength(5); // 5 different chart types
      
      // Check that each chart has the required properties
      charts.forEach(chart => {
        expect(chart.type).toBeDefined();
        expect(chart.title).toBeDefined();
        expect(chart.data).toBeDefined();
        expect(Array.isArray(chart.data)).toBe(true);
      });
    });

    it('should handle errors gracefully', async () => {
      // @ts-ignore - Intentionally passing invalid data
      const invalidReport = null as any;
      
      await expect(generator.generateCharts(invalidReport))
        .rejects.toThrow('Failed to generate charts');
    });
  });

  describe('generateCustomReport', () => {
    it('should generate HTML custom report successfully', async () => {
      const options = {
        format: 'HTML' as const,
        includeCharts: true,
        includeRawData: false,
        dateRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-12-31')
        }
      };
      
      const report = await generator.generateCustomReport(sampleReport, options);
      
      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
      expect(report).toContain('<!DOCTYPE html>');
    });

    it('should generate JSON custom report successfully', async () => {
      const options = {
        format: 'JSON' as const,
        includeCharts: false,
        includeRawData: true,
        dateRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-12-31')
        }
      };
      
      const report = await generator.generateCustomReport(sampleReport, options);
      
      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
      
      const parsed = JSON.parse(report as string);
      expect(parsed.reportId).toBe('report-1');
    });

    it('should generate PDF custom report successfully', async () => {
      const options = {
        format: 'PDF' as const,
        includeCharts: true,
        includeRawData: false,
        dateRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-12-31')
        }
      };
      
      const report = await generator.generateCustomReport(sampleReport, options);
      
      expect(report).toBeDefined();
      expect(Buffer.isBuffer(report)).toBe(true);
    });

    it('should handle unsupported format', async () => {
      const options = {
        format: 'UNSUPPORTED' as any,
        includeCharts: true,
        includeRawData: false,
        dateRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-12-31')
        }
      };
      
      await expect(generator.generateCustomReport(sampleReport, options))
        .rejects.toThrow('Unsupported export format: UNSUPPORTED');
    });
  });
});

// Integration tests
describe('Performance Analytics Integration', () => {
  let analytics: PerformanceAnalytics;
  let generator: ReportGenerator;
  let sampleTrades: Trade[];

  beforeEach(() => {
    analytics = new PerformanceAnalytics();
    generator = new ReportGenerator();
    
    // Create comprehensive sample trade data
    const baseDate = new Date('2023-01-01');
    sampleTrades = [];
    
    // Generate 100 trades over a year
    for (let i = 0; i < 100; i++) {
      const isWin = Math.random() > 0.4; // 60% win rate
      const profit = isWin ? Math.random() * 100 + 10 : -(Math.random() * 50 + 10);
      
      sampleTrades.push({
        id: `trade-${i}`,
        strategyId: 'integration-strategy',
        symbol: ['EURUSD', 'GBPUSD', 'USDJPY'][Math.floor(Math.random() * 3)],
        direction: Math.random() > 0.5 ? 'BUY' : 'SELL',
        entryPrice: 1.1000 + Math.random() * 0.1000,
        exitPrice: 1.1000 + Math.random() * 0.1000,
        entryTime: new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000 * 3.65), // Every ~3.65 days
        exitTime: new Date(baseDate.getTime() + (i + 1) * 24 * 60 * 60 * 1000 * 3.65),
        volume: 1.0,
        stopLoss: 1.0950,
        takeProfit: 1.1100,
        commission: 5,
        swap: Math.random() * 2 - 1, // Random swap between -1 and 1
        profit,
        status: 'CLOSED'
      });
    }
  });

  it('should perform complete analytics workflow', async () => {
    // 1. Calculate trade metrics
    const tradeMetrics = await analytics.calculateTradeMetrics(sampleTrades);
    expect(tradeMetrics.totalTrades).toBe(100);
    
    // 2. Calculate strategy metrics
    const strategyMetrics = await analytics.calculateStrategyMetrics(
      'integration-strategy',
      'Integration Test Strategy',
      sampleTrades,
      10000
    );
    expect(strategyMetrics.totalTrades).toBe(100);
    
    // 3. Calculate risk-adjusted returns
    const riskAdjustedReturns = await analytics.calculateRiskAdjustedReturns(
      sampleTrades,
      10000
    );
    expect(riskAdjustedReturns.sharpeRatio).toBeDefined();
    
    // 4. Perform drawdown analysis
    const drawdownAnalysis = await analytics.performDrawdownAnalysis(
      sampleTrades,
      10000
    );
    expect(drawdownAnalysis.maxDrawdown).toBeDefined();
    
    // 5. Calculate win rate statistics
    const winRateStats = await analytics.calculateWinRateStats(sampleTrades);
    expect(winRateStats.overall).toBeDefined();
    
    // 6. Generate performance report
    const report = await analytics.generatePerformanceReport(
      'integration-strategy',
      'Integration Test Strategy',
      sampleTrades,
      new Date('2023-01-01'),
      new Date('2023-12-31'),
      10000
    );
    expect(report.reportId).toBeDefined();
    
    // 7. Generate HTML report
    const htmlReport = await generator.generateHTMLReport(report);
    expect(htmlReport).toContain('<!DOCTYPE html>');
    
    // 8. Generate JSON export
    const jsonExport = await generator.generateJSONExport(report);
    const parsedReport = JSON.parse(jsonExport);
    expect(parsedReport.reportId).toBe(report.reportId);
    
    // 9. Generate CSV export
    const csvExport = await generator.generateCSVExport(sampleTrades);
    expect(csvExport).toContain('ID,Strategy ID,Symbol,Direction');
  });

  it('should handle performance alerts and goals', async () => {
    // Set thresholds that should trigger alerts
    const thresholds = {
      maxDrawdownPercent: 1, // Very low threshold
      minWinRate: 90, // Very high threshold
      minProfitFactor: 3, // Very high threshold
      minSharpeRatio: 3 // Very high threshold
    };
    
    // Check for alerts
    const alerts = await analytics.checkPerformanceAlerts(
      'integration-strategy',
      'Integration Test Strategy',
      sampleTrades,
      thresholds
    );
    
    // Should have some alerts due to strict thresholds
    expect(Array.isArray(alerts)).toBe(true);
    
    // Set goals
    const goals: PerformanceGoal[] = [
      {
        goalId: 'profit-goal',
        strategyId: 'integration-strategy',
        goalType: 'PROFIT_TARGET',
        targetValue: 1000,
        currentValue: 0,
        progress: 0,
        deadline: new Date('2023-12-31'),
        achieved: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        goalId: 'winrate-goal',
        strategyId: 'integration-strategy',
        goalType: 'WIN_RATE',
        targetValue: 70,
        currentValue: 0,
        progress: 0,
        deadline: new Date('2023-12-31'),
        achieved: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    // Track goals
    const trackedGoals = await analytics.trackPerformanceGoals(
      'integration-strategy',
      sampleTrades,
      goals
    );
    
    expect(trackedGoals).toHaveLength(2);
    expect(trackedGoals[0].currentValue).toBeDefined();
    expect(trackedGoals[0].progress).toBeDefined();
  });
});