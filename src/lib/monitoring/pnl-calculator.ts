/**
 * Real-time P&L calculation module for monitoring position profitability
 */

import { Position, SymbolInfo } from '../brokers/types';
import { 
  MonitoredPosition, 
  PnLReport, 
  PositionPnL, 
  ExchangeRates,
  PricePoint 
} from './types';

export class PnLCalculator {
  private exchangeRates: ExchangeRates = {};
  private symbolInfo: Map<string, SymbolInfo> = new Map();
  private priceHistory: Map<number, PricePoint[]> = new Map();

  /**
   * Set exchange rates for currency conversion
   */
  setExchangeRates(rates: ExchangeRates): void {
    this.exchangeRates = { ...rates };
  }

  /**
   * Update symbol information for P&L calculations
   */
  updateSymbolInfo(symbol: string, info: SymbolInfo): void {
    this.symbolInfo.set(symbol, info);
  }

  /**
   * Get symbol information
   */
  getSymbolInfo(symbol: string): SymbolInfo | undefined {
    return this.symbolInfo.get(symbol);
  }

  /**
   * Add price point to history
   */
  addPricePoint(positionId: number, pricePoint: PricePoint): void {
    if (!this.priceHistory.has(positionId)) {
      this.priceHistory.set(positionId, []);
    }
    
    const history = this.priceHistory.get(positionId)!;
    history.push(pricePoint);
    
    // Keep only last 100 points
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Get price history for a position
   */
  getPriceHistory(positionId: number): PricePoint[] {
    return this.priceHistory.get(positionId) || [];
  }

  /**
   * Calculate pip value for a position
   */
  calculatePipValue(position: Position, currentPrice: number): number {
    const symbolInfo = this.symbolInfo.get(position.symbol);
    if (!symbolInfo) {
      console.warn(`Symbol info not found for ${position.symbol}`);
      return 0;
    }

    // For Forex pairs, calculate pip value based on quote currency
    const digits = symbolInfo.digits;
    const pipSize = digits === 3 || digits === 5 ? 0.0001 : 0.01;
    const tickValue = symbolInfo.tickValue;
    const tickSize = symbolInfo.tickSize;
    
    // Calculate pip value
    const pipValue = (tickValue / tickSize) * pipSize * position.volume;
    
    return pipValue;
  }

  /**
   * Calculate profit in pips
   */
  calculatePips(position: Position, currentPrice: number): number {
    const symbolInfo = this.symbolInfo.get(position.symbol);
    if (!symbolInfo) {
      return 0;
    }

    const digits = symbolInfo.digits;
    const pipSize = digits === 3 || digits === 5 ? 0.0001 : 0.01;
    
    if (position.type === 0) { // Buy position
      return (currentPrice - position.priceOpen) / pipSize;
    } else { // Sell position
      return (position.priceOpen - currentPrice) / pipSize;
    }
  }

  /**
   * Calculate unrealized P&L for a single position
   */
  calculateUnrealizedPnL(position: Position, currentPrice: number): number {
    if (position.type === 0) { // Buy position
      return (currentPrice - position.priceOpen) * position.volume;
    } else { // Sell position
      return (position.priceOpen - currentPrice) * position.volume;
    }
  }

  /**
   * Calculate total P&L for a position including commission and swap
   */
  calculateTotalPnL(position: Position, currentPrice: number): number {
    const unrealizedPnL = this.calculateUnrealizedPnL(position, currentPrice);
    const commission = position.commission || 0;
    const swap = position.swap || 0;
    
    return unrealizedPnL + commission + swap;
  }

  /**
   * Convert currency amount to account currency
   */
  convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
    if (fromCurrency === toCurrency) {
      return amount;
    }
    
    const rate = this.exchangeRates[`${fromCurrency}${toCurrency}`] || 
                 this.exchangeRates[`${toCurrency}${fromCurrency}`];
    
    if (!rate) {
      console.warn(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`);
      return amount;
    }
    
    // If we have the inverse rate, invert it
    if (this.exchangeRates[`${toCurrency}${fromCurrency}`]) {
      return amount / rate;
    }
    
    return amount * rate;
  }

  /**
   * Calculate margin used for a position
   */
  calculateMarginUsed(position: Position): number {
    const symbolInfo = this.symbolInfo.get(position.symbol);
    if (!symbolInfo) {
      return 0;
    }
    
    // Margin calculation formula: Volume * Contract Size * Price / Leverage
    const contractSize = symbolInfo.contractSize;
    const leverage = 100; // Default leverage, should come from account info
    const price = position.priceOpen;
    
    return (position.volume * contractSize * price) / leverage;
  }

  /**
   * Calculate P&L for a single position with full details
   */
  calculatePositionPnL(position: Position, currentPrice: number, accountCurrency = 'USD'): PositionPnL {
    const symbolInfo = this.symbolInfo.get(position.symbol);
    const profitCurrency = symbolInfo?.currencyProfit || 'USD';
    
    // Calculate basic P&L
    const unrealizedPnL = this.calculateUnrealizedPnL(position, currentPrice);
    const realizedPnL = 0; // For open positions, realized P&L is 0
    const totalPnL = unrealizedPnL + (position.commission || 0) + (position.swap || 0);
    
    // Calculate pips
    const pips = this.calculatePips(position, currentPrice);
    
    // Convert to account currency if needed
    const convertedUnrealizedPnL = this.convertCurrency(unrealizedPnL, profitCurrency, accountCurrency);
    const convertedTotalPnL = this.convertCurrency(totalPnL, profitCurrency, accountCurrency);
    const convertedCommission = this.convertCurrency(position.commission || 0, profitCurrency, accountCurrency);
    const convertedSwap = this.convertCurrency(position.swap || 0, profitCurrency, accountCurrency);
    
    // Calculate margin used
    const marginUsed = this.calculateMarginUsed(position);
    const convertedMarginUsed = this.convertCurrency(marginUsed, symbolInfo?.currencyMargin || 'USD', accountCurrency);
    
    return {
      ticket: position.ticket,
      symbol: position.symbol,
      type: position.type,
      volume: position.volume,
      openPrice: position.priceOpen,
      currentPrice,
      unrealizedPnL: convertedUnrealizedPnL,
      realizedPnL,
      totalPnL: convertedTotalPnL,
      pips,
      commission: convertedCommission,
      swap: convertedSwap,
      currency: accountCurrency,
      marginUsed: convertedMarginUsed
    };
  }

  /**
   * Calculate comprehensive P&L report for multiple positions
   */
  calculatePnLReport(
    positions: Position[], 
    accountCurrency = 'USD',
    accountBalance?: number,
    accountEquity?: number
  ): PnLReport {
    const positionPnLs: PositionPnL[] = [];
    let totalUnrealizedPnL = 0;
    let totalRealizedPnL = 0;
    
    // Calculate P&L for each position
    for (const position of positions) {
      const positionPnL = this.calculatePositionPnL(position, position.priceCurrent, accountCurrency);
      positionPnLs.push(positionPnL);
      totalUnrealizedPnL += positionPnL.unrealizedPnL;
      totalRealizedPnL += positionPnL.realizedPnL;
    }
    
    const totalPnL = totalUnrealizedPnL + totalRealizedPnL;
    
    // Calculate time-based P&L (simplified, would need historical data for accurate calculation)
    const dailyPnL = this.calculateTimeBasedPnL(positions, 'day', accountCurrency);
    const weeklyPnL = this.calculateTimeBasedPnL(positions, 'week', accountCurrency);
    const monthlyPnL = this.calculateTimeBasedPnL(positions, 'month', accountCurrency);
    
    return {
      totalUnrealizedPnL,
      totalRealizedPnL,
      totalPnL,
      positions: positionPnLs,
      currency: accountCurrency,
      timestamp: new Date(),
      accountBalance,
      accountEquity,
      dailyPnL,
      weeklyPnL,
      monthlyPnL
    };
  }

  /**
   * Calculate time-based P&L (simplified implementation)
   */
  private calculateTimeBasedPnL(positions: Position[], period: 'day' | 'week' | 'month', accountCurrency: string): number {
    // In a real implementation, this would use historical trade data
    // For now, return a proportion of the current P&L
    const now = new Date();
    let cutoffDate = new Date();
    
    switch (period) {
      case 'day':
        cutoffDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
    }
    
    let periodPnL = 0;
    for (const position of positions) {
      if (position.openTime >= cutoffDate) {
        periodPnL += this.calculateTotalPnL(position, position.priceCurrent);
      }
    }
    
    return this.convertCurrency(periodPnL, 'USD', accountCurrency);
  }

  /**
   * Calculate risk percentage for a position
   */
  calculateRiskPercent(position: Position, currentPrice: number, accountBalance: number): number {
    const totalPnL = this.calculateTotalPnL(position, currentPrice);
    const marginUsed = this.calculateMarginUsed(position);
    
    // Risk is the potential loss if the position hits stop loss
    // For now, use margin as a proxy for risk
    return accountBalance > 0 ? (marginUsed / accountBalance) * 100 : 0;
  }

  /**
   * Monitor position for P&L thresholds
   */
  checkPnLThresholds(position: MonitoredPosition, profitThreshold: number, lossThreshold: number): {
    profitReached: boolean;
    lossReached: boolean;
    profitPercent: number;
    lossPercent: number;
  } {
    const totalPnL = position.totalPnL || 0;
    const marginUsed = position.marginUsed || 1;
    
    const profitPercent = marginUsed > 0 ? (totalPnL / marginUsed) * 100 : 0;
    const lossPercent = Math.min(0, profitPercent);
    
    return {
      profitReached: profitPercent >= profitThreshold,
      lossReached: lossPercent <= -lossThreshold,
      profitPercent,
      lossPercent
    };
  }
}