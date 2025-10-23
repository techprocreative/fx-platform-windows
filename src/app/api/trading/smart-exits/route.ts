import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SmartExitCalculator } from '@/lib/trading/smart-exits';
import { riskManager } from '@/lib/risk/risk-manager';
import {
  SmartExitRules,
  ExitCalculationParams,
  ExitCalculationResult,
  ApiResponse
} from '@/types';
import { TradeParams } from '@/lib/risk/types';

/**
 * POST /api/trading/smart-exits
 * Calculate smart exit levels based on market data and rules
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
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

    // Parse request body
    const body = await request.json();
    const { 
      entryPrice, 
      tradeType, 
      atr, 
      swingPoints, 
      currentPrice, 
      smartExitRules,
      symbol,
      lotSize,
      stopLoss,
      takeProfit,
      validateRisk = true
    } = body;

    // Validate required fields
    if (!entryPrice || !tradeType || !smartExitRules) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: entryPrice, tradeType, smartExitRules'
        }
      }, { status: 400 });
    }

    // Validate trade type
    if (!['BUY', 'SELL'].includes(tradeType)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'INVALID_TRADE_TYPE',
          message: 'Trade type must be BUY or SELL'
        }
      }, { status: 400 });
    }

    // Prepare exit calculation parameters
    const exitParams: ExitCalculationParams = {
      entryPrice: Number(entryPrice),
      tradeType,
      atr: atr ? Number(atr) : undefined,
      swingPoints: swingPoints || [],
      currentPrice: currentPrice ? Number(currentPrice) : Number(entryPrice),
      timestamp: new Date()
    };

    // Calculate smart exits
    let exitResult: ExitCalculationResult;
    try {
      exitResult = SmartExitCalculator.calculateExits(exitParams, smartExitRules);
    } catch (error) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'CALCULATION_ERROR',
          message: `Failed to calculate smart exits: ${(error as Error).message}`,
          details: { exitParams, smartExitRules }
        }
      }, { status: 500 });
    }

    // Validate trade against risk management if requested
    let riskValidation = null;
    if (validateRisk && symbol && lotSize) {
      try {
        const tradeParams: TradeParams = {
          userId: session.user.id,
          symbol,
          type: tradeType,
          entryPrice: Number(entryPrice),
          lotSize: Number(lotSize),
          stopLoss: stopLoss || exitResult.stopLoss.price,
          takeProfit: takeProfit || exitResult.takeProfit.price,
          currentATR: atr ? Number(atr) : undefined
        };

        const validationResult = await riskManager.validateTrade(
          tradeParams, 
          smartExitRules, 
          { atr, swingPoints }
        );

        riskValidation = {
          valid: validationResult.valid,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          adjustedParams: validationResult.adjustedParams
        };
      } catch (error) {
        // Don't fail the request if risk validation fails, just include the error
        riskValidation = {
          valid: false,
          errors: [`Risk validation failed: ${(error as Error).message}`],
          warnings: [],
          adjustedParams: null
        };
      }
    }

    // Return successful response
    return NextResponse.json<ApiResponse<{
      exitCalculation: ExitCalculationResult;
      riskValidation: typeof riskValidation;
      metadata: {
        calculatedAt: Date;
        userId: string;
        symbol?: string;
        tradeType: string;
      };
    }>>({
      success: true,
      data: {
        exitCalculation: exitResult,
        riskValidation,
        metadata: {
          calculatedAt: new Date(),
          userId: session.user.id,
          symbol,
          tradeType
        }
      }
    });

  } catch (error) {
    console.error('Smart exits API error:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? { message: (error as Error).message } : undefined
      }
    }, { status: 500 });
  }
}

/**
 * GET /api/trading/smart-exits
 * Get swing point analysis for a symbol
 */
export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const timeframe = searchParams.get('timeframe') || 'H1';
    const lookback = searchParams.get('lookback') ? parseInt(searchParams.get('lookback')!) : 50;

    if (!symbol) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Symbol parameter is required'
        }
      }, { status: 400 });
    }

    // In a real implementation, this would fetch historical price data
    // For now, we'll return a mock swing point analysis
    const mockSwingPoints = [
      {
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        price: 1.0850,
        type: 'high' as const,
        strength: 3
      },
      {
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
        price: 1.0750,
        type: 'low' as const,
        strength: 4
      },
      {
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        price: 1.0900,
        type: 'high' as const,
        strength: 2
      }
    ];

    const swingPointAnalysis = SmartExitCalculator.analyzeSwingPoints(mockSwingPoints);

    return NextResponse.json<ApiResponse<{
      symbol: string;
      timeframe: string;
      swingPointAnalysis: typeof swingPointAnalysis;
      metadata: {
        calculatedAt: Date;
        userId: string;
        lookback: number;
      };
    }>>({
      success: true,
      data: {
        symbol,
        timeframe,
        swingPointAnalysis,
        metadata: {
          calculatedAt: new Date(),
          userId: session.user.id,
          lookback
        }
      }
    });

  } catch (error) {
    console.error('Smart swing points API error:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? { message: (error as Error).message } : undefined
      }
    }, { status: 500 });
  }
}