/**
 * Strategy Types & Interfaces
 * Defines structure for trading strategies from web platform
 */

// ============================================================================
// STRATEGY DEFINITION (from Web Platform)
// ============================================================================

export interface Strategy {
  id: string;
  name: string;
  description: string;
  version: string;
  status: 'active' | 'paused' | 'stopped';
  
  // Trading parameters
  symbols: string[];
  timeframe: Timeframe;
  maxPositions: number;
  positionSize: number;
  riskPercent: number;
  
  // Entry conditions
  entryConditions: Condition[];
  entryLogic: 'AND' | 'OR'; // How to combine conditions
  
  // Exit conditions
  exitConditions: Condition[];
  exitLogic: 'AND' | 'OR';
  
  // Stop loss & take profit
  stopLoss?: StopLossConfig;
  takeProfit?: TakeProfitConfig;
  
  // Filters (time, session, volatility, etc)
  filters?: StrategyFilter[];
  
  // Advanced settings
  trailingStop?: TrailingStopConfig;
  breakeven?: BreakevenConfig;
  partialClose?: PartialCloseConfig;
  
  // Position Sizing & Risk Management
  positionSizing?: PositionSizingConfig;
  dynamicRisk?: DynamicRiskParams;
  
  // Smart Exits
  smartExit?: SmartExitRules;
  enhancedPartialExits?: EnhancedPartialExitConfig;
  
  // Advanced Filters
  correlationFilter?: CorrelationFilter;
  regimeDetection?: RegimeDetectionConfig;
  
  // Multi-Timeframe
  mtfSettings?: MTFStrategy;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// ============================================================================
// TIMEFRAMES
// ============================================================================

export type Timeframe = 
  | 'M1'   // 1 minute
  | 'M5'   // 5 minutes
  | 'M15'  // 15 minutes
  | 'M30'  // 30 minutes
  | 'H1'   // 1 hour
  | 'H4'   // 4 hours
  | 'D1'   // 1 day
  | 'W1'   // 1 week
  | 'MN1'; // 1 month

// ============================================================================
// CONDITIONS (Entry/Exit)
// ============================================================================

export interface Condition {
  id: string;
  type: ConditionType;
  indicator: IndicatorType;
  params: IndicatorParams;
  comparison: ComparisonOperator;
  value: number | 'price' | string;
  enabled: boolean;
}

export type ConditionType = 
  | 'indicator'
  | 'price'
  | 'pattern'
  | 'custom';

export type IndicatorType =
  | 'MA'          // Moving Average
  | 'EMA'         // Exponential MA
  | 'RSI'         // Relative Strength Index
  | 'MACD'        // Moving Average Convergence Divergence
  | 'BB'          // Bollinger Bands
  | 'STOCH'       // Stochastic
  | 'ATR'         // Average True Range
  | 'ADX'         // Average Directional Index
  | 'CCI'         // Commodity Channel Index
  | 'WILLIAMS'    // Williams %R
  | 'VWAP'        // Volume Weighted Average Price
  | 'SAR'         // Parabolic SAR
  | 'ICHIMOKU'    // Ichimoku
  | 'PIVOT'       // Pivot Points
  | 'SUPPORT'     // Support Level
  | 'RESISTANCE'  // Resistance Level
  | 'VOLUME'      // Volume
  | 'CUSTOM';     // Custom indicator

export type ComparisonOperator =
  | 'greater_than'      // >
  | 'less_than'         // <
  | 'equals'            // =
  | 'greater_or_equal'  // >=
  | 'less_or_equal'     // <=
  | 'crosses_above'     // Crosses up
  | 'crosses_below'     // Crosses down
  | 'between'           // Between two values
  | 'outside';          // Outside range

export interface IndicatorParams {
  period?: number;
  shift?: number;
  maMethod?: 'SMA' | 'EMA' | 'SMMA' | 'LWMA';
  appliedPrice?: 'CLOSE' | 'OPEN' | 'HIGH' | 'LOW' | 'MEDIAN' | 'TYPICAL' | 'WEIGHTED';
  
  // MACD params
  fastPeriod?: number;
  slowPeriod?: number;
  signalPeriod?: number;
  
  // Bollinger Bands params
  deviation?: number;
  
