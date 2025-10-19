/**
 * Types and interfaces for the Trade Execution Safety Layer
 * 
 * This file contains all the type definitions for the trading execution system,
 * including interfaces for trade signals, execution results, and validation.
 */

import { TradeParams, TradeResult, ValidationResult } from '../risk/types';
import { MarketOrder } from '../brokers/types';

/**
 * Trade signal interface representing a trading decision
 */
export interface TradeSignal extends TradeParams {
  /** Unique identifier for the trade signal */
  id: string;
  /** Timestamp when the signal was generated */
  timestamp: Date;
  /** Confidence level of the signal (0-100) */
  confidence: number;
  /** Expected price movement in pips */
  expectedMove?: number;
  /** Timeframe for the expected move */
  timeframe?: string;
  /** Source of the signal (manual, strategy, AI, etc.) */
  source: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Execution result interface for trade execution outcomes
 */
export interface ExecutionResult {
  /** Unique identifier for the execution */
  id: string;
  /** Whether the execution was successful */
  success: boolean;
  /** Trade ticket number if successful */
  ticket?: number;
  /** Execution price */
  executionPrice?: number;
  /** Executed lot size */
  executedLotSize?: number;
  /** Slippage in pips */
  slippage?: number;
  /** Commission paid */
  commission?: number;
  /** Swap charged */
  swap?: number;
  /** Error message if execution failed */
  error?: string;
  /** Execution timestamp */
  timestamp: Date;
  /** Time taken to execute in milliseconds */
  executionTime: number;
  /** Number of retry attempts */
  retryAttempts: number;
  /** Original trade signal */
  signal: TradeSignal;
  /** Additional execution details */
  details?: Record<string, any>;
}

/**
 * Extended validation result with additional context
 */
export interface ExtendedValidationResult extends ValidationResult {
  /** Validation timestamp */
  timestamp: Date;
  /** Validation check details */
  checks: ValidationCheck[];
  /** Overall risk score (0-100) */
  riskScore?: number;
  /** Recommended actions */
  recommendations?: string[];
}

/**
 * Individual validation check result
 */
export interface ValidationCheck {
  /** Name of the validation check */
  name: string;
  /** Whether the check passed */
  passed: boolean;
  /** Check result message */
  message: string;
  /** Severity level */
  severity: 'info' | 'warning' | 'error' | 'critical';
  /** Time taken to perform check in milliseconds */
  duration: number;
  /** Additional check data */
  data?: Record<string, any>;
}

/**
 * Market hours information
 */
export interface MarketHours {
  /** Whether the market is currently open */
  isOpen: boolean;
  /** Market open time */
  openTime?: Date;
  /** Market close time */
  closeTime?: Date;
  /** Time until market opens/closes in minutes */
  timeUntilEvent?: number;
  /** Current session */
  session?: 'asian' | 'london' | 'newyork' | 'closed';
  /** Trading status message */
  message?: string;
}

/**
 * Symbol trading information
 */
export interface SymbolTradingInfo {
  /** Symbol name */
  symbol: string;
  /** Whether symbol is tradeable */
  tradeable: boolean;
  /** Current spread in pips */
  spread: number;
  /** Maximum allowed spread in pips */
  maxSpread: number;
  /** Whether spread is acceptable */
  spreadAcceptable: boolean;
  /** Current bid price */
  bid: number;
  /** Current ask price */
  ask: number;
  /** Point value */
  point: number;
  /** Digits after decimal point */
  digits: number;
  /** Minimum lot size */
  minLot: number;
  /** Maximum lot size */
  maxLot: number;
  /** Lot step */
  lotStep: number;
  /** Margin required per lot */
  marginPerLot: number;
  /** Whether trading is allowed */
  tradingAllowed: boolean;
}

/**
 * Connection status information
 */
export interface ConnectionStatus {
  /** Whether connected to broker */
  connected: boolean;
  /** Connection latency in milliseconds */
  latency?: number;
  /** Last connection check timestamp */
  lastCheck: Date;
  /** Connection status message */
  message?: string;
  /** Number of reconnection attempts */
  reconnectAttempts?: number;
}

/**
 * News event information
 */
export interface NewsEvent {
  /** Event ID */
  id: string;
  /** Event title */
  title: string;
  /** Event currency */
  currency: string;
  /** Event impact level */
  impact: 'low' | 'medium' | 'high';
  /** Event timestamp */
  timestamp: Date;
  /** Forecast value */
  forecast?: string;
  /** Previous value */
  previous?: string;
  /** Actual value */
  actual?: string;
  /** Minutes until event */
  minutesUntil?: number;
  /** Whether trading should be avoided during this event */
  avoidTrading: boolean;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay between retries in milliseconds */
  initialDelay: number;
  /** Backoff multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Maximum delay between retries in milliseconds */
  maxDelay: number;
  /** Whether to use jitter */
  useJitter: boolean;
}

/**
 * Notification configuration
 */
export interface NotificationConfig {
  /** Whether to send notifications on successful execution */
  notifyOnSuccess: boolean;
  /** Whether to send notifications on failed execution */
  notifyOnFailure: boolean;
  /** Notification channels */
  channels: ('email' | 'sms' | 'push' | 'webhook')[];
  /** Additional notification recipients */
  additionalRecipients?: string[];
}

/**
 * Trade record for database storage
 */
export interface TradeRecord {
  /** Unique identifier */
  id: string;
  /** User ID */
  userId: string;
  /** Strategy ID if applicable */
  strategyId?: string;
  /** Trade ticket number */
  ticket?: number;
  /** Symbol */
  symbol: string;
  /** Trade type */
  type: 'BUY' | 'SELL';
  /** Lot size */
  lotSize: number;
  /** Entry price */
  entryPrice?: number;
  /** Stop loss price */
  stopLoss?: number;
  /** Take profit price */
  takeProfit?: number;
  /** Exit price */
  exitPrice?: number;
  /** Profit/loss */
  profit?: number;
  /** Commission */
  commission?: number;
  /** Swap */
  swap?: number;
  /** Open time */
  openTime?: Date;
  /** Close time */
  closeTime?: Date;
  /** Trade status */
  status: 'pending' | 'open' | 'closed' | 'cancelled' | 'failed';
  /** Trade comment */
  comment?: string;
  /** Magic number */
  magicNumber?: number;
  /** Source of the trade signal */
  source: string;
  /** Execution time in milliseconds */
  executionTime?: number;
  /** Number of retry attempts */
  retryAttempts?: number;
  /** Error message if failed */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Order interface (if not already defined in brokers/types.ts)
 */
export interface Order {
  /** Order ticket number */
  ticket: number;
  /** Symbol */
  symbol: string;
  /** Order type */
  type: 'BUY' | 'SELL' | 'BUY_LIMIT' | 'SELL_LIMIT' | 'BUY_STOP' | 'SELL_STOP';
  /** Order volume */
  volume: number;
  /** Order price */
  price: number;
  /** Stop loss price */
  stopLoss?: number;
  /** Take profit price */
  takeProfit?: number;
  /** Order comment */
  comment?: string;
  /** Magic number */
  magicNumber?: number;
  /** Order state */
  state: 'placed' | 'filled' | 'partial' | 'cancelled' | 'rejected' | 'expired';
  /** Order timestamp */
  timestamp: Date;
  /** Fill timestamp */
  fillTimestamp?: Date;
  /** Filled volume */
  filledVolume?: number;
  /** Average fill price */
  avgFillPrice?: number;
  /** Remaining volume */
  remainingVolume?: number;
  /** User ID */
  userId: string;
  /** Strategy ID if applicable */
  strategyId?: string;
}