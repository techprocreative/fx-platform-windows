import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { adaptTradesFromDB, filterClosedTrades, groupTradesByMonth } from '@/lib/analytics/adapters';
import { PerformanceTrend, TimeFrame, AnalyticsFilters } from '@/types';

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
    const metric = searchParams.get('metric') || 'profit';
    const period = searchParams.get('period') || 'monthly'; // daily, weekly, monthly, quarterly

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
        startDate = new Date(0);
        break;
    }

    // Build filters
    const filters: AnalyticsFilters = {
      timeFrame: timeframe,
      strategies: strategyId ? [strategyId] : [],
      symbols: symbol ? [symbol] : [],
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
          not: null,
        },
        ...(strategyId && { strategyId }),
        ...(symbol && { symbol }),
      },
      orderBy: { openTime: 'asc' },
    });

    // Convert to analytics trades
    const analyticsTrades = adaptTradesFromDB(dbTrades);
    const closedTrades = filterClosedTrades(analyticsTrades);

    if (closedTrades.length === 0) {
      return NextResponse.json({
        trends: [],
        message: 'No trades found for the specified criteria'
      });
    }

    // Calculate trends based on period
    let trends: PerformanceTrend[] = [];
    
    switch (period) {
      case 'daily':
        trends = calculateDailyTrends(closedTrades, metric);
        break;
      case 'weekly':
        trends = calculateWeeklyTrends(closedTrades, metric);
        break;
      case 'monthly':
        trends = calculateMonthlyTrends(closedTrades, metric);
        break;
      case 'quarterly':
        trends = calculateQuarterlyTrends(closedTrades, metric);
        break;
      default:
        trends = calculateMonthlyTrends(closedTrades, metric);
    }

    // Calculate trend direction and change
    trends = calculateTrendChanges(trends);

    return NextResponse.json({
      trends,
      filters,
      summary: {
        totalPeriods: trends.length,
        averageValue: trends.reduce((sum, t) => sum + t.value, 0) / trends.length,
        totalChange: trends.length > 0 ? trends[trends.length - 1].change : 0,
        totalChangePercent: trends.length > 0 ? trends[trends.length - 1].changePercent : 0,
        trendDirection: trends.length > 1 ? 
          (trends[trends.length - 1].value > trends[0].value ? 'up' : 
           trends[trends.length - 1].value < trends[0].value ? 'down' : 'stable') : 'stable'
      }
    });

  } catch (error) {
    console.error('Trends analytics API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch trends analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function calculateDailyTrends(trades: any[], metric: string): PerformanceTrend[] {
  const dailyData = new Map<string, any[]>();
  
  // Group trades by day
  trades.forEach(trade => {
    const day = trade.exitTime.toISOString().split('T')[0]; // YYYY-MM-DD
    if (!dailyData.has(day)) {
      dailyData.set(day, []);
    }
    dailyData.get(day)!.push(trade);
  });

  const trends: PerformanceTrend[] = [];
  const sortedDays = Array.from(dailyData.keys()).sort();

  sortedDays.forEach(day => {
    const dayTrades = dailyData.get(day)!;
    const value = calculateMetricValue(dayTrades, metric);
    
    trends.push({
      period: day,
      metric,
      value,
      change: 0, // Will be calculated later
      changePercent: 0, // Will be calculated later
      trend: 'stable' // Will be calculated later
    });
  });

  return trends;
}

function calculateWeeklyTrends(trades: any[], metric: string): PerformanceTrend[] {
  const weeklyData = new Map<string, any[]>();
  
  // Group trades by week
  trades.forEach(trade => {
    const date = new Date(trade.exitTime);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0]; // YYYY-MM-DD of week start
    
    if (!weeklyData.has(weekKey)) {
      weeklyData.set(weekKey, []);
    }
    weeklyData.get(weekKey)!.push(trade);
  });

  const trends: PerformanceTrend[] = [];
  const sortedWeeks = Array.from(weeklyData.keys()).sort();

  sortedWeeks.forEach(week => {
    const weekTrades = weeklyData.get(week)!;
    const value = calculateMetricValue(weekTrades, metric);
    
    trends.push({
      period: `Week of ${week}`,
      metric,
      value,
      change: 0,
      changePercent: 0,
      trend: 'stable'
    });
  });

  return trends;
}

