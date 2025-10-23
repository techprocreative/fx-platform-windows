import { PrismaClient } from '@prisma/client';
import { MarketRegime, RegimeDetectionConfig, RegimeDetectionResult, RegimeTransition, RegimeHistory } from '@/types';

const prisma = new PrismaClient();

// Extended interface for strategy with regime settings
interface StrategyWithRegimeSettings {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  symbol: string;
  timeframe: string;
  type: string;
  status: string;
  rules: any;
  version: number;
  aiPrompt: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  regimeSettings?: any;
}

export class RegimeService {
  /**
   * Save regime detection configuration
   */
  static async saveRegimeConfig(userId: string, config: RegimeDetectionConfig & { symbol: string; timeframe: string }) {
    try {
      // Store in strategy's rules field as a backup until regimeSettings is available
      const existingStrategy = await prisma.strategy.findFirst({
        where: {
          userId,
          symbol: config.symbol,
          timeframe: config.timeframe
        },
        select: { rules: true }
      });

      const existingRules = existingStrategy?.rules as any || {};
      
      const result = await prisma.strategy.updateMany({
        where: {
          userId,
          symbol: config.symbol,
          timeframe: config.timeframe
        },
        data: {
          rules: {
            ...existingRules,
            regimeDetection: config
          }
        }
      });

      return result;
    } catch (error) {
      console.error('Error saving regime config:', error);
      throw error;
    }
  }

  /**
   * Get regime detection configuration
   */
  static async getRegimeConfig(userId: string, symbol: string, timeframe: string) {
    try {
      // Get from strategy rules field
      const strategy = await prisma.strategy.findFirst({
        where: {
          userId,
          symbol,
          timeframe
        }
      });

      if (strategy?.rules && typeof strategy.rules === 'object' && 'regimeDetection' in strategy.rules) {
        const regimeDetection = (strategy.rules as any).regimeDetection;
        return regimeDetection as unknown as RegimeDetectionConfig;
      }

      return null;
    } catch (error) {
      console.error('Error getting regime config:', error);
      throw error;
    }
  }

