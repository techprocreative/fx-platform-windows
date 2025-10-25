/**
 * Safety Validator Service
 * Pre-trade validation to ensure all safety limits are respected
 * CRITICAL: This prevents dangerous trades from executing
 */

import { Signal } from '../types/strategy.types';
import { logger } from '../utils/logger';

export interface ValidationResult {
  canTrade: boolean;
  failedChecks: SafetyCheck[];
  warnings: SafetyCheck[];
  metadata?: any;
}

export interface SafetyCheck {
  name: string;
  passed: boolean;
  warning: boolean;
  reason: string;
  value?: any;
  limit?: any;
}

export interface SafetyLimits {
  maxDailyLoss: number;           // Maximum daily loss in currency
  maxDailyLossPercent: number;    // Maximum daily loss in percentage
  maxDrawdown: number;            // Maximum drawdown in currency
  maxDrawdownPercent: number;     // Maximum drawdown in percentage
  maxPositions: number;           // Maximum open positions
  maxLotSize: number;             // Maximum lot size per trade
  maxTotalExposure: number;       // Maximum total exposure
  maxCorrelation: number;         // Maximum correlation between positions
  requireMarginCheck: boolean;    // Require sufficient margin
  checkTradingHours: boolean;     // Check if symbol is trading
  checkNewsEvents: boolean;       // Check for high-impact news
}

export class SafetyValidatorService {
  private limits: SafetyLimits;
  private dailyPnL: number = 0;
  private startingBalance: number = 0;
  private peakBalance: number = 0;

  constructor(limits?: Partial<SafetyLimits>) {
    this.limits = {
      maxDailyLoss: 500,
      maxDailyLossPercent: 5,
      maxDrawdown: 1000,
      maxDrawdownPercent: 10,
      maxPositions: 10,
      maxLotSize: 1.0,
      maxTotalExposure: 5000,
      maxCorrelation: 0.7,
      requireMarginCheck: true,
      checkTradingHours: true,
      checkNewsEvents: true,
      ...limits,
    };

    logger.info('[SafetyValidator] Initialized with limits:', this.limits);
  }

  /**
   * Validate before opening a trade
   */
  async validateBeforeTrade(signal: Signal): Promise<ValidationResult> {
    logger.info(`[SafetyValidator] Validating signal: ${signal.action} ${signal.symbol}`);

    const checks: SafetyCheck[] = [];

    // 1. Check daily loss limit
    checks.push(await this.checkDailyLoss());

    // 2. Check maximum positions
    checks.push(await this.checkMaxPositions());

    // 3. Check drawdown limit
    checks.push(await this.checkDrawdown());

    // 4. Check lot size
    checks.push(await this.checkLotSize(signal.volume));

    // 5. Check margin requirements
    if (this.limits.requireMarginCheck) {
      checks.push(await this.checkMargin(signal));
    }

    // 6. Check symbol trading hours
    if (this.limits.checkTradingHours) {
      checks.push(await this.checkTradingHours(signal.symbol));
    }

    // 7. Check correlation exposure
    checks.push(await this.checkCorrelation(signal.symbol));

    // 8. Check total exposure
    checks.push(await this.checkTotalExposure(signal));

    // 9. Check for high-impact news
    if (this.limits.checkNewsEvents) {
      checks.push(await this.checkEconomicEvents(signal.symbol));
    }

    const failedChecks = checks.filter(c => !c.passed && !c.warning);
    const warnings = checks.filter(c => c.warning);

    const result: ValidationResult = {
      canTrade: failedChecks.length === 0,
      failedChecks,
      warnings,
      metadata: {
        totalChecks: checks.length,
        passedChecks: checks.filter(c => c.passed).length,
      },
    };

    if (!result.canTrade) {
      logger.warn('[SafetyValidator] Trade validation FAILED:', {
        signal,
        failedChecks: failedChecks.map(c => c.reason),
      });
    } else if (warnings.length > 0) {
      logger.warn('[SafetyValidator] Trade validation passed with WARNINGS:', {
        warnings: warnings.map(c => c.reason),
      });
    } else {
      logger.info('[SafetyValidator] Trade validation PASSED');
    }

    return result;
  }

  /**
   * Update limits (can be changed dynamically)
   */
  updateLimits(newLimits: Partial<SafetyLimits>): void {
    this.limits = { ...this.limits, ...newLimits };
    logger.info('[SafetyValidator] Limits updated:', this.limits);
  }

