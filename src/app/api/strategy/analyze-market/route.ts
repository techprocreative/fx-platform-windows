/**
 * MARKET ANALYSIS API FOR STRATEGY CREATION
 * Provides comprehensive market analysis for AI strategy generation
 * Phase 2.3 Implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { marketContextProvider } from '@/lib/market/context';
import { callLLM } from '@/lib/llm/openrouter';
import { buildMarketAnalysisPrompt, ENHANCED_STRATEGY_PROMPTS } from '@/lib/llm/prompts';
import { 
  calculateCorrelationMatrix, 
  analyzeCorrelationForSignal,
  getRecommendedPairs 
} from '@/lib/market/correlation';
import { HistoricalDataFetcher } from '@/lib/backtest/engine';
import { ApiResponse, MarketRegime, RegimeDetectionResult } from '@/types';

// Request validation schema
const MarketAnalysisSchema = z.object({
  symbol: z.string().min(1).max(10),
  timeframe: z.string().min(1).max(10),
  strategyType: z.enum(['scalping', 'day_trading', 'swing_trading', 'position_trading']).optional().default('day_trading'),
  timeframePreference: z.enum(['short_term', 'medium_term', 'long_term']).optional().default('medium_term'),
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']).optional().default('moderate'),
  includeCorrelation: z.boolean().optional().default(true),
  includeRegime: z.boolean().optional().default(true),
  includeRecommendations: z.boolean().optional().default(true),
  lookbackDays: z.number().min(30).max(365).optional().default(90),
  analysisDepth: z.enum(['basic', 'standard', 'comprehensive']).optional().default('standard')
});

/**
 * POST /api/strategy/analyze-market
 * Analyze market conditions for strategy creation
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
    const validatedParams = MarketAnalysisSchema.parse(body);

    const {
      symbol,
      timeframe,
      strategyType,
      timeframePreference,
      riskTolerance,
      includeCorrelation,
      includeRegime,
      includeRecommendations,
      lookbackDays,
      analysisDepth
    } = validatedParams;

    // Initialize analysis result
    const analysisResult: any = {
      symbol,
      timeframe,
      strategyType,
      timestamp: new Date().toISOString(),
      analysisDepth,
      userId: session.user.id
    };

    // 1. Get basic market context
    try {
      const marketContext = await marketContextProvider.getMarketContext({
        symbol,
        timeframe,
        atrPeriod: 14,
        lookbackPeriods: 100
      });
      analysisResult.marketContext = marketContext;
    } catch (error) {
      console.error('Failed to get market context:', error);
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'MARKET_CONTEXT_ERROR',
          message: 'Failed to retrieve market context',
          details: { message: error instanceof Error ? error.message : 'Unknown error' }
        }
      }, { status: 500 });
    }

    // 2. Get historical data for technical analysis
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

      if (historicalData.length === 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: {
            code: 'NO_DATA',
            message: `No historical data available for ${symbol} on ${timeframe} timeframe`
          }
        }, { status: 404 });
      }

      analysisResult.historicalData = {
        dataPoints: historicalData.length,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        latestPrice: historicalData[historicalData.length - 1].close,
        priceChange: historicalData.length > 1 
          ? historicalData[historicalData.length - 1].close - historicalData[0].close
          : 0,
        priceChangePercent: historicalData.length > 1
          ? ((historicalData[historicalData.length - 1].close - historicalData[0].close) / historicalData[0].close) * 100
          : 0
      };
    } catch (error) {
      console.error('Failed to fetch historical data:', error);
      analysisResult.historicalData = { error: 'Failed to fetch historical data' };
    }

    // 3. Correlation analysis (if requested)
    if (includeCorrelation && analysisDepth !== 'basic') {
      try {
        // Get recommended pairs for correlation analysis
        const recommendedPairs = getRecommendedPairs(symbol, [
          'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
          'EURJPY', 'GBPJPY', 'EURGBP', 'AUDJPY', 'EURAUD', 'EURCHF'
        ]);

        // Generate mock price data for correlation (in production, use real data)
        const correlationPairs = [symbol, ...recommendedPairs.slice(0, 10)];
        const priceData: Record<string, any[]> = {};
        
        for (const pair of correlationPairs) {
          try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 30);
            
            priceData[pair] = await HistoricalDataFetcher.fetchFromYahooFinance(
              pair,
              'D1',
              startDate,
              endDate
            );
          } catch (error) {
            console.error(`Failed to fetch correlation data for ${pair}:`, error);
            priceData[pair] = [];
          }
        }

        const correlationMatrix = await calculateCorrelationMatrix(
          correlationPairs,
          priceData,
          'D1',
          30,
          20
        );

        const correlationAnalysis = analyzeCorrelationForSignal(
          symbol,
          [], // No existing positions for analysis
          correlationMatrix,
          {
            enabled: true,
            maxCorrelation: 0.7,
            checkPairs: recommendedPairs,
            skipHighlyCorrelated: true,
            timeframes: ['D1'],
            lookbackPeriod: 30,
            minDataPoints: 20,
            updateFrequency: 24,
            dynamicThreshold: false,
            groupByCurrency: true
          }
        );

        analysisResult.correlationAnalysis = {
          matrix: correlationMatrix,
          analysis: correlationAnalysis,
          recommendedPairs: recommendedPairs
        };
      } catch (error) {
        console.error('Failed to perform correlation analysis:', error);
        analysisResult.correlationAnalysis = { error: 'Failed to perform correlation analysis' };
      }
    }

    // 4. Market regime detection (if requested)
    if (includeRegime && analysisDepth === 'comprehensive') {
      try {
        const regimeResult = await detectMarketRegime(symbol, timeframe, lookbackDays);
        analysisResult.regimeAnalysis = regimeResult;
      } catch (error) {
        console.error('Failed to detect market regime:', error);
        analysisResult.regimeAnalysis = { error: 'Failed to detect market regime' };
      }
    }

    // 5. AI-powered market analysis and recommendations
    if (includeRecommendations) {
      try {
        const marketDataString = formatMarketDataForAI(analysisResult);
        const analysisPrompt = buildMarketAnalysisPrompt(marketDataString);
        
        const aiAnalysis = await callLLM(
          analysisPrompt,
          'analysis', // Use analysis model tier
          ENHANCED_STRATEGY_PROMPTS.MARKET_ANALYSIS_TEMPLATE
        );

        analysisResult.aiAnalysis = aiAnalysis;
      } catch (error) {
        console.error('AI analysis failed:', error);
        analysisResult.aiAnalysis = {
          error: 'AI analysis temporarily unavailable',
          message: 'Market data retrieved successfully, but AI analysis failed'
        };
      }
    }

    // 6. Generate strategy recommendations based on analysis
    if (includeRecommendations) {
      try {
        const recommendations = generateStrategyRecommendations(
          analysisResult,
          strategyType,
          riskTolerance,
          timeframePreference
        );
        analysisResult.strategyRecommendations = recommendations;
      } catch (error) {
        console.error('Failed to generate strategy recommendations:', error);
        analysisResult.strategyRecommendations = { error: 'Failed to generate recommendations' };
      }
    }

    return NextResponse.json<ApiResponse<typeof analysisResult>>({
      success: true,
      data: analysisResult
    });

  } catch (error) {
    console.error('Market analysis API error:', error);

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
        message: 'Failed to analyze market',
        details: { message: error instanceof Error ? error.message : 'Unknown error' }
      }
    }, { status: 500 });
  }
}

/**
 * GET /api/strategy/analyze-market
 * Get market analysis with query parameters
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
      timeframe: searchParams.get('timeframe'),
      strategyType: searchParams.get('strategyType') as any || 'day_trading',
      timeframePreference: searchParams.get('timeframePreference') as any || 'medium_term',
      riskTolerance: searchParams.get('riskTolerance') as any || 'moderate',
      includeCorrelation: searchParams.get('includeCorrelation') === 'true',
      includeRegime: searchParams.get('includeRegime') === 'true',
      includeRecommendations: searchParams.get('includeRecommendations') !== 'false',
      lookbackDays: parseInt(searchParams.get('lookbackDays') || '90'),
      analysisDepth: searchParams.get('analysisDepth') as any || 'standard'
    };

    // Validate required parameters
    if (!params.symbol || !params.timeframe) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Missing required parameters: symbol, timeframe',
          details: { required: ['symbol', 'timeframe'] }
        }
      }, { status: 400 });
    }

    // Validate parameters using schema
    const validatedParams = MarketAnalysisSchema.parse(params);

    // Create a mock request body for the POST handler
    const mockRequest = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify(validatedParams),
      headers: { 'Content-Type': 'application/json' }
    });

    // Reuse the POST logic
    return await POST(mockRequest);

  } catch (error) {
    console.error('Market analysis GET API error:', error);

    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to analyze market',
        details: { message: error instanceof Error ? error.message : 'Unknown error' }
      }
    }, { status: 500 });
  }
}

/**
 * Detect market regime based on historical data
 */
