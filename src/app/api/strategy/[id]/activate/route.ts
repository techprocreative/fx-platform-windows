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
    const { executorId, options } = body;

    if (!executorId) {
      return NextResponse.json(
        { error: 'executorId is required' },
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

    // Check if executor exists and is online
    const executor = await prisma.executor.findUnique({
      where: { id: executorId },
    });

    if (!executor) {
      return NextResponse.json(
        { error: 'Executor not found' },
        { status: 404 }
      );
    }

    // Create strategy assignment
    const assignment = await prisma.strategyAssignment.create({
      data: {
        strategyId,
        executorId,
        status: 'active',
      },
    });

    // Send START_STRATEGY command via Pusher
    const command = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'START_STRATEGY' as const,
      priority: 'HIGH' as const,
      executorId,
      strategyId,
      payload: {
        strategyId: strategy.id,
        strategyName: strategy.name,
        symbol: strategy.symbol,
        timeframe: strategy.timeframe,
        rules: strategy.rules,
        enabled: true,
        options: options || {},
      },
      metadata: {
        source: 'web_platform',
        userId: session.user.id,
        assignmentId: assignment.id,
      },
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    };

    // Send command
    await sendCommandToExecutor(executorId, command);

    // Update strategy status
    await prisma.strategy.update({
      where: { id: strategyId },
      data: {
        status: 'active',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Strategy activation command sent',
      data: {
        commandId: command.id,
        assignmentId: assignment.id,
        executorId,
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
