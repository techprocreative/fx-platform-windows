/**
 * ExecutionQualityTracker class for monitoring execution quality
 * Tracks fill ratios, rejection rates, and execution venue performance
 */

import {
  ExecutionQuality,
  ExecutionQualityStatistics,
  RejectionReasonCount,
  HistoricalDataPoint,
  ExecutionQualityThresholds
} from './monitoring-types';

// Default thresholds for execution quality monitoring
const DEFAULT_EXECUTION_QUALITY_THRESHOLDS: ExecutionQualityThresholds = {
  minFillRatio: 0.95, // 95%
  maxRejectionRate: 0.05, // 5%
  maxExecutionTime: 5000, // 5 seconds
  minPriceImprovementRate: 0.1 // 10%
};

export class ExecutionQualityTracker {
  private executionHistory: ExecutionQuality[] = [];
  private rejectionReasons = new Map<string, number>();
  private venuePerformance = new Map<string, ExecutionQuality[]>();
  private thresholds: ExecutionQualityThresholds;
  private maxHistorySize: number;
  private enableDebugLogging: boolean;

  constructor(
    thresholds?: Partial<ExecutionQualityThresholds>,
    options?: {
      maxHistorySize?: number;
      enableDebugLogging?: boolean;
    }
  ) {
    this.thresholds = { ...DEFAULT_EXECUTION_QUALITY_THRESHOLDS, ...thresholds };
    this.maxHistorySize = options?.maxHistorySize || 10000;
    this.enableDebugLogging = options?.enableDebugLogging || false;
  }

  /**
   * Record a new execution quality event
   * @param execution The execution quality data to record
   */
  recordExecution(execution: ExecutionQuality): void {
    // Add to history
    this.executionHistory.push(execution);
    
    // Limit history size
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory.shift();
    }

    // Track by venue
    if (execution.executionVenue) {
      if (!this.venuePerformance.has(execution.executionVenue)) {
        this.venuePerformance.set(execution.executionVenue, []);
      }
      
      const venueHistory = this.venuePerformance.get(execution.executionVenue)!;
      venueHistory.push(execution);
      
      // Limit venue history size
      if (venueHistory.length > this.maxHistorySize) {
        venueHistory.shift();
      }
    }

    // Track rejection reasons
    if (execution.isRejected && execution.rejectionReason) {
      const currentCount = this.rejectionReasons.get(execution.rejectionReason) || 0;
      this.rejectionReasons.set(execution.rejectionReason, currentCount + 1);
    }

