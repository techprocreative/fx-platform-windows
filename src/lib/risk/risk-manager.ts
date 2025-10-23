/**
 * Risk Management System
 * 
 * This module provides comprehensive risk management functionality for the trading platform.
 * It includes position sizing, trade validation, risk exposure monitoring, and emergency controls.
 */

import {
  RiskParameters,
  RiskExposure,
  ValidationResult,
  Position,
  TradeResult,
  AccountInfo,
  SymbolInfo,
  RiskViolation,
  EmergencyCloseResult
} from './types';

// Define TradeParams interface locally to avoid import issues
interface TradeParams {
  /** Trading symbol (e.g., 'EURUSD') */
  symbol: string;
  /** Trade type: BUY or SELL */
  type: "BUY" | "SELL";
  /** Requested lot size */
  lotSize: number;
  /** Entry price */
  entryPrice: number;
  /** Stop loss price */
  stopLoss: number;
  /** Take profit price */
  takeProfit?: number;
  /** Trade comment or identifier */
  comment?: string;
  /** Magic number for trade identification */
  magicNumber?: number;
  /** User ID placing the trade */
  userId: string;
  /** Strategy ID if trade is from a strategy */
  strategyId?: string;
  /** Current ATR value for dynamic risk management */
  currentATR?: number;
  /** Dynamic risk parameters */
  dynamicRisk?: any;
  /** Session filter parameters */
  sessionFilter?: SessionFilter;
  /** Correlation filter parameters */
  correlationFilter?: CorrelationFilter;
  /** Regime detection parameters */
  regimeDetection?: RegimeDetectionConfig;
  /** Timeframe for the trade */
  timeframe?: string;
  /** Enhanced partial exits configuration */
  enhancedPartialExits?: EnhancedPartialExitConfig;
}

// Mock implementations - these would be replaced with actual broker/database connections
import { logger } from '../monitoring/logger';
import { SessionFilter, SmartExitRules, PositionSizingConfig, PositionSizingParams, SizingMethod, CorrelationFilter, MarketRegime, RegimeDetectionConfig, RegimeBasedRiskParams, EnhancedPartialExitConfig, PartialExitLevel } from '../../types';
import { getSessionMultiplier, isTradingAllowed } from '../market/sessions';
import { SmartExitCalculator } from '../trading/smart-exits';
import { positionSizingCalculator, PositionSizingCalculator } from '../trading/position-sizing';
import { createPartialExitManager } from '../trading/partial-exits';

// Default risk parameters for new users
const DEFAULT_RISK_PARAMETERS: RiskParameters = {
  maxRiskPerTrade: 2.0,      // 2% of balance per trade
  maxDailyLoss: 6.0,         // 6% of balance per day
  maxDrawdown: 20.0,         // 20% maximum drawdown
  maxPositions: 5,           // 5 concurrent positions
  maxLeverage: 100,          // 1:100 maximum leverage
  minStopLossDistance: 10,   // 10 pips minimum stop loss
  maxLotSize: 10.0           // Maximum 10 lots per trade
};

/**
 * RiskManager class handles all risk-related calculations and validations
 */
export class RiskManager {
  private riskParameters: Map<string, RiskParameters> = new Map();
  
  /**
   * Initialize the RiskManager with default parameters
   */
  constructor() {
    logger.info('RiskManager initialized');
  }

  /**
   * Get risk parameters for a user, or return defaults if not set
   */
  private async getRiskParameters(userId: string): Promise<RiskParameters> {
    if (!this.riskParameters.has(userId)) {
      // In a real implementation, this would fetch from database
      // For now, we'll use default parameters
      this.riskParameters.set(userId, { ...DEFAULT_RISK_PARAMETERS });
    }
    return this.riskParameters.get(userId)!;
  }

  /**
   * Set risk parameters for a user
   */
  async setRiskParameters(userId: string, params: Partial<RiskParameters>): Promise<void> {
    const currentParams = await this.getRiskParameters(userId);
    const updatedParams = { ...currentParams, ...params };
    this.riskParameters.set(userId, updatedParams);
    
    // In a real implementation, this would save to database
    logger.info(`Updated risk parameters for user ${userId}`, { params: updatedParams });
  }

  /**
   * Calculate safe position size based on risk percentage and stop loss
   * 
   * @param balance Account balance
   * @param riskPercent Risk percentage (e.g., 2 for 2%)
   * @param stopLossPips Stop loss distance in pips
   * @param symbol Trading symbol
   * @returns Safe position size in lots
   */
  calculatePositionSize(
    balance: number,
    riskPercent: number,
    stopLossPips: number,
    symbol: string
  ): number {
    try {
      // Validate inputs
      if (balance <= 0) {
        throw new Error('Balance must be greater than 0');
      }
      if (riskPercent <= 0 || riskPercent > 100) {
        throw new Error('Risk percent must be between 0 and 100');
      }
      if (stopLossPips <= 0) {
        throw new Error('Stop loss pips must be greater than 0');
      }

      // Calculate risk amount in monetary terms
      const riskAmount = balance * (riskPercent / 100);
      
      // Get symbol information (mocked for now)
      const symbolInfo = this.getSymbolInfo(symbol);
      
      // Calculate pip value (simplified calculation)
      // In a real implementation, this would account for currency conversion
      const pipValue = symbolInfo.contractSize * symbolInfo.point;
      
      // Calculate position size based on risk amount and stop loss
      const positionSize = riskAmount / (stopLossPips * pipValue);
      
      // Round to valid lot size
      const roundedSize = this.roundToLotSize(positionSize, symbolInfo);
      
      logger.debug(`Calculated position size`, {
        balance,
        riskPercent,
        stopLossPips,
        symbol,
        riskAmount,
        pipValue,
        positionSize: roundedSize
      });
      
      return roundedSize;
    } catch (error) {
      logger.error('Error calculating position size', error as Error, { balance, riskPercent, stopLossPips, symbol });
      throw error;
    }
  }

  /**
   * Calculate ATR-based position size
   *
   * @param balance Account balance
   * @param riskPercent Risk percentage (e.g., 2 for 2%)
   * @param atr Current ATR value
   * @param atrMultiplier ATR multiplier for stop loss (1-3x)
   * @param symbol Trading symbol
   * @param dynamicRisk Dynamic risk parameters
   * @returns Safe position size in lots
   */
  calculateATRPositionSize(
    balance: number,
    riskPercent: number,
    atr: number,
    atrMultiplier: number,
    symbol: string,
    dynamicRisk?: any,
    sessionFilter?: SessionFilter
  ): number {
    try {
      // Validate inputs
      if (balance <= 0) {
        throw new Error('Balance must be greater than 0');
      }
      if (riskPercent <= 0 || riskPercent > 100) {
        throw new Error('Risk percent must be between 0 and 100');
      }
      if (atr <= 0) {
        throw new Error('ATR must be greater than 0');
      }
      if (atrMultiplier < 1 || atrMultiplier > 3) {
        throw new Error('ATR multiplier must be between 1 and 3');
      }

      // Calculate risk amount in monetary terms
      const riskAmount = balance * (riskPercent / 100);
      
      // Get symbol information
      const symbolInfo = this.getSymbolInfo(symbol);
      
      // Calculate stop loss distance in price units
      const stopLossDistance = atr * atrMultiplier;
      
      // Calculate position size based on risk amount and ATR-based stop loss
      const positionSize = riskAmount / (stopLossDistance * symbolInfo.contractSize);
      
      // Apply volatility adjustment if enabled
      let adjustedSize = positionSize;
      if (dynamicRisk?.reduceInHighVolatility && atr > dynamicRisk.volatilityThreshold) {
        // Reduce position size by 25% in high volatility
        adjustedSize = positionSize * 0.75;
      }
      
      // Apply session multiplier if session filter is enabled
      if (sessionFilter) {
        const sessionMultiplier = getSessionMultiplier(symbol, sessionFilter);
        adjustedSize = adjustedSize * sessionMultiplier;
      }
      
      // Round to valid lot size
      const roundedSize = this.roundToLotSize(adjustedSize, symbolInfo);
      
      logger.debug(`Calculated ATR-based position size`, {
        balance,
        riskPercent,
        atr,
        atrMultiplier,
        symbol,
        riskAmount,
        stopLossDistance,
        positionSize: roundedSize,
        volatilityAdjusted: dynamicRisk?.reduceInHighVolatility && atr > dynamicRisk.volatilityThreshold
      });
      
      return roundedSize;
    } catch (error) {
      logger.error('Error calculating ATR position size', error as Error, {
        balance, riskPercent, atr, atrMultiplier, symbol
      });
      throw error;
    }
  }

