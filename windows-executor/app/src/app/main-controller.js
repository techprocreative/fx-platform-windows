"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MainController = void 0;
const events_1 = require("events");
const mt5_auto_installer_service_1 = require("../services/mt5-auto-installer.service");
const mt5_detector_service_1 = require("../services/mt5-detector.service");
const pusher_service_1 = require("../services/pusher.service");
const zeromq_service_1 = require("../services/zeromq.service");
const zeromq_server_service_1 = require("../services/zeromq-server.service");
const command_service_1 = require("../services/command.service");
const heartbeat_service_1 = require("../services/heartbeat.service");
const safety_service_1 = require("../services/safety.service");
const monitoring_service_1 = require("../services/monitoring.service");
const security_service_1 = require("../services/security.service");
const api_service_1 = require("../services/api.service");
const connection_manager_service_1 = require("../services/connection-manager.service");
const manager_1 = require("../database/manager");
const strategy_service_1 = require("../services/strategy.service");
const indicator_service_1 = require("../services/indicator.service");
const market_data_service_1 = require("../services/market-data.service");
const llm_service_1 = require("../services/llm.service");
const mt5_account_service_1 = require("../services/mt5-account.service");
const performance_monitor_service_1 = require("../services/performance-monitor.service");
const alert_service_1 = require("../services/alert.service");
// New services for live trading readiness
const strategy_monitor_service_1 = require("../services/strategy-monitor.service");
const safety_validator_service_1 = require("../services/safety-validator.service");
const emergency_stop_service_1 = require("../services/emergency-stop.service");
const command_processor_service_1 = require("../services/command-processor.service");
const condition_evaluator_service_1 = require("../services/condition-evaluator.service");
const filter_evaluator_service_1 = require("../services/filter-evaluator.service");
const position_sizing_service_1 = require("../services/position-sizing.service");
const indicator_advanced_service_1 = require("../services/indicator-advanced.service");
const position_sizing_advanced_service_1 = require("../services/position-sizing-advanced.service");
const smart_exit_executor_service_1 = require("../services/smart-exit-executor.service");
const correlation_executor_service_1 = require("../services/correlation-executor.service");
const multi_account_manager_service_1 = require("../services/multi-account-manager.service");
const disaster_recovery_service_1 = require("../services/disaster-recovery.service");
const cache_manager_service_1 = require("../services/cache-manager.service");
const performance_optimizer_service_1 = require("../services/performance-optimizer.service");
/**
 * Main Application Controller
 *
 * This controller manages the entire lifecycle of the Windows Executor application,
 * coordinating all services and providing a unified interface for the UI.
 */
