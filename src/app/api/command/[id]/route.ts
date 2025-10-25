/**
 * Command Status API
 * GET /api/command/[id]
 * Check status of a specific command
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const command = await prisma.command.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      include: {
        executor: {
          select: {
            id: true,
            name: true,
            status: true,
            lastHeartbeat: true,
          },
        },
      },
    });

    if (!command) {
      return NextResponse.json(
        { error: 'Command not found' },
        { status: 404 }
      );
    }

    // Check if executor is online
    const isExecutorOnline = command.executor.lastHeartbeat
      ? new Date().getTime() - new Date(command.executor.lastHeartbeat).getTime() < 5 * 60 * 1000
      : false;

    return NextResponse.json({
      success: true,
      command: {
        ...command,
        executor: {
          ...command.executor,
          isOnline: isExecutorOnline,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching command:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch command' },
      { status: 500 }
    );
  }
}

/**
 * Update Command Status
 * PATCH /api/command/[id]
 * Used by executor to update command status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { status, result, acknowledgedAt, executedAt } = body;

    const command = await prisma.command.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!command) {
      return NextResponse.json(
        { error: 'Command not found' },
        { status: 404 }
      );
    }

    // Update command
    const updatedCommand = await prisma.command.update({
      where: { id: params.id },
      data: {
        ...(status && { status }),
        ...(result && { result }),
        ...(acknowledgedAt && { acknowledgedAt: new Date(acknowledgedAt) }),
        ...(executedAt && { executedAt: new Date(executedAt) }),
      },
    });

    return NextResponse.json({
      success: true,
      command: updatedCommand,
    });
  } catch (error: any) {
    console.error('Error updating command:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update command' },
      { status: 500 }
    );
  }
}
