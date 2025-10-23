/**
 * SIGNAL GENERATOR SERVICE
 * Core brain component for generating trading signals
 * DO NOT DELETE - CRITICAL ARCHITECTURE COMPONENT
 */

import { prisma } from '../prisma';
import { DynamicRiskParams, SessionFilter, MTFStrategy, SmartExitRules, CorrelationFilter, EnhancedPartialExitConfig, MarketRegime, RegimeDetectionConfig } from '../../types';
import {
  isTradingAllowed,
  getSessionMultiplier,
  getCurrentSession
} from '../market/sessions';
import { SmartExitCalculator } from '../trading/smart-exits';
import { createPartialExitManager, EnhancedPartialExitManager } from '../trading/partial-exits';
import {
  analyzeCorrelationForSignal,
  calculateCorrelationMatrix,
  getRecommendedPairs,
  validateCorrelationFilter
} from '../market/correlation';

export interface TradingSignal {
  id: string;
  strategyId: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'CLOSE' | 'MODIFY';
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
  timestamp: Date;
  confidence: number;
  metadata?: {
    reason?: string;
    indicators?: Record<string, any>;
    riskScore?: number;
    correlationAdjustment?: {
      originalVolume: number;
      adjustedVolume: number;
      reason?: string;
      confidence: number;
    };
    enhancedPartialExits?: {
      enabled: boolean;
      levels: Array<{
        id: string;
        name: string;
        percentage: number;
        triggerType: string;
        triggerValue: number;
        priority: number;
        description?: string;
      }>;
      strategy: string;
      recommendations?: string[];
    };
    regimeDetection?: {
      currentRegime: any;
      confidence: number;
      adaptation: any;
      timestamp: Date;
    };
  };
}

export interface SignalGeneratorConfig {
  strategyId: string;
  symbol: string;
  timeframe: string;
  rules: any;
  dynamicRisk?: DynamicRiskParams;
  sessionFilter?: SessionFilter;
  correlationFilter?: CorrelationFilter;
  isMTF?: boolean;
  mtfStrategy?: MTFStrategy;
  enhancedPartialExits?: EnhancedPartialExitConfig;
  regimeDetection?: RegimeDetectionConfig;
}

export class SignalGenerator {
  private config: SignalGeneratorConfig;
  private mtfAnalyzer?: any; // Will be imported when needed
  private partialExitManager?: EnhancedPartialExitManager;
  private regimeDetector?: any; // Will be imported when needed
  private regimeAdapter?: any; // Will be imported when needed

  constructor(config: SignalGeneratorConfig) {
    this.config = config;
    
    // Initialize enhanced partial exit manager if configured
    if (config.enhancedPartialExits?.enabled) {
      this.partialExitManager = createPartialExitManager(config.enhancedPartialExits);
    }
    
    // Initialize regime detection if configured
    if (config.regimeDetection) {
      this.initializeRegimeDetection();
    }
  }

  /**
   * Generate trading signal based on strategy rules and market data
   */
  async generateSignal(marketData: any): Promise<TradingSignal | null> {
    try {
      const { rules, sessionFilter, correlationFilter, isMTF, mtfStrategy, regimeDetection } = this.config;
      
      // Check if trading is allowed based on session filter
      if (sessionFilter?.enabled) {
        if (!isTradingAllowed(this.config.symbol, sessionFilter)) {
          console.log(`Signal generation skipped: ${this.config.symbol} not allowed in current session`);
          return null;
        }
      }
      
      // Check correlation filter before generating signal
      if (correlationFilter?.enabled) {
        const correlationResult = await this.checkCorrelationFilter(correlationFilter);
        if (correlationResult.shouldSkip) {
          console.log(`Signal generation skipped: ${this.config.symbol} failed correlation filter - ${correlationResult.reason}`);
          return null;
        }
      }
      
      // Detect current market regime if enabled
      let currentRegime: MarketRegime | null = null;
      let regimeConfidence = 0;
      let regimeAdaptation = null;
      
      if (regimeDetection) {
        const regimeResult = await this.detectMarketRegime(marketData);
        currentRegime = regimeResult.regime;
        regimeConfidence = regimeResult.confidence;
        
        // Get regime-based strategy adjustments
        if (this.regimeAdapter && currentRegime) {
          regimeAdaptation = await this.regimeAdapter.adjustStrategy(currentRegime);
        }
        
        // Skip signal if regime confidence is too low
        if (regimeConfidence < (regimeDetection.minConfidence || 70)) {
          console.log(`Signal generation skipped: ${this.config.symbol} regime confidence too low (${regimeConfidence}%)`);
          return null;
        }
      }
      
      let signal;
      
      if (isMTF && mtfStrategy) {
        signal = await this.analyzeMTFMarket(marketData, mtfStrategy);
      } else {
        signal = await this.analyzeMarket(marketData, rules);
      }

      if (!signal) return null;

      // Apply regime-based adjustments if available
      if (regimeAdaptation && signal.volume) {
        signal.volume = signal.volume * regimeAdaptation.positionSize;
        
        // Adjust entry confidence based on regime
        signal.confidence = signal.confidence * (regimeConfidence / 100);
        
        // Add regime information to metadata
        signal.metadata = {
          ...signal.metadata,
          regimeDetection: {
            currentRegime,
            confidence: regimeConfidence,
            adaptation: regimeAdaptation,
            timestamp: new Date()
          }
        };
        
        console.log(`Signal adjusted for ${currentRegime} regime: position size ${regimeAdaptation.positionSize}x, entry threshold ${regimeAdaptation.entryThreshold}`);
      }

      // Apply correlation-based position size adjustment if needed
      if (correlationFilter?.enabled && signal.volume) {
        const correlationResult = await this.checkCorrelationFilter(correlationFilter);
        if (correlationResult.adjustedPositionSize) {
          const originalVolume = signal.volume;
          signal.volume = signal.volume * correlationResult.adjustedPositionSize;
          signal.metadata = {
            ...signal.metadata,
            correlationAdjustment: {
              originalVolume,
              adjustedVolume: signal.volume,
              reason: correlationResult.reason,
              confidence: correlationResult.confidence
            }
          };
        }
      }

      // Save signal to database
      await prisma.activityLog.create({
        data: {
          userId: rules.userId,
          eventType: 'SIGNAL_GENERATED',
          metadata: signal as any,
        },
      });

      return signal;
    } catch (error) {
      console.error('Signal generation error:', error);
      return null;
    }
  }

