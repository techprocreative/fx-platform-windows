import { prisma } from '../prisma';
import { 
  CorrelationMatrix, 
  CorrelationData, 
  CorrelationFilter,
  CorrelationGroup,
  CorrelationThreshold,
  CorrelationAnalysisResult
} from '@/types';

/**
 * Database service for correlation data operations
 */
export class CorrelationService {
  /**
   * Save correlation matrix to database
   */
  async saveCorrelationMatrix(matrix: CorrelationMatrix): Promise<string> {
    try {
      // Create the main matrix record
      const matrixRecord = await prisma.correlationMatrix.create({
        data: {
          id: matrix.id,
          timestamp: matrix.timestamp,
          timeframe: matrix.timeframe,
          lookbackPeriod: matrix.lookbackPeriod,
          totalPairs: matrix.metadata.totalPairs,
          averageCorrelation: matrix.metadata.averageCorrelation,
          highestCorrelation: matrix.metadata.highestCorrelation,
          lowestCorrelation: matrix.metadata.lowestCorrelation,
          volatilityAdjusted: matrix.metadata.volatilityAdjusted,
          metadata: matrix.metadata
        }
      });

      // Create correlation entries
      const entries = Object.entries(matrix.correlations).flatMap(([symbol1, symbolMap]) =>
        Object.entries(symbolMap).map(([symbol2, correlationData]) => ({
          matrixId: matrixRecord.id,
          symbol1,
          symbol2,
          correlation: correlationData.correlation,
          pValue: correlationData.pValue,
          sampleSize: correlationData.sampleSize,
          standardError: correlationData.standardError || 0,
          confidenceLow: correlationData.standardError ? 
            correlationData.correlation - 1.96 * correlationData.standardError : 0,
          confidenceHigh: correlationData.standardError ? 
            correlationData.correlation + 1.96 * correlationData.standardError : 0,
          trend: correlationData.trend,
          changeRate: correlationData.changeRate,
          lastUpdated: correlationData.lastUpdated
        }))
      );

      // Batch insert entries
      await prisma.correlationEntry.createMany({
        data: entries,
        skipDuplicates: true
      });

      console.log(`Saved correlation matrix ${matrix.id} with ${entries.length} entries`);
      return matrixRecord.id;
    } catch (error) {
      console.error('Error saving correlation matrix:', error);
      throw error;
    }
  }

  /**
   * Get correlation matrix by ID
   */
  async getCorrelationMatrix(id: string): Promise<CorrelationMatrix | null> {
    try {
      const matrixRecord = await prisma.correlationMatrix.findUnique({
        where: { id },
        include: {
          correlationEntries: true
        }
      });

      if (!matrixRecord) return null;

      // Reconstruct correlation matrix
      const correlations: Record<string, Record<string, CorrelationData>> = {};
      
      for (const entry of matrixRecord.correlationEntries) {
        if (!correlations[entry.symbol1]) {
          correlations[entry.symbol1] = {};
        }
        
        correlations[entry.symbol1][entry.symbol2] = {
          correlation: entry.correlation,
          pValue: entry.pValue,
          sampleSize: entry.sampleSize,
          lastUpdated: entry.lastUpdated,
          trend: entry.trend as 'increasing' | 'decreasing' | 'stable',
          changeRate: entry.changeRate
        };
      }

      return {
        id: matrixRecord.id,
        timestamp: matrixRecord.timestamp,
        timeframe: matrixRecord.timeframe,
        lookbackPeriod: matrixRecord.lookbackPeriod,
        correlations,
        metadata: {
          totalPairs: matrixRecord.totalPairs,
          averageCorrelation: matrixRecord.averageCorrelation,
          highestCorrelation: matrixRecord.highestCorrelation,
          lowestCorrelation: matrixRecord.lowestCorrelation,
          volatilityAdjusted: matrixRecord.volatilityAdjusted
        }
      };
    } catch (error) {
      console.error('Error getting correlation matrix:', error);
      throw error;
    }
  }