  /**
   * Save regime detection result
   */
  static async saveRegimeDetection(result: RegimeDetectionResult & { symbol: string; timeframe: string }) {
    try {
      // For now, store in ActivityLog with a specific event type
      const activityData = {
        symbol: result.symbol,
        timeframe: result.timeframe,
        regime: result.regime,
        confidence: result.confidence,
        timestamp: result.timestamp,
        metadata: result.metadata
      };

      await prisma.activityLog.create({
        data: {
          userId: 'system', // We'll need to pass this properly
          eventType: 'regime_detection',
          metadata: activityData
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Error saving regime detection:', error);
      throw error;
    }
  }

  /**
   * Get regime history for a symbol
   */
  static async getRegimeHistory(
    symbol: string, 
    timeframe: string, 
    startDate?: Date, 
    endDate?: Date,
    limit: number = 100
  ): Promise<RegimeHistory[]> {
    try {
      // Get from ActivityLog
      const activities = await prisma.activityLog.findMany({
        where: {
          eventType: 'regime_detection',
          metadata: {
            path: ['symbol'],
            equals: symbol
          },
          ...(startDate && { timestamp: { gte: startDate } }),
          ...(endDate && { timestamp: { lte: endDate } })
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: limit
      });

      return activities.map(activity => {
        const metadata = activity.metadata as any;
        return {
          id: activity.id,
          symbol: metadata.symbol,
          timeframe: metadata.timeframe,
          regime: metadata.regime as MarketRegime,
          confidence: metadata.confidence,
          timestamp: activity.timestamp,
          metadata: metadata.metadata,
          previousRegime: metadata.previousRegime as MarketRegime | undefined,
          transitionReason: metadata.transitionReason,
          data: metadata.data || {},
          transitions: metadata.transitions || [],
          statistics: metadata.statistics || {}
        };
      });
    } catch (error) {
      console.error('Error getting regime history:', error);
      throw error;
    }
  }

  /**
   * Get regime transition history
   */
  static async getRegimeTransitions(
    symbol: string, 
    timeframe: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<RegimeTransition[]> {
    try {
      // Get transitions from ActivityLog
      const activities = await prisma.activityLog.findMany({
        where: {
          eventType: 'regime_transition',
          metadata: {
            path: ['symbol'],
            equals: symbol
          },
          ...(startDate && { timestamp: { gte: startDate } }),
          ...(endDate && { timestamp: { lte: endDate } })
        },
        orderBy: {
          timestamp: 'desc'
        }
      });

      return activities.map(activity => {
        const metadata = activity.metadata as any;
        return {
          id: activity.id,
          symbol: metadata.symbol,
          timeframe: metadata.timeframe,
          fromRegime: metadata.fromRegime as MarketRegime,
          toRegime: metadata.toRegime as MarketRegime,
          transitionTime: activity.timestamp,
          timestamp: activity.timestamp,
          duration: metadata.duration || 0,
          transitionStrength: metadata.transitionStrength,
          volatilityBefore: metadata.volatilityBefore,
          volatilityAfter: metadata.volatilityAfter,
          volumeChange: metadata.volumeChange,
          marketEvent: metadata.marketEvent,
          newsImpact: metadata.newsImpact,
          tradesAffected: metadata.tradesAffected || 0,
          performanceChange: metadata.performanceChange,
          aiAnalysis: metadata.aiAnalysis,
          confidence: metadata.confidence
        };
      });
    } catch (error) {
      console.error('Error getting regime transitions:', error);
      throw error;
    }
  }

  /**
   * Save regime prediction
   */
  static async saveRegimePrediction(prediction: {
    symbol: string;
    timeframe: string;
    currentRegime: MarketRegime;
    predictedRegime: MarketRegime;
    targetTime: Date;
    confidence: number;
    probability: number;
    modelType: string;
    modelVersion: string;
    features?: any;
  }) {
    try {
      // Store in ActivityLog
      await prisma.activityLog.create({
        data: {
          userId: 'system',
          eventType: 'regime_prediction',
          metadata: prediction
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Error saving regime prediction:', error);
      throw error;
    }
  }

  /**
   * Update regime prediction with actual outcome
   */
  static async updateRegimePrediction(
    predictionId: string, 
    actualRegime: MarketRegime, 
    wasCorrect: boolean
  ) {
    try {
      // Update the ActivityLog entry
      await prisma.activityLog.update({
        where: { id: predictionId },
        data: {
          metadata: {
            actualRegime,
            wasCorrect,
            updatedAt: new Date()
          }
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating regime prediction:', error);
      throw error;
    }
  }

  /**
   * Save regime strategy adjustment
   */
  static async saveRegimeStrategyAdjustment(
    strategyId: string,
    regime: MarketRegime,
    adjustments: {
      positionSizeMultiplier?: number;
      maxPositionSize?: number;
      stopLossMultiplier?: number;
      takeProfitMultiplier?: number;
      trailingStopAdjustment?: number;
      entryThresholdMultiplier?: number;
      confirmationRequired?: boolean;
      exitThresholdMultiplier?: number;
      partialExitEnabled?: boolean;
      partialExitLevels?: any;
    }
  ) {
    try {
      // Store in Strategy's rules field
      const strategy = await prisma.strategy.findUnique({
        where: { id: strategyId }
      });

      if (!strategy) {
        throw new Error('Strategy not found');
      }

      const currentRules = strategy.rules as any || {};
      const currentRegimeSettings = currentRules.regimeAdjustments || {};
      const updatedRegimeSettings = {
        ...currentRegimeSettings,
        [regime]: adjustments,
        updatedAt: new Date()
      };

      await prisma.strategy.update({
        where: { id: strategyId },
        data: {
          rules: {
            ...currentRules,
            regimeAdjustments: updatedRegimeSettings
          }
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Error saving regime strategy adjustment:', error);
      throw error;
    }
  }

  /**
   * Get regime strategy adjustments for a strategy
   */
  static async getRegimeStrategyAdjustments(strategyId: string) {
    try {
      const strategy = await prisma.strategy.findUnique({
        where: { id: strategyId }
      });

      if (!strategy) {
        return [];
      }

      const rules = strategy.rules as any || {};
      const regimeSettings = rules.regimeAdjustments;
      if (!regimeSettings) {
        return [];
      }

      // Convert the regime settings object to an array format
      return Object.entries(regimeSettings).map(([regime, adjustments]: [string, any]) => ({
        strategyId,
        regime,
        isActive: true,
        ...adjustments
      }));
    } catch (error) {
      console.error('Error getting regime strategy adjustments:', error);
      throw error;
    }
  }

  /**
   * Cache regime detection result
   */
  static async cacheRegimeDetection(
    symbol: string,
    timeframe: string,
    timestamp: Date,
    regime: MarketRegime,
    confidence: number,
    data: any,
    expiresAt: Date
  ) {
    try {
      // Store in ActivityLog with cache event type
      await prisma.activityLog.create({
        data: {
          userId: 'system',
          eventType: 'regime_cache',
          metadata: {
            symbol,
            timeframe,
            timestamp,
            regime,
            confidence,
            data,
            expiresAt
          }
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Error caching regime detection:', error);
      throw error;
    }
  }

  /**
   * Get cached regime detection
   */
  static async getCachedRegimeDetection(
    symbol: string,
    timeframe: string,
    timestamp: Date
  ) {
    try {
      const cached = await prisma.activityLog.findFirst({
        where: {
          eventType: 'regime_cache',
          metadata: {
            path: ['symbol'],
            equals: symbol
          },
          timestamp: {
            gte: timestamp
          }
        },
        orderBy: {
          timestamp: 'desc'
        }
      });

      if (cached) {
        const metadata = cached.metadata as any;
        // Check if cache is still valid
        if (new Date(metadata.expiresAt) > new Date()) {
          return metadata;
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting cached regime detection:', error);
      return null;
    }
  }

  /**
   * Clean up expired cache entries
   */
  static async cleanupExpiredCache() {
    try {
      const result = await prisma.activityLog.deleteMany({
        where: {
          eventType: 'regime_cache',
          timestamp: {
            lt: new Date()
          }
        }
      });

      return result.count;
    } catch (error) {
      console.error('Error cleaning up expired cache:', error);
      throw error;
    }
  }

  /**
   * Get regime performance statistics
   */
  static async getRegimePerformanceStats(strategyId: string, regime: MarketRegime) {
    try {
      // Calculate from trade data
      const trades = await prisma.trade.findMany({
        where: {
          strategyId,
          // Add regime filtering if we store regime in trades
        }
      });

      // For now, return calculated stats
      const stats = {
        strategyId,
        regime,
        timeframe: 'H1',
        totalTrades: trades.length,
        winningTrades: trades.filter(t => (t.profit || 0) > 0).length,
        winRate: trades.length > 0 ? trades.filter(t => (t.profit || 0) > 0).length / trades.length * 100 : 0,
        avgProfit: 0,
        avgLoss: 0,
        profitFactor: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        avgPositionSize: 0,
        maxPositionSize: 0,
        riskRewardRatio: 0,
        startDate: new Date(),
        endDate: new Date(),
        lastUpdated: new Date()
      };

      return stats;
    } catch (error) {
      console.error('Error getting regime performance stats:', error);
      throw error;
    }
  }

  /**
   * Update regime performance statistics
   */
  static async updateRegimePerformanceStats(
    strategyId: string,
    regime: MarketRegime,
    timeframe: string,
    performanceData: {
      totalTrades?: number;
      winningTrades?: number;
      winRate?: number;
      avgProfit?: number;
      avgLoss?: number;
      profitFactor?: number;
      maxDrawdown?: number;
      sharpeRatio?: number;
      avgPositionSize?: number;
      maxPositionSize?: number;
      riskRewardRatio?: number;
    }
  ) {
    try {
      // Store in ActivityLog for now
      await prisma.activityLog.create({
        data: {
          userId: 'system',
          eventType: 'regime_performance_update',
          metadata: {
            strategyId,
            regime,
            timeframe,
            ...performanceData,
            updatedAt: new Date()
          }
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating regime performance stats:', error);
      throw error;
    }
  }
}