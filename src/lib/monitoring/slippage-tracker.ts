/**
 * SlippageTracker class for tracking slippage
 * Calculates and analyzes slippage across trades, symbols, and time periods
 */

import {
  SlippageMetrics,
  SlippageDistribution,
  SlippageBucket,
  HistoricalDataPoint,
  SlippageThresholds
} from './monitoring-types';

// Symbol-specific configuration for pip calculation
interface SymbolConfig {
  pipSize: number;
  digits: number;
}

// Default thresholds for slippage monitoring
const DEFAULT_SLIPPAGE_THRESHOLDS: SlippageThresholds = {
  maxNegativeSlippage: 3, // 3 pips
  maxNegativeSlippagePercent: 0.1, // 0.1%
  slippageTolerance: 2, // 2 pips
  slippageAnomalyThreshold: 2 // 2 standard deviations
};

// Default symbol configurations
const DEFAULT_SYMBOL_CONFIGS: Record<string, SymbolConfig> = {
  'EURUSD': { pipSize: 0.0001, digits: 5 },
  'GBPUSD': { pipSize: 0.0001, digits: 5 },
  'USDJPY': { pipSize: 0.01, digits: 3 },
  'AUDUSD': { pipSize: 0.0001, digits: 5 },
  'USDCAD': { pipSize: 0.0001, digits: 5 },
  'USDCHF': { pipSize: 0.0001, digits: 5 },
  'NZDUSD': { pipSize: 0.0001, digits: 5 },
  'EURJPY': { pipSize: 0.01, digits: 3 },
  'GBPJPY': { pipSize: 0.01, digits: 3 },
  'EURGBP': { pipSize: 0.0001, digits: 5 },
  // Default for other symbols
  'DEFAULT': { pipSize: 0.0001, digits: 5 }
};

export class SlippageTracker {
  private slippageHistory: SlippageMetrics[] = [];
  private symbolConfigs: Map<string, SymbolConfig>;
  private thresholds: SlippageThresholds;
  private maxHistorySize: number;
  private enableDebugLogging: boolean;

  constructor(
    thresholds?: Partial<SlippageThresholds>,
    symbolConfigs?: Record<string, SymbolConfig>,
    options?: {
      maxHistorySize?: number;
      enableDebugLogging?: boolean;
    }
  ) {
    this.thresholds = { ...DEFAULT_SLIPPAGE_THRESHOLDS, ...thresholds };
    this.maxHistorySize = options?.maxHistorySize || 10000;
    this.enableDebugLogging = options?.enableDebugLogging || false;
    
    // Initialize symbol configurations
    this.symbolConfigs = new Map();
    const configs = { ...DEFAULT_SYMBOL_CONFIGS, ...symbolConfigs };
    for (const [symbol, config] of Object.entries(configs)) {
      this.symbolConfigs.set(symbol, config);
    }
  }

  /**
   * Record a new slippage event
   * @param slippage The slippage metrics to record
   */
  recordSlippage(slippage: SlippageMetrics): void {
    // Add to history
    this.slippageHistory.push(slippage);
    
    // Limit history size
    if (this.slippageHistory.length > this.maxHistorySize) {
      this.slippageHistory.shift();
    }

    if (this.enableDebugLogging) {
      console.log(`[SlippageTracker] Recorded slippage for order ${slippage.orderId}:`, {
        symbol: slippage.symbol,
        slippage: slippage.slippage,
        slippagePips: slippage.slippagePips,
        slippageType: slippage.slippageType
      });
    }
  }

