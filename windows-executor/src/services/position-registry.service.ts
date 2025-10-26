/**
 * Central Position Registry Service
 * Tracks all open positions with strategy mapping and profit tracking
 */

import { MT5AccountService } from './mt5-account.service';
import { logger } from '../utils/logger';

// Import and use actual MT5Position type
import type { MT5Position as ImportedMT5Position } from './mt5-account.service';

// Create compatible type
type MT5Position = Omit<ImportedMT5Position, 'currentPrice' | 'stopLoss' | 'takeProfit' | 'swap' | 'commission'> & {
  sl?: number;
  tp?: number;
};

export interface PositionRecord {
  ticket: number;
  strategyId: string;
  strategyName: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  openPrice: number;
  openTime: Date;
  sl: number;
  tp: number;
  profit: number;
  profitPercent: number;
  magic: number;
  comment: string;
  duration: number; // in milliseconds
}

export interface PositionSummary {
  total: number;
  profitable: number;
  losing: number;
  totalProfit: number;
  totalVolume: number;
  byStrategy: Map<string, StrategyPositionSummary>;
  bySymbol: Map<string, SymbolPositionSummary>;
}

export interface StrategyPositionSummary {
  strategyId: string;
  strategyName: string;
  count: number;
  volume: number;
  profit: number;
  positions: PositionRecord[];
}

export interface SymbolPositionSummary {
  symbol: string;
  count: number;
  volume: number;
  profit: number;
  positions: PositionRecord[];
}

export class PositionRegistry {
  private positions: Map<number, PositionRecord> = new Map();
  private mt5Service: MT5AccountService;
  private syncInterval: NodeJS.Timeout | null = null;
  private lastSyncTime: Date | null = null;
  private syncFailures: number = 0;

  constructor(mt5Service: MT5AccountService) {
    this.mt5Service = mt5Service;
  }

  /**
   * Start automatic position sync
   */
  startSync(intervalMs: number = 5000): void {
    if (this.syncInterval) {
      logger.warn('[PositionRegistry] Sync already started');
      return;
    }

    logger.info('[PositionRegistry] Starting position sync', { intervalMs });
    
    // Initial sync
    this.syncWithMT5().catch(err => {
      logger.error('[PositionRegistry] Initial sync failed', err);
    });

    // Periodic sync
    this.syncInterval = setInterval(async () => {
      await this.syncWithMT5();
    }, intervalMs);
  }