  /**
   * Analyze market conditions and generate signal
   */
  private async analyzeMarket(marketData: any, rules: any): Promise<TradingSignal | null> {
    // Extract indicators from rules
    const { indicators, entry, exit, risk, dynamicRisk, sessionFilter, smartExit } = rules;
    
    // Calculate technical indicators
    const calculatedIndicators = this.calculateIndicators(marketData, indicators);
    
    // Check entry conditions with regime-aware adjustments
    const entrySignal = this.checkEntryConditions(calculatedIndicators, entry);
    
    if (!entrySignal) {
      // Check exit conditions for open positions
      const exitSignal = this.checkExitConditions(calculatedIndicators, exit);
      if (exitSignal) {
        return this.createSignal('CLOSE', 0, exitSignal.confidence);
      }
      return null;
    }

    // Calculate position size based on risk management
    let volume: number;
    let stopLoss: number;
    let takeProfit: number;
    
    // Get session multiplier for position sizing adjustment
    const sessionMultiplier = getSessionMultiplier(this.config.symbol, sessionFilter);
    
    // Use Smart Exit Rules if available
    if (smartExit) {
      // Prepare smart exit calculation parameters
      const smartExitParams = {
        entryPrice: marketData.close,
        tradeType: entrySignal.action,
        atr: calculatedIndicators.atr,
        swingPoints: calculatedIndicators.swingPoints,
        currentPrice: marketData.close,
        timestamp: new Date()
      };

      try {
        // Calculate smart exits
        const smartExitResult = SmartExitCalculator.calculateExits(smartExitParams, smartExit);
        
        stopLoss = smartExitResult.stopLoss.price;
        takeProfit = smartExitResult.takeProfit.price;
        
        // Calculate position size based on smart stop loss distance
        if (dynamicRisk?.useATRSizing && calculatedIndicators.atr) {
          volume = this.calculateATRPositionSize(
            risk,
            marketData,
            calculatedIndicators.atr,
            dynamicRisk
          );
        } else {
          volume = this.calculatePositionSize(risk, marketData);
        }
        
        // Apply session multiplier to position size
        volume = volume * sessionMultiplier;
        
        return this.createSignal(
          entrySignal.action,
          volume,
          Math.min(entrySignal.confidence, smartExitResult.confidence), // Use lower of entry and exit confidence
          stopLoss,
          takeProfit,
          {
            reason: `${entrySignal.reason} | Smart Exit: ${smartExitResult.stopLoss.reason}, ${smartExitResult.takeProfit.reason}`,
            indicators: calculatedIndicators,
            riskScore: this.calculateRiskScore(marketData, risk),
            atrUsed: calculatedIndicators.atr,
            sessionMultiplier,
            currentSessions: getCurrentSession(),
            sessionFilter: sessionFilter?.enabled ? sessionFilter : undefined,
            smartExit: {
              enabled: true,
              stopLossType: smartExitResult.stopLoss.type,
              takeProfitType: smartExitResult.takeProfit.type,
              riskRewardRatio: smartExitResult.riskRewardRatio,
              confidence: smartExitResult.confidence,
              partialExits: smartExitResult.partialExits
            }
          }
        );
      } catch (error) {
        console.error('Smart exit calculation failed, falling back to traditional exits:', error);
        // Fall back to traditional calculations
      }
    }
    
    // Traditional calculations (fallback or when smart exits not enabled)
    if (dynamicRisk?.useATRSizing && calculatedIndicators.atr) {
      volume = this.calculateATRPositionSize(
        risk,
        marketData,
        calculatedIndicators.atr,
        dynamicRisk
      );
      
      // Apply session multiplier to position size
      volume = volume * sessionMultiplier;
      
      // Calculate ATR-based stop loss
      stopLoss = this.calculateATRStopLoss(
        entrySignal.action,
        marketData.close,
        calculatedIndicators.atr,
        dynamicRisk.atrMultiplier
      );
      
      // Calculate take profit (risk:reward ratio of 1:2 by default)
      const riskDistance = Math.abs(marketData.close - stopLoss);
      takeProfit = entrySignal.action === 'BUY'
        ? marketData.close + (riskDistance * 2)
        : marketData.close - (riskDistance * 2);
    } else {
      // Traditional calculations
      volume = this.calculatePositionSize(risk, marketData);
      
      // Apply session multiplier to position size
      volume = volume * sessionMultiplier;
      
      // Calculate SL/TP levels
      const riskLevels = this.calculateRiskLevels(
        entrySignal.action,
        marketData.close,
        risk
      );
      stopLoss = riskLevels.stopLoss;
      takeProfit = riskLevels.takeProfit;
    }

    return this.createSignal(
      entrySignal.action,
      volume,
      entrySignal.confidence,
      stopLoss,
      takeProfit,
      {
        reason: entrySignal.reason,
        indicators: calculatedIndicators,
        riskScore: this.calculateRiskScore(marketData, risk),
        atrUsed: dynamicRisk?.useATRSizing ? calculatedIndicators.atr : undefined,
        sessionMultiplier,
        currentSessions: getCurrentSession(),
        sessionFilter: sessionFilter?.enabled ? sessionFilter : undefined,
      }
    );
  }

