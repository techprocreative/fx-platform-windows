"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiService = void 0;
const axios_1 = __importDefault(require("axios"));
class ApiService {
    constructor(log) {
        this.config = null;
        this.log = log || console.log;
        this.client = axios_1.default.create({
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'FX-Executor/1.0.0',
            },
        });
        this.setupInterceptors();
    }
    setupInterceptors() {
        this.client.interceptors.request.use((config) => {
            if (this.config) {
                config.headers['X-API-Key'] = this.config.apiKey;
                config.headers['X-API-Secret'] = this.config.apiSecret;
                config.headers['X-Executor-Id'] = this.config.executorId;
            }
            return config;
        }, (error) => Promise.reject(error));
        this.client.interceptors.response.use((response) => response, (error) => {
            this.log('error', 'API request failed', {
                url: error.config?.url,
                status: error.response?.status,
                message: error.message,
            });
            return Promise.reject(error);
        });
    }
    configure(config) {
        this.config = config;
        this.client.defaults.baseURL = config.platformUrl;
    }
    async sendHeartbeat(payload) {
        try {
            const response = await this.client.post(`/api/executor/${this.config?.executorId}/heartbeat`, payload);
            this.log('debug', 'Heartbeat sent successfully', response.data);
            return response.data;
        }
        catch (error) {
            this.log('error', 'Failed to send heartbeat', { error: error.message });
            throw error;
        }
    }
    async reportCommandResult(commandId, status, result) {
        try {
            await this.client.patch(`/api/executor/${this.config?.executorId}/command`, {
                commandId,
                status,
                result,
                timestamp: new Date().toISOString(),
            });
            this.log('debug', 'Command result reported', { commandId, status });
        }
        catch (error) {
            this.log('error', 'Failed to report command result', {
                commandId,
                error: error.message,
            });
            throw error;
        }
    }
    async reportTrade(trade) {
        try {
            await this.client.post(`/api/trades`, {
                executorId: this.config?.executorId,
                ...trade,
                timestamp: new Date().toISOString(),
            });
            this.log('info', 'Trade reported', { ticket: trade.ticket });
        }
        catch (error) {
            this.log('error', 'Failed to report trade', {
                ticket: trade.ticket,
                error: error.message,
            });
        }
    }
    async reportTradeClose(ticket, closePrice, closeTime, profit) {
        try {
            await this.client.patch(`/api/trades/${ticket}`, {
                executorId: this.config?.executorId,
                closePrice,
                closeTime,
                profit,
                timestamp: new Date().toISOString(),
            });
            this.log('info', 'Trade close reported', { ticket, profit });
        }
        catch (error) {
            this.log('error', 'Failed to report trade close', {
                ticket,
                error: error.message,
            });
        }
    }
    async reportSafetyAlert(alert) {
        try {
            await this.client.post(`/api/alerts`, {
                executorId: this.config?.executorId,
                category: 'safety',
                ...alert,
                timestamp: new Date().toISOString(),
            });
            this.log('warn', 'Safety alert reported', alert);
        }
        catch (error) {
            this.log('error', 'Failed to report safety alert', {
                error: error.message,
            });
        }
    }
    async reportSecurityEvent(event) {
        try {
            await this.client.post(`/api/alerts`, {
                executorId: this.config?.executorId,
                category: 'security',
                ...event,
                timestamp: new Date().toISOString(),
            });
            this.log('error', 'Security event reported', event);
        }
        catch (error) {
            this.log('error', 'Failed to report security event', {
                error: error.message,
            });
        }
    }
    async reportError(error) {
        try {
            await this.client.post(`/api/errors/report`, {
                executorId: this.config?.executorId,
                ...error,
                timestamp: new Date().toISOString(),
            });
            this.log('error', 'Error reported to platform', error);
        }
        catch (err) {
            this.log('error', 'Failed to report error', {
                error: err.message,
            });
        }
    }
    async getPendingCommands() {
        try {
            const response = await this.client.get(`/api/executor/${this.config?.executorId}/commands/pending`);
            if (response.data.success && response.data.data) {
                this.log('debug', 'Retrieved pending commands', {
                    count: response.data.data.length,
                });
                return response.data.data;
            }
            return [];
        }
        catch (error) {
            this.log('error', 'Failed to get pending commands', {
                error: error.message,
            });
            return [];
        }
    }
    async updateExecutorStatus(status) {
        try {
            await this.client.patch(`/api/executor/${this.config?.executorId}`, {
                status,
                timestamp: new Date().toISOString(),
            });
            this.log('info', 'Executor status updated', { status });
        }
        catch (error) {
            this.log('error', 'Failed to update executor status', {
                error: error.message,
            });
        }
    }
    async testConnection() {
        try {
            const response = await this.client.get(`/api/executor/${this.config?.executorId}/ping`);
            return response.data.success;
        }
        catch (error) {
            this.log('error', 'Connection test failed', {
                error: error.message,
            });
            return false;
        }
    }
    async registerExecutor(executorData) {
        try {
            const response = await this.client.post(`/api/executor/register`, executorData);
            return response.data.success;
        }
        catch (error) {
            this.log('error', 'Failed to register executor', {
                error: error.message,
            });
            return false;
        }
    }
    isConfigured() {
        return this.config !== null && !!this.config.apiKey && !!this.config.executorId;
    }
}
exports.ApiService = ApiService;
