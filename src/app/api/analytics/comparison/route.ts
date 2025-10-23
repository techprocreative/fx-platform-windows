import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { performanceProcessor } from '@/lib/analytics/performance-processor';
import { adaptTradesFromDB, filterClosedTrades } from '@/lib/analytics/adapters';
import { AnalyticsComparison, ComparisonItem, ComparisonResult, AnalyticsFilters, TimeFrame } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'strategy';
    const timeframe = (searchParams.get('timeframe') as TimeFrame) || '6M';
    const metrics = searchParams.get('metrics')?.split(',') || ['totalProfit', 'winRate', 'sharpeRatio', 'maxDrawdownPercent'];

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
      strategies: [],
      symbols: [],
      dateRange: {
        start: startDate,
        end: now
      }
    };

    let items: ComparisonItem[] = [];
    let comparisonData: AnalyticsComparison;

    switch (type) {
      case 'strategy':
        items = await getStrategyComparisonItems(session.user.id, startDate);
        break;
      case 'symbol':
        items = await getSymbolComparisonItems(session.user.id, startDate);
        break;
      case 'timeframe':
        items = getTimeframeComparisonItems();
        break;
      default:
        return NextResponse.json({ error: 'Invalid comparison type' }, { status: 400 });
    }

    if (items.length === 0) {
      return NextResponse.json({
        comparison: null,
        message: 'No items found for comparison'
      });
    }

    // Get performance data for each item
    const results: ComparisonResult[] = [];
    
    for (const item of items) {
      let performanceData;
      
      switch (item.type) {
        case 'strategy':
          performanceData = await getStrategyPerformance(session.user.id, item.id, filters);
          break;
        case 'symbol':
          performanceData = await getSymbolPerformance(session.user.id, item.id, filters);
          break;
        case 'timeframe':
          performanceData = await getTimeframePerformance(session.user.id, item.id, filters);
          break;
        default:
          continue;
      }
      
      if (performanceData) {
        const result = createComparisonResult(item, performanceData, metrics);
        results.push(result);
      }
    }

    // Sort results by overall score
    results.sort((a, b) => b.score - a.score);
    
    // Assign ranks
    results.forEach((result, index) => {
      result.rank = index + 1;
    });

    // Create comparison object
    comparisonData = {
      id: `comparison_${Date.now()}`,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Comparison`,
      type: type as any,
      items,
      metrics,
      period: {
        start: startDate,
        end: now
      },
      results,
      createdAt: new Date()
    };

    return NextResponse.json({
      comparison: comparisonData,
      summary: {
        totalItems: results.length,
        bestPerformer: results[0],
        worstPerformer: results[results.length - 1],
        averageScores: calculateAverageScores(results, metrics),
        insights: generateComparisonInsights(results, metrics)
      }
    });

  } catch (error) {
    console.error('Comparison analytics API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch comparison analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function getStrategyComparisonItems(userId: string, startDate: Date): Promise<ComparisonItem[]> {
  // Get strategies with trades in the period
  const strategiesWithTrades = await prisma.trade.findMany({
    where: {
      userId,
      openTime: {
        gte: startDate,
      },
      closeTime: {
        not: null,
      },
    },
    select: {
      strategyId: true,
    },
    distinct: ['strategyId'],
  });

  const strategyIds = strategiesWithTrades.map(t => t.strategyId);

  if (strategyIds.length === 0) return [];

  const strategies = await prisma.strategy.findMany({
    where: {
      id: { in: strategyIds },
      userId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  return strategies.map(strategy => ({
    id: strategy.id,
    name: strategy.name,
    type: 'strategy' as const,
    metadata: {}
  }));
}

async function getSymbolComparisonItems(userId: string, startDate: Date): Promise<ComparisonItem[]> {
  // Get symbols with trades in the period
  const symbolsWithTrades = await prisma.trade.findMany({
    where: {
      userId,
      openTime: {
        gte: startDate,
      },
      closeTime: {
        not: null,
      },
    },
    select: {
      symbol: true,
    },
    distinct: ['symbol'],
  });

  const symbols = [...new Set(symbolsWithTrades.map(t => t.symbol))];

  return symbols.map(symbol => ({
    id: symbol,
    name: symbol,
    type: 'symbol' as const,
    metadata: {}
  }));
}

function getTimeframeComparisonItems(): ComparisonItem[] {
  const timeframes = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'];
  
  return timeframes.map(timeframe => ({
    id: timeframe,
    name: timeframe,
    type: 'timeframe' as const,
    metadata: {}
  }));
}

async function getStrategyPerformance(userId: string, strategyId: string, filters: AnalyticsFilters) {
  const dbTrades = await prisma.trade.findMany({
    where: {
      userId,
      strategyId,
      openTime: {
        gte: filters.dateRange!.start,
      },
      closeTime: {
        not: null,
      },
    },
    orderBy: { openTime: 'asc' },
  });

  const analyticsTrades = adaptTradesFromDB(dbTrades);
  const closedTrades = filterClosedTrades(analyticsTrades);

  if (closedTrades.length === 0) return null;

  const strategy = await prisma.strategy.findUnique({
    where: { id: strategyId },
    select: { name: true }
  });

  return performanceProcessor.processStrategyPerformance(
    closedTrades,
    strategy?.name || 'Unknown Strategy',
    filters
  );
}

async function getSymbolPerformance(userId: string, symbol: string, filters: AnalyticsFilters) {
  const dbTrades = await prisma.trade.findMany({
    where: {
      userId,
      symbol,
      openTime: {
        gte: filters.dateRange!.start,
      },
      closeTime: {
        not: null,
      },
    },
    orderBy: { openTime: 'asc' },
  });

  const analyticsTrades = adaptTradesFromDB(dbTrades);
  const closedTrades = filterClosedTrades(analyticsTrades);

  if (closedTrades.length === 0) return null;

  return performanceProcessor.processStrategyPerformance(
    closedTrades,
    `${symbol} Trading`,
    filters
  );
}

async function getTimeframePerformance(userId: string, timeframe: string, filters: AnalyticsFilters) {
  // For timeframe comparison, we'd need to filter trades by timeframe
  // This is a simplified implementation
  const dbTrades = await prisma.trade.findMany({
    where: {
      userId,
      openTime: {
        gte: filters.dateRange!.start,
      },
      closeTime: {
        not: null,
      },
    },
    orderBy: { openTime: 'asc' },
  });

  const analyticsTrades = adaptTradesFromDB(dbTrades);
  const closedTrades = filterClosedTrades(analyticsTrades);

  if (closedTrades.length === 0) return null;

  return performanceProcessor.processStrategyPerformance(
    closedTrades,
    `${timeframe} Timeframe`,
    filters
  );
}

function createComparisonResult(item: ComparisonItem, performanceData: any, metrics: string[]): ComparisonResult {
  const metricsData: Record<string, number> = {};
  
  metrics.forEach(metric => {
    switch (metric) {
      case 'totalProfit':
        metricsData[metric] = performanceData.metrics.totalProfit;
        break;
      case 'winRate':
        metricsData[metric] = performanceData.metrics.winRate;
        break;
      case 'sharpeRatio':
        metricsData[metric] = performanceData.metrics.sharpeRatio;
        break;
      case 'maxDrawdownPercent':
        metricsData[metric] = performanceData.metrics.maxDrawdownPercent;
        break;
      case 'profitFactor':
        metricsData[metric] = performanceData.metrics.profitFactor;
        break;
      case 'totalTrades':
        metricsData[metric] = performanceData.metrics.totalTrades;
        break;
      case 'averageWin':
        metricsData[metric] = performanceData.metrics.averageWin;
        break;
      case 'averageLoss':
        metricsData[metric] = performanceData.metrics.averageLoss;
        break;
      default:
        metricsData[metric] = 0;
    }
  });

  // Calculate overall score (weighted average)
  const weights: Record<string, number> = {
    totalProfit: 0.3,
    winRate: 0.25,
    sharpeRatio: 0.2,
    maxDrawdownPercent: 0.15, // Lower is better, will be inverted
    profitFactor: 0.1
  };

  let score = 0;
  let totalWeight = 0;

  metrics.forEach(metric => {
    const weight = weights[metric] || 0.1;
    let normalizedValue = metricsData[metric];

    // Normalize values to 0-100 scale
    if (metric === 'maxDrawdownPercent') {
      // Lower drawdown is better
      normalizedValue = Math.max(0, 100 - normalizedValue);
    } else if (metric === 'winRate') {
      // Already in percentage
      normalizedValue = Math.min(100, normalizedValue);
    } else if (metric === 'sharpeRatio') {
      // Normalize Sharpe ratio (assuming 0-5 range)
      normalizedValue = Math.min(100, normalizedValue * 20);
    } else if (metric === 'profitFactor') {
      // Normalize profit factor (assuming 0-5 range)
      normalizedValue = Math.min(100, normalizedValue * 20);
    } else if (metric === 'totalProfit') {
      // Normalize profit (assuming -1000 to 10000 range)
      normalizedValue = Math.max(0, Math.min(100, (normalizedValue + 1000) / 110));
    } else {
      // Generic normalization
      normalizedValue = Math.min(100, Math.max(0, normalizedValue));
    }

    score += normalizedValue * weight;
    totalWeight += weight;
  });

  score = totalWeight > 0 ? score / totalWeight : 0;

  // Generate strengths and weaknesses
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (metricsData.winRate >= 60) strengths.push('High win rate');
  if (metricsData.winRate < 40) weaknesses.push('Low win rate');
  
  if (metricsData.sharpeRatio >= 2) strengths.push('Excellent risk-adjusted returns');
  if (metricsData.sharpeRatio < 1) weaknesses.push('Poor risk-adjusted returns');
  
  if (metricsData.maxDrawdownPercent <= 10) strengths.push('Low drawdown risk');
  if (metricsData.maxDrawdownPercent > 20) weaknesses.push('High drawdown risk');
  
  if (metricsData.profitFactor >= 2) strengths.push('Strong profit factor');
  if (metricsData.profitFactor < 1.5) weaknesses.push('Weak profit factor');

  return {
    itemId: item.id,
    metrics: metricsData,
    rank: 0, // Will be assigned later
    score,
    strengths,
    weaknesses
  };
}

function calculateAverageScores(results: ComparisonResult[], metrics: string[]): Record<string, number> {
  const averages: Record<string, number> = {};
  
  metrics.forEach(metric => {
    const total = results.reduce((sum, result) => sum + result.metrics[metric], 0);
    averages[metric] = results.length > 0 ? total / results.length : 0;
  });

  return averages;
}

function generateComparisonInsights(results: ComparisonResult[], metrics: string[]): string[] {
  const insights: string[] = [];

  if (results.length === 0) return insights;

  const best = results[0];
  const worst = results[results.length - 1];

  insights.push(`Best performer: ${best.itemId} with a score of ${best.score.toFixed(1)}`);
  
  if (results.length > 1) {
    insights.push(`Worst performer: ${worst.itemId} with a score of ${worst.score.toFixed(1)}`);
    
    const scoreDiff = best.score - worst.score;
    insights.push(`Performance gap: ${scoreDiff.toFixed(1)} points (${(scoreDiff / worst.score * 100).toFixed(1)}% difference)`);
  }

  // Metric-specific insights
  if (metrics.includes('winRate')) {
    const avgWinRate = results.reduce((sum, r) => sum + r.metrics.winRate, 0) / results.length;
    const highWinRateCount = results.filter(r => r.metrics.winRate >= 50).length;
    insights.push(`${highWinRateCount}/${results.length} items have win rates above 50% (average: ${avgWinRate.toFixed(1)}%)`);
  }

  if (metrics.includes('sharpeRatio')) {
    const avgSharpe = results.reduce((sum, r) => sum + r.metrics.sharpeRatio, 0) / results.length;
    const goodSharpeCount = results.filter(r => r.metrics.sharpeRatio >= 1).length;
    insights.push(`${goodSharpeCount}/${results.length} items have acceptable risk-adjusted returns (average Sharpe: ${avgSharpe.toFixed(2)})`);
  }

  if (metrics.includes('maxDrawdownPercent')) {
    const avgDrawdown = results.reduce((sum, r) => sum + r.metrics.maxDrawdownPercent, 0) / results.length;
    const lowDrawdownCount = results.filter(r => r.metrics.maxDrawdownPercent <= 15).length;
    insights.push(`${lowDrawdownCount}/${results.length} items have controlled drawdown (average: ${avgDrawdown.toFixed(1)}%)`);
  }

  return insights;
}