  /**
   * Get latest correlation matrix for specific symbols and timeframe
   */
  async getLatestCorrelationMatrix(
    symbols: string[], 
    timeframe: string
  ): Promise<CorrelationMatrix | null> {
    try {
      const matrixRecord = await prisma.correlationMatrix.findFirst({
        where: {
          timeframe,
          timestamp: {
            // Get matrices from the last 7 days
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        },
        orderBy: { timestamp: 'desc' },
        include: {
          correlationEntries: {
            where: {
              OR: symbols.flatMap(symbol1 => 
                symbols.map(symbol2 => ({
                  OR: [
                    { symbol1, symbol2 },
                    { symbol1: symbol2, symbol2: symbol1 }
                  ]
                }))
              )
            }
          }
        }
      });

      if (!matrixRecord) return null;

      // Reconstruct correlation matrix
      const correlations: Record<string, Record<string, CorrelationData>> = {};
      
      for (const entry of matrixRecord.correlationEntries) {
        if (!correlations[entry.symbol1]) {
          correlations[entry.symbol1] = {};
        }
        
        correlations[entry.symbol1][entry.symbol2] = {
          correlation: entry.correlation,
          pValue: entry.pValue,
          sampleSize: entry.sampleSize,
          lastUpdated: entry.lastUpdated,
          trend: entry.trend as 'increasing' | 'decreasing' | 'stable',
          changeRate: entry.changeRate
        };
      }

      return {
        id: matrixRecord.id,
        timestamp: matrixRecord.timestamp,
        timeframe: matrixRecord.timeframe,
        lookbackPeriod: matrixRecord.lookbackPeriod,
        correlations,
        metadata: {
          totalPairs: matrixRecord.totalPairs,
          averageCorrelation: matrixRecord.averageCorrelation,
          highestCorrelation: matrixRecord.highestCorrelation,
          lowestCorrelation: matrixRecord.lowestCorrelation,
          volatilityAdjusted: matrixRecord.volatilityAdjusted
        }
      };
    } catch (error) {
      console.error('Error getting latest correlation matrix:', error);
      throw error;
    }
  }

  /**
   * Save correlation analysis result
   */
  async saveCorrelationAnalysisResult(result: CorrelationAnalysisResult): Promise<string> {
    try {
      // Create the analysis result record
      const analysisRecord = await prisma.correlationAnalysisResult.create({
        data: {
          symbol: result.symbol,
          shouldSkip: result.shouldSkip,
          reason: result.reason || null,
          recommendedAction: result.recommendedAction,
          adjustedPositionSize: result.adjustedPositionSize || null,
          confidence: result.confidence,
          userId: 'default-user', // Would come from session/auth
          strategyId: null // Would come from context
        }
      });

      // Create conflicting positions records
      if (result.conflictingPositions.length > 0) {
        await prisma.correlationConflict.createMany({
          data: result.conflictingPositions.map(conflict => ({
            analysisResultId: analysisRecord.id,
            symbol: conflict.symbol,
            correlation: conflict.correlation,
            positionSize: conflict.positionSize
          }))
        });
      }

      console.log(`Saved correlation analysis result for ${result.symbol}`);
      return analysisRecord.id;
    } catch (error) {
      console.error('Error saving correlation analysis result:', error);
      throw error;
    }
  }

  /**
   * Get correlation analysis results for a user
   */
  async getCorrelationAnalysisResults(
    userId: string, 
    limit: number = 50
  ): Promise<CorrelationAnalysisResult[]> {
    try {
      const results = await prisma.correlationAnalysisResult.findMany({
        where: { userId },
        include: {
          conflictingPositions: true
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return results.map(result => ({
        symbol: result.symbol,
        shouldSkip: result.shouldSkip,
        reason: result.reason || undefined,
        conflictingPositions: result.conflictingPositions.map(conflict => ({
          symbol: conflict.symbol,
          correlation: conflict.correlation,
          positionSize: conflict.positionSize
        })),
        recommendedAction: result.recommendedAction as 'proceed' | 'skip' | 'reduce_size',
        adjustedPositionSize: result.adjustedPositionSize || undefined,
        confidence: result.confidence
      }));
    } catch (error) {
      console.error('Error getting correlation analysis results:', error);
      throw error;
    }
  }

  /**
   * Save correlation thresholds
   */
  async saveCorrelationThresholds(
    thresholds: CorrelationThreshold[]
  ): Promise<void> {
    try {
      await prisma.correlationThreshold.createMany({
        data: thresholds,
        skipDuplicates: true
      });

      console.log(`Saved ${thresholds.length} correlation thresholds`);
    } catch (error) {
      console.error('Error saving correlation thresholds:', error);
      throw error;
    }
  }

  /**
   * Get correlation threshold for a symbol and timeframe
   */
  async getCorrelationThreshold(
    symbol: string, 
    timeframe: string
  ): Promise<CorrelationThreshold | null> {
    try {
      const threshold = await prisma.correlationThreshold.findUnique({
        where: {
          symbol_timeframe: {
            symbol,
            timeframe
          }
        }
      });

      if (!threshold) return null;

      return {
        symbol: threshold.symbol,
        threshold: threshold.threshold,
        adjustedForVolatility: threshold.adjustedForVolatility,
        volatilityMultiplier: threshold.volatilityMultiplier
      };
    } catch (error) {
      console.error('Error getting correlation threshold:', error);
      throw error;
    }
  }

  /**
   * Save correlation groups
   */
  async saveCorrelationGroups(groups: CorrelationGroup[]): Promise<void> {
    try {
      for (const group of groups) {
        // Create group record
        const groupRecord = await prisma.correlationGroup.upsert({
          where: { currency: group.currency },
          update: {
            averageInternalCorrelation: group.averageInternalCorrelation,
            riskFactor: group.riskFactor
          },
          create: {
            currency: group.currency,
            averageInternalCorrelation: group.averageInternalCorrelation,
            riskFactor: group.riskFactor
          }
        });

        // Update group members
        // Delete existing members
        await prisma.correlationGroupMember.deleteMany({
          where: { groupId: groupRecord.id }
        });

        // Create new members
        if (group.pairs.length > 0) {
          await prisma.correlationGroupMember.createMany({
            data: group.pairs.map(symbol => ({
              groupId: groupRecord.id,
              symbol
            })),
            skipDuplicates: true
          });
        }
      }

      console.log(`Saved ${groups.length} correlation groups`);
    } catch (error) {
      console.error('Error saving correlation groups:', error);
      throw error;
    }
  }

  /**
   * Get correlation groups
   */
  async getCorrelationGroups(): Promise<CorrelationGroup[]> {
    try {
      const groups = await prisma.correlationGroup.findMany({
        include: {
          groupMembers: true
        }
      });

      return groups.map(group => ({
        currency: group.currency,
        pairs: group.groupMembers.map(member => member.symbol),
        averageInternalCorrelation: group.averageInternalCorrelation,
        riskFactor: group.riskFactor
      }));
    } catch (error) {
      console.error('Error getting correlation groups:', error);
      throw error;
    }
  }

  /**
   * Clean up old correlation data
   */
  async cleanupOldData(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
      
      // Delete old correlation matrices (cascade will delete entries)
      const deletedMatrices = await prisma.correlationMatrix.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate
          }
        }
      });

      // Delete old analysis results
      const deletedResults = await prisma.correlationAnalysisResult.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          }
        }
      });

      console.log(`Cleaned up ${deletedMatrices.count} old matrices and ${deletedResults.count} old analysis results`);
    } catch (error) {
      console.error('Error cleaning up old data:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const correlationService = new CorrelationService();