  /**
   * Calculate slippage from expected and actual prices
   * @param orderId The order ID
   * @param symbol The trading symbol
   * @param orderType The order type
   * @param direction The trade direction
   * @param volume The trade volume
   * @param expectedPrice The expected price
   * @param actualPrice The actual execution price
   * @param orderTimestamp The order timestamp
   * @param executionTimestamp The execution timestamp
   * @param additionalData Additional data to include
   * @returns The calculated slippage metrics
   */
  calculateSlippage(
    orderId: string,
    symbol: string,
    orderType: 'market' | 'limit' | 'stop' | 'stop_limit',
    direction: 'buy' | 'sell',
    volume: number,
    expectedPrice: number,
    actualPrice: number,
    orderTimestamp: Date,
    executionTimestamp: Date,
    additionalData?: Partial<SlippageMetrics>
  ): SlippageMetrics {
    // Get symbol configuration
    const symbolConfig = this.symbolConfigs.get(symbol) || this.symbolConfigs.get('DEFAULT')!;
    
    // Calculate slippage in price terms
    let slippage = 0;
    if (direction === 'buy') {
      // For buy orders, slippage is actual price - expected price
      slippage = actualPrice - expectedPrice;
    } else {
      // For sell orders, slippage is expected price - actual price
      slippage = expectedPrice - actualPrice;
    }
    
    // Calculate slippage in pips
    const slippagePips = slippage / symbolConfig.pipSize;
    
    // Calculate slippage percentage
    const slippagePercent = Math.abs(slippage / expectedPrice) * 100;
    
    // Determine slippage type
    let slippageType: 'positive' | 'negative' | 'neutral';
    if (Math.abs(slippagePips) < 0.1) { // Less than 0.1 pips is considered neutral
      slippageType = 'neutral';
    } else if (slippage > 0) {
      slippageType = 'positive';
    } else {
      slippageType = 'negative';
    }
    
    // Check if slippage is within tolerance
    const isWithinTolerance = Math.abs(slippagePips) <= this.thresholds.slippageTolerance;
    
    // Create the slippage metrics
    const slippageMetrics: SlippageMetrics = {
      orderId,
      symbol,
      orderType,
      direction,
      volume,
      expectedPrice,
      actualPrice,
      slippage,
      slippagePips,
      slippagePercent,
      orderTimestamp,
      executionTimestamp,
      spreadAtExecution: 0, // Default value, should be provided in additionalData
      slippageType,
      isWithinTolerance,
      ...additionalData
    };
    
    // Record the slippage
    this.recordSlippage(slippageMetrics);
    
    return slippageMetrics;
  }

  /**
   * Get slippage distribution analysis
   * @param periodStart Start of the period
   * @param periodEnd End of the period
   * @param symbol Optional symbol to filter by
   * @returns Slippage distribution analysis
   */
  getSlippageDistribution(
    periodStart?: Date,
    periodEnd?: Date,
    symbol?: string
  ): SlippageDistribution {
    // Filter slippage by time period and symbol
    let filteredSlippage = this.slippageHistory;
    
    if (symbol) {
      filteredSlippage = filteredSlippage.filter(s => s.symbol === symbol);
    }
    
    if (periodStart || periodEnd) {
      filteredSlippage = filteredSlippage.filter(slippage => {
        const timestamp = slippage.executionTimestamp;
        if (periodStart && timestamp < periodStart) return false;
        if (periodEnd && timestamp > periodEnd) return false;
        return true;
      });
    }

    if (filteredSlippage.length === 0) {
      return {
        buckets: [],
        mean: 0,
        median: 0,
        standardDeviation: 0,
        totalTrades: 0,
        positiveSlippageCount: 0,
        negativeSlippageCount: 0,
        neutralSlippageCount: 0,
        positiveSlippagePercent: 0,
        negativeSlippagePercent: 0,
        neutralSlippagePercent: 0,
        periodStart: periodStart || new Date(),
        periodEnd: periodEnd || new Date()
      };
    }

    // Extract slippage values
    const slippageValues = filteredSlippage.map(s => s.slippagePips);
    slippageValues.sort((a, b) => a - b);
    
    // Calculate basic statistics
    const totalTrades = slippageValues.length;
    const sum = slippageValues.reduce((acc, val) => acc + val, 0);
    const mean = sum / totalTrades;
    
    // Calculate median
    const median = totalTrades % 2 === 0
      ? (slippageValues[totalTrades / 2 - 1] + slippageValues[totalTrades / 2]) / 2
      : slippageValues[Math.floor(totalTrades / 2)];
    
    // Calculate variance and standard deviation
    const variance = slippageValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / totalTrades;
    const standardDeviation = Math.sqrt(variance);
    
    // Count slippage types
    const positiveSlippageCount = filteredSlippage.filter(s => s.slippageType === 'positive').length;
    const negativeSlippageCount = filteredSlippage.filter(s => s.slippageType === 'negative').length;
    const neutralSlippageCount = filteredSlippage.filter(s => s.slippageType === 'neutral').length;
    
    const positiveSlippagePercent = (positiveSlippageCount / totalTrades) * 100;
    const negativeSlippagePercent = (negativeSlippageCount / totalTrades) * 100;
    const neutralSlippagePercent = (neutralSlippageCount / totalTrades) * 100;
    
    // Create distribution buckets
    const buckets = this.createSlippageBuckets(slippageValues);
    
    return {
      buckets,
      mean,
      median,
      standardDeviation,
      totalTrades,
      positiveSlippageCount,
      negativeSlippageCount,
      neutralSlippageCount,
      positiveSlippagePercent,
      negativeSlippagePercent,
      neutralSlippagePercent,
      periodStart: periodStart || new Date(Math.min(...filteredSlippage.map(s => s.executionTimestamp.getTime()))),
      periodEnd: periodEnd || new Date(Math.max(...filteredSlippage.map(s => s.executionTimestamp.getTime())))
    };
  }