  /**
   * Stop automatic position sync
   */
  stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      logger.info('[PositionRegistry] Position sync stopped');
    }
  }

  /**
   * Sync positions with MT5
   */
  async syncWithMT5(): Promise<void> {
    try {
      const mt5Positions = await this.mt5Service.getOpenPositions();
      
      // Get current tickets
      const currentTickets = new Set(this.positions.keys());
      const mt5Tickets = new Set(mt5Positions.map(p => p.ticket));

      // Remove closed positions
      for (const ticket of currentTickets) {
        if (!mt5Tickets.has(ticket)) {
          logger.info('[PositionRegistry] Position closed', { ticket });
          this.positions.delete(ticket);
        }
      }

      // Add or update positions
      for (const mt5Pos of mt5Positions) {
        const existing = this.positions.get(mt5Pos.ticket);
        
        if (existing) {
          // Update profit and duration
          existing.profit = mt5Pos.profit;
          existing.profitPercent = this.calculateProfitPercent(mt5Pos);
          existing.duration = Date.now() - existing.openTime.getTime();
        } else {
          // New position
          const record = this.createPositionRecord(mt5Pos);
          this.positions.set(mt5Pos.ticket, record);
          logger.info('[PositionRegistry] New position detected', {
            ticket: record.ticket,
            strategy: record.strategyName,
            symbol: record.symbol
          });
        }
      }

      this.lastSyncTime = new Date();
      this.syncFailures = 0;
      
    } catch (error) {
      this.syncFailures++;
      logger.error('[PositionRegistry] Sync failed', {
        error: (error as Error).message,
        failures: this.syncFailures
      });
      
      // Clear registry after 3 consecutive failures (safety)
      if (this.syncFailures >= 3) {
        logger.warn('[PositionRegistry] Too many sync failures, clearing registry');
        this.positions.clear();
      }
    }
  }

  /**
   * Create position record from MT5 position
   */
  private createPositionRecord(mt5Pos: any): PositionRecord {
    const strategyId = this.magicToStrategyId(mt5Pos.magic);
    const strategyName = mt5Pos.comment || 'Unknown';
    
    return {
      ticket: mt5Pos.ticket,
      strategyId,
      strategyName,
      symbol: mt5Pos.symbol,
      type: mt5Pos.type === 'BUY' || mt5Pos.type === 0 ? 'BUY' : 'SELL',
      volume: mt5Pos.volume,
      openPrice: mt5Pos.openPrice,
      openTime: mt5Pos.openTime,
      sl: mt5Pos.stopLoss || mt5Pos.sl || 0,
      tp: mt5Pos.takeProfit || mt5Pos.tp || 0,
      profit: mt5Pos.profit,
      profitPercent: this.calculateProfitPercent(mt5Pos),
      magic: mt5Pos.magic,
      comment: mt5Pos.comment,
      duration: Date.now() - mt5Pos.openTime.getTime()
    };
  }

  /**
   * Calculate profit percentage
   */
  private calculateProfitPercent(mt5Pos: any): number {
    const positionValue = mt5Pos.volume * 100000 * mt5Pos.openPrice;
    return positionValue > 0 ? (mt5Pos.profit / positionValue) * 100 : 0;
  }

  /**
   * Convert magic number to strategy ID
   */
  private magicToStrategyId(magic: number): string {
    return `strategy_${magic}`;
  }

  /**
   * Get all positions
   */
  getAllPositions(): PositionRecord[] {
    return Array.from(this.positions.values());
  }

  /**
   * Get positions by strategy
   */
  getByStrategy(strategyId: string): PositionRecord[] {
    return this.getAllPositions().filter(p => p.strategyId === strategyId);
  }

  /**
   * Get positions by symbol
   */
  getBySymbol(symbol: string): PositionRecord[] {
    return this.getAllPositions().filter(p => p.symbol === symbol);
  }

  /**
   * Get profitable positions
   */
  getProfitable(minProfit: number = 0): PositionRecord[] {
    return this.getAllPositions().filter(p => p.profit > minProfit);
  }

  /**
   * Get losing positions
   */
  getLosing(maxLoss: number = 0): PositionRecord[] {
    return this.getAllPositions().filter(p => p.profit < maxLoss);
  }

  /**
   * Get oldest positions
   */
  getOldest(count: number): PositionRecord[] {
    return this.getAllPositions()
      .sort((a, b) => a.openTime.getTime() - b.openTime.getTime())
      .slice(0, count);
  }

  /**
   * Get newest positions
   */
  getNewest(count: number): PositionRecord[] {
    return this.getAllPositions()
      .sort((a, b) => b.openTime.getTime() - a.openTime.getTime())
      .slice(0, count);
  }

  /**
   * Get position by ticket
   */
  getByTicket(ticket: number): PositionRecord | undefined {
    return this.positions.get(ticket);
  }

  /**
   * Get position count
   */
  getCount(): number {
    return this.positions.size;
  }

  /**
   * Get position count by strategy
   */
  getCountByStrategy(strategyId: string): number {
    return this.getByStrategy(strategyId).length;
  }

  /**
   * Get total exposure
   */
  getTotalExposure(): { symbol: string; volume: number }[] {
    const exposure = new Map<string, number>();
    
    for (const pos of this.positions.values()) {
      const current = exposure.get(pos.symbol) || 0;
      exposure.set(pos.symbol, current + pos.volume);
    }

    return Array.from(exposure.entries()).map(([symbol, volume]) => ({
      symbol,
      volume
    }));
  }

  /**
   * Get position summary
   */
  getSummary(): PositionSummary {
    const positions = this.getAllPositions();
    
    const byStrategy = new Map<string, StrategyPositionSummary>();
    const bySymbol = new Map<string, SymbolPositionSummary>();

    // Group by strategy
    for (const pos of positions) {
      const existing = byStrategy.get(pos.strategyId);
      if (existing) {
        existing.count++;
        existing.volume += pos.volume;
        existing.profit += pos.profit;
        existing.positions.push(pos);
      } else {
        byStrategy.set(pos.strategyId, {
          strategyId: pos.strategyId,
          strategyName: pos.strategyName,
          count: 1,
          volume: pos.volume,
          profit: pos.profit,
          positions: [pos]
        });
      }
    }

    // Group by symbol
    for (const pos of positions) {
      const existing = bySymbol.get(pos.symbol);
      if (existing) {
        existing.count++;
        existing.volume += pos.volume;
        existing.profit += pos.profit;
        existing.positions.push(pos);
      } else {
        bySymbol.set(pos.symbol, {
          symbol: pos.symbol,
          count: 1,
          volume: pos.volume,
          profit: pos.profit,
          positions: [pos]
        });
      }
    }

    return {
      total: positions.length,
      profitable: positions.filter(p => p.profit > 0).length,
      losing: positions.filter(p => p.profit < 0).length,
      totalProfit: positions.reduce((sum, p) => sum + p.profit, 0),
      totalVolume: positions.reduce((sum, p) => sum + p.volume, 0),
      byStrategy,
      bySymbol
    };
  }

  /**
   * Check if strategy has open positions
   */
  hasOpenPositions(strategyId: string): boolean {
    return this.getByStrategy(strategyId).length > 0;
  }

  /**
   * Get sync status
   */
  getSyncStatus(): {
    isRunning: boolean;
    lastSync: Date | null;
    failures: number;
    positionCount: number;
  } {
    return {
      isRunning: this.syncInterval !== null,
      lastSync: this.lastSyncTime,
      failures: this.syncFailures,
      positionCount: this.positions.size
    };
  }
}