  /**
   * Analyze market conditions for MTF strategies
   */
  private async analyzeMTFMarket(marketData: any, mtfStrategy: MTFStrategy): Promise<TradingSignal | null> {
    try {
      // Import MTF analyzer dynamically to avoid circular dependencies
      const { createMTFAnalyzer } = await import('../analysis/multi-timeframe');
      
      // Prepare market data for all timeframes
      const multiTimeframeData: Record<string, any[]> = {
        [mtfStrategy.primaryTimeframe]: marketData[mtfStrategy.primaryTimeframe] || marketData,
        ...mtfStrategy.confirmationTimeframes.reduce((acc, tf) => {
          acc[tf] = marketData[tf] || marketData; // Fallback to primary data if specific TF not available
          return acc;
        }, {} as Record<string, any[]>)
      };

      // Create MTF analyzer
      const mtfAnalyzer = createMTFAnalyzer({
        strategy: mtfStrategy,
        marketData: multiTimeframeData,
        currentTime: new Date()
      });

      // Perform MTF analysis
      const analysisResult = await mtfAnalyzer.analyze();

      if (!analysisResult.overallSignal) {
        return null;
      }

      // Get primary timeframe data for position sizing
      const primaryData = multiTimeframeData[mtfStrategy.primaryTimeframe];
      const latestCandle = primaryData[primaryData.length - 1];

      // Calculate position size and risk levels
      const { riskManagement, dynamicRisk } = mtfStrategy.rules;
      const smartExit = (mtfStrategy.rules as any).smartExit as SmartExitRules | undefined;
      let volume: number;
      let stopLoss: number;
      let takeProfit: number;

      // Get session multiplier for position sizing adjustment
      const sessionMultiplier = getSessionMultiplier(this.config.symbol, this.config.sessionFilter);

      // Determine action based on primary conditions
      const action = this.determineActionFromConditions(mtfStrategy.rules.entry.primary, latestCandle);

      // Get indicators from primary timeframe
      const primaryIndicators = mtfAnalyzer.getLatestData().find(d => d.timeframe === mtfStrategy.primaryTimeframe)?.indicators || {};
      const atr = primaryIndicators.ATR || 0.002;

      // Use Smart Exit Rules if available
      if (smartExit) {
        // Prepare smart exit calculation parameters
        const smartExitParams = {
          entryPrice: latestCandle.close,
          tradeType: action,
          atr: atr,
          swingPoints: (primaryIndicators.swingPoints as unknown as any[]) || [],
          currentPrice: latestCandle.close,
          timestamp: new Date()
        };

        try {
          // Calculate smart exits
          const smartExitResult = SmartExitCalculator.calculateExits(smartExitParams, smartExit);
          
          stopLoss = smartExitResult.stopLoss.price;
          takeProfit = smartExitResult.takeProfit.price;
          
          // Calculate position size
          if (dynamicRisk?.useATRSizing) {
            volume = this.calculateATRPositionSize(
              riskManagement,
              latestCandle,
              atr,
              dynamicRisk
            );
          } else {
            volume = this.calculatePositionSize(riskManagement, latestCandle);
          }
          
          // Apply session multiplier to position size
          volume = volume * sessionMultiplier;
          
          return this.createSignal(
            action,
            volume,
            Math.min(analysisResult.confidence, smartExitResult.confidence),
            stopLoss,
            takeProfit,
            {
              reason: `MTF Signal: Primary=${analysisResult.primarySignal}, Confirmations=${analysisResult.confirmations.filter(c => c.met).length}/${analysisResult.confirmations.length} | Smart Exit: ${smartExitResult.stopLoss.reason}, ${smartExitResult.takeProfit.reason}`,
              indicators: mtfAnalyzer.getLatestData().reduce((acc, d) => {
                acc[d.timeframe] = d.indicators;
                return acc;
              }, {} as Record<string, any>),
              riskScore: this.calculateRiskScore(latestCandle, riskManagement),
              mtfAnalysis: analysisResult,
              sessionMultiplier,
              currentSessions: getCurrentSession(),
              sessionFilter: this.config.sessionFilter?.enabled ? this.config.sessionFilter : undefined,
              smartExit: {
                enabled: true,
                stopLossType: smartExitResult.stopLoss.type,
                takeProfitType: smartExitResult.takeProfit.type,
                riskRewardRatio: smartExitResult.riskRewardRatio,
                confidence: smartExitResult.confidence,
                partialExits: smartExitResult.partialExits
              }
            }
          );
        } catch (error) {
          console.error('Smart exit calculation failed for MTF, falling back to traditional exits:', error);
          // Fall back to traditional calculations
        }
      }

      // Traditional calculations (fallback or when smart exits not enabled)
      if (dynamicRisk?.useATRSizing) {
        volume = this.calculateATRPositionSize(
          riskManagement,
          latestCandle,
          atr,
          dynamicRisk
        );
        
        // Apply session multiplier to position size
        volume = volume * sessionMultiplier;
        
        // Calculate ATR-based stop loss
        stopLoss = this.calculateATRStopLoss(
          action,
          latestCandle.close,
          atr,
          dynamicRisk.atrMultiplier
        );
        
        // Calculate take profit (risk:reward ratio of 1:2 by default)
        const riskDistance = Math.abs(latestCandle.close - stopLoss);
        takeProfit = action === 'BUY'
          ? latestCandle.close + (riskDistance * 2)
          : latestCandle.close - (riskDistance * 2);
      } else {
        // Traditional calculations
        volume = this.calculatePositionSize(riskManagement, latestCandle);
        
        // Apply session multiplier to position size
        volume = volume * sessionMultiplier;
        
        // Calculate SL/TP levels
        const riskLevels = this.calculateRiskLevels(
          action,
          latestCandle.close,
          riskManagement
        );
        stopLoss = riskLevels.stopLoss;
        takeProfit = riskLevels.takeProfit;
      }

      return this.createSignal(
        action,
        volume,
        analysisResult.confidence,
        stopLoss,
        takeProfit,
        {
          reason: `MTF Signal: Primary=${analysisResult.primarySignal}, Confirmations=${analysisResult.confirmations.filter(c => c.met).length}/${analysisResult.confirmations.length}`,
          indicators: mtfAnalyzer.getLatestData().reduce((acc, d) => {
            acc[d.timeframe] = d.indicators;
            return acc;
          }, {} as Record<string, any>),
          riskScore: this.calculateRiskScore(latestCandle, riskManagement),
          mtfAnalysis: analysisResult,
          sessionMultiplier,
          currentSessions: getCurrentSession(),
          sessionFilter: this.config.sessionFilter?.enabled ? this.config.sessionFilter : undefined,
        }
      );

    } catch (error) {
      console.error('MTF Market analysis error:', error);
      return null;
    }
  }

