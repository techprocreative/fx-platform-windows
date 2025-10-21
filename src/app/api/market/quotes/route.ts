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
    const symbols = searchParams.get('symbols');
    const type = searchParams.get('type') || 'quote';

    if (!symbols) {
      return NextResponse.json(
        { error: 'Missing required parameter: symbols' },
        { status: 400 }
      );
    }

    const marketDataService = getMarketDataService();
    const symbolList = symbols.split(',').map(s => s.trim());

    if (type === 'quote') {
      const quotes = await marketDataService.getRealTimeQuote(symbolList);

      return NextResponse.json({
        success: true,
        data: quotes,
        timestamp: new Date().toISOString(),
        provider: marketDataService.getAvailableProviders()[0]
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid type parameter. Use "quote" for real-time quotes.' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Market data API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch market data',
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
    const { symbols, type = 'quote' } = body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid symbols array' },
        { status: 400 }
      );
    }

    const marketDataService = getMarketDataService();

    if (type === 'quote') {
      const quotes = await marketDataService.getRealTimeQuote(symbols);

      return NextResponse.json({
        success: true,
        data: quotes,
        timestamp: new Date().toISOString(),
        provider: marketDataService.getAvailableProviders()[0]
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid type parameter. Use "quote" for real-time quotes.' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Market data API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch market data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
