import { BacktestResults, Strategy } from "../../types";
import { marketDataCache, CacheKey } from "../cache/market-data-cache";
import YahooFinance from 'yahoo-finance2';

// Symbol-specific pip configuration for accurate calculations
const SYMBOL_CONFIG = {
  // Major Forex Pairs
  EURUSD: { pipMultiplier: 0.0001, minPips: 20, maxPips: 50 },
  GBPUSD: { pipMultiplier: 0.0001, minPips: 20, maxPips: 50 },
  USDJPY: { pipMultiplier: 0.01, minPips: 20, maxPips: 50 },
  USDCHF: { pipMultiplier: 0.0001, minPips: 20, maxPips: 50 },
  AUDUSD: { pipMultiplier: 0.0001, minPips: 20, maxPips: 50 },
  USDCAD: { pipMultiplier: 0.0001, minPips: 20, maxPips: 50 },
  NZDUSD: { pipMultiplier: 0.0001, minPips: 20, maxPips: 50 },

  // Cross Currency Pairs
  EURGBP: { pipMultiplier: 0.0001, minPips: 20, maxPips: 50 },
  EURJPY: { pipMultiplier: 0.01, minPips: 20, maxPips: 50 },
  GBPJPY: { pipMultiplier: 0.01, minPips: 20, maxPips: 50 },
  EURCHF: { pipMultiplier: 0.0001, minPips: 20, maxPips: 50 },
  EURAUD: { pipMultiplier: 0.0001, minPips: 20, maxPips: 50 },
  EURCAD: { pipMultiplier: 0.0001, minPips: 20, maxPips: 50 },
  EURNZD: { pipMultiplier: 0.0001, minPips: 20, maxPips: 50 },
  GBPCHF: { pipMultiplier: 0.0001, minPips: 20, maxPips: 50 },
  GBPAUD: { pipMultiplier: 0.0001, minPips: 20, maxPips: 50 },
  GBPCAD: { pipMultiplier: 0.0001, minPips: 20, maxPips: 50 },
  GBPNZD: { pipMultiplier: 0.0001, minPips: 20, maxPips: 50 },
  AUDJPY: { pipMultiplier: 0.01, minPips: 20, maxPips: 50 },
  AUDNZD: { pipMultiplier: 0.0001, minPips: 20, maxPips: 50 },
  NZDJPY: { pipMultiplier: 0.01, minPips: 20, maxPips: 50 },
  AUDCAD: { pipMultiplier: 0.0001, minPips: 20, maxPips: 50 },
  CADJPY: { pipMultiplier: 0.01, minPips: 20, maxPips: 50 },
  CHFJPY: { pipMultiplier: 0.01, minPips: 20, maxPips: 50 },

  // Commodities
  XAUUSD: { pipMultiplier: 0.1, minPips: 30, maxPips: 100 }, // Gold
  XAGUSD: { pipMultiplier: 0.001, minPips: 50, maxPips: 200 }, // Silver
  USOIL: { pipMultiplier: 0.01, minPips: 20, maxPips: 100 }, // WTI Crude Oil
  UKOIL: { pipMultiplier: 0.01, minPips: 20, maxPips: 100 }, // Brent Crude Oil
  NATGAS: { pipMultiplier: 0.001, minPips: 20, maxPips: 100 }, // Natural Gas
  COPPER: { pipMultiplier: 0.0005, minPips: 50, maxPips: 200 }, // Copper
  PLAT: { pipMultiplier: 0.1, minPips: 30, maxPips: 100 }, // Platinum
  PALLAD: { pipMultiplier: 0.05, minPips: 30, maxPips: 100 }, // Palladium

  // Indices
  US30: { pipMultiplier: 1, minPips: 50, maxPips: 200 }, // Dow Jones
  NAS100: { pipMultiplier: 0.5, minPips: 20, maxPips: 100 }, // NASDAQ
  SPX500: { pipMultiplier: 0.1, minPips: 20, maxPips: 100 }, // S&P 500
  UK100: { pipMultiplier: 1, minPips: 30, maxPips: 150 }, // FTSE 100
  GER40: { pipMultiplier: 1, minPips: 30, maxPips: 150 }, // DAX
  JPN225: { pipMultiplier: 50, minPips: 50, maxPips: 200 }, // Nikkei
  CHN50: { pipMultiplier: 1, minPips: 30, maxPips: 150 }, // China A50
  AUS200: { pipMultiplier: 1, minPips: 20, maxPips: 100 }, // ASX 200
  ESP35: { pipMultiplier: 1, minPips: 30, maxPips: 150 }, // IBEX 35
  FRA40: { pipMultiplier: 1, minPips: 30, maxPips: 150 }, // CAC 40

  // Cryptocurrencies
  BTCUSD: { pipMultiplier: 1, minPips: 100, maxPips: 500 }, // Bitcoin
  ETHUSD: { pipMultiplier: 0.01, minPips: 50, maxPips: 300 }, // Ethereum
  LTCUSD: { pipMultiplier: 0.01, minPips: 50, maxPips: 300 }, // Litecoin
  XRPUSD: { pipMultiplier: 0.0001, minPips: 50, maxPips: 300 }, // Ripple
  BCHUSD: { pipMultiplier: 0.1, minPips: 50, maxPips: 300 }, // Bitcoin Cash
};

