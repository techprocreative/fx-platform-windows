import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { z } from 'zod';

const QuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  symbol: z.string().optional(),
  strategyId: z.string().optional(),
  executorId: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = {
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      symbol: searchParams.get('symbol'),
      strategyId: searchParams.get('strategyId'),
      executorId: searchParams.get('executorId'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
    };

    const validated = QuerySchema.parse(query);

    const where: any = {
      userId: session.user.id,
    };

    if (validated.startDate) {
      where.openTime = { ...where.openTime, gte: new Date(validated.startDate) };
    }
    if (validated.endDate) {
      where.openTime = { ...where.openTime, lte: new Date(validated.endDate) };
    }
    if (validated.symbol) {
      where.symbol = validated.symbol;
    }
    if (validated.strategyId) {
      where.strategyId = validated.strategyId;
    }
    if (validated.executorId) {
      where.executorId = validated.executorId;
    }

    const limit = validated.limit ? parseInt(validated.limit) : 50;
    const offset = validated.offset ? parseInt(validated.offset) : 0;

    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where,
        include: {
          strategy: { select: { name: true } },
          executor: { select: { name: true } },
        },
        orderBy: { openTime: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.trade.count({ where }),
    ]);

    const stats = {
      totalTrades: total,
      totalProfit: trades.reduce((sum, t) => sum + (t.profit || 0), 0),
      winningTrades: trades.filter(t => (t.profit || 0) > 0).length,
      losingTrades: trades.filter(t => (t.profit || 0) < 0).length,
    };

    return NextResponse.json({
      trades,
      stats,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Trades API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
