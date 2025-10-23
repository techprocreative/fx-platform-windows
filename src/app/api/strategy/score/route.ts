import { NextRequest, NextResponse } from 'next/server';
import { calculateStrategyScore, createStrategyScorer } from '@/lib/analysis/strategy-scorer';
import { 
  StrategyScoreCalculationParams, 
  StrategyScore, 
  ApiResponse,
  ScoringConfig 
} from '@/types';

/**
 * API endpoint for calculating strategy performance scores
 * 
 * POST /api/strategy/score
 * 
 * Request body:
 * {
 *   backtestResults: BacktestResults | BacktestResult,
 *   config?: ScoringConfig,
 *   benchmark?: BenchmarkData,
 *   historicalScores?: StrategyScoreHistory[]
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     score: StrategyScore,
 *     metrics: ScoringMetrics,
 *     timestamp: string
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    
    // Validate required fields
    if (!body.backtestResults) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELD',
          message: 'backtestResults is required',
          details: { field: 'backtestResults' }
        }
      }, { status: 400 });
    }

    // Extract parameters
    const params: StrategyScoreCalculationParams = {
      backtestResults: body.backtestResults,
      config: body.config,
      benchmark: body.benchmark,
      historicalScores: body.historicalScores
    };

    // Validate backtest results
    if (!validateBacktestResults(params.backtestResults)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'INVALID_BACKTEST_RESULTS',
          message: 'Invalid backtest results provided',
          details: {
            required: ['totalTrades', 'winRate', 'returnPercentage', 'maxDrawdown'],
            provided: Object.keys(params.backtestResults)
          }
        }
      }, { status: 400 });
    }

    // Calculate strategy score
    const scorer = createStrategyScorer(params.config);
    const strategyScore = scorer.calculateStrategyScore(params);

    // Extract metrics from backtest results for response
    const metrics = extractMetricsFromBacktest(params.backtestResults);

    // Return successful response
    return NextResponse.json<ApiResponse<{
      score: StrategyScore;
      metrics: any;
      timestamp: string;
    }>>({
      success: true,
      data: {
        score: strategyScore,
        metrics,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Strategy scoring error:', error);
    
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'SCORING_ERROR',
        message: 'Failed to calculate strategy score',
        details: error instanceof Error ? {
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        } : { message: 'Unknown error' }
      }
    }, { status: 500 });
  }
}

/**
 * GET endpoint for retrieving scoring configuration and defaults
 * 
 * GET /api/strategy/score
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     defaultConfig: ScoringConfig,
 *     availableWeights: ScoringWeights[],
 *     scoringDimensions: string[]
 *   }
 * }
 */
export async function GET() {
  try {
    // Return default scoring configuration
    const defaultConfig: ScoringConfig = {
      weights: {
        profitability: 0.30,
        consistency: 0.25,
        riskAdjusted: 0.25,
        drawdown: 0.20
      },
      minimumTrades: 20,
      lookbackPeriod: 365,
      enableHistoricalTracking: true
    };

    // Available weight presets
    const weightPresets = [
      {
        name: 'Balanced',
        description: 'Equal emphasis on all dimensions',
        weights: {
          profitability: 0.25,
          consistency: 0.25,
          riskAdjusted: 0.25,
          drawdown: 0.25
        }
      },
      {
        name: 'Conservative',
        description: 'Higher emphasis on risk management',
        weights: {
          profitability: 0.20,
          consistency: 0.25,
          riskAdjusted: 0.30,
          drawdown: 0.25
        }
      },
      {
        name: 'Aggressive',
        description: 'Higher emphasis on profitability',
        weights: {
          profitability: 0.40,
          consistency: 0.20,
          riskAdjusted: 0.20,
          drawdown: 0.20
        }
      }
    ];

    return NextResponse.json<ApiResponse<{
      defaultConfig: ScoringConfig;
      weightPresets: typeof weightPresets;
      scoringDimensions: string[];
      scoreInterpretation: {
        excellent: { min: number; description: string };
        good: { min: number; description: string };
        average: { min: number; description: string };
        poor: { min: number; description: string };
      };
    }>>({
      success: true,
      data: {
        defaultConfig,
        weightPresets,
        scoringDimensions: ['profitability', 'consistency', 'riskAdjusted', 'drawdown'],
        scoreInterpretation: {
          excellent: { min: 80, description: 'Exceptional strategy performance' },
          good: { min: 65, description: 'Strong strategy with good metrics' },
          average: { min: 50, description: 'Acceptable performance with room for improvement' },
          poor: { min: 0, description: 'Strategy needs significant improvement' }
        }
      }
    });

  } catch (error) {
    console.error('Get scoring config error:', error);
    
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'CONFIG_ERROR',
        message: 'Failed to retrieve scoring configuration',
        details: error instanceof Error ? { message: error.message } : { message: 'Unknown error' }
      }
    }, { status: 500 });
  }
}

