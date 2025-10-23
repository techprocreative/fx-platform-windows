// API Route: POST /api/supervisor/optimize
// Trigger parameter optimization for a strategy

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { LLMSupervisor } from '@/lib/supervisor/llm-supervisor';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { strategyId, executorIds, forceOptimize = false } = body;
    
    // Validation
    if (!strategyId || !executorIds || !Array.isArray(executorIds) || executorIds.length === 0) {
      return NextResponse.json(
        { error: 'strategyId and executorIds[] are required' },
        { status: 400 }
      );
    }
    
    // Verify strategy ownership
    const strategy = await prisma.strategy.findFirst({
      where: {
        id: strategyId,
        userId: session.user.id
      }
    });
    
    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found or access denied' },
        { status: 404 }
      );
    }
    
    // Verify executor ownership
    const executors = await prisma.executor.findMany({
      where: {
        id: { in: executorIds },
        userId: session.user.id
      }
    });
    
    if (executors.length !== executorIds.length) {
      return NextResponse.json(
        { error: 'One or more executors not found or access denied' },
        { status: 404 }
      );
    }
    
    console.log(`🧠 Optimization requested by user ${session.user.id} for strategy ${strategyId}`);
    
    // Trigger optimization
    const result = await LLMSupervisor.optimizeStrategy({
      strategyId,
      executorIds,
      userId: session.user.id,
      forceOptimize
    });
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('❌ Optimization API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        status: 'ERROR',
        error: error.message || 'Internal server error'
      },
      { status: 500 }
    );
  }
}

// GET /api/supervisor/optimize?strategyId=xxx
// Get optimization history for a strategy
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
    const strategyId = searchParams.get('strategyId');
    
    if (!strategyId) {
      return NextResponse.json(
        { error: 'strategyId is required' },
        { status: 400 }
      );
    }
    
    // Verify strategy ownership
    const strategy = await prisma.strategy.findFirst({
      where: {
        id: strategyId,
        userId: session.user.id
      }
    });
    
    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found or access denied' },
        { status: 404 }
      );
    }
    
    // Get optimization history
    const optimizations = await prisma.parameterOptimization.findMany({
      where: { strategyId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    
    return NextResponse.json({
      success: true,
      optimizations: optimizations.map(opt => ({
        id: opt.id,
        status: opt.status,
        confidence: opt.confidenceScore,
        currentParams: opt.currentParams,
        proposedParams: opt.proposedParams,
        reasoning: opt.reasoning,
        createdAt: opt.approvedAt
      }))
    });
    
  } catch (error: any) {
    console.error('❌ Get optimization history error:', error);
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
