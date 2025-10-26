export type { MT5Info } from './mt5.types';
import { MT5Info } from './mt5.types';

// Command types
export interface Command {
  id: string;
  command: string;
  parameters?: Record<string, any>;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  createdAt: string;
  executorId?: string;
  timeout?: number;
  retryCount?: number;
  maxRetries?: number;
}

export interface CommandResult {
  success: boolean;
  ticket?: number;
  message?: string;
  error?: string;
  metadata?: Record<string, any>;
  executionTime?: number;
  timestamp: string;
}

export interface SafetyCheck {
  passed: boolean;
  warnings: string[];
  errors: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface TradeParams {
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
  magicNumber?: number;
  deviation?: number;
  slippage?: number;
}

export interface SafetyLimits {
  maxDailyLoss: number;
  maxPositions: number;
  maxLotSize: number;
  maxDrawdownPercent: number;
  maxSpreadPoints?: number;
  maxRiskPerTrade?: number;
}

// Pusher event types
export interface PusherEvent {
  event: string;
  data: any;
  channel: string;
}

export interface PusherCommandData extends Command {
  eventType: 'command-received' | 'command-cancel' | 'emergency-stop';
}

// ZeroMQ message formats
export interface ZeroMQRequest {
  command: string;
  requestId?: string;
  timestamp: string;
  parameters?: Record<string, any>;
}

export interface ZeroMQResponse {
  status: 'OK' | 'ERROR' | 'TIMEOUT';
  data?: any;
  error?: string;
  requestId?: string;
  timestamp: string;
  executionTime?: number;
}

export interface TradeResult extends CommandResult {
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  openPrice: number;
  closePrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  swap?: number;
  profit?: number;
  commission?: number;
}

// Connection status types
export interface ConnectionStatus {
  pusher: 'connected' | 'disconnected' | 'error' | 'connecting';
  zeromq: 'connected' | 'disconnected' | 'error' | 'connecting';
  api: 'connected' | 'disconnected' | 'error' | 'connecting';
  mt5: 'connected' | 'disconnected' | 'error' | 'connecting';
  lastUpdate: string;
}

// Heartbeat data types
export interface HeartbeatData {
  executorId: string;
  timestamp: string;
  uptime: number;
  connections: ConnectionStatus;
  mt5Info?: MT5Info[];
  mt5Status?: {
    accountBalance?: number;
    accountEquity?: number;
    openPositions?: number;
  };
  systemMetrics: SystemMetrics;
  queueStats: QueueStats;
  activeCommands: number;
  lastCommandExecution?: string;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkLatency?: number;
  processesRunning: number;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  averageProcessingTime: number;
}

// Priority queue item
export interface QueueItem<T = any> {
  id: string;
  priority: number;
  data: T;
  createdAt: Date;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date;
}

// Config types
export interface AppConfig {
  executorId: string;
  apiKey: string;
  apiSecret: string;
  sharedSecret?: string; // For EA authentication
  platformUrl: string;
  pusherKey: string;
  pusherCluster: string;
  zmqPort: number;
  zmqHost: string;
  heartbeatInterval: number;
  autoReconnect: boolean;
  retryAttempts: number;
  commandTimeout: number;
}

// Error types
export interface ExecutorError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  retryable: boolean;
}

// Log entry types
export interface LogEntry {
  id: number;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  message: string;
  metadata?: Record<string, any>;
  source?: string;
}

// Command validation result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// MT5 specific command types
export interface MT5Command {
  OPEN_POSITION: 'OPEN_POSITION';
  CLOSE_POSITION: 'CLOSE_POSITION';
  CLOSE_ALL_POSITIONS: 'CLOSE_ALL_POSITIONS';
  MODIFY_POSITION: 'MODIFY_POSITION';
  GET_POSITIONS: 'GET_POSITIONS';
  GET_ACCOUNT_INFO: 'GET_ACCOUNT_INFO';
  GET_SYMBOL_INFO: 'GET_SYMBOL_INFO';
  PING: 'PING';
}

// Command execution context
export interface ExecutionContext {
  command: Command;
  executorId: string;
  timestamp: string;
  mt5Connected: boolean;
  safetyLimits: SafetyLimits;
  currentPositions: number;
  dailyLoss: number;
}

// Rate limiting types
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}