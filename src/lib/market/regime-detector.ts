/**
 * Market Regime Detection System
 * 
 * This module provides comprehensive market regime detection using multiple
 * technical analysis methods including trend analysis, volatility measurement,
 * and range detection.
 */

import {
  MarketRegime,
  RegimeDetectionResult,
  RegimeTransition,
  RegimeHistory,
  RegimeDetectionConfig
} from '../../types';

export interface MarketDataPoint {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  // Trend indicators
  sma: number[];
  ema: number[];
  adx: number;
  
  // Volatility indicators
  atr: number;
  atrHistory: number[];
  bollingerBands: {
    upper: number[];
    middle: number[];
    lower: number[];
  };
  
  // Momentum indicators
  rsi: number[];
  macd: {
    macd: number[];
    signal: number[];
    histogram: number[];
  };
  
  // Volume indicators
  volumeMA: number[];
  volumeRatio: number[];
  
  // Price action
  priceChanges: number[];
  priceVolatility: number;
}

/**
 * Market Regime Detector Class
 */
export class MarketRegimeDetector {
  private cache: Map<string, { result: RegimeDetectionResult; timestamp: Date }>;
  private historyCache: Map<string, RegimeHistory>;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly DEFAULT_CONFIG: RegimeDetectionConfig = {
    trendPeriod: 20,
    trendThreshold: 0.5,
    volatilityPeriod: 14,
    volatilityThreshold: 1.5,
    rangePeriod: 50,
    rangeThreshold: 0.3,
    enableMTFAnalysis: true,
    primaryTimeframe: 'H1',
    confirmationTimeframes: ['M15', 'H4'],
    minConfidence: 60,
    weightTrend: 0.4,
    weightVolatility: 0.3,
    weightRange: 0.3,
    lookbackPeriod: 30,
    minDataPoints: 100,
    updateFrequency: 15,
    enableTransitionDetection: true
  };

  constructor(private config: Partial<RegimeDetectionConfig> = {}) {
    this.cache = new Map();
    this.historyCache = new Map();
    this.config = { ...this.DEFAULT_CONFIG, ...config };
  }