  /**
   * Determine trading action from primary conditions
   */
  private determineActionFromConditions(primaryConditions: any[], marketData: any): 'BUY' | 'SELL' {
    // Simplified logic - in production would analyze conditions more thoroughly
    const rsi = this.calculateRSI([marketData], 14);
    return rsi < 30 ? 'BUY' : 'SELL';
  }

  /**
   * Calculate technical indicators
   */
  private calculateIndicators(marketData: any, indicatorRules: any): Record<string, any> {
    const indicators: Record<string, any> = {};
    
    // Example: Moving Average
    if (indicatorRules?.movingAverage) {
      const { period, type } = indicatorRules.movingAverage;
      indicators.ma = this.calculateMA(marketData, period, type);
    }

    // Example: RSI
    if (indicatorRules?.rsi) {
      const { period } = indicatorRules.rsi;
      indicators.rsi = this.calculateRSI(marketData, period);
    }

    // Example: MACD
    if (indicatorRules?.macd) {
      indicators.macd = this.calculateMACD(marketData);
    }

    // New indicators from Phase 1.1
    if (indicatorRules?.atr) {
      const { period } = indicatorRules.atr;
      indicators.atr = this.calculateATR(marketData, period);
    }

    if (indicatorRules?.ichimoku) {
      indicators.ichimoku = this.calculateIchimoku(marketData);
    }

    if (indicatorRules?.vwap) {
      indicators.vwap = this.calculateVWAP(marketData);
    }

    if (indicatorRules?.cci) {
      const { period } = indicatorRules.cci;
      indicators.cci = this.calculateCCI(marketData, period);
    }

    if (indicatorRules?.williamsR) {
      const { period } = indicatorRules.williamsR;
      indicators.williamsR = this.calculateWilliamsR(marketData, period);
    }

    if (indicatorRules?.obv) {
      indicators.obv = this.calculateOBV(marketData);
    }

    if (indicatorRules?.volumeMA) {
      const { period } = indicatorRules.volumeMA;
      indicators.volumeMA = this.calculateVolumeMA(marketData, period);
    }

    return indicators;
  }

  /**
   * Check entry conditions
   */
  private checkEntryConditions(indicators: any, entryRules: any): any {
    if (!entryRules) return null;

    const conditions = entryRules.conditions || [];
    let score = 0;
    let totalWeight = 0;
    let action: 'BUY' | 'SELL' | null = null;
    const reasons: string[] = [];

    for (const condition of conditions) {
      const { indicator, operator, value, weight = 1 } = condition;
      const indicatorValue = indicators[indicator];

      if (this.evaluateCondition(indicatorValue, operator, value)) {
        score += weight;
        reasons.push(`${indicator} ${operator} ${value}`);
        
        // Determine action based on condition
        if (condition.action) {
          action = condition.action;
        }
      }
      totalWeight += weight;
    }

    const confidence = totalWeight > 0 ? score / totalWeight : 0;
    
    if (confidence >= (entryRules.minConfidence || 0.7) && action) {
      return {
        action,
        confidence,
        reason: reasons.join(', '),
      };
    }

    return null;
  }

  /**
   * Check exit conditions
   */
  private checkExitConditions(indicators: any, exitRules: any): any {
    if (!exitRules) return null;

    // Similar logic to entry conditions
    // but focused on closing positions
    return null;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(value: any, operator: string, threshold: any): boolean {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '==': return value === threshold;
      case '!=': return value !== threshold;
      case 'CROSSES_ABOVE':
        // Implement cross detection logic
        return false;
      case 'CROSSES_BELOW':
        // Implement cross detection logic
        return false;
      default:
        return false;
    }
  }

  /**
   * Calculate position size based on risk management
   */
  private calculatePositionSize(riskRules: any, marketData: any): number {
    const { maxRiskPerTrade = 0.02, accountBalance = 10000 } = riskRules;
    const riskAmount = accountBalance * maxRiskPerTrade;
    
    // Standard lot size calculation
    const pipValue = 10; // USD per pip for standard lot
    const stopLossPips = 50; // Example SL in pips
    const maxLots = riskAmount / (stopLossPips * pipValue);
    
    // Apply minimum and maximum constraints
    const minLot = riskRules.minLotSize || 0.01;
    const maxLot = riskRules.maxLotSize || 1.0;
    
    return Math.max(minLot, Math.min(maxLot, Math.round(maxLots * 100) / 100));
  }

