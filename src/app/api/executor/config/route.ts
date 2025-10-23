/**
 * Executor Configuration Endpoint
 *
 * GET /api/executor/config
 *
 * This endpoint returns the complete configuration needed by Windows Executor
 * based on API credentials (key + secret).
 *
 * Used by executor during setup to auto-provision Pusher credentials and platform config.
 * Eliminates the need for users to manually input technical details.
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AppError, handleApiError } from '@/lib/errors';

// Validation schema for environment variables
const envSchema = z.object({
  NEXTAUTH_URL: z.string().url('Invalid NEXTAUTH_URL'),
  NEXT_PUBLIC_PUSHER_KEY: z.string().min(1, 'Pusher key not configured'),
  NEXT_PUBLIC_PUSHER_CLUSTER: z.string().min(1, 'Pusher cluster not configured'),
});

/**
 * Rate limiting per executor (simple in-memory implementation)
 * In production, use Redis or database-backed rate limiting
 */
const configRequestCache = new Map<string, { timestamp: number; count: number }>();

function checkRateLimit(executorId: string, windowMs = 60000, maxRequests = 10): boolean {
  const now = Date.now();
  const record = configRequestCache.get(executorId);

  if (!record) {
    configRequestCache.set(executorId, { timestamp: now, count: 1 });
    return true;
  }

  if (now - record.timestamp > windowMs) {
    configRequestCache.set(executorId, { timestamp: now, count: 1 });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

export const dynamic = 'force-dynamic';

/**
 * GET /api/executor/config
 *
 * Returns platform configuration for executor
 *
 * Headers:
 *   X-API-Key: Executor API key
 *   X-API-Secret: Executor API secret
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Extract and validate API credentials from headers
    const apiKey = req.headers.get('x-api-key');
    const apiSecret = req.headers.get('x-api-secret');

    if (!apiKey || !apiSecret) {
      throw new AppError(
        401,
        'API credentials required in headers (X-API-Key, X-API-Secret)',
        'MISSING_CREDENTIALS'
      );
    }

    // Validate API key format (should start with 'exe_' for executor keys)
    if (!apiKey.startsWith('exe_')) {
      throw new AppError(
        400,
        'Invalid API key format. Executor keys should start with "exe_"',
        'INVALID_API_KEY_FORMAT'
      );
    }

    // 2. Find executor by API key
    const executor = await prisma.executor.findFirst({
      where: {
        apiKey,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        apiSecretHash: true,
        status: true,
        userId: true,
        createdAt: true,
        lastHeartbeat: true,
      },
    });

    if (!executor) {
      throw new AppError(
        404,
        'Executor not found or invalid API key',
        'EXECUTOR_NOT_FOUND'
      );
    }

    // 3. Check rate limiting per executor
    if (!checkRateLimit(executor.id)) {
      throw new AppError(
        429,
        'Too many config requests. Please wait before trying again.',
        'RATE_LIMIT_EXCEEDED'
      );
    }

    // 4. Verify API secret with bcrypt comparison
    let isValidSecret = false;
    try {
      isValidSecret = await bcrypt.compare(apiSecret, executor.apiSecretHash);
    } catch (error) {
      console.error('Error comparing API secret:', error);
      throw new AppError(
        500,
        'Internal error during credential verification',
        'VERIFICATION_ERROR'
      );
    }

    if (!isValidSecret) {
      // Log failed attempts for security monitoring
      console.warn(`Failed config request attempt for executor: ${executor.id}`);
      throw new AppError(
        401,
        'Invalid API secret',
        'INVALID_CREDENTIALS'
      );
    }

    // 5. Validate environment variables
    const envValidation = envSchema.safeParse(process.env);
    if (!envValidation.success) {
      console.error('Invalid environment configuration:', envValidation.error);
      throw new AppError(
        500,
        'Server configuration incomplete',
        'CONFIG_ERROR'
      );
    }

    const { NEXTAUTH_URL, NEXT_PUBLIC_PUSHER_KEY, NEXT_PUBLIC_PUSHER_CLUSTER } = envValidation.data;

    // 6. Build executor configuration object
    const executorConfig = {
      // Executor Identity
      executorId: executor.id,
      executorName: executor.name,

      // Platform URLs
      platformUrl: NEXTAUTH_URL,

      // Pusher Real-time Configuration (AUTO-FILLED from server)
      pusherKey: NEXT_PUBLIC_PUSHER_KEY,
      pusherCluster: NEXT_PUBLIC_PUSHER_CLUSTER,

      // ZeroMQ Configuration
      zmqPort: 5555,
      zmqHost: 'tcp://localhost',

      // Connection Settings
      heartbeatInterval: 60, // seconds
      heartbeatTimeout: 120, // seconds
      commandTimeout: 30000, // milliseconds
      connectionTimeout: 10000, // milliseconds

      // Retry Configuration
      autoReconnect: true,
      retryAttempts: 5,
      retryBackoffMs: 2000,
      maxReconnectAttempts: 10,

      // Feature Flags
      features: {
        autoInstallEA: true,
        autoAttachEA: true,
        safetyChecks: true,
        monitoring: true,
        logging: true,
      },

      // Server Metadata
      serverTime: new Date().toISOString(),
      executorCreatedAt: executor.createdAt.toISOString(),
      executorStatus: executor.status,
    };

    // 7. Log successful config fetch for auditing
    console.log(`Config fetched for executor: ${executor.id} (${executor.name})`);

    // 8. Return successful response
    return NextResponse.json(
      {
        success: true,
        config: executorConfig,
        metadata: {
          requestProcessingTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    // Log the error for debugging
    if (error instanceof AppError) {
      console.warn(`Config request error [${error.code}]: ${error.message}`);
    } else {
      console.error('Unexpected error in config endpoint:', error);
    }

    return handleApiError(error);
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'X-API-Key, X-API-Secret, Content-Type',
    },
  });
}
