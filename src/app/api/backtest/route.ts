import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Request validation schema
const BacktestRequestSchema = z.object({
  strategyId: z.string(),
  symbol: z.string().min(1),
  interval: z.enum(['1min', '5min', '15min', '30min', '1h', '4h', '1d', '1w']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  initialBalance: z.number().min(100).max(1000000),
  preferredDataSource: z.enum(['twelvedata', 'yahoo']).optional(),
});

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
    const validatedData = BacktestRequestSchema.parse(body);

    // Fetch strategy from database
    const strategy = await prisma.strategy.findUnique({
      where: { id: validatedData.strategyId },
    });

    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    // Check if user owns this strategy
    if (strategy.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Parse dates
    const startDate = new Date(validatedData.startDate);
    const endDate = new Date(validatedData.endDate);

    // Validate date range
    if (startDate >= endDate) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      );
    }

    // Limit backtest period to prevent excessive API calls
    const maxDays = 365;
    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > maxDays) {
      return NextResponse.json(
        { error: `Backtest period cannot exceed ${maxDays} days` },
        { status: 400 }
      );
    }

    // Create backtest record
    const backtest = await prisma.backtest.create({
      data: {
        strategyId: validatedData.strategyId,
        userId: session.user.id,
        status: 'running',
        startDate,
        endDate,
        symbol: validatedData.symbol,
        interval: validatedData.interval,
        initialBalance: validatedData.initialBalance,
        metadata: {
          preferredDataSource: validatedData.preferredDataSource,
        },
      },
    });

    try {
      // Run backtest
      const { runBacktest } = await import('../../../lib/backtest/engine');
      const result = await runBacktest(validatedData.strategyId, {
        startDate,
        endDate,
        initialBalance: validatedData.initialBalance,
        symbol: validatedData.symbol,
        interval: validatedData.interval,
        strategy: strategy,
        preferredDataSource: validatedData.preferredDataSource,
      });

      // Update backtest with results
      const updatedBacktest = await prisma.backtest.update({
        where: { id: backtest.id },
        data: {
          status: 'completed',
          finalBalance: result.finalBalance,
          totalReturn: result.totalReturn,
          returnPercentage: result.returnPercentage,
          maxDrawdown: result.maxDrawdown,
          winRate: result.winRate,
          totalTrades: result.totalTrades,
          winningTrades: result.winningTrades,
          losingTrades: result.losingTrades,
          averageWin: result.averageWin,
          averageLoss: result.averageLoss,
          profitFactor: result.profitFactor,
          sharpeRatio: result.sharpeRatio,
          trades: result.trades,
          equityCurve: result.equityCurve,
          metadata: {
            ...backtest.metadata,
            ...result.metadata,
          },
          completedAt: new Date(),
        },
      });

      // Update strategy statistics
      await prisma.strategy.update({
        where: { id: validatedData.strategyId },
        data: {
          totalBacktests: {
            increment: 1,
          },
          lastBacktestAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        backtest: updatedBacktest,
        result,
      });

    } catch (backtestError) {
      console.error('Backtest execution error:', backtestError);
      
      // Update backtest with error status
      await prisma.backtest.update({
        where: { id: backtest.id },
        data: {
          status: 'failed',
          metadata: {
            ...backtest.metadata,
            error: backtestError instanceof Error ? backtestError.message : 'Unknown error',
          },
          completedAt: new Date(),
        },
      });

      return NextResponse.json(
        { 
          error: 'Backtest execution failed',
          details: backtestError instanceof Error ? backtestError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Backtest API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

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
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    const where: any = {
      userId: session.user.id,
    };

    if (strategyId) {
      where.strategyId = strategyId;
    }

    // Fetch backtests
    const backtests = await prisma.backtest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        strategy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Get total count
    const total = await prisma.backtest.count({ where });

    return NextResponse.json({
      backtests,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });

  } catch (error) {
    console.error('Backtest GET error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
