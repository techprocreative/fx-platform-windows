/**
 * Market Regime Adapter for Trading Strategy Adjustment
 * 
 * This module provides adaptive strategy parameter adjustments based on
 * detected market regimes to optimize trading performance across different
 * market conditions.
 */

import {
  MarketRegime,
  RegimeAdapter,
  RegimeDetectionResult,
  RegimeHistory,
  RegimeTransition,
  RegimeBasedRiskParams,
  RegimeAdjustedStrategy,
  Strategy
} from '../../types';
import { marketRegimeDetector } from '../market/regime-detector';
import { logger } from '../monitoring/logger';

export interface RegimeAdapterConfig {
  // Base adjustment factors
  baseAdjustments: {
    entryThreshold: number;
    positionSize: number;
    takeProfitMultiplier: number;
    stopLossMultiplier: number;
    trailingDistance: number;
    maxTradesPerDay: number;
    sessionFilterMultiplier: number;
  };

  // Regime-specific adjustments
  regimeAdjustments: Record<MarketRegime, {
    entryThreshold: number; // Stricter in ranging markets
    positionSize: number; // Smaller in volatile markets
    takeProfitMultiplier: number; // Larger in trending markets
    stopLossMultiplier?: number; // Adjusted per regime
    trailingDistance?: number; // Dynamic trailing per regime
    maxTradesPerDay?: number; // Reduced in volatile markets
    sessionFilterMultiplier?: number; // Adjust per regime
    confidenceThreshold: number; // Minimum confidence to apply adjustments
  }>;

  // Transition handling
  transitionAdjustments: {
    reducePositionSizeDuringTransition: boolean;
    transitionMultiplier: number;
    waitPeriod: number; // Minutes to wait after transition
    increaseConfirmationRequirements: boolean;
  };

  // Risk management
  riskAdjustments: RegimeBasedRiskParams;

  // Performance tracking
  enablePerformanceTracking: boolean;
  trackRegimePerformance: boolean;
  optimizeParameters: boolean;
  optimizationPeriod: number; // Days
}

export interface RegimePerformanceMetrics {
  regime: MarketRegime;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  totalProfit: number;
  maxDrawdown: number;
  sharpeRatio: number;
  averageTradeDuration: number;
  adjustedParameters: ReturnType<RegimeAdapter['adjustStrategy']>;
  performanceScore: number;
  lastUpdated: Date;
}

export interface RegimeAdjustmentResult {
  originalStrategy: Strategy;
  adjustedStrategy: Strategy;
  currentRegime: MarketRegime;
  adjustments: ReturnType<RegimeAdapter['adjustStrategy']>;
  confidence: number;
  appliedAdjustments: string[];
  warnings: string[];
  recommendations: string[];
  timestamp: Date;
  performanceMetrics?: RegimePerformanceMetrics;
}

/**
 * Market Regime Adapter Class
 */
export class MarketRegimeAdapter implements RegimeAdapter {
  private config: RegimeAdapterConfig;
  private performanceCache: Map<string, RegimePerformanceMetrics> = new Map();
  private lastAdjustmentCache: Map<string, { result: RegimeAdjustmentResult; timestamp: Date }> = new Map();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  constructor(config: Partial<RegimeAdapterConfig> = {}) {
    this.config = this.mergeWithDefaults(config);
    logger.info('MarketRegimeAdapter initialized', { config: this.config });
  }

  /**
   * Detect current market regime for a symbol and timeframe
   */
  async detectRegime(symbol: string, timeframe: string): Promise<MarketRegime> {
    try {
      const result = await marketRegimeDetector.detectRegime(symbol, timeframe);
      return result.regime;
    } catch (error) {
      logger.error('Failed to detect regime', error as Error, { symbol, timeframe });
      return MarketRegime.RANGING; // Default to ranging on error
    }
  }

