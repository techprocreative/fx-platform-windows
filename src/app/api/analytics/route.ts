import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { adaptTradesFromDB, filterClosedTrades } from '@/lib/analytics/adapters';
import {
  calculateTradeAnalytics,
  calculateBacktestAnalytics,
  calculateStrategyPerformance,
} from '@/lib/analytics/analytics-service';
import { BacktestResults, isBacktestResults } from '@/types/backtest';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '6M';
    
    // Calculate date range based on timeframe
    const now = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
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

    // Fetch real trades from database (use openTime for filtering)
    const dbTrades = await prisma.trade.findMany({
      where: {
        userId: session.user.id,
        openTime: {
          gte: startDate,
        },
        closeTime: {
          not: null, // Only closed trades for analytics
        },
      },
      orderBy: { openTime: 'asc' },
    });

    // Fetch completed backtests from database
    const backtests = await prisma.backtest.findMany({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: startDate,
        },
        status: 'completed',
      },
      include: {
        strategy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Convert DB trades to Analytics trades
    const analyticsTrades = adaptTradesFromDB(dbTrades);
    const closedTrades = filterClosedTrades(analyticsTrades);

    // Calculate analytics from trades
    const tradeAnalytics = calculateTradeAnalytics(closedTrades, 10000);
    
    // Calculate analytics from backtests
    const backtestAnalytics = calculateBacktestAnalytics(backtests);
    
    // Use trade analytics if we have real trades, otherwise use backtest analytics
    const analytics = closedTrades.length > 0 ? tradeAnalytics : backtestAnalytics;
    
    // Build strategy names map
    const strategyNames = new Map<string, string>();
    backtests.forEach(b => {
      if (b.strategy) {
        strategyNames.set(b.strategyId, b.strategy.name);
      }
    });
    
    // Fetch strategy names for trades
    if (closedTrades.length > 0) {
      const strategyIds = [...new Set(closedTrades.map(t => t.strategyId))];
      const strategies = await prisma.strategy.findMany({
        where: {
          id: { in: strategyIds },
        },
        select: {
          id: true,
          name: true,
        },
      });
      
      strategies.forEach(s => {
        strategyNames.set(s.id, s.name);
      });
    }
    
    // Calculate strategy performance from real trades
    const strategyPerformance = calculateStrategyPerformance(
      closedTrades,
      strategyNames
    );

    // Return analytics data
    return NextResponse.json({
      totalTrades: analytics.totalTrades,
      winningTrades: analytics.winningTrades,
      losingTrades: analytics.losingTrades,
      totalProfit: parseFloat(analytics.totalProfit.toFixed(2)),
      winRate: parseFloat(analytics.winRate.toFixed(2)),
      profitFactor: analytics.profitFactor === Infinity ? 9999 : parseFloat(analytics.profitFactor.toFixed(2)),
      maxDrawdown: parseFloat(analytics.maxDrawdownPercent.toFixed(2)),
      averageWin: parseFloat(analytics.averageWin.toFixed(2)),
      averageLoss: parseFloat(analytics.averageLoss.toFixed(2)),
      sharpeRatio: parseFloat(analytics.sharpeRatio.toFixed(2)),
      monthlyData: analytics.monthlyData.length > 0 
        ? analytics.monthlyData.map(m => ({
            month: m.month,
            profit: parseFloat(m.profit.toFixed(2)),
            trades: m.trades,
          }))
        : [{ month: 'No Data', profit: 0, trades: 0 }],
      strategyPerformance: strategyPerformance.map(sp => ({
        strategyId: sp.strategyId,
        name: sp.name,
        profit: parseFloat(sp.profit.toFixed(2)),
        winRate: parseFloat(sp.winRate.toFixed(2)),
        trades: sp.trades,
      })),
      // Equity curve for charts
      equityCurve: analytics.equityCurve.map(point => ({
        timestamp: point.timestamp,
        equity: parseFloat(point.equity.toFixed(2)),
        date: point.date,
      })),
      // Additional metadata for debugging
      source: analytics.source,
      hasRealTrades: closedTrades.length > 0,
      hasBacktests: backtests.length > 0,
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch analytics data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
