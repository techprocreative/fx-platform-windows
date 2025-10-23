import {
  EnhancedPartialExitConfig,
  PartialExitLevel,
  PartialExitExecution,
  PartialExitCalculationParams,
  PartialExitCalculationResult,
  PartialExitPerformance,
  PartialExitOptimizationResult,
  MarketRegime,
  SwingPoint
} from '@/types';

export class EnhancedPartialExitManager {
  private config: EnhancedPartialExitConfig;
  private executions: PartialExitExecution[] = [];
  private performance: Map<string, PartialExitPerformance> = new Map();

  constructor(config: EnhancedPartialExitConfig) {
    this.config = config;
  }

  /**
   * Calculate partial exit recommendations based on current market conditions
   */
  async calculatePartialExits(params: PartialExitCalculationParams): Promise<PartialExitCalculationResult> {
    const {
      tradeId,
      symbol,
      entryPrice,
      currentPrice,
      tradeType,
      originalQuantity,
      remainingQuantity,
      entryTime,
      atr,
      volatility,
      spread,
      currentRegime,
      regimeConfidence,
      currentSession,
      config
    } = params;

    // Filter active levels based on strategy type
    const activeLevels = this.getActiveLevels(config.levels, config.strategy);
    
    // Calculate current profit/loss
    const currentProfit = this.calculateProfit(entryPrice, currentPrice, tradeType, originalQuantity - remainingQuantity);
    const currentProfitPercentage = this.calculateProfitPercentage(entryPrice, currentPrice, tradeType);
    const unrealizedProfit = this.calculateProfit(entryPrice, currentPrice, tradeType, remainingQuantity);

    // Check each level for trigger conditions
    const recommendedExits = [];
    
    for (const level of activeLevels) {
      if (this.shouldTriggerLevel(level, params)) {
        const exitQuantity = this.calculateExitQuantity(level, remainingQuantity, originalQuantity);
        
        recommendedExits.push({
          levelId: level.id,
          levelName: level.name,
          percentage: level.percentage,
          quantity: exitQuantity,
          price: this.calculateExitPrice(level, currentPrice, tradeType, atr),
          reason: this.getTriggerReason(level, params),
          confidence: this.calculateConfidence(level, params),
          urgency: this.calculateUrgency(level, params)
        });
      }
    }

    // Sort by priority and confidence
    recommendedExits.sort((a, b) => {
      const levelA = config.levels.find(l => l.id === a.levelId);
      const levelB = config.levels.find(l => l.id === b.levelId);
      
      if (levelA?.priority !== levelB?.priority) {
        return (levelA?.priority || 999) - (levelB?.priority || 999);
      }
      
      return b.confidence - a.confidence;
    });

    // Market analysis
    const marketConditions = this.analyzeMarketConditions(params);
    
    // Risk analysis
    const riskMetrics = this.analyzeRisk(params);

    // Performance predictions
    const predictions = await this.predictPerformance(params, recommendedExits);

    // Generate warnings and recommendations
    const warnings = this.generateWarnings(params, recommendedExits);
    const recommendations = this.generateRecommendations(params, recommendedExits);

    return {
      shouldExit: recommendedExits.length > 0,
      recommendedExits,
      analysis: {
        currentProfit,
        currentProfitPercentage,
        unrealizedProfit,
        riskExposure: this.calculateRiskExposure(params),
        marketConditions,
        riskMetrics
      },
      predictions,
      warnings,
      recommendations,
      timestamp: new Date(),
      calculationTime: Date.now() // Simple timing
    };
  }