    if (this.enableDebugLogging) {
      console.log(`[ExecutionQualityTracker] Recorded execution for order ${execution.orderId}:`, {
        fillRatio: execution.fillRatio,
        isRejected: execution.isRejected,
        executionVenue: execution.executionVenue
      });
    }
  }

  /**
   * Get execution quality statistics for a specific time period
   * @param periodStart Start of the period
   * @param periodEnd End of the period
   * @param venue Optional venue to filter by
   * @returns Execution quality statistics
   */
  getStatistics(
    periodStart?: Date,
    periodEnd?: Date,
    venue?: string
  ): ExecutionQualityStatistics {
    // Filter executions by time period and venue
    let filteredExecutions = this.executionHistory;
    
    if (venue) {
      filteredExecutions = filteredExecutions.filter(e => e.executionVenue === venue);
    }
    
    if (periodStart || periodEnd) {
      filteredExecutions = filteredExecutions.filter(execution => {
        const timestamp = execution.orderTimestamp;
        if (periodStart && timestamp < periodStart) return false;
        if (periodEnd && timestamp > periodEnd) return false;
        return true;
      });
    }

    if (filteredExecutions.length === 0) {
      return {
        averageFillRatio: 0,
        medianFillRatio: 0,
        minFillRatio: 0,
        maxFillRatio: 0,
        rejectionRate: 0,
        rejectionReasons: [],
        averageExecutionTime: 0,
        medianExecutionTime: 0,
        priceImprovementRate: 0,
        averagePriceImprovement: 0,
        totalOrders: 0,
        filledOrders: 0,
        rejectedOrders: 0,
        partiallyFilledOrders: 0,
        periodStart: periodStart || new Date(),
        periodEnd: periodEnd || new Date()
      };
    }

    // Calculate fill ratio metrics
    const fillRatios = filteredExecutions
      .filter(e => !e.isRejected)
      .map(e => e.fillRatio);
    
    fillRatios.sort((a, b) => a - b);
    
    const averageFillRatio = fillRatios.length > 0
      ? fillRatios.reduce((sum, ratio) => sum + ratio, 0) / fillRatios.length
      : 0;
    
    const medianFillRatio = fillRatios.length > 0
      ? (fillRatios.length % 2 === 0
        ? (fillRatios[fillRatios.length / 2 - 1] + fillRatios[fillRatios.length / 2]) / 2
        : fillRatios[Math.floor(fillRatios.length / 2)])
      : 0;
    
    const minFillRatio = fillRatios.length > 0 ? fillRatios[0] : 0;
    const maxFillRatio = fillRatios.length > 0 ? fillRatios[fillRatios.length - 1] : 0;

    // Calculate rejection metrics
    const totalOrders = filteredExecutions.length;
    const rejectedOrders = filteredExecutions.filter(e => e.isRejected).length;
    const rejectionRate = totalOrders > 0 ? rejectedOrders / totalOrders : 0;
    
    // Get rejection reasons
    const rejectionReasons = this.getRejectionReasonCounts(filteredExecutions);

    // Calculate execution time metrics
    const executionTimes = filteredExecutions
      .filter(e => e.executionTime !== undefined)
      .map(e => e.executionTime as number);
    
    executionTimes.sort((a, b) => a - b);
    
    const averageExecutionTime = executionTimes.length > 0
      ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length
      : 0;
    
    const medianExecutionTime = executionTimes.length > 0
      ? (executionTimes.length % 2 === 0
        ? (executionTimes[executionTimes.length / 2 - 1] + executionTimes[executionTimes.length / 2]) / 2
        : executionTimes[Math.floor(executionTimes.length / 2)])
      : 0;

    // Calculate price improvement metrics
    const priceImprovements = filteredExecutions.filter(e => e.priceImprovement);
    const priceImprovementRate = totalOrders > 0 ? priceImprovements.length / totalOrders : 0;
    
    // Calculate average price improvement (when requested price is available)
    const priceImprovementAmounts = filteredExecutions
      .filter(e => e.requestedPrice !== undefined && e.averageFillPrice !== undefined)
      .map(e => {
        const requestedPrice = e.requestedPrice as number;
        const averageFillPrice = e.averageFillPrice;
        // For buy orders, lower fill price is improvement
        // For sell orders, higher fill price is improvement
        // We need order direction to calculate this properly
        return Math.abs(averageFillPrice - requestedPrice);
      });
    
    const averagePriceImprovement = priceImprovementAmounts.length > 0
      ? priceImprovementAmounts.reduce((sum, improvement) => sum + improvement, 0) / priceImprovementAmounts.length
      : 0;

    // Count order types
    const filledOrders = filteredExecutions.filter(e => !e.isRejected && e.fillRatio > 0).length;
    const partiallyFilledOrders = filteredExecutions.filter(e => !e.isRejected && e.fillRatio > 0 && e.fillRatio < 1).length;

    return {
      averageFillRatio,
      medianFillRatio,
      minFillRatio,
      maxFillRatio,
      rejectionRate,
      rejectionReasons,
      averageExecutionTime,
      medianExecutionTime,
      priceImprovementRate,
      averagePriceImprovement,
      totalOrders,
      filledOrders,
      rejectedOrders,
      partiallyFilledOrders,
      periodStart: periodStart || new Date(Math.min(...filteredExecutions.map(e => e.orderTimestamp.getTime()))),
      periodEnd: periodEnd || new Date(Math.max(...filteredExecutions.map(e => e.orderTimestamp.getTime())))
    };
  }

  /**
   * Get execution quality statistics by venue
   * @param periodStart Start of the period
   * @param periodEnd End of the period
   * @returns Map of venue to statistics
   */
  getVenueStatistics(
    periodStart?: Date,
    periodEnd?: Date
  ): Map<string, ExecutionQualityStatistics> {
    const venueStats = new Map<string, ExecutionQualityStatistics>();
    
    for (const [venue] of this.venuePerformance) {
      venueStats.set(venue, this.getStatistics(periodStart, periodEnd, venue));
    }
    
    return venueStats;
  }

  /**
   * Get execution quality statistics by symbol
   * @param periodStart Start of the period
   * @param periodEnd End of the period
   * @returns Map of symbol to statistics
   */
  getSymbolStatistics(
    periodStart?: Date,
    periodEnd?: Date
  ): Map<string, ExecutionQualityStatistics> {
    const symbolStats = new Map<string, ExecutionQualityStatistics>();
    
    // Get all unique symbols
    const symbols = new Set(this.executionHistory.map(e => e.symbol));
    
    for (const symbol of symbols) {
      const symbolExecutions = this.executionHistory.filter(e => e.symbol === symbol);
      
      // Create a temporary tracker for this symbol
      const tempTracker = new ExecutionQualityTracker(this.thresholds, {
        maxHistorySize: this.maxHistorySize,
        enableDebugLogging: false
      });
      
      // Add all symbol executions to the temporary tracker
      symbolExecutions.forEach(e => tempTracker.recordExecution(e));
      
      // Get statistics for this symbol
      symbolStats.set(symbol, tempTracker.getStatistics(periodStart, periodEnd));
    }
    
    return symbolStats;
  }

  /**
   * Get time-in-market analysis
   * @param periodStart Start of the period
   * @param periodEnd End of the period
   * @returns Array of time-in-market data points
   */
  getTimeInMarketAnalysis(
    periodStart?: Date,
    periodEnd?: Date
  ): HistoricalDataPoint<number>[] {
    let filteredExecutions = this.executionHistory;
    
    if (periodStart || periodEnd) {
      filteredExecutions = this.executionHistory.filter(execution => {
        const timestamp = execution.orderTimestamp;
        if (periodStart && timestamp < periodStart) return false;
        if (periodEnd && timestamp > periodEnd) return false;
        return true;
      });
    }

    // Calculate time-in-market for each execution
    return filteredExecutions
      .filter(e => e.executionTime !== undefined)
      .map(execution => ({
        timestamp: execution.orderTimestamp,
        value: execution.executionTime as number,
        metadata: {
          orderId: execution.orderId,
          symbol: execution.symbol,
          fillRatio: execution.fillRatio,
          executionVenue: execution.executionVenue
        }
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Check if execution quality meets thresholds
   * @param execution The execution quality to check
   * @returns Object with threshold violations
   */
  checkThresholds(execution: ExecutionQuality): Record<string, boolean> {
    return {
      fillRatio: !execution.isRejected && execution.fillRatio < this.thresholds.minFillRatio,
      executionTime: execution.executionTime !== undefined && 
        execution.executionTime > this.thresholds.maxExecutionTime,
      lateExecution: execution.lateExecution
    };
  }

  /**
   * Get historical fill ratio data
   * @param periodStart Start of the period
   * @param periodEnd End of the period
   * @param venue Optional venue to filter by
   * @returns Array of historical data points
   */
  getHistoricalFillRatio(
    periodStart?: Date,
    periodEnd?: Date,
    venue?: string
  ): HistoricalDataPoint<number>[] {
    let filteredExecutions = this.executionHistory;
    
    if (venue) {
      filteredExecutions = filteredExecutions.filter(e => e.executionVenue === venue);
    }
    
    if (periodStart || periodEnd) {
      filteredExecutions = filteredExecutions.filter(execution => {
        const timestamp = execution.orderTimestamp;
        if (periodStart && timestamp < periodStart) return false;
        if (periodEnd && timestamp > periodEnd) return false;
        return true;
      });
    }

    return filteredExecutions
      .filter(e => !e.isRejected)
      .map(execution => ({
        timestamp: execution.orderTimestamp,
        value: execution.fillRatio,
        metadata: {
          orderId: execution.orderId,
          symbol: execution.symbol,
          executionVenue: execution.executionVenue,
          requestedVolume: execution.requestedVolume,
          executedVolume: execution.executedVolume
        }
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get historical rejection rate data
   * @param periodStart Start of the period
   * @param periodEnd End of the period
   * @param venue Optional venue to filter by
   * @returns Array of historical data points
   */
  getHistoricalRejectionRate(
    periodStart?: Date,
    periodEnd?: Date,
    venue?: string
  ): HistoricalDataPoint<number>[] {
    let filteredExecutions = this.executionHistory;
    
    if (venue) {
      filteredExecutions = filteredExecutions.filter(e => e.executionVenue === venue);
    }
    
    if (periodStart || periodEnd) {
      filteredExecutions = filteredExecutions.filter(execution => {
        const timestamp = execution.orderTimestamp;
        if (periodStart && timestamp < periodStart) return false;
        if (periodEnd && timestamp > periodEnd) return false;
        return true;
      });
    }

    // Group by hour or day to calculate rejection rates
    const timeGroups = new Map<number, { total: number; rejected: number }>();
    
    for (const execution of filteredExecutions) {
      // Group by hour
      const timeKey = Math.floor(execution.orderTimestamp.getTime() / (1000 * 60 * 60));
      
      if (!timeGroups.has(timeKey)) {
        timeGroups.set(timeKey, { total: 0, rejected: 0 });
      }
      
      const group = timeGroups.get(timeKey)!;
      group.total++;
      if (execution.isRejected) {
        group.rejected++;
      }
    }

    // Convert to historical data points
    return Array.from(timeGroups.entries())
      .map(([timeKey, group]) => ({
        timestamp: new Date(timeKey * 1000 * 60 * 60),
        value: group.total > 0 ? group.rejected / group.total : 0,
        metadata: {
          totalOrders: group.total,
          rejectedOrders: group.rejected
        }
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Compare execution venues
   * @param periodStart Start of the period
   * @param periodEnd End of the period
   * @returns Comparison of execution venues
   */
  compareVenues(
    periodStart?: Date,
    periodEnd?: Date
  ): Map<string, ExecutionQualityStatistics> {
    return this.getVenueStatistics(periodStart, periodEnd);
  }

  /**
   * Clear all execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
    this.rejectionReasons.clear();
    this.venuePerformance.clear();
    
    if (this.enableDebugLogging) {
      console.log('[ExecutionQualityTracker] Cleared all history');
    }
  }

  /**
   * Get the current thresholds
   * @returns The current thresholds
   */
  getThresholds(): ExecutionQualityThresholds {
    return { ...this.thresholds };
  }

  /**
   * Update the thresholds
   * @param newThresholds The new thresholds
   */
  updateThresholds(newThresholds: Partial<ExecutionQualityThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    
    if (this.enableDebugLogging) {
      console.log('[ExecutionQualityTracker] Updated thresholds:', this.thresholds);
    }
  }

  /**
   * Get rejection reason counts for a set of executions
   * @param executions The executions to analyze
   * @returns Array of rejection reason counts
   */
  private getRejectionReasonCounts(executions: ExecutionQuality[]): RejectionReasonCount[] {
    const reasonCounts = new Map<string, number>();
    const totalRejections = executions.filter(e => e.isRejected).length;
    
    for (const execution of executions) {
      if (execution.isRejected && execution.rejectionReason) {
        const currentCount = reasonCounts.get(execution.rejectionReason) || 0;
        reasonCounts.set(execution.rejectionReason, currentCount + 1);
      }
    }
    
    return Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: totalRejections > 0 ? (count / totalRejections) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);
  }
}