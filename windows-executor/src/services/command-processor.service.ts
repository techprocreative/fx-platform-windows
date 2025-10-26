import { Command, CommandResult } from '../types/command.types';
import { StrategyCommand, StrategyCommandType } from '../types/strategy-command.types';
import { CommandService } from './command.service';
import { ZeroMQService } from './zeromq.service';
import { PusherService } from './pusher.service';
import { StrategyMonitor } from './strategy-monitor.service';
import { EmergencyStopService } from './emergency-stop.service';
import { PositionRegistry } from './position-registry.service';
import { logger } from '../utils/logger';

export class CommandProcessor {
  private commandService: CommandService;
  private strategyMonitor: StrategyMonitor | null = null;
  private emergencyStop: EmergencyStopService | null = null;
  private positionRegistry: PositionRegistry | null = null;
  private zeromqService: ZeroMQService | null = null;
  private isProcessing: boolean = false;

  constructor() {
    // Initialize with default services - these will be set later
    this.commandService = new CommandService(
      new ZeroMQService(),
      new PusherService(),
      {
        maxDailyLoss: 500,
        maxPositions: 10,
        maxLotSize: 1.0,
        maxDrawdownPercent: 20,
      },
      {
        windowMs: 60000, // 1 minute
        maxRequests: 100,
      }
    );
  }

  /**
   * Initialize the processor with actual services
   */
  initialize(
    zeromqService: ZeroMQService,
    pusherService: PusherService,
    strategyMonitor: StrategyMonitor,
    emergencyStop: EmergencyStopService,
    positionRegistry?: PositionRegistry
  ) {
    this.commandService = new CommandService(
      zeromqService,
      pusherService,
      {
        maxDailyLoss: 500,
        maxPositions: 10,
        maxLotSize: 1.0,
        maxDrawdownPercent: 20,
      },
      {
        windowMs: 60000, // 1 minute
        maxRequests: 100,
      }
    );
    
    this.strategyMonitor = strategyMonitor;
    this.emergencyStop = emergencyStop;
    this.positionRegistry = positionRegistry || null;
    this.zeromqService = zeromqService;
    
    logger.info('[CommandProcessor] Initialized with all services', {
      hasPositionRegistry: !!this.positionRegistry
    });
  }
  
  /**
   * Process command from platform (generic entry point)
   */
  async processCommand(command: any): Promise<any> {
    logger.info(`[CommandProcessor] Processing command: ${command.command}`, {
      commandId: command.id,
      strategyId: command.parameters?.strategyId
    });
    
    try {
      // Route based on command type
      switch (command.command) {
        case 'START_STRATEGY':
          await this.handleStartStrategy({
            type: 'START_STRATEGY' as any,
            strategyId: command.parameters?.strategyId,
            strategy: command.parameters?.strategy,
            timestamp: new Date()
          } as any);
          return { success: true, message: 'Strategy started' };
          
        case 'STOP_STRATEGY':
          await this.handleStopStrategy({
            type: 'STOP_STRATEGY' as any,
            strategyId: command.parameters?.strategyId,
            timestamp: new Date()
          } as any);
          return { success: true, message: 'Strategy stopped' };
          
        case 'GET_STATUS':
          return { 
            success: true, 
            data: { status: 'operational', strategies: this.strategyMonitor?.getAllActive().length || 0 }
          };
        
        case 'CLOSE_PROFITABLE':
          return await this.handleCloseProfitable(command.parameters);
          
        case 'CLOSE_LOSING':
          return await this.handleCloseLosing(command.parameters);
          
        case 'CLOSE_BY_STRATEGY':
          return await this.handleCloseByStrategy(command.parameters);
          
        case 'CLOSE_BY_SYMBOL':
          return await this.handleCloseBySymbol(command.parameters);
          
        default:
          throw new Error(`Unknown command: ${command.command}`);
      }
    } catch (error) {
      logger.error(`[CommandProcessor] Command execution error:`, error);
      throw error;
    }
  }
  
