// Strategy Types
export type IndicatorType =
  | "RSI"
  | "MACD"
  | "EMA"
  | "SMA"
  | "ADX"
  | "Bollinger Bands"
  | "Stochastic"
  | "ATR"
  | "Ichimoku"
  | "VWAP"
  | "CCI"
  | "Williams %R"
  | "OBV"
  | "Volume MA";

export interface IndicatorConfig {
  periods: number[];
  description: string;
}

export interface StrategyRule {
  indicator: IndicatorType | string; // Allow string for backward compatibility
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

export interface DynamicRiskParams {
  // Position sizing based on ATR
  useATRSizing: boolean;
  atrMultiplier: number; // 1-3x ATR for stop loss
  
  // Account-based sizing
  riskPercentage: number; // 1-2% per trade
  autoAdjustLotSize: boolean;
  
  // Volatility adjustment
  reduceInHighVolatility: boolean;
  volatilityThreshold: number;
}

// Position Sizing Types
export type SizingMethod =
  | "fixed_lot"
  | "percentage_risk"
  | "atr_based"
  | "volatility_based"
  | "kelly_criterion"
  | "account_equity";

export interface PositionSizingConfig {
  /** Primary position sizing method */
  method: SizingMethod;
  
  /** Fixed lot size configuration */
  fixedLot?: {
    lotSize: number;
    maxPositions: number;
  };
  
  /** Percentage risk configuration */
  percentageRisk?: {
    riskPercentage: number; // 1-2% per trade
    maxRiskPerTrade: number;
    maxDailyRisk: number;
  };
  
  /** ATR-based configuration */
  atrBased?: {
    atrMultiplier: number; // 1-3x ATR for stop loss
    riskPercentage: number;
    volatilityAdjustment: boolean;
    minATR: number;
    maxATR: number;
  };
  
  /** Volatility-based configuration */
  volatilityBased?: {
    volatilityPeriod: number;
    volatilityMultiplier: number;
    riskPercentage: number;
    maxVolatilityThreshold: number;
  };
  
  /** Kelly criterion configuration */
  kellyCriterion?: {
    winRate: number; // Historical win rate (0-1)
    avgWin: number; // Average win amount
    avgLoss: number; // Average loss amount
    kellyFraction: number; // Fraction of Kelly to use (0.25-0.5)
    maxPositionSize: number;
  };
  
  /** Account equity-based configuration */
  accountEquity?: {
    equityPercentage: number; // % of account equity to risk
    drawdownAdjustment: boolean;
    maxDrawdown: number;
    equityCurveAdjustment: boolean;
  };
  
  /** Common settings */
  maxPositionSize: number;
  minPositionSize: number;
  positionSizeStep: number;
  
  /** Risk limits */
  maxDailyLoss: number;
  maxDrawdown: number;
  maxTotalExposure: number;
}

export interface PositionSizingResult {
  /** Calculated position size in lots */
  positionSize: number;
  
  /** Risk amount in account currency */
  riskAmount: number;
  
  /** Risk percentage of account */
  riskPercentage: number;
  
  /** Stop loss distance in pips */
  stopLossPips: number;
  
  /** Stop loss price */
  stopLossPrice: number;
  
  /** Take profit price (if calculated) */
  takeProfitPrice?: number;
  
  /** Risk-reward ratio */
  riskRewardRatio: number;
  
  /** Confidence score (0-100) */
  confidence: number;
  
  /** Warnings and recommendations */
  warnings: string[];
  
  /** Calculation method used */
  method: SizingMethod;
  
  /** Additional metadata */
  metadata: {
    accountBalance: number;
    symbol: string;
    entryPrice: number;
    currentATR?: number;
    volatility?: number;
    timestamp: Date;
  };
}

export interface PositionSizingParams {
  /** Account information */
  accountBalance: number;
  accountEquity?: number;
  
  /** Trade information */
  symbol: string;
  entryPrice: number;
  tradeType: "BUY" | "SELL";
  
  /** Market data */
  currentATR?: number;
  volatility?: number;
  spread?: number;
  
  /** Historical performance (for Kelly criterion) */
  historicalData?: {
    winRate: number;
    avgWin: number;
    avgLoss: number;
    totalTrades: number;
  };
  
  /** Current positions */
  openPositions?: Array<{
    symbol: string;
    lotSize: number;
    profit: number;
  }>;
  
