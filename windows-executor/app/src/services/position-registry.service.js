"use strict";
/**
 * Central Position Registry Service
 * Tracks all open positions with strategy mapping and profit tracking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PositionRegistry = void 0;
const logger_1 = require("../utils/logger");
class PositionRegistry {
    constructor(mt5Service) {
        this.positions = new Map();
        this.syncInterval = null;
        this.lastSyncTime = null;
        this.syncFailures = 0;
        this.mt5Service = mt5Service;
    }
    /**
     * Start automatic position sync
     */
    startSync(intervalMs = 5000) {
        if (this.syncInterval) {
            logger_1.logger.warn('[PositionRegistry] Sync already started');
            return;
        }
        logger_1.logger.info('[PositionRegistry] Starting position sync', { intervalMs });
        // Initial sync
        this.syncWithMT5().catch(err => {
            logger_1.logger.error('[PositionRegistry] Initial sync failed', err);
        });
        // Periodic sync
        this.syncInterval = setInterval(async () => {
            await this.syncWithMT5();
        }, intervalMs);
    }
    /**
     * Stop automatic position sync
     */
    stopSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            logger_1.logger.info('[PositionRegistry] Position sync stopped');
        }
    }
    /**
     * Sync positions with MT5
     */
    async syncWithMT5() {
        try {
            const mt5Positions = await this.mt5Service.getOpenPositions();
            // Get current tickets
            const currentTickets = new Set(this.positions.keys());
            const mt5Tickets = new Set(mt5Positions.map(p => p.ticket));
            // Remove closed positions
            for (const ticket of currentTickets) {
                if (!mt5Tickets.has(ticket)) {
                    logger_1.logger.info('[PositionRegistry] Position closed', { ticket });
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
                }
                else {
                    // New position
                    const record = this.createPositionRecord(mt5Pos);
                    this.positions.set(mt5Pos.ticket, record);
                    logger_1.logger.info('[PositionRegistry] New position detected', {
                        ticket: record.ticket,
                        strategy: record.strategyName,
                        symbol: record.symbol
                    });
                }
            }
            this.lastSyncTime = new Date();
            this.syncFailures = 0;
        }
        catch (error) {
            this.syncFailures++;
            logger_1.logger.error('[PositionRegistry] Sync failed', {
                error: error.message,
                failures: this.syncFailures
            });
            // Clear registry after 3 consecutive failures (safety)
            if (this.syncFailures >= 3) {
                logger_1.logger.warn('[PositionRegistry] Too many sync failures, clearing registry');
                this.positions.clear();
            }
        }
    }
    /**
     * Create position record from MT5 position
     */
    createPositionRecord(mt5Pos) {
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
    calculateProfitPercent(mt5Pos) {
        const positionValue = mt5Pos.volume * 100000 * mt5Pos.openPrice;
        return positionValue > 0 ? (mt5Pos.profit / positionValue) * 100 : 0;
    }
    /**
     * Convert magic number to strategy ID
     */
    magicToStrategyId(magic) {
        return `strategy_${magic}`;
    }
    /**
     * Get all positions
     */
    getAllPositions() {
        return Array.from(this.positions.values());
    }
    /**
     * Get positions by strategy
     */
    getByStrategy(strategyId) {
        return this.getAllPositions().filter(p => p.strategyId === strategyId);
    }
    /**
     * Get positions by symbol
     */
    getBySymbol(symbol) {
        return this.getAllPositions().filter(p => p.symbol === symbol);
    }
    /**
     * Get profitable positions
     */
    getProfitable(minProfit = 0) {
        return this.getAllPositions().filter(p => p.profit > minProfit);
    }
    /**
     * Get losing positions
     */
    getLosing(maxLoss = 0) {
        return this.getAllPositions().filter(p => p.profit < maxLoss);
    }
    /**
     * Get oldest positions
     */
    getOldest(count) {
        return this.getAllPositions()
            .sort((a, b) => a.openTime.getTime() - b.openTime.getTime())
            .slice(0, count);
    }
    /**
     * Get newest positions
     */
    getNewest(count) {
        return this.getAllPositions()
            .sort((a, b) => b.openTime.getTime() - a.openTime.getTime())
            .slice(0, count);
    }
    /**
     * Get position by ticket
     */
    getByTicket(ticket) {
        return this.positions.get(ticket);
    }
    /**
     * Get position count
     */
    getCount() {
        return this.positions.size;
    }
    /**
     * Get position count by strategy
     */
    getCountByStrategy(strategyId) {
        return this.getByStrategy(strategyId).length;
    }
    /**
     * Get total exposure
     */
    getTotalExposure() {
        const exposure = new Map();
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
    getSummary() {
        const positions = this.getAllPositions();
        const byStrategy = new Map();
        const bySymbol = new Map();
        // Group by strategy
        for (const pos of positions) {
            const existing = byStrategy.get(pos.strategyId);
            if (existing) {
                existing.count++;
                existing.volume += pos.volume;
                existing.profit += pos.profit;
                existing.positions.push(pos);
            }
            else {
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
            }
            else {
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
    hasOpenPositions(strategyId) {
        return this.getByStrategy(strategyId).length > 0;
    }
    /**
     * Get sync status
     */
    getSyncStatus() {
        return {
            isRunning: this.syncInterval !== null,
            lastSync: this.lastSyncTime,
            failures: this.syncFailures,
            positionCount: this.positions.size
        };
    }
}
exports.PositionRegistry = PositionRegistry;
