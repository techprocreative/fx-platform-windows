/**
 * EA Attachment Handler
 * Handles notification and tracking of EA attachments
 */

import { PersistenceService } from '../services/persistence.service';
import { logger } from '../utils/logger';

export interface EAAttachmentInfo {
  symbol: string;
  timeframe: string;
  accountNumber: string;
  chartId?: string;
}

export class EAAttachmentHandler {
  constructor(private persistence: PersistenceService) {}

  /**
   * Notify that EA has been attached to a chart
   */
  notifyEAAttached(info: EAAttachmentInfo): void {
    try {
      logger.info('[EAAttachmentHandler] EA attached notification received', {
        symbol: info.symbol,
        timeframe: info.timeframe,
        accountNumber: info.accountNumber,
      });

      // Save EA attachment state
      this.persistence.saveEAAttachment({
        symbol: info.symbol,
        timeframe: info.timeframe,
        accountNumber: info.accountNumber,
        attachedAt: new Date().toISOString(),
        chartId: info.chartId,
      });

      logger.info('[EAAttachmentHandler] EA attachment state persisted');
    } catch (error) {
      logger.error('[EAAttachmentHandler] Failed to persist EA attachment:', error);
    }
  }

  /**
   * Notify that EA has been detached from a chart
   */
  notifyEADetached(info: EAAttachmentInfo): void {
    try {
      logger.info('[EAAttachmentHandler] EA detached notification received', {
        symbol: info.symbol,
        timeframe: info.timeframe,
        accountNumber: info.accountNumber,
      });

      // Remove EA attachment state
      this.persistence.removeEAAttachment(
        info.symbol,
        info.timeframe,
        info.accountNumber
      );

      logger.info('[EAAttachmentHandler] EA attachment state removed');
    } catch (error) {
      logger.error('[EAAttachmentHandler] Failed to remove EA attachment:', error);
    }
  }

  /**
   * Get current EA attachments
   */
  getAttachments() {
    return this.persistence.getEAAttachments();
  }

  /**
   * Check if EA is attached for given symbol/timeframe
   */
  isEAAttached(symbol: string, timeframe: string, accountNumber: string): boolean {
    const attachment = this.persistence.getEAAttachment(symbol, timeframe, accountNumber);
    return attachment !== null;
  }
}
