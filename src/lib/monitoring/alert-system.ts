/**
 * Comprehensive Alert System Configuration
 * 
 * This module provides a unified alert system for all monitoring components:
 * - Alert rule configuration
 * - Notification channels (email, SMS, Slack, PagerDuty)
 * - Escalation policies
 * - Alert suppression and deduplication
 * - On-call scheduling
 * - Alert history and analytics
 */

import { captureEnhancedError, addBreadcrumb, ErrorCategory } from './sentry';

// Alert rule interface
export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  
  // Rule configuration
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'ne';
  threshold: number;
  duration: number; // seconds
  
  // Severity and classification
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: 'performance' | 'availability' | 'security' | 'business' | 'infrastructure';
  tags: Record<string, string>;
  
  // Notification settings
  notificationChannels: string[];
  escalationPolicyId?: string;
  
  // Suppression settings
  suppressFor?: number; // seconds
  groupBy?: string[];
  
  // Schedule
  schedule?: {
    timezone: string;
    activeHours: { start: string; end: string }[];
    activeDays: number[]; // 0-6 (Sunday-Saturday)
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Notification channel interface
export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'slack' | 'pagerduty' | 'webhook' | 'teams' | 'discord';
  enabled: boolean;
  
  // Channel configuration
  config: {
    // Email
    recipients?: string[];
    template?: string;
    
    // SMS
    phoneNumbers?: string[];
    
    // Slack
    webhookUrl?: string;
    channel?: string;
    
    // PagerDuty
    serviceKey?: string;
    escalationPolicy?: string;
    
    // Webhook
    url?: string;
    method?: 'POST' | 'PUT';
    headers?: Record<string, string>;
    
    // Teams/Discord
    teamsWebhookUrl?: string;
  };
  
  // Filtering
  filters: {
    severities: string[];
    categories: string[];
    tags?: Record<string, string>;
  };
  
  // Rate limiting
  rateLimit?: {
    maxAlerts: number;
    period: number; // seconds
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Escalation policy interface
export interface EscalationPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  
  // Escalation steps
  steps: Array<{
    order: number;
    delay: number; // seconds
    channels: string[];
    conditions?: {
      severity?: string[];
      category?: string[];
      tags?: Record<string, string>;
    };
  }>;
  
  // Loop settings
  loop?: boolean;
  loopDelay?: number; // seconds
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Alert instance interface
export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  
  // Alert data
  metric: string;
  value: number;
  threshold: number;
  condition: string;
  severity: string;
  category: string;
  message: string;
  description?: string;
  
  // Status and lifecycle
  status: 'firing' | 'resolved' | 'suppressed' | 'acknowledged';
  startedAt: Date;
  resolvedAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  
  // Context
  labels: Record<string, string>;
  annotations: Record<string, string>;
  source: string;
  
  // Notifications
  notificationsSent: number;
  lastNotificationAt?: Date;
  channelsNotified: string[];
  
  // Escalation
  escalationLevel?: number;
  escalatedAt?: Date;
  
  // Suppression
  suppressed?: boolean;
  suppressedUntil?: Date;
  suppressionReason?: string;
}

// Alert analytics interface
export interface AlertAnalytics {
  period: 'hour' | 'day' | 'week' | 'month';
  timestamp: Date;
  
  // Volume metrics
  totalAlerts: number;
  alertsBySeverity: Record<string, number>;
  alertsByCategory: Record<string, number>;
  alertsBySource: Record<string, number>;
  
  // Time metrics
  averageResolutionTime: number;
  averageAcknowledgmentTime: number;
  averageEscalationTime: number;
  
  // Effectiveness metrics
  falsePositiveRate: number;
  suppressionRate: number;
  escalationRate: number;
  
  // Channel metrics
  notificationsByChannel: Record<string, number>;
  deliverySuccessRate: Record<string, number>;
}

// On-call schedule interface
export interface OnCallSchedule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  
  // Schedule configuration
  timezone: string;
  rotations: Array<{
    id: string;
    name: string;
    type: 'daily' | 'weekly' | 'monthly';
    users: string[];
    startTime: Date;
    endTime?: Date;
    handoffTime?: string; // HH:MM
  }>;
  
  // Override rules
  overrides: Array<{
    user: string;
    startTime: Date;
    endTime: Date;
    reason?: string;
  }>;
  
  // Coverage rules
  coverageRules: Array<{
    days: number[]; // 0-6 (Sunday-Saturday)
    hours: { start: string; end: string };
    requiredUsers: number;
  }>;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export class AlertSystem {
  private static instance: AlertSystem;
  private rules: Map<string, AlertRule> = new Map();
  private channels: Map<string, NotificationChannel> = new Map();
  private escalationPolicies: Map<string, EscalationPolicy> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private schedules: Map<string, OnCallSchedule> = new Map();
  private analytics: AlertAnalytics[] = [];
  
  private isRunning: boolean = false;
  private evaluationInterval?: NodeJS.Timeout;
  private notificationQueue: Array<{ alert: Alert; channels: string[] }> = [];
  private isProcessingNotifications: boolean = false;
  
  private constructor() {
    this.loadDefaultConfiguration();
  }
  
  static getInstance(): AlertSystem {
    if (!AlertSystem.instance) {
      AlertSystem.instance = new AlertSystem();
    }
    return AlertSystem.instance;
  }
  
  /**
   * Start the alert system
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.startEvaluationLoop();
    this.startNotificationProcessor();
    
    addBreadcrumb(
      'Alert system started',
      'alert_system',
      'info'
    );
  }
  
  /**
   * Stop the alert system
   */
  stop(): void {
    this.isRunning = false;
    
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = undefined;
    }
    
    addBreadcrumb(
      'Alert system stopped',
      'alert_system',
      'info'
    );
  }
  
  /**
   * Create or update an alert rule
   */
  upsertRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = this.generateId();
    const now = new Date();
    
    const alertRule: AlertRule = {
      ...rule,
      id,
      createdAt: now,
      updatedAt: now,
      createdBy: rule.createdBy || 'system'
    };
    
    this.rules.set(id, alertRule);
    
    addBreadcrumb(
      `Alert rule created: ${rule.name}`,
      'alert_system',
      'info',
      { ruleId: id, ruleName: rule.name }
    );
    
    return id;
  }
  
  /**
   * Delete an alert rule
   */
  deleteRule(ruleId: string): boolean {
    const deleted = this.rules.delete(ruleId);
    
    if (deleted) {
      // Resolve any active alerts from this rule
      for (const [alertId, alert] of this.alerts.entries()) {
        if (alert.ruleId === ruleId && alert.status === 'firing') {
          this.resolveAlert(alertId, 'Rule deleted');
        }
      }
      
      addBreadcrumb(
        `Alert rule deleted: ${ruleId}`,
        'alert_system',
        'info',
        { ruleId }
      );
    }
    
    return deleted;
  }
  
  /**
   * Create or update a notification channel
   */
  upsertChannel(channel: Omit<NotificationChannel, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = this.generateId();
    const now = new Date();
    
    const notificationChannel: NotificationChannel = {
      ...channel,
      id,
      createdAt: now,
      updatedAt: now,
      createdBy: channel.createdBy || 'system'
    };
    
    this.channels.set(id, notificationChannel);
    
    addBreadcrumb(
      `Notification channel created: ${channel.name}`,
      'alert_system',
      'info',
      { channelId: id, channelName: channel.name, type: channel.type }
    );
    
    return id;
  }
  
  /**
   * Create or update an escalation policy
   */
  upsertEscalationPolicy(policy: Omit<EscalationPolicy, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = this.generateId();
    const now = new Date();
    
    const escalationPolicy: EscalationPolicy = {
      ...policy,
      id,
      createdAt: now,
      updatedAt: now,
      createdBy: policy.createdBy || 'system'
    };
    
    this.escalationPolicies.set(id, escalationPolicy);
    
    addBreadcrumb(
      `Escalation policy created: ${policy.name}`,
      'alert_system',
      'info',
      { policyId: id, policyName: policy.name }
    );
    
    return id;
  }
  
  /**
   * Evaluate a metric against alert rules
   */
  evaluateMetric(
    metric: string,
    value: number,
    labels: Record<string, string> = {},
    source: string = 'unknown'
  ): void {
    if (!this.isRunning) return;
    
    for (const rule of this.rules.values()) {
      if (!rule.enabled || rule.metric !== metric) continue;
      
      // Check if rule matches labels
      if (!this.matchesLabels(rule.tags, labels)) continue;
      
      // Check if rule is within schedule
      if (!this.isWithinSchedule(rule.schedule)) continue;
      
      // Evaluate condition
      const conditionMet = this.evaluateCondition(value, rule.condition, rule.threshold);
      
      // Find or create alert instance
      const alertKey = this.getAlertKey(rule.id, labels);
      let alert = this.alerts.get(alertKey);
      
      if (conditionMet) {
        if (!alert) {
          // Create new alert
          alert = this.createAlert(rule, value, labels, source);
          this.alerts.set(alertKey, alert);
        } else if (alert.status === 'resolved') {
          // Re-open resolved alert
          alert.status = 'firing';
          alert.startedAt = new Date();
          alert.value = value;
        }
      } else if (alert && alert.status === 'firing') {
        // Condition no longer met, resolve alert
        this.resolveAlert(alert.id, 'Condition resolved');
      }
    }
  }
  
  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status !== 'firing') return false;
    
    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;
    
    addBreadcrumb(
      `Alert acknowledged: ${alertId}`,
      'alert_system',
      'info',
      { alertId, acknowledgedBy }
    );
    
    return true;
  }
  
  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string, reason?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status === 'resolved') return false;
    
    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    
    if (reason) {
      alert.annotations.resolutionReason = reason;
    }
    
    addBreadcrumb(
      `Alert resolved: ${alertId}`,
      'alert_system',
      'info',
      { alertId, reason }
    );
    
    return true;
  }
  
  /**
   * Suppress an alert
   */
  suppressAlert(alertId: string, duration: number, reason?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;
    
    alert.suppressed = true;
    alert.suppressedUntil = new Date(Date.now() + duration * 1000);
    alert.suppressionReason = reason || 'Manual suppression';
    
    addBreadcrumb(
      `Alert suppressed: ${alertId}`,
      'alert_system',
      'info',
      { alertId, duration, reason }
    );
    
    return true;
  }
  
  /**
   * Get active alerts
   */
  getActiveAlerts(filters?: {
    severity?: string[];
    category?: string[];
    source?: string;
    status?: string[];
  }): Alert[] {
    let alerts = Array.from(this.alerts.values());
    
    if (filters) {
      if (filters.severity) {
        alerts = alerts.filter(a => filters.severity!.includes(a.severity));
      }
      if (filters.category) {
        alerts = alerts.filter(a => filters.category!.includes(a.category));
      }
      if (filters.source) {
        alerts = alerts.filter(a => a.source === filters.source);
      }
      if (filters.status) {
        alerts = alerts.filter(a => filters.status!.includes(a.status));
      }
    }
    
    return alerts.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }
  
  /**
   * Get alert rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }
  
  /**
   * Get notification channels
   */
  getChannels(): NotificationChannel[] {
    return Array.from(this.channels.values());
  }
  
  /**
   * Get escalation policies
   */
  getEscalationPolicies(): EscalationPolicy[] {
    return Array.from(this.escalationPolicies.values());
  }
  
  /**
   * Get alert analytics
   */
  getAnalytics(period: 'hour' | 'day' | 'week' | 'month', limit: number = 100): AlertAnalytics[] {
    return this.analytics
      .filter(a => a.period === period)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
  
  /**
   * Load default configuration
   */
  private loadDefaultConfiguration(): void {
    // Default alert rules
    const defaultRules: Array<Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>> = [
      {
        name: 'High Error Rate',
        description: 'Alert when error rate exceeds 1%',
        enabled: true,
        metric: 'error_rate',
        condition: 'gt',
        threshold: 1,
        duration: 300, // 5 minutes
        severity: 'critical',
        category: 'availability',
        tags: {},
        notificationChannels: ['default-email', 'default-slack'],
        suppressFor: 900, // 15 minutes
        groupBy: ['source'],
        createdBy: 'system'
      },
      {
        name: 'Slow API Response',
        description: 'Alert when API response time exceeds 1000ms',
        enabled: true,
        metric: 'api_response_time_p95',
        condition: 'gt',
        threshold: 1000,
        duration: 600, // 10 minutes
        severity: 'warning',
        category: 'performance',
        tags: {},
        notificationChannels: ['default-email'],
        suppressFor: 600, // 10 minutes
        groupBy: ['endpoint'],
        createdBy: 'system'
      },
      {
        name: 'High Memory Usage',
        description: 'Alert when memory usage exceeds 80%',
        enabled: true,
        metric: 'memory_usage_percent',
        condition: 'gt',
        threshold: 80,
        duration: 900, // 15 minutes
        severity: 'warning',
        category: 'infrastructure',
        tags: {},
        notificationChannels: ['default-email'],
        suppressFor: 600, // 10 minutes
        groupBy: ['server'],
        createdBy: 'system'
      },
      {
        name: 'Database Connection Issues',
        description: 'Alert when database connections exceed 80%',
        enabled: true,
        metric: 'db_connection_usage_percent',
        condition: 'gt',
        threshold: 80,
        duration: 300, // 5 minutes
        severity: 'critical',
        category: 'infrastructure',
        tags: {},
        notificationChannels: ['default-email', 'default-slack', 'default-pagerduty'],
        suppressFor: 300, // 5 minutes
        groupBy: ['database'],
        createdBy: 'system'
      },
      {
        name: 'WebSocket Connection Drops',
        description: 'Alert when WebSocket disconnect rate exceeds 5%',
        enabled: true,
        metric: 'ws_disconnect_rate',
        condition: 'gt',
        threshold: 5,
        duration: 600, // 10 minutes
        severity: 'warning',
        category: 'availability',
        tags: {},
        notificationChannels: ['default-email'],
        suppressFor: 600, // 10 minutes
        groupBy: ['server'],
        createdBy: 'system'
      }
    ];
    
    defaultRules.forEach(rule => this.upsertRule(rule));
    
    // Default notification channels
    const defaultChannels: Array<Omit<NotificationChannel, 'id' | 'createdAt' | 'updatedAt'>> = [
      {
        name: 'Default Email',
        type: 'email',
        enabled: true,
        config: {
          recipients: ['alerts@nexustrade.com'],
          template: 'default-alert'
        },
        filters: {
          severities: ['warning', 'error', 'critical'],
          categories: ['performance', 'availability', 'security', 'business', 'infrastructure']
        },
        rateLimit: {
          maxAlerts: 10,
          period: 3600 // 1 hour
        },
        createdBy: 'system'
      },
      {
        name: 'Default Slack',
        type: 'slack',
        enabled: true,
        config: {
          webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
          channel: '#alerts'
        },
        filters: {
          severities: ['error', 'critical'],
          categories: ['performance', 'availability', 'security', 'business', 'infrastructure']
        },
        rateLimit: {
          maxAlerts: 20,
          period: 3600 // 1 hour
        },
        createdBy: 'system'
      },
      {
        name: 'Default PagerDuty',
        type: 'pagerduty',
        enabled: true,
        config: {
          serviceKey: process.env.PAGERDUTY_SERVICE_KEY || '',
          escalationPolicy: 'default'
        },
        filters: {
          severities: ['critical'],
          categories: ['availability', 'security', 'business', 'infrastructure']
        },
        rateLimit: {
          maxAlerts: 5,
          period: 3600 // 1 hour
        },
        createdBy: 'system'
      }
    ];
    
    defaultChannels.forEach(channel => this.upsertChannel(channel));
  }
  
  /**
   * Start the evaluation loop
   */
  private startEvaluationLoop(): void {
    this.evaluationInterval = setInterval(() => {
      if (this.isRunning) {
        this.evaluateActiveAlerts();
        this.processEscalations();
        this.cleanupOldAlerts();
        this.updateAnalytics();
      }
    }, 30000); // Evaluate every 30 seconds
  }
  
  /**
   * Start the notification processor
   */
  private startNotificationProcessor(): void {
    setInterval(() => {
      if (this.isRunning && !this.isProcessingNotifications) {
        this.processNotificationQueue();
      }
    }, 5000); // Process notifications every 5 seconds
  }
  
  /**
   * Evaluate active alerts for escalation and suppression
   */
  private evaluateActiveAlerts(): void {
    const now = Date.now();
    
    for (const alert of this.alerts.values()) {
      if (alert.status !== 'firing' && alert.status !== 'acknowledged') continue;
      
      // Check suppression
      if (alert.suppressed && alert.suppressedUntil) {
        if (now > alert.suppressedUntil.getTime()) {
          alert.suppressed = false;
          alert.suppressedUntil = undefined;
          alert.suppressionReason = undefined;
        } else {
          continue; // Still suppressed
        }
      }
      
      // Check for escalation
      if (alert.escalationLevel === undefined) {
        const rule = this.rules.get(alert.ruleId);
        if (rule?.escalationPolicyId) {
          this.checkEscalation(alert);
        }
      }
    }
  }
  
  /**
   * Process escalations
   */
  private processEscalations(): void {
    const now = Date.now();
    
    for (const alert of this.alerts.values()) {
      if (alert.status !== 'firing' && alert.status !== 'acknowledged') continue;
      if (alert.suppressed) continue;
      
      const policy = this.escalationPolicies.get(alert.ruleId);
      if (!policy || !policy.steps.length) continue;
      
      const currentLevel = alert.escalationLevel || 0;
      if (currentLevel >= policy.steps.length) continue;
      
      const step = policy.steps[currentLevel];
      const timeSinceStart = now - alert.startedAt.getTime();
      
      if (timeSinceStart >= step.delay * 1000) {
        // Escalate to next level
        alert.escalationLevel = currentLevel + 1;
        alert.escalatedAt = new Date();
        
        // Queue notifications
        this.queueNotifications(alert, step.channels);
      }
    }
  }
  
  /**
   * Clean up old resolved alerts
   */
  private cleanupOldAlerts(): void {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.status === 'resolved' && alert.resolvedAt && alert.resolvedAt < cutoff) {
        this.alerts.delete(id);
      }
    }
  }
  
  /**
   * Update analytics
   */
  private updateAnalytics(): void {
    const now = new Date();
    const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
    
    // Find or create analytics for current hour
    let analytics = this.analytics.find(a => a.timestamp.getTime() === currentHour.getTime());
    if (!analytics) {
      analytics = {
        period: 'hour',
        timestamp: currentHour,
        totalAlerts: 0,
        alertsBySeverity: {},
        alertsByCategory: {},
        alertsBySource: {},
        averageResolutionTime: 0,
        averageAcknowledgmentTime: 0,
        averageEscalationTime: 0,
        falsePositiveRate: 0,
        suppressionRate: 0,
        escalationRate: 0,
        notificationsByChannel: {},
        deliverySuccessRate: {}
      };
      this.analytics.push(analytics);
    }
    
    // Update analytics data
    const activeAlerts = Array.from(this.alerts.values());
    analytics.totalAlerts = activeAlerts.length;
    
    // Count by severity
    analytics.alertsBySeverity = {};
    activeAlerts.forEach(alert => {
      analytics.alertsBySeverity[alert.severity] = (analytics.alertsBySeverity[alert.severity] || 0) + 1;
    });
    
    // Count by category
    analytics.alertsByCategory = {};
    activeAlerts.forEach(alert => {
      analytics.alertsByCategory[alert.category] = (analytics.alertsByCategory[alert.category] || 0) + 1;
    });
    
    // Count by source
    analytics.alertsBySource = {};
    activeAlerts.forEach(alert => {
      analytics.alertsBySource[alert.source] = (analytics.alertsBySource[alert.source] || 0) + 1;
    });
    
    // Calculate rates
    const resolvedAlerts = activeAlerts.filter(a => a.status === 'resolved');
    const acknowledgedAlerts = activeAlerts.filter(a => a.status === 'acknowledged');
    const suppressedAlerts = activeAlerts.filter(a => a.suppressed);
    const escalatedAlerts = activeAlerts.filter(a => a.escalationLevel !== undefined && a.escalationLevel > 0);
    
    analytics.suppressionRate = activeAlerts.length > 0 ? (suppressedAlerts.length / activeAlerts.length) * 100 : 0;
    analytics.escalationRate = activeAlerts.length > 0 ? (escalatedAlerts.length / activeAlerts.length) * 100 : 0;
    
    // Keep only last 168 hours (7 days)
    this.analytics = this.analytics.filter(a => a.timestamp > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  }
  
  /**
   * Check if labels match rule tags
   */
  private matchesLabels(ruleTags: Record<string, string>, labels: Record<string, string>): boolean {
    for (const [key, value] of Object.entries(ruleTags)) {
      if (labels[key] !== value) {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Check if current time is within rule schedule
   */
  private isWithinSchedule(schedule?: AlertRule['schedule']): boolean {
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
   * Evaluate condition
   */
  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'eq': return value === threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      case 'ne': return value !== threshold;
      default: return false;
    }
  }
  
  /**
   * Get alert key
   */
  private getAlertKey(ruleId: string, labels: Record<string, string>): string {
    const labelKey = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${ruleId}:${labelKey}`;
  }
  
  /**
   * Create alert
   */
  private createAlert(
    rule: AlertRule,
    value: number,
    labels: Record<string, string>,
    source: string
  ): Alert {
    const alert: Alert = {
      id: this.generateId(),
      ruleId: rule.id,
      ruleName: rule.name,
      metric: rule.metric,
      value,
      threshold: rule.threshold,
      condition: rule.condition,
      severity: rule.severity,
      category: rule.category,
      message: `${rule.name}: ${rule.metric} is ${value} (threshold: ${rule.threshold})`,
      description: rule.description,
      status: 'firing',
      startedAt: new Date(),
      labels: { ...rule.tags, ...labels },
      annotations: {},
      source,
      notificationsSent: 0,
      channelsNotified: []
    };
    
    // Queue initial notifications
    this.queueNotifications(alert, rule.notificationChannels);
    
    return alert;
  }
  
  /**
   * Queue notifications
   */
  private queueNotifications(alert: Alert, channelIds: string[]): void {
    // Filter channels based on alert properties
    const eligibleChannels = channelIds.filter(channelId => {
      const channel = this.channels.get(channelId);
      if (!channel || !channel.enabled) return false;
      
      // Check severity filter
      if (channel.filters.severities.length && !channel.filters.severities.includes(alert.severity)) {
        return false;
      }
      
      // Check category filter
      if (channel.filters.categories.length && !channel.filters.categories.includes(alert.category)) {
        return false;
      }
      
      // Check tags filter
      if (channel.filters.tags) {
        for (const [key, value] of Object.entries(channel.filters.tags)) {
          if (alert.labels[key] !== value) {
            return false;
          }
        }
      }
      
      // Check rate limiting
      if (channel.rateLimit) {
        const recentNotifications = this.getRecentNotificationsForChannel(channelId, channel.rateLimit.period);
        if (recentNotifications >= channel.rateLimit.maxAlerts) {
          return false;
        }
      }
      
      return true;
    });
    
    if (eligibleChannels.length > 0) {
      this.notificationQueue.push({ alert, channels: eligibleChannels });
    }
  }
  
  /**
   * Process notification queue
   */
  private async processNotificationQueue(): Promise<void> {
    if (this.notificationQueue.length === 0) return;
    
    this.isProcessingNotifications = true;
    
    try {
      const batch = this.notificationQueue.splice(0, 10); // Process 10 at a time
      
      for (const { alert, channels } of batch) {
        for (const channelId of channels) {
          try {
            await this.sendNotification(alert, channelId);
            alert.channelsNotified.push(channelId);
            alert.notificationsSent++;
            alert.lastNotificationAt = new Date();
          } catch (error) {
            captureEnhancedError(
              error instanceof Error ? error : new Error('Failed to send notification'),
              {
                component: 'AlertSystem',
                action: 'send_notification',
                additionalData: {
                  alertId: alert.id,
                  channelId,
                  error: error instanceof Error ? error.message : 'Unknown error'
                }
              }
            );
          }
        }
      }
    } finally {
      this.isProcessingNotifications = false;
    }
  }
  
  /**
   * Send notification
   */
  private async sendNotification(alert: Alert, channelId: string): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) throw new Error(`Channel not found: ${channelId}`);
    
    switch (channel.type) {
      case 'email':
        await this.sendEmailNotification(alert, channel);
        break;
      case 'slack':
        await this.sendSlackNotification(alert, channel);
        break;
      case 'pagerduty':
        await this.sendPagerDutyNotification(alert, channel);
        break;
      case 'webhook':
        await this.sendWebhookNotification(alert, channel);
        break;
      default:
        throw new Error(`Unsupported channel type: ${channel.type}`);
    }
  }
  
  /**
   * Send email notification
   */
  private async sendEmailNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    // Implementation would depend on email service
    console.log(`Sending email notification for alert ${alert.id} to ${channel.config.recipients?.join(', ')}`);
    
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  /**
   * Send Slack notification
   */
  private async sendSlackNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    const webhookUrl = channel.config.webhookUrl;
    if (!webhookUrl) throw new Error('Slack webhook URL not configured');
    
    const payload = {
      channel: channel.config.channel,
      text: `🚨 ${alert.severity.toUpperCase()} Alert: ${alert.ruleName}`,
      attachments: [
        {
          color: this.getSeverityColor(alert.severity),
          fields: [
            { title: 'Metric', value: alert.metric, short: true },
            { title: 'Value', value: alert.value.toString(), short: true },
            { title: 'Threshold', value: alert.threshold.toString(), short: true },
            { title: 'Source', value: alert.source, short: true }
          ],
          timestamp: Math.floor(alert.startedAt.getTime() / 1000)
        }
      ]
    };
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.statusText}`);
    }
  }
  
  /**
   * Send PagerDuty notification
   */
  private async sendPagerDutyNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    const serviceKey = channel.config.serviceKey;
    if (!serviceKey) throw new Error('PagerDuty service key not configured');
    
    const payload = {
      service_key: serviceKey,
      incident_key: alert.id,
      event_type: 'trigger',
      description: alert.message,
      client: 'FX Platform Alert System',
      client_url: `${process.env.BASE_URL}/alerts/${alert.id}`,
      details: {
        alert_id: alert.id,
        rule_name: alert.ruleName,
        metric: alert.metric,
        value: alert.value,
        threshold: alert.threshold,
        severity: alert.severity,
        category: alert.category,
        source: alert.source,
        labels: alert.labels
      },
      contexts: [
        {
          type: 'link',
          href: `${process.env.BASE_URL}/alerts/${alert.id}`,
          text: 'View Alert Details'
        }
      ]
    };
    
    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`PagerDuty notification failed: ${response.statusText}`);
    }
  }
  
  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    const url = channel.config.url;
    if (!url) throw new Error('Webhook URL not configured');
    
    const payload = {
      alert_id: alert.id,
      rule_name: alert.ruleName,
      metric: alert.metric,
      value: alert.value,
      threshold: alert.threshold,
      severity: alert.severity,
      category: alert.category,
      message: alert.message,
      description: alert.description,
      status: alert.status,
      started_at: alert.startedAt.toISOString(),
      labels: alert.labels,
      source: alert.source
    };
    
    const response = await fetch(url, {
      method: channel.config.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...channel.config.headers
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Webhook notification failed: ${response.statusText}`);
    }
  }
  
  /**
   * Get severity color for Slack
   */
  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'danger';
      case 'error': return 'danger';
      case 'warning': return 'warning';
      case 'info': return 'good';
      default: return 'good';
    }
  }
  
  /**
   * Get recent notifications for channel
   */
  private getRecentNotificationsForChannel(channelId: string, period: number): number {
    const cutoff = Date.now() - period * 1000;
    let count = 0;
    
    for (const alert of this.alerts.values()) {
      if (alert.channelsNotified.includes(channelId) && 
          alert.lastNotificationAt && 
          alert.lastNotificationAt.getTime() > cutoff) {
        count++;
      }
    }
    
    return count;
  }
  
  /**
   * Check escalation
   */
  private checkEscalation(alert: Alert): void {
    const rule = this.rules.get(alert.ruleId);
    if (!rule?.escalationPolicyId) return;
    
    const policy = this.escalationPolicies.get(rule.escalationPolicyId);
    if (!policy || !policy.steps.length) return;
    
    const now = Date.now();
    const timeSinceStart = now - alert.startedAt.getTime();
    
    // Find the first step that should have triggered
    for (let i = 0; i < policy.steps.length; i++) {
      const step = policy.steps[i];
      
      if (timeSinceStart >= step.delay * 1000) {
        if (alert.escalationLevel === undefined || alert.escalationLevel < i + 1) {
          // Escalate to this level
          alert.escalationLevel = i + 1;
          alert.escalatedAt = new Date();
          
          // Check if this step matches the alert
          if (this.matchesEscalationConditions(alert, step)) {
            this.queueNotifications(alert, step.channels);
          }
        }
      }
    }
  }
  
  /**
   * Check if alert matches escalation conditions
   */
  private matchesEscalationConditions(alert: Alert, step: EscalationPolicy['steps'][0]): boolean {
    if (!step.conditions) return true;
    
    if (step.conditions.severity && !step.conditions.severity.includes(alert.severity)) {
      return false;
    }
    
    if (step.conditions.category && !step.conditions.category.includes(alert.category)) {
      return false;
    }
    
    if (step.conditions.tags) {
      for (const [key, value] of Object.entries(step.conditions.tags)) {
        if (alert.labels[key] !== value) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const alertSystem = AlertSystem.getInstance();

// Initialize alert system
if (typeof window !== 'undefined') {
  // Start alert system after page load
  if (document.readyState === 'complete') {
    alertSystem.start();
  } else {
    window.addEventListener('load', () => {
      alertSystem.start();
    });
  }
}