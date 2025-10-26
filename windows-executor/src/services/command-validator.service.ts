/**
 * Command Validator Service
 * Validates trading commands before execution
 * Enforces beta limits and safety checks
 */

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface TradeCommand {
  command: string;
  symbol?: string;
  lotSize?: number;
  action?: string;
  stopLoss?: number;
  takeProfit?: number;
  [key: string]: any;
}

// Beta configuration limits
const BETA_LIMITS = {
  maxLotSize: 0.01, // Micro lots only
  maxPositions: 3,
  allowedSymbols: [
    // Major Forex Pairs
    'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'NZDUSD', 
    'USDCAD', 'USDCHF', 'EURJPY', 'GBPJPY',
    // Crypto
    'BTCUSD', 'ETHUSD',
    // Commodities
    'XAUUSD', 'XAGUSD', 'USOIL'
  ],
  maxDailyTrades: 20,
  maxDrawdown: 20, // Percentage
};

export class CommandValidatorService {
  private openPositions: number = 0;
  private dailyTradesCount: number = 0;
  private lastResetDate: Date = new Date();
  
  /**
   * Validate a trade command
   */
  validateCommand(command: TradeCommand): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Reset daily counter if needed
    this.resetDailyCounterIfNeeded();
    
    // Basic validation
    if (!command.command) {
      errors.push('Command is required');
      return { valid: false, errors, warnings };
    }
    
    // Validate based on command type
    switch (command.command) {
      case 'OPEN_POSITION':
        this.validateOpenPosition(command, errors, warnings);
        break;
        
      case 'MODIFY_POSITION':
        this.validateModifyPosition(command, errors, warnings);
        break;
        
      case 'CLOSE_POSITION':
        // Close position is generally safe
        break;
        
      case 'CLOSE_ALL_POSITIONS':
      case 'STOP_ALL':
        // Emergency commands are always allowed
        break;
        
      default:
        warnings.push(`Command type '${command.command}' not specifically validated`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
  
  /**
   * Validate OPEN_POSITION command
   */
  private validateOpenPosition(
    command: TradeCommand,
    errors: string[],
    warnings: string[]
  ): void {
    // Check lot size
    if (!command.lotSize || command.lotSize <= 0) {
      errors.push('Lot size must be greater than 0');
    } else if (command.lotSize > BETA_LIMITS.maxLotSize) {
      errors.push(
        `Lot size ${command.lotSize} exceeds beta limit of ${BETA_LIMITS.maxLotSize}`
      );
    }
    
    // Check symbol
    if (!command.symbol) {
      errors.push('Symbol is required');
    } else {
      const symbol = command.symbol.toUpperCase();
      if (!BETA_LIMITS.allowedSymbols.includes(symbol)) {
        errors.push(
          `Symbol ${symbol} not allowed in beta. Allowed symbols: ${BETA_LIMITS.allowedSymbols.join(', ')}`
        );
      }
    }
    
    // Check action
    if (!command.action) {
      errors.push('Action (BUY/SELL) is required');
    } else if (!['BUY', 'SELL', 'buy', 'sell'].includes(command.action)) {
      errors.push(`Invalid action: ${command.action}. Must be BUY or SELL`);
    }
    
    // Check max positions
    if (this.openPositions >= BETA_LIMITS.maxPositions) {
      errors.push(
        `Maximum ${BETA_LIMITS.maxPositions} positions allowed in beta (currently ${this.openPositions})`
      );
    }
    
    // Check daily trades limit
    if (this.dailyTradesCount >= BETA_LIMITS.maxDailyTrades) {
      errors.push(
        `Daily trade limit of ${BETA_LIMITS.maxDailyTrades} reached. Try again tomorrow.`
      );
    }
    
    // Validate stop loss and take profit
    if (command.stopLoss && command.stopLoss < 0) {
      errors.push('Stop loss must be positive');
    }
    
    if (command.takeProfit && command.takeProfit < 0) {
      errors.push('Take profit must be positive');
    }
    
    // Warnings
    if (!command.stopLoss) {
      warnings.push('No stop loss set - position will have no automatic loss protection');
    }
    
    if (!command.takeProfit) {
      warnings.push('No take profit set - position will need manual closing');
    }
  }
  
  /**
   * Validate MODIFY_POSITION command
   */
  private validateModifyPosition(
    command: TradeCommand,
    errors: string[],
    warnings: string[]
  ): void {
    if (!command.ticket && !command.positionId) {
      errors.push('Ticket or position ID is required');
    }
    
    if (command.stopLoss && command.stopLoss < 0) {
      errors.push('Stop loss must be positive');
    }
    
    if (command.takeProfit && command.takeProfit < 0) {
      errors.push('Take profit must be positive');
    }
  }
  
  /**
   * Update open positions count
   */
  setOpenPositionsCount(count: number): void {
    this.openPositions = Math.max(0, count);
  }
  
  /**
   * Increment daily trades count
   */
  incrementDailyTrades(): void {
    this.dailyTradesCount++;
  }
  
  /**
   * Reset daily counter if it's a new day
   */
  private resetDailyCounterIfNeeded(): void {
    const now = new Date();
    const lastReset = this.lastResetDate;
    
    // Check if it's a new day
    if (
      now.getDate() !== lastReset.getDate() ||
      now.getMonth() !== lastReset.getMonth() ||
      now.getFullYear() !== lastReset.getFullYear()
    ) {
      this.dailyTradesCount = 0;
      this.lastResetDate = now;
      console.log('Daily trade counter reset');
    }
  }
  
  /**
   * Get beta limits info
   */
  getBetaLimits() {
    return {
      ...BETA_LIMITS,
      currentPositions: this.openPositions,
      todaysTrades: this.dailyTradesCount,
      remainingTrades: Math.max(0, BETA_LIMITS.maxDailyTrades - this.dailyTradesCount),
    };
  }
  
  /**
   * Check if beta mode is active
   */
  isBetaMode(): boolean {
    return process.env.BETA_MODE === 'true' || true; // Always true for beta
  }
}

// Singleton instance
export const commandValidator = new CommandValidatorService();