async function detectMarketRegime(
  symbol: string, 
  timeframe: string, 
  lookbackDays: number
): Promise<RegimeDetectionResult> {
  // Mock implementation - in production, use actual regime detection logic
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

  // Simple regime detection logic (mock)
  const recentPrices = historicalData.slice(-20).map(d => d.close);
  const priceChange = (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0];
  const volatility = calculateVolatility(recentPrices);

  let regime: MarketRegime;
  let confidence: number;

  if (Math.abs(priceChange) > 0.02 && volatility > 0.015) {
    regime = MarketRegime.VOLATILE;
    confidence = 75;
  } else if (priceChange > 0.01) {
    regime = MarketRegime.TRENDING_UP;
    confidence = 80;
  } else if (priceChange < -0.01) {
    regime = MarketRegime.TRENDING_DOWN;
    confidence = 80;
  } else {
    regime = MarketRegime.RANGING;
    confidence = 70;
  }

  return {
    regime,
    confidence,
    timestamp: new Date(),
    timeframe,
    metadata: {
      trendStrength: Math.abs(priceChange) * 100,
      volatility,
      rangeBound: volatility < 0.01 ? 1 - volatility / 0.01 : 0,
      adx: 25 + Math.random() * 30, // Mock ADX
      atr: volatility * 1000, // Mock ATR
      priceChange: priceChange * 100,
      volumeChange: Math.random() * 20 - 10 // Mock volume change
    }
  };
}