  // Stochastic params
  kPeriod?: number;
  dPeriod?: number;
  slowing?: number;
  
  // Ichimoku params
  tenkanPeriod?: number;
  kijunPeriod?: number;
  senkouSpanBPeriod?: number;
  
  [key: string]: any; // For custom params
}

// ============================================================================
// STOP LOSS & TAKE PROFIT
// ============================================================================

export interface StopLossConfig {
  type: 'fixed' | 'atr' | 'percent' | 'price';
  value: number;
  minPips?: number;
  maxPips?: number;
}

export interface TakeProfitConfig {
  type: 'fixed' | 'atr' | 'percent' | 'price' | 'ratio';
  value: number;
  ratio?: number; // Risk:Reward ratio
}

export interface TrailingStopConfig {
  enabled: boolean;
  distance: number;
  step: number;
  activateAfter?: number; // Pips of profit before activating
}

export interface BreakevenConfig {
  enabled: boolean;
  triggerPips: number;
  lockPips: number;
}

export interface PartialCloseConfig {
  enabled: boolean;
  levels: Array<{
    percent: number;
    atPips: number;
  }>;
}

// ============================================================================
// FILTERS
// ============================================================================

export interface StrategyFilter {
  type: FilterType;
  enabled: boolean;
  config: FilterConfig;
}

export type FilterType =
  | 'time'        // Trading hours
  | 'session'     // Market sessions
  | 'volatility'  // Min/max volatility
  | 'spread'      // Max spread
  | 'news'        // News calendar
  | 'dayOfWeek'   // Specific days
  | 'custom';

export interface FilterConfig {
  // Time filter
  startTime?: string;
  endTime?: string;
  timezone?: string;
  
  // Session filter
  sessions?: ('ASIAN' | 'LONDON' | 'NEWYORK')[];
  
  // Volatility filter
  minVolatility?: number;
  maxVolatility?: number;
  
  // Spread filter
  maxSpread?: number;
  
  // Day of week
  allowedDays?: number[]; // 0=Sunday, 6=Saturday
  
  [key: string]: any;
}

// ============================================================================
// SIGNAL GENERATION
// ============================================================================

export interface Signal {
  id: string;
  strategyId: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  action: 'BUY' | 'SELL'; // Alias for type (for compatibility)
  timeframe: Timeframe;
  
  // Entry info
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  volume: number;
  
  // Confidence & reasoning
  confidence: number; // 0-100
  reasons: string[];
  conditionsMet: string[];
  
  // Metadata
  timestamp: Date;
  expiresAt?: Date;
}

// ============================================================================
// STRATEGY EXECUTION STATE
// ============================================================================

export interface StrategyState {
  strategyId: string;
  status: 'running' | 'paused' | 'stopped' | 'error';
  
  // Execution stats
  startedAt: Date;
  lastEvaluation: Date;
  evaluationCount: number;
  
  // Trading stats
  signalsGenerated: number;
  tradesExecuted: number;
  openPositions: number;
  
  // Performance
  winRate: number;
  profitFactor: number;
  totalPnL: number;
  
  // Current positions
  positions: StrategyPosition[];
  
  // Errors
  lastError?: string;
  errorCount: number;
}

export interface StrategyPosition {
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  openPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  profit: number;
  openedAt: Date;
}

// ============================================================================
// EVALUATION RESULT
// ============================================================================

export interface EvaluationResult {
  strategyId: string;
  symbol: string;
  timestamp: Date;
  
  // Decision
  action: 'BUY' | 'SELL' | 'CLOSE' | 'HOLD' | 'WAIT';
  confidence: number;
  
  // Condition evaluation
  entryConditionsMet: boolean;
  exitConditionsMet: boolean;
  filtersPassed: boolean;
  
  // Details
  indicatorValues: Record<string, any>;
  conditionResults: ConditionResult[];
  filterResults: FilterResult[];
  
