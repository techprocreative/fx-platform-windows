import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { getClientIP } from './ip-whitelist';

const prisma = new PrismaClient();

// Audit event types
export enum AuditEventType {
  // Authentication events
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET = 'PASSWORD_RESET',
  TWO_FACTOR_ENABLED = 'TWO_FACTOR_ENABLED',
  TWO_FACTOR_DISABLED = 'TWO_FACTOR_DISABLED',
  TWO_FACTOR_VERIFICATION = 'TWO_FACTOR_VERIFICATION',
  TWO_FACTOR_BACKUP_CODE_USED = 'TWO_FACTOR_BACKUP_CODE_USED',
  
  // Trading events
  TRADE_OPEN = 'TRADE_OPEN',
  TRADE_CLOSE = 'TRADE_CLOSE',
  TRADE_MODIFY = 'TRADE_MODIFY',
  TRADE_CONFIRMATION = 'TRADE_CONFIRMATION',
  TRADE_CANCELLED = 'TRADE_CANCELLED',
  
  // Strategy events
  STRATEGY_CREATE = 'STRATEGY_CREATE',
  STRATEGY_UPDATE = 'STRATEGY_UPDATE',
  STRATEGY_DELETE = 'STRATEGY_DELETE',
  STRATEGY_ACTIVATE = 'STRATEGY_ACTIVATE',
  STRATEGY_DEACTIVATE = 'STRATEGY_DEACTIVATE',
  
  // API Key events
  API_KEY_CREATE = 'API_KEY_CREATE',
  API_KEY_UPDATE = 'API_KEY_UPDATE',
  API_KEY_DELETE = 'API_KEY_DELETE',
  API_KEY_USED = 'API_KEY_USED',
  
  // Executor events
  EXECUTOR_CREATE = 'EXECUTOR_CREATE',
  EXECUTOR_UPDATE = 'EXECUTOR_UPDATE',
  EXECUTOR_DELETE = 'EXECUTOR_DELETE',
  EXECUTOR_CONNECT = 'EXECUTOR_CONNECT',
  EXECUTOR_DISCONNECT = 'EXECUTOR_DISCONNECT',
  
  // Security events
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  IP_BLOCKED = 'IP_BLOCKED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  DATA_BREACH_ATTEMPT = 'DATA_BREACH_ATTEMPT',
  
  // System events
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  SYSTEM_MAINTENANCE = 'SYSTEM_MAINTENANCE',
  DATA_EXPORT = 'DATA_EXPORT',
  DATA_IMPORT = 'DATA_IMPORT',
  BACKUP_CREATED = 'BACKUP_CREATED',
  BACKUP_RESTORED = 'BACKUP_RESTORED',
}

