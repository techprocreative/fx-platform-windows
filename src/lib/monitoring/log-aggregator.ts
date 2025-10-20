/**
 * Comprehensive Log Aggregation and Analysis System
 * 
 * This module provides advanced log management capabilities:
 * - Structured logging format
 * - Log level management
 * - Log retention policies
 * - Search and filter capabilities
 * - Log-based alerting
 * - Compliance logging
 */

import { captureEnhancedError, addBreadcrumb, ErrorCategory } from './sentry';

// Log levels
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5
}

// Log entry interface
export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  
  // Context information
  context: {
    service?: string;
    version?: string;
    environment?: string;
    userId?: string;
    sessionId?: string;
    requestId?: string;
    correlationId?: string;
    ip?: string;
    userAgent?: string;
    route?: string;
    method?: string;
    statusCode?: number;
    duration?: number;
  };
  
  // Structured data
  data?: Record<string, any>;
  
  // Error information
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  
  // Stack trace
  stack?: string;
  
  // Source information
  source: {
    file?: string;
    line?: number;
    function?: string;
    column?: number;
  };
  
  // Tags
  tags: string[];
  
  // Metadata
  metadata?: Record<string, any>;
}

// Log retention policy interface
export interface LogRetentionPolicy {
  level: LogLevel;
  retentionDays: number;
  maxSize?: number; // MB
  compressionEnabled: boolean;
  archiveEnabled: boolean;
  archiveLocation?: string;
}

// Log filter interface
export interface LogFilter {
  levels?: LogLevel[];
  services?: string[];
  users?: string[];
  sessions?: string[];
  timeRange?: {
    start: Date;
    end: Date;
  };
  message?: string;
  tags?: string[];
  data?: Record<string, any>;
  context?: Record<string, any>;
}

// Log aggregation statistics interface
export interface LogAggregationStats {
  period: 'hour' | 'day' | 'week' | 'month';
  timestamp: Date;
  
  // Volume metrics
  totalLogs: number;
  logsByLevel: Record<LogLevel, number>;
  logsByService: Record<string, number>;
  logsByUser: Record<string, number>;
  
  // Error metrics
  errorRate: number;
  topErrors: Array<{
    message: string;
    count: number;
    level: LogLevel;
    service?: string;
  }>;
  
  // Performance metrics
  averageResponseTime: number;
  slowestRequests: Array<{
    route: string;
    method: string;
    duration: number;
    timestamp: Date;
  }>;
  
  // Compliance metrics
  complianceViolations: number;
  retentionPolicyViolations: number;
}

