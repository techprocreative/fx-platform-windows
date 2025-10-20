/**
 * Business Metrics Dashboard
 * 
 * This module provides comprehensive business metrics tracking for the FX trading platform:
 * - Strategy performance metrics
 * - User engagement tracking
 * - Trading volume monitoring
 * - System health indicators
 * - Conversion funnels
 * - Revenue tracking
 */

import { captureEnhancedError, addBreadcrumb, ErrorCategory } from './sentry';

// Strategy performance metrics interface
export interface StrategyMetrics {
  strategyId: string;
  strategyName: string;
  userId: string;
  
  // Performance metrics
  totalReturn: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  
  // Trading metrics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  averageWin: number;
  averageLoss: number;
  
  // Risk metrics
  riskScore: number;
  volatility: number;
  valueAtRisk: number;
  
  // Time metrics
  createdAt: Date;
  lastActive: Date;
  uptime: number;
  
  // User metrics
  subscribers: number;
  rating: number;
  reviews: number;
}

// User engagement metrics interface
export interface UserEngagementMetrics {
  userId: string;
  
  // Activity metrics
  dailyActiveTime: number;
  weeklyActiveTime: number;
  monthlyActiveTime: number;
  
  // Feature usage
  strategiesCreated: number;
  backtestsRun: number;
  tradesExecuted: number;
  
  // Session metrics
  sessionCount: number;
  averageSessionDuration: number;
  bounceRate: number;
  
  // Engagement metrics
  pagesPerSession: number;
  featureAdoptionRate: number;
  retentionRate: number;
  
  // Timestamps
  lastLogin: Date;
  registrationDate: Date;
  
  // Geographic data
  country?: string;
  timezone?: string;
}

// Trading volume metrics interface
export interface TradingVolumeMetrics {
  timestamp: Date;
  period: 'hour' | 'day' | 'week' | 'month';
  
  // Volume metrics
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  
  // Trade metrics
  tradeCount: number;
  uniqueTraders: number;
  averageTradeSize: number;
  
  // Symbol breakdown
  symbolVolumes: Record<string, number>;
  topSymbols: Array<{ symbol: string; volume: number; percentage: number }>;
  
  // Geographic breakdown
  countryVolumes: Record<string, number>;
  
  // Revenue metrics
  totalRevenue: number;
  commissionRevenue: number;
  spreadRevenue: number;
}

// System health indicators interface
export interface SystemHealthMetrics {
  timestamp: Date;
  
  // Service status
  apiHealth: 'healthy' | 'degraded' | 'down';
  databaseHealth: 'healthy' | 'degraded' | 'down';
  websocketHealth: 'healthy' | 'degraded' | 'down';
  
  // Performance metrics
  averageResponseTime: number;
  errorRate: number;
  throughput: number;
  
  // Resource metrics
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  
  // Business metrics
  activeUsers: number;
  activeStrategies: number;
  processingQueue: number;
  
  // External dependencies
  brokerConnectivity: Record<string, boolean>;
  dataProviderStatus: Record<string, boolean>;
}

// Conversion funnel metrics interface
export interface ConversionFunnelMetrics {
  timestamp: Date;
  period: 'day' | 'week' | 'month';
  
  // Funnel stages
  visitors: number;
  signups: number;
  activatedUsers: number;
  firstStrategy: number;
  firstTrade: number;
  payingUsers: number;
  
  // Conversion rates
  visitorToSignup: number;
  signupToActivation: number;
  activationToStrategy: number;
  strategyToTrade: number;
  tradeToPayment: number;
  
  // Time metrics
  averageTimeToSignup: number;
  averageTimeToActivation: number;
  averageTimeToFirstTrade: number;
  averageTimeToPayment: number;
  
  // Source breakdown
  trafficSources: Record<string, { visitors: number; conversions: number }>;
}

