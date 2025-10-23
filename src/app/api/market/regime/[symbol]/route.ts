/**
 * MARKET REGIME DETECTION API
 * Provides market regime analysis for trading symbols
 * Phase 3.1 Implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { HistoricalDataFetcher } from '@/lib/backtest/engine';
import { 
  ApiResponse, 
  MarketRegime, 
  RegimeDetectionResult,
  RegimeHistory,
  RegimeTransition,
  RegimeDetectionConfig
} from '@/types';

// Request validation schema
const RegimeDetectionSchema = z.object({
  timeframe: z.string().min(1).max(10).optional().default('H1'),
  lookbackDays: z.number().min(7).max(365).optional().default(30),
  includeHistory: z.boolean().optional().default(false),
  includeTransitions: z.boolean().optional().default(true),
  includePredictions: z.boolean().optional().default(false),
  config: z.object({
    // Trend detection parameters
    trendPeriod: z.number().min(5).max(50).optional().default(14),
    trendThreshold: z.number().min(0.01).max(0.1).optional().default(0.02),
    
    // Volatility detection parameters
    volatilityPeriod: z.number().min(5).max(50).optional().default(14),
    volatilityThreshold: z.number().min(0.005).max(0.05).optional().default(0.015),
    
    // Range detection parameters
    rangePeriod: z.number().min(10).max(100).optional().default(20),
    rangeThreshold: z.number().min(0.005).max(0.05).optional().default(0.01),
    
    // Multi-timeframe analysis
    enableMTFAnalysis: z.boolean().optional().default(false),
    primaryTimeframe: z.string().min(1).max(10),
    confirmationTimeframes: z.array(z.string()).optional().default([]),
    
    // Confidence calculation
    minConfidence: z.number().min(50).max(100).optional().default(60),
    weightTrend: z.number().min(0).max(1).optional().default(0.4),
    weightVolatility: z.number().min(0).max(1).optional().default(0.3),
    weightRange: z.number().min(0).max(1).optional().default(0.3),
    
    // Historical analysis
    lookbackPeriod: z.number().min(7).max(365).optional().default(30),
    minDataPoints: z.number().min(10).max(100).optional().default(20),
    
    // Real-time updates
    updateFrequency: z.number().min(1).max(1440).optional().default(60),
    enableTransitionDetection: z.boolean().optional().default(true)
  }).optional()
});

/**
 * GET /api/market/regime/[symbol]
 * Detect current market regime for a symbol
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
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

    const { symbol } = params;
    const { searchParams } = new URL(request.url);

    // Extract and validate parameters
    const queryParams = {
      timeframe: searchParams.get('timeframe') || 'H1',
      lookbackDays: searchParams.get('lookbackDays') ? parseInt(searchParams.get('lookbackDays')!) : 30,
      includeHistory: searchParams.get('includeHistory') === 'true',
      includeTransitions: searchParams.get('includeTransitions') !== 'false',
      includePredictions: searchParams.get('includePredictions') === 'true',
      config: searchParams.get('config') ? JSON.parse(searchParams.get('config')!) : undefined
    };

    const validatedParams = RegimeDetectionSchema.parse(queryParams);

    // Validate symbol
    if (!symbol || symbol.length < 1 || symbol.length > 10) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'INVALID_SYMBOL',
          message: 'Invalid symbol provided',
          details: { symbol }
        }
      }, { status: 400 });
    }

    // Initialize regime detection result
    const regimeResult: any = {
      symbol,
      timeframe: validatedParams.timeframe,
      lookbackDays: validatedParams.lookbackDays,
      timestamp: new Date().toISOString(),
      userId: session.user.id
    };

    // 1. Detect current regime
    try {
      const currentRegime = await detectMarketRegime(
        symbol,
        validatedParams.timeframe,
        validatedParams.lookbackDays,
        validatedParams.config
      );
      regimeResult.currentRegime = currentRegime;
    } catch (error) {
      console.error('Failed to detect current regime:', error);
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'DETECTION_ERROR',
          message: 'Failed to detect market regime',
          details: { message: error instanceof Error ? error.message : 'Unknown error' }
        }
      }, { status: 500 });
    }

    // 2. Get regime history (if requested)
    if (validatedParams.includeHistory) {
      try {
        const history = await getRegimeHistory(
          symbol,
          validatedParams.timeframe,
          Math.min(validatedParams.lookbackDays * 2, 90) // Extended history
        );
        regimeResult.history = history;
      } catch (error) {
        console.error('Failed to get regime history:', error);
        regimeResult.history = { error: 'Failed to retrieve regime history' };
      }
    }

    // 3. Get regime transitions (if requested)
    if (validatedParams.includeTransitions) {
      try {
        const transitions = await getRegimeTransitions(
          symbol,
          validatedParams.timeframe,
          validatedParams.lookbackDays
        );
        regimeResult.transitions = transitions;
      } catch (error) {
        console.error('Failed to get regime transitions:', error);
        regimeResult.transitions = { error: 'Failed to retrieve regime transitions' };
      }
    }

    // 4. Generate regime predictions (if requested)
    if (validatedParams.includePredictions) {
      try {
        const predictions = await generateRegimePredictions(
          symbol,
          validatedParams.timeframe,
          regimeResult.currentRegime
        );
        regimeResult.predictions = predictions;
      } catch (error) {
        console.error('Failed to generate predictions:', error);
        regimeResult.predictions = { error: 'Failed to generate predictions' };
      }
    }

    // 5. Generate regime-based recommendations
    try {
      const recommendations = generateRegimeRecommendations(
        regimeResult.currentRegime,
        symbol,
        validatedParams.timeframe
      );
      regimeResult.recommendations = recommendations;
    } catch (error) {
      console.error('Failed to generate recommendations:', error);
      regimeResult.recommendations = { error: 'Failed to generate recommendations' };
    }

    return NextResponse.json<ApiResponse<typeof regimeResult>>({
      success: true,
      data: regimeResult
    });

  } catch (error) {
    console.error('Market regime API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: { errors: error.errors }
        }
      }, { status: 400 });
    }

    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to detect market regime',
        details: { message: error instanceof Error ? error.message : 'Unknown error' }
      }
    }, { status: 500 });
  }
}

/**
 * POST /api/market/regime/[symbol]
 * Advanced regime detection with custom parameters
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
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

    const { symbol } = params;
    const body = await request.json();
    
    // Merge with path parameters
    const requestParams = {
      ...body,
      symbol
    };

    const validatedParams = RegimeDetectionSchema.parse(requestParams);

    // Create a mock GET request to reuse the GET logic
    const url = new URL('http://localhost');
    Object.keys(validatedParams).forEach(key => {
      if (key !== 'symbol' && validatedParams[key as keyof typeof validatedParams] !== undefined) {
        url.searchParams.set(key, String(validatedParams[key as keyof typeof validatedParams]));
      }
    });

    const mockRequest = new NextRequest(url.toString(), { method: 'GET' });

    // Reuse the GET logic
    return await GET(mockRequest, { params });

  } catch (error) {
    console.error('Market regime POST API error:', error);

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
        message: 'Failed to detect market regime',
        details: { message: error instanceof Error ? error.message : 'Unknown error' }
      }
    }, { status: 500 });
  }
}

/**
 * Detect market regime using technical analysis
 */
