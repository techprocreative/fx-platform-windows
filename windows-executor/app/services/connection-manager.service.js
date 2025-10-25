"use strict";
/**
 * Connection Manager Service
 * Handles auto-reconnection with exponential backoff for all connections
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionManager = void 0;
const events_1 = require("events");
class ConnectionManager extends events_1.EventEmitter {
    constructor(config, logger) {
        super();
        this.connections = new Map();
        this.reconnectTimers = new Map();
        this.config = {
            initialDelay: 1000, // 1 second
            maxDelay: 60000, // 1 minute
            maxAttempts: 10,
            backoffMultiplier: 2,
            ...config,
        };
        this.logger = logger || console.log;
        // Initialize connection statuses
        const types = ['pusher', 'zeromq', 'api', 'mt5'];
        types.forEach(type => {
            this.connections.set(type, {
                type,
                status: 'disconnected',
                reconnectAttempts: 0,
            });
        });
    }
    /**
     * Register a connection as connected
     */
    setConnected(type) {
        const status = this.connections.get(type);
        if (status) {
            status.status = 'connected';
            status.lastConnected = new Date();
            status.reconnectAttempts = 0;
            status.lastError = undefined;
            this.log('info', `${type} connected`, { type });
            this.emit('connection-status-changed', { type, status: 'connected' });
            // Clear any pending reconnect timer
            this.clearReconnectTimer(type);
        }
    }
    /**
     * Register a connection as disconnected
     */
    setDisconnected(type, error) {
        const status = this.connections.get(type);
        if (status) {
            status.status = 'disconnected';
            status.lastError = error;
            this.log('warn', `${type} disconnected`, { type, error });
            this.emit('connection-status-changed', { type, status: 'disconnected', error });
            // Start auto-reconnection
            this.scheduleReconnect(type);
        }
    }
    /**
     * Register a connection error
     */
    setError(type, error) {
        const status = this.connections.get(type);
        if (status) {
            status.status = 'error';
            status.lastError = error;
            this.log('error', `${type} connection error`, { type, error });
            this.emit('connection-status-changed', { type, status: 'error', error });
            // Start auto-reconnection
            this.scheduleReconnect(type);
        }
    }
    /**
     * Schedule reconnection with exponential backoff
     */
    scheduleReconnect(type) {
        const status = this.connections.get(type);
        if (!status)
            return;
        // Check if we've exceeded max attempts
        if (status.reconnectAttempts >= this.config.maxAttempts) {
            this.log('error', `${type} max reconnection attempts reached`, {
                type,
                attempts: status.reconnectAttempts,
            });
            this.emit('max-reconnect-attempts-reached', { type });
            return;
        }
        // Calculate delay with exponential backoff
        const delay = Math.min(this.config.initialDelay * Math.pow(this.config.backoffMultiplier, status.reconnectAttempts), this.config.maxDelay);
        status.reconnectAttempts++;
        status.status = 'connecting';
        this.log('info', `${type} scheduling reconnection attempt #${status.reconnectAttempts}`, {
            type,
            attempt: status.reconnectAttempts,
            delay,
        });
        // Notify after 3 failed attempts
        if (status.reconnectAttempts === 3) {
            this.emit('reconnection-struggling', {
                type,
                attempts: status.reconnectAttempts,
                message: `Having trouble reconnecting to ${type}. Will keep trying...`,
            });
        }
        // Clear existing timer
        this.clearReconnectTimer(type);
        // Schedule reconnection
        const timer = setTimeout(() => {
            this.emit('reconnect-requested', { type, attempt: status.reconnectAttempts });
        }, delay);
        this.reconnectTimers.set(type, timer);
    }
    /**
     * Clear reconnect timer for a connection
     */
    clearReconnectTimer(type) {
        const timer = this.reconnectTimers.get(type);
        if (timer) {
            clearTimeout(timer);
            this.reconnectTimers.delete(type);
        }
    }
    /**
     * Reset reconnection attempts for a connection
     */
    resetReconnectAttempts(type) {
        const status = this.connections.get(type);
        if (status) {
            status.reconnectAttempts = 0;
            this.clearReconnectTimer(type);
        }
    }
    /**
     * Get status for a specific connection
     */
    getStatus(type) {
        return this.connections.get(type);
    }
    /**
     * Get status for all connections
     */
    getAllStatuses() {
        return new Map(this.connections);
    }
    /**
     * Check if all connections are connected
     */
    areAllConnected() {
        return Array.from(this.connections.values()).every(status => status.status === 'connected');
    }
    /**
     * Check if any connection is in error state
     */
    hasErrors() {
        return Array.from(this.connections.values()).some(status => status.status === 'error');
    }
    /**
     * Get connection health summary
     */
    getHealthSummary() {
        const statuses = Array.from(this.connections.values());
        return {
            healthy: this.areAllConnected(),
            connected: statuses.filter(s => s.status === 'connected').length,
            disconnected: statuses.filter(s => s.status === 'disconnected').length,
            errors: statuses.filter(s => s.status === 'error').length,
            reconnecting: statuses.filter(s => s.status === 'connecting').length,
        };
    }
    /**
     * Force reconnection for a specific connection
     */
    forceReconnect(type) {
        const status = this.connections.get(type);
        if (status) {
            this.log('info', `Force reconnecting ${type}`, { type });
            this.clearReconnectTimer(type);
            status.reconnectAttempts = 0;
            this.emit('reconnect-requested', { type, forced: true });
        }
    }
    /**
     * Stop all reconnection attempts
     */
    stopAllReconnections() {
        this.log('info', 'Stopping all reconnection attempts');
        this.connections.forEach((_, type) => {
            this.clearReconnectTimer(type);
        });
    }
    /**
     * Cleanup and stop all timers
     */
    destroy() {
        this.log('info', 'Destroying connection manager');
        this.stopAllReconnections();
        this.removeAllListeners();
    }
    /**
     * Helper: Log messages
     */
    log(level, message, metadata) {
        this.logger(level, `[ConnectionManager] ${message}`, metadata);
    }
}
exports.ConnectionManager = ConnectionManager;
