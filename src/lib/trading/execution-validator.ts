/**
 * Trade Execution Validator
 * 
 * This module provides comprehensive pre-execution validation checks for trade execution safety.
 * It includes market hours validation, symbol validation, spread checks, connection verification,
 * margin requirement checks, stop loss/take profit validation, news event checks, and risk limit verification.
 */

import { 
  TradeSignal, 
  ExtendedValidationResult, 
  ValidationCheck, 
  MarketHours, 
  SymbolTradingInfo, 
  ConnectionStatus, 
  NewsEvent 
} from './types';
import { logger } from '../monitoring/logger';

/**
 * ExecutionValidator class handles all pre-execution validation checks
 */
export class ExecutionValidator {
  private maxSpreadPips = 20; // Maximum acceptable spread in pips
  private minMarginPercent = 10; // Minimum margin required as percentage of free margin
  private newsEventBufferMinutes = 15; // Minutes to avoid trading before/after news events
  private connectionTimeoutMs = 5000; // Connection check timeout in milliseconds

  /**
   * Perform comprehensive pre-execution validation checks
   * 
   * @param signal Trade signal to validate
   * @returns Extended validation result with all check details
   */
  async validateExecution(signal: TradeSignal): Promise<ExtendedValidationResult> {
    const startTime = Date.now();
    const checks: ValidationCheck[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    try {
      logger.info(`Starting execution validation`, { 
        signalId: signal.id, 
        symbol: signal.symbol, 
        type: signal.type 
      });

      // 1. Check market hours
      const marketHoursCheck = await this.checkMarketHours(signal.symbol);
      checks.push(marketHoursCheck);
      if (!marketHoursCheck.passed) {
        errors.push(marketHoursCheck.message);
      } else if (marketHoursCheck.severity === 'warning') {
        warnings.push(marketHoursCheck.message);
      }

      // 2. Validate symbol exists and is tradeable
      const symbolCheck = await this.validateSymbol(signal.symbol);
      checks.push(symbolCheck);
      if (!symbolCheck.passed) {
        errors.push(symbolCheck.message);
      } else if (symbolCheck.severity === 'warning') {
        warnings.push(symbolCheck.message);
      }

      // 3. Check spread is acceptable
      const spreadCheck = await this.checkSpread(signal.symbol);
      checks.push(spreadCheck);
      if (!spreadCheck.passed) {
        errors.push(spreadCheck.message);
      } else if (spreadCheck.severity === 'warning') {
        warnings.push(spreadCheck.message);
      }

      // 4. Verify connection to broker
      const connectionCheck = await this.verifyConnection();
      checks.push(connectionCheck);
      if (!connectionCheck.passed) {
        errors.push(connectionCheck.message);
      } else if (connectionCheck.severity === 'warning') {
        warnings.push(connectionCheck.message);
      }

      // 5. Check account has sufficient margin
      const marginCheck = await this.checkMarginRequirements(signal);
      checks.push(marginCheck);
      if (!marginCheck.passed) {
        errors.push(marginCheck.message);
      } else if (marginCheck.severity === 'warning') {
        warnings.push(marginCheck.message);
      }

      // 6. Validate stop loss/take profit levels
      const sltpCheck = await this.validateStopLossTakeProfit(signal);
      checks.push(sltpCheck);
      if (!sltpCheck.passed) {
        errors.push(sltpCheck.message);
      } else if (sltpCheck.severity === 'warning') {
        warnings.push(sltpCheck.message);
      }

      // 7. Check for news events (optional)
      const newsCheck = await this.checkNewsEvents(signal.symbol);
      checks.push(newsCheck);
      if (!newsCheck.passed) {
        errors.push(newsCheck.message);
      } else if (newsCheck.severity === 'warning') {
        warnings.push(newsCheck.message);
      }

      // 8. Verify risk limits not exceeded
      const riskCheck = await this.verifyRiskLimits(signal);
      checks.push(riskCheck);
      if (!riskCheck.passed) {
        errors.push(riskCheck.message);
      } else if (riskCheck.severity === 'warning') {
        warnings.push(riskCheck.message);
      }

      // Calculate overall risk score
      const riskScore = this.calculateRiskScore(checks);

      // Generate recommendations
      if (riskScore > 70) {
        recommendations.push('High risk score detected. Consider reducing position size or waiting for better market conditions.');
      }
      if (warnings.length > 2) {
        recommendations.push('Multiple warnings detected. Exercise caution with this trade.');
      }
      if (connectionCheck.data?.latency && connectionCheck.data.latency > 1000) {
        recommendations.push('High connection latency detected. Consider waiting for better connectivity.');
      }

      const valid = errors.length === 0;
      const duration = Date.now() - startTime;

      logger.info(`Execution validation completed`, {
        signalId: signal.id,
        valid,
        errors: errors.length,
        warnings: warnings.length,
        riskScore,
        duration
      });

      return {
        valid,
        errors,
        warnings,
        timestamp: new Date(),
        checks,
        riskScore,
        recommendations
      };
    } catch (error) {
      logger.error('Error during execution validation', error as Error, { signalId: signal.id });
      return {
        valid: false,
        errors: ['Validation error: ' + (error as Error).message],
        warnings,
        timestamp: new Date(),
        checks,
        riskScore: 100,
        recommendations: ['Fix validation errors before proceeding']
      };
    }
  }

  /**
   * Check if market is open for trading
   * 
   * @param symbol Trading symbol
   * @returns Validation check result
   */
  private async checkMarketHours(symbol: string): Promise<ValidationCheck> {
    const startTime = Date.now();
    
    try {
      // Get current time
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const hours = now.getUTCHours();
      
      // Check if it's weekend (Forex market closed)
      if (dayOfWeek === 0 || (dayOfWeek === 6 && hours > 21) || (dayOfWeek === 1 && hours < 21)) {
        return {
          name: 'Market Hours',
          passed: false,
          message: 'Market is closed (weekend)',
          severity: 'error',
          duration: Date.now() - startTime,
          data: { 
            dayOfWeek, 
            hours, 
            marketStatus: 'closed' 
          }
        };
      }
      
      // Check if within trading session (simplified)
      const session = this.getCurrentTradingSession(hours);
      const isOpen = session !== 'closed';
      
      if (!isOpen) {
        return {
          name: 'Market Hours',
          passed: false,
          message: 'Market is closed (outside trading hours)',
          severity: 'error',
          duration: Date.now() - startTime,
          data: { 
            hours, 
            session, 
            marketStatus: 'closed' 
          }
        };
      }
      
      // Check if near session end (warning)
      const sessionEnd = this.getSessionEndTime(session);
      const minutesUntilClose = sessionEnd ? (sessionEnd - hours) * 60 : 0;
      
      if (minutesUntilClose < 30 && minutesUntilClose > 0) {
        return {
          name: 'Market Hours',
          passed: true,
          message: `Market closes in ${minutesUntilClose.toFixed(0)} minutes`,
          severity: 'warning',
          duration: Date.now() - startTime,
          data: { 
            hours, 
            session, 
            minutesUntilClose,
            marketStatus: 'closing_soon' 
          }
        };
      }
      
      return {
        name: 'Market Hours',
        passed: true,
        message: 'Market is open',
        severity: 'info',
        duration: Date.now() - startTime,
        data: { 
          hours, 
          session, 
          marketStatus: 'open' 
        }
      };
    } catch (error) {
      logger.error('Error checking market hours', error as Error, { symbol });
      return {
        name: 'Market Hours',
        passed: false,
        message: 'Failed to check market hours',
        severity: 'error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Validate that symbol exists and is tradeable
   * 
   * @param symbol Trading symbol
   * @returns Validation check result
   */
  private async validateSymbol(symbol: string): Promise<ValidationCheck> {
    const startTime = Date.now();
    
    try {
      // Mock implementation - would fetch from broker
      const symbolInfo = await this.getSymbolInfo(symbol);
      
      if (!symbolInfo) {
        return {
          name: 'Symbol Validation',
          passed: false,
          message: `Symbol ${symbol} not found`,
          severity: 'error',
          duration: Date.now() - startTime
        };
      }
      
      if (!symbolInfo.tradeable) {
        return {
          name: 'Symbol Validation',
          passed: false,
          message: `Symbol ${symbol} is not tradeable`,
          severity: 'error',
          duration: Date.now() - startTime,
          data: { symbolInfo }
        };
      }
      
      if (!symbolInfo.tradingAllowed) {
        return {
          name: 'Symbol Validation',
          passed: false,
          message: `Trading is not allowed for symbol ${symbol}`,
          severity: 'error',
          duration: Date.now() - startTime,
          data: { symbolInfo }
        };
      }
      
      return {
        name: 'Symbol Validation',
        passed: true,
        message: `Symbol ${symbol} is valid and tradeable`,
        severity: 'info',
        duration: Date.now() - startTime,
        data: { symbolInfo }
      };
    } catch (error) {
      logger.error('Error validating symbol', error as Error, { symbol });
      return {
        name: 'Symbol Validation',
        passed: false,
        message: `Failed to validate symbol ${symbol}`,
        severity: 'error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Check if spread is acceptable
   * 
   * @param symbol Trading symbol
   * @returns Validation check result
   */
  private async checkSpread(symbol: string): Promise<ValidationCheck> {
    const startTime = Date.now();
    
    try {
      // Mock implementation - would fetch from broker
      const symbolInfo = await this.getSymbolInfo(symbol);
      
      if (!symbolInfo) {
        return {
          name: 'Spread Check',
          passed: false,
          message: `Cannot check spread for symbol ${symbol}`,
          severity: 'error',
          duration: Date.now() - startTime
        };
      }
      
      const spreadPips = symbolInfo.spread;
      const spreadAcceptable = spreadPips <= this.maxSpreadPips;
      
      if (!spreadAcceptable) {
        return {
          name: 'Spread Check',
          passed: false,
          message: `Spread too high: ${spreadPips} pips (max: ${this.maxSpreadPips} pips)`,
          severity: 'error',
          duration: Date.now() - startTime,
          data: { 
            spreadPips, 
            maxSpreadPips: this.maxSpreadPips,
            bid: symbolInfo.bid,
            ask: symbolInfo.ask
          }
        };
      }
      
      // Warning if spread is high but acceptable
      if (spreadPips > this.maxSpreadPips * 0.7) {
        return {
          name: 'Spread Check',
          passed: true,
          message: `Spread is elevated: ${spreadPips} pips`,
          severity: 'warning',
          duration: Date.now() - startTime,
          data: { 
            spreadPips, 
            maxSpreadPips: this.maxSpreadPips,
            bid: symbolInfo.bid,
            ask: symbolInfo.ask
          }
        };
      }
      
      return {
        name: 'Spread Check',
        passed: true,
        message: `Spread is acceptable: ${spreadPips} pips`,
        severity: 'info',
        duration: Date.now() - startTime,
        data: { 
          spreadPips, 
          bid: symbolInfo.bid,
          ask: symbolInfo.ask
        }
      };
    } catch (error) {
      logger.error('Error checking spread', error as Error, { symbol });
      return {
        name: 'Spread Check',
        passed: false,
        message: `Failed to check spread for symbol ${symbol}`,
        severity: 'error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Verify connection to broker
   * 
   * @returns Validation check result
   */
  private async verifyConnection(): Promise<ValidationCheck> {
    const startTime = Date.now();
    
    try {
      // Mock implementation - would check actual broker connection
      const connectionStatus = await this.checkBrokerConnection();
      
      if (!connectionStatus.connected) {
        return {
          name: 'Connection Verification',
          passed: false,
          message: connectionStatus.message || 'Not connected to broker',
          severity: 'critical',
          duration: Date.now() - startTime,
          data: connectionStatus
        };
      }
      
      // Check latency
      if (connectionStatus.latency && connectionStatus.latency > 2000) {
        return {
          name: 'Connection Verification',
          passed: false,
          message: `Connection latency too high: ${connectionStatus.latency}ms`,
          severity: 'error',
          duration: Date.now() - startTime,
          data: connectionStatus
        };
      }
      
      // Warning for high latency
      if (connectionStatus.latency && connectionStatus.latency > 1000) {
        return {
          name: 'Connection Verification',
          passed: true,
          message: `High connection latency: ${connectionStatus.latency}ms`,
          severity: 'warning',
          duration: Date.now() - startTime,
          data: connectionStatus
        };
      }
      
      return {
        name: 'Connection Verification',
        passed: true,
        message: `Connected to broker (${connectionStatus.latency}ms)`,
        severity: 'info',
        duration: Date.now() - startTime,
        data: connectionStatus
      };
    } catch (error) {
      logger.error('Error verifying connection', error as Error);
      return {
        name: 'Connection Verification',
        passed: false,
        message: 'Failed to verify broker connection',
        severity: 'critical',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Check account has sufficient margin
   * 
   * @param signal Trade signal
   * @returns Validation check result
   */
  private async checkMarginRequirements(signal: TradeSignal): Promise<ValidationCheck> {
    const startTime = Date.now();
    
    try {
      // Mock implementation - would fetch from broker
      const accountInfo = await this.getAccountInfo();
      const symbolInfo = await this.getSymbolInfo(signal.symbol);
      
      if (!accountInfo || !symbolInfo) {
        return {
          name: 'Margin Check',
          passed: false,
          message: 'Cannot check margin requirements',
          severity: 'error',
          duration: Date.now() - startTime
        };
      }
      
      // Calculate required margin
      const requiredMargin = signal.lotSize * symbolInfo.marginPerLot;
      const marginPercent = (requiredMargin / accountInfo.freeMargin) * 100;
      
      if (requiredMargin > accountInfo.freeMargin) {
        return {
          name: 'Margin Check',
          passed: false,
          message: `Insufficient margin: required $${requiredMargin.toFixed(2)}, available $${accountInfo.freeMargin.toFixed(2)}`,
          severity: 'error',
          duration: Date.now() - startTime,
          data: { 
            requiredMargin, 
            freeMargin: accountInfo.freeMargin,
            marginPercent,
            lotSize: signal.lotSize
          }
        };
      }
      
      // Warning if using too much margin
      if (marginPercent > 50) {
        return {
          name: 'Margin Check',
          passed: true,
          message: `High margin usage: ${marginPercent.toFixed(1)}%`,
          severity: 'warning',
          duration: Date.now() - startTime,
          data: { 
            requiredMargin, 
            freeMargin: accountInfo.freeMargin,
            marginPercent,
            lotSize: signal.lotSize
          }
        };
      }
      
      return {
        name: 'Margin Check',
        passed: true,
        message: `Sufficient margin: $${accountInfo.freeMargin.toFixed(2)} available`,
        severity: 'info',
        duration: Date.now() - startTime,
        data: { 
          requiredMargin, 
          freeMargin: accountInfo.freeMargin,
          marginPercent,
          lotSize: signal.lotSize
        }
      };
    } catch (error) {
      logger.error('Error checking margin requirements', error as Error, { signalId: signal.id });
      return {
        name: 'Margin Check',
        passed: false,
        message: 'Failed to check margin requirements',
        severity: 'error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Validate stop loss and take profit levels
   * 
   * @param signal Trade signal
   * @returns Validation check result
   */
  private async validateStopLossTakeProfit(signal: TradeSignal): Promise<ValidationCheck> {
    const startTime = Date.now();
    
    try {
      const symbolInfo = await this.getSymbolInfo(signal.symbol);
      
      if (!symbolInfo) {
        return {
          name: 'SL/TP Validation',
          passed: false,
          message: 'Cannot validate SL/TP levels',
          severity: 'error',
          duration: Date.now() - startTime
        };
      }
      
      // Check if stop loss is set
      if (!signal.stopLoss) {
        return {
          name: 'SL/TP Validation',
          passed: false,
          message: 'Stop loss is required',
          severity: 'error',
          duration: Date.now() - startTime
        };
      }
      
      // Calculate stop loss distance in pips
      const slDistancePips = Math.abs(signal.entryPrice - signal.stopLoss) / symbolInfo.point;
      
      // Check minimum stop loss distance
      const minStopLossPips = 10; // Minimum 10 pips
      if (slDistancePips < minStopLossPips) {
        return {
          name: 'SL/TP Validation',
          passed: false,
          message: `Stop loss too close: ${slDistancePips.toFixed(1)} pips (minimum: ${minStopLossPips} pips)`,
          severity: 'error',
          duration: Date.now() - startTime,
          data: { 
            slDistancePips, 
            minStopLossPips,
            entryPrice: signal.entryPrice,
            stopLoss: signal.stopLoss
          }
        };
      }
      
      // Validate stop loss direction
      const isBuy = signal.type === 'BUY';
      const slValid = isBuy ? signal.stopLoss < signal.entryPrice : signal.stopLoss > signal.entryPrice;
      
      if (!slValid) {
        return {
          name: 'SL/TP Validation',
          passed: false,
          message: `Stop loss direction invalid for ${signal.type} order`,
          severity: 'error',
          duration: Date.now() - startTime,
          data: { 
            type: signal.type,
            entryPrice: signal.entryPrice,
            stopLoss: signal.stopLoss
          }
        };
      }
      
      // Validate take profit if set
      if (signal.takeProfit) {
        const tpDistancePips = Math.abs(signal.takeProfit - signal.entryPrice) / symbolInfo.point;
        
        // Check minimum take profit distance
        if (tpDistancePips < minStopLossPips) {
          return {
            name: 'SL/TP Validation',
            passed: false,
            message: `Take profit too close: ${tpDistancePips.toFixed(1)} pips (minimum: ${minStopLossPips} pips)`,
            severity: 'error',
            duration: Date.now() - startTime,
            data: { 
              tpDistancePips, 
              minStopLossPips,
              entryPrice: signal.entryPrice,
              takeProfit: signal.takeProfit
            }
          };
        }
        
        // Validate take profit direction
        const tpValid = isBuy ? signal.takeProfit > signal.entryPrice : signal.takeProfit < signal.entryPrice;
        
        if (!tpValid) {
          return {
            name: 'SL/TP Validation',
            passed: false,
            message: `Take profit direction invalid for ${signal.type} order`,
            severity: 'error',
            duration: Date.now() - startTime,
            data: { 
              type: signal.type,
              entryPrice: signal.entryPrice,
              takeProfit: signal.takeProfit
            }
          };
        }
        
        // Check risk/reward ratio
        const riskRewardRatio = tpDistancePips / slDistancePips;
        if (riskRewardRatio < 1.0) {
          return {
            name: 'SL/TP Validation',
            passed: true,
            message: `Low risk/reward ratio: ${riskRewardRatio.toFixed(2)}:1`,
            severity: 'warning',
            duration: Date.now() - startTime,
            data: { 
              riskRewardRatio,
              slDistancePips,
              tpDistancePips
            }
          };
        }
      }
      
      return {
        name: 'SL/TP Validation',
        passed: true,
        message: 'Stop loss and take profit levels are valid',
        severity: 'info',
        duration: Date.now() - startTime,
        data: { 
          slDistancePips,
          entryPrice: signal.entryPrice,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit
        }
      };
    } catch (error) {
      logger.error('Error validating SL/TP', error as Error, { signalId: signal.id });
      return {
        name: 'SL/TP Validation',
        passed: false,
        message: 'Failed to validate SL/TP levels',
        severity: 'error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Check for upcoming news events
   * 
   * @param symbol Trading symbol
   * @returns Validation check result
   */
  private async checkNewsEvents(symbol: string): Promise<ValidationCheck> {
    const startTime = Date.now();
    
    try {
      // Mock implementation - would fetch from news API
      const newsEvents = await this.getUpcomingNewsEvents(symbol);
      const relevantEvents = newsEvents.filter(event => 
        event.avoidTrading && 
        event.minutesUntil !== undefined && 
        event.minutesUntil <= this.newsEventBufferMinutes
      );
      
      if (relevantEvents.length > 0) {
        const highImpactEvents = relevantEvents.filter(event => event.impact === 'high');
        const nextEvent = relevantEvents[0];
        
        if (highImpactEvents.length > 0) {
          return {
            name: 'News Event Check',
            passed: false,
            message: `High impact news event in ${nextEvent.minutesUntil} minutes: ${nextEvent.title}`,
            severity: 'error',
            duration: Date.now() - startTime,
            data: { 
              events: highImpactEvents,
              nextEvent,
              bufferMinutes: this.newsEventBufferMinutes
            }
          };
        }
        
        return {
          name: 'News Event Check',
          passed: true,
          message: `News event in ${nextEvent.minutesUntil} minutes: ${nextEvent.title}`,
          severity: 'warning',
          duration: Date.now() - startTime,
          data: { 
            events: relevantEvents,
            nextEvent,
            bufferMinutes: this.newsEventBufferMinutes
          }
        };
      }
      
      return {
        name: 'News Event Check',
        passed: true,
        message: 'No relevant news events detected',
        severity: 'info',
        duration: Date.now() - startTime,
        data: { 
          checkedEvents: newsEvents.length,
          bufferMinutes: this.newsEventBufferMinutes
        }
      };
    } catch (error) {
      logger.error('Error checking news events', error as Error, { symbol });
      // News check failure should not block trading
      return {
        name: 'News Event Check',
        passed: true,
        message: 'Could not check news events',
        severity: 'warning',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Verify risk limits are not exceeded
   * 
   * @param signal Trade signal
   * @returns Validation check result
   */
  private async verifyRiskLimits(signal: TradeSignal): Promise<ValidationCheck> {
    const startTime = Date.now();
    
    try {
      // Mock implementation - would use actual RiskManager
      const riskManager = await this.getRiskManager();
      const riskCheck = await riskManager.validateTrade(signal);
      
      if (!riskCheck.valid) {
        return {
          name: 'Risk Limit Check',
          passed: false,
          message: `Risk limits exceeded: ${riskCheck.errors.join(', ')}`,
          severity: 'error',
          duration: Date.now() - startTime,
          data: { 
            errors: riskCheck.errors,
            warnings: riskCheck.warnings,
            adjustedParams: riskCheck.adjustedParams
          }
        };
      }
      
      if (riskCheck.warnings.length > 0) {
        return {
          name: 'Risk Limit Check',
          passed: true,
          message: `Risk warnings: ${riskCheck.warnings.join(', ')}`,
          severity: 'warning',
          duration: Date.now() - startTime,
          data: { 
            errors: riskCheck.errors,
            warnings: riskCheck.warnings,
            adjustedParams: riskCheck.adjustedParams
          }
        };
      }
      
      return {
        name: 'Risk Limit Check',
        passed: true,
        message: 'Risk limits are within acceptable range',
        severity: 'info',
        duration: Date.now() - startTime,
        data: { 
          errors: riskCheck.errors,
          warnings: riskCheck.warnings
        }
      };
    } catch (error) {
      logger.error('Error verifying risk limits', error as Error, { signalId: signal.id });
      return {
        name: 'Risk Limit Check',
        passed: false,
        message: 'Failed to verify risk limits',
        severity: 'error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Calculate overall risk score from validation checks
   * 
   * @param checks Array of validation checks
   * @returns Risk score (0-100, higher is riskier)
   */
  private calculateRiskScore(checks: ValidationCheck[]): number {
    let score = 0;
    
    for (const check of checks) {
      switch (check.severity) {
        case 'critical':
          score += 30;
          break;
        case 'error':
          score += 20;
          break;
        case 'warning':
          score += 10;
          break;
        case 'info':
          score += 0;
          break;
      }
    }
    
    return Math.min(100, score);
  }

  // Helper methods (mock implementations - would connect to real services)
  
  private getCurrentTradingSession(hours: number): 'asian' | 'london' | 'newyork' | 'closed' {
    if (hours >= 0 && hours < 2) return 'asian';
    if (hours >= 2 && hours < 8) return 'asian';
    if (hours >= 8 && hours < 13) return 'london';
    if (hours >= 13 && hours < 17) return 'newyork';
    if (hours >= 17 && hours < 22) return 'newyork';
    return 'closed';
  }

  private getSessionEndTime(session: string): number | null {
    switch (session) {
      case 'asian': return 8;
      case 'london': return 13;
      case 'newyork': return 22;
      default: return null;
    }
  }

  private async getSymbolInfo(symbol: string): Promise<SymbolTradingInfo | null> {
    // Mock implementation
    return {
      symbol,
      tradeable: true,
      spread: 2,
      maxSpread: this.maxSpreadPips,
      spreadAcceptable: true,
      bid: 1.1000,
      ask: 1.1002,
      point: 0.0001,
      digits: 4,
      minLot: 0.01,
      maxLot: 100,
      lotStep: 0.01,
      marginPerLot: 1000,
      tradingAllowed: true
    };
  }

  private async checkBrokerConnection(): Promise<ConnectionStatus> {
    // Mock implementation
    return {
      connected: true,
      latency: 150,
      lastCheck: new Date(),
      message: 'Connected'
    };
  }

  private async getAccountInfo(): Promise<{ balance: number; freeMargin: number } | null> {
    // Mock implementation
    return {
      balance: 10000,
      freeMargin: 8000
    };
  }

  private async getUpcomingNewsEvents(symbol: string): Promise<NewsEvent[]> {
    // Mock implementation
    return [];
  }

  private async getRiskManager(): Promise<{ validateTrade(signal: TradeSignal): Promise<{ valid: boolean; errors: string[]; warnings: string[]; adjustedParams?: any }> }> {
    // Mock implementation - would import actual RiskManager
    return {
      validateTrade: async (signal: TradeSignal) => {
        return { valid: true, errors: [], warnings: [] };
      }
    };
  }
}

// Export singleton instance
export const executionValidator = new ExecutionValidator();