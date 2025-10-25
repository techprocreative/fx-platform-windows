"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandProcessor = void 0;
const strategy_command_types_1 = require("../types/strategy-command.types");
const command_service_1 = require("./command.service");
const zeromq_service_1 = require("./zeromq.service");
const pusher_service_1 = require("./pusher.service");
const logger_1 = require("../utils/logger");
class CommandProcessor {
    constructor() {
        this.strategyMonitor = null;
        this.emergencyStop = null;
        this.isProcessing = false;
        // Initialize with default services - these will be set later
        this.commandService = new command_service_1.CommandService(new zeromq_service_1.ZeroMQService(), new pusher_service_1.PusherService(), {
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
        this.commandService = new command_service_1.CommandService(zeromqService, pusherService, {
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
        logger_1.logger.info('[CommandProcessor] Initialized with all services');
    }
    /**
     * Handle strategy commands (START, STOP, PAUSE, RESUME, UPDATE)
     */
    async handleStrategyCommand(command) {
        logger_1.logger.info(`[CommandProcessor] Handling strategy command: ${command.type} for strategy ${command.strategyId}`);
        try {
            switch (command.type) {
                case strategy_command_types_1.StrategyCommandType.START_STRATEGY:
                    await this.handleStartStrategy(command);
                    break;
                case strategy_command_types_1.StrategyCommandType.STOP_STRATEGY:
                    await this.handleStopStrategy(command);
                    break;
                case strategy_command_types_1.StrategyCommandType.PAUSE_STRATEGY:
                    await this.handlePauseStrategy(command);
                    break;
                case strategy_command_types_1.StrategyCommandType.RESUME_STRATEGY:
                    await this.handleResumeStrategy(command);
                    break;
                case strategy_command_types_1.StrategyCommandType.UPDATE_STRATEGY:
                    await this.handleUpdateStrategy(command);
                    break;
                default:
                    logger_1.logger.warn(`[CommandProcessor] Unknown strategy command type: ${command.type}`);
            }
        }
        catch (error) {
            logger_1.logger.error(`[CommandProcessor] Error handling strategy command:`, error);
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
        logger_1.logger.info(`[CommandProcessor] Starting strategy: ${command.strategy.name}`);
        // Check if emergency stop is active
        if (this.emergencyStop && !this.emergencyStop.canTrade()) {
            throw new Error('Cannot start strategy: Emergency stop is active');
        }
        // Start monitoring the strategy
        await this.strategyMonitor.startMonitoring(command.strategy);
        logger_1.logger.info(`[CommandProcessor] Strategy monitoring started: ${command.strategy.name}`);
    }
    /**
     * Handle STOP_STRATEGY command
     */
    async handleStopStrategy(command) {
        if (!this.strategyMonitor) {
            throw new Error('Strategy monitor not initialized');
        }
        logger_1.logger.info(`[CommandProcessor] Stopping strategy: ${command.strategyId}`);
        // Stop monitoring
        await this.strategyMonitor.stopMonitoring(command.strategyId);
        // Close all positions for this strategy (if requested)
        // TODO: Implement closing positions by strategy ID
        logger_1.logger.info(`[CommandProcessor] Strategy stopped: ${command.strategyId}`);
    }
    /**
     * Handle PAUSE_STRATEGY command
     */
    async handlePauseStrategy(command) {
        logger_1.logger.info(`[CommandProcessor] Pausing strategy: ${command.strategyId}`);
        // TODO: Implement pause logic (stop monitoring but keep positions)
    }
    /**
     * Handle RESUME_STRATEGY command
     */
    async handleResumeStrategy(command) {
        logger_1.logger.info(`[CommandProcessor] Resuming strategy: ${command.strategyId}`);
        // TODO: Implement resume logic
    }
    /**
     * Handle UPDATE_STRATEGY command
     */
    async handleUpdateStrategy(command) {
        logger_1.logger.info(`[CommandProcessor] Updating strategy: ${command.strategyId}`);
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
            logger_1.logger.info('[CommandProcessor] Processing resumed');
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
exports.CommandProcessor = CommandProcessor;
