/**
 * MULTI-TIMEFRAME ANALYSIS API
 * Provides MTF data analysis and confirmation logic
 * Phase 2.1 Implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMTFAnalyzer, validateMTFStrategy } from '@/lib/analysis/multi-timeframe';
import { HistoricalDataFetcher } from '@/lib/backtest/engine';
import { MTFStrategy, MTFAnalysisResult } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { strategy, dateRange, symbol } = body;

    // Validate request
    if (!strategy || !dateRange || !symbol) {
      return NextResponse.json(
        { error: 'Missing required fields: strategy, dateRange, symbol' },
        { status: 400 }
      );
    }

    // Validate MTF strategy
    const validation = validateMTFStrategy(strategy);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Invalid MTF strategy', details: validation.errors },
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

    // Fetch market data for all timeframes
    const marketData: Record<string, any[]> = {};
    
    // Fetch primary timeframe data
    try {
      const primaryData = await HistoricalDataFetcher.fetchFromYahooFinance(
        symbol,
        strategy.primaryTimeframe,
        startDate,
        endDate
      );
      marketData[strategy.primaryTimeframe] = primaryData;
    } catch (error) {
      console.error(`Failed to fetch primary timeframe data:`, error);
      return NextResponse.json(
        { error: `Failed to fetch data for ${strategy.primaryTimeframe} timeframe` },
        { status: 500 }
      );
    }

    // Fetch confirmation timeframe data
    for (const tf of strategy.confirmationTimeframes) {
      try {
        const confirmationData = await HistoricalDataFetcher.fetchFromYahooFinance(
          symbol,
          tf,
          startDate,
          endDate
        );
        marketData[tf] = confirmationData;
      } catch (error) {
        console.error(`Failed to fetch ${tf} timeframe data:`, error);
        // Continue with other timeframes if one fails
        marketData[tf] = [];
      }
    }

    // Create MTF analyzer
    const mtfAnalyzer = createMTFAnalyzer({
      strategy,
      marketData,
      currentTime: new Date()
    });

    // Perform analysis
    const analysisResult = await mtfAnalyzer.analyze();

    // Get latest data for all timeframes
    const latestData = mtfAnalyzer.getLatestData();

    // Get analysis summary
    const analysisSummary = mtfAnalyzer.getAnalysisSummary();

    return NextResponse.json({
      success: true,
      data: {
        analysis: analysisResult,
        latestData,
        summary: analysisSummary,
        marketDataPoints: Object.keys(marketData).reduce((acc, tf) => {
          acc[tf] = marketData[tf].length;
          return acc;
        }, {} as Record<string, number>)
      }
    });

  } catch (error) {
    console.error('MTF Analysis API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const primaryTimeframe = searchParams.get('primaryTimeframe');
    const confirmationTimeframes = searchParams.get('confirmationTimeframes')?.split(',');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Validate required parameters
    if (!symbol || !primaryTimeframe || !confirmationTimeframes || !from || !to) {
      return NextResponse.json(
        { error: 'Missing required parameters: symbol, primaryTimeframe, confirmationTimeframes, from, to' },
        { status: 400 }
      );
    }

    // Create a basic MTF strategy from query parameters
    const basicStrategy: MTFStrategy = {
      id: 'query_strategy',
      userId: 'api_user',
      name: 'Query-based MTF Strategy',
      description: 'MTF strategy created from query parameters',
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

    // Parse date range
    const startDate = new Date(from);
    const endDate = new Date(to);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)' },
        { status: 400 }
      );
    }

    // Fetch market data for all timeframes
    const marketData: Record<string, any[]> = {};
    
    // Fetch primary timeframe data
    try {
      const primaryData = await HistoricalDataFetcher.fetchFromYahooFinance(
        symbol,
        primaryTimeframe,
        startDate,
        endDate
      );
      marketData[primaryTimeframe] = primaryData;
    } catch (error) {
      console.error(`Failed to fetch primary timeframe data:`, error);
      return NextResponse.json(
        { error: `Failed to fetch data for ${primaryTimeframe} timeframe` },
        { status: 500 }
      );
    }

    // Fetch confirmation timeframe data
    for (const tf of confirmationTimeframes) {
      try {
        const confirmationData = await HistoricalDataFetcher.fetchFromYahooFinance(
          symbol,
          tf,
          startDate,
          endDate
        );
        marketData[tf] = confirmationData;
      } catch (error) {
        console.error(`Failed to fetch ${tf} timeframe data:`, error);
        // Continue with other timeframes if one fails
        marketData[tf] = [];
      }
    }

    // Create MTF analyzer
    const mtfAnalyzer = createMTFAnalyzer({
      strategy: basicStrategy,
      marketData,
      currentTime: new Date()
    });

    // Perform analysis
    const analysisResult = await mtfAnalyzer.analyze();

    // Get latest data for all timeframes
    const latestData = mtfAnalyzer.getLatestData();

    // Get analysis summary
    const analysisSummary = mtfAnalyzer.getAnalysisSummary();

    return NextResponse.json({
      success: true,
      data: {
        analysis: analysisResult,
        latestData,
        summary: analysisSummary,
        marketDataPoints: Object.keys(marketData).reduce((acc, tf) => {
          acc[tf] = marketData[tf].length;
          return acc;
        }, {} as Record<string, number>),
        strategy: basicStrategy
      }
    });

  } catch (error) {
    console.error('MTF Analysis GET API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}