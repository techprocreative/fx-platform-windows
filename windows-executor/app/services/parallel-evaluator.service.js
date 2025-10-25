"use strict";
/**
 * Parallel Evaluator Service
 * Evaluates multiple symbols in parallel for better performance
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParallelEvaluatorService = void 0;
const logger_1 = require("../utils/logger");
const events_1 = require("events");
class ParallelEvaluatorService extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "maxConcurrency", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 10
        });
        Object.defineProperty(this, "evaluationTimeout", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 30000
        }); // 30 seconds
    }
    /**
     * Evaluate strategy for multiple symbols in parallel
     */
    async evaluateMultipleSymbols(strategy, evaluateFunction) {
        const startTime = Date.now();
        const symbols = strategy.symbols;
        logger_1.logger.info(`[ParallelEvaluator] Starting parallel evaluation for ${symbols.length} symbols`);
        const results = [];
        const errors = [];
        try {
            // Split symbols into batches based on max concurrency
            const batches = this.createBatches(symbols, this.maxConcurrency);
            for (const batch of batches) {
                // Evaluate batch in parallel
                const batchPromises = batch.map(symbol => this.evaluateWithTimeout(strategy, symbol, evaluateFunction)
                    .catch(error => {
                    errors.push({
                        symbol,
                        error: error.message
                    });
                    return null;
                }));
                const batchResults = await Promise.all(batchPromises);
                // Collect successful results
                for (const result of batchResults) {
                    if (result) {
                        results.push(result);
                    }
                }
            }
            const duration = Date.now() - startTime;
            logger_1.logger.info(`[ParallelEvaluator] Completed in ${duration}ms. Success: ${results.length}, Errors: ${errors.length}`);
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
        }
        catch (error) {
            logger_1.logger.error('[ParallelEvaluator] Fatal error during parallel evaluation:', error);
            throw error;
        }
    }
    /**
     * Evaluate with timeout
     */
    async evaluateWithTimeout(strategy, symbol, evaluateFunction) {
        return Promise.race([
            evaluateFunction(strategy, symbol),
            this.createTimeout(symbol)
        ]);
    }
    /**
     * Create timeout promise
     */
    createTimeout(symbol) {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Evaluation timeout for ${symbol} after ${this.evaluationTimeout}ms`));
            }, this.evaluationTimeout);
        });
    }
    /**
     * Create batches from array
     */
    createBatches(array, batchSize) {
        const batches = [];
        for (let i = 0; i < array.length; i += batchSize) {
            batches.push(array.slice(i, i + batchSize));
        }
        return batches;
    }
    /**
     * Set max concurrency
     */
    setMaxConcurrency(count) {
        this.maxConcurrency = Math.max(1, Math.min(count, 50));
        logger_1.logger.info(`[ParallelEvaluator] Max concurrency set to ${this.maxConcurrency}`);
    }
    /**
     * Set evaluation timeout
     */
    setEvaluationTimeout(ms) {
        this.evaluationTimeout = ms;
        logger_1.logger.info(`[ParallelEvaluator] Evaluation timeout set to ${ms}ms`);
    }
    /**
     * Get optimal concurrency based on system resources
     */
    getOptimalConcurrency() {
        const cpuCount = require('os').cpus().length;
        // Use 2x CPU count as optimal concurrency
        const optimal = cpuCount * 2;
        logger_1.logger.info(`[ParallelEvaluator] Detected ${cpuCount} CPUs, optimal concurrency: ${optimal}`);
        return optimal;
    }
    /**
     * Auto-configure based on system
     */
    autoConfigureForSystem() {
        const optimal = this.getOptimalConcurrency();
        this.setMaxConcurrency(optimal);
    }
    /**
     * Evaluate multiple strategies in parallel
     */
    async evaluateMultipleStrategies(strategies, evaluateFunction) {
        logger_1.logger.info(`[ParallelEvaluator] Evaluating ${strategies.length} strategies in parallel`);
        const results = new Map();
        const promises = strategies.map(async (strategy) => {
            try {
                const strategyResults = await evaluateFunction(strategy);
                results.set(strategy.id, strategyResults);
            }
            catch (error) {
                logger_1.logger.error(`[ParallelEvaluator] Error evaluating strategy ${strategy.id}:`, error);
                results.set(strategy.id, []);
            }
        });
        await Promise.all(promises);
        return results;
    }
    /**
     * Batch process array with parallel execution
     */
    async batchProcess(items, processor, options) {
        const concurrency = options?.concurrency || this.maxConcurrency;
        const results = [];
        let completed = 0;
        const batches = this.createBatches(items, concurrency);
        for (const batch of batches) {
            const batchResults = await Promise.all(batch.map(item => processor(item)));
            results.push(...batchResults);
            completed += batch.length;
            if (options?.onProgress) {
                options.onProgress(completed, items.length);
            }
        }
        return results;
    }
}
exports.ParallelEvaluatorService = ParallelEvaluatorService;
