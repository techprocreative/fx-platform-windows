import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { z } from 'zod';

import { authOptions } from '../../../../lib/auth';
import { marketContextProvider } from '../../../../lib/market/context';
import { callLLM } from '../../../../lib/llm/openrouter';
import { buildMarketAnalysisPrompt, ENHANCED_STRATEGY_PROMPTS } from '../../../../lib/llm/prompts';

// Initialize Redis for caching (Upstash Redis)
let redis: any = null;
let isRedisAvailable = false;

async function initializeRedis() {
  if (redis) return redis;
  
  try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      const { Redis } = await import('@upstash/redis');
      redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      isRedisAvailable = true;
      console.log('✅ Redis cache initialized for market context');
      return redis;
    }
  } catch (error) {
    console.error('❌ Redis initialization failed:', error);
  }
  return null;
}

// Cache TTL: 15 minutes (900 seconds)
const CACHE_TTL = 900;

// Request validation schema
const MarketContextSchema = z.object({
  symbol: z.string().min(1).max(10),
  timeframe: z.string().min(1).max(10),
  atrPeriod: z.number().min(5).max(50).optional().default(14),
  lookbackPeriods: z.number().min(50).max(500).optional().default(100),
  includeAnalysis: z.boolean().optional().default(false),
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
    const { symbol, timeframe, atrPeriod, lookbackPeriods, includeAnalysis } = 
      MarketContextSchema.parse(body);

    // Get market context data
    const marketContext = await marketContextProvider.getMarketContext({
      symbol,
      timeframe,
      atrPeriod,
      lookbackPeriods
    });

    let analysis = null;
    
    // If analysis is requested, use AI to analyze the market context
    if (includeAnalysis) {
      try {
        const marketDataString = formatMarketContextForAI(marketContext);
        const analysisPrompt = buildMarketAnalysisPrompt(marketDataString);
        
        analysis = await callLLM(
          analysisPrompt,
          'analysis', // Use analysis model tier
          ENHANCED_STRATEGY_PROMPTS.MARKET_ANALYSIS_TEMPLATE
        );
      } catch (error) {
        console.error('Market analysis failed:', error);
        // Don't fail the entire request if analysis fails
        analysis = {
          error: 'Analysis temporarily unavailable',
          message: 'Market context retrieved successfully, but AI analysis failed'
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        marketContext,
        analysis,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Market context API error:', error);

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
        error: 'Failed to retrieve market context',
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

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const timeframe = searchParams.get('timeframe');

    if (!symbol || !timeframe) {
      return NextResponse.json(
        { 
          error: 'Missing required parameters',
          required: ['symbol', 'timeframe']
        },
        { status: 400 }
      );
    }

    // Validate parameters
    const params = MarketContextSchema.parse({
      symbol,
      timeframe,
      atrPeriod: parseInt(searchParams.get('atrPeriod') || '14'),
      lookbackPeriods: parseInt(searchParams.get('lookbackPeriods') || '100'),
      includeAnalysis: searchParams.get('includeAnalysis') === 'true'
    });

    // Initialize Redis
    const redisClient = await initializeRedis();
    
    // Generate cache key
    const cacheKey = `market-context:${params.symbol}:${params.timeframe}:${params.atrPeriod}:${params.lookbackPeriods}`;

    // Try to get from cache first
    if (redisClient && isRedisAvailable) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          const parsedCache = typeof cached === 'string' ? JSON.parse(cached) : cached;
          console.log(`✅ Cache HIT for ${params.symbol} ${params.timeframe} (Age: ${Math.floor((Date.now() - new Date(parsedCache.timestamp).getTime()) / 1000)}s)`);
          
          return NextResponse.json({
            success: true,
            data: {
              marketContext: parsedCache.marketContext,
              timestamp: parsedCache.timestamp,
              cached: true,
              cacheAge: Math.floor((Date.now() - new Date(parsedCache.timestamp).getTime()) / 1000)
            }
          });
        } else {
          console.log(`💨 Cache MISS for ${params.symbol} ${params.timeframe}`);
        }
      } catch (cacheError) {
        console.error('Cache read error:', cacheError);
      }
    }

    // Get fresh market context data
    const marketContext = await marketContextProvider.getMarketContext({
      symbol: params.symbol,
      timeframe: params.timeframe,
      atrPeriod: params.atrPeriod,
      lookbackPeriods: params.lookbackPeriods
    });

    const timestamp = new Date().toISOString();

    // Store in cache
    if (redisClient && isRedisAvailable) {
      try {
        const cacheData = {
          marketContext,
          timestamp
        };
        await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(cacheData));
        console.log(`💾 Cached market context for ${params.symbol} ${params.timeframe} (TTL: ${CACHE_TTL}s)`);
      } catch (cacheError) {
        console.error('Cache write error:', cacheError);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        marketContext,
        timestamp,
        cached: false
      }
    });

  } catch (error) {
    console.error('Market context GET error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request parameters',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to retrieve market context',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Format market context for AI analysis
 */
function formatMarketContextForAI(context: any): string {
  return `
Symbol: ${context.symbol}
Timeframe: ${context.timeframe}
Current Price: ${context.price.current.toFixed(5)}
24h Change: ${context.price.changePercent >= 0 ? '+' : ''}${context.price.changePercent.toFixed(2)}%

Volatility Analysis:
- Current ATR: ${context.volatility.currentATR.toFixed(5)}
- Historical ATR: ${context.volatility.historicalAverage.toFixed(5)}
- Volatility Level: ${context.volatility.volatilityLevel}

Trend Analysis:
- Direction: ${context.trend.direction}
- Strength: ${context.trend.strength.toFixed(0)}/100
- Timeframe: ${context.trend.timeframe}

Key Levels:
- Nearest Support: ${context.keyLevels.nearestSupport?.toFixed(5) || 'N/A'}
- Nearest Resistance: ${context.keyLevels.nearestResistance?.toFixed(5) || 'N/A'}
- Support Levels: ${context.keyLevels.support.map((s: number) => s.toFixed(5)).join(', ')}
- Resistance Levels: ${context.keyLevels.resistance.map((r: number) => r.toFixed(5)).join(', ')}

Market Sessions:
- Active Sessions: ${context.session.activeSessions.join(', ')}
- Market Condition: ${context.session.marketCondition}
- Optimal for ${context.symbol}: ${context.session.isOptimalForPair ? 'YES' : 'NO'}
- Recommended Pairs: ${context.session.recommendedPairs.join(', ')}

Data Timestamp: ${context.timestamp}
`;
}