  /**
   * Execute a partial exit
   */
  async executePartialExit(
    levelId: string,
    params: PartialExitCalculationParams,
    executionPrice?: number
  ): Promise<PartialExitExecution> {
    const level = this.config.levels.find(l => l.id === levelId);
    if (!level) {
      throw new Error(`Partial exit level ${levelId} not found`);
    }

    const exitQuantity = this.calculateExitQuantity(level, params.remainingQuantity, params.originalQuantity);
    const exitPrice = executionPrice || this.calculateExitPrice(level, params.currentPrice, params.tradeType, params.atr);
    
    const execution: PartialExitExecution = {
      id: `execution-${Date.now()}-${Math.random()}`,
      tradeId: params.tradeId,
      levelId: level.id,
      levelName: level.name,
      timestamp: new Date(),
      price: exitPrice,
      quantity: exitQuantity,
      percentage: level.percentage,
      remainingQuantity: params.remainingQuantity - exitQuantity,
      triggerType: level.triggerType,
      triggerValue: this.getTriggerValue(level, params),
      triggerReason: this.getTriggerReason(level, params),
      marketContext: {
        regime: params.currentRegime || MarketRegime.RANGING,
        volatility: params.volatility || 0,
        spread: params.spread || 0,
        session: params.currentSession || 'unknown'
      },
      realizedProfit: this.calculateProfit(params.entryPrice, exitPrice, params.tradeType, exitQuantity),
      unrealizedProfit: this.calculateProfit(exitPrice, params.currentPrice, params.tradeType, params.remainingQuantity - exitQuantity),
      totalProfit: this.calculateProfit(params.entryPrice, params.currentPrice, params.tradeType, params.originalQuantity - (params.remainingQuantity - exitQuantity)),
      riskReduction: this.calculateRiskReduction(level, params),
      executionQuality: {
        slippage: Math.abs(exitPrice - (executionPrice || params.currentPrice)),
        executionTime: 100, // Mock execution time
        priceImprovement: Math.max(0, (executionPrice || params.currentPrice) - exitPrice)
      },
      metadata: {
        confidence: this.calculateConfidence(level, params),
        warnings: this.generateExecutionWarnings(level, params),
        notes: ''
      }
    };

    // Store execution
    this.executions.push(execution);
    
    // Update performance tracking
    this.updatePerformance(level.id, execution);

    return execution;
  }

  /**
   * Get active levels based on strategy type
   */
  private getActiveLevels(levels: PartialExitLevel[], strategy: string): PartialExitLevel[] {
    const activeLevels = levels.filter(level => level.isActive);
    
    switch (strategy) {
      case 'sequential':
        // Return levels in priority order, but only if previous levels are executed
        const sortedLevels = activeLevels.sort((a, b) => a.priority - b.priority);
        const executedLevelIds = this.executions.map(e => e.levelId);
        
        return sortedLevels.filter((level, index) => {
          if (index === 0) return true; // First level is always available
          const previousLevel = sortedLevels[index - 1];
          return executedLevelIds.includes(previousLevel.id);
        });

      case 'parallel':
        // All active levels are available
        return activeLevels;

      case 'conditional':
        // Filter based on market conditions (simplified for now)
        return activeLevels.filter(level => {
          // Add conditional logic here based on market conditions
          return true;
        });

      default:
        return activeLevels;
    }
  }

  /**
   * Check if a level should be triggered
   */
  private shouldTriggerLevel(level: PartialExitLevel, params: PartialExitCalculationParams): boolean {
    // Check cooldown period
    if (this.isInCooldown(level, params)) {
      return false;
    }

    // Check daily limits
    if (this.exceedsDailyLimit(level, params)) {
      return false;
    }

    // Check market conditions
    if (!this.areMarketConditionsSuitable(level, params)) {
      return false;
    }

    // Check trigger-specific conditions
    switch (level.triggerType) {
      case 'profit':
        return this.checkProfitTrigger(level, params);
      case 'time':
        return this.checkTimeTrigger(level, params);
      case 'price':
        return this.checkPriceTrigger(level, params);
      case 'atr':
        return this.checkATRTrigger(level, params);
      case 'trailing':
        return this.checkTrailingTrigger(level, params);
      case 'regime':
        return this.checkRegimeTrigger(level, params);
      default:
        return false;
    }
  }