  /**
   * Detect current market regime for a symbol and timeframe
   */
  async detectRegime(
    symbol: string,
    timeframe: string,
    customConfig?: Partial<RegimeDetectionConfig>
  ): Promise<RegimeDetectionResult> {
    const config = { ...this.config, ...customConfig };
    const cacheKey = `${symbol}-${timeframe}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp.getTime() < this.CACHE_TTL) {
      return cached.result;
    }

    try {
      // Get market data
      const marketData = await this.getMarketData(symbol, timeframe, config.lookbackPeriod!);
      
      if (marketData.length < config.minDataPoints!) {
        throw new Error(`Insufficient data points: ${marketData.length} < ${config.minDataPoints}`);
      }

      // Calculate technical indicators
      const indicators = this.calculateIndicators(marketData, config);
      
      // Detect regime using multiple methods
      const regime = this.detectRegimeFromIndicators(indicators, config);
      
      // Calculate confidence
      const confidence = this.calculateConfidence(indicators, regime, config);
      
      // Create result
      const result: RegimeDetectionResult = {
        regime,
        confidence,
        timestamp: new Date(),
        timeframe,
        metadata: {
          trendStrength: this.calculateTrendStrength(indicators),
          volatility: indicators.atr,
          rangeBound: this.calculateRangeBoundness(indicators),
          adx: indicators.adx,
          atr: indicators.atr,
          priceChange: this.calculateRecentPriceChange(marketData),
          volumeChange: this.calculateVolumeChange(indicators)
        }
      };

      // Cache the result
      this.cache.set(cacheKey, {
        result,
        timestamp: new Date()
      });

      // Update history
      this.updateHistory(symbol, timeframe, result);

      return result;
    } catch (error) {
      console.error(`Failed to detect regime for ${symbol} ${timeframe}:`, error);
      throw new Error(`Regime detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Multi-timeframe regime analysis
   */
  async detectRegimeMTF(
    symbol: string,
    timeframes: string[] = ['M15', 'H1', 'H4', 'D1']
  ): Promise<{
    primary: RegimeDetectionResult;
    confirmations: Array<{
      timeframe: string;
      result: RegimeDetectionResult;
      weight: number;
    }>;
    consensus: MarketRegime;
    confidence: number;
  }> {
    const config = this.config as RegimeDetectionConfig;
    
    if (!config.enableMTFAnalysis) {
      throw new Error('Multi-timeframe analysis is disabled');
    }

    const results = [];
    let totalWeight = 0;

    for (const timeframe of timeframes) {
      try {
        const result = await this.detectRegime(symbol, timeframe);
        const weight = this.getTimeframeWeight(timeframe, config);
        
        results.push({
          timeframe,
          result,
          weight
        });
        
        totalWeight += weight;
      } catch (error) {
        console.warn(`Failed to detect regime for ${symbol} ${timeframe}:`, error);
      }
    }

    if (results.length === 0) {
      throw new Error('No successful regime detections across timeframes');
    }

    // Calculate weighted consensus
    const regimeScores = new Map<MarketRegime, number>();
    
    for (const { result, weight } of results) {
      const currentScore = regimeScores.get(result.regime) || 0;
      regimeScores.set(result.regime, currentScore + (weight * result.confidence / 100));
    }

    // Find consensus regime
    let consensus: MarketRegime = MarketRegime.RANGING;
    let maxScore = 0;
    
    regimeScores.forEach((score, regime) => {
      if (score > maxScore) {
        maxScore = score;
        consensus = regime;
      }
    });

    const confidence = Math.min(100, (maxScore / totalWeight) * 100);

    return {
      primary: results.find(r => r.timeframe === config.primaryTimeframe)?.result || results[0].result,
      confirmations: results,
      consensus,
      confidence
    };
  }

  /**
   * Detect regime transitions
   */
  async detectTransition(
    symbol: string,
    timeframe: string
  ): Promise<RegimeTransition | null> {
    const history = await this.getRegimeHistory(symbol, timeframe, 7); // Last 7 days
    
    if (history.data.length < 2) {
      return null;
    }

    const current = history.data[history.data.length - 1];
    const previous = history.data[history.data.length - 2];

    if (current.regime !== previous.regime) {
      // Find transition duration
      let duration = 0;
      for (let i = history.data.length - 2; i >= 0; i--) {
        if (history.data[i].regime === previous.regime) {
          duration++;
        } else {
          break;
        }
      }

      return {
        fromRegime: previous.regime,
        toRegime: current.regime,
        timestamp: current.timestamp,
        confidence: Math.min(current.confidence, previous.confidence),
        duration: duration * 24 // Convert days to hours (approximate)
      };
    }

    return null;
  }

  /**
   * Get regime history
   */
  async getRegimeHistory(
    symbol: string,
    timeframe: string,
    days: number = 30
  ): Promise<RegimeHistory> {
    const cacheKey = `${symbol}-${timeframe}-history`;
    let history = this.historyCache.get(cacheKey);

    if (!history) {
      history = {
        symbol,
        timeframe,
        data: [],
        transitions: [],
        statistics: {
          regimeDistribution: {
            [MarketRegime.TRENDING_UP]: 0,
            [MarketRegime.TRENDING_DOWN]: 0,
            [MarketRegime.RANGING]: 0,
            [MarketRegime.VOLATILE]: 0
          },
          averageRegimeDuration: {
            [MarketRegime.TRENDING_UP]: 0,
            [MarketRegime.TRENDING_DOWN]: 0,
            [MarketRegime.RANGING]: 0,
            [MarketRegime.VOLATILE]: 0
          },
          transitionFrequency: {
            [MarketRegime.TRENDING_UP]: {
              [MarketRegime.TRENDING_UP]: 0,
              [MarketRegime.TRENDING_DOWN]: 0,
              [MarketRegime.RANGING]: 0,
              [MarketRegime.VOLATILE]: 0
            },
            [MarketRegime.TRENDING_DOWN]: {
              [MarketRegime.TRENDING_UP]: 0,
              [MarketRegime.TRENDING_DOWN]: 0,
              [MarketRegime.RANGING]: 0,
              [MarketRegime.VOLATILE]: 0
            },
            [MarketRegime.RANGING]: {
              [MarketRegime.TRENDING_UP]: 0,
              [MarketRegime.TRENDING_DOWN]: 0,
              [MarketRegime.RANGING]: 0,
              [MarketRegime.VOLATILE]: 0
            },
            [MarketRegime.VOLATILE]: {
              [MarketRegime.TRENDING_UP]: 0,
              [MarketRegime.TRENDING_DOWN]: 0,
              [MarketRegime.RANGING]: 0,
              [MarketRegime.VOLATILE]: 0
            }
          }
        }
      };
      this.historyCache.set(cacheKey, history);
    }

    // Filter data for requested period
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const filteredData = history.data.filter(d => d.timestamp >= cutoffDate);

    return {
      ...history,
      data: filteredData
    };
  }

  /**
   * Get market data (mock implementation - in production, use real data source)
   */
  private async getMarketData(
    symbol: string,
    timeframe: string,
    days: number
  ): Promise<MarketDataPoint[]> {
    // In production, this would fetch from Yahoo Finance, broker API, etc.
    const basePrice = symbol.includes('JPY') ? 150 : 1.1;
    const volatility = symbol.includes('JPY') ? 0.5 : 0.01;
    const dataPoints = days * 24 * 60; // Assuming hourly data
    
    const data: MarketDataPoint[] = [];
    let currentPrice = basePrice;
    
    for (let i = 0; i < dataPoints; i++) {
      const change = (Math.random() - 0.5) * volatility;
      currentPrice = Math.max(0.0001, currentPrice + change);
      
      data.push({
        timestamp: new Date(Date.now() - (dataPoints - i) * 60 * 60 * 1000),
        open: currentPrice,
        high: currentPrice * (1 + Math.random() * volatility * 0.5),
        low: currentPrice * (1 - Math.random() * volatility * 0.5),
        close: currentPrice,
        volume: Math.floor(Math.random() * 10000) + 1000
      });
    }
    
    return data;
  }

  /**
   * Calculate technical indicators
   */
  private calculateIndicators(
    data: MarketDataPoint[],
    config: Partial<RegimeDetectionConfig>
  ): TechnicalIndicators {
    const prices = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const volumes = data.map(d => d.volume);

    return {
      // Trend indicators
      sma: this.calculateSMA(prices, config.trendPeriod!),
      ema: this.calculateEMA(prices, config.trendPeriod!),
      adx: this.calculateADX(highs, lows, prices, 14),
      
      // Volatility indicators
      atr: this.calculateATR(highs, lows, prices, config.volatilityPeriod!),
      atrHistory: this.calculateATRHistory(highs, lows, prices, config.volatilityPeriod!),
      bollingerBands: this.calculateBollingerBands(prices, 20, 2),
      
      // Momentum indicators
      rsi: this.calculateRSI(prices, 14),
      macd: this.calculateMACD(prices, 12, 26, 9),
      
      // Volume indicators
      volumeMA: this.calculateSMA(volumes, 20),
      volumeRatio: this.calculateVolumeRatio(volumes, this.calculateSMA(volumes, 20)),
      
      // Price action
      priceChanges: this.calculatePriceChanges(prices),
      priceVolatility: this.calculatePriceVolatility(prices)
    };
  }

  /**
   * Detect regime from technical indicators
   */
  private detectRegimeFromIndicators(
    indicators: TechnicalIndicators,
    config: Partial<RegimeDetectionConfig>
  ): MarketRegime {
    const trendScore = this.calculateTrendScore(indicators, config);
    const volatilityScore = this.calculateVolatilityScore(indicators, config);
    const rangeScore = this.calculateRangeScore(indicators, config);

    // Weighted decision
    const trendWeight = config.weightTrend || 0.4;
    const volatilityWeight = config.weightVolatility || 0.3;
    const rangeWeight = config.weightRange || 0.3;

    const weightedTrend = trendScore * trendWeight;
    const weightedVolatility = volatilityScore * volatilityWeight;
    const weightedRange = rangeScore * rangeWeight;

    // Decision logic
    if (weightedVolatility > 0.7) {
      return MarketRegime.VOLATILE;
    }

    if (weightedRange > 0.6) {
      return MarketRegime.RANGING;
    }

    if (weightedTrend > 0.5) {
      const lastSMA = indicators.sma[indicators.sma.length - 1];
      const lastEMA = indicators.ema[indicators.ema.length - 1];
      const lastPrice = indicators.sma.length > 0 ? 
        (indicators.sma[indicators.sma.length - 1] + lastEMA) / 2 : 0;

      if (lastPrice > lastSMA && lastPrice > lastEMA) {
        return MarketRegime.TRENDING_UP;
      } else {
        return MarketRegime.TRENDING_DOWN;
      }
    }

    return MarketRegime.RANGING;
  }

  /**
   * Calculate confidence in regime detection
   */
  private calculateConfidence(
    indicators: TechnicalIndicators,
    regime: MarketRegime,
    config: Partial<RegimeDetectionConfig>
  ): number {
    let confidence = 50; // Base confidence

    switch (regime) {
      case MarketRegime.TRENDING_UP:
      case MarketRegime.TRENDING_DOWN:
        confidence += indicators.adx > 25 ? 20 : 0;
        confidence += Math.abs(indicators.rsi[indicators.rsi.length - 1] - 50) > 10 ? 15 : 0;
        break;

      case MarketRegime.RANGING:
        confidence += indicators.adx < 20 ? 20 : 0;
        confidence += indicators.priceVolatility < 0.02 ? 15 : 0;
        break;

      case MarketRegime.VOLATILE:
        confidence += indicators.atr > indicators.atrHistory[indicators.atrHistory.length - 1] * 1.5 ? 25 : 0;
        confidence += indicators.priceVolatility > 0.03 ? 15 : 0;
        break;
    }

    return Math.min(100, Math.max(config.minConfidence || 60, confidence));
  }

  /**
   * Calculate trend score (0-1)
   */
  private calculateTrendScore(
    indicators: TechnicalIndicators,
    config: Partial<RegimeDetectionConfig>
  ): number {
    const threshold = config.trendThreshold || 0.5;
    
    // ADX trend strength
    const adxScore = Math.min(1, indicators.adx / 50);
    
    // SMA alignment
    const smaAlignment = this.calculateSMAAlignment(indicators.sma);
    
    // EMA alignment
    const emaAlignment = this.calculateEMAAlignment(indicators.ema);
    
    return (adxScore + smaAlignment + emaAlignment) / 3;
  }

  /**
   * Calculate volatility score (0-1)
   */
  private calculateVolatilityScore(
    indicators: TechnicalIndicators,
    config: Partial<RegimeDetectionConfig>
  ): number {
    const threshold = config.volatilityThreshold || 1.5;
    
    // Current ATR vs historical average
    const avgATR = indicators.atrHistory.reduce((a, b) => a + b, 0) / indicators.atrHistory.length;
    const atrRatio = indicators.atr / avgATR;
    
    // Price volatility
    const priceVolScore = Math.min(1, indicators.priceVolatility / 0.05);
    
    // Bollinger Band width
    const bbWidth = this.calculateBBWidth(indicators.bollingerBands);
    
    return (Math.min(1, atrRatio / threshold) + priceVolScore + bbWidth) / 3;
  }

  /**
   * Calculate range score (0-1)
   */
  private calculateRangeScore(
    indicators: TechnicalIndicators,
    config: Partial<RegimeDetectionConfig>
  ): number {
    const threshold = config.rangeThreshold || 0.3;
    
    // Low ADX indicates ranging
    const adxRangeScore = Math.max(0, 1 - indicators.adx / 50);
    
    // Price bouncing between support/resistance
    const rangeBoundness = this.calculateRangeBoundness(indicators);
    
    // Low volatility
    const volatilityRangeScore = Math.max(0, 1 - indicators.priceVolatility / 0.03);
    
    return (adxRangeScore + rangeBoundness + volatilityRangeScore) / 3;
  }

  // Technical indicator calculation methods
  private calculateSMA(prices: number[], period: number): number[] {
    const sma: number[] = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    return sma;
  }

  private calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    // Start with SMA
    ema[0] = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    for (let i = period; i < prices.length; i++) {
      ema.push((prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1]);
    }
    
    return ema;
  }

