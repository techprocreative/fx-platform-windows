/**
 * Activate Strategy API Endpoint
 * Sends START_STRATEGY command to Windows Executor
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
    const { executorId, executorIds, autoAssign, options, settings } = body;

    // Determine executors to activate
    let targetExecutors: string[] = [];
    
    if (executorId) {
      // Single executor (legacy)
      targetExecutors = [executorId];
    } else if (executorIds && Array.isArray(executorIds)) {
      // Multiple executors
      targetExecutors = executorIds;
    } else if (autoAssign) {
      // Auto-assign to all online executors
      const onlineExecutors = await prisma.executor.findMany({
        where: {
          userId: session.user.id,
          isConnected: true,
        },
      });
      targetExecutors = onlineExecutors.map(e => e.id);
    }

    if (targetExecutors.length === 0) {
      return NextResponse.json(
        { error: 'No executors available. Please select executors or ensure at least one executor is online.' },
        { status: 400 }
      );
    }

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

    // Process each executor
    const assignments = [];
    const commands = [];

    for (const execId of targetExecutors) {
      // Check if executor exists and is online
      const executor = await prisma.executor.findUnique({
        where: { id: execId },
      });

      if (!executor) {
        console.warn(`Executor ${execId} not found, skipping`);
        continue;
      }

      // Check if strategy already assigned to this executor
      let assignment = await prisma.strategyAssignment.findFirst({
        where: {
          strategyId,
          executorId: execId,
        },
      });

      if (assignment) {
        // Update existing assignment to active
        assignment = await prisma.strategyAssignment.update({
          where: { id: assignment.id },
          data: {
            status: 'active',
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new strategy assignment
        assignment = await prisma.strategyAssignment.create({
          data: {
            strategyId,
            executorId: execId,
            status: 'active',
          },
        });
      }

      assignments.push(assignment);

      // Create command in database for tracking
      const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await prisma.command.create({
        data: {
          id: commandId,
          userId: session.user.id,
          executorId: execId,
          strategyId: strategy.id,
          command: 'START_STRATEGY',
          parameters: {
            strategyId: strategy.id,
            strategyName: strategy.name,
            symbol: strategy.symbol,
            timeframe: strategy.timeframe,
            rules: strategy.rules,
            enabled: true,
            options: options || {},
            settings: settings || {},
          },
          priority: 'HIGH',
          status: 'pending',
        },
      });

      // Send START_STRATEGY command via Pusher
      const command = {
        id: commandId,
        type: 'START_STRATEGY' as const,
        priority: 'HIGH' as const,
        executorId: execId,
        strategyId,
        payload: {
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: strategy.symbol,
          timeframe: strategy.timeframe,
          rules: strategy.rules,
          enabled: true,
          options: options || {},
          settings: settings || {},
        },
        metadata: {
          source: 'web_platform',
          userId: session.user.id,
          assignmentId: assignment.id,
        },
        timestamp: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      };

      // Send command via Pusher
      await sendCommandToExecutor(execId, command);
      commands.push(command);
    }

    // Update strategy status
    await prisma.strategy.update({
      where: { id: strategyId },
      data: {
        status: 'active',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Strategy activated on ${assignments.length} executor(s)`,
      executorsNotified: assignments.length,
      data: {
        commandIds: commands.map(c => c.id),
        assignmentIds: assignments.map(a => a.id),
        executorIds: targetExecutors,
        strategyId,
      },
    });

  } catch (error: any) {
    console.error('Error activating strategy:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to activate strategy' },
      { status: 500 }
    );
  }
}