/**
 * Calculate volatility of price series
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
 * Format market data for AI analysis
 */
function formatMarketDataForAI(analysisResult: any): string {
  const { marketContext, historicalData, correlationAnalysis, regimeAnalysis } = analysisResult;

  let dataString = `
Market Analysis Request:
Symbol: ${analysisResult.symbol}
Timeframe: ${analysisResult.timeframe}
Strategy Type: ${analysisResult.strategyType}
Risk Tolerance: ${analysisResult.riskTolerance}
Analysis Depth: ${analysisResult.analysisDepth}

Current Market Conditions:
`;

  if (marketContext) {
    dataString += `
Price: ${marketContext.price.current.toFixed(5)} (${marketContext.price.changePercent >= 0 ? '+' : ''}${marketContext.price.changePercent.toFixed(2)}%)
ATR: ${marketContext.volatility.currentATR.toFixed(5)}
Volatility Level: ${marketContext.volatility.volatilityLevel}
Trend: ${marketContext.trend.direction} (Strength: ${marketContext.trend.strength.toFixed(0)}/100)
Key Support: ${marketContext.keyLevels.nearestSupport?.toFixed(5) || 'N/A'}
Key Resistance: ${marketContext.keyLevels.nearestResistance?.toFixed(5) || 'N/A'}
Market Sessions: ${marketContext.session.activeSessions.join(', ')}
Market Condition: ${marketContext.session.marketCondition}
`;
  }

  if (historicalData && !historicalData.error) {
    dataString += `
Historical Performance (${historicalData.dataPoints} data points):
Period: ${historicalData.dateRange.start} to ${historicalData.dateRange.end}
Price Change: ${historicalData.priceChangePercent >= 0 ? '+' : ''}${historicalData.priceChangePercent.toFixed(2)}%
`;
  }

  if (regimeAnalysis && !regimeAnalysis.error) {
    dataString += `
Market Regime: ${regimeAnalysis.regime}
Regime Confidence: ${regimeAnalysis.confidence}%
Trend Strength: ${regimeAnalysis.metadata.trendStrength?.toFixed(1)}%
Volatility: ${(regimeAnalysis.metadata.volatility! * 100).toFixed(2)}%
`;
  }

  if (correlationAnalysis && !correlationAnalysis.error) {
    dataString += `
Correlation Analysis:
Should Skip Trade: ${correlationAnalysis.analysis.shouldSkip}
Recommended Action: ${correlationAnalysis.analysis.recommendedAction}
Confidence: ${correlationAnalysis.analysis.confidence}%
`;
  }

  dataString += `
Analysis Timestamp: ${analysisResult.timestamp}
`;

  return dataString;
}

