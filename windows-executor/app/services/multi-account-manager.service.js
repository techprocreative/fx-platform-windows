"use strict";
/**
 * Multi-Account Manager Service
 * Manages multiple MT5 accounts (demo & live)
 * with separate risk limits and segregation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiAccountManager = void 0;
const events_1 = require("events");
const logger_1 = require("../utils/logger");
const safety_validator_service_1 = require("./safety-validator.service");
class MultiAccountManager extends events_1.EventEmitter {
    constructor() {
        super();
        this.accounts = new Map();
        this.activeAccount = null;
        logger_1.logger.info('[MultiAccountManager] Service initialized');
    }
    /**
     * Add a new account
     */
    async addAccount(config) {
        try {
            logger_1.logger.info(`[MultiAccountManager] Adding ${config.type} account: ${config.login}`);
            // Validate config
            if (!config.login || !config.password || !config.server) {
                throw new Error('Invalid account configuration');
            }
            // Check if account already exists
            if (this.accounts.has(config.login)) {
                throw new Error(`Account ${config.login} already exists`);
            }
            // Set appropriate limits based on account type
            const limits = this.getLimitsForAccountType(config.type);
            // Create safety validator for this account
            const safetyValidator = new safety_validator_service_1.SafetyValidatorService(limits);
            // Initialize account info
            const info = {
                login: config.login,
                type: config.type,
                broker: config.broker,
                server: config.server,
                balance: 0,
                equity: 0,
                margin: 0,
                freeMargin: 0,
                marginLevel: 0,
                profit: 0,
                openPositions: 0,
                isConnected: false,
                lastUpdate: new Date(),
            };
            // Store account
            this.accounts.set(config.login, {
                config,
                info,
                limits,
                safetyValidator,
                isActive: false,
            });
            // Try to connect
            await this.connectAccount(config.login);
            this.emit('account-added', { login: config.login, type: config.type });
            logger_1.logger.info(`[MultiAccountManager] Account ${config.login} added successfully`);
        }
        catch (error) {
            logger_1.logger.error('[MultiAccountManager] Error adding account:', error);
            throw error;
        }
    }
    /**
     * Remove an account
     */
    async removeAccount(login) {
        const account = this.accounts.get(login);
        if (!account) {
            throw new Error(`Account ${login} not found`);
        }
        // Disconnect if active
        if (account.isActive) {
            await this.disconnectAccount(login);
        }
        // Remove from map
        this.accounts.delete(login);
        this.emit('account-removed', { login });
        logger_1.logger.info(`[MultiAccountManager] Account ${login} removed`);
    }
    /**
     * Connect to an account
     */
    async connectAccount(login) {
        const account = this.accounts.get(login);
        if (!account) {
            throw new Error(`Account ${login} not found`);
        }
        logger_1.logger.info(`[MultiAccountManager] Connecting to account ${login}...`);
        try {
            // TODO: Implement actual MT5 connection
            // For now, simulate connection
            // Update account info from MT5
            await this.updateAccountInfo(login);
            account.isActive = true;
            account.info.isConnected = true;
            this.emit('account-connected', { login, type: account.config.type });
            logger_1.logger.info(`[MultiAccountManager] Connected to account ${login}`);
        }
        catch (error) {
            logger_1.logger.error(`[MultiAccountManager] Failed to connect to account ${login}:`, error);
            account.info.isConnected = false;
            throw error;
        }
    }
    /**
     * Disconnect from an account
     */
    async disconnectAccount(login) {
        const account = this.accounts.get(login);
        if (!account) {
            throw new Error(`Account ${login} not found`);
        }
        account.isActive = false;
        account.info.isConnected = false;
        this.emit('account-disconnected', { login });
        logger_1.logger.info(`[MultiAccountManager] Disconnected from account ${login}`);
    }
    /**
     * Switch active account
     */
    async switchAccount(login) {
        const account = this.accounts.get(login);
        if (!account) {
            throw new Error(`Account ${login} not found`);
        }
        if (!account.isActive) {
            await this.connectAccount(login);
        }
        this.activeAccount = login;
        this.emit('account-switched', { login, type: account.config.type });
        logger_1.logger.info(`[MultiAccountManager] Switched to account ${login}`);
    }
    /**
     * Get active account
     */
    getActiveAccount() {
        return this.activeAccount;
    }
    /**
     * Get account info
     */
    getAccountInfo(login) {
        const account = this.accounts.get(login);
        return account ? account.info : null;
    }
    /**
     * Get account limits
     */
    getAccountLimits(login) {
        const account = this.accounts.get(login);
        return account ? account.limits : null;
    }
    /**
     * Get safety validator for account
     */
    getSafetyValidator(login) {
        const account = this.accounts.get(login);
        return account ? account.safetyValidator : null;
    }
    /**
     * Update account limits
     */
    updateAccountLimits(login, limits) {
        const account = this.accounts.get(login);
        if (!account) {
            throw new Error(`Account ${login} not found`);
        }
        // Update limits
        account.limits = { ...account.limits, ...limits };
        // Update safety validator
        account.safetyValidator.updateLimits(limits);
        this.emit('account-limits-updated', { login, limits: account.limits });
        logger_1.logger.info(`[MultiAccountManager] Updated limits for account ${login}`);
    }
    /**
     * Get all accounts
     */
    getAllAccounts() {
        return Array.from(this.accounts.entries()).map(([login, account]) => ({
            login,
            type: account.config.type,
            info: account.info,
        }));
    }
    /**
     * Get accounts by type
     */
    getAccountsByType(type) {
        return Array.from(this.accounts.entries())
            .filter(([_, account]) => account.config.type === type)
            .map(([login, _]) => login);
    }
    /**
     * Update account info from MT5
     */
    async updateAccountInfo(login) {
        const account = this.accounts.get(login);
        if (!account) {
            return;
        }
        try {
            // TODO: Get actual data from MT5
            // For now, use mock data
            account.info = {
                ...account.info,
                balance: 10000, // Mock data
                equity: 10000,
                margin: 0,
                freeMargin: 10000,
                marginLevel: 0,
                profit: 0,
                openPositions: 0,
                lastUpdate: new Date(),
            };
            // Update safety validator with new balance
            account.safetyValidator.updateBalance(account.info.balance);
        }
        catch (error) {
            logger_1.logger.error(`[MultiAccountManager] Error updating account info for ${login}:`, error);
        }
    }
    /**
     * Get limits based on account type
     */
    getLimitsForAccountType(type) {
        if (type === 'demo') {
            return {
                maxDailyLoss: 1000,
                maxDailyLossPercent: 10,
                maxDrawdown: 3000,
                maxDrawdownPercent: 30,
                maxPositions: 10,
                maxLotSize: 1.0,
                maxTotalExposure: 10000,
                requireConfirmation: false,
                allowHighRiskStrategies: true,
                autoStopOnLimit: true,
            };
        }
        else {
            // Live account - much more conservative
            return {
                maxDailyLoss: 200,
                maxDailyLossPercent: 2,
                maxDrawdown: 600,
                maxDrawdownPercent: 6,
                maxPositions: 3,
                maxLotSize: 0.1,
                maxTotalExposure: 1000,
                requireConfirmation: true,
                allowHighRiskStrategies: false,
                autoStopOnLimit: true,
            };
        }
    }
    /**
     * Validate trade for specific account
     */
    async validateTradeForAccount(login, signal) {
        const account = this.accounts.get(login);
        if (!account) {
            throw new Error(`Account ${login} not found`);
        }
        return await account.safetyValidator.validateBeforeTrade(signal);
    }
    /**
     * Start periodic account updates
     */
    startPeriodicUpdates(intervalMs = 60000) {
        setInterval(async () => {
            for (const [login, account] of this.accounts) {
                if (account.isActive) {
                    await this.updateAccountInfo(login);
                }
            }
        }, intervalMs);
        logger_1.logger.info('[MultiAccountManager] Periodic updates started');
    }
}
exports.MultiAccountManager = MultiAccountManager;
