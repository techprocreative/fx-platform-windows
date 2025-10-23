import { 
  Command, 
  CommandResult, 
  TradeParams, 
  ValidationResult, 
  SafetyCheck, 
  SafetyLimits,
  ExecutionContext,
  RateLimitConfig,
  RateLimitResult,
  ExecutorError 
} from '../types/command.types';
import { PriorityQueue, PRIORITIES } from '../utils/priority-queue';
import { ZeroMQService } from './zeromq.service';
import { PusherService } from './pusher.service';

export class CommandService {
  private commandQueue: PriorityQueue<Command>;
  private processing = false;
  private zeroMQService: ZeroMQService;
  private pusherService: PusherService;
  private safetyLimits: SafetyLimits;
  private rateLimitConfig: RateLimitConfig;
  private commandHistory: Map<string, { timestamp: Date; result: CommandResult }> = new Map();
  private activeCommands: Set<string> = new Set();
  private retryDelays: Map<number, number> = new Map([
    [1, 1000],   // 1 second
    [2, 2000],   // 2 seconds
    [3, 5000],   // 5 seconds
    [4, 10000],  // 10 seconds
    [5, 30000],  // 30 seconds
  ]);
  private logger: (level: string, message: string, metadata?: any) => void;
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor(
    zeroMQService: ZeroMQService,
    pusherService: PusherService,
    safetyLimits: SafetyLimits,
    rateLimitConfig: RateLimitConfig,
    logger?: (level: string, message: string, metadata?: any) => void
  ) {
    this.commandQueue = new PriorityQueue(1000);
    this.zeroMQService = zeroMQService;
    this.pusherService = pusherService;
    this.safetyLimits = safetyLimits;
    this.rateLimitConfig = rateLimitConfig;
    this.logger = logger || this.defaultLogger;
    
    // Start processing commands
    this.startProcessing();
  }

  private log(level: string, message: string, metadata?: any): void {
    this.logger(level, message, metadata);
  }

