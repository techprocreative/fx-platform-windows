import { NextRequest, NextResponse } from 'next/server';
import { getMarketDataService, initializeMarketDataService, DEFAULT_MARKET_DATA_CONFIG } from '@/lib/market-data/service';

// Initialize the market data service
let serviceInitialized = false;

function ensureServiceInitialized() {
  if (!serviceInitialized) {
    initializeMarketDataService(DEFAULT_MARKET_DATA_CONFIG);
    serviceInitialized = true;
  }
}

export async function GET(request: NextRequest) {
  try {
    ensureServiceInitialized();

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const timeframe = searchParams.get('timeframe') || '1h';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

    if (!symbol) {
      return NextResponse.json(
        { error: 'Missing required parameter: symbol' },
        { status: 400 }
      );
    }

    const marketDataService = getMarketDataService();
    const historicalData = await marketDataService.getHistoricalData(symbol, timeframe, limit);

    return NextResponse.json({
      success: true,
      data: historicalData,
      timestamp: new Date().toISOString(),
      provider: marketDataService.getAvailableProviders()[0]
    });
  } catch (error) {
    console.error('Historical data API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch historical data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureServiceInitialized();

    const body = await request.json();
    const { symbol, timeframe = '1h', limit } = body;

    if (!symbol) {
      return NextResponse.json(
        { error: 'Missing required parameter: symbol' },
        { status: 400 }
      );
    }

    const marketDataService = getMarketDataService();
    const historicalData = await marketDataService.getHistoricalData(symbol, timeframe, limit);

    return NextResponse.json({
      success: true,
      data: historicalData,
      timestamp: new Date().toISOString(),
      provider: marketDataService.getAvailableProviders()[0]
    });
  } catch (error) {
    console.error('Historical data API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch historical data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
