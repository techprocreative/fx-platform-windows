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
        take: 1000,
      }),
    ]);

    const totalProfit = trades.reduce((sum: number, trade: any) => sum + (trade.profit || 0), 0);
    const winningTrades = trades.filter((t: any) => (t.profit || 0) > 0).length;
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
