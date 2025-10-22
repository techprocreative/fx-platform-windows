import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { prisma } from '../../../../../lib/prisma';
import { AppError, handleApiError } from '@/lib/errors';
import { broadcastStatusUpdate } from '@/lib/pusher/server';

export const dynamic = 'force-dynamic';

// Heartbeat data schema
const heartbeatSchema = z.object({
  status: z.enum(['online', 'offline', 'error']).optional(),
  metadata: z
    .object({
      version: z.string().optional(),
      platform: z.string().optional(),
      accountBalance: z.number().optional(),
      accountEquity: z.number().optional(),
      openPositions: z.number().optional(),
      cpuUsage: z.number().optional(),
      memoryUsage: z.number().optional(),
    })
    .optional(),
});

/**
 * POST /api/executor/[id]/heartbeat
 * Update executor heartbeat and status
 * This endpoint is called by the executor application to keep connection alive
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get API credentials from headers
    const apiKey = req.headers.get('x-api-key');
    const apiSecret = req.headers.get('x-api-secret');

    if (!apiKey || !apiSecret) {
      throw new AppError(401, 'API credentials required', 'MISSING_CREDENTIALS');
    }

    // Find executor by API key
    const executor = await prisma.executor.findFirst({
      where: {
        id: params.id,
        apiKey,
        deletedAt: null,
      },
    });

    if (!executor) {
      throw new AppError(404, 'Executor not found', 'EXECUTOR_NOT_FOUND');
    }

    // Verify API secret
    const isValidSecret = await bcrypt.compare(apiSecret, executor.apiSecretHash);
    if (!isValidSecret) {
      throw new AppError(401, 'Invalid API credentials', 'INVALID_CREDENTIALS');
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const validation = heartbeatSchema.safeParse(body);

    if (!validation.success) {
      throw new AppError(
        400,
        'Validation error',
        'VALIDATION_ERROR',
        validation.error.flatten().fieldErrors
      );
    }

    const { status, metadata } = validation.data;

    // Update executor heartbeat
    const updatedExecutor = await prisma.executor.update({
      where: { id: params.id },
      data: {
        lastHeartbeat: new Date(),
        ...(status && { status }),
        updatedAt: new Date(),
      },
    });

    // Broadcast status update to all listeners via Pusher
    await broadcastStatusUpdate({
      executorId: params.id,
      status: status || updatedExecutor.status,
      timestamp: new Date().toISOString(),
    });

    // Store metadata if provided (could be used for monitoring)
    if (metadata) {
      // You could store this in a separate table or in executor's metadata field
      // For now, we'll just acknowledge it
      console.log(`Executor ${executor.name} metadata:`, metadata);
    }

    // Check for pending commands
    const pendingCommands = await prisma.command.findMany({
      where: {
        executorId: params.id,
        status: 'pending',
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 10, // Return up to 10 commands per heartbeat
    });

    // Mark commands as acknowledged
    if (pendingCommands.length > 0) {
      await prisma.command.updateMany({
        where: {
          id: { in: pendingCommands.map((c) => c.id) },
          status: 'pending',
        },
        data: {
          acknowledgedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      executor: {
        id: updatedExecutor.id,
        name: updatedExecutor.name,
        status: updatedExecutor.status,
        lastHeartbeat: updatedExecutor.lastHeartbeat,
      },
      pendingCommands: pendingCommands.map((cmd) => ({
        id: cmd.id,
        command: cmd.command,
        parameters: cmd.parameters,
        priority: cmd.priority,
        createdAt: cmd.createdAt,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