class MainController extends events_1.EventEmitter {
    constructor() {
        super();
        this.config = null;
        this.isInitialized = false;
        this.isShuttingDown = false;
        this.executorId = '';
        // State
        this.connectionStatus = {
            pusher: 'disconnected',
            zeromq: 'disconnected',
            api: 'disconnected',
            mt5: 'disconnected',
        };
        this.mt5Installations = [];
        this.logs = [];
        this.activeStrategies = [];
        this.performanceMetrics = {
            totalTrades: 0,
            winRate: 0,
            profitFactor: 0,
            dailyPnL: 0,
            maxDrawdown: 0,
        };
        // Initialize database
        const dbConfig = {
            path: './executor.db',
            encryptionKey: 'fx-executor-encryption-key',
            backupEnabled: true,
            backupInterval: 24,
            maxBackups: 7,
        };
        this.db = new manager_1.DatabaseManager(dbConfig);
        // Initialize services
        this.initializeServices();
        // Setup error handling
        this.setupErrorHandling();
        // Setup process event handlers
        this.setupProcessHandlers();
    }
    /**
     * Initialize all services
     */
    initializeServices() {
        // Create logger function
        const logger = (level, message, metadata) => {
            this.addLog(level, 'MAIN', message, metadata);
        };
        // Initialize services with dependency injection
        this.mt5Detector = new mt5_detector_service_1.MT5DetectorService();
        this.mt5Installer = new mt5_auto_installer_service_1.MT5AutoInstaller();
        this.apiService = new api_service_1.ApiService(logger);
        this.connectionManager = new connection_manager_service_1.ConnectionManager({
            initialDelay: 1000,
            maxDelay: 60000,
            maxAttempts: 10,
            backoffMultiplier: 2,
        }, logger);
        this.pusherService = new pusher_service_1.PusherService(logger);
        this.zeromqService = new zeromq_service_1.ZeroMQService(logger);
        this.zeromqServer = new zeromq_server_service_1.ZeroMQServerService(logger);
        this.safetyService = new safety_service_1.SafetyService(this.db);
        this.monitoringService = new monitoring_service_1.MonitoringService(this.db);
        this.securityService = new security_service_1.SecurityService(this.db, 'encryption-key-placeholder');
        // Command service depends on other services
        this.commandService = new command_service_1.CommandService(this.zeromqService, this.pusherService, this.safetyService.getLimits(), this.getRateLimitConfig(), logger, this.apiService);
        // Heartbeat service
        this.heartbeatService = new heartbeat_service_1.HeartbeatService(this.zeromqService, this.pusherService, this.commandService, logger, this.apiService);
        // Strategy Engine services (NEW)
        this.indicatorService = new indicator_service_1.IndicatorService();
        this.marketDataService = new market_data_service_1.MarketDataService(this.zeromqService);
        // PHASE 1-5: Live Trading Services
        // Cache services (Phase 5)
        this.indicatorCache = new cache_manager_service_1.IndicatorCache();
        this.marketDataCache = new cache_manager_service_1.MarketDataCache();
        // Advanced indicators (Phase 2)
        this.advancedIndicators = new indicator_advanced_service_1.AdvancedIndicatorService();
        // Safety and monitoring (Phase 1)
        this.safetyValidator = new safety_validator_service_1.SafetyValidatorService({
            maxDailyLoss: Number(process.env.MAX_DAILY_LOSS) || 1000,
            maxDailyLossPercent: Number(process.env.MAX_DAILY_LOSS_PERCENT) || 10,
            maxDrawdown: Number(process.env.MAX_DRAWDOWN) || 3000,
            maxDrawdownPercent: Number(process.env.MAX_DRAWDOWN_PERCENT) || 30,
            maxPositions: Number(process.env.MAX_POSITIONS) || 10,
            maxLotSize: Number(process.env.MAX_LOT_SIZE) || 1.0,
            maxCorrelation: Number(process.env.MAX_CORRELATION) || 0.7,
            maxTotalExposure: Number(process.env.MAX_TOTAL_EXPOSURE) || 5000,
        });
        this.emergencyStop = new emergency_stop_service_1.EmergencyStopService();
        // Strategy evaluation services (Phase 1)
        this.conditionEvaluator = new condition_evaluator_service_1.ConditionEvaluatorService(this.indicatorService);
        this.filterEvaluator = new filter_evaluator_service_1.FilterEvaluatorService();
        this.positionSizing = new position_sizing_service_1.PositionSizingService();
        this.advancedPositionSizing = new position_sizing_advanced_service_1.AdvancedPositionSizingService();
        // Strategy monitor (Phase 1) - The core 24/7 monitoring service
        this.strategyMonitor = new strategy_monitor_service_1.StrategyMonitor(this.indicatorService, this.marketDataService, this.conditionEvaluator, this.filterEvaluator, this.positionSizing, this.safetyValidator);
        // Exit management (Phase 3)
        this.smartExitExecutor = new smart_exit_executor_service_1.SmartExitExecutor();
        this.correlationExecutor = new correlation_executor_service_1.CorrelationExecutorService();
        // Account management (Phase 4)
        this.multiAccountManager = new multi_account_manager_service_1.MultiAccountManager();
        // Disaster recovery (Phase 4)
        this.disasterRecovery = new disaster_recovery_service_1.DisasterRecoveryService({
            enabled: true,
            autoBackup: true,
            backupInterval: 60 * 60 * 1000, // 1 hour
            maxBackups: 24,
            backupPath: './backups',
        });
        // Performance optimization (Phase 5)
        this.performanceOptimizer = new performance_optimizer_service_1.PerformanceOptimizer();
        // Command processor (Phase 1) - Wires everything together
        this.commandProcessor = new command_processor_service_1.CommandProcessor();
        this.addLog('info', 'MAIN', 'All services initialized successfully (11 core + 11 live trading services)');
        // Setup service event handlers
        this.setupServiceEventHandlers();
    }
    /**
     * Initialize strategy service after connection is established
     */
    initializeStrategyService() {
        if (!this.config) {
            this.addLog('warn', 'MAIN', 'Cannot initialize strategy service: no config');
            return;
        }
        this.strategyService = new strategy_service_1.StrategyService(this.config.platformUrl, this.executorId, this.indicatorService, this.marketDataService);
        // Setup strategy event handlers
        this.setupStrategyEventHandlers();
        this.addLog('info', 'MAIN', 'Strategy service initialized');
    }
    /**
     * Setup strategy event handlers
     */
    setupStrategyEventHandlers() {
        // Strategy events
        this.strategyService.on('strategy:loaded', (strategy) => {
            this.addLog('info', 'STRATEGY', `Strategy loaded: ${strategy.name}`);
        });
        this.strategyService.on('strategy:started', ({ strategy }) => {
            this.addLog('info', 'STRATEGY', `Strategy started: ${strategy.name}`);
        });
        this.strategyService.on('strategy:stopped', ({ strategy }) => {
            this.addLog('info', 'STRATEGY', `Strategy stopped: ${strategy.name}`);
        });
        // Signal generation
        this.strategyService.on('signal:generated', async (signal) => {
            this.addLog('info', 'SIGNAL', `${signal.type} signal on ${signal.symbol}`, {
                confidence: signal.confidence,
                reasons: signal.reasons
            });
            // Execute signal via command service
            try {
                const command = {
                    id: signal.id,
                    type: 'OPEN_TRADE',
                    params: {
                        symbol: signal.symbol,
                        type: signal.type,
                        volume: signal.volume,
                        stopLoss: signal.stopLoss,
                        takeProfit: signal.takeProfit
                    },
                    timestamp: new Date().toISOString(),
                    priority: 'high'
                };
                // Queue command for execution
                // @ts-ignore - executeCommand is accessible via event system
                await this.commandService.queueCommand(command);
            }
            catch (error) {
                this.addLog('error', 'SIGNAL', 'Failed to execute signal', { signal, error });
            }
        });
        // LLM consultations
        this.strategyService.on('llm:consultation', (consultation) => {
            this.addLog('info', 'LLM', `Consultation: ${consultation.query.substring(0, 50)}...`);
        });
    }
    /**
     * Setup event handlers for all services
     */
    setupServiceEventHandlers() {
        // Connection Manager events
        this.connectionManager.on('connection-status-changed', (data) => {
            this.addLog('info', 'CONNECTION', `${data.type} status changed: ${data.status}`, data);
            // Update local connection status
            if (data.type === 'pusher')
                this.connectionStatus.pusher = data.status;
            if (data.type === 'zeromq')
                this.connectionStatus.zeromq = data.status;
            if (data.type === 'api')
                this.connectionStatus.api = data.status;
            if (data.type === 'mt5')
                this.connectionStatus.mt5 = data.status;
            this.emit('connection-status-changed', this.connectionStatus);
        });
        this.connectionManager.on('reconnect-requested', async (data) => {
            this.addLog('info', 'CONNECTION', `Reconnecting ${data.type}...`, data);
            // Reconnection will be handled by each service's internal retry logic
            // This event is mainly for logging and UI notifications
        });
        this.connectionManager.on('reconnection-struggling', (data) => {
            this.addLog('warn', 'CONNECTION', data.message, data);
            // Notify user via UI
            this.emit('show-notification', {
                type: 'warning',
                title: 'Connection Issues',
                message: data.message,
            });
        });
        this.connectionManager.on('max-reconnect-attempts-reached', (data) => {
            this.addLog('error', 'CONNECTION', `${data.type} reconnection failed after max attempts`, data);
            // Notify user
            this.emit('show-notification', {
                type: 'error',
                title: 'Connection Lost',
                message: `Failed to reconnect to ${data.type}. Please check your connection and restart the application.`,
            });
        });
        // Pusher service events
        this.pusherService.on('connection-status', (data) => {
            if (data.status === 'connected') {
                this.connectionManager.setConnected('pusher');
            }
            else if (data.status === 'error') {
                this.connectionManager.setError('pusher', data.error || 'Unknown error');
            }
            else {
                this.connectionManager.setDisconnected('pusher', data.error);
            }
            this.addLog('info', 'PUSHER', `Connection status: ${data.status}`, data);
        });
        this.pusherService.on('command-received', async (command) => {
            this.addLog('info', 'COMMAND', `Command received: ${command.command}`, { command });
            await this.commandService.addCommand(command);
        });
        this.pusherService.on('emergency-stop', (data) => {
            this.addLog('warn', 'SAFETY', 'Emergency stop received', data);
            this.handleEmergencyStop(data.reason, data.initiator);
        });
        // Command service events
        this.commandService.on('command-completed', (data) => {
            this.addLog('info', 'COMMAND', `Command completed: ${data.commandId}`, data);
            this.updatePerformanceMetrics(data);
        });
        this.commandService.on('command-failed', (data) => {
            this.addLog('error', 'COMMAND', `Command failed: ${data.commandId}`, data);
        });
        // Safety service events
        this.safetyService.on('emergencyStop', (data) => {
            this.addLog('warn', 'SAFETY', `Emergency stop activated`, data);
            this.emit('safety-alert', data);
        });
        // Monitoring service events
        this.monitoringService.on('alertTriggered', (data) => {
            this.addLog('warn', 'MONITORING', `Alert triggered: ${data.alert.type}`, data);
            this.emit('performance-alert', data);
        });
        // Security service events
        this.securityService.on('securityEvent', (data) => {
            this.addLog('error', 'SECURITY', `Security event: ${data.event.type}`, data);
            this.emit('security-threat', data);
        });
    }
    /**
     * Setup global error handling
     */
    setupErrorHandling() {
        // Catch unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            this.addLog('error', 'MAIN', 'Unhandled Promise Rejection', { reason, promise });
            this.emit('error', { type: 'unhandledRejection', reason, promise });
        });
        // Catch uncaught exceptions
        process.on('uncaughtException', (error) => {
            this.addLog('error', 'MAIN', 'Uncaught Exception', { error: error.message, stack: error.stack });
            this.emit('error', { type: 'uncaughtException', error });
            // Graceful shutdown
            this.shutdown('Uncaught exception occurred').catch(console.error);
        });
    }
    /**
     * Setup process event handlers
     */
    setupProcessHandlers() {
        // Handle SIGINT (Ctrl+C)
        process.on('SIGINT', () => {
            this.addLog('info', 'MAIN', 'SIGINT received, shutting down gracefully');
            this.shutdown('SIGINT').catch(console.error);
        });
        // Handle SIGTERM
        process.on('SIGTERM', () => {
            this.addLog('info', 'MAIN', 'SIGTERM received, shutting down gracefully');
            this.shutdown('SIGTERM').catch(console.error);
        });
    }
    /**
     * Handle auto-install result by updating state, logging, and emitting events
     */
    handleAutoInstallResult(installResult, options = {}) {
        const { emitDetectionEvent = true } = options;
        this.mt5Installations = installResult.mt5Installations || [];
        if (emitDetectionEvent) {
            if (this.mt5Installations.length > 0) {
                this.emit('mt5-detected', this.mt5Installations);
            }
            else {
                this.emit('mt5-not-found');
            }
        }
        if (!installResult.success) {
            this.addLog('error', 'MAIN', 'Auto-installation failed', installResult.errors);
            this.emit('auto-install-failed', installResult);
        }
        else {
            this.addLog('info', 'MAIN', 'Auto-installation completed successfully');
            this.emit('auto-install-completed', installResult);
        }
    }
    /**
     * Trigger MT5 auto-installation outside of full initialization
     */
    async autoInstallMT5() {
        try {
            this.addLog('info', 'MAIN', 'Manual auto-installation requested');
            const installResult = await this.mt5Installer.autoInstallEverything();
            this.handleAutoInstallResult(installResult);
            return installResult;
        }
        catch (error) {
            const message = error.message || 'Unknown auto-installation error';
            const fallbackResult = {
                success: false,
                mt5Installations: [],
                componentsInstalled: {
                    libzmq: false,
                    expertAdvisor: false,
                    configFile: false,
                },
                errors: [message],
                warnings: [],
            };
            this.addLog('error', 'MAIN', `Auto-installation error: ${message}`, { error });
            this.emit('auto-install-failed', fallbackResult);
            return fallbackResult;
        }
    }
    /**
     * Initialize the application
     */
    async initialize(config) {
        try {
            this.addLog('info', 'MAIN', 'Initializing Windows Executor...');
            this.config = config;
            this.executorId = config.executorId;
            // Step 0: Initialize database FIRST
            this.addLog('info', 'MAIN', 'Initializing database...');
            const dbInitialized = await this.db.initialize();
            if (!dbInitialized) {
                this.addLog('error', 'MAIN', 'Failed to initialize database');
                return false;
            }
            this.addLog('info', 'MAIN', 'Database initialized successfully');
            // Configure API service
            this.apiService.configure(config);
            // Step 1: Detect MT5 installations
            this.addLog('info', 'MAIN', 'Detecting MT5 installations...');
            this.mt5Installations = await this.mt5Detector.detectAllInstallations();
            if (this.mt5Installations.length === 0) {
                this.addLog('warn', 'MAIN', 'No MT5 installations found');
                this.emit('mt5-not-found');
                return false;
            }
            this.addLog('info', 'MAIN', `Found ${this.mt5Installations.length} MT5 installation(s)`);
            this.emit('mt5-detected', this.mt5Installations);
            // Step 2: Auto-install components if needed
            const installResult = await this.mt5Installer.autoInstallEverything();
            this.handleAutoInstallResult(installResult, { emitDetectionEvent: false });
            if (!installResult.success) {
                return false;
            }
            // Step 3: Initialize security service
            this.addLog('info', 'MAIN', 'Step 3: Initializing security service...');
            await this.securityService.initialize();
            this.connectionStatus.api = 'connected';
            this.addLog('info', 'MAIN', 'Security service initialized');
            // Step 4: Connect to Pusher
            this.addLog('info', 'MAIN', 'Step 4: Connecting to Pusher...');
            this.addLog('debug', 'MAIN', 'Pusher config:', {
                key: config.pusherKey ? '***' : 'missing',
                cluster: config.pusherCluster
            });
            const pusherConnected = await this.pusherService.connect(config);
            if (!pusherConnected) {
                this.addLog('warn', 'MAIN', 'Failed to connect to Pusher - continuing without real-time updates');
                // Don't fail initialization, just log warning
                // Real-time updates will be disabled but app can still function
            }
            else {
                this.addLog('info', 'MAIN', 'Pusher connected successfully');
            }
            // Step 5: Start ZeroMQ Server (listen for MT5 connections)
            this.addLog('info', 'MAIN', 'Step 5: Starting ZeroMQ Server...');
            const zeromqStarted = await this.zeromqServer.start(config);
            if (!zeromqStarted) {
                this.addLog('error', 'MAIN', 'Failed to start ZeroMQ Server - MT5 communication will be unavailable');
                // Don't fail initialization, continue without MT5 connection
            }
            else {
                this.addLog('info', 'MAIN', '✅ ZeroMQ Server started - ready for MT5 connections');
                this.connectionStatus.zeromq = 'connected';
            }
            // Step 6: Start heartbeat service
            await this.heartbeatService.start(config);
            // Step 7: Start monitoring service
            await this.monitoringService.startMonitoring();
            // Step 8: Safety service is already initialized in constructor
            // Step 9: Initialize Strategy Engine (NEW!)
            this.addLog('info', 'MAIN', 'Step 9: Initializing Strategy Engine...');
            this.llmService = new llm_service_1.LLMService(config.platformUrl, config.apiKey, this.executorId);
            // Initialize additional services
            this.mt5AccountService = new mt5_account_service_1.MT5AccountService();
            this.performanceMonitor = new performance_monitor_service_1.PerformanceMonitorService();
            this.alertService = new alert_service_1.AlertService();
            this.addLog('info', 'MAIN', 'Additional services initialized (MT5Account, PerformanceMonitor, Alert)');
            // Initialize strategy service with dependencies
            this.initializeStrategyService();
            // Download and load strategies from platform
            if (this.strategyService) {
                try {
                    await this.strategyService.downloadStrategies();
                    this.addLog('info', 'MAIN', 'Strategies downloaded and loaded');
                }
                catch (error) {
                    this.addLog('warn', 'MAIN', 'Failed to download strategies - will retry later', { error });
                }
            }
            // Step 10: Start Live Trading Background Services
            this.addLog('info', 'MAIN', 'Step 10: Starting live trading services...');
            await this.startLiveTradingServices();
            this.isInitialized = true;
            this.addLog('info', 'MAIN', 'Windows Executor initialized successfully');
            this.emit('initialized');
            return true;
        }
        catch (error) {
            this.addLog('error', 'MAIN', `Initialization failed: ${error.message}`, { error });
            this.emit('initialization-failed', error);
            return false;
        }
    }
    /**
     * Start the application
     */
    async start() {
        if (!this.isInitialized) {
            throw new Error('Application not initialized. Call initialize() first.');
        }
        try {
            this.addLog('info', 'MAIN', 'Starting Windows Executor...');
            // Start command processing
            // CommandService doesn't have a public startProcessing method
            // It starts automatically when commands are added
            // Update MT5 connection status
            this.connectionStatus.mt5 = 'connected';
            this.emit('connection-status-changed', this.connectionStatus);
            this.addLog('info', 'MAIN', 'Windows Executor started successfully');
            this.emit('started');
            return true;
        }
        catch (error) {
            this.addLog('error', 'MAIN', `Failed to start: ${error.message}`, { error });
            this.emit('start-failed', error);
            return false;
        }
    }
    /**
     * Stop the application
     */
    async stop() {
        try {
            this.addLog('info', 'MAIN', 'Stopping Windows Executor...');
            // Stop command processing
            // CommandService doesn't have a public stopProcessing method
            // It stops automatically when no more commands are in queue
            // Stop heartbeat
            this.heartbeatService.stop();
            // Stop monitoring
            await this.monitoringService.stopMonitoring();
            // Disconnect services
            this.pusherService.disconnect();
            this.zeromqService.disconnect();
            // Update connection status
            this.connectionStatus = {
                pusher: 'disconnected',
                zeromq: 'disconnected',
                api: 'disconnected',
                mt5: 'disconnected',
            };
            this.emit('connection-status-changed', this.connectionStatus);
            this.addLog('info', 'MAIN', 'Windows Executor stopped successfully');
            this.emit('stopped');
            return true;
        }
        catch (error) {
            this.addLog('error', 'MAIN', `Failed to stop: ${error.message}`, { error });
            this.emit('stop-failed', error);
            return false;
        }
    }
    /**
     * Shutdown the application gracefully
     */
    async shutdown(reason) {
        if (this.isShuttingDown) {
            return;
        }
        this.isShuttingDown = true;
        this.addLog('info', 'MAIN', `Shutting down Windows Executor: ${reason}`);
        try {
            // Stop all services
            await this.stop();
            // Cleanup resources
            this.removeAllListeners();
            this.addLog('info', 'MAIN', 'Windows Executor shutdown complete');
            // Exit process
            process.exit(0);
        }
        catch (error) {
            this.addLog('error', 'MAIN', `Error during shutdown: ${error.message}`, { error });
            process.exit(1);
        }
    }
    /**
     * Handle emergency stop
     */
    async handleEmergencyStop(reason, initiator) {
        this.addLog('warn', 'SAFETY', 'Emergency stop activated', { reason, initiator });
        try {
            // Stop command processing
            this.commandService.stopProcessing();
            // Execute emergency stop in safety service
            await this.safetyService.emergencyStop();
            // Emit emergency stop event
            this.emit('emergency-stop', { reason, initiator });
        }
        catch (error) {
            this.addLog('error', 'SAFETY', `Emergency stop failed: ${error.message}`, { error });
        }
    }
    /**
     * Update performance metrics
     */
    updatePerformanceMetrics(data) {
        // This would be implemented with actual metrics calculation
        // For now, just emit the event
        this.emit('performance-updated', data);
    }
    /**
     * Get rate limit configuration
     */
    getRateLimitConfig() {
        return {
            windowMs: 60000, // 1 minute
            maxRequests: 100, // 100 requests per minute
        };
    }
    /**
     * Add log entry
     */
    addLog(level, category, message, metadata) {
        const logEntry = {
            id: Date.now() + Math.random(),
            timestamp: new Date(),
            level,
            category,
            message,
            metadata,
        };
        this.logs.unshift(logEntry);
        // Keep only last 1000 logs
        if (this.logs.length > 1000) {
            this.logs = this.logs.slice(0, 1000);
        }
        // Output to console for debugging
        const timestamp = new Date().toISOString().substring(11, 23);
        const levelColors = {
            debug: '\x1b[36m', // cyan
            info: '\x1b[32m', // green
            warn: '\x1b[33m', // yellow
            error: '\x1b[31m', // red
        };
        const color = levelColors[level] || '';
        const reset = '\x1b[0m';
        console.log(`${timestamp} [${color}${level}${reset}] [${category}]: ${message}`, metadata || '');
        // Emit log event
        this.emit('log-added', logEntry);
    }
    /**
     * Get application status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isShuttingDown: this.isShuttingDown,
            connectionStatus: this.connectionStatus,
            mt5Installations: this.mt5Installations,
            performanceMetrics: this.performanceMetrics,
            activeStrategies: this.activeStrategies,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
        };
    }
    /**
     * Get logs
     */
    getLogs(limit) {
        return limit ? this.logs.slice(0, limit) : this.logs;
    }
    /**
     * Get connection status
     */
    getConnectionStatus() {
        return this.connectionStatus;
    }
    /**
     * Get MT5 installations
     */
    getMT5Installations() {
        return this.mt5Installations;
    }
    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return this.performanceMetrics;
    }
    /**
     * Get service statistics
     */
    getServiceStats() {
        return {
            pusher: this.pusherService.getConnectionStats(),
            zeromq: this.zeromqService.getConnectionStats(),
            command: this.commandService.getQueueStats(),
            monitoring: {}, // MonitoringService doesn't have getStats method
        };
    }
    /**
     * Execute command manually
     */
    async executeCommand(command) {
        return await this.commandService.addCommand(command);
    }
    /**
     * Cancel command
     */
    cancelCommand(commandId) {
        return this.commandService.cancelCommand(commandId);
    }
    /**
     * Get command status
     */
    getCommandStatus(commandId) {
        return this.commandService.getCommandStatus(commandId);
    }
    /**
     * Update configuration
     */
    async updateConfig(newConfig) {
        try {
            if (!this.config) {
                throw new Error('No configuration loaded');
            }
            this.config = { ...this.config, ...newConfig };
            // Update services with new configuration
            await this.pusherService.forceReconnect();
            await this.zeromqService.forceReconnect();
            this.addLog('info', 'MAIN', 'Configuration updated', { newConfig });
            this.emit('config-updated', this.config);
            return true;
        }
        catch (error) {
            this.addLog('error', 'MAIN', `Failed to update configuration: ${error.message}`, { error });
            return false;
        }
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return this.config;
    }
    /**
     * Get MT5 account information
     */
    async getMT5AccountInfo() {
        try {
            return await this.mt5AccountService.getAccountInfo();
        }
        catch (error) {
            this.addLog('error', 'MT5', `Failed to get account info: ${error.message}`);
            return null;
        }
    }
    /**
     * Get system health
     */
    getSystemHealth() {
        const metrics = this.performanceMonitor.getMetrics();
        const health = this.performanceMonitor.checkHealth();
        return {
            healthy: health.healthy,
            issues: health.issues,
            evaluationsPerMinute: metrics.evaluationsPerMinute,
            avgEvaluationTime: metrics.averageEvaluationTime,
            cacheHitRate: metrics.indicatorCacheHitRate,
            memoryUsage: metrics.memoryUsage,
            errorRate: metrics.errorRate
        };
    }
    /**
     * Get recent signals
     */
    getRecentSignals(limit = 10) {
        // Get from strategy service or alertService
        const alerts = this.alertService.getRecentAlerts(limit * 2);
        // Filter only signal alerts
        const signals = alerts
            .filter(alert => alert.type === 'signal_generated')
            .slice(0, limit)
            .map(alert => ({
            type: alert.data?.type || 'BUY',
            symbol: alert.data?.symbol || '',
            price: alert.data?.price || 0,
            timestamp: alert.timestamp,
            confidence: alert.data?.confidence || 0
        }));
        return signals;
    }
    /**
     * Get active strategies
     */
    getActiveStrategies() {
        return this.activeStrategies.map(strategy => ({
            id: strategy.id,
            name: strategy.name,
            status: strategy.status,
            symbols: strategy.symbols,
            timeframe: strategy.timeframe,
            lastSignal: strategy.lastSignal
        }));
    }
    /**
     * Get recent activity
     */
    getRecentActivity(limit = 20) {
        return this.logs.slice(0, limit).map(log => ({
            id: log.id,
            type: log.level === 'error' ? 'ERROR' : log.level === 'warn' ? 'WARNING' : 'INFO',
            message: log.message,
            timestamp: log.timestamp,
            metadata: log.metadata
        }));
    }
    /**
     * Start live trading background services
     */
    async startLiveTradingServices() {
        try {
            // Start disaster recovery auto-backup (Phase 4)
            this.disasterRecovery.startAutoBackup();
            this.addLog('info', 'RECOVERY', 'Disaster recovery auto-backup started');
            // Start performance monitoring (Phase 5)
            this.performanceOptimizer.startMonitoring(60000); // Every 1 minute
            this.addLog('info', 'PERFORMANCE', 'Performance monitoring started');
            // Start cache auto-cleanup (Phase 5)
            this.indicatorCache['cache'].startAutoCleanup(60000); // Every 1 minute
            this.addLog('info', 'CACHE', 'Cache auto-cleanup started');
            // Start multi-account periodic updates (Phase 4)
            this.multiAccountManager.startPeriodicUpdates();
            this.addLog('info', 'ACCOUNTS', 'Multi-account manager started');
            // Initialize command processor with all services (Phase 1)
            this.commandProcessor.initialize(this.zeromqService, this.pusherService, this.strategyMonitor, this.emergencyStop);
            this.addLog('info', 'COMMAND', 'Command processor initialized');
            // Perform crash recovery if needed (Phase 4)
            if (await this.detectPreviousCrash()) {
                this.addLog('warn', 'RECOVERY', 'Previous crash detected, initiating recovery...');
                await this.disasterRecovery.recoverFromCrash();
            }
            this.addLog('info', 'MAIN', '✅ All live trading services started successfully');
        }
        catch (error) {
            this.addLog('error', 'MAIN', 'Error starting live trading services:', error);
        }
    }
    /**
     * Detect if previous session crashed
     */
    async detectPreviousCrash() {
        // Check for crash marker file
        const fs = require('fs');
        const crashMarkerPath = './crash.marker';
        return fs.existsSync(crashMarkerPath);
    }
    /**
     * Setup event handlers for live trading services
     */
    setupLiveTradingEventHandlers() {
        // Strategy Monitor events (Phase 1)
        this.strategyMonitor.on('signal:generated', async (data) => {
            this.addLog('info', 'SIGNAL', `Signal generated for ${data.signal.symbol}`, data.signal);
            // TODO: Execute trade via ZeroMQ
        });
        this.strategyMonitor.on('monitor:stopped', (data) => {
            this.addLog('info', 'MONITOR', `Strategy monitor stopped: ${data.strategyId}`);
        });
        // Emergency Stop events (Phase 1)
        this.emergencyStop.on('killswitch:activated', (data) => {
            this.addLog('error', 'EMERGENCY', '🔴 KILL SWITCH ACTIVATED', data);
            this.strategyMonitor.stopAll();
        });
        // Disaster Recovery events (Phase 4)
        this.disasterRecovery.on('backup-completed', (data) => {
            this.addLog('info', 'BACKUP', `Backup completed: ${data.backupId}`);
        });
        // Performance events (Phase 5)
        this.performanceOptimizer.on('performance-degraded', (data) => {
            this.addLog('warn', 'PERFORMANCE', 'Performance issues detected', data);
        });
        this.addLog('info', 'MAIN', 'Live trading event handlers configured');
    }
    /**
     * Handle signal generated
     */
    async handleSignalGenerated(data) {
        // TODO: Execute trade via ZeroMQ
        this.addLog('info', 'SIGNAL', 'Handling signal', data);
    }
    /**
     * Execute partial close
     */
    async executePartialClose(data) {
        // TODO: Implement via ZeroMQ
        this.addLog('info', 'EXIT', 'Executing partial close', data);
    }
    /**
     * Modify position
     */
    async modifyPosition(data) {
        // TODO: Implement via ZeroMQ
        this.addLog('info', 'EXIT', 'Modifying position', data);
    }
    /**
     * Close position
     */
    async closePosition(data) {
        // TODO: Implement via ZeroMQ
        this.addLog('info', 'EXIT', 'Closing position', data);
    }
    /**
     * Handle kill switch activation
     */
    async handleKillSwitchActivated(data) {
        this.connectionStatus.mt5 = 'error';
        this.emit('kill-switch-activated', data);
        // TODO: Notify platform via API
        this.addLog('warn', 'EMERGENCY', 'Platform notification for kill switch pending API implementation');
    }
}
exports.MainController = MainController;