  /**
   * Check profit-based trigger
   */
  private checkProfitTrigger(level: PartialExitLevel, params: PartialExitCalculationParams): boolean {
    if (!level.profitTarget) return false;

    const currentProfitPercentage = this.calculateProfitPercentage(
      params.entryPrice,
      params.currentPrice,
      params.tradeType
    );

    switch (level.profitTarget.type) {
      case 'pips':
        const profitPips = this.calculatePipsProfit(params.entryPrice, params.currentPrice, params.tradeType);
        return profitPips >= level.profitTarget.value;

      case 'percentage':
        return currentProfitPercentage >= level.profitTarget.value;

      case 'rr_ratio':
        const riskPips = this.calculateRiskPips(params.entryPrice, 0, params.tradeType); // Using 0 as default stop loss
        const profitPipsForRR = this.calculatePipsProfit(params.entryPrice, params.currentPrice, params.tradeType);
        return riskPips > 0 && (profitPipsForRR / riskPips) >= level.profitTarget.value;

      case 'amount':
        const profitAmount = this.calculateProfit(params.entryPrice, params.currentPrice, params.tradeType, params.originalQuantity);
        return profitAmount >= level.profitTarget.value;

      default:
        return false;
    }
  }

  /**
   * Check time-based trigger
   */
  private checkTimeTrigger(level: PartialExitLevel, params: PartialExitCalculationParams): boolean {
    if (!level.timeTarget) return false;

    const currentTime = new Date();
    const entryTime = params.entryTime;

    switch (level.timeTarget.type) {
      case 'duration':
        const elapsedMinutes = (currentTime.getTime() - entryTime.getTime()) / (1000 * 60);
        return elapsedMinutes >= level.timeTarget.value;

      case 'specific_time':
        const targetTime = new Date();
        const [hours, minutes] = level.timeTarget.value.toString().split(':').map(Number);
        targetTime.setHours(hours, minutes, 0, 0);
        return currentTime >= targetTime;

      case 'session_end':
        return this.isSessionEnd(currentTime, level.timeTarget.sessionType || 'any');

      default:
        return false;
    }
  }

  /**
   * Check price-based trigger
   */
  private checkPriceTrigger(level: PartialExitLevel, params: PartialExitCalculationParams): boolean {
    if (!level.priceTarget) return false;

    switch (level.priceTarget.type) {
      case 'absolute':
        if (params.tradeType === 'BUY') {
          return params.currentPrice >= level.priceTarget.value;
        } else {
          return params.currentPrice <= level.priceTarget.value;
        }

      case 'relative':
        const relativePrice = params.entryPrice * (1 + level.priceTarget.value / 100);
        if (params.tradeType === 'BUY') {
          return params.currentPrice >= relativePrice;
        } else {
          return params.currentPrice <= relativePrice;
        }

      case 'support':
      case 'resistance':
        // This would require access to support/resistance data
        return false;

      default:
        return false;
    }
  }

  /**
   * Check ATR-based trigger
   */
  private checkATRTrigger(level: PartialExitLevel, params: PartialExitCalculationParams): boolean {
    if (!level.atrTarget || !params.atr) return false;

    const atrDistance = params.atr * level.atrTarget.multiplier;
    const currentDistance = Math.abs(params.currentPrice - params.entryPrice);

    if (level.atrTarget.direction === 'profit') {
      if (params.tradeType === 'BUY') {
        return (params.currentPrice - params.entryPrice) >= atrDistance;
      } else {
        return (params.entryPrice - params.currentPrice) >= atrDistance;
      }
    } else {
      // Loss direction
      if (params.tradeType === 'BUY') {
        return (params.entryPrice - params.currentPrice) >= atrDistance;
      } else {
        return (params.currentPrice - params.entryPrice) >= atrDistance;
      }
    }
  }

  /**
   * Check trailing trigger
   */
  private checkTrailingTrigger(level: PartialExitLevel, params: PartialExitCalculationParams): boolean {
    if (!level.trailingTarget) return false;

    // This is a simplified implementation
    // In a real implementation, you would track the highest/lowest price since activation
    const activationDistance = this.getActivationDistance(level, params);
    const currentDistance = Math.abs(params.currentPrice - params.entryPrice);

    // Check if we've reached activation point
    if (currentDistance < activationDistance) {
      return false;
    }

    // Check if we've trailed down from the peak
    const trailingDistance = this.getTrailingDistance(level, params);
    const peakProfit = this.getPeakProfit(params.tradeId, level.id);

    if (params.tradeType === 'BUY') {
      return (peakProfit - params.currentPrice) >= trailingDistance;
    } else {
      return (params.currentPrice - peakProfit) >= trailingDistance;
    }
  }

