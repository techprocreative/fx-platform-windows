import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { AppError, handleApiError } from '@/lib/errors';
import { applyRateLimit } from '@/lib/middleware/rate-limit-middleware';

export const dynamic = 'force-dynamic';

// Validation schema for executor creation
const executorCreateSchema = z.object({
  name: z.string().min(3).max(100),
  platform: z.enum(['MT5', 'MT4']),
  brokerServer: z.string().optional(),
  accountNumber: z.string().optional(),
});

// Validation schema for executor update
const executorUpdateSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  platform: z.enum(['MT5', 'MT4']).optional(),
  brokerServer: z.string().optional(),
  accountNumber: z.string().optional(),
  status: z.enum(['online', 'offline', 'error']).optional(),
});

/**
 * Generate secure API key and secret
 */
function generateApiCredentials(): { apiKey: string; secretKey: string } {
  const apiKey = `exe_${crypto.randomBytes(16).toString('hex')}`;
  const secretKey = crypto.randomBytes(32).toString('hex');
  return { apiKey, secretKey };
}

/**
 * GET /api/executor
 * List all executors for the authenticated user
 */
export async function GET(req: NextRequest) {
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

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const platform = url.searchParams.get('platform');
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true';

    // Build where clause
    const where: any = {
      userId: session.user.id,
      ...(status && { status }),
      ...(platform && { platform }),
      ...(!includeDeleted && { deletedAt: null }),
    };

    // Fetch executors
    const executors = await prisma.executor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            trades: true,
            commands: true,
          },
        },
      },
    });

    // Calculate connection status (offline if no heartbeat in last 5 minutes)
    const now = new Date();
    const executorsWithStatus = executors.map((executor) => {
      const isConnected = executor.lastHeartbeat
        ? now.getTime() - new Date(executor.lastHeartbeat).getTime() < 5 * 60 * 1000
        : false;

      return {
        ...executor,
        isConnected,
        apiSecretHash: undefined, // Don't expose secret hash
      };
    });

    // Get statistics
    const stats = {
      total: executors.length,
      online: executorsWithStatus.filter((e) => e.isConnected).length,
      offline: executorsWithStatus.filter((e) => !e.isConnected).length,
      byPlatform: {
        MT5: executors.filter((e) => e.platform === 'MT5').length,
        MT4: executors.filter((e) => e.platform === 'MT4').length,
      },
    };

    return NextResponse.json({
      executors: executorsWithStatus,
      stats,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/executor
 * Create a new executor
 */
export async function POST(req: NextRequest) {
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
    const validation = executorCreateSchema.safeParse(body);

    if (!validation.success) {
      throw new AppError(
        400,
        'Validation error',
        'VALIDATION_ERROR',
        validation.error.flatten().fieldErrors
      );
    }

    const { name, platform, brokerServer, accountNumber } = validation.data;

    // Check executor limit (max 5 per user for now)
    const executorCount = await prisma.executor.count({
      where: {
        userId: session.user.id,
        deletedAt: null,
      },
    });

    if (executorCount >= 5) {
      throw new AppError(
        403,
        'Executor limit reached (maximum 5 executors per account)',
        'EXECUTOR_LIMIT'
      );
    }

    // Check for duplicate name
    const existingExecutor = await prisma.executor.findFirst({
      where: {
        userId: session.user.id,
        name,
        deletedAt: null,
      },
    });

    if (existingExecutor) {
      throw new AppError(
        409,
        'An executor with this name already exists',
        'DUPLICATE_NAME'
      );
    }

    // Generate API credentials
    const { apiKey, secretKey } = generateApiCredentials();
    const secretHash = await bcrypt.hash(secretKey, 10);

    // Create executor
    const executor = await prisma.executor.create({
      data: {
        userId: session.user.id,
        name,
        platform,
        brokerServer,
        accountNumber,
        apiKey,
        apiSecretHash: secretHash,
        status: 'offline',
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        eventType: 'EXECUTOR_CREATED',
        metadata: {
          executorId: executor.id,
          name: executor.name,
          platform: executor.platform,
        },
      },
    });

    // Return executor with credentials (only shown once)
    return NextResponse.json(
      {
        executor: {
          ...executor,
          secretKey, // Only returned on creation
          apiSecretHash: undefined, // Don't expose hash
        },
        message:
          '⚠️ Save these credentials securely. The secret key will not be shown again!',
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