  /** Daily performance */
  dailyPnL?: number;
  
  /** Configuration */
  config: PositionSizingConfig;
}

// Market Session Types
export interface MarketSessionInfo {
  start: string; // HH:mm format in UTC
  end: string;   // HH:mm format in UTC
  pairs: string[];
  description: string;
}

export interface MarketSessions {
  sydney: MarketSessionInfo;
  tokyo: MarketSessionInfo;
  london: MarketSessionInfo;
  newYork: MarketSessionInfo;
}

export interface SessionFilter {
  enabled: boolean;
  allowedSessions: Array<keyof MarketSessions>;
  useOptimalPairs: boolean;
  aggressivenessMultiplier: {
    optimal: number;    // Multiplier when trading optimal session/pair
    suboptimal: number; // Multiplier when trading suboptimal session/pair
  };
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
    smartExit?: SmartExitRules;
    enhancedPartialExits?: EnhancedPartialExitConfig;
  };
  riskManagement: RiskManagement;
  dynamicRisk?: DynamicRiskParams;
  sessionFilter?: SessionFilter;
  correlationFilter?: CorrelationFilter;
}

// Correlation Filter Types
export interface CorrelationFilter {
  enabled: boolean;
  maxCorrelation: number; // 0.7 = skip if pairs >70% correlated
  checkPairs: string[];
  
  // Don't open EURUSD if already in GBPUSD (high correlation)
  skipHighlyCorrelated: boolean;
  
  // Advanced correlation settings
  timeframes: string[]; // Multiple timeframes for correlation analysis
  lookbackPeriod: number; // Days to look back for correlation calculation
  minDataPoints: number; // Minimum data points required for valid correlation
  updateFrequency: number; // Hours between correlation updates
  dynamicThreshold: boolean; // Adjust threshold based on market volatility
  groupByCurrency: boolean; // Group pairs by base currency (USD, EUR, etc.)
}

export interface CorrelationMatrix {
  id: string;
  timestamp: Date;
  timeframe: string;
  lookbackPeriod: number;
  correlations: Record<string, Record<string, CorrelationData>>;
  metadata: {
    totalPairs: number;
    averageCorrelation: number;
    highestCorrelation: number;
    lowestCorrelation: number;
    volatilityAdjusted: boolean;
  };
}

export interface CorrelationData {
  correlation: number; // Pearson correlation coefficient (-1 to 1)
  pValue: number; // Statistical significance
  sampleSize: number; // Number of data points used
  lastUpdated: Date;
  trend: 'increasing' | 'decreasing' | 'stable';
  changeRate: number; // Rate of change in correlation over time
}

export interface CorrelationThreshold {
  symbol: string;
  threshold: number;
  adjustedForVolatility: boolean;
  volatilityMultiplier: number;
}

export interface CorrelationGroup {
  currency: string; // Base currency (USD, EUR, GBP, etc.)
  pairs: string[];
  averageInternalCorrelation: number;
  riskFactor: number; // Higher means more risky to trade multiple pairs
}

export interface CorrelationAnalysisResult {
  symbol: string;
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

export interface HistoricalCorrelation {
  symbol1: string;
  symbol2: string;
  timeframe: string;
  dataPoints: Array<{
    date: Date;
    correlation: number;
    volatility: number;
  }>;
  statistics: {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
}

// Smart Exit Rules Types
export interface SmartExitRules {
  stopLoss: {
    type: "fixed" | "atr" | "support" | "trailing";
    
    // ATR-based stops
    atrMultiplier?: number;
    
    // Structure-based stops
    useSwingPoints?: boolean;
    swingLookback?: number;
    
    // Time-based stops
    maxHoldingHours?: number;
  };
  