  private calculateADX(highs: number[], lows: number[], closes: number[], period: number): number {
    // Simplified ADX calculation
    const tr = this.calculateTrueRange(highs, lows, closes);
    const dmPlus = this.calculateDirectionalMovement(highs, lows, closes, true);
    const dmMinus = this.calculateDirectionalMovement(highs, lows, closes, false);
    
    const atr = this.calculateSMA(tr, period);
    const diPlus = this.calculateSMA(dmPlus, period).map((dm, i) => (dm / atr[i]) * 100);
    const diMinus = this.calculateSMA(dmMinus, period).map((dm, i) => (dm / atr[i]) * 100);
    
    const dx = diPlus.map((plus, i) => Math.abs(plus - diMinus[i]) / (plus + diMinus[i]) * 100);
    
    return this.calculateSMA(dx, period)[dx.length - 1] || 0;
  }

  private calculateATR(highs: number[], lows: number[], closes: number[], period: number): number {
    const tr = this.calculateTrueRange(highs, lows, closes);
    const atr = this.calculateSMA(tr, period);
    return atr[atr.length - 1] || 0;
  }

  private calculateATRHistory(highs: number[], lows: number[], closes: number[], period: number): number[] {
    const tr = this.calculateTrueRange(highs, lows, closes);
    return this.calculateSMA(tr, period);
  }

