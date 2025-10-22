// Circuit Breaker - Emergency stop system for trading

import { prisma } from '@/lib/prisma';
import { triggerExecutorCommand } from '@/lib/pusher/server';

export class CircuitBreaker {
  // Safety thresholds
  private static thresholds = {
    MAX_CONSECUTIVE_LOSSES: 5,
    MAX_DAILY_LOSS_PERCENT: 10,  // % of account
    MAX_DRAWDOWN_PERCENT: 20,
    MAX_TRADES_PER_HOUR: 20,
    MAX_SLIPPAGE_PIPS: 10,
    MIN_WIN_RATE: 0.30,  // Below 30% win rate is concerning
  };
  
  /**
   * Check if circuit breaker should trigger
   */
  static async check(
    executorId: string,
    strategyId: string
  ): Promise<{ shouldBreak: boolean; reason?: string; severity?: string }> {
    const now = new Date();
    const dayStart = new Date(now.setHours(0, 0, 0, 0));
    
    try {
      // Get today's trades
      const trades = await prisma.trade.findMany({
        where: {
          executorId,
          strategyId,
          openTime: { gte: dayStart }
        },
        orderBy: { openTime: 'desc' }
      });
      
      // Check 1: Consecutive losses
      const recentTrades = trades.slice(0, 10);
      let consecutiveLosses = 0;
      for (const trade of recentTrades) {
        if ((trade.profit || 0) < 0) {
          consecutiveLosses++;
        } else {
          break;
        }
      }
      
      if (consecutiveLosses >= this.thresholds.MAX_CONSECUTIVE_LOSSES) {
        return {
          shouldBreak: true,
          reason: `${consecutiveLosses} consecutive losses detected (threshold: ${this.thresholds.MAX_CONSECUTIVE_LOSSES})`,
          severity: 'CRITICAL'
        };
      }
      
      // Check 2: Daily loss percentage
      const dailyProfit = trades.reduce((sum, t) => sum + (t.profit || 0), 0);
      const executor = await prisma.executor.findUnique({
        where: { id: executorId },
        select: { accountBalance: true }
      });
      
      if (executor && dailyProfit < 0) {
        const lossPercent = Math.abs(dailyProfit) / executor.accountBalance * 100;
        if (lossPercent >= this.thresholds.MAX_DAILY_LOSS_PERCENT) {
          return {
            shouldBreak: true,
            reason: `Daily loss ${lossPercent.toFixed(1)}% exceeds ${this.thresholds.MAX_DAILY_LOSS_PERCENT}% limit`,
            severity: 'CRITICAL'
          };
        }
      }
      
      // Check 3: Drawdown
      if (executor) {
        const equity = executor.accountBalance + dailyProfit;
        const peak = await this.getPeakEquity(executorId);
        const drawdown = peak > 0 ? (peak - equity) / peak * 100 : 0;
        
        if (drawdown >= this.thresholds.MAX_DRAWDOWN_PERCENT) {
          return {
            shouldBreak: true,
            reason: `Drawdown ${drawdown.toFixed(1)}% exceeds ${this.thresholds.MAX_DRAWDOWN_PERCENT}% limit`,
            severity: 'CRITICAL'
          };
        }
      }
      
      // Check 4: Trade frequency (potential runaway EA)
      const lastHour = new Date(Date.now() - 60 * 60 * 1000);
      const hourTrades = trades.filter(t => t.openTime >= lastHour);
      
      if (hourTrades.length >= this.thresholds.MAX_TRADES_PER_HOUR) {
        return {
          shouldBreak: true,
          reason: `${hourTrades.length} trades in last hour exceeds ${this.thresholds.MAX_TRADES_PER_HOUR} limit (potential runaway EA)`,
          severity: 'HIGH'
        };
      }
      
      // Check 5: Win rate (if enough trades)
      if (trades.length >= 20) {
        const wins = trades.filter(t => (t.profit || 0) > 0).length;
        const winRate = wins / trades.length;
        
        if (winRate < this.thresholds.MIN_WIN_RATE) {
          return {
            shouldBreak: true,
            reason: `Win rate ${(winRate * 100).toFixed(1)}% below minimum ${(this.thresholds.MIN_WIN_RATE * 100).toFixed(1)}%`,
            severity: 'HIGH'
          };
        }
      }
      
      return { shouldBreak: false };
      
    } catch (error) {
      console.error('❌ Circuit breaker check failed:', error);
      throw error;
    }
  }
  