  takeProfit: {
    type: "fixed" | "rr_ratio" | "resistance" | "partial";
    
    // Risk-reward based
    rrRatio?: number; // 1:2, 1:3, etc.
    
    // Partial TP
    partialExits?: {
      percentage: number;
      atRR: number;
    }[];
  };
}

// Swing Point Detection Types
export interface SwingPoint {
  timestamp: Date;
  price: number;
  type: 'high' | 'low';
  strength: number; // 1-5, higher is stronger
}

export interface SwingPointAnalysis {
  swingPoints: SwingPoint[];
  currentSupport: number[];
  currentResistance: number[];
  nearestSupport: number;
  nearestResistance: number;
}

// Exit Calculation Types
export interface ExitCalculationParams {
  entryPrice: number;
  tradeType: 'BUY' | 'SELL';
  atr?: number;
  swingPoints?: SwingPoint[];
  currentPrice?: number;
  timestamp: Date;
}

export interface ExitCalculationResult {
  stopLoss: {
    price: number;
    type: string;
    distance: number;
    reason?: string;
  };
  takeProfit: {
    price: number;
    type: string;
    distance: number;
    reason?: string;
  };
  partialExits?: Array<{
    price: number;
    percentage: number;
    atRR: number;
  }>;
  riskRewardRatio: number;
  confidence: number;
}

// Exit Execution Types
export interface ExitExecution {
  id: string;
  tradeId: string;
  type: 'STOP_LOSS' | 'TAKE_PROFIT' | 'PARTIAL' | 'MANUAL';
  price: number;
  quantity: number;
  timestamp: Date;
  reason: string;
  remainingQuantity?: number;
}

export interface ExitRule {
  id: string;
  name: string;
  type: 'stop_loss' | 'take_profit' | 'partial';
  condition: {
    type: 'price' | 'time' | 'atr' | 'swing' | 'trailing';
    value: number;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  };
  action: {
    type: 'close' | 'partial';
    percentage?: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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

// Multi-Timeframe Strategy Types
export interface StrategyCondition {
  indicator: string;
  condition: string;
  value?: number | string;
  period?: number;
}

export interface MTFConfirmation {
  timeframe: string;
  condition: StrategyCondition;
  required: boolean;
}

export interface MTFEntryRules {
  primary: StrategyCondition[];
  confirmation: MTFConfirmation[];
}

export interface MTFStrategyRules {
  entry: MTFEntryRules;
  exit: {
    takeProfit: ExitLevels;
    stopLoss: ExitLevels;
    trailing?: {
      enabled: boolean;
      distance: number;
    };
    smartExit?: SmartExitRules;
    enhancedPartialExits?: EnhancedPartialExitConfig;
  };
  riskManagement: RiskManagement;
  dynamicRisk?: DynamicRiskParams;
  sessionFilter?: SessionFilter;
  correlationFilter?: CorrelationFilter;
}

export interface MTFStrategy {
  id: string;
  userId: string;
  name: string;
  description?: string;
  symbol: string;
  primaryTimeframe: string;
  confirmationTimeframes: string[];
  type: 'manual' | 'ai_generated' | 'imported' | 'mtf';
  status: 'draft' | 'active' | 'paused' | 'archived';
  rules: MTFStrategyRules;
  version: number;
  aiPrompt?: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// MTF Analysis Types
export interface MTFDataPoint {
  timeframe: string;
  timestamp: Date;
  indicators: Record<string, number>;
  price: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
}

export interface MTFAnalysisResult {
  primarySignal: boolean;
  confirmations: Array<{
    timeframe: string;
    signal: boolean;
    condition: StrategyCondition;
    met: boolean;
  }>;
  overallSignal: boolean;
  confidence: number;
  timestamp: Date;
}

export interface MTFBacktestConfig extends BacktestConfig {
  strategyType: 'mtf';
  primaryTimeframe: string;
  confirmationTimeframes: string[];
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

// Strategy Performance Scoring Types
export interface StrategyScore {
  profitability: number; // 0-100
  consistency: number; // Based on win rate stability
  riskAdjusted: number; // Sharpe/Sortino ratio
  drawdown: number; // Max DD score
  overall: number; // Weighted average
  
  recommendations: string[];
  warnings: string[];
}

export interface ScoringMetrics {
  // Profitability metrics
  returnPercentage: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  expectancy: number;
  
  // Consistency metrics
  winRate: number;
  winRateStability: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  
  // Risk-adjusted metrics
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  
  // Drawdown metrics
  maxDrawdown: number;
  maxDrawdownPercent: number;
  drawdownDuration: number;
  recoveryFactor: number;
  
  // Trading frequency metrics
  totalTrades: number;
  tradesPerMonth: number;
  averageTradeDuration: number;
  
  // Additional metrics for scoring
  var95: number; // Value at Risk 95%
  skewness: number;
  kurtosis: number;
}

export interface ScoringWeights {
  profitability: number; // Weight for profitability score
  consistency: number; // Weight for consistency score
  riskAdjusted: number; // Weight for risk-adjusted score
  drawdown: number; // Weight for drawdown score
}

export interface StrategyScoreHistory {
  id: string;
  strategyId: string;
  score: StrategyScore;
  metrics: ScoringMetrics;
  backtestId: string;
  timestamp: Date;
  benchmarkComparison?: {
    buyAndHoldReturn: number;
    marketReturn: number;
    strategyAlpha: number;
  };
}

export interface BenchmarkData {
  symbol: string;
  timeframe: string;
  startDate: Date;
  endDate: Date;
  buyAndHoldReturn: number;
  marketReturn: number;
  volatility: number;
  sharpeRatio: number;
}

export interface ScoringConfig {
  weights: ScoringWeights;
  benchmark?: BenchmarkData;
  minimumTrades: number;
  lookbackPeriod: number; // days
  enableHistoricalTracking: boolean;
}

// BacktestResult interface (matching engine.ts definition)
export interface BacktestResult {
  id: string;
  strategyId: string;
  status: string;
  startDate: Date;
  endDate: Date;
  initialBalance: number;
  finalBalance: number;
  totalReturn: number;
  returnPercentage: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  trades: any[];
  equityCurve: { timestamp: Date; equity: number }[];
  metadata: any;
}

export interface StrategyScoreCalculationParams {
  backtestResults: BacktestResults | BacktestResult;
  config?: ScoringConfig;
  benchmark?: BenchmarkData;
  historicalScores?: StrategyScoreHistory[];
}

// Market Regime Detection Types
export enum MarketRegime {
  TRENDING_UP = "trending_up",
  TRENDING_DOWN = "trending_down",
  RANGING = "ranging",
  VOLATILE = "volatile"
}

export interface RegimeDetectionResult {
  regime: MarketRegime;
  confidence: number; // 0-100
  timestamp: Date;
  timeframe: string;
  metadata: {
    trendStrength?: number;
    volatility?: number;
    rangeBound?: number;
    adx?: number;
    atr?: number;
    priceChange?: number;
    volumeChange?: number;
  };
}

export interface RegimeTransition {
  fromRegime: MarketRegime;
  toRegime: MarketRegime;
  timestamp: Date;
  confidence: number;
  duration: number; // Duration of previous regime in hours
}

export interface RegimeHistory {
  symbol: string;
  timeframe: string;
  data: Array<{
    timestamp: Date;
    regime: MarketRegime;
    confidence: number;
    metadata: RegimeDetectionResult['metadata'];
  }>;
  transitions: RegimeTransition[];
  statistics: {
    regimeDistribution: Record<MarketRegime, number>;
    averageRegimeDuration: Record<MarketRegime, number>;
    transitionFrequency: Record<MarketRegime, Record<MarketRegime, number>>;
  };
}

export interface RegimeAdapter {
  detectRegime(symbol: string, timeframe: string): Promise<MarketRegime>;
  
  adjustStrategy(regime: MarketRegime): {
    entryThreshold: number; // Stricter in ranging
    positionSize: number; // Smaller in volatile
    takeProfitMultiplier: number; // Larger in trending
    stopLossMultiplier?: number; // Adjusted per regime
    trailingDistance?: number; // Dynamic trailing per regime
    maxTradesPerDay?: number; // Reduced in volatile
    sessionFilterMultiplier?: number; // Adjust per regime
  };
  
  getRegimeConfidence(symbol: string, timeframe: string): Promise<number>;
  
  getRegimeHistory(symbol: string, timeframe: string, days?: number): Promise<RegimeHistory>;
  
  detectTransition(symbol: string, timeframe: string): Promise<RegimeTransition | null>;
}

export interface RegimeDetectionConfig {
  // Trend detection parameters
  trendPeriod: number;
  trendThreshold: number;
  
  // Volatility detection parameters
  volatilityPeriod: number;
  volatilityThreshold: number;
  
  // Range detection parameters
  rangePeriod: number;
  rangeThreshold: number;
  
  // Multi-timeframe analysis
  enableMTFAnalysis: boolean;
  primaryTimeframe: string;
  confirmationTimeframes: string[];
  
  // Confidence calculation
  minConfidence: number;
  weightTrend: number;
  weightVolatility: number;
  weightRange: number;
  
  // Historical analysis
  lookbackPeriod: number; // days
  minDataPoints: number;
  
  // Real-time updates
  updateFrequency: number; // minutes
  enableTransitionDetection: boolean;
}

export interface RegimeAdjustedStrategy {
  originalStrategy: Strategy;
  adjustedStrategy: Strategy;
  currentRegime: MarketRegime;
  adjustments: RegimeAdapter['adjustStrategy'];
  confidence: number;
  timestamp: Date;
}

export interface RegimeBasedRiskParams {
  // Risk adjustments per regime
  regimeRiskMultipliers: Record<MarketRegime, {
    positionSize: number;
    stopLoss: number;
    takeProfit: number;
    maxDrawdown: number;
    maxDailyLoss: number;
  }>;
  
  // Dynamic risk adjustments
  reduceInVolatile: boolean;
  increaseInTrending: boolean;
  useRegimeTransitions: boolean;
  
  // Risk limits
  maxPositionSizePerRegime: Record<MarketRegime, number>;
  maxExposurePerRegime: Record<MarketRegime, number>;
}

export interface RegimeVisualizerData {
  symbol: string;
  timeframe: string;
  currentRegime: MarketRegime;
  regimeHistory: Array<{
    timestamp: Date;
    regime: MarketRegime;
    confidence: number;
  }>;
  transitions: RegimeTransition[];
  predictions: Array<{
    timestamp: Date;
    predictedRegime: MarketRegime;
    probability: number;
  }>;
}

// Enhanced Partial Exit System Types
export interface PartialExitLevel {
  id: string;
  name: string;
  percentage: number; // Percentage of position to close (0-100)
  triggerType: 'profit' | 'time' | 'price' | 'atr' | 'trailing' | 'regime';
  
  // Profit-based triggers
  profitTarget?: {
    type: 'pips' | 'percentage' | 'rr_ratio' | 'amount';
    value: number;
  };
  
  // Time-based triggers
  timeTarget?: {
    type: 'duration' | 'specific_time' | 'session_end';
    value: number; // minutes for duration, HH:mm for specific_time
    sessionType?: 'sydney' | 'tokyo' | 'london' | 'newyork' | 'any';
  };
  
  // Price-based triggers
  priceTarget?: {
    type: 'absolute' | 'relative' | 'support' | 'resistance';
    value: number;
    lookback?: number; // for support/resistance
  };
  
  // ATR-based triggers
  atrTarget?: {
    multiplier: number;
    direction: 'profit' | 'loss';
  };
  
  // Trailing triggers
  trailingTarget?: {
    distance: number;
    distanceType: 'pips' | 'percentage' | 'atr';
    activationPoint: number; // When to start trailing
    activationType: 'pips' | 'percentage' | 'rr_ratio';
  };
  
  // Market regime triggers
  regimeTarget?: {
    regime: MarketRegime;
    confidence: number; // Minimum confidence required
    action: 'partial_exit' | 'full_exit' | 'skip';
  };
  
  // Advanced settings
  conditions?: {
    requireConfirmation?: boolean;
    confirmationTimeframes?: string[];
    minConfidence?: number;
    maxSpread?: number;
    minVolume?: number;
  };
  
  // Dynamic adjustments
  dynamicAdjustments?: {
    volatilityScaling: boolean;
    timeScaling: boolean;
    regimeScaling: boolean;
  };
  
  isActive: boolean;
  priority: number; // Lower number = higher priority
  description?: string;
}

export interface EnhancedPartialExitConfig {
  enabled: boolean;
  strategy: 'sequential' | 'parallel' | 'conditional';
  
  // Exit levels configuration
  levels: PartialExitLevel[];
  
  // Global settings
  globalSettings: {
    allowReentry: boolean;
    minRemainingPosition: number; // Minimum position to keep (percentage)
    maxDailyPartialExits: number;
    cooldownPeriod: number; // Minutes between partial exits
    
    // Risk management
    reduceInHighVolatility: boolean;
    volatilityThreshold: number;
    adjustForSpread: boolean;
    maxSpreadPercentage: number;
    
    // Time-based settings
    respectMarketSessions: boolean;
    avoidNewsEvents: boolean;
    newsBufferMinutes: number;
  };
  
  // Performance tracking
  performanceTracking: {
    enabled: boolean;
    trackEffectiveness: boolean;
    optimizeLevels: boolean;
    lookbackPeriod: number; // Days for optimization
  };
  
  // Integration with existing systems
  integration: {
    withSmartExits: boolean;
    withTrailingStops: boolean;
    withRiskManagement: boolean;
    withRegimeDetection: boolean;
  };
}

export interface PartialExitExecution {
  id: string;
  tradeId: string;
  levelId: string;
  levelName: string;
  
  // Execution details
  timestamp: Date;
  price: number;
  quantity: number; // Amount closed
  percentage: number; // Percentage of original position
  remainingQuantity: number;
  
  // Trigger information
  triggerType: PartialExitLevel['triggerType'];
  triggerValue: number;
  triggerReason: string;
  
  // Market context
  marketContext: {
    regime: MarketRegime;
    volatility: number;
    spread: number;
    session: string;
  };
  
  // Performance metrics
  realizedProfit: number;
  unrealizedProfit: number;
  totalProfit: number;
  riskReduction: number;
  
  // Execution quality
  executionQuality: {
    slippage: number;
    executionTime: number; // milliseconds
    priceImprovement: number;
  };
  
  // Metadata
  metadata: {
    confidence: number;
    warnings: string[];
    notes?: string;
  };
}

export interface PartialExitPerformance {
  levelId: string;
  levelName: string;
  
  // Performance metrics
  totalExecutions: number;
  successRate: number;
  averageProfit: number;
  totalProfit: number;
  riskReduction: number;
  
  // Timing metrics
  averageTimeToExecution: number; // minutes
  bestTimeToExecute: string; // session/time
  worstTimeToExecute: string;
  
  // Market context performance
  performanceByRegime: Record<MarketRegime, {
    executions: number;
    successRate: number;
    avgProfit: number;
  }>;
  
  // Optimization suggestions
  suggestions: Array<{
    type: 'adjust_percentage' | 'adjust_trigger' | 'adjust_timing' | 'disable';
    currentValue: number;
    suggestedValue: number;
    expectedImprovement: number;
    confidence: number;
  }>;
  
  // Historical data
  history: PartialExitExecution[];
  
  // Last updated
  lastUpdated: Date;
}

export interface PartialExitCalculationParams {
  // Trade information
  tradeId: string;
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  tradeType: 'BUY' | 'SELL';
  originalQuantity: number;
  remainingQuantity: number;
  entryTime: Date;
  
  // Market data
  atr?: number;
  volatility?: number;
  spread?: number;
  volume?: number;
  
  // Market context
  currentRegime?: MarketRegime;
  regimeConfidence?: number;
  currentSession?: string;
  
  // Historical performance
  historicalPerformance?: PartialExitPerformance[];
  
  // Configuration
  config: EnhancedPartialExitConfig;
  
  // Additional context
  metadata?: {
    newsEvents?: Array<{
      time: Date;
      impact: 'low' | 'medium' | 'high';
      currency: string;
    }>;
    correlationData?: CorrelationAnalysisResult;
    swingPoints?: SwingPoint[];
  };
}

export interface PartialExitCalculationResult {
  // Recommendations
  shouldExit: boolean;
  recommendedExits: Array<{
    levelId: string;
    levelName: string;
    percentage: number;
    quantity: number;
    price?: number;
    reason: string;
    confidence: number;
    urgency: 'low' | 'medium' | 'high' | 'immediate';
  }>;
  
  // Analysis
  analysis: {
    currentProfit: number;
    currentProfitPercentage: number;
    unrealizedProfit: number;
    riskExposure: number;
    
    // Market analysis
    marketConditions: {
      regime: MarketRegime;
      volatility: 'low' | 'normal' | 'high';
      trend: 'up' | 'down' | 'sideways';
      strength: number;
    };
    
    // Risk analysis
    riskMetrics: {
      currentRisk: number;
      maxRisk: number;
      riskReductionPotential: number;
      stopLossDistance: number;
    };
  };
  
  // Performance predictions
  predictions: {
    expectedProfit: number;
    probabilityOfSuccess: number;
    riskReduction: number;
    optimalExitTiming: Date;
  };
  
  // Warnings and recommendations
  warnings: string[];
  recommendations: string[];
  
  // Metadata
  timestamp: Date;
  calculationTime: number; // milliseconds
}

export interface PartialExitOptimizationResult {
  // Optimized configuration
  optimizedConfig: EnhancedPartialExitConfig;
  
  // Performance comparison
  performanceComparison: {
    before: {
      totalProfit: number;
      winRate: number;
      maxDrawdown: number;
      sharpeRatio: number;
    };
    after: {
      totalProfit: number;
      winRate: number;
      maxDrawdown: number;
      sharpeRatio: number;
    };
    improvement: {
      profitImprovement: number;
      winRateImprovement: number;
      drawdownReduction: number;
      sharpeImprovement: number;
    };
  };
  
  // Optimization details
  optimizationDetails: {
    algorithm: string;
    iterations: number;
    convergenceTime: number;
    parametersOptimized: string[];
  };
  
  // Validation results
  validation: {
    backtestPeriod: {
      from: Date;
      to: Date;
    };
    outOfSampleResults: {
      profit: number;
      winRate: number;
      maxDrawdown: number;
    };
    robustnessScore: number;
  };
  
  // Recommendations
  recommendations: Array<{
    type: 'configuration' | 'risk_management' | 'timing';
    description: string;
    expectedImpact: number;
    implementationComplexity: 'low' | 'medium' | 'high';
  }>;
  
  timestamp: Date;
}

// Performance Analytics Dashboard Types
export interface AnalyticsDashboard {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  layout: DashboardLayout;
  widgets: AnalyticsWidget[];
  filters: AnalyticsFilters;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardLayout {
  columns: number;
  rows: number;
  gap: number;
}

export interface AnalyticsWidget {
  id: string;
  type: WidgetType;
  title: string;
  position: WidgetPosition;
  config: WidgetConfig;
  dataSource: WidgetDataSource;
  refreshInterval?: number; // seconds
  isVisible: boolean;
}

export type WidgetType =
  | 'performance_overview'
  | 'equity_curve'
  | 'monthly_performance'
  | 'win_rate_analysis'
  | 'risk_metrics'
  | 'strategy_comparison'
  | 'performance_trends'
  | 'drawdown_analysis'
  | 'trade_distribution'
  | 'symbol_performance'
  | 'time_analysis'
  | 'real_time_monitoring';

export interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WidgetConfig {
  timeframe?: TimeFrame;
  chartType?: ChartType;
  showLegend?: boolean;
  showGrid?: boolean;
  colors?: string[];
  metrics?: string[];
  strategyIds?: string[];
  symbols?: string[];
  maxItems?: number;
}

export type WidgetDataSource =
  | 'trades'
  | 'backtests'
  | 'combined'
  | 'real_time'
  | 'custom';

export type TimeFrame = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';
export type ChartType = 'line' | 'bar' | 'area' | 'pie' | 'scatter' | 'heatmap';

export interface AnalyticsFilters {
  timeFrame: TimeFrame;
  strategies: string[];
  symbols: string[];
  tradeType?: 'ALL' | 'BUY' | 'SELL';
  minProfit?: number;
  maxProfit?: number;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface PerformanceMetrics {
  // Basic metrics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalProfitPercent: number;
  
  // Risk metrics
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  profitFactor: number;
  
  // Trade metrics
  averageWin: number;
  averageLoss: number;
  averageTrade: number;
  largestWin: number;
  largestLoss: number;
  averageHoldingTime: number;
  
  // Advanced metrics
  expectancy: number;
  recoveryFactor: number;
  var95: number; // Value at Risk 95%
  cvar95: number; // Conditional Value at Risk 95%
  riskOfRuin: number;
  kellyCriterion: number;
  
  // Consistency metrics
  monthlyWinRate: number;
  quarterlyWinRate: number;
  yearlyWinRate: number;
  winRateStability: number;
  profitConsistency: number;
  
  // Time-based metrics
  tradesPerMonth: number;
  tradesPerWeek: number;
  tradesPerDay: number;
  bestDay: string;
  worstDay: string;
  bestMonth: string;
  worstMonth: string;
}

export interface StrategyPerformanceData {
  strategyId: string;
  strategyName: string;
  metrics: PerformanceMetrics;
  equityCurve: EquityPoint[];
  monthlyData: MonthlyPerformanceData[];
  drawdownPeriods: DrawdownPeriod[];
  tradesBySymbol: SymbolPerformanceData[];
  tradesByTimeframe: TimeframePerformanceData[];
  score: StrategyScore;
  rank: number;
}

export interface MonthlyPerformanceData {
  month: string; // YYYY-MM format
  year: number;
  profit: number;
  profitPercent: number;
  trades: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
}

export interface SymbolPerformanceData {
  symbol: string;
  trades: number;
  winRate: number;
  profit: number;
  profitPercent: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

export interface TimeframePerformanceData {
  timeframe: string;
  trades: number;
  winRate: number;
  profit: number;
  profitPercent: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

export interface DrawdownPeriod {
  id: string;
  startTime: Date;
  endTime?: Date;
  startEquity: number;
  endEquity: number;
  depth: number;
  depthPercent: number;
  duration: number; // in days
  recovered: boolean;
  recoveryTime?: number; // in days
}

export interface EquityPoint {
  timestamp: Date;
  equity: number;
  date: string;
  profit?: number;
  drawdown?: number;
}

export interface PerformanceTrend {
  period: string;
  metric: string;
  value: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface RealTimePerformanceData {
  timestamp: Date;
  openPositions: OpenPositionData[];
  closedTradesToday: TradeData[];
  currentEquity: number;
  dailyPnL: number;
  dailyDrawdown: number;
  activeStrategies: string[];
  marketStatus: MarketStatus;
  alerts: PerformanceAlert[];
}

export interface OpenPositionData {
  tradeId: string;
  strategyId: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  currentPrice: number;
  volume: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  duration: number; // in minutes
  stopLoss?: number;
  takeProfit?: number;
}

export interface TradeData {
  tradeId: string;
  strategyId: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  volume: number;
  profit: number;
  profitPercent: number;
  duration: number; // in minutes
  entryTime: Date;
  exitTime: Date;
}

export interface MarketStatus {
  session: 'sydney' | 'tokyo' | 'london' | 'newyork' | 'closed';
  isOpen: boolean;
  volatility: 'low' | 'normal' | 'high';
  spread: number;
  nextOpen: Date;
  nextClose: Date;
}

export interface PerformanceAlert {
  id: string;
  type: AlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  strategyId?: string;
  currentValue: number;
  threshold: number;
  triggeredAt: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

export type AlertType =
  | 'drawdown'
  | 'win_rate'
  | 'profit_factor'
  | 'sharpe_ratio'
  | 'daily_loss'
  | 'consecutive_losses'
  | 'position_size'
  | 'margin_call'
  | 'strategy_inactive'
  | 'market_volatility';

export interface AnalyticsExportOptions {
  format: 'pdf' | 'excel' | 'csv' | 'json';
  includeCharts: boolean;
  includeRawData: boolean;
  dateRange: {
    start: Date;
    end: Date;
  };
  strategies?: string[];
  metrics?: string[];
  template?: 'standard' | 'detailed' | 'summary' | 'custom';
}

export interface AnalyticsReport {
  id: string;
  userId: string;
  title: string;
  description?: string;
  type: 'performance' | 'strategy' | 'risk' | 'custom';
  format: string;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  data: any;
  fileUrl?: string;
  fileSize?: number;
  status: 'generating' | 'completed' | 'failed';
  expiresAt?: Date;
}

export interface AnalyticsComparison {
  id: string;
  name: string;
  type: 'strategy' | 'timeframe' | 'symbol' | 'custom';
  items: ComparisonItem[];
  metrics: string[];
  period: {
    start: Date;
    end: Date;
  };
  results: ComparisonResult[];
  createdAt: Date;
}

export interface ComparisonItem {
  id: string;
  name: string;
  type: 'strategy' | 'symbol' | 'timeframe';
  metadata?: Record<string, any>;
}

export interface ComparisonResult {
  itemId: string;
  metrics: Record<string, number>;
  rank: number;
  score: number;
  strengths: string[];
  weaknesses: string[];
}

// WebSocket subscription types for real-time updates
export interface AnalyticsSubscription {
  id: string;
  userId: string;
  type: 'performance' | 'trades' | 'positions' | 'alerts';
  filters: AnalyticsFilters;
  active: boolean;
  createdAt: Date;
  lastActivity: Date;
}

export interface AnalyticsUpdateMessage {
  type: 'performance_update' | 'trade_update' | 'position_update' | 'alert';
  data: any;
  timestamp: Date;
  subscriptionId: string;
}