  // Reasoning
  reasons: string[];
  warnings?: string[];
}

export interface ConditionResult {
  conditionId: string;
  indicator: string;
  currentValue: number | string;
  expectedValue: number | string;
  comparison: string;
  met: boolean;
  reason: string;
}

export interface FilterResult {
  filterType: string;
  passed: boolean;
  reason: string;
}

// ============================================================================
// LLM CONSULTATION
// ============================================================================

export interface LLMConsultation {
  id: string;
  strategyId: string;
  query: string;
  context: {
    symbol: string;
    timeframe: Timeframe;
    currentPrice: number;
    indicatorValues: Record<string, any>;
    recentSignals: Signal[];
    openPositions: StrategyPosition[];
  };
  response?: string;
  decision?: 'proceed' | 'skip' | 'modify' | 'close';
  timestamp: Date;
}

// ============================================================================
// STRATEGY REPORT (to Web Platform)
// ============================================================================

export interface StrategyReport {
  strategyId: string;
  executorId: string;
  timestamp: Date;
  
  // Status
  status: 'running' | 'paused' | 'stopped' | 'error';
  uptime: number; // seconds
  
  // Performance
  stats: {
    totalSignals: number;
    totalTrades: number;
    openPositions: number;
    winRate: number;
    profitFactor: number;
    totalPnL: number;
    drawdown: number;
  };
  
  // Recent activity
  recentSignals: Signal[];
  recentTrades: Trade[];
  
  // Issues
  errors?: Array<{
    timestamp: Date;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  
  // LLM consultations
  llmConsultations?: LLMConsultation[];
}

export interface Trade {
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  openPrice: number;
  closePrice?: number;
  stopLoss: number;
  takeProfit: number;
  profit?: number;
  commission?: number;
  swap?: number;
  openedAt: Date;
  closedAt?: Date;
  closedReason?: string;
}

// ============================================================================
// POSITION SIZING
// ============================================================================

export type SizingMethod =
  | 'fixed_lot'
  | 'percentage_risk'
  | 'atr_based'
  | 'volatility_based'
  | 'kelly_criterion'
  | 'account_equity';

export interface PositionSizingConfig {
  method: SizingMethod;
  
  // Fixed lot
  fixedLot?: number;
  
  // Percentage risk
  riskPercentage?: number;
  
  // ATR-based
  atrBased?: {
    atrMultiplier: number;
    riskPercentage: number;
    volatilityAdjustment: boolean;
    minATR?: number;
    maxATR?: number;
  };
  
  // Volatility-based
  volatilityBased?: {
    baseSize: number;
    volatilityFactor: number;
    lookbackPeriod: number;
  };
  
  // Kelly Criterion
  kellyCriterion?: {
    winRate: number;
    avgWin: number;
    avgLoss: number;
    kellyFraction: number;
    maxPositionSize: number;
  };
  
  // Risk limits
  maxDailyLoss?: number;
  maxDrawdown?: number;
  maxTotalExposure?: number;
  minPositionSize?: number;
  maxPositionSize?: number;
}

export interface PositionSizeCalculation {
  recommendedSize: number;
  method: SizingMethod;
  riskAmount: number;
  riskPercentage: number;
  stopLossDistance: number;
  reasoning: string[];
  adjustments: string[];
  constraints: {
    min: number;
    max: number;
    applied: boolean;
  };
}

// ============================================================================
// DYNAMIC RISK MANAGEMENT
// ============================================================================

export interface DynamicRiskParams {
  enabled: boolean;
  
  // ATR-based sizing
  useATRSizing: boolean;
  atrMultiplier?: number;
  
  // Account-based sizing
  riskPercentage: number;
  autoAdjustLotSize: boolean;
  
  // Volatility adjustment
  reduceInHighVolatility: boolean;
  volatilityThreshold?: number;
  
  // Drawdown protection
  maxDrawdown: number;
  drawdownAdjustment: boolean;
  equityCurveAdjustment: boolean;
  
  // Daily limits
  maxDailyLoss: number;
  maxDailyTrades?: number;
  stopTradingAfterLoss: boolean;
}

// ============================================================================
// SMART EXITS & PARTIAL EXITS
// ============================================================================

export interface SmartExitRules {
  enabled: boolean;
  
  stopLoss: {
    type: 'fixed' | 'atr' | 'support' | 'trailing';
    value: number;
    atrMultiplier?: number;
    useSwingPoints?: boolean;
    swingLookback?: number;
    maxHoldingHours?: number;
  };
  
