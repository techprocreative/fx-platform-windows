import { StrategyCommandType } from '../types/strategy-command.types';
import { CommandService } from './command.service';
import { ZeroMQService } from './zeromq.service';
import { PusherService } from './pusher.service';
import { logger } from '../utils/logger';
export class CommandProcessor {
    constructor() {
        Object.defineProperty(this, "commandService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "strategyMonitor", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "emergencyStop", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "isProcessing", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        // Initialize with default services - these will be set later
        this.commandService = new CommandService(new ZeroMQService(), new PusherService(), {
            maxDailyLoss: 500,
            maxPositions: 10,
            maxLotSize: 1.0,
            maxDrawdownPercent: 20,
        }, {
            windowMs: 60000, // 1 minute
            maxRequests: 100,
        });
    }
    /**
     * Initialize the processor with actual services
     */
    initialize(zeromqService, pusherService, strategyMonitor, emergencyStop) {
        this.commandService = new CommandService(zeromqService, pusherService, {
            maxDailyLoss: 500,
            maxPositions: 10,
            maxLotSize: 1.0,
            maxDrawdownPercent: 20,
        }, {
            windowMs: 60000, // 1 minute
            maxRequests: 100,
        });
        this.strategyMonitor = strategyMonitor;
        this.emergencyStop = emergencyStop;
        logger.info('[CommandProcessor] Initialized with all services');
    }
    /**
     * Handle strategy commands (START, STOP, PAUSE, RESUME, UPDATE)
     */
    async handleStrategyCommand(command) {
        logger.info(`[CommandProcessor] Handling strategy command: ${command.type} for strategy ${command.strategyId}`);
        try {
            switch (command.type) {
                case StrategyCommandType.START_STRATEGY:
                    await this.handleStartStrategy(command);
                    break;
                case StrategyCommandType.STOP_STRATEGY:
                    await this.handleStopStrategy(command);
                    break;
                case StrategyCommandType.PAUSE_STRATEGY:
                    await this.handlePauseStrategy(command);
                    break;
                case StrategyCommandType.RESUME_STRATEGY:
                    await this.handleResumeStrategy(command);
                    break;
                case StrategyCommandType.UPDATE_STRATEGY:
                    await this.handleUpdateStrategy(command);
                    break;
                default:
                    logger.warn(`[CommandProcessor] Unknown strategy command type: ${command.type}`);
            }
        }
        catch (error) {
            logger.error(`[CommandProcessor] Error handling strategy command:`, error);
            throw error;
        }
    }
    /**
     * Handle START_STRATEGY command
     */
    async handleStartStrategy(command) {
        if (!command.strategy) {
            throw new Error('Strategy data is required for START_STRATEGY command');
        }
        if (!this.strategyMonitor) {
            throw new Error('Strategy monitor not initialized');
        }
        logger.info(`[CommandProcessor] Starting strategy: ${command.strategy.name}`);
        // Check if emergency stop is active
        if (this.emergencyStop && !this.emergencyStop.canTrade()) {
            throw new Error('Cannot start strategy: Emergency stop is active');
        }
        // Start monitoring the strategy
        await this.strategyMonitor.startMonitoring(command.strategy);
        logger.info(`[CommandProcessor] Strategy monitoring started: ${command.strategy.name}`);
    }
    /**
     * Handle STOP_STRATEGY command
     */
    async handleStopStrategy(command) {
        if (!this.strategyMonitor) {
            throw new Error('Strategy monitor not initialized');
        }
        logger.info(`[CommandProcessor] Stopping strategy: ${command.strategyId}`);
        // Stop monitoring
        await this.strategyMonitor.stopMonitoring(command.strategyId);
        // Close all positions for this strategy (if requested)
        // TODO: Implement closing positions by strategy ID
        logger.info(`[CommandProcessor] Strategy stopped: ${command.strategyId}`);
    }
    /**
     * Handle PAUSE_STRATEGY command
     */
    async handlePauseStrategy(command) {
        logger.info(`[CommandProcessor] Pausing strategy: ${command.strategyId}`);
        // TODO: Implement pause logic (stop monitoring but keep positions)
    }
    /**
     * Handle RESUME_STRATEGY command
     */
    async handleResumeStrategy(command) {
        logger.info(`[CommandProcessor] Resuming strategy: ${command.strategyId}`);
        // TODO: Implement resume logic
    }
    /**
     * Handle UPDATE_STRATEGY command
     */
    async handleUpdateStrategy(command) {
        logger.info(`[CommandProcessor] Updating strategy: ${command.strategyId}`);
        // TODO: Implement update logic
    }
    /**
     * Add a command to the processing queue
     */
    async add(command) {
        return await this.commandService.addCommand(command);
    }
    /**
     * Cancel a command
     */
    cancel(commandId) {
        return this.commandService.cancelCommand(commandId);
    }
    /**
     * Get command status
     */
    getStatus(commandId) {
        return this.commandService.getCommandStatus(commandId);
    }
    /**
     * Get queue statistics
     */
    getStats() {
        return this.commandService.getQueueStats();
    }
    /**
     * Start processing commands
     */
    start() {
        this.isProcessing = true;
    }
    /**
     * Stop processing commands
     */
    stop() {
        this.isProcessing = false;
        this.commandService.stopProcessing();
    }
    /**
     * Pause command processing
     */
    pause() {
        this.commandService.stopProcessing();
    }
    /**
     * Resume command processing
     */
    resume() {
        if (!this.isProcessing) {
            // Mark as processing again
            this.isProcessing = true;
            logger.info('[CommandProcessor] Processing resumed');
        }
    }
    /**
     * Check if processor is active
     */
    isActive() {
        return this.isProcessing;
    }
    /**
     * Update safety limits
     */
    updateSafetyLimits(limits) {
        this.commandService.updateSafetyLimits(limits);
    }
    /**
     * Update rate limit config
     */
    updateRateLimitConfig(config) {
        this.commandService.updateRateLimitConfig(config);
    }
    /**
     * Clear command history
     */
    clearHistory() {
        this.commandService.clearHistory();
    }
    /**
     * Get command from history
     */
    getFromHistory(commandId) {
        return this.commandService.getCommandFromHistory(commandId);
    }
    /**
     * Event handling
     */
    on(event, handler) {
        this.commandService.on(event, handler);
    }
    off(event, handler) {
        this.commandService.off(event, handler);
    }
}
