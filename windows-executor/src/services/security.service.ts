import { 
  SecurityConfig, 
  SecurityEvent, 
  CredentialStorage, 
  SecuritySession,
  RateLimitEntry,
  SecurityAuditLog
} from '../types/security.types';
import { createLogger } from '../utils/logger';
import { CryptoUtils, SecureStorage } from '../utils/crypto';
import { DatabaseManager } from '../database/manager';
import { EventEmitter } from 'events';

const logger = createLogger('security');

export class SecurityService extends EventEmitter {
  private config: SecurityConfig;
  private db: DatabaseManager;
  private secureStorage: SecureStorage;
  private activeSessions: Map<string, SecuritySession> = new Map();
  private rateLimitMap: Map<string, RateLimitEntry> = new Map();
  private failedLoginAttempts: Map<string, number> = new Map();
  private isInitialized: boolean = false;

  constructor(db: DatabaseManager, encryptionKey: string) {
    super();
    this.db = db;
    this.secureStorage = new SecureStorage(encryptionKey);
    this.config = this.getDefaultConfig();
  }

  private getDefaultConfig(): SecurityConfig {
    return {
      encryptionKey: CryptoUtils.generateKey(),
      sessionTimeout: 60, // 60 minutes
      maxLoginAttempts: 5,
      ipWhitelist: [], // Empty means no IP restrictions
      rateLimits: {
        apiCallsPerMinute: 60,
        tradesPerMinute: 10,
        commandsPerSecond: 5,
      },
    };
  }

  /**
   * Initialize security service
   */
  async initialize(): Promise<boolean> {
    try {
      logger.info('Initializing security service');
      
      // Load configuration from database
      await this.loadConfiguration();
      
      // Clean up expired sessions
      await this.cleanupExpiredSessions();
      
      // Start session cleanup interval
      this.startSessionCleanup();
      
      // Start rate limit cleanup
      this.startRateLimitCleanup();
      
      this.isInitialized = true;
      logger.info('Security service initialized successfully');
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize security service', { error });
      return false;
    }
  }

