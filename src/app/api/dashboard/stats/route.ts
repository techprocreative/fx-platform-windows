import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    export async function GET(req: NextRequest) {
  try {
    // Check for demo user header
    const isDemoRequest = req.headers.get('x-demo-user') === 'true';
    
    const session = await getServerSession(authOptions);

    if (!session?.user?.id && !isDemoRequest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch real stats if authenticated
    const [activeStrategies, trades] = await Promise.all([
      prisma.strategy.count({
        where: {
          userId: session.user.id,
          status: 'active',
          deletedAt: null,
        },
      }),
      prisma.trade.findMany({
        where: {
          userId: session.user.id,
        },
        orderBy: { createdAt: 'desc' },
        take: 1000, // Get last 1000 trades for calculations
      }),
    ]);

    const totalProfit = trades.reduce((sum: number, trade: any) => sum + (trade.profit || 0), 0);
    const winningTrades = trades.filter((t: any) => (t.profit || 0) > 0).length;
    const totalTrades = trades.length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    // If no real activity, return demo data
    if (totalTrades === 0 && activeStrategies === 0) {
      const demoStats = {
        activeStrategies: 1,
        totalTrades: 0,
        totalProfit: 0,
        winRate: 0,
      };

      return NextResponse.json({
        ...demoStats,
        demo: true,
      });
    }

    return NextResponse.json({
      activeStrategies,
      totalTrades,
      totalProfit: parseFloat(totalProfit.toFixed(2)),
      winRate: parseFloat(winRate.toFixed(2)),
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    console.error('Dashboard stats error:', error);
    console.error('Stack trace:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
      }),
    ]);

    const totalProfit = trades.reduce((sum: number, trade: any) => sum + (trade.profit || 0), 0);
    const winningTrades = trades.filter((t: any) => t.profit && t.profit > 0).length;
    const winRate = trades.length > 0 ? (winningTrades / trades.length) * 100 : 0;

    return NextResponse.json({
      activeStrategies,
      totalTrades: trades.length,
      totalProfit: parseFloat(totalProfit.toFixed(2)),
      winRate: parseFloat(winRate.toFixed(2)),
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
