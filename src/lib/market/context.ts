/**
 * Market Context Provider for Enhanced AI Strategy Generation
 * 
 * This module provides real-time market context data including:
 * - Current volatility (ATR)
 * - Trend direction
 * - Key support/resistance levels
 * - Market session information
 * - Optimal trading conditions
 */

import { getCurrentSessionContext, getOptimalPairsForCurrentSessions } from './sessions';

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

  constructor() {
    this.cache = new Map();
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

    // Get market data (mock implementation - in production, this would fetch from real data source)
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
   * Get market data for analysis (mock implementation)
   */
  private async getMarketData(symbol: string, timeframe: string, periods: number): Promise<any[]> {
    // In production, this would fetch from Yahoo Finance, broker API, or other data source
    // For now, return mock data that looks realistic
    
    const basePrice = symbol.includes('JPY') ? 150 : 1.1;
    const volatility = symbol.includes('JPY') ? 0.5 : 0.01;
    
    const data = [];
    let currentPrice = basePrice;
    
    for (let i = 0; i < periods; i++) {
      const change = (Math.random() - 0.5) * volatility;
      currentPrice = Math.max(0.0001, currentPrice + change);
      
      data.push({
        timestamp: new Date(Date.now() - (periods - i) * 60 * 60 * 1000), // 1-hour candles
        open: currentPrice,
        high: currentPrice * (1 + Math.random() * volatility * 0.5),
        low: currentPrice * (1 - Math.random() * volatility * 0.5),
        close: currentPrice,
        volume: Math.floor(Math.random() * 10000) + 1000
      });
    }
    
    return data;
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