// Type definitions for Security and Monitoring System

export interface TradeParams {
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
  magicNumber?: number;
}

export interface SafetyLimits {
  maxDailyLoss: number;
  maxPositions: number;
  maxLotSize: number;
  maxDrawdownPercent: number;
  maxHourlyTrades: number;
  maxRiskPerTrade: number;
  maxSpreadPoints: number;
  minAccountBalance: number;
}

export interface SafetyCheck {
  passed: boolean;
  warnings: string[];
  errors: string[];
  metadata?: {
    currentDrawdown?: number;
    dailyPnL?: number;
    openPositions?: number;
    accountBalance?: number;
    riskPercentage?: number;
  };
}

export interface SecurityConfig {
  encryptionKey: string;
  sessionTimeout: number; // in minutes
  maxLoginAttempts: number;
  ipWhitelist: string[];
  rateLimits: {
    apiCallsPerMinute: number;
    tradesPerMinute: number;
    commandsPerSecond: number;
  };
}

export interface SecurityEvent {
  id: string;
  type: 'LOGIN' | 'LOGOUT' | 'UNAUTHORIZED_ACCESS' | 'RATE_LIMIT' | 'EMERGENCY_STOP' | 'SECURITY_BREACH';
  timestamp: Date;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  details?: Record<string, any>;
  resolved?: boolean;
  resolvedAt?: Date;
}

export interface CredentialStorage {
  apiKey: string;
  apiSecret: string;
  executorId: string;
  encrypted: boolean;
  lastUpdated: Date;
}

export interface MonitoringMetrics {
  system: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkLatency: number;
  };
  trading: {
    dailyPnL: number;
    openPositions: number;
    totalTrades: number;
    winRate: number;
    averageTradeDuration: number;
  };
  connections: {
    pusher: ConnectionStatus;
    zeromq: ConnectionStatus;
    mt5: ConnectionStatus;
    api: ConnectionStatus;
  };
  performance: {
    commandQueueSize: number;
    averageExecutionTime: number;
    errorRate: number;
    uptime: number;
  };
}

export interface ConnectionStatus {
  connected: boolean;
  lastConnected?: Date;
  lastDisconnected?: Date;
  reconnectAttempts: number;
  latency?: number;
  error?: string;
}

export interface HealthCheckResult {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  timestamp: Date;
  checks: {
    database: boolean;
    connections: boolean;
    diskSpace: boolean;
    memory: boolean;
    safetyLimits: boolean;
  };
  issues: string[];
  recommendations: string[];
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  message: string;
  metadata?: Record<string, any>;
  stackTrace?: string;
  userId?: string;
  sessionId?: string;
}

export interface AlertConfig {
  enabled: boolean;
  thresholds: {
    dailyLoss: number;
    drawdown: number;
    errorRate: number;
    latency: number;
    diskUsage: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  notifications: {
    email: string[];
    webhook?: string;
    inApp: boolean;
  };
}

export interface Alert {
  id: string;
  type: 'DAILY_LOSS' | 'DRAWDOWN' | 'CONNECTION_LOST' | 'HIGH_ERROR_RATE' | 'DISK_SPACE' | 'MEMORY_USAGE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface PerformanceMetrics {
  id: string;
  commandId: string;
  commandType: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface DatabaseConfig {
  path: string;
  encryptionKey: string;
  backupEnabled: boolean;
  backupInterval: number; // in hours
  maxBackups: number;
}

export interface RecoveryAction {
  id: string;
  type: 'RECONNECT' | 'RESTART_SERVICE' | 'CLEAR_CACHE' | 'EMERGENCY_STOP';
  condition: string;
  enabled: boolean;
  maxRetries: number;
  retryInterval: number; // in seconds
  lastExecuted?: Date;
  successCount: number;
  failureCount: number;
}

export interface SecurityAuditLog {
  id: string;
  timestamp: Date;
  action: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource: string;
  result: 'SUCCESS' | 'FAILURE';
  details?: Record<string, any>;
}

export interface EmergencyStopConfig {
  enabled: boolean;
  triggers: {
    dailyLossExceeded: boolean;
    maxDrawdownExceeded: boolean;
    connectionLost: boolean;
    manualActivation: boolean;
    securityBreach: boolean;
  };
  actions: {
    closeAllPositions: boolean;
    pauseStrategies: boolean;
    disconnectFromMT5: boolean;
    notifyAdmin: boolean;
  };
}

export interface RateLimitEntry {
  key: string;
  count: number;
  windowStart: Date;
  maxRequests: number;
  windowSizeMs: number;
}

export interface SecuritySession {
  id: string;
  userId?: string;
  startTime: Date;
  lastActivity: Date;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  permissions: string[];
}

export interface EncryptionResult {
  success: boolean;
  data?: string;
  iv?: string;
  tag?: string;
  error?: string;
}

export interface DecryptionResult {
  success: boolean;
  data?: string;
  error?: string;
}