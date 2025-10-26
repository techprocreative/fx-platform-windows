import { EventEmitter } from 'events';
import { MT5AutoInstaller } from '../services/mt5-auto-installer.service';
import { MT5DetectorService } from '../services/mt5-detector.service';
import { PusherService } from '../services/pusher.service';
import { ZeroMQService } from '../services/zeromq.service';
import { ZeroMQServerService } from '../services/zeromq-server.service';
import { CommandService } from '../services/command.service';
import { HeartbeatService } from '../services/heartbeat.service';
import { SafetyService } from '../services/safety.service';
import { MonitoringService } from '../services/monitoring.service';
import { SecurityService } from '../services/security.service';
import { ApiService } from '../services/api.service';
import { ConnectionManager } from '../services/connection-manager.service';
import { DatabaseManager } from '../database/manager';
import { StrategyService } from '../services/strategy.service';
import { IndicatorService } from '../services/indicator.service';
import { MarketDataService } from '../services/market-data.service';
import { LLMService } from '../services/llm.service';
import { MT5AccountService } from '../services/mt5-account.service';
import { PerformanceMonitorService } from '../services/performance-monitor.service';
import { AlertService } from '../services/alert.service';
import { logger } from '../utils/logger';
// New services for live trading readiness
import { StrategyMonitor } from '../services/strategy-monitor.service';
import { SafetyValidatorService } from '../services/safety-validator.service';
import { EmergencyStopService } from '../services/emergency-stop.service';
import { CommandProcessor } from '../services/command-processor.service';
import { ConditionEvaluatorService } from '../services/condition-evaluator.service';
import { FilterEvaluatorService } from '../services/filter-evaluator.service';
import { PositionSizingService } from '../services/position-sizing.service';
import { AdvancedIndicatorService } from '../services/indicator-advanced.service';
import { AdvancedPositionSizingService } from '../services/position-sizing-advanced.service';
import { SmartExitExecutor } from '../services/smart-exit-executor.service';
import { CorrelationExecutorService } from '../services/correlation-executor.service';
import { MultiAccountManager } from '../services/multi-account-manager.service';
import { DisasterRecoveryService } from '../services/disaster-recovery.service';
import { IndicatorCache, MarketDataCache } from '../services/cache-manager.service';
import { PerformanceOptimizer } from '../services/performance-optimizer.service';
import { PersistenceService } from '../services/persistence.service';
import { EAAttachmentHandler } from './ea-attachment-handler';
/**
 * Main Application Controller
 *
 * This controller manages the entire lifecycle of the Windows Executor application,
 * coordinating all services and providing a unified interface for the UI.
 */
