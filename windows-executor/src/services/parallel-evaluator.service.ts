/**
 * Parallel Evaluator Service
 * Evaluates multiple symbols in parallel for better performance
 */

import { logger } from '../utils/logger';
import { Strategy, EvaluationResult } from '../types/strategy.types';
import { EventEmitter } from 'events';

export interface ParallelEvaluationResult {
  results: EvaluationResult[];
  duration: number;
  successCount: number;
  errorCount: number;
  errors: Array<{ symbol: string; error: string }>;
}

export class ParallelEvaluatorService extends EventEmitter {
  private maxConcurrency: number = 10;
  private evaluationTimeout: number = 30000; // 30 seconds

  /**
   * Evaluate strategy for multiple symbols in parallel
   */
  async evaluateMultipleSymbols(
    strategy: Strategy,
    evaluateFunction: (strategy: Strategy, symbol: string) => Promise<EvaluationResult>
  ): Promise<ParallelEvaluationResult> {
    
    const startTime = Date.now();
    const symbols = strategy.symbols;

    logger.info(`[ParallelEvaluator] Starting parallel evaluation for ${symbols.length} symbols`);

    const results: EvaluationResult[] = [];
    const errors: Array<{ symbol: string; error: string }> = [];

    try {
      // Split symbols into batches based on max concurrency
      const batches = this.createBatches(symbols, this.maxConcurrency);

      for (const batch of batches) {
        // Evaluate batch in parallel
        const batchPromises = batch.map(symbol =>
          this.evaluateWithTimeout(strategy, symbol, evaluateFunction)
            .catch(error => {
              errors.push({
                symbol,
                error: error.message
              });
              return null;
            })
        );

        const batchResults = await Promise.all(batchPromises);

        // Collect successful results
        for (const result of batchResults) {
          if (result) {
            results.push(result);
          }
        }
      }

      const duration = Date.now() - startTime;

      logger.info(`[ParallelEvaluator] Completed in ${duration}ms. Success: ${results.length}, Errors: ${errors.length}`);

      this.emit('evaluation:complete', {
        strategyId: strategy.id,
        symbolCount: symbols.length,
        successCount: results.length,
        errorCount: errors.length,
        duration
      });

      return {
        results,
        duration,
        successCount: results.length,
        errorCount: errors.length,
        errors
      };

    } catch (error) {
      logger.error('[ParallelEvaluator] Fatal error during parallel evaluation:', error);
      throw error;
    }
  }

  /**
   * Evaluate with timeout
   */
  private async evaluateWithTimeout(
    strategy: Strategy,
    symbol: string,
    evaluateFunction: (strategy: Strategy, symbol: string) => Promise<EvaluationResult>
  ): Promise<EvaluationResult> {
    
    return Promise.race([
      evaluateFunction(strategy, symbol),
      this.createTimeout(symbol)
    ]);
  }

  /**
   * Create timeout promise
   */
  private createTimeout(symbol: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Evaluation timeout for ${symbol} after ${this.evaluationTimeout}ms`));
      }, this.evaluationTimeout);
    });
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * Set max concurrency
   */
  setMaxConcurrency(count: number): void {
    this.maxConcurrency = Math.max(1, Math.min(count, 50));
    logger.info(`[ParallelEvaluator] Max concurrency set to ${this.maxConcurrency}`);
  }

  /**
   * Set evaluation timeout
   */
  setEvaluationTimeout(ms: number): void {
    this.evaluationTimeout = ms;
    logger.info(`[ParallelEvaluator] Evaluation timeout set to ${ms}ms`);
  }

  /**
   * Get optimal concurrency based on system resources
   */
  getOptimalConcurrency(): number {
    const cpuCount = require('os').cpus().length;
    
    // Use 2x CPU count as optimal concurrency
    const optimal = cpuCount * 2;
    
    logger.info(`[ParallelEvaluator] Detected ${cpuCount} CPUs, optimal concurrency: ${optimal}`);
    
    return optimal;
  }

  /**
   * Auto-configure based on system
   */
  autoConfigureForSystem(): void {
    const optimal = this.getOptimalConcurrency();
    this.setMaxConcurrency(optimal);
  }

  /**
   * Evaluate multiple strategies in parallel
   */
  async evaluateMultipleStrategies(
    strategies: Strategy[],
    evaluateFunction: (strategy: Strategy) => Promise<EvaluationResult[]>
  ): Promise<Map<string, EvaluationResult[]>> {
    
    logger.info(`[ParallelEvaluator] Evaluating ${strategies.length} strategies in parallel`);

    const results = new Map<string, EvaluationResult[]>();

    const promises = strategies.map(async strategy => {
      try {
        const strategyResults = await evaluateFunction(strategy);
        results.set(strategy.id, strategyResults);
      } catch (error) {
        logger.error(`[ParallelEvaluator] Error evaluating strategy ${strategy.id}:`, error);
        results.set(strategy.id, []);
      }
    });

    await Promise.all(promises);

    return results;
  }

  /**
   * Batch process array with parallel execution
   */
  async batchProcess<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options?: {
      concurrency?: number;
      onProgress?: (completed: number, total: number) => void;
    }
  ): Promise<R[]> {
    
    const concurrency = options?.concurrency || this.maxConcurrency;
    const results: R[] = [];
    let completed = 0;

    const batches = this.createBatches(items, concurrency);

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(item => processor(item))
      );

      results.push(...batchResults);
      completed += batch.length;

      if (options?.onProgress) {
        options.onProgress(completed, items.length);
      }
    }

    return results;
  }
}
