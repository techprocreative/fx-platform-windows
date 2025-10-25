/**
 * Multi-Timeframe Analysis Service
 * Analyzes signals across multiple timeframes for confirmation
 */

import { logger } from '../utils/logger';
import {
  MTFStrategy,
  MTFAnalysisResult,
  MTFConfirmation,
  Timeframe,
  Condition
} from '../types/strategy.types';
import { Bar, IndicatorService } from './indicator.service';
import { ConditionEvaluatorService } from './condition-evaluator.service';

interface TimeframeData {
  timeframe: Timeframe;
  bars: Bar[];
}

export class MTFAnalysisService {
  private conditionEvaluator: ConditionEvaluatorService;

  constructor(private indicatorService: IndicatorService) {
    this.conditionEvaluator = new ConditionEvaluatorService(indicatorService);
  }

  /**
   * Analyze signals across multiple timeframes
   */
  async analyzeMultiTimeframe(
    config: MTFStrategy,
    symbol: string,
    timeframeData: TimeframeData[]
  ): Promise<MTFAnalysisResult> {
    
    if (!config.enabled) {
      return {
        primarySignal: false,
        confirmations: [],
        overallSignal: false,
        confidence: 0
      };
    }

    // Get primary timeframe data
    const primaryData = timeframeData.find(d => d.timeframe === config.primaryTimeframe);
    
    if (!primaryData) {
      logger.warn(`[MTFAnalysisService] Primary timeframe ${config.primaryTimeframe} data not found`);
      return {
        primarySignal: false,
        confirmations: [],
        overallSignal: false,
        confidence: 0
      };
    }

    // Evaluate primary conditions
    const primarySignal = await this.evaluatePrimaryConditions(
      config.rules.entry.primary,
      primaryData,
      symbol
    );

    logger.info(`[MTFAnalysisService] Primary signal (${config.primaryTimeframe}): ${primarySignal}`);

    // Evaluate confirmation timeframes
    const confirmations: MTFAnalysisResult['confirmations'] = [];
    let confirmedCount = 0;
    let requiredCount = 0;

    for (const confirmation of config.rules.entry.confirmation) {
      const tfData = timeframeData.find(d => d.timeframe === confirmation.timeframe);
      
      if (!tfData) {
        logger.warn(`[MTFAnalysisService] Confirmation timeframe ${confirmation.timeframe} data not found`);
        continue;
      }

      const met = await this.evaluateConfirmationCondition(
        confirmation.condition,
        tfData,
        symbol
      );

      confirmations.push({
        timeframe: confirmation.timeframe,
        signal: met,
        condition: confirmation.condition,
        met
      });

      if (met) {
        confirmedCount++;
      }

      if (confirmation.required) {
        requiredCount++;
      }

      logger.info(`[MTFAnalysisService] Confirmation ${confirmation.timeframe}: ${met ? 'MET' : 'NOT MET'} (required: ${confirmation.required})`);
    }

    // Determine overall signal
    let overallSignal = primarySignal;

    // All required confirmations must be met
    const requiredMet = confirmations
      .filter(c => config.rules.entry.confirmation.find(conf => 
        conf.timeframe === c.timeframe && conf.required
      ))
      .every(c => c.met);

    if (!requiredMet) {
      overallSignal = false;
      logger.info('[MTFAnalysisService] Required confirmations not met');
    }

    // Calculate confidence based on confirmation ratio
    const totalConfirmations = confirmations.length;
    const confirmationRatio = totalConfirmations > 0 
      ? confirmedCount / totalConfirmations 
      : 0;

    let confidence = 0;
    if (primarySignal) {
      confidence = 0.5 + (confirmationRatio * 0.5);
    } else {
      confidence = 0;
    }

    logger.info(`[MTFAnalysisService] Overall signal: ${overallSignal}, Confidence: ${(confidence * 100).toFixed(1)}%`);

    return {
      primarySignal,
      confirmations,
      overallSignal,
      confidence
    };
  }

  /**
   * Evaluate primary conditions
   */
  private async evaluatePrimaryConditions(
    conditions: Condition[],
    timeframeData: TimeframeData,
    symbol: string
  ): Promise<boolean> {
    
    if (conditions.length === 0) {
      return true;
    }

    const marketData = {
      symbol,
      timeframe: timeframeData.timeframe,
      bars: timeframeData.bars
    };

    // Evaluate all conditions
    const currentPrice = marketData.bars[marketData.bars.length - 1].close;
    const results = await Promise.all(
      conditions.map(condition => 
        this.conditionEvaluator.evaluateCondition(condition, marketData, currentPrice)
      )
    );

    // All conditions must be met (AND logic)
    return results.every(result => result.met);
  }