  /**
   * Check regime-based trigger
   */
  private checkRegimeTrigger(level: PartialExitLevel, params: PartialExitCalculationParams): boolean {
    if (!level.regimeTarget || !params.currentRegime) return false;

    return params.currentRegime === level.regimeTarget.regime &&
           (params.regimeConfidence || 0) >= level.regimeTarget.confidence;
  }

  /**
   * Calculate exit quantity
   */
  private calculateExitQuantity(level: PartialExitLevel, remainingQuantity: number, originalQuantity: number): number {
    const percentageQuantity = (originalQuantity * level.percentage) / 100;
    return Math.min(percentageQuantity, remainingQuantity);
  }

  /**
   * Calculate exit price
   */
  private calculateExitPrice(level: PartialExitLevel, currentPrice: number, tradeType: 'BUY' | 'SELL', atr?: number): number {
    // For simplicity, return current price
    // In a real implementation, you might add slippage, spread adjustments, etc.
    return currentPrice;
  }

  /**
   * Calculate profit
   */
  private calculateProfit(entryPrice: number, exitPrice: number, tradeType: 'BUY' | 'SELL', quantity: number): number {
    if (tradeType === 'BUY') {
      return (exitPrice - entryPrice) * quantity;
    } else {
      return (entryPrice - exitPrice) * quantity;
    }
  }

  /**
   * Calculate profit percentage
   */
  private calculateProfitPercentage(entryPrice: number, currentPrice: number, tradeType: 'BUY' | 'SELL'): number {
    if (tradeType === 'BUY') {
      return ((currentPrice - entryPrice) / entryPrice) * 100;
    } else {
      return ((entryPrice - currentPrice) / entryPrice) * 100;
    }
  }

  /**
   * Calculate profit in pips
   */
  private calculatePipsProfit(entryPrice: number, currentPrice: number, tradeType: 'BUY' | 'SELL'): number {
    // This is a simplified calculation
    // In reality, pip calculation depends on the symbol and lot size
    const multiplier = tradeType === 'BUY' ? 1 : -1;
    return Math.round((currentPrice - entryPrice) * 10000 * multiplier);
  }

  /**
   * Calculate risk in pips
   */
  private calculateRiskPips(entryPrice: number, stopLossPrice?: number, tradeType?: 'BUY' | 'SELL'): number {
    if (!stopLossPrice || !tradeType) return 0;
    
    const multiplier = tradeType === 'BUY' ? -1 : 1;
    return Math.round((stopLossPrice - entryPrice) * 10000 * multiplier);
  }

  /**
   * Calculate risk exposure
   */
  private calculateRiskExposure(params: PartialExitCalculationParams): number {
    // Simplified risk calculation
    return params.remainingQuantity * (params.volatility || 0.01);
  }

  /**
   * Analyze market conditions
   */
  private analyzeMarketConditions(params: PartialExitCalculationParams) {
    return {
      regime: params.currentRegime || MarketRegime.RANGING,
      volatility: this.categorizeVolatility(params.volatility || 0),
      trend: this.determineTrend(params),
      strength: this.calculateTrendStrength(params)
    };
  }

  /**
   * Analyze risk metrics
   */
  private analyzeRisk(params: PartialExitCalculationParams) {
    return {
      currentRisk: this.calculateCurrentRisk(params),
      maxRisk: this.calculateMaxRisk(params),
      riskReductionPotential: this.calculateRiskReductionPotential(params),
      stopLossDistance: this.calculateStopLossDistance(params)
    };
  }

  /**
   * Predict performance
   */
  private async predictPerformance(params: PartialExitCalculationParams, recommendedExits: any[]) {
    // Simplified prediction logic
    return {
      expectedProfit: this.calculateExpectedProfit(params, recommendedExits),
      probabilityOfSuccess: this.calculateSuccessProbability(params, recommendedExits),
      riskReduction: this.calculateExpectedRiskReduction(params, recommendedExits),
      optimalExitTiming: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
    };
  }