// Revenue tracking metrics interface
export interface RevenueMetrics {
  timestamp: Date;
  period: 'day' | 'week' | 'month';
  
  // Total revenue
  totalRevenue: number;
  
  // Revenue breakdown
  subscriptionRevenue: number;
  commissionRevenue: number;
  spreadRevenue: number;
  premiumFeaturesRevenue: number;
  
  // User metrics
  payingUsers: number;
  averageRevenuePerUser: number;
  customerLifetimeValue: number;
  
  // Subscription metrics
  newSubscriptions: number;
  churnedSubscriptions: number;
  netSubscriptionGrowth: number;
  
  // Feature revenue
  strategyMarketplaceRevenue: number;
  advancedAnalyticsRevenue: number;
  apiAccessRevenue: number;
  
  // Geographic revenue
  revenueByCountry: Record<string, number>;
}

// Business alert interface
export interface BusinessAlert {
  id: string;
  type: 'strategy_performance' | 'user_engagement' | 'trading_volume' | 'system_health' | 'conversion_rate' | 'revenue';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
  context?: Record<string, any>;
}

export class BusinessMetricsCollector {
  private static instance: BusinessMetricsCollector;
  private strategyMetrics: StrategyMetrics[] = [];
  private userEngagementMetrics: UserEngagementMetrics[] = [];
  private tradingVolumeMetrics: TradingVolumeMetrics[] = [];
  private systemHealthMetrics: SystemHealthMetrics[] = [];
  private conversionFunnelMetrics: ConversionFunnelMetrics[] = [];
  private revenueMetrics: RevenueMetrics[] = [];
  private businessAlerts: BusinessAlert[] = [];
  private maxMetricsSize: number = 10000;
  private isCollecting: boolean = false;
  
  private constructor() {}
  
  static getInstance(): BusinessMetricsCollector {
    if (!BusinessMetricsCollector.instance) {
      BusinessMetricsCollector.instance = new BusinessMetricsCollector();
    }
    return BusinessMetricsCollector.instance;
  }
  
  /**
   * Start metrics collection
   */
  startCollection(): void {
    if (this.isCollecting) return;
    
    this.isCollecting = true;
    this.schedulePeriodicCollection();
    
    addBreadcrumb(
      'Business metrics collection started',
      'business_metrics',
      'info'
    );
  }
  
  /**
   * Stop metrics collection
   */
  stopCollection(): void {
    this.isCollecting = false;
    
    addBreadcrumb(
      'Business metrics collection stopped',
      'business_metrics',
      'info'
    );
  }
  
  /**
   * Record strategy metrics
   */
  recordStrategyMetrics(metrics: Omit<StrategyMetrics, 'lastActive'>): void {
    const strategyMetrics: StrategyMetrics = {
      ...metrics,
      lastActive: new Date()
    };
    
    // Update existing strategy or add new one
    const existingIndex = this.strategyMetrics.findIndex(s => s.strategyId === metrics.strategyId);
    if (existingIndex >= 0) {
      this.strategyMetrics[existingIndex] = strategyMetrics;
    } else {
      this.strategyMetrics.push(strategyMetrics);
    }
    
    // Limit array size
    if (this.strategyMetrics.length > this.maxMetricsSize) {
      this.strategyMetrics.shift();
    }
    
    this.checkStrategyPerformanceThresholds(strategyMetrics);
  }
  
  /**
   * Record user engagement metrics
   */
  recordUserEngagementMetrics(metrics: Omit<UserEngagementMetrics, 'lastLogin'>): void {
    const engagementMetrics: UserEngagementMetrics = {
      ...metrics,
      lastLogin: new Date()
    };
    
    // Update existing user or add new one
    const existingIndex = this.userEngagementMetrics.findIndex(u => u.userId === metrics.userId);
    if (existingIndex >= 0) {
      this.userEngagementMetrics[existingIndex] = engagementMetrics;
    } else {
      this.userEngagementMetrics.push(engagementMetrics);
    }
    
    // Limit array size
    if (this.userEngagementMetrics.length > this.maxMetricsSize) {
      this.userEngagementMetrics.shift();
    }
    
    this.checkUserEngagementThresholds(engagementMetrics);
  }
  