// Default pip configuration for unknown symbols
const DEFAULT_PIP_CONFIG = {
  pipMultiplier: 0.0001,
  minPips: 20,
  maxPips: 50,
};

// Get pip configuration for a symbol
export function getPipConfig(symbol: string) {
  return (
    SYMBOL_CONFIG[symbol as keyof typeof SYMBOL_CONFIG] || DEFAULT_PIP_CONFIG
  );
}

// Define BacktestResult interface locally to avoid import issues
interface BacktestResult {
  id: string;
  strategyId: string;
  status: string;
  startDate: Date;
  endDate: Date;
  initialBalance: number;
  finalBalance: number;
  totalReturn: number;
  returnPercentage: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  trades: any[];
  equityCurve: { timestamp: Date; equity: number }[];
  metadata: any;
}

/**
 * Convert symbol to Yahoo Finance API format
 * Yahoo Finance uses different formats for forex, commodities, and indices
 */
function convertSymbolToYahooFormat(symbol: string): string {
  // Remove any spaces
  symbol = symbol.replace(/\s/g, "").toUpperCase();

  // Commodities mapping
  const commodityMap: Record<string, string> = {
    "XAUUSD": "GC=F",      // Gold Futures
    "XAGUSD": "SI=F",      // Silver Futures
    "USOIL": "CL=F",       // WTI Crude Oil Futures
    "UKOIL": "BZ=F",       // Brent Crude Oil Futures
    "NATGAS": "NG=F",      // Natural Gas Futures
    "COPPER": "HG=F",      // Copper Futures
  };

  // Check commodities first
  if (commodityMap[symbol]) {
    return commodityMap[symbol];
  }

  // Forex pairs - add =X suffix
  const forexPairs = [
    "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD",
    "EURGBP", "EURJPY", "GBPJPY", "EURCHF", "EURAUD", "EURCAD", "EURNZD",
    "GBPCHF", "GBPAUD", "GBPCAD", "GBPNZD", "AUDJPY", "AUDNZD", "NZDJPY",
    "AUDCAD", "CADJPY", "CHFJPY"
  ];

  if (forexPairs.includes(symbol)) {
    return `${symbol}=X`;
  }

  // Indices mapping
  const indexMap: Record<string, string> = {
    "US30": "^DJI",       // Dow Jones
    "SPX500": "^GSPC",    // S&P 500
    "NAS100": "^IXIC",    // NASDAQ
    "UK100": "^FTSE",     // FTSE 100
    "GER40": "^GDAXI",    // DAX
    "JPN225": "^N225",    // Nikkei 225
    "FRA40": "^FCHI",     // CAC 40
  };

  if (indexMap[symbol]) {
    return indexMap[symbol];
  }

  // Crypto - add -USD suffix
  const cryptoPairs = ["BTCUSD", "ETHUSD", "LTCUSD", "XRPUSD", "BCHUSD"];
  if (cryptoPairs.includes(symbol)) {
    const base = symbol.substring(0, symbol.length - 3);
    return `${base}-USD`;
  }

  // Default: return as-is
  return symbol;
}

// Market data interface for backtesting
interface MarketData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol: string;
  interval: string;
}

