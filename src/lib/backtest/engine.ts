import { MarketData, BacktestResult, Strategy } from '../../types';
import TwelveData from 'twelvedata';
import { marketDataCache, CacheKey } from '../cache/market-data-cache';

// Initialize TwelveData client
const twelveDataClient = new TwelveData({
  apikey: process.env.TWELVEDATA_API_KEY || '',
});

// Enhanced market data interface
interface EnhancedMarketData extends MarketData {
  currency?: string;
  exchange?: string;
}

// Historical data fetcher with multiple sources
export class HistoricalDataFetcher {
  static async fetchFromTwelveData(symbol: string, interval: string, startDate: Date, endDate: Date): Promise<EnhancedMarketData[]> {
    // Check cache first
    const cacheKey: CacheKey = {
      symbol,
      interval,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      source: 'twelvedata',
    };

    const cachedData = await marketDataCache.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    try {
      console.log(`📡 Fetching from TwelveData: ${symbol} ${interval} ${cacheKey.startDate} to ${cacheKey.endDate}`);
      
      const response = await twelveDataClient.timeSeries({
        symbol,
        interval,
        start_date: cacheKey.startDate,
        end_date: cacheKey.endDate,
        outputsize: 5000,
      });

      if (!response.values) return [];

      const data = response.values.map(chart => ({
        timestamp: new Date(chart.datetime),
        open: parseFloat(chart.open),
        high: parseFloat(chart.high),
        low: parseFloat(chart.low),
        close: parseFloat(chart.close),
        volume: parseInt(chart.volume || '0'),
        symbol,
        interval,
        currency: chart.currency || 'USD',
        exchange: chart.exchange || 'FX',
      }));

      // Cache the fetched data
      if (data.length > 0) {
        await marketDataCache.set(cacheKey, data, 'twelvedata');
      }

      return data;
    } catch (error) {
      console.error('TwelveData fetch error:', error);
      return [];
    }
  }