  /**
   * Record trading volume metrics
   */
  recordTradingVolumeMetrics(metrics: TradingVolumeMetrics): void {
    this.tradingVolumeMetrics.push(metrics);
    
    // Limit array size
    if (this.tradingVolumeMetrics.length > this.maxMetricsSize) {
      this.tradingVolumeMetrics.shift();
    }
    
    this.checkTradingVolumeThresholds(metrics);
  }
  
  /**
   * Record system health metrics
   */
  recordSystemHealthMetrics(metrics: SystemHealthMetrics): void {
    this.systemHealthMetrics.push(metrics);
    
    // Limit array size
    if (this.systemHealthMetrics.length > this.maxMetricsSize) {
      this.systemHealthMetrics.shift();
    }
    
    this.checkSystemHealthThresholds(metrics);
  }
  
  /**
   * Record conversion funnel metrics
   */
  recordConversionFunnelMetrics(metrics: ConversionFunnelMetrics): void {
    this.conversionFunnelMetrics.push(metrics);
    
    // Limit array size
    if (this.conversionFunnelMetrics.length > this.maxMetricsSize) {
      this.conversionFunnelMetrics.shift();
    }
    
    this.checkConversionFunnelThresholds(metrics);
  }
  
  /**
   * Record revenue metrics
   */
  recordRevenueMetrics(metrics: Omit<RevenueMetrics, 'totalRevenue'>): void {
    const totalRevenue = metrics.subscriptionRevenue +
                        metrics.commissionRevenue +
                        metrics.spreadRevenue +
                        metrics.premiumFeaturesRevenue;
    
    const revenueMetrics: RevenueMetrics = {
      ...metrics,
      totalRevenue
    };
    
    this.revenueMetrics.push(revenueMetrics);
    
    // Limit array size
    if (this.revenueMetrics.length > this.maxMetricsSize) {
      this.revenueMetrics.shift();
    }
    
    this.checkRevenueThresholds(revenueMetrics);
  }
  
  /**
   * Get strategy performance summary
   */
  getStrategyPerformanceSummary(periodStart?: Date, periodEnd?: Date): {
    totalStrategies: number;
    activeStrategies: number;
    averageReturn: number;
    averageWinRate: number;
    topPerformers: StrategyMetrics[];
    worstPerformers: StrategyMetrics[];
  } {
    let filteredMetrics = this.strategyMetrics;
    
    if (periodStart || periodEnd) {
      filteredMetrics = this.strategyMetrics.filter(s => {
        const timestamp = s.lastActive;
        if (periodStart && timestamp < periodStart) return false;
        if (periodEnd && timestamp > periodEnd) return false;
        return true;
      });
    }
    
    const activeStrategies = filteredMetrics.filter(s => 
      Date.now() - s.lastActive.getTime() < 7 * 24 * 60 * 60 * 1000 // Active in last 7 days
    );
    
    const totalReturns = filteredMetrics.map(s => s.totalReturn);
    const winRates = filteredMetrics.map(s => s.winRate);
    
    const averageReturn = totalReturns.length > 0 
      ? totalReturns.reduce((sum, r) => sum + r, 0) / totalReturns.length 
      : 0;
    
    const averageWinRate = winRates.length > 0 
      ? winRates.reduce((sum, r) => sum + r, 0) / winRates.length 
      : 0;
    
    const sortedByReturn = [...filteredMetrics].sort((a, b) => b.totalReturn - a.totalReturn);
    const topPerformers = sortedByReturn.slice(0, 10);
    const worstPerformers = sortedByReturn.slice(-10).reverse();
    
    return {
      totalStrategies: filteredMetrics.length,
      activeStrategies: activeStrategies.length,
      averageReturn,
      averageWinRate,
      topPerformers,
      worstPerformers
    };
  }
  