  private calculateBollingerBands(prices: number[], period: number, stdDev: number): {
    upper: number[];
    middle: number[];
    lower: number[];
  } {
    const middle = this.calculateSMA(prices, period);
    const upper: number[] = [];
    const lower: number[] = [];

    for (let i = 0; i < middle.length; i++) {
      const slice = prices.slice(i, i + period);
      const mean = middle[i];
      const variance = slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
      const standardDeviation = Math.sqrt(variance);
      
      upper.push(mean + (standardDeviation * stdDev));
      lower.push(mean - (standardDeviation * stdDev));
    }

    return { upper, middle, lower };
  }

  private calculateRSI(prices: number[], period: number): number[] {
    const rsi: number[] = [];
    const changes = this.calculatePriceChanges(prices);
    
    for (let i = period; i < changes.length; i++) {
      const gains = changes.slice(i - period, i).filter(c => c > 0);
      const losses = changes.slice(i - period, i).filter(c => c < 0).map(c => Math.abs(c));
      
      const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
      const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
      
      if (avgLoss === 0) {
        rsi.push(100);
      } else {
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }
    }
    
    return rsi;
  }

  private calculateMACD(prices: number[], fast: number, slow: number, signal: number): {
    macd: number[];
    signal: number[];
    histogram: number[];
  } {
    const emaFast = this.calculateEMA(prices, fast);
    const emaSlow = this.calculateEMA(prices, slow);
    
    const macd = emaFast.map((fast, i) => fast - emaSlow[i + (slow - fast)]);
    const signalLine = this.calculateEMA(macd, signal);
    const histogram = macd.map((macd, i) => macd - signalLine[i]);
    
    return { macd, signal: signalLine, histogram };
  }

