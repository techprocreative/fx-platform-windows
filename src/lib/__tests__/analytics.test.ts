import { performanceProcessor } from '@/lib/analytics/performance-processor';
import { adaptTradesFromDB, filterClosedTrades } from '@/lib/analytics/adapters';
// Define local types for testing
interface AnalyticsTrade {
  id: string;
  status: 'open' | 'closed';
  strategyId: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  direction: 'BUY' | 'SELL';
  lots: number;
  openTime: Date;
  openPrice: number;
  entryTime: Date;
  entryPrice: number;
  volume: number;
  closeTime: Date | null;
  closePrice: number | null;
  exitTime: Date | null;
  exitPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  profit: number;
  profitPercent: number;
  commission: number;
  swap: number;
  pips: number;
  netProfit: number;
  comment?: string;
  magicNumber?: number;
  createdAt: Date;
  updatedAt: Date;
}

describe('Analytics Performance Processor', () => {
  // Create mock trades for testing
  const createMockTrades = (count: number): AnalyticsTrade[] => {
    const trades: AnalyticsTrade[] = [];
    const now = new Date();
    
    for (let i = 0; i < count; i++) {
      const entryTime = new Date(now.getTime() - (count - i) * 24 * 60 * 60 * 1000);
      const exitTime = new Date(entryTime.getTime() + Math.random() * 24 * 60 * 60 * 1000);
      const entryPrice = 1.1 + Math.random() * 0.2;
      const exitPrice = entryPrice + (Math.random() - 0.5) * 0.01;
      const volume = 0.1 + Math.random() * 0.5;
      const profit = (exitPrice - entryPrice) * volume * 100000;
      
      trades.push({
        id: `trade_${i}`,
        status: 'closed',
        strategyId: 'strategy_1',
        symbol: 'EURUSD',
        type: Math.random() > 0.5 ? 'BUY' : 'SELL',
        direction: Math.random() > 0.5 ? 'BUY' : 'SELL',
        lots: volume,
        openTime: entryTime,
        openPrice: entryPrice,
        entryTime,
        entryPrice,
        volume,
        closeTime: exitTime,
        closePrice: exitPrice,
        exitTime,
        exitPrice,
        stopLoss: entryPrice - 0.01,
        takeProfit: entryPrice + 0.02,
        profit,
        profitPercent: (profit / (entryPrice * volume * 100000)) * 100,
        commission: 7,
        swap: 0,
        pips: Math.abs(exitPrice - entryPrice) * 10000,
        netProfit: profit - 7,
        createdAt: entryTime,
        updatedAt: exitTime
      });
    }
    
    return trades;
  };

  test('should process strategy performance correctly', async () => {
    // Create mock trades
    const mockTrades = createMockTrades(100);
    
    // Process performance
    const performance = await performanceProcessor.processStrategyPerformance(
      mockTrades as any,
      'Test Strategy',
      {
        timeFrame: '6M',
        strategies: ['strategy_1'],
        symbols: ['EURUSD']
      }
    );
    
    // Verify basic metrics
    expect(performance).toBeDefined();
    expect(performance.strategyName).toBe('Test Strategy');
    expect(performance.metrics.totalTrades).toBe(100);
    expect(performance.metrics.winningTrades + performance.metrics.losingTrades).toBe(100);
    expect(performance.metrics.winRate).toBeGreaterThanOrEqual(0);
    expect(performance.metrics.winRate).toBeLessThanOrEqual(100);
    
    // Verify score calculation
    expect(performance.score).toBeDefined();
    expect(performance.score.overall).toBeGreaterThanOrEqual(0);
    expect(performance.score.overall).toBeLessThanOrEqual(100);
    
    // Verify monthly data
    expect(performance.monthlyData.length).toBeGreaterThan(0);
    expect(performance.equityCurve.length).toBeGreaterThan(0);
  });

  test('should calculate risk metrics correctly', async () => {
    // Create mock trades with known characteristics
    const mockTrades = createMockTrades(50);
    
    // Process performance
    const performance = await performanceProcessor.processStrategyPerformance(
      mockTrades as any,
      'Test Strategy',
      {
        timeFrame: '3M',
        strategies: ['strategy_1'],
        symbols: ['EURUSD']
      }
    );
    
    // Verify risk metrics
    expect(performance.metrics.sharpeRatio).toBeDefined();
    expect(performance.metrics.sortinoRatio).toBeDefined();
    expect(performance.metrics.maxDrawdownPercent).toBeGreaterThanOrEqual(0);
    expect(performance.metrics.profitFactor).toBeDefined();
    expect(performance.metrics.recoveryFactor).toBeDefined();
    expect(performance.metrics.var95).toBeDefined();
    expect(performance.metrics.cvar95).toBeDefined();
    expect(performance.metrics.riskOfRuin).toBeDefined();
  });

  test('should handle empty trades array', async () => {
    // Process performance with empty trades
    const performance = await performanceProcessor.processStrategyPerformance(
      [],
      'Empty Strategy',
      {
        timeFrame: '1M',
        strategies: [],
        symbols: []
      }
    );
    
    // Verify default values
    expect(performance.metrics.totalTrades).toBe(0);
    expect(performance.metrics.winningTrades).toBe(0);
    expect(performance.metrics.losingTrades).toBe(0);
    expect(performance.metrics.winRate).toBe(0);
    expect(performance.metrics.totalProfit).toBe(0);
  });

  test('should calculate win rate stability', async () => {
    // Create mock trades
    const mockTrades = createMockTrades(100);
    
    // Process performance
    const performance = await performanceProcessor.processStrategyPerformance(
      mockTrades as any,
      'Test Strategy',
      {
        timeFrame: '6M',
        strategies: ['strategy_1'],
        symbols: ['EURUSD']
      }
    );
    
    // Verify win rate stability
    expect(performance.metrics.winRateStability).toBeDefined();
    expect(performance.metrics.winRateStability).toBeGreaterThanOrEqual(0);
    expect(performance.metrics.winRateStability).toBeLessThanOrEqual(100);
  });

  test('should process real-time performance data', async () => {
    // Create mock trades
    const mockTrades = createMockTrades(10);
    
    // Process real-time performance
    const realTimeData = await performanceProcessor.processRealTimePerformance(
      mockTrades as any,
      mockTrades,
      10500
    );
    
    // Verify real-time data
    expect(realTimeData).toBeDefined();
    expect(realTimeData.timestamp).toBeInstanceOf(Date);
    expect(realTimeData.currentEquity).toBe(10500);
    expect(realTimeData.dailyPnL).toBeDefined();
    expect(realTimeData.dailyDrawdown).toBeDefined();
    expect(realTimeData.openPositions).toBeDefined();
    expect(realTimeData.closedTradesToday).toBeDefined();
    expect(realTimeData.activeStrategies).toBeDefined();
    expect(realTimeData.marketStatus).toBeDefined();
    expect(realTimeData.alerts).toBeDefined();
  });
});

