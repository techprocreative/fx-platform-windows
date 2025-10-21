import {
  MarketDataProvider,
  MarketQuote,
  HistoricalData,
  SymbolInfo,
  OHLCV,
  DataProviderException,
  COMMON_FOREX_PAIRS,
  COMMON_COMMODITIES,
  COMMON_INDICES,
  COMMON_CRYPTO,
  COMMON_TIMEFRAMES,
} from "../common/types";

interface TwelveDataQuote {
  symbol: string;
  price: number;
  change: number;
  changes_percentage: number;
  day_high: number;
  day_low: number;
  volume: number;
  previous_close: number;
  timestamp: string;
}

interface TwelveDataHistorical {
  values: Array<{
    datetime: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  status: string;
  symbol: string;
  interval: string;
}

interface TwelveDataSymbol {
  symbol: string;
  instrument_name: string;
  exchange: string;
  mic_code: string;
  exchange_timezone: string;
  instrument_type: string;
  country: string;
  currency: string;
}

export class TwelveDataProvider implements MarketDataProvider {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.twelvedata.com";
  private readonly maxRequestsPerSecond = 8;
  private lastRequestTime = 0;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
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
    url.searchParams.set("apikey", this.apiKey);

    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });

    try {
      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new DataProviderException(
          `HTTP ${response.status}: ${response.statusText}`,
          "HTTP_ERROR",
          "twelvedata",
          { status: response.status, statusText: response.statusText },
        );
      }

      const data = await response.json();

      if (data.status === "error" || data.code) {
        throw new DataProviderException(
          data.message || "Unknown API error",
          data.code || "API_ERROR",
          "twelvedata",
          data,
        );
      }

      return data;
    } catch (error) {
      if (error instanceof DataProviderException) throw error;

      throw new DataProviderException(
        `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
        "NETWORK_ERROR",
        "twelvedata",
        error,
      );
    }
  }

  async getRealTimeQuote(symbols: string[]): Promise<MarketQuote[]> {
    if (symbols.length === 0) return [];

    try {
      // TwelveData allows multiple symbols in one request
      const response = await this.makeRequest<{
        [symbol: string]: TwelveDataQuote;
      }>("/quote", {
        symbol: symbols.join(","),
        format: "json",
      });

      const quotes: MarketQuote[] = [];

      for (const [symbol, data] of Object.entries(response)) {
        if (!data || !data.price) continue;

        // Calculate bid/ask spread (simplified - would need order book for real spread)
        const spread = this.calculateSpread(data.price, symbol);
        const bid = data.price - spread / 2;
        const ask = data.price + spread / 2;

        quotes.push({
          symbol: data.symbol,
          bid,
          ask,
          price: data.price,
          change: data.change || 0,
          changePercent: parseFloat(String(data.changes_percentage)) || 0,
          volume: data.volume || 0,
          timestamp: new Date(data.timestamp),
          spread,
        });
      }

      return quotes;
    } catch (error) {
      console.error("Error fetching real-time quotes from TwelveData:", error);
      throw error;
    }
  }

  async getHistoricalData(
    symbol: string,
    timeframe: string,
    limit: number = 500,
  ): Promise<HistoricalData> {
    try {
      // Convert our timeframe format to TwelveData format
      const interval = this.convertTimeframe(timeframe);

      const response = await this.makeRequest<TwelveDataHistorical>(
        "/time_series",
        {
          symbol,
          interval,
          outputsize: Math.min(limit, 5000).toString(),
          format: "json",
        },
      );

      if (!response.values || response.values.length === 0) {
        throw new DataProviderException(
          "No historical data available",
          "NO_DATA",
          "twelvedata",
          { symbol, timeframe },
        );
      }

      const data: OHLCV[] = response.values
        .map((candle) => ({
          timestamp: new Date(candle.datetime),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume || 0,
        }))
        .reverse(); // Reverse to get chronological order

      return {
        symbol,
        timeframe,
        data,
      };
    } catch (error) {
      console.error("Error fetching historical data from TwelveData:", error);
      throw error;
    }
  }

  async getSymbolInfo(symbol: string): Promise<SymbolInfo> {
    try {
      // Try to get symbol info from TwelveData
      const response = await this.makeRequest<{
        [symbol: string]: TwelveDataSymbol;
      }>("/symbol_search", {
        symbol,
        outputsize: "1",
      });

      const symbolData = response[symbol];
      if (!symbolData) {
        // Fallback to common forex pairs info
        return this.getForexPairInfo(symbol);
      }

      return {
        symbol: symbolData.symbol,
        name: symbolData.instrument_name,
        type: this.mapInstrumentType(symbolData.instrument_type),
        exchange: symbolData.exchange,
        currency: symbolData.currency,
        description: symbolData.instrument_name,
        minLot: 0.01,
        maxLot: 100.0,
        lotStep: 0.01,
        minStopLoss: 0.0001,
        minTakeProfit: 0.0001,
        swapLong: 0,
        swapShort: 0,
      };
    } catch (error) {
      console.error("Error fetching symbol info from TwelveData:", error);
      // Fallback to common forex pairs info
      return this.getForexPairInfo(symbol);
    }
  }

  async searchSymbols(query: string): Promise<SymbolInfo[]> {
    try {
      const response = await this.makeRequest<{ data: TwelveDataSymbol[] }>(
        "/symbol_search",
        {
          symbol: query,
          outputsize: "20",
        },
      );

      if (!response.data || response.data.length === 0) {
        return [];
      }

      return response.data.map((symbol) => ({
        symbol: symbol.symbol,
        name: symbol.instrument_name,
        type: this.mapInstrumentType(symbol.instrument_type),
        exchange: symbol.exchange,
        currency: symbol.currency,
        description: symbol.instrument_name,
        minLot: 0.01,
        maxLot: 100.0,
        lotStep: 0.01,
        minStopLoss: 0.0001,
        minTakeProfit: 0.0001,
        swapLong: 0,
        swapShort: 0,
      }));
    } catch (error) {
      console.error("Error searching symbols from TwelveData:", error);
      return [];
    }
  }

  private calculateSpread(price: number, symbol: string): number {
    // Check forex pairs first
    const forexPair = COMMON_FOREX_PAIRS.find((p) => p.symbol === symbol);
    if (forexPair) {
      return forexPair.pipSize * 2; // Typical 2-pip spread for major pairs
    }

    // Check commodities
    const commodity = COMMON_COMMODITIES.find((c) => c.symbol === symbol);
    if (commodity) {
      return commodity.pipSize * 5; // Wider spreads for commodities
    }

    // Check indices
    const index = COMMON_INDICES.find((i) => i.symbol === symbol);
    if (index) {
      return index.pipSize * 2; // Typical spread for indices
    }

    // Check crypto
    const crypto = COMMON_CRYPTO.find((c) => c.symbol === symbol);
    if (crypto) {
      return crypto.pipSize * 10; // Wider spreads for crypto
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
      "1min": "1min",
      "5min": "5min",
      "15min": "15min",
      "30min": "30min",
      "1h": "1h",
      "4h": "4h",
      "1day": "1day",
      "1week": "1week",
      "1month": "1month",
    };

    return timeframeMap[timeframe] || "1h";
  }

  private mapInstrumentType(
    type: string,
  ): "forex" | "stock" | "crypto" | "commodity" {
    const typeMap: Record<string, "forex" | "stock" | "crypto" | "commodity"> =
      {
        currency: "forex",
        common_stock: "stock",
        etf: "stock",
        crypto: "crypto",
        commodity: "commodity",
        index: "stock",
      };

    return typeMap[type.toLowerCase()] || "forex";
  }

  private getForexPairInfo(symbol: string): SymbolInfo {
    // Check forex pairs first
    const forexPair = COMMON_FOREX_PAIRS.find((p) => p.symbol === symbol);
    if (forexPair) {
      return {
        symbol: forexPair.symbol,
        name: `${forexPair.base}/${forexPair.quote}`,
        type: "forex",
        exchange: "FOREX",
        currency: forexPair.quote,
        description: `${forexPair.base}/${forexPair.quote} Forex Pair`,
        minLot: 0.01,
        maxLot: 100.0,
        lotStep: 0.01,
        minStopLoss: forexPair.pipSize * 5,
        minTakeProfit: forexPair.pipSize * 5,
        swapLong: 0,
        swapShort: 0,
      };
    }

    // Check commodities
    const commodity = COMMON_COMMODITIES.find((c) => c.symbol === symbol);
    if (commodity) {
      const commodityNames: Record<string, string> = {
        XAUUSD: "Gold vs US Dollar",
        XAGUSD: "Silver vs US Dollar",
        USOIL: "WTI Crude Oil",
        UKOIL: "Brent Crude Oil",
        NATGAS: "Natural Gas",
        COPPER: "Copper",
        PLAT: "Platinum",
        PALLAD: "Palladium",
      };

      return {
        symbol: commodity.symbol,
        name: commodityNames[symbol] || `${commodity.base}/${commodity.quote}`,
        type: "commodity",
        exchange: "COMEX",
        currency: "USD",
        description:
          commodityNames[symbol] ||
          `${commodity.base}/${commodity.quote} Commodity`,
        minLot: 0.01,
        maxLot: 50.0,
        lotStep: 0.01,
        minStopLoss: commodity.pipSize * 10,
        minTakeProfit: commodity.pipSize * 10,
        swapLong: 0,
        swapShort: 0,
      };
    }

    // Check indices
    const index = COMMON_INDICES.find((i) => i.symbol === symbol);
    if (index) {
      const indexNames: Record<string, string> = {
        US30: "Dow Jones Industrial Average",
        SPX500: "S&P 500",
        NAS100: "NASDAQ 100",
        UK100: "FTSE 100",
        GER40: "DAX",
        FRA40: "CAC 40",
        ESP35: "IBEX 35",
        JPN225: "Nikkei 225",
        CHN50: "China A50",
        AUS200: "ASX 200",
      };

      return {
        symbol: index.symbol,
        name: indexNames[symbol] || `${index.base}/${index.quote}`,
        type: "stock", // Indices are treated as stock type
        exchange: "INDEX",
        currency: index.quote,
        description: indexNames[symbol] || `${index.base}/${index.quote} Index`,
        minLot: 0.01,
        maxLot: 100.0,
        lotStep: 0.01,
        minStopLoss: index.pipSize * 5,
        minTakeProfit: index.pipSize * 5,
        swapLong: 0,
        swapShort: 0,
      };
    }

    // Check crypto
    const crypto = COMMON_CRYPTO.find((c) => c.symbol === symbol);
    if (crypto) {
      const cryptoNames: Record<string, string> = {
        BTCUSD: "Bitcoin vs US Dollar",
        ETHUSD: "Ethereum vs US Dollar",
        LTCUSD: "Litecoin vs US Dollar",
        XRPUSD: "Ripple vs US Dollar",
        BCHUSD: "Bitcoin Cash vs US Dollar",
      };

      return {
        symbol: crypto.symbol,
        name: cryptoNames[symbol] || `${crypto.base}/${crypto.quote}`,
        type: "crypto",
        exchange: "CRYPTO",
        currency: "USD",
        description:
          cryptoNames[symbol] ||
          `${crypto.base}/${crypto.quote} Cryptocurrency`,
        minLot: 0.001,
        maxLot: 10.0,
        lotStep: 0.001,
        minStopLoss: crypto.pipSize * 20,
        minTakeProfit: crypto.pipSize * 20,
        swapLong: 0,
        swapShort: 0,
      };
    }

    throw new DataProviderException(
      `Unknown symbol: ${symbol}`,
      "UNKNOWN_SYMBOL",
      "twelvedata",
      { symbol },
    );
  }
}
