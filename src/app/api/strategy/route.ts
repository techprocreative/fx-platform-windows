import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { AppError, handleApiError } from '@/lib/errors';
import {
  STRATEGY_LIST_INCLUDE,
  revalidateStrategiesCache,
} from '@/lib/cache/query-cache';

import type { Prisma } from '@prisma/client';

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
      throw new AppError(401, 'Unauthorized');
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const symbol = url.searchParams.get('symbol');
    const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.StrategyWhereInput = {
      userId: session.user.id,
      deletedAt: null,
      ...(status && status !== 'all' ? { status } : {}),
      ...(symbol ? { symbol: symbol.toUpperCase() } : {}),
    };

    const strategiesPromise = prisma.strategy.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: STRATEGY_LIST_INCLUDE,
    });

    const [strategies, total] = await Promise.all([
      strategiesPromise,
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
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      throw new AppError(401, 'Unauthorized');
    }

    const body = await req.json();

    const validation = strategyCreateSchema.safeParse(body);
    if (!validation.success) {
      throw new AppError(
        400,
        'Validation error',
        'VALIDATION_ERROR',
        validation.error.flatten().fieldErrors
      );
    }

    const { name, description, symbol, timeframe, type, rules, isPublic } = validation.data;

    const [existingCount] = await Promise.all([
      prisma.strategy.count({
        where: {
          userId: session.user.id,
          deletedAt: null,
        },
      }),
    ]);

    if (existingCount >= 100) {
      throw new AppError(409, 'Strategy limit reached. Upgrade your plan.', 'STRATEGY_LIMIT');
    }

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

    await revalidateStrategiesCache();

    return NextResponse.json(strategy, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
