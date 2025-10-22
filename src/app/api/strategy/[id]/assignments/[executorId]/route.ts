import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '../../../../../../lib/auth';
import { prisma } from '../../../../../../lib/prisma';
import { AppError, handleApiError } from '@/lib/errors';
import { triggerExecutorCommand } from '@/lib/pusher/server';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/strategy/[id]/assignments/[executorId]
 * Remove assignment and stop strategy on executor
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; executorId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(401, 'Unauthorized');
    }

    // Verify strategy ownership
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

    // Get assignment
    const assignment = await prisma.strategyAssignment.findUnique({
      where: {
        strategyId_executorId: {
          strategyId: params.id,
          executorId: params.executorId,
        },
      },
      include: {
        executor: true,
      },
    });

    if (!assignment) {
      throw new AppError(404, 'Assignment not found', 'ASSIGNMENT_NOT_FOUND');
    }

    // Send STOP_STRATEGY command if assignment was active
    if (assignment.status === 'active') {
      const command = await prisma.command.create({
        data: {
          userId: session.user.id,
          executorId: params.executorId,
          command: 'STOP_STRATEGY',
          parameters: {
            strategyId: params.id,
            strategyName: strategy.name,
          },
          priority: 'HIGH',
          status: 'pending',
        },
      });

      // Trigger Pusher event
      await triggerExecutorCommand(params.executorId, {
        id: command.id,
        command: 'STOP_STRATEGY',
        parameters: command.parameters,
        priority: 'HIGH',
      });
    }

    // Delete assignment
    await prisma.strategyAssignment.delete({
      where: {
        strategyId_executorId: {
          strategyId: params.id,
          executorId: params.executorId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Assignment removed successfully',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/strategy/[id]/assignments/[executorId]
 * Update assignment status (pause/resume)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; executorId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(401, 'Unauthorized');
    }

    const body = await req.json();
    const { status } = body;

    if (!['active', 'paused', 'stopped'].includes(status)) {
      throw new AppError(400, 'Invalid status', 'INVALID_STATUS');
    }

    // Verify strategy ownership
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

    // Update assignment
    const assignment = await prisma.strategyAssignment.update({
      where: {
        strategyId_executorId: {
          strategyId: params.id,
          executorId: params.executorId,
        },
      },
      data: { status },
    });

    // Send appropriate command
    const commandType =
      status === 'active'
        ? 'RESUME_STRATEGY'
        : status === 'paused'
        ? 'PAUSE_STRATEGY'
        : 'STOP_STRATEGY';

    const command = await prisma.command.create({
      data: {
        userId: session.user.id,
        executorId: params.executorId,
        command: commandType,
        parameters: {
          strategyId: params.id,
          strategyName: strategy.name,
        },
        priority: 'HIGH',
        status: 'pending',
      },
    });

    // Trigger Pusher event
    await triggerExecutorCommand(params.executorId, {
      id: command.id,
      command: commandType,
      parameters: command.parameters,
      priority: 'HIGH',
    });

    return NextResponse.json({
      success: true,
      message: `Strategy ${status} on executor`,
      assignment,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
