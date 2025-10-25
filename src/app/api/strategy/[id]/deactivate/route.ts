/**
 * Deactivate Strategy API Endpoint
 * Sends STOP_STRATEGY command to Windows Executor
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendCommandToExecutor } from '@/lib/realtime/pusher-service';
import { requireAuth } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Auth check
    const session = await requireAuth(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const strategyId = params.id;
    const body = await request.json();
    const { executorId, closePositions = true } = body;

    // Get strategy
    const strategy = await prisma.strategy.findUnique({
      where: {
        id: strategyId,
        userId: session.user.id,
      },
    });

    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    // Get active assignments
    const assignments = await prisma.strategyAssignment.findMany({
      where: {
        strategyId,
        status: 'active',
        ...(executorId ? { executorId } : {}),
      },
    });

    if (assignments.length === 0) {
      return NextResponse.json(
        { error: 'No active assignments found' },
        { status: 404 }
      );
    }

    const commands = [];

    // Send STOP_STRATEGY command to all executors
    for (const assignment of assignments) {
      const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const command = {
        id: commandId,
        command: 'STOP_STRATEGY', // Add command field (executor expects this)
        type: 'STOP_STRATEGY' as const,
        priority: 'HIGH' as const,
        executorId: assignment.executorId,
        parameters: {
          strategyId,
          strategyName: strategy.name,
          closePositions,
        },
        payload: {
          strategyId,
          strategyName: strategy.name,
          closePositions,
        },
        metadata: {
          source: 'web_platform',
          userId: session.user.id,
          assignmentId: assignment.id,
        },
        createdAt: new Date().toISOString(),
        timestamp: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      };

      // Save command to database
      await prisma.command.create({
        data: {
          id: commandId,
          userId: session.user.id,
          executorId: assignment.executorId,
          command: 'STOP_STRATEGY',
          parameters: {
            strategyId,
            strategyName: strategy.name,
            closePositions,
          },
          priority: 'HIGH',
          status: 'pending',
        },
      });

      const sent = await sendCommandToExecutor(assignment.executorId, command);
      if (sent) {
        console.log(`✅ STOP command sent to executor ${assignment.executorId}:`, {
          commandId: command.id,
          channel: `private-executor-${assignment.executorId}`,
          event: 'command-received',
        });
      } else {
        console.error(`❌ Failed to send STOP command to executor ${assignment.executorId}`);
      }
      
      commands.push(command);

      // Update assignment
      await prisma.strategyAssignment.update({
        where: { id: assignment.id },
        data: {
          status: 'stopped',
        },
      });
    }

    // Update strategy status
    await prisma.strategy.update({
      where: { id: strategyId },
      data: {
        status: 'inactive',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Strategy deactivation command sent',
      data: {
        commandIds: commands.map(c => c.id),
        executorIds: assignments.map(a => a.executorId),
        strategyId,
      },
    });

  } catch (error: any) {
    console.error('Error deactivating strategy:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to deactivate strategy' },
      { status: 500 }
    );
  }
}
