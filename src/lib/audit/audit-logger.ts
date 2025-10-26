import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

/**
 * Audit Logging System
 * Track all critical operations for security and debugging
 */

export enum AuditAction {
  // Authentication
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  API_KEY_CREATED = 'API_KEY_CREATED',
  API_KEY_DELETED = 'API_KEY_DELETED',
  
  // Strategy
  STRATEGY_CREATED = 'STRATEGY_CREATED',
  STRATEGY_UPDATED = 'STRATEGY_UPDATED',
  STRATEGY_DELETED = 'STRATEGY_DELETED',
  STRATEGY_ACTIVATED = 'STRATEGY_ACTIVATED',
  STRATEGY_DEACTIVATED = 'STRATEGY_DEACTIVATED',
  
  // Trading
  TRADE_OPENED = 'TRADE_OPENED',
  TRADE_CLOSED = 'TRADE_CLOSED',
  TRADE_MODIFIED = 'TRADE_MODIFIED',
  TRADE_FAILED = 'TRADE_FAILED',
  
  // Executor
  EXECUTOR_CONNECTED = 'EXECUTOR_CONNECTED',
  EXECUTOR_DISCONNECTED = 'EXECUTOR_DISCONNECTED',
  EXECUTOR_COMMAND_SENT = 'EXECUTOR_COMMAND_SENT',
  EXECUTOR_COMMAND_FAILED = 'EXECUTOR_COMMAND_FAILED',
  
  // Emergency
  EMERGENCY_STOP_TRIGGERED = 'EMERGENCY_STOP_TRIGGERED',
  POSITIONS_FORCE_CLOSED = 'POSITIONS_FORCE_CLOSED',
  
  // System
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
}

export interface AuditLogEntry {
  action: AuditAction;
  userId?: string;
  executorId?: string;
  details: Record<string, any>;
  ip?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

export class AuditLogger {
  private static logDir = path.join(process.cwd(), 'logs', 'audit');
  
  /**
   * Initialize audit logger (create log directory)
   */
  static initialize() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }
  
  /**
   * Log an audit event
   */
  static async log(entry: AuditLogEntry): Promise<void> {
    try {
      const timestamp = new Date();
      
      // Log to database
      await prisma.auditLog.create({
        data: {
          action: entry.action,
          userId: entry.userId,
          executorId: entry.executorId,
          details: entry.details as any,
          ip: entry.ip,
          userAgent: entry.userAgent,
          success: entry.success,
          errorMessage: entry.errorMessage,
          timestamp,
        },
      }).catch(err => {
        console.error('Failed to save audit log to database:', err);
      });
      
      // Also log to file for backup
      const logLine = JSON.stringify({
        timestamp: timestamp.toISOString(),
        ...entry,
      }) + '\n';
      
      const filename = `audit-${timestamp.toISOString().split('T')[0]}.log`;
      const filepath = path.join(this.logDir, filename);
      
      fs.appendFileSync(filepath, logLine);
      
      // Log critical events to console
      if (this.isCritical(entry.action)) {
        console.warn('🚨 CRITICAL AUDIT EVENT:', entry.action, entry.details);
      }
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }
  
  /**
   * Log trade event
   */
  static async logTrade(
    action: AuditAction,
    userId: string,
    executorId: string,
    tradeDetails: any,
    success: boolean = true,
    errorMessage?: string
  ) {
    await this.log({
      action,
      userId,
      executorId,
      details: {
        trade: tradeDetails,
        timestamp: new Date().toISOString(),
      },
      success,
      errorMessage,
    });
  }
  
  /**
   * Log executor event
   */
  static async logExecutor(
    action: AuditAction,
    userId: string,
    executorId: string,
    details: any
  ) {
    await this.log({
      action,
      userId,
      executorId,
      details,
      success: true,
    });
  }
  
  /**
   * Log emergency event
   */
  static async logEmergency(
    action: AuditAction,
    userId: string,
    details: any
  ) {
    await this.log({
      action,
      userId,
      details: {
        ...details,
        severity: 'CRITICAL',
        timestamp: new Date().toISOString(),
      },
      success: true,
    });
    
    // Send alert (implement email/SMS notification here)
    console.error('🚨🚨🚨 EMERGENCY EVENT:', action, details);
  }
  
  /**
   * Check if action is critical
   */
  private static isCritical(action: AuditAction): boolean {
    return [
      AuditAction.EMERGENCY_STOP_TRIGGERED,
      AuditAction.POSITIONS_FORCE_CLOSED,
      AuditAction.UNAUTHORIZED_ACCESS,
      AuditAction.SYSTEM_ERROR,
    ].includes(action);
  }
  
  /**
   * Query audit logs
   */
  static async query(filters: {
    userId?: string;
    executorId?: string;
    action?: AuditAction;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    return prisma.auditLog.findMany({
      where: {
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.executorId && { executorId: filters.executorId }),
        ...(filters.action && { action: filters.action }),
        ...(filters.startDate && {
          timestamp: { gte: filters.startDate },
        }),
        ...(filters.endDate && {
          timestamp: { lte: filters.endDate },
        }),
      },
      orderBy: { timestamp: 'desc' },
      take: filters.limit || 100,
    });
  }
}

// Initialize on import
AuditLogger.initialize();