  /**
   * Calculate ATR-based stop loss level
   *
   * @param entryPrice Entry price of the trade
   * @param atr Current ATR value
   * @param atrMultiplier ATR multiplier for stop loss (1-3x)
   * @param tradeType Trade type (BUY or SELL)
   * @returns Stop loss price
   */
  calculateATRStopLoss(
    entryPrice: number,
    atr: number,
    atrMultiplier: number,
    tradeType: "BUY" | "SELL"
  ): number {
    try {
      // Validate inputs
      if (entryPrice <= 0) {
        throw new Error('Entry price must be greater than 0');
      }
      if (atr <= 0) {
        throw new Error('ATR must be greater than 0');
      }
      if (atrMultiplier < 1 || atrMultiplier > 3) {
        throw new Error('ATR multiplier must be between 1 and 3');
      }

      // Calculate stop loss distance
      const stopLossDistance = atr * atrMultiplier;
      
      // Calculate stop loss price based on trade type
      if (tradeType === "BUY") {
        return entryPrice - stopLossDistance;
      } else {
        return entryPrice + stopLossDistance;
      }
    } catch (error) {
      logger.error('Error calculating ATR stop loss', error as Error, {
        entryPrice, atr, atrMultiplier, tradeType
      });
      throw error;
    }
  }

  /**
   * Validate trade against risk parameters before execution
   * 
   * @param params Trade parameters to validate
   * @returns Validation result with any errors or warnings
   */
  async validateTrade(params: TradeParams, smartExitRules?: SmartExitRules, marketData?: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let adjustedParams: TradeParams | undefined;

    try {
      // Check if trading is allowed based on session filter
      if (params.sessionFilter?.enabled) {
        if (!isTradingAllowed(params.symbol, params.sessionFilter)) {
          errors.push(`Trading ${params.symbol} not allowed in current market session`);
          return {
            valid: false,
            errors,
            warnings
          };
        }
      }

      // Detect current market regime if regime detection is enabled
      let currentRegime: MarketRegime | null = null;
      let regimeConfidence = 0;
      let regimeBasedRiskParams: RegimeBasedRiskParams | null = null;
      
      if (params.regimeDetection) {
        try {
          // Import regime detector dynamically to avoid circular dependencies
          const { MarketRegimeDetector } = await import('../market/regime-detector');
          const { MarketRegimeAdapter } = await import('../trading/regime-adapter');
          
          const regimeDetector = new MarketRegimeDetector(params.regimeDetection);
          const regimeAdapter = new MarketRegimeAdapter();
          
          // Detect current regime
          const regimeResult = await regimeDetector.detectRegime(
            params.symbol,
            params.timeframe || 'H1',
            marketData
          );
          
          currentRegime = regimeResult.regime;
          regimeConfidence = regimeResult.confidence;
          
          // Get regime-based risk adjustments
          const regimeAdjustments = regimeAdapter.adjustStrategy(currentRegime);
          regimeBasedRiskParams = {
            regimeRiskMultipliers: {
              [MarketRegime.TRENDING_UP]: { positionSize: 1.2, stopLoss: 1.2, takeProfit: 1.5, maxDrawdown: 1.1, maxDailyLoss: 1.0 },
              [MarketRegime.TRENDING_DOWN]: { positionSize: 1.1, stopLoss: 1.2, takeProfit: 1.4, maxDrawdown: 1.1, maxDailyLoss: 1.0 },
              [MarketRegime.RANGING]: { positionSize: 0.8, stopLoss: 0.9, takeProfit: 0.8, maxDrawdown: 0.9, maxDailyLoss: 0.8 },
              [MarketRegime.VOLATILE]: { positionSize: 0.6, stopLoss: 1.5, takeProfit: 1.2, maxDrawdown: 0.7, maxDailyLoss: 0.6 }
            },
            reduceInVolatile: true,
            increaseInTrending: true,
            useRegimeTransitions: true,
            maxPositionSizePerRegime: {
              [MarketRegime.TRENDING_UP]: 2.0,
              [MarketRegime.TRENDING_DOWN]: 2.0,
              [MarketRegime.RANGING]: 1.5,
              [MarketRegime.VOLATILE]: 1.0
            },
            maxExposurePerRegime: {
              [MarketRegime.TRENDING_UP]: 20.0,
              [MarketRegime.TRENDING_DOWN]: 20.0,
              [MarketRegime.RANGING]: 15.0,
              [MarketRegime.VOLATILE]: 10.0
            }
          };
          
          // Skip trade if regime confidence is too low
          if (regimeConfidence < (params.regimeDetection.minConfidence || 70)) {
            errors.push(`Regime confidence too low (${regimeConfidence}%) for ${currentRegime} regime`);
            return {
              valid: false,
              errors,
              warnings
            };
          }
          
          // Add regime information to warnings
          warnings.push(`Current market regime: ${currentRegime} (${regimeConfidence}% confidence)`);
          
          // Apply regime-specific warnings
          switch (currentRegime) {
            case MarketRegime.VOLATILE:
              warnings.push('High volatility detected - reduced position size and wider stops recommended');
              break;
            case MarketRegime.RANGING:
              warnings.push('Ranging market detected - tighter stops and smaller targets recommended');
              break;
            case MarketRegime.TRENDING_UP:
              warnings.push('Strong uptrend detected - larger targets and wider stops recommended');
              break;
            case MarketRegime.TRENDING_DOWN:
              warnings.push('Strong downtrend detected - larger targets and wider stops recommended');
              break;
          }
          
        } catch (error) {
          logger.error('Regime detection failed during trade validation', error as Error, { params });
          warnings.push('Regime detection failed - using standard risk parameters');
        }
      }
      
      // Validate correlation filter if enabled
      if (params.correlationFilter?.enabled) {
        const correlationValidation = await this.validateCorrelationFilter(params, params.correlationFilter);
        errors.push(...correlationValidation.errors);
        warnings.push(...correlationValidation.warnings);
        
        // If correlation validation fails, return early
        if (!correlationValidation.valid) {
          return {
            valid: false,
            errors,
            warnings
          };
        }
      }
      
      // Get user's risk parameters
      const riskParams = await this.getRiskParameters(params.userId);
      
      // Get account information
      const accountInfo = await this.getAccountInfo(params.userId);
      
      // Get symbol information
      const symbolInfo = this.getSymbolInfo(params.symbol);
      
      // Check correlation-based position limits
      if (params.correlationFilter?.enabled) {
        const positionLimits = await this.calculateCorrelationBasedPositionLimits(
          params.userId,
          params.correlationFilter
        );
        
        const baseCurrency = params.symbol.slice(0, 3);
        const maxPositionSize = positionLimits[baseCurrency] || riskParams.maxLotSize;
        
        if (params.lotSize > maxPositionSize) {
          errors.push(`Position size ${params.lotSize} exceeds correlation-based limit ${maxPositionSize.toFixed(2)} for ${baseCurrency} pairs`);
          
          // Suggest adjusted lot size
          adjustedParams = {
            ...params,
            lotSize: maxPositionSize
          };
          
          warnings.push(`Position size adjusted to correlation-based limit: ${maxPositionSize.toFixed(2)}`);
        }
      }
      
      // Handle ATR-based validation if enabled
      if (params.dynamicRisk?.useATRSizing && params.currentATR) {
        // Validate ATR multiplier
        if (params.dynamicRisk.atrMultiplier < 1 || params.dynamicRisk.atrMultiplier > 3) {
          errors.push(`ATR multiplier ${params.dynamicRisk.atrMultiplier} must be between 1 and 3`);
        }
        
        // Calculate ATR-based stop loss if not provided
        let atrStopLoss = params.stopLoss;
        if (!params.stopLoss || params.stopLoss === 0) {
          atrStopLoss = this.calculateATRStopLoss(
            params.entryPrice,
            params.currentATR,
            params.dynamicRisk.atrMultiplier,
            params.type
          );
          warnings.push(`ATR-based stop loss calculated at ${atrStopLoss.toFixed(5)}`);
        }
        
        // Calculate ATR-based position size
        let atrPositionSize = this.calculateATRPositionSize(
          accountInfo.balance,
          params.dynamicRisk.riskPercentage,
          params.currentATR,
          params.dynamicRisk.atrMultiplier,
          params.symbol,
          params.dynamicRisk,
          params.sessionFilter
        );
        
        // Apply regime-based adjustments to position size
        if (regimeBasedRiskParams && currentRegime) {
          const regimeMultiplier = regimeBasedRiskParams.regimeRiskMultipliers[currentRegime].positionSize;
          atrPositionSize = atrPositionSize * regimeMultiplier;
          
          // Apply regime-specific maximum position size
          const maxRegimePositionSize = regimeBasedRiskParams.maxPositionSizePerRegime[currentRegime];
          atrPositionSize = Math.min(atrPositionSize, maxRegimePositionSize);
          
          warnings.push(`Position size adjusted by ${regimeMultiplier}x for ${currentRegime} regime`);
        }
        
        // Validate lot size against ATR calculation
        if (params.dynamicRisk.autoAdjustLotSize && Math.abs(params.lotSize - atrPositionSize) > 0.01) {
          adjustedParams = {
            ...params,
            lotSize: atrPositionSize,
            stopLoss: atrStopLoss
          };
          warnings.push(`Position size adjusted to ${atrPositionSize.toFixed(2)} based on ATR and regime`);
        }
        
        // Check volatility adjustment
        if (params.dynamicRisk.reduceInHighVolatility && params.currentATR > params.dynamicRisk.volatilityThreshold) {
          warnings.push(`High volatility detected (ATR: ${params.currentATR.toFixed(5)}), position size reduced`);
        }
      } else {
        // Traditional validation
        // Validate lot size
        let maxLotSize = riskParams.maxLotSize;
        
        // Apply regime-based maximum lot size
        if (regimeBasedRiskParams && currentRegime) {
          const regimeMultiplier = regimeBasedRiskParams.regimeRiskMultipliers[currentRegime].positionSize;
          maxLotSize = riskParams.maxLotSize * regimeMultiplier;
          
          // Apply regime-specific maximum position size
          const maxRegimePositionSize = regimeBasedRiskParams.maxPositionSizePerRegime[currentRegime];
          maxLotSize = Math.min(maxLotSize, maxRegimePositionSize);
        }
        
        if (params.lotSize < symbolInfo.minLot) {
          errors.push(`Lot size ${params.lotSize} is below minimum ${symbolInfo.minLot}`);
        }
        if (params.lotSize > symbolInfo.maxLot) {
          errors.push(`Lot size ${params.lotSize} exceeds maximum ${symbolInfo.maxLot}`);
        }
        if (params.lotSize > maxLotSize) {
          errors.push(`Lot size ${params.lotSize} exceeds regime-adjusted risk limit ${maxLotSize.toFixed(2)}`);
        }
      }
      
      // Validate stop loss distance
      const stopLossPips = this.calculatePipDistance(params.entryPrice, params.stopLoss, params.symbol);
      if (stopLossPips < riskParams.minStopLossDistance) {
        errors.push(`Stop loss distance ${stopLossPips.toFixed(2)} pips is below minimum ${riskParams.minStopLossDistance} pips`);
      }
      
      // Calculate position risk
      const positionRisk = this.calculatePositionRisk(params, accountInfo, symbolInfo);
      if (positionRisk.riskPercent > riskParams.maxRiskPerTrade) {
        errors.push(`Position risk ${positionRisk.riskPercent.toFixed(2)}% exceeds maximum ${riskParams.maxRiskPerTrade}%`);
        
        // Suggest adjusted lot size
        let suggestedLotSize: number;
        if (params.dynamicRisk?.useATRSizing && params.currentATR) {
          suggestedLotSize = this.calculateATRPositionSize(
            accountInfo.balance,
            params.dynamicRisk.riskPercentage,
            params.currentATR,
            params.dynamicRisk.atrMultiplier,
            params.symbol,
            params.dynamicRisk,
            params.sessionFilter
          );
        } else {
          suggestedLotSize = this.calculatePositionSize(
            accountInfo.balance,
            riskParams.maxRiskPerTrade,
            stopLossPips,
            params.symbol
          );
        }
        
        adjustedParams = {
          ...params,
          lotSize: suggestedLotSize
        };
        
        warnings.push(`Suggested lot size: ${suggestedLotSize.toFixed(2)}`);
      }
      
      // Check if user can open new position with regime-based adjustments
      let canOpen = await this.canOpenPosition(params.userId);
      
      // Apply regime-based position limits
      if (regimeBasedRiskParams && currentRegime) {
        const riskExposure = await this.getRiskExposure(params.userId);
        const maxRegimeExposure = regimeBasedRiskParams.maxExposurePerRegime[currentRegime];
        
        if (riskExposure.totalRiskExposure > maxRegimeExposure) {
          errors.push(`Cannot open new position: risk exposure ${riskExposure.totalRiskExposure.toFixed(2)} exceeds regime limit ${maxRegimeExposure} for ${currentRegime}`);
          canOpen = false;
        }
      }
      
      if (!canOpen) {
        errors.push('Cannot open new position: maximum positions reached or risk limits exceeded');
      }
      
      // Validate trading hours (simplified)
      if (!this.isWithinTradingHours(params.symbol)) {
        warnings.push('Market is closed or outside optimal trading hours');
      }
      
      // Validate spread (mocked)
      const currentSpread = this.getCurrentSpread(params.symbol);
      if (currentSpread > 20) { // 20 pips threshold
        warnings.push(`High spread detected: ${currentSpread.toFixed(2)} pips`);
      }
      
      // Validate smart exit rules if provided
      if (smartExitRules) {
        const smartExitValidation = await this.validateSmartExits(params, smartExitRules, marketData);
        errors.push(...smartExitValidation.errors);
        warnings.push(...smartExitValidation.warnings);
      }
      
      // Validate enhanced partial exits if provided
      if (params.enhancedPartialExits) {
        const partialExitValidation = await this.validateEnhancedPartialExits(params, params.enhancedPartialExits, marketData);
        errors.push(...partialExitValidation.errors);
        warnings.push(...partialExitValidation.warnings);
      }
      
      const isValid = errors.length === 0;
      
      logger.debug(`Trade validation completed`, {
        userId: params.userId,
        symbol: params.symbol,
        valid: isValid,
        errors: errors.length,
        warnings: warnings.length
      });
      
      return {
        valid: isValid,
        errors,
        warnings,
        adjustedParams
      };
    } catch (error) {
      logger.error('Error validating trade', error as Error, { params });
      return {
        valid: false,
        errors: ['Validation error: ' + (error as Error).message],
        warnings
      };
    }
  }

