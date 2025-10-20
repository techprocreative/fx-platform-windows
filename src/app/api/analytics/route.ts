import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

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

    // Fetch real trades from database
    const trades = await prisma.trade.findMany({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: startDate,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Fetch real backtests from database
    const backtests = await prisma.backtest.findMany({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: startDate,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Calculate combined metrics from both trades and backtests
    const totalTrades = trades.length + backtests.length;
    const winningTrades = (
      trades.filter(t => (t.profit || 0) > 0).length +
      backtests.filter(b => {
        const results = b.results as any;
        return (results?.returnPercentage || 0) > 0;
      }).length
    );
    const losingTrades = (
      trades.filter(t => (t.profit || 0) <= 0).length +
      backtests.filter(b => {
        const results = b.results as any;
        return (results?.returnPercentage || 0) <= 0;
      }).length
    );
    
    // Combine profits from both trades and backtests
    const tradeProfits = trades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const backtestReturns = backtests.reduce((sum, b) => {
      const results = b.results as any;
      return sum + (results?.totalReturn || 0);
    }, 0);
    const totalProfit = tradeProfits + backtestReturns;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    // Calculate profit factor
    const tradeWins = trades
      .filter(t => (t.profit || 0) > 0)
      .reduce((sum, t) => sum + (t.profit || 0), 0);
    const backtestWins = backtests
      .filter(b => {
        const results = b.results as any;
        return (results?.returnPercentage || 0) > 0;
      })
      .reduce((sum, b) => {
        const results = b.results as any;
        return sum + (Math.abs(results?.totalReturn || 0));
      }, 0);
    
    const tradeLosses = Math.abs(
      trades
        .filter(t => (t.profit || 0) < 0)
        .reduce((sum, t) => sum + (t.profit || 0), 0)
    );
    const backtestLosses = backtests
      .filter(b => {
        const results = b.results as any;
        return (results?.returnPercentage || 0) < 0;
      })
      .reduce((sum, b) => {
        const results = b.results as any;
        return sum + (Math.abs(results?.totalReturn || 0));
      }, 0);
    
    const totalWinAmount = tradeWins + backtestWins;
    const totalLossAmount = tradeLosses + backtestLosses;
    const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount > 0 ? Infinity : 0;

    // Calculate average win/loss
    const averageWin = winningTrades > 0 ? totalWinAmount / winningTrades : 0;
    const averageLoss = losingTrades > 0 ? totalLossAmount / losingTrades : 0;

    // Calculate drawdown (simplified)
    let maxDrawdown = 0;
    let runningBalance = 10000;
    let peakBalance = 10000;

    trades.forEach(trade => {
      runningBalance += (trade.profit || 0);
      if (runningBalance > peakBalance) {
        peakBalance = runningBalance;
      }
      const drawdown = peakBalance - runningBalance;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    const maxDrawdownPercentage = (maxDrawdown / peakBalance) * 100;

    // Calculate Sharpe ratio (simplified)
    const returns = [];
    for (let i = 1; i < trades.length; i++) {
      const prevBalance = 10000 + trades.slice(0, i).reduce((sum, t) => sum + (t.profit || 0), 0);
      const currBalance = 10000 + trades.slice(0, i + 1).reduce((sum, t) => sum + (t.profit || 0), 0);
      returns.push((currBalance - prevBalance) / prevBalance);
    }

    const avgReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length || 1);
    const sharpeRatio = variance > 0 ? (avgReturn / Math.sqrt(variance)) * Math.sqrt(252) : 0;

    // Group actual data by month (trades + backtests)
    const monthlyData: { month: string; profit: number; trades: number }[] = [];
    const monthlyGroups = new Map<string, { profits: number[]; tradeCount: number }>();

    // Add trades to monthly groups
    trades.forEach(trade => {
      const month = trade.createdAt.toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyGroups.has(month)) {
        monthlyGroups.set(month, { profits: [], tradeCount: 0 });
      }
      monthlyGroups.get(month)!.profits.push(trade.profit || 0);
      monthlyGroups.get(month)!.tradeCount += 1;
    });

    // Add backtests to monthly groups  
    backtests.forEach(backtest => {
      const month = backtest.createdAt.toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyGroups.has(month)) {
        monthlyGroups.set(month, { profits: [], tradeCount: 0 });
      }
      const results = backtest.results as any;
      monthlyGroups.get(month)!.profits.push(results?.totalReturn || 0);
      monthlyGroups.get(month)!.tradeCount += 1;
    });

    monthlyGroups.forEach((data, month) => {
      const monthName = new Date(month + '-01').toLocaleString('default', { month: 'short', year: 'numeric' });
      monthlyData.push({
        month: monthName,
        profit: data.profits.reduce((sum, p) => sum + p, 0),
        trades: data.tradeCount,
      });
    });

    // Fetch real strategy performance from actual backtests
    const strategyBacktests = await prisma.backtest.groupBy({
      by: ['strategyId'],
      where: {
        userId: session.user.id,
        createdAt: {
          gte: startDate,
        },
      },
      _count: { id: true },
    });

    const strategyPerformance = await Promise.all(
      strategyBacktests.map(async (sp) => {
        const strategy = await prisma.strategy.findUnique({
          where: { id: sp.strategyId },
          select: { id: true, name: true },
        });

        const allBacktests = await prisma.backtest.findMany({
          where: {
            userId: session.user.id,
            strategyId: sp.strategyId,
            createdAt: { gte: startDate },
          },
          select: { results: true },
        });

        const winningBacktests = allBacktests.filter(b => {
          const results = b.results as any;
          return (results?.returnPercentage || 0) > 0;
        }).length;

        const totalReturn = allBacktests.reduce((sum, b) => {
          const results = b.results as any;
          return sum + (results?.totalReturn || 0);
        }, 0);

        const totalStratBacktests = sp._count.id;
        const stratWinRate = totalStratBacktests > 0 ? (winningBacktests / totalStratBacktests) * 100 : 0;

        return {
          strategyId: sp.strategyId,
          name: strategy?.name || 'Unknown Strategy',
          profit: totalReturn,
          winRate: stratWinRate,
          trades: totalStratBacktests,
        };
      })
    );

    return NextResponse.json({
      totalTrades,
      winningTrades,
      losingTrades,
      totalProfit: parseFloat(totalProfit.toFixed(2)),
      winRate: parseFloat(winRate.toFixed(2)),
      profitFactor: parseFloat(profitFactor.toFixed(2)),
      maxDrawdown: parseFloat(maxDrawdownPercentage.toFixed(2)),
      averageWin: parseFloat(averageWin.toFixed(2)),
      averageLoss: parseFloat(averageLoss.toFixed(2)),
      sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
      monthlyData: monthlyData.length > 0 ? monthlyData : [{ month: 'No Data', profit: 0, trades: 0 }],
      strategyPerformance,
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}
