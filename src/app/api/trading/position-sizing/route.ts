/**
 * Position Sizing API Endpoint
 * 
 * This endpoint provides position sizing calculations using multiple methods
 * including fixed lot, percentage risk, ATR-based, volatility-based, Kelly criterion,
 * and account equity-based sizing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { riskManager } from '@/lib/risk/risk-manager';
import { 
  PositionSizingConfig, 
  PositionSizingParams, 
  SizingMethod,
  ApiResponse 
} from '@/types';
import { logger } from '@/lib/monitoring/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Request body is required and must be an object'
          }
        } as ApiResponse<never>,
        { status: 400 }
      );
    }

    const { 
      accountBalance,
      accountEquity,
      symbol,
      entryPrice,
      tradeType,
      currentATR,
      volatility,
      spread,
      historicalData,
      openPositions,
      dailyPnL,
      config
    } = body as PositionSizingParams;

    // Validate required fields
    const requiredFields = ['accountBalance', 'symbol', 'entryPrice', 'tradeType', 'config'];
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: `Missing required fields: ${missingFields.join(', ')}`,
            details: { missingFields }
          }
        } as ApiResponse<never>,
        { status: 400 }
      );
    }

    // Validate position sizing configuration
    const configValidation = riskManager.validatePositionSizingConfig(config);
    if (!configValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CONFIG',
            message: 'Invalid position sizing configuration',
            details: { errors: configValidation.errors }
          }
        } as ApiResponse<never>,
        { status: 400 }
      );
    }

    // Prepare position sizing parameters
    const params: Omit<PositionSizingParams, 'config'> = {
      accountBalance: Number(accountBalance),
      accountEquity: accountEquity ? Number(accountEquity) : undefined,
      symbol: String(symbol),
      entryPrice: Number(entryPrice),
      tradeType: tradeType === 'BUY' || tradeType === 'SELL' ? tradeType : 'BUY',
      currentATR: currentATR ? Number(currentATR) : undefined,
      volatility: volatility ? Number(volatility) : undefined,
      spread: spread ? Number(spread) : undefined,
      historicalData: historicalData ? {
        winRate: Number(historicalData.winRate),
        avgWin: Number(historicalData.avgWin),
        avgLoss: Number(historicalData.avgLoss),
        totalTrades: Number(historicalData.totalTrades)
      } : undefined,
      openPositions: openPositions || [],
      dailyPnL: dailyPnL ? Number(dailyPnL) : undefined
    };

    // Calculate position size
    const result = await riskManager.calculateEnhancedPositionSize(params, config);

    logger.info('Position sizing calculation completed', {
      method: config.method,
      symbol,
      positionSize: result.positionSize,
      riskPercentage: result.riskPercentage,
      confidence: result.confidence
    });

    return NextResponse.json({
      success: true,
      data: result
    } as ApiResponse<typeof result>);

  } catch (error) {
    logger.error('Position sizing calculation failed', error as Error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CALCULATION_ERROR',
          message: 'Failed to calculate position size',
          details: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      } as ApiResponse<never>,
      { status: 500 }
    );
  }
}

/**
 * Get default position sizing configuration for a method
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const method = searchParams.get('method') as SizingMethod;
    const experienceLevel = searchParams.get('experienceLevel') as 'beginner' | 'intermediate' | 'advanced';
    const riskTolerance = searchParams.get('riskTolerance') as 'conservative' | 'moderate' | 'aggressive';
    const accountBalance = searchParams.get('accountBalance');

    if (method && experienceLevel && riskTolerance && accountBalance) {
      // Get recommended configuration based on user profile
      const recommendedConfig = riskManager.getRecommendedPositionSizingConfig(
        {
          experienceLevel,
          riskTolerance
        },
        Number(accountBalance)
      );

      return NextResponse.json({
        success: true,
        data: {
          method,
          config: recommendedConfig,
          recommended: true
        }
      } as ApiResponse<{ method: SizingMethod; config: PositionSizingConfig; recommended: boolean }>);
    }

    if (method) {
      // Get default configuration for specific method
      try {
        const { PositionSizingCalculator } = await import('@/lib/trading/position-sizing');
        const defaultConfig = PositionSizingCalculator.getDefaultConfig(method);

        return NextResponse.json({
          success: true,
          data: {
            method,
            config: defaultConfig,
            recommended: false
          }
        } as ApiResponse<{ method: SizingMethod; config: PositionSizingConfig; recommended: boolean }>);
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_METHOD',
              message: `Invalid position sizing method: ${method}`,
              details: { availableMethods: ['fixed_lot', 'percentage_risk', 'atr_based', 'volatility_based', 'kelly_criterion', 'account_equity'] }
            }
          } as ApiResponse<never>,
          { status: 400 }
        );
      }
    }

    // Get all available methods and their descriptions
    const methods = [
      {
        method: 'fixed_lot' as SizingMethod,
        name: 'Fixed Lot Size',
        description: 'Use a fixed lot size for all trades',
        bestFor: 'Beginners who want simplicity',
        complexity: 'Low'
      },
      {
        method: 'percentage_risk' as SizingMethod,
        name: 'Percentage Risk',
        description: 'Risk a fixed percentage of account balance per trade',
        bestFor: 'Most traders who want consistent risk management',
        complexity: 'Low'
      },
      {
        method: 'atr_based' as SizingMethod,
        name: 'ATR-Based',
        description: 'Adjust position size based on market volatility (ATR)',
        bestFor: 'Traders who want adaptive risk management',
        complexity: 'Medium'
      },
      {
        method: 'volatility_based' as SizingMethod,
        name: 'Volatility-Based',
        description: 'Adjust position size based on statistical volatility',
        bestFor: 'Advanced traders who understand volatility metrics',
        complexity: 'Medium'
      },
      {
        method: 'kelly_criterion' as SizingMethod,
        name: 'Kelly Criterion',
        description: 'Mathematical formula for optimal position sizing',
        bestFor: 'Advanced traders with reliable historical data',
        complexity: 'High'
      },
      {
        method: 'account_equity' as SizingMethod,
        name: 'Account Equity',
        description: 'Adjust position size based on account equity and drawdown',
        bestFor: 'Traders who want to protect their capital',
        complexity: 'Medium'
      }
    ];

    return NextResponse.json({
      success: true,
      data: {
        methods,
        message: 'Use ?method=METHOD_NAME to get default configuration for a specific method'
      }
    } as ApiResponse<{ methods: typeof methods; message: string }>);

  } catch (error) {
    logger.error('Position sizing config request failed', error as Error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CONFIG_ERROR',
          message: 'Failed to get position sizing configuration',
          details: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      } as ApiResponse<never>,
      { status: 500 }
    );
  }
}

/**
 * Validate position sizing configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body || !body.config) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Configuration object is required'
          }
        } as ApiResponse<never>,
        { status: 400 }
      );
    }

    const validation = riskManager.validatePositionSizingConfig(body.config as PositionSizingConfig);

    return NextResponse.json({
      success: true,
      data: {
        valid: validation.valid,
        errors: validation.errors,
        config: body.config
      }
    } as ApiResponse<{ valid: boolean; errors: string[]; config: PositionSizingConfig }>);

  } catch (error) {
    logger.error('Position sizing validation failed', error as Error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Failed to validate position sizing configuration',
          details: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      } as ApiResponse<never>,
      { status: 500 }
    );
  }
}