  /**
   * Calculate ATR-based position size
   */
  private calculateATRPositionSize(
    riskRules: any,
    marketData: any,
    atr: number,
    dynamicRisk: DynamicRiskParams
  ): number {
    const { accountBalance = 10000 } = riskRules;
    const riskAmount = accountBalance * (dynamicRisk.riskPercentage / 100);
    
    // Calculate stop loss distance using ATR
    const stopLossDistance = atr * dynamicRisk.atrMultiplier;
    
    // Calculate position size based on ATR
    const contractSize = 100000; // Standard contract size
    const maxLots = riskAmount / (stopLossDistance * contractSize);
    
    // Apply volatility adjustment if enabled
    let adjustedLots = maxLots;
    if (dynamicRisk.reduceInHighVolatility && atr > dynamicRisk.volatilityThreshold) {
      adjustedLots = maxLots * 0.75; // Reduce by 25% in high volatility
    }
    
    // Apply minimum and maximum constraints
    const minLot = riskRules.minLotSize || 0.01;
    const maxLot = riskRules.maxLotSize || 1.0;
    
    return Math.max(minLot, Math.min(maxLot, Math.round(adjustedLots * 100) / 100));
  }

  /**
   * Calculate ATR-based stop loss
   */
  private calculateATRStopLoss(
    action: 'BUY' | 'SELL',
    currentPrice: number,
    atr: number,
    atrMultiplier: number
  ): number {
    const stopLossDistance = atr * atrMultiplier;
    
    if (action === 'BUY') {
      return currentPrice - stopLossDistance;
    } else {
      return currentPrice + stopLossDistance;
    }
  }

  /**
   * Calculate stop loss and take profit levels
   */
  private calculateRiskLevels(
    action: 'BUY' | 'SELL',
    currentPrice: number,
    riskRules: any
  ): { stopLoss: number; takeProfit: number } {
    const { stopLossPips = 50, takeProfitPips = 100 } = riskRules;
    const pipSize = 0.0001; // For forex pairs

    if (action === 'BUY') {
      return {
        stopLoss: currentPrice - (stopLossPips * pipSize),
        takeProfit: currentPrice + (takeProfitPips * pipSize),
      };
    } else {
      return {
        stopLoss: currentPrice + (stopLossPips * pipSize),
        takeProfit: currentPrice - (takeProfitPips * pipSize),
      };
    }
  }

  /**
   * Calculate risk score for the trade
   */
  private calculateRiskScore(marketData: any, riskRules: any): number {
    // Implement risk scoring logic
    // Consider: volatility, market conditions, time of day, etc.
    return 0.5; // Medium risk
  }

  /**
   * Create signal object
   */
  private createSignal(
    action: 'BUY' | 'SELL' | 'CLOSE' | 'MODIFY',
    volume: number,
    confidence: number,
    stopLoss?: number,
    takeProfit?: number,
    metadata?: any
  ): TradingSignal {
    // Include enhanced partial exit information if available
    const enhancedPartialExitData = this.partialExitManager ? {
      enabled: true,
      levels: this.config.enhancedPartialExits?.levels || [],
      strategy: this.config.enhancedPartialExits?.strategy || 'sequential',
      recommendations: this.generatePartialExitRecommendations(action, volume, stopLoss, takeProfit)
    } : undefined;

    return {
      id: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      strategyId: this.config.strategyId,
      symbol: this.config.symbol,
      action,
      volume,
      stopLoss,
      takeProfit,
      timestamp: new Date(),
      confidence,
      metadata: {
        ...metadata,
        enhancedPartialExits: enhancedPartialExitData
      },
    };
  }

  /**
   * Generate partial exit recommendations for the signal
   */
  private generatePartialExitRecommendations(
    action: 'BUY' | 'SELL' | 'CLOSE' | 'MODIFY',
    volume: number,
    stopLoss?: number,
    takeProfit?: number
  ): string[] {
    if (!this.config.enhancedPartialExits?.enabled) {
      return [];
    }

    const recommendations: string[] = [];
    const levels = this.config.enhancedPartialExits.levels;

    // Generate recommendations based on configured levels
    if (levels.length > 0) {
      recommendations.push(`Monitor ${levels.length} partial exit levels for optimal position management`);
      
      // Add specific recommendations based on trigger types
      const profitLevels = levels.filter(l => l.triggerType === 'profit');
      if (profitLevels.length > 0) {
        recommendations.push(`Profit-based exits configured at ${profitLevels.map(l => l.percentage).join('%, ')} of position`);
      }

      const timeLevels = levels.filter(l => l.triggerType === 'time');
      if (timeLevels.length > 0) {
        recommendations.push(`Time-based exits configured for risk management`);
      }

      const atrLevels = levels.filter(l => l.triggerType === 'atr');
      if (atrLevels.length > 0) {
        recommendations.push(`ATR-based exits will adapt to market volatility`);
      }

      const trailingLevels = levels.filter(l => l.triggerType === 'trailing');
      if (trailingLevels.length > 0) {
        recommendations.push(`Trailing exits will protect profits as trade develops`);
      }
    }

    // Add risk management recommendations
    if (stopLoss && takeProfit) {
      const riskRewardRatio = Math.abs(takeProfit - (action === 'BUY' ? 1.1 : 0.9)) / Math.abs(stopLoss - (action === 'BUY' ? 1.1 : 0.9));
      if (riskRewardRatio < 1.5) {
        recommendations.push('Consider improving risk-reward ratio for better performance');
      }
    }

    return recommendations;
  }

