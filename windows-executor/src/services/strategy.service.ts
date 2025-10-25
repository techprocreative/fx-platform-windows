/**
 * Strategy Service
 * Core strategy execution engine
 * - Downloads strategies from web platform
 * - Evaluates indicators and conditions
 * - Generates trading signals
 * - Reports back to platform
 */

import { EventEmitter } from 'events';
import { 
  Strategy, 
  StrategyState, 
  Signal, 
  EvaluationResult,
  StrategyReport,
  LLMConsultation 
} from '../types/strategy.types';
import { logger } from '../utils/logger';
import { IndicatorService } from './indicator.service';
import { MarketDataService } from './market-data.service';
import { ConditionEvaluatorService } from './condition-evaluator.service';
import { FilterEvaluatorService, SymbolInfo } from './filter-evaluator.service';
import { PositionSizingService } from './position-sizing.service';
import { CorrelationService } from './correlation.service';
import { RegimeDetectionService } from './regime-detection.service';
import { SmartExitService } from './smart-exit.service';
import { SessionService } from './session.service';
import { MTFAnalysisService } from './mtf-analysis.service';

export class StrategyService extends EventEmitter {
  private strategies: Map<string, Strategy> = new Map();
  private strategyStates: Map<string, StrategyState> = new Map();
  private evaluationIntervals: Map<string, NodeJS.Timeout> = new Map();
  
  private indicatorService: IndicatorService;
  private marketDataService: MarketDataService;
  private conditionEvaluator: ConditionEvaluatorService;
  private filterEvaluator: FilterEvaluatorService;
  
  // Advanced services
  private positionSizingService: PositionSizingService;
  private correlationService: CorrelationService;
  private regimeDetectionService: RegimeDetectionService;
  private smartExitService: SmartExitService;
  private sessionService: SessionService;
  private mtfAnalysisService: MTFAnalysisService;
  
  constructor(
    private apiBaseUrl: string,
    private executorId: string,
    indicatorService: IndicatorService,
    marketDataService: MarketDataService
  ) {
    super();
    
    this.indicatorService = indicatorService;
    this.marketDataService = marketDataService;
    this.conditionEvaluator = new ConditionEvaluatorService(indicatorService);
    this.filterEvaluator = new FilterEvaluatorService();
    
    // Initialize advanced services
    this.positionSizingService = new PositionSizingService();
    this.correlationService = new CorrelationService();
    this.regimeDetectionService = new RegimeDetectionService();
    this.smartExitService = new SmartExitService();
    this.sessionService = new SessionService();
    this.mtfAnalysisService = new MTFAnalysisService(this.indicatorService);
    
    logger.info('[StrategyService] Initialized with advanced features');
  }

  /**
   * Download and load strategies from web platform
   */
  async downloadStrategies(): Promise<Strategy[]> {
    try {
      logger.info('[StrategyService] Downloading strategies from platform...');
      
      // TODO: Call API to get strategies
      // const response = await fetch(`${this.apiBaseUrl}/api/executor/${this.executorId}/strategies`);
      // const strategies = await response.json();
      
      // For now, return empty
      // In real implementation, this will fetch from your web platform
      const strategies: Strategy[] = [];
      
      // Load each strategy
      for (const strategy of strategies) {
        await this.loadStrategy(strategy);
      }
      
      logger.info(`[StrategyService] Loaded ${strategies.length} strategies`);
      return strategies;
      
    } catch (error) {
      logger.error('[StrategyService] Failed to download strategies:', error);
      throw error;
    }
  }

