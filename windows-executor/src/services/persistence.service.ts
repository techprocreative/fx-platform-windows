/**
 * Persistence Service
 * Manages persistent storage for application state using electron-store
 * Handles EA attachment state and active strategies persistence across restarts
 */

import Store from 'electron-store';
import { logger } from '../utils/logger';

interface EAAttachmentState {
  symbol: string;
  timeframe: string;
  accountNumber: string;
  attachedAt: string;
  chartId?: string;
}

interface ActiveStrategyState {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  status: string;
  activatedAt: string;
  eaAttached?: boolean;
  eaAttachmentState?: EAAttachmentState;
}

interface PersistenceData {
  activeStrategies: ActiveStrategyState[];
  eaAttachments: EAAttachmentState[];
  lastSync: string;
}

export class PersistenceService {
  private store: Store<PersistenceData>;
  
  constructor() {
    this.store = new Store<PersistenceData>({
      name: 'fx-executor-state',
      defaults: {
        activeStrategies: [],
        eaAttachments: [],
        lastSync: new Date().toISOString(),
      },
    });
    
    logger.info('[PersistenceService] Initialized');
  }

  /**
   * Save active strategy state
   */
  saveActiveStrategy(strategy: ActiveStrategyState): void {
    try {
      const strategies = this.getActiveStrategies();
      
      // Check if strategy already exists
      const existingIndex = strategies.findIndex(s => s.id === strategy.id);
      
      if (existingIndex >= 0) {
        // Update existing
        strategies[existingIndex] = {
          ...strategies[existingIndex],
          ...strategy,
        };
      } else {
        // Add new
        strategies.push(strategy);
      }
      
      this.store.set('activeStrategies', strategies);
      this.store.set('lastSync', new Date().toISOString());
      
      logger.info(`[PersistenceService] Saved strategy: ${strategy.name}`, {
        strategyId: strategy.id,
        eaAttached: strategy.eaAttached,
      });
    } catch (error) {
      logger.error('[PersistenceService] Failed to save strategy:', error);
    }
  }

  /**
   * Remove active strategy state
   */
  removeActiveStrategy(strategyId: string): void {
    try {
      const strategies = this.getActiveStrategies();
      const filtered = strategies.filter(s => s.id !== strategyId);
      
      this.store.set('activeStrategies', filtered);
      this.store.set('lastSync', new Date().toISOString());
      
      logger.info(`[PersistenceService] Removed strategy: ${strategyId}`);
    } catch (error) {
      logger.error('[PersistenceService] Failed to remove strategy:', error);
    }
  }

  /**
   * Get all active strategies
   */
  getActiveStrategies(): ActiveStrategyState[] {
    try {
      return this.store.get('activeStrategies', []);
    } catch (error) {
      logger.error('[PersistenceService] Failed to get active strategies:', error);
      return [];
    }
  }

  /**
   * Save EA attachment state
   */
  saveEAAttachment(attachment: EAAttachmentState): void {
    try {
      const attachments = this.getEAAttachments();
      
      // Check if attachment already exists for this symbol/timeframe
      const existingIndex = attachments.findIndex(
        a => a.symbol === attachment.symbol && 
             a.timeframe === attachment.timeframe &&
             a.accountNumber === attachment.accountNumber
      );
      
      if (existingIndex >= 0) {
        // Update existing
        attachments[existingIndex] = {
          ...attachments[existingIndex],
          ...attachment,
        };
      } else {
        // Add new
        attachments.push(attachment);
      }
      
      this.store.set('eaAttachments', attachments);
      this.store.set('lastSync', new Date().toISOString());
      
      // Also update the strategy with EA attachment info
      this.updateStrategyEAState(attachment.symbol, attachment.timeframe, true, attachment);
      
      logger.info(`[PersistenceService] Saved EA attachment: ${attachment.symbol} ${attachment.timeframe}`, {
        accountNumber: attachment.accountNumber,
      });
    } catch (error) {
      logger.error('[PersistenceService] Failed to save EA attachment:', error);
    }
  }

  /**
   * Remove EA attachment state
   */
  removeEAAttachment(symbol: string, timeframe: string, accountNumber: string): void {
    try {
      const attachments = this.getEAAttachments();
      const filtered = attachments.filter(
        a => !(a.symbol === symbol && 
               a.timeframe === timeframe && 
               a.accountNumber === accountNumber)
      );
      
      this.store.set('eaAttachments', filtered);
      this.store.set('lastSync', new Date().toISOString());
      
      // Update the strategy with EA detachment info
      this.updateStrategyEAState(symbol, timeframe, false);
      
      logger.info(`[PersistenceService] Removed EA attachment: ${symbol} ${timeframe}`);
    } catch (error) {
      logger.error('[PersistenceService] Failed to remove EA attachment:', error);
    }
  }

  /**
   * Get all EA attachments
   */
  getEAAttachments(): EAAttachmentState[] {
    try {
      return this.store.get('eaAttachments', []);
    } catch (error) {
      logger.error('[PersistenceService] Failed to get EA attachments:', error);
      return [];
    }
  }

  /**
   * Get EA attachment for specific symbol/timeframe
   */
  getEAAttachment(symbol: string, timeframe: string, accountNumber: string): EAAttachmentState | null {
    try {
      const attachments = this.getEAAttachments();
      return attachments.find(
        a => a.symbol === symbol && 
             a.timeframe === timeframe &&
             a.accountNumber === accountNumber
      ) || null;
    } catch (error) {
      logger.error('[PersistenceService] Failed to get EA attachment:', error);
      return null;
    }
  }

  /**
   * Update strategy with EA attachment state
   */
  private updateStrategyEAState(
    symbol: string, 
    timeframe: string, 
    eaAttached: boolean,
    attachmentState?: EAAttachmentState
  ): void {
    try {
      const strategies = this.getActiveStrategies();
      const strategy = strategies.find(s => s.symbol === symbol && s.timeframe === timeframe);
      
      if (strategy) {
        strategy.eaAttached = eaAttached;
        if (attachmentState) {
          strategy.eaAttachmentState = attachmentState;
        } else {
          delete strategy.eaAttachmentState;
        }
        
        this.store.set('activeStrategies', strategies);
      }
    } catch (error) {
      logger.error('[PersistenceService] Failed to update strategy EA state:', error);
    }
  }

  /**
   * Clear all stored data (for reset/troubleshooting)
   */
  clearAll(): void {
    try {
      this.store.clear();
      logger.info('[PersistenceService] Cleared all stored data');
    } catch (error) {
      logger.error('[PersistenceService] Failed to clear data:', error);
    }
  }

  /**
   * Get last sync time
   */
  getLastSync(): string {
    try {
      return this.store.get('lastSync', new Date().toISOString());
    } catch (error) {
      logger.error('[PersistenceService] Failed to get last sync:', error);
      return new Date().toISOString();
    }
  }

  /**
   * Export state for debugging
   */
  exportState(): PersistenceData {
    return {
      activeStrategies: this.getActiveStrategies(),
      eaAttachments: this.getEAAttachments(),
      lastSync: this.getLastSync(),
    };
  }
}
