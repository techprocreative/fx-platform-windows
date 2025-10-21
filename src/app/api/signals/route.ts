/**
 * SIGNAL GENERATION API
 * Endpoint for generating and managing trading signals
 * DO NOT DELETE - CRITICAL ARCHITECTURE COMPONENT
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { createSignalGenerator } from '../../../lib/signals/generator';
import { getCommandQueue } from '../../../lib/commands/queue';
import { getExecutorManager } from '../../../lib/executors/manager';
import { prisma } from '../../../lib/prisma';
import { z } from 'zod';

// Request validation schema
const GenerateSignalSchema = z.object({
  strategyId: z.string(),
  marketData: z.object({
    symbol: z.string(),
    timeframe: z.string(),
    close: z.number(),
    open: z.number(),
    high: z.number(),
    low: z.number(),
    volume: z.number(),
  }),
  execute: z.boolean().optional(), // Whether to execute immediately
  executorId: z.string().optional(), // Specific executor to use
});

/**
 * POST /api/signals - Generate trading signal
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
    const validatedData = GenerateSignalSchema.parse(body);

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

    // Create signal generator
    const signalGenerator = await createSignalGenerator(validatedData.strategyId);
    if (!signalGenerator) {
      return NextResponse.json(
        { error: 'Failed to create signal generator' },
        { status: 500 }
      );
    }

    // Generate signal
    const signal = await signalGenerator.generateSignal(validatedData.marketData);
    
    if (!signal) {
      return NextResponse.json({
        signal: null,
        message: 'No signal generated based on current conditions',
      });
    }

    // If execute flag is set, send to executor
    let commandId = null;
    if (validatedData.execute) {
      const commandQueue = getCommandQueue();
      const executorManager = getExecutorManager();

      // Create trade command
      const command = {
        id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        strategyId: strategy.id,
        executorId: validatedData.executorId,
        type: 'TRADE_SIGNAL' as const,
        priority: signal.confidence > 0.8 ? 'HIGH' as const : 'NORMAL' as const,
        command: {
          action: signal.action === 'BUY' || signal.action === 'SELL' 
            ? 'OPEN_POSITION' as const 
            : 'CLOSE_POSITION' as const,
          symbol: signal.symbol,
          type: signal.action as 'BUY' | 'SELL',
          volume: signal.volume,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit,
          magicNumber: parseInt(strategy.id.replace(/\D/g, '').substr(0, 6)),
          comment: `Strategy: ${strategy.name}`,
        },
        timestamp: new Date(),
        expiry: 5000, // 5 seconds
      };

      // Send to executor or queue
      if (validatedData.executorId) {
        const sent = await executorManager.sendCommand(validatedData.executorId, command);
        if (!sent) {
          return NextResponse.json(
            { error: 'Executor is offline or unavailable' },
            { status: 503 }
          );
        }
      } else {
        await commandQueue.push(command);
      }

      commandId = command.id;
    }

    return NextResponse.json({
      signal,
      executed: validatedData.execute || false,
      commandId,
      strategy: {
        id: strategy.id,
        name: strategy.name,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Signal generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate signal' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/signals - Get signal history
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
    const strategyId = searchParams.get('strategyId');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build query
    const where: any = {
      userId: session.user.id,
      eventType: 'SIGNAL_GENERATED',
    };

    if (strategyId) {
      where.metadata = {
        path: ['strategyId'],
        equals: strategyId,
      };
    }

    // Fetch signal history from activity logs
    const signals = await prisma.activityLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      signals: signals.map(s => s.metadata),
      total: signals.length,
    });
  } catch (error) {
    console.error('Signal fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch signals' },
      { status: 500 }
    );
  }
}
