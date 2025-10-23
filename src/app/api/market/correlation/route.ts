import { NextRequest, NextResponse } from 'next/server';
import { 
  calculateCorrelationMatrix, 
  analyzeCorrelationForSignal,
  getRecommendedPairs,
  calculateDynamicThresholds,
  validateCorrelationFilter,
  groupPairsByCurrency,
  calculateHistoricalCorrelation
} from '@/lib/market/correlation';
import { 
  CorrelationFilter, 
  CorrelationMatrix, 
  CorrelationAnalysisResult,
  HistoricalCorrelation 
} from '@/types';

// Mock price data generator for development
// In production, this would fetch from your data provider
function generateMockPriceData(symbol: string, periods: number): any[] {
  const data: any[] = [];
  const basePrice = getBasePriceForSymbol(symbol);
  let currentPrice = basePrice;
  
  const now = new Date();
  for (let i = periods; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000)); // Hourly data
    const change = (Math.random() - 0.5) * 0.002; // Random change
    currentPrice = currentPrice * (1 + change);
    
    const volatility = 0.0005 + Math.random() * 0.001;
    data.push({
      timestamp,
      open: currentPrice,
      high: currentPrice + volatility,
      low: currentPrice - volatility,
      close: currentPrice + (Math.random() - 0.5) * volatility,
      volume: 1000 + Math.random() * 5000
    });
  }
  
  return data;
}

function getBasePriceForSymbol(symbol: string): number {
  // Simple base price mapping for common pairs
  const basePrices: Record<string, number> = {
    'EURUSD': 1.1000,
    'GBPUSD': 1.3000,
    'USDJPY': 110.00,
    'USDCHF': 0.9000,
    'AUDUSD': 0.7000,
    'USDCAD': 1.2500,
    'NZDUSD': 0.6500,
    'EURJPY': 120.00,
    'GBPJPY': 140.00,
    'EURGBP': 0.8500,
    'AUDJPY': 80.00,
    'EURAUD': 1.6000,
    'EURCHF': 1.0500,
    'AUDNZD': 1.1000,
    'NZDJPY': 75.00,
    'GBPAUD': 1.8000,
    'GBPCAD': 1.7000,
    'GBPNZD': 2.0000,
    'AUDCAD': 0.9000
  };
  
  return basePrices[symbol] || 1.0000;
}

// Mock existing positions for testing
function getMockExistingPositions(): Array<{ symbol: string; size: number }> {
  return [
    { symbol: 'EURUSD', size: 0.1 },
    { symbol: 'GBPUSD', size: 0.05 },
    { symbol: 'USDJPY', size: 0.2 }
  ];
}