  /**
   * Validate smart exit rules before trade execution
   *
   * @param params Trade parameters with smart exit rules
   * @returns Validation result for smart exits
   */
  async validateSmartExits(
    params: TradeParams,
    smartExitRules: SmartExitRules,
    marketData?: any
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate stop loss rules
      const stopLossValidation = this.validateStopLossRules(params, smartExitRules.stopLoss);
      errors.push(...stopLossValidation.errors);
      warnings.push(...stopLossValidation.warnings);

      // Validate take profit rules
      const takeProfitValidation = this.validateTakeProfitRules(params, smartExitRules.takeProfit);
      errors.push(...takeProfitValidation.errors);
      warnings.push(...takeProfitValidation.warnings);

      // Calculate and validate smart exits if market data is available
      if (marketData) {
        try {
          const smartExitParams = {
            entryPrice: params.entryPrice,
            tradeType: params.type,
            atr: params.currentATR || marketData.atr,
            swingPoints: marketData.swingPoints || [],
            currentPrice: params.entryPrice,
            timestamp: new Date()
          };

          const exitResult = SmartExitCalculator.calculateExits(smartExitParams, smartExitRules);
          
          // Validate risk-reward ratio
          if (exitResult.riskRewardRatio < 1.0) {
            errors.push(`Risk-reward ratio ${exitResult.riskRewardRatio.toFixed(2)}:1 is below minimum 1:1`);
          } else if (exitResult.riskRewardRatio < 1.5) {
            warnings.push(`Risk-reward ratio ${exitResult.riskRewardRatio.toFixed(2)}:1 is below recommended 1.5:1`);
          }

          // Validate exit confidence
          if (exitResult.confidence < 50) {
            errors.push(`Smart exit confidence ${exitResult.confidence.toFixed(0)}% is too low`);
          } else if (exitResult.confidence < 70) {
            warnings.push(`Smart exit confidence ${exitResult.confidence.toFixed(0)}% could be higher`);
          }

          // Validate partial exits
          if (smartExitRules.takeProfit.type === 'partial' && smartExitRules.takeProfit.partialExits) {
            const totalPercentage = smartExitRules.takeProfit.partialExits.reduce((sum, exit) => sum + exit.percentage, 0);
            if (totalPercentage > 100) {
              errors.push(`Partial exit total percentage ${totalPercentage}% exceeds 100%`);
            } else if (totalPercentage < 50) {
              warnings.push(`Partial exit total percentage ${totalPercentage}% is low, consider closing more`);
            }
          }

          logger.debug('Smart exit validation completed', {
            symbol: params.symbol,
            type: params.type,
            riskRewardRatio: exitResult.riskRewardRatio,
            confidence: exitResult.confidence,
            errors: errors.length,
            warnings: warnings.length
          });

        } catch (error) {
          errors.push(`Smart exit calculation failed: ${(error as Error).message}`);
          logger.error('Smart exit validation error', error as Error, { params, smartExitRules });
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      logger.error('Error validating smart exits', error as Error, { params });
      return {
        valid: false,
        errors: ['Smart exit validation error: ' + (error as Error).message],
        warnings
      };
    }
  }

  /**
   * Validate stop loss rules
   */
  private validateStopLossRules(
    params: TradeParams,
    stopLossRules: SmartExitRules['stopLoss']
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (stopLossRules.type) {
      case 'atr':
        if (!stopLossRules.atrMultiplier || stopLossRules.atrMultiplier < 1 || stopLossRules.atrMultiplier > 5) {
          errors.push(`ATR multiplier ${stopLossRules.atrMultiplier} must be between 1 and 5`);
        }
        if (!params.currentATR) {
          errors.push('ATR value required for ATR-based stop loss');
        }
        break;

      case 'support':
        if (stopLossRules.useSwingPoints && (!stopLossRules.swingLookback || stopLossRules.swingLookback < 5 || stopLossRules.swingLookback > 50)) {
          errors.push(`Swing lookback ${stopLossRules.swingLookback} must be between 5 and 50`);
        }
        break;

      case 'trailing':
        warnings.push('Trailing stop loss requires active monitoring');
        break;

      case 'fixed':
        // Fixed stop loss is always valid
        break;

      default:
        errors.push(`Unknown stop loss type: ${stopLossRules.type}`);
    }

    // Validate maximum holding time
    if (stopLossRules.maxHoldingHours && (stopLossRules.maxHoldingHours < 1 || stopLossRules.maxHoldingHours > 168)) {
      errors.push(`Maximum holding time ${stopLossRules.maxHoldingHours} hours must be between 1 and 168 (1 week)`);
    }

    return { errors, warnings };
  }

  /**
   * Validate take profit rules
   */
  private validateTakeProfitRules(
    params: TradeParams,
    takeProfitRules: SmartExitRules['takeProfit']
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (takeProfitRules.type) {
      case 'rr_ratio':
        if (!takeProfitRules.rrRatio || takeProfitRules.rrRatio < 0.5 || takeProfitRules.rrRatio > 10) {
          errors.push(`Risk-reward ratio ${takeProfitRules.rrRatio} must be between 0.5 and 10`);
        }
        break;

      case 'partial':
        if (!takeProfitRules.partialExits || takeProfitRules.partialExits.length === 0) {
          errors.push('Partial exits configuration required for partial take profit');
        }
        
        if (takeProfitRules.partialExits) {
          takeProfitRules.partialExits.forEach((exit, index) => {
            if (exit.percentage <= 0 || exit.percentage > 100) {
              errors.push(`Partial exit ${index + 1} percentage ${exit.percentage}% must be between 0 and 100`);
            }
            if (exit.atRR < 0.5 || exit.atRR > 10) {
              errors.push(`Partial exit ${index + 1} RR ratio ${exit.atRR}:1 must be between 0.5 and 10`);
            }
          });
        }
        break;

      case 'resistance':
        warnings.push('Resistance-based take profit requires swing point analysis');
        break;

      case 'fixed':
        // Fixed take profit is always valid
        break;

      default:
        errors.push(`Unknown take profit type: ${takeProfitRules.type}`);
    }

    return { errors, warnings };
  }

  /**
   * Check if user can open new position based on their current exposure
   * 
   * @param userId User ID to check
   * @returns True if user can open new position
   */
  async canOpenPosition(userId: string): Promise<boolean> {
    try {
      const riskParams = await this.getRiskParameters(userId);
      const riskExposure = await this.getRiskExposure(userId);
      
      // Check if any limits are exceeded
      if (riskExposure.limitsExceeded) {
        return false;
      }
      
      // Check maximum positions
      if (riskExposure.openPositions >= riskParams.maxPositions) {
        return false;
      }
      
      // Check daily loss limit
      if (riskExposure.dailyLossPercent >= riskParams.maxDailyLoss) {
        return false;
      }
      
      // Check drawdown limit
      if (riskExposure.drawdownPercent >= riskParams.maxDrawdown) {
        return false;
      }
      
      // Check available margin
      if (riskExposure.availableMargin <= 0) {
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error('Error checking if user can open position', error as Error, { userId });
      return false;
    }
  }

  /**
   * Get current risk exposure for a user
   * 
   * @param userId User ID to check
   * @returns Current risk exposure information
   */
  async getRiskExposure(userId: string): Promise<RiskExposure> {
    try {
      const riskParams = await this.getRiskParameters(userId);
      const accountInfo = await this.getAccountInfo(userId);
      const openPositions = await this.getOpenPositions(userId);
      
      // Calculate total risk exposure
      let totalRiskExposure = 0;
      let totalDailyLoss = 0;
      
      for (const position of openPositions) {
        // Calculate risk for each position (simplified)
        const positionRisk = Math.abs(position.profit);
        totalRiskExposure += positionRisk;
        
        // Check if position was opened today (simplified)
        if (this.isPositionFromToday(position)) {
          if (position.profit < 0) {
            totalDailyLoss += Math.abs(position.profit);
          }
        }
      }
      
      // Calculate percentages
      const riskExposurePercent = accountInfo.balance > 0 
        ? (totalRiskExposure / accountInfo.balance) * 100 
        : 0;
      
      const dailyLossPercent = accountInfo.balance > 0 
        ? (totalDailyLoss / accountInfo.balance) * 100 
        : 0;
      
      // Calculate drawdown (simplified - would need historical data in real implementation)
      const currentDrawdown = Math.max(0, accountInfo.balance - accountInfo.equity);
      const drawdownPercent = accountInfo.balance > 0 
        ? (currentDrawdown / accountInfo.balance) * 100 
        : 0;
      
      // Check for violations
      const violations: RiskViolation[] = [];
      
      if (dailyLossPercent > riskParams.maxDailyLoss) {
        violations.push({
          type: 'MAX_DAILY_LOSS',
          currentValue: dailyLossPercent,
          limit: riskParams.maxDailyLoss,
          severity: dailyLossPercent > riskParams.maxDailyLoss * 1.5 ? 'EMERGENCY' : 'CRITICAL',
          message: `Daily loss ${dailyLossPercent.toFixed(2)}% exceeds limit ${riskParams.maxDailyLoss}%`
        });
      }
      
      if (drawdownPercent > riskParams.maxDrawdown) {
        violations.push({
          type: 'MAX_DRAWDOWN',
          currentValue: drawdownPercent,
          limit: riskParams.maxDrawdown,
          severity: drawdownPercent > riskParams.maxDrawdown * 1.5 ? 'EMERGENCY' : 'CRITICAL',
          message: `Drawdown ${drawdownPercent.toFixed(2)}% exceeds limit ${riskParams.maxDrawdown}%`
        });
      }
      
      if (openPositions.length > riskParams.maxPositions) {
        violations.push({
          type: 'MAX_POSITIONS',
          currentValue: openPositions.length,
          limit: riskParams.maxPositions,
          severity: 'WARNING',
          message: `Open positions ${openPositions.length} exceeds limit ${riskParams.maxPositions}`
        });
      }
      
      if (riskExposurePercent > riskParams.maxRiskPerTrade * riskParams.maxPositions) {
        violations.push({
          type: 'MAX_RISK_EXPOSURE',
          currentValue: riskExposurePercent,
          limit: riskParams.maxRiskPerTrade * riskParams.maxPositions,
          severity: 'WARNING',
          message: `Total risk exposure ${riskExposurePercent.toFixed(2)}% exceeds safe limit`
        });
      }
      
      return {
        balance: accountInfo.balance,
        totalRiskExposure,
        riskExposurePercent,
        openPositions: openPositions.length,
        dailyLoss: totalDailyLoss,
        dailyLossPercent,
        currentDrawdown,
        drawdownPercent,
        availableMargin: accountInfo.freeMargin,
        limitsExceeded: violations.length > 0,
        violations
      };
    } catch (error) {
      logger.error('Error getting risk exposure', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Emergency close all positions for a user
   * 
   * @param userId User ID to close positions for
   * @param reason Reason for emergency close
   * @returns Result of emergency close operation
   */
  async emergencyCloseAll(userId: string, reason: string): Promise<void> {
    try {
      logger.warn(`Emergency close all positions initiated`, { userId, reason });
      
      const openPositions = await this.getOpenPositions(userId);
      
      if (openPositions.length === 0) {
        logger.info(`No open positions to close for user ${userId}`);
        return;
      }
      
      const results: TradeResult[] = [];
      let totalPnL = 0;
      const errors: string[] = [];
      
      // Close each position
      for (const position of openPositions) {
        try {
          const result = await this.closePosition(position.ticket, position.lotSize);
          results.push(result);
          
          if (result.success && result.executedLotSize) {
            // Calculate P&L (simplified)
            const pnl = (position.currentPrice - position.openPrice) * 
                       position.lotSize * 
                       (position.type === 'BUY' ? 1 : -1);
            totalPnL += pnl;
          } else if (result.error) {
            errors.push(`Failed to close position ${position.ticket}: ${result.error}`);
          }
        } catch (error) {
          const errorMsg = `Error closing position ${position.ticket}: ${(error as Error).message}`;
          errors.push(errorMsg);
          logger.error(errorMsg, undefined, { position });
        }
      }
      
      const success = errors.length === 0;
      
      logger.warn(`Emergency close all positions completed`, {
        userId,
        reason,
        positionsClosed: results.filter(r => r.success).length,
        totalPositions: openPositions.length,
        totalPnL,
        success,
        errors: errors.length
      });
      
      if (!success) {
        throw new Error(`Emergency close partially failed: ${errors.join(', ')}`);
      }
      
      // In a real implementation, this would also:
      // 1. Send notifications to the user
      // 2. Log the emergency event for audit
      // 3. Temporarily disable trading for the user
      // 4. Send alerts to administrators
      
    } catch (error) {
      logger.error('Emergency close all positions failed', error as Error, { userId, reason });
      throw error;
    }
  }

  // Helper methods (mocked implementations - would connect to real broker/database)
  
  private getSymbolInfo(symbol: string): SymbolInfo {
    // Mock implementation - would fetch from broker
    return {
      symbol,
      point: 0.0001,
      contractSize: 100000,
      minLot: 0.01,
      maxLot: 100,
      lotStep: 0.01,
      digits: 4,
      spread: 2,
      tradeAllowed: true
    };
  }

  private roundToLotSize(size: number, symbolInfo: SymbolInfo): number {
    const step = symbolInfo.lotStep;
    const rounded = Math.round(size / step) * step;
    return Math.max(symbolInfo.minLot, Math.min(rounded, symbolInfo.maxLot));
  }

  private calculatePipDistance(entryPrice: number, stopLoss: number, symbol: string): number {
    const symbolInfo = this.getSymbolInfo(symbol);
    return Math.abs(entryPrice - stopLoss) / symbolInfo.point;
  }

  private calculatePositionRisk(
    params: TradeParams, 
    accountInfo: AccountInfo, 
    symbolInfo: SymbolInfo
  ): { riskAmount: number; riskPercent: number } {
    const stopLossPips = this.calculatePipDistance(params.entryPrice, params.stopLoss, params.symbol);
    const pipValue = symbolInfo.contractSize * symbolInfo.point;
    const riskAmount = params.lotSize * stopLossPips * pipValue;
    const riskPercent = accountInfo.balance > 0 ? (riskAmount / accountInfo.balance) * 100 : 0;
    
    return { riskAmount, riskPercent };
  }

  private async getAccountInfo(userId: string): Promise<AccountInfo> {
    // Mock implementation - would fetch from broker
    return {
      balance: 10000,
      equity: 10000,
      margin: 0,
      freeMargin: 10000,
      marginLevel: 0,
      leverage: 100
    };
  }

  private async getOpenPositions(userId: string): Promise<Position[]> {
    // Mock implementation - would fetch from broker
    return [];
  }

  private isWithinTradingHours(symbol: string): boolean {
    // Mock implementation - would check market hours
    return true;
  }

  private getCurrentSpread(symbol: string): number {
    // Mock implementation - would fetch from broker
    return 2;
  }

  private isPositionFromToday(position: Position): boolean {
    // Mock implementation - would check position timestamp
    return true;
  }

  /**
   * Validate trade against correlation filter
   *
   * @param params Trade parameters to validate
   * @param correlationFilter Correlation filter configuration
   * @returns Validation result with any errors or warnings
   */
  async validateCorrelationFilter(
    params: TradeParams,
    correlationFilter: CorrelationFilter
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Skip validation if correlation filter is not enabled
      if (!correlationFilter.enabled) {
        return { valid: true, errors, warnings };
      }

      // Get current open positions
      const openPositions = await this.getOpenPositions(params.userId);
      
      // If no positions, no correlation conflict
      if (openPositions.length === 0) {
        return { valid: true, errors, warnings };
      }

      // Import correlation analyzer functions
      const {
        analyzeCorrelationForSignal,
        calculateCorrelationMatrix,
        validateCorrelationFilter,
        getRecommendedPairs
      } = await import('../market/correlation');

      // Validate correlation filter configuration
      const validationErrors = validateCorrelationFilter(correlationFilter);
      if (validationErrors.length > 0) {
        errors.push(...validationErrors);
        return { valid: false, errors, warnings };
      }

      // Get or calculate correlation matrix
      const pairsToAnalyze = [
        params.symbol,
        ...correlationFilter.checkPairs,
        ...getRecommendedPairs(params.symbol, correlationFilter.checkPairs)
      ].slice(0, 20); // Limit to 20 pairs for performance

      // Generate mock price data for correlation calculation
      const priceData: Record<string, any[]> = {};
      for (const pair of pairsToAnalyze) {
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

      // Convert open positions to required format
      const existingPositions = openPositions.map(pos => ({
        symbol: pos.symbol,
        size: pos.lotSize
      }));

      // Analyze correlation for current signal
      const analysisResult = analyzeCorrelationForSignal(
        params.symbol,
        existingPositions,
        correlationMatrix,
        correlationFilter
      );

      // Add warnings or errors based on analysis result
      if (analysisResult.shouldSkip) {
        errors.push(analysisResult.reason || 'Trade skipped due to high correlation with existing positions');
      } else if (analysisResult.conflictingPositions.length > 0) {
        warnings.push(analysisResult.reason || 'Moderate correlation detected with existing positions');
        
        if (analysisResult.recommendedAction === 'reduce_size' && analysisResult.adjustedPositionSize) {
          warnings.push(`Recommended position size adjustment: ${analysisResult.adjustedPositionSize.toFixed(2)} lots`);
        }
      }

      logger.debug('Correlation filter validation completed', {
        symbol: params.symbol,
        shouldSkip: analysisResult.shouldSkip,
        conflictingPositions: analysisResult.conflictingPositions.length,
        confidence: analysisResult.confidence
      });

      return {
        valid: !analysisResult.shouldSkip,
        errors,
        warnings
      };
    } catch (error) {
      logger.error('Error validating correlation filter', error as Error, { params });
      return {
        valid: false,
        errors: ['Correlation validation error: ' + (error as Error).message],
        warnings
      };
    }
  }

  /**
   * Generate mock price data for correlation analysis
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
   * Calculate correlation-based position limits
   *
   * @param userId User ID
   * @param correlationFilter Correlation filter configuration
   * @returns Maximum position size limits per currency group
   */
  async calculateCorrelationBasedPositionLimits(
    userId: string,
    correlationFilter: CorrelationFilter
  ): Promise<Record<string, number>> {
    const positionLimits: Record<string, number> = {};
    
    try {
      // Skip if correlation filter is not enabled
      if (!correlationFilter.enabled) {
        return positionLimits;
      }

      // Get user's risk parameters
      const riskParams = await this.getRiskParameters(userId);
      
      // Get account information
      const accountInfo = await this.getAccountInfo(userId);
      
      // Get current open positions
      const openPositions = await this.getOpenPositions(userId);
      
      // Group positions by base currency
      const positionsByCurrency: Record<string, Array<{ symbol: string; size: number }>> = {};
      
      for (const position of openPositions) {
        const baseCurrency = position.symbol.slice(0, 3);
        if (!positionsByCurrency[baseCurrency]) {
          positionsByCurrency[baseCurrency] = [];
        }
        positionsByCurrency[baseCurrency].push({
          symbol: position.symbol,
          size: position.lotSize
        });
      }
      
      // Calculate position limits for each currency group
      for (const [currency, positions] of Object.entries(positionsByCurrency)) {
        // Calculate total exposure for this currency group
        const totalExposure = positions.reduce((sum, pos) => sum + pos.size, 0);
        
        // Calculate maximum additional position size based on correlation risk
        // The more positions in a currency group, the lower the limit for new positions
        const baseLimit = riskParams.maxLotSize || 10.0;
        const correlationPenalty = Math.min(0.8, positions.length * 0.2); // 20% penalty per position, max 80%
        
        positionLimits[currency] = baseLimit * (1 - correlationPenalty);
      }
      
      logger.debug('Correlation-based position limits calculated', {
        userId,
        positionLimits
      });
      
      return positionLimits;
    } catch (error) {
      logger.error('Error calculating correlation-based position limits', error as Error, { userId });
      return positionLimits;
    }
  }

  private async closePosition(ticket: number, volume?: number): Promise<TradeResult> {
    // Mock implementation - would close position via broker
    return {
      success: true,
      ticket,
      executionPrice: 1.1000,
      executedLotSize: volume || 0.1,
      timestamp: new Date()
    };
  }

  /**
   * Enhanced position sizing using the comprehensive calculator
   *
   * @param params Position sizing parameters
   * @param config Position sizing configuration
   * @returns Position sizing result
   */
  async calculateEnhancedPositionSize(
    params: Omit<PositionSizingParams, 'config'>,
    config: PositionSizingConfig
  ): Promise<any> {
    try {
      const positionSizingParams: PositionSizingParams = {
        ...params,
        config
      };

      const result = await positionSizingCalculator.calculatePositionSize(positionSizingParams);
      
      logger.debug('Enhanced position size calculated', {
        method: config.method,
        symbol: params.symbol,
        positionSize: result.positionSize,
        riskPercentage: result.riskPercentage,
        confidence: result.confidence
      });

      return result;
    } catch (error) {
      logger.error('Error calculating enhanced position size', error as Error, { params, config });
      throw error;
    }
  }

  /**
   * Validate position sizing configuration
   *
   * @param config Position sizing configuration
   * @returns Validation result
   */
  validatePositionSizingConfig(config: PositionSizingConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Validate method
      if (!config.method) {
        errors.push('Position sizing method is required');
      }

      // Validate common settings
      if (config.minPositionSize <= 0) {
        errors.push('Minimum position size must be greater than 0');
      }

      if (config.maxPositionSize <= config.minPositionSize) {
        errors.push('Maximum position size must be greater than minimum position size');
      }

      if (config.positionSizeStep <= 0) {
        errors.push('Position size step must be greater than 0');
      }

      // Validate method-specific settings
      switch (config.method) {
        case 'fixed_lot':
          if (!config.fixedLot) {
            errors.push('Fixed lot configuration is required for fixed lot method');
          } else {
            if (config.fixedLot.lotSize <= 0) {
              errors.push('Fixed lot size must be greater than 0');
            }
            if (config.fixedLot.maxPositions <= 0) {
              errors.push('Maximum positions must be greater than 0');
            }
          }
          break;

        case 'percentage_risk':
          if (!config.percentageRisk) {
            errors.push('Percentage risk configuration is required for percentage risk method');
          } else {
            if (config.percentageRisk.riskPercentage <= 0 || config.percentageRisk.riskPercentage > 10) {
              errors.push('Risk percentage must be between 0 and 10');
            }
            if (config.percentageRisk.maxRiskPerTrade <= 0 || config.percentageRisk.maxRiskPerTrade > 10) {
              errors.push('Maximum risk per trade must be between 0 and 10');
            }
          }
          break;

        case 'atr_based':
          if (!config.atrBased) {
            errors.push('ATR-based configuration is required for ATR-based method');
          } else {
            if (config.atrBased.atrMultiplier < 1 || config.atrBased.atrMultiplier > 5) {
              errors.push('ATR multiplier must be between 1 and 5');
            }
            if (config.atrBased.riskPercentage <= 0 || config.atrBased.riskPercentage > 10) {
              errors.push('Risk percentage must be between 0 and 10');
            }
            if (config.atrBased.minATR >= config.atrBased.maxATR) {
              errors.push('Minimum ATR must be less than maximum ATR');
            }
          }
          break;

        case 'volatility_based':
          if (!config.volatilityBased) {
            errors.push('Volatility-based configuration is required for volatility-based method');
          } else {
            if (config.volatilityBased.volatilityPeriod <= 0) {
              errors.push('Volatility period must be greater than 0');
            }
            if (config.volatilityBased.volatilityMultiplier <= 0) {
              errors.push('Volatility multiplier must be greater than 0');
            }
            if (config.volatilityBased.riskPercentage <= 0 || config.volatilityBased.riskPercentage > 10) {
              errors.push('Risk percentage must be between 0 and 10');
            }
          }
          break;

        case 'kelly_criterion':
          if (!config.kellyCriterion) {
            errors.push('Kelly criterion configuration is required for Kelly criterion method');
          } else {
            if (config.kellyCriterion.winRate < 0 || config.kellyCriterion.winRate > 1) {
              errors.push('Win rate must be between 0 and 1');
            }
            if (config.kellyCriterion.avgWin <= 0) {
              errors.push('Average win must be greater than 0');
            }
            if (config.kellyCriterion.avgLoss <= 0) {
              errors.push('Average loss must be greater than 0');
            }
            if (config.kellyCriterion.kellyFraction <= 0 || config.kellyCriterion.kellyFraction > 1) {
              errors.push('Kelly fraction must be between 0 and 1');
            }
            if (config.kellyCriterion.maxPositionSize <= 0) {
              errors.push('Maximum position size must be greater than 0');
            }
          }
          break;

        case 'account_equity':
          if (!config.accountEquity) {
            errors.push('Account equity configuration is required for account equity method');
          } else {
            if (config.accountEquity.equityPercentage <= 0 || config.accountEquity.equityPercentage > 10) {
              errors.push('Equity percentage must be between 0 and 10');
            }
            if (config.accountEquity.maxDrawdown <= 0 || config.accountEquity.maxDrawdown > 100) {
              errors.push('Maximum drawdown must be between 0 and 100');
            }
          }
          break;
      }

      // Validate risk limits
      if (config.maxDailyLoss <= 0 || config.maxDailyLoss > 50) {
        errors.push('Maximum daily loss must be between 0 and 50');
      }

      if (config.maxDrawdown <= 0 || config.maxDrawdown > 100) {
        errors.push('Maximum drawdown must be between 0 and 100');
      }

      if (config.maxTotalExposure <= 0 || config.maxTotalExposure > 200) {
        errors.push('Maximum total exposure must be between 0 and 200');
      }

      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      logger.error('Error validating position sizing config', error as Error, { config });
      return {
        valid: false,
        errors: ['Validation error: ' + (error as Error).message]
      };
    }
  }

  /**
   * Get recommended position sizing configuration based on user profile
   *
   * @param userProfile User profile information
   * @param accountBalance Account balance
   * @returns Recommended configuration
   */
  getRecommendedPositionSizingConfig(
    userProfile: {
      experienceLevel: 'beginner' | 'intermediate' | 'advanced';
      riskTolerance: 'conservative' | 'moderate' | 'aggressive';
    },
    accountBalance: number
  ): PositionSizingConfig {
    try {
      let method: SizingMethod;
      let config: Partial<PositionSizingConfig> = {};

      // Determine method based on experience level
      switch (userProfile.experienceLevel) {
        case 'beginner':
          method = 'percentage_risk';
          config = {
            percentageRisk: {
              riskPercentage: userProfile.riskTolerance === 'conservative' ? 0.5 :
                            userProfile.riskTolerance === 'moderate' ? 1.0 : 1.5,
              maxRiskPerTrade: 2.0,
              maxDailyRisk: 3.0
            }
          };
          break;

        case 'intermediate':
          method = 'atr_based';
          config = {
            atrBased: {
              atrMultiplier: 2.0,
              riskPercentage: userProfile.riskTolerance === 'conservative' ? 1.0 :
                            userProfile.riskTolerance === 'moderate' ? 1.5 : 2.0,
              volatilityAdjustment: true,
              minATR: 0.0005,
              maxATR: 0.005
            }
          };
          break;

        case 'advanced':
          method = userProfile.riskTolerance === 'aggressive' ? 'kelly_criterion' : 'account_equity';
          if (method === 'kelly_criterion') {
            config = {
              kellyCriterion: {
                winRate: 0.55, // Default assumption
                avgWin: 100,
                avgLoss: 50,
                kellyFraction: 0.25, // Conservative Kelly
                maxPositionSize: 2.0
              }
            };
          } else {
            config = {
              accountEquity: {
                equityPercentage: userProfile.riskTolerance === 'conservative' ? 1.0 :
                                userProfile.riskTolerance === 'moderate' ? 1.5 : 2.0,
                drawdownAdjustment: true,
                maxDrawdown: 20.0,
                equityCurveAdjustment: true
              }
            };
          }
          break;
      }

      // Set common settings based on account balance
      const maxPositionSize = accountBalance < 1000 ? 0.1 :
                           accountBalance < 10000 ? 1.0 :
                           accountBalance < 100000 ? 5.0 : 10.0;

      return {
        method,
        ...config,
        maxPositionSize,
        minPositionSize: 0.01,
        positionSizeStep: 0.01,
        maxDailyLoss: userProfile.riskTolerance === 'conservative' ? 3.0 :
                     userProfile.riskTolerance === 'moderate' ? 5.0 : 8.0,
        maxDrawdown: userProfile.riskTolerance === 'conservative' ? 15.0 :
                    userProfile.riskTolerance === 'moderate' ? 20.0 : 30.0,
        maxTotalExposure: userProfile.riskTolerance === 'conservative' ? 25.0 :
                         userProfile.riskTolerance === 'moderate' ? 50.0 : 75.0
      };
    } catch (error) {
      logger.error('Error generating recommended position sizing config', error as Error, { userProfile, accountBalance });
      
      // Return safe default
      return PositionSizingCalculator.getDefaultConfig('percentage_risk');
    }
  }

  /**
   * Validate enhanced partial exits configuration
   *
   * @param params Trade parameters with enhanced partial exits
   * @param config Enhanced partial exit configuration
   * @param marketData Current market data
   * @returns Validation result for enhanced partial exits
   */
  async validateEnhancedPartialExits(
    params: TradeParams,
    config: EnhancedPartialExitConfig,
    marketData?: any
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if enhanced partial exits are enabled
      if (!config.enabled) {
        return { valid: true, errors, warnings };
      }

      // Validate configuration structure
      if (!config.levels || config.levels.length === 0) {
        errors.push('Enhanced partial exits must have at least one level configured');
        return { valid: false, errors, warnings };
      }

      // Validate each exit level
      let totalPercentage = 0;
      const levelIds = new Set<string>();

      for (let i = 0; i < config.levels.length; i++) {
        const level = config.levels[i];
        
        // Check for duplicate level IDs
        if (levelIds.has(level.id)) {
          errors.push(`Duplicate level ID: ${level.id}`);
        }
        levelIds.add(level.id);

        // Validate percentage
        if (level.percentage <= 0 || level.percentage > 100) {
          errors.push(`Level ${level.name} percentage ${level.percentage}% must be between 0 and 100`);
        }
        totalPercentage += level.percentage;

        // Validate trigger configuration
        const triggerValidation = this.validatePartialExitTrigger(level, params, marketData);
        errors.push(...triggerValidation.errors);
        warnings.push(...triggerValidation.warnings);

        // Validate priority
        if (level.priority < 1 || level.priority > 10) {
          errors.push(`Level ${level.name} priority ${level.priority} must be between 1 and 10`);
        }

        // Validate conditions if present
        if (level.conditions) {
          if (level.conditions) {
            if (Array.isArray(level.conditions)) {
              for (const condition of level.conditions) {
                const conditionValidation = this.validatePartialExitCondition(condition, params);
                errors.push(...conditionValidation.errors);
                warnings.push(...conditionValidation.warnings);
              }
            }
          }
        }
      }

      // Validate total percentage
      if (totalPercentage > 100) {
        errors.push(`Total partial exit percentage ${totalPercentage}% exceeds 100%`);
      } else if (totalPercentage < 50) {
        warnings.push(`Total partial exit percentage ${totalPercentage}% is low, consider closing more`);
      }

      // Validate risk management settings
      // Validate global settings
      if (config.globalSettings) {
        const globalValidation = this.validatePartialExitGlobalSettings(config.globalSettings, params);
        errors.push(...globalValidation.errors);
        warnings.push(...globalValidation.warnings);
      }

      // Validate performance tracking settings
      if (config.performanceTracking?.enabled) {
        const performanceValidation = this.validatePartialExitPerformanceTracking(config.performanceTracking, params);
        errors.push(...performanceValidation.errors);
        warnings.push(...performanceValidation.warnings);
      }

      // Validate integration settings
      if (config.integration) {
        const integrationValidation = this.validatePartialExitIntegration(config.integration, params);
        errors.push(...integrationValidation.errors);
        warnings.push(...integrationValidation.warnings);
      }

      // Test the configuration with a mock scenario
      if (errors.length === 0 && marketData) {
        try {
          const partialExitManager = createPartialExitManager(config);
          
          const testParams = {
            tradeId: 'test_validation',
            symbol: params.symbol,
            entryPrice: params.entryPrice,
            currentPrice: params.entryPrice,
            tradeType: params.type,
            originalQuantity: params.lotSize,
            remainingQuantity: params.lotSize,
            entryTime: new Date(),
            atr: params.currentATR || 0.001,
            volatility: marketData.volatility || 0.01,
            spread: marketData.spread || 0.0001,
            currentRegime: marketData.regime || 'ranging',
            regimeConfidence: marketData.regimeConfidence || 70,
            currentSession: marketData.session || 'unknown',
            config
          };

          const testResult = await partialExitManager.calculatePartialExits(testParams);
          
          if (!testResult.shouldExit && testResult.recommendedExits.length === 0) {
            errors.push(`Partial exit configuration test failed: No valid exit recommendations generated`);
          }

          logger.debug('Enhanced partial exits validation test completed', {
            symbol: params.symbol,
            valid: testResult.shouldExit || testResult.recommendedExits.length > 0,
            shouldExit: testResult.shouldExit,
            recommendedExits: testResult.recommendedExits.length
          });

        } catch (error) {
          errors.push(`Partial exit configuration test failed: ${(error as Error).message}`);
          logger.error('Enhanced partial exits validation test error', error as Error, { params });
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      logger.error('Error validating enhanced partial exits', error as Error, { params });
      return {
        valid: false,
        errors: ['Enhanced partial exits validation error: ' + (error as Error).message],
        warnings
      };
    }
  }

  /**
   * Validate partial exit trigger configuration
   */
  private validatePartialExitTrigger(
    level: PartialExitLevel,
    params: TradeParams,
    marketData?: any
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      switch (level.triggerType) {
        case 'profit':
          if (!level.profitTarget) {
            errors.push('Profit target configuration is required for profit-based triggers');
          } else {
            if (level.profitTarget.value <= 0) {
              errors.push('Profit target value must be greater than 0');
            }
            if (level.profitTarget.type === 'percentage' && level.profitTarget.value > 100) {
              warnings.push('Profit target over 100% may be unrealistic');
            }
          }
          break;

        case 'time':
          if (!level.timeTarget) {
            errors.push('Time target configuration is required for time-based triggers');
          } else {
            if (level.timeTarget.value <= 0) {
              errors.push('Time target value must be greater than 0');
            }
            if (level.timeTarget.type === 'duration' && level.timeTarget.value > 1440) {
              warnings.push('Time target over 24 hours may be too long for intraday trading');
            }
          }
          break;

        case 'price':
          if (!level.priceTarget) {
            errors.push('Price target configuration is required for price-based triggers');
          } else {
            if (level.priceTarget.value <= 0) {
              errors.push('Price target value must be greater than 0');
            }
          }
          break;

        case 'atr':
          if (!params.currentATR) {
            errors.push('ATR value is required for ATR-based triggers');
          }
          if (!level.atrTarget) {
            errors.push('ATR target configuration is required for ATR-based triggers');
          } else {
            if (level.atrTarget.multiplier <= 0) {
              errors.push('ATR multiplier must be greater than 0');
            }
            if (level.atrTarget.multiplier > 10) {
              warnings.push('ATR multiplier over 10 may be too large');
            }
          }
          break;

        case 'trailing':
          if (!level.trailingTarget) {
            errors.push('Trailing target configuration is required for trailing triggers');
          } else {
            if (level.trailingTarget.distance <= 0) {
              errors.push('Trailing distance must be greater than 0');
            }
          }
          warnings.push('Trailing exits require active monitoring');
          break;

        case 'regime':
          if (!level.regimeTarget) {
            errors.push('Regime target configuration is required for regime-based triggers');
          } else {
            if (marketData && marketData.regime !== level.regimeTarget.regime) {
              warnings.push(`Current regime ${marketData.regime} not in target regime ${level.regimeTarget.regime}`);
            }
          }
          break;

        default:
          errors.push(`Unknown trigger type: ${level.triggerType}`);
      }
    } catch (error) {
      errors.push(`Trigger validation error: ${(error as Error).message}`);
    }

    return { errors, warnings };
  }

  /**
   * Validate partial exit condition
   */
  private validatePartialExitCondition(
    condition: any,
    params: TradeParams
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      switch (condition.type) {
        case 'time_range':
          if (!condition.value || typeof condition.value !== 'object') {
            errors.push('Time range condition requires a valid time range object');
          }
          break;

        case 'market_session':
          if (!condition.value || typeof condition.value !== 'string') {
            errors.push('Market session condition requires a valid session string');
          }
          break;

        case 'volatility':
          if (typeof condition.value !== 'number' || condition.value <= 0) {
            errors.push('Volatility condition requires a positive number');
          }
          break;

        case 'regime':
          if (!condition.value || typeof condition.value !== 'string') {
            errors.push('Regime condition requires a valid regime string');
          }
          break;

        default:
          errors.push(`Unknown condition type: ${condition.type}`);
      }

      if (!condition.operator) {
        errors.push('Operator is required for conditions');
      }
    } catch (error) {
      errors.push(`Condition validation error: ${(error as Error).message}`);
    }

    return { errors, warnings };
  }

  /**
   * Validate partial exit risk management settings
   */
  private validatePartialExitRiskManagement(
    globalSettings: EnhancedPartialExitConfig['globalSettings'],
    params: TradeParams
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (globalSettings.maxDailyPartialExits < 1 || globalSettings.maxDailyPartialExits > 50) {
        errors.push('Max daily partial exits must be between 1 and 50');
      }

      if (globalSettings.minRemainingPosition <= 0 || globalSettings.minRemainingPosition >= 100) {
        errors.push('Minimum remaining position must be between 0 and 100 percent');
      }

      if (globalSettings.cooldownPeriod < 0 || globalSettings.cooldownPeriod > 1440) {
        errors.push('Cooldown period must be between 0 and 1440 minutes (24 hours)');
      }

      if (globalSettings.maxSpreadPercentage <= 0 || globalSettings.maxSpreadPercentage > 10) {
        errors.push('Max spread percentage must be between 0 and 10');
      }

      if (globalSettings.newsBufferMinutes < 0 || globalSettings.newsBufferMinutes > 120) {
        errors.push('News buffer minutes must be between 0 and 120');
      }
    } catch (error) {
      errors.push(`Global settings validation error: ${(error as Error).message}`);
    }

    return { errors, warnings };
  }

  /**
   * Validate partial exit dynamic adjustment settings
   */
  private validatePartialExitDynamicAdjustment(
    performanceTracking: EnhancedPartialExitConfig['performanceTracking'],
    params: TradeParams
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (performanceTracking.enabled && performanceTracking.lookbackPeriod < 7) {
        warnings.push('Lookback period less than 7 days may not provide reliable optimization data');
      }

      if (performanceTracking.enabled && performanceTracking.lookbackPeriod > 365) {
        warnings.push('Lookback period over 1 year may not reflect current market conditions');
      }

      if (performanceTracking.optimizeLevels && !performanceTracking.trackEffectiveness) {
        errors.push('Track effectiveness must be enabled to optimize levels');
      }
    } catch (error) {
      errors.push(`Performance tracking validation error: ${(error as Error).message}`);
    }

    return { errors, warnings };
  }

  /**
   * Calculate risk-adjusted position size considering partial exits
   *
   * @param params Trade parameters
   * @param config Enhanced partial exit configuration
   * @returns Risk-adjusted position size
   */
  async calculateRiskAdjustedPositionSize(
    params: TradeParams,
    config: EnhancedPartialExitConfig
  ): Promise<number> {
    try {
      if (!config.enabled || !config.levels || config.levels.length === 0) {
        return params.lotSize; // No adjustment if partial exits not configured
      }

      // Calculate expected partial exit timeline
      const partialExitManager = createPartialExitManager(config);
      
      const testParams = {
        tradeId: 'risk_calculation',
        symbol: params.symbol,
        entryPrice: params.entryPrice,
        currentPrice: params.entryPrice,
        tradeType: params.type,
        originalQuantity: params.lotSize,
        remainingQuantity: params.lotSize,
        entryTime: new Date(),
        atr: params.currentATR || 0.001,
        volatility: 0.01,
        spread: 0.0001,
        currentRegime: 'ranging' as any,
        regimeConfidence: 70,
        currentSession: 'unknown',
        config
      };

      const result = await partialExitManager.calculatePartialExits(testParams);
      
      if (!result.shouldExit && result.recommendedExits.length === 0) {
        return params.lotSize;
      }

      // Calculate average position size over time
      let totalPositionTime = 0;
      let weightedPositionSize = 0;
      let currentSize = params.lotSize;

      // Start with full position
      weightedPositionSize += currentSize * 1; // Assume 1 hour before first exit
      totalPositionTime += 1;

      // Process each partial exit level
      for (const exit of result.recommendedExits) {
        // Reduce position size
        const reduction = currentSize * (exit.percentage / 100);
        currentSize -= reduction;
        
        // Add weighted contribution (simplified - assumes 1 hour between exits)
        weightedPositionSize += currentSize * 1;
        totalPositionTime += 1;
      }

      // Add remaining position time (assume 4 more hours)
      weightedPositionSize += currentSize * 4;
      totalPositionTime += 4;

      // Calculate average position size
      const averagePositionSize = weightedPositionSize / totalPositionTime;
      
      // Apply risk adjustment factor (reduce position size if many partial exits)
      const riskAdjustmentFactor = Math.max(0.8, 1 - (result.recommendedExits.length * 0.05));
      
      const adjustedSize = params.lotSize * riskAdjustmentFactor * (averagePositionSize / params.lotSize);
      
      logger.debug('Risk-adjusted position size calculated for partial exits', {
        originalSize: params.lotSize,
        adjustedSize,
        averagePositionSize,
        riskAdjustmentFactor,
        partialExitCount: result.recommendedExits.length
      });

      return adjustedSize;
    } catch (error) {
      logger.error('Error calculating risk-adjusted position size', error as Error, { params });
      return params.lotSize; // Return original size on error
    }
  }

  /**
   * Validate partial exit global settings
   */
  private validatePartialExitGlobalSettings(
      globalSettings: any,
      params: TradeParams
    ): { errors: string[]; warnings: string[] } {
      const errors: string[] = [];
      const warnings: string[] = [];
  
      try {
        if (globalSettings.maxDailyPartialExits < 1 || globalSettings.maxDailyPartialExits > 50) {
          errors.push('Max daily partial exits must be between 1 and 50');
        }
  
        if (globalSettings.minRemainingPosition <= 0 || globalSettings.minRemainingPosition >= 100) {
          errors.push('Minimum remaining position must be between 0 and 100 percent');
        }
  
        if (globalSettings.cooldownPeriod < 0 || globalSettings.cooldownPeriod > 1440) {
          errors.push('Cooldown period must be between 0 and 1440 minutes (24 hours)');
        }
  
        if (globalSettings.volatilityThreshold <= 0 || globalSettings.volatilityThreshold > 1) {
          errors.push('Volatility threshold must be between 0 and 1');
        }
  
        if (globalSettings.maxSpreadPercentage <= 0 || globalSettings.maxSpreadPercentage > 10) {
          errors.push('Max spread percentage must be between 0 and 10');
        }
  
        if (globalSettings.newsBufferMinutes < 0 || globalSettings.newsBufferMinutes > 120) {
          errors.push('News buffer minutes must be between 0 and 120');
        }
      } catch (error) {
        errors.push(`Global settings validation error: ${(error as Error).message}`);
      }
  
      return { errors, warnings };
    }
  
    /**
     * Validate partial exit performance tracking settings
     */
    private validatePartialExitPerformanceTracking(
      performanceTracking: any,
      params: TradeParams
    ): { errors: string[]; warnings: string[] } {
      const errors: string[] = [];
      const warnings: string[] = [];
  
      try {
        if (performanceTracking.enabled && performanceTracking.lookbackPeriod < 7) {
          warnings.push('Lookback period less than 7 days may not provide reliable optimization data');
        }
  
        if (performanceTracking.enabled && performanceTracking.lookbackPeriod > 365) {
          warnings.push('Lookback period over 1 year may not reflect current market conditions');
        }
  
        if (performanceTracking.optimizeLevels && !performanceTracking.trackEffectiveness) {
          errors.push('Track effectiveness must be enabled to optimize levels');
        }
      } catch (error) {
        errors.push(`Performance tracking validation error: ${(error as Error).message}`);
      }
  
      return { errors, warnings };
    }
  
    /**
     * Validate partial exit integration settings
     */
    private validatePartialExitIntegration(
      integration: any,
      params: TradeParams
    ): { errors: string[]; warnings: string[] } {
      const errors: string[] = [];
      const warnings: string[] = [];
  
      try {
        if (integration.withSmartExits && !params.dynamicRisk) {
          warnings.push('Smart exits integration enabled but dynamic risk management not configured');
        }
  
        if (integration.withTrailingStops && !params.takeProfit) {
          warnings.push('Trailing stops integration enabled but no take profit configured');
        }
  
        if (integration.withRegimeDetection && !params.regimeDetection) {
          warnings.push('Regime detection integration enabled but regime detection not configured');
        }
  
        if (integration.withRiskManagement && params.lotSize > 10) {
          warnings.push('Risk management integration enabled with large position size');
        }
      } catch (error) {
        errors.push(`Integration validation error: ${(error as Error).message}`);
      }
  
      return { errors, warnings };
    }
}

// Export singleton instance
export const riskManager = new RiskManager();