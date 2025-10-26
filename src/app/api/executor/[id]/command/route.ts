import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { AppError, handleApiError } from '@/lib/errors';
import { applyRateLimit } from '@/lib/middleware/rate-limit-middleware';
import { triggerExecutorCommand, notifyUserExecution } from '@/lib/pusher/server';

export const dynamic = 'force-dynamic';

// Command schema
const commandSchema = z.object({
  command: z.enum([
    'STOP_ALL',
    'PAUSE',
    'RESUME',
    'CLOSE_ALL_POSITIONS',
    'CLOSE_POSITION',
    'OPEN_POSITION',
    'MODIFY_POSITION',
    'GET_STATUS',
    'RESTART',
    'START_STRATEGY',     // NEW: Start executing a strategy
    'STOP_STRATEGY',      // NEW: Stop executing a strategy
    'PAUSE_STRATEGY',     // NEW: Pause strategy execution
    'RESUME_STRATEGY',    // NEW: Resume strategy execution
    'UPDATE_STRATEGY',    // NEW: Update strategy rules
    'CLOSE_PROFITABLE',   // NEW: Close all profitable positions
    'CLOSE_LOSING',       // NEW: Close all losing positions
    'CLOSE_BY_STRATEGY',  // NEW: Close positions by strategy
    'CLOSE_BY_SYMBOL',    // NEW: Close positions by symbol
  ]),
  parameters: z.record(z.any()).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
});

/**
 * POST /api/executor/[id]/command
 * Send a command to an executor
 */
export async function POST(
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

    // Validate executor ownership
    const executor = await prisma.executor.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
        deletedAt: null,
      },
    });

    if (!executor) {
      throw new AppError(404, 'Executor not found', 'EXECUTOR_NOT_FOUND');
    }

    // Parse and validate command
    const body = await req.json();
    const validation = commandSchema.safeParse(body);

    if (!validation.success) {
      throw new AppError(
        400,
        'Validation error',
        'VALIDATION_ERROR',
        validation.error.flatten().fieldErrors
      );
    }

    const { command, parameters, priority } = validation.data;

    // Check if executor is online (optional warning, not blocking)
    const now = new Date();
    const isOnline = executor.lastHeartbeat
      ? now.getTime() - new Date(executor.lastHeartbeat).getTime() < 5 * 60 * 1000
      : false;

    // Create command
    const createdCommand = await prisma.command.create({
      data: {
        userId: session.user.id,
        executorId: params.id,
        command,
        parameters: parameters || {},
        priority,
        status: 'pending',
      },
    });

    // Trigger Pusher event to notify executor in real-time
    await triggerExecutorCommand(params.id, {
      id: createdCommand.id,
      command,
      parameters: parameters || {},
      priority,
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        eventType: 'COMMAND_SENT',
        metadata: {
          commandId: createdCommand.id,
          executorId: params.id,
          command,
          priority,
        },
      },
    });

    return NextResponse.json(
      {
        command: createdCommand,
        executor: {
          id: executor.id,
          name: executor.name,
          status: executor.status,
          isOnline,
        },
        message: isOnline
          ? 'Command sent successfully via real-time channel'
          : '⚠️ Warning: Executor is offline. Command queued and will be delivered when executor reconnects.',
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/executor/[id]/command
 * Get commands for an executor
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

    // Validate executor ownership
    const executor = await prisma.executor.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
        deletedAt: null,
      },
    });

    if (!executor) {
      throw new AppError(404, 'Executor not found', 'EXECUTOR_NOT_FOUND');
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    // Fetch commands
    const commands = await prisma.command.findMany({
      where: {
        executorId: params.id,
        userId: session.user.id,
        ...(status && { status }),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    });

    // Get command statistics
    const stats = {
      total: commands.length,
      pending: commands.filter((c) => c.status === 'pending').length,
      executed: commands.filter((c) => c.status === 'executed').length,
      failed: commands.filter((c) => c.status === 'failed').length,
    };

    return NextResponse.json({
      commands,
      stats,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/executor/[id]/command/[commandId]
 * Update command status (for executor to report back)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { commandId, status, result } = body;

    if (!commandId || !status) {
      throw new AppError(400, 'Command ID and status are required');
    }

    // Find command
    const command = await prisma.command.findFirst({
      where: {
        id: commandId,
        executorId: params.id,
      },
    });

    if (!command) {
      throw new AppError(404, 'Command not found', 'COMMAND_NOT_FOUND');
    }

    // Update command
    const updatedCommand = await prisma.command.update({
      where: { id: commandId },
      data: {
        status,
        result: result || null,
        executedAt: status === 'executed' ? new Date() : null,
      },
      include: {
        user: {
          select: { id: true },
        },
      },
    });

    // Notify user about execution result via Pusher
    await notifyUserExecution(updatedCommand.userId, {
      commandId: commandId,
      executorId: params.id,
      command: command.command,
      success: status === 'executed',
      result: result || null,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      command: updatedCommand,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