// Audit log entry interface
export interface AuditLogEntry {
  userId?: string;
  eventType: AuditEventType;
  resource?: string;
  action?: string;
  result?: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

/**
 * Create an audit log entry
 * @param entry - Audit log entry
 * @returns Created audit log
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<any> {
  try {
    // Generate a tamper-proof hash of the log entry
    const hash = generateAuditHash(entry);
    
    // Create the audit log entry
    const createData: any = {
      eventType: entry.eventType,
      metadata: entry.metadata || {},
      hash,
    };
    
    if (entry.userId) createData.userId = entry.userId;
    if (entry.resource) createData.resource = entry.resource;
    if (entry.action) createData.action = entry.action;
    if (entry.result) createData.result = entry.result;
    if (entry.ipAddress) createData.ipAddress = entry.ipAddress;
    if (entry.userAgent) createData.userAgent = entry.userAgent;
    
    const auditLog = await prisma.auditLog.create({
      data: createData,
    });
    
    // Check if this is a critical security event that needs immediate attention
    if (isCriticalSecurityEvent(entry.eventType)) {
      await handleCriticalSecurityEvent(entry);
    }
    
    return auditLog;
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw here to avoid breaking the main application flow
    return null;
  }
}

/**
 * Create an audit log entry from a request object
 * @param entry - Audit log entry
 * @param req - Request object
 * @returns Created audit log
 */
export async function createAuditLogFromRequest(
  entry: AuditLogEntry,
  req: any
): Promise<any> {
  try {
    // Extract additional information from the request
    const ipAddress = getClientIP(req);
    const userAgent = req.headers['user-agent'];
    const sessionId = req.session?.id || req.cookies?.sessionId;
    
    return createAuditLog({
      ...entry,
      ipAddress,
      userAgent,
      sessionId,
    });
  } catch (error) {
    console.error('Error creating audit log from request:', error);
    return createAuditLog(entry);
  }
}

/**
 * Generate a tamper-proof hash for an audit log entry
 * @param entry - Audit log entry
 * @returns SHA-256 hash
 */
function generateAuditHash(entry: AuditLogEntry): string {
  try {
    // Create a canonical representation of the entry
    const canonical = JSON.stringify({
      userId: entry.userId || '',
      eventType: entry.eventType,
      resource: entry.resource || '',
      action: entry.action || '',
      result: entry.result || '',
      metadata: entry.metadata || {},
      ipAddress: entry.ipAddress || '',
      userAgent: entry.userAgent || '',
      timestamp: new Date().toISOString(),
    });
    
    // Generate SHA-256 hash
    return crypto.createHash('sha256').update(canonical).digest('hex');
  } catch (error) {
    console.error('Error generating audit hash:', error);
    return '';
  }
}

/**
 * Verify the integrity of an audit log entry
 * @param auditLog - Audit log entry to verify
 * @returns Whether the entry is valid
 */
export async function verifyAuditLogIntegrity(auditLog: any): Promise<boolean> {
  try {
    // Generate the expected hash
    const expectedHash = generateAuditHash({
      userId: auditLog.userId,
      eventType: auditLog.eventType,
      resource: auditLog.resource,
      action: auditLog.action,
      result: auditLog.result,
      metadata: auditLog.metadata,
      ipAddress: auditLog.ipAddress,
      userAgent: auditLog.userAgent,
    });
    
    // Compare with the stored hash
    return auditLog.hash === expectedHash;
  } catch (error) {
    console.error('Error verifying audit log integrity:', error);
    return false;
  }
}

/**
 * Check if an event type is a critical security event
 * @param eventType - Event type
 * @returns Whether it's a critical security event
 */
function isCriticalSecurityEvent(eventType: AuditEventType): boolean {
  const criticalEvents = [
    AuditEventType.SECURITY_VIOLATION,
    AuditEventType.DATA_BREACH_ATTEMPT,
    AuditEventType.SUSPICIOUS_ACTIVITY,
    AuditEventType.LOGIN_FAILED,
    AuditEventType.TWO_FACTOR_BACKUP_CODE_USED,
    AuditEventType.IP_BLOCKED,
  ];
  
  return criticalEvents.includes(eventType);
}

/**
 * Handle critical security events
 * @param entry - Audit log entry
 */
async function handleCriticalSecurityEvent(entry: AuditLogEntry): Promise<void> {
  try {
    // In a real implementation, you would:
    // 1. Send alerts to security team
    // 2. Trigger automated security responses
    // 3. Create security tickets
    // 4. Notify affected users
    
    console.warn('🚨 Critical security event detected:', {
      eventType: entry.eventType,
      userId: entry.userId,
      ipAddress: entry.ipAddress,
      timestamp: new Date().toISOString(),
    });
    
    // For now, we'll just log to console
    // In production, you would integrate with your security monitoring system
  } catch (error) {
    console.error('Error handling critical security event:', error);
  }
}

/**
 * Get audit logs for a user
 * @param userId - User ID
 * @param limit - Maximum number of logs to retrieve
 * @param offset - Offset for pagination
 * @returns Array of audit logs
 */
export async function getUserAuditLogs(
  userId: string,
  limit: number = 100,
  offset: number = 0
): Promise<any[]> {
  try {
    return await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    });
  } catch (error) {
    console.error('Error getting user audit logs:', error);
    return [];
  }
}

/**
 * Get audit logs by event type
 * @param eventType - Event type
 * @param limit - Maximum number of logs to retrieve
 * @param offset - Offset for pagination
 * @returns Array of audit logs
 */
export async function getAuditLogsByEventType(
  eventType: AuditEventType,
  limit: number = 100,
  offset: number = 0
): Promise<any[]> {
  try {
    return await prisma.auditLog.findMany({
      where: { eventType },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    });
  } catch (error) {
    console.error('Error getting audit logs by event type:', error);
    return [];
  }
}