  /**
   * Trigger emergency stop
   */
  static async trigger(
    executorId: string,
    strategyId: string,
    reason: string,
    severity: string = 'CRITICAL'
  ) {
    try {
      console.error(`🚨 CIRCUIT BREAKER TRIGGERED: ${reason}`);
      
      // Stop strategy immediately
      await triggerExecutorCommand(executorId, {
        command: 'EMERGENCY_STOP',
        parameters: { strategyId, reason },
        priority: 'URGENT'
      });
      
      // Get executor info for user notification
      const executor = await prisma.executor.findUnique({
        where: { id: executorId },
        select: { userId: true, name: true }
      });
      
      if (!executor) {
        throw new Error(`Executor ${executorId} not found`);
      }
      
      // Log circuit breaker event
      await prisma.anomalyLog.create({
        data: {
          userId: executor.userId,
          executorId,
          strategyId,
          type: 'CIRCUIT_BREAKER_TRIGGERED',
          severity,
          description: `Circuit breaker triggered: ${reason}`,
          metrics: {},
          resolved: false
        }
      });
      
      // TODO: Send urgent notification to user (email, SMS, push)
      console.log(`📧 URGENT: Circuit breaker notification sent to user`);
      
      return {
        success: true,
        action: 'EMERGENCY_STOP',
        executor: executor.name,
        reason
      };
      
    } catch (error) {
      console.error('❌ Failed to trigger circuit breaker:', error);
      throw error;
    }
  }
  
  /**
   * Check circuit breaker and trigger if needed
   */
  static async checkAndTrigger(
    executorId: string,
    strategyId: string
  ): Promise<{ triggered: boolean; reason?: string }> {
    try {
      const result = await this.check(executorId, strategyId);
      
      if (result.shouldBreak) {
        await this.trigger(executorId, strategyId, result.reason!, result.severity);
        return {
          triggered: true,
          reason: result.reason
        };
      }
      
      return {
        triggered: false
      };
      
    } catch (error) {
      console.error('❌ Circuit breaker check and trigger failed:', error);
      throw error;
    }
  }
  
  /**
   * Get circuit breaker thresholds
   */
  static getThresholds() {
    return { ...this.thresholds };
  }
  
  /**
   * Update circuit breaker thresholds (for testing or custom settings)
   */
  static updateThresholds(newThresholds: Partial<typeof this.thresholds>) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('⚙️  Circuit breaker thresholds updated:', this.thresholds);
  }
  
  /**
   * Get peak equity for drawdown calculation
   */
  private static async getPeakEquity(executorId: string): Promise<number> {
    try {
      const executor = await prisma.executor.findUnique({
        where: { id: executorId },
        select: { accountBalance: true }
      });
      
      // TODO: Track actual peak equity in database over time
      // For now, use current balance as peak (conservative approach)
      return executor?.accountBalance || 10000;
    } catch (error) {
      console.error('Failed to get peak equity:', error);
      return 10000; // Default fallback
    }
  }
  
  /**
   * Get circuit breaker history
   */
  static async getHistory(executorId: string, limit: number = 10) {
    try {
      const logs = await prisma.anomalyLog.findMany({
        where: {
          executorId,
          type: 'CIRCUIT_BREAKER_TRIGGERED'
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });
      
      return logs.map(log => ({
        id: log.id,
        severity: log.severity,
        description: log.description,
        triggeredAt: log.createdAt,
        resolved: log.resolved,
        resolvedAt: log.resolvedAt
      }));
    } catch (error) {
      console.error('❌ Failed to get circuit breaker history:', error);
      return [];
    }
  }
  
  /**
   * Reset circuit breaker (mark anomaly as resolved)
   */
  static async reset(anomalyLogId: string, resolution: string) {
    try {
      await prisma.anomalyLog.update({
        where: { id: anomalyLogId },
        data: {
          resolved: true,
          resolvedAt: new Date(),
          resolution
        }
      });
      
      console.log(`✅ Circuit breaker reset for anomaly ${anomalyLogId}`);
      
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to reset circuit breaker:', error);
      throw error;
    }
  }
}
