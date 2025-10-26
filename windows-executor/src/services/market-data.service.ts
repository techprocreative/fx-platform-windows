/**
 * Market Data Service
 * Fetches market data from MT5 via ZeroMQ
 */

import { logger } from '../utils/logger';
import { SymbolMapper } from '../utils/symbol-mapper';
import { Timeframe } from '../types/strategy.types';
import { Bar, MarketData } from './indicator.service';

export class MarketDataService {
  
  constructor(private zeromqService: any) {
    logger.info('[MarketDataService] Initialized');
  }

  /**
   * Get market data for symbol and timeframe
   */
  async getMarketData(
    symbol: string,
    timeframe: Timeframe,
    bars: number = 100
  ): Promise<MarketData> {
    
    try {
      // Map platform symbol to MT5 broker symbol
      const mt5Symbol = SymbolMapper.toMT5Symbol(symbol);
      
      if (mt5Symbol !== symbol) {
        logger.debug(`[MarketDataService] Symbol mapped: ${symbol} -> ${mt5Symbol}`);
      }
      
      logger.debug(`[MarketDataService] Fetching ${bars} bars for ${mt5Symbol} ${timeframe}`);
      
      // Request from MT5 via ZeroMQ
      const request = {
        command: 'GET_BARS',
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        parameters: {
          symbol: mt5Symbol,  // Use mapped symbol for MT5
          timeframe,
          bars
        }
      };
      
      // Send request to MT5 via ZeroMQ client (port 5556)
      const response = await this.zeromqService.sendRequest(request, 5000);
      
      if (!response || response.status !== 'OK') {
        logger.warn(`[MarketDataService] Failed to get bars: ${response?.error || 'Unknown error'}`);
        return {
          symbol,
          timeframe,
          bars: []
        };
      }
      
      // Parse bars data
      const barData: Bar[] = (response.data?.bars || []).map((b: any) => ({
        time: new Date(b.time * 1000), // Convert unix timestamp to Date
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume
      }));
      
      const marketData: MarketData = {
        symbol,
        timeframe,
        bars: barData
      };
      
      logger.debug(`[MarketDataService] Retrieved ${barData.length} bars for ${symbol}`);
      return marketData;
      
    } catch (error) {
      logger.error('[MarketDataService] Failed to get market data:', error);
      return {
        symbol,
        timeframe,
        bars: []
      };
    }
  }

  /**
   * Get latest market data (alias for getMarketData)
   * Used by strategy-monitor for consistency
   */
  async getLatestData(
    symbol: string,
    timeframe: Timeframe,
    bars: number = 100
  ): Promise<Bar[]> {
    const marketData = await this.getMarketData(symbol, timeframe, bars);
    return marketData.bars;
  }

  /**
   * Get current price for symbol
   */
  async getCurrentPrice(symbol: string): Promise<{ bid: number; ask: number } | null> {
    try {
      const request = {
        command: 'GET_PRICE',
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        parameters: { symbol }
      };
      
      const response = await this.zeromqService.sendRequest(request, 3000);
      
      if (!response || response.status !== 'OK') {
        logger.warn(`[MarketDataService] Failed to get price: ${response?.error || 'Unknown error'}`);
        return null;
      }
      
      return {
        bid: response.data?.bid || 0,
        ask: response.data?.ask || 0
      };
      
    } catch (error) {
      logger.error('[MarketDataService] Failed to get current price:', error);
      return null;
    }
  }

  /**
   * Subscribe to tick updates
   */
  subscribeToSymbol(symbol: string, callback: (tick: any) => void): void {
    // TODO: Set up tick subscription via ZeroMQ
    logger.info(`[MarketDataService] Subscribed to ${symbol}`);
  }

  /**
   * Unsubscribe from tick updates
   */
  unsubscribeFromSymbol(symbol: string): void {
    logger.info(`[MarketDataService] Unsubscribed from ${symbol}`);
  }

  /**
   * Get symbol information (spread, point, etc)
   */
  async getSymbolInfo(symbol: string): Promise<{
    symbol: string;
    bid: number;
    ask: number;
    spread: number;
    point: number;
  }> {
    try {
      // Get current price first
      const priceData = await this.getCurrentPrice(symbol);
      
      if (!priceData) {
        // Return default values if price not available
        return {
          symbol,
          bid: 0,
          ask: 0,
          spread: 0,
          point: 0.0001
        };
      }
      
      // Calculate spread
      const spread = priceData.ask - priceData.bid;
      
      // Determine point value based on symbol
      // For XAUUSD, XAGUSD: point = 0.01
      // For forex pairs: point = 0.0001 (or 0.01 for JPY pairs)
      let point = 0.0001;
      if (symbol.includes('XAU') || symbol.includes('XAG')) {
        point = 0.01;
      } else if (symbol.includes('JPY')) {
        point = 0.01;
      }
      
      return {
        symbol,
        bid: priceData.bid,
        ask: priceData.ask,
        spread,
        point
      };
      
    } catch (error) {
      logger.error(`[MarketDataService] Error getting symbol info for ${symbol}:`, error);
      
      // Return default values
      return {
        symbol,
        bid: 0,
        ask: 0,
        spread: 0,
        point: 0.0001
      };
    }
  }
}
