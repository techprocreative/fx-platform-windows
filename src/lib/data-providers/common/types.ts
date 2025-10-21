// Common types for market data providers

export interface MarketQuote {
  symbol: string;
  bid: number;
  ask: number;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: Date;
  spread: number;
}

export interface HistoricalData {
  symbol: string;
  timeframe: string;
  data: OHLCV[];
}

export interface OHLCV {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SymbolInfo {
  symbol: string;
  name: string;
  type: "forex" | "stock" | "crypto" | "commodity";
  exchange: string;
  currency: string;
  description?: string;
  minLot: number;
  maxLot: number;
  lotStep: number;
  minStopLoss: number;
  minTakeProfit: number;
  swapLong: number;
  swapShort: number;
}

export interface MarketDataProvider {
  getRealTimeQuote(symbols: string[]): Promise<MarketQuote[]>;
  getHistoricalData(
    symbol: string,
    timeframe: string,
    limit?: number,
  ): Promise<HistoricalData>;
  getSymbolInfo(symbol: string): Promise<SymbolInfo>;
  searchSymbols(query: string): Promise<SymbolInfo[]>;
}

export interface ForexPair {
  symbol: string;
  base: string;
  quote: string;
  pipSize: number;
  contractSize: number;
}

export interface Timeframe {
  label: string;
  value: string;
  seconds: number;
}

export const COMMON_FOREX_PAIRS: ForexPair[] = [
  // Major Forex Pairs
  {
    symbol: "EURUSD",
    base: "EUR",
    quote: "USD",
    pipSize: 0.0001,
    contractSize: 100000,
  },
  {
    symbol: "GBPUSD",
    base: "GBP",
    quote: "USD",
    pipSize: 0.0001,
    contractSize: 100000,
  },
  {
    symbol: "USDJPY",
    base: "USD",
    quote: "JPY",
    pipSize: 0.01,
    contractSize: 100000,
  },
  {
    symbol: "USDCHF",
    base: "USD",
    quote: "CHF",
    pipSize: 0.0001,
    contractSize: 100000,
  },
  {
    symbol: "AUDUSD",
    base: "AUD",
    quote: "USD",
    pipSize: 0.0001,
    contractSize: 100000,
  },
  {
    symbol: "USDCAD",
    base: "USD",
    quote: "CAD",
    pipSize: 0.0001,
    contractSize: 100000,
  },
  {
    symbol: "NZDUSD",
    base: "NZD",
    quote: "USD",
    pipSize: 0.0001,
    contractSize: 100000,
  },

  // Cross Currency Pairs
  {
    symbol: "EURGBP",
    base: "EUR",
    quote: "GBP",
    pipSize: 0.0001,
    contractSize: 100000,
  },
  {
    symbol: "EURJPY",
    base: "EUR",
    quote: "JPY",
    pipSize: 0.01,
    contractSize: 100000,
  },
  {
    symbol: "GBPJPY",
    base: "GBP",
    quote: "JPY",
    pipSize: 0.01,
    contractSize: 100000,
  },
  {
    symbol: "EURCHF",
    base: "EUR",
    quote: "CHF",
    pipSize: 0.0001,
    contractSize: 100000,
  },
  {
    symbol: "EURNZD",
    base: "EUR",
    quote: "NZD",
    pipSize: 0.0001,
    contractSize: 100000,
  },
  {
    symbol: "GBPCHF",
    base: "GBP",
    quote: "CHF",
    pipSize: 0.0001,
    contractSize: 100000,
  },
  {
    symbol: "GBPAUD",
    base: "GBP",
    quote: "AUD",
    pipSize: 0.0001,
    contractSize: 100000,
  },
  {
    symbol: "GBPCAD",
    base: "GBP",
    quote: "CAD",
    pipSize: 0.0001,
    contractSize: 100000,
  },
  {
    symbol: "EURCHF",
    base: "EUR",
    quote: "CHF",
    pipSize: 0.0001,
    contractSize: 100000,
  },
  {
    symbol: "EURAUD",
    base: "EUR",
    quote: "AUD",
    pipSize: 0.0001,
    contractSize: 100000,
  },
  {
    symbol: "EURCAD",
    base: "EUR",
    quote: "CAD",
    pipSize: 0.0001,
    contractSize: 100000,
  },
  {
    symbol: "AUDJPY",
    base: "AUD",
    quote: "JPY",
    pipSize: 0.01,
    contractSize: 100000,
  },
  {
    symbol: "AUDNZD",
    base: "AUD",
    quote: "NZD",
    pipSize: 0.0001,
    contractSize: 100000,
  },
  {
    symbol: "NZDJPY",
    base: "NZD",
    quote: "JPY",
    pipSize: 0.01,
    contractSize: 100000,
  },
];

export const COMMON_COMMODITIES: ForexPair[] = [
  // Precious Metals
  {
    symbol: "XAUUSD",
    base: "XAU",
    quote: "USD",
    pipSize: 0.1,
    contractSize: 100,
  },
  {
    symbol: "XAGUSD",
    base: "XAG",
    quote: "USD",
    pipSize: 0.001,
    contractSize: 5000,
  },

  // Energy
  {
    symbol: "USOIL",
    base: "USOIL",
    quote: "USD",
    pipSize: 0.01,
    contractSize: 1000,
  },
  {
    symbol: "UKOIL",
    base: "UKOIL",
    quote: "USD",
    pipSize: 0.01,
    contractSize: 1000,
  },
  {
    symbol: "NATGAS",
    base: "NATGAS",
    quote: "USD",
    pipSize: 0.001,
    contractSize: 10000,
  },

  // Industrial Metals
  {
    symbol: "COPPER",
    base: "COPPER",
    quote: "USD",
    pipSize: 0.0005,
    contractSize: 25000,
  },
  {
    symbol: "PLAT",
    base: "PLAT",
    quote: "USD",
    pipSize: 0.1,
    contractSize: 50,
  },
  {
    symbol: "PALLAD",
    base: "PALLAD",
    quote: "USD",
    pipSize: 0.05,
    contractSize: 100,
  },
];

export const COMMON_INDICES: ForexPair[] = [
  // US Indices
  { symbol: "US30", base: "US30", quote: "USD", pipSize: 1, contractSize: 1 },
  {
    symbol: "SPX500",
    base: "SPX500",
    quote: "USD",
    pipSize: 0.1,
    contractSize: 1,
  },
  {
    symbol: "NAS100",
    base: "NAS100",
    quote: "USD",
    pipSize: 0.5,
    contractSize: 1,
  },

  // European Indices
  { symbol: "UK100", base: "UK100", quote: "GBP", pipSize: 1, contractSize: 1 },
  { symbol: "GER40", base: "GER40", quote: "EUR", pipSize: 1, contractSize: 1 },
  { symbol: "FRA40", base: "FRA40", quote: "EUR", pipSize: 1, contractSize: 1 },
  { symbol: "ESP35", base: "ESP35", quote: "EUR", pipSize: 1, contractSize: 1 },

  // Asian Indices
  {
    symbol: "JPN225",
    base: "JPN225",
    quote: "JPY",
    pipSize: 50,
    contractSize: 1,
  },
  { symbol: "CHN50", base: "CHN50", quote: "USD", pipSize: 1, contractSize: 1 },
  {
    symbol: "AUS200",
    base: "AUS200",
    quote: "AUD",
    pipSize: 1,
    contractSize: 1,
  },
];

export const COMMON_CRYPTO: ForexPair[] = [
  { symbol: "BTCUSD", base: "BTC", quote: "USD", pipSize: 1, contractSize: 1 },
  {
    symbol: "ETHUSD",
    base: "ETH",
    quote: "USD",
    pipSize: 0.01,
    contractSize: 1,
  },
  {
    symbol: "LTCUSD",
    base: "LTC",
    quote: "USD",
    pipSize: 0.01,
    contractSize: 1,
  },
  {
    symbol: "XRPUSD",
    base: "XRP",
    quote: "USD",
    pipSize: 0.0001,
    contractSize: 1,
  },
  {
    symbol: "BCHUSD",
    base: "BCH",
    quote: "USD",
    pipSize: 0.1,
    contractSize: 1,
  },
];

export const COMMON_TIMEFRAMES: Timeframe[] = [
  { label: "M1", value: "1min", seconds: 60 },
  { label: "M5", value: "5min", seconds: 300 },
  { label: "M15", value: "15min", seconds: 900 },
  { label: "M30", value: "30min", seconds: 1800 },
  { label: "H1", value: "1h", seconds: 3600 },
  { label: "H4", value: "4h", seconds: 14400 },
  { label: "D1", value: "1day", seconds: 86400 },
  { label: "W1", value: "1week", seconds: 604800 },
  { label: "MN1", value: "1month", seconds: 2592000 },
];

export interface DataProviderError extends Error {
  code: string;
  provider: string;
  details?: any;
}

export class DataProviderException extends Error implements DataProviderError {
  constructor(
    message: string,
    public code: string,
    public provider: string,
    public details?: any,
  ) {
    super(message);
    this.name = "DataProviderException";
  }
}
