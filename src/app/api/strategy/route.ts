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
import { rateLimit } from '@/lib/middleware/rate-limit';
import { AuditLogger, AuditAction } from '@/lib/audit/audit-logger';

import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const strategyCreateSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().optional(),
  symbol: z.string().min(3).max(20),
  timeframe: z.enum(['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1']),
  type: z.enum(['manual', 'automated', 'ai_generated', 'imported']).default('manual'),
  rules: z.object({}).passthrough(), // JSON object
  isPublic: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      throw new AppError(401, 'Unauthorized');
    }
    
    // Apply rate limiting
    const rateLimitResponse = await rateLimit(req, session.user.id);
    if (rateLimitResponse) return rateLimitResponse;

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const symbol = url.searchParams.get('symbol');
    const search = url.searchParams.get('search');
    const sortBy = url.searchParams.get('sortBy') || 'createdAt';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';
    const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const skip = (page - 1) * limit;

    // Build where clause with optimized queries
    const where: Prisma.StrategyWhereInput = {
      userId: session.user.id,
      deletedAt: null,
      ...(status && status !== 'all' ? { status } : {}),
      ...(symbol ? { symbol: symbol.toUpperCase() } : {}),
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { symbol: { contains: search.toUpperCase(), mode: 'insensitive' } },
        ],
      } : {}),
    };

    // Build order by clause
    const orderBy: Prisma.StrategyOrderByWithRelationInput = {};
    if (sortBy === 'name') {
      orderBy.name = sortOrder as 'asc' | 'desc';
    } else if (sortBy === 'symbol') {
      orderBy.symbol = sortOrder as 'asc' | 'desc';
    } else if (sortBy === 'status') {
      orderBy.status = sortOrder as 'asc' | 'desc';
    } else {
      orderBy.createdAt = sortOrder as 'asc' | 'desc';
    }

    // Optimized query with proper indexing
    const strategiesPromise = prisma.strategy.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: STRATEGY_LIST_INCLUDE,
    });

    // Count query with optimized where clause
    const totalPromise = prisma.strategy.count({ where });

    // Additional stats queries (optimized with specific selects)
    const statsPromise = prisma.strategy.groupBy({
      by: ['status'],
      where: {
        userId: session.user.id,
        deletedAt: null,
      },
      _count: {
        status: true,
      },
    });

    const [strategies, total, stats] = await Promise.all([
      strategiesPromise,
      totalPromise,
      statsPromise,
    ]);

    // Process stats into a more usable format
    const statusCounts = stats.reduce((acc, stat) => {
      acc[stat.status] = stat._count.status;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      strategies,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      stats: {
        byStatus: statusCounts,
        total,
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
    
    // Apply rate limiting
    const rateLimitResponse = await rateLimit(req, session.user.id);
    if (rateLimitResponse) return rateLimitResponse;

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
