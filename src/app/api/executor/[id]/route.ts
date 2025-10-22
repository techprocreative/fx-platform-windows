import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { AppError, handleApiError } from '@/lib/errors';
import { applyRateLimit } from '@/lib/middleware/rate-limit-middleware';

export const dynamic = 'force-dynamic';

// Validation schema for executor update
const executorUpdateSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  platform: z.enum(['MT5', 'MT4']).optional(),
  brokerServer: z.string().optional(),
  accountNumber: z.string().optional(),
  status: z.enum(['online', 'offline', 'error']).optional(),
});

/**
 * Validate executor ownership
 */
async function validateExecutorOwnership(executorId: string, userId: string) {
  const executor = await prisma.executor.findFirst({
    where: {
      id: executorId,
      userId,
      deletedAt: null,
    },
    include: {
      _count: {
        select: {
          trades: true,
          commands: true,
        },
      },
    },
  });

  if (!executor) {
    throw new AppError(404, 'Executor not found', 'EXECUTOR_NOT_FOUND');
  }

  return executor;
}

/**
 * GET /api/executor/[id]
 * Get executor details
 */
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

    const executor = await validateExecutorOwnership(params.id, session.user.id);

    // Calculate connection status
    const now = new Date();
    const isConnected = executor.lastHeartbeat
      ? now.getTime() - new Date(executor.lastHeartbeat).getTime() < 5 * 60 * 1000
      : false;

    // Get recent trades
    const recentTrades = await prisma.trade.findMany({
      where: {
        executorId: params.id,
        userId: session.user.id,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        strategy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Get recent commands
    const recentCommands = await prisma.command.findMany({
      where: {
        executorId: params.id,
        userId: session.user.id,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      executor: {
        ...executor,
        isConnected,
        apiSecretHash: undefined, // Don't expose secret hash
      },
      recentTrades,
      recentCommands,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/executor/[id]
 * Update executor
 */
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

    // Validate ownership
    await validateExecutorOwnership(params.id, session.user.id);

    const body = await req.json();
    const validation = executorUpdateSchema.safeParse(body);

    if (!validation.success) {
      throw new AppError(
        400,
        'Validation error',
        'VALIDATION_ERROR',
        validation.error.flatten().fieldErrors
      );
    }

    // Check for duplicate name if name is being changed
    if (validation.data.name) {
      const existingExecutor = await prisma.executor.findFirst({
        where: {
          userId: session.user.id,
          name: validation.data.name,
          deletedAt: null,
          id: { not: params.id },
        },
      });

      if (existingExecutor) {
        throw new AppError(
          409,
          'An executor with this name already exists',
          'DUPLICATE_NAME'
        );
      }
    }

    // Update executor
    const executor = await prisma.executor.update({
      where: { id: params.id },
      data: {
        ...validation.data,
        updatedAt: new Date(),
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        eventType: 'EXECUTOR_UPDATED',
        metadata: {
          executorId: executor.id,
          changes: Object.keys(validation.data),
        },
      },
    });

    return NextResponse.json({
      executor: {
        ...executor,
        apiSecretHash: undefined,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/executor/[id]
 * Soft delete executor
 */
export async function DELETE(
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

    // Validate ownership
    const executor = await validateExecutorOwnership(params.id, session.user.id);

    // Check if executor is currently online
    const now = new Date();
    const isConnected = executor.lastHeartbeat
      ? now.getTime() - new Date(executor.lastHeartbeat).getTime() < 5 * 60 * 1000
      : false;

    if (isConnected) {
      throw new AppError(
        400,
        'Cannot delete an online executor. Please disconnect it first.',
        'EXECUTOR_ONLINE'
      );
    }

    // Check for open trades
    const openTrades = await prisma.trade.count({
      where: {
        executorId: params.id,
        closePrice: null,
      },
    });

    if (openTrades > 0) {
      throw new AppError(
        400,
        `Cannot delete executor with ${openTrades} open trade(s). Please close all trades first.`,
        'OPEN_TRADES_EXIST'
      );
    }

    // Soft delete
    await prisma.executor.update({
      where: { id: params.id },
      data: {
        deletedAt: new Date(),
        status: 'offline',
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        eventType: 'EXECUTOR_DELETED',
        metadata: {
          executorId: params.id,
          name: executor.name,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Executor deleted successfully',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
