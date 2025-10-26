import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
// Ensure logs directory exists in user data folder (not in Program Files)
const logsDir = app.isPackaged
    ? path.join(app.getPath('userData'), 'logs')
    : path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}
// Custom format for structured logging
const customFormat = winston.format.combine(winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
}), winston.format.errors({ stack: true }), winston.format.json(), winston.format.printf(({ timestamp, level, message, category, metadata, stack, ...meta }) => {
    let logObj = {
        timestamp,
        level: level.toUpperCase(),
        message,
    };
    // Add category if present
    if (category) {
        logObj.category = category;
    }
    // Add metadata if present
    if (metadata) {
        logObj.metadata = metadata;
    }
    // Add stack trace for errors
    if (stack) {
        logObj.stack = stack;
    }
    // Add any additional metadata
    if (Object.keys(meta).length > 0) {
        logObj = { ...logObj, ...meta };
    }
    return JSON.stringify(logObj);
}));
// Create logger instance
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: customFormat,
    defaultMeta: {
        service: 'fx-executor',
        version: process.env.npm_package_version || '1.0.0',
        pid: process.pid,
    },
    transports: [
        // Error log file
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 10,
            tailable: true,
            format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
        }),
        // Combined log file
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 10,
            tailable: true,
            format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
        }),
        // Security events log
        new winston.transports.File({
            filename: path.join(logsDir, 'security.log'),
            level: 'warn',
            maxsize: 5242880, // 5MB
            maxFiles: 20,
            tailable: true,
            format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
            // Only log security events
            // filter: (info: any) => info.category === 'security' || info.level === 'error',
        }),
        // Trading events log
        new winston.transports.File({
            filename: path.join(logsDir, 'trading.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 20,
            tailable: true,
            format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
            // Only log trading events
            // filter: (info: any) => info.category === 'trading' || info.category === 'safety',
        }),
        // Performance log
        new winston.transports.File({
            filename: path.join(logsDir, 'performance.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true,
            format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
            // Only log performance events
            // filter: (info: any) => info.category === 'performance' || info.category === 'monitoring',
        }),
    ],
    // Handle uncaught exceptions and rejections
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'exceptions.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'rejections.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
});
// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), winston.format.timestamp({ format: 'HH:mm:ss' }), winston.format.printf(({ timestamp, level, message, category, metadata, stack }) => {
            let logMessage = `${timestamp} [${level}]`;
            if (category) {
                logMessage += ` [${category}]`;
            }
            logMessage += `: ${message}`;
            if (metadata && Object.keys(metadata).length > 0) {
                logMessage += ` ${JSON.stringify(metadata)}`;
            }
            if (stack) {
                logMessage += `\n${stack}`;
            }
            return logMessage;
        })),
    }));
}
// Enhanced logging methods with category support
export const createLogger = (category) => {
    return {
        debug: (message, metadata) => {
            logger.debug(message, { category, metadata });
        },
        info: (message, metadata) => {
            logger.info(message, { category, metadata });
        },
        warn: (message, metadata) => {
            logger.warn(message, { category, metadata });
        },
        error: (message, metadata) => {
            logger.error(message, { category, metadata });
        },
        critical: (message, metadata) => {
            logger.error(`[CRITICAL] ${message}`, { category, metadata, severity: 'CRITICAL' });
        },
        // Performance logging
        performance: (operation, duration, metadata) => {
            logger.info(`Performance: ${operation}`, {
                category: 'performance',
                metadata: {
                    operation,
                    duration: `${duration}ms`,
                    ...metadata
                }
            });
        },
        // Security logging
        security: (message, severity, metadata) => {
            const level = severity === 'CRITICAL' ? 'error' :
                severity === 'HIGH' ? 'error' :
                    severity === 'MEDIUM' ? 'warn' : 'info';
            logger[level](message, {
                category: 'security',
                metadata: {
                    severity,
                    ...metadata
                }
            });
        },
        // Trading logging
        trading: (message, metadata) => {
            logger.info(message, {
                category: 'trading',
                metadata
            });
        },
        // Audit logging
        audit: (action, userId, metadata) => {
            logger.info(`Audit: ${action}`, {
                category: 'audit',
                metadata: {
                    action,
                    userId,
                    timestamp: new Date().toISOString(),
                    ...metadata
                }
            });
        },
    };
};
// Performance monitoring helper
export class PerformanceLogger {
    constructor(operation, category = 'performance', metadata) {
        Object.defineProperty(this, "startTime", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "operation", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "category", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "metadata", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.operation = operation;
        this.category = category;
        this.metadata = metadata;
        this.startTime = Date.now();
    }
    end(additionalMetadata) {
        const duration = Date.now() - this.startTime;
        logger.info(`Performance: ${this.operation}`, {
            category: this.category,
            metadata: {
                operation: this.operation,
                duration: `${duration}ms`,
                ...this.metadata,
                ...additionalMetadata,
            }
        });
        return duration;
    }
}
// Log rotation and cleanup utilities
export class LogManager {
    /**
     * Clean up old log files
     */
    static async cleanupOldLogs() {
        try {
            const files = fs.readdirSync(logsDir);
            const now = new Date();
            for (const file of files) {
                const filePath = path.join(logsDir, file);
                const stats = fs.statSync(filePath);
                // Remove files older than MAX_LOG_AGE_DAYS
                const daysOld = (now.getTime() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
                if (daysOld > this.MAX_LOG_AGE_DAYS) {
                    fs.unlinkSync(filePath);
                    logger.info(`Cleaned up old log file: ${file}`, { category: 'maintenance' });
                }
                // Remove files that are too large
                const sizeMB = stats.size / (1024 * 1024);
                if (sizeMB > this.MAX_LOG_SIZE_MB) {
                    fs.unlinkSync(filePath);
                    logger.info(`Cleaned up large log file: ${file} (${sizeMB.toFixed(2)}MB)`, { category: 'maintenance' });
                }
            }
        }
        catch (error) {
            logger.error('Error cleaning up logs', { category: 'maintenance', error });
        }
    }
    /**
     * Get log statistics
     */
    static getLogStats() {
        try {
            const files = fs.readdirSync(logsDir);
            const stats = {
                totalFiles: files.length,
                totalSize: 0,
                files: [],
            };
            for (const file of files) {
                const filePath = path.join(logsDir, file);
                const fileStats = fs.statSync(filePath);
                stats.totalSize += fileStats.size;
                stats.files.push({
                    name: file,
                    size: fileStats.size,
                    sizeMB: (fileStats.size / (1024 * 1024)).toFixed(2),
                    modified: fileStats.mtime,
                });
            }
            stats.totalSizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);
            return stats;
        }
        catch (error) {
            logger.error('Error getting log stats', { category: 'maintenance', error });
            return {};
        }
    }
    /**
     * Rotate logs manually
     */
    static async rotateLogs() {
        try {
            const files = fs.readdirSync(logsDir);
            for (const file of files) {
                if (file.endsWith('.log')) {
                    const filePath = path.join(logsDir, file);
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const rotatedPath = path.join(logsDir, `${file}.${timestamp}`);
                    // Rename current log file
                    if (fs.existsSync(filePath)) {
                        fs.renameSync(filePath, rotatedPath);
                        logger.info(`Rotated log file: ${file}`, { category: 'maintenance' });
                    }
                }
            }
        }
        catch (error) {
            logger.error('Error rotating logs', { category: 'maintenance', error });
        }
    }
}
Object.defineProperty(LogManager, "MAX_LOG_AGE_DAYS", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 30
});
Object.defineProperty(LogManager, "MAX_LOG_SIZE_MB", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 100
});
// Schedule log cleanup (run daily at 2 AM)
const scheduleLogCleanup = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0);
    const msUntil2AM = tomorrow.getTime() - now.getTime();
    setTimeout(() => {
        LogManager.cleanupOldLogs();
        scheduleLogCleanup(); // Schedule next day
    }, msUntil2AM);
};
// Start log cleanup scheduler
if (process.env.NODE_ENV === 'production') {
    scheduleLogCleanup();
}
// Add critical method to main logger
logger.critical = (message, metadata) => {
    logger.error(`[CRITICAL] ${message}`, { metadata, severity: 'CRITICAL' });
};
// Export default logger for backward compatibility
export default logger;
