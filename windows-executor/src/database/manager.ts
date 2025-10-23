import { 
  DatabaseConfig, 
  SecurityEvent, 
  LogEntry, 
  PerformanceMetrics,
  RateLimitEntry,
  SecuritySession,
  SafetyLimits,
  CredentialStorage
} from '../types/security.types';
import { createLogger } from '../utils/logger';
import { CryptoUtils } from '../utils/crypto';

const logger = createLogger('database');

export class DatabaseManager {
  private db: any = null; // SQLite database instance
  private config: DatabaseConfig;
  private encryptionKey: string;
  private isInitialized: boolean = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.encryptionKey = config.encryptionKey;
  }

  /**
   * Initialize database with encryption
   */
  async initialize(): Promise<boolean> {
    try {
      logger.info('Initializing encrypted database');
      
      // In a real implementation, this would use SQLCipher
      // For now, we'll simulate with a mock implementation
      this.db = {
        data: new Map<string, any>(),
        prepare: (query: string) => ({
          run: (params?: any) => this.mockExecute(query, params),
          get: (params?: any) => this.mockGet(query, params),
          all: (params?: any) => this.mockAll(query, params),
        }),
        exec: (query: string) => this.mockExecute(query),
      };

      // Create tables
      await this.createTables();
      
      // Load initial data
      await this.loadInitialData();
      
      this.isInitialized = true;
      logger.info('Database initialized successfully');
      
      // Schedule backups if enabled
      if (this.config.backupEnabled) {
        this.scheduleBackups();
      }
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize database', { error });
      return false;
    }
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    const tables = [
      // Security events table
      `CREATE TABLE IF NOT EXISTS security_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        severity TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        resolved BOOLEAN DEFAULT FALSE,
        resolved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Logs table
      `CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        timestamp DATETIME NOT NULL,
        level TEXT NOT NULL,
        category TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata TEXT,
        stack_trace TEXT,
        user_id TEXT,
        session_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Performance metrics table
      `CREATE TABLE IF NOT EXISTS performance_metrics (
        id TEXT PRIMARY KEY,
        command_id TEXT NOT NULL,
        command_type TEXT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        duration INTEGER,
        success BOOLEAN NOT NULL,
        error TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Rate limiting table
      `CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        window_start DATETIME NOT NULL,
        max_requests INTEGER NOT NULL,
        window_size_ms INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Security sessions table
      `CREATE TABLE IF NOT EXISTS security_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        start_time DATETIME NOT NULL,
        last_activity DATETIME NOT NULL,
        ip_address TEXT NOT NULL,
        user_agent TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        permissions TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Configuration table
      `CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        encrypted BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Audit logs table
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp DATETIME NOT NULL,
        action TEXT NOT NULL,
        user_id TEXT,
        ip_address TEXT,
        user_agent TEXT,
        resource TEXT NOT NULL,
        result TEXT NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    ];

    for (const table of tables) {
      this.db.exec(table);
    }

    logger.info('Database tables created');
  }

  /**
   * Load initial data
   */
  private async loadInitialData(): Promise<void> {
    try {
      // Load default safety limits
      const defaultLimits: SafetyLimits = {
        maxDailyLoss: 500,
        maxPositions: 10,
        maxLotSize: 1.0,
        maxDrawdownPercent: 20,
        maxHourlyTrades: 20,
        maxRiskPerTrade: 2,
        maxSpreadPoints: 5,
        minAccountBalance: 1000,
      };
      
      await this.saveConfig('safetyLimits', defaultLimits);
      
      logger.info('Initial data loaded');
    } catch (error) {
      logger.error('Failed to load initial data', { error });
    }
  }

  /**
   * Save security event
   */
  async saveSecurityEvent(event: SecurityEvent): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO security_events 
        (id, type, timestamp, severity, message, details, resolved, resolved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        event.id,
        event.type,
        event.timestamp.toISOString(),
        event.severity,
        event.message,
        event.details ? JSON.stringify(event.details) : null,
        event.resolved || false,
        event.resolvedAt ? event.resolvedAt.toISOString() : null,
      ]);
      
      logger.debug('Security event saved', { eventId: event.id });
      return true;
    } catch (error) {
      logger.error('Failed to save security event', { error, event });
      return false;
    }
  }

  /**
   * Save log entry
   */
  async saveLogEntry(entry: LogEntry): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO logs 
        (id, timestamp, level, category, message, metadata, stack_trace, user_id, session_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        entry.id,
        entry.timestamp.toISOString(),
        entry.level,
        entry.category,
        entry.message,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.stackTrace || null,
        entry.userId || null,
        entry.sessionId || null,
      ]);
      
      return true;
    } catch (error) {
      logger.error('Failed to save log entry', { error, entry });
      return false;
    }
  }

  /**
   * Save performance metrics
   */
  async savePerformanceMetrics(metrics: PerformanceMetrics): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO performance_metrics 
        (id, command_id, command_type, start_time, end_time, duration, success, error, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        metrics.id,
        metrics.commandId,
        metrics.commandType,
        metrics.startTime.toISOString(),
        metrics.endTime ? metrics.endTime.toISOString() : null,
        metrics.duration || null,
        metrics.success,
        metrics.error || null,
        metrics.metadata ? JSON.stringify(metrics.metadata) : null,
      ]);
      
      return true;
    } catch (error) {
      logger.error('Failed to save performance metrics', { error, metrics });
      return false;
    }
  }

  /**
   * Save configuration
   */
  async saveConfig(key: string, value: any, encrypted: boolean = false): Promise<boolean> {
    try {
      let dataToStore = JSON.stringify(value);
      
      if (encrypted) {
        const encryptedData = CryptoUtils.encrypt(dataToStore, this.encryptionKey);
        if (encryptedData.success && encryptedData.data && encryptedData.iv && encryptedData.tag) {
          dataToStore = JSON.stringify({
            data: encryptedData.data,
            iv: encryptedData.iv,
            tag: encryptedData.tag,
          });
        } else {
          throw new Error('Failed to encrypt configuration data');
        }
      }
      
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO config (key, value, encrypted, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      stmt.run([key, dataToStore, encrypted]);
      
      logger.debug('Configuration saved', { key, encrypted });
      return true;
    } catch (error) {
      logger.error('Failed to save configuration', { error, key });
      return false;
    }
  }

  /**
   * Get configuration
   */
  async getConfig(key: string): Promise<any> {
    try {
      const stmt = this.db.prepare('SELECT value, encrypted FROM config WHERE key = ?');
      const result = stmt.get([key]);
      
      if (!result) {
        return null;
      }
      
      let dataToParse = result.value;
      
      if (result.encrypted) {
        const encryptedData = JSON.parse(dataToParse);
        const decryptedData = CryptoUtils.decrypt(
          encryptedData.data,
          this.encryptionKey,
          encryptedData.iv,
          encryptedData.tag
        );
        
        if (decryptedData.success && decryptedData.data) {
          dataToParse = decryptedData.data;
        } else {
          throw new Error('Failed to decrypt configuration data');
        }
      }
      
      return JSON.parse(dataToParse);
    } catch (error) {
      logger.error('Failed to get configuration', { error, key });
      return null;
    }
  }

  /**
   * Save rate limit entry
   */
  async saveRateLimitEntry(entry: RateLimitEntry): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO rate_limits 
        (key, count, window_start, max_requests, window_size_ms, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      stmt.run([
        entry.key,
        entry.count,
        entry.windowStart.toISOString(),
        entry.maxRequests,
        entry.windowSizeMs,
      ]);
      
      return true;
    } catch (error) {
      logger.error('Failed to save rate limit entry', { error, entry });
      return false;
    }
  }

  /**
   * Get rate limit entry
   */
  async getRateLimitEntry(key: string): Promise<RateLimitEntry | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM rate_limits WHERE key = ?');
      const result = stmt.get([key]);
      
      if (!result) {
        return null;
      }
      
      return {
        key: result.key,
        count: result.count,
        windowStart: new Date(result.window_start),
        maxRequests: result.max_requests,
        windowSizeMs: result.window_size_ms,
      };
    } catch (error) {
      logger.error('Failed to get rate limit entry', { error, key });
      return null;
    }
  }

  /**
   * Save security session
   */
  async saveSecuritySession(session: SecuritySession): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO security_sessions 
        (id, user_id, start_time, last_activity, ip_address, user_agent, is_active, permissions, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      stmt.run([
        session.id,
        session.userId || null,
        session.startTime.toISOString(),
        session.lastActivity.toISOString(),
        session.ipAddress,
        session.userAgent || null,
        session.isActive,
        JSON.stringify(session.permissions),
      ]);
      
      return true;
    } catch (error) {
      logger.error('Failed to save security session', { error, session });
      return false;
    }
  }

  /**
   * Get security session
   */
  async getSecuritySession(sessionId: string): Promise<SecuritySession | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM security_sessions WHERE id = ?');
      const result = stmt.get([sessionId]);
      
      if (!result) {
        return null;
      }
      
      return {
        id: result.id,
        userId: result.user_id,
        startTime: new Date(result.start_time),
        lastActivity: new Date(result.last_activity),
        ipAddress: result.ip_address,
        userAgent: result.user_agent,
        isActive: result.is_active,
        permissions: JSON.parse(result.permissions || '[]'),
      };
    } catch (error) {
      logger.error('Failed to get security session', { error, sessionId });
      return null;
    }
  }

  /**
   * Save audit log
   */
  async saveAuditLog(log: {
    id: string;
    timestamp: Date;
    action: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    resource: string;
    result: 'SUCCESS' | 'FAILURE';
    details?: any;
  }): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO audit_logs 
        (id, timestamp, action, user_id, ip_address, user_agent, resource, result, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        log.id,
        log.timestamp.toISOString(),
        log.action,
        log.userId || null,
        log.ipAddress || null,
        log.userAgent || null,
        log.resource,
        log.result,
        log.details ? JSON.stringify(log.details) : null,
      ]);
      
      return true;
    } catch (error) {
      logger.error('Failed to save audit log', { error, log });
      return false;
    }
  }

  /**
   * Clean up old records
   */
  async cleanupOldRecords(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffString = cutoffDate.toISOString();
      
      const tables = [
        'security_events',
        'logs',
        'performance_metrics',
        'audit_logs',
      ];
      
      for (const table of tables) {
        const stmt = this.db.prepare(`DELETE FROM ${table} WHERE timestamp < ?`);
        const result = stmt.run([cutoffString]);
        
        if (result.changes > 0) {
          logger.info(`Cleaned up old records from ${table}`, { 
            deletedCount: result.changes,
            cutoffDate: cutoffString,
          });
        }
      }
      
      logger.info('Database cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup old records', { error });
    }
  }

  /**
   * Backup database
   */
  async backup(): Promise<boolean> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${this.config.path}.backup.${timestamp}`;
      
      // In a real implementation, this would create an encrypted backup
      // For now, we'll simulate the backup process
      logger.info('Creating database backup', { backupPath });
      
      // Simulate backup process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      logger.info('Database backup completed', { backupPath });
      return true;
    } catch (error) {
      logger.error('Failed to backup database', { error });
      return false;
    }
  }

  /**
   * Schedule automatic backups
   */
  private scheduleBackups(): void {
    const scheduleNextBackup = () => {
      const now = new Date();
      const nextBackup = new Date(now);
      nextBackup.setHours(nextBackup.getHours() + this.config.backupInterval);
      
      const msUntilNextBackup = nextBackup.getTime() - now.getTime();
      
      setTimeout(async () => {
        await this.backup();
        scheduleNextBackup();
      }, msUntilNextBackup);
    };
    
    scheduleNextBackup();
    logger.info('Database backup scheduler started', { interval: `${this.config.backupInterval} hours` });
  }

  /**
   * Mock database execution (for development)
   */
  private mockExecute(query: string, params?: any): any {
    logger.debug('Mock execute', { query, params });
    return { changes: 1, lastInsertRowid: Date.now() };
  }

  /**
   * Mock database get (for development)
   */
  private mockGet(query: string, params?: any): any {
    logger.debug('Mock get', { query, params });
    return null;
  }

  /**
   * Mock database all (for development)
   */
  private mockAll(query: string, params?: any): any[] {
    logger.debug('Mock all', { query, params });
    return [];
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    try {
      if (this.db) {
        // In a real implementation, this would close the database connection
        this.db = null;
        this.isInitialized = false;
        logger.info('Database connection closed');
      }
    } catch (error) {
      logger.error('Failed to close database connection', { error });
    }
  }

  /**
   * Check if database is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<Record<string, any>> {
    try {
      const tables = [
        'security_events',
        'logs',
        'performance_metrics',
        'rate_limits',
        'security_sessions',
        'config',
        'audit_logs',
      ];
      
      const stats: Record<string, any> = {};
      
      for (const table of tables) {
        const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`);
        const result = stmt.get();
        stats[table] = result.count;
      }
      
      return stats;
    } catch (error) {
      logger.error('Failed to get database stats', { error });
      return {};
    }
  }
}

export default DatabaseManager;