/**
 * MULTI-TIMEFRAME ANALYSIS
 * Core component for analyzing signals across multiple timeframes
 * Phase 2.1 Implementation
 */

import { 
  MTFStrategy, 
  MTFDataPoint, 
  MTFAnalysisResult, 
  MTFConfirmation,
  StrategyCondition,
  MTFEntryRules
} from '../../types';

export interface MTFAnalyzerConfig {
  strategy: MTFStrategy;
  marketData: Record<string, any[]>; // timeframe -> data array
  currentTime: Date;
}

export interface TimeframeData {
  timeframe: string;
  data: any[];
  indicators: Record<string, number>;
  lastUpdate: Date;
}

export class MTFAnalyzer {
  private config: MTFAnalyzerConfig;
  private timeframeData: Map<string, TimeframeData> = new Map();
  private indicatorCache: Map<string, Record<string, number>> = new Map();

  constructor(config: MTFAnalyzerConfig) {
    this.config = config;
    this.initializeTimeframeData();
  }

  /**
   * Initialize timeframe data from market data
   */
  private initializeTimeframeData(): void {
    const { primaryTimeframe, confirmationTimeframes } = this.config.strategy;
    
    // Initialize primary timeframe
    if (this.config.marketData[primaryTimeframe]) {
      this.timeframeData.set(primaryTimeframe, {
        timeframe: primaryTimeframe,
        data: this.config.marketData[primaryTimeframe],
        indicators: {},
        lastUpdate: new Date()
      });
    }

    // Initialize confirmation timeframes
    for (const tf of confirmationTimeframes) {
      if (this.config.marketData[tf]) {
        this.timeframeData.set(tf, {
          timeframe: tf,
          data: this.config.marketData[tf],
          indicators: {},
          lastUpdate: new Date()
        });
      }
    }
  }

  /**
   * Perform complete MTF analysis
   */
  async analyze(): Promise<MTFAnalysisResult> {
    try {
      // 1. Calculate indicators for all timeframes
      await this.calculateAllTimeframeIndicators();

      // 2. Check primary timeframe conditions
      const primarySignal = await this.checkPrimaryTimeframeConditions();

      if (!primarySignal) {
        return this.createAnalysisResult(false, primarySignal, [], 0);
      }

      // 3. Check confirmation timeframes
      const confirmations = await this.checkConfirmations();

      // 4. Evaluate overall signal
      const overallSignal = this.evaluateOverallSignal(primarySignal, confirmations);

      // 5. Calculate confidence score
      const confidence = this.calculateConfidence(primarySignal, confirmations);

      return this.createAnalysisResult(overallSignal, primarySignal, confirmations, confidence);

    } catch (error) {
      console.error('MTF Analysis error:', error);
      return this.createAnalysisResult(false, false, [], 0);
    }
  }

  /**
   * Calculate indicators for all timeframes
   */
  private async calculateAllTimeframeIndicators(): Promise<void> {
    for (const [timeframe, tfData] of this.timeframeData) {
      const indicators = await this.calculateTimeframeIndicators(tfData);
      tfData.indicators = indicators;
      this.indicatorCache.set(timeframe, indicators);
    }
  }

  /**
   * Calculate indicators for a specific timeframe
   */
  private async calculateTimeframeIndicators(tfData: TimeframeData): Promise<Record<string, number>> {
    const indicators: Record<string, number> = {};
    const data = tfData.data;

    if (data.length === 0) return indicators;

    // Extract unique indicators from strategy rules
    const allConditions = [
      ...this.config.strategy.rules.entry.primary,
      ...this.config.strategy.rules.entry.confirmation.map(c => c.condition)
    ];

    const uniqueIndicators = new Set(
      allConditions.map(c => this.extractIndicatorName(c.indicator))
    );

    // Calculate each indicator
    for (const indicator of uniqueIndicators) {
      try {
        indicators[indicator] = await this.calculateIndicator(indicator, data);
      } catch (error) {
        console.warn(`Failed to calculate ${indicator} for ${tfData.timeframe}:`, error);
        indicators[indicator] = 0;
      }
    }

    return indicators;
  }