  // Simplified indicator calculations
  private calculateMA(data: any, period: number, type: 'SMA' | 'EMA'): number {
    // Implement MA calculation
    return 0;
  }

  private calculateRSI(data: any, period: number): number {
    // Implement RSI calculation
    return 50;
  }

  private calculateMACD(data: any): { macd: number; signal: number; histogram: number } {
    // Implement MACD calculation
    return { macd: 0, signal: 0, histogram: 0 };
  }

  // New indicator calculations for Phase 1.1

  /**
   * Calculate Average True Range (ATR)
   * Measures volatility and is useful for stop loss placement
   */
  private calculateATR(data: any, period: number = 14): number {
    // Simplified ATR calculation
    // In production, this would use the true range formula
    const recentCandles = data.slice(-period);
    if (recentCandles.length < 2) return 0.002; // Default 20 pips

    let totalTR = 0;
    for (let i = 1; i < recentCandles.length; i++) {
      const high = recentCandles[i].high || recentCandles[i].close * 1.001;
      const low = recentCandles[i].low || recentCandles[i].close * 0.999;
      const prevClose = recentCandles[i - 1].close;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      totalTR += tr;
    }
    
    return totalTR / (recentCandles.length - 1);
  }

  /**
   * Calculate Ichimoku Cloud components
   * Comprehensive trend analysis system
   */
  private calculateIchimoku(data: any): any {
    const periods = { tenkan: 9, kijun: 26, senkouB: 52 };
    
    // Simplified Ichimoku calculation
    const recentData = data.slice(-periods.senkouB);
    if (recentData.length < periods.senkouB) {
      return {
        tenkanSen: 0,
        kijunSen: 0,
        senkouSpanA: 0,
        senkouSpanB: 0,
        chikouSpan: 0
      };
    }

    // Tenkan-sen (Conversion Line): (9-period high + 9-period low) / 2
    const tenkanHigh = Math.max(...recentData.slice(-periods.tenkan).map((d: any) => d.high || d.close));
    const tenkanLow = Math.min(...recentData.slice(-periods.tenkan).map((d: any) => d.low || d.close));
    const tenkanSen = (tenkanHigh + tenkanLow) / 2;

    // Kijun-sen (Base Line): (26-period high + 26-period low) / 2
    const kijunHigh = Math.max(...recentData.slice(-periods.kijun).map((d: any) => d.high || d.close));
    const kijunLow = Math.min(...recentData.slice(-periods.kijun).map((d: any) => d.low || d.close));
    const kijunSen = (kijunHigh + kijunLow) / 2;

    // Senkou Span A: (Tenkan-sen + Kijun-sen) / 2, displaced 26 periods forward
    const senkouSpanA = (tenkanSen + kijunSen) / 2;

    // Senkou Span B: (52-period high + 52-period low) / 2, displaced 26 periods forward
    const senkouBHigh = Math.max(...recentData.map((d: any) => d.high || d.close));
    const senkouBLow = Math.min(...recentData.map((d: any) => d.low || d.close));
    const senkouSpanB = (senkouBHigh + senkouBLow) / 2;

    // Chikou Span: Current close, displaced 26 periods backward
    const chikouSpan = recentData[recentData.length - 1].close;

    return {
      tenkanSen,
      kijunSen,
      senkouSpanA,
      senkouSpanB,
      chikouSpan
    };
  }

  /**
   * Calculate Volume Weighted Average Price (VWAP)
   * Important institutional level indicator
   */
  private calculateVWAP(data: any): number {
    const typicalPrices = data.map((d: any) => (d.high + d.low + d.close) / 3);
    const volumes = data.map((d: any) => d.volume || 1000); // Default volume if not provided
    
    let totalPV = 0;
    let totalVolume = 0;
    
    for (let i = 0; i < typicalPrices.length; i++) {
      totalPV += typicalPrices[i] * volumes[i];
      totalVolume += volumes[i];
    }
    
    return totalVolume > 0 ? totalPV / totalVolume : data[data.length - 1]?.close || 0;
  }

  /**
   * Calculate Commodity Channel Index (CCI)
   * Identifies overbought/oversold conditions
   */
  private calculateCCI(data: any, period: number = 14): number {
    if (data.length < period) return 0;

    const typicalPrices = data.slice(-period).map((d: any) => (d.high + d.low + d.close) / 3);
    const sma = typicalPrices.reduce((sum: number, price: number) => sum + price, 0) / period;
    
    // Calculate mean deviation
    let meanDeviation = 0;
    for (const price of typicalPrices) {
      meanDeviation += Math.abs(price - sma);
    }
    meanDeviation /= period;

    // CCI formula: (Typical Price - SMA) / (0.015 * Mean Deviation)
    const currentTP = typicalPrices[typicalPrices.length - 1];
    return meanDeviation > 0 ? (currentTP - sma) / (0.015 * meanDeviation) : 0;
  }

  /**
   * Calculate Williams %R
   * Momentum reversal indicator
   */
  private calculateWilliamsR(data: any, period: number = 14): number {
    if (data.length < period) return -50;

    const recentData = data.slice(-period);
    const highestHigh = Math.max(...recentData.map((d: any) => d.high || d.close));
    const lowestLow = Math.min(...recentData.map((d: any) => d.low || d.close));
    const currentClose = recentData[recentData.length - 1].close;

    // Williams %R formula: (Highest High - Current Close) / (Highest High - Lowest Low) * -100
    const denominator = highestHigh - lowestLow;
    return denominator > 0 ? ((highestHigh - currentClose) / denominator) * -100 : -50;
  }

