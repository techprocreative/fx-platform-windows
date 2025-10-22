import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { AppError, handleApiError } from '@/lib/errors';
import { triggerExecutorCommand } from '@/lib/pusher/server';

export const dynamic = 'force-dynamic';

const activateSchema = z.object({
  autoAssign: z.boolean().default(false),
  executorIds: z.array(z.string()).optional(),
  settings: z.object({
    lotSize: z.number().optional(),
    maxRisk: z.number().optional(),
    maxDailyLoss: z.number().optional(),
    maxOpenTrades: z.number().optional(),
  }).optional(),
});

/**
 * POST /api/strategy/[id]/activate
 * Activate strategy and assign to executors
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(401, 'Unauthorized');
    }

    // Parse request body
    const body = await req.json();
    const validation = activateSchema.safeParse(body);

    if (!validation.success) {
      throw new AppError(
        400,
        'Validation error',
        'VALIDATION_ERROR',
        validation.error.flatten().fieldErrors
      );
    }

    const { autoAssign, executorIds, settings } = validation.data;

    // Get strategy
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

    // Update strategy status to active
    const updatedStrategy = await prisma.strategy.update({
      where: { id: params.id },
      data: { status: 'active' },
    });

    // Determine target executors
    let targetExecutors;
    if (autoAssign) {
      // Get all online executors
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      targetExecutors = await prisma.executor.findMany({
        where: {
          userId: session.user.id,
          deletedAt: null,
          lastHeartbeat: {
            gte: fiveMinutesAgo,
          },
        },
      });
    } else if (executorIds && executorIds.length > 0) {
      // Get specified executors
      targetExecutors = await prisma.executor.findMany({
        where: {
          id: { in: executorIds },
          userId: session.user.id,
          deletedAt: null,
        },
      });
    } else {
      throw new AppError(
        400,
        'Either autoAssign must be true or executorIds must be provided',
        'INVALID_REQUEST'
      );
    }

    if (targetExecutors.length === 0) {
      throw new AppError(
        400,
        'No executors available. Make sure at least one executor is online.',
        'NO_EXECUTORS_AVAILABLE'
      );
    }

    // Create assignments
    const assignments = await Promise.all(
      targetExecutors.map((executor) =>
        prisma.strategyAssignment.upsert({
          where: {
            strategyId_executorId: {
              strategyId: strategy.id,
              executorId: executor.id,
            },
          },
          create: {
            strategyId: strategy.id,
            executorId: executor.id,
            status: 'active',
            settings: settings || {},
          },
          update: {
            status: 'active',
            settings: settings || {},
          },
        })
      )
    );

    // Send START_STRATEGY command to each executor
    const commands = await Promise.all(
      targetExecutors.map(async (executor) => {
        const command = await prisma.command.create({
          data: {
            userId: session.user.id,
            executorId: executor.id,
            command: 'START_STRATEGY',
            parameters: {
              strategyId: strategy.id,
              strategyName: strategy.name,
              symbol: strategy.symbol,
              timeframe: strategy.timeframe,
              rules: strategy.rules,
              settings: settings || {},
            },
            priority: 'HIGH',
            status: 'pending',
          },
        });

        // Trigger Pusher event for real-time delivery
        await triggerExecutorCommand(executor.id, {
          id: command.id,
          command: 'START_STRATEGY',
          parameters: command.parameters,
          priority: 'HIGH',
        });

        return command;
      })
    );

    return NextResponse.json({
      success: true,
      message: `Strategy activated and assigned to ${targetExecutors.length} executor(s)`,
      strategy: updatedStrategy,
      assignments,
      executorsNotified: targetExecutors.length,
      commands: commands.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/strategy/[id]/activate
 * Deactivate strategy and stop on all executors
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(401, 'Unauthorized');
    }

    // Get strategy
    const strategy = await prisma.strategy.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
        deletedAt: null,
      },
      include: {
        assignments: {
          where: { status: 'active' },
          include: { executor: true },
        },
      },
    });

    if (!strategy) {
      throw new AppError(404, 'Strategy not found', 'STRATEGY_NOT_FOUND');
    }

    // Update strategy status to paused
    await prisma.strategy.update({
      where: { id: params.id },
      data: { status: 'paused' },
    });

    // Update all assignments to stopped
    await prisma.strategyAssignment.updateMany({
      where: {
        strategyId: params.id,
        status: 'active',
      },
      data: { status: 'stopped' },
    });

    // Send STOP_STRATEGY command to each executor
    const commands = await Promise.all(
      strategy.assignments.map(async (assignment) => {
        const command = await prisma.command.create({
          data: {
            userId: session.user.id,
            executorId: assignment.executorId,
            command: 'STOP_STRATEGY',
            parameters: {
              strategyId: strategy.id,
              strategyName: strategy.name,
            },
            priority: 'HIGH',
            status: 'pending',
          },
        });

        // Trigger Pusher event
        await triggerExecutorCommand(assignment.executorId, {
          id: command.id,
          command: 'STOP_STRATEGY',
          parameters: command.parameters,
          priority: 'HIGH',
        });

        return command;
      })
    );

    return NextResponse.json({
      success: true,
      message: `Strategy deactivated on ${strategy.assignments.length} executor(s)`,
      executorsNotified: strategy.assignments.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
