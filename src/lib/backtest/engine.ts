import { BacktestResults, Strategy, MTFStrategy, MTFBacktestConfig, SmartExitRules, EnhancedPartialExitConfig } from "../../types";
import { marketDataCache, CacheKey } from "../cache/market-data-cache";
import YahooFinance from 'yahoo-finance2';
import { SmartExitCalculator } from '../trading/smart-exits';
import { createPartialExitManager, EnhancedPartialExitManager } from '../trading/partial-exits';
import { convertToProviderSymbol } from "../data-providers/common/symbol-mapper";

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
 * Yahoo Finance uses different formats for forex, commodities, indices, and crypto
 * Now uses centralized symbol mapper for consistency across all symbols
 */
function convertSymbolToYahooFormat(symbol: string): string {
  // Remove any spaces and uppercase
  symbol = symbol.replace(/\s/g, "").toUpperCase();

  // Use centralized symbol mapper for comprehensive coverage
  const yahooSymbol = convertToProviderSymbol(symbol, 'yahooFinance');
  
  console.log(`📊 Symbol Mapping: ${symbol} → ${yahooSymbol}`);
  
  return yahooSymbol;
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
  private multiTimeframeData: Record<string, EnhancedMarketData[]> = {};
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
  private isMTF: boolean = false;
  private mtfStrategy?: MTFStrategy;
  private smartExitRules?: SmartExitRules;
  private useSmartExits: boolean = false;
  private enhancedPartialExitConfig?: EnhancedPartialExitConfig;
  private partialExitManager?: EnhancedPartialExitManager;
  private useEnhancedPartialExits: boolean = false;

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

  setSmartExitRules(smartExitRules: SmartExitRules) {
    this.smartExitRules = smartExitRules;
    this.useSmartExits = true;
    console.log(`🔧 Smart exits enabled for backtesting`);
  }

  setEnhancedPartialExitConfig(config: EnhancedPartialExitConfig) {
    this.enhancedPartialExitConfig = config;
    this.useEnhancedPartialExits = true;
    this.partialExitManager = createPartialExitManager(config);
    console.log(`🔧 Enhanced partial exits enabled for backtesting with ${config.levels.length} levels`);
  }

  async loadData(
    symbol: string,
    interval: string,
    startDate: Date,
    endDate: Date,
    mtfConfig?: MTFBacktestConfig,
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
    
    // Handle MTF data loading
    if (mtfConfig) {
      this.isMTF = true;
      console.log(`🔍 BACKTEST DEBUG - Loading MTF data for ${mtfConfig.primaryTimeframe} primary timeframe`);
      
      // Load primary timeframe data
      const primaryData = await HistoricalDataFetcher.fetchFromYahooFinance(
        symbol,
        mtfConfig.primaryTimeframe,
        startDate,
        endDate,
      );
      this.multiTimeframeData[mtfConfig.primaryTimeframe] = primaryData;
      this.data = primaryData; // Set primary data as main data for iteration
      
      // Load confirmation timeframe data
      for (const tf of mtfConfig.confirmationTimeframes) {
        console.log(`🔍 BACKTEST DEBUG - Loading confirmation data for ${tf} timeframe`);
        const confirmationData = await HistoricalDataFetcher.fetchFromYahooFinance(
          symbol,
          tf,
          startDate,
          endDate,
        );
        this.multiTimeframeData[tf] = confirmationData;
      }
      
      console.log(`🔍 BACKTEST DEBUG - MTF data loaded successfully`);
    } else {
      // Standard single timeframe data loading
      console.log(`🔍 BACKTEST DEBUG - Fetching data from Yahoo Finance...`);
      const data = await HistoricalDataFetcher.fetchFromYahooFinance(
        symbol,
        interval,
        startDate,
        endDate,
      );
      this.data = data;
      console.log(`🔍 BACKTEST DEBUG - Yahoo Finance returned ${data.length} data points`);
    }

    // Get the data that was loaded (either MTF or standard)
    const loadedData = this.isMTF ? this.data : this.data;
    
    // Throw error if no data available
    if (loadedData.length === 0) {
      console.error(`❌ BACKTEST DEBUG - No data available for ${symbol} from Yahoo Finance`);
      throw new Error(
        `Failed to fetch real market data for ${symbol} from Yahoo Finance API. Please check your API keys, internet connection, and ensure the symbol is supported.`,
      );
    }

    // DEBUG: Log actual data range received
    if (loadedData.length > 0) {
      const actualStartDate = loadedData[0].timestamp;
      const actualEndDate = loadedData[loadedData.length - 1].timestamp;
      console.log(`🔍 BACKTEST DEBUG - Actual data range:`);
      console.log(`   Actual Start Date: ${actualStartDate.toISOString()}`);
      console.log(`   Actual End Date: ${actualEndDate.toISOString()}`);
      console.log(`   Actual Days: ${(actualEndDate.getTime() - actualStartDate.getTime()) / (1000 * 60 * 60 * 24)}`);
      console.log(`   First 3 data points:`, loadedData.slice(0, 3).map((d: any) => ({ time: d.timestamp.toISOString(), close: d.close })));
      console.log(`   Last 3 data points:`, loadedData.slice(-3).map((d: any) => ({ time: d.timestamp.toISOString(), close: d.close })));
    }

    console.log(
      `✅ Successfully loaded ${loadedData.length} data points for ${symbol} from real market data sources`,
    );

    // Sort by timestamp and store (already done for MTF data)
    if (!this.isMTF) {
      this.data = loadedData.sort(
        (a: any, b: any) => a.timestamp.getTime() - b.timestamp.getTime(),
      );
    }
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

  private calculateATR(
    data: EnhancedMarketData[],
    index: number,
    period: number,
  ): number {
    if (index < period) return this.pipConfig.maxPips * this.pipConfig.pipMultiplier;

    let totalTR = 0;
    for (let i = index - period + 1; i <= index; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const prevClose = data[i - 1].close;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      totalTR += tr;
    }
    
    return totalTR / period;
  }

  private calculateSwingPoints(
    data: EnhancedMarketData[],
    index: number,
    lookback: number,
  ): any[] {
    if (index < lookback) return [];

    const swingPoints: any[] = [];
    const startIndex = Math.max(0, index - lookback);

    for (let i = startIndex + 1; i < index - 1; i++) {
      const current = data[i];
      const prev = data[i - 1];
      const next = data[i + 1];

      // Check for swing high
      if (current.high > prev.high && current.high > next.high) {
        swingPoints.push({
          timestamp: current.timestamp,
          price: current.high,
          type: 'high',
          strength: this.calculateSwingStrength(data, i, 'high', lookback)
        });
      }

      // Check for swing low
      if (current.low < prev.low && current.low < next.low) {
        swingPoints.push({
          timestamp: current.timestamp,
          price: current.low,
          type: 'low',
          strength: this.calculateSwingStrength(data, i, 'low', lookback)
        });
      }
    }

    return swingPoints;
  }

  private calculateSwingStrength(
    data: EnhancedMarketData[],
    index: number,
    type: 'high' | 'low',
    lookback: number
  ): number {
    const startIndex = Math.max(0, index - lookback);
    const endIndex = Math.min(data.length - 1, index + lookback);
    
    let strength = 0;
    const point = data[index];
    const price = type === 'high' ? point.high : point.low;

    // Count how many bars to the left and right this point dominates
    for (let i = startIndex; i <= endIndex; i++) {
      if (i === index) continue;
      
      const otherPoint = data[i];
      const otherPrice = type === 'high' ? otherPoint.high : otherPoint.low;
      
      if (type === 'high' && price > otherPrice) {
        strength++;
      } else if (type === 'low' && price < otherPrice) {
        strength++;
      }
    }

    return Math.min(strength, 5); // Cap strength at 5
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

    let stopLossPrice: number;
    let takeProfitPrice: number;
    let smartExitInfo: any = null;

    // Use smart exits if enabled and available
    if (this.useSmartExits && this.smartExitRules) {
      try {
        // Calculate ATR for smart exit calculation
        const atr = this.calculateATR(this.data, this.data.findIndex(d => d.timestamp === timestamp), 14);
        
        // Calculate swing points for smart exit calculation
        const swingPoints = this.calculateSwingPoints(this.data, this.data.findIndex(d => d.timestamp === timestamp), 20);
        
        // Prepare smart exit calculation parameters
        const smartExitParams = {
          entryPrice: price,
          tradeType: type.toUpperCase() as 'BUY' | 'SELL',
          atr,
          swingPoints,
          currentPrice: price,
          timestamp
        };

        // Calculate smart exits
        const smartExitResult = SmartExitCalculator.calculateExits(smartExitParams, this.smartExitRules);
        
        stopLossPrice = smartExitResult.stopLoss.price;
        takeProfitPrice = smartExitResult.takeProfit.price;
        
        smartExitInfo = {
          enabled: true,
          stopLossType: smartExitResult.stopLoss.type,
          takeProfitType: smartExitResult.takeProfit.type,
          riskRewardRatio: smartExitResult.riskRewardRatio,
          confidence: smartExitResult.confidence,
          partialExits: smartExitResult.partialExits,
          reasons: {
            stopLoss: smartExitResult.stopLoss.reason,
            takeProfit: smartExitResult.takeProfit.reason
          }
        };

        console.log(`🔧 Smart exit applied: SL=${stopLossPrice.toFixed(5)} (${smartExitResult.stopLoss.reason}), TP=${takeProfitPrice.toFixed(5)} (${smartExitResult.takeProfit.reason})`);
      } catch (error) {
        console.warn(`⚠️ Smart exit calculation failed, using traditional exits:`, error);
        // Fall back to traditional calculations
        stopLossPrice = type === "buy"
          ? price - price * this.strategyParameters.stopLoss
          : price + price * this.strategyParameters.stopLoss;
        takeProfitPrice = type === "buy"
          ? price + price * this.strategyParameters.takeProfit
          : price - price * this.strategyParameters.takeProfit;
      }
    } else {
      // Traditional SL/TP calculation
      stopLossPrice = type === "buy"
        ? price - price * this.strategyParameters.stopLoss
        : price + price * this.strategyParameters.stopLoss;
      takeProfitPrice = type === "buy"
        ? price + price * this.strategyParameters.takeProfit
        : price - price * this.strategyParameters.takeProfit;
    }

    this.positions.push({
      type,
      size,
      openPrice: price,
      openTime: timestamp,
      currentPrice: price,
      stopLoss: stopLossPrice,
      takeProfit: takeProfitPrice,
      smartExit: smartExitInfo,
      enhancedPartialExits: this.useEnhancedPartialExits ? {
        enabled: true,
        config: this.enhancedPartialExitConfig,
        executedLevels: [],
        remainingSize: size,
        originalSize: size,
        lastPartialExitTime: null,
        totalPartialExits: 0
      } : undefined
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

  private async checkStopLossAndTakeProfit(
    currentPrice: number,
    timestamp: Date,
  ): Promise<void> {
    const positionsToClose: any[] = [];
    const positionsToModify: any[] = [];

    for (let [index, position] of this.positions.entries()) {
      let shouldClose = false;
      let shouldModify = false;
      let closeReason = "";
      let modificationReason = "";

      // Handle smart exits
      if (position.smartExit && position.smartExit.enabled) {
        // Check for partial exits
        if (position.smartExit.partialExits && position.smartExit.partialExits.length > 0) {
          const riskDistance = Math.abs(position.openPrice - position.stopLoss);
          
          for (const partialExit of position.smartExit.partialExits) {
            const targetPrice = position.type === "buy"
              ? position.openPrice + (riskDistance * partialExit.atRR)
              : position.openPrice - (riskDistance * partialExit.atRR);
            
            const hitTarget = position.type === "buy"
              ? currentPrice >= targetPrice
              : currentPrice <= targetPrice;
            
            if (hitTarget && !partialExit.triggered) {
              // Mark partial exit as triggered
              partialExit.triggered = true;
              shouldModify = true;
              modificationReason = `Partial Exit ${partialExit.percentage}% at ${partialExit.atRR}:1 RR`;
              
              // Calculate partial close amount
              const partialCloseAmount = position.size * (partialExit.percentage / 100);
              positionsToModify.push({
                position,
                index,
                reason: modificationReason,
                partialCloseAmount,
                remainingSize: position.size - partialCloseAmount
              });
              
              console.log(`🔧 Partial exit triggered: ${modificationReason}, closing ${partialCloseAmount.toFixed(4)} of ${position.size.toFixed(4)}`);
            }
          }
        }

        // Check for trailing stop updates
        if (position.smartExit.stopLossType === 'trailing') {
          const trailDistance = Math.abs(position.openPrice - position.stopLoss) * 0.5; // Trail at 50% of original distance
          
          if (position.type === "buy") {
            const newStopLoss = currentPrice - trailDistance;
            if (newStopLoss > position.stopLoss) {
              position.stopLoss = newStopLoss;
              shouldModify = true;
              modificationReason = `Trailing stop updated to ${newStopLoss.toFixed(5)}`;
              console.log(`🔧 ${modificationReason}`);
            }
          } else {
            const newStopLoss = currentPrice + trailDistance;
            if (newStopLoss < position.stopLoss) {
              position.stopLoss = newStopLoss;
              shouldModify = true;
              modificationReason = `Trailing stop updated to ${newStopLoss.toFixed(5)}`;
              console.log(`🔧 ${modificationReason}`);
            }
          }
        }

        // Check for maximum holding time
        if (position.smartExit.maxHoldingHours) {
          const holdingHours = (timestamp.getTime() - position.openTime.getTime()) / (1000 * 60 * 60);
          if (holdingHours >= position.smartExit.maxHoldingHours) {
            shouldClose = true;
            closeReason = `Max Holding Time (${position.smartExit.maxHoldingHours}h)`;
          }
        }
      }

      // Handle enhanced partial exits
      if (position.enhancedPartialExits && position.enhancedPartialExits.enabled && !shouldClose) {
        // Calculate partial exit parameters
        const dataIndex = this.data.findIndex(d => d.timestamp === timestamp);
        const atr = this.calculateATR(this.data, dataIndex, 14);
        const volatility = atr / currentPrice; // Simple volatility calculation
        
        // Get market regime for more realistic simulation
        let currentRegime: any = 'ranging';
        let regimeConfidence = 70;
        try {
          // Simple regime detection based on price movement
          const recentData = this.data.slice(Math.max(0, dataIndex - 20), dataIndex);
          if (recentData.length > 10) {
            const priceChange = (currentPrice - recentData[0].close) / recentData[0].close;
            if (priceChange > 0.02) {
              currentRegime = 'trending_up';
              regimeConfidence = 80;
            } else if (priceChange < -0.02) {
              currentRegime = 'trending_down';
              regimeConfidence = 80;
            }
          }
        } catch (error) {
          // Use default values if regime detection fails
        }
        
        // Get current session based on timestamp
        const hour = timestamp.getUTCHours();
        let currentSession = 'unknown';
        if (hour >= 0 && hour < 6) currentSession = 'sydney';
        else if (hour >= 6 && hour < 14) currentSession = 'london';
        else if (hour >= 14 && hour < 22) currentSession = 'newyork';
        else currentSession = 'tokyo';
        
        // Prepare parameters for partial exit calculation
        const partialExitParams = {
          tradeId: `trade_${position.openTime.getTime()}`,
          symbol: this.symbol,
          entryPrice: position.openPrice,
          currentPrice: currentPrice,
          tradeType: position.type.toUpperCase() as 'BUY' | 'SELL',
          originalQuantity: position.enhancedPartialExits.originalSize,
          remainingQuantity: position.enhancedPartialExits.remainingSize,
          entryTime: position.openTime,
          atr,
          volatility,
          spread: this.pipConfig.pipMultiplier * 2, // More realistic spread
          currentRegime,
          regimeConfidence,
          currentSession,
          config: position.enhancedPartialExits.config
        };

        try {
          // Calculate partial exits using the manager
          const partialExitResult = await this.partialExitManager!.calculatePartialExits(partialExitParams);
          
          if (partialExitResult.shouldExit && partialExitResult.recommendedExits.length > 0) {
            // Sort by priority and execute the highest priority partial exit
            const recommendedExits = partialExitResult.recommendedExits.sort((a, b) => a.urgency.localeCompare(b.urgency));
            const recommendedExit = recommendedExits[0];
            
            // Check if this level has already been executed
            const alreadyExecuted = position.enhancedPartialExits.executedLevels.some(
              (level: any) => level.levelId === recommendedExit.levelId
            );
            
            // Check cooldown period between partial exits
            const lastExecution = position.enhancedPartialExits.executedLevels[position.enhancedPartialExits.executedLevels.length - 1];
            const cooldownMs = (position.enhancedPartialExits.config.globalSettings?.cooldownPeriod || 0) * 60 * 1000;
            const isInCooldown = lastExecution && (timestamp.getTime() - lastExecution.timestamp.getTime()) < cooldownMs;
            
            if (!alreadyExecuted && !isInCooldown) {
              // Execute partial exit
              const execution = await this.partialExitManager!.executePartialExit(
                recommendedExit.levelId,
                partialExitParams,
                recommendedExit.price
              );
              
              // Update position
              position.enhancedPartialExits.executedLevels.push({
                levelId: execution.levelId,
                levelName: execution.levelName,
                timestamp: execution.timestamp,
                price: execution.price,
                quantity: execution.quantity,
                percentage: execution.percentage,
                reason: execution.triggerReason
              });
              
              position.enhancedPartialExits.remainingSize = execution.remainingQuantity;
              position.size = execution.remainingQuantity;
              position.enhancedPartialExits.lastPartialExitTime = execution.timestamp;
              position.enhancedPartialExits.totalPartialExits += 1;
              
              // Update balance with realized profit
              this.balance += execution.realizedProfit;
              
              // Record trade
              this.trades.push({
                type: position.type.toUpperCase(),
                size: execution.quantity,
                entryPrice: position.openPrice,
                exitPrice: execution.price,
                entryTime: position.openTime.toISOString(),
                exitTime: execution.timestamp.toISOString(),
                profit: execution.realizedProfit,
                pips: position.type === "buy"
                  ? (execution.price - position.openPrice) / this.pipConfig.pipMultiplier
                  : (position.openPrice - execution.price) / this.pipConfig.pipMultiplier,
                duration: execution.timestamp.getTime() - position.openTime.getTime(),
                closeReason: `Enhanced Partial Exit: ${execution.levelName} (${execution.triggerReason})`,
                isPartial: true,
                remainingSize: execution.remainingQuantity,
                enhancedPartialExit: {
                  levelId: execution.levelId,
                  levelName: execution.levelName,
                  triggerType: execution.triggerType,
                  triggerValue: execution.triggerValue,
                  confidence: execution.metadata?.confidence || 0,
                  urgency: recommendedExit.urgency,
                  marketContext: execution.marketContext
                }
              });
              
              shouldModify = true;
              modificationReason = `Enhanced Partial Exit: ${execution.levelName} (${execution.percentage}% at ${execution.triggerReason})`;
              
              console.log(`🔧 Enhanced partial exit executed: ${modificationReason}, ${execution.quantity.toFixed(4)} of ${position.enhancedPartialExits.originalSize.toFixed(4)}`);
            }
          }
        } catch (error) {
          console.warn(`⚠️ Enhanced partial exit calculation failed:`, error);
        }
      }

      // Check regular stop loss and take profit
      if (!shouldClose) {
        if (position.type === "buy") {
          // Check stop loss
          if (currentPrice <= position.stopLoss) {
            shouldClose = true;
            closeReason = position.smartExit?.enabled
              ? `Smart Stop Loss (${position.smartExit.reasons?.stopLoss || 'ATR-based'})`
              : "Stop Loss";
          }
          // Check take profit
          else if (currentPrice >= position.takeProfit) {
            shouldClose = true;
            closeReason = position.smartExit?.enabled
              ? `Smart Take Profit (${position.smartExit.reasons?.takeProfit || 'RR-based'})`
              : "Take Profit";
          }
        } else if (position.type === "sell") {
          // Check stop loss
          if (currentPrice >= position.stopLoss) {
            shouldClose = true;
            closeReason = position.smartExit?.enabled
              ? `Smart Stop Loss (${position.smartExit.reasons?.stopLoss || 'ATR-based'})`
              : "Stop Loss";
          }
          // Check take profit
          else if (currentPrice <= position.takeProfit) {
            shouldClose = true;
            closeReason = position.smartExit?.enabled
              ? `Smart Take Profit (${position.smartExit.reasons?.takeProfit || 'RR-based'})`
              : "Take Profit";
          }
        }
      }

      if (shouldClose) {
        positionsToClose.push({ position, index, reason: closeReason });
      }
    }

    // Process position modifications (partial exits, trailing stops)
    positionsToModify.forEach(({ position, partialCloseAmount, remainingSize, reason }) => {
      this.partialClosePosition(position, partialCloseAmount, currentPrice, timestamp, reason);
      position.size = remainingSize;
    });

    // Close positions that hit SL/TP
    positionsToClose.reverse().forEach(({ position, reason }) => {
      this.closePositionWithReason(currentPrice, timestamp, reason);
    });
  }

  private partialClosePosition(
    position: any,
    closeAmount: number,
    price: number,
    timestamp: Date,
    reason: string
  ): void {
    // Use symbol-specific pip configuration
    const pipValue = this.pipConfig.pipMultiplier;
    let profit = 0;
    let pips = 0;

    if (position.type === "buy") {
      profit = ((price - position.openPrice) / pipValue) * closeAmount * 10;
      pips = (price - position.openPrice) / pipValue;
    } else {
      profit = ((position.openPrice - price) / pipValue) * closeAmount * 10;
      pips = (position.openPrice - price) / pipValue;
    }

    this.balance += profit;

    this.trades.push({
      type: position.type.toUpperCase(),
      size: closeAmount,
      entryPrice: position.openPrice,
      exitPrice: price,
      entryTime: position.openTime.toISOString(),
      exitTime: timestamp.toISOString(),
      profit,
      pips,
      duration: timestamp.getTime() - position.openTime.getTime(),
      closeReason: reason,
      isPartial: true,
      remainingSize: position.size - closeAmount
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

  async runBacktest(strategy: EnhancedStrategy | MTFStrategy): Promise<BacktestResult> {
    if (this.data.length === 0) {
      throw new Error("No data loaded for backtesting");
    }

    const initialBalance = this.balance;

    // Run strategy through all data points
    for (let i = 0; i < this.data.length; i++) {
      const candle = this.data[i];

      // Check SL/TP for open positions FIRST
      await this.checkStopLossAndTakeProfit(candle.close, candle.timestamp);

      // Apply strategy rules
      this.applyStrategy(strategy as EnhancedStrategy, candle, i);

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

  /**
   * Calculate Sortino Ratio (downside risk-adjusted return)
   */
  private calculateSortinoRatio(): number {
    if (this.equityCurve.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < this.equityCurve.length; i++) {
      const returnRate =
        (this.equityCurve[i].equity - this.equityCurve[i - 1].equity) /
        this.equityCurve[i - 1].equity;
      returns.push(returnRate);
    }

    if (returns.length === 0) return 0;

    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    
    // Calculate downside deviation (only negative returns)
    const negativeReturns = returns.filter(r => r < 0);
    if (negativeReturns.length === 0) return avgReturn > 0 ? 10 : 0; // High score if no negative returns
    
    const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length;
    const downsideDeviation = Math.sqrt(downsideVariance);

    return downsideDeviation > 0 ? (avgReturn / downsideDeviation) * Math.sqrt(252) : 0; // Annualized
  }

  /**
   * Calculate Calmar Ratio (return / maximum drawdown)
   */
  private calculateCalmarRatio(): number {
    if (this.equityCurve.length < 2) return 0;

    const totalReturn = (this.balance - this.equityCurve[0].equity) / this.equityCurve[0].equity;
    const maxDrawdownPercent = this.calculateMaxDrawdownPercent();
    
    return maxDrawdownPercent > 0 ? totalReturn / Math.abs(maxDrawdownPercent) : 0;
  }

  /**
   * Calculate maximum drawdown percentage
   */
  private calculateMaxDrawdownPercent(): number {
    if (this.equityCurve.length < 2) return 0;

    let maxDrawdown = 0;
    let peakEquity = this.equityCurve[0].equity;

    this.equityCurve.forEach((point) => {
      if (point.equity > peakEquity) {
        peakEquity = point.equity;
      }
      const drawdown = (peakEquity - point.equity) / peakEquity * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    return maxDrawdown;
  }

  /**
   * Calculate expectancy (average profit per trade)
   */
  private calculateExpectancy(): number {
    if (this.trades.length === 0) return 0;

    const winningTrades = this.trades.filter((trade) => trade.profit > 0);
    const losingTrades = this.trades.filter((trade) => trade.profit <= 0);
    
    const winRate = winningTrades.length / this.trades.length;
    const averageWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, trade) => sum + trade.profit, 0) / winningTrades.length
      : 0;
    const averageLoss = losingTrades.length > 0
      ? losingTrades.reduce((sum, trade) => sum + Math.abs(trade.profit), 0) / losingTrades.length
      : 0;

    return (winRate * averageWin) - ((1 - winRate) * averageLoss);
  }

  /**
   * Calculate recovery factor (total return / maximum drawdown)
   */
  private calculateRecoveryFactor(): number {
    const totalReturn = this.balance - this.equityCurve[0].equity;
    const maxDrawdown = this.calculateMaxDrawdownPercent() / 100 * this.equityCurve[0].equity;
    
    return maxDrawdown > 0 ? totalReturn / maxDrawdown : (totalReturn > 0 ? 10 : 0);
  }

  /**
   * Calculate drawdown duration in days
   */
  private calculateDrawdownDuration(): number {
    if (this.equityCurve.length < 2) return 0;

    let maxDrawdownDuration = 0;
    let currentDrawdownDuration = 0;
    let peakEquity = this.equityCurve[0].equity;

    for (let i = 1; i < this.equityCurve.length; i++) {
      const currentEquity = this.equityCurve[i].equity;
      
      if (currentEquity > peakEquity) {
        // New peak - reset drawdown
        peakEquity = currentEquity;
        maxDrawdownDuration = Math.max(maxDrawdownDuration, currentDrawdownDuration);
        currentDrawdownDuration = 0;
      } else {
        // In drawdown
        currentDrawdownDuration++;
      }
    }

    // Convert to days (assuming each point represents one time period)
    return maxDrawdownDuration;
  }

  /**
   * Calculate win rate stability (consistency of win rate over time)
   */
  private calculateWinRateStability(): number {
    if (this.trades.length < 20) return 0;

    // Calculate rolling win rate over windows of 10 trades
    const windowSize = 10;
    const rollingWinRates: number[] = [];
    
    for (let i = windowSize; i < this.trades.length; i++) {
      const window = this.trades.slice(i - windowSize, i);
      const wins = window.filter(t => t.profit > 0).length;
      const winRate = wins / windowSize;
      rollingWinRates.push(winRate);
    }

    if (rollingWinRates.length === 0) return 0;

    // Calculate stability as 1 - coefficient of variation
    const mean = rollingWinRates.reduce((sum, wr) => sum + wr, 0) / rollingWinRates.length;
    const variance = rollingWinRates.reduce((sum, wr) => sum + Math.pow(wr - mean, 2), 0) / rollingWinRates.length;
    const stdDev = Math.sqrt(variance);

    return mean > 0 ? Math.max(0, 1 - (stdDev / mean)) : 0;
  }

  /**
   * Calculate consecutive wins and losses
   */
  private calculateConsecutiveRuns(): { consecutiveWins: number; consecutiveLosses: number } {
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;
    
    for (const trade of this.trades) {
      if (trade.profit > 0) {
        currentWins++;
        currentLosses = 0;
        maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins);
      } else {
        currentLosses++;
        currentWins = 0;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
      }
    }

    return {
      consecutiveWins: maxConsecutiveWins,
      consecutiveLosses: maxConsecutiveLosses,
    };
  }

  /**
   * Calculate Value at Risk (95% confidence level)
   */
  private calculateVaR95(): number {
    if (this.trades.length < 10) return 0;

    const returns = this.trades.map(t => t.profit);
    returns.sort((a, b) => a - b);
    
    const var95Index = Math.floor(returns.length * 0.05);
    return Math.abs(returns[var95Index] || 0);
  }

  /**
   * Calculate skewness of returns
   */
  private calculateSkewness(): number {
    if (this.trades.length < 10) return 0;

    const returns = this.trades.map(t => t.profit);
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    const skewness = returns.reduce((sum, r) => sum + Math.pow((r - mean) / stdDev, 3), 0) / returns.length;
    return skewness;
  }

  /**
   * Calculate kurtosis of returns
   */
  private calculateKurtosis(): number {
    if (this.trades.length < 10) return 0;

    const returns = this.trades.map(t => t.profit);
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    const kurtosis = returns.reduce((sum, r) => sum + Math.pow((r - mean) / stdDev, 4), 0) / returns.length - 3;
    return kurtosis;
  }
  /**
   * Run MTF backtest
   */
  private async runMTFBacktest(mtfStrategy: MTFStrategy): Promise<BacktestResult> {
    if (this.data.length === 0) {
      throw new Error("No data loaded for MTF backtesting");
    }

    const initialBalance = this.balance;
    console.log(`🔍 MTF BACKTEST DEBUG - Running MTF backtest for ${mtfStrategy.name}`);
    console.log(`   Primary TF: ${mtfStrategy.primaryTimeframe}`);
    console.log(`   Confirmation TFs: ${mtfStrategy.confirmationTimeframes.join(', ')}`);

    // Import MTF analyzer dynamically
    const { createMTFAnalyzer } = await import('../analysis/multi-timeframe');

    // Run strategy through all primary timeframe data points
    for (let i = 0; i < this.data.length; i++) {
      const candle = this.data[i];

      // Check SL/TP for open positions FIRST
      await this.checkStopLossAndTakeProfit(candle.close, candle.timestamp);

      // Create MTF analyzer for current point
      const mtfAnalyzer = createMTFAnalyzer({
        strategy: mtfStrategy,
        marketData: this.multiTimeframeData,
        currentTime: candle.timestamp
      });

      // Get data up to current point for each timeframe
      const truncatedData: Record<string, any[]> = {};
      for (const [tf, data] of Object.entries(this.multiTimeframeData)) {
        // Find the index in this timeframe that corresponds to current time
        const tfIndex = data.findIndex(d => d.timestamp >= candle.timestamp);
        if (tfIndex > 0) {
          truncatedData[tf] = data.slice(0, tfIndex + 1);
        } else {
          truncatedData[tf] = data.slice(0, 1); // At least one data point
        }
      }

      // Update analyzer with truncated data
      for (const [tf, data] of Object.entries(truncatedData)) {
        mtfAnalyzer.updateTimeframe(tf, data);
      }

      // Perform MTF analysis
      try {
        const analysisResult = await mtfAnalyzer.analyze();

        if (analysisResult.overallSignal) {
          // Determine action based on primary conditions
          const action = this.determineActionFromMTFConditions(mtfStrategy.rules.entry.primary, candle);

          // Execute trade if no positions are open
          if (this.positions.length === 0) {
            this.openPosition(
              action,
              mtfStrategy.rules.riskManagement.lotSize,
              candle.close,
              candle.timestamp,
            );
          }
        }
      } catch (error) {
        console.warn(`MTF analysis error at ${candle.timestamp}:`, error);
      }

      // Update equity
      this.updateEquity(candle.close, candle.timestamp);
    }

    // Close any remaining positions at the end
    if (this.positions.length > 0) {
      const lastCandle = this.data[this.data.length - 1];
      this.closePosition(lastCandle.close, lastCandle.timestamp);
    }

    // Calculate statistics (same as standard backtest)
    return this.calculateBacktestResults(initialBalance, mtfStrategy.id);
  }

  /**
   * Determine action from MTF primary conditions
   */
  private determineActionFromMTFConditions(primaryConditions: any[], marketData: EnhancedMarketData): 'buy' | 'sell' {
    // Simplified logic - in production would analyze conditions more thoroughly
    const rsi = this.calculateRSI(this.data.slice(-20), this.data.length - 1, 14);
    return rsi < 30 ? 'buy' : 'sell';
  }

  /**
   * Calculate backtest results
   */
  private calculateBacktestResults(initialBalance: number, strategyId: string): BacktestResult {
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

    // Calculate additional advanced metrics
    const sortinoRatio = this.calculateSortinoRatio();
    const calmarRatio = this.calculateCalmarRatio();
    const expectancy = this.calculateExpectancy();
    const recoveryFactor = this.calculateRecoveryFactor();
    const drawdownDuration = this.calculateDrawdownDuration();
    const winRateStability = this.calculateWinRateStability();
    const { consecutiveWins, consecutiveLosses } = this.calculateConsecutiveRuns();
    const var95 = this.calculateVaR95();
    const skewness = this.calculateSkewness();
    const kurtosis = this.calculateKurtosis();

    return {
      id: `bt_${Date.now()}`,
      strategyId,
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
        isMTF: this.isMTF,
        timeframes: this.isMTF ? Object.keys(this.multiTimeframeData) : [this.data[0]?.interval],
        // Include advanced metrics in metadata for scoring
        advancedMetrics: {
          sortinoRatio,
          calmarRatio,
          expectancy,
          recoveryFactor,
          drawdownDuration,
          winRateStability,
          consecutiveWins,
          consecutiveLosses,
          var95,
          skewness,
          kurtosis,
        },
      },
    };
  }

  /**
   * Set MTF strategy
   */
  setMTFStrategy(mtfStrategy: MTFStrategy): void {
    this.mtfStrategy = mtfStrategy;
    this.isMTF = true;
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
    mtfConfig?: MTFBacktestConfig;
    smartExitRules?: SmartExitRules;
    enhancedPartialExitConfig?: EnhancedPartialExitConfig;
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

  // Set smart exit rules if provided
  if (params.smartExitRules) {
    engine.setSmartExitRules(params.smartExitRules);
  }

  // Set enhanced partial exit configuration if provided
  if (params.enhancedPartialExitConfig) {
    engine.setEnhancedPartialExitConfig(params.enhancedPartialExitConfig);
  }

  // Set MTF strategy if provided
  if (params.mtfConfig) {
    const mtfStrategy: MTFStrategy = {
      id: strategyId,
      userId: "backtest_user",
      name: "MTF Backtest Strategy",
      description: "MTF strategy for backtesting",
      symbol: params.symbol,
      primaryTimeframe: params.mtfConfig.primaryTimeframe,
      confirmationTimeframes: params.mtfConfig.confirmationTimeframes,
      type: "mtf",
      status: "active",
      rules: (params.strategy as any).rules || {
        entry: {
          primary: [],
          confirmation: []
        },
        exit: {
          takeProfit: { type: "pips", value: 50 },
          stopLoss: { type: "pips", value: 25 },
          smartExit: params.smartExitRules
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
    
    engine.setMTFStrategy(mtfStrategy);
  }

  await engine.loadData(
    params.symbol,
    params.interval,
    params.startDate,
    params.endDate,
    params.mtfConfig,
  );

  return await engine.runBacktest(params.strategy);
}

/**
 * MTF-specific backtest function
 */
export async function runMTFBacktest(
  strategyId: string,
  mtfStrategy: MTFStrategy,
  params: {
    startDate: Date;
    endDate: Date;
    initialBalance: number;
    smartExitRules?: SmartExitRules;
  },
): Promise<BacktestResult> {
  const engine = new BacktestEngine(params.initialBalance);
  
  // Set MTF strategy
  engine.setMTFStrategy(mtfStrategy);
  
  // Set strategy parameters from MTF strategy
  if (mtfStrategy.rules.riskManagement) {
    engine.setStrategyParameters({
      stopLoss: 0.002, // Default, will be overridden by strategy rules
      takeProfit: 0.004, // Default, will be overridden by strategy rules
      maxPositions: mtfStrategy.rules.riskManagement.maxPositions || 1,
      maxDailyLoss: mtfStrategy.rules.riskManagement.maxDailyLoss || 100,
    });
  }

  // Set smart exit rules if provided
  if (params.smartExitRules || mtfStrategy.rules.exit.smartExit) {
    const smartExitRules = params.smartExitRules || mtfStrategy.rules.exit.smartExit;
    if (smartExitRules) {
      engine.setSmartExitRules(smartExitRules);
    }
  }

  // Create MTF config
  const mtfConfig: MTFBacktestConfig = {
    strategyType: 'mtf',
    strategyId,
    dateRange: {
      from: params.startDate,
      to: params.endDate
    },
    initialBalance: params.initialBalance,
    settings: {
      spread: 0.0001,
      commission: 0.0002,
      slippage: 0.0001,
      includeSwap: false,
    },
    primaryTimeframe: mtfStrategy.primaryTimeframe,
    confirmationTimeframes: mtfStrategy.confirmationTimeframes,
  };

  await engine.loadData(
    mtfStrategy.symbol,
    mtfStrategy.primaryTimeframe,
    params.startDate,
    params.endDate,
    mtfConfig,
  );

  return await engine.runBacktest(mtfStrategy);
}
