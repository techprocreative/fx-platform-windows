import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { z } from 'zod';

import { authOptions } from '../../../../lib/auth';
import { createOpenRouterAI } from '../../../../lib/ai/openrouter';
import { prisma } from '../../../../lib/prisma';

// Request validation schema
const GenerateStrategyPreviewSchema = z.object({
  prompt: z.string().min(10).max(1000),
  model: z.string().optional(),
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

    // Check if OpenRouter API key is configured
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY not configured');
      return NextResponse.json(
        { 
          error: 'AI service is not configured. Please contact administrator.',
          code: 'SERVICE_UNAVAILABLE'
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { prompt, model: requestModel } = GenerateStrategyPreviewSchema.parse(body);
    
    // Force use of Grok 4 Fast model from OpenRouter
    const model = 'x-ai/grok-4-fast';

    // Check user's AI generation limit (same as full generation)
    const recentGenerations = await prisma.strategy.count({
      where: {
        userId: session.user.id,
        type: 'ai_generated',
        createdAt: {
          gte: new Date(new Date().setDate(new Date().getDate() - 1)), // Last 24 hours
        },
      },
    });

    const dailyLimit = 10; // 10 generations per day
    if (recentGenerations >= dailyLimit) {
      return NextResponse.json(
        { 
          error: `Daily AI generation limit reached (${dailyLimit} generations per day)`,
          code: 'LIMIT_REACHED'
        },
        { status: 429 }
      );
    }

    // Initialize OpenRouter AI with Grok
    const ai = createOpenRouterAI(
      process.env.OPENROUTER_API_KEY,
      model
    );

    // Generate strategy (but don't save to database yet)
    const strategyData = await ai.generateStrategy(prompt);
    
    // Debug logging
    console.log('📤 API Response - Sending to client:', {
      symbol: strategyData.symbol,
      timeframe: strategyData.timeframe,
      name: strategyData.name,
    });

    // Return the generated data for preview/editing
    return NextResponse.json({
      success: true,
      strategy: {
        name: strategyData.name || 'AI Generated Strategy',
        description: strategyData.description || '',
        symbol: strategyData.symbol,
        timeframe: strategyData.timeframe,
        rules: strategyData.rules || [],
        prompt,
        model: 'x-ai/grok-4-fast',
      },
      usage: {
        used: recentGenerations,
        remaining: dailyLimit - recentGenerations - 1,
        dailyLimit,
      },
    });

  } catch (error) {
    console.error('AI Strategy Preview error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    // Check if it's an API key error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('401') || errorMessage.includes('API key')) {
      return NextResponse.json(
        { 
          error: 'AI service authentication failed. Please contact administrator.',
          code: 'AUTH_ERROR',
          details: 'The OpenRouter API key may be invalid or not configured.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to generate strategy',
        details: errorMessage,
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

    // Return available models and daily usage info
    const recentGenerations = await prisma.strategy.count({
      where: {
        userId: session.user.id,
        type: 'ai_generated',
        createdAt: {
          gte: new Date(new Date().setDate(new Date().getDate() - 1)), // Last 24 hours
        },
      },
    });

    const dailyLimit = 10;
    const remainingLimit = Math.max(0, dailyLimit - recentGenerations);

    return NextResponse.json({
      model: {
        id: 'x-ai/grok-4-fast',
        name: 'Grok 4 Fast',
        provider: 'xAI',
      },
      usage: {
        dailyLimit,
        used: recentGenerations,
        remaining: remainingLimit,
      },
    });

  } catch (error) {
    console.error('AI Strategy Preview GET error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
