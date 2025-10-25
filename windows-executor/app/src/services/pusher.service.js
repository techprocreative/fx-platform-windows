"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PusherService = void 0;
const pusher_js_1 = __importDefault(require("pusher-js"));
class PusherService {
    constructor(logger) {
        this.pusher = null;
        this.channel = null;
        this.config = null;
        this.connectionStatus = 'disconnected';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectTimeout = null;
        this.heartbeatInterval = null;
        this.eventHandlers = new Map();
        this.logger = logger || this.defaultLogger;
    }
    log(level, message, metadata) {
        this.logger(level, message, metadata);
    }
    /**
     * Connect to Pusher with authentication
     */
    async connect(config) {
        try {
            this.config = config;
            this.connectionStatus = 'connecting';
            this.log('info', 'Connecting to Pusher...', { cluster: config.pusherCluster });
            // Clear any existing reconnect timeout
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }
            this.pusher = new pusher_js_1.default(config.pusherKey, {
                cluster: config.pusherCluster,
                // encrypted: true, // Removed - not in current Pusher type definitions
                authEndpoint: `${config.platformUrl}/api/pusher/auth`,
                auth: {
                    headers: {
                        'X-API-Key': config.apiKey,
                        'X-API-Secret': config.apiSecret,
                    },
                    // Pusher will use application/x-www-form-urlencoded by default
                },
                forceTLS: true,
                disableStats: true,
                enabledTransports: ['ws', 'wss'],
            });
            // Set up connection event handlers
            this.pusher.connection.bind('connected', this.onConnected.bind(this));
            this.pusher.connection.bind('disconnected', this.onDisconnected.bind(this));
            this.pusher.connection.bind('error', this.onConnectionError.bind(this));
            this.pusher.connection.bind('unavailable', this.onConnectionUnavailable.bind(this));
            // Subscribe to private executor channel
            const success = await this.subscribeToExecutorChannel();
            if (success) {
                // Start heartbeat
                this.startHeartbeat();
                this.log('info', 'Pusher connection established successfully');
                return true;
            }
            else {
                this.log('error', 'Failed to subscribe to executor channel');
                return false;
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            this.log('error', 'Failed to connect to Pusher', {
                error: errorMessage,
                stack: errorStack,
                type: error?.constructor?.name
            });
            this.connectionStatus = 'error';
            this.scheduleReconnect();
            return false;
        }
    }
    /**
     * Subscribe to private executor channel
     */
    async subscribeToExecutorChannel() {
        return new Promise((resolve) => {
            if (!this.pusher || !this.config) {
                resolve(false);
                return;
            }
            const channelName = `private-executor-${this.config.executorId}`;
            this.channel = this.pusher.subscribe(channelName);
            // Bind to channel events
            this.channel.bind('pusher:subscription_succeeded', () => {
                this.log('info', `Successfully subscribed to channel: ${channelName}`);
                resolve(true);
            });
            this.channel.bind('pusher:subscription_error', (error) => {
                this.log('error', 'Channel subscription error', { error, channel: channelName });
                resolve(false);
            });
            // Bind to command events
            this.channel.bind('command-received', this.handleCommand.bind(this));
            this.channel.bind('command-cancel', this.handleCommandCancel.bind(this));
            this.channel.bind('emergency-stop', this.handleEmergencyStop.bind(this));
            this.channel.bind('executor-config-update', this.handleConfigUpdate.bind(this));
            // Set a timeout for subscription
            setTimeout(() => {
                if (this.channel && this.channel.subscribed !== true) {
                    this.log('error', 'Channel subscription timeout');
                    resolve(false);
                }
            }, 10000);
        });
    }
    /**
     * Handle incoming commands from web platform
     */
    async handleCommand(data) {
        try {
            this.log('info', 'Command received', { commandId: data.id, command: data.command });
            // Validate command structure
            if (!this.validateCommand(data)) {
                this.log('error', 'Invalid command structure', { commandId: data.id });
                this.emitEvent('command-error', {
                    commandId: data.id,
                    error: 'Invalid command structure',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            // Add metadata to command and fill in missing optional fields
            const enrichedCommand = {
                ...data,
                executorId: this.config?.executorId,
                priority: data.priority || 'NORMAL', // Default to NORMAL if not specified
                createdAt: data.createdAt || new Date().toISOString(), // Use current time if not specified
            };
            // Emit command to event handlers
            this.emitEvent('command-received', enrichedCommand);
        }
        catch (error) {
            this.log('error', 'Error handling command', {
                commandId: data.id,
                error: error.message
            });
        }
    }
    /**
     * Handle command cancellation
     */
    handleCommandCancel(data) {
        this.log('info', 'Command cancellation received', { commandId: data.commandId });
        this.emitEvent('command-cancel', data);
    }
    /**
     * Handle emergency stop
     */
    handleEmergencyStop(data) {
        this.log('warn', 'Emergency stop received', { reason: data.reason, initiator: data.initiator });
        this.emitEvent('emergency-stop', data);
    }
    /**
     * Handle configuration updates
     */
    handleConfigUpdate(data) {
        this.log('info', 'Configuration update received', data);
        this.emitEvent('config-update', data);
    }
    /**
     * Send command result back to web platform
     */
    async sendCommandResult(commandId, result) {
        try {
            if (!this.channel || !this.isConnected()) {
                this.log('error', 'Cannot send command result - not connected');
                return false;
            }
            // Trigger client event (if supported by your backend)
            // Note: Client events must be enabled in Pusher dashboard
            try {
                this.channel.trigger('client-command-result', {
                    commandId,
                    result,
                    executorId: this.config?.executorId,
                    timestamp: new Date().toISOString(),
                });
                this.log('info', 'Command result sent via Pusher', { commandId });
            }
            catch (clientEventError) {
                // Client events not enabled - this is OK, results will be sent via API
                this.log('debug', 'Client events not available, will use API fallback', {
                    commandId
                });
            }
            return true;
        }
        catch (error) {
            this.log('error', 'Failed to send command result', {
                commandId,
                error: error.message
            });
            return false;
        }
    }
    /**
     * Validate command structure
     */
    validateCommand(command) {
        // Basic validation - only require essential fields
        if (!command || typeof command.id !== 'string' || typeof command.command !== 'string') {
            return false;
        }
        // Priority and createdAt are optional - will be added if missing
        return true;
    }
    /**
     * Connection event handlers
     */
    onConnected() {
        this.connectionStatus = 'connected';
        this.reconnectAttempts = 0;
        this.log('info', 'Pusher connected successfully');
        this.emitEvent('connection-status', { status: 'connected' });
    }
    onDisconnected() {
        this.connectionStatus = 'disconnected';
        this.log('warn', 'Pusher disconnected');
        this.emitEvent('connection-status', { status: 'disconnected' });
        this.scheduleReconnect();
    }
    onConnectionError(error) {
        this.connectionStatus = 'error';
        this.log('error', 'Pusher connection error', { error });
        this.emitEvent('connection-status', { status: 'error', error });
        this.scheduleReconnect();
    }
    onConnectionUnavailable() {
        this.connectionStatus = 'error';
        this.log('warn', 'Pusher connection unavailable');
        this.emitEvent('connection-status', { status: 'error', message: 'Connection unavailable' });
        this.scheduleReconnect();
    }
    /**
     * Schedule reconnection with exponential backoff
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.log('error', 'Max reconnection attempts reached');
            this.emitEvent('connection-failed', {
                attempts: this.reconnectAttempts,
                message: 'Max reconnection attempts reached'
            });
            return;
        }
        // Calculate exponential backoff delay
        const baseDelay = 1000; // 1 second
        const maxDelay = 30000; // 30 seconds
        const delay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts), maxDelay);
        this.reconnectAttempts++;
        this.log('info', `Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
        this.reconnectTimeout = setTimeout(async () => {
            if (this.config) {
                await this.connect(this.config);
            }
        }, delay);
    }
    /**
     * Start heartbeat to monitor connection
     */
    startHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected()) {
                this.emitEvent('heartbeat', {
                    timestamp: new Date().toISOString(),
                    status: 'connected',
                });
            }
        }, 30000); // Every 30 seconds
    }
    /**
     * Stop heartbeat
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    /**
     * Event emitter functionality
     */
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }
    off(event, handler) {
        if (!this.eventHandlers.has(event)) {
            return;
        }
        if (handler) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
        else {
            this.eventHandlers.delete(event);
        }
    }
    emitEvent(event, data) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                }
                catch (error) {
                    this.log('error', `Error in event handler for ${event}`, {
                        error: error.message
                    });
                }
            });
        }
    }
    /**
     * Get connection status
     */
    getConnectionStatus() {
        return this.connectionStatus;
    }
    /**
     * Check if connected
     */
    isConnected() {
        return this.pusher?.connection.state === 'connected' && this.connectionStatus === 'connected';
    }
    /**
     * Get connection statistics
     */
    getConnectionStats() {
        return {
            status: this.connectionStatus,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts,
            channelSubscribed: this.channel?.subscribed || false,
            socketId: this.pusher?.connection.socket_id || null,
            connectedAt: this.connectionStatus === 'connected' ? new Date().toISOString() : null,
        };
    }
    /**
     * Disconnect from Pusher
     */
    disconnect() {
        this.log('info', 'Disconnecting from Pusher...');
        // Clear timeouts
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.stopHeartbeat();
        // Disconnect Pusher
        if (this.pusher) {
            this.pusher.disconnect();
            this.pusher = null;
        }
        this.channel = null;
        this.connectionStatus = 'disconnected';
        this.reconnectAttempts = 0;
        this.log('info', 'Pusher disconnected');
        this.emitEvent('connection-status', { status: 'disconnected' });
    }
    /**
     * Force reconnection
     */
    async forceReconnect() {
        this.log('info', 'Force reconnection requested');
        this.disconnect();
        if (this.config) {
            return await this.connect(this.config);
        }
        return false;
    }
    /**
     * Default logger implementation
     */
    defaultLogger(level, message, metadata) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            service: 'PusherService',
            message,
            metadata,
        };
        console[level] ? console[level](`[${timestamp}] [${level}] [PusherService] ${message}`, metadata) : console.log(logEntry);
    }
    /**
     * Set custom logger
     */
    setLogger(logger) {
        this.logger = logger;
    }
    /**
     * Get channel information
     */
    getChannelInfo() {
        return {
            name: this.channel ? `private-executor-${this.config?.executorId}` : null,
            subscribed: this.channel?.subscribed || false,
            subscribedAt: this.channel?.subscribed_at || null,
        };
    }
}
exports.PusherService = PusherService;
