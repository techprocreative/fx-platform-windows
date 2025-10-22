// Rollback Manager - Safe parameter rollback mechanism

import { prisma } from '@/lib/prisma';
import { triggerExecutorCommand } from '@/lib/pusher/server';

export class RollbackManager {
  /**
   * Create rollback snapshot before applying changes
   */
  static async createSnapshot(
    strategyId: string,
    executorId: string,
    currentParams: Record<string, any>,
    reason: string = 'pre_optimization'
  ) {
    try {
      await prisma.parameterSnapshot.create({
        data: {
          strategyId,
          executorId,
          parameters: currentParams,
          reason,
          createdAt: new Date()
        }
      });
      
      console.log(`✅ Created parameter snapshot for strategy ${strategyId}, executor ${executorId}`);
    } catch (error) {
      console.error('❌ Failed to create parameter snapshot:', error);
      throw error;
    }
  }
  
  /**
   * Rollback to previous parameters
   */
  static async rollback(
    optimizationId: string,
    reason: string
  ) {
    try {
      const optimization = await prisma.parameterOptimization.findUnique({
        where: { id: optimizationId },
        include: { strategy: true }
      });
      
      if (!optimization) {
        throw new Error(`Optimization ${optimizationId} not found`);
      }
      
      // Get the most recent snapshot before this optimization
      const snapshot = await prisma.parameterSnapshot.findFirst({
        where: {
          strategyId: optimization.strategyId,
          createdAt: {
            lt: optimization.createdAt
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      if (!snapshot) {
        throw new Error(`No snapshot found for rollback of optimization ${optimizationId}`);
      }
      
      console.log(`🔄 Rolling back optimization ${optimizationId}: ${reason}`);
      
      // Restore old parameters to all affected executors
      const executors = optimization.affectedExecutors;
      
      for (const executorId of executors) {
        await triggerExecutorCommand(executorId, {
          command: 'UPDATE_PARAMETERS',
          parameters: {
            strategyId: optimization.strategyId,
            newParameters: snapshot.parameters
          },
          priority: 'URGENT'
        });
      }
      
      // Update optimization status
      await prisma.parameterOptimization.update({
        where: { id: optimizationId },
        data: {
          status: 'ROLLED_BACK',
          rollbackReason: reason,
          wasSuccessful: false,
          evaluatedAt: new Date()
        }
      });
      
      console.log(`✅ Rollback completed for optimization ${optimizationId}`);
      
      return {
        success: true,
        restoredParameters: snapshot.parameters,
        affectedExecutors: executors
      };
      
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
  
  /**
   * Auto-rollback if performance degrades significantly
   */
  static async checkAndRollback(
    optimizationId: string,
    currentMetrics: {
      winRate: number;
      profitFactor: number;
      maxDrawdown: number;
    }
  ) {
    try {
      const optimization = await prisma.parameterOptimization.findUnique({
        where: { id: optimizationId }
      });
      
      if (!optimization) {
        console.warn(`Optimization ${optimizationId} not found for rollback check`);
        return;
      }
      
      // Only check optimizations that are currently active
      if (optimization.status !== 'TESTING' && optimization.status !== 'ACTIVE') {
        return;
      }
      
      const testMetrics = optimization.testMetrics as any;
      if (!testMetrics) {
        console.warn(`No test metrics found for optimization ${optimizationId}`);
        return;
      }
      
      // Check for performance degradation
      const winRateDrop = (testMetrics.winRate - currentMetrics.winRate) / testMetrics.winRate;
      const drawdownIncrease = (currentMetrics.maxDrawdown - testMetrics.maxDrawdown) / Math.abs(testMetrics.maxDrawdown);
      const profitFactorDrop = (testMetrics.profitFactor - currentMetrics.profitFactor) / testMetrics.profitFactor;
      
      let shouldRollback = false;
      let reason = '';
      
      // Rollback triggers
      if (winRateDrop > 0.15) {
        shouldRollback = true;
        reason = `Win rate dropped ${(winRateDrop * 100).toFixed(1)}% below baseline`;
      } else if (drawdownIncrease > 0.30) {
        shouldRollback = true;
        reason = `Max drawdown increased ${(drawdownIncrease * 100).toFixed(1)}% above baseline`;
      } else if (profitFactorDrop > 0.20) {
        shouldRollback = true;
        reason = `Profit factor dropped ${(profitFactorDrop * 100).toFixed(1)}% below baseline`;
      } else if (currentMetrics.profitFactor < 1.0) {
        shouldRollback = true;
        reason = `Profit factor dropped below 1.0 (currently ${currentMetrics.profitFactor.toFixed(2)})`;
      }
      
      if (shouldRollback) {
        console.warn(`⚠️  Auto-rollback triggered: ${reason}`);
        
        await this.rollback(optimizationId, reason);
        
        // TODO: Alert user via notification system
        console.log(`📧 User notification: Parameter optimization rolled back - ${reason}`);
        
        return {
          rolledBack: true,
          reason
        };
      }
      
      return {
        rolledBack: false,
        reason: 'Performance within acceptable range'
      };
      
    } catch (error) {
      console.error('❌ Auto-rollback check failed:', error);
      throw error;
    }
  }
  
  /**
   * Get rollback history for a strategy
   */
  static async getRollbackHistory(strategyId: string) {
    try {
      const rollbacks = await prisma.parameterOptimization.findMany({
        where: {
          strategyId,
          status: 'ROLLED_BACK'
        },
        orderBy: { evaluatedAt: 'desc' },
        take: 10
      });
      
      return rollbacks.map(r => ({
        id: r.id,
        reason: r.rollbackReason,
        rolledBackAt: r.evaluatedAt,
        affectedExecutors: r.affectedExecutors
      }));
    } catch (error) {
      console.error('❌ Failed to get rollback history:', error);
      return [];
    }
  }
  
  /**
   * Get available snapshots for a strategy
   */
  static async getSnapshots(strategyId: string, executorId?: string) {
    try {
      const snapshots = await prisma.parameterSnapshot.findMany({
        where: {
          strategyId,
          ...(executorId && { executorId })
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      });
      
      return snapshots;
    } catch (error) {
      console.error('❌ Failed to get snapshots:', error);
      return [];
    }
  }
}
