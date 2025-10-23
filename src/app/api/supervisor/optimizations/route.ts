// API Route: GET /api/supervisor/optimizations
// Get user's optimization history with strategy details

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const strategyId = searchParams.get('strategyId');
    
    // Get user's optimization history
    const optimizations = await prisma.parameterOptimization.findMany({
      where: {
        userId: session.user.id,
        ...(strategyId && { strategyId })
      },
      include: {
        strategy: {
          select: {
            name: true,
            symbol: true,
            timeframe: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    
    return NextResponse.json({
      success: true,
      optimizations: optimizations.map(opt => ({
        id: opt.id,
        strategyId: opt.strategyId,
        status: opt.status,
        confidence: opt.confidenceScore,
        currentParams: opt.currentParams,
        proposedParams: opt.proposedParams,
        reasoning: opt.reasoning,
        createdAt: opt.approvedAt,
        strategy: opt.strategy
      }))
    });
    
  } catch (error: any) {
    console.error('❌ Get optimizations API error:', error);
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
