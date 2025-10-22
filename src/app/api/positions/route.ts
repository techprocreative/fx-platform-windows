// API Route: GET /api/positions
// Get all open positions from all executors

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all user's executors
    const executors = await prisma.executor.findMany({
      where: {
        userId: session.user.id,
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        platform: true,
        accountBalance: true,
        accountEquity: true,
        status: true
      }
    });

    // Get all open trades (positions) from user's executors
    const openTrades = await prisma.trade.findMany({
      where: {
        userId: session.user.id,
        closeTime: null, // Open positions only
        executorId: {
          in: executors.map(e => e.id)
        }
      },
      include: {
        strategy: {
          select: {
            name: true,
            symbol: true
          }
        },
        executor: {
          select: {
            name: true,
            platform: true
          }
        }
      },
      orderBy: {
        openTime: 'desc'
      }
    });

    // Calculate aggregated statistics
    const totalPositions = openTrades.length;
    const totalProfit = openTrades.reduce((sum, trade) => {
      // Calculate current P/L if not set
      const currentPL = trade.profit || 0;
      return sum + currentPL;
    }, 0);

    const profitablePositions = openTrades.filter(t => (t.profit || 0) > 0).length;
    const losingPositions = openTrades.filter(t => (t.profit || 0) < 0).length;
    const breakevenPositions = totalPositions - profitablePositions - losingPositions;

    // Calculate total exposure by symbol
    const exposureBySymbol: Record<string, { long: number; short: number; net: number }> = {};
    
    openTrades.forEach(trade => {
      const symbol = trade.symbol;
      if (!exposureBySymbol[symbol]) {
        exposureBySymbol[symbol] = { long: 0, short: 0, net: 0 };
      }
      
      const lots = trade.lots || 0;
      if (trade.type === 'BUY') {
        exposureBySymbol[symbol].long += lots;
        exposureBySymbol[symbol].net += lots;
      } else if (trade.type === 'SELL') {
        exposureBySymbol[symbol].short += lots;
        exposureBySymbol[symbol].net -= lots;
      }
    });

    // Calculate account statistics
    const totalBalance = executors.reduce((sum, e) => sum + (e.accountBalance || 0), 0);
    const totalEquity = executors.reduce((sum, e) => sum + (e.accountEquity || 0), 0);
    const totalMargin = totalBalance - totalEquity;
    const freeMargin = totalEquity - totalMargin;

    // Transform trades to position format
    const positions = openTrades.map(trade => ({
      id: trade.id,
      ticket: trade.ticket,
      symbol: trade.symbol,
      type: trade.type,
      lots: trade.lots,
      openPrice: trade.openPrice,
      currentPrice: trade.closePrice || trade.openPrice, // Will be updated by executor
      openTime: trade.openTime,
      profit: trade.profit || 0,
      pips: trade.pips || 0,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      commission: trade.commission || 0,
      swap: trade.swap || 0,
      strategy: {
        name: trade.strategy?.name || 'Unknown',
        symbol: trade.strategy?.symbol || trade.symbol
      },
      executor: {
        name: trade.executor?.name || 'Unknown',
        platform: trade.executor?.platform || 'MT5'
      },
      duration: Math.floor((Date.now() - new Date(trade.openTime).getTime()) / 1000), // seconds
      profitPercent: totalBalance > 0 ? ((trade.profit || 0) / totalBalance * 100) : 0
    }));

    // Calculate P&L report
    const pnlReport = {
      totalProfit,
      totalPositions,
      profitablePositions,
      losingPositions,
      breakevenPositions,
      winRate: totalPositions > 0 ? (profitablePositions / totalPositions * 100) : 0,
      averageProfit: profitablePositions > 0 
        ? openTrades.filter(t => (t.profit || 0) > 0).reduce((sum, t) => sum + (t.profit || 0), 0) / profitablePositions
        : 0,
      averageLoss: losingPositions > 0
        ? Math.abs(openTrades.filter(t => (t.profit || 0) < 0).reduce((sum, t) => sum + (t.profit || 0), 0)) / losingPositions
        : 0,
      largestWin: Math.max(...openTrades.map(t => t.profit || 0), 0),
      largestLoss: Math.min(...openTrades.map(t => t.profit || 0), 0),
      totalCommission: openTrades.reduce((sum, t) => sum + (t.commission || 0), 0),
      totalSwap: openTrades.reduce((sum, t) => sum + (t.swap || 0), 0)
    };

    // Account summary
    const accountSummary = {
      balance: totalBalance,
      equity: totalEquity,
      margin: totalMargin,
      freeMargin: freeMargin,
      marginLevel: totalMargin > 0 ? (totalEquity / totalMargin * 100) : 0,
      profitLoss: totalProfit,
      profitLossPercent: totalBalance > 0 ? (totalProfit / totalBalance * 100) : 0
    };

    return NextResponse.json({
      success: true,
      positions,
      pnlReport,
      accountSummary,
      exposureBySymbol,
      executors: executors.map(e => ({
        id: e.id,
        name: e.name,
        status: e.status,
        positions: positions.filter(p => p.executor.name === e.name).length
      }))
    });

  } catch (error: any) {
    console.error('❌ Get positions API error:', error);
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