// Log-based alert rule interface
export interface LogAlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  
  // Rule configuration
  filter: LogFilter;
  condition: 'count' | 'rate' | 'pattern';
  threshold: number;
  timeWindow: number; // seconds
  
  // Alert configuration
  severity: 'info' | 'warning' | 'error' | 'critical';
  notificationChannels: string[];
  
  // Schedule
  schedule?: {
    timezone: string;
    activeHours: { start: string; end: string }[];
    activeDays: number[];
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export class LogAggregator {
  private static instance: LogAggregator;
  private logs: LogEntry[] = [];
  private retentionPolicies: Map<LogLevel, LogRetentionPolicy> = new Map();
  private alertRules: Map<string, LogAlertRule> = new Map();
  private stats: LogAggregationStats[] = [];
  private maxLogSize: number = 100000;
  private isAggregating: boolean = false;
  private aggregationInterval?: NodeJS.Timeout;
  
  private constructor() {
    this.setupDefaultRetentionPolicies();
    this.setupDefaultAlertRules();
  }
  
  static getInstance(): LogAggregator {
    if (!LogAggregator.instance) {
      LogAggregator.instance = new LogAggregator();
    }
    return LogAggregator.instance;
  }
  
  /**
   * Start log aggregation
   */
  startAggregation(): void {
    if (this.isAggregating) return;
    
    this.isAggregating = true;
    this.startAggregationLoop();
    
    addBreadcrumb(
      'Log aggregation started',
      'log_aggregator',
      'info'
    );
  }
  
  /**
   * Stop log aggregation
   */
  stopAggregation(): void {
    this.isAggregating = false;
    
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
      this.aggregationInterval = undefined;
    }
    
    addBreadcrumb(
      'Log aggregation stopped',
      'log_aggregator',
      'info'
    );
  }
  
  /**
   * Log a message
   */
  log(
    level: LogLevel,
    message: string,
    context: Partial<LogEntry['context']> = {},
    data?: Record<string, any>,
    error?: Error,
    source?: Partial<LogEntry['source']>,
    tags: string[] = []
  ): void {
    const logEntry: LogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      level,
      message,
      context: {
        service: process.env.SERVICE_NAME || 'fx-platform',
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        ...context
      },
      data,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      } : undefined,
      stack: error?.stack,
      source: {
        file: source?.file,
        line: source?.line,
        function: source?.function,
        column: source?.column
      },
      tags
    };
    
    this.addLog(logEntry);
  }
  
  /**
   * Convenience methods for different log levels
   */
  trace(message: string, context?: Partial<LogEntry['context']>, data?: Record<string, any>): void {
    this.log(LogLevel.TRACE, message, context, data);
  }
  
  debug(message: string, context?: Partial<LogEntry['context']>, data?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context, data);
  }
  
  info(message: string, context?: Partial<LogEntry['context']>, data?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context, data);
  }
  
  warn(message: string, context?: Partial<LogEntry['context']>, data?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context, data);
  }
  
  error(message: string, error?: Error, context?: Partial<LogEntry['context']>, data?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context, data, error);
    
    // Send to Sentry for error tracking
    captureEnhancedError(
      error || new Error(message),
      {
        component: context?.service || 'LogAggregator',
        action: 'log_error',
        route: context?.route,
        additionalData: {
          ...data,
          logLevel: 'error',
          logMessage: message
        }
      }
    );
  }
  
  fatal(message: string, error?: Error, context?: Partial<LogEntry['context']>, data?: Record<string, any>): void {
    this.log(LogLevel.FATAL, message, context, data, error);
    
    // Send to Sentry for critical error tracking
    captureEnhancedError(
      error || new Error(message),
      {
        component: context?.service || 'LogAggregator',
        action: 'log_fatal',
        route: context?.route,
        additionalData: {
          ...data,
          logLevel: 'fatal',
          logMessage: message
        }
      },
      'fatal'
    );
  }
  
  /**
   * Search logs
   */
  searchLogs(filter: LogFilter, limit: number = 1000): LogEntry[] {
    let filteredLogs = this.logs;
    
    // Apply time range filter
    if (filter.timeRange) {
      filteredLogs = filteredLogs.filter(log => 
        log.timestamp >= filter.timeRange!.start && 
        log.timestamp <= filter.timeRange!.end
      );
    }
    
    // Apply level filter
    if (filter.levels && filter.levels.length > 0) {
      filteredLogs = filteredLogs.filter(log => filter.levels!.includes(log.level));
    }
    
    // Apply service filter
    if (filter.services && filter.services.length > 0) {
      filteredLogs = filteredLogs.filter(log => 
        log.context.service && filter.services!.includes(log.context.service!)
      );
    }
    
    // Apply user filter
    if (filter.users && filter.users.length > 0) {
      filteredLogs = filteredLogs.filter(log => 
        log.context.userId && filter.users!.includes(log.context.userId!)
      );
    }
    
    // Apply session filter
    if (filter.sessions && filter.sessions.length > 0) {
      filteredLogs = filteredLogs.filter(log => 
        log.context.sessionId && filter.sessions!.includes(log.context.sessionId!)
      );
    }
    
    // Apply message filter
    if (filter.message) {
      const searchTerm = filter.message.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        log.message.toLowerCase().includes(searchTerm)
      );
    }
    
    // Apply tags filter
    if (filter.tags && filter.tags.length > 0) {
      filteredLogs = filteredLogs.filter(log => 
        filter.tags!.some(tag => log.tags.includes(tag))
      );
    }
    
    // Apply data filter
    if (filter.data) {
      filteredLogs = filteredLogs.filter(log => {
        if (!log.data) return false;
        
        for (const [key, value] of Object.entries(filter.data!)) {
          if (log.data[key] !== value) {
            return false;
          }
        }
        
        return true;
      });
    }
    
    // Apply context filter
    if (filter.context) {
      filteredLogs = filteredLogs.filter(log => {
        for (const [key, value] of Object.entries(filter.context!)) {
          if ((log.context as any)[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }
    
    // Sort by timestamp (newest first) and limit
    return filteredLogs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
  
  /**
   * Get log statistics
   */
  getStats(period: 'hour' | 'day' | 'week' | 'month', limit: number = 100): LogAggregationStats[] {
    return this.stats
      .filter(stat => stat.period === period)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
  
  /**
   * Get retention policies
   */
  getRetentionPolicies(): Map<LogLevel, LogRetentionPolicy> {
    return new Map(this.retentionPolicies);
  }
  
  /**
   * Update retention policy
   */
  updateRetentionPolicy(level: LogLevel, policy: Partial<LogRetentionPolicy>): void {
    const existingPolicy = this.retentionPolicies.get(level);
    const updatedPolicy: LogRetentionPolicy = {
      level,
      retentionDays: 30,
      compressionEnabled: true,
      archiveEnabled: false,
      ...existingPolicy,
      ...policy
    };
    
    this.retentionPolicies.set(level, updatedPolicy);
  }
  
  /**
   * Create or update log alert rule
   */
  upsertLogAlertRule(rule: Omit<LogAlertRule, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = this.generateId();
    const now = new Date();
    
    const alertRule: LogAlertRule = {
      ...rule,
      id,
      createdAt: now,
      updatedAt: now,
      createdBy: rule.createdBy || 'system'
    };
    
    this.alertRules.set(id, alertRule);
    
    addBreadcrumb(
      `Log alert rule created: ${rule.name}`,
      'log_aggregator',
      'info',
      { ruleId: id, ruleName: rule.name }
    );
    
    return id;
  }
  
  /**
   * Delete log alert rule
   */
  deleteLogAlertRule(ruleId: string): boolean {
    return this.alertRules.delete(ruleId);
  }
  
  /**
   * Get log alert rules
   */
  getLogAlertRules(): LogAlertRule[] {
    return Array.from(this.alertRules.values());
  }
  
  /**
   * Export logs
   */
  exportLogs(filter: LogFilter, format: 'json' | 'csv' | 'txt' = 'json'): string {
    const logs = this.searchLogs(filter);
    
    switch (format) {
      case 'json':
        return JSON.stringify(logs, null, 2);
      
      case 'csv':
        const headers = [
          'id', 'timestamp', 'level', 'message', 'service', 'userId', 'sessionId',
          'requestId', 'route', 'method', 'statusCode', 'duration'
        ];
        
        const csvRows = [
          headers.join(','),
          ...logs.map(log => [
            log.id,
            log.timestamp.toISOString(),
            LogLevel[log.level],
            `"${log.message.replace(/"/g, '""')}"`,
            log.context.service || '',
            log.context.userId || '',
            log.context.sessionId || '',
            log.context.requestId || '',
            log.context.route || '',
            log.context.method || '',
            log.context.statusCode || '',
            log.context.duration || ''
          ].join(','))
        ];
        
        return csvRows.join('\n');
      
      case 'txt':
        return logs.map(log => 
          `[${log.timestamp.toISOString()}] ${LogLevel[log.level]} ${log.message}` +
          (log.context.service ? ` [${log.context.service}]` : '') +
          (log.context.userId ? ` [user:${log.context.userId}]` : '') +
          (log.error ? `\nError: ${log.error.message}` : '')
        ).join('\n');
      
      default:
        return JSON.stringify(logs, null, 2);
    }
  }
  
  /**
   * Add log entry
   */
  private addLog(logEntry: LogEntry): void {
    this.logs.push(logEntry);
    
    // Limit log size
    if (this.logs.length > this.maxLogSize) {
      this.logs.shift();
    }
    
    // Check log alert rules
    this.checkLogAlertRules(logEntry);
  }
  
  /**
   * Start aggregation loop
   */
  private startAggregationLoop(): void {
    this.aggregationInterval = setInterval(() => {
      if (this.isAggregating) {
        this.processLogRetention();
        this.updateStats();
        this.checkLogAlertRules();
      }
    }, 60000); // Process every minute
  }
  
  /**
   * Setup default retention policies
   */
  private setupDefaultRetentionPolicies(): void {
    const defaultPolicies: Array<[LogLevel, LogRetentionPolicy]> = [
      [LogLevel.TRACE, { level: LogLevel.TRACE, retentionDays: 7, compressionEnabled: true, archiveEnabled: false }],
      [LogLevel.DEBUG, { level: LogLevel.DEBUG, retentionDays: 14, compressionEnabled: true, archiveEnabled: false }],
      [LogLevel.INFO, { level: LogLevel.INFO, retentionDays: 30, compressionEnabled: true, archiveEnabled: true }],
      [LogLevel.WARN, { level: LogLevel.WARN, retentionDays: 90, compressionEnabled: true, archiveEnabled: true }],
      [LogLevel.ERROR, { level: LogLevel.ERROR, retentionDays: 365, compressionEnabled: true, archiveEnabled: true }],
      [LogLevel.FATAL, { level: LogLevel.FATAL, retentionDays: 365 * 7, compressionEnabled: true, archiveEnabled: true }]
    ];
    
    defaultPolicies.forEach(([level, policy]) => {
      this.retentionPolicies.set(level, policy);
    });
  }
  
  /**
   * Setup default alert rules
   */
  private setupDefaultAlertRules(): void {
    const defaultRules: Array<Omit<LogAlertRule, 'id' | 'createdAt' | 'updatedAt'>> = [
      {
        name: 'High Error Rate',
        description: 'Alert when error rate exceeds 5% in 5 minutes',
        enabled: true,
        filter: {
          levels: [LogLevel.ERROR, LogLevel.FATAL]
        },
        condition: 'rate',
        threshold: 0.05,
        timeWindow: 300,
        severity: 'critical',
        notificationChannels: ['default-email', 'default-slack'],
        createdBy: 'system'
      },
      {
        name: 'Fatal Error Detected',
        description: 'Alert when a fatal error is logged',
        enabled: true,
        filter: {
          levels: [LogLevel.FATAL]
        },
        condition: 'count',
        threshold: 1,
        timeWindow: 60,
        severity: 'critical',
        notificationChannels: ['default-email', 'default-slack', 'default-pagerduty'],
        createdBy: 'system'
      },
      {
        name: 'Database Connection Errors',
        description: 'Alert when database connection errors are detected',
        enabled: true,
        filter: {
          message: 'database connection',
          levels: [LogLevel.ERROR, LogLevel.FATAL]
        },
        condition: 'count',
        threshold: 3,
        timeWindow: 300,
        severity: 'warning',
        notificationChannels: ['default-email'],
        createdBy: 'system'
      }
    ];
    
    defaultRules.forEach(rule => this.upsertLogAlertRule(rule));
  }
  
  /**
   * Process log retention
   */
  private processLogRetention(): void {
    const now = Date.now();
    
    for (const [level, policy] of this.retentionPolicies) {
      const cutoff = now - policy.retentionDays * 24 * 60 * 60 * 1000;
      
      // Remove logs older than retention policy
      const initialLength = this.logs.length;
      this.logs = this.logs.filter(log => 
        log.level !== level || log.timestamp.getTime() > cutoff
      );
      
      // Check for retention policy violations
      if (this.logs.length === initialLength) {
        // No logs were removed, check if we're approaching size limit
        const maxSize = policy.maxSize ? policy.maxSize * 1024 * 1024 : Infinity;
        const currentSize = this.estimateLogSize();
        
        if (currentSize > maxSize * 0.9) { // 90% of max size
          this.warn(
            `Log retention policy violation approaching for level ${LogLevel[level]}`,
            {
              service: 'LogAggregator'
            },
            {
              currentSizeMB: currentSize / 1024 / 1024, // MB
              maxSize: maxSize / 1024 / 1024 // MB
            }
          );
        }
      }
    }
  }
  
  /**
   * Estimate log size in bytes
   */
  private estimateLogSize(): number {
    // Rough estimation based on average log entry size
    return this.logs.length * 1024; // Assume 1KB per log entry
  }
  
  /**
   * Update statistics
   */
  private updateStats(): void {
    const now = new Date();
    const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
    
    // Find or create stats for current hour
    let stats = this.stats.find(s => s.timestamp.getTime() === currentHour.getTime());
    if (!stats) {
      stats = {
        period: 'hour',
        timestamp: currentHour,
        totalLogs: 0,
        logsByLevel: {} as Record<LogLevel, number>,
        logsByService: {},
        logsByUser: {},
        errorRate: 0,
        topErrors: [],
        averageResponseTime: 0,
        slowestRequests: [],
        complianceViolations: 0,
        retentionPolicyViolations: 0
      };
      this.stats.push(stats);
    }
    
    // Calculate stats for the current hour
    const hourStart = currentHour.getTime();
    const hourEnd = hourStart + 60 * 60 * 1000;
    const hourLogs = this.logs.filter(log => 
      log.timestamp.getTime() >= hourStart && log.timestamp.getTime() < hourEnd
    );
    
    stats.totalLogs = hourLogs.length;
    
    // Count by level
    stats.logsByLevel = {} as Record<LogLevel, number>;
    for (const level of Object.values(LogLevel)) {
      stats.logsByLevel[level as LogLevel] = 0;
    }
    hourLogs.forEach(log => {
      stats.logsByLevel[log.level]++;
    });
    
    // Count by service
    stats.logsByService = {};
    hourLogs.forEach(log => {
      if (log.context.service) {
        stats.logsByService[log.context.service] = (stats.logsByService[log.context.service] || 0) + 1;
      }
    });
    
    // Count by user
    stats.logsByUser = {};
    hourLogs.forEach(log => {
      if (log.context.userId) {
        stats.logsByUser[log.context.userId] = (stats.logsByUser[log.context.userId] || 0) + 1;
      }
    });
    
    // Calculate error rate
    const errorLogs = hourLogs.filter(log => log.level >= LogLevel.ERROR);
    stats.errorRate = hourLogs.length > 0 ? (errorLogs.length / hourLogs.length) * 100 : 0;
    
    // Find top errors
    const errorMessages = new Map<string, { count: number; level: LogLevel; service?: string }>();
    errorLogs.forEach(log => {
      const key = log.message;
      const existing = errorMessages.get(key);
      if (existing) {
        existing.count++;
      } else {
        errorMessages.set(key, { count: 1, level: log.level, service: log.context.service });
      }
    });
    
    stats.topErrors = Array.from(errorMessages.entries())
      .map(([message, data]) => ({ message, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Calculate average response time
    const requestsWithDuration = hourLogs.filter(log => log.context.duration !== undefined);
    if (requestsWithDuration.length > 0) {
      const totalDuration = requestsWithDuration.reduce((sum, log) => sum + (log.context.duration || 0), 0);
      stats.averageResponseTime = totalDuration / requestsWithDuration.length;
      
      // Find slowest requests
      stats.slowestRequests = requestsWithDuration
        .filter(log => log.context.route && log.context.method)
        .map(log => ({
          route: log.context.route!,
          method: log.context.method!,
          duration: log.context.duration!,
          timestamp: log.timestamp
        }))
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10);
    }
    
    // Keep only last 168 hours (7 days)
    this.stats = this.stats.filter(s => s.timestamp > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  }
  
  /**
   * Check log alert rules
   */
  private checkLogAlertRules(logEntry?: LogEntry): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;
      
      // Check if rule is within schedule
      if (!this.isWithinSchedule(rule.schedule)) continue;
      
      // Get logs matching the rule filter
      const filter = { ...rule.filter };
      if (logEntry) {
        // If we have a specific log entry, check if it matches the filter
        if (!this.logMatchesFilter(logEntry, rule.filter)) continue;
        
        // Set time range to include the time window
        const now = new Date();
        filter.timeRange = {
          start: new Date(now.getTime() - rule.timeWindow * 1000),
          end: now
        };
      }
      
      const matchingLogs = this.searchLogs(filter);
      
      // Check condition
      let alertTriggered = false;
      let alertValue = 0;
      
      switch (rule.condition) {
        case 'count':
          alertValue = matchingLogs.length;
          alertTriggered = alertValue >= rule.threshold;
          break;
        
        case 'rate':
          const timeWindow = rule.timeWindow * 1000; // Convert to milliseconds
          const now = Date.now();
          const recentLogs = matchingLogs.filter(log => 
            log.timestamp.getTime() > now - timeWindow
          );
          
          // Calculate rate per minute
          alertValue = (recentLogs.length / rule.timeWindow) * 60;
          alertTriggered = alertValue >= rule.threshold;
          break;
        
        case 'pattern':
          // For pattern matching, we'd need more sophisticated logic
          // For now, just check if we have any matching logs
          alertValue = matchingLogs.length;
          alertTriggered = alertValue > 0;
          break;
      }
      
      if (alertTriggered) {
        this.triggerLogAlert(rule, alertValue, matchingLogs);
      }
    }
  }
  
  /**
   * Check if log matches filter
   */
  private logMatchesFilter(log: LogEntry, filter: LogFilter): boolean {
    // Check level filter
    if (filter.levels && !filter.levels.includes(log.level)) {
      return false;
    }
    
    // Check service filter
    if (filter.services && log.context.service && !filter.services.includes(log.context.service)) {
      return false;
    }
    
    // Check user filter
    if (filter.users && log.context.userId && !filter.users.includes(log.context.userId)) {
      return false;
    }
    
    // Check session filter
    if (filter.sessions && log.context.sessionId && !filter.sessions.includes(log.context.sessionId)) {
      return false;
    }
    
    // Check message filter
    if (filter.message && !log.message.toLowerCase().includes(filter.message.toLowerCase())) {
      return false;
    }
    
    // Check tags filter
    if (filter.tags && !filter.tags.some(tag => log.tags.includes(tag))) {
      return false;
    }
    
    // Check data filter
    if (filter.data && log.data) {
      for (const [key, value] of Object.entries(filter.data)) {
        if (log.data[key] !== value) {
          return false;
        }
      }
    }
    
    // Check context filter
    if (filter.context) {
      for (const [key, value] of Object.entries(filter.context)) {
        if ((log.context as any)[key] !== value) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Check if current time is within schedule
   */
  private isWithinSchedule(schedule?: LogAlertRule['schedule']): boolean {
    if (!schedule) return true;
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const currentDay = now.getDay();
    
    // Check if current day is active
    if (!schedule.activeDays.includes(currentDay)) return false;
    
    // Check if current time is within active hours
    for (const activeHours of schedule.activeHours) {
      const [startHour, startMin] = activeHours.start.split(':').map(Number);
      const [endHour, endMin] = activeHours.end.split(':').map(Number);
      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;
      
      if (currentTime >= startTime && currentTime <= endTime) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Trigger log alert
   */
  private triggerLogAlert(
    rule: LogAlertRule,
    value: number,
    matchingLogs: LogEntry[]
  ): void {
    const alertMessage = `Log Alert: ${rule.name} - ${rule.description}`;
    const alertData = {
      ruleId: rule.id,
      ruleName: rule.name,
      condition: rule.condition,
      threshold: rule.threshold,
      value,
      matchingLogCount: matchingLogs.length,
      timeWindow: rule.timeWindow,
      sampleLogs: matchingLogs.slice(0, 5).map(log => ({
        id: log.id,
        timestamp: log.timestamp.toISOString(),
        level: LogLevel[log.level],
        message: log.message,
        service: log.context.service
      }))
    };
    
    // Don't log the alert to prevent infinite recursion
    // this.error(alertMessage, undefined, { service: 'LogAggregator' }, alertData);
    
    // Send to Sentry
    captureEnhancedError(
      new Error(alertMessage),
      {
        component: 'LogAggregator',
        action: 'log_alert',
        additionalData: alertData
      },
      rule.severity as any
    );
    
    addBreadcrumb(
      `Log alert triggered: ${rule.name}`,
      'log_aggregator',
      'warning',
      alertData
    );
  }
  
  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const logAggregator = LogAggregator.getInstance();

// Initialize log aggregation
if (typeof window !== 'undefined') {
  // Start log aggregation after page load
  if (document.readyState === 'complete') {
    logAggregator.startAggregation();
  } else {
    window.addEventListener('load', () => {
      logAggregator.startAggregation();
    });
  }
}

// Enhanced logger that uses the log aggregator
export const logger = {
  trace: (message: string, context?: Partial<LogEntry['context']>, data?: Record<string, any>) => {
    logAggregator.trace(message, context, data);
  },
  
  debug: (message: string, context?: Partial<LogEntry['context']>, data?: Record<string, any>) => {
    logAggregator.debug(message, context, data);
  },
  
  info: (message: string, context?: Partial<LogEntry['context']>, data?: Record<string, any>) => {
    logAggregator.info(message, context, data);
  },
  
  warn: (message: string, context?: Partial<LogEntry['context']>, data?: Record<string, any>) => {
    logAggregator.warn(message, context, data);
  },
  
  error: (message: string, error?: Error, context?: Partial<LogEntry['context']>, data?: Record<string, any>) => {
    logAggregator.error(message, error, context, data);
  },
  
  fatal: (message: string, error?: Error, context?: Partial<LogEntry['context']>, data?: Record<string, any>) => {
    logAggregator.fatal(message, error, context, data);
  }
};