// Enhanced market data interface
export interface EnhancedMarketData extends MarketData {
  currency?: string;
  exchange?: string;
}

// Define proper types for strategy rules and conditions
interface StrategyCondition {
  indicator: string;
  operator: string;
  value: number;
  timeframes: string[];
}

interface StrategyRule {
  name: string;
  conditions: StrategyCondition[];
  action: {
    type: string;
    parameters: Record<string, number | undefined>;
  };
}

interface StrategyParameters {
  stopLoss?: number;
  takeProfit?: number;
  maxPositions?: number;
  maxDailyLoss?: number;
}

interface EnhancedStrategy {
  id: string;
  symbol: string;
  rules: StrategyRule[];
  parameters?: StrategyParameters;
}

// Historical data fetcher with Yahoo Finance library (yahoo-finance2)
export class HistoricalDataFetcher {
  private static yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical'] });

  static async fetchFromYahooFinance(
    symbol: string,
    interval: string,
    startDate: Date,
    endDate: Date,
    retryCount: number = 0
  ): Promise<EnhancedMarketData[]> {
    const MAX_RETRIES = 3;
    const STRICT_TOLERANCE_MS = 24 * 60 * 60 * 1000; // 1 day tolerance (strict)
    
    // Check cache first
    const cacheKey: CacheKey = {
      symbol,
      interval,
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      source: "yahoo",
    };

    const cachedData = await marketDataCache.get(cacheKey);
    if (cachedData) {
      console.log(`✅ Using cached data for ${symbol} ${interval}`);
      return cachedData;
    }

    try {
      console.log(`📡 Fetching from Yahoo Finance (yahoo-finance2 library): ${symbol} ${interval} ${cacheKey.startDate} to ${cacheKey.endDate} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
      console.log(`🆓 Using FREE yahoo-finance2 library (no API key needed!)`);

      // Convert symbol to Yahoo Finance format using improved mapper
      const yahooSymbol = convertSymbolToYahooFormat(symbol);

      // Convert interval to Yahoo Finance format
      const yahooInterval = this.convertIntervalToYahoo(interval);

      console.log(`🔍 YAHOO FINANCE DEBUG - Request:`);
      console.log(`   Original Symbol: ${symbol}`);
      console.log(`   Yahoo Symbol: ${yahooSymbol}`);
      console.log(`   Interval: ${yahooInterval}`);
      console.log(`   Start: ${startDate.toISOString()}`);
      console.log(`   End: ${endDate.toISOString()}`);

      // Fetch data using yahoo-finance2 library
      const result = await this.yahooFinance.chart(yahooSymbol, {
        period1: startDate,
        period2: endDate,
        interval: yahooInterval as '1m' | '2m' | '5m' | '15m' | '30m' | '60m' | '90m' | '1h' | '1d' | '5d' | '1wk' | '1mo' | '3mo',
      });

      console.log(`🔍 YAHOO FINANCE DEBUG - Response:`);
      console.log(`   Quotes count: ${result?.quotes?.length || 0}`);

      if (!result || !result.quotes || result.quotes.length === 0) {
        console.error("❌ Yahoo Finance returned no data");
        
        // Retry on empty response
        if (retryCount < MAX_RETRIES) {
          const backoffMs = Math.pow(2, retryCount) * 1000; // Exponential backoff
          console.log(`⏳ Retrying in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          return this.fetchFromYahooFinance(symbol, interval, startDate, endDate, retryCount + 1);
        }

        throw new Error(`No data available for ${symbol} from Yahoo Finance. This could be due to: 1) Symbol not supported, 2) Date range exceeds limits (60 days for intraday), or 3) Market was closed during this period.`);
      }

      // Extract data from yahoo-finance2 response
      const quotes = result.quotes;
      const timestamps: number[] = [];
      const closes: (number | null)[] = [];
      const opens: (number | null)[] = [];
      const highs: (number | null)[] = [];
      const lows: (number | null)[] = [];
      const volumes: (number | null)[] = [];

      // Extract data from quotes
      for (const quote of quotes) {
        timestamps.push(Math.floor(new Date(quote.date).getTime() / 1000)); // Convert to unix timestamp
        closes.push(quote.close);
        opens.push(quote.open);
        highs.push(quote.high);
        lows.push(quote.low);
        volumes.push(quote.volume);
      }

      if (timestamps.length === 0 || closes.length === 0) {
        console.error("❌ Yahoo Finance response has no data points");
        throw new Error("No data points available from Yahoo Finance");
      }

      // Map to market data with filtering for null/undefined values
      let marketData: EnhancedMarketData[] = timestamps
        .map((timestamp: number, index: number) => ({
          timestamp: new Date(timestamp * 1000),
          open: opens[index] || closes[index] || 0,
          high: highs[index] || closes[index] || 0,
          low: lows[index] || closes[index] || 0,
          close: closes[index] || 0,
          volume: volumes[index] || 0,
          symbol,
          interval,
          currency: "USD",
          exchange: "YAHOO",
        }))
        .filter((d: EnhancedMarketData) => d.close > 0); // Filter out invalid data points

      console.log(`🔍 YAHOO FINANCE DEBUG - Raw data points: ${marketData.length}`);

      // FLEXIBLE DATE RANGE FILTERING - Yahoo Finance uses range-based queries (1mo, 5d, etc)
      // So we allow data slightly outside requested range but within tolerance
      const FILTER_TOLERANCE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days tolerance for filtering
      const filterStartTime = startDate.getTime() - FILTER_TOLERANCE_MS;
      const filterEndTime = endDate.getTime() + FILTER_TOLERANCE_MS;
      
      const filteredData = marketData.filter(d => {
        const timestamp = d.timestamp.getTime();
        return timestamp >= filterStartTime && timestamp <= filterEndTime;
      });

      console.log(`🔍 YAHOO FINANCE DEBUG - After flexible date filtering: ${filteredData.length} points`);
      console.log(`   (Tolerance: ±7 days from requested range)`);

      if (filteredData.length === 0) {
        console.error("❌ No data points after filtering for requested date range");
        console.error(`   Requested: ${startDate.toISOString()} to ${endDate.toISOString()}`);
        console.error(`   Filter tolerance: ±7 days`);
        throw new Error("No data available for the requested date range");
      }

      // Use filtered data if available, otherwise use all data (Yahoo Finance returned what it has)
      marketData = filteredData.length > 0 ? filteredData : marketData;

      // DEBUG: Log processed data
      const actualStart = marketData[0].timestamp;
      const actualEnd = marketData[marketData.length - 1].timestamp;
      console.log(`🔍 YAHOO FINANCE DEBUG - Filtered data range:`);
      console.log(`   First data point: ${actualStart.toISOString()} - Close: ${marketData[0].close}`);
      console.log(`   Last data point: ${actualEnd.toISOString()} - Close: ${marketData[marketData.length - 1].close}`);
      console.log(`   Actual Days: ${Math.ceil((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24))}`);
      console.log(`   Data points: ${marketData.length}`);

      // FLEXIBLE VALIDATION - Yahoo Finance uses range-based queries, so allow some tolerance
      // Cache validation tolerance: 7 days (less strict than before)
      const CACHE_TOLERANCE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days for caching
      const requestedStart = new Date(cacheKey.startDate);
      const requestedEnd = new Date(cacheKey.endDate);
      const startDiff = Math.abs(actualStart.getTime() - requestedStart.getTime());
      const endDiff = Math.abs(actualEnd.getTime() - requestedEnd.getTime());

      if (startDiff > CACHE_TOLERANCE_MS || endDiff > CACHE_TOLERANCE_MS) {
        console.warn(`⚠️ YAHOO FINANCE WARNING - Date range mismatch:`);
        console.warn(`   Requested: ${requestedStart.toISOString()} to ${requestedEnd.toISOString()}`);
        console.warn(`   Received: ${actualStart.toISOString()} to ${actualEnd.toISOString()}`);
        console.warn(`   Start difference: ${(startDiff / (1000 * 60 * 60 * 24)).toFixed(1)} days`);
        console.warn(`   End difference: ${(endDiff / (1000 * 60 * 60 * 24)).toFixed(1)} days`);
        console.warn(`   Cache tolerance: ${(CACHE_TOLERANCE_MS / (1000 * 60 * 60 * 24)).toFixed(0)} days`);
        console.warn(`   ⚠️ Data range differs from requested - returning data but not caching`);
        
        // Return data but don't cache if range is too different
        return marketData;
      }

      // Cache the fetched data only if it passes validation
      console.log(`✅ Yahoo Finance data validated successfully`);
      console.log(`🔍 Caching data with key:`, cacheKey);
      await marketDataCache.set(cacheKey, marketData, "yahoo");

      return marketData;
      
    } catch (error) {
      console.error("❌ Yahoo Finance fetch error:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        symbol,
        interval,
        startDate: cacheKey.startDate,
        endDate: cacheKey.endDate,
        retryCount,
      });
      
