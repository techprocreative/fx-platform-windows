/**
 * COMMANDS API ENDPOINT
 * Manages trade commands between Brain and Executor
 * DO NOT DELETE - CRITICAL ARCHITECTURE COMPONENT
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { getCommandQueue, TradeCommand } from '../../../lib/commands/queue';
import { getExecutorManager } from '../../../lib/executors/manager';
import { prisma } from '../../../lib/prisma';
import { z } from 'zod';

// Request validation schemas
const SendCommandSchema = z.object({
  strategyId: z.string(),
  executorId: z.string().optional(),
  type: z.enum(['TRADE_SIGNAL', 'RISK_UPDATE', 'EMERGENCY_STOP', 'STATUS_REQUEST']),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  command: z.object({
    action: z.enum(['OPEN_POSITION', 'CLOSE_POSITION', 'MODIFY_POSITION', 'CLOSE_ALL']),
    symbol: z.string().optional(),
    type: z.enum(['BUY', 'SELL']).optional(),
    volume: z.number().optional(),
    ticket: z.number().optional(),
    stopLoss: z.number().optional(),
    takeProfit: z.number().optional(),
    magicNumber: z.number().optional(),
    comment: z.string().optional(),
  }),
  expiry: z.number().optional(),
});

/**
 * POST /api/commands - Send trade command
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = SendCommandSchema.parse(body);

    // Verify strategy ownership
    const strategy = await prisma.strategy.findUnique({
      where: { id: validatedData.strategyId },
    });

    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    if (strategy.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Create command
    const command: TradeCommand = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      strategyId: validatedData.strategyId,
      executorId: validatedData.executorId,
      type: validatedData.type,
      priority: validatedData.priority || 'NORMAL',
      command: validatedData.command,
      timestamp: new Date(),
      expiry: validatedData.expiry,
    };

    // Send command
    const commandQueue = getCommandQueue();
    const executorManager = getExecutorManager();

    if (validatedData.executorId) {
      // Send to specific executor
      const sent = await executorManager.sendCommand(validatedData.executorId, command);
      if (!sent) {
        return NextResponse.json(
          { error: 'Executor is offline or unavailable' },
          { status: 503 }
        );
      }
    } else {
      // Add to queue for any available executor
      await commandQueue.push(command);
    }

    return NextResponse.json({
      success: true,
      commandId: command.id,
      status: 'pending',
      message: validatedData.executorId 
        ? 'Command sent to executor'
        : 'Command queued for execution',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Command send error:', error);
    return NextResponse.json(
      { error: 'Failed to send command' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/commands - Get command status or list
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const commandId = searchParams.get('commandId');
    const executorId = searchParams.get('executorId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    const commandQueue = getCommandQueue();

    // Get specific command status
    if (commandId) {
      const command = await commandQueue.getStatus(commandId);
      if (!command) {
        return NextResponse.json(
          { error: 'Command not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ command });
    }

    // Get list of commands
    const where: any = {
      userId: session.user.id,
    };

    if (executorId) {
      where.executorId = executorId;
    }

    if (status) {
      where.status = status;
    }

    const commands = await prisma.command.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Get pending commands from queue
    const pendingCommands = await commandQueue.getPendingCommands(executorId || undefined);

    return NextResponse.json({
      commands,
      pending: pendingCommands,
      total: commands.length,
    });
  } catch (error) {
    console.error('Command fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch commands' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/commands - Cancel command
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const commandId = searchParams.get('commandId');

    if (!commandId) {
      return NextResponse.json(
        { error: 'Command ID is required' },
        { status: 400 }
      );
    }

    // Verify command ownership
    const command = await prisma.command.findUnique({
      where: { id: commandId },
    });

    if (!command) {
      return NextResponse.json(
        { error: 'Command not found' },
        { status: 404 }
      );
    }

    if (command.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Cancel command
    const commandQueue = getCommandQueue();
    await commandQueue.cancel(commandId);

    return NextResponse.json({
      success: true,
      message: 'Command cancelled',
    });
  } catch (error) {
    console.error('Command cancel error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel command' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/commands - Emergency stop
 */
export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, executorId, reason } = body;

    if (action !== 'emergency_stop') {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    const executorManager = getExecutorManager();

    if (executorId) {
      // Emergency stop specific executor
      await executorManager.emergencyStop(executorId, reason || 'User initiated');
    } else {
      // Emergency stop all executors
      await executorManager.emergencyStopAll(reason || 'User initiated');
    }

    return NextResponse.json({
      success: true,
      message: executorId 
        ? `Emergency stop sent to executor ${executorId}`
        : 'Emergency stop sent to all executors',
    });
  } catch (error) {
    console.error('Emergency stop error:', error);
    return NextResponse.json(
      { error: 'Failed to execute emergency stop' },
      { status: 500 }
    );
  }
}
