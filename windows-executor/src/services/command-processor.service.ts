import { Command, CommandResult } from '../types/command.types';
import { CommandService } from './command.service';
import { ZeroMQService } from './zeromq.service';
import { PusherService } from './pusher.service';

export class CommandProcessor {
  private commandService: CommandService;
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
  initialize(zeromqService: ZeroMQService, pusherService: PusherService) {
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
    if (this.isProcessing) {
      // Create new command service to restart processing
      // This is a workaround since startProcessing is private
      this.initialize(new ZeroMQService(), new PusherService());
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
}