  /**
   * Get user engagement summary
   */
  getUserEngagementSummary(periodStart?: Date, periodEnd?: Date): {
    totalUsers: number;
    activeUsers: number;
    averageSessionDuration: number;
    averageEngagementScore: number;
    topEngagedUsers: UserEngagementMetrics[];
    featureAdoptionRates: Record<string, number>;
  } {
    let filteredMetrics = this.userEngagementMetrics;
    
    if (periodStart || periodEnd) {
      filteredMetrics = this.userEngagementMetrics.filter(u => {
        const timestamp = u.lastLogin;
        if (periodStart && timestamp < periodStart) return false;
        if (periodEnd && timestamp > periodEnd) return false;
        return true;
      });
    }
    
    const activeUsers = filteredMetrics.filter(u => 
      Date.now() - u.lastLogin.getTime() < 7 * 24 * 60 * 60 * 1000 // Active in last 7 days
    );
    
    const sessionDurations = filteredMetrics.map(u => u.averageSessionDuration);
    const averageSessionDuration = sessionDurations.length > 0
      ? sessionDurations.reduce((sum, d) => sum + d, 0) / sessionDurations.length
      : 0;
    
    // Calculate engagement score (0-100)
    const engagementScores = filteredMetrics.map(u => {
      const activityScore = Math.min(u.dailyActiveTime / (60 * 60), 1) * 30; // Max 30 points
      const featureScore = Math.min(u.featureAdoptionRate, 1) * 40; // Max 40 points
      const retentionScore = Math.min(u.retentionRate, 1) * 30; // Max 30 points
      return activityScore + featureScore + retentionScore;
    });
    
    const averageEngagementScore = engagementScores.length > 0
      ? engagementScores.reduce((sum, s) => sum + s, 0) / engagementScores.length
      : 0;
    
    const topEngagedUsers = filteredMetrics
      .map((user, index) => ({ ...user, engagementScore: engagementScores[index] }))
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 10);
    
    // Calculate feature adoption rates
    const totalUsers = filteredMetrics.length;
    const featureAdoptionRates = {
      strategiesCreated: totalUsers > 0 ? filteredMetrics.filter(u => u.strategiesCreated > 0).length / totalUsers : 0,
      backtestsRun: totalUsers > 0 ? filteredMetrics.filter(u => u.backtestsRun > 0).length / totalUsers : 0,
      tradesExecuted: totalUsers > 0 ? filteredMetrics.filter(u => u.tradesExecuted > 0).length / totalUsers : 0
    };
    
