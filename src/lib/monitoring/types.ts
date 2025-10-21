/**
 * Types and interfaces for the real-time position monitoring system
 */

import { Position } from '../brokers/types';

// Extended Position interface with monitoring-specific properties
export interface MonitoredPosition extends Position {
  // Additional monitoring properties
  unrealizedPnL?: number;
  realizedPnL?: number;
  totalPnL?: number;
  pipValue?: number;
  marginUsed?: number;
  riskPercent?: number;
  lastUpdated?: Date;
  priceHistory?: PricePoint[];
  alerts?: PositionAlert[];
}

// Price point for tracking price history
export interface PricePoint {
  timestamp: Date;
  price: number;
  type: 'bid' | 'ask';
}

// P&L Report interface
export interface PnLReport {
  totalUnrealizedPnL: number;
  totalRealizedPnL: number;
  totalPnL: number;
  positions: PositionPnL[];
  currency: string;
  timestamp: Date;
  accountBalance?: number;
  accountEquity?: number;
  dailyPnL?: number;
  weeklyPnL?: number;
  monthlyPnL?: number;
}

// P&L for individual position
export interface PositionPnL {
  ticket: number;
  symbol: string;
  type: 0 | 1; // 0-buy, 1-sell
  volume: number;
  openPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
  totalPnL: number;
  pips: number;
  commission: number;
  swap: number;
  currency: string;
  marginUsed: number;
}

// Anomaly detection interface
export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  positionId?: number;
  symbol?: string;
  description: string;
  timestamp: Date;
  value?: number;
  expectedValue?: number;
  threshold?: number;
  confidence?: number;
  resolved: boolean;
  resolvedAt?: Date;
  actions?: AnomalyAction[];
}

// Anomaly types
export enum AnomalyType {
  PRICE_SPIKE = 'price_spike',
  UNUSUAL_VOLUME = 'unusual_volume',
  MARGIN_CALL = 'margin_call',
  STOP_LOSS_HIT = 'stop_loss_hit',
  TAKE_PROFIT_HIT = 'take_profit_hit',
  POSITION_TIMEOUT = 'position_timeout',
  CONNECTION_LOSS = 'connection_loss',
  RAPID_DRAWDOWN = 'rapid_drawdown',
  UNAUTHORIZED_TRADE = 'unauthorized_trade',
  SYSTEM_ERROR = 'system_error'
}

// Anomaly severity levels
export enum AnomalySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Actions to take for anomalies
export interface AnomalyAction {
  type: 'notify' | 'close_position' | 'reduce_position' | 'stop_trading' | 'manual_review';
  description: string;
  executed: boolean;
  executedAt?: Date;
  result?: string;
}

// Position subscription interface
export interface PositionSubscription {
  id: string;
  userId: string;
  symbols?: string[];
  callback: (positions: MonitoredPosition[]) => void;
  active: boolean;
  createdAt: Date;
  lastUpdate?: Date;
}

// Monitoring configuration
export interface MonitoringConfig {
  // Update intervals (in milliseconds)
  positionUpdateInterval: number;
  priceUpdateInterval: number;
  pnlUpdateInterval: number;
  
  // Anomaly detection thresholds
  priceSpikeThreshold: number; // Percentage
  volumeThreshold: number; // Multiple of average
  drawdownThreshold: number; // Percentage
  marginCallThreshold: number; // Percentage
  
  // Position monitoring
  maxPositionAge: number; // In milliseconds
  enablePriceHistory: boolean;
  priceHistorySize: number; // Number of points to keep
  
  // Alerts
  enableAlerts: boolean;
  alertChannels: AlertChannel[];
  
  // Risk management
  maxRiskPerPosition: number; // Percentage
  maxTotalRisk: number; // Percentage
  emergencyStop: boolean;
  
  // Logging
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// Alert channels
export interface AlertChannel {
  type: 'email' | 'sms' | 'push' | 'webhook';
  enabled: boolean;
  config: Record<string, any>;
}

// Position alert
export interface PositionAlert {
  id: string;
  type: AlertType;
  message: string;
  triggered: boolean;
  triggeredAt?: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
}

// Alert types
export enum AlertType {
  STOP_LOSS_APPROACHING = 'stop_loss_approaching',
  TAKE_PROFIT_APPROACHING = 'take_profit_approaching',
  MARGIN_LOW = 'margin_low',
  POSITION_PROFIT = 'position_profit',
  POSITION_LOSS = 'position_loss',
  DRAWDOWN_WARNING = 'drawdown_warning'
}

// Monitoring status
export interface MonitoringStatus {
  active: boolean;
  startTime?: Date;
  lastUpdate?: Date;
  positionsMonitored: number;
  anomaliesDetected: number;
  alertsTriggered: number;
  uptime?: number; // In milliseconds
  errors: MonitoringError[];
}

// Monitoring error
export interface MonitoringError {
  timestamp: Date;
  message: string;
  details?: any;
  resolved: boolean;
}

// Currency conversion rates
export interface ExchangeRates {
  [currency: string]: number;
}

// Position monitoring event
export interface PositionEvent {
  type: 'open' | 'close' | 'modify' | 'sl_hit' | 'tp_hit';
  position: MonitoredPosition;
  timestamp: Date;
  data?: any;
}

// Performance metrics
export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  currentDrawdown: number;
  sharpeRatio?: number;
  sortinoRatio?: number;
  totalReturn: number;
  annualizedReturn?: number;
}