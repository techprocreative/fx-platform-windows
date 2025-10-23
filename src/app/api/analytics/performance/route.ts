import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { performanceProcessor } from '@/lib/analytics/performance-processor';
import { adaptTradesFromDB, filterClosedTrades } from '@/lib/analytics/adapters';
import { AnalyticsFilters, TimeFrame } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const timeframe = (searchParams.get('timeframe') as TimeFrame) || '6M';
    const strategyId = searchParams.get('strategyId');
    const symbol = searchParams.get('symbol');
    const tradeType = searchParams.get('tradeType') as 'BUY' | 'SELL' | 'ALL' || 'ALL';

    // Calculate date range based on timeframe
    const now = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
      case '1D':
        startDate.setDate(now.getDate() - 1);
        break;
      case '1W':
        startDate.setDate(now.getDate() - 7);
        break;
      case '1M':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case '3M':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case '6M':
        startDate.setMonth(now.getMonth() - 6);
        break;
      case '1Y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'ALL':
        startDate = new Date(0); // Beginning of time
        break;
    }

    // Build filters
    const filters: AnalyticsFilters = {
      timeFrame: timeframe,
      strategies: strategyId ? [strategyId] : [],
      symbols: symbol ? [symbol] : [],
      tradeType: tradeType as any,
      dateRange: {
        start: startDate,
        end: now
      }
    };

    // Fetch trades from database
    const dbTrades = await prisma.trade.findMany({
      where: {
        userId: session.user.id,
        openTime: {
          gte: startDate,
        },
        closeTime: {
          not: null, // Only closed trades for analytics
        },
        ...(strategyId && { strategyId }),
        ...(symbol && { symbol }),
        ...(tradeType && tradeType !== 'ALL' && { 
          type: tradeType === 'BUY' ? 'BUY' : 'SELL' 
        }),
      },
      orderBy: { openTime: 'asc' },
    });

    // Convert to analytics trades
    const analyticsTrades = adaptTradesFromDB(dbTrades);
    const closedTrades = filterClosedTrades(analyticsTrades);

    if (closedTrades.length === 0) {
      return NextResponse.json({
        performance: null,
        message: 'No trades found for the specified criteria'
      });
    }

    // Get strategy name if strategyId is provided
    let strategyName = 'All Strategies';
    if (strategyId) {
      const strategy = await prisma.strategy.findUnique({
        where: { id: strategyId },
        select: { name: true }
      });
      strategyName = strategy?.name || 'Unknown Strategy';
    }

    // Process performance data
    const performanceData = await performanceProcessor.processStrategyPerformance(
      closedTrades,
      strategyName,
      filters
    );

    return NextResponse.json({
      performance: performanceData,
      filters,
      summary: {
        totalTrades: performanceData.metrics.totalTrades,
        totalProfit: performanceData.metrics.totalProfit,
        winRate: performanceData.metrics.winRate,
        sharpeRatio: performanceData.metrics.sharpeRatio,
        maxDrawdown: performanceData.metrics.maxDrawdownPercent,
        profitFactor: performanceData.metrics.profitFactor
      }
    });

  } catch (error) {
    console.error('Performance analytics API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch performance analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { strategyIds, symbols, timeFrame, tradeType, dateRange } = body;

    // Validate required fields
    if (!timeFrame) {
      return NextResponse.json({ error: 'timeFrame is required' }, { status: 400 });
    }

    // Build filters
    const filters: AnalyticsFilters = {
      timeFrame: timeFrame as TimeFrame,
      strategies: strategyIds || [],
      symbols: symbols || [],
      tradeType: tradeType || 'ALL',
      dateRange: dateRange ? {
        start: new Date(dateRange.start),
        end: new Date(dateRange.end)
      } : undefined
    };

    // Calculate date range if not provided
    let startDate = new Date();
    const now = new Date();
    
    if (!dateRange) {
      switch (timeFrame) {
        case '1D':
          startDate.setDate(now.getDate() - 1);
          break;
        case '1W':
          startDate.setDate(now.getDate() - 7);
          break;
        case '1M':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case '3M':
          startDate.setMonth(now.getMonth() - 3);
          break;
        case '6M':
          startDate.setMonth(now.getMonth() - 6);
          break;
        case '1Y':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        case 'ALL':
          startDate = new Date(0);
          break;
      }
      filters.dateRange = { start: startDate, end: now };
    }

    // Fetch trades from database
    const dbTrades = await prisma.trade.findMany({
      where: {
        userId: session.user.id,
        openTime: {
          gte: filters.dateRange!.start,
        },
        closeTime: {
          not: null,
        },
        ...(strategyIds?.length && { strategyId: { in: strategyIds } }),
        ...(symbols?.length && { symbol: { in: symbols } }),
        ...(tradeType && tradeType !== 'ALL' && { 
          type: tradeType === 'BUY' ? 'BUY' : 'SELL' 
        }),
      },
      orderBy: { openTime: 'asc' },
    });

    // Convert to analytics trades
    const analyticsTrades = adaptTradesFromDB(dbTrades);
    const closedTrades = filterClosedTrades(analyticsTrades);

    if (closedTrades.length === 0) {
      return NextResponse.json({
        performance: null,
        message: 'No trades found for the specified criteria'
      });
    }

    // Get strategy names
    const uniqueStrategyIds = [...new Set(closedTrades.map(t => t.strategyId))];
    const strategies = await prisma.strategy.findMany({
      where: { id: { in: uniqueStrategyIds } },
      select: { id: true, name: true }
    });
    
    const strategyNames = new Map(strategies.map(s => [s.id, s.name]));

    // Group trades by strategy and process each
    const tradesByStrategy = new Map<string, typeof closedTrades>();
    closedTrades.forEach(trade => {
      if (!tradesByStrategy.has(trade.strategyId)) {
        tradesByStrategy.set(trade.strategyId, []);
      }
      tradesByStrategy.get(trade.strategyId)!.push(trade);
    });

    const performanceResults = await Promise.all(
      Array.from(tradesByStrategy.entries()).map(async ([strategyId, strategyTrades]) => {
        const strategyName = strategyNames.get(strategyId) || 'Unknown Strategy';
        return performanceProcessor.processStrategyPerformance(
          strategyTrades,
          strategyName,
          filters
        );
      })
    );

    // Calculate overall performance
    const overallPerformance = await performanceProcessor.processStrategyPerformance(
      closedTrades,
      'Combined Strategies',
      filters
    );

    // Sort by performance
    performanceResults.sort((a, b) => b.metrics.totalProfit - a.metrics.totalProfit);

    // Assign ranks
    performanceResults.forEach((result, index) => {
      result.rank = index + 1;
    });

    return NextResponse.json({
      performance: overallPerformance,
      strategyPerformance: performanceResults,
      filters,
      summary: {
        totalStrategies: performanceResults.length,
        totalTrades: overallPerformance.metrics.totalTrades,
        totalProfit: overallPerformance.metrics.totalProfit,
        avgWinRate: performanceResults.reduce((sum, p) => sum + p.metrics.winRate, 0) / performanceResults.length,
        avgSharpeRatio: performanceResults.reduce((sum, p) => sum + p.metrics.sharpeRatio, 0) / performanceResults.length,
        bestStrategy: performanceResults[0],
        worstStrategy: performanceResults[performanceResults.length - 1]
      }
    });

  } catch (error) {
    console.error('Performance analytics POST error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process performance analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}