    return {
      totalUsers: filteredMetrics.length,
      activeUsers: activeUsers.length,
      averageSessionDuration,
      averageEngagementScore,
      topEngagedUsers,
      featureAdoptionRates
    };
  }
  
  /**
   * Get trading volume summary
   */
  getTradingVolumeSummary(periodStart?: Date, periodEnd?: Date): {
    totalVolume: number;
    totalTrades: number;
    averageTradeSize: number;
    topSymbols: Array<{ symbol: string; volume: number; percentage: number }>;
    volumeTrend: Array<{ timestamp: Date; volume: number }>;
  } {
    let filteredMetrics = this.tradingVolumeMetrics;
    
    if (periodStart || periodEnd) {
      filteredMetrics = this.tradingVolumeMetrics.filter(v => {
        const timestamp = v.timestamp;
        if (periodStart && timestamp < periodStart) return false;
        if (periodEnd && timestamp > periodEnd) return false;
        return true;
      });
    }
    
    const totalVolume = filteredMetrics.reduce((sum, v) => sum + v.totalVolume, 0);
    const totalTrades = filteredMetrics.reduce((sum, v) => sum + v.tradeCount, 0);
    const averageTradeSize = totalTrades > 0 ? totalVolume / totalTrades : 0;
    
    // Aggregate symbol volumes
    const symbolVolumes = new Map<string, number>();
    filteredMetrics.forEach(v => {
      Object.entries(v.symbolVolumes).forEach(([symbol, volume]) => {
        symbolVolumes.set(symbol, (symbolVolumes.get(symbol) || 0) + volume);
      });
    });
    
    const topSymbols = Array.from(symbolVolumes.entries())
      .map(([symbol, volume]) => ({
        symbol,
        volume,
        percentage: totalVolume > 0 ? (volume / totalVolume) * 100 : 0
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);
    
    const volumeTrend = filteredMetrics
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map(v => ({ timestamp: v.timestamp, volume: v.totalVolume }));
    
    return {
      totalVolume,
      totalTrades,
      averageTradeSize,
      topSymbols,
      volumeTrend
    };
  }
  
  /**
   * Get business alerts
   */
  getBusinessAlerts(severity?: 'info' | 'warning' | 'critical'): BusinessAlert[] {
    let filteredAlerts = this.businessAlerts;
    
    if (severity) {
      filteredAlerts = filteredAlerts.filter(alert => alert.severity === severity);
    }
    
    return filteredAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  
  /**
   * Schedule periodic collection
   */
  private schedulePeriodicCollection(): void {
    if (!this.isCollecting) return;
    
    // Collect system health metrics every minute
    setTimeout(() => {
      if (this.isCollecting) {
        this.collectSystemHealthMetrics();
        this.schedulePeriodicCollection();
      }
    }, 60000);
  }
  
  /**
   * Collect system health metrics
   */
  private collectSystemHealthMetrics(): void {
    // This would typically be called by a monitoring service
    // For now, we'll create placeholder metrics
    const metrics: SystemHealthMetrics = {
      timestamp: new Date(),
      apiHealth: 'healthy',
      databaseHealth: 'healthy',
      websocketHealth: 'healthy',
      averageResponseTime: 200,
      errorRate: 0.1,
      throughput: 1000,
      cpuUsage: 45,
      memoryUsage: 60,
      diskUsage: 30,
      activeUsers: this.userEngagementMetrics.filter(u => 
        Date.now() - u.lastLogin.getTime() < 24 * 60 * 60 * 1000
      ).length,
      activeStrategies: this.strategyMetrics.filter(s => 
        Date.now() - s.lastActive.getTime() < 24 * 60 * 60 * 1000
      ).length,
      processingQueue: 0,
      brokerConnectivity: {},
      dataProviderStatus: {}
    };
    
    this.recordSystemHealthMetrics(metrics);
  }
  
  /**
   * Check strategy performance thresholds
   */
  private checkStrategyPerformanceThresholds(metrics: StrategyMetrics): void {
    // Low win rate alert
    if (metrics.winRate < 0.3 && metrics.totalTrades > 10) {
      this.createBusinessAlert(
        'strategy_performance',
        'warning',
        'Low Strategy Win Rate',
        `Strategy "${metrics.strategyName}" has a low win rate of ${(metrics.winRate * 100).toFixed(1)}%`,
        'winRate',
        metrics.winRate,
        0.3,
        {
          strategyId: metrics.strategyId,
          strategyName: metrics.strategyName,
          userId: metrics.userId,
          totalTrades: metrics.totalTrades
        }
      );
    }
    
    // High drawdown alert
    if (metrics.maxDrawdown > 0.2) {
      this.createBusinessAlert(
        'strategy_performance',
        'critical',
        'High Strategy Drawdown',
        `Strategy "${metrics.strategyName}" has a high drawdown of ${(metrics.maxDrawdown * 100).toFixed(1)}%`,
        'maxDrawdown',
        metrics.maxDrawdown,
        0.2,
        {
          strategyId: metrics.strategyId,
          strategyName: metrics.strategyName,
          userId: metrics.userId
        }
      );
    }
  }
  
  /**
   * Check user engagement thresholds
   */
  private checkUserEngagementThresholds(metrics: UserEngagementMetrics): void {
    // Low engagement alert
    if (metrics.dailyActiveTime < 300 && metrics.sessionCount > 5) { // Less than 5 minutes per day
      this.createBusinessAlert(
        'user_engagement',
        'warning',
        'Low User Engagement',
        `User ${metrics.userId} shows low engagement with only ${metrics.dailyActiveTime}s daily active time`,
        'dailyActiveTime',
        metrics.dailyActiveTime,
        300,
        {
          userId: metrics.userId,
          sessionCount: metrics.sessionCount,
          lastLogin: metrics.lastLogin
        }
      );
    }
    
    // High churn risk
    const daysSinceLastLogin = (Date.now() - metrics.lastLogin.getTime()) / (24 * 60 * 60 * 1000);
    if (daysSinceLastLogin > 7 && metrics.retentionRate < 0.5) {
      this.createBusinessAlert(
        'user_engagement',
        'critical',
        'High Churn Risk',
        `User ${metrics.userId} is at high risk of churn - last login ${daysSinceLastLogin.toFixed(0)} days ago`,
        'daysSinceLastLogin',
        daysSinceLastLogin,
        7,
        {
          userId: metrics.userId,
          retentionRate: metrics.retentionRate,
          lastLogin: metrics.lastLogin
        }
      );
    }
  }
  
  /**
   * Check trading volume thresholds
   */
  private checkTradingVolumeThresholds(metrics: TradingVolumeMetrics): void {
    // Low volume alert
    if (metrics.totalVolume < 10000 && metrics.tradeCount > 0) {
      this.createBusinessAlert(
        'trading_volume',
        'warning',
        'Low Trading Volume',
        `Trading volume for ${metrics.period} is low: $${metrics.totalVolume.toLocaleString()}`,
        'totalVolume',
        metrics.totalVolume,
        10000,
        {
          period: metrics.period,
          tradeCount: metrics.tradeCount,
          timestamp: metrics.timestamp
        }
      );
    }
  }
  
  /**
   * Check system health thresholds
   */
  private checkSystemHealthThresholds(metrics: SystemHealthMetrics): void {
    // High error rate alert
    if (metrics.errorRate > 0.05) { // 5% error rate
      this.createBusinessAlert(
        'system_health',
        'critical',
        'High System Error Rate',
        `System error rate is ${(metrics.errorRate * 100).toFixed(1)}%`,
        'errorRate',
        metrics.errorRate,
        0.05,
        {
          averageResponseTime: metrics.averageResponseTime,
          throughput: metrics.throughput,
          timestamp: metrics.timestamp
        }
      );
    }
    
    // Service degradation alert
    if (metrics.apiHealth === 'degraded' || metrics.databaseHealth === 'degraded') {
      this.createBusinessAlert(
        'system_health',
        'warning',
        'Service Degradation',
        `Service degradation detected: API=${metrics.apiHealth}, DB=${metrics.databaseHealth}`,
        'serviceHealth',
        0,
        0,
        {
          apiHealth: metrics.apiHealth,
          databaseHealth: metrics.databaseHealth,
          websocketHealth: metrics.websocketHealth,
          timestamp: metrics.timestamp
        }
      );
    }
  }
  
  /**
   * Check conversion funnel thresholds
   */
  private checkConversionFunnelThresholds(metrics: ConversionFunnelMetrics): void {
    // Low conversion rate alert
    if (metrics.visitorToSignup < 0.02) { // Less than 2% conversion
      this.createBusinessAlert(
        'conversion_rate',
        'warning',
        'Low Visitor to Signup Conversion',
        `Visitor to signup conversion rate is ${(metrics.visitorToSignup * 100).toFixed(1)}%`,
        'visitorToSignup',
        metrics.visitorToSignup,
        0.02,
        {
          period: metrics.period,
          visitors: metrics.visitors,
          signups: metrics.signups,
          timestamp: metrics.timestamp
        }
      );
    }
  }
  
  /**
   * Check revenue thresholds
   */
  private checkRevenueThresholds(metrics: RevenueMetrics): void {
    // Revenue decline alert
    if (this.revenueMetrics.length > 1) {
      const previousMetrics = this.revenueMetrics[this.revenueMetrics.length - 2];
      const revenueChange = (metrics.totalRevenue - previousMetrics.totalRevenue) / previousMetrics.totalRevenue;
      
      if (revenueChange < -0.1) { // More than 10% decline
        this.createBusinessAlert(
          'revenue',
          'critical',
          'Revenue Decline',
          `Revenue declined by ${(revenueChange * 100).toFixed(1)}% compared to previous ${metrics.period}`,
          'revenueChange',
          revenueChange,
          -0.1,
          {
            period: metrics.period,
            currentRevenue: metrics.totalRevenue,
            previousRevenue: previousMetrics.totalRevenue,
            timestamp: metrics.timestamp
          }
        );
      }
    }
  }
  
  /**
   * Create business alert
   */
  private createBusinessAlert(
    type: BusinessAlert['type'],
    severity: BusinessAlert['severity'],
    title: string,
    message: string,
    metric: string,
    value: number,
    threshold: number,
    context?: Record<string, any>
  ): void {
    const alert: BusinessAlert = {
      id: `business_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      title,
      message,
      metric,
      value,
      threshold,
      timestamp: new Date(),
      context
    };
    
    this.businessAlerts.push(alert);
    
    // Limit alerts size
    if (this.businessAlerts.length > 1000) {
      this.businessAlerts.shift();
    }
    
    // Send to Sentry
    captureEnhancedError(
      new Error(`Business Alert: ${title}`),
      {
        component: 'BusinessMetricsCollector',
        action: 'business_alert',
        additionalData: {
          alertType: type,
          severity,
          metric,
          value,
          threshold,
          ...context
        }
      }
    );
  }
}

// Export singleton instance
export const businessMetricsCollector = BusinessMetricsCollector.getInstance();

// Utility functions for recording metrics
export function recordStrategyPerformance(
  strategyId: string,
  strategyName: string,
  userId: string,
  performance: {
    totalReturn: number;
    winRate: number;
    profitFactor: number;
    maxDrawdown: number;
    sharpeRatio: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    averageWin: number;
    averageLoss: number;
  }
): void {
  businessMetricsCollector.recordStrategyMetrics({
    strategyId,
    strategyName,
    userId,
    ...performance,
    riskScore: 0, // Would be calculated based on strategy parameters
    volatility: 0, // Would be calculated from returns
    valueAtRisk: 0, // Would be calculated from historical data
    createdAt: new Date(),
    uptime: 0,
    subscribers: 0,
    rating: 0,
    reviews: 0
  });
}

export function recordUserEngagement(
  userId: string,
  engagement: {
    dailyActiveTime: number;
    weeklyActiveTime: number;
    monthlyActiveTime: number;
    strategiesCreated: number;
    backtestsRun: number;
    tradesExecuted: number;
    sessionCount: number;
    averageSessionDuration: number;
    bounceRate: number;
    pagesPerSession: number;
    featureAdoptionRate: number;
    retentionRate: number;
    registrationDate: Date;
    country?: string;
    timezone?: string;
  }
): void {
  businessMetricsCollector.recordUserEngagementMetrics({
    userId,
    ...engagement
  });
}

// Initialize business metrics collection
if (typeof window !== 'undefined') {
  // Start collection after page load
  if (document.readyState === 'complete') {
    businessMetricsCollector.startCollection();
  } else {
    window.addEventListener('load', () => {
      businessMetricsCollector.startCollection();
    });
  }
}