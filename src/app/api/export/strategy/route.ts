/**
 * STRATEGY EXPORT API
 * Export strategies to Vercel Blob storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { 
  uploadStrategyExport, 
  isBlobStorageConfigured,
  getStorageStatus 
} from '../../../../lib/storage/vercel-blob';
import { 
  createSecureResponse, 
  createErrorResponse,
  rateLimit,
  getClientIP
} from '../../../../lib/api-security';

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
      `export_${ip}_${session.user.id}`,
      10, // 10 exports
      3600000 // per hour
    );

    if (!rateLimitResult.allowed) {
      return createErrorResponse('Rate limit exceeded', 429, {
        retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
      });
    }

    // Check storage configuration
    const storageStatus = getStorageStatus();
    if (!storageStatus.configured && process.env.NODE_ENV === 'production') {
      return createErrorResponse('File storage not configured', 503);
    }

    // Parse request
    const body = await request.json();
    const { strategyId } = body;

    if (!strategyId) {
      return createErrorResponse('Strategy ID is required', 400);
    }

    // Fetch strategy
    const strategy = await prisma.strategy.findUnique({
      where: { id: strategyId },
      include: {
        backtests: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        trades: {
          orderBy: { openTime: 'desc' },
          take: 100,
        },
      },
    });

    if (!strategy) {
      return createErrorResponse('Strategy not found', 404);
    }

    // Verify ownership
    if (strategy.userId !== session.user.id) {
      return createErrorResponse('Access denied', 403);
    }

    // Prepare export data
    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      strategy: {
        id: strategy.id,
        name: strategy.name,
        description: strategy.description,
        symbol: strategy.symbol,
        timeframe: strategy.timeframe,
        type: strategy.type,
        rules: strategy.rules,
        version: strategy.version,
        createdAt: strategy.createdAt,
        updatedAt: strategy.updatedAt,
      },
      performance: {
        totalTrades: strategy.trades.length,
        winRate: calculateWinRate(strategy.trades),
        totalProfit: calculateTotalProfit(strategy.trades),
        bestTrade: findBestTrade(strategy.trades),
        worstTrade: findWorstTrade(strategy.trades),
      },
      recentBacktests: strategy.backtests.map(bt => ({
        id: bt.id,
        dateFrom: bt.dateFrom,
        dateTo: bt.dateTo,
        initialBalance: bt.initialBalance,
        status: bt.status,
        createdAt: bt.createdAt,
      })),
      recentTrades: strategy.trades.map(trade => ({
        ticket: trade.ticket,
        symbol: trade.symbol,
        type: trade.type,
        lots: trade.lots,
        openTime: trade.openTime,
        openPrice: trade.openPrice,
        closeTime: trade.closeTime,
        closePrice: trade.closePrice,
        profit: trade.profit,
        pips: trade.pips,
      })),
    };

    // Upload to storage
    if (isBlobStorageConfigured()) {
      const file = await uploadStrategyExport(strategyId, exportData);
      
      return createSecureResponse({
        success: true,
        downloadUrl: file.url,
        fileSize: file.size,
        expiresIn: 2592000, // 30 days
        message: 'Strategy exported successfully',
      });
    } else {
      // Fallback: Return JSON directly for development
      return createSecureResponse({
        success: true,
        data: exportData,
        message: 'Strategy export (development mode)',
      });
    }
  } catch (error) {
    console.error('Strategy export error:', error);
    return createErrorResponse('Failed to export strategy', 500);
  }
}

// Helper functions
function calculateWinRate(trades: any[]): number {
  if (trades.length === 0) return 0;
  const wins = trades.filter(t => t.profit && t.profit > 0).length;
  return Math.round((wins / trades.length) * 100);
}

function calculateTotalProfit(trades: any[]): number {
  return trades.reduce((sum, trade) => sum + (trade.profit || 0), 0);
}

function findBestTrade(trades: any[]): any {
  if (trades.length === 0) return null;
  return trades.reduce((best, trade) => 
    (trade.profit || 0) > (best.profit || 0) ? trade : best
  );
}

function findWorstTrade(trades: any[]): any {
  if (trades.length === 0) return null;
  return trades.reduce((worst, trade) => 
    (trade.profit || 0) < (worst.profit || 0) ? trade : worst
  );
}