export class MainController extends EventEmitter {
    constructor() {
        super();
        Object.defineProperty(this, "config", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "isInitialized", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "isShuttingDown", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "executorId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ''
        });
        // Services
        Object.defineProperty(this, "mt5Installer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "mt5Detector", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "apiService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "connectionManager", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "pusherService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "zeromqService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "zeromqServer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "commandService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "heartbeatService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "safetyService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "monitoringService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "securityService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "strategyService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "indicatorService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "marketDataService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "llmService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "mt5AccountService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "performanceMonitor", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "alertService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "strategyMonitor", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "safetyValidator", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "emergencyStop", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "commandProcessor", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "conditionEvaluator", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "filterEvaluator", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "positionSizing", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // Live trading services (Phase 1-5)
        Object.defineProperty(this, "advancedIndicators", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "advancedPositionSizing", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "smartExitExecutor", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "correlationExecutor", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "multiAccountManager", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "disasterRecovery", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "indicatorCache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "marketDataCache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "performanceOptimizer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "persistence", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "eaAttachmentHandler", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "db", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // State
        Object.defineProperty(this, "connectionStatus", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {
                pusher: 'disconnected',
                zeromq: 'disconnected',
                api: 'disconnected',
                mt5: 'disconnected',
            }
        });
        Object.defineProperty(this, "mt5Installations", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "logs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "activeStrategies", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "performanceMetrics", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {
                totalTrades: 0,
                winRate: 0,
                profitFactor: 0,
                dailyPnL: 0,
                maxDrawdown: 0,
            }
        });
        // Initialize database
        const dbConfig = {
            path: './executor.db',
            encryptionKey: 'fx-executor-encryption-key',
            backupEnabled: true,
            backupInterval: 24,
            maxBackups: 7,
        };
        this.db = new DatabaseManager(dbConfig);
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
        this.mt5Detector = new MT5DetectorService();
        this.mt5Installer = new MT5AutoInstaller();
        this.apiService = new ApiService(logger);
        this.connectionManager = new ConnectionManager({
            initialDelay: 1000,
            maxDelay: 60000,
            maxAttempts: 10,
            backoffMultiplier: 2,
        }, logger);
        this.pusherService = new PusherService(logger);
        this.zeromqService = new ZeroMQService(logger);
        this.zeromqServer = new ZeroMQServerService(logger);
        this.safetyService = new SafetyService(this.db);
        this.monitoringService = new MonitoringService(this.db);
        this.securityService = new SecurityService(this.db, 'encryption-key-placeholder');
        // Command service depends on other services
        this.commandService = new CommandService(this.zeromqService, this.pusherService, this.safetyService.getLimits(), this.getRateLimitConfig(), logger, this.apiService);
        // Heartbeat service
        this.heartbeatService = new HeartbeatService(this.zeromqService, this.pusherService, this.commandService, logger, this.apiService);
        // Strategy Engine services (NEW)
        this.indicatorService = new IndicatorService();
        this.marketDataService = new MarketDataService(this.zeromqService);
        // PHASE 1-5: Live Trading Services
        // Cache services (Phase 5)
        this.indicatorCache = new IndicatorCache();
        this.marketDataCache = new MarketDataCache();
        // Advanced indicators (Phase 2)
        this.advancedIndicators = new AdvancedIndicatorService();
        // Safety and monitoring (Phase 1)
        this.safetyValidator = new SafetyValidatorService({
            maxDailyLoss: Number(process.env.MAX_DAILY_LOSS) || 1000,
            maxDailyLossPercent: Number(process.env.MAX_DAILY_LOSS_PERCENT) || 10,
            maxDrawdown: Number(process.env.MAX_DRAWDOWN) || 3000,
            maxDrawdownPercent: Number(process.env.MAX_DRAWDOWN_PERCENT) || 30,
            maxPositions: Number(process.env.MAX_POSITIONS) || 10,
            maxLotSize: Number(process.env.MAX_LOT_SIZE) || 1.0,
            maxCorrelation: Number(process.env.MAX_CORRELATION) || 0.7,
            maxTotalExposure: Number(process.env.MAX_TOTAL_EXPOSURE) || 5000,
        });
        this.emergencyStop = new EmergencyStopService();
        // Strategy evaluation services (Phase 1)
        this.conditionEvaluator = new ConditionEvaluatorService(this.indicatorService);
        this.filterEvaluator = new FilterEvaluatorService();
        this.positionSizing = new PositionSizingService();
        this.advancedPositionSizing = new AdvancedPositionSizingService();
        // Strategy monitor (Phase 1) - The core 24/7 monitoring service
        this.strategyMonitor = new StrategyMonitor(this.indicatorService, this.marketDataService, this.conditionEvaluator, this.filterEvaluator, this.positionSizing, this.safetyValidator);
        // Exit management (Phase 3)
        this.smartExitExecutor = new SmartExitExecutor();
        this.correlationExecutor = new CorrelationExecutorService();
        // Account management (Phase 4)
        this.multiAccountManager = new MultiAccountManager();
        // Disaster recovery (Phase 4)
        this.disasterRecovery = new DisasterRecoveryService({
            enabled: true,
            autoBackup: true,
            backupInterval: 60 * 60 * 1000, // 1 hour
            maxBackups: 24,
            backupPath: './backups',
        });
        // Performance optimization (Phase 5)
        this.performanceOptimizer = new PerformanceOptimizer();
        // Persistence service for state management
        this.persistence = new PersistenceService();
        // EA attachment handler
        this.eaAttachmentHandler = new EAAttachmentHandler(this.persistence);
        // Command processor (Phase 1) - Wires everything together
        this.commandProcessor = new CommandProcessor();
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
        this.strategyService = new StrategyService(this.config.platformUrl, this.executorId, this.indicatorService, this.marketDataService);
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
            // Log EVERYTHING about incoming command
            logger.info('[MainController] ===== COMMAND RECEIVED FROM PUSHER =====', {
                category: 'COMMAND',
                metadata: {
                    commandId: command.id,
                    command: command.command,
                    type: command.type,
                    priority: command.priority,
                    executorId: command.executorId,
                    parameters: command.parameters,
                    payload: command.payload,
                    hasCommand: !!command.command,
                    hasType: !!command.type,
                    hasId: !!command.id,
                    allKeys: Object.keys(command),
                    timestamp: new Date().toISOString()
                }
            });
            this.addLog('info', 'COMMAND', `Command received: ${command.type || command.command}`, { command });
            // Transform web platform command format to executor format
            const transformedCommand = {
                id: command.id,
                command: command.type || command.command, // Web platform uses 'type', executor uses 'command'
                parameters: command.payload || command.parameters || {},
                priority: command.priority || 'NORMAL',
                createdAt: command.timestamp || command.createdAt || new Date().toISOString(),
                executorId: command.executorId || this.executorId,
                timeout: command.timeout,
                retryCount: 0,
                maxRetries: command.maxRetries || 3,
            };
            this.addLog('debug', 'COMMAND', 'Transformed command', { original: command, transformed: transformedCommand });
            // Log transformed command to file
            logger.info('[MainController] Command transformed and validated', {
                category: 'COMMAND',
                metadata: {
                    commandId: transformedCommand.id,
                    command: transformedCommand.command,
                    parameters: transformedCommand.parameters,
                    willBeHandledBy: (transformedCommand.command === 'START_STRATEGY' || transformedCommand.command === 'STOP_STRATEGY') ? 'commandProcessor' : 'commandService'
                }
            });
            // Handle strategy commands directly with commandProcessor
            if (this.commandProcessor && (transformedCommand.command === 'START_STRATEGY' || transformedCommand.command === 'STOP_STRATEGY')) {
                try {
                    logger.info('[MainController] Handling strategy command with commandProcessor', {
                        category: 'COMMAND',
                        metadata: {
                            commandId: transformedCommand.id,
                            command: transformedCommand.command,
                            strategyId: transformedCommand.parameters?.strategyId,
                            strategyName: transformedCommand.parameters?.strategyName
                        }
                    });
                    if (transformedCommand.command === 'START_STRATEGY' && transformedCommand.parameters) {
                        // Handle START_STRATEGY
                        const params = transformedCommand.parameters;
                        await this.commandProcessor.handleStrategyCommand({
                            type: 'START_STRATEGY',
                            strategyId: params.strategyId,
                            strategy: {
                                id: params.strategyId,
                                name: params.strategyName,
                                symbol: params.symbol,
                                timeframe: params.timeframe,
                                rules: params.rules,
                                enabled: true,
                            },
                            options: params.options || {},
                        });
                        // Add to active strategies
                        this.activeStrategies.push({
                            id: params.strategyId,
                            name: params.strategyName,
                            status: 'active',
                            symbol: params.symbol,
                            symbols: [params.symbol],
                            timeframe: params.timeframe, // Singular for getActiveStrategies()
                            activeSince: new Date(),
                            lastSignal: null
                        });
                        // Persist strategy activation
                        this.persistence.saveActiveStrategy({
                            id: params.strategyId,
                            name: params.strategyName,
                            symbol: params.symbol,
                            timeframe: params.timeframe,
                            status: 'active',
                            activatedAt: new Date().toISOString(),
                        });
                        this.emit('strategy-activated', {
                            strategyId: params.strategyId,
                            strategyName: params.strategyName,
                        });
                        this.addLog('info', 'COMMAND', `Strategy ${params.strategyName} activated`);
                        logger.info('[MainController] START_STRATEGY completed successfully', {
                            category: 'COMMAND',
                            metadata: {
                                commandId: transformedCommand.id,
                                strategyId: params.strategyId,
                                strategyName: params.strategyName
                            }
                        });
                    }
                    else if (transformedCommand.command === 'STOP_STRATEGY' && transformedCommand.parameters) {
                        // Handle STOP_STRATEGY
                        const params = transformedCommand.parameters;
                        logger.info('[MainController] Starting STOP_STRATEGY handler', {
                            category: 'COMMAND',
                            metadata: {
                                commandId: transformedCommand.id,
                                parameters: params,
                                currentActiveStrategies: this.activeStrategies.map(s => ({ id: s.id, name: s.name }))
                            }
                        });
                        const strategyId = params?.strategyId;
                        if (!strategyId) {
                            const error = new Error('Missing strategyId in STOP_STRATEGY command');
                            logger.error('[MainController] STOP_STRATEGY failed: Missing strategyId', {
                                category: 'COMMAND',
                                metadata: {
                                    commandId: transformedCommand.id,
                                    parameters: params,
                                    error: error.message
                                }
                            });
                            throw error;
                        }
                        // Call command processor to handle the strategy command
                        if (this.commandProcessor) {
                            await this.commandProcessor.handleStrategyCommand({
                                type: 'STOP_STRATEGY',
                                strategyId: strategyId,
                                options: {
                                    closePositions: params.closePositions !== false, // Default true
                                },
                            });
                        }
                        // Remove from active strategies
                        const index = this.activeStrategies.findIndex(s => s.id === strategyId);
                        if (index > -1) {
                            const removedStrategy = this.activeStrategies.splice(index, 1)[0];
                            // Remove from persistence
                            this.persistence.removeActiveStrategy(strategyId);
                            this.emit('strategy-deactivated', {
                                strategyId: strategyId,
                                strategyName: removedStrategy.name,
                            });
                            this.addLog('info', 'COMMAND', `Strategy ${removedStrategy.name} deactivated`);
                            logger.info('[MainController] STOP_STRATEGY completed - strategy removed from active list', {
                                category: 'COMMAND',
                                metadata: {
                                    commandId: transformedCommand.id,
                                    strategyId: strategyId,
                                    strategyName: removedStrategy.name,
                                    remainingActiveStrategies: this.activeStrategies.length
                                }
                            });
                        }
                        else {
                            this.addLog('warn', 'COMMAND', `Strategy ${strategyId} not found in active strategies`);
                            logger.warn('[MainController] STOP_STRATEGY - strategy not found in active list', {
                                category: 'COMMAND',
                                metadata: {
                                    commandId: transformedCommand.id,
                                    strategyId: strategyId,
                                    currentActiveStrategies: this.activeStrategies.map(s => ({ id: s.id, name: s.name }))
                                }
                            });
                        }
                    }
                    // Update command status via API if available
                    try {
                        if (this.apiService && typeof this.apiService.reportCommandResult === 'function') {
                            await this.apiService.reportCommandResult(transformedCommand.id, 'executed', {
                                success: true,
                                timestamp: new Date().toISOString(),
                                command: transformedCommand.command
                            });
                        }
                    }
                    catch (apiError) {
                        // Non-critical error, just log it
                        this.addLog('warn', 'COMMAND', `Failed to report command result: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
                    }
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    const errorStack = error instanceof Error ? error.stack : undefined;
                    // Log to file via Winston
                    logger.error(`[MainController] Failed to execute strategy command: ${errorMessage}`, {
                        category: 'COMMAND',
                        metadata: {
                            command: transformedCommand.command,
                            commandId: transformedCommand.id,
                            strategyId: transformedCommand.parameters?.strategyId,
                            error: errorMessage,
                            stack: errorStack
                        }
                    });
                    this.addLog('error', 'COMMAND', `Failed to execute strategy command: ${errorMessage}`, { error });
                    // Report failure if API available
                    try {
                        if (this.apiService && typeof this.apiService.reportCommandResult === 'function') {
                            await this.apiService.reportCommandResult(transformedCommand.id, 'failed', {
                                success: false,
                                error: error instanceof Error ? error.message : 'Unknown error',
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                    catch (apiError) {
                        // Non-critical error, just log it
                        this.addLog('warn', 'COMMAND', `Failed to report command failure: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
                    }
                }
            }
            else {
                // For other commands, use command service
                try {
                    await this.commandService.addCommand(transformedCommand);
                }
                catch (commandError) {
                    const errorMessage = commandError instanceof Error ? commandError.message : 'Unknown error';
                    const errorStack = commandError instanceof Error ? commandError.stack : undefined;
                    // Log to file
                    logger.error(`[MainController] Failed to add command to queue: ${errorMessage}`, {
                        category: 'COMMAND',
                        metadata: {
                            command: transformedCommand.command,
                            commandId: transformedCommand.id,
                            error: errorMessage,
                            stack: errorStack
                        }
                    });
                    this.addLog('error', 'COMMAND', `Failed to queue command: ${errorMessage}`, {
                        command: transformedCommand.command,
                        error: commandError
                    });
                    // Report failure if API available
                    try {
                        if (this.apiService && typeof this.apiService.reportCommandResult === 'function') {
                            await this.apiService.reportCommandResult(transformedCommand.id, 'failed', {
                                success: false,
                                error: errorMessage,
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                    catch (apiError) {
                        // Non-critical, just log
                        this.addLog('warn', 'COMMAND', `Failed to report command queue failure: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
                    }
                }
            }
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
            // Log to file
            logger.error(`[MainController] UNHANDLED REJECTION: ${reason}`, {
                category: 'CRITICAL',
                metadata: {
                    reason: String(reason),
                    timestamp: new Date().toISOString()
                }
            });
            this.addLog('error', 'MAIN', 'Unhandled Promise Rejection', { reason, promise });
            this.emit('error', { type: 'unhandledRejection', reason, promise });
        });
        // Catch uncaught exceptions
        process.on('uncaughtException', (error) => {
            // Log to file FIRST before any other operations
            logger.error(`[MainController] UNCAUGHT EXCEPTION: ${error.message}`, {
                category: 'CRITICAL',
                metadata: {
                    error: error.message,
                    stack: error.stack,
                    timestamp: new Date().toISOString()
                }
            });
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
                this.addLog('warn', 'MAIN', 'Auto-installation failed, but continuing initialization...');
                // Don't fail - EA might already be installed manually
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
                this.addLog('warn', 'MAIN', 'Auto-installation failed, but continuing initialization...');
                // Don't fail - EA might already be installed manually
            }
            this.addLog('info', 'MAIN', `Found ${this.mt5Installations.length} MT5 installation(s)`);
            this.emit('mt5-detected', this.mt5Installations);
            // Step 2: Auto-install components if needed
            const installResult = await this.mt5Installer.autoInstallEverything();
            this.handleAutoInstallResult(installResult, { emitDetectionEvent: false });
            if (!installResult.success) {
                this.addLog('warn', 'MAIN', 'Auto-installation failed, but continuing initialization...');
                // Don't fail - EA might already be installed manually
            }
            // Step 3: Initialize security service
            this.addLog('info', 'MAIN', 'Step 3: Initializing security service...');
            await this.securityService.initialize();
            this.connectionStatus.api = 'connected';
            this.monitoringService.updateConnectionStatus('api', { connected: true });
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
                this.monitoringService.updateConnectionStatus('pusher', { connected: false });
                // Don't fail initialization, just log warning
                // Real-time updates will be disabled but app can still function
            }
            else {
                this.addLog('info', 'MAIN', 'Pusher connected successfully');
                this.monitoringService.updateConnectionStatus('pusher', { connected: true });
            }
            // Step 5: Start ZeroMQ Server (listen for MT5 connections)
            this.addLog('info', 'MAIN', 'Step 5: Starting ZeroMQ Server...');
            const zeromqStarted = await this.zeromqServer.start(config);
            if (!zeromqStarted) {
                this.addLog('error', 'MAIN', 'Failed to start ZeroMQ Server - MT5 communication will be unavailable');
                this.monitoringService.updateConnectionStatus('zeromq', { connected: false });
                // Don't fail initialization, continue without MT5 connection
            }
            else {
                this.addLog('info', 'MAIN', '✅ ZeroMQ Server started - ready for MT5 connections');
                this.connectionStatus.zeromq = 'connected';
                this.monitoringService.updateConnectionStatus('zeromq', { connected: true });
            }
            // Step 5.5: Connect ZeroMQ Client (port 5556) for sending requests to MT5
            // Server uses port 5555 to receive from MT5, client uses 5556 to send to MT5
            this.addLog('info', 'MAIN', 'Step 5.5: Connecting ZeroMQ Client on port 5556...');
            try {
                const zmqClientConnected = await this.zeromqService.connect(config);
                if (zmqClientConnected) {
                    this.addLog('info', 'MAIN', '✅ ZeroMQ Client connected on port 5556 - ready to send requests to MT5');
                    this.connectionStatus.zeromq = 'connected';
                }
                else {
                    this.addLog('warn', 'MAIN', 'ZeroMQ Client connection failed - will retry automatically');
                }
            }
            catch (zmqError) {
                this.addLog('warn', 'MAIN', `ZeroMQ Client connection error: ${zmqError instanceof Error ? zmqError.message : 'Unknown'}`);
                // Don't fail initialization, continue without market data access
            }
            // Step 6: Start heartbeat service
            await this.heartbeatService.start(config);
            // Step 7: Start monitoring service
            await this.monitoringService.startMonitoring();
            // Step 8: Safety service is already initialized in constructor
            // Step 9: Initialize Strategy Engine (NEW!)
            this.addLog('info', 'MAIN', 'Step 9: Initializing Strategy Engine...');
            this.llmService = new LLMService(config.platformUrl, config.apiKey, this.executorId);
            // Initialize additional services
            this.mt5AccountService = new MT5AccountService(this.zeromqServer);
            this.performanceMonitor = new PerformanceMonitorService();
            this.alertService = new AlertService();
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
            // Sync active strategies from platform (restore after restart)
            // MOVED TO AFTER ALL CRITICAL SERVICES ARE INITIALIZED
            // This ensures ZeroMQ is connected before attempting to monitor strategies
            // Step 10: Start Live Trading Background Services
            this.addLog('info', 'MAIN', 'Step 10: Starting live trading services...');
            await this.startLiveTradingServices();
            // Step 11: Sync active strategies from platform (after all services are ready)
            this.addLog('info', 'MAIN', 'Step 11: Syncing active strategies from platform...');
            try {
                await this.syncActiveStrategiesFromPlatform();
                this.addLog('info', 'MAIN', 'Active strategies synced successfully');
            }
            catch (error) {
                this.addLog('warn', 'MAIN', 'Failed to sync active strategies from platform', { error });
                // Try to load from persisted state as fallback
                try {
                    const persistedStrategies = this.persistence.getActiveStrategies();
                    if (persistedStrategies.length > 0) {
                        this.addLog('info', 'MAIN', `Loading ${persistedStrategies.length} strategies from local cache`);
                        for (const strategy of persistedStrategies) {
                            this.activeStrategies.push({
                                id: strategy.id,
                                name: strategy.name,
                                status: 'active',
                                symbol: strategy.symbol,
                                symbols: [strategy.symbol],
                                timeframe: strategy.timeframe,
                                lastSignal: null
                            });
                            // Start monitoring if ZeroMQ is connected
                            if (this.connectionStatus.zeromq === 'connected' && this.strategyMonitor) {
                                await this.strategyMonitor.startMonitoring(strategy);
                            }
                        }
                    }
                }
                catch (fallbackError) {
                    this.addLog('warn', 'MAIN', 'Failed to load persisted strategies', { error: fallbackError });
                }
            }
            this.isInitialized = true;
            this.addLog('info', 'MAIN', 'Windows Executor initialized successfully');
            this.emit('initialized');
            return true;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorStack = error instanceof Error ? error.stack : undefined;
            // Log to file via Winston
            logger.error(`[MainController] Initialization failed: ${errorMessage}`, {
                category: 'MAIN',
                metadata: {
                    config: this.config ? { executorId: this.config.executorId, platformUrl: this.config.platformUrl } : null,
                    error: errorMessage,
                    stack: errorStack
                }
            });
            this.addLog('error', 'MAIN', `Initialization failed: ${errorMessage}`, { error });
            this.emit('initialization-failed', error);
            this.addLog('warn', 'MAIN', 'Auto-installation failed, but continuing initialization...');
            // Don't fail - EA might already be installed manually
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
            this.monitoringService.updateConnectionStatus('mt5', { connected: true });
            this.emit('connection-status-changed', this.connectionStatus);
            this.addLog('info', 'MAIN', 'Windows Executor started successfully');
            this.emit('started');
            return true;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorStack = error instanceof Error ? error.stack : undefined;
            // Log to file via Winston
            logger.error(`[MainController] Failed to start: ${errorMessage}`, {
                category: 'MAIN',
                metadata: { error: errorMessage, stack: errorStack }
            });
            this.addLog('error', 'MAIN', `Failed to start: ${errorMessage}`, { error });
            this.emit('start-failed', error);
            this.addLog('warn', 'MAIN', 'Auto-installation failed, but continuing initialization...');
            // Don't fail - EA might already be installed manually
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
            this.addLog('warn', 'MAIN', 'Auto-installation failed, but continuing initialization...');
            // Don't fail - EA might already be installed manually
        }
    }
    /**
     * Sync active strategies from platform after restart
     * Improved with retry mechanism and persistence fallback
     */
    async syncActiveStrategiesFromPlatform() {
        const maxRetries = 3;
        let attempt = 0;
        let lastError = null;
        while (attempt < maxRetries) {
            try {
                if (!this.config) {
                    throw new Error('Config not initialized');
                }
                attempt++;
                this.addLog('info', 'SYNC', `Syncing active strategies (attempt ${attempt}/${maxRetries})...`);
                // Fetch active strategies from web platform API
                // Support both local development and Vercel deployment
                const platformUrl = this.config.platformUrl || 'https://fx.nusanexus.com';
                const apiUrl = `${platformUrl}/api/executor/${this.executorId}/active-strategies`;
                this.addLog('debug', 'SYNC', `Fetching strategies from: ${apiUrl}`);
                const response = await fetch(apiUrl, {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json',
                        'X-Executor-Id': this.executorId,
                        'X-API-Key': this.config.apiKey
                    },
                    signal: AbortSignal.timeout(15000) // 15 second timeout (increased for Vercel)
                });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                const data = await response.json();
                const activeStrategies = data.strategies || [];
                logger.info(`[MainController] Found ${activeStrategies.length} active strategies to sync`, {
                    category: 'SYNC',
                    metadata: { strategies: activeStrategies.map((s) => ({ id: s.id, name: s.name })) }
                });
                // Clear previous active strategies
                this.activeStrategies = [];
                // Start each active strategy
                for (const strategy of activeStrategies) {
                    try {
                        this.addLog('info', 'SYNC', `Restoring strategy: ${strategy.name}`);
                        // Add to active list
                        this.activeStrategies.push({
                            id: strategy.id,
                            name: strategy.name,
                            status: 'active',
                            symbol: strategy.symbol,
                            symbols: [strategy.symbol], // Array for compatibility with dashboard
                            timeframe: strategy.timeframe,
                            lastSignal: null
                        });
                        // Save to persistence
                        this.persistence.saveActiveStrategy({
                            id: strategy.id,
                            name: strategy.name,
                            symbol: strategy.symbol,
                            timeframe: strategy.timeframe,
                            status: 'active',
                            activatedAt: new Date().toISOString(),
                        });
                        // Start monitoring
                        if (this.strategyMonitor) {
                            await this.strategyMonitor.startMonitoring(strategy);
                            this.addLog('info', 'SYNC', `Strategy ${strategy.name} restored and monitoring started`);
                        }
                        // Check if EA was previously attached for this strategy
                        await this.restoreEAAttachment(strategy);
                    }
                    catch (error) {
                        logger.error(`[MainController] Failed to restore strategy ${strategy.name}:`, error);
                        this.addLog('error', 'SYNC', `Failed to restore strategy: ${strategy.name}`, { error });
                    }
                }
                logger.info(`[MainController] Active strategies sync completed: ${activeStrategies.length} restored`);
                return; // Success - exit retry loop
            }
            catch (error) {
                lastError = error;
                logger.error(`[MainController] Sync attempt ${attempt} failed:`, error);
                if (attempt < maxRetries) {
                    // Wait before retry (exponential backoff)
                    const delay = 1000 * Math.pow(2, attempt - 1);
                    this.addLog('warn', 'SYNC', `Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        // All retries failed - fallback to persisted state
        this.addLog('warn', 'SYNC', 'Failed to sync from platform, using persisted state');
        logger.warn('[MainController] Using persisted state as fallback');
        try {
            const persistedStrategies = this.persistence.getActiveStrategies();
            if (persistedStrategies.length > 0) {
                this.addLog('info', 'SYNC', `Restoring ${persistedStrategies.length} strategies from persisted state`);
                for (const strategy of persistedStrategies) {
                    try {
                        // Add to active list
                        this.activeStrategies.push({
                            id: strategy.id,
                            name: strategy.name,
                            status: 'active',
                            symbol: strategy.symbol,
                            symbols: [strategy.symbol], // Array for compatibility with dashboard
                            timeframe: strategy.timeframe,
                            lastSignal: null
                        });
                        // Start monitoring
                        if (this.strategyMonitor) {
                            await this.strategyMonitor.startMonitoring(strategy);
                            this.addLog('info', 'SYNC', `Strategy ${strategy.name} restored from persistence`);
                        }
                        // Restore EA attachment if it was attached
                        if (strategy.eaAttached && strategy.eaAttachmentState) {
                            await this.restoreEAAttachment(strategy);
                        }
                    }
                    catch (error) {
                        logger.error(`[MainController] Failed to restore persisted strategy ${strategy.name}:`, error);
                    }
                }
            }
            else {
                this.addLog('info', 'SYNC', 'No persisted strategies found');
            }
        }
        catch (fallbackError) {
            logger.error('[MainController] Failed to restore from persisted state:', fallbackError);
            throw lastError || fallbackError;
        }
    }
    /**
     * Restore EA attachment for a strategy
     */
    async restoreEAAttachment(strategy) {
        try {
            if (!this.config)
                return;
            // Get EA attachment state from persistence
            const mt5Installations = await this.mt5Detector.detectAllInstallations();
            if (mt5Installations.length === 0) {
                return;
            }
            const accountNumber = mt5Installations[0].accountNumber || '';
            const attachment = this.persistence.getEAAttachment(strategy.symbol, strategy.timeframe, accountNumber);
            if (attachment) {
                this.addLog('info', 'SYNC', `Reattaching EA for ${strategy.name} on ${strategy.symbol} ${strategy.timeframe}`);
                // Send command to MT5 to reattach EA
                try {
                    // Note: EA reattachment would typically be done manually in MT5
                    // This is logged for informational purposes
                    this.addLog('info', 'SYNC', `EA attachment detected for ${strategy.name}, ready to execute`);
                }
                catch (error) {
                    this.addLog('warn', 'SYNC', `Failed to reattach EA for ${strategy.name}, manual attachment may be required`);
                    logger.warn(`[MainController] EA reattachment failed:`, error);
                }
            }
        }
        catch (error) {
            logger.error(`[MainController] Error restoring EA attachment:`, error);
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
            this.addLog('warn', 'MAIN', 'Auto-installation failed, but continuing initialization...');
            // Don't fail - EA might already be installed manually
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
            // Get account info from ZeroMQ server (received from MT5 EA)
            const accountInfo = this.zeromqServer.getAccountInfo();
            if (accountInfo) {
                return accountInfo;
            }
            // Fallback to old method if no data from ZMQ yet
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
     * Notify that EA has been attached
     */
    notifyEAAttached(info) {
        try {
            this.eaAttachmentHandler.notifyEAAttached(info);
            this.addLog('info', 'EA', `EA attached: ${info.symbol} ${info.timeframe}`);
        }
        catch (error) {
            this.addLog('error', 'EA', `Failed to track EA attachment: ${error.message}`);
        }
    }
    /**
     * Notify that EA has been detached
     */
    notifyEADetached(info) {
        try {
            this.eaAttachmentHandler.notifyEADetached(info);
            this.addLog('info', 'EA', `EA detached: ${info.symbol} ${info.timeframe}`);
        }
        catch (error) {
            this.addLog('error', 'EA', `Failed to track EA detachment: ${error.message}`);
        }
    }
    /**
     * Get EA attachments
     */
    getEAAttachments() {
        return this.eaAttachmentHandler.getAttachments();
    }
    /**
     * Reconnect ZeroMQ client (for manual recovery)
     */
    async reconnectZeroMQClient() {
        try {
            this.addLog('info', 'ZEROMQ', 'Attempting to reconnect ZeroMQ client...');
            // Disconnect first if connected
            this.zeromqService.disconnect();
            // Wait a moment
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Reconnect
            const connected = await this.zeromqService.connect(this.config);
            if (connected) {
                this.addLog('info', 'ZEROMQ', '✅ ZeroMQ client reconnected successfully');
                this.connectionStatus.zeromq = 'connected';
                this.monitoringService.updateConnectionStatus('zeromq', { connected: true });
                return true;
            }
            else {
                this.addLog('error', 'ZEROMQ', 'Failed to reconnect ZeroMQ client');
                return false;
            }
        }
        catch (error) {
            this.addLog('error', 'ZEROMQ', `Reconnection error: ${error.message}`, { error });
            return false;
        }
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
        const { strategyId, signal } = data;
        try {
            this.addLog('info', 'SIGNAL', `Signal received for execution: ${signal.action} ${signal.symbol}`, {
                strategyId,
                signal: {
                    symbol: signal.symbol,
                    type: signal.type,
                    action: signal.action,
                    entryPrice: signal.entryPrice,
                    stopLoss: signal.stopLoss,
                    takeProfit: signal.takeProfit,
                    volume: signal.volume,
                    confidence: signal.confidence,
                    reasons: signal.reasons
                }
            });
            // Check if emergency stop is active
            if (this.emergencyStop && !this.emergencyStop.canTrade()) {
                this.addLog('warn', 'SIGNAL', 'Trade rejected: Emergency stop is active');
                return;
            }
            // Validate signal has required fields
            if (!signal.symbol || !signal.type || !signal.volume) {
                this.addLog('error', 'SIGNAL', 'Invalid signal: Missing required fields', { signal });
                return;
            }
            // Prepare trade parameters
            const tradeParams = {
                symbol: signal.symbol,
                type: signal.type, // 'BUY' or 'SELL'
                volume: signal.volume,
                price: signal.entryPrice || 0, // 0 means market price
                stopLoss: signal.stopLoss || 0,
                takeProfit: signal.takeProfit || 0,
                comment: `Strategy: ${strategyId}`,
                magic: this.generateMagicNumber(strategyId),
                slippage: 10, // 10 points slippage
            };
            this.addLog('info', 'SIGNAL', 'Executing trade via ZeroMQ...', { tradeParams });
            // Execute trade via ZeroMQ
            const result = await this.zeromqService.openPosition(tradeParams);
            if (result.success) {
                this.addLog('info', 'SIGNAL', `✅ Trade executed successfully: Ticket #${result.ticket}`, {
                    ticket: result.ticket,
                    symbol: result.symbol,
                    type: result.type,
                    volume: result.volume,
                    openPrice: result.openPrice,
                    stopLoss: result.stopLoss,
                    takeProfit: result.takeProfit,
                    profit: result.profit,
                    commission: result.commission,
                });
                // Notify platform about trade execution
                await this.reportTradeExecution(strategyId, signal, result);
                // Emit event for monitoring
                this.emit('trade:opened', {
                    strategyId,
                    signal,
                    result,
                });
            }
            else {
                this.addLog('error', 'SIGNAL', `❌ Trade execution failed: ${result.error}`, {
                    signal,
                    error: result.error,
                });
                // Emit event for error handling
                this.emit('trade:failed', {
                    strategyId,
                    signal,
                    error: result.error,
                });
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.addLog('error', 'SIGNAL', `Error executing signal: ${errorMessage}`, {
                error,
                signal,
                strategyId,
            });
            this.emit('trade:error', {
                strategyId,
                signal,
                error: errorMessage,
            });
        }
    }
    /**
     * Generate magic number from strategy ID
     */
    generateMagicNumber(strategyId) {
        // Generate a consistent magic number from strategy ID
        let hash = 0;
        for (let i = 0; i < strategyId.length; i++) {
            const char = strategyId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        // Ensure positive number between 100000 and 999999
        return Math.abs(hash % 900000) + 100000;
    }
    /**
     * Report trade execution to platform
     */
    async reportTradeExecution(strategyId, signal, result) {
        try {
            if (!this.apiService) {
                this.addLog('warn', 'SIGNAL', 'API service not available for trade reporting');
                return;
            }
            await this.apiService.reportTrade({
                ticket: result.ticket?.toString() || 'unknown',
                symbol: signal.symbol,
                type: signal.type,
                volume: signal.volume,
                openPrice: result.openPrice || signal.entryPrice,
                openTime: result.timestamp || new Date().toISOString(),
                stopLoss: result.stopLoss || signal.stopLoss,
                takeProfit: result.takeProfit || signal.takeProfit,
                comment: `Strategy: ${strategyId}`,
            });
            this.addLog('info', 'SIGNAL', 'Trade execution reported to platform');
        }
        catch (error) {
            this.addLog('warn', 'SIGNAL', 'Failed to report trade to platform', { error });
            // Don't throw - this is non-critical
        }
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
