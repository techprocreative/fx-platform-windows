/**
 * Risk Management System Types
 *
 * This file contains all the type definitions for the Risk Management System,
 * including interfaces for risk parameters, validation results, and trade parameters.
 */

import { DynamicRiskParams, SessionFilter, CorrelationFilter, RegimeDetectionConfig } from "../../types";

export interface RiskParameters {
  /** Maximum risk per trade as percentage of balance (e.g., 2%) */
  maxRiskPerTrade: number;
  /** Maximum daily loss as percentage of balance (e.g., 6%) */
  maxDailyLoss: number;
  /** Maximum drawdown as percentage of balance (e.g., 20%) */
  maxDrawdown: number;
  /** Maximum number of concurrent positions (e.g., 5) */
  maxPositions: number;
  /** Maximum leverage allowed (e.g., 1:100) */
  maxLeverage: number;
  /** Minimum stop loss distance in pips */
  minStopLossDistance: number;
  /** Maximum lot size per trade */
  maxLotSize: number;
}

export interface RiskExposure {
  /** Current account balance */
  balance: number;
  /** Current total risk exposure in monetary value */
  totalRiskExposure: number;
  /** Current risk exposure as percentage of balance */
  riskExposurePercent: number;
  /** Number of currently open positions */
  openPositions: number;
  /** Total daily loss so far */
  dailyLoss: number;
  /** Daily loss as percentage of balance */
  dailyLossPercent: number;
  /** Current drawdown */
  currentDrawdown: number;
  /** Current drawdown as percentage of balance */
  drawdownPercent: number;
  /** Available margin for new positions */
  availableMargin: number;
  /** Whether risk limits are exceeded */
  limitsExceeded: boolean;
  /** Array of specific limit violations */
  violations: RiskViolation[];
}

export interface RiskViolation {
  /** Type of risk limit violation */
  type:
    | "MAX_DAILY_LOSS"
    | "MAX_DRAWDOWN"
    | "MAX_POSITIONS"
    | "MAX_RISK_EXPOSURE"
    | "MAX_LEVERAGE";
  /** Current value that triggered the violation */
  currentValue: number;
  /** Limit that was exceeded */
  limit: number;
  /** Severity of the violation */
  severity: "WARNING" | "CRITICAL" | "EMERGENCY";
  /** Description of the violation */
  message: string;
}

export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  /** Array of validation errors */
  errors: string[];
  /** Array of validation warnings */
  warnings: string[];
  /** Suggested adjusted parameters if validation failed */
  adjustedParams?: TradeParams;
}

export interface TradeParams {
  /** Trading symbol (e.g., 'EURUSD') */
  symbol: string;
  /** Trade type: BUY or SELL */
  type: "BUY" | "SELL";
  /** Requested lot size */
  lotSize: number;
  /** Entry price */
  entryPrice: number;
  /** Stop loss price */
  stopLoss: number;
  /** Take profit price */
  takeProfit?: number;
  /** Trade comment or identifier */
  comment?: string;
  /** Magic number for trade identification */
  magicNumber?: number;
  /** User ID placing the trade */
  userId: string;
  /** Strategy ID if trade is from a strategy */
  strategyId?: string;
  /** Current ATR value for dynamic risk management */
  currentATR?: number;
  /** Dynamic risk parameters */
  dynamicRisk?: DynamicRiskParams;
  /** Session filter parameters */
  sessionFilter?: SessionFilter;
  /** Correlation filter parameters */
  correlationFilter?: CorrelationFilter;
  /** Regime detection parameters */
  regimeDetection?: RegimeDetectionConfig;
  /** Timeframe for the trade */
  timeframe?: string;
}

export interface Position {
  /** Position ticket number */
  ticket: number;
  /** Trading symbol */
  symbol: string;
  /** Trade type: BUY or SELL */
  type: "BUY" | "SELL";
  /** Position size in lots */
  lotSize: number;
  /** Opening price */
  openPrice: number;
  /** Current price */
  currentPrice: number;
  /** Stop loss price */
  stopLoss?: number;
  /** Take profit price */
  takeProfit?: number;
  /** Position profit/loss */
  profit: number;
  /** Position swap */
  swap: number;
  /** Opening time */
  openTime: Date;
  /** User ID who owns the position */
  userId: string;
}

export interface TradeResult {
  /** Whether the trade was successful */
  success: boolean;
  /** Trade ticket number if successful */
  ticket?: number;
  /** Execution price */
  executionPrice?: number;
  /** Executed lot size */
  executedLotSize?: number;
  /** Error message if trade failed */
  error?: string;
  /** Execution timestamp */
  timestamp: Date;
}

export interface AccountInfo {
  /** Account balance */
  balance: number;
  /** Account equity */
  equity: number;
  /** Used margin */
  margin: number;
  /** Free margin */
  freeMargin: number;
  /** Margin level percentage */
  marginLevel: number;
  /** Account leverage */
  leverage: number;
  /** Current profit/loss */
  profit?: number;
  /** Number of open positions */
  openPositions?: number;
  /** Account number */
  accountNumber?: string;
  /** Account type */
  accountType?: string;
  /** Account currency */
  currency?: string;
  /** Server name */
  server?: string;
  /** Company name */
  company?: string;
  /** Account name */
  name?: string;
  /** Whether trading is allowed */
  tradeAllowed?: boolean;
  /** Whether expert advisors are allowed */
  tradeExpertAllowed?: boolean;
}

export interface SymbolInfo {
  /** Symbol name */
  symbol: string;
  /** Point value (smallest price change) */
  point: number;
  /** Trade contract size */
  contractSize: number;
  /** Minimum lot size */
  minLot: number;
  /** Maximum lot size */
  maxLot: number;
  /** Lot step */
  lotStep: number;
  /** Digits after decimal point */
  digits: number;
  /** Spread in points */
  spread: number;
  /** Whether trading is allowed */
  tradeAllowed: boolean;
}

export interface EmergencyCloseResult {
  /** Total number of positions closed */
  positionsClosed: number;
  /** Total profit/loss from closed positions */
  totalPnL: number;
  /** Array of individual position close results */
  results: TradeResult[];
  /** Whether the operation was completely successful */
  success: boolean;
  /** Any errors encountered during the process */
  errors: string[];
}
