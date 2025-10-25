"use strict";
/**
 * MT5 Account Service
 * Fetches real account information from MT5 terminal
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MT5AccountService = void 0;
const logger_1 = require("../utils/logger");
class MT5AccountService {
    constructor() {
        this.cachedAccountInfo = null;
        this.cacheExpiry = 0;
        this.cacheLifetime = 5000; // 5 seconds
        this.cachedPositions = [];
        this.positionsCacheExpiry = 0;
    }
    /**
     * Get current account information from MT5
     */
    async getAccountInfo() {
        // Check cache
        if (this.cachedAccountInfo && Date.now() < this.cacheExpiry) {
            return this.cachedAccountInfo;
        }
        try {
            logger_1.logger.debug('[MT5AccountService] Fetching account info from MT5...');
            // TODO: Replace with actual MT5 ZMQ or native bridge call
            // For now, simulate MT5 account info
            const accountInfo = await this.fetchAccountInfoFromMT5();
            // Cache result
            this.cachedAccountInfo = accountInfo;
            this.cacheExpiry = Date.now() + this.cacheLifetime;
            logger_1.logger.info(`[MT5AccountService] Account Info: Balance=$${accountInfo.balance.toFixed(2)}, Equity=$${accountInfo.equity.toFixed(2)}`);
            return accountInfo;
        }
        catch (error) {
            logger_1.logger.error('[MT5AccountService] Failed to fetch account info:', error);
            // Return cached data if available, otherwise throw
            if (this.cachedAccountInfo) {
                logger_1.logger.warn('[MT5AccountService] Using cached account info due to error');
                return this.cachedAccountInfo;
            }
            throw error;
        }
    }
    /**
     * Get all open positions from MT5
     */
    async getOpenPositions() {
        // Check cache
        if (this.cachedPositions.length > 0 && Date.now() < this.positionsCacheExpiry) {
            return this.cachedPositions;
        }
        try {
            logger_1.logger.debug('[MT5AccountService] Fetching open positions from MT5...');
            const positions = await this.fetchPositionsFromMT5();
            // Cache result
            this.cachedPositions = positions;
            this.positionsCacheExpiry = Date.now() + this.cacheLifetime;
            logger_1.logger.info(`[MT5AccountService] Open positions: ${positions.length}`);
            return positions;
        }
        catch (error) {
            logger_1.logger.error('[MT5AccountService] Failed to fetch positions:', error);
            if (this.cachedPositions.length > 0) {
                logger_1.logger.warn('[MT5AccountService] Using cached positions due to error');
                return this.cachedPositions;
            }
            return [];
        }
    }
    /**
     * Get positions for a specific symbol
     */
    async getPositionsBySymbol(symbol) {
        const allPositions = await this.getOpenPositions();
        return allPositions.filter(p => p.symbol === symbol);
    }
    /**
     * Get positions for a specific strategy (by magic number)
     */
    async getPositionsByStrategy(strategyId) {
        const magic = this.strategyIdToMagic(strategyId);
        const allPositions = await this.getOpenPositions();
        return allPositions.filter(p => p.magic === magic);
    }
    /**
     * Convert MT5 positions to strategy positions
     */
    convertToStrategyPositions(mt5Positions) {
        return mt5Positions.map(pos => ({
            ticket: pos.ticket,
            symbol: pos.symbol,
            type: pos.type,
            volume: pos.volume,
            openPrice: pos.openPrice,
            currentPrice: pos.currentPrice,
            stopLoss: pos.stopLoss,
            takeProfit: pos.takeProfit,
            profit: pos.profit,
            openedAt: pos.openTime
        }));
    }
    /**
     * Calculate total exposure
     */
    async calculateTotalExposure() {
        const positions = await this.getOpenPositions();
        return positions.reduce((total, pos) => total + pos.volume, 0);
    }
    /**
     * Calculate exposure by symbol
     */
    async calculateExposureBySymbol(symbol) {
        const positions = await this.getPositionsBySymbol(symbol);
        return positions.reduce((total, pos) => total + pos.volume, 0);
    }
    /**
     * Get account statistics
     */
    async getAccountStatistics() {
        try {
            // TODO: Fetch from MT5 history
            // For now, return placeholders
            return {
                dailyPnL: 0,
                weeklyPnL: 0,
                monthlyPnL: 0,
                totalTrades: 0,
                winRate: 0,
                profitFactor: 0
            };
        }
        catch (error) {
            logger_1.logger.error('[MT5AccountService] Failed to fetch statistics:', error);
            throw error;
        }
    }
    /**
     * Check if account is ready for trading
     */
    async isReadyForTrading() {
        const reasons = [];
        try {
            const account = await this.getAccountInfo();
            // Check if connected
            if (!account) {
                reasons.push('Not connected to MT5');
                return { ready: false, reasons };
            }
            // Check margin level
            if (account.marginLevel < 200) {
                reasons.push(`Margin level too low: ${account.marginLevel.toFixed(2)}%`);
            }
            // Check free margin
            if (account.freeMargin < 100) {
                reasons.push(`Free margin too low: $${account.freeMargin.toFixed(2)}`);
            }
            // Check balance
            if (account.balance < 100) {
                reasons.push(`Balance too low: $${account.balance.toFixed(2)}`);
            }
            return {
                ready: reasons.length === 0,
                reasons
            };
        }
        catch (error) {
            reasons.push(`Error checking account: ${error.message}`);
            return { ready: false, reasons };
        }
    }
    /**
     * Get current drawdown percentage
     */
    async getCurrentDrawdown() {
        try {
            const account = await this.getAccountInfo();
            const initialBalance = account.balance + account.profit; // Approximate
            if (initialBalance <= 0)
                return 0;
            const drawdown = ((initialBalance - account.equity) / initialBalance) * 100;
            return Math.max(0, drawdown);
        }
        catch (error) {
            logger_1.logger.error('[MT5AccountService] Failed to calculate drawdown:', error);
            return 0;
        }
    }
    /**
     * Clear cache (force refresh)
     */
    clearCache() {
        this.cachedAccountInfo = null;
        this.cacheExpiry = 0;
        this.cachedPositions = [];
        this.positionsCacheExpiry = 0;
        logger_1.logger.info('[MT5AccountService] Cache cleared');
    }
    /**
     * Fetch account info from MT5 (to be implemented with ZMQ/bridge)
     */
    async fetchAccountInfoFromMT5() {
        // TODO: Implement actual MT5 communication
        // This is where you'd call your ZMQ bridge or MT5 native API
        // Placeholder implementation
        // In production, this should send ZMQ request to MT5 Expert Advisor
        // Simulate MT5 response
        return {
            balance: 10000,
            equity: 10000,
            margin: 0,
            freeMargin: 10000,
            marginLevel: 0,
            profit: 0,
            currency: 'USD',
            leverage: 100,
            accountNumber: '12345678',
            server: 'MetaQuotes-Demo',
            company: 'MetaQuotes Software Corp.'
        };
    }
    /**
     * Fetch positions from MT5 (to be implemented with ZMQ/bridge)
     */
    async fetchPositionsFromMT5() {
        // TODO: Implement actual MT5 communication
        // Placeholder implementation
        return [];
    }
    /**
     * Convert strategy ID to magic number
     */
    strategyIdToMagic(strategyId) {
        // Simple hash function to convert strategy ID to magic number
        let hash = 0;
        for (let i = 0; i < strategyId.length; i++) {
            const char = strategyId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash) % 999999 + 100000; // 6-digit magic number
    }
}
exports.MT5AccountService = MT5AccountService;