  /**
   * Generate warnings
   */
  private generateWarnings(params: PartialExitCalculationParams, recommendedExits: any[]): string[] {
    const warnings: string[] = [];

    if (params.spread && params.spread > 0.002) {
      warnings.push('High spread detected, may affect execution quality');
    }

    if (params.volatility && params.volatility > 0.03) {
      warnings.push('High volatility detected, consider reducing position size');
    }

    if (recommendedExits.length > 3) {
      warnings.push('Multiple exit levels triggered, consider consolidating');
    }

    return warnings;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(params: PartialExitCalculationParams, recommendedExits: any[]): string[] {
    const recommendations: string[] = [];

    if (recommendedExits.length > 0) {
      recommendations.push('Execute highest priority exit first');
    }

    if (params.currentRegime === MarketRegime.VOLATILE) {
      recommendations.push('Consider tighter exits in volatile conditions');
    }

    return recommendations;
  }

  /**
   * Helper methods
   */
  private categorizeVolatility(volatility: number): 'low' | 'normal' | 'high' {
    if (volatility < 0.01) return 'low';
    if (volatility < 0.02) return 'normal';
    return 'high';
  }

  private determineTrend(params: PartialExitCalculationParams): 'up' | 'down' | 'sideways' {
    // Simplified trend determination
    const priceChange = (params.currentPrice - params.entryPrice) / params.entryPrice;
    if (priceChange > 0.01) return 'up';
    if (priceChange < -0.01) return 'down';
    return 'sideways';
  }

  private calculateTrendStrength(params: PartialExitCalculationParams): number {
    // Simplified trend strength calculation
    return Math.abs((params.currentPrice - params.entryPrice) / params.entryPrice) * 100;
  }

  private calculateCurrentRisk(params: PartialExitCalculationParams): number {
    return params.remainingQuantity * (params.volatility || 0.01);
  }

  private calculateMaxRisk(params: PartialExitCalculationParams): number {
    return params.originalQuantity * (params.volatility || 0.01);
  }

  private calculateRiskReductionPotential(params: PartialExitCalculationParams): number {
    // Simplified calculation
    return 0.5; // 50% risk reduction potential
  }

  private calculateStopLossDistance(params: PartialExitCalculationParams): number {
    // This would need access to stop loss price
    return 0.01; // Default 1%
  }

  private calculateExpectedProfit(params: PartialExitCalculationParams, recommendedExits: any[]): number {
    return recommendedExits.reduce((total, exit) => total + (exit.quantity * 0.001), 0);
  }

  private calculateSuccessProbability(params: PartialExitCalculationParams, recommendedExits: any[]): number {
    // Simplified probability calculation
    return 0.65; // 65% success rate
  }

  private calculateExpectedRiskReduction(params: PartialExitCalculationParams, recommendedExits: any[]): number {
    return recommendedExits.reduce((total, exit) => total + exit.percentage, 0) / recommendedExits.length;
  }

  private isInCooldown(level: PartialExitLevel, params: PartialExitCalculationParams): boolean {
    // Check if this level was recently executed
    const lastExecution = this.executions
      .filter(e => e.levelId === level.id)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    if (!lastExecution) return false;

    const cooldownMinutes = this.config.globalSettings.cooldownPeriod;
    const elapsedMinutes = (new Date().getTime() - lastExecution.timestamp.getTime()) / (1000 * 60);

    return elapsedMinutes < cooldownMinutes;
  }

  private exceedsDailyLimit(level: PartialExitLevel, params: PartialExitCalculationParams): boolean {
    const today = new Date().toDateString();
    const todayExecutions = this.executions.filter(e => 
      e.levelId === level.id && 
      e.timestamp.toDateString() === today
    );

    return todayExecutions.length >= this.config.globalSettings.maxDailyPartialExits;
  }

  private areMarketConditionsSuitable(level: PartialExitLevel, params: PartialExitCalculationParams): boolean {
    // Check if current market conditions are suitable for this level
    if (this.config.globalSettings.respectMarketSessions && !this.isOptimalSession(params.currentSession)) {
      return false;
    }

    if (this.config.globalSettings.avoidNewsEvents && this.isNearNewsEvent(params)) {
      return false;
    }

    if (this.config.globalSettings.reduceInHighVolatility && 
        params.volatility && 
        params.volatility > this.config.globalSettings.volatilityThreshold) {
      return false;
    }

    return true;
  }

  private isOptimalSession(session?: string): boolean {
    // Simplified session check
    return true;
  }

  private isNearNewsEvent(params: PartialExitCalculationParams): boolean {
    // This would need access to news event data
    return false;
  }

  private getTriggerReason(level: PartialExitLevel, params: PartialExitCalculationParams): string {
    switch (level.triggerType) {
      case 'profit':
        return `Profit target reached: ${level.profitTarget?.type} ${level.profitTarget?.value}`;
      case 'time':
        return `Time condition met: ${level.timeTarget?.type} ${level.timeTarget?.value}`;
      case 'price':
        return `Price level reached: ${level.priceTarget?.type} ${level.priceTarget?.value}`;
      case 'atr':
        return `ATR condition met: ${level.atrTarget?.multiplier}x ATR`;
      case 'trailing':
        return `Trailing stop activated`;
      case 'regime':
        return `Market regime detected: ${level.regimeTarget?.regime}`;
      default:
        return 'Trigger condition met';
    }
  }

  private getTriggerValue(level: PartialExitLevel, params: PartialExitCalculationParams): number {
    switch (level.triggerType) {
      case 'profit':
        return level.profitTarget?.value || 0;
      case 'time':
        return level.timeTarget?.value || 0;
      case 'price':
        return level.priceTarget?.value || 0;
      case 'atr':
        return level.atrTarget?.multiplier || 0;
      case 'trailing':
        return level.trailingTarget?.distance || 0;
      case 'regime':
        return level.regimeTarget?.confidence || 0;
      default:
        return 0;
    }
  }

  private calculateConfidence(level: PartialExitLevel, params: PartialExitCalculationParams): number {
    let confidence = 50; // Base confidence

    // Adjust based on trigger type and market conditions
    switch (level.triggerType) {
      case 'profit':
        confidence += 20;
        break;
      case 'time':
        confidence += 10;
        break;
      case 'atr':
        confidence += 15;
        break;
    }

    // Adjust based on volatility
    if (params.volatility) {
      if (params.volatility < 0.01) {
        confidence += 10;
      } else if (params.volatility > 0.03) {
        confidence -= 10;
      }
    }

    return Math.max(0, Math.min(100, confidence));
  }

  private calculateUrgency(level: PartialExitLevel, params: PartialExitCalculationParams): 'low' | 'medium' | 'high' | 'immediate' {
    if (level.triggerType === 'regime' && params.currentRegime === MarketRegime.VOLATILE) {
      return 'immediate';
    }

    if (level.triggerType === 'profit' && this.calculateProfitPercentage(params.entryPrice, params.currentPrice, params.tradeType) > 2) {
      return 'high';
    }

    if (level.triggerType === 'time') {
      return 'medium';
    }

    return 'low';
  }

  private calculateRiskReduction(level: PartialExitLevel, params: PartialExitCalculationParams): number {
    return (level.percentage / 100) * this.calculateCurrentRisk(params);
  }

  private generateExecutionWarnings(level: PartialExitLevel, params: PartialExitCalculationParams): string[] {
    const warnings: string[] = [];

    if (params.spread && params.spread > this.config.globalSettings.maxSpreadPercentage) {
      warnings.push('Spread exceeds maximum threshold');
    }

    if (params.volatility && params.volatility > 0.03) {
      warnings.push('High volatility may affect execution');
    }

    return warnings;
  }

  private updatePerformance(levelId: string, execution: PartialExitExecution): void {
    const existing = this.performance.get(levelId);
    
    if (existing) {
      // Update existing performance
      existing.totalExecutions++;
      existing.totalProfit += execution.realizedProfit;
      existing.history.push(execution);
      existing.lastUpdated = new Date();
      
      // Recalculate averages
      existing.averageProfit = existing.totalProfit / existing.totalExecutions;
      existing.successRate = existing.history.filter(e => e.realizedProfit > 0).length / existing.totalExecutions * 100;
    } else {
      // Create new performance record
      this.performance.set(levelId, {
        levelId,
        levelName: execution.levelName,
        totalExecutions: 1,
        successRate: execution.realizedProfit > 0 ? 100 : 0,
        averageProfit: execution.realizedProfit,
        totalProfit: execution.realizedProfit,
        riskReduction: execution.riskReduction,
        averageTimeToExecution: 0, // Would need entry time
        bestTimeToExecute: 'unknown',
        worstTimeToExecute: 'unknown',
        performanceByRegime: {
          [MarketRegime.TRENDING_UP]: { executions: 0, successRate: 0, avgProfit: 0 },
          [MarketRegime.TRENDING_DOWN]: { executions: 0, successRate: 0, avgProfit: 0 },
          [MarketRegime.RANGING]: { executions: 0, successRate: 0, avgProfit: 0 },
          [MarketRegime.VOLATILE]: { executions: 0, successRate: 0, avgProfit: 0 }
        },
        suggestions: [],
        history: [execution],
        lastUpdated: new Date()
      });
    }
  }

  private isSessionEnd(currentTime: Date, sessionType: string): boolean {
    // Simplified session end check
    return false;
  }

  private getActivationDistance(level: PartialExitLevel, params: PartialExitCalculationParams): number {
    if (!level.trailingTarget) return 0;

    switch (level.trailingTarget.activationType) {
      case 'pips':
        return level.trailingTarget.activationPoint;
      case 'percentage':
        return params.entryPrice * (level.trailingTarget.activationPoint / 100);
      case 'rr_ratio':
        return this.calculateRiskPips(params.entryPrice, 0, params.tradeType) * level.trailingTarget.activationPoint; // Using 0 as default stop loss
      default:
        return 0;
    }
  }

  private getTrailingDistance(level: PartialExitLevel, params: PartialExitCalculationParams): number {
    if (!level.trailingTarget) return 0;

    switch (level.trailingTarget.distanceType) {
      case 'pips':
        return level.trailingTarget.distance;
      case 'percentage':
        return params.entryPrice * (level.trailingTarget.distance / 100);
      case 'atr':
        return (params.atr || 0) * level.trailingTarget.distance;
      default:
        return 0;
    }
  }

  private getPeakProfit(tradeId: string, levelId: string): number {
    // This would need to track peak profits for each trade/level combination
    return 0;
  }

  /**
   * Get performance data for a level
   */
  getPerformance(levelId: string): PartialExitPerformance | undefined {
    return this.performance.get(levelId);
  }

  /**
   * Get all executions
   */
  getExecutions(): PartialExitExecution[] {
    return [...this.executions];
  }

  /**
   * Update configuration
   */
  updateConfig(config: EnhancedPartialExitConfig): void {
    this.config = config;
  }

  /**
   * Get current configuration
   */
  getConfig(): EnhancedPartialExitConfig {
    return { ...this.config };
  }

  /**
   * Optimize partial exit levels based on historical performance
   */
  async optimizeLevels(lookbackPeriod: number = 30): Promise<PartialExitOptimizationResult> {
    // This would implement optimization logic based on historical performance
    // For now, return a placeholder result
    
    return {
      optimizedConfig: this.config,
      performanceComparison: {
        before: {
          totalProfit: 0,
          winRate: 0,
          maxDrawdown: 0,
          sharpeRatio: 0
        },
        after: {
          totalProfit: 0,
          winRate: 0,
          maxDrawdown: 0,
          sharpeRatio: 0
        },
        improvement: {
          profitImprovement: 0,
          winRateImprovement: 0,
          drawdownReduction: 0,
          sharpeImprovement: 0
        }
      },
      optimizationDetails: {
        algorithm: 'genetic',
        iterations: 100,
        convergenceTime: 5000,
        parametersOptimized: ['percentage', 'triggerType', 'priority']
      },
      validation: {
        backtestPeriod: {
          from: new Date(Date.now() - lookbackPeriod * 24 * 60 * 60 * 1000),
          to: new Date()
        },
        outOfSampleResults: {
          profit: 0,
          winRate: 0,
          maxDrawdown: 0
        },
        robustnessScore: 0.8
      },
      recommendations: [
        {
          type: 'configuration',
          description: 'Consider adjusting profit targets based on recent volatility',
          expectedImpact: 15,
          implementationComplexity: 'medium'
        }
      ],
      timestamp: new Date()
    };
  }
}

// Export factory function
export function createPartialExitManager(config: EnhancedPartialExitConfig): EnhancedPartialExitManager {
  return new EnhancedPartialExitManager(config);
}