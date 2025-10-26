import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { AppError, handleApiError } from '@/lib/errors';
import { applyRateLimit } from '@/lib/middleware/rate-limit-middleware';
import { SharedSecretManager } from '@/lib/auth/shared-secret';
import { AuditLogger, AuditAction } from '@/lib/audit/audit-logger';
import { BETA_CONFIG } from '@/config/beta.config';

export const dynamic = 'force-dynamic';

// Validation schema for executor creation
const executorCreateSchema = z.object({
  name: z.string().min(3).max(100),
  platform: z.enum(['MT5', 'MT4']),
  // Note: brokerServer and accountNumber are optional and should be populated
  // automatically by the Windows executor app via heartbeat, not by user input
  brokerServer: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
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

    // Check executor limit (use beta config if enabled)
    const maxExecutors = BETA_CONFIG.enabled 
      ? BETA_CONFIG.accounts.maxActiveExecutors 
      : 5;
      
    const executorCount = await prisma.executor.count({
      where: {
        userId: session.user.id,
        deletedAt: null,
      },
    });

    if (executorCount >= maxExecutors) {
      throw new AppError(
        403,
        `Executor limit reached (maximum ${maxExecutors} executors${BETA_CONFIG.enabled ? ' during beta' : ''})`,
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
    
    // Generate shared secret for EA-Executor communication
    const sharedSecret = SharedSecretManager.generateSharedSecret(
      apiKey, // Use apiKey as part of seed
      secretKey
    );

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
        sharedSecret, // Store shared secret for validation
        status: 'offline',
      },
    });

    // Log to audit system
    await AuditLogger.logExecutor(
      AuditAction.API_KEY_CREATED,
      session.user.id,
      executor.id,
      {
        executorName: executor.name,
        platform: executor.platform,
        betaMode: BETA_CONFIG.enabled,
      }
    );

    // Return executor with credentials (only shown once)
    return NextResponse.json(
      {
        executor: {
          ...executor,
          secretKey, // Only returned on creation
          sharedSecret, // Only returned on creation - for EA configuration
          apiSecretHash: undefined, // Don't expose hash
        },
        message:
          '⚠️ Save these credentials securely. The secret key and shared secret will not be shown again!',
        betaMode: BETA_CONFIG.enabled,
        betaLimits: BETA_CONFIG.enabled ? BETA_CONFIG.limits : null,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
