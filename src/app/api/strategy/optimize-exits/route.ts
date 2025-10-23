/**
 * STRATEGY EXIT OPTIMIZATION API
 * Provides smart exit calculation and optimization for trading strategies
 * Phase 2.3 Implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { SmartExitCalculator } from '@/lib/trading/smart-exits';
import { riskManager } from '@/lib/risk/risk-manager';
import { HistoricalDataFetcher } from '@/lib/backtest/engine';
import { 
  SmartExitRules,
  ExitCalculationParams,
  ExitCalculationResult,
  ApiResponse,
  PartialExitCalculationParams,
  PartialExitCalculationResult,
  EnhancedPartialExitConfig,
  MarketRegime
} from '@/types';

// Request validation schema
const ExitOptimizationSchema = z.object({
  symbol: z.string().min(1).max(10),
  entryPrice: z.number().positive(),
  tradeType: z.enum(['BUY', 'SELL']),
  currentPrice: z.number().positive().optional(),
  atr: z.number().positive().optional(),
  swingPoints: z.array(z.object({
    timestamp: z.string(),
    price: z.number(),
    type: z.enum(['high', 'low']),
    strength: z.number().min(1).max(5)
  })).optional(),
  optimizationType: z.enum(['basic', 'advanced', 'comprehensive']).optional().default('advanced'),
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']).optional().default('moderate'),
  includePartialExits: z.boolean().optional().default(true),
  includeRegimeAdjustment: z.boolean().optional().default(true),
  historicalData: z.object({
    winRate: z.number().min(0).max(1),
    avgWin: z.number(),
    avgLoss: z.number(),
    totalTrades: z.number().positive()
  }).optional(),
  existingExitRules: z.object({
    stopLoss: z.object({
      type: z.enum(['fixed', 'atr', 'support', 'trailing']),
      atrMultiplier: z.number().optional(),
      useSwingPoints: z.boolean().optional(),
      swingLookback: z.number().optional(),
      maxHoldingHours: z.number().optional()
    }),
    takeProfit: z.object({
      type: z.enum(['fixed', 'rr_ratio', 'resistance', 'partial']),
      rrRatio: z.number().optional(),
      partialExits: z.array(z.object({
        percentage: z.number(),
        atRR: z.number()
      })).optional()
    })
  }).optional()
});

/**
 * POST /api/strategy/optimize-exits
 * Optimize exit levels for a trading strategy
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }, { status: 401 });
    }

    const body = await request.json();
    const validatedParams = ExitOptimizationSchema.parse(body);

    const {
      symbol,
      entryPrice,
      tradeType,
      currentPrice,
      atr,
      swingPoints,
      optimizationType,
      riskTolerance,
      includePartialExits,
      includeRegimeAdjustment,
      historicalData,
      existingExitRules
    } = validatedParams;

    // Initialize optimization result
    const optimizationResult: any = {
      symbol,
      entryPrice,
      tradeType,
      optimizationType,
      riskTolerance,
      timestamp: new Date().toISOString(),
      userId: session.user.id
    };

    // 1. Get current market data
    try {
      const marketData = await getCurrentMarketData(symbol);
      optimizationResult.marketData = marketData;
      
      // Use current price from market if not provided
      const priceToUse = currentPrice || marketData.currentPrice;
      const atrToUse = atr || marketData.atr;
      
      optimizationResult.currentPrice = priceToUse;
      optimizationResult.atr = atrToUse;
    } catch (error) {
      console.error('Failed to get market data:', error);
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'MARKET_DATA_ERROR',
          message: 'Failed to retrieve market data',
          details: { message: error instanceof Error ? error.message : 'Unknown error' }
        }
      }, { status: 500 });
    }

    // 2. Get swing points if not provided
    let swingPointsToUse = swingPoints;
    if (!swingPointsToUse && optimizationType !== 'basic') {
      try {
        swingPointsToUse = await getSwingPoints(symbol, 'H1', 50);
        optimizationResult.swingPoints = swingPointsToUse;
      } catch (error) {
        console.error('Failed to get swing points:', error);
        swingPointsToUse = [];
      }
    }

    // 3. Detect market regime (if requested)
    let currentRegime: MarketRegime | null = null;
    if (includeRegimeAdjustment && optimizationType === 'comprehensive') {
      try {
        currentRegime = await detectMarketRegime(symbol, 'H1', 30);
        optimizationResult.marketRegime = currentRegime;
      } catch (error) {
        console.error('Failed to detect market regime:', error);
        currentRegime = null;
      }
    }

    // 4. Generate optimized exit rules
    const optimizedExitRules = generateOptimizedExitRules(
      riskTolerance,
      optimizationType,
      currentRegime,
      historicalData,
      existingExitRules
    );
    optimizationResult.optimizedExitRules = optimizedExitRules;

    // 5. Calculate exit levels using optimized rules
    try {
      const exitParams: ExitCalculationParams = {
        entryPrice,
        tradeType,
        atr: optimizationResult.atr,
        swingPoints: (swingPointsToUse || []).map(sp => ({
          ...sp,
          timestamp: new Date(sp.timestamp)
        })),
        currentPrice: optimizationResult.currentPrice,
        timestamp: new Date()
      };

      const exitCalculation = SmartExitCalculator.calculateExits(exitParams, optimizedExitRules);
      optimizationResult.exitCalculation = exitCalculation;
    } catch (error) {
      console.error('Failed to calculate exits:', error);
      optimizationResult.exitCalculation = {
        error: 'Failed to calculate exit levels',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // 6. Partial exits optimization (if requested)
    if (includePartialExits && optimizationType !== 'basic') {
      try {
        const partialExitConfig = generatePartialExitConfig(
          riskTolerance,
          optimizationType,
          historicalData,
          currentRegime
        );

        const partialExitParams: PartialExitCalculationParams = {
          tradeId: `optimization_${Date.now()}`,
          symbol,
          entryPrice,
          currentPrice: optimizationResult.currentPrice,
          tradeType,
          originalQuantity: 1.0, // Standardized for optimization
          remainingQuantity: 1.0,
          entryTime: new Date(),
          atr: optimizationResult.atr,
          currentRegime: currentRegime || undefined,
          config: partialExitConfig
        };

        const partialExitResult = await calculatePartialExits(partialExitParams);
        optimizationResult.partialExitOptimization = partialExitResult;
      } catch (error) {
        console.error('Failed to optimize partial exits:', error);
        optimizationResult.partialExitOptimization = {
          error: 'Failed to optimize partial exits',
          details: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // 7. Risk validation and recommendations
    try {
      const riskValidation = await validateExitOptimization(
        optimizationResult,
        riskTolerance,
        session.user.id
      );
      optimizationResult.riskValidation = riskValidation;
    } catch (error) {
      console.error('Failed to validate optimization:', error);
      optimizationResult.riskValidation = {
        error: 'Failed to validate optimization',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // 8. Generate optimization summary and recommendations
    try {
      const summary = generateOptimizationSummary(optimizationResult);
      optimizationResult.summary = summary;
    } catch (error) {
      console.error('Failed to generate summary:', error);
      optimizationResult.summary = {
        error: 'Failed to generate optimization summary',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    return NextResponse.json<ApiResponse<typeof optimizationResult>>({
      success: true,
      data: optimizationResult
    });

  } catch (error) {
    console.error('Exit optimization API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: { errors: error.errors }
        }
      }, { status: 400 });
    }

    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to optimize exits',
        details: { message: error instanceof Error ? error.message : 'Unknown error' }
      }
    }, { status: 500 });
  }
}

/**
 * GET /api/strategy/optimize-exits
 * Get exit optimization recommendations with query parameters
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    
    // Extract and validate parameters
    const params = {
      symbol: searchParams.get('symbol'),
      entryPrice: searchParams.get('entryPrice') ? parseFloat(searchParams.get('entryPrice')!) : undefined,
      tradeType: searchParams.get('tradeType') as any,
      currentPrice: searchParams.get('currentPrice') ? parseFloat(searchParams.get('currentPrice')!) : undefined,
      atr: searchParams.get('atr') ? parseFloat(searchParams.get('atr')!) : undefined,
      optimizationType: searchParams.get('optimizationType') as any || 'advanced',
      riskTolerance: searchParams.get('riskTolerance') as any || 'moderate',
      includePartialExits: searchParams.get('includePartialExits') === 'true',
      includeRegimeAdjustment: searchParams.get('includeRegimeAdjustment') === 'true'
    };

    // Validate required parameters
    if (!params.symbol || !params.entryPrice || !params.tradeType) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Missing required parameters: symbol, entryPrice, tradeType',
          details: { required: ['symbol', 'entryPrice', 'tradeType'] }
        }
      }, { status: 400 });
    }

    // Validate parameters using schema
    const validatedParams = ExitOptimizationSchema.parse(params);

    // Create a mock request body for the POST handler
    const mockRequest = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify(validatedParams),
      headers: { 'Content-Type': 'application/json' }
    });

    // Reuse the POST logic
    return await POST(mockRequest);

  } catch (error) {
    console.error('Exit optimization GET API error:', error);

    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to optimize exits',
        details: { message: error instanceof Error ? error.message : 'Unknown error' }
      }
    }, { status: 500 });
  }
}

/**
 * Get current market data for a symbol
 */