  /**
   * Load a strategy into the engine
   */
  async loadStrategy(strategy: Strategy): Promise<void> {
    try {
      logger.info(`[StrategyService] Loading strategy: ${strategy.name} (${strategy.id})`);
      
      // Validate strategy
      this.validateStrategy(strategy);
      
      // Store strategy
      this.strategies.set(strategy.id, strategy);
      
      // Initialize state
      const state: StrategyState = {
        strategyId: strategy.id,
        status: 'paused',
        startedAt: new Date(),
        lastEvaluation: new Date(),
        evaluationCount: 0,
        signalsGenerated: 0,
        tradesExecuted: 0,
        openPositions: 0,
        winRate: 0,
        profitFactor: 0,
        totalPnL: 0,
        positions: [],
        errorCount: 0
      };
      
      this.strategyStates.set(strategy.id, state);
      
      // Start if active
      if (strategy.status === 'active') {
        await this.startStrategy(strategy.id);
      }
      
      logger.info(`[StrategyService] Strategy loaded: ${strategy.name}`);
      this.emit('strategy:loaded', strategy);
      
    } catch (error) {
      logger.error(`[StrategyService] Failed to load strategy ${strategy.id}:`, error);
      throw error;
    }
  }

  /**
   * Start strategy execution
   */
  async startStrategy(strategyId: string): Promise<void> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }
    
    const state = this.strategyStates.get(strategyId);
    if (!state) {
      throw new Error(`Strategy state ${strategyId} not found`);
    }
    
    logger.info(`[StrategyService] Starting strategy: ${strategy.name}`);
    
    // Update state
    state.status = 'running';
    state.startedAt = new Date();
    
    // Calculate evaluation interval based on timeframe
    const intervalMs = this.getEvaluationInterval(strategy.timeframe);
    
    // Start periodic evaluation
    const interval = setInterval(() => {
      this.evaluateStrategy(strategyId).catch(err => {
        logger.error(`[StrategyService] Evaluation error for ${strategyId}:`, err);
      });
    }, intervalMs);
    
    this.evaluationIntervals.set(strategyId, interval);
    
    // Emit event
    this.emit('strategy:started', { strategyId, strategy });
    
    logger.info(`[StrategyService] Strategy started: ${strategy.name}`);
  }

  /**
   * Stop strategy execution
   */
  async stopStrategy(strategyId: string): Promise<void> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }
    
    logger.info(`[StrategyService] Stopping strategy: ${strategy.name}`);
    
    // Clear evaluation interval
    const interval = this.evaluationIntervals.get(strategyId);
    if (interval) {
      clearInterval(interval);
      this.evaluationIntervals.delete(strategyId);
    }
    
    // Update state
    const state = this.strategyStates.get(strategyId);
    if (state) {
      state.status = 'stopped';
    }
    
    // Emit event
    this.emit('strategy:stopped', { strategyId, strategy });
    
    logger.info(`[StrategyService] Strategy stopped: ${strategy.name}`);
  }

  /**
   * Evaluate strategy and generate signals
   */
  async evaluateStrategy(strategyId: string): Promise<EvaluationResult[]> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }
    
    const state = this.strategyStates.get(strategyId);
    if (!state || state.status !== 'running') {
      return [];
    }
    
    logger.debug(`[StrategyService] Evaluating strategy: ${strategy.name}`);
    
    const results: EvaluationResult[] = [];
    
    try {
      // Evaluate for each symbol
      for (const symbol of strategy.symbols) {
        const result = await this.evaluateSymbol(strategy, symbol);
        results.push(result);
        
        // Generate signal if conditions met
        if (result.action !== 'HOLD' && result.action !== 'WAIT') {
          // Get market data for signal generation
          const marketData = await this.marketDataService.getMarketData(
            symbol,
            strategy.timeframe,
            100
          );
          await this.handleEvaluationResult(strategy, result, marketData);
        }
      }
      
      // Update state
      state.lastEvaluation = new Date();
      state.evaluationCount++;
      
    } catch (error) {
      logger.error(`[StrategyService] Evaluation failed for ${strategyId}:`, error);
      state.errorCount++;
      state.lastError = (error as Error).message;
    }
    
    return results;
  }

  /**
   * Evaluate strategy for a specific symbol
   */
  private async evaluateSymbol(strategy: Strategy, symbol: string): Promise<EvaluationResult> {
    logger.debug(`[StrategyService] Evaluating ${strategy.name} for ${symbol}`);
    
    try {
      // STEP 1: Get market data
      const marketData = await this.marketDataService.getMarketData(
        symbol,
        strategy.timeframe,
        100 // Get 100 bars for indicator calculation
      );

      if (!marketData || marketData.bars.length === 0) {
        return {
          strategyId: strategy.id,
          symbol,
          timestamp: new Date(),
          action: 'WAIT',
          confidence: 0,
          entryConditionsMet: false,
          exitConditionsMet: false,
          filtersPassed: false,
          indicatorValues: {},
          conditionResults: [],
          filterResults: [],
          reasons: ['No market data available']
        };
      }

      const currentPrice = marketData.bars[marketData.bars.length - 1].close;
      
      // STEP 2: Get symbol info for filters
      const symbolInfo: SymbolInfo = await this.marketDataService.getSymbolInfo(symbol);

      // STEP 3: Calculate all required indicators and store values
      const indicatorValues: Record<string, any> = {};
      
      for (const condition of strategy.entryConditions) {
        const value = await this.indicatorService.getIndicatorValue(
          marketData,
          condition.indicator,
          condition.params
        );
        
        if (value !== null) {
          indicatorValues[`${condition.indicator}_${JSON.stringify(condition.params)}`] = value;
        }
      }

      // Calculate ATR for volatility filter if needed
      let currentVolatility: number | undefined;
      if (strategy.filters?.some(f => f.type === 'volatility')) {
        const atr = this.indicatorService.calculateATR(marketData.bars, 14);
        currentVolatility = atr.length > 0 ? atr[atr.length - 1] : undefined;
      }

      // STEP 4: Evaluate filters first
      const filtersResult = await this.filterEvaluator.evaluateFilters(
        strategy.filters || [],
        symbolInfo,
        currentVolatility
      );

      if (!filtersResult.passed) {
        return {
          strategyId: strategy.id,
          symbol,
          timestamp: new Date(),
          action: 'WAIT',
          confidence: 0,
          entryConditionsMet: false,
          exitConditionsMet: false,
          filtersPassed: false,
          indicatorValues,
          conditionResults: [],
          filterResults: filtersResult.results,
          reasons: ['Filters not passed', ...filtersResult.results.filter(r => !r.passed).map(r => r.reason)]
        };
      }

      // STEP 5: Evaluate entry conditions
      const entryResult = await this.conditionEvaluator.evaluateConditions(
        strategy.entryConditions,
        strategy.entryLogic,
        marketData,
        currentPrice
      );

      // STEP 6: Check if we have open positions for this strategy+symbol
      const state = this.strategyStates.get(strategy.id);
      const hasOpenPosition = state?.positions.some(p => p.symbol === symbol) || false;

      // STEP 7: Evaluate exit conditions if we have open positions
      let exitConditionsMet = false;
      let exitResults: any[] = [];
      
      if (hasOpenPosition && strategy.exitConditions && strategy.exitConditions.length > 0) {
        const exitResult = await this.conditionEvaluator.evaluateConditions(
          strategy.exitConditions,
          strategy.exitLogic,
          marketData,
          currentPrice
        );
        exitConditionsMet = exitResult.met;
        exitResults = exitResult.results;
      }

      // STEP 8: Determine action
      let action: 'BUY' | 'SELL' | 'CLOSE' | 'HOLD' | 'WAIT' = 'WAIT';
      let confidence = 0;
      const reasons: string[] = [];

      if (exitConditionsMet && hasOpenPosition) {
        // Exit signal takes priority
        action = 'CLOSE';
        confidence = 90;
        reasons.push('Exit conditions met');
        exitResults.filter(r => r.met).forEach(r => reasons.push(r.reason));
        
      } else if (entryResult.met && !hasOpenPosition) {
        // Entry signal
        // Determine BUY or SELL based on conditions
        // For now, simplified: if RSI < 30 = BUY, RSI > 70 = SELL
        const rsiCondition = strategy.entryConditions.find(c => c.indicator === 'RSI');
        
        if (rsiCondition) {
          const rsiValue = indicatorValues[`${rsiCondition.indicator}_${JSON.stringify(rsiCondition.params)}`];
          
          if (rsiValue < 40) {
            action = 'BUY';
          } else if (rsiValue > 60) {
            action = 'SELL';
          } else {
            action = 'BUY'; // Default to BUY if conditions met
          }
        } else {
          action = 'BUY'; // Default action
        }
        
        // Calculate confidence based on how many conditions met
        const metCount = entryResult.results.filter(r => r.met).length;
        const totalCount = entryResult.results.length;
        confidence = Math.round((metCount / totalCount) * 100);
        
        reasons.push('Entry conditions met');
        entryResult.results.filter(r => r.met).forEach(r => reasons.push(r.reason));
        
      } else if (hasOpenPosition) {
        action = 'HOLD';
        reasons.push('Position open, exit conditions not met');
      } else {
        action = 'WAIT';
        reasons.push('Entry conditions not met');
      }

      // STEP 9: Return evaluation result
      return {
        strategyId: strategy.id,
        symbol,
        timestamp: new Date(),
        action,
        confidence,
        entryConditionsMet: entryResult.met,
        exitConditionsMet,
        filtersPassed: filtersResult.passed,
        indicatorValues,
        conditionResults: entryResult.results,
        filterResults: filtersResult.results,
        reasons
      };

    } catch (error) {
      logger.error(`[StrategyService] Error evaluating ${symbol}:`, error);
      
      return {
        strategyId: strategy.id,
        symbol,
        timestamp: new Date(),
        action: 'WAIT',
        confidence: 0,
        entryConditionsMet: false,
        exitConditionsMet: false,
        filtersPassed: false,
        indicatorValues: {},
        conditionResults: [],
        filterResults: [],
        reasons: [`Error: ${(error as Error).message}`]
      };
    }
  }

  /**
   * Handle evaluation result and generate signal
   */
  private async handleEvaluationResult(
    strategy: Strategy, 
    result: EvaluationResult,
    marketData: any
  ): Promise<void> {
    if (result.action === 'BUY' || result.action === 'SELL') {
      // Generate signal
      const signal = await this.generateSignal(strategy, result, marketData);
      
      // Emit signal event
      this.emit('signal:generated', signal);
      
      // Update state
      const state = this.strategyStates.get(strategy.id);
      if (state) {
        state.signalsGenerated++;
      }
      
      logger.info(`[StrategyService] Signal generated:`, {
        strategy: strategy.name,
        symbol: result.symbol,
        type: result.action,
        confidence: result.confidence
      });
    }
  }

  /**
   * Generate trading signal from evaluation
   */
  private async generateSignal(
    strategy: Strategy, 
    result: EvaluationResult,
    marketData: any
  ): Promise<Signal> {
    // Get current price
    const symbolInfo = await this.marketDataService.getSymbolInfo(result.symbol);
    const entryPrice = result.action === 'BUY' ? symbolInfo.ask : symbolInfo.bid;
    
    // Calculate SL/TP first (needed for position sizing)
    const { stopLoss, takeProfit } = await this.calculateSLTP(
      strategy,
      result.symbol,
      result.action,
      entryPrice,
      marketData
    );
    
    // Calculate position size with advanced methods
    let volume = await this.calculatePositionSize(
      strategy, 
      result.symbol,
      stopLoss,
      entryPrice
    );

    // Check correlation filter
    if (strategy.correlationFilter?.enabled) {
      const state = this.strategyStates.get(strategy.id);
      
      if (state && state.positions.length > 0) {
        // Get correlation matrix (simplified - would need historical data)
        // For now, just log that correlation check would happen
        logger.info(`[StrategyService] Correlation filter enabled - would check against ${state.positions.length} open positions`);
        
        // In full implementation:
        // const correlationMatrix = await this.correlationService.calculateCorrelationMatrix(...)
        // const analysis = await this.correlationService.analyzeCorrelationRisk(...)
        // if (analysis.shouldSkip) return; // Skip this signal
        // if (analysis.adjustedPositionSize) volume = analysis.adjustedPositionSize;
      }
    }

    // Apply regime detection adjustments
    if (strategy.regimeDetection?.enabled && strategy.regimeDetection.adaptStrategy) {
      const regimeResult = await this.regimeDetectionService.detectRegime(marketData.bars);
      
      logger.info(`[StrategyService] Regime detected: ${regimeResult.regime} (confidence: ${(regimeResult.confidence * 100).toFixed(1)}%)`);

      // Adjust position size based on regime
      const regimeMultiplier = this.regimeDetectionService.getPositionSizeMultiplier(regimeResult.regime);
      volume *= regimeMultiplier;

      logger.info(`[StrategyService] Volume adjusted for regime: ${volume.toFixed(2)} (${regimeMultiplier}x)`);
    }

    // Round volume
    volume = Math.round(volume * 100) / 100;
    
    const signal: Signal = {
      id: `signal-${Date.now()}-${Math.random()}`,
      strategyId: strategy.id,
      symbol: result.symbol,
      type: result.action as 'BUY' | 'SELL',
      action: result.action as 'BUY' | 'SELL',
      timeframe: strategy.timeframe,
      entryPrice,
      stopLoss,
      takeProfit,
      volume,
      confidence: result.confidence,
      reasons: result.reasons,
      conditionsMet: result.conditionResults
        .filter(c => c.met)
        .map(c => c.reason),
      timestamp: new Date()
    };
    
    return signal;
  }

  /**
   * Calculate position size based on risk
   */
  private async calculatePositionSize(
    strategy: Strategy, 
    symbol: string, 
    stopLoss: number, 
    entryPrice: number
  ): Promise<number> {
    
    // Check if advanced position sizing is configured
    if (strategy.positionSizing && strategy.positionSizing.method !== 'fixed_lot') {
      try {
        // Get account info (simplified - should come from MT5)
        const accountInfo = {
          balance: 10000, // TODO: Get from MT5
          equity: 10000,
          currency: 'USD'
        };

        // Get market data for ATR calculation if needed
        const bars = await this.marketDataService.getMarketData(symbol, strategy.timeframe, 100);

        const priceInfo = {
          symbol,
          currentPrice: entryPrice,
          stopLoss,
          bars: bars?.bars || []
        };

        const sizeCalculation = await this.positionSizingService.calculatePositionSize(
          strategy.positionSizing,
          accountInfo,
          priceInfo
        );

        logger.info(`[StrategyService] Position size calculated: ${sizeCalculation.recommendedSize} (${sizeCalculation.method})`);
        logger.info(`[StrategyService] Risk: $${sizeCalculation.riskAmount.toFixed(2)} (${sizeCalculation.riskPercentage.toFixed(2)}%)`);

        // Apply session-based adjustment if configured
        const sessionAnalysis = this.sessionService.analyzeSession(symbol);
        const finalSize = sizeCalculation.recommendedSize * sessionAnalysis.aggressivenessMultiplier;

        logger.info(`[StrategyService] Final size after session adjustment: ${finalSize.toFixed(2)}x`);

        return Math.round(finalSize * 100) / 100;

      } catch (error) {
        logger.error('[StrategyService] Position sizing calculation error:', error);
        return strategy.positionSize;
      }
    }

    // Fallback to basic size
    return strategy.positionSize;
  }

  /**
   * Calculate stop loss and take profit levels
   */
  private async calculateSLTP(
    strategy: Strategy,
    symbol: string,
    action: string,
    entryPrice: number,
    marketData: any
  ): Promise<{ stopLoss: number; takeProfit: number }> {
    
    let stopLoss = 0;
    let takeProfit = 0;
    
    try {
      // Get symbol info for point calculation
      const symbolInfo = await this.marketDataService.getSymbolInfo(symbol);
      const point = symbolInfo.point;
      
      // Calculate Stop Loss
      if (strategy.stopLoss) {
        const slConfig = strategy.stopLoss;
        
        switch (slConfig.type) {
          case 'fixed':
            // Fixed pips
            const slPips = slConfig.value;
            const slDistance = slPips * point * 10;
            stopLoss = action === 'BUY' 
              ? entryPrice - slDistance 
              : entryPrice + slDistance;
            break;
          
          case 'atr':
            // ATR-based
            const atr = this.indicatorService.calculateATR(marketData.bars, 14);
            const atrValue = atr.length > 0 ? atr[atr.length - 1] : 0;
            const atrMultiplier = slConfig.value;
            const atrDistance = atrValue * atrMultiplier;
            stopLoss = action === 'BUY'
              ? entryPrice - atrDistance
              : entryPrice + atrDistance;
            break;
          
          case 'percent':
            // Percentage of entry price
            const slPercent = slConfig.value / 100;
            stopLoss = action === 'BUY'
              ? entryPrice * (1 - slPercent)
              : entryPrice * (1 + slPercent);
            break;
          
          case 'price':
            // Fixed price level
            stopLoss = slConfig.value;
            break;
        }
        
        // Apply min/max limits if specified
        if (slConfig.minPips) {
          const minDistance = slConfig.minPips * point * 10;
          const currentDistance = Math.abs(entryPrice - stopLoss);
          if (currentDistance < minDistance) {
            stopLoss = action === 'BUY'
              ? entryPrice - minDistance
              : entryPrice + minDistance;
          }
        }
        
        if (slConfig.maxPips) {
          const maxDistance = slConfig.maxPips * point * 10;
          const currentDistance = Math.abs(entryPrice - stopLoss);
          if (currentDistance > maxDistance) {
            stopLoss = action === 'BUY'
              ? entryPrice - maxDistance
              : entryPrice + maxDistance;
          }
        }
      }
      
      // Calculate Take Profit
      if (strategy.takeProfit) {
        const tpConfig = strategy.takeProfit;
        
        switch (tpConfig.type) {
          case 'fixed':
            // Fixed pips
            const tpPips = tpConfig.value;
            const tpDistancePips = tpPips * point * 10;
            takeProfit = action === 'BUY'
              ? entryPrice + tpDistancePips
              : entryPrice - tpDistancePips;
            break;
          
          case 'atr':
            // ATR-based
            const atr = this.indicatorService.calculateATR(marketData.bars, 14);
            const atrValue = atr.length > 0 ? atr[atr.length - 1] : 0;
            const atrMultiplier = tpConfig.value;
            const atrDistance = atrValue * atrMultiplier;
            takeProfit = action === 'BUY'
              ? entryPrice + atrDistance
              : entryPrice - atrDistance;
            break;
          
          case 'percent':
            // Percentage of entry price
            const tpPercent = tpConfig.value / 100;
            takeProfit = action === 'BUY'
              ? entryPrice * (1 + tpPercent)
              : entryPrice * (1 - tpPercent);
            break;
          
          case 'ratio':
            // Risk:Reward ratio based on SL distance
            const slDistance = Math.abs(entryPrice - stopLoss);
            const ratio = tpConfig.ratio || tpConfig.value;
            const tpDistanceRatio = slDistance * ratio;
            takeProfit = action === 'BUY'
              ? entryPrice + tpDistanceRatio
              : entryPrice - tpDistanceRatio;
            break;
          
          case 'price':
            // Fixed price level
            takeProfit = tpConfig.value;
            break;
        }
      }
      
      return { stopLoss, takeProfit };
      
    } catch (error) {
      logger.error('[StrategyService] Error calculating SL/TP:', error);
      return { stopLoss: 0, takeProfit: 0 };
    }
  }

  /**
   * Consult LLM for uncertain situations
   */
  async consultLLM(
    strategyId: string,
    query: string,
    context: any
  ): Promise<LLMConsultation> {
    logger.info(`[StrategyService] Consulting LLM for strategy ${strategyId}`);
    
    try {
      // TODO: Call web platform LLM API
      // const response = await fetch(`${this.apiBaseUrl}/api/llm/consult`, {
      //   method: 'POST',
      //   body: JSON.stringify({ query, context })
      // });
      
      const consultation: LLMConsultation = {
        id: `llm-${Date.now()}`,
        strategyId,
        query,
        context,
        response: 'LLM integration not yet implemented',
        decision: 'proceed',
        timestamp: new Date()
      };
      
      this.emit('llm:consultation', consultation);
      
      return consultation;
      
    } catch (error) {
      logger.error('[StrategyService] LLM consultation failed:', error);
      throw error;
    }
  }

  /**
   * Generate strategy report
   */
  async generateReport(strategyId: string): Promise<StrategyReport> {
    const strategy = this.strategies.get(strategyId);
    const state = this.strategyStates.get(strategyId);
    
    if (!strategy || !state) {
      throw new Error(`Strategy ${strategyId} not found`);
    }
    
    const report: StrategyReport = {
      strategyId,
      executorId: this.executorId,
      timestamp: new Date(),
      status: state.status,
      uptime: Math.floor((Date.now() - state.startedAt.getTime()) / 1000),
      stats: {
        totalSignals: state.signalsGenerated,
        totalTrades: state.tradesExecuted,
        openPositions: state.openPositions,
        winRate: state.winRate,
        profitFactor: state.profitFactor,
        totalPnL: state.totalPnL,
        drawdown: 0 // TODO: Calculate
      },
      recentSignals: [],
      recentTrades: []
    };
    
    return report;
  }

  /**
   * Send report to web platform
   */
  async sendReport(strategyId: string): Promise<void> {
    try {
      const report = await this.generateReport(strategyId);
      
      // TODO: Send to API
      // await fetch(`${this.apiBaseUrl}/api/executor/${this.executorId}/report`, {
      //   method: 'POST',
      //   body: JSON.stringify(report)
      // });
      
      logger.info(`[StrategyService] Report sent for strategy ${strategyId}`);
      this.emit('report:sent', report);
      
    } catch (error) {
      logger.error(`[StrategyService] Failed to send report for ${strategyId}:`, error);
      throw error;
    }
  }

  /**
   * Validate strategy configuration
   */
  private validateStrategy(strategy: Strategy): void {
    if (!strategy.id || !strategy.name) {
      throw new Error('Strategy must have id and name');
    }
    
    if (!strategy.symbols || strategy.symbols.length === 0) {
      throw new Error('Strategy must have at least one symbol');
    }
    
    if (!strategy.timeframe) {
      throw new Error('Strategy must have a timeframe');
    }
    
    if (!strategy.entryConditions || strategy.entryConditions.length === 0) {
      throw new Error('Strategy must have at least one entry condition');
    }
  }

  /**
   * Get evaluation interval based on timeframe
   */
  private getEvaluationInterval(timeframe: string): number {
    const intervals: Record<string, number> = {
      'M1': 60 * 1000,         // 1 minute
      'M5': 5 * 60 * 1000,     // 5 minutes
      'M15': 15 * 60 * 1000,   // 15 minutes
      'M30': 30 * 60 * 1000,   // 30 minutes
      'H1': 60 * 60 * 1000,    // 1 hour
      'H4': 4 * 60 * 60 * 1000,// 4 hours
      'D1': 24 * 60 * 60 * 1000// 1 day
    };
    
    return intervals[timeframe] || 60 * 1000; // Default 1 minute
  }

  /**
   * Get all loaded strategies
   */
  getStrategies(): Strategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Get strategy by ID
   */
  getStrategy(id: string): Strategy | undefined {
    return this.strategies.get(id);
  }

  /**
   * Get strategy state
   */
  getStrategyState(id: string): StrategyState | undefined {
    return this.strategyStates.get(id);
  }

  /**
   * Cleanup
   */
  async shutdown(): Promise<void> {
    logger.info('[StrategyService] Shutting down...');
    
    // Stop all strategies
    for (const strategyId of this.strategies.keys()) {
      await this.stopStrategy(strategyId);
    }
    
    // Clear all
    this.strategies.clear();
    this.strategyStates.clear();
    this.evaluationIntervals.clear();
    
    logger.info('[StrategyService] Shutdown complete');
  }
}
