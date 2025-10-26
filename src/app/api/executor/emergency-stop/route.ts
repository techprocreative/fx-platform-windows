/**
 * Emergency Stop API Endpoint
 * 
 * Triggers emergency stop command to ALL executors.
 * This is a critical operation that should be used with caution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { AppError, handleApiError } from '@/lib/errors';
import { applyRateLimit } from '@/lib/middleware/rate-limit-middleware';
import { triggerEmergencyStop } from '@/lib/pusher/server';

export const dynamic = 'force-dynamic';

const emergencyStopSchema = z.object({
  reason: z.string().min(1).max(500),
});

/**
 * POST /api/executor/emergency-stop
 * Trigger emergency stop to all executors
 */
export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting (stricter for emergency operations)
    const rateLimitResponse = await applyRateLimit(req, 'api' as any);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(401, 'Unauthorized');
    }

    const body = await req.json();
    const validation = emergencyStopSchema.safeParse(body);

    if (!validation.success) {
      throw new AppError(
        400,
        'Validation error',
        'VALIDATION_ERROR',
        validation.error.flatten().fieldErrors
      );
    }

    const { reason } = validation.data;

    // Get all user's executors
    const executors = await prisma.executor.findMany({
      where: {
        userId: session.user.id,
        deletedAt: null,
      },
    });

    if (executors.length === 0) {
      throw new AppError(404, 'No executors found', 'NO_EXECUTORS');
    }

    // Create emergency stop command for each executor
    const commandPromises = executors.map((executor) =>
      prisma.command.create({
        data: {
          userId: session.user.id,
          executorId: executor.id,
          command: 'EMERGENCY_STOP',
          parameters: { reason },
          priority: 'URGENT',
          status: 'pending',
        },
      })
    );

    const commands = await Promise.all(commandPromises);

    // Broadcast emergency stop via Pusher
    await triggerEmergencyStop({
      userId: session.user.id,
      reason,
      timestamp: new Date().toISOString(),
    });

    // Log critical activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        eventType: 'EMERGENCY_STOP',
        metadata: {
          reason,
          executorCount: executors.length,
          commandIds: commands.map((c) => c.id),
        },
      },
    });

    // Also create audit log for security
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'EMERGENCY_STOP_TRIGGERED',
        eventType: 'EMERGENCY_STOP_TRIGGERED',
        result: 'success',
        metadata: {
          reason,
          executorCount: executors.length,
          timestamp: new Date().toISOString(),
        },
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        timestamp: new Date(),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: `Emergency stop sent to ${executors.length} executor(s)`,
        executors: executors.map((e) => ({
          id: e.id,
          name: e.name,
        })),
        commands: commands.map((c) => ({
          id: c.id,
          executorId: c.executorId,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