  /**
   * Add a command to the queue
   */
  async addCommand(command: Command): Promise<string> {
    try {
      // Validate command
      const validation = this.validateCommand(command);
      if (!validation.valid) {
        throw new Error(`Command validation failed: ${validation.errors.join(', ')}`);
      }

      // Check rate limits
      const rateLimitResult = this.checkRateLimit(command);
      if (!rateLimitResult.allowed) {
        throw new Error(`Rate limit exceeded. Retry after ${rateLimitResult.retryAfter}ms`);
      }

      // Check safety limits
      const safetyCheck = await this.performSafetyCheck(command);
      if (!safetyCheck.passed) {
        throw new Error(`Safety check failed: ${safetyCheck.errors.join(', ')}`);
      }

      // Determine priority based on command type and urgency
      const priority = this.getCommandPriority(command);
      
      // Add to queue
      const queueId = this.commandQueue.enqueue(command, priority, command.maxRetries || 3);
      
      this.log('info', 'Command added to queue', {
        commandId: command.id,
        command: command.command,
        priority,
        queueId,
      });

      this.emitEvent('command-queued', {
        commandId: command.id,
        queueId,
        priority,
        queueSize: this.commandQueue.size(),
      });

      return queueId;
    } catch (error) {
      this.log('error', 'Failed to add command to queue', {
        commandId: command.id,
        error: (error as Error).message,
      });

      // Report error back to platform
      await this.reportCommandResult(command.id, {
        success: false,
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }

  /**
   * Cancel a command in the queue
   */
  cancelCommand(commandId: string): boolean {
    // Find and remove from queue
    const allItems = this.commandQueue.getAll();
    const queueItem = allItems.find(item => item.data.id === commandId);
    
    if (queueItem) {
      const removed = this.commandQueue.removeById(queueItem.id);
      if (removed) {
        this.log('info', 'Command cancelled from queue', { commandId });
        this.emitEvent('command-cancelled', { commandId });
        return true;
      }
    }

    // Check if it's currently processing
    if (this.activeCommands.has(commandId)) {
      this.log('warn', 'Cannot cancel command - currently processing', { commandId });
      return false;
    }

    this.log('warn', 'Command not found for cancellation', { commandId });
    return false;
  }

  /**
   * Get command status
   */
  getCommandStatus(commandId: string): {
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
    queuePosition?: number;
    result?: CommandResult;
  } {
    // Check if in queue
    const allItems = this.commandQueue.getAll();
    const queueItem = allItems.find(item => item.data.id === commandId);
    
    if (queueItem) {
      const processableItems = this.commandQueue.getProcessableItems();
      const position = processableItems.findIndex(item => item.data.id === commandId);
      
      return {
        status: 'queued',
        queuePosition: position >= 0 ? position + 1 : undefined,
      };
    }

    // Check if currently processing
    if (this.activeCommands.has(commandId)) {
      return { status: 'processing' };
    }

    // Check history
    const history = this.commandHistory.get(commandId);
    if (history) {
      return {
        status: history.result.success ? 'completed' : 'failed',
        result: history.result,
      };
    }

    return { status: 'cancelled' };
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    const stats = this.commandQueue.getStats();
    const historyStats = this.getHistoryStats();

    return {
      queue: stats,
      processing: {
        activeCommands: this.activeCommands.size,
        isProcessing: this.processing,
      },
      history: historyStats,
      rateLimit: {
        windowMs: this.rateLimitConfig.windowMs,
        maxRequests: this.rateLimitConfig.maxRequests,
        currentUsage: this.getCurrentRateLimitUsage(),
      },
    };
  }

  /**
   * Start processing commands from queue
   */
  private startProcessing(): void {
    this.processing = true;
    this.processQueue();
  }

  /**
   * Stop processing commands
   */
  stopProcessing(): void {
    this.processing = false;
    this.log('info', 'Command processing stopped');
  }

  /**
   * Process commands from queue
   */
  private async processQueue(): Promise<void> {
    while (this.processing) {
      try {
        // Get next command that's ready for processing
        const queueItem = this.commandQueue.dequeue();
        
        if (!queueItem) {
          // No commands to process, wait a bit
          await this.sleep(100);
          continue;
        }

        const command = queueItem.data;
        
        // Check if command is ready for retry
        if (queueItem.nextRetryAt && queueItem.nextRetryAt > new Date()) {
          // Put it back and wait
          this.commandQueue.enqueue(command, queueItem.priority, queueItem.maxAttempts);
          await this.sleep(100);
          continue;
        }

        // Process the command
        await this.executeCommand(command, queueItem);
        
      } catch (error) {
        this.log('error', 'Error in command processing loop', {
          error: (error as Error).message,
        });
        
        // Wait a bit before continuing
        await this.sleep(1000);
      }
    }
  }

  /**
   * Execute a single command
   */
  private async executeCommand(command: Command, queueItem: any): Promise<void> {
    const startTime = Date.now();
    this.activeCommands.add(command.id);
    
    this.log('info', 'Executing command', {
      commandId: command.id,
      command: command.command,
      attempt: queueItem.attempts + 1,
    });

    this.emitEvent('command-started', {
      commandId: command.id,
      attempt: queueItem.attempts + 1,
    });

    try {
      // Create execution context
      const context = await this.createExecutionContext(command);
      
      // Execute based on command type
      let result: CommandResult;
      
      switch (command.command) {
        case 'OPEN_POSITION':
          result = await this.executeOpenPosition(command, context);
          break;
          
        case 'CLOSE_POSITION':
          result = await this.executeClosePosition(command, context);
          break;
          
        case 'CLOSE_ALL_POSITIONS':
          result = await this.executeCloseAllPositions(command, context);
          break;
          
        case 'MODIFY_POSITION':
          result = await this.executeModifyPosition(command, context);
          break;
          
        case 'GET_POSITIONS':
          result = await this.executeGetPositions(command, context);
          break;
          
        case 'GET_ACCOUNT_INFO':
          result = await this.executeGetAccountInfo(command, context);
          break;
          
        case 'GET_SYMBOL_INFO':
          result = await this.executeGetSymbolInfo(command, context);
          break;
          
        default:
          throw new Error(`Unknown command: ${command.command}`);
      }

      // Calculate execution time
      const executionTime = Date.now() - startTime;
      result.executionTime = executionTime;
      
      // Store in history
      this.commandHistory.set(command.id, {
        timestamp: new Date(),
        result,
      });

      // Clean up old history (keep last 1000)
      if (this.commandHistory.size > 1000) {
        const oldestKey = this.commandHistory.keys().next().value;
        if (oldestKey) {
          this.commandHistory.delete(oldestKey);
        }
      }

      // Report result
      await this.reportCommandResult(command.id, result);
      
      this.log('info', 'Command executed successfully', {
        commandId: command.id,
        executionTime,
        success: result.success,
      });

      this.emitEvent('command-completed', {
        commandId: command.id,
        result,
        executionTime,
      });

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = (error as Error).message;
      
      this.log('error', 'Command execution failed', {
        commandId: command.id,
        error: errorMessage,
        executionTime,
        attempt: queueItem.attempts + 1,
      });

      // Check if we should retry
      const shouldRetry = queueItem.attempts < queueItem.maxAttempts;
      
      if (shouldRetry) {
        // Calculate retry delay
        const retryDelay = this.retryDelays.get(queueItem.attempts + 1) || 30000;
        
        this.log('info', 'Scheduling command retry', {
          commandId: command.id,
          attempt: queueItem.attempts + 1,
          maxAttempts: queueItem.maxAttempts,
          retryDelay,
        });

        // Requeue for retry
        this.commandQueue.requeue(queueItem.id, retryDelay);
        
        this.emitEvent('command-retry', {
          commandId: command.id,
          attempt: queueItem.attempts + 1,
          maxAttempts: queueItem.maxAttempts,
          retryDelay,
        });
        
      } else {
        // Max retries reached, mark as failed
        const result: CommandResult = {
          success: false,
          error: errorMessage,
          timestamp: new Date().toISOString(),
          executionTime,
        };

        this.commandHistory.set(command.id, {
          timestamp: new Date(),
          result,
        });

        await this.reportCommandResult(command.id, result);
        
        this.emitEvent('command-failed', {
          commandId: command.id,
          error: errorMessage,
          executionTime,
          maxRetriesReached: true,
        });
      }
      
    } finally {
      this.activeCommands.delete(command.id);
    }
  }

  /**
   * Execute OPEN_POSITION command
   */
  private async executeOpenPosition(command: Command, context: ExecutionContext): Promise<CommandResult> {
    const params = command.parameters as TradeParams;
    
    // Additional safety checks
    if (params.volume > this.safetyLimits.maxLotSize) {
      throw new Error(`Lot size ${params.volume} exceeds maximum ${this.safetyLimits.maxLotSize}`);
    }

    const result = await this.zeroMQService.openPosition(params);
    return result;
  }

  /**
   * Execute CLOSE_POSITION command
   */
  private async executeClosePosition(command: Command, context: ExecutionContext): Promise<CommandResult> {
    const { ticket } = command.parameters || {};
    
    if (!ticket) {
      throw new Error('Ticket number is required for closing position');
    }

    const result = await this.zeroMQService.closePosition(ticket);
    return result;
  }

  /**
   * Execute CLOSE_ALL_POSITIONS command
   */
  private async executeCloseAllPositions(command: Command, context: ExecutionContext): Promise<CommandResult> {
    const results = await this.zeroMQService.closeAllPositions();
    
    return {
      success: true,
      message: `Closed ${results.length} positions`,
      metadata: { results },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Execute MODIFY_POSITION command
   */
  private async executeModifyPosition(command: Command, context: ExecutionContext): Promise<CommandResult> {
    const params = command.parameters;
    
    if (!params?.ticket) {
      throw new Error('Ticket number is required for modifying position');
    }

    const result = await this.zeroMQService.modifyPosition(params.ticket, params);
    return result;
  }

  /**
   * Execute GET_POSITIONS command
   */
  private async executeGetPositions(command: Command, context: ExecutionContext): Promise<CommandResult> {
    const positions = await this.zeroMQService.getPositions();
    
    return {
      success: true,
      message: `Retrieved ${positions.length} positions`,
      metadata: { positions },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Execute GET_ACCOUNT_INFO command
   */
  private async executeGetAccountInfo(command: Command, context: ExecutionContext): Promise<CommandResult> {
    const accountInfo = await this.zeroMQService.getAccountInfo();
    
    return {
      success: true,
      message: 'Account information retrieved',
      metadata: { accountInfo },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Execute GET_SYMBOL_INFO command
   */
  private async executeGetSymbolInfo(command: Command, context: ExecutionContext): Promise<CommandResult> {
    const { symbol } = command.parameters || {};
    
    if (!symbol) {
      throw new Error('Symbol is required for getting symbol info');
    }

    const symbolInfo = await this.zeroMQService.getSymbolInfo(symbol);
    
    return {
      success: true,
      message: `Symbol information retrieved for ${symbol}`,
      metadata: { symbolInfo },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Validate command structure
   */
  private validateCommand(command: Command): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!command.id) errors.push('Command ID is required');
    if (!command.command) errors.push('Command type is required');
    if (!command.createdAt) errors.push('Created timestamp is required');
    if (!command.priority || !['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(command.priority)) {
      errors.push('Valid priority is required');
    }

    // Command-specific validation
    switch (command.command) {
      case 'OPEN_POSITION':
        const tradeParams = command.parameters as TradeParams;
        if (!tradeParams?.symbol) errors.push('Symbol is required for opening position');
        if (!tradeParams?.type) errors.push('Trade type is required for opening position');
        if (!tradeParams?.volume || tradeParams.volume <= 0) errors.push('Valid volume is required');
        break;
        
      case 'CLOSE_POSITION':
        if (!command.parameters?.ticket) errors.push('Ticket is required for closing position');
        break;
        
      case 'GET_SYMBOL_INFO':
        if (!command.parameters?.symbol) errors.push('Symbol is required for getting symbol info');
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check rate limits
   */
  private checkRateLimit(command: Command): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.rateLimitConfig.windowMs;
    
    // Count recent commands
    let recentCommands = 0;
    for (const [_, entry] of this.commandHistory) {
      if (entry.timestamp.getTime() >= windowStart) {
        recentCommands++;
      }
    }

    const allowed = recentCommands < this.rateLimitConfig.maxRequests;
    const resetTime = new Date(windowStart + this.rateLimitConfig.windowMs);
    const retryAfter = allowed ? 0 : resetTime.getTime() - now;

    return {
      allowed,
      remaining: Math.max(0, this.rateLimitConfig.maxRequests - recentCommands),
      resetTime,
      retryAfter: retryAfter > 0 ? retryAfter : undefined,
    };
  }

  /**
   * Perform safety check
   */
  private async performSafetyCheck(command: Command): Promise<SafetyCheck> {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Get current positions
      const positions = await this.zeroMQService.getPositions();
      const currentPositions = positions.length;

      // Check position limits
      if (currentPositions >= this.safetyLimits.maxPositions) {
        if (command.command === 'OPEN_POSITION') {
          errors.push(`Maximum positions limit reached: ${currentPositions}/${this.safetyLimits.maxPositions}`);
        }
      } else if (currentPositions >= this.safetyLimits.maxPositions * 0.8) {
        warnings.push(`Approaching position limit: ${currentPositions}/${this.safetyLimits.maxPositions}`);
      }

      // Check daily loss (simplified - would need actual calculation)
      if (command.command === 'OPEN_POSITION') {
        // This would need actual daily loss calculation
        warnings.push('Daily loss check not implemented');
      }

      // Check lot size
      if (command.command === 'OPEN_POSITION') {
        const params = command.parameters as TradeParams;
        if (params.volume > this.safetyLimits.maxLotSize) {
          errors.push(`Lot size exceeds maximum: ${params.volume} > ${this.safetyLimits.maxLotSize}`);
        }
      }

      // Determine risk level
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
      if (errors.length > 0) {
        riskLevel = 'CRITICAL';
      } else if (warnings.length > 2) {
        riskLevel = 'HIGH';
      } else if (warnings.length > 0) {
        riskLevel = 'MEDIUM';
      }

      return {
        passed: errors.length === 0,
        warnings,
        errors,
        riskLevel,
      };

    } catch (error) {
      return {
        passed: false,
        warnings: [],
        errors: [`Safety check failed: ${(error as Error).message}`],
        riskLevel: 'CRITICAL',
      };
    }
  }

  /**
   * Create execution context
   */
  private async createExecutionContext(command: Command): Promise<ExecutionContext> {
    const positions = await this.zeroMQService.getPositions();
    
    return {
      command,
      executorId: 'current-executor', // Would come from config
      timestamp: new Date().toISOString(),
      mt5Connected: this.zeroMQService.isConnected(),
      safetyLimits: this.safetyLimits,
      currentPositions: positions.length,
      dailyLoss: 0, // Would need actual calculation
    };
  }

  /**
   * Get command priority
   */
  private getCommandPriority(command: Command): number {
    // Base priority from command priority
    let priority = PRIORITIES[command.priority] || PRIORITIES.NORMAL;

    // Adjust based on command type
    switch (command.command) {
      case 'CLOSE_POSITION':
      case 'CLOSE_ALL_POSITIONS':
        priority += 10; // Higher priority for closing positions
        break;
        
      case 'OPEN_POSITION':
        // Keep base priority
        break;
        
      case 'GET_ACCOUNT_INFO':
      case 'GET_POSITIONS':
      case 'GET_SYMBOL_INFO':
        priority -= 10; // Lower priority for info commands
        break;
    }

    return priority;
  }

  /**
   * Report command result back to platform
   */
  private async reportCommandResult(commandId: string, result: CommandResult): Promise<void> {
    try {
      await this.pusherService.sendCommandResult(commandId, result);
    } catch (error) {
      this.log('error', 'Failed to report command result', {
        commandId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get current rate limit usage
   */
  private getCurrentRateLimitUsage(): number {
    const now = Date.now();
    const windowStart = now - this.rateLimitConfig.windowMs;
    
    let recentCommands = 0;
    for (const [_, entry] of this.commandHistory) {
      if (entry.timestamp.getTime() >= windowStart) {
        recentCommands++;
      }
    }

    return recentCommands;
  }

  /**
   * Get history statistics
   */
  private getHistoryStats() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last1h = new Date(now.getTime() - 60 * 60 * 1000);

    let total = 0;
    let successful = 0;
    let last24hCount = 0;
    let last1hCount = 0;
    let totalExecutionTime = 0;

    for (const [_, entry] of this.commandHistory) {
      total++;
      if (entry.result.success) successful++;
      if (entry.timestamp >= last24h) last24hCount++;
      if (entry.timestamp >= last1h) last1hCount++;
      if (entry.result.executionTime) {
        totalExecutionTime += entry.result.executionTime;
      }
    }

    return {
      total,
      successful,
      failed: total - successful,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      last24h: last24hCount,
      last1h: last1hCount,
      averageExecutionTime: total > 0 ? totalExecutionTime / total : 0,
    };
  }

  /**
   * Event emitter functionality
   */
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler?: Function): void {
    if (!this.eventHandlers.has(event)) {
      return;
    }

    if (handler) {
      const handlers = this.eventHandlers.get(event)!;
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    } else {
      this.eventHandlers.delete(event);
    }
  }

  private emitEvent(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          this.log('error', `Error in event handler for ${event}`, { 
            error: (error as Error).message 
          });
        }
      });
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Default logger implementation
   */
  private defaultLogger(level: string, message: string, metadata?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      service: 'CommandService',
      message,
      metadata,
    };

    (console as any)[level] ? (console as any)[level](`[${timestamp}] [${level}] [CommandService] ${message}`, metadata) : console.log(logEntry);
  }

  /**
   * Update safety limits
   */
  updateSafetyLimits(limits: Partial<SafetyLimits>): void {
    this.safetyLimits = { ...this.safetyLimits, ...limits };
    this.log('info', 'Safety limits updated', { limits });
  }

  /**
   * Update rate limit config
   */
  updateRateLimitConfig(config: Partial<RateLimitConfig>): void {
    this.rateLimitConfig = { ...this.rateLimitConfig, ...config };
    this.log('info', 'Rate limit config updated', { config });
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.commandHistory.clear();
    this.log('info', 'Command history cleared');
  }

  /**
   * Get command by ID from history
   */
  getCommandFromHistory(commandId: string): { timestamp: Date; result: CommandResult } | undefined {
    return this.commandHistory.get(commandId);
  }
}