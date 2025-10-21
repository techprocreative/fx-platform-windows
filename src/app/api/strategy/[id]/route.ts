import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { AppError, handleApiError } from '@/lib/errors';
import { revalidateStrategiesCache } from '@/lib/cache/query-cache';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { applyRateLimit } from '@/lib/middleware/rate-limit-middleware';

/**
 * Enhanced ownership validation helper
 * Ensures user can only access their own strategies with additional security checks
 */
async function validateStrategyOwnership(
  strategyId: string,
  userId: string,
  operation: 'read' | 'update' | 'delete' = 'read'
): Promise<{ strategy: any; user: any }> {
  // First, validate user exists and is not locked
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      locked: true,
      lockedUntil: true,
      failedLoginAttempts: true
    }
  });

  if (!user) {
    throw new AppError(401, 'User not found', 'USER_NOT_FOUND');
  }

  if (user.locked && user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(403, 'User account is locked', 'USER_LOCKED');
  }

  if (!user.emailVerified) {
    throw new AppError(403, 'Email not verified', 'EMAIL_NOT_VERIFIED');
  }

  // Simple ownership validation - no admin role in current schema
  const strategy = await prisma.strategy.findFirst({
    where: {
      id: strategyId,
      userId: userId,
      deletedAt: null,
    },
    include: {
      user: {
        select: { id: true, email: true }
      }
    }
  });

  if (!strategy) {
    // Log potential security breach attempt
    await prisma.auditLog.create({
      data: {
        userId: userId,
        eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        result: 'denied',
        metadata: {
          strategyId,
          operation,
        },
        ipAddress: 'unknown',
        timestamp: new Date(),
      },
    });

    throw new AppError(404, 'Strategy not found', 'STRATEGY_NOT_FOUND');
  }

  // Additional security check: ensure user owns the strategy
  if (strategy.userId !== userId) {
    // Log potential security breach attempt
    await prisma.auditLog.create({
      data: {
        userId: userId,
        eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        result: 'denied',
        metadata: {
          strategyId,
          targetUserId: strategy.userId,
          operation,
        },
        ipAddress: 'unknown',
        timestamp: new Date(),
      },
    });

    throw new AppError(403, 'Access denied: You do not own this strategy', 'ACCESS_DENIED');
  }

  // Log successful access for sensitive operations
  if (operation === 'update' || operation === 'delete') {
    await prisma.auditLog.create({
      data: {
        userId: userId,
        eventType: `STRATEGY_${operation.toUpperCase()}_ATTEMPT`,
        result: 'success',
        metadata: {
          strategyId,
          strategyName: strategy.name,
          operation,
        },
        ipAddress: 'unknown',
        timestamp: new Date(),
      },
    });
  }

  return { strategy, user };
}

export const dynamic = 'force-dynamic';

const strategyUpdateSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  rules: z.object({}).passthrough().optional(),
  isPublic: z.boolean().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await applyRateLimit(req, 'api' as any);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      throw new AppError(401, 'Unauthorized');
    }

    // Enhanced ownership validation
    const { strategy } = await validateStrategyOwnership(params.id, session.user.id, 'read');

    // Get full strategy details with relationships
    const fullStrategy = await prisma.strategy.findUnique({
      where: { id: params.id },
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

    return NextResponse.json(fullStrategy);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await applyRateLimit(req, 'api' as any);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

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

    // Enhanced ownership validation
    const { strategy } = await validateStrategyOwnership(params.id, session.user.id, 'update');

    // Additional validation for critical fields
    if (validation.data.isPublic !== undefined) {
      // Log attempt to change visibility (for audit purposes)
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          eventType: 'STRATEGY_VISIBILITY_CHANGE',
          result: 'success',
          metadata: {
            strategyId: params.id,
            isPublic: validation.data.isPublic,
          },
          ipAddress: 'unknown',
          timestamp: new Date(),
        },
      });
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
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      throw new AppError(401, 'Unauthorized');
    }

    // Enhanced ownership validation
    const { strategy } = await validateStrategyOwnership(params.id, session.user.id, 'delete');

    // Additional validation: prevent deletion of active strategies with open trades
    const activeTrades = await prisma.trade.count({
      where: {
        strategyId: params.id,
        closePrice: null, // Open trades have no close price
      },
    });

    if (activeTrades > 0) {
      throw new AppError(
        400,
        'Cannot delete strategy with open trades',
        'ACTIVE_TRADES_EXIST',
        { activeTrades }
      );
    }

    // Additional validation: prevent deletion of recently created strategies (grace period)
    const recentlyCreated = new Date(strategy.createdAt);
    recentlyCreated.setHours(recentlyCreated.getHours() + 1); // 1 hour grace period
    
    if (new Date() < recentlyCreated) {
      throw new AppError(
        400,
        'Cannot delete strategy created within the last hour',
        'GRACE_PERIOD_ACTIVE',
        { createdAt: strategy.createdAt }
      );
    }

    // Additional validation: prevent deletion if there are running backtests
    const runningBacktests = await prisma.backtest.count({
      where: {
        strategyId: params.id,
        status: 'running',
      },
    });

    if (runningBacktests > 0) {
      throw new AppError(
        400,
        'Cannot delete strategy with running backtests',
        'RUNNING_BACKTESTS_EXIST',
        { runningBacktests }
      );
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
