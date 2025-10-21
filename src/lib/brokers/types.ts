/**
 * Types and interfaces for the broker connection layer
 */

// Broker credentials for authentication
export interface BrokerCredentials {
  login: number;
  password: string;
  server: string;
  path?: string; // Path to MT5 terminal
  timeout?: number; // Connection timeout in milliseconds
}

// Account information from broker
export interface AccountInfo {
  login: number;
  server: string;
  currency: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  leverage: number;
  profit: number;
  marginFree: number;
  marginUsed: number;
  name: string;
  stopoutMode: number;
  stopoutLevel: number;
  tradeAllowed: boolean;
  tradeExpert: boolean;
}

// Symbol information
export interface SymbolInfo {
  symbol: string;
  description: string;
  base: string;
  quote: string;
  type: string; // FOREX, CFD, FUTURES, etc.
  digits: number;
  point: number;
  tickValue: number;
  tickSize: number;
  contractSize: number;
  volumeMin: number;
  volumeMax: number;
  volumeStep: number;
  spread: number;
  swapLong: number;
  swapShort: number;
  starting: number;
  expiration: number;
  tradeMode: number; // 0-disabled, 1-longonly, 2-shortonly, 3-both
  currencyBase: string;
  currencyProfit: string;
  currencyMargin: string;
  marginHedged: number;
  marginInitial: number;
  marginMaintenance: number;
  sessionOpen: number;
  sessionClose: number;
}

// Position information
export interface Position {
  ticket: number;
  symbol: string;
  type: 0 | 1; // 0-buy, 1-sell
  volume: number;
  priceOpen: number;
  priceCurrent: number;
  priceSL?: number;
  priceTP?: number;
  swap: number;
  profit: number;
  comment: string;
  openTime: Date;
  expiration: Date;
  magic: number;
  commission: number;
  storage: number;
  identifier: number;
}

// Order information
export interface Order {
  ticket: number;
  symbol: string;
  type: 0 | 1 | 2 | 3 | 4 | 5; // 0-buy, 1-sell, 2-buylimit, 3-selllimit, 4-buystop, 5-sellstop
  typeTime: number; // Order expiration type
  state: number; // Order state
  volume: number;
  priceOpen: number;
  priceSL?: number;
  priceTP?: number;
  priceCurrent: number;
  volumeCurrent: number;
  comment: string;
  openTime: Date;
  expiration: Date;
  magic: number;
  commission: number;
  storage: number;
  identifier: number;
  reason: number; // Order reason
}

// Market order for opening positions
export interface MarketOrder {
  symbol: string;
  type: 0 | 1; // 0-buy, 1-sell
  volume: number;
  price?: number; // Market price if not specified
  sl?: number; // Stop loss price
  tp?: number; // Take profit price
  comment?: string;
  magic?: number;
  deviation?: number; // Max price deviation
  type_filling?: number; // Order filling type
}

// Trade result from broker operations
export interface TradeResult {
  retcode: number; // Return code
  deal: number; // Deal ticket
  order: number; // Order ticket
  volume: number; // Deal volume
  price: number; // Deal price
  bid: number; // Current bid price
  ask: number; // Current ask price
  comment: string; // Broker comment
  request_id: number; // Request ID
  retcode_external: number; // External return code
  request: MarketOrder; // Original request
}

// Price information
export interface PriceInfo {
  symbol: string;
  time: number;
  bid: number;
  ask: number;
  last: number;
  volume: number;
}

// Error information
export interface BrokerError {
  code: number;
  message: string;
  details?: string;
}

// Connection status
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

// Trade operation type
export enum TradeOperation {
  BUY = 0,
  SELL = 1,
  BUY_LIMIT = 2,
  SELL_LIMIT = 3,
  BUY_STOP = 4,
  SELL_STOP = 5,
  BALANCE = 6,
  CREDIT = 7
}

// Order state
export enum OrderState {
  STARTED = 0,
  PLACED = 1,
  CANCELED = 2,
  PARTIAL = 3,
  FILLED = 4,
  REJECTED = 5,
  EXPIRED = 6,
  REQUEST_ADD = 7,
  REQUEST_MODIFY = 8,
  REQUEST_CANCEL = 9
}

// Order filling type
export enum OrderFilling {
  FOK = 0, // Fill or Kill
  IOC = 1, // Immediate or Cancel
  RETURN = 2 // Return
}

// Order time in force
export enum OrderTime {
  GTC = 0, // Good till Canceled
  DAY = 1, // Day
  SPECIFIED = 2, // Specified date
  SPECIFIED_DAY = 3 // Specified day
}

// Broker configuration options
export interface BrokerConfig {
  maxRetries: number;
  retryDelay: number; // in milliseconds
  connectionTimeout: number; // in milliseconds
  requestTimeout: number; // in milliseconds
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  reconnectAttempts: number;
  reconnectInterval: number; // in milliseconds
}

// Historical data request parameters
export interface HistoryRequest {
  symbol: string;
  timeframe: number; // Timeframe in minutes (1, 5, 15, 30, 60, 240, 1440, 10080, 43200)
  from: Date;
  to: Date;
}

// Candle data
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  spread: number;
  real_volume: number;
}

// Market data subscription
export interface MarketDataSubscription {
  symbol: string;
  type: 'tick' | 'bar';
  timeframe?: number; // Only for bar type
  callback: (data: PriceInfo | Candle) => void;
}

// Connection event types
export enum ConnectionEventType {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  RECONNECTING = 'reconnecting'
}

// Connection event
export interface ConnectionEvent {
  type: ConnectionEventType;
  timestamp: Date;
  data?: any;
  error?: BrokerError;
}