describe('Analytics Adapters', () => {
  test('should adapt trades from database format', () => {
    // Create mock database trade
    const dbTrade = {
      id: 'trade_1',
      userId: 'user_1',
      strategyId: 'strategy_1',
      executorId: 'executor_1',
      ticket: '12345',
      symbol: 'EURUSD',
      type: 'BUY',
      status: 'closed',
      lots: 0.1,
      openTime: new Date('2023-01-01'),
      openPrice: 1.1000,
      closeTime: new Date('2023-01-02'),
      closePrice: 1.1050,
      stopLoss: 1.0950,
      takeProfit: 1.1150,
      profit: 50,
      profitPercent: 0.45,
      commission: 7,
      swap: 0,
      pips: 50,
      netProfit: 43,
      comment: 'Test trade',
      magicNumber: 123,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Adapt trade
    const adaptedTrades = adaptTradesFromDB([dbTrade]);
    
    // Verify adaptation
    expect(adaptedTrades).toHaveLength(1);
    expect(adaptedTrades[0].id).toBe('trade_1');
    expect(adaptedTrades[0].strategyId).toBe('strategy_1');
    expect(adaptedTrades[0].symbol).toBe('EURUSD');
    expect(adaptedTrades[0].direction).toBe('BUY');
    expect(adaptedTrades[0].entryPrice).toBe(1.1000);
    expect(adaptedTrades[0].exitPrice).toBe(1.1050);
    expect(adaptedTrades[0].volume).toBe(0.1);
    expect(adaptedTrades[0].profit).toBe(50);
  });

  test('should filter closed trades', () => {
    // Create mock trades
    const mockTrades = [
      {
        id: 'trade_1',
        status: 'closed' as const,
        strategyId: 'strategy_1',
        symbol: 'EURUSD',
        type: 'BUY' as const,
        lots: 0.1,
        openTime: new Date(),
        openPrice: 1.1000,
        closeTime: new Date(),
        closePrice: 1.1050,
        stopLoss: 1.0950,
        takeProfit: 1.1150,
        profit: 50,
        profitPercent: 0.45,
        commission: 7,
        swap: 0,
        pips: 50,
        netProfit: 43,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'trade_2',
        status: 'open' as const,
        strategyId: 'strategy_1',
        symbol: 'GBPUSD',
        type: 'SELL' as const,
        lots: 0.1,
        openTime: new Date(),
        openPrice: 1.2000,
        closeTime: null, // Open trade
        closePrice: null,
        stopLoss: 1.2050,
        takeProfit: 1.1950,
        profit: 0,
        profitPercent: 0,
        commission: 7,
        swap: 0,
        pips: 0,
        netProfit: -7,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    // Filter closed trades
    const closedTrades = filterClosedTrades(mockTrades as any[]);
    
    // Verify filtering
    expect(closedTrades).toHaveLength(1);
    expect(closedTrades[0].id).toBe('trade_1');
    expect(closedTrades[0].exitTime).toBeDefined();
  });
});