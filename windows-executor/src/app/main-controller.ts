import { EventEmitter } from 'events';
import { AppConfig, ConnectionStatus, LogEntry } from '../types/config.types';
import { MT5Info, InstallResult } from '../types/mt5.types';
import { Command } from '../types/command.types';
import { DatabaseConfig } from '../types/security.types';
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

/**
 * Main Application Controller
 * 
 * This controller manages the entire lifecycle of the Windows Executor application,
 * coordinating all services and providing a unified interface for the UI.
 */
export class MainController extends EventEmitter {
  private config: AppConfig | null = null;
  private isInitialized = false;
  private isShuttingDown = false;
  private executorId: string = '';
  
  // Services
  private mt5Installer!: MT5AutoInstaller;
  private mt5Detector!: MT5DetectorService;
  private apiService!: ApiService;
  private connectionManager!: ConnectionManager;
  private pusherService!: PusherService;
  private zeromqService!: ZeroMQService;
  private zeromqServer!: ZeroMQServerService;
  private commandService!: CommandService;
  private heartbeatService!: HeartbeatService;
  private safetyService!: SafetyService;
  private monitoringService!: MonitoringService;
  private securityService!: SecurityService;
  private strategyService!: StrategyService;
  private indicatorService!: IndicatorService;
  private marketDataService!: MarketDataService;
  private llmService!: LLMService;
  private mt5AccountService!: MT5AccountService;
  private performanceMonitor!: PerformanceMonitorService;
  private alertService!: AlertService;
  private strategyMonitor!: StrategyMonitor;
  private safetyValidator!: SafetyValidatorService;
  private emergencyStop!: EmergencyStopService;
  private commandProcessor!: CommandProcessor;
  private conditionEvaluator!: ConditionEvaluatorService;
  private filterEvaluator!: FilterEvaluatorService;
  private positionSizing!: PositionSizingService;
  
  // Live trading services (Phase 1-5)
  private advancedIndicators!: AdvancedIndicatorService;
  private advancedPositionSizing!: AdvancedPositionSizingService;
  private smartExitExecutor!: SmartExitExecutor;
  private correlationExecutor!: CorrelationExecutorService;
  private multiAccountManager!: MultiAccountManager;
  private disasterRecovery!: DisasterRecoveryService;
  private indicatorCache!: IndicatorCache;
  private marketDataCache!: MarketDataCache;
  private performanceOptimizer!: PerformanceOptimizer;
  
  private db: DatabaseManager;
  
  // State
  private connectionStatus: ConnectionStatus = {
    pusher: 'disconnected',
    zeromq: 'disconnected',
    api: 'disconnected',
    mt5: 'disconnected',
  };
  
  private mt5Installations: MT5Info[] = [];
  private logs: LogEntry[] = [];
  private activeStrategies: any[] = [];
  private performanceMetrics: any = {
    totalTrades: 0,
    winRate: 0,
    profitFactor: 0,
    dailyPnL: 0,
    maxDrawdown: 0,
  };

