import {
  MarketDataProvider,
  MarketQuote,
  HistoricalData,
  SymbolInfo,
  OHLCV,
  DataProviderException,
  COMMON_FOREX_PAIRS,
  COMMON_TIMEFRAMES,
} from "../common/types";

interface YahooFinanceQuote {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketVolume: number;
  regularMarketPreviousClose: number;
  regularMarketOpen: number;
  regularMarketTime: number;
  fullExchangeName: string;
  currency: string;
  marketState: string;
  quoteType: string;
  shortName: string;
  longName: string;
}

interface YahooFinanceChart {
  chart: {
    result: Array<{
      meta: {
        symbol: string;
        currency: string;
        exchangeName: string;
        instrumentType: string;
        firstTradeDate: number;
        regularMarketTime: number;
        gmtoffset: number;
        timezone: string;
        exchangeTimezoneName: string;
        regularMarketPrice: number;
        chartPreviousClose: number;
        previousClose: number;
        scale: number;
        priceHint: number;
        currentTradingPeriod: {
          pre: { start: number; end: number; timezone: string };
          regular: { start: number; end: number; timezone: string };
          post: { start: number; end: number; timezone: string };
        };
        tradingPeriods: Array<
          Array<{ start: number; end: number; timezone: string }>
        >;
        dataGranularity: string;
        range: string;
      };
      timestamps: number[];
      indicators: {
        quote: Array<{
          open: number[];
          high: number[];
          low: number[];
          close: number[];
          volume: number[];
        }>;
        adjclose?: Array<{ close: number[] }>;
      };
    }>;
    error: any;
  };
}

interface YahooFinanceSearch {
  explains: any[];
  count: number;
  quotes: Array<{
    exchange: string;
    shortname: string;
    quoteType: string;
    symbol: string;
    index: string;
    score: number;
    typeDisp: string;
    longname: string;
    exchDisp: string;
    sector?: string;
    sectorDisp?: string;
    industry?: string;
    industryDisp?: string;
  }>;
  news: any[];
  nav: any[];
  lists: any[];
  researchReports: any[];
  screenerFieldResults: any[];
  totalTime: number;
  timeTakenForQuotes: number;
  timeTakenForNews: number;
  timeTakenForAlgowatchlist: number;
  timeTakenForPredefinedScreener: number;
  timeTakenForCrunchbase: number;
  timeTakenForNav: number;
  timeTakenForResearchReports: number;
  timeTakenForScreenerField: number;
  timeTakenForCulturalAssets: number;
}

export class YahooFinanceProvider implements MarketDataProvider {
  private readonly apiKey: string;
  private readonly apiHost: string;
  private readonly baseUrl = "https://yahoo-finance166.p.rapidapi.com";
  private readonly maxRequestsPerSecond = 10;
  private lastRequestTime = 0;