/**
 * Generate strategy recommendations based on analysis
 */
function generateStrategyRecommendations(
  analysisResult: any,
  strategyType: string,
  riskTolerance: string,
  timeframePreference: string
): any {
  const { marketContext, regimeAnalysis } = analysisResult;

  const recommendations = {
    entryStrategies: [] as Array<{type: string; description: string; confidence: number}>,
    exitStrategies: [] as Array<{type: string; description: string; confidence: number}>,
    riskManagement: {} as Record<string, any>,
    timeframes: [] as string[],
    indicators: [] as string[],
    marketConditions: {} as Record<string, any>,
    warnings: [] as string[],
    confidence: 0
  };

  // Entry strategy recommendations
  if (marketContext?.trend.direction === 'up') {
    recommendations.entryStrategies.push({
      type: 'trend_following',
      description: 'Focus on pullback entries in the direction of the uptrend',
      confidence: 80
    });
  } else if (marketContext?.trend.direction === 'down') {
    recommendations.entryStrategies.push({
      type: 'trend_following',
      description: 'Focus on rally entries in the direction of the downtrend',
      confidence: 80
    });
  } else {
    recommendations.entryStrategies.push({
      type: 'range_trading',
      description: 'Consider mean reversion strategies at key support/resistance levels',
      confidence: 70
    });
  }

  // Exit strategy recommendations
  if (marketContext?.volatility.volatilityLevel === 'high') {
    recommendations.exitStrategies.push({
      type: 'atr_based',
      description: 'Use wider stops based on ATR to avoid premature exits',
      confidence: 85
    });
  } else {
    recommendations.exitStrategies.push({
      type: 'fixed_ratio',
      description: 'Use fixed risk-reward ratios (1:2 or 1:3)',
      confidence: 75
    });
  }

  // Risk management recommendations
  const riskMultiplier = riskTolerance === 'aggressive' ? 1.5 : riskTolerance === 'conservative' ? 0.7 : 1.0;
  recommendations.riskManagement = {
    maxRiskPerTrade: riskTolerance === 'aggressive' ? '2-3%' : riskTolerance === 'conservative' ? '0.5-1%' : '1-2%',
    maxPositions: riskTolerance === 'aggressive' ? 3 : 2,
    useTrailingStops: regimeAnalysis?.regime === 'trending_up' || regimeAnalysis?.regime === 'trending_down'
  };

  // Timeframe recommendations
  if (timeframePreference === 'short_term') {
    recommendations.timeframes = ['M5', 'M15', 'M30'];
  } else if (timeframePreference === 'long_term') {
    recommendations.timeframes = ['H4', 'D1', 'W1'];
  } else {
    recommendations.timeframes = ['M15', 'M30', 'H1', 'H4'];
  }

  // Indicator recommendations
  if (regimeAnalysis?.regime === 'ranging') {
    recommendations.indicators = ['RSI', 'Stochastic', 'Bollinger Bands'];
  } else if (regimeAnalysis?.regime === 'trending_up' || regimeAnalysis?.regime === 'trending_down') {
    recommendations.indicators = ['EMA', 'MACD', 'ADX', 'ATR'];
  } else {
    recommendations.indicators = ['RSI', 'EMA', 'ATR'];
  }

  // Market condition warnings
  if (marketContext?.volatility.volatilityLevel === 'high') {
    recommendations.warnings.push('High volatility detected - consider reducing position sizes');
  }

  if (marketContext?.session.marketCondition === 'suboptimal') {
    recommendations.warnings.push('Current market session is suboptimal for this pair');
  }

  // Overall confidence
  const confidenceScores = [
    marketContext?.trend.strength || 50,
    regimeAnalysis?.confidence || 50,
    marketContext?.session.isOptimalForPair ? 80 : 60
  ];
  recommendations.confidence = Math.round(confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length);

  return recommendations;
}