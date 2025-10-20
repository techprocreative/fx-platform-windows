import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { z } from 'zod';

import { AppError, handleApiError } from '@/lib/errors';
import { transformStrategyRules } from '@/lib/backtest/strategy-rules';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

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
      throw new AppError(401, 'Authentication required');
    }

    const body = await request.json();
    const validatedData = BacktestRequestSchema.parse(body);

    // Fetch strategy from database
    const strategy = await prisma.strategy.findFirst({
      where: {
        id: validatedData.strategyId,
        userId: session.user.id,
        deletedAt: null,
      },
    });

    if (!strategy) {
      throw new AppError(404, 'Strategy not found', 'STRATEGY_NOT_FOUND');
    }

    // Parse dates
    const startDate = new Date(validatedData.startDate);
    const endDate = new Date(validatedData.endDate);

    // Validate date range
    if (startDate >= endDate) {
      throw new AppError(400, 'Start date must be before end date', 'INVALID_DATE_RANGE');
    }

    // Limit backtest period to prevent excessive API calls
    const maxDays = 365;
    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > maxDays) {
      throw new AppError(400, `Backtest period cannot exceed ${maxDays} days`, 'INVALID_DATE_RANGE');
    }

    // Create backtest record
    const backtest = await prisma.backtest.create({
      data: {
        strategyId: validatedData.strategyId,
        userId: session.user.id,
        status: 'running',
        dateFrom: startDate,
        dateTo: endDate,
        initialBalance: validatedData.initialBalance,
        settings: {
          symbol: validatedData.symbol,
          interval: validatedData.interval,
          preferredDataSource: validatedData.preferredDataSource,
        },
      },
    });

    try {
      // Extract parameters from strategy rules
      const strategyRules = strategy.rules as any;
      const riskManagement = strategyRules?.riskManagement || {};
      const exitRules = strategyRules?.exit || {};
      
      // Convert pips to decimal for backtest engine
      const stopLossPips = exitRules?.stopLoss?.value || 25;
      const takeProfitPips = exitRules?.takeProfit?.value || 50;
      
      // Approximate conversion: 1 pip = 0.0001 for most forex pairs
      // For JPY pairs it's 0.01, but we'll use general conversion
      const stopLossDecimal = stopLossPips * 0.0001;
      const takeProfitDecimal = takeProfitPips * 0.0001;

      // Transform strategy data to format expected by backtest engine
      const transformedStrategy = {
        id: strategy.id,
        name: strategy.name,
        rules: transformStrategyRules(strategy.rules),
        parameters: {
          riskPerTrade: riskManagement.lotSize || 0.01,
          maxPositions: riskManagement.maxPositions || 1,
          stopLoss: stopLossDecimal,
          takeProfit: takeProfitDecimal,
          maxDailyLoss: riskManagement.maxDailyLoss || 100,
        },
      };

      // Run backtest
      const { runBacktest } = await import('../../../lib/backtest/engine');
      const result = await runBacktest(validatedData.strategyId, {
        startDate,
        endDate,
        initialBalance: validatedData.initialBalance,
        symbol: validatedData.symbol,
        interval: validatedData.interval,
        strategy: transformedStrategy,
        preferredDataSource: validatedData.preferredDataSource,
      });

      // Update backtest with results
      const updatedBacktest = await prisma.backtest.update({
        where: { id: backtest.id },
        data: {
          status: 'completed',
          results: {
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
            metadata: result.metadata,
          },
          completedAt: new Date(),
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
          results: {
            error: backtestError instanceof Error ? backtestError.message : 'Unknown error',
          },
          completedAt: new Date(),
        },
      });

      throw backtestError instanceof Error ? backtestError : new Error('Backtest execution failed');
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new AppError(400, 'Invalid request data', 'VALIDATION_ERROR', error.flatten().fieldErrors));
    }

    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(401, 'Authentication required');
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
    return handleApiError(error);
  }
}
