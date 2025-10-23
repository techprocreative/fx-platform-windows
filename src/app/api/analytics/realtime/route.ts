import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { performanceProcessor } from '@/lib/analytics/performance-processor';
import { adaptTradesFromDB, filterClosedTrades } from '@/lib/analytics/adapters';
import { RealTimePerformanceData, MarketStatus } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current date
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch open positions
    const openPositions = await prisma.trade.findMany({
      where: {
        userId: session.user.id,
        closeTime: null, // Only open trades
      },
      orderBy: { openTime: 'desc' },
    });

    // Fetch today's closed trades
    const closedTradesToday = await prisma.trade.findMany({
      where: {
        userId: session.user.id,
        closeTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { closeTime: 'desc' },
    });

    // Calculate current equity (simplified)
    const initialBalance = 10000; // This should come from user settings
    const totalProfit = closedTradesToday.reduce((sum, trade) => sum + (trade.profit || 0), 0);
    // For demo purposes, we'll calculate unrealized P&L based on current market prices
    // In a real implementation, this would come from a market data feed
    const unrealizedPnL = openPositions.reduce((sum, position) => {
      // Simulate current price (in a real app, this would come from market data)
      const currentPrice = position.openPrice * (1 + (Math.random() - 0.5) * 0.01);
      const profit = (currentPrice - position.openPrice) * position.lots * 100000 * (position.type === 'BUY' ? 1 : -1);
      return sum + profit;
    }, 0);
    const currentEquity = initialBalance + totalProfit + unrealizedPnL;

    // Get market status
    const marketStatus = getMarketStatus();

    // Generate alerts based on current performance
    const alerts = generatePerformanceAlerts({
      dailyPnL: totalProfit,
      dailyDrawdown: calculateDailyDrawdown(currentEquity, totalProfit + unrealizedPnL),
      openPositions: openPositions.length,
      closedTrades: closedTradesToday.length
    });

    // Get active strategies
    const activeStrategies = [...new Set(openPositions.map(p => p.strategyId))];

    const realTimeData: RealTimePerformanceData = {
      timestamp: now,
      currentEquity,
      dailyPnL: totalProfit,
      dailyDrawdown: calculateDailyDrawdown(currentEquity, totalProfit + unrealizedPnL),
      openPositions: openPositions.map(position => {
        // Simulate current price (in a real app, this would come from market data)
        const currentPrice = position.openPrice * (1 + (Math.random() - 0.5) * 0.01);
        const profit = (currentPrice - position.openPrice) * position.lots * 100000 * (position.type === 'BUY' ? 1 : -1);
        const profitPercent = ((currentPrice - position.openPrice) / position.openPrice) * 100 * (position.type === 'BUY' ? 1 : -1);
        
        return {
          tradeId: position.id,
          strategyId: position.strategyId,
          symbol: position.symbol,
          direction: position.type as 'BUY' | 'SELL',
          entryPrice: position.openPrice,
          currentPrice,
          volume: position.lots,
          unrealizedPnL: profit,
          unrealizedPnLPercent: profitPercent,
          duration: position.openTime ? Math.floor((now.getTime() - position.openTime.getTime()) / (1000 * 60)) : 0,
          stopLoss: position.stopLoss || undefined,
          takeProfit: position.takeProfit || undefined
        };
      }),
      closedTradesToday: closedTradesToday.filter(trade => trade.closeTime).map(trade => {
        // Calculate profit percent if not available
        const profitPercent = trade.profit && trade.openPrice
          ? (trade.profit / (trade.openPrice * trade.lots * 100000)) * 100
          : 0;
          
        return {
          tradeId: trade.id,
          strategyId: trade.strategyId,
          symbol: trade.symbol,
          direction: trade.type as 'BUY' | 'SELL',
          entryPrice: trade.openPrice,
          exitPrice: trade.closePrice!,
          volume: trade.lots,
          profit: trade.profit || 0,
          profitPercent,
          duration: trade.openTime && trade.closeTime
            ? Math.floor((trade.closeTime.getTime() - trade.openTime.getTime()) / (1000 * 60))
            : 0,
          entryTime: trade.openTime,
          exitTime: trade.closeTime!
        };
      }),
      activeStrategies,
      marketStatus,
      alerts
    };

    return NextResponse.json(realTimeData);

  } catch (error) {
    console.error('Real-time analytics API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch real-time analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function getMarketStatus(): MarketStatus {
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
  
  // Calculate next open and close times
  const nextOpen = calculateNextOpen(now, session);
  const nextClose = calculateNextClose(now, session);
  
  return {
    session,
    isOpen,
    volatility: 'normal', // Would be calculated from market data
    spread: 1.2, // Would be fetched from market data
    nextOpen,
    nextClose
  };
}

function calculateNextOpen(now: Date, currentSession: string): Date {
  // Simplified calculation
  const nextOpen = new Date(now);
  nextOpen.setUTCHours(22, 0, 0, 0);
  if (nextOpen <= now) {
    nextOpen.setUTCDate(nextOpen.getUTCDate() + 1);
  }
  return nextOpen;
}

function calculateNextClose(now: Date, currentSession: string): Date {
  // Simplified calculation
  const nextClose = new Date(now);
  nextClose.setUTCHours(21, 0, 0, 0);
  if (nextClose <= now) {
    nextClose.setUTCDate(nextClose.getUTCDate() + 1);
  }
  return nextClose;
}

function calculateDailyDrawdown(currentEquity: number, dailyPnL: number): number {
  const startOfDayEquity = currentEquity - dailyPnL;
  return startOfDayEquity > 0 ? ((startOfDayEquity - currentEquity) / startOfDayEquity) * 100 : 0;
}

function generatePerformanceAlerts(metrics: {
  dailyPnL: number;
  dailyDrawdown: number;
  openPositions: number;
  closedTrades: number;
}) {
  const alerts: any[] = [];
  
  // Daily loss alert
  if (metrics.dailyPnL < -500) {
    alerts.push({
      id: `alert_${Date.now()}_daily_loss`,
      type: 'daily_loss' as const,
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
      type: 'drawdown' as const,
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
      type: 'position_size' as const,
      severity: 'medium' as const,
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