// Mock historical correlation data for testing
function getMockHistoricalCorrelation(symbol1: string, symbol2: string): HistoricalCorrelation {
  const dataPoints = [];
  const now = new Date();
  
  for (let i = 30; i >= 0; i--) {
    const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000)); // Daily data
    const correlation = 0.5 + (Math.random() - 0.5) * 0.8; // Random correlation between 0.1 and 0.9
    const volatility = 0.01 + Math.random() * 0.02;
    
    dataPoints.push({
      date,
      correlation,
      volatility
    });
  }
  
  const correlations = dataPoints.map(d => d.correlation);
  const mean = correlations.reduce((sum, val) => sum + val, 0) / correlations.length;
  const variance = correlations.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / correlations.length;
  const stdDev = Math.sqrt(variance);
  const min = Math.min(...correlations);
  const max = Math.max(...correlations);
  
  // Determine trend
  const recentCorrelations = correlations.slice(-10);
  const olderCorrelations = correlations.slice(-20, -10);
  const recentAvg = recentCorrelations.reduce((sum, val) => sum + val, 0) / recentCorrelations.length;
  const olderAvg = olderCorrelations.length > 0 
    ? olderCorrelations.reduce((sum, val) => sum + val, 0) / olderCorrelations.length 
    : recentAvg;
  
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (recentAvg > olderAvg + 0.05) trend = 'increasing';
  else if (recentAvg < olderAvg - 0.05) trend = 'decreasing';
  
  return {
    symbol1,
    symbol2,
    timeframe: 'D1',
    dataPoints,
    statistics: {
      mean,
      stdDev,
      min,
      max,
      trend
    }
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    switch (action) {
      case 'matrix':
        return await handleGetCorrelationMatrix(searchParams);
      case 'analyze':
        return await handleAnalyzeCorrelation(searchParams);
      case 'historical':
        return await handleGetHistoricalCorrelation(searchParams);
      case 'recommendations':
        return await handleGetRecommendations(searchParams);
      case 'groups':
        return await handleGetCurrencyGroups(searchParams);
      case 'validate':
        return await handleValidateFilter(searchParams);
      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Correlation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleGetCorrelationMatrix(searchParams: URLSearchParams): Promise<NextResponse> {
  const symbols = searchParams.get('symbols')?.split(',') || [];
  const timeframe = searchParams.get('timeframe') || 'H1';
  const lookbackPeriod = parseInt(searchParams.get('lookbackPeriod') || '30');
  const minDataPoints = parseInt(searchParams.get('minDataPoints') || '20');
  
  if (symbols.length < 2) {
    return NextResponse.json(
      { error: 'At least 2 symbols are required for correlation matrix' },
      { status: 400 }
    );
  }
  
  try {
    // Generate mock price data for all symbols
    const priceData: Record<string, any[]> = {};
    for (const symbol of symbols) {
      priceData[symbol] = generateMockPriceData(symbol, lookbackPeriod);
    }
    
    // Calculate correlation matrix
    const correlationMatrix = await calculateCorrelationMatrix(
      symbols,
      priceData,
      timeframe,
      lookbackPeriod,
      minDataPoints
    );
    
    return NextResponse.json({
      success: true,
      data: correlationMatrix
    });
  } catch (error) {
    console.error('Error calculating correlation matrix:', error);
    return NextResponse.json(
      { error: 'Failed to calculate correlation matrix' },
      { status: 500 }
    );
  }
}

async function handleAnalyzeCorrelation(searchParams: URLSearchParams): Promise<NextResponse> {
  const symbol = searchParams.get('symbol');
  const filterJson = searchParams.get('filter');
  
  if (!symbol) {
    return NextResponse.json(
      { error: 'Symbol parameter is required' },
      { status: 400 }
    );
  }
  
  let correlationFilter: CorrelationFilter;
  try {
    correlationFilter = filterJson ? JSON.parse(filterJson) : {
      enabled: true,
      maxCorrelation: 0.7,
      checkPairs: [],
      skipHighlyCorrelated: true,
      timeframes: ['H1'],
      lookbackPeriod: 30,
      minDataPoints: 20,
      updateFrequency: 24,
      dynamicThreshold: false,
      groupByCurrency: true
    };
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid filter parameter' },
      { status: 400 }
    );
  }
  
  try {
    // Get existing positions (mock data)
    const existingPositions = getMockExistingPositions();
    
    // Generate mock correlation matrix
    const pairsToAnalyze = [
      symbol,
      ...correlationFilter.checkPairs,
      ...getRecommendedPairs(symbol, correlationFilter.checkPairs)
    ].slice(0, 20);
    
    const priceData: Record<string, any[]> = {};
    for (const pair of pairsToAnalyze) {
      priceData[pair] = generateMockPriceData(pair, correlationFilter.lookbackPeriod);
    }
    
    const correlationMatrix = await calculateCorrelationMatrix(
      pairsToAnalyze,
      priceData,
      correlationFilter.timeframes[0] || 'H1',
      correlationFilter.lookbackPeriod,
      correlationFilter.minDataPoints
    );
    
    // Analyze correlation for the signal
    const analysisResult = analyzeCorrelationForSignal(
      symbol,
      existingPositions,
      correlationMatrix,
      correlationFilter
    );
    
    return NextResponse.json({
      success: true,
      data: analysisResult
    });
  } catch (error) {
    console.error('Error analyzing correlation:', error);
    return NextResponse.json(
      { error: 'Failed to analyze correlation' },
      { status: 500 }
    );
  }
}

async function handleGetHistoricalCorrelation(searchParams: URLSearchParams): Promise<NextResponse> {
  const symbol1 = searchParams.get('symbol1');
  const symbol2 = searchParams.get('symbol2');
  const timeframe = searchParams.get('timeframe') || 'D1';
  const lookbackPeriod = parseInt(searchParams.get('lookbackPeriod') || '30');
  
  if (!symbol1 || !symbol2) {
    return NextResponse.json(
      { error: 'Both symbol1 and symbol2 parameters are required' },
      { status: 400 }
    );
  }
  
  try {
    // Generate mock historical correlation data
    const historicalCorrelation = getMockHistoricalCorrelation(symbol1, symbol2);
    
    return NextResponse.json({
      success: true,
      data: historicalCorrelation
    });
  } catch (error) {
    console.error('Error getting historical correlation:', error);
    return NextResponse.json(
      { error: 'Failed to get historical correlation' },
      { status: 500 }
    );
  }
}

async function handleGetRecommendations(searchParams: URLSearchParams): Promise<NextResponse> {
  const symbol = searchParams.get('symbol');
  const allPairsJson = searchParams.get('allPairs');
  
  if (!symbol) {
    return NextResponse.json(
      { error: 'Symbol parameter is required' },
      { status: 400 }
    );
  }
  
  let allPairs: string[];
  try {
    allPairs = allPairsJson ? JSON.parse(allPairsJson) : [
      'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
      'EURJPY', 'GBPJPY', 'EURGBP', 'AUDJPY', 'EURAUD', 'EURCHF',
      'AUDNZD', 'NZDJPY', 'GBPAUD', 'GBPCAD', 'GBPNZD', 'AUDCAD'
    ];
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid allPairs parameter' },
      { status: 400 }
    );
  }
  
  try {
    const recommendedPairs = getRecommendedPairs(symbol, allPairs);
    
    return NextResponse.json({
      success: true,
      data: {
        symbol,
        recommendedPairs,
        count: recommendedPairs.length
      }
    });
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to get recommendations' },
      { status: 500 }
    );
  }
}

