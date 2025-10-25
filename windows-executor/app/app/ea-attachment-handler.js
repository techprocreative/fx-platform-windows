"use strict";
/**
 * EA Attachment Handler
 * Handles notification and tracking of EA attachments
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EAAttachmentHandler = void 0;
const logger_1 = require("../utils/logger");
class EAAttachmentHandler {
    constructor(persistence) {
        this.persistence = persistence;
    }
    /**
     * Notify that EA has been attached to a chart
     */
    notifyEAAttached(info) {
        try {
            logger_1.logger.info('[EAAttachmentHandler] EA attached notification received', {
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
            logger_1.logger.info('[EAAttachmentHandler] EA attachment state persisted');
        }
        catch (error) {
            logger_1.logger.error('[EAAttachmentHandler] Failed to persist EA attachment:', error);
        }
    }
    /**
     * Notify that EA has been detached from a chart
     */
    notifyEADetached(info) {
        try {
            logger_1.logger.info('[EAAttachmentHandler] EA detached notification received', {
                symbol: info.symbol,
                timeframe: info.timeframe,
                accountNumber: info.accountNumber,
            });
            // Remove EA attachment state
            this.persistence.removeEAAttachment(info.symbol, info.timeframe, info.accountNumber);
            logger_1.logger.info('[EAAttachmentHandler] EA attachment state removed');
        }
        catch (error) {
            logger_1.logger.error('[EAAttachmentHandler] Failed to remove EA attachment:', error);
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
    isEAAttached(symbol, timeframe, accountNumber) {
        const attachment = this.persistence.getEAAttachment(symbol, timeframe, accountNumber);
        return attachment !== null;
    }
}
exports.EAAttachmentHandler = EAAttachmentHandler;
