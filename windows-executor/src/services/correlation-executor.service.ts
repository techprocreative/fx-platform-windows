/**
 * Correlation Executor Service
 * Real-time correlation checking and position management
 * Prevents overexposure to correlated pairs
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface CorrelationData {
  symbol1: string;
  symbol2: string;
  correlation: number;
  calculatedAt: Date;
  dataPoints: number;
  pValue?: number; // Statistical significance
}

export interface CorrelationCheckResult {
  canTrade: boolean;
  reason?: string;
  adjustedLotSize?: number;
  correlatedPositions: Array<{
    symbol: string;
    correlation: number;
    positionSize: number;
    ticket: number;
  }>;
  recommendation: 'proceed' | 'skip' | 'reduce_size' | 'hedge';
  confidence: number;
}

export interface Position {
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
}

export class CorrelationExecutorService extends EventEmitter {
  private correlationMatrix: Map<string, Map<string, CorrelationData>> = new Map();
  private maxCorrelation: number = 0.7; // 70% correlation threshold
  private updateInterval: number = 60 * 60 * 1000; // 1 hour
  private lastUpdate: Date | null = null;

  // Common currency correlations (simplified - in production, calculate from real data)
  private readonly KNOWN_CORRELATIONS: Record<string, Record<string, number>> = {
    'EURUSD': {
      'GBPUSD': 0.75,
      'AUDUSD': 0.65,
      'NZDUSD': 0.60,
      'USDCHF': -0.90,
      'USDJPY': -0.40,
    },
    'GBPUSD': {
      'EURUSD': 0.75,
      'AUDUSD': 0.60,
      'EURGBP': -0.50,
    },
    'AUDUSD': {
      'EURUSD': 0.65,
      'NZDUSD': 0.85,
      'USDCAD': -0.55,
    },
    'NZDUSD': {
      'AUDUSD': 0.85,
      'EURUSD': 0.60,
    },
    'USDCHF': {
      'EURUSD': -0.90,
      'GBPUSD': -0.70,
    },
    'USDJPY': {
      'EURUSD': -0.40,
      'GBPUSD': -0.35,
    },
    'USDCAD': {
      'AUDUSD': -0.55,
      'EURUSD': -0.45,
    },
  };

  constructor(maxCorrelation?: number) {
    super();
    if (maxCorrelation) {
      this.maxCorrelation = maxCorrelation;
    }
    logger.info(`[CorrelationExecutor] Initialized with max correlation: ${this.maxCorrelation}`);
    this.initializeKnownCorrelations();
  }

  /**
   * Check correlation before opening a trade
   */
  async checkBeforeTrade(
    symbol: string,
    proposedLotSize: number,
    openPositions: Position[]
  ): Promise<CorrelationCheckResult> {
    logger.debug(`[CorrelationExecutor] Checking correlation for ${symbol}`);

    const correlatedPositions: CorrelationCheckResult['correlatedPositions'] = [];
    let totalCorrelatedExposure = 0;
    let maxCorrelationFound = 0;

    // Check each open position
    for (const position of openPositions) {
      if (position.symbol === symbol) {
        // Same symbol - perfect correlation
        correlatedPositions.push({
          symbol: position.symbol,
          correlation: 1.0,
          positionSize: position.volume,
          ticket: position.ticket,
        });
        totalCorrelatedExposure += position.volume;
        maxCorrelationFound = 1.0;
        continue;
      }

      // Get correlation
      const correlationData = await this.getCorrelation(symbol, position.symbol);

      if (Math.abs(correlationData.correlation) > this.maxCorrelation) {
        correlatedPositions.push({
          symbol: position.symbol,
          correlation: correlationData.correlation,
          positionSize: position.volume,
          ticket: position.ticket,
        });

        // Add to exposure (weighted by correlation)
        totalCorrelatedExposure += position.volume * Math.abs(correlationData.correlation);

        if (Math.abs(correlationData.correlation) > maxCorrelationFound) {
          maxCorrelationFound = Math.abs(correlationData.correlation);
        }
      }
    }

    // Make decision
    return this.makeDecision(
      symbol,
      proposedLotSize,
      correlatedPositions,
      totalCorrelatedExposure,
      maxCorrelationFound
    );
  }

  /**
   * Make trading decision based on correlation
   */
  private makeDecision(
    symbol: string,
    proposedLotSize: number,
    correlatedPositions: CorrelationCheckResult['correlatedPositions'],
    totalCorrelatedExposure: number,
    maxCorrelation: number
  ): CorrelationCheckResult {
    // No correlated positions
    if (correlatedPositions.length === 0) {
      return {
        canTrade: true,
        correlatedPositions: [],
        recommendation: 'proceed',
        confidence: 100,
      };
    }

    // High correlation detected
    if (maxCorrelation > 0.9) {
      // Very high correlation (>90%) - reduce size significantly
      const adjustedLotSize = proposedLotSize * 0.3; // Reduce to 30%

      return {
        canTrade: true,
        reason: `Very high correlation (${(maxCorrelation * 100).toFixed(0)}%) with open positions`,
        adjustedLotSize,
        correlatedPositions,
        recommendation: 'reduce_size',
        confidence: 60,
      };
    } else if (maxCorrelation > 0.8) {
      // High correlation (>80%) - reduce size
      const adjustedLotSize = proposedLotSize * 0.5; // Reduce to 50%

      return {
        canTrade: true,
        reason: `High correlation (${(maxCorrelation * 100).toFixed(0)}%) with open positions`,
        adjustedLotSize,
        correlatedPositions,
        recommendation: 'reduce_size',
        confidence: 75,
      };
    } else if (maxCorrelation > 0.7) {
      // Moderate correlation (>70%) - slight reduction
      const adjustedLotSize = proposedLotSize * 0.7; // Reduce to 70%

      return {
        canTrade: true,
        reason: `Moderate correlation (${(maxCorrelation * 100).toFixed(0)}%) with open positions`,
        adjustedLotSize,
        correlatedPositions,
        recommendation: 'reduce_size',
        confidence: 85,
      };
    }

    // Check if inverse correlation (hedging opportunity)
    const minCorrelation = Math.min(...correlatedPositions.map(p => p.correlation));
    if (minCorrelation < -0.7) {
      return {
        canTrade: true,
        reason: `Inverse correlation detected (${(minCorrelation * 100).toFixed(0)}%) - potential hedge`,
        correlatedPositions,
        recommendation: 'hedge',
        confidence: 80,
      };
    }

    // Low correlation - proceed normally
    return {
      canTrade: true,
      correlatedPositions,
      recommendation: 'proceed',
      confidence: 95,
    };
  }

  /**
   * Get correlation between two symbols
   */
  async getCorrelation(symbol1: string, symbol2: string): Promise<CorrelationData> {
    // Check cache first
    const cached = this.getCachedCorrelation(symbol1, symbol2);
    if (cached && this.isCacheValid(cached.calculatedAt)) {
      return cached;
    }

    // Calculate or get from known correlations
    const correlation = this.getKnownCorrelation(symbol1, symbol2);

    const data: CorrelationData = {
      symbol1,
      symbol2,
      correlation,
      calculatedAt: new Date(),
      dataPoints: 100, // Simplified
    };

    // Cache it
    this.cacheCorrelation(data);

    return data;
  }

  /**
   * Calculate correlation from historical data
   * This is a simplified version - in production, use real market data
   */
  async calculateCorrelation(
    symbol1: string,
    symbol2: string,
    historicalData1: number[],
    historicalData2: number[]
  ): Promise<number> {
    if (historicalData1.length !== historicalData2.length || historicalData1.length < 30) {
      logger.warn('[CorrelationExecutor] Insufficient data for correlation calculation');
      return 0;
    }

    const n = historicalData1.length;

    // Calculate means
    const mean1 = historicalData1.reduce((a, b) => a + b, 0) / n;
    const mean2 = historicalData2.reduce((a, b) => a + b, 0) / n;

    // Calculate correlation
    let numerator = 0;
    let sumSq1 = 0;
    let sumSq2 = 0;

    for (let i = 0; i < n; i++) {
      const diff1 = historicalData1[i] - mean1;
      const diff2 = historicalData2[i] - mean2;

      numerator += diff1 * diff2;
      sumSq1 += diff1 * diff1;
      sumSq2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(sumSq1 * sumSq2);

    if (denominator === 0) {
      return 0;
    }

    const correlation = numerator / denominator;

    logger.debug(`[CorrelationExecutor] Calculated correlation between ${symbol1} and ${symbol2}: ${correlation.toFixed(3)}`);

    return correlation;
  }

  /**
   * Update max correlation threshold
   */
  setMaxCorrelation(maxCorrelation: number): void {
    this.maxCorrelation = maxCorrelation;
    logger.info(`[CorrelationExecutor] Max correlation updated to: ${maxCorrelation}`);
  }

  /**
   * Get correlation matrix for all pairs
   */
  getCorrelationMatrix(symbols: string[]): Map<string, Map<string, number>> {
    const matrix = new Map<string, Map<string, number>>();

    for (const symbol1 of symbols) {
      const row = new Map<string, number>();

      for (const symbol2 of symbols) {
        if (symbol1 === symbol2) {
          row.set(symbol2, 1.0);
        } else {
          const correlation = this.getKnownCorrelation(symbol1, symbol2);
          row.set(symbol2, correlation);
        }
      }

      matrix.set(symbol1, row);
    }

    return matrix;
  }

  // ============ HELPER METHODS ============

  /**
   * Initialize known correlations
   */
  private initializeKnownCorrelations(): void {
    for (const [symbol1, correlations] of Object.entries(this.KNOWN_CORRELATIONS)) {
      for (const [symbol2, correlation] of Object.entries(correlations)) {
        const data: CorrelationData = {
          symbol1,
          symbol2,
          correlation,
          calculatedAt: new Date(),
          dataPoints: 100,
        };
        this.cacheCorrelation(data);
      }
    }

    logger.info('[CorrelationExecutor] Known correlations initialized');
  }

  /**
   * Get known correlation (static data)
   */
  private getKnownCorrelation(symbol1: string, symbol2: string): number {
    if (symbol1 === symbol2) {
      return 1.0;
    }

    // Check forward
    if (this.KNOWN_CORRELATIONS[symbol1]?.[symbol2] !== undefined) {
      return this.KNOWN_CORRELATIONS[symbol1][symbol2];
    }

    // Check reverse
    if (this.KNOWN_CORRELATIONS[symbol2]?.[symbol1] !== undefined) {
      return this.KNOWN_CORRELATIONS[symbol2][symbol1];
    }

    // Default to low correlation if unknown
    return 0.1;
  }

  /**
   * Cache correlation data
   */
  private cacheCorrelation(data: CorrelationData): void {
    if (!this.correlationMatrix.has(data.symbol1)) {
      this.correlationMatrix.set(data.symbol1, new Map());
    }
    this.correlationMatrix.get(data.symbol1)!.set(data.symbol2, data);

    // Also cache reverse
    if (!this.correlationMatrix.has(data.symbol2)) {
      this.correlationMatrix.set(data.symbol2, new Map());
    }
    this.correlationMatrix.get(data.symbol2)!.set(data.symbol1, { ...data, symbol1: data.symbol2, symbol2: data.symbol1 });
  }

  /**
   * Get cached correlation
   */
  private getCachedCorrelation(symbol1: string, symbol2: string): CorrelationData | null {
    return this.correlationMatrix.get(symbol1)?.get(symbol2) || null;
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(calculatedAt: Date): boolean {
    const now = Date.now();
    const cacheAge = now - calculatedAt.getTime();
    return cacheAge < this.updateInterval;
  }
}