  takeProfit: {
    type: 'fixed' | 'rr_ratio' | 'resistance' | 'partial';
    value: number;
    rrRatio?: number;
    partialExits?: Array<{
      percentage: number;
      atRR: number;
    }>;
  };
}

export interface EnhancedPartialExitConfig {
  enabled: boolean;
  strategy: 'sequential' | 'parallel' | 'conditional';
  
  levels: Array<{
    id: string;
    name: string;
    percentage: number;
    triggerType: 'pips' | 'rr' | 'atr' | 'swing' | 'time';
    triggerValue: number;
    priority: number;
    isActive: boolean;
    
    conditions?: {
      regime?: MarketRegime[];
      volatility?: { min: number; max: number };
      session?: string[];
      timeOfDay?: { start: string; end: string };
    };
  }>;
  
  maxTotalExit: number;
  minRemaining: number;
  lockInProfit: boolean;
  
  trailingAfterExits?: {
    enabled: boolean;
    distance: number;
    adjustPerExit: boolean;
  };
}

export interface PartialExitCalculationResult {
  shouldExit: boolean;
  recommendedExits: Array<{
    levelId: string;
    levelName: string;
    percentage: number;
    quantity: number;
    price: number;
    reason: string;
    confidence: number;
    urgency: 'low' | 'medium' | 'high';
  }>;
  
  analysis: {
    currentProfit: number;
    currentProfitPercentage: number;
    unrealizedProfit: number;
    riskExposure: number;
  };
  
  warnings: string[];
  recommendations: string[];
}

// ============================================================================
// CORRELATION FILTER
// ============================================================================

export interface CorrelationFilter {
  enabled: boolean;
  maxCorrelation: number;
  checkPairs: string[];
  skipHighlyCorrelated: boolean;
  
  timeframes?: string[];
  lookbackPeriod?: number;
  minDataPoints?: number;
  updateFrequency?: number;
  dynamicThreshold?: boolean;
  groupByCurrency?: boolean;
}

export interface CorrelationData {
  correlation: number;
  pValue: number;
  dataPoints: number;
  isSignificant: boolean;
  lastUpdated: Date;
}

export interface CorrelationMatrix {
  correlations: Record<string, Record<string, CorrelationData>>;
  metadata: {
    totalPairs: number;
    averageCorrelation: number;
    highestCorrelation: number;
    volatilityAdjusted: boolean;
    lastUpdated: Date;
  };
}

export interface CorrelationAnalysisResult {
  shouldSkip: boolean;
  reason?: string;
  conflictingPositions: Array<{
    symbol: string;
    correlation: number;
    positionSize: number;
  }>;
  recommendedAction: 'proceed' | 'skip' | 'reduce_size';
  adjustedPositionSize?: number;
  confidence: number;
}

// ============================================================================
// REGIME DETECTION
// ============================================================================

export enum MarketRegime {
  BULLISH_TRENDING = 'bullish_trending',
  BEARISH_TRENDING = 'bearish_trending',
  RANGING = 'ranging',
  HIGH_VOLATILITY = 'high_volatility',
  LOW_VOLATILITY = 'low_volatility',
  BREAKOUT = 'breakout'
}

export interface RegimeDetectionConfig {
  enabled: boolean;
  adaptStrategy: boolean;
  
  regimeSettings?: {
    [key in MarketRegime]?: {
      positionSizeMultiplier: number;
      takeProfitMultiplier: number;
      stopLossMultiplier?: number;
      enabled: boolean;
    };
  };
}

export interface RegimeDetectionResult {
  regime: MarketRegime;
  confidence: number;
  strength: number;
  
  indicators: {
    adx: number;
    atr: number;
    pricePosition: number;
  };
  
  recommendations: string[];
}

// ============================================================================
// MULTI-TIMEFRAME
// ============================================================================

export interface MTFStrategy {
  enabled: boolean;
  primaryTimeframe: Timeframe;
  confirmationTimeframes: Timeframe[];
  
  rules: {
    entry: {
      primary: Condition[];
      confirmation: MTFConfirmation[];
    };
  };
}

export interface MTFConfirmation {
  timeframe: Timeframe;
  condition: Condition;
  required: boolean;
}

export interface MTFAnalysisResult {
  primarySignal: boolean;
  confirmations: Array<{
    timeframe: Timeframe;
    signal: boolean;
    condition: Condition;
    met: boolean;
  }>;
  overallSignal: boolean;
  confidence: number;
}