  /**
   * Evaluate confirmation condition
   */
  private async evaluateConfirmationCondition(
    condition: Condition,
    timeframeData: TimeframeData,
    symbol: string
  ): Promise<boolean> {
    
    const marketData = {
      symbol,
      timeframe: timeframeData.timeframe,
      bars: timeframeData.bars
    };

    const currentPrice = timeframeData.bars[timeframeData.bars.length - 1].close;
    const result = await this.conditionEvaluator.evaluateCondition(condition, marketData, currentPrice);
    return result.met;
  }

  /**
   * Get recommended timeframes for confirmation
   */
  getRecommendedConfirmationTimeframes(primaryTimeframe: Timeframe): Timeframe[] {
    const timeframeOrder: Timeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'];
    const primaryIndex = timeframeOrder.indexOf(primaryTimeframe);

    if (primaryIndex === -1) {
      return ['H1', 'H4'];
    }

    const recommendations: Timeframe[] = [];

    // Add higher timeframe (for trend confirmation)
    if (primaryIndex < timeframeOrder.length - 1) {
      recommendations.push(timeframeOrder[primaryIndex + 1]);
    }
    
    // Add even higher timeframe
    if (primaryIndex < timeframeOrder.length - 2) {
      recommendations.push(timeframeOrder[primaryIndex + 2]);
    }

    return recommendations;
  }

  /**
   * Check if timeframe alignment is bullish
   */
  async checkTimeframeAlignment(
    timeframeData: TimeframeData[],
    alignmentType: 'bullish' | 'bearish'
  ): Promise<{ aligned: boolean; strength: number }> {
    
    let alignedCount = 0;

    for (const tfData of timeframeData) {
      // Simple trend check using EMAs
      const bars = tfData.bars;
      if (bars.length < 50) continue;

      const recentBars = bars.slice(-50);
      const ema20 = this.calculateSimpleEMA(recentBars, 20);
      const ema50 = this.calculateSimpleEMA(recentBars, 50);

      const currentEma20 = ema20[ema20.length - 1];
      const currentEma50 = ema50[ema50.length - 1];

      if (alignmentType === 'bullish' && currentEma20 > currentEma50) {
        alignedCount++;
      } else if (alignmentType === 'bearish' && currentEma20 < currentEma50) {
        alignedCount++;
      }
    }

    const strength = alignedCount / timeframeData.length;
    const aligned = strength >= 0.7; // 70% of timeframes must agree

    return { aligned, strength };
  }

  /**
   * Simple EMA calculation helper
   */
  private calculateSimpleEMA(bars: Bar[], period: number): number[] {
    if (bars.length < period) return [];

    const result: number[] = [];
    const multiplier = 2 / (period + 1);

    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += bars[i].close;
    }
    const firstEMA = sum / period;
    result.push(firstEMA);

    for (let i = period; i < bars.length; i++) {
      const ema = (bars[i].close - result[result.length - 1]) * multiplier + result[result.length - 1];
      result.push(ema);
    }

    return result;
  }

  /**
   * Get trend direction for each timeframe
   */
  async getTimeframeTrends(
    timeframeData: TimeframeData[]
  ): Promise<Record<Timeframe, 'bullish' | 'bearish' | 'neutral'>> {
    
    const trends: Record<string, 'bullish' | 'bearish' | 'neutral'> = {};

    for (const tfData of timeframeData) {
      const bars = tfData.bars;
      
      if (bars.length < 50) {
        trends[tfData.timeframe] = 'neutral';
        continue;
      }

      const recentBars = bars.slice(-50);
      const ema20 = this.calculateSimpleEMA(recentBars, 20);
      const ema50 = this.calculateSimpleEMA(recentBars, 50);

      if (ema20.length === 0 || ema50.length === 0) {
        trends[tfData.timeframe] = 'neutral';
        continue;
      }

      const currentEma20 = ema20[ema20.length - 1];
      const currentEma50 = ema50[ema50.length - 1];
      const currentPrice = bars[bars.length - 1].close;

      if (currentEma20 > currentEma50 && currentPrice > currentEma20) {
        trends[tfData.timeframe] = 'bullish';
      } else if (currentEma20 < currentEma50 && currentPrice < currentEma20) {
        trends[tfData.timeframe] = 'bearish';
      } else {
        trends[tfData.timeframe] = 'neutral';
      }
    }

    return trends as Record<Timeframe, 'bullish' | 'bearish' | 'neutral'>;
  }

  /**
   * Calculate MTF score (0-100)
   */
  calculateMTFScore(result: MTFAnalysisResult): number {
    let score = 0;

    // Primary signal weight: 40%
    if (result.primarySignal) {
      score += 40;
    }

    // Confirmations weight: 60%
    const confirmationScore = (result.confidence - 0.5) * 2 * 60;
    score += confirmationScore;

    return Math.max(0, Math.min(100, score));
  }
}