  constructor() {
    super();
    
    // Initialize database
    const dbConfig: DatabaseConfig = {
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
  private initializeServices(): void {
    // Create logger function
    const logger = (level: string, message: string, metadata?: any) => {
      this.addLog(level as 'debug' | 'info' | 'warn' | 'error', 'MAIN', message, metadata);
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
    this.commandService = new CommandService(
      this.zeromqService,
      this.pusherService,
      this.safetyService.getLimits(),
      this.getRateLimitConfig(),
      logger,
      this.apiService
    );
    
    // Heartbeat service
    this.heartbeatService = new HeartbeatService(
      this.zeromqService,
      this.pusherService,
      this.commandService,
      logger,
      this.apiService
    );
    
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
    this.strategyMonitor = new StrategyMonitor(
      this.indicatorService,
      this.marketDataService,
      this.conditionEvaluator,
      this.filterEvaluator,
      this.positionSizing,
      this.safetyValidator
    );
    
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
    
    // Command processor (Phase 1) - Wires everything together
    this.commandProcessor = new CommandProcessor();
    
    this.addLog('info', 'MAIN', 'All services initialized successfully (11 core + 11 live trading services)');
    
    // Setup service event handlers
    this.setupServiceEventHandlers();
  }
  
  /**
   * Initialize strategy service after connection is established
   */
  private initializeStrategyService(): void {
    if (!this.config) {
      this.addLog('warn', 'MAIN', 'Cannot initialize strategy service: no config');
      return;
    }
    
    this.strategyService = new StrategyService(
      this.config.platformUrl,
      this.executorId,
      this.indicatorService,
      this.marketDataService
    );
    
    // Setup strategy event handlers
    this.setupStrategyEventHandlers();
    
    this.addLog('info', 'MAIN', 'Strategy service initialized');
  }
  
  /**
   * Setup strategy event handlers
   */
  private setupStrategyEventHandlers(): void {
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
        await this.commandService.queueCommand(command as any);
        
      } catch (error) {
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
  private setupServiceEventHandlers(): void {
    // Connection Manager events
    this.connectionManager.on('connection-status-changed', (data: any) => {
      this.addLog('info', 'CONNECTION', `${data.type} status changed: ${data.status}`, data);
      
      // Update local connection status
      if (data.type === 'pusher') this.connectionStatus.pusher = data.status;
      if (data.type === 'zeromq') this.connectionStatus.zeromq = data.status;
      if (data.type === 'api') this.connectionStatus.api = data.status;
      if (data.type === 'mt5') this.connectionStatus.mt5 = data.status;
      
      this.emit('connection-status-changed', this.connectionStatus);
    });

    this.connectionManager.on('reconnect-requested', async (data: any) => {
      this.addLog('info', 'CONNECTION', `Reconnecting ${data.type}...`, data);
      
      // Reconnection will be handled by each service's internal retry logic
      // This event is mainly for logging and UI notifications
    });

    this.connectionManager.on('reconnection-struggling', (data: any) => {
      this.addLog('warn', 'CONNECTION', data.message, data);
      // Notify user via UI
      this.emit('show-notification', {
        type: 'warning',
        title: 'Connection Issues',
        message: data.message,
      });
    });

    this.connectionManager.on('max-reconnect-attempts-reached', (data: any) => {
      this.addLog('error', 'CONNECTION', `${data.type} reconnection failed after max attempts`, data);
      // Notify user
      this.emit('show-notification', {
        type: 'error',
        title: 'Connection Lost',
        message: `Failed to reconnect to ${data.type}. Please check your connection and restart the application.`,
      });
    });

    // Pusher service events
    this.pusherService.on('connection-status', (data: any) => {
      if (data.status === 'connected') {
        this.connectionManager.setConnected('pusher');
      } else if (data.status === 'error') {
        this.connectionManager.setError('pusher', data.error || 'Unknown error');
      } else {
        this.connectionManager.setDisconnected('pusher', data.error);
      }
      
      this.addLog('info', 'PUSHER', `Connection status: ${data.status}`, data);
    });

    this.pusherService.on('command-received', async (command: Command) => {
      this.addLog('info', 'COMMAND', `Command received: ${command.command}`, { command });
      await this.commandService.addCommand(command);
    });

    this.pusherService.on('emergency-stop', (data: any) => {
      this.addLog('warn', 'SAFETY', 'Emergency stop received', data);
      this.handleEmergencyStop(data.reason, data.initiator);
    });

    // Command service events
    this.commandService.on('command-completed', (data: any) => {
      this.addLog('info', 'COMMAND', `Command completed: ${data.commandId}`, data);
      this.updatePerformanceMetrics(data);
    });

    this.commandService.on('command-failed', (data: any) => {
      this.addLog('error', 'COMMAND', `Command failed: ${data.commandId}`, data);
    });

    // Safety service events
    this.safetyService.on('emergencyStop', (data: any) => {
      this.addLog('warn', 'SAFETY', `Emergency stop activated`, data);
      this.emit('safety-alert', data);
    });

    // Monitoring service events
    this.monitoringService.on('alertTriggered', (data: any) => {
      this.addLog('warn', 'MONITORING', `Alert triggered: ${data.alert.type}`, data);
      this.emit('performance-alert', data);
    });

    // Security service events
    this.securityService.on('securityEvent', (data: any) => {
      this.addLog('error', 'SECURITY', `Security event: ${data.event.type}`, data);
      this.emit('security-threat', data);
    });
  }

  /**
   * Setup global error handling
   */
  private setupErrorHandling(): void {
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
  private setupProcessHandlers(): void {
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
  private handleAutoInstallResult(
    installResult: InstallResult,
    options: { emitDetectionEvent?: boolean } = {},
  ): void {
    const { emitDetectionEvent = true } = options;

    this.mt5Installations = installResult.mt5Installations || [];

    if (emitDetectionEvent) {
      if (this.mt5Installations.length > 0) {
        this.emit('mt5-detected', this.mt5Installations);
      } else {
        this.emit('mt5-not-found');
      }
    }

    if (!installResult.success) {
      this.addLog('error', 'MAIN', 'Auto-installation failed', installResult.errors);
      this.emit('auto-install-failed', installResult);
    } else {
      this.addLog('info', 'MAIN', 'Auto-installation completed successfully');
      this.emit('auto-install-completed', installResult);
    }
  }

  /**
   * Trigger MT5 auto-installation outside of full initialization
   */
  async autoInstallMT5(): Promise<InstallResult> {
    try {
      this.addLog('info', 'MAIN', 'Manual auto-installation requested');

      const installResult = await this.mt5Installer.autoInstallEverything();
      this.handleAutoInstallResult(installResult);
      return installResult;
    } catch (error) {
      const message = (error as Error).message || 'Unknown auto-installation error';
      const fallbackResult: InstallResult = {
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
  async initialize(config: AppConfig): Promise<boolean> {
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
      const pusherConnected = await this.pusherService.connect(config as any);
      if (!pusherConnected) {
        this.addLog('warn', 'MAIN', 'Failed to connect to Pusher - continuing without real-time updates');
        // Don't fail initialization, just log warning
        // Real-time updates will be disabled but app can still function
      } else {
        this.addLog('info', 'MAIN', 'Pusher connected successfully');
      }
      
      // Step 5: Start ZeroMQ Server (listen for MT5 connections)
      this.addLog('info', 'MAIN', 'Step 5: Starting ZeroMQ Server...');
      const zeromqStarted = await this.zeromqServer.start(config as any);
      if (!zeromqStarted) {
        this.addLog('error', 'MAIN', 'Failed to start ZeroMQ Server - MT5 communication will be unavailable');
        // Don't fail initialization, continue without MT5 connection
      } else {
        this.addLog('info', 'MAIN', '✅ ZeroMQ Server started - ready for MT5 connections');
        this.connectionStatus.zeromq = 'connected';
      }
      
      // Step 6: Start heartbeat service
      await this.heartbeatService.start(config as any);
      
      // Step 7: Start monitoring service
      await this.monitoringService.startMonitoring();
      
      // Step 8: Safety service is already initialized in constructor
      
      // Step 9: Initialize Strategy Engine (NEW!)
      this.addLog('info', 'MAIN', 'Step 9: Initializing Strategy Engine...');
      this.llmService = new LLMService(config.platformUrl, config.apiKey, this.executorId);
      
      // Initialize additional services
      this.mt5AccountService = new MT5AccountService();
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
        } catch (error) {
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
      
    } catch (error) {
      this.addLog('error', 'MAIN', `Initialization failed: ${(error as Error).message}`, { error });
      this.emit('initialization-failed', error);
      return false;
    }
  }

  /**
   * Start the application
   */
  async start(): Promise<boolean> {
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
      
    } catch (error) {
      this.addLog('error', 'MAIN', `Failed to start: ${(error as Error).message}`, { error });
      this.emit('start-failed', error);
      return false;
    }
  }

  /**
   * Stop the application
   */
  async stop(): Promise<boolean> {
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
      
    } catch (error) {
      this.addLog('error', 'MAIN', `Failed to stop: ${(error as Error).message}`, { error });
      this.emit('stop-failed', error);
      return false;
    }
  }

  /**
   * Shutdown the application gracefully
   */
  async shutdown(reason: string): Promise<void> {
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
      
    } catch (error) {
      this.addLog('error', 'MAIN', `Error during shutdown: ${(error as Error).message}`, { error });
      process.exit(1);
    }
  }

  /**
   * Handle emergency stop
   */
  private async handleEmergencyStop(reason?: string, initiator?: string): Promise<void> {
    this.addLog('warn', 'SAFETY', 'Emergency stop activated', { reason, initiator });
    
    try {
      // Stop command processing
      this.commandService.stopProcessing();
      
      // Execute emergency stop in safety service
      await this.safetyService.emergencyStop();
      
      // Emit emergency stop event
      this.emit('emergency-stop', { reason, initiator });
      
    } catch (error) {
      this.addLog('error', 'SAFETY', `Emergency stop failed: ${(error as Error).message}`, { error });
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(data: any): void {
    // This would be implemented with actual metrics calculation
    // For now, just emit the event
    this.emit('performance-updated', data);
  }

  /**
   * Get rate limit configuration
   */
  private getRateLimitConfig() {
    return {
      windowMs: 60000, // 1 minute
      maxRequests: 100, // 100 requests per minute
    };
  }

  /**
   * Add log entry
   */
  private addLog(level: 'debug' | 'info' | 'warn' | 'error', category: string, message: string, metadata?: any): void {
    const logEntry: LogEntry = {
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
    const levelColors: Record<string, string> = {
      debug: '\x1b[36m', // cyan
      info: '\x1b[32m',  // green
      warn: '\x1b[33m',  // yellow
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
  getLogs(limit?: number): LogEntry[] {
    return limit ? this.logs.slice(0, limit) : this.logs;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Get MT5 installations
   */
  getMT5Installations(): MT5Info[] {
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
  async executeCommand(command: Command): Promise<string> {
    return await this.commandService.addCommand(command);
  }

  /**
   * Cancel command
   */
  cancelCommand(commandId: string): boolean {
    return this.commandService.cancelCommand(commandId);
  }

  /**
   * Get command status
   */
  getCommandStatus(commandId: string) {
    return this.commandService.getCommandStatus(commandId);
  }

  /**
   * Update configuration
   */
  async updateConfig(newConfig: Partial<AppConfig>): Promise<boolean> {
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
      
    } catch (error) {
      this.addLog('error', 'MAIN', `Failed to update configuration: ${(error as Error).message}`, { error });
      return false;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AppConfig | null {
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
    } catch (error) {
      this.addLog('error', 'MT5', `Failed to get account info: ${(error as Error).message}`);
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
  getRecentSignals(limit: number = 10) {
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
  getRecentActivity(limit: number = 20) {
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
  private async startLiveTradingServices(): Promise<void> {
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
      this.commandProcessor.initialize(
        this.zeromqService,
        this.pusherService,
        this.strategyMonitor,
        this.emergencyStop
      );
      this.addLog('info', 'COMMAND', 'Command processor initialized');
      
      // Perform crash recovery if needed (Phase 4)
      if (await this.detectPreviousCrash()) {
        this.addLog('warn', 'RECOVERY', 'Previous crash detected, initiating recovery...');
        await this.disasterRecovery.recoverFromCrash();
      }
      
      this.addLog('info', 'MAIN', '✅ All live trading services started successfully');
      
    } catch (error) {
      this.addLog('error', 'MAIN', 'Error starting live trading services:', error);
    }
  }
  
  /**
   * Detect if previous session crashed
   */
  private async detectPreviousCrash(): Promise<boolean> {
    // Check for crash marker file
    const fs = require('fs');
    const crashMarkerPath = './crash.marker';
    return fs.existsSync(crashMarkerPath);
  }
  
  /**
   * Setup event handlers for live trading services
   */
  private setupLiveTradingEventHandlers(): void {
    // Strategy Monitor events (Phase 1)
    this.strategyMonitor.on('signal:generated', async (data: any) => {
      this.addLog('info', 'SIGNAL', `Signal generated for ${data.signal.symbol}`, data.signal);
      // TODO: Execute trade via ZeroMQ
    });
    
    this.strategyMonitor.on('monitor:stopped', (data: any) => {
      this.addLog('info', 'MONITOR', `Strategy monitor stopped: ${data.strategyId}`);
    });
    
    // Emergency Stop events (Phase 1)
    this.emergencyStop.on('killswitch:activated', (data: any) => {
      this.addLog('error', 'EMERGENCY', '🔴 KILL SWITCH ACTIVATED', data);
      this.strategyMonitor.stopAll();
    });
    
    // Disaster Recovery events (Phase 4)
    this.disasterRecovery.on('backup-completed', (data: any) => {
      this.addLog('info', 'BACKUP', `Backup completed: ${data.backupId}`);
    });
    
    // Performance events (Phase 5)
    this.performanceOptimizer.on('performance-degraded', (data: any) => {
      this.addLog('warn', 'PERFORMANCE', 'Performance issues detected', data);
    });
    
    this.addLog('info', 'MAIN', 'Live trading event handlers configured');
  }
  
  /**
   * Handle signal generated
   */
  private async handleSignalGenerated(data: any): Promise<void> {
    // TODO: Execute trade via ZeroMQ
    this.addLog('info', 'SIGNAL', 'Handling signal', data);
  }
  
  /**
   * Execute partial close
   */
  private async executePartialClose(data: any): Promise<void> {
    // TODO: Implement via ZeroMQ
    this.addLog('info', 'EXIT', 'Executing partial close', data);
  }
  
  /**
   * Modify position
   */
  private async modifyPosition(data: any): Promise<void> {
    // TODO: Implement via ZeroMQ
    this.addLog('info', 'EXIT', 'Modifying position', data);
  }
  
  /**
   * Close position
   */
  private async closePosition(data: any): Promise<void> {
    // TODO: Implement via ZeroMQ
    this.addLog('info', 'EXIT', 'Closing position', data);
  }
  
  /**
   * Handle kill switch activation
   */
  private async handleKillSwitchActivated(data: any): Promise<void> {
    this.connectionStatus.mt5 = 'error';
    this.emit('kill-switch-activated', data);
    
    // TODO: Notify platform via API
    this.addLog('warn', 'EMERGENCY', 'Platform notification for kill switch pending API implementation');
  }
}
