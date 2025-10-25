"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogManager = exports.PerformanceLogger = exports.createLogger = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const electron_1 = require("electron");
// Ensure logs directory exists in user data folder (not in Program Files)
const logsDir = electron_1.app.isPackaged
    ? path_1.default.join(electron_1.app.getPath('userData'), 'logs')
    : path_1.default.join(process.cwd(), 'logs');
if (!fs_1.default.existsSync(logsDir)) {
    fs_1.default.mkdirSync(logsDir, { recursive: true });
}
// Custom format for structured logging
const customFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
}), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf(({ timestamp, level, message, category, metadata, stack, ...meta }) => {
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
exports.logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: customFormat,
    defaultMeta: {
        service: 'fx-executor',
        version: process.env.npm_package_version || '1.0.0',
        pid: process.pid,
    },
    transports: [
        // Error log file
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 10,
            tailable: true,
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
        }),
        // Combined log file
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 10,
            tailable: true,
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
        }),
        // Security events log
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'security.log'),
            level: 'warn',
            maxsize: 5242880, // 5MB
            maxFiles: 20,
            tailable: true,
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
            // Only log security events
            // filter: (info: any) => info.category === 'security' || info.level === 'error',
        }),
        // Trading events log
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'trading.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 20,
            tailable: true,
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
            // Only log trading events
            // filter: (info: any) => info.category === 'trading' || info.category === 'safety',
        }),
        // Performance log
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'performance.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true,
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
            // Only log performance events
            // filter: (info: any) => info.category === 'performance' || info.category === 'monitoring',
        }),
    ],
    // Handle uncaught exceptions and rejections
    exceptionHandlers: [
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'exceptions.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
    rejectionHandlers: [
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'rejections.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
});
// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
    exports.logger.add(new winston_1.default.transports.Console({
        format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp({ format: 'HH:mm:ss' }), winston_1.default.format.printf(({ timestamp, level, message, category, metadata, stack }) => {
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
const createLogger = (category) => {
    return {
        debug: (message, metadata) => {
            exports.logger.debug(message, { category, metadata });
        },
        info: (message, metadata) => {
            exports.logger.info(message, { category, metadata });
        },
        warn: (message, metadata) => {
            exports.logger.warn(message, { category, metadata });
        },
        error: (message, metadata) => {
            exports.logger.error(message, { category, metadata });
        },
        critical: (message, metadata) => {
            exports.logger.error(`[CRITICAL] ${message}`, { category, metadata, severity: 'CRITICAL' });
        },
        // Performance logging
        performance: (operation, duration, metadata) => {
            exports.logger.info(`Performance: ${operation}`, {
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
            exports.logger[level](message, {
                category: 'security',
                metadata: {
                    severity,
                    ...metadata
                }
            });
        },
        // Trading logging
        trading: (message, metadata) => {
            exports.logger.info(message, {
                category: 'trading',
                metadata
            });
        },
        // Audit logging
        audit: (action, userId, metadata) => {
            exports.logger.info(`Audit: ${action}`, {
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
exports.createLogger = createLogger;
// Performance monitoring helper
class PerformanceLogger {
    constructor(operation, category = 'performance', metadata) {
        this.operation = operation;
        this.category = category;
        this.metadata = metadata;
        this.startTime = Date.now();
    }
    end(additionalMetadata) {
        const duration = Date.now() - this.startTime;
        exports.logger.info(`Performance: ${this.operation}`, {
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
exports.PerformanceLogger = PerformanceLogger;
// Log rotation and cleanup utilities
class LogManager {
    /**
     * Clean up old log files
     */
    static async cleanupOldLogs() {
        try {
            const files = fs_1.default.readdirSync(logsDir);
            const now = new Date();
            for (const file of files) {
                const filePath = path_1.default.join(logsDir, file);
                const stats = fs_1.default.statSync(filePath);
                // Remove files older than MAX_LOG_AGE_DAYS
                const daysOld = (now.getTime() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
                if (daysOld > this.MAX_LOG_AGE_DAYS) {
                    fs_1.default.unlinkSync(filePath);
                    exports.logger.info(`Cleaned up old log file: ${file}`, { category: 'maintenance' });
                }
                // Remove files that are too large
                const sizeMB = stats.size / (1024 * 1024);
                if (sizeMB > this.MAX_LOG_SIZE_MB) {
                    fs_1.default.unlinkSync(filePath);
                    exports.logger.info(`Cleaned up large log file: ${file} (${sizeMB.toFixed(2)}MB)`, { category: 'maintenance' });
                }
            }
        }
        catch (error) {
            exports.logger.error('Error cleaning up logs', { category: 'maintenance', error });
        }
    }
    /**
     * Get log statistics
     */
    static getLogStats() {
        try {
            const files = fs_1.default.readdirSync(logsDir);
            const stats = {
                totalFiles: files.length,
                totalSize: 0,
                files: [],
            };
            for (const file of files) {
                const filePath = path_1.default.join(logsDir, file);
                const fileStats = fs_1.default.statSync(filePath);
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
            exports.logger.error('Error getting log stats', { category: 'maintenance', error });
            return {};
        }
    }
    /**
     * Rotate logs manually
     */
    static async rotateLogs() {
        try {
            const files = fs_1.default.readdirSync(logsDir);
            for (const file of files) {
                if (file.endsWith('.log')) {
                    const filePath = path_1.default.join(logsDir, file);
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const rotatedPath = path_1.default.join(logsDir, `${file}.${timestamp}`);
                    // Rename current log file
                    if (fs_1.default.existsSync(filePath)) {
                        fs_1.default.renameSync(filePath, rotatedPath);
                        exports.logger.info(`Rotated log file: ${file}`, { category: 'maintenance' });
                    }
                }
            }
        }
        catch (error) {
            exports.logger.error('Error rotating logs', { category: 'maintenance', error });
        }
    }
}
exports.LogManager = LogManager;
LogManager.MAX_LOG_AGE_DAYS = 30;
LogManager.MAX_LOG_SIZE_MB = 100;
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
exports.logger.critical = (message, metadata) => {
    exports.logger.error(`[CRITICAL] ${message}`, { metadata, severity: 'CRITICAL' });
};
// Export default logger for backward compatibility
exports.default = exports.logger;