/**
 * Validate backtest results structure
 */
function validateBacktestResults(results: any): boolean {
  if (!results || typeof results !== 'object') {
    return false;
  }

  // Check for required basic metrics
  const requiredFields = ['totalTrades', 'winRate', 'returnPercentage', 'maxDrawdown'];
  for (const field of requiredFields) {
    if (!(field in results) || typeof results[field] !== 'number') {
      return false;
    }
  }

  // Validate trade data
  if (results.trades && !Array.isArray(results.trades)) {
    return false;
  }

  // Validate equity curve
  if (results.equityCurve && !Array.isArray(results.equityCurve)) {
    return false;
  }

  return true;
}

/**
 * Extract key metrics from backtest results for response
 */
function extractMetricsFromBacktest(results: any): any {
  const basicMetrics = {
    totalTrades: results.totalTrades || 0,
    winRate: results.winRate || 0,
    returnPercentage: results.returnPercentage || 0,
    maxDrawdown: results.maxDrawdown || 0,
    profitFactor: results.profitFactor || 0,
    sharpeRatio: results.sharpeRatio || 0,
    averageWin: results.averageWin || 0,
    averageLoss: results.averageLoss || 0
  };

  // Include advanced metrics if available
  const advancedMetrics = results.metadata?.advancedMetrics || {};

  return {
    ...basicMetrics,
    ...advancedMetrics,
    tradesCount: results.trades?.length || 0,
    equityCurvePoints: results.equityCurve?.length || 0,
    dataSource: results.metadata?.dataSource || 'unknown',
    executionTime: results.metadata?.executionTime || null
  };
}

/**
 * PUT endpoint for updating scoring configuration (admin only)
 * 
 * PUT /api/strategy/score
 * 
 * Request body:
 * {
 *   config: ScoringConfig,
 *   apiKey: string // Admin API key
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Simple API key validation (in production, use proper authentication)
    const adminApiKey = process.env.ADMIN_API_KEY;
    if (!adminApiKey || body.apiKey !== adminApiKey) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or missing API key',
          details: { required: 'apiKey' }
        }
      }, { status: 401 });
    }

    // Validate config
    if (!body.config || typeof body.config !== 'object') {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'INVALID_CONFIG',
          message: 'Valid scoring configuration is required',
          details: { required: 'config' }
        }
      }, { status: 400 });
    }

    // Validate weights
    const { weights } = body.config;
    if (!weights || typeof weights !== 'object') {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'INVALID_WEIGHTS',
          message: 'Valid weights configuration is required',
          details: { required: 'weights' }
        }
      }, { status: 400 });
    }

    // Validate weight values
    const weightFields = ['profitability', 'consistency', 'riskAdjusted', 'drawdown'];
    let totalWeight = 0;
    
    for (const field of weightFields) {
      if (!(field in weights) || typeof weights[field] !== 'number' || weights[field] < 0) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: {
            code: 'INVALID_WEIGHT_VALUE',
            message: `Invalid weight value for ${field}`,
            details: { field, value: weights[field] }
          }
        }, { status: 400 });
      }
      totalWeight += weights[field];
    }

    // Check if weights sum to 1 (allowing small floating point errors)
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'INVALID_WEIGHT_SUM',
          message: 'Weights must sum to 1.0',
          details: { totalWeight, expected: 1.0 }
        }
      }, { status: 400 });
    }

    // In a real implementation, you would save this to a database
    // For now, just return success
    return NextResponse.json<ApiResponse<{ message: string; config: any }>>({
      success: true,
      data: {
        message: 'Scoring configuration updated successfully',
        config: body.config
      }
    });

  } catch (error) {
    console.error('Update scoring config error:', error);
    
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'UPDATE_ERROR',
        message: 'Failed to update scoring configuration',
        details: error instanceof Error ? { message: error.message } : { message: 'Unknown error' }
      }
    }, { status: 500 });
  }
}