  /**
   * Get current limits
   */
  getLimits(): SafetyLimits {
    return { ...this.limits };
  }

  /**
   * Reset daily tracking
   */
  resetDaily(): void {
    this.dailyPnL = 0;
    logger.info('[SafetyValidator] Daily tracking reset');
  }

  /**
   * Update daily P&L
   */
  updateDailyPnL(pnl: number): void {
    this.dailyPnL += pnl;
  }

  /**
   * Update account balance tracking
   */
  updateBalance(balance: number): void {
    if (this.startingBalance === 0) {
      this.startingBalance = balance;
      this.peakBalance = balance;
    }

    if (balance > this.peakBalance) {
      this.peakBalance = balance;
    }
  }

  // ============ INDIVIDUAL SAFETY CHECKS ============

  /**
   * Check 1: Daily loss limit
   */
  private async checkDailyLoss(): Promise<SafetyCheck> {
    const dailyLossPercent = this.startingBalance > 0
      ? Math.abs((this.dailyPnL / this.startingBalance) * 100)
      : 0;

    const exceededAmount = Math.abs(this.dailyPnL) > this.limits.maxDailyLoss;
    const exceededPercent = dailyLossPercent > this.limits.maxDailyLossPercent;

    const passed = !exceededAmount && !exceededPercent;

    return {
      name: 'Daily Loss Limit',
      passed,
      warning: false,
      reason: passed
        ? 'Daily loss within limits'
        : `Daily loss exceeded: ${this.dailyPnL.toFixed(2)} (${dailyLossPercent.toFixed(2)}%)`,
      value: { amount: this.dailyPnL, percent: dailyLossPercent },
      limit: { amount: this.limits.maxDailyLoss, percent: this.limits.maxDailyLossPercent },
    };
  }

  /**
   * Check 2: Maximum positions
   */
  private async checkMaxPositions(): Promise<SafetyCheck> {
    // TODO: Get actual open positions from MT5
    const openPositions = await this.getOpenPositionsCount();
    const passed = openPositions < this.limits.maxPositions;

    return {
      name: 'Maximum Positions',
      passed,
      warning: false,
      reason: passed
        ? `Open positions (${openPositions}) within limit`
        : `Maximum positions reached: ${openPositions}/${this.limits.maxPositions}`,
      value: openPositions,
      limit: this.limits.maxPositions,
    };
  }

  /**
   * Check 3: Drawdown limit
   */
  private async checkDrawdown(): Promise<SafetyCheck> {
    const currentBalance = await this.getCurrentBalance();
    const drawdown = this.peakBalance - currentBalance;
    const drawdownPercent = this.peakBalance > 0
      ? (drawdown / this.peakBalance) * 100
      : 0;

    const exceededAmount = drawdown > this.limits.maxDrawdown;
    const exceededPercent = drawdownPercent > this.limits.maxDrawdownPercent;

    const passed = !exceededAmount && !exceededPercent;

    return {
      name: 'Drawdown Limit',
      passed,
      warning: false,
      reason: passed
        ? 'Drawdown within limits'
        : `Drawdown exceeded: ${drawdown.toFixed(2)} (${drawdownPercent.toFixed(2)}%)`,
      value: { amount: drawdown, percent: drawdownPercent },
      limit: { amount: this.limits.maxDrawdown, percent: this.limits.maxDrawdownPercent },
    };
  }

  /**
   * Check 4: Lot size
   */
  private async checkLotSize(lotSize: number): Promise<SafetyCheck> {
    const passed = lotSize <= this.limits.maxLotSize;

    return {
      name: 'Lot Size Check',
      passed,
      warning: false,
      reason: passed
        ? `Lot size (${lotSize}) within limit`
        : `Lot size exceeds maximum: ${lotSize} > ${this.limits.maxLotSize}`,
      value: lotSize,
      limit: this.limits.maxLotSize,
    };
  }

  /**
   * Check 5: Margin requirements
   */
  private async checkMargin(signal: Signal): Promise<SafetyCheck> {
    // TODO: Get actual margin requirements from MT5
    const requiredMargin = await this.calculateRequiredMargin(signal);
    const freeMargin = await this.getFreeMargin();

    const passed = freeMargin >= requiredMargin * 1.5; // 150% margin safety
    const warning = freeMargin >= requiredMargin && freeMargin < requiredMargin * 1.5;

    return {
      name: 'Margin Check',
      passed,
      warning,
      reason: passed
        ? 'Sufficient margin available'
        : warning
        ? 'Low margin warning'
        : `Insufficient margin: need ${requiredMargin}, have ${freeMargin}`,
      value: freeMargin,
      limit: requiredMargin,
    };
  }

