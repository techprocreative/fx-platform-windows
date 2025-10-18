import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const strategyCreateSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().optional(),
  symbol: z.string().min(3).max(20),
  timeframe: z.enum(['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1']),
  type: z.enum(['manual', 'ai_generated', 'imported']).default('manual'),
  rules: z.object({}).passthrough(), // JSON object
  isPublic: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const symbol = url.searchParams.get('symbol');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const skip = (page - 1) * limit;

    const where: any = {
      userId: session.user.id,
      deletedAt: null,
    };

    if (status && status !== 'all') {
      where.status = status;
    }

    if (symbol) {
      where.symbol = symbol.toUpperCase();
    }

    const [strategies, total] = await Promise.all([
      prisma.strategy.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.strategy.count({ where }),
    ]);

    return NextResponse.json({
      strategies,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (error) {
    console.error('Strategy GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch strategies' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Validate input
    const validation = strategyCreateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, description, symbol, timeframe, type, rules, isPublic } =
      validation.data;

    // Check user subscription limits (MVP: no limits)
    const existingCount = await prisma.strategy.count({
      where: {
        userId: session.user.id,
        deletedAt: null,
      },
    });

    if (existingCount >= 100) {
      return NextResponse.json(
        { error: 'Strategy limit reached. Upgrade your plan.' },
        { status: 409 }
      );
    }

    // Create strategy
    const strategy = await prisma.strategy.create({
      data: {
        userId: session.user.id,
        name,
        description,
        symbol: symbol.toUpperCase(),
        timeframe,
        type,
        rules,
        isPublic,
        status: 'draft',
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        eventType: 'STRATEGY_CREATED',
        metadata: {
          strategyId: strategy.id,
          name: strategy.name,
        },
      },
    });

    return NextResponse.json(strategy, { status: 201 });
  } catch (error) {
    console.error('Strategy POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create strategy' },
      { status: 500 }
    );
  }
}
