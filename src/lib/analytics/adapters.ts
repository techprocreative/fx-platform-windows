/**
 * Analytics Type Adapters
 * 
 * Converts database models to analytics types
 */

import { Trade as PrismaTrade } from '@prisma/client';
import { Trade as AnalyticsTrade } from './types';

/**
 * Convert Prisma Trade to Analytics Trade
 */
export function adaptTradeFromDB(dbTrade: PrismaTrade): AnalyticsTrade {
  // Calculate holding time if trade is closed
  const holdingTime = dbTrade.closeTime
    ? dbTrade.closeTime.getTime() - dbTrade.openTime.getTime()
    : undefined;

  // Calculate profit percentage
  const profitPercent = dbTrade.openPrice > 0 && dbTrade.profit !== null
    ? (dbTrade.profit / (dbTrade.openPrice * dbTrade.lots * 100000)) * 100  // Simplified forex calculation
    : 0;

  return {
    tradeId: dbTrade.id,
    strategyId: dbTrade.strategyId,
    symbol: dbTrade.symbol,
    direction: dbTrade.type === 'BUY' ? 'LONG' : 'SHORT',
    entryTime: dbTrade.openTime,
    exitTime: dbTrade.closeTime || undefined,
    entryPrice: dbTrade.openPrice,
    exitPrice: dbTrade.closePrice || undefined,
    quantity: dbTrade.lots,
    profit: dbTrade.profit || 0,
    profitPercent,
    commission: dbTrade.commission || 0,
    swap: dbTrade.swap || 0,
    pips: dbTrade.pips || undefined,
    holdingTime,
    status: dbTrade.closeTime ? 'CLOSED' : 'OPEN',
    metadata: {
      ticket: dbTrade.ticket,
      executorId: dbTrade.executorId,
      stopLoss: dbTrade.stopLoss,
      takeProfit: dbTrade.takeProfit,
      magicNumber: dbTrade.magicNumber,
      comment: dbTrade.comment,
      netProfit: dbTrade.netProfit,
    },
  };
}

/**
 * Convert multiple Prisma Trades to Analytics Trades
 */
export function adaptTradesFromDB(dbTrades: PrismaTrade[]): AnalyticsTrade[] {
  return dbTrades.map(adaptTradeFromDB);
}

/**
 * Filter only closed trades for analytics
 */
export function filterClosedTrades(trades: AnalyticsTrade[]): AnalyticsTrade[] {
  return trades.filter(trade => trade.status === 'CLOSED' && trade.exitTime);
}

/**
 * Group trades by month (using close time)
 */
export function groupTradesByMonth(trades: AnalyticsTrade[]): Map<string, AnalyticsTrade[]> {
  const grouped = new Map<string, AnalyticsTrade[]>();
  
  trades.forEach(trade => {
    if (trade.exitTime) {
      const month = trade.exitTime.toISOString().slice(0, 7); // YYYY-MM
      if (!grouped.has(month)) {
        grouped.set(month, []);
      }
      grouped.get(month)!.push(trade);
    }
  });
  
  return grouped;
}

/**
 * Group trades by strategy
 */
export function groupTradesByStrategy(trades: AnalyticsTrade[]): Map<string, AnalyticsTrade[]> {
  const grouped = new Map<string, AnalyticsTrade[]>();
  
  trades.forEach(trade => {
    if (!grouped.has(trade.strategyId)) {
      grouped.set(trade.strategyId, []);
    }
    grouped.get(trade.strategyId)!.push(trade);
  });
  
  return grouped;
}

/**
 * Group trades by symbol
 */
export function groupTradesBySymbol(trades: AnalyticsTrade[]): Map<string, AnalyticsTrade[]> {
  const grouped = new Map<string, AnalyticsTrade[]>();
  
  trades.forEach(trade => {
    if (!grouped.has(trade.symbol)) {
      grouped.set(trade.symbol, []);
    }
    grouped.get(trade.symbol)!.push(trade);
  });
  
  return grouped;
}

/**
 * Calculate basic trade statistics
 */
export function calculateBasicStats(trades: AnalyticsTrade[]) {
  const closedTrades = filterClosedTrades(trades);
  const totalTrades = closedTrades.length;
  
  if (totalTrades === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalProfit: 0,
      winRate: 0,
      averageProfit: 0,
    };
  }
  
  const winningTrades = closedTrades.filter(t => t.profit > 0);
  const losingTrades = closedTrades.filter(t => t.profit <= 0);
  
  const totalProfit = closedTrades.reduce((sum, t) => sum + t.profit, 0);
  const winRate = (winningTrades.length / totalTrades) * 100;
  const averageProfit = totalProfit / totalTrades;
  
  return {
    totalTrades,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    totalProfit,
    winRate,
    averageProfit,
  };
}