  /**
   * Adjust strategy parameters based on market regime
   */
  adjustStrategy(regime: MarketRegime): {
    entryThreshold: number;
    positionSize: number;
    takeProfitMultiplier: number;
    stopLossMultiplier?: number;
    trailingDistance?: number;
    maxTradesPerDay?: number;
    sessionFilterMultiplier?: number;
  } {
    const baseAdjustments = this.config.baseAdjustments;
    const regimeAdjustments = this.config.regimeAdjustments[regime];

    return {
      entryThreshold: baseAdjustments.entryThreshold * regimeAdjustments.entryThreshold,
      positionSize: baseAdjustments.positionSize * regimeAdjustments.positionSize,
      takeProfitMultiplier: baseAdjustments.takeProfitMultiplier * regimeAdjustments.takeProfitMultiplier,
      stopLossMultiplier: regimeAdjustments.stopLossMultiplier
        ? baseAdjustments.stopLossMultiplier * regimeAdjustments.stopLossMultiplier
        : baseAdjustments.stopLossMultiplier,
      trailingDistance: regimeAdjustments.trailingDistance
        ? baseAdjustments.trailingDistance * regimeAdjustments.trailingDistance
        : baseAdjustments.trailingDistance,
      maxTradesPerDay: regimeAdjustments.maxTradesPerDay
        ? Math.floor(baseAdjustments.maxTradesPerDay * regimeAdjustments.maxTradesPerDay)
        : baseAdjustments.maxTradesPerDay,
      sessionFilterMultiplier: regimeAdjustments.sessionFilterMultiplier
        ? baseAdjustments.sessionFilterMultiplier * regimeAdjustments.sessionFilterMultiplier
        : baseAdjustments.sessionFilterMultiplier
    };
  }

  /**
   * Get regime confidence for a symbol and timeframe
   */
  async getRegimeConfidence(symbol: string, timeframe: string): Promise<number> {
    try {
      const result = await marketRegimeDetector.detectRegime(symbol, timeframe);
      return result.confidence;
    } catch (error) {
      logger.error('Failed to get regime confidence', error as Error, { symbol, timeframe });
      return 50; // Default confidence on error
    }
  }

  /**
   * Get regime history for a symbol and timeframe
   */
  async getRegimeHistory(symbol: string, timeframe: string, days?: number): Promise<RegimeHistory> {
    try {
      return await marketRegimeDetector.getRegimeHistory(symbol, timeframe, days);
    } catch (error) {
      logger.error('Failed to get regime history', error as Error, { symbol, timeframe, days });
      throw error;
    }
  }

  /**
   * Detect regime transition
   */
  async detectTransition(symbol: string, timeframe: string): Promise<RegimeTransition | null> {
    try {
      return await marketRegimeDetector.detectTransition(symbol, timeframe);
    } catch (error) {
      logger.error('Failed to detect regime transition', error as Error, { symbol, timeframe });
      return null;
    }
  }

  /**
   * Adjust a complete strategy based on current market regime
   */
  async adjustStrategyForRegime(
    strategy: Strategy,
    symbol: string,
    timeframe: string,
    customConfig?: Partial<RegimeAdapterConfig>
  ): Promise<RegimeAdjustmentResult> {
    const cacheKey = `${strategy.id}-${symbol}-${timeframe}`;
    
    // Check cache first
    const cached = this.lastAdjustmentCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp.getTime() < this.CACHE_TTL) {
      return cached.result;
    }

