import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { AppError, handleApiError } from '@/lib/errors';
import { revalidateStrategiesCache } from '@/lib/cache/query-cache';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

export const dynamic = 'force-dynamic';

const strategyUpdateSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  rules: z.object({}).passthrough().optional(),
  isPublic: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      throw new AppError(401, 'Unauthorized');
    }

    const strategyPromise = prisma.strategy.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
        deletedAt: null,
      },
      include: {
        trades: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        backtests: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        versions: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            trades: true,
            backtests: true,
            versions: true,
          },
        },
      },
    });

    const strategy = await strategyPromise;

    if (!strategy) {
      throw new AppError(404, 'Strategy not found', 'STRATEGY_NOT_FOUND');
    }

    return NextResponse.json(strategy);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      throw new AppError(401, 'Unauthorized');
    }

    const body = await req.json();
    const validation = strategyUpdateSchema.safeParse(body);

    if (!validation.success) {
      throw new AppError(
        400,
        'Validation error',
        'VALIDATION_ERROR',
        validation.error.flatten().fieldErrors
      );
    }

    const strategy = await prisma.strategy.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
        deletedAt: null,
      },
    });

    if (!strategy) {
      throw new AppError(404, 'Strategy not found', 'STRATEGY_NOT_FOUND');
    }

    if (validation.data.rules) {
      await prisma.strategyVersion.create({
        data: {
          strategyId: params.id,
          version: strategy.version + 1,
          rules: strategy.rules as any,
          description: `Version ${strategy.version} snapshot`,
        },
      });
    }

    const updated = await prisma.strategy.update({
      where: { id: params.id },
      data: {
        ...validation.data,
        version: validation.data.rules ? strategy.version + 1 : strategy.version,
      },
      include: {
        trades: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        backtests: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        versions: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            trades: true,
            backtests: true,
            versions: true,
          },
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        eventType: 'STRATEGY_UPDATED',
        metadata: {
          strategyId: params.id,
          changes: Object.keys(validation.data),
        },
      },
    });

    await revalidateStrategiesCache();

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      throw new AppError(401, 'Unauthorized');
    }

    const strategy = await prisma.strategy.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
        deletedAt: null,
      },
    });

    if (!strategy) {
      throw new AppError(404, 'Strategy not found', 'STRATEGY_NOT_FOUND');
    }

    await prisma.strategy.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        eventType: 'STRATEGY_DELETED',
        metadata: {
          strategyId: params.id,
          name: strategy.name,
        },
      },
    });

    await revalidateStrategiesCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