async function handleGetCurrencyGroups(searchParams: URLSearchParams): Promise<NextResponse> {
  const pairsJson = searchParams.get('pairs');
  
  let pairs: string[];
  try {
    pairs = pairsJson ? JSON.parse(pairsJson) : [
      'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
      'EURJPY', 'GBPJPY', 'EURGBP', 'AUDJPY', 'EURAUD', 'EURCHF',
      'AUDNZD', 'NZDJPY', 'GBPAUD', 'GBPCAD', 'GBPNZD', 'AUDCAD'
    ];
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid pairs parameter' },
      { status: 400 }
    );
  }
  
  try {
    const currencyGroups = groupPairsByCurrency(pairs);
    
    return NextResponse.json({
      success: true,
      data: currencyGroups
    });
  } catch (error) {
    console.error('Error getting currency groups:', error);
    return NextResponse.json(
      { error: 'Failed to get currency groups' },
      { status: 500 }
    );
  }
}

async function handleValidateFilter(searchParams: URLSearchParams): Promise<NextResponse> {
  const filterJson = searchParams.get('filter');
  
  if (!filterJson) {
    return NextResponse.json(
      { error: 'Filter parameter is required' },
      { status: 400 }
    );
  }
  
  let correlationFilter: CorrelationFilter;
  try {
    correlationFilter = JSON.parse(filterJson);
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid filter parameter' },
      { status: 400 }
    );
  }
  
  try {
    const validationErrors = validateCorrelationFilter(correlationFilter);
    
    return NextResponse.json({
      success: true,
      data: {
        valid: validationErrors.length === 0,
        errors: validationErrors
      }
    });
  } catch (error) {
    console.error('Error validating filter:', error);
    return NextResponse.json(
      { error: 'Failed to validate filter' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    switch (action) {
      case 'calculate-dynamic-thresholds':
        return await handleCalculateDynamicThresholds(body);
      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Correlation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleCalculateDynamicThresholds(body: any): Promise<NextResponse> {
  const { correlationMatrix, volatilityData, baseThreshold } = body;
  
  if (!correlationMatrix || !volatilityData) {
    return NextResponse.json(
      { error: 'Correlation matrix and volatility data are required' },
      { status: 400 }
    );
  }
  
  try {
    const thresholds = calculateDynamicThresholds(
      correlationMatrix,
      volatilityData,
      baseThreshold || 0.7
    );
    
    return NextResponse.json({
      success: true,
      data: thresholds
    });
  } catch (error) {
    console.error('Error calculating dynamic thresholds:', error);
    return NextResponse.json(
      { error: 'Failed to calculate dynamic thresholds' },
      { status: 500 }
    );
  }
}