  /**
   * Handle strategy commands (START, STOP, PAUSE, RESUME, UPDATE)
   */
  async handleStrategyCommand(command: StrategyCommand): Promise<void> {
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
    } catch (error) {
      logger.error(`[CommandProcessor] Error handling strategy command:`, error);
      throw error;
    }
  }
  
  /**
   * Handle START_STRATEGY command
   */
  private async handleStartStrategy(command: StrategyCommand): Promise<void> {
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
  private async handleStopStrategy(command: StrategyCommand): Promise<void> {
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
  private async handlePauseStrategy(command: StrategyCommand): Promise<void> {
    logger.info(`[CommandProcessor] Pausing strategy: ${command.strategyId}`);
    // TODO: Implement pause logic (stop monitoring but keep positions)
  }
  
  /**
   * Handle RESUME_STRATEGY command
   */
  private async handleResumeStrategy(command: StrategyCommand): Promise<void> {
    logger.info(`[CommandProcessor] Resuming strategy: ${command.strategyId}`);
    // TODO: Implement resume logic
  }
  
  /**
   * Handle UPDATE_STRATEGY command
   */
  private async handleUpdateStrategy(command: StrategyCommand): Promise<void> {
    logger.info(`[CommandProcessor] Updating strategy: ${command.strategyId}`);
    // TODO: Implement update logic
  }

  /**
   * Add a command to the processing queue
   */
  async add(command: Command): Promise<string> {
    return await this.commandService.addCommand(command);
  }

  /**
   * Cancel a command
   */
  cancel(commandId: string): boolean {
    return this.commandService.cancelCommand(commandId);
  }

  /**
   * Get command status
   */
  getStatus(commandId: string) {
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
  isActive(): boolean {
    return this.isProcessing;
  }

  /**
   * Update safety limits
   */
  updateSafetyLimits(limits: any) {
    this.commandService.updateSafetyLimits(limits);
  }

  /**
   * Update rate limit config
   */
  updateRateLimitConfig(config: any) {
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
  getFromHistory(commandId: string) {
    return this.commandService.getCommandFromHistory(commandId);
  }

  /**
   * Event handling
   */
  on(event: string, handler: Function) {
    this.commandService.on(event, handler);
  }

  off(event: string, handler?: Function) {
    this.commandService.off(event, handler);
  }

  /**
   * Handle CLOSE_PROFITABLE command
   */
  private async handleCloseProfitable(parameters: any): Promise<any> {
    if (!this.positionRegistry) {
      throw new Error('Position registry not available');
    }

    if (!this.zeromqService) {
      throw new Error('ZeroMQ service not available');
    }

    const minProfit = parameters?.minProfit || 0;
    const profitablePositions = this.positionRegistry.getProfitable(minProfit);

    logger.info(`[CommandProcessor] Closing ${profitablePositions.length} profitable positions`, {
      minProfit,
      totalProfit: profitablePositions.reduce((sum, p) => sum + p.profit, 0)
    });

    const results = [];
    for (const position of profitablePositions) {
      try {
        const result = await this.zeromqService.closePosition(position.ticket);
        results.push({
          ticket: position.ticket,
          symbol: position.symbol,
          profit: position.profit,
          success: result.success
        });
      } catch (error) {
        logger.error(`[CommandProcessor] Failed to close position ${position.ticket}`, error);
        results.push({
          ticket: position.ticket,
          success: false,
          error: (error as Error).message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return {
      success: true,
      message: `Closed ${successCount}/${profitablePositions.length} profitable positions`,
      data: { results, totalClosed: successCount }
    };
  }

  /**
   * Handle CLOSE_LOSING command
   */
  private async handleCloseLosing(parameters: any): Promise<any> {
    if (!this.positionRegistry) {
      throw new Error('Position registry not available');
    }

    if (!this.zeromqService) {
      throw new Error('ZeroMQ service not available');
    }

    const maxLoss = parameters?.maxLoss || 0;
    const losingPositions = this.positionRegistry.getLosing(maxLoss);

    logger.warn(`[CommandProcessor] Closing ${losingPositions.length} losing positions`, {
      maxLoss,
      totalLoss: losingPositions.reduce((sum, p) => sum + p.profit, 0)
    });

    const results = [];
    for (const position of losingPositions) {
      try {
        const result = await this.zeromqService.closePosition(position.ticket);
        results.push({
          ticket: position.ticket,
          symbol: position.symbol,
          profit: position.profit,
          success: result.success
        });
      } catch (error) {
        logger.error(`[CommandProcessor] Failed to close position ${position.ticket}`, error);
        results.push({
          ticket: position.ticket,
          success: false,
          error: (error as Error).message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return {
      success: true,
      message: `Closed ${successCount}/${losingPositions.length} losing positions`,
      data: { results, totalClosed: successCount }
    };
  }

  /**
   * Handle CLOSE_BY_STRATEGY command
   */
  private async handleCloseByStrategy(parameters: any): Promise<any> {
    if (!this.positionRegistry) {
      throw new Error('Position registry not available');
    }

    if (!this.zeromqService) {
      throw new Error('ZeroMQ service not available');
    }

    const { strategyId } = parameters;
    if (!strategyId) {
      throw new Error('Strategy ID is required');
    }

    const positions = this.positionRegistry.getByStrategy(strategyId);

    logger.info(`[CommandProcessor] Closing ${positions.length} positions for strategy ${strategyId}`);

    const results = [];
    for (const position of positions) {
      try {
        const result = await this.zeromqService.closePosition(position.ticket);
        results.push({
          ticket: position.ticket,
          symbol: position.symbol,
          profit: position.profit,
          success: result.success
        });
      } catch (error) {
        logger.error(`[CommandProcessor] Failed to close position ${position.ticket}`, error);
        results.push({
          ticket: position.ticket,
          success: false,
          error: (error as Error).message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return {
      success: true,
      message: `Closed ${successCount}/${positions.length} positions for strategy`,
      data: { results, totalClosed: successCount, strategyId }
    };
  }

  /**
   * Handle CLOSE_BY_SYMBOL command
   */
  private async handleCloseBySymbol(parameters: any): Promise<any> {
    if (!this.positionRegistry) {
      throw new Error('Position registry not available');
    }

    if (!this.zeromqService) {
      throw new Error('ZeroMQ service not available');
    }

    const { symbol } = parameters;
    if (!symbol) {
      throw new Error('Symbol is required');
    }

    const positions = this.positionRegistry.getBySymbol(symbol);

    logger.info(`[CommandProcessor] Closing ${positions.length} positions for symbol ${symbol}`);

    const results = [];
    for (const position of positions) {
      try {
        const result = await this.zeromqService.closePosition(position.ticket);
        results.push({
          ticket: position.ticket,
          symbol: position.symbol,
          profit: position.profit,
          success: result.success
        });
      } catch (error) {
        logger.error(`[CommandProcessor] Failed to close position ${position.ticket}`, error);
        results.push({
          ticket: position.ticket,
          success: false,
          error: (error as Error).message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return {
      success: true,
      message: `Closed ${successCount}/${positions.length} positions for symbol`,
      data: { results, totalClosed: successCount, symbol }
    };
  }
}