      // Re-throw the error to be handled by the caller
      throw error;
    }
  }

  private static convertIntervalToYahoo(interval: string): string {
    const intervalMap: Record<string, string> = {
      "1min": "1m",
      "5min": "5m",
      "15min": "15m",
      "30min": "30m",
      "1h": "1h",
      "4h": "1d",
      "1d": "1d",
      "1w": "1wk",
    };
    return intervalMap[interval] || "1d";
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
  private strategyParameters: {
    stopLoss: number;
    takeProfit: number;
    maxPositions: number;
    maxDailyLoss: number;
  } = {
    stopLoss: 0.002,
    takeProfit: 0.004,
    maxPositions: 1,
    maxDailyLoss: 100,
  };
  private symbol: string = "";
  private pipConfig: typeof DEFAULT_PIP_CONFIG = DEFAULT_PIP_CONFIG;

  constructor(initialBalance: number = 10000) {
    this.balance = initialBalance;
    this.equity = initialBalance;
  }

  setStrategyParameters(params: {
    stopLoss: number;
    takeProfit: number;
    maxPositions: number;
    maxDailyLoss: number;
  }) {
    this.strategyParameters = params;
  }

  async loadData(
    symbol: string,
    interval: string,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    // Store symbol and get pip configuration
    this.symbol = symbol;
    this.pipConfig = getPipConfig(symbol);
    
    // DEBUG: Log date range details
    console.log(`🔍 BACKTEST DEBUG - Loading data:`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Interval: ${interval}`);
    console.log(`   Requested Start Date: ${startDate.toISOString()}`);
    console.log(`   Requested End Date: ${endDate.toISOString()}`);
    console.log(`   Days Difference: ${(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)}`);
    console.log(`   Data Source: Yahoo Finance (only)`);
    console.log(
      `🔧 Using pip configuration for ${symbol}: multiplier=${this.pipConfig.pipMultiplier}, minPips=${this.pipConfig.minPips}, maxPips=${this.pipConfig.maxPips}`,
    );
    
    // Fetch data from Yahoo Finance only
    console.log(`🔍 BACKTEST DEBUG - Fetching data from Yahoo Finance...`);
    const data = await HistoricalDataFetcher.fetchFromYahooFinance(
      symbol,
      interval,
      startDate,
      endDate,
    );
    console.log(`🔍 BACKTEST DEBUG - Yahoo Finance returned ${data.length} data points`);

    // Throw error if no data available
    if (data.length === 0) {
      console.error(`❌ BACKTEST DEBUG - No data available for ${symbol} from Yahoo Finance`);
      throw new Error(
        `Failed to fetch real market data for ${symbol} from Yahoo Finance API. Please check your API keys, internet connection, and ensure the symbol is supported.`,
      );
    }

    // DEBUG: Log actual data range received
    if (data.length > 0) {
      const actualStartDate = data[0].timestamp;
      const actualEndDate = data[data.length - 1].timestamp;
      console.log(`🔍 BACKTEST DEBUG - Actual data range:`);
      console.log(`   Actual Start Date: ${actualStartDate.toISOString()}`);
      console.log(`   Actual End Date: ${actualEndDate.toISOString()}`);
      console.log(`   Actual Days: ${(actualEndDate.getTime() - actualStartDate.getTime()) / (1000 * 60 * 60 * 24)}`);
      console.log(`   First 3 data points:`, data.slice(0, 3).map(d => ({ time: d.timestamp.toISOString(), close: d.close })));
      console.log(`   Last 3 data points:`, data.slice(-3).map(d => ({ time: d.timestamp.toISOString(), close: d.close })));
    }

    console.log(
      `✅ Successfully loaded ${data.length} data points for ${symbol} from real market data sources`,
    );

    // Sort by timestamp and store
    this.data = data.sort(
      (a: any, b: any) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
  }

  private applyStrategy(
    strategy: EnhancedStrategy,
    data: EnhancedMarketData,
    index: number,
  ): void {
    const { rules } = strategy;

    // Separate entry and exit rules
    const entryRules = rules.filter(
      (rule: StrategyRule) =>
        rule.action.type === "buy" || rule.action.type === "sell",
    );
    const exitRules = rules.filter(
      (rule: StrategyRule) => rule.action.type === "close",
    );

    // Only process entry rules if no positions open
    if (this.positions.length === 0) {
      entryRules.forEach((rule: StrategyRule) => {
        const { conditions, action } = rule;
        let shouldExecute = true;

        // Check all conditions
        conditions.forEach((condition: StrategyCondition) => {
          const { indicator, operator, value, timeframes } = condition;

          if (!timeframes.includes(timeframes[0])) {
            shouldExecute = false;
            return;
          }

          const currentValue = this.calculateIndicator(
            indicator,
            this.data,
            index,
          );

          switch (operator) {
            case "gt":
              if (!(currentValue > value)) shouldExecute = false;
              break;
            case "lt":
              if (!(currentValue < value)) shouldExecute = false;
              break;
            case "eq":
              if (!(Math.abs(currentValue - value) < 0.0001))
                shouldExecute = false;
              break;
            case "gte":
              if (!(currentValue >= value)) shouldExecute = false;
              break;
            case "lte":
              if (!(currentValue <= value)) shouldExecute = false;
              break;
          }
        });

        if (shouldExecute) {
          this.executeAction(action, data);
        }
      });
    }
    // Only process exit rules if positions are open
    else {
      exitRules.forEach((rule: StrategyRule) => {
        const { conditions, action } = rule;
        let shouldExecute = true;

        // Check all conditions
        conditions.forEach((condition: StrategyCondition) => {
          const { indicator, operator, value, timeframes } = condition;

          if (!timeframes.includes(timeframes[0])) {
            shouldExecute = false;
            return;
          }

          const currentValue = this.calculateIndicator(
            indicator,
            this.data,
            index,
          );

          switch (operator) {
            case "gt":
              if (!(currentValue > value)) shouldExecute = false;
              break;
            case "lt":
              if (!(currentValue < value)) shouldExecute = false;
              break;
            case "eq":
              if (!(Math.abs(currentValue - value) < 0.0001))
                shouldExecute = false;
              break;
            case "gte":
              if (!(currentValue >= value)) shouldExecute = false;
              break;
            case "lte":
              if (!(currentValue <= value)) shouldExecute = false;
              break;
          }
        });

        if (shouldExecute) {
          this.executeAction(action, data);
        }
      });
    }
  }

  private calculateIndicator(
    indicator: string,
    data: EnhancedMarketData[],
    index: number,
  ): number {
    switch (indicator) {
      case "price":
        return data[index].close;
      case "sma_20":
        return this.calculateSMA(data, index, 20);
      case "sma_50":
        return this.calculateSMA(data, index, 50);
      case "ema_12":
        return this.calculateEMA(data, index, 12);
      case "ema_26":
        return this.calculateEMA(data, index, 26);
      case "rsi":
        return this.calculateRSI(data, index, 14);
      default:
        return data[index].close;
    }
  }

  private calculateSMA(
    data: EnhancedMarketData[],
    index: number,
    period: number,
  ): number {
    if (index < period - 1) return data[index].close;

    let sum = 0;
    for (let i = index - period + 1; i <= index; i++) {
      sum += data[i].close;
    }
    return sum / period;
  }

  private calculateEMA(
    data: EnhancedMarketData[],
    index: number,
    period: number,
  ): number {
    if (index === 0) return data[index].close;

    const multiplier = 2 / (period + 1);
    const previousEMA = this.calculateEMA(data, index - 1, period);
    return (data[index].close - previousEMA) * multiplier + previousEMA;
  }

  private calculateRSI(
    data: EnhancedMarketData[],
    index: number,
    period: number,
  ): number {
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
    return 100 - 100 / (1 + rs);
  }

  private executeAction(action: any, data: EnhancedMarketData): void {
    const { type, parameters } = action;

    switch (type) {
      case "buy":
        this.openPosition(
          "buy",
          parameters.size || 0.01,
          data.close,
          data.timestamp,
        );
        break;
      case "sell":
        this.openPosition(
          "sell",
          parameters.size || 0.01,
          data.close,
          data.timestamp,
        );
        break;
      case "close":
        this.closePosition(data.close, data.timestamp);
        break;
    }
  }

  private openPosition(
    type: "buy" | "sell",
    size: number,
    price: number,
    timestamp: Date,
  ): void {
    if (this.positions.length >= this.strategyParameters.maxPositions) return;

    // Calculate SL and TP based on strategy parameters
    const stopLossPrice =
      type === "buy"
        ? price - price * this.strategyParameters.stopLoss
        : price + price * this.strategyParameters.stopLoss;

    const takeProfitPrice =
      type === "buy"
        ? price + price * this.strategyParameters.takeProfit
        : price - price * this.strategyParameters.takeProfit;

    this.positions.push({
      type,
      size,
      openPrice: price,
      openTime: timestamp,
      currentPrice: price,
      stopLoss: stopLossPrice,
      takeProfit: takeProfitPrice,
    });
  }

  private closePosition(price: number, timestamp: Date): void {
    if (this.positions.length === 0) return;

    const position = this.positions.pop();
    if (!position) return;

    // Use symbol-specific pip configuration
    const pipValue = this.pipConfig.pipMultiplier;
    let profit = 0;
    let pips = 0;

    if (position.type === "buy") {
      profit = ((price - position.openPrice) / pipValue) * position.size * 10;
      pips = (price - position.openPrice) / pipValue;
    } else {
      profit = ((position.openPrice - price) / pipValue) * position.size * 10;
      pips = (position.openPrice - price) / pipValue;
    }

    this.balance += profit;

    this.trades.push({
      type: position.type.toUpperCase(),
      size: position.size,
      entryPrice: position.openPrice,
      exitPrice: price,
      entryTime: position.openTime.toISOString(),
      exitTime: timestamp.toISOString(),
      profit,
      pips,
      duration: timestamp.getTime() - position.openTime.getTime(),
    });
  }

  private updateEquity(currentPrice: number, timestamp: Date): void {
    let unrealizedPnL = 0;

    this.positions.forEach((position) => {
      // Use symbol-specific pip configuration
      const pipValue = this.pipConfig.pipMultiplier;
      let positionProfit = 0;

      if (position.type === "buy") {
        positionProfit =
          ((currentPrice - position.openPrice) / pipValue) * position.size * 10;
      } else {
        positionProfit =
          ((position.openPrice - currentPrice) / pipValue) * position.size * 10;
      }

      unrealizedPnL += positionProfit;
    });

    this.equity = this.balance + unrealizedPnL;
    this.equityCurve.push({ timestamp, equity: this.equity });
  }

  private checkStopLossAndTakeProfit(
    currentPrice: number,
    timestamp: Date,
  ): void {
    const positionsToClose: any[] = [];

    this.positions.forEach((position, index) => {
      let shouldClose = false;
      let closeReason = "";

      if (position.type === "buy") {
        // Check stop loss
        if (currentPrice <= position.stopLoss) {
          shouldClose = true;
          closeReason = "Stop Loss";
        }
        // Check take profit
        else if (currentPrice >= position.takeProfit) {
          shouldClose = true;
          closeReason = "Take Profit";
        }
      } else if (position.type === "sell") {
        // Check stop loss
        if (currentPrice >= position.stopLoss) {
          shouldClose = true;
          closeReason = "Stop Loss";
        }
        // Check take profit
        else if (currentPrice <= position.takeProfit) {
          shouldClose = true;
          closeReason = "Take Profit";
        }
      }

      if (shouldClose) {
        positionsToClose.push({ position, index, reason: closeReason });
      }
    });

    // Close positions that hit SL/TP
    positionsToClose.reverse().forEach(({ position, reason }) => {
      this.closePositionWithReason(currentPrice, timestamp, reason);
    });
  }

  private closePositionWithReason(
    price: number,
    timestamp: Date,
    reason: string,
  ): void {
    if (this.positions.length === 0) return;

    const position = this.positions.pop();
    if (!position) return;

    // Use symbol-specific pip configuration
    const pipValue = this.pipConfig.pipMultiplier;
    let profit = 0;
    let pips = 0;

    if (position.type === "buy") {
      profit = ((price - position.openPrice) / pipValue) * position.size * 10;
      pips = (price - position.openPrice) / pipValue;
    } else {
      profit = ((position.openPrice - price) / pipValue) * position.size * 10;
      pips = (position.openPrice - price) / pipValue;
    }

    this.balance += profit;

    this.trades.push({
      type: position.type.toUpperCase(),
      size: position.size,
      entryPrice: position.openPrice,
      exitPrice: price,
      entryTime: position.openTime.toISOString(),
      exitTime: timestamp.toISOString(),
      profit,
      pips,
      duration: timestamp.getTime() - position.openTime.getTime(),
      closeReason: reason,
    });
  }

  async runBacktest(strategy: EnhancedStrategy): Promise<BacktestResult> {
    if (this.data.length === 0) {
      throw new Error("No data loaded for backtesting");
    }

    const initialBalance = this.balance;

    // Run strategy through all data points
    for (let i = 0; i < this.data.length; i++) {
      const candle = this.data[i];

      // Check SL/TP for open positions FIRST
      this.checkStopLossAndTakeProfit(candle.close, candle.timestamp);

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

    const winningTrades = this.trades.filter((trade) => trade.profit > 0);
    const losingTrades = this.trades.filter((trade) => trade.profit <= 0);

    const winRate =
      this.trades.length > 0
        ? (winningTrades.length / this.trades.length) * 100
        : 0;
    const averageWin =
      winningTrades.length > 0
        ? winningTrades.reduce((sum, trade) => sum + trade.profit, 0) /
          winningTrades.length
        : 0;
    const averageLoss =
      losingTrades.length > 0
        ? losingTrades.reduce((sum, trade) => sum + Math.abs(trade.profit), 0) /
          losingTrades.length
        : 0;

    // Calculate maximum drawdown
    let maxDrawdown = 0;
    let peakEquity = initialBalance;

    this.equityCurve.forEach((point) => {
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
    const totalProfit = winningTrades.reduce(
      (sum, trade) => sum + trade.profit,
      0,
    );
    const totalLoss = losingTrades.reduce(
      (sum, trade) => sum + Math.abs(trade.profit),
      0,
    );
    const profitFactor =
      totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

    return {
      id: `bt_${Date.now()}`,
      strategyId: strategy.id,
      status: "completed",
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
      trades: this.trades.map((trade) => ({
        id: `trade_${Date.now()}_${Math.random()}`,
        ...trade,
      })),
      equityCurve: this.equityCurve,
      metadata: {
        dataSource: "yahoo_finance",
        totalDataPoints: this.data.length,
        executionTime: new Date(),
      },
    };
  }

  private calculateSharpeRatio(): number {
    if (this.equityCurve.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < this.equityCurve.length; i++) {
      const returnRate =
        (this.equityCurve[i].equity - this.equityCurve[i - 1].equity) /
        this.equityCurve[i - 1].equity;
      returns.push(returnRate);
    }

    if (returns.length === 0) return 0;

    const avgReturn =
      returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance =
      returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) /
      returns.length;
    const stdDev = Math.sqrt(variance);

    return stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized Sharpe Ratio
  }
}

// Main running function
export async function runBacktest(
  strategyId: string,
  params: {
    startDate: Date;
    endDate: Date;
    initialBalance: number;
    symbol: string;
    interval: string;
    strategy: EnhancedStrategy;
  },
): Promise<BacktestResult> {
  const engine = new BacktestEngine(params.initialBalance);

  // Set strategy parameters from strategy object
  if (params.strategy.parameters) {
    engine.setStrategyParameters({
      stopLoss: params.strategy.parameters.stopLoss || 0.002,
      takeProfit: params.strategy.parameters.takeProfit || 0.004,
      maxPositions: params.strategy.parameters.maxPositions || 1,
      maxDailyLoss: params.strategy.parameters.maxDailyLoss || 100,
    });
  }

  await engine.loadData(
    params.symbol,
    params.interval,
    params.startDate,
    params.endDate,
  );

  return await engine.runBacktest(params.strategy);
}