    try {
      // Detect current regime
      const regimeResult = await marketRegimeDetector.detectRegime(symbol, timeframe);
      const currentRegime = regimeResult.regime;
      const confidence = regimeResult.confidence;

      // Check for recent transition
      const transition = await this.detectTransition(symbol, timeframe);
      const isInTransition = transition !== null && 
        Date.now() - transition.timestamp.getTime() < this.config.transitionAdjustments.waitPeriod * 60 * 1000;

      // Get regime adjustments
      const adjustments = this.adjustStrategy(currentRegime);
      
      // Apply transition adjustments if needed
      const finalAdjustments = isInTransition 
        ? this.applyTransitionAdjustments(adjustments, transition!)
        : adjustments;

      // Create adjusted strategy
      const adjustedStrategy = this.createAdjustedStrategy(strategy, finalAdjustments, currentRegime);

      // Generate applied adjustments list
      const appliedAdjustments = this.getAppliedAdjustments(strategy, adjustedStrategy, finalAdjustments);
      
      // Generate warnings and recommendations
      const warnings = this.generateWarnings(regimeResult, transition, isInTransition);
      const recommendations = this.generateRecommendations(currentRegime, confidence, appliedAdjustments);

      // Get performance metrics if enabled
      const performanceMetrics = this.config.enablePerformanceTracking 
        ? await this.getPerformanceMetrics(strategy.id, currentRegime)
        : undefined;

      const result: RegimeAdjustmentResult = {
        originalStrategy: strategy,
        adjustedStrategy,
        currentRegime,
        adjustments: finalAdjustments,
        confidence,
        appliedAdjustments,
        warnings,
        recommendations,
        timestamp: new Date(),
        performanceMetrics
      };

      // Cache the result
      this.lastAdjustmentCache.set(cacheKey, {
        result,
        timestamp: new Date()
      });

      logger.info('Strategy adjusted for regime', {
        strategyId: strategy.id,
        symbol,
        timeframe,
        regime: currentRegime,
        confidence,
        adjustments: finalAdjustments
      });

      return result;
    } catch (error) {
      logger.error('Failed to adjust strategy for regime', error as Error, {
        strategyId: strategy.id,
        symbol,
        timeframe
      });
      throw error;
    }
  }

  /**
   * Get optimal entry conditions based on regime
   */
  async getOptimalEntryConditions(
    symbol: string,
    timeframe: string,
    baseConditions: any[]
  ): Promise<{
    conditions: any[];
    minimumConfidence: number;
    additionalFilters: string[];
  }> {
    const regime = await this.detectRegime(symbol, timeframe);
    const confidence = await this.getRegimeConfidence(symbol, timeframe);
    
    const regimeConfig = this.config.regimeAdjustments[regime];
    const minimumConfidence = Math.max(regimeConfig.confidenceThreshold, confidence);

    let additionalFilters: string[] = [];
    let adjustedConditions = [...baseConditions];

    switch (regime) {
      case MarketRegime.TRENDING_UP:
        additionalFilters.push('RSI < 70', 'MACD bullish crossover');
        break;
      
      case MarketRegime.TRENDING_DOWN:
        additionalFilters.push('RSI > 30', 'MACD bearish crossover');
        break;
      
      case MarketRegime.RANGING:
        additionalFilters.push('Bollinger Bands bounce', 'RSI between 30-70');
        // Stricter entry conditions in ranging markets
        adjustedConditions = adjustedConditions.map(condition => ({
          ...condition,
          threshold: condition.threshold * regimeConfig.entryThreshold
        }));
        break;
      
      case MarketRegime.VOLATILE:
        additionalFilters.push('Volume confirmation', 'Wide stop loss');
        // More confirmation needed in volatile markets
        adjustedConditions.push({
          type: 'volume_confirmation',
          threshold: 1.5,
          description: 'Volume must be 1.5x average'
        });
        break;
    }

    return {
      conditions: adjustedConditions,
      minimumConfidence,
      additionalFilters
    };
  }

  /**
   * Update performance metrics for a regime
   */
  async updatePerformanceMetrics(
    strategyId: string,
    regime: MarketRegime,
    tradeResult: {
      profit: number;
      duration: number;
      win: boolean;
    }
  ): Promise<void> {
    if (!this.config.trackRegimePerformance) return;

    const cacheKey = `${strategyId}-${regime}`;
    let metrics = this.performanceCache.get(cacheKey);

    if (!metrics) {
      metrics = {
        regime,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        averageWin: 0,
        averageLoss: 0,
        profitFactor: 0,
        totalProfit: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        averageTradeDuration: 0,
        adjustedParameters: this.adjustStrategy(regime),
        performanceScore: 0,
        lastUpdated: new Date()
      };
    }

    // Update metrics
    metrics.totalTrades++;
    if (tradeResult.win) {
      metrics.winningTrades++;
      metrics.averageWin = (metrics.averageWin * (metrics.winningTrades - 1) + tradeResult.profit) / metrics.winningTrades;
    } else {
      metrics.losingTrades++;
      metrics.averageLoss = (metrics.averageLoss * (metrics.losingTrades - 1) + Math.abs(tradeResult.profit)) / metrics.losingTrades;
    }

    metrics.winRate = (metrics.winningTrades / metrics.totalTrades) * 100;
    metrics.totalProfit += tradeResult.profit;
    metrics.averageTradeDuration = (metrics.averageTradeDuration * (metrics.totalTrades - 1) + tradeResult.duration) / metrics.totalTrades;
    
    if (metrics.averageLoss > 0) {
      metrics.profitFactor = (metrics.averageWin * metrics.winningTrades) / (metrics.averageLoss * metrics.losingTrades);
    }

    // Calculate performance score
    metrics.performanceScore = this.calculatePerformanceScore(metrics);
    metrics.lastUpdated = new Date();

    this.performanceCache.set(cacheKey, metrics);

    logger.debug('Performance metrics updated', {
      strategyId,
      regime,
      totalTrades: metrics.totalTrades,
      winRate: metrics.winRate,
      performanceScore: metrics.performanceScore
    });
  }

  /**
   * Get performance metrics for a strategy and regime
   */
  async getPerformanceMetrics(strategyId: string, regime: MarketRegime): Promise<RegimePerformanceMetrics | undefined> {
    const cacheKey = `${strategyId}-${regime}`;
    return this.performanceCache.get(cacheKey);
  }

  /**
   * Optimize regime parameters based on historical performance
   */
  async optimizeRegimeParameters(strategyId: string): Promise<Record<MarketRegime, ReturnType<RegimeAdapter['adjustStrategy']>>> {
    if (!this.config.optimizeParameters) {
      // Convert the regime adjustments to the expected format
      const convertedParams: Record<MarketRegime, ReturnType<RegimeAdapter['adjustStrategy']>> = {} as any;
      for (const regime of Object.values(MarketRegime)) {
        convertedParams[regime] = this.adjustStrategy(regime);
      }
      return convertedParams;
    }

    const optimizedParams: Record<MarketRegime, ReturnType<RegimeAdapter['adjustStrategy']>> = {} as any;

    for (const regime of Object.values(MarketRegime)) {
      const metrics = await this.getPerformanceMetrics(strategyId, regime);
      
      if (metrics && metrics.totalTrades >= 10) {
        // Optimize based on performance
        const baseAdjustments = this.adjustStrategy(regime);
        optimizedParams[regime] = {
          entryThreshold: this.optimizeParameter(
            baseAdjustments.entryThreshold,
            metrics.winRate,
            0.5, // min
            2.0  // max
          ),
          positionSize: this.optimizeParameter(
            baseAdjustments.positionSize,
            metrics.profitFactor,
            0.1, // min
            2.0  // max
          ),
          takeProfitMultiplier: this.optimizeParameter(
            baseAdjustments.takeProfitMultiplier,
            metrics.averageWin / metrics.averageLoss,
            1.0, // min
            5.0  // max
          ),
          stopLossMultiplier: baseAdjustments.stopLossMultiplier,
          trailingDistance: baseAdjustments.trailingDistance,
          maxTradesPerDay: baseAdjustments.maxTradesPerDay,
          sessionFilterMultiplier: baseAdjustments.sessionFilterMultiplier
        };
      } else {
        // Use default adjustments if insufficient data
        optimizedParams[regime] = this.adjustStrategy(regime);
      }
    }

    logger.info('Regime parameters optimized', { strategyId, optimizedParams });
    return optimizedParams;
  }

  /**
   * Get regime adjustment statistics
   */
  getAdjustmentStatistics(): {
    totalAdjustments: number;
    adjustmentsByRegime: Record<MarketRegime, number>;
    averageConfidence: number;
    performanceScores: Record<MarketRegime, number>;
  } {
    const adjustmentsByRegime: Record<MarketRegime, number> = {
      [MarketRegime.TRENDING_UP]: 0,
      [MarketRegime.TRENDING_DOWN]: 0,
      [MarketRegime.RANGING]: 0,
      [MarketRegime.VOLATILE]: 0
    };

    let totalConfidence = 0;
    let adjustmentCount = 0;

    this.lastAdjustmentCache.forEach(({ result }) => {
      adjustmentsByRegime[result.currentRegime]++;
      totalConfidence += result.confidence;
      adjustmentCount++;
    });

    const performanceScores: Record<MarketRegime, number> = {
      [MarketRegime.TRENDING_UP]: 0,
      [MarketRegime.TRENDING_DOWN]: 0,
      [MarketRegime.RANGING]: 0,
      [MarketRegime.VOLATILE]: 0
    };

    this.performanceCache.forEach((metrics, key) => {
      const regime = key.split('-')[1] as MarketRegime;
      performanceScores[regime] = metrics.performanceScore;
    });

    return {
      totalAdjustments: adjustmentCount,
      adjustmentsByRegime,
      averageConfidence: adjustmentCount > 0 ? totalConfidence / adjustmentCount : 0,
      performanceScores
    };
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    this.lastAdjustmentCache.clear();
    this.performanceCache.clear();
    logger.info('Regime adapter caches cleared');
  }

  // Private helper methods

  private mergeWithDefaults(config: Partial<RegimeAdapterConfig>): RegimeAdapterConfig {
    const defaultConfig: RegimeAdapterConfig = {
      baseAdjustments: {
        entryThreshold: 1.0,
        positionSize: 1.0,
        takeProfitMultiplier: 1.0,
        stopLossMultiplier: 1.0,
        trailingDistance: 1.0,
        maxTradesPerDay: 10,
        sessionFilterMultiplier: 1.0
      },
      regimeAdjustments: {
        [MarketRegime.TRENDING_UP]: {
          entryThreshold: 0.8, // Less strict entries in strong uptrends
          positionSize: 1.2,   // Increase position size
          takeProfitMultiplier: 1.5, // Larger take profits
          stopLossMultiplier: 1.2,   // Wider stops
          trailingDistance: 1.0,
          maxTradesPerDay: 12,
          sessionFilterMultiplier: 1.1,
          confidenceThreshold: 65
        },
        [MarketRegime.TRENDING_DOWN]: {
          entryThreshold: 0.8, // Less strict entries in strong downtrends
          positionSize: 1.1,   // Slightly increase position size
          takeProfitMultiplier: 1.4, // Larger take profits
          stopLossMultiplier: 1.2,   // Wider stops
          trailingDistance: 1.0,
          maxTradesPerDay: 12,
          sessionFilterMultiplier: 1.1,
          confidenceThreshold: 65
        },
        [MarketRegime.RANGING]: {
          entryThreshold: 1.5, // Stricter entries in ranging markets
          positionSize: 0.8,   // Reduce position size
          takeProfitMultiplier: 0.8, // Smaller take profits
          stopLossMultiplier: 0.9,   // Tighter stops
          trailingDistance: 0.8,
          maxTradesPerDay: 8,
          sessionFilterMultiplier: 0.9,
          confidenceThreshold: 70
        },
        [MarketRegime.VOLATILE]: {
          entryThreshold: 1.3, // Stricter entries in volatile markets
          positionSize: 0.6,   // Significantly reduce position size
          takeProfitMultiplier: 1.2, // Larger take profits for volatility
          stopLossMultiplier: 1.5,   // Much wider stops
          trailingDistance: 1.2,
          maxTradesPerDay: 5,  // Fewer trades in volatile markets
          sessionFilterMultiplier: 0.7,
          confidenceThreshold: 75
        }
      },
      transitionAdjustments: {
        reducePositionSizeDuringTransition: true,
        transitionMultiplier: 0.7,
        waitPeriod: 30, // 30 minutes
        increaseConfirmationRequirements: true
      },
      riskAdjustments: {
        regimeRiskMultipliers: {
          [MarketRegime.TRENDING_UP]: {
            positionSize: 1.2,
            stopLoss: 1.2,
            takeProfit: 1.5,
            maxDrawdown: 1.1,
            maxDailyLoss: 1.0
          },
          [MarketRegime.TRENDING_DOWN]: {
            positionSize: 1.1,
            stopLoss: 1.2,
            takeProfit: 1.4,
            maxDrawdown: 1.1,
            maxDailyLoss: 1.0
          },
          [MarketRegime.RANGING]: {
            positionSize: 0.8,
            stopLoss: 0.9,
            takeProfit: 0.8,
            maxDrawdown: 0.9,
            maxDailyLoss: 0.8
          },
          [MarketRegime.VOLATILE]: {
            positionSize: 0.6,
            stopLoss: 1.5,
            takeProfit: 1.2,
            maxDrawdown: 0.7,
            maxDailyLoss: 0.6
          }
        },
        reduceInVolatile: true,
        increaseInTrending: true,
        useRegimeTransitions: true,
        maxPositionSizePerRegime: {
          [MarketRegime.TRENDING_UP]: 2.0,
          [MarketRegime.TRENDING_DOWN]: 2.0,
          [MarketRegime.RANGING]: 1.5,
          [MarketRegime.VOLATILE]: 1.0
        },
        maxExposurePerRegime: {
          [MarketRegime.TRENDING_UP]: 20.0,
          [MarketRegime.TRENDING_DOWN]: 20.0,
          [MarketRegime.RANGING]: 15.0,
          [MarketRegime.VOLATILE]: 10.0
        }
      },
      enablePerformanceTracking: true,
      trackRegimePerformance: true,
      optimizeParameters: true,
      optimizationPeriod: 30
    };

    return {
      ...defaultConfig,
      ...config,
      regimeAdjustments: {
        ...defaultConfig.regimeAdjustments,
        ...config.regimeAdjustments
      },
      riskAdjustments: {
        ...defaultConfig.riskAdjustments,
        ...config.riskAdjustments
      }
    };
  }

  private applyTransitionAdjustments(
    adjustments: ReturnType<RegimeAdapter['adjustStrategy']>,
    transition: RegimeTransition
  ): ReturnType<RegimeAdapter['adjustStrategy']> {
    const transitionConfig = this.config.transitionAdjustments;
    
    if (!transitionConfig.reducePositionSizeDuringTransition) {
      return adjustments;
    }

    return {
      ...adjustments,
      positionSize: adjustments.positionSize * transitionConfig.transitionMultiplier,
      maxTradesPerDay: adjustments.maxTradesPerDay
        ? Math.floor(adjustments.maxTradesPerDay * transitionConfig.transitionMultiplier)
        : undefined
    };
  }

  private createAdjustedStrategy(
    originalStrategy: Strategy,
    adjustments: ReturnType<RegimeAdapter['adjustStrategy']>,
    regime: MarketRegime
  ): Strategy {
    // Deep clone the original strategy
    const adjustedStrategy: Strategy = JSON.parse(JSON.stringify(originalStrategy));

    // Adjust risk management parameters
    if (adjustedStrategy.rules.riskManagement.lotSize) {
      adjustedStrategy.rules.riskManagement.lotSize *= adjustments.positionSize;
    }

    if (adjustedStrategy.rules.riskManagement.maxPositions) {
      adjustedStrategy.rules.riskManagement.maxPositions = adjustments.maxTradesPerDay 
        ? Math.floor(adjustedStrategy.rules.riskManagement.maxPositions * adjustments.positionSize)
        : adjustedStrategy.rules.riskManagement.maxPositions;
    }

    // Adjust exit levels
    if (adjustedStrategy.rules.exit.takeProfit) {
      const originalValue = adjustedStrategy.rules.exit.takeProfit.value;
      adjustedStrategy.rules.exit.takeProfit.value = originalValue * adjustments.takeProfitMultiplier;
    }

    if (adjustedStrategy.rules.exit.stopLoss) {
      const originalValue = adjustedStrategy.rules.exit.stopLoss.value;
      adjustedStrategy.rules.exit.stopLoss.value = originalValue * (adjustments.stopLossMultiplier || 1.0);
    }

    // Adjust trailing settings
    if (adjustedStrategy.rules.exit.trailing) {
      adjustedStrategy.rules.exit.trailing.distance *= adjustments.trailingDistance || 1.0;
    }

    // Adjust session filter if present
    if (adjustedStrategy.rules.sessionFilter) {
      // Apply session filter multiplier to aggressiveness multipliers
      if (adjustedStrategy.rules.sessionFilter.aggressivenessMultiplier) {
        adjustedStrategy.rules.sessionFilter.aggressivenessMultiplier.optimal *= 
          adjustments.sessionFilterMultiplier || 1.0;
        adjustedStrategy.rules.sessionFilter.aggressivenessMultiplier.suboptimal *= 
          adjustments.sessionFilterMultiplier || 1.0;
      }
    }

    // Update strategy metadata
    adjustedStrategy.updatedAt = new Date();
    adjustedStrategy.version += 1;

    return adjustedStrategy;
  }

  private getAppliedAdjustments(
    originalStrategy: Strategy,
    adjustedStrategy: Strategy,
    adjustments: ReturnType<RegimeAdapter['adjustStrategy']>
  ): string[] {
    const appliedAdjustments: string[] = [];

    if (originalStrategy.rules.riskManagement.lotSize !== adjustedStrategy.rules.riskManagement.lotSize) {
      appliedAdjustments.push(`Position size adjusted by ${(adjustments.positionSize * 100 - 100).toFixed(1)}%`);
    }

    if (originalStrategy.rules.exit.takeProfit.value !== adjustedStrategy.rules.exit.takeProfit.value) {
      appliedAdjustments.push(`Take profit adjusted by ${(adjustments.takeProfitMultiplier * 100 - 100).toFixed(1)}%`);
    }

    if (originalStrategy.rules.exit.stopLoss.value !== adjustedStrategy.rules.exit.stopLoss.value) {
      appliedAdjustments.push(`Stop loss adjusted by ${((adjustments.stopLossMultiplier || 1.0) * 100 - 100).toFixed(1)}%`);
    }

    if (adjustments.maxTradesPerDay && originalStrategy.rules.riskManagement.maxPositions !== adjustedStrategy.rules.riskManagement.maxPositions) {
      appliedAdjustments.push(`Max trades per day adjusted to ${adjustments.maxTradesPerDay}`);
    }

    return appliedAdjustments;
  }

  private generateWarnings(
    regimeResult: RegimeDetectionResult,
    transition: RegimeTransition | null,
    isInTransition: boolean
  ): string[] {
    const warnings: string[] = [];

    if (regimeResult.confidence < 65) {
      warnings.push('Low regime confidence detected. Adjustments may be less reliable.');
    }

    if (isInTransition) {
      warnings.push('Recent regime transition detected. Using conservative adjustments.');
    }

    if (transition && transition.duration < 4) {
      warnings.push('Very short previous regime. Market conditions may be unstable.');
    }

    if (regimeResult.metadata.volatility && regimeResult.metadata.volatility > 0.03) {
      warnings.push('High volatility detected. Consider reducing position size further.');
    }

    return warnings;
  }

  private generateRecommendations(
    regime: MarketRegime,
    confidence: number,
    appliedAdjustments: string[]
  ): string[] {
    const recommendations: string[] = [];

    if (confidence < 70) {
      recommendations.push('Wait for higher confidence before trading or reduce position size further.');
    }

    switch (regime) {
      case MarketRegime.TRENDING_UP:
        recommendations.push('Consider trend-following strategies with larger take profits.');
        break;
      
      case MarketRegime.TRENDING_DOWN:
        recommendations.push('Consider short-selling strategies or defensive positions.');
        break;
      
      case MarketRegime.RANGING:
        recommendations.push('Consider range-bound strategies with tighter stops.');
        recommendations.push('Be patient with entries - wait for clear support/resistance bounces.');
        break;
      
      case MarketRegime.VOLATILE:
        recommendations.push('Reduce position size and use wider stops.');
        recommendations.push('Consider waiting for volatility to subside before trading.');
        break;
    }

    if (appliedAdjustments.length > 3) {
      recommendations.push('Multiple adjustments applied. Monitor performance closely.');
    }

    return recommendations;
  }

  private calculatePerformanceScore(metrics: RegimePerformanceMetrics): number {
    let score = 0;

    // Win rate (30% weight)
    score += (metrics.winRate / 100) * 30;

    // Profit factor (25% weight)
    score += Math.min(25, metrics.profitFactor * 5);

    // Sharpe ratio (20% weight)
    score += Math.min(20, metrics.sharpeRatio * 10);

    // Average trade duration (15% weight) - prefer shorter durations
    const durationScore = Math.max(0, 15 - (metrics.averageTradeDuration / 60)); // Convert to hours
    score += durationScore;

    // Total trades (10% weight) - more trades = more reliable
    const tradeScore = Math.min(10, metrics.totalTrades / 10);
    score += tradeScore;

    return Math.min(100, Math.max(0, score));
  }

  private optimizeParameter(
    currentValue: number,
    performanceMetric: number,
    minValue: number,
    maxValue: number
  ): number {
    // Simple optimization based on performance
    const adjustmentFactor = performanceMetric > 1 ? 1.1 : 0.9;
    let newValue = currentValue * adjustmentFactor;

    // Ensure within bounds
    return Math.max(minValue, Math.min(maxValue, newValue));
  }
}

// Singleton instance
export const marketRegimeAdapter = new MarketRegimeAdapter();

/**
 * Convenience functions
 */
export async function adjustStrategyForRegime(
  strategy: Strategy,
  symbol: string,
  timeframe: string,
  config?: Partial<RegimeAdapterConfig>
): Promise<RegimeAdjustmentResult> {
  return marketRegimeAdapter.adjustStrategyForRegime(strategy, symbol, timeframe, config);
}

export async function getOptimalEntryConditions(
  symbol: string,
  timeframe: string,
  baseConditions: any[]
): Promise<{
  conditions: any[];
  minimumConfidence: number;
  additionalFilters: string[];
}> {
  return marketRegimeAdapter.getOptimalEntryConditions(symbol, timeframe, baseConditions);
}

export async function updateRegimePerformanceMetrics(
  strategyId: string,
  regime: MarketRegime,
  tradeResult: {
    profit: number;
    duration: number;
    win: boolean;
  }
): Promise<void> {
  return marketRegimeAdapter.updatePerformanceMetrics(strategyId, regime, tradeResult);
}