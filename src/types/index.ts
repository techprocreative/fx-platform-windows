// Strategy Types
export interface StrategyRule {
  indicator: string;
  condition: string;
  value?: number;
  period?: number;
}

export interface EntryRules {
  conditions: StrategyRule[];
  logic: 'AND' | 'OR';
}

export interface ExitLevels {
  type: 'pips' | 'percentage' | 'atr';
  value: number;
}

export interface RiskManagement {
  lotSize: number;
  maxPositions: number;
  maxDailyLoss?: number;
}

export interface StrategyRules {
  entry: EntryRules;
  exit: {
    takeProfit: ExitLevels;
    stopLoss: ExitLevels;
    trailing?: {
      enabled: boolean;
      distance: number;
    };
  };
  riskManagement: RiskManagement;
}

export interface Strategy {
  id: string;
  userId: string;
  name: string;
  description?: string;
  symbol: string;
  timeframe: string;
  type: 'manual' | 'ai_generated' | 'imported';
  status: 'draft' | 'active' | 'paused' | 'archived';
  rules: StrategyRules;
  version: number;
  aiPrompt?: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Backtest Types
export interface BacktestConfig {
  strategyId: string;
  dateRange: {
    from: Date;
    to: Date;
  };
  initialBalance: number;
  settings: {
    spread: number;
    commission: number;
    slippage: number;
    includeSwap: boolean;
  };
}

export interface BacktestTrade {
  id: number;
  openTime: Date;
  closeTime: Date;
  type: 'BUY' | 'SELL';
  lots: number;
  openPrice: number;
  closePrice: number;
  profit: number;
  pips: number;
}

export interface BacktestResults {
  backtestId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  initialBalance: number;
  finalBalance: number;
  totalReturn: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  maxDrawdown: number;
  sharpeRatio: number;
  trades: BacktestTrade[];
  equityCurve: Array<{ date: Date; balance: number }>;
}

// User Types
export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  createdAt: Date;
  subscription?: {
    tier: string;
    status: string;
    expiresAt: Date;
  };
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pages: number;
    limit: number;
  };
}

// Auth Types
export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}
