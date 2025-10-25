/**
 * Market Context Provider for Enhanced AI Strategy Generation
 * 
 * This module provides real-time market context data using Yahoo Finance including:
 * - Current volatility (ATR) - calculated from real historical data
 * - Trend direction - analyzed from real price movements
 * - Key support/resistance levels - identified from actual price swings
 * - Market session information - from current time and trading hours
 * - Optimal trading conditions - based on session analysis
 * 
 * Data Source: Yahoo Finance (via yahoo-finance2 package - no API key required)
 * Cache TTL: 5 minutes
 */

import { getCurrentSessionContext, getOptimalPairsForCurrentSessions } from './sessions';
import YahooFinance from 'yahoo-finance2';
import { convertToProviderSymbol } from '../data-providers/common/symbol-mapper';

export interface OHLCV {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketContext {
  symbol: string;
  timeframe: string;
  volatility: {
    currentATR: number;
    atrPeriod: number;
    volatilityLevel: 'low' | 'medium' | 'high';
    historicalAverage: number;
  };
  trend: {
    direction: 'bullish' | 'bearish' | 'sideways';
    strength: number; // 0-100
    timeframe: string;
  };
  keyLevels: {
    support: number[];
    resistance: number[];
    nearestSupport?: number;
    nearestResistance?: number;
  };
  session: {
    activeSessions: string[];
    isOptimalForPair: boolean;
    marketCondition: 'low' | 'medium' | 'high';
    recommendedPairs: string[];
  };
  price: {
    current: number;
    change24h: number;
    changePercent: number;
  };
  timestamp: Date;
}

export interface MarketContextRequest {
  symbol: string;
  timeframe: string;
  atrPeriod?: number;
  lookbackPeriods?: number;
}

/**
 * Market Context Provider Class
 */
export class MarketContextProvider {
  private cache: Map<string, { context: MarketContext; timestamp: Date }>;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical'] });

  constructor() {
    this.cache = new Map();
    console.log('✅ Market Context: Using yahoo-finance2 package (no API key required)');
  }

  /**
   * Get comprehensive market context for a symbol and timeframe
   */
  async getMarketContext(request: MarketContextRequest): Promise<MarketContext> {
    const cacheKey = `${request.symbol}-${request.timeframe}`;
    const cached = this.cache.get(cacheKey);

    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp.getTime() < this.CACHE_TTL) {
      return cached.context;
    }