  static async fetchFromYahooFinance(symbol: string, interval: string, startDate: Date, endDate: Date): Promise<EnhancedMarketData[]> {
    // Check cache first
    const cacheKey: CacheKey = {
      symbol,
      interval,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      source: 'yahoo',
    };

    const cachedData = await marketDataCache.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // Try the Yahoo Finance package first (if it works)
    try {
      console.log(`📡 Fetching from Yahoo Finance: ${symbol} ${interval} ${cacheKey.startDate} to ${cacheKey.endDate}`);
      
      const yahooFinance = (await import('yahoo-finance2')).default;
      
      const yahooInterval = this.convertIntervalToYahoo(interval);
      const period1 = Math.floor(startDate.getTime() / 1000);
      const period2 = Math.floor(endDate.getTime() / 1000);

      const result = await yahooFinance.chart(symbol, {
        period1,
        period2,
        interval: yahooInterval,
      });

      if (result.quotes) {
        const data = result.quotes.map(quote => ({
          timestamp: new Date(quote.date),
          open: quote.open,
          high: quote.high,
          low: quote.low,
          close: quote.close,
          volume: quote.volume || 0,
          symbol,
          interval,
          currency: 'USD',
          exchange: 'YAHOO',
        }));

        // Cache the fetched data
        if (data.length > 0) {
          await marketDataCache.set(cacheKey, data, 'yahoo');
        }

        return data;
      }
    } catch (error) {
      console.log('Yahoo Finance package failed, trying RapidAPI...');
    }

    // Fallback to RapidAPI Yahoo Finance
    try {
      const apiKey = process.env.YAHOO_FINANCE_API_KEY;
      const rapidApiHost = process.env.YAHOO_FINANCE_RAPIDAPI_HOST;
      
      if (!apiKey || !rapidApiHost) {
        console.log('Yahoo Finance RapidAPI credentials not found');
        return [];
      }

      // Convert symbol for Yahoo Finance format
      const yahooSymbol = symbol.replace('/', '');
      const url = `https://${rapidApiHost}/market/v2/get-chart?region=US&lang=en&symbol=${yahooSymbol}&interval=${interval}&period1=${Math.floor(startDate.getTime() / 1000)}&period2=${Math.floor(endDate.getTime() / 1000)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': rapidApiHost,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.chart?.result?.[0]?.timestamp && data.chart?.result?.[0]?.indicators?.quote?.[0]) {
        const timestamps = data.chart.result[0].timestamp;
        const quotes = data.chart.result[0].indicators.quote[0];
        
        const marketData = timestamps.map((timestamp: number, index: number) => ({
          timestamp: new Date(timestamp * 1000),
          open: quotes.open?.[index] || 0,
          high: quotes.high?.[index] || 0,
          low: quotes.low?.[index] || 0,
          close: quotes.close?.[index] || 0,
          volume: quotes.volume?.[index] || 0,
          symbol,
          interval,
          currency: 'USD',
          exchange: 'YAHOO_RAPIDAPI',
        })).filter(candle => candle.close > 0); // Filter out invalid candles

        // Cache the fetched data
        if (marketData.length > 0) {
          await marketDataCache.set(cacheKey, marketData, 'yahoo_rapidapi');
        }

        return marketData;
      }
      
      return [];
    } catch (error) {
      console.error('Yahoo Finance RapidAPI fetch error:', error);
      return [];
    }
  }

  private static convertIntervalToYahoo(interval: string): string {
    const intervalMap: Record<string, string> = {
      '1min': '1m',
      '5min': '5m',
      '15min': '15m',
      '30min': '30m',
      '1h': '1h',
      '4h': '1d',
      '1d': '1d',
      '1w': '1wk',
    };
    return intervalMap[interval] || '1d';
  }

  // Sample data generation removed - only real market data allowed
  static generateSampleData(symbol: string, interval: string, startDate: Date, endDate: Date): EnhancedMarketData[] {
    throw new Error(`Sample data generation disabled. Real market data is required for ${symbol} ${interval} from ${startDate.toISOString()} to ${endDate.toISOString()}. Please ensure TwelveData and/or Yahoo Finance APIs are properly configured.`);
  }
}

// Main backtesting engine
export class BacktestEngine {
  private data: EnhancedMarketData[] = [];
  private balance: number;
  private equity: number = 0;
  private positions: any[] = [];
  private trades: any[] = [];
  private equityCurve: { timestamp: Date; equity: number }[] = [];

  constructor(initialBalance: number = 10000) {
    this.balance = initialBalance;
    this.equity = initialBalance;
  }

  async loadData(
    symbol: string,
    interval: string,
    startDate: Date,
    endDate: Date,
    preferredSource: 'twelvedata' | 'yahoo' = 'twelvedata'
  ): Promise<void> {
    // Try preferred source first, then fallback to the other
    let data: EnhancedMarketData[] = [];

    if (preferredSource === 'twelvedata') {
      data = await HistoricalDataFetcher.fetchFromTwelveData(symbol, interval, startDate, endDate);
      if (data.length === 0) {
        data = await HistoricalDataFetcher.fetchFromYahooFinance(symbol, interval, startDate, endDate);
      }
    } else if (preferredSource === 'yahoo') {
      data = await HistoricalDataFetcher.fetchFromYahooFinance(symbol, interval, startDate, endDate);
      if (data.length === 0) {
        data = await HistoricalDataFetcher.fetchFromTwelveData(symbol, interval, startDate, endDate);
      }
    }

    // No fallback to sample data - throw error if no data available
    if (data.length === 0) {
      throw new Error(`Failed to fetch real market data for ${symbol} from both TwelveData and Yahoo Finance APIs. Please check your API keys and internet connection.`);
    }

    console.log(`✅ Successfully loaded ${data.length} data points for ${symbol} from real market data sources`);

    // Sort by timestamp and store
    this.data = data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private applyStrategy(strategy: Strategy, data: EnhancedMarketData, index: number): void {
    const { rules } = strategy;
    
    // Simple strategy execution based on rules
    rules.forEach(rule => {
      const { conditions, action } = rule;
      
      let shouldExecute = true;
      
      // Check all conditions
      conditions.forEach(condition => {
        const { indicator, operator, value, timeframes } = condition;
        
        if (!timeframes.includes(timeframes[0])) {
          shouldExecute = false;
          return;
        }

        const currentValue = this.calculateIndicator(indicator, data, index);
        
        switch (operator) {
          case 'gt':
            if (!(currentValue > value)) shouldExecute = false;
            break;
          case 'lt':
            if (!(currentValue < value)) shouldExecute = false;
            break;
          case 'eq':
            if (!(Math.abs(currentValue - value) < 0.0001)) shouldExecute = false;
            break;
          case 'gte':
            if (!(currentValue >= value)) shouldExecute = false;
            break;
          case 'lte':
            if (!(currentValue <= value)) shouldExecute = false;
            break;
        }
      });

      if (shouldExecute) {
        this.executeAction(action, data);
      }
    });
  }

  private calculateIndicator(indicator: string, data: EnhancedMarketData[], index: number): number {
    switch (indicator) {
      case 'price':
        return data[index].close;
      case 'sma_20':
        return this.calculateSMA(data, index, 20);
      case 'sma_50':
        return this.calculateSMA(data, index, 50);
      case 'ema_12':
        return this.calculateEMA(data, index, 12);
      case 'ema_26':
        return this.calculateEMA(data, index, 26);
      case 'rsi':
        return this.calculateRSI(data, index, 14);
      default:
        return data[index].close;
    }
  }

  private calculateSMA(data: EnhancedMarketData[], index: number, period: number): number {
    if (index < period - 1) return data[index].close;
    
    let sum = 0;
    for (let i = index - period + 1; i <= index; i++) {
      sum += data[i].close;
    }
    return sum / period;
  }

  private calculateEMA(data: EnhancedMarketData[], index: number, period: number): number {
    if (index === 0) return data[index].close;
    
    const multiplier = 2 / (period + 1);
    const previousEMA = this.calculateEMA(data, index - 1, period);
    return (data[index].close - previousEMA) * multiplier + previousEMA;
  }

  private calculateRSI(data: EnhancedMarketData[], index: number, period: number): number {
    if (index < period) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = index - period + 1; i <= index; i++) {
      const change = data[i].close - data[i - 1].close;
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private executeAction(action: any, data: EnhancedMarketData): void {
    const { type, parameters } = action;
    
    switch (type) {
      case 'buy':
        this.openPosition('buy', parameters.size || 0.01, data.close, data.timestamp);
        break;
      case 'sell':
        this.openPosition('sell', parameters.size || 0.01, data.close, data.timestamp);
        break;
      case 'close':
        this.closePosition(data.close, data.timestamp);
        break;
    }
  }

  private openPosition(type: 'buy' | 'sell', size: number, price: number, timestamp: Date): void {
    if (this.positions.length >= 1) return; // Limit to 1 open position for simplicity
    
    this.positions.push({
      type,
      size,
      openPrice: price,
      openTime: timestamp,
      currentPrice: price,
    });
  }

  private closePosition(price: number, timestamp: Date): void {
    if (this.positions.length === 0) return;
    
    const position = this.positions.pop();
    if (!position) return;
    
    const pipValue = 0.0001;
    let profit = 0;
    
    if (position.type === 'buy') {
      profit = (price - position.openPrice) / pipValue * position.size * 10;
    } else {
      profit = (position.openPrice - price) / pipValue * position.size * 10;
    }
    
    this.balance += profit;
    
    this.trades.push({
      type: position.type,
      size: position.size,
      openPrice: position.openPrice,
      closePrice: price,
      openTime: position.openTime,
      closeTime: timestamp,
      profit,
      duration: timestamp.getTime() - position.openTime.getTime(),
    });
  }

  private updateEquity(currentPrice: number, timestamp: Date): void {
    let unrealizedPnL = 0;
    
    this.positions.forEach(position => {
      const pipValue = 0.0001;
      let positionProfit = 0;
      
      if (position.type === 'buy') {
        positionProfit = (currentPrice - position.openPrice) / pipValue * position.size * 10;
      } else {
        positionProfit = (position.openPrice - currentPrice) / pipValue * position.size * 10;
      }
      
      unrealizedPnL += positionProfit;
    });
    
    this.equity = this.balance + unrealizedPnL;
    this.equityCurve.push({ timestamp, equity: this.equity });
  }

  async runBacktest(strategy: Strategy): Promise<BacktestResult> {
    if (this.data.length === 0) {
      throw new Error('No data loaded for backtesting');
    }

    const initialBalance = this.balance;
    
    // Run strategy through all data points
    for (let i = 0; i < this.data.length; i++) {
      const candle = this.data[i];
      
      // Apply strategy rules
      this.applyStrategy(strategy, candle, i);
      
      // Update equity
      this.updateEquity(candle.close, candle.timestamp);
    }
    
    // Close any remaining positions at the end
    if (this.positions.length > 0) {
      const lastCandle = this.data[this.data.length - 1];
      this.closePosition(lastCandle.close, lastCandle.timestamp);
    }
    
    // Calculate statistics
    const totalReturn = this.balance - initialBalance;
    const returnPercentage = (totalReturn / initialBalance) * 100;
    
    const winningTrades = this.trades.filter(trade => trade.profit > 0);
    const losingTrades = this.trades.filter(trade => trade.profit <= 0);
    
    const winRate = this.trades.length > 0 ? (winningTrades.length / this.trades.length) * 100 : 0;
    const averageWin = winningTrades.length > 0 
      ? winningTrades.reduce((sum, trade) => sum + trade.profit, 0) / winningTrades.length 
      : 0;
    const averageLoss = losingTrades.length > 0 
      ? losingTrades.reduce((sum, trade) => sum + Math.abs(trade.profit), 0) / losingTrades.length 
      : 0;
    
    // Calculate maximum drawdown
    let maxDrawdown = 0;
    let peakEquity = initialBalance;
    
    this.equityCurve.forEach(point => {
      if (point.equity > peakEquity) {
        peakEquity = point.equity;
      }
      const drawdown = peakEquity - point.equity;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });
    
    const maxDrawdownPercentage = (maxDrawdown / peakEquity) * 100;
    
    // Calculate profit factor
    const totalProfit = winningTrades.reduce((sum, trade) => sum + trade.profit, 0);
    const totalLoss = losingTrades.reduce((sum, trade) => sum + Math.abs(trade.profit), 0);
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
    
    return {
      id: `bt_${Date.now()}`,
      strategyId: strategy.id,
      status: 'completed',
      startDate: this.data[0].timestamp,
      endDate: this.data[this.data.length - 1].timestamp,
      initialBalance,
      finalBalance: this.balance,
      totalReturn,
      returnPercentage,
      maxDrawdown: maxDrawdownPercentage,
      winRate,
      totalTrades: this.trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      averageWin,
      averageLoss,
      profitFactor,
      sharpeRatio: this.calculateSharpeRatio(),
      trades: this.trades.map(trade => ({
        id: `trade_${Date.now()}_${Math.random()}`,
        ...trade,
      })),
      equityCurve: this.equityCurve,
      metadata: {
        dataSource: 'twelvedata_yahoo_finance',
        totalDataPoints: this.data.length,
        executionTime: new Date(),
      },
    };
  }

  private calculateSharpeRatio(): number {
    if (this.equityCurve.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < this.equityCurve.length; i++) {
      const returnRate = (this.equityCurve[i].equity - this.equityCurve[i - 1].equity) / this.equityCurve[i - 1].equity;
      returns.push(returnRate);
    }
    
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized Sharpe Ratio
  }
}

// Main running function
export async function runBacktest(strategyId: string, params: {
  startDate: Date;
  endDate: Date;
  initialBalance: number;
  symbol: string;
  interval: string;
  strategy: Strategy;
  preferredDataSource?: 'twelvedata' | 'yahoo';
}): Promise<BacktestResult> {
  const engine = new BacktestEngine(params.initialBalance);
  
  await engine.loadData(
    params.symbol,
    params.interval,
    params.startDate,
    params.endDate,
    params.preferredDataSource || 'twelvedata'
  );
  
  return await engine.runBacktest(params.strategy);
}
