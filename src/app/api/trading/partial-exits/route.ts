/**
 * PARTIAL EXITS API
 * Provides endpoints for managing enhanced partial exits
 * Phase 3 Implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createPartialExitManager } from '@/lib/trading/partial-exits';
import { 
  EnhancedPartialExitConfig, 
  PartialExitExecution
} from '@/types';
import { z } from 'zod';

// Validation schemas
const CreatePartialExitConfigSchema = z.object({
  strategyId: z.string(),
  config: z.object({
    enabled: z.boolean(),
    strategy: z.enum(['sequential', 'parallel', 'conditional']),
    levels: z.array(z.object({
      id: z.string(),
      name: z.string(),
      percentage: z.number().min(0.1).max(100),
      trigger: z.object({
        type: z.enum(['profit', 'time', 'price', 'atr', 'trailing', 'regime']),
        value: z.number(),
        operator: z.enum(['gt', 'lt', 'gte', 'lte', 'eq']).optional(),
        timeUnit: z.enum(['minutes', 'hours', 'days']).optional(),
        atrMultiplier: z.number().optional(),
        trailingDistance: z.number().optional(),
        regimes: z.array(z.string()).optional()
      }),
      conditions: z.array(z.object({
        type: z.enum(['time_range', 'market_session', 'volatility', 'regime']),
        value: z.any(),
        operator: z.enum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'in', 'not_in'])
      })).optional(),
      priority: z.number().min(1).max(10),
      reduceAfterExit: z.boolean(),
      moveStopToBreakEven: z.boolean(),
      trailingAfterExit: z.boolean()
    })),
    dynamicAdjustment: z.object({
      enabled: z.boolean(),
      volatilityScaling: z.boolean(),
      timeScaling: z.boolean(),
      regimeScaling: z.boolean(),
      performanceScaling: z.boolean()
    }).optional(),
    riskManagement: z.object({
      maxPartialExits: z.number().min(1).max(10),
      minRemainingSize: z.number().min(0.01),
      emergencyExit: z.object({
        enabled: z.boolean(),
        maxLossPercent: z.number(),
        maxTimeHours: z.number()
      })
    }),
    globalSettings: z.object({
      maxDailyPartialExits: z.number(),
      minTimeBetweenExits: z.number(),
      enableNotifications: z.boolean()
    }).optional(),
    performanceTracking: z.object({
      enabled: z.boolean(),
      trackExitReasons: z.boolean(),
      analyzeOptimalTiming: z.boolean()
    }).optional(),
    integration: z.object({
      smartExits: z.boolean(),
      riskManagement: z.boolean(),
      regimeDetection: z.boolean()
    }).optional()
  })
});

const CalculatePartialExitSchema = z.object({
  tradeId: z.string(),
  symbol: z.string(),
  entryPrice: z.number(),
  currentPrice: z.number(),
  tradeType: z.enum(['BUY', 'SELL']),
  originalQuantity: z.number(),
  remainingQuantity: z.number(),
  entryTime: z.string().datetime(),
  atr: z.number().optional(),
  volatility: z.number().optional(),
  spread: z.number(),
  currentRegime: z.string(),
  regimeConfidence: z.number(),
  currentSession: z.string(),
  config: z.any() // EnhancedPartialExitConfig
});

const ExecutePartialExitSchema = z.object({
  tradeId: z.string(),
  levelId: z.string(),
  symbol: z.string(),
  exitPrice: z.number(),
  exitQuantity: z.number(),
  exitReason: z.string(),
  metadata: z.any().optional()
});

// GET /api/trading/partial-exits
// Get all partial exit configurations for a user
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
    const tradeId = searchParams.get('tradeId');
    const symbol = searchParams.get('symbol');

    // Fetch partial exit configurations
    const whereClause: any = { userId: session.user.id };
    
    if (strategyId) {
      whereClause.strategyId = strategyId;
    }

    // Get strategies with enhanced partial exits
    const strategies = await prisma.strategy.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        symbol: true,
        rules: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Extract enhanced partial exit configurations
    const partialExitConfigs = strategies
      .filter(strategy => strategy.rules && (strategy.rules as any).enhancedPartialExits)
      .map(strategy => ({
        strategyId: strategy.id,
        strategyName: strategy.name,
        symbol: strategy.symbol,
        config: (strategy.rules as any).enhancedPartialExits,
        createdAt: strategy.createdAt,
        updatedAt: strategy.updatedAt
      }));

    // If tradeId is provided, get trade-specific partial exit history
    let partialExitHistory = [];
    if (tradeId) {
      const history = await prisma.$queryRaw`
        SELECT * FROM "PartialExitHistory" 
        WHERE "tradeId" = ${tradeId} 
        ORDER BY "exitSequence" ASC
      `;
      partialExitHistory = history as any[];
    }

    // Get performance statistics
    const performanceStats = await calculatePartialExitPerformance(session.user.id, strategyId || undefined, symbol || undefined);

    return NextResponse.json({
      success: true,
      data: {
        configurations: partialExitConfigs,
        history: partialExitHistory,
        performance: performanceStats
      }
    });

  } catch (error) {
    console.error('Partial Exits GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/trading/partial-exits
// Create or update partial exit configuration
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
    const validatedData = CreatePartialExitConfigSchema.parse(body);

    // Check if strategy exists and belongs to user
    const strategy = await prisma.strategy.findFirst({
      where: {
        id: validatedData.strategyId,
        userId: session.user.id
      }
    });

    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    // Update strategy rules with enhanced partial exits
    const currentRules = strategy.rules as any || {};
    const updatedRules = {
      ...currentRules,
      enhancedPartialExits: validatedData.config
    };

    await prisma.strategy.update({
      where: { id: validatedData.strategyId },
      data: {
        rules: updatedRules,
        updatedAt: new Date()
      }
    });

    // Test the configuration
    const testResult = await testPartialExitConfig(validatedData.config as unknown as EnhancedPartialExitConfig);

    return NextResponse.json({
      success: true,
      data: {
        strategyId: validatedData.strategyId,
        config: validatedData.config,
        testResult
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Partial Exits POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT /api/trading/partial-exits/calculate
// Calculate partial exit recommendations
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = CalculatePartialExitSchema.parse(body);

    // Create partial exit manager
    const partialExitManager = createPartialExitManager(validatedData.config);

    // Calculate partial exit recommendations
    const result = await partialExitManager.calculatePartialExits({
      tradeId: validatedData.tradeId,
      symbol: validatedData.symbol,
      entryPrice: validatedData.entryPrice,
      currentPrice: validatedData.currentPrice,
      tradeType: validatedData.tradeType,
      originalQuantity: validatedData.originalQuantity,
      remainingQuantity: validatedData.remainingQuantity,
      entryTime: new Date(validatedData.entryTime),
      atr: validatedData.atr,
      volatility: validatedData.volatility,
      spread: validatedData.spread,
      currentRegime: validatedData.currentRegime as any,
      regimeConfidence: validatedData.regimeConfidence,
      currentSession: validatedData.currentSession,
      config: validatedData.config
    });

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Partial Exits PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/trading/partial-exits/execute
// Execute a partial exit
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = ExecutePartialExitSchema.parse(body);

    // Get the strategy to extract partial exit config
    const trade = await prisma.trade.findFirst({
      where: { ticket: validatedData.tradeId },
      include: {
        strategy: {
          select: { rules: true }
        }
      }
    });

    if (!trade) {
      return NextResponse.json(
        { error: 'Trade not found' },
        { status: 404 }
      );
    }

    const config = (trade.strategy.rules as any)?.enhancedPartialExits;
    if (!config) {
      return NextResponse.json(
        { error: 'No enhanced partial exit configuration found' },
        { status: 404 }
      );
    }

    // Create partial exit manager
    const partialExitManager = createPartialExitManager(config);

    // Execute the partial exit
    const execution = await partialExitManager.executePartialExit(
      validatedData.levelId,
      {
        tradeId: validatedData.tradeId,
        symbol: validatedData.symbol,
        entryPrice: trade.openPrice,
        currentPrice: validatedData.exitPrice,
        tradeType: trade.type as 'BUY' | 'SELL',
        originalQuantity: trade.lots,
        remainingQuantity: validatedData.exitQuantity,
        entryTime: trade.openTime,
        config
      },
      validatedData.exitPrice
    );

    // Record the partial exit in database
    const existingExits = await prisma.$queryRaw`
      SELECT * FROM "PartialExitHistory" 
      WHERE "tradeId" = ${validatedData.tradeId} 
      ORDER BY "exitSequence" DESC 
      LIMIT 1
    `;

    const nextSequence = (existingExits as any[]).length > 0 ? (existingExits as any[])[0].exitSequence + 1 : 1;

    await prisma.$queryRaw`
      INSERT INTO "PartialExitHistory" (
        "id", "tradeId", "exitSequence", "exitPercentage", "exitPrice", 
        "exitTime", "exitConfig", "exitReason", "profitAtExit", "remainingProfit", "createdAt"
      ) VALUES (
        ${`pe_${Date.now()}_${Math.random()}`}, ${validatedData.tradeId}, ${nextSequence}, 
        ${execution.percentage}, ${execution.price}, ${execution.timestamp}, 
        ${JSON.stringify({
          levelId: execution.levelId,
          levelName: execution.levelName,
          triggerType: execution.triggerType,
          triggerValue: execution.triggerValue
        })}, ${validatedData.exitReason}, ${execution.realizedProfit}, ${0}, ${new Date()}
      )
    `;

    return NextResponse.json({
      success: true,
      data: {
        execution,
        recordedExit: {
          tradeId: validatedData.tradeId,
          exitSequence: nextSequence,
          exitPrice: execution.price,
          exitQuantity: execution.quantity,
          exitReason: validatedData.exitReason
        }
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Partial Exits PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/trading/partial-exits
// Delete partial exit configuration
export async function DELETE(request: NextRequest) {
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
        { error: 'Strategy ID is required' },
        { status: 400 }
      );
    }

    // Check if strategy exists and belongs to user
    const strategy = await prisma.strategy.findFirst({
      where: {
        id: strategyId,
        userId: session.user.id
      }
    });

    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    // Remove enhanced partial exits from strategy rules
    const currentRules = strategy.rules as any || {};
    const updatedRules = { ...currentRules };
    delete updatedRules.enhancedPartialExits;

    await prisma.strategy.update({
      where: { id: strategyId },
      data: {
        rules: updatedRules,
        updatedAt: new Date()
      }
    });

    // Optionally clean up partial exit history
    const cleanHistory = searchParams.get('cleanHistory') === 'true';
    if (cleanHistory) {
      // Get all trades for this strategy
      const trades = await prisma.trade.findMany({
        where: { strategyId },
        select: { ticket: true }
      });

      // Delete partial exit history for these trades
      if (trades.length > 0) {
        await prisma.$queryRaw`
          DELETE FROM "PartialExitHistory" 
          WHERE "tradeId" = ANY(${trades.map(t => t.ticket)})
        `;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        strategyId,
        enhancedPartialExitsRemoved: true,
        historyCleaned: cleanHistory
      }
    });

  } catch (error) {
    console.error('Partial Exits DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper functions
async function calculatePartialExitPerformance(
  userId: string,
  strategyId?: string,
  symbol?: string
) {
  try {
    // Get trades with partial exits
    const tradesWithPartialExits = await prisma.trade.findMany({
      where: {
        userId,
        ...(strategyId && { strategyId }),
        ...(symbol && { symbol })
      }
    });

    // Get partial exit history separately
    const partialExitHistoryMap = new Map();
    if (tradesWithPartialExits.length > 0) {
      const tradeIds = tradesWithPartialExits.map(t => t.ticket);
      const partialExitHistories = await prisma.$queryRaw`
        SELECT * FROM "PartialExitHistory" 
        WHERE "tradeId" = ANY(${tradeIds}) 
        ORDER BY "tradeId", "exitSequence" ASC
      `;
      
      // Group by tradeId
      (partialExitHistories as any[]).forEach((history: any) => {
        if (!partialExitHistoryMap.has(history.tradeId)) {
          partialExitHistoryMap.set(history.tradeId, []);
        }
        partialExitHistoryMap.get(history.tradeId).push(history);
      });
    }

    // Calculate performance metrics
    let totalTrades = 0;
    let totalPartialExits = 0;
    let totalProfitFromPartialExits = 0;
    let averageExitDelay = 0;
    let exitLevelHitRates: Record<string, { hits: number; total: number }> = {};

    tradesWithPartialExits.forEach(trade => {
      const partialExits = partialExitHistoryMap.get(trade.ticket) || [];
      if (partialExits.length > 0) {
        totalTrades++;
        totalPartialExits += partialExits.length;
        
        partialExits.forEach((exit: any, index: number) => {
          totalProfitFromPartialExits += exit.profitAtExit || 0;
          
          // Calculate exit delay (time from entry to exit)
          if (index === 0) {
            const delay = new Date(exit.exitTime).getTime() - trade.openTime.getTime();
            averageExitDelay += delay;
          }
          
          // Track level hit rates
          const levelName = (exit.exitConfig as any)?.levelName || `Level ${exit.exitSequence}`;
          if (!exitLevelHitRates[levelName]) {
            exitLevelHitRates[levelName] = { hits: 0, total: 0 };
          }
          exitLevelHitRates[levelName].hits++;
          exitLevelHitRates[levelName].total++;
        });
      }
    });

    // Calculate averages
    averageExitDelay = totalTrades > 0 ? averageExitDelay / totalTrades : 0;

    // Calculate hit rates
    const levelHitRates = Object.entries(exitLevelHitRates).map(([level, stats]) => ({
      level,
      hitRate: stats.total > 0 ? (stats.hits / stats.total) * 100 : 0,
      totalExits: stats.total
    }));

    return {
      totalTrades,
      totalPartialExits,
      totalProfitFromPartialExits,
      averageExitDelay,
      averageExitsPerTrade: totalTrades > 0 ? totalPartialExits / totalTrades : 0,
      levelHitRates,
      averageProfitPerExit: totalPartialExits > 0 ? totalProfitFromPartialExits / totalPartialExits : 0
    };

  } catch (error) {
    console.error('Error calculating partial exit performance:', error);
    return {
      totalTrades: 0,
      totalPartialExits: 0,
      totalProfitFromPartialExits: 0,
      averageExitDelay: 0,
      averageExitsPerTrade: 0,
      levelHitRates: [],
      averageProfitPerExit: 0
    };
  }
}

async function testPartialExitConfig(config: EnhancedPartialExitConfig) {
  try {
    // Create a test scenario
    const testScenario = {
      tradeId: 'test_trade',
      symbol: 'EURUSD',
      entryPrice: 1.1000,
      currentPrice: 1.1050,
      tradeType: 'BUY' as const,
      originalQuantity: 0.1,
      remainingQuantity: 0.1,
      entryTime: new Date(Date.now() - 3600000), // 1 hour ago
      atr: 0.0010,
      volatility: 0.01,
      spread: 0.0001,
      currentRegime: 'trending' as any,
      regimeConfidence: 80,
      currentSession: 'london',
      config
    };

    // Create partial exit manager and test calculation
    const partialExitManager = createPartialExitManager(config);
    const result = await partialExitManager.calculatePartialExits(testScenario);

    return {
      valid: true,
      shouldExit: result.shouldExit,
      recommendedExits: result.recommendedExits.length,
      testPassed: true,
      message: 'Configuration test successful'
    };

  } catch (error) {
    return {
      valid: false,
      shouldExit: false,
      recommendedExits: 0,
      testPassed: false,
      message: error instanceof Error ? error.message : 'Test failed'
    };
  }
}