async function detectMarketRegime(
  symbol: string,
  timeframe: string,
  lookbackDays: number,
  config?: RegimeDetectionConfig
): Promise<RegimeDetectionResult> {
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
      throw new Error('Insufficient data for regime detection');
    }

    // Use default config if not provided
    const detectionConfig: RegimeDetectionConfig = config || {
      trendPeriod: 14,
      trendThreshold: 0.02,
      volatilityPeriod: 14,
      volatilityThreshold: 0.015,
      rangePeriod: 20,
      rangeThreshold: 0.01,
      enableMTFAnalysis: false,
      primaryTimeframe: timeframe,
      confirmationTimeframes: [],
      minConfidence: 60,
      weightTrend: 0.4,
      weightVolatility: 0.3,
      weightRange: 0.3,
      lookbackPeriod: lookbackDays,
      minDataPoints: 20,
      updateFrequency: 60,
      enableTransitionDetection: true
    };

    // Calculate technical indicators
    const prices = historicalData.map(d => d.close);
    const highs = historicalData.map(d => d.high);
    const lows = historicalData.map(d => d.low);
    
    // Trend analysis
    const trendScore = calculateTrendScore(prices, detectionConfig.trendPeriod, detectionConfig.trendThreshold);
    
    // Volatility analysis
    const volatilityScore = calculateVolatilityScore(prices, detectionConfig.volatilityPeriod, detectionConfig.volatilityThreshold);
    
    // Range analysis
    const rangeScore = calculateRangeScore(highs, lows, detectionConfig.rangePeriod, detectionConfig.rangeThreshold);

    // Determine regime based on weighted scores
    const trendWeight = detectionConfig.weightTrend;
    const volatilityWeight = detectionConfig.weightVolatility;
    const rangeWeight = detectionConfig.weightRange;

    let regime: MarketRegime;
    let confidence: number;

    if (volatilityScore > 0.7) {
      regime = MarketRegime.VOLATILE;
      confidence = Math.min(95, 50 + volatilityScore * 30);
    } else if (Math.abs(trendScore) > detectionConfig.trendThreshold) {
      regime = trendScore > 0 ? MarketRegime.TRENDING_UP : MarketRegime.TRENDING_DOWN;
      confidence = Math.min(95, 50 + Math.abs(trendScore) * 1000);
    } else if (rangeScore > 0.6) {
      regime = MarketRegime.RANGING;
      confidence = Math.min(95, 40 + rangeScore * 40);
    } else {
      // Default to ranging if unclear
      regime = MarketRegime.RANGING;
      confidence = 55;
    }

    // Calculate additional metadata
    const recentPrices = prices.slice(-20);
    const priceChange = (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0];
    const volatility = calculateVolatility(recentPrices);
    
    // Mock ADX calculation
    const adx = calculateMockADX(highs, lows, prices, 14);
    
    // Mock ATR calculation
    const atr = calculateATR(highs, lows, prices, 14);

    return {
      regime,
      confidence: Math.round(confidence),
      timestamp: new Date(),
      timeframe,
      metadata: {
        trendStrength: Math.abs(trendScore) * 100,
        volatility,
        rangeBound: rangeScore,
        adx,
        atr,
        priceChange: priceChange * 100,
        volumeChange: Math.random() * 20 - 10 // Mock volume change
      }
    };

  } catch (error) {
    throw new Error(`Failed to detect market regime for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate trend score
 */
function calculateTrendScore(prices: number[], period: number, threshold: number): number {
  if (prices.length < period + 1) return 0;

  const recent = prices.slice(-period);
  const earlier = prices.slice(-period * 2, -period);
  
  if (earlier.length === 0) return 0;

  const recentAvg = recent.reduce((sum, p) => sum + p, 0) / recent.length;
  const earlierAvg = earlier.reduce((sum, p) => sum + p, 0) / earlier.length;
  
  return (recentAvg - earlierAvg) / earlierAvg;
}

/**
 * Calculate volatility score
 */
function calculateVolatilityScore(prices: number[], period: number, threshold: number): number {
  if (prices.length < period) return 0;

  const recent = prices.slice(-period);
  const returns = [];
  
  for (let i = 1; i < recent.length; i++) {
    returns.push((recent[i] - recent[i - 1]) / recent[i - 1]);
  }

  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance);

  return Math.min(1, volatility / threshold);
}

/**
 * Calculate range score
 */
function calculateRangeScore(highs: number[], lows: number[], period: number, threshold: number): number {
  if (highs.length < period || lows.length < period) return 0;

  const recentHighs = highs.slice(-period);
  const recentLows = lows.slice(-period);
  
  const avgHigh = recentHighs.reduce((sum, h) => sum + h, 0) / recentHighs.length;
  const avgLow = recentLows.reduce((sum, l) => sum + l, 0) / recentLows.length;
  const range = (avgHigh - avgLow) / avgLow;

  return Math.max(0, 1 - (range / threshold));
}

/**
 * Calculate volatility
 */
function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;

  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }

  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  
  return Math.sqrt(variance);
}

/**
 * Mock ADX calculation
 */
function calculateMockADX(highs: number[], lows: number[], closes: number[], period: number): number {
  // Simplified ADX calculation - in production use proper ADX implementation
  const recentHighs = highs.slice(-period);
  const recentLows = lows.slice(-period);
  const recentCloses = closes.slice(-period);

  const avgHigh = recentHighs.reduce((sum, h) => sum + h, 0) / recentHighs.length;
  const avgLow = recentLows.reduce((sum, l) => sum + l, 0) / recentLows.length;
  const avgClose = recentCloses.reduce((sum, c) => sum + c, 0) / recentCloses.length;

  const range = (avgHigh - avgLow) / avgClose;
  const trend = Math.abs((avgClose - recentCloses[0]) / recentCloses[0]);

  return Math.min(100, 20 + trend * 1000 + range * 500);
}

/**
 * Calculate ATR
 */
function calculateATR(highs: number[], lows: number[], closes: number[], period: number): number {
  if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) {
    return 0;
  }

  const trValues = [];
  for (let i = 1; i <= period; i++) {
    const high = highs[highs.length - i];
    const low = lows[lows.length - i];
    const prevClose = closes[closes.length - i - 1];
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trValues.push(tr);
  }

  return trValues.reduce((sum, tr) => sum + tr, 0) / trValues.length;
}

/**
 * Get regime history
 */
async function getRegimeHistory(
  symbol: string,
  timeframe: string,
  days: number
): Promise<RegimeHistory> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const historicalData = await HistoricalDataFetcher.fetchFromYahooFinance(
      symbol,
      timeframe,
      startDate,
      endDate
    );

    if (historicalData.length < 20) {
      throw new Error('Insufficient data for regime history');
    }

    // Generate mock regime history
    const dataPoints = [];
    const chunkSize = Math.max(20, Math.floor(historicalData.length / 10));
    
    for (let i = chunkSize; i < historicalData.length; i += chunkSize) {
      const chunk = historicalData.slice(i - chunkSize, i);
      const prices = chunk.map(d => d.close);
      const highs = chunk.map(d => d.high);
      const lows = chunk.map(d => d.low);
      
      const trendScore = calculateTrendScore(prices, 14, 0.02);
      const volatilityScore = calculateVolatilityScore(prices, 14, 0.015);
      
      let regime: MarketRegime;
      if (volatilityScore > 0.7) {
        regime = MarketRegime.VOLATILE;
      } else if (Math.abs(trendScore) > 0.02) {
        regime = trendScore > 0 ? MarketRegime.TRENDING_UP : MarketRegime.TRENDING_DOWN;
      } else {
        regime = MarketRegime.RANGING;
      }

      dataPoints.push({
        timestamp: chunk[chunk.length - 1].timestamp,
        regime,
        confidence: 60 + Math.random() * 30,
        metadata: {
          trendStrength: Math.abs(trendScore) * 100,
          volatility: calculateVolatility(prices),
          rangeBound: 1 - volatilityScore
        }
      });
    }

    // Calculate statistics
    const regimeCounts = dataPoints.reduce((acc, dp) => {
      acc[dp.regime] = (acc[dp.regime] || 0) + 1;
      return acc;
    }, {} as Record<MarketRegime, number>);

    const transitions = detectTransitions(dataPoints);

    return {
      symbol,
      timeframe,
      data: dataPoints,
      transitions,
      statistics: {
        regimeDistribution: regimeCounts,
        averageRegimeDuration: calculateAverageDuration(dataPoints, transitions),
        transitionFrequency: calculateTransitionFrequency(transitions)
      }
    };

  } catch (error) {
    throw new Error(`Failed to get regime history: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get regime transitions
 */
async function getRegimeTransitions(
  symbol: string,
  timeframe: string,
  days: number
): Promise<RegimeTransition[]> {
  try {
    const history = await getRegimeHistory(symbol, timeframe, days);
    return history.transitions;
  } catch (error) {
    throw new Error(`Failed to get regime transitions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Detect transitions in regime data
 */
function detectTransitions(dataPoints: RegimeHistory['data']): RegimeTransition[] {
  const transitions: RegimeTransition[] = [];
  
  for (let i = 1; i < dataPoints.length; i++) {
    const current = dataPoints[i];
    const previous = dataPoints[i - 1];
    
    if (current.regime !== previous.regime) {
      transitions.push({
        fromRegime: previous.regime,
        toRegime: current.regime,
        timestamp: current.timestamp,
        confidence: (previous.confidence + current.confidence) / 2,
        duration: current.timestamp.getTime() - previous.timestamp.getTime()
      });
    }
  }
  
  return transitions;
}

/**
 * Calculate average regime duration
 */
function calculateAverageDuration(
  dataPoints: RegimeHistory['data'],
  transitions: RegimeTransition[]
): Record<MarketRegime, number> {
  const durations: Record<MarketRegime, number[]> = {
    [MarketRegime.TRENDING_UP]: [],
    [MarketRegime.TRENDING_DOWN]: [],
    [MarketRegime.RANGING]: [],
    [MarketRegime.VOLATILE]: []
  };

  // Calculate durations between transitions
  let startIndex = 0;
  for (const transition of transitions) {
    const regime = dataPoints[startIndex].regime;
    const duration = transition.timestamp.getTime() - dataPoints[startIndex].timestamp.getTime();
    durations[regime].push(duration);
    startIndex = dataPoints.findIndex(dp => dp.timestamp === transition.timestamp);
  }

  // Handle the last regime
  if (startIndex < dataPoints.length - 1) {
    const regime = dataPoints[startIndex].regime;
    const duration = dataPoints[dataPoints.length - 1].timestamp.getTime() - dataPoints[startIndex].timestamp.getTime();
    durations[regime].push(duration);
  }

  // Calculate averages
  const averages: Record<MarketRegime, number> = {} as any;
  for (const regime in durations) {
    const regimeDurations = durations[regime as MarketRegime];
    averages[regime as MarketRegime] = regimeDurations.length > 0
      ? regimeDurations.reduce((sum, d) => sum + d, 0) / regimeDurations.length
      : 0;
  }

  return averages;
}

/**
 * Calculate transition frequency
 */
function calculateTransitionFrequency(transitions: RegimeTransition[]): Record<MarketRegime, Record<MarketRegime, number>> {
  const frequency: Record<MarketRegime, Record<MarketRegime, number>> = {
    [MarketRegime.TRENDING_UP]: {
      [MarketRegime.TRENDING_UP]: 0,
      [MarketRegime.TRENDING_DOWN]: 0,
      [MarketRegime.RANGING]: 0,
      [MarketRegime.VOLATILE]: 0
    },
    [MarketRegime.TRENDING_DOWN]: {
      [MarketRegime.TRENDING_UP]: 0,
      [MarketRegime.TRENDING_DOWN]: 0,
      [MarketRegime.RANGING]: 0,
      [MarketRegime.VOLATILE]: 0
    },
    [MarketRegime.RANGING]: {
      [MarketRegime.TRENDING_UP]: 0,
      [MarketRegime.TRENDING_DOWN]: 0,
      [MarketRegime.RANGING]: 0,
      [MarketRegime.VOLATILE]: 0
    },
    [MarketRegime.VOLATILE]: {
      [MarketRegime.TRENDING_UP]: 0,
      [MarketRegime.TRENDING_DOWN]: 0,
      [MarketRegime.RANGING]: 0,
      [MarketRegime.VOLATILE]: 0
    }
  };

  for (const transition of transitions) {
    if (!frequency[transition.fromRegime][transition.toRegime]) {
      frequency[transition.fromRegime][transition.toRegime] = 0;
    }
    frequency[transition.fromRegime][transition.toRegime]++;
  }

  return frequency;
}

/**
 * Generate regime predictions
 */
async function generateRegimePredictions(
  symbol: string,
  timeframe: string,
  currentRegime: RegimeDetectionResult
): Promise<Array<{timestamp: Date; predictedRegime: MarketRegime; probability: number}>> {
  // Mock prediction logic - in production, use ML models or advanced analysis
  const predictions = [];
  const currentTime = new Date();
  
  for (let i = 1; i <= 5; i++) {
    const futureTime = new Date(currentTime.getTime() + i * 24 * 60 * 60 * 1000); // Next 5 days
    
    // Simple prediction based on current regime
    let predictedRegime: MarketRegime;
    let probability: number;
    
    if (currentRegime.regime === MarketRegime.VOLATILE) {
      // Volatile markets tend to stay volatile or become ranging
      predictedRegime = Math.random() > 0.3 ? MarketRegime.VOLATILE : MarketRegime.RANGING;
      probability = 0.6 + Math.random() * 0.3;
    } else if (currentRegime.regime === MarketRegime.TRENDING_UP || currentRegime.regime === MarketRegime.TRENDING_DOWN) {
      // Trends tend to continue or reverse
      predictedRegime = Math.random() > 0.4 ? currentRegime.regime : MarketRegime.RANGING;
      probability = 0.5 + Math.random() * 0.4;
    } else {
      // Ranging markets can break out or continue ranging
      predictedRegime = Math.random() > 0.5 ? MarketRegime.RANGING : 
                       Math.random() > 0.5 ? MarketRegime.TRENDING_UP : MarketRegime.TRENDING_DOWN;
      probability = 0.4 + Math.random() * 0.4;
    }
    
    predictions.push({
      timestamp: futureTime,
      predictedRegime,
      probability: Math.round(probability * 100)
    });
  }
  
  return predictions;
}

/**
 * Generate regime-based recommendations
 */
function generateRegimeRecommendations(
  currentRegime: RegimeDetectionResult,
  symbol: string,
  timeframe: string
): any {
  const recommendations = {
    tradingStrategies: [] as string[],
    riskManagement: [] as string[],
    timeframes: [] as string[],
    indicators: [] as string[],
    warnings: [] as string[],
    confidence: currentRegime.confidence
  };

  switch (currentRegime.regime) {
    case MarketRegime.TRENDING_UP:
      recommendations.tradingStrategies.push(
        'Focus on buy-the-dip strategies',
        'Consider trend-following approaches',
        'Look for breakout continuation patterns'
      );
      recommendations.riskManagement.push(
        'Use trailing stops to lock in profits',
        'Consider pyramiding positions',
        'Wider stop losses to accommodate volatility'
      );
      recommendations.timeframes.push('H1', 'H4', 'D1');
      recommendations.indicators.push('EMA', 'MACD', 'ADX', 'Parabolic SAR');
      break;

    case MarketRegime.TRENDING_DOWN:
      recommendations.tradingStrategies.push(
        'Focus on short-selling strategies',
        'Consider bearish continuation patterns',
        'Look for rally failures to short'
      );
      recommendations.riskManagement.push(
        'Tight stop losses on counter-trend trades',
        'Reduce position sizes',
        'Avoid catching falling knives'
      );
      recommendations.timeframes.push('H1', 'H4', 'D1');
      recommendations.indicators.push('EMA', 'MACD', 'ADX', 'Parabolic SAR');
      break;

    case MarketRegime.RANGING:
      recommendations.tradingStrategies.push(
        'Mean reversion strategies at key levels',
        'Range-bound trading at support/resistance',
        'Oscillator-based entry signals'
      );
      recommendations.riskManagement.push(
        'Tight profit targets',
        'Clear support/resistance levels',
        'Avoid breakouts without confirmation'
      );
      recommendations.timeframes.push('M15', 'M30', 'H1');
      recommendations.indicators.push('RSI', 'Stochastic', 'Bollinger Bands', 'CCI');
      break;

    case MarketRegime.VOLATILE:
      recommendations.tradingStrategies.push(
        'Reduce trading frequency',
        'Wait for volatility to subside',
        'Consider news-based trading if applicable'
      );
      recommendations.riskManagement.push(
        'Significantly reduce position sizes',
        'Wider stops to avoid noise',
        'Avoid trading during high volatility spikes'
      );
      recommendations.timeframes.push('H4', 'D1'); // Higher timeframes for clarity
      recommendations.indicators.push('ATR', 'VIX', 'Volume indicators');
      recommendations.warnings.push('High volatility detected - increased risk');
      break;
  }

  // Add general recommendations based on confidence
  if (currentRegime.confidence < 70) {
    recommendations.warnings.push('Low regime confidence - use caution');
    recommendations.riskManagement.push('Reduce position sizes due to uncertainty');
  }

  // Add metadata-based recommendations
  if (currentRegime.metadata.trendStrength && currentRegime.metadata.trendStrength > 70) {
    recommendations.tradingStrategies.push('Strong trend detected - consider trend-following');
  }

  if (currentRegime.metadata.volatility && currentRegime.metadata.volatility > 0.02) {
    recommendations.warnings.push('High volatility - adjust risk management accordingly');
  }

  return recommendations;
}