  /**
   * Store credentials securely
   */
  async storeCredentials(credentials: CredentialStorage): Promise<boolean> {
    try {
      logger.info('Storing encrypted credentials');
      
      // Encrypt sensitive data
      const encryptedSecret = CryptoUtils.encrypt(credentials.apiSecret, this.config.encryptionKey);
      
      if (!encryptedSecret.success || !encryptedSecret.data || !encryptedSecret.iv || !encryptedSecret.tag) {
        throw new Error('Failed to encrypt API secret');
      }
      
      const encryptedCredentials: CredentialStorage = {
        ...credentials,
        apiSecret: JSON.stringify({
          data: encryptedSecret.data,
          iv: encryptedSecret.iv,
          tag: encryptedSecret.tag,
        }),
        encrypted: true,
        lastUpdated: new Date(),
      };
      
      // Store in secure storage
      const success = this.secureStorage.set('credentials', JSON.stringify(encryptedCredentials));
      
      if (success) {
        await this.logSecurityEvent('LOGIN', 'MEDIUM', 'Credentials stored securely');
        logger.info('Credentials stored successfully');
      }
      
      return success;
    } catch (error) {
      logger.error('Failed to store credentials', { error });
      await this.logSecurityEvent('SECURITY_BREACH', 'HIGH', `Failed to store credentials: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Retrieve credentials securely
   */
  async getCredentials(): Promise<CredentialStorage | null> {
    try {
      const encryptedData = this.secureStorage.get('credentials');
      
      if (!encryptedData) {
        logger.warn('No credentials found in secure storage');
        return null;
      }
      
      const credentials: CredentialStorage = JSON.parse(encryptedData);
      
      if (!credentials.encrypted) {
        logger.warn('Credentials are not encrypted');
        return credentials;
      }
      
      // Decrypt API secret
      const secretData = JSON.parse(credentials.apiSecret);
      const decryptedSecret = CryptoUtils.decrypt(
        secretData.data,
        this.config.encryptionKey,
        secretData.iv,
        secretData.tag
      );
      
      if (!decryptedSecret.success || !decryptedSecret.data) {
        throw new Error('Failed to decrypt API secret');
      }
      
      credentials.apiSecret = decryptedSecret.data;
      
      logger.info('Credentials retrieved successfully');
      return credentials;
    } catch (error) {
      logger.error('Failed to retrieve credentials', { error });
      await this.logSecurityEvent('SECURITY_BREACH', 'HIGH', `Failed to retrieve credentials: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Create security session
   */
  async createSession(userId?: string, ipAddress?: string, userAgent?: string): Promise<SecuritySession> {
    try {
      const sessionId = CryptoUtils.generateUUID();
      const now = new Date();
      
      const session: SecuritySession = {
        id: sessionId,
        userId,
        startTime: now,
        lastActivity: now,
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        isActive: true,
        permissions: this.getDefaultPermissions(userId),
      };
      
      // Store in memory
      this.activeSessions.set(sessionId, session);
      
      // Store in database
      await this.db.saveSecuritySession(session);
      
      await this.logSecurityEvent('LOGIN', 'MEDIUM', `Session created for user: ${userId || 'anonymous'}`, {
        sessionId,
        ipAddress,
      });
      
      logger.info('Security session created', { sessionId, userId });
      
      return session;
    } catch (error) {
      logger.error('Failed to create session', { error });
      throw error;
    }
  }

  /**
   * Validate session
   */
  async validateSession(sessionId: string): Promise<boolean> {
    try {
      // Check memory first
      let session = this.activeSessions.get(sessionId);
      
      if (!session) {
        // Check database
        session = await this.db.getSecuritySession(sessionId);
        
        if (session) {
          this.activeSessions.set(sessionId, session);
        }
      }
      
      if (!session) {
        logger.warn('Session not found', { sessionId });
        return false;
      }
      
      // Check if session is active
      if (!session.isActive) {
        logger.warn('Session is inactive', { sessionId });
        return false;
      }
      
      // Check session timeout
      const now = new Date();
      const sessionAge = (now.getTime() - session.lastActivity.getTime()) / (1000 * 60); // minutes
      
      if (sessionAge > this.config.sessionTimeout) {
        logger.warn('Session expired', { sessionId, sessionAge });
        await this.invalidateSession(sessionId);
        return false;
      }
      
      // Update last activity
      session.lastActivity = now;
      await this.db.saveSecuritySession(session);
      
      return true;
    } catch (error) {
      logger.error('Failed to validate session', { error, sessionId });
      return false;
    }
  }

  /**
   * Invalidate session
   */
  async invalidateSession(sessionId: string): Promise<boolean> {
    try {
      const session = this.activeSessions.get(sessionId);
      
      if (session) {
        session.isActive = false;
        await this.db.saveSecuritySession(session);
        this.activeSessions.delete(sessionId);
        
        await this.logSecurityEvent('LOGOUT', 'MEDIUM', `Session invalidated: ${sessionId}`);
        logger.info('Session invalidated', { sessionId });
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Failed to invalidate session', { error, sessionId });
      return false;
    }
  }

  /**
   * Check rate limit
   */
  async checkRateLimit(key: string, maxRequests: number, windowSizeMs: number): Promise<boolean> {
    try {
      const now = new Date();
      let entry = this.rateLimitMap.get(key);
      
      if (!entry) {
        // Create new entry
        entry = {
          key,
          count: 1,
          windowStart: now,
          maxRequests,
          windowSizeMs,
        };
        
        this.rateLimitMap.set(key, entry);
        await this.db.saveRateLimitEntry(entry);
        
        return true;
      }
      
      // Check if window has expired
      const windowElapsed = now.getTime() - entry.windowStart.getTime();
      
      if (windowElapsed > entry.windowSizeMs) {
        // Reset window
        entry.count = 1;
        entry.windowStart = now;
        await this.db.saveRateLimitEntry(entry);
        
        return true;
      }
      
      // Check if limit exceeded
      if (entry.count >= entry.maxRequests) {
        await this.logSecurityEvent('RATE_LIMIT', 'MEDIUM', `Rate limit exceeded for key: ${key}`, {
          key,
          count: entry.count,
          maxRequests: entry.maxRequests,
        });
        
        return false;
      }
      
      // Increment count
      entry.count++;
      await this.db.saveRateLimitEntry(entry);
      
      return true;
    } catch (error) {
      logger.error('Failed to check rate limit', { error, key });
      return false;
    }
  }

  /**
   * Validate API key
   */
  async validateApiKey(apiKey: string, apiSecret: string): Promise<boolean> {
    try {
      const credentials = await this.getCredentials();
      
      if (!credentials) {
        logger.warn('No credentials found for validation');
        return false;
      }
      
      // Use constant-time comparison to prevent timing attacks
      const apiKeyValid = CryptoUtils.constantTimeCompare(credentials.apiKey, apiKey);
      const apiSecretValid = CryptoUtils.constantTimeCompare(credentials.apiSecret, apiSecret);
      
      if (apiKeyValid && apiSecretValid) {
        logger.info('API credentials validated successfully');
        return true;
      } else {
        await this.logSecurityEvent('UNAUTHORIZED_ACCESS', 'HIGH', 'Invalid API credentials provided');
        logger.warn('Invalid API credentials provided');
        return false;
      }
    } catch (error) {
      logger.error('Failed to validate API credentials', { error });
      return false;
    }
  }

  /**
   * Check IP whitelist
   */
  isIPAllowed(ipAddress: string): boolean {
    try {
      // If whitelist is empty, allow all IPs
      if (this.config.ipWhitelist.length === 0) {
        return true;
      }
      
      // Check if IP is in whitelist
      return this.config.ipWhitelist.includes(ipAddress);
    } catch (error) {
      logger.error('Failed to check IP whitelist', { error, ipAddress });
      return false;
    }
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    type: string, 
    severity: string, 
    message: string, 
    details?: any
  ): Promise<void> {
    try {
      const event: SecurityEvent = {
        id: CryptoUtils.generateUUID(),
        type: type as any,
        timestamp: new Date(),
        severity: severity as any,
        message,
        details,
      };
      
      await this.db.saveSecurityEvent(event);
      
      // Emit security event for real-time monitoring
      this.emit('securityEvent', event);
      
      logger.security(message, severity, { type, details });
    } catch (error) {
      logger.error('Failed to log security event', { error });
    }
  }

  /**
   * Log audit trail
   */
  async logAuditLog(log: {
    action: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    resource: string;
    result: 'SUCCESS' | 'FAILURE';
    details?: any;
  }): Promise<void> {
    try {
      const auditLog: SecurityAuditLog = {
        id: CryptoUtils.generateUUID(),
        timestamp: new Date(),
        ...log,
      };
      
      await this.db.saveAuditLog(auditLog);
      
      logger.audit(log.action, log.userId, {
        resource: log.resource,
        result: log.result,
        ipAddress: log.ipAddress,
        details: log.details,
      });
    } catch (error) {
      logger.error('Failed to log audit trail', { error });
    }
  }

  /**
   * Update security configuration
   */
  async updateConfig(newConfig: Partial<SecurityConfig>): Promise<boolean> {
    try {
      this.config = { ...this.config, ...newConfig };
      
      // Save to database
      await this.db.saveConfig('securityConfig', this.config);
      
      logger.info('Security configuration updated', { newConfig });
      this.emit('configUpdated', { config: this.config });
      
      return true;
    } catch (error) {
      logger.error('Failed to update security configuration', { error });
      return false;
    }
  }

  /**
   * Get current security configuration
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): SecuritySession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Check if service is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Load configuration from database
   */
  private async loadConfiguration(): Promise<void> {
    try {
      const savedConfig = await this.db.getConfig('securityConfig');
      
      if (savedConfig) {
        this.config = { ...this.config, ...savedConfig };
        logger.info('Security configuration loaded from database');
      }
    } catch (error) {
      logger.error('Failed to load security configuration', { error });
    }
  }

  /**
   * Get default permissions for user
   */
  private getDefaultPermissions(userId?: string): string[] {
    if (!userId) {
      return ['read'];
    }
    
    // In a real implementation, this would check user roles
    return ['read', 'write', 'trade'];
  }

  /**
   * Clean up expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    try {
      const now = new Date();
      const expiredSessions: string[] = [];
      
      for (const [sessionId, session] of this.activeSessions.entries()) {
        const sessionAge = (now.getTime() - session.lastActivity.getTime()) / (1000 * 60);
        
        if (sessionAge > this.config.sessionTimeout) {
          expiredSessions.push(sessionId);
        }
      }
      
      for (const sessionId of expiredSessions) {
        await this.invalidateSession(sessionId);
      }
      
      if (expiredSessions.length > 0) {
        logger.info('Cleaned up expired sessions', { count: expiredSessions.length });
      }
    } catch (error) {
      logger.error('Failed to cleanup expired sessions', { error });
    }
  }

  /**
   * Start session cleanup interval
   */
  private startSessionCleanup(): void {
    // Run cleanup every 5 minutes
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000);
  }

  /**
   * Start rate limit cleanup
   */
  private startRateLimitCleanup(): void {
    // Run cleanup every minute
    setInterval(() => {
      const now = new Date();
      const expiredKeys: string[] = [];
      
      for (const [key, entry] of this.rateLimitMap.entries()) {
        const windowElapsed = now.getTime() - entry.windowStart.getTime();
        
        if (windowElapsed > entry.windowSizeMs * 2) { // Keep for 2x window time
          expiredKeys.push(key);
        }
      }
      
      for (const key of expiredKeys) {
        this.rateLimitMap.delete(key);
      }
    }, 60 * 1000);
  }
}

export default SecurityService;