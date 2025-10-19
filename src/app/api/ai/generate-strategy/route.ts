import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createOpenRouterAI } from '@/lib/ai/openrouter';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Request validation schema
const GenerateStrategyRequestSchema = z.object({
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

    const body = await request.json();
    const { prompt, model } = GenerateStrategyRequestSchema.parse(body);

    // Check user's AI generation limit
    const userStrategies = await prisma.strategy.count({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: new Date(new Date().setDate(new Date().getDate() - 1)), // Last 24 hours
        },
      },
    });

    const dailyLimit = 10; // 10 strategies per day
    if (userStrategies >= dailyLimit) {
      return NextResponse.json(
        { error: `Daily AI generation limit reached (${dailyLimit} strategies per day)` },
        { status: 429 }
      );
    }

    // Initialize OpenRouter AI
    const ai = createOpenRouterAI(
      process.env.OPENROUTER_API_KEY,
      model
    );

    // Generate strategy
    const strategyData = await ai.generateStrategy(prompt);

    // Create strategy in database
    const strategy = await prisma.strategy.create({
      data: {
        ...strategyData,
        id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: session.user.id,
        source: 'ai',
        sourceModel: model || 'anthropic/claude-3-haiku:beta',
        sourcePrompt: prompt,
        isActive: false,
      },
    });

    return NextResponse.json({
      success: true,
      strategy,
    });

  } catch (error) {
    console.error('AI Strategy Generation error:', error);

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
        error: 'Failed to generate strategy',
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

    // Return available models and daily usage info
    const userStrategies = await prisma.strategy.count({
      where: {
        userId: session.user.id,
        source: 'ai',
        createdAt: {
          gte: new Date(new Date().setDate(new Date().getDate() - 1)), // Last 24 hours
        },
      },
    });

    const dailyLimit = 10;
    const remainingLimit = Math.max(0, dailyLimit - userStrategies);

    return NextResponse.json({
      models: [
        'anthropic/claude-3-haiku:beta',
        'anthropic/claude-3-sonnet:beta',
        'anthropic/claude-3-opus:beta',
        'openai/gpt-4-turbo-preview',
        'openai/gpt-4',
        'openai/gpt-3.5-turbo',
        'google/gemini-pro',
      ],
      usage: {
        dailyLimit,
        used: userStrategies,
        remaining: remainingLimit,
      },
    });

  } catch (error) {
    console.error('AI Strategy GET error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
