/**
 * BACKTEST EXPORT API
 * Export backtest results to Vercel Blob storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { 
  uploadBacktestResults,
  uploadCSV,
  isBlobStorageConfigured,
  getStorageStatus 
} from '@/lib/storage/vercel-blob';
import { 
  createSecureResponse, 
  createErrorResponse,
  rateLimit,
  getClientIP
} from '@/lib/api-security';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return createErrorResponse('Authentication required', 401);
    }

    // Rate limiting
    const ip = getClientIP(request);
    const rateLimitResult = await rateLimit(
      `export_backtest_${ip}_${session.user.id}`,
      20, // 20 exports
      3600000 // per hour
    );

    if (!rateLimitResult.allowed) {
      return createErrorResponse('Rate limit exceeded', 429, {
        retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
      });
    }

    // Parse request
    const body = await request.json();
    const { backtestId, format = 'json' } = body;

    if (!backtestId) {
      return createErrorResponse('Backtest ID is required', 400);
    }

    // Fetch backtest
    const backtest = await prisma.backtest.findUnique({
      where: { id: backtestId },
      include: {
        strategy: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!backtest) {
      return createErrorResponse('Backtest not found', 404);
    }

    // Verify ownership
    if (backtest.userId !== session.user.id) {
      return createErrorResponse('Access denied', 403);
    }

    if (backtest.status !== 'completed') {
      return createErrorResponse('Backtest is not completed', 400);
    }

    // Check storage configuration
    const storageStatus = getStorageStatus();
    if (!storageStatus.configured && process.env.NODE_ENV === 'production') {
      return createErrorResponse('File storage not configured', 503);
    }

    // Handle different export formats
    if (format === 'csv') {
      return await exportAsCSV(backtest);
    } else {
      return await exportAsJSON(backtest);
    }
  } catch (error) {
    console.error('Backtest export error:', error);
    return createErrorResponse('Failed to export backtest', 500);
  }
}

async function exportAsJSON(backtest: any): Promise<NextResponse> {
  const exportData = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    backtest: {
      id: backtest.id,
      strategyId: backtest.strategyId,
      strategyName: backtest.strategy.name,
      dateFrom: backtest.dateFrom,
      dateTo: backtest.dateTo,
      initialBalance: backtest.initialBalance,
      status: backtest.status,
      settings: backtest.settings,
      results: backtest.results,
      createdAt: backtest.createdAt,
      completedAt: backtest.completedAt,
    },
  };

  if (isBlobStorageConfigured()) {
    const file = await uploadBacktestResults(backtest.id, exportData);
    
    return createSecureResponse({
      success: true,
      downloadUrl: file.url,
      fileSize: file.size,
      format: 'json',
      message: 'Backtest exported successfully',
    });
  } else {
    // Fallback for development
    return createSecureResponse({
      success: true,
      data: exportData,
      format: 'json',
      message: 'Backtest export (development mode)',
    });
  }
}

async function exportAsCSV(backtest: any): Promise<NextResponse> {
  const results = backtest.results as any;
  
  if (!results?.trades || !Array.isArray(results.trades)) {
    return createErrorResponse('No trades data available', 404);
  }

  const headers = [
    'Trade #',
    'Date',
    'Symbol',
    'Type',
    'Entry Price',
    'Exit Price',
    'Volume',
    'Profit',
    'Pips',
    'Duration (min)',
    'Result',
  ];

  const data = results.trades.map((trade: any, index: number) => [
    (index + 1).toString(),
    new Date(trade.entryTime).toISOString(),
    trade.symbol,
    trade.type,
    trade.entryPrice.toString(),
    trade.exitPrice.toString(),
    trade.volume.toString(),
    trade.profit.toFixed(2),
    trade.pips?.toString() || '0',
    trade.duration?.toString() || '0',
    trade.profit > 0 ? 'WIN' : 'LOSS',
  ]);

  // Add summary rows
  data.push([]);
  data.push(['SUMMARY', '', '', '', '', '', '', '', '', '', '']);
  data.push(['Total Trades', results.totalTrades?.toString() || '0', '', '', '', '', '', '', '', '', '']);
  data.push(['Win Rate', `${results.winRate || 0}%`, '', '', '', '', '', '', '', '', '']);
  data.push(['Total Profit', results.totalProfit?.toFixed(2) || '0', '', '', '', '', '', '', '', '', '']);
  data.push(['Max Drawdown', results.maxDrawdown?.toFixed(2) || '0', '', '', '', '', '', '', '', '', '']);
  data.push(['Sharpe Ratio', results.sharpeRatio?.toFixed(2) || '0', '', '', '', '', '', '', '', '', '']);
  data.push(['Final Balance', results.finalBalance?.toFixed(2) || '0', '', '', '', '', '', '', '', '', '']);

  if (isBlobStorageConfigured()) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `exports/backtests/${backtest.id}/trades-${timestamp}.csv`;
    
    const file = await uploadCSV(filename, data, { headers });
    
    return createSecureResponse({
      success: true,
      downloadUrl: file.url,
      fileSize: file.size,
      format: 'csv',
      message: 'Backtest exported as CSV successfully',
    });
  } else {
    // Fallback for development - return CSV as text
    const csvContent = [headers.join(','), ...data.map(row => row.join(','))].join('\n');
    
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="backtest-${backtest.id}.csv"`,
      },
    });
  }
}
