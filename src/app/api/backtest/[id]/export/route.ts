import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { z } from 'zod';

import { authOptions } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { AppError, handleApiError } from '@/lib/errors';
import { generateCSVResponse, generateJSONResponse, BacktestResults } from '@/lib/utils/export';

// Request validation schema
const ExportRequestSchema = z.object({
  format: z.enum(['csv', 'json']),
  includeTrades: z.boolean().default(true),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(401, 'Authentication required');
    }

    // Validate request parameters
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') as 'csv' | 'json' | null;
    const includeTrades = searchParams.get('includeTrades') !== 'false';

    if (!format || !['csv', 'json'].includes(format)) {
      throw new AppError(400, 'Invalid format. Must be csv or json');
    }

    const validation = ExportRequestSchema.safeParse({
      format,
      includeTrades,
    });

    if (!validation.success) {
      throw new AppError(
        400,
        'Invalid request parameters',
        'VALIDATION_ERROR',
        validation.error.flatten().fieldErrors
      );
    }

    // Fetch backtest data
    const backtest = await prisma.backtest.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      include: {
        strategy: {
          select: {
            name: true,
            symbol: true,
            timeframe: true,
          },
        },
      },
    });

    if (!backtest) {
      throw new AppError(404, 'Backtest not found');
    }

    // Fetch trades if requested
    let trades: any[] = [];
    if (includeTrades) {
      trades = await prisma.trade.findMany({
        where: {
          strategyId: backtest.strategyId,
          userId: session.user.id,
          openTime: {
            gte: backtest.dateFrom,
            lte: backtest.dateTo,
          },
        },
        orderBy: {
          openTime: 'asc',
        },
      });
    }

    // Transform data to export format
    const results: BacktestResults = {
      id: backtest.id,
      strategyName: backtest.strategy.name,
      symbol: backtest.strategy.symbol,
      timeframe: backtest.strategy.timeframe,
      dateFrom: backtest.dateFrom.toISOString(),
      dateTo: backtest.dateTo.toISOString(),
      initialBalance: backtest.initialBalance,
      finalBalance: (backtest.results as any)?.finalBalance,
      totalReturn: (backtest.results as any)?.totalReturn,
      returnPercentage: (backtest.results as any)?.returnPercentage,
      maxDrawdown: (backtest.results as any)?.maxDrawdown,
      maxDrawdownPercentage: (backtest.results as any)?.maxDrawdownPercentage,
      winRate: (backtest.results as any)?.winRate,
      totalTrades: (backtest.results as any)?.totalTrades,
      winningTrades: (backtest.results as any)?.winningTrades,
      losingTrades: (backtest.results as any)?.losingTrades,
      averageWin: (backtest.results as any)?.averageWin,
      averageLoss: (backtest.results as any)?.averageLoss,
      profitFactor: (backtest.results as any)?.profitFactor,
      sharpeRatio: (backtest.results as any)?.sharpeRatio,
      trades: trades.map(trade => ({
        id: trade.id,
        ticket: trade.ticket,
        symbol: trade.symbol,
        type: trade.type as 'BUY' | 'SELL',
        lots: trade.lots,
        openTime: trade.openTime.toISOString(),
        openPrice: trade.openPrice,
        closeTime: trade.closeTime?.toISOString(),
        closePrice: trade.closePrice || undefined,
        stopLoss: trade.stopLoss || undefined,
        takeProfit: trade.takeProfit || undefined,
        commission: trade.commission || undefined,
        swap: trade.swap || undefined,
        profit: trade.profit || undefined,
        netProfit: trade.netProfit || undefined,
        pips: trade.pips || undefined,
        magicNumber: trade.magicNumber || undefined,
        comment: trade.comment || undefined,
      })),
    };

    // Generate response based on format
    if (format === 'csv') {
      return generateCSVResponse(results.trades);
    } else if (format === 'json') {
      return generateJSONResponse(results);
    }

    throw new AppError(400, 'Unsupported format');
  } catch (error) {
    return handleApiError(error);
  }
}

// POST endpoint for more complex export options
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(401, 'Authentication required');
    }

    const body = await request.json();
    const validation = ExportRequestSchema.safeParse(body);

    if (!validation.success) {
      throw new AppError(
        400,
        'Invalid request data',
        'VALIDATION_ERROR',
        validation.error.flatten().fieldErrors
      );
    }

    const { format, includeTrades } = validation.data;

    // Fetch backtest data
    const backtest = await prisma.backtest.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      include: {
        strategy: {
          select: {
            name: true,
            symbol: true,
            timeframe: true,
          },
        },
      },
    });

    if (!backtest) {
      throw new AppError(404, 'Backtest not found');
    }

    // Fetch trades if requested
    let trades: any[] = [];
    if (includeTrades) {
      trades = await prisma.trade.findMany({
        where: {
          strategyId: backtest.strategyId,
          userId: session.user.id,
          openTime: {
            gte: backtest.dateFrom,
            lte: backtest.dateTo,
          },
        },
        orderBy: {
          openTime: 'asc',
        },
      });
    }

    // Transform data to export format
    const results: BacktestResults = {
      id: backtest.id,
      strategyName: backtest.strategy.name,
      symbol: backtest.strategy.symbol,
      timeframe: backtest.strategy.timeframe,
      dateFrom: backtest.dateFrom.toISOString(),
      dateTo: backtest.dateTo.toISOString(),
      initialBalance: backtest.initialBalance,
      finalBalance: (backtest.results as any)?.finalBalance,
      totalReturn: (backtest.results as any)?.totalReturn,
      returnPercentage: (backtest.results as any)?.returnPercentage,
      maxDrawdown: (backtest.results as any)?.maxDrawdown,
      maxDrawdownPercentage: (backtest.results as any)?.maxDrawdownPercentage,
      winRate: (backtest.results as any)?.winRate,
      totalTrades: (backtest.results as any)?.totalTrades,
      winningTrades: (backtest.results as any)?.winningTrades,
      losingTrades: (backtest.results as any)?.losingTrades,
      averageWin: (backtest.results as any)?.averageWin,
      averageLoss: (backtest.results as any)?.averageLoss,
      profitFactor: (backtest.results as any)?.profitFactor,
      sharpeRatio: (backtest.results as any)?.sharpeRatio,
      trades: trades.map(trade => ({
        id: trade.id,
        ticket: trade.ticket,
        symbol: trade.symbol,
        type: trade.type as 'BUY' | 'SELL',
        lots: trade.lots,
        openTime: trade.openTime.toISOString(),
        openPrice: trade.openPrice,
        closeTime: trade.closeTime?.toISOString(),
        closePrice: trade.closePrice || undefined,
        stopLoss: trade.stopLoss || undefined,
        takeProfit: trade.takeProfit || undefined,
        commission: trade.commission || undefined,
        swap: trade.swap || undefined,
        profit: trade.profit || undefined,
        netProfit: trade.netProfit || undefined,
        pips: trade.pips || undefined,
        magicNumber: trade.magicNumber || undefined,
        comment: trade.comment || undefined,
      })),
    };

    // Generate response based on format
    if (format === 'csv') {
      return generateCSVResponse(results.trades);
    } else if (format === 'json') {
      return generateJSONResponse(results);
    }

    throw new AppError(400, 'Unsupported format');
  } catch (error) {
    return handleApiError(error);
  }
}