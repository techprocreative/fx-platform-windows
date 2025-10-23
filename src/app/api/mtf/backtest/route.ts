/**
 * MULTI-TIMEFRAME BACKTEST API
 * Provides MTF strategy backtesting functionality
 * Phase 2.1 Implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import { runMTFBacktest } from '@/lib/backtest/engine';
import { MTFStrategy } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { strategy, dateRange, initialBalance } = body;

    // Validate request
    if (!strategy || !dateRange || !initialBalance) {
      return NextResponse.json(
        { error: 'Missing required fields: strategy, dateRange, initialBalance' },
        { status: 400 }
      );
    }

    // Parse date range
    const startDate = new Date(dateRange.from);
    const endDate = new Date(dateRange.to);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date range format' },
        { status: 400 }
      );
    }

    // Validate initial balance
    if (typeof initialBalance !== 'number' || initialBalance <= 0) {
      return NextResponse.json(
        { error: 'Initial balance must be a positive number' },
        { status: 400 }
      );
    }

    // Run MTF backtest
    const backtestResult = await runMTFBacktest(
      strategy.id,
      strategy as MTFStrategy,
      {
        startDate,
        endDate,
        initialBalance
      }
    );

    return NextResponse.json({
      success: true,
      data: backtestResult
    });

  } catch (error) {
    console.error('MTF Backtest API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const strategyId = searchParams.get('strategyId');
    const symbol = searchParams.get('symbol');
    const primaryTimeframe = searchParams.get('primaryTimeframe');
    const confirmationTimeframes = searchParams.get('confirmationTimeframes')?.split(',');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const initialBalance = searchParams.get('initialBalance');

    // Validate required parameters
    if (!strategyId || !symbol || !primaryTimeframe || !confirmationTimeframes || !from || !to || !initialBalance) {
      return NextResponse.json(
        { error: 'Missing required parameters: strategyId, symbol, primaryTimeframe, confirmationTimeframes, from, to, initialBalance' },
        { status: 400 }
      );
    }

    // Parse and validate initial balance
    const balance = parseFloat(initialBalance);
    if (isNaN(balance) || balance <= 0) {
      return NextResponse.json(
        { error: 'Initial balance must be a positive number' },
        { status: 400 }
      );
    }

    // Parse date range
    const startDate = new Date(from);
    const endDate = new Date(to);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)' },
        { status: 400 }
      );
    }

    // Create a basic MTF strategy from query parameters
    const basicStrategy: MTFStrategy = {
      id: strategyId,
      userId: 'api_user',
      name: 'Query-based MTF Backtest Strategy',
      description: 'MTF strategy created from query parameters for backtesting',
      symbol,
      primaryTimeframe,
      confirmationTimeframes,
      type: 'mtf',
      status: 'active',
      rules: {
        entry: {
          primary: [
            {
              indicator: 'RSI',
              condition: 'less_than',
              value: 30
            }
          ],
          confirmation: confirmationTimeframes.map(tf => ({
            timeframe: tf,
            condition: {
              indicator: 'RSI',
              condition: 'less_than',
              value: 50
            },
            required: true
          }))
        },
        exit: {
          takeProfit: { type: 'pips', value: 50 },
          stopLoss: { type: 'pips', value: 25 }
        },
        riskManagement: {
          lotSize: 0.01,
          maxPositions: 1,
          maxDailyLoss: 100
        }
      },
      version: 1,
      isPublic: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Run MTF backtest
    const backtestResult = await runMTFBacktest(
      strategyId,
      basicStrategy,
      {
        startDate,
        endDate,
        initialBalance: balance
      }
    );

    return NextResponse.json({
      success: true,
      data: backtestResult,
      strategy: basicStrategy
    });

  } catch (error) {
    console.error('MTF Backtest GET API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}