  /**
   * Calculate On Balance Volume (OBV)
   * Volume confirmation indicator
   */
  private calculateOBV(data: any): number {
    if (data.length < 2) return 0;

    let obv = 0;
    for (let i = 1; i < data.length; i++) {
      const volume = data[i].volume || 1000;
      
      if (data[i].close > data[i - 1].close) {
        obv += volume;
      } else if (data[i].close < data[i - 1].close) {
        obv -= volume;
      }
      // If equal, OBV remains unchanged
    }
    
    return obv;
  }

  /**
   * Calculate Volume Moving Average
   * Shows volume trends over time
   */
  private calculateVolumeMA(data: any, period: number = 20): number {
    if (data.length < period) return 0;

    const recentVolumes = data.slice(-period).map((d: any) => d.volume || 1000);
    return recentVolumes.reduce((sum: number, volume: number) => sum + volume, 0) / period;
  }

  /**
   * Check correlation filter for the current symbol
   */
  private async checkCorrelationFilter(correlationFilter: CorrelationFilter): Promise<any> {
    try {
      // Validate correlation filter configuration
      const validationErrors = validateCorrelationFilter(correlationFilter);
      if (validationErrors.length > 0) {
        console.warn('Correlation filter validation errors:', validationErrors);
        return {
          shouldSkip: false,
          reason: 'Invalid correlation filter configuration',
          confidence: 0
        };
      }

      // Get current open positions for the user
      const currentPositions = await this.getCurrentPositions();
      
      // If no positions, no correlation conflict
      if (currentPositions.length === 0) {
        return {
          shouldSkip: false,
          conflictingPositions: [],
          recommendedAction: 'proceed',
          confidence: 100
        };
      }

      // Get or calculate correlation matrix
      const correlationMatrix = await this.getCorrelationMatrix(correlationFilter);
      
      // Analyze correlation for current signal
      const analysisResult = analyzeCorrelationForSignal(
        this.config.symbol,
        currentPositions,
        correlationMatrix,
        correlationFilter
      );

      return analysisResult;
    } catch (error) {
      console.error('Error checking correlation filter:', error);
      return {
        shouldSkip: false,
        reason: 'Correlation analysis failed',
        confidence: 50
      };
    }
  }

  /**
   * Get current open positions for correlation analysis
   */
  private async getCurrentPositions(): Promise<Array<{ symbol: string; size: number }>> {
    try {
      // This would typically query your positions database
      // For now, return empty array as placeholder
      // In production, you would implement actual position retrieval
      
      // Example implementation:
      // const positions = await prisma.position.findMany({
      //   where: {
      //     userId: this.config.rules.userId,
      //     status: 'OPEN'
      //   },
      //   select: { symbol: true, size: true }
      // });
      
      return [];
    } catch (error) {
      console.error('Error fetching current positions:', error);
      return [];
    }
  }

  /**
   * Get or calculate correlation matrix
   */
  private async getCorrelationMatrix(correlationFilter: CorrelationFilter): Promise<any> {
    try {
      // In production, you would fetch this from cache or database
      // For now, calculate it on-demand
      
      // Get all pairs to analyze (current symbol + checked pairs)
      const pairsToAnalyze = [
        this.config.symbol,
        ...correlationFilter.checkPairs,
        ...getRecommendedPairs(this.config.symbol, correlationFilter.checkPairs)
      ].slice(0, 20); // Limit to 20 pairs for performance

      // Fetch price data for all pairs
      const priceData: Record<string, any[]> = {};
      
      for (const pair of pairsToAnalyze) {
        // In production, fetch from your data provider
        // For now, use mock data
        priceData[pair] = this.generateMockPriceData(pair, correlationFilter.lookbackPeriod);
      }

      // Calculate correlation matrix
      const correlationMatrix = await calculateCorrelationMatrix(
        pairsToAnalyze,
        priceData,
        correlationFilter.timeframes[0] || 'H1',
        correlationFilter.lookbackPeriod,
        correlationFilter.minDataPoints
      );

      return correlationMatrix;
    } catch (error) {
      console.error('Error calculating correlation matrix:', error);
      throw error;
    }
  }

  /**
   * Generate mock price data for testing
   * In production, replace with actual data fetching
   */
  private generateMockPriceData(symbol: string, periods: number): any[] {
    const data: any[] = [];
    const basePrice = this.getBasePriceForSymbol(symbol);
    let currentPrice = basePrice;
    
    const now = new Date();
    for (let i = periods; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000)); // Hourly data
      const change = (Math.random() - 0.5) * 0.002; // Random change
      currentPrice = currentPrice * (1 + change);
      
