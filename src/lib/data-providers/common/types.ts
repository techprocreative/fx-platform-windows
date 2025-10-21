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
  type: 'forex' | 'stock' | 'crypto' | 'commodity';
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
  getHistoricalData(symbol: string, timeframe: string, limit?: number): Promise<HistoricalData>;
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
  { symbol: 'EURUSD', base: 'EUR', quote: 'USD', pipSize: 0.0001, contractSize: 100000 },
  { symbol: 'GBPUSD', base: 'GBP', quote: 'USD', pipSize: 0.0001, contractSize: 100000 },
  { symbol: 'USDJPY', base: 'USD', quote: 'JPY', pipSize: 0.01, contractSize: 100000 },
  { symbol: 'USDCHF', base: 'USD', quote: 'CHF', pipSize: 0.0001, contractSize: 100000 },
  { symbol: 'AUDUSD', base: 'AUD', quote: 'USD', pipSize: 0.0001, contractSize: 100000 },
  { symbol: 'USDCAD', base: 'USD', quote: 'CAD', pipSize: 0.0001, contractSize: 100000 },
  { symbol: 'NZDUSD', base: 'NZD', quote: 'USD', pipSize: 0.0001, contractSize: 100000 },
  { symbol: 'EURGBP', base: 'EUR', quote: 'GBP', pipSize: 0.0001, contractSize: 100000 },
  { symbol: 'EURJPY', base: 'EUR', quote: 'JPY', pipSize: 0.01, contractSize: 100000 },
  { symbol: 'GBPJPY', base: 'GBP', quote: 'JPY', pipSize: 0.01, contractSize: 100000 },
  { symbol: 'EURCHF', base: 'EUR', quote: 'CHF', pipSize: 0.0001, contractSize: 100000 },
  { symbol: 'EURNZD', base: 'EUR', quote: 'NZD', pipSize: 0.0001, contractSize: 100000 },
  { symbol: 'GBPCHF', base: 'GBP', quote: 'CHF', pipSize: 0.0001, contractSize: 100000 },
  { symbol: 'GBPAUD', base: 'GBP', quote: 'AUD', pipSize: 0.0001, contractSize: 100000 },
  { symbol: 'GBPCAD', base: 'GBP', quote: 'CAD', pipSize: 0.0001, contractSize: 100000 },
];

export const COMMON_TIMEFRAMES: Timeframe[] = [
  { label: 'M1', value: '1min', seconds: 60 },
  { label: 'M5', value: '5min', seconds: 300 },
  { label: 'M15', value: '15min', seconds: 900 },
  { label: 'M30', value: '30min', seconds: 1800 },
  { label: 'H1', value: '1h', seconds: 3600 },
  { label: 'H4', value: '4h', seconds: 14400 },
  { label: 'D1', value: '1day', seconds: 86400 },
  { label: 'W1', value: '1week', seconds: 604800 },
  { label: 'MN1', value: '1month', seconds: 2592000 },
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
    public details?: any
  ) {
    super(message);
    this.name = 'DataProviderException';
  }
}