  /**
   * Calculate a specific indicator
   */
  private async calculateIndicator(indicator: string, data: any[]): Promise<number> {
    switch (indicator) {
      case 'RSI':
        return this.calculateRSI(data, 14);
      case 'EMA_20':
        return this.calculateEMA(data, 20);
      case 'EMA_50':
        return this.calculateEMA(data, 50);
      case 'EMA_200':
        return this.calculateEMA(data, 200);
      case 'SMA_20':
        return this.calculateSMA(data, 20);
      case 'SMA_50':
        return this.calculateSMA(data, 50);
      case 'SMA_200':
        return this.calculateSMA(data, 200);
      case 'MACD':
        return this.calculateMACD(data).macd;
      case 'ADX':
        return this.calculateADX(data, 14);
      case 'ATR':
        return this.calculateATR(data, 14);
      case 'Stochastic':
        return this.calculateStochastic(data, 14);
      case 'CCI':
        return this.calculateCCI(data, 14);
      case 'Williams_%R':
        return this.calculateWilliamsR(data, 14);
      default:
        console.warn(`Unknown indicator: ${indicator}`);
        return 0;
    }
  }

  /**
   * Check primary timeframe conditions
   */
  private async checkPrimaryTimeframeConditions(): Promise<boolean> {
    const primaryTF = this.config.strategy.primaryTimeframe;
    const tfData = this.timeframeData.get(primaryTF);
    
    if (!tfData) {
      console.error(`Primary timeframe ${primaryTF} not available`);
      return false;
    }

    const primaryConditions = this.config.strategy.rules.entry.primary;
    
    // Check all primary conditions (AND logic)
    for (const condition of primaryConditions) {
      const indicatorValue = tfData.indicators[this.extractIndicatorName(condition.indicator)];
      
      if (condition.value === undefined || !this.evaluateCondition(indicatorValue, condition.condition, condition.value)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check confirmation timeframes
   */
  private async checkConfirmations(): Promise<Array<{
    timeframe: string;
    signal: boolean;
    condition: StrategyCondition;
    met: boolean;
  }>> {
    const confirmations = [];
    const confirmationRules = this.config.strategy.rules.entry.confirmation;

    for (const rule of confirmationRules) {
      const tfData = this.timeframeData.get(rule.timeframe);
      
      if (!tfData) {
        console.warn(`Confirmation timeframe ${rule.timeframe} not available`);
        confirmations.push({
          timeframe: rule.timeframe,
          signal: false,
          condition: rule.condition,
          met: false
        });
        continue;
      }

      const indicatorValue = tfData.indicators[this.extractIndicatorName(rule.condition.indicator)];
      const met = rule.condition.value !== undefined && this.evaluateCondition(indicatorValue, rule.condition.condition, rule.condition.value);

      confirmations.push({
        timeframe: rule.timeframe,
        signal: met,
        condition: rule.condition,
        met
      });
    }

    return confirmations;
  }

  /**
   * Evaluate overall signal based on primary and confirmations
   */
  private evaluateOverallSignal(
    primarySignal: boolean,
    confirmations: Array<{ timeframe: string; signal: boolean; condition: StrategyCondition; met: boolean }>
  ): boolean {
    if (!primarySignal) return false;

    // Check required confirmations
    const requiredConfirmations = this.config.strategy.rules.entry.confirmation.filter(c => c.required);
    const requiredMet = confirmations.filter(c => 
      requiredConfirmations.some(rc => rc.timeframe === c.timeframe) && c.met
    );

    // All required confirmations must be met
    if (requiredMet.length < requiredConfirmations.length) {
      return false;
    }

    return true;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    primarySignal: boolean,
    confirmations: Array<{ timeframe: string; signal: boolean; condition: StrategyCondition; met: boolean }>
  ): number {
    if (!primarySignal) return 0;

    let confidence = 0.5; // Base confidence for primary signal

    // Add confidence for each confirmation
    const totalConfirmations = this.config.strategy.rules.entry.confirmation.length;
    const metConfirmations = confirmations.filter(c => c.met).length;

    if (totalConfirmations > 0) {
      const confirmationBonus = (metConfirmations / totalConfirmations) * 0.5;
      confidence += confirmationBonus;
    }

    // Weight required confirmations more heavily
    const requiredConfirmations = this.config.strategy.rules.entry.confirmation.filter(c => c.required);
    const requiredMet = confirmations.filter(c => 
      requiredConfirmations.some(rc => rc.timeframe === c.timeframe) && c.met
    );

    if (requiredConfirmations.length > 0 && requiredMet.length === requiredConfirmations.length) {
      confidence += 0.2; // Bonus for meeting all required confirmations
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Create analysis result
   */
  private createAnalysisResult(
    overallSignal: boolean,
    primarySignal: boolean,
    confirmations: Array<{ timeframe: string; signal: boolean; condition: StrategyCondition; met: boolean }>,
    confidence: number
  ): MTFAnalysisResult {
    return {
      primarySignal,
      confirmations,
      overallSignal,
      confidence,
      timestamp: new Date()
    };
  }

  /**
   * Extract indicator name from condition indicator
   */
  private extractIndicatorName(indicator: string): string {
    // Handle cases like "EMA_50" -> "EMA_50"
    return indicator;
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(value: number, operator: string, threshold: number | string): boolean {
    const numValue = Number(value);
    const numThreshold = Number(threshold);

    switch (operator) {
      case 'greater_than':
        return numValue > numThreshold;
      case 'less_than':
        return numValue < numThreshold;
      case 'equals':
        return numValue === numThreshold;
      case 'crosses_above':
        return this.checkCrossAbove(numValue, numThreshold);
      case 'crosses_below':
        return this.checkCrossBelow(numValue, numThreshold);
      default:
        console.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }

  /**
   * Check if value crosses above threshold
   */
  private checkCrossAbove(current: number, threshold: number): boolean {
    // Simplified implementation - in production would track previous values
    return current > threshold;
  }

  /**
   * Check if value crosses below threshold
   */
  private checkCrossBelow(current: number, threshold: number): boolean {
    // Simplified implementation - in production would track previous values
    return current < threshold;
  }

  // Indicator calculation methods

  private calculateRSI(data: any[], period: number = 14): number {
    if (data.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = data.length - period; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      if (change > 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateEMA(data: any[], period: number): number {
    if (data.length < period) return data[data.length - 1]?.close || 0;

    const multiplier = 2 / (period + 1);
    let ema = data[data.length - period - 1].close;

    for (let i = data.length - period; i < data.length; i++) {
      ema = (data[i].close - ema) * multiplier + ema;
    }

    return ema;
  }

  private calculateSMA(data: any[], period: number): number {
    if (data.length < period) return data[data.length - 1]?.close || 0;

    const sum = data.slice(-period).reduce((acc, candle) => acc + candle.close, 0);
    return sum / period;
  }

  private calculateMACD(data: any[]): { macd: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(data, 12);
    const ema26 = this.calculateEMA(data, 26);
    const macd = ema12 - ema26;
    
    // Simplified signal line calculation
    const signal = macd * 0.9; // Simplified
    const histogram = macd - signal;

    return { macd, signal, histogram };
  }

  private calculateADX(data: any[], period: number = 14): number {
    // Simplified ADX calculation
    if (data.length < period) return 25;

    let sumDX = 0;
    for (let i = data.length - period; i < data.length; i++) {
      // Simplified DX calculation
      const dx = Math.random() * 100; // Placeholder
      sumDX += dx;
    }

    return sumDX / period;
  }

  private calculateATR(data: any[], period: number = 14): number {
    if (data.length < 2) return 0.002;

    let totalTR = 0;
    for (let i = Math.max(1, data.length - period); i < data.length; i++) {
      const high = data[i].high || data[i].close * 1.001;
      const low = data[i].low || data[i].close * 0.999;
      const prevClose = data[i - 1].close;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      totalTR += tr;
    }
    
    return totalTR / Math.min(period, data.length - 1);
  }

  private calculateStochastic(data: any[], period: number = 14): number {
    if (data.length < period) return 50;

    const recentData = data.slice(-period);
    const highestHigh = Math.max(...recentData.map(d => d.high || d.close));
    const lowestLow = Math.min(...recentData.map(d => d.low || d.close));
    const currentClose = recentData[recentData.length - 1].close;

    return ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  }

  private calculateCCI(data: any[], period: number = 14): number {
    if (data.length < period) return 0;

    const typicalPrices = data.slice(-period).map(d => (d.high + d.low + d.close) / 3);
    const sma = typicalPrices.reduce((sum, price) => sum + price, 0) / period;
    
    let meanDeviation = 0;
    for (const price of typicalPrices) {
      meanDeviation += Math.abs(price - sma);
    }
    meanDeviation /= period;

    const currentTP = typicalPrices[typicalPrices.length - 1];
    return meanDeviation > 0 ? (currentTP - sma) / (0.015 * meanDeviation) : 0;
  }

  private calculateWilliamsR(data: any[], period: number = 14): number {
    if (data.length < period) return -50;

    const recentData = data.slice(-period);
    const highestHigh = Math.max(...recentData.map(d => d.high || d.close));
    const lowestLow = Math.min(...recentData.map(d => d.low || d.close));
    const currentClose = recentData[recentData.length - 1].close;

    const denominator = highestHigh - lowestLow;
    return denominator > 0 ? ((highestHigh - currentClose) / denominator) * -100 : -50;
  }

  /**
   * Get latest data for all timeframes
   */
  getLatestData(): MTFDataPoint[] {
    const dataPoints: MTFDataPoint[] = [];

    for (const [timeframe, tfData] of this.timeframeData) {
      if (tfData.data.length > 0) {
        const latestCandle = tfData.data[tfData.data.length - 1];
        dataPoints.push({
          timeframe,
          timestamp: new Date(latestCandle.timestamp || Date.now()),
          indicators: tfData.indicators,
          price: {
            open: latestCandle.open,
            high: latestCandle.high,
            low: latestCandle.low,
            close: latestCandle.close
          }
        });
      }
    }

    return dataPoints;
  }

  /**
   * Update market data for a specific timeframe
   */
  updateTimeframe(timeframe: string, newData: any[]): void {
    const tfData = this.timeframeData.get(timeframe);
    if (tfData) {
      tfData.data = newData;
      tfData.lastUpdate = new Date();
      // Clear cached indicators for this timeframe
      this.indicatorCache.delete(timeframe);
    }
  }

  /**
   * Get analysis summary
   */
  getAnalysisSummary(): {
    primaryTimeframe: string;
    confirmationTimeframes: string[];
    lastUpdate: Date;
    availableIndicators: Record<string, string[]>;
  } {
    const availableIndicators: Record<string, string[]> = {};
    
    for (const [timeframe, tfData] of this.timeframeData) {
      availableIndicators[timeframe] = Object.keys(tfData.indicators);
    }

    return {
      primaryTimeframe: this.config.strategy.primaryTimeframe,
      confirmationTimeframes: this.config.strategy.confirmationTimeframes,
      lastUpdate: new Date(),
      availableIndicators
    };
  }
}

/**
 * Factory function to create MTF analyzer
 */
export function createMTFAnalyzer(config: MTFAnalyzerConfig): MTFAnalyzer {
  return new MTFAnalyzer(config);
}

/**
 * Utility function to validate MTF strategy configuration
 */
export function validateMTFStrategy(strategy: MTFStrategy): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate primary timeframe
  if (!strategy.primaryTimeframe) {
    errors.push('Primary timeframe is required');
  }

  // Validate confirmation timeframes
  if (!strategy.confirmationTimeframes || strategy.confirmationTimeframes.length === 0) {
    errors.push('At least one confirmation timeframe is required');
  }

  // Validate primary conditions
  if (!strategy.rules.entry.primary || strategy.rules.entry.primary.length === 0) {
    errors.push('At least one primary condition is required');
  }

  // Validate confirmation rules
  if (!strategy.rules.entry.confirmation || strategy.rules.entry.confirmation.length === 0) {
    errors.push('At least one confirmation rule is required');
  }

  // Check if confirmation timeframes match rules
  const ruleTimeframes = strategy.rules.entry.confirmation.map(c => c.timeframe);
  const missingTimeframes = strategy.confirmationTimeframes.filter(tf => !ruleTimeframes.includes(tf));
  
  if (missingTimeframes.length > 0) {
    errors.push(`Missing confirmation rules for timeframes: ${missingTimeframes.join(', ')}`);
  }

  // Check if at least one confirmation is required
  const requiredConfirmations = strategy.rules.entry.confirmation.filter(c => c.required);
  if (requiredConfirmations.length === 0) {
    errors.push('At least one confirmation must be marked as required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}