      const volatility = 0.0005 + Math.random() * 0.001;
      data.push({
        timestamp,
        open: currentPrice,
        high: currentPrice + volatility,
        low: currentPrice - volatility,
        close: currentPrice + (Math.random() - 0.5) * volatility,
        volume: 1000 + Math.random() * 5000
      });
    }
    
    return data;
  }

  /**
   * Get base price for a symbol
   */
  private getBasePriceForSymbol(symbol: string): number {
    // Simple base price mapping for common pairs
    const basePrices: Record<string, number> = {
      'EURUSD': 1.1000,
      'GBPUSD': 1.3000,
      'USDJPY': 110.00,
      'USDCHF': 0.9000,
      'AUDUSD': 0.7000,
      'USDCAD': 1.2500,
      'NZDUSD': 0.6500,
      'EURJPY': 120.00,
      'GBPJPY': 140.00,
      'EURGBP': 0.8500,
      'AUDJPY': 80.00,
      'EURAUD': 1.6000,
      'EURCHF': 1.0500,
      'AUDNZD': 1.1000,
      'NZDJPY': 75.00,
      'GBPAUD': 1.8000,
      'GBPCAD': 1.7000,
      'GBPNZD': 2.0000,
      'AUDCAD': 0.9000
    };
    
    return basePrices[symbol] || 1.0000;
  }

  /**
   * Initialize regime detection components
   */
  private async initializeRegimeDetection(): Promise<void> {
    try {
      // Import regime detector dynamically to avoid circular dependencies
      const { MarketRegimeDetector } = await import('../market/regime-detector');
      const { MarketRegimeAdapter } = await import('../trading/regime-adapter');
      
      this.regimeDetector = new MarketRegimeDetector(this.config.regimeDetection!);
      this.regimeAdapter = new MarketRegimeAdapter();
      
      console.log(`Regime detection initialized for ${this.config.symbol}`);
    } catch (error) {
      console.error('Failed to initialize regime detection:', error);
    }
  }

  /**
   * Detect current market regime
   */
  private async detectMarketRegime(marketData: any): Promise<{
    regime: MarketRegime;
    confidence: number;
    details?: any;
  }> {
    if (!this.regimeDetector) {
      return {
        regime: MarketRegime.RANGING,
        confidence: 50
      };
    }

    try {
      const result = await this.regimeDetector.detectRegime(
        this.config.symbol,
        this.config.timeframe,
        marketData
      );
      
      return {
        regime: result.regime,
        confidence: result.confidence,
        details: result
      };
    } catch (error) {
      console.error('Regime detection failed:', error);
      return {
        regime: MarketRegime.RANGING,
        confidence: 50
      };
    }
  }

  /**
   * Check if signal is appropriate for current regime
   */
  private isSignalAppropriateForRegime(
    signal: { action: 'BUY' | 'SELL'; confidence: number },
    regime: MarketRegime,
    regimeConfidence: number
  ): boolean {
    // Skip signals in volatile markets unless confidence is very high
    if (regime === MarketRegime.VOLATILE && signal.confidence < 0.9) {
      return false;
    }
    
    // In ranging markets, require higher confidence for trend-following signals
    if (regime === MarketRegime.RANGING && signal.confidence < 0.8) {
      return false;
    }
    
    // Skip signals if regime confidence is too low
    if (regimeConfidence < (this.config.regimeDetection?.minConfidence || 70)) {
      return false;
    }
    
    return true;
  }

  /**
   * Apply regime-specific filters to entry conditions
   */
  private applyRegimeFilters(
    entrySignal: any,
    regime: MarketRegime,
    indicators: any
  ): any {
    if (!this.config.regimeDetection) {
      return entrySignal;
    }

    let adjustedSignal = { ...entrySignal };
    
    switch (regime) {
      case MarketRegime.TRENDING_UP:
        // In uptrending markets, be more selective with SELL signals
        if (entrySignal.action === 'SELL') {
          adjustedSignal.confidence *= 0.7; // Reduce confidence for counter-trend signals
        }
        break;
        
      case MarketRegime.TRENDING_DOWN:
        // In downtrending markets, be more selective with BUY signals
        if (entrySignal.action === 'BUY') {
          adjustedSignal.confidence *= 0.7; // Reduce confidence for counter-trend signals
        }
        break;
        
      case MarketRegime.RANGING:
        // In ranging markets, require stronger confirmation
        adjustedSignal.confidence *= 0.8;
        break;
        
      case MarketRegime.VOLATILE:
        // In volatile markets, require very high confidence
        adjustedSignal.confidence *= 0.6;
        break;
    }
    
    return adjustedSignal;
  }
}

/**
 * Factory function to create signal generator
 */
export async function createSignalGenerator(strategyId: string): Promise<SignalGenerator | null> {
  try {
    const strategy = await prisma.strategy.findUnique({
      where: { id: strategyId },
    });

    if (!strategy) return null;

    const rules = strategy.rules as any;
    const isMTF = strategy.type === 'mtf' || (rules.entry && rules.entry.primary && rules.entry.confirmation);
    
    return new SignalGenerator({
      strategyId: strategy.id,
      symbol: strategy.symbol,
      timeframe: strategy.timeframe,
      rules: rules,
      dynamicRisk: rules?.dynamicRisk as DynamicRiskParams | undefined,
      sessionFilter: rules?.sessionFilter as SessionFilter | undefined,
      correlationFilter: rules?.correlationFilter as CorrelationFilter | undefined,
      enhancedPartialExits: rules?.exit?.enhancedPartialExits as EnhancedPartialExitConfig | undefined,
      regimeDetection: rules?.regimeDetection as RegimeDetectionConfig | undefined,
      isMTF,
      mtfStrategy: isMTF ? {
        id: strategy.id,
        userId: strategy.userId,
        name: strategy.name,
        description: strategy.description || undefined,
        symbol: strategy.symbol,
        primaryTimeframe: (strategy as any).primaryTimeframe || strategy.timeframe,
        confirmationTimeframes: (strategy as any).confirmationTimeframes || [],
        type: strategy.type as any,
        status: strategy.status as any,
        rules: rules as any,
        version: strategy.version,
        aiPrompt: strategy.aiPrompt || undefined,
        isPublic: strategy.isPublic,
        createdAt: strategy.createdAt,
        updatedAt: strategy.updatedAt
      } : undefined
    });
  } catch (error) {
    console.error('Failed to create signal generator:', error);
    return null;
  }
}
