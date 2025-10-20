import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { createOpenRouterAI } from '../../../../lib/ai/openrouter';
import { prisma } from '../../../../lib/prisma';
import { z } from 'zod';

// Request validation schema
const OptimizeStrategyRequestSchema = z.object({
  strategyId: z.string(),
  model: z.string().optional(),
  performanceGoals: z.object({
    targetWinRate: z.number().min(0).max(100).optional(),
    targetProfitFactor: z.number().min(0).optional(),
    maxDrawdown: z.number().min(0).max(100).optional(),
  }).optional(),
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
    const { strategyId, model, performanceGoals } = OptimizeStrategyRequestSchema.parse(body);

    // Fetch strategy
    const strategy = await prisma.strategy.findUnique({
      where: { id: strategyId },
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

    // Get recent backtest performance data
    const recentBacktest = await prisma.backtest.findFirst({
      where: {
        strategyId,
        userId: session.user.id,
        status: 'completed',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!recentBacktest) {
      return NextResponse.json(
        { error: 'Strategy must have at least one completed backtest before optimization' },
        { status: 400 }
      );
    }

    // Check user's AI optimization limit
    const userOptimizations = await prisma.strategy.count({
      where: {
        userId: session.user.id,
        type: 'ai_generated',
        aiPrompt: {
          contains: 'Optimized based on strategy',
        },
        createdAt: {
          gte: new Date(new Date().setDate(new Date().getDate() - 1)), // Last 24 hours
        },
      },
    });

    const dailyLimit = 5; // 5 optimizations per day
    if (userOptimizations >= dailyLimit) {
      return NextResponse.json(
        { error: `Daily AI optimization limit reached (${dailyLimit} optimizations per day)` },
        { status: 429 }
      );
    }

    // Initialize OpenRouter AI
    const ai = createOpenRouterAI(
      process.env.OPENROUTER_API_KEY,
      model
    );

    // Extract performance metrics from results Json
    const results = recentBacktest.results as any || {};
    const performanceData = {
      currentMetrics: {
        winRate: results.winRate || 0,
        profitFactor: results.profitFactor || 0,
        maxDrawdown: results.maxDrawdown || 0,
        returnPercentage: results.returnPercentage || 0,
        sharpeRatio: results.sharpeRatio || 0,
      },
      targetGoals: performanceGoals || {
        targetWinRate: 60,
        targetProfitFactor: 1.5,
        maxDrawdown: 20,
      },
    };

    // Optimize strategy
    const optimizedStrategyData = await ai.optimizeStrategy({
      ...strategy,
      description: strategy.description || undefined,
      type: strategy.type as 'ai_generated' | 'manual' | 'imported',
      status: strategy.status as 'draft' | 'active' | 'paused' | 'archived',
    }, performanceData);

    // Create optimized strategy in database
    const optimizedStrategy = await prisma.strategy.create({
      data: {
        name: optimizedStrategyData.name || strategy.name || 'Optimized Strategy',
        description: optimizedStrategyData.description || strategy.description || null,
        symbol: optimizedStrategyData.symbol || strategy.symbol || 'EURUSD',
        timeframe: optimizedStrategyData.timeframe || strategy.timeframe || 'H1',
        rules: (optimizedStrategyData.rules || {}) as any,
        userId: session.user.id,
        type: 'ai_generated',
        aiPrompt: `Optimized based on strategy ${strategyId}`,
        status: 'draft',
      },
    });

    return NextResponse.json({
      success: true,
      optimizedStrategy,
      performanceData,
    });

  } catch (error) {
    console.error('AI Strategy Optimization error:', error);

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
        error: 'Failed to optimize strategy',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