    try {
      const context = await this.buildMarketContext(request);
      
      // Cache the result
      this.cache.set(cacheKey, {
        context,
        timestamp: new Date()
      });

      return context;
    } catch (error) {
      console.error('Failed to build market context:', error);
      throw new Error(`Market context unavailable for ${request.symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build comprehensive market context
   */
  private async buildMarketContext(request: MarketContextRequest): Promise<MarketContext> {
    const { symbol, timeframe, atrPeriod = 14, lookbackPeriods = 100 } = request;

    // Get real market data from Yahoo Finance
    const marketData = await this.getMarketData(symbol, timeframe, lookbackPeriods);
    
    // Calculate ATR for volatility
    const currentATR = this.calculateATR(marketData, atrPeriod);
    const historicalATR = this.calculateHistoricalATR(marketData, atrPeriod);
    const volatilityLevel = this.classifyVolatility(currentATR, historicalATR);

    // Analyze trend
    const trend = this.analyzeTrend(marketData, timeframe);

    // Find key levels
    const keyLevels = this.findKeyLevels(marketData);

    // Get session context
    const sessionContext = getCurrentSessionContext();
    const isOptimalForPair = sessionContext.isOptimalForPairs[symbol] || false;

    // Get current price information
    const currentPrice = marketData[marketData.length - 1].close;
    const price24hAgo = marketData[Math.max(0, marketData.length - 24)].close;
    const change24h = currentPrice - price24hAgo;
    const changePercent = (change24h / price24hAgo) * 100;

    return {
      symbol,
      timeframe,
      volatility: {
        currentATR,
        atrPeriod,
        volatilityLevel,
        historicalAverage: historicalATR
      },
      trend,
      keyLevels,
      session: {
        activeSessions: sessionContext.activeSessions,
        isOptimalForPair,
        marketCondition: sessionContext.marketCondition,
        recommendedPairs: sessionContext.recommendedPairs
      },
      price: {
        current: currentPrice,
        change24h,
        changePercent
      },
      timestamp: new Date()
    };
  }

  /**
   * Get real market data from Yahoo Finance using yahoo-finance2 package
   */
  private async getMarketData(symbol: string, timeframe: string, periods: number): Promise<OHLCV[]> {
    try {
      // Convert symbol to Yahoo Finance format
      const yahooSymbol = this.convertSymbolToYahooFormat(symbol);
      
      // Calculate date range based on timeframe and periods
      const { period1, period2, interval } = this.calculateDateRange(timeframe, periods);
      
      console.log(`📊 Fetching ${periods} candles for ${yahooSymbol} (${timeframe}) from Yahoo Finance...`);
      
      // Fetch historical data using yahoo-finance2 chart method
      const result = await this.yahooFinance.chart(yahooSymbol, {
        period1,
        period2,
        interval: interval as '1m' | '2m' | '5m' | '15m' | '30m' | '60m' | '90m' | '1h' | '1d' | '5d' | '1wk' | '1mo' | '3mo'
      });

      if (!result || !result.quotes || result.quotes.length === 0) {
        throw new Error(`No historical data available for ${symbol}`);
      }

      // Convert to OHLCV format
      const ohlcvData: OHLCV[] = result.quotes.map(quote => ({
        timestamp: new Date(quote.date),
        open: quote.open,
        high: quote.high,
        low: quote.low,
        close: quote.close,
        volume: quote.volume
      }));

      console.log(`✅ Fetched ${ohlcvData.length} real candles for ${symbol} from Yahoo Finance`);
      
      return ohlcvData;
    } catch (error) {
      console.error(`❌ Failed to fetch market data for ${symbol}:`, error);
      throw new Error(`Failed to fetch market data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert symbol to Yahoo Finance format using centralized mapper
   */
  private convertSymbolToYahooFormat(symbol: string): string {
    // Use centralized symbol mapper for comprehensive symbol support
    const yahooSymbol = convertToProviderSymbol(symbol, 'yahooFinance');
    console.log(`🔄 Symbol conversion: ${symbol} → ${yahooSymbol}`);
    return yahooSymbol;
  }

  /**
   * Calculate date range and interval for Yahoo Finance
   */
  private calculateDateRange(timeframe: string, periods: number): { period1: Date; period2: Date; interval: string } {
    const period2 = new Date(); // Current time
    
    // Map timeframes to intervals and calculate period1
    const timeframeMap: Record<string, { interval: string; durationMs: number }> = {
      'M1': { interval: '1m', durationMs: 60 * 1000 },
      'M5': { interval: '5m', durationMs: 5 * 60 * 1000 },
      'M15': { interval: '15m', durationMs: 15 * 60 * 1000 },
      'M30': { interval: '30m', durationMs: 30 * 60 * 1000 },
      'H1': { interval: '1h', durationMs: 60 * 60 * 1000 },
      'H4': { interval: '1h', durationMs: 4 * 60 * 60 * 1000 }, // Yahoo doesn't have 4h, use 1h
      'D1': { interval: '1d', durationMs: 24 * 60 * 60 * 1000 },
      'W1': { interval: '1wk', durationMs: 7 * 24 * 60 * 60 * 1000 },
      'MN1': { interval: '1mo', durationMs: 30 * 24 * 60 * 60 * 1000 },
    };

    const tf = timeframeMap[timeframe] || timeframeMap['H1'];
    const totalDuration = tf.durationMs * periods * 1.5; // Add 50% buffer to ensure enough data
    const period1 = new Date(period2.getTime() - totalDuration);

    return {
      period1,
      period2,
      interval: tf.interval
    };
  }

  /**
   * Calculate Average True Range (ATR)
   */
  private calculateATR(data: any[], period: number): number {
    if (data.length < period + 1) return 0;

    let sumTR = 0;
    for (let i = 1; i <= period; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const prevClose = data[i - 1].close;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      
      sumTR += tr;
    }
    
    return sumTR / period;
  }

  /**
   * Calculate historical average ATR
   */
  private calculateHistoricalATR(data: any[], period: number): number {
    const atrValues = [];
    
    for (let i = period + 1; i < data.length; i++) {
      const slice = data.slice(i - period - 1, i + 1);
      const atr = this.calculateATR(slice, period);
      atrValues.push(atr);
    }
    
    return atrValues.length > 0 ? atrValues.reduce((a, b) => a + b, 0) / atrValues.length : 0;
  }

  /**
   * Classify volatility level
   */
  private classifyVolatility(currentATR: number, historicalATR: number): 'low' | 'medium' | 'high' {
    if (historicalATR === 0) return 'medium';
    
    const ratio = currentATR / historicalATR;
    
    if (ratio < 0.8) return 'low';
    if (ratio > 1.2) return 'high';
    return 'medium';
  }

  /**
   * Analyze trend direction and strength
   */
  private analyzeTrend(data: any[], timeframe: string): MarketContext['trend'] {
    const prices = data.map(d => d.close);
    const sma20 = this.calculateSMA(prices, 20);
    const sma50 = this.calculateSMA(prices, 50);
    
    const currentPrice = prices[prices.length - 1];
    const sma20Current = sma20[sma20.length - 1];
    const sma50Current = sma50[sma50.length - 1];
    
    let direction: 'bullish' | 'bearish' | 'sideways';
    let strength: number;
    
    if (currentPrice > sma20Current && sma20Current > sma50Current) {
      direction = 'bullish';
      strength = Math.min(100, ((currentPrice - sma50Current) / sma50Current) * 1000);
    } else if (currentPrice < sma20Current && sma20Current < sma50Current) {
      direction = 'bearish';
      strength = Math.min(100, ((sma50Current - currentPrice) / sma50Current) * 1000);
    } else {
      direction = 'sideways';
      strength = 100 - Math.abs(currentPrice - sma20Current) / sma20Current * 500;
    }
    
    return {
      direction,
      strength: Math.max(0, Math.min(100, strength)),
      timeframe
    };
  }

  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(prices: number[], period: number): number[] {
    const sma = [];
    
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    
    return sma;
  }

  /**
   * Find key support and resistance levels
   */
  private findKeyLevels(data: any[]): MarketContext['keyLevels'] {
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const currentPrice = data[data.length - 1].close;
    
    // Find swing highs (resistance)
    const resistance = this.findSwingPoints(highs, true, 5);
    
    // Find swing lows (support)
    const support = this.findSwingPoints(lows, false, 5);
    
    // Find nearest levels
    const nearestResistance = resistance
      .filter(r => r > currentPrice)
      .sort((a, b) => a - b)[0];
    
    const nearestSupport = support
      .filter(s => s < currentPrice)
      .sort((a, b) => b - a)[0];
    
    return {
      support,
      resistance,
      nearestSupport,
      nearestResistance
    };
  }

  /**
   * Find swing points in price data
   */
  private findSwingPoints(prices: number[], isHigh: boolean, lookback: number): number[] {
    const swingPoints = [];
    
    for (let i = lookback; i < prices.length - lookback; i++) {
      const current = prices[i];
      const isSwing = isHigh 
        ? prices.slice(i - lookback, i).every(p => p <= current) &&
          prices.slice(i + 1, i + lookback + 1).every(p => p <= current)
        : prices.slice(i - lookback, i).every(p => p >= current) &&
          prices.slice(i + 1, i + lookback + 1).every(p => p >= current);
      
      if (isSwing) {
        swingPoints.push(current);
      }
    }
    
    return swingPoints;
  }

  /**
   * Get formatted market context for AI prompts
   */
  async getFormattedContext(request: MarketContextRequest): Promise<string> {
    const context = await this.getMarketContext(request);
    
    return `
Market Context for ${context.symbol} (${context.timeframe}):
- Current Price: ${context.price.current.toFixed(5)} (${context.price.changePercent >= 0 ? '+' : ''}${context.price.changePercent.toFixed(2)}%)
- Volatility: ${context.volatility.volatilityLevel} (ATR: ${context.volatility.currentATR.toFixed(5)})
- Trend: ${context.trend.direction} (Strength: ${context.trend.strength.toFixed(0)}/100)
- Key Levels: Support ${context.keyLevels.nearestSupport?.toFixed(5) || 'N/A'}, Resistance ${context.keyLevels.nearestResistance?.toFixed(5) || 'N/A'}
- Market Sessions: ${context.session.activeSessions.join(', ')} (${context.session.marketCondition} activity)
- Optimal for ${context.symbol}: ${context.session.isOptimalForPair ? 'YES' : 'NO'}

Session Recommendations:
- Active Sessions: ${context.session.activeSessions.join(', ')}
- Optimal Pairs: ${context.session.recommendedPairs.join(', ')}
- Market Condition: ${context.session.marketCondition} volume
`;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Singleton instance
export const marketContextProvider = new MarketContextProvider();

/**
 * Convenience function to get market context
 */
export async function getMarketContext(symbol: string, timeframe: string): Promise<MarketContext> {
  return marketContextProvider.getMarketContext({ symbol, timeframe });
}

/**
 * Convenience function to get formatted context for AI
 */
export async function getFormattedMarketContext(symbol: string, timeframe: string): Promise<string> {
  return marketContextProvider.getFormattedContext({ symbol, timeframe });
}