import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { AppError, handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/strategy/[id]/assignments
 * Get all assignments for a strategy
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
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

    // Get assignments with executor details
    const assignments = await prisma.strategyAssignment.findMany({
      where: {
        strategyId: params.id,
      },
      include: {
        executor: {
          select: {
            id: true,
            name: true,
            platform: true,
            status: true,
            lastHeartbeat: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate online status for each executor
    const now = new Date();
    const assignmentsWithStatus = assignments.map((assignment) => {
      const isOnline = assignment.executor.lastHeartbeat
        ? now.getTime() - new Date(assignment.executor.lastHeartbeat).getTime() <
          5 * 60 * 1000
        : false;

      return {
        ...assignment,
        executor: {
          ...assignment.executor,
          isConnected: isOnline,
        },
      };
    });

    return NextResponse.json({
      success: true,
      assignments: assignmentsWithStatus,
      total: assignmentsWithStatus.length,
      active: assignmentsWithStatus.filter((a) => a.status === 'active').length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const createAssignmentSchema = z.object({
  executorId: z.string(),
  settings: z
    .object({
      lotSize: z.number().optional(),
      maxRisk: z.number().optional(),
      maxDailyLoss: z.number().optional(),
      maxOpenTrades: z.number().optional(),
    })
    .optional(),
});

/**
 * POST /api/strategy/[id]/assignments
 * Create a new assignment
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
    const validation = createAssignmentSchema.safeParse(body);

    if (!validation.success) {
      throw new AppError(
        400,
        'Validation error',
        'VALIDATION_ERROR',
        validation.error.flatten().fieldErrors
      );
    }

    const { executorId, settings } = validation.data;

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

    // Verify executor ownership
    const executor = await prisma.executor.findFirst({
      where: {
        id: executorId,
        userId: session.user.id,
        deletedAt: null,
      },
    });

    if (!executor) {
      throw new AppError(404, 'Executor not found', 'EXECUTOR_NOT_FOUND');
    }

    // Check if assignment already exists
    const existing = await prisma.strategyAssignment.findUnique({
      where: {
        strategyId_executorId: {
          strategyId: params.id,
          executorId,
        },
      },
    });

    if (existing) {
      throw new AppError(
        409,
        'Strategy is already assigned to this executor',
        'ASSIGNMENT_EXISTS'
      );
    }

    // Create assignment
    const assignment = await prisma.strategyAssignment.create({
      data: {
        strategyId: params.id,
        executorId,
        status: strategy.status === 'active' ? 'active' : 'paused',
        settings: settings || {},
      },
      include: {
        executor: true,
        strategy: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Strategy assigned to executor successfully',
      assignment,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