/**
 * Get audit logs by date range
 * @param startDate - Start date
 * @param endDate - End date
 * @param limit - Maximum number of logs to retrieve
 * @param offset - Offset for pagination
 * @returns Array of audit logs
 */
export async function getAuditLogsByDateRange(
  startDate: Date,
  endDate: Date,
  limit: number = 100,
  offset: number = 0
): Promise<any[]> {
  try {
    return await prisma.auditLog.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    });
  } catch (error) {
    console.error('Error getting audit logs by date range:', error);
    return [];
  }
}

/**
 * Get security events
 * @param limit - Maximum number of logs to retrieve
 * @param offset - Offset for pagination
 * @returns Array of security events
 */
export async function getSecurityEvents(
  limit: number = 100,
  offset: number = 0
): Promise<any[]> {
  try {
    const securityEventTypes = [
      AuditEventType.SECURITY_VIOLATION,
      AuditEventType.RATE_LIMIT_EXCEEDED,
      AuditEventType.IP_BLOCKED,
      AuditEventType.SUSPICIOUS_ACTIVITY,
      AuditEventType.DATA_BREACH_ATTEMPT,
      AuditEventType.LOGIN_FAILED,
    ];
    
    return await prisma.auditLog.findMany({
      where: {
        eventType: { in: securityEventTypes },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    });
  } catch (error) {
    console.error('Error getting security events:', error);
    return [];
  }
}

/**
 * Search audit logs
 * @param query - Search query
 * @param filters - Additional filters
 * @param limit - Maximum number of logs to retrieve
 * @param offset - Offset for pagination
 * @returns Array of audit logs
 */
export async function searchAuditLogs(
  query: string,
  filters: {
    userId?: string;
    eventType?: AuditEventType;
    startDate?: Date;
    endDate?: Date;
  } = {},
  limit: number = 100,
  offset: number = 0
): Promise<any[]> {
  try {
    const where: any = {};
    
    // Add filters
    if (filters.userId) {
      where.userId = filters.userId;
    }
    
    if (filters.eventType) {
      where.eventType = filters.eventType;
    }
    
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) {
        where.timestamp.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.timestamp.lte = filters.endDate;
      }
    }
    
    // Add text search for metadata
    if (query) {
      where.OR = [
        { resource: { contains: query, mode: 'insensitive' } },
        { action: { contains: query, mode: 'insensitive' } },
        { result: { contains: query, mode: 'insensitive' } },
        { ipAddress: { contains: query, mode: 'insensitive' } },
      ];
    }
    
    return await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    });
  } catch (error) {
    console.error('Error searching audit logs:', error);
    return [];
  }
}

/**
 * Export audit logs to CSV
 * @param filters - Filters to apply
 * @returns CSV string
 */
export async function exportAuditLogsToCSV(
  filters: {
    userId?: string;
    eventType?: AuditEventType;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<string> {
  try {
    const logs = await searchAuditLogs('', filters, 10000);
    
    // Create CSV header
    const headers = [
      'ID',
      'User ID',
      'Event Type',
      'Resource',
      'Action',
      'Result',
      'IP Address',
      'User Agent',
      'Timestamp',
      'Metadata',
    ];
    
    // Create CSV rows
    const rows = logs.map(log => [
      log.id,
      log.userId || '',
      log.eventType,
      log.resource || '',
      log.action || '',
      log.result || '',
      log.ipAddress || '',
      log.userAgent || '',
      log.timestamp.toISOString(),
      JSON.stringify(log.metadata || {}),
    ]);
    
    // Combine header and rows
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    return csvContent;
  } catch (error) {
    console.error('Error exporting audit logs to CSV:', error);
    return '';
  }
}

/**
 * Clean up old audit logs
 * @param daysToKeep - Number of days to keep logs
 * @returns Number of deleted logs
 */
export async function cleanupOldAuditLogs(daysToKeep: number = 365): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const result = await prisma.auditLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });
    
    return result.count;
  } catch (error) {
    console.error('Error cleaning up old audit logs:', error);
    return 0;
  }
}

export default {
  createAuditLog,
  createAuditLogFromRequest,
  verifyAuditLogIntegrity,
  getUserAuditLogs,
  getAuditLogsByEventType,
  getAuditLogsByDateRange,
  getSecurityEvents,
  searchAuditLogs,
  exportAuditLogsToCSV,
  cleanupOldAuditLogs,
  AuditEventType,
};