  constructor(apiKey: string, apiHost: string) {
    this.apiKey = apiKey;
    this.apiHost = apiHost;
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 1000 / this.maxRequestsPerSecond;

    if (timeSinceLastRequest < minInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, minInterval - timeSinceLastRequest),
      );
    }
    this.lastRequestTime = Date.now();
  }

  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    await this.rateLimit();

    const url = new URL(`${this.baseUrl}${endpoint}`);

    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });

    const options = {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": this.apiKey,
        "X-RapidAPI-Host": this.apiHost,
      },
    };

    try {
      const response = await fetch(url.toString(), options);

      if (!response.ok) {
        throw new DataProviderException(
          `HTTP ${response.status}: ${response.statusText}`,
          "HTTP_ERROR",
          "yahoo-finance",
          { status: response.status, statusText: response.statusText },
        );
      }

      const data = await response.json();

      // Yahoo Finance API doesn't always return consistent error formats
      if (data.error || (data.chart && data.chart.error)) {
        throw new DataProviderException(
          data.message || data.chart?.error?.description || "Unknown API error",
          "API_ERROR",
          "yahoo-finance",
          data,
        );
      }

      return data;
    } catch (error) {
      if (error instanceof DataProviderException) throw error;

      throw new DataProviderException(
        `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
        "NETWORK_ERROR",
        "yahoo-finance",
        error,
      );
    }
  }

  async getRealTimeQuote(symbols: string[]): Promise<MarketQuote[]> {
    if (symbols.length === 0) return [];

    try {
      // Yahoo Finance supports multiple symbols with comma separation
      const response = await this.makeRequest<{
        [symbol: string]: YahooFinanceQuote;
      }>("/market/v2/get-quotes", {
        symbols: symbols.join(","),
        region: "US",
        lang: "en",
      });

      const quotes: MarketQuote[] = [];

      for (const [symbol, data] of Object.entries(response)) {
        if (!data || !data.regularMarketPrice) continue;

        // Calculate bid/ask spread (simplified)
        const spread = this.calculateSpread(data.regularMarketPrice, symbol);
        const bid = data.regularMarketPrice - spread / 2;
        const ask = data.regularMarketPrice + spread / 2;

        quotes.push({
          symbol: data.symbol,
          bid,
          ask,
          price: data.regularMarketPrice,
          change: data.regularMarketChange || 0,
          changePercent: (data.regularMarketChangePercent || 0) / 100,
          volume: data.regularMarketVolume || 0,
          timestamp: new Date(data.regularMarketTime * 1000),
          spread,
        });
      }

      return quotes;
    } catch (error) {
      console.error(
        "Error fetching real-time quotes from Yahoo Finance:",
        error,
      );
      throw error;
    }
  }

  async getHistoricalData(
    symbol: string,
    timeframe: string,
    limit: number = 500,
  ): Promise<HistoricalData> {
    try {
      // Convert our timeframe to Yahoo Finance interval
      const interval = this.convertTimeframe(timeframe);
      const range = this.calculateRange(timeframe, limit);

      const response = await this.makeRequest<YahooFinanceChart>(
        "/market/v2/get-chart",
        {
          symbol: this.yahooSymbol(symbol),
          interval,
          range,
          region: "US",
          lang: "en",
        },
      );

      if (!response.chart?.result || response.chart.result.length === 0) {
        throw new DataProviderException(
          "No historical data available",
          "NO_DATA",
          "yahoo-finance",
          { symbol, timeframe },
        );
      }

      const result = response.chart.result[0];
      const quoteData = result.indicators.quote[0];

      if (!quoteData || !quoteData.close || quoteData.close.length === 0) {
        throw new DataProviderException(
          "Invalid historical data format",
          "INVALID_DATA",
          "yahoo-finance",
          { symbol, timeframe },
        );
      }

      const data: OHLCV[] = result.timestamps.map((timestamp, index) => ({
        timestamp: new Date(timestamp * 1000),
        open: quoteData.open[index] || 0,
        high: quoteData.high[index] || 0,
        low: quoteData.low[index] || 0,
        close: quoteData.close[index] || 0,
        volume: quoteData.volume[index] || 0,
      }));

      return {
        symbol,
        timeframe,
        data,
      };
    } catch (error) {
      console.error(
        "Error fetching historical data from Yahoo Finance:",
        error,
      );
      throw error;
    }
  }

  async getSymbolInfo(symbol: string): Promise<SymbolInfo> {
    try {
      const response = await this.makeRequest<{
        [symbol: string]: YahooFinanceQuote;
      }>("/market/v2/get-quotes", {
        symbols: this.yahooSymbol(symbol),
        region: "US",
        lang: "en",
      });

      const data = response[this.yahooSymbol(symbol)];
      if (!data || !data.shortName) {
        // Fallback to common forex pairs info
        return this.getForexPairInfo(symbol);
      }

      return {
        symbol: data.symbol,
        name: data.shortName,
        type: this.mapQuoteType(data.quoteType),
        exchange: data.fullExchangeName || "UNKNOWN",
        currency: data.currency,
        description: data.longName || data.shortName,
        minLot: 0.01,
        maxLot: 100.0,
        lotStep: 0.01,
        minStopLoss: 0.0001,
        minTakeProfit: 0.0001,
        swapLong: 0,
        swapShort: 0,
      };
    } catch (error) {
      console.error("Error fetching symbol info from Yahoo Finance:", error);
      // Fallback to common forex pairs info
      return this.getForexPairInfo(symbol);
    }
  }

  async searchSymbols(query: string): Promise<SymbolInfo[]> {
    try {
      const response = await this.makeRequest<YahooFinanceSearch>(
        "/auto-complete",
        {
          q: query,
          region: "US",
          lang: "en",
        },
      );

      if (!response.quotes || response.quotes.length === 0) {
        return [];
      }

      return response.quotes.slice(0, 20).map((quote) => ({
        symbol: quote.symbol,
        name: quote.shortname || quote.longname || quote.symbol,
        type: this.mapQuoteType(quote.quoteType),
        exchange: quote.exchDisp || "UNKNOWN",
        currency: "USD", // Yahoo Finance doesn't always provide currency in search
        description: quote.longname || quote.shortname,
        minLot: 0.01,
        maxLot: 100.0,
        lotStep: 0.01,
        minStopLoss: 0.0001,
        minTakeProfit: 0.0001,
        swapLong: 0,
        swapShort: 0,
      }));
    } catch (error) {
      console.error("Error searching symbols from Yahoo Finance:", error);
      return [];
    }
  }

  private calculateSpread(price: number, symbol: string): number {
    // Simplified spread calculation
    const pair = COMMON_FOREX_PAIRS.find((p) => p.symbol === symbol);
    if (pair) {
      return pair.pipSize * 2; // Typical 2-pip spread for major pairs
    }

    // Default spread calculation
    if (price < 1) {
      return 0.0001; // For pairs like USDJPY
    } else if (price < 100) {
      return 0.001; // For most forex pairs
    } else {
      return price * 0.0001; // For higher-priced instruments
    }
  }

  private convertTimeframe(timeframe: string): string {
    const timeframeMap: Record<string, string> = {
      "1min": "1m",
      "5min": "5m",
      "15min": "15m",
      "30min": "30m",
      "1h": "1h",
      "4h": "1d", // Yahoo Finance doesn't have 4h, fallback to daily
      "1day": "1d",
      "1week": "1wk",
      "1month": "1mo",
    };

    return timeframeMap[timeframe] || "1h";
  }

  private calculateRange(timeframe: string, limit: number): string {
    // Yahoo Finance uses predefined ranges instead of limit
    const duration =
      COMMON_TIMEFRAMES.find((tf) => tf.value === timeframe)?.seconds || 3600;
    const totalSeconds = duration * limit;

    if (totalSeconds <= 86400) return "1d"; // 1 day
    if (totalSeconds <= 604800) return "5d"; // 5 days
    if (totalSeconds <= 2592000) return "1mo"; // 1 month
    if (totalSeconds <= 7776000) return "3mo"; // 3 months
    if (totalSeconds <= 15552000) return "6mo"; // 6 months
    if (totalSeconds <= 31536000) return "1y"; // 1 year
    if (totalSeconds <= 63072000) return "2y"; // 2 years
    return "5y"; // 5 years
  }

  private yahooSymbol(symbol: string): string {
    // Convert forex symbols to Yahoo Finance format
    const pair = COMMON_FOREX_PAIRS.find((p) => p.symbol === symbol);
    if (pair) {
      return `${pair.base}${pair.quote}=X`;
    }
    return symbol;
  }

  private mapQuoteType(
    type: string,
  ): "forex" | "stock" | "crypto" | "commodity" {
    const typeMap: Record<string, "forex" | "stock" | "crypto" | "commodity"> =
      {
        CURRENCY: "forex",
        EQUITY: "stock",
        ETF: "stock",
        CRYPTOCURRENCY: "crypto",
        COMMODITY: "commodity",
        INDEX: "stock",
        FUTURE: "commodity",
      };

    return typeMap[type.toUpperCase()] || "forex";
  }

  private getForexPairInfo(symbol: string): SymbolInfo {
    const pair = COMMON_FOREX_PAIRS.find((p) => p.symbol === symbol);

    if (!pair) {
      throw new DataProviderException(
        `Unknown symbol: ${symbol}`,
        "UNKNOWN_SYMBOL",
        "yahoo-finance",
        { symbol },
      );
    }

    return {
      symbol: pair.symbol,
      name: `${pair.base}/${pair.quote}`,
      type: "forex",
      exchange: "FOREX",
      currency: pair.quote,
      description: `${pair.base} to ${pair.quote} exchange rate`,
      minLot: 0.01,
      maxLot: 100.0,
      lotStep: 0.01,
      minStopLoss: pair.pipSize,
      minTakeProfit: pair.pipSize,
      swapLong: 0,
      swapShort: 0,
    };
  }
}