  private calculateTrueRange(highs: number[], lows: number[], closes: number[]): number[] {
    const tr: number[] = [];
    
    for (let i = 1; i < highs.length; i++) {
      const high = highs[i];
      const low = lows[i];
      const prevClose = closes[i - 1];
      
      tr.push(Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      ));
    }
    
    return tr;
  }

  private calculateDirectionalMovement(
    highs: number[],
    lows: number[],
    closes: number[],
    isPlus: boolean
  ): number[] {
    const dm: number[] = [];
    
    for (let i = 1; i < highs.length; i++) {
      const upMove = highs[i] - highs[i - 1];
      const downMove = lows[i - 1] - lows[i];
      
      if (isPlus) {
        dm.push(upMove > downMove && upMove > 0 ? upMove : 0);
      } else {
        dm.push(downMove > upMove && downMove > 0 ? downMove : 0);
      }
    }
    
    return dm;
  }

  private calculatePriceChanges(prices: number[]): number[] {
    const changes: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }
    return changes;
  }

  private calculatePriceVolatility(prices: number[]): number {
    const changes = this.calculatePriceChanges(prices);
    const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
    const variance = changes.reduce((sum, change) => sum + Math.pow(change - mean, 2), 0) / changes.length;
    return Math.sqrt(variance);
  }

  private calculateVolumeRatio(volumes: number[], volumeMA: number[]): number[] {
    return volumes.map((vol, i) => i < volumeMA.length ? vol / volumeMA[i] : 1);
  }

  private calculateSMAAlignment(sma: number[]): number {
    if (sma.length < 3) return 0;
    
    const recent = sma.slice(-3);
    const isAscending = recent[0] < recent[1] && recent[1] < recent[2];
    const isDescending = recent[0] > recent[1] && recent[1] > recent[2];
    
    return isAscending || isDescending ? 1 : 0;
  }

  private calculateEMAAlignment(ema: number[]): number {
    if (ema.length < 3) return 0;
    
    const recent = ema.slice(-3);
    const isAscending = recent[0] < recent[1] && recent[1] < recent[2];
    const isDescending = recent[0] > recent[1] && recent[1] > recent[2];
    
    return isAscending || isDescending ? 1 : 0;
  }

  private calculateBBWidth(bands: { upper: number[]; middle: number[]; lower: number[] }): number {
    if (bands.upper.length === 0) return 0;
    
    const lastIndex = bands.upper.length - 1;
    const width = (bands.upper[lastIndex] - bands.lower[lastIndex]) / bands.middle[lastIndex];
    return Math.min(1, width / 0.1); // Normalize to 0-1
  }

  private calculateRangeBoundness(indicators: TechnicalIndicators): number {
    const lastRSI = indicators.rsi[indicators.rsi.length - 1];
    const lastBB = {
      upper: indicators.bollingerBands.upper[indicators.bollingerBands.upper.length - 1],
      middle: indicators.bollingerBands.middle[indicators.bollingerBands.middle.length - 1],
      lower: indicators.bollingerBands.lower[indicators.bollingerBands.lower.length - 1]
    };

    // RSI in middle range (40-60)
    const rsiMiddle = lastRSI >= 40 && lastRSI <= 60 ? 1 : 0;
    
    // Price near middle Bollinger Band
    const priceNearMiddle = Math.abs(lastBB.middle - (lastBB.upper + lastBB.lower) / 2) / 
                           ((lastBB.upper - lastBB.lower) / 2) < 0.2 ? 1 : 0;

    return (rsiMiddle + priceNearMiddle) / 2;
  }

  private calculateTrendStrength(indicators: TechnicalIndicators): number {
    return Math.min(100, indicators.adx * 2); // Convert ADX (0-50) to 0-100 scale
  }

  private calculateRecentPriceChange(data: MarketDataPoint[]): number {
    if (data.length < 2) return 0;
    
    const current = data[data.length - 1].close;
    const previous = data[Math.max(0, data.length - 24)].close; // 24 periods ago
    return ((current - previous) / previous) * 100;
  }

  private calculateVolumeChange(indicators: TechnicalIndicators): number {
    const recentVolume = indicators.volumeRatio.slice(-5);
    const avgRecentVolume = recentVolume.reduce((a, b) => a + b, 0) / recentVolume.length;
    return (avgRecentVolume - 1) * 100; // Percentage change from average
  }

  private getTimeframeWeight(timeframe: string, config: RegimeDetectionConfig): number {
    const weights: Record<string, number> = {
      'M5': 0.5,
      'M15': 0.7,
      'M30': 0.8,
      'H1': 1.0,
      'H4': 1.2,
      'D1': 1.5
    };
    
    return weights[timeframe] || 1.0;
  }

  private updateHistory(symbol: string, timeframe: string, result: RegimeDetectionResult): void {
    const cacheKey = `${symbol}-${timeframe}-history`;
    let history = this.historyCache.get(cacheKey);

    if (!history) {
      history = {
        symbol,
        timeframe,
        data: [],
        transitions: [],
        statistics: {
          regimeDistribution: {
            [MarketRegime.TRENDING_UP]: 0,
            [MarketRegime.TRENDING_DOWN]: 0,
            [MarketRegime.RANGING]: 0,
            [MarketRegime.VOLATILE]: 0
          },
          averageRegimeDuration: {
            [MarketRegime.TRENDING_UP]: 0,
            [MarketRegime.TRENDING_DOWN]: 0,
            [MarketRegime.RANGING]: 0,
            [MarketRegime.VOLATILE]: 0
          },
          transitionFrequency: {
            [MarketRegime.TRENDING_UP]: {
              [MarketRegime.TRENDING_UP]: 0,
              [MarketRegime.TRENDING_DOWN]: 0,
              [MarketRegime.RANGING]: 0,
              [MarketRegime.VOLATILE]: 0
            },
            [MarketRegime.TRENDING_DOWN]: {
              [MarketRegime.TRENDING_UP]: 0,
              [MarketRegime.TRENDING_DOWN]: 0,
              [MarketRegime.RANGING]: 0,
              [MarketRegime.VOLATILE]: 0
            },
            [MarketRegime.RANGING]: {
              [MarketRegime.TRENDING_UP]: 0,
              [MarketRegime.TRENDING_DOWN]: 0,
              [MarketRegime.RANGING]: 0,
              [MarketRegime.VOLATILE]: 0
            },
            [MarketRegime.VOLATILE]: {
              [MarketRegime.TRENDING_UP]: 0,
              [MarketRegime.TRENDING_DOWN]: 0,
              [MarketRegime.RANGING]: 0,
              [MarketRegime.VOLATILE]: 0
            }
          }
        }
      };
    }

    // Add new data point
    history.data.push({
      timestamp: result.timestamp,
      regime: result.regime,
      confidence: result.confidence,
      metadata: result.metadata
    });

    // Keep only last 30 days
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    history.data = history.data.filter(d => d.timestamp >= cutoffDate);

    // Update statistics
    this.updateHistoryStatistics(history);

    this.historyCache.set(cacheKey, history);
  }

  private updateHistoryStatistics(history: RegimeHistory): void {
    // Reset statistics
    Object.keys(history.statistics.regimeDistribution).forEach(regime => {
      history.statistics.regimeDistribution[regime as MarketRegime] = 0;
    });

    // Count regime occurrences
    history.data.forEach(point => {
      history.statistics.regimeDistribution[point.regime]++;
    });

    // Calculate transitions
    history.transitions = [];
    for (let i = 1; i < history.data.length; i++) {
      if (history.data[i].regime !== history.data[i - 1].regime) {
        history.transitions.push({
          fromRegime: history.data[i - 1].regime,
          toRegime: history.data[i].regime,
          timestamp: history.data[i].timestamp,
          confidence: Math.min(history.data[i].confidence, history.data[i - 1].confidence),
          duration: 24 // Simplified duration
        });
      }
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.historyCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    regimeCache: { size: number; keys: string[] };
    historyCache: { size: number; keys: string[] };
  } {
    return {
      regimeCache: {
        size: this.cache.size,
        keys: Array.from(this.cache.keys())
      },
      historyCache: {
        size: this.historyCache.size,
        keys: Array.from(this.historyCache.keys())
      }
    };
  }
}

// Singleton instance
export const marketRegimeDetector = new MarketRegimeDetector();

/**
 * Convenience functions
 */
export async function detectMarketRegime(
  symbol: string,
  timeframe: string,
  config?: Partial<RegimeDetectionConfig>
): Promise<RegimeDetectionResult> {
  return marketRegimeDetector.detectRegime(symbol, timeframe, config);
}

export async function detectMarketRegimeMTF(
  symbol: string,
  timeframes?: string[]
): Promise<{
  primary: RegimeDetectionResult;
  confirmations: Array<{
    timeframe: string;
    result: RegimeDetectionResult;
    weight: number;
  }>;
  consensus: MarketRegime;
  confidence: number;
}> {
  return marketRegimeDetector.detectRegimeMTF(symbol, timeframes);
}

export async function getRegimeHistory(
  symbol: string,
  timeframe: string,
  days?: number
): Promise<RegimeHistory> {
  return marketRegimeDetector.getRegimeHistory(symbol, timeframe, days);
}

export async function detectRegimeTransition(
  symbol: string,
  timeframe: string
): Promise<RegimeTransition | null> {
  return marketRegimeDetector.detectTransition(symbol, timeframe);
}