function calculateMonthlyTrends(trades: any[], metric: string): PerformanceTrend[] {
  const tradesByMonth = groupTradesByMonth(trades);
  const trends: PerformanceTrend[] = [];

  tradesByMonth.forEach((monthTrades, monthStr) => {
    const value = calculateMetricValue(monthTrades, metric);
    
    // Format month name
    const [year, month] = monthStr.split('-');
    const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { 
      month: 'short', 
      year: 'numeric' 
    });
    
    trends.push({
      period: monthName,
      metric,
      value,
      change: 0,
      changePercent: 0,
      trend: 'stable'
    });
  });

  return trends.sort((a, b) => a.period.localeCompare(b.period));
}

function calculateQuarterlyTrends(trades: any[], metric: string): PerformanceTrend[] {
  const quarterlyData = new Map<string, any[]>();
  
  // Group trades by quarter
  trades.forEach(trade => {
    const date = new Date(trade.exitTime);
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    const quarterKey = `${date.getFullYear()}-Q${quarter}`;
    
    if (!quarterlyData.has(quarterKey)) {
      quarterlyData.set(quarterKey, []);
    }
    quarterlyData.get(quarterKey)!.push(trade);
  });

  const trends: PerformanceTrend[] = [];
  const sortedQuarters = Array.from(quarterlyData.keys()).sort();

  sortedQuarters.forEach(quarter => {
    const quarterTrades = quarterlyData.get(quarter)!;
    const value = calculateMetricValue(quarterTrades, metric);
    
    trends.push({
      period: quarter,
      metric,
      value,
      change: 0,
      changePercent: 0,
      trend: 'stable'
    });
  });

  return trends;
}

function calculateMetricValue(trades: any[], metric: string): number {
  switch (metric) {
    case 'profit':
      return trades.reduce((sum, trade) => sum + trade.profit, 0);
    
    case 'winRate':
      if (trades.length === 0) return 0;
      const winningTrades = trades.filter(t => t.profit > 0).length;
      return (winningTrades / trades.length) * 100;
    
    case 'tradeCount':
      return trades.length;
    
    case 'averageWin':
      const wins = trades.filter(t => t.profit > 0);
      return wins.length > 0 ? wins.reduce((sum, t) => sum + t.profit, 0) / wins.length : 0;
    
    case 'averageLoss':
      const losses = trades.filter(t => t.profit <= 0);
      return losses.length > 0 ? losses.reduce((sum, t) => sum + t.profit, 0) / losses.length : 0;
    
    case 'profitFactor':
      const totalWin = trades.filter(t => t.profit > 0).reduce((sum, t) => sum + t.profit, 0);
      const totalLoss = Math.abs(trades.filter(t => t.profit <= 0).reduce((sum, t) => sum + t.profit, 0));
      return totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0;
    
    case 'averageTrade':
      if (trades.length === 0) return 0;
      const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0);
      return totalProfit / trades.length;
    
    case 'sharpeRatio':
      // Simplified Sharpe ratio calculation
      if (trades.length < 2) return 0;
      const returns = trades.map(t => t.profit / 10000); // Assuming 10k base
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
      const stdDev = Math.sqrt(variance);
      return stdDev === 0 ? 0 : avgReturn / stdDev * Math.sqrt(252);
    
    default:
      return 0;
  }
}

function calculateTrendChanges(trends: PerformanceTrend[]): PerformanceTrend[] {
  if (trends.length === 0) return trends;
  
  // Calculate change from previous period
  for (let i = 0; i < trends.length; i++) {
    if (i === 0) {
      trends[i].change = 0;
      trends[i].changePercent = 0;
      trends[i].trend = 'stable';
    } else {
      const currentValue = trends[i].value;
      const previousValue = trends[i - 1].value;
      
      trends[i].change = currentValue - previousValue;
      trends[i].changePercent = previousValue !== 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;
      
      // Determine trend direction
      const changeThreshold = Math.abs(previousValue) * 0.05; // 5% threshold
      if (Math.abs(trends[i].change) < changeThreshold) {
        trends[i].trend = 'stable';
      } else if (trends[i].change > 0) {
        trends[i].trend = 'up';
      } else {
        trends[i].trend = 'down';
      }
    }
  }
  
  return trends;
}