  /**
   * Check 6: Symbol trading hours
   */
  private async checkTradingHours(symbol: string): Promise<SafetyCheck> {
    // TODO: Implement actual trading hours check
    const isTradingHours = await this.isSymbolTrading(symbol);

    return {
      name: 'Trading Hours',
      passed: isTradingHours,
      warning: false,
      reason: isTradingHours
        ? `${symbol} is currently trading`
        : `${symbol} is not trading (market closed)`,
      value: isTradingHours,
    };
  }

  /**
   * Check 7: Correlation exposure
   */
  private async checkCorrelation(symbol: string): Promise<SafetyCheck> {
    // TODO: Get actual correlation data
    const openPositions = await this.getOpenPositions();
    
    for (const position of openPositions) {
      const correlation = await this.getCorrelationBetween(symbol, position.symbol);
      
      if (Math.abs(correlation) > this.limits.maxCorrelation) {
        return {
          name: 'Correlation Check',
          passed: false,
          warning: false,
          reason: `High correlation with ${position.symbol}: ${(correlation * 100).toFixed(1)}%`,
          value: correlation,
          limit: this.limits.maxCorrelation,
        };
      }
    }

    return {
      name: 'Correlation Check',
      passed: true,
      warning: false,
      reason: 'No high correlation detected',
    };
  }

  /**
   * Check 8: Total exposure
   */
  private async checkTotalExposure(signal: Signal): Promise<SafetyCheck> {
    const currentExposure = await this.getTotalExposure();
    const newExposure = await this.calculateExposure(signal);
    const totalExposure = currentExposure + newExposure;

    const passed = totalExposure <= this.limits.maxTotalExposure;
    const warning = totalExposure > this.limits.maxTotalExposure * 0.8;

    return {
      name: 'Total Exposure',
      passed,
      warning: !passed && warning,
      reason: passed
        ? 'Total exposure within limits'
        : `Total exposure too high: ${totalExposure.toFixed(2)}`,
      value: totalExposure,
      limit: this.limits.maxTotalExposure,
    };
  }

  /**
   * Check 9: Economic events
   */
  private async checkEconomicEvents(symbol: string): Promise<SafetyCheck> {
    // TODO: Integrate with economic calendar API
    const hasHighImpactNews = await this.checkForHighImpactNews(symbol);

    return {
      name: 'Economic Events',
      passed: !hasHighImpactNews,
      warning: hasHighImpactNews,
      reason: hasHighImpactNews
        ? `High-impact news event approaching for ${symbol}`
        : 'No high-impact news events',
      value: hasHighImpactNews,
    };
  }

  // ============ HELPER METHODS (TODO: Implement with actual MT5 data) ============

  private async getOpenPositionsCount(): Promise<number> {
    // TODO: Get from MT5 service
    return 0;
  }

  private async getOpenPositions(): Promise<any[]> {
    // TODO: Get from MT5 service
    return [];
  }

  private async getCurrentBalance(): Promise<number> {
    // TODO: Get from MT5 service
    return this.startingBalance || 10000;
  }

  private async getFreeMargin(): Promise<number> {
    // TODO: Get from MT5 service
    return 5000;
  }

  private async calculateRequiredMargin(signal: Signal): Promise<number> {
    // Simple margin calculation
    return signal.volume * 1000;
  }

  private async isSymbolTrading(symbol: string): Promise<boolean> {
    // TODO: Check with MT5
    return true;
  }

  private async getCorrelationBetween(symbol1: string, symbol2: string): Promise<number> {
    // TODO: Calculate actual correlation
    return 0;
  }

  private async getTotalExposure(): Promise<number> {
    // TODO: Calculate from open positions
    return 0;
  }

  private async calculateExposure(signal: Signal): Promise<number> {
    // Simple exposure calculation
    return signal.volume * 100000; // For forex pairs
  }

  private async checkForHighImpactNews(symbol: string): Promise<boolean> {
    // TODO: Check economic calendar
    return false;
  }
}