async function getCurrentMarketData(symbol: string): Promise<{
  currentPrice: number;
  atr: number;
  spread: number;
  volatility: number;
}> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 14);

    const historicalData = await HistoricalDataFetcher.fetchFromYahooFinance(
      symbol,
      'D1',
      startDate,
      endDate
    );

    if (historicalData.length === 0) {
      throw new Error(`No historical data available for ${symbol}`);
    }

    const currentPrice = historicalData[historicalData.length - 1].close;
    
    // Calculate ATR (simplified)
    const trValues = [];
    for (let i = 1; i < historicalData.length; i++) {
      const high = historicalData[i].high;
      const low = historicalData[i].low;
      const prevClose = historicalData[i - 1].close;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trValues.push(tr);
    }
    
    const atr = trValues.length > 0 
      ? trValues.reduce((sum, tr) => sum + tr, 0) / trValues.length 
      : currentPrice * 0.001; // Default 0.1% if no data

    // Calculate volatility
    const returns = [];
    for (let i = 1; i < historicalData.length; i++) {
      returns.push((historicalData[i].close - historicalData[i - 1].close) / historicalData[i - 1].close);
    }
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);

    return {
      currentPrice,
      atr,
      spread: currentPrice * 0.0001, // Mock spread (1 pip)
      volatility
    };
  } catch (error) {
    throw new Error(`Failed to get market data for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get swing points for a symbol
 */
async function getSwingPoints(symbol: string, timeframe: string, lookback: number): Promise<any[]> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - lookback);

    const historicalData = await HistoricalDataFetcher.fetchFromYahooFinance(
      symbol,
      timeframe,
      startDate,
      endDate
    );

    if (historicalData.length < 10) {
      return [];
    }

    // Simple swing point detection (mock implementation)
    const swingPoints = [];
    
    for (let i = 2; i < historicalData.length - 2; i++) {
      const current = historicalData[i];
      const prev1 = historicalData[i - 1];
      const prev2 = historicalData[i - 2];
      const next1 = historicalData[i + 1];
      const next2 = historicalData[i + 2];

      // High swing point
      if (current.high > prev1.high && current.high > prev2.high && 
          current.high > next1.high && current.high > next2.high) {
        swingPoints.push({
          timestamp: current.timestamp.toISOString(),
          price: current.high,
          type: 'high',
          strength: Math.min(5, Math.floor(Math.random() * 5) + 1)
        });
      }

      // Low swing point
      if (current.low < prev1.low && current.low < prev2.low && 
          current.low < next1.low && current.low < next2.low) {
        swingPoints.push({
          timestamp: current.timestamp.toISOString(),
          price: current.low,
          type: 'low',
          strength: Math.min(5, Math.floor(Math.random() * 5) + 1)
        });
      }
    }

    return swingPoints;
  } catch (error) {
    console.error('Failed to get swing points:', error);
    return [];
  }
}

/**
 * Detect market regime
 */
async function detectMarketRegime(symbol: string, timeframe: string, lookbackDays: number): Promise<MarketRegime> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - lookbackDays);

    const historicalData = await HistoricalDataFetcher.fetchFromYahooFinance(
      symbol,
      timeframe,
      startDate,
      endDate
    );

    if (historicalData.length < 20) {
      return MarketRegime.RANGING; // Default
    }

    const recentPrices = historicalData.slice(-20).map(d => d.close);
    const priceChange = (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0];
    
    // Simple regime detection
    if (Math.abs(priceChange) > 0.02) {
      return priceChange > 0 ? MarketRegime.TRENDING_UP : MarketRegime.TRENDING_DOWN;
    } else {
      return MarketRegime.RANGING;
    }
  } catch (error) {
    console.error('Failed to detect market regime:', error);
    return MarketRegime.RANGING;
  }
}

/**
 * Generate optimized exit rules based on parameters
 */
function generateOptimizedExitRules(
  riskTolerance: string,
  optimizationType: string,
  currentRegime: MarketRegime | null,
  historicalData?: any,
  existingRules?: any
): SmartExitRules {
  const baseRules: SmartExitRules = {
    stopLoss: {
      type: 'atr'
    },
    takeProfit: {
      type: 'rr_ratio'
    }
  };

  // Adjust based on risk tolerance
  if (riskTolerance === 'conservative') {
    baseRules.stopLoss.atrMultiplier = 1.5;
    baseRules.takeProfit.rrRatio = 1.5;
  } else if (riskTolerance === 'aggressive') {
    baseRules.stopLoss.atrMultiplier = 2.5;
    baseRules.takeProfit.rrRatio = 3.0;
  } else {
    baseRules.stopLoss.atrMultiplier = 2.0;
    baseRules.takeProfit.rrRatio = 2.0;
  }

  // Adjust based on market regime
  if (currentRegime) {
    if (currentRegime === MarketRegime.VOLATILE) {
      baseRules.stopLoss.atrMultiplier! *= 1.5;
      baseRules.takeProfit.rrRatio! *= 1.2;
    } else if (currentRegime === MarketRegime.RANGING) {
      baseRules.stopLoss.atrMultiplier! *= 0.8;
      baseRules.takeProfit.rrRatio! *= 0.8;
    }
  }

  // Advanced optimization
  if (optimizationType === 'advanced' || optimizationType === 'comprehensive') {
    baseRules.stopLoss.useSwingPoints = true;
    baseRules.stopLoss.swingLookback = 10;
    baseRules.stopLoss.maxHoldingHours = riskTolerance === 'conservative' ? 24 : 48;
  }

  // Comprehensive optimization
  if (optimizationType === 'comprehensive') {
    baseRules.takeProfit.type = 'partial';
    baseRules.takeProfit.partialExits = [
      { percentage: 30, atRR: 1.0 },
      { percentage: 30, atRR: 1.5 },
      { percentage: 40, atRR: 2.0 }
    ];
  }

  return baseRules;
}

/**
 * Generate partial exit configuration
 */
function generatePartialExitConfig(
  riskTolerance: string,
  optimizationType: string,
  historicalData?: any,
  currentRegime?: MarketRegime | null
): EnhancedPartialExitConfig {
  const baseConfig: EnhancedPartialExitConfig = {
    enabled: true,
    strategy: 'sequential',
    levels: [],
    globalSettings: {
      allowReentry: false,
      minRemainingPosition: 10,
      maxDailyPartialExits: 5,
      cooldownPeriod: 30,
      reduceInHighVolatility: true,
      volatilityThreshold: 0.02,
      adjustForSpread: true,
      maxSpreadPercentage: 0.001,
      respectMarketSessions: true,
      avoidNewsEvents: false,
      newsBufferMinutes: 30
    },
    performanceTracking: {
      enabled: true,
      trackEffectiveness: true,
      optimizeLevels: false,
      lookbackPeriod: 30
    },
    integration: {
      withSmartExits: true,
      withTrailingStops: true,
      withRiskManagement: true,
      withRegimeDetection: true
    }
  };

  // Generate exit levels based on risk tolerance and regime
  if (riskTolerance === 'conservative') {
    baseConfig.levels = [
      {
        id: 'partial_1',
        name: 'First Target',
        percentage: 40,
        triggerType: 'profit',
        profitTarget: { type: 'rr_ratio', value: 1.0 },
        isActive: true,
        priority: 1
      },
      {
        id: 'partial_2',
        name: 'Second Target',
        percentage: 60,
        triggerType: 'profit',
        profitTarget: { type: 'rr_ratio', value: 1.5 },
        isActive: true,
        priority: 2
      }
    ];
  } else if (riskTolerance === 'aggressive') {
    baseConfig.levels = [
      {
        id: 'partial_1',
        name: 'Quick Profit',
        percentage: 20,
        triggerType: 'profit',
        profitTarget: { type: 'rr_ratio', value: 0.8 },
        isActive: true,
        priority: 1
      },
      {
        id: 'partial_2',
        name: 'Main Target',
        percentage: 30,
        triggerType: 'profit',
        profitTarget: { type: 'rr_ratio', value: 1.5 },
        isActive: true,
        priority: 2
      },
      {
        id: 'partial_3',
        name: 'Full Target',
        percentage: 50,
        triggerType: 'profit',
        profitTarget: { type: 'rr_ratio', value: 2.5 },
        isActive: true,
        priority: 3
      }
    ];
  } else {
    baseConfig.levels = [
      {
        id: 'partial_1',
        name: 'First Target',
        percentage: 30,
        triggerType: 'profit',
        profitTarget: { type: 'rr_ratio', value: 1.0 },
        isActive: true,
        priority: 1
      },
      {
        id: 'partial_2',
        name: 'Second Target',
        percentage: 70,
        triggerType: 'profit',
        profitTarget: { type: 'rr_ratio', value: 2.0 },
        isActive: true,
        priority: 2
      }
    ];
  }

  return baseConfig;
}

/**
 * Calculate partial exits (mock implementation)
 */
async function calculatePartialExits(params: PartialExitCalculationParams): Promise<PartialExitCalculationResult> {
  // Mock implementation - in production, use actual partial exit calculation logic
  const currentProfit = params.tradeType === 'BUY' 
    ? (params.currentPrice - params.entryPrice) / params.entryPrice * 100
    : (params.entryPrice - params.currentPrice) / params.entryPrice * 100;

  const recommendedExits = params.config.levels.map(level => ({
    levelId: level.id,
    levelName: level.name,
    percentage: level.percentage,
    quantity: params.originalQuantity * (level.percentage / 100),
    price: params.entryPrice * (1 + (params.tradeType === 'BUY' ? 1 : -1) * (level.profitTarget?.value || 0.01)),
    reason: `Target ${level.profitTarget?.value} RR ratio`,
    confidence: 75 + Math.random() * 20,
    urgency: currentProfit > (level.profitTarget?.value || 0.01) * 100 ? 'immediate' as const : 'medium' as const
  }));

  return {
    shouldExit: recommendedExits.length > 0,
    recommendedExits,
    analysis: {
      currentProfit,
      currentProfitPercentage: currentProfit,
      unrealizedProfit: currentProfit * params.originalQuantity / 100,
      riskExposure: Math.abs(currentProfit),
      marketConditions: {
        regime: params.currentRegime || MarketRegime.RANGING,
        volatility: currentProfit > 2 ? 'high' as const : currentProfit > 1 ? 'normal' as const : 'low' as const,
        trend: currentProfit > 0 ? 'up' as const : 'down' as const,
        strength: Math.abs(currentProfit)
      },
      riskMetrics: {
        currentRisk: Math.abs(currentProfit),
        maxRisk: 5,
        riskReductionPotential: recommendedExits.length * 0.5,
        stopLossDistance: params.atr ? params.atr * 2 : 0.01
      }
    },
    predictions: {
      expectedProfit: currentProfit * 0.8,
      probabilityOfSuccess: 0.65,
      riskReduction: recommendedExits.length * 0.3,
      optimalExitTiming: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
    },
    warnings: currentProfit < 0 ? ['Current position is in loss'] : [],
    recommendations: ['Consider partial exits to lock in profits'],
    timestamp: new Date(),
    calculationTime: Math.random() * 100 + 50 // 50-150ms
  };
}

/**
 * Validate exit optimization
 */
async function validateExitOptimization(
  optimizationResult: any,
  riskTolerance: string,
  userId: string
): Promise<any> {
  const validation = {
    valid: true,
    errors: [] as string[],
    warnings: [] as string[],
    adjustedParams: {} as any
  };

  // Validate risk-reward ratio
  if (optimizationResult.exitCalculation?.riskRewardRatio) {
    const rr = optimizationResult.exitCalculation.riskRewardRatio;
    if (rr < 1.0) {
      validation.errors.push('Risk-reward ratio is less than 1:1');
      validation.valid = false;
    } else if (rr < 1.5) {
      validation.warnings.push('Risk-reward ratio is less than 1.5:1');
    }
  }

  // Validate stop loss distance
  if (optimizationResult.exitCalculation?.stopLoss?.distance) {
    const slDistance = optimizationResult.exitCalculation.stopLoss.distance;
    const atr = optimizationResult.atr;
    
    if (atr && slDistance > atr * 5) {
      validation.warnings.push('Stop loss is very wide (>5x ATR)');
    } else if (atr && slDistance < atr * 0.5) {
      validation.warnings.push('Stop loss is very tight (<0.5x ATR)');
    }
  }

  // Validate partial exits
  if (optimizationResult.partialExitOptimization?.recommendedExits) {
    const totalPercentage = optimizationResult.partialExitOptimization.recommendedExits
      .reduce((sum: number, exit: any) => sum + exit.percentage, 0);
    
    if (totalPercentage > 100) {
      validation.errors.push('Total partial exit percentage exceeds 100%');
      validation.valid = false;
    }
  }

  // Risk tolerance validation
  if (riskTolerance === 'conservative') {
    if (optimizationResult.exitCalculation?.riskRewardRatio && optimizationResult.exitCalculation.riskRewardRatio < 1.5) {
      validation.warnings.push('Conservative risk tolerance but RR ratio is less than 1.5:1');
    }
  }

  return validation;
}

/**
 * Generate optimization summary
 */
function generateOptimizationSummary(optimizationResult: any): any {
  const summary = {
    overallScore: 0,
    strengths: [] as string[],
    weaknesses: [] as string[],
    recommendations: [] as string[],
    implementationComplexity: 'medium' as 'low' | 'medium' | 'high',
    expectedImprovement: {
      winRate: 0,
      profitFactor: 0,
      maxDrawdown: 0
    }
  };

  // Calculate overall score
  let score = 50; // Base score

  if (optimizationResult.exitCalculation?.riskRewardRatio) {
    const rr = optimizationResult.exitCalculation.riskRewardRatio;
    score += Math.min(20, rr * 10); // Up to 20 points for RR ratio
    summary.strengths.push(`Good risk-reward ratio (${rr.toFixed(2)}:1)`);
  }

  if (optimizationResult.marketRegime) {
    score += 10; // 10 points for regime analysis
    summary.strengths.push('Market regime analysis included');
  }

  if (optimizationResult.partialExitOptimization?.recommendedExits?.length > 0) {
    score += 15; // 15 points for partial exits
    summary.strengths.push('Partial exit strategy optimized');
  }

  if (optimizationResult.riskValidation?.errors?.length > 0) {
    score -= 20; // Penalize for validation errors
    summary.weaknesses.push('Risk validation failed');
  }

  summary.overallScore = Math.max(0, Math.min(100, score));

  // Generate recommendations
  if (summary.overallScore < 60) {
    summary.recommendations.push('Consider more conservative exit parameters');
  }

  if (optimizationResult.exitCalculation?.riskRewardRatio && optimizationResult.exitCalculation.riskRewardRatio < 1.5) {
    summary.recommendations.push('Aim for higher risk-reward ratios (1.5:1 or better)');
  }

  if (!optimizationResult.partialExitOptimization) {
    summary.recommendations.push('Consider implementing partial exit strategy');
  }

  // Expected improvements (mock)
  summary.expectedImprovement = {
    winRate: 5 + Math.random() * 10, // 5-15% improvement
    profitFactor: 0.2 + Math.random() * 0.3, // 0.2-0.5 improvement
    maxDrawdown: -(5 + Math.random() * 10) // 5-15% reduction
  };

  return summary;
}