  /**
   * Get slippage statistics by symbol
   * @param periodStart Start of the period
   * @param periodEnd End of the period
   * @returns Map of symbol to slippage distribution
   */
  getSlippageBySymbol(
    periodStart?: Date,
    periodEnd?: Date
  ): Map<string, SlippageDistribution> {
    const symbolStats = new Map<string, SlippageDistribution>();
    
    // Get all unique symbols
    const symbols = new Set(this.slippageHistory.map(s => s.symbol));
    
    for (const symbol of symbols) {
      symbolStats.set(symbol, this.getSlippageDistribution(periodStart, periodEnd, symbol));
    }
    
    return symbolStats;
  }

  /**
   * Get slippage statistics by time period
   * @param periodStart Start of the period
   * @param periodEnd End of the period
   * @param interval The interval for grouping (hour, day, week, month)
   * @returns Array of slippage distribution by time period
   */
  getSlippageByTimePeriod(
    periodStart?: Date,
    periodEnd?: Date,
    interval: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): SlippageDistribution[] {
    let filteredSlippage = this.slippageHistory;
    
    if (periodStart || periodEnd) {
      filteredSlippage = filteredSlippage.filter(slippage => {
        const timestamp = slippage.executionTimestamp;
        if (periodStart && timestamp < periodStart) return false;
        if (periodEnd && timestamp > periodEnd) return false;
        return true;
      });
    }

    // Group slippage by time interval
    const timeGroups = new Map<number, SlippageMetrics[]>();
    
    for (const slippage of filteredSlippage) {
      let timeKey: number;
      
      switch (interval) {
        case 'hour':
          timeKey = Math.floor(slippage.executionTimestamp.getTime() / (1000 * 60 * 60));
          break;
        case 'day':
          timeKey = Math.floor(slippage.executionTimestamp.getTime() / (1000 * 60 * 60 * 24));
          break;
        case 'week':
          timeKey = Math.floor(slippage.executionTimestamp.getTime() / (1000 * 60 * 60 * 24 * 7));
          break;
        case 'month':
          timeKey = Math.floor(slippage.executionTimestamp.getTime() / (1000 * 60 * 60 * 24 * 30));
          break;
      }
      
      if (!timeGroups.has(timeKey)) {
        timeGroups.set(timeKey, []);
      }
      
      timeGroups.get(timeKey)!.push(slippage);
    }

    // Convert each time group to a slippage distribution
    return Array.from(timeGroups.entries())
      .map(([timeKey, slippages]) => {
        const slippageValues = slippages.map(s => s.slippagePips);
        slippageValues.sort((a, b) => a - b);
        
        const totalTrades = slippageValues.length;
        const sum = slippageValues.reduce((acc, val) => acc + val, 0);
        const mean = totalTrades > 0 ? sum / totalTrades : 0;
        
        const median = totalTrades > 0
          ? (totalTrades % 2 === 0
            ? (slippageValues[totalTrades / 2 - 1] + slippageValues[totalTrades / 2]) / 2
            : slippageValues[Math.floor(totalTrades / 2)])
          : 0;
        
        const variance = totalTrades > 0
          ? slippageValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / totalTrades
          : 0;
        const standardDeviation = Math.sqrt(variance);
        
        const positiveSlippageCount = slippages.filter(s => s.slippageType === 'positive').length;
        const negativeSlippageCount = slippages.filter(s => s.slippageType === 'negative').length;
        const neutralSlippageCount = slippages.filter(s => s.slippageType === 'neutral').length;
        
        return {
          buckets: this.createSlippageBuckets(slippageValues),
          mean,
          median,
          standardDeviation,
          totalTrades,
          positiveSlippageCount,
          negativeSlippageCount,
          neutralSlippageCount,
          positiveSlippagePercent: totalTrades > 0 ? (positiveSlippageCount / totalTrades) * 100 : 0,
          negativeSlippagePercent: totalTrades > 0 ? (negativeSlippageCount / totalTrades) * 100 : 0,
          neutralSlippagePercent: totalTrades > 0 ? (neutralSlippageCount / totalTrades) * 100 : 0,
          periodStart: new Date(timeKey * this.getIntervalMultiplier(interval)),
          periodEnd: new Date((timeKey + 1) * this.getIntervalMultiplier(interval))
        };
      })
      .sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());
  }

  /**
   * Check if slippage exceeds thresholds
   * @param slippage The slippage metrics to check
   * @returns Object with threshold violations
   */
  checkThresholds(slippage: SlippageMetrics): Record<string, boolean> {
    return {
      maxNegativeSlippage: slippage.slippageType === 'negative' && 
        Math.abs(slippage.slippagePips) > this.thresholds.maxNegativeSlippage,
      maxNegativeSlippagePercent: slippage.slippageType === 'negative' && 
        slippage.slippagePercent > this.thresholds.maxNegativeSlippagePercent,
      slippageTolerance: !slippage.isWithinTolerance
    };
  }

  /**
   * Detect slippage anomalies
   * @param periodStart Start of the period
   * @param periodEnd End of the period
   * @param symbol Optional symbol to filter by
   * @returns Array of anomalous slippage events
   */
  detectAnomalies(
    periodStart?: Date,
    periodEnd?: Date,
    symbol?: string
  ): SlippageMetrics[] {
    // Get slippage distribution for the period
    const distribution = this.getSlippageDistribution(periodStart, periodEnd, symbol);
    
    if (distribution.totalTrades < 10) { // Not enough data to detect anomalies
      return [];
    }
    
    // Filter slippage by time period and symbol
    let filteredSlippage = this.slippageHistory;
    
    if (symbol) {
      filteredSlippage = filteredSlippage.filter(s => s.symbol === symbol);
    }
    
    if (periodStart || periodEnd) {
      filteredSlippage = filteredSlippage.filter(slippage => {
        const timestamp = slippage.executionTimestamp;
        if (periodStart && timestamp < periodStart) return false;
        if (periodEnd && timestamp > periodEnd) return false;
        return true;
      });
    }
    
    // Detect anomalies based on standard deviation
    return filteredSlippage.filter(slippage => {
      const zScore = Math.abs(slippage.slippagePips - distribution.mean) / distribution.standardDeviation;
      return zScore > this.thresholds.slippageAnomalyThreshold;
    });
  }

  /**
   * Get historical slippage data
   * @param periodStart Start of the period
   * @param periodEnd End of the period
   * @param symbol Optional symbol to filter by
   * @returns Array of historical data points
   */
  getHistoricalData(
    periodStart?: Date,
    periodEnd?: Date,
    symbol?: string
  ): HistoricalDataPoint<number>[] {
    let filteredSlippage = this.slippageHistory;
    
    if (symbol) {
      filteredSlippage = filteredSlippage.filter(s => s.symbol === symbol);
    }
    
    if (periodStart || periodEnd) {
      filteredSlippage = filteredSlippage.filter(slippage => {
        const timestamp = slippage.executionTimestamp;
        if (periodStart && timestamp < periodStart) return false;
        if (periodEnd && timestamp > periodEnd) return false;
        return true;
      });
    }

    return filteredSlippage
      .map(slippage => ({
        timestamp: slippage.executionTimestamp,
        value: slippage.slippagePips,
        metadata: {
          orderId: slippage.orderId,
          symbol: slippage.symbol,
          orderType: slippage.orderType,
          direction: slippage.direction,
          slippageType: slippage.slippageType,
          isWithinTolerance: slippage.isWithinTolerance
        }
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Add or update symbol configuration
   * @param symbol The symbol
   * @param config The symbol configuration
   */
  setSymbolConfig(symbol: string, config: SymbolConfig): void {
    this.symbolConfigs.set(symbol, config);
    
    if (this.enableDebugLogging) {
      console.log(`[SlippageTracker] Updated config for ${symbol}:`, config);
    }
  }

  /**
   * Clear all slippage history
   */
  clearHistory(): void {
    this.slippageHistory = [];
    
    if (this.enableDebugLogging) {
      console.log('[SlippageTracker] Cleared all history');
    }
  }

  /**
   * Get the current thresholds
   * @returns The current thresholds
   */
  getThresholds(): SlippageThresholds {
    return { ...this.thresholds };
  }

  /**
   * Update the thresholds
   * @param newThresholds The new thresholds
   */
  updateThresholds(newThresholds: Partial<SlippageThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    
    if (this.enableDebugLogging) {
      console.log('[SlippageTracker] Updated thresholds:', this.thresholds);
    }
  }

  /**
   * Create slippage distribution buckets
   * @param slippageValues Sorted array of slippage values
   * @returns Array of slippage buckets
   */
  private createSlippageBuckets(slippageValues: number[]): SlippageBucket[] {
    if (slippageValues.length === 0) {
      return [];
    }
    
    const min = slippageValues[0];
    const max = slippageValues[slippageValues.length - 1];
    
    // Create 10 buckets
    const bucketCount = 10;
    const bucketSize = (max - min) / bucketCount;
    
    const buckets: SlippageBucket[] = [];
    
    for (let i = 0; i < bucketCount; i++) {
      const minSlippage = min + (i * bucketSize);
      const maxSlippage = min + ((i + 1) * bucketSize);
      
      // Count values in this bucket
      const count = slippageValues.filter(
        value => value >= minSlippage && (i === bucketCount - 1 ? value <= maxSlippage : value < maxSlippage)
      ).length;
      
      buckets.push({
        minSlippage,
        maxSlippage,
        count,
        percentage: slippageValues.length > 0 ? (count / slippageValues.length) * 100 : 0
      });
    }
    
    return buckets;
  }

  /**
   * Get the multiplier for a time interval in milliseconds
   * @param interval The time interval
   * @returns The multiplier in milliseconds
   */
  private getIntervalMultiplier(interval: 'hour' | 'day' | 'week' | 'month'): number {
    switch (interval) {
      case 'hour':
        return 1000 * 60 * 60;
      case 'day':
        return 1000 * 60 * 60 * 24;
      case 'week':
        return 1000 * 60 * 60 * 24 * 7;
      case 'month':
        return 1000 * 60 * 60 * 24 * 30;
    }
  }
}