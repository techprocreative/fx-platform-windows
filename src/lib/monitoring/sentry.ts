/**
 * Enhanced Sentry Monitoring Setup
 *
 * This file contains the comprehensive setup and configuration for Sentry error tracking
 * and performance monitoring with advanced features for production readiness.
 */

// Sentry is optional - install with: npm install @sentry/nextjs
let Sentry: any = null;
try {
  Sentry = require("@sentry/nextjs");
} catch (e) {
  console.warn("Sentry module not installed. Error monitoring disabled.");
  // Create mock Sentry object with all required methods
  Sentry = {
    init: () => {},
    captureException: () => {},
    captureMessage: () => {},
    setContext: () => {},
    setTag: () => {},
    setTags: () => {},
    setUser: () => {},
    setExtras: () => {},
    setMetrics: () => {},
    addBreadcrumb: () => {},
    withScope: (callback: any) => callback({}),
    startTransaction: () => ({
      setStatus: () => {},
      setTag: () => {},
      setExtras: () => {},
      finish: () => {},
      startChild: () => ({
        finish: () => {},
      }),
    }),
    BrowserTracing: class {},
    SeverityLevel: {
      Info: "info",
      Warning: "warning",
      Error: "error",
      Fatal: "fatal",
      Debug: "debug",
      Log: "log",
    },
    Severity: {
      Info: "info",
      Warning: "warning",
      Error: "error",
      Fatal: "fatal",
      Debug: "debug",
      Log: "log",
    },
  };
}

// Type definitions for Sentry when module is not installed
namespace Sentry {
  export type SeverityLevel =
    | "fatal"
    | "error"
    | "warning"
    | "log"
    | "info"
    | "debug";
  export interface Event {
    user?: any;
    exception?: any;
    [key: string]: any;
  }
  export interface EventHint {
    extra?: any;
    [key: string]: any;
  }
  export interface Transaction {
    setStatus(status: string): void;
    setTag(key: string, value: string): void;
    setExtras(extras: Record<string, any>): void;
    finish(): void;
    startChild(options: any): Span;
  }
  export interface Span {
    finish(): void;
  }
}
import * as React from "react";
import { CONFIG } from "../config";

// Enhanced error categorization
export enum ErrorCategory {
  AUTHENTICATION = "authentication",
  AUTHORIZATION = "authorization",
  VALIDATION = "validation",
  DATABASE = "database",
  EXTERNAL_API = "external_api",
  TRADING = "trading",
  WEBSOCKET = "websocket",
  BACKTEST = "backtest",
  PERFORMANCE = "performance",
  SYSTEM = "system",
  USER_INTERFACE = "user_interface",
  BUSINESS_LOGIC = "business_logic",
}

// Error severity levels
export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

// Custom error context interface
export interface CustomErrorContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  action?: string;
  component?: string;
  route?: string;
  userAgent?: string;
  ip?: string;
  timestamp?: Date;
  additionalData?: Record<string, any>;
}

// Performance monitoring context
export interface PerformanceContext {
  operationName: string;
  operationType: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

// User session tracking interface
export interface UserSession {
  id: string;
  userId: string;
  startTime: Date;
  lastActivity: Date;
  pageViews: number;
  errors: number;
  performanceMetrics: {
    averageLoadTime: number;
    totalRequests: number;
    failedRequests: number;
  };
  features: string[];
}

/**
 * Initialize Sentry for error tracking and performance monitoring
 */
export function initSentry() {
  // Only initialize if DSN is provided
  if (!CONFIG.MONITORING.SENTRY_DSN) {
    if (CONFIG.isDevelopment) {
      console.warn("Sentry DSN not provided. Error tracking disabled.");
    }
    return;
  }

  Sentry.init({
    dsn: CONFIG.MONITORING.SENTRY_DSN,
    environment: CONFIG.MONITORING.SENTRY_ENVIRONMENT,

    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: CONFIG.isProduction ? 0.1 : 1.0,

    // Performance monitoring
    integrations: [
      new Sentry.BrowserTracing({
        // Set `tracePropagationTargets` to control for which URLs distributed tracing should be enabled
        tracePropagationTargets: [
          "localhost",
          /^https:\/\/api\.nexustrade\.com/,
        ],
      }),
    ],

    // Before sending events, add additional data
    beforeSend(event: Sentry.Event) {
      // Add user context if available (this would be set during authentication)
      if (typeof window !== "undefined" && (window as any).__sentryUser) {
        event.user = (window as any).__sentryUser;
      }

      // Filter out certain errors in development
      if (CONFIG.isDevelopment) {
        // Don't send console errors in development
        if (
          event.exception?.values?.some(
            (exc: any) => exc.type === "ConsoleError",
          )
        ) {
          return null;
        }
      }

      return event;
    },

    // Ignore certain errors
    ignoreErrors: [
      // Random browser extensions
      "Non-Error promise rejection captured",
      // ResizeObserver loop limit exceeded
      "ResizeObserver loop limit exceeded",
      // Network errors that we can't control
      "Network request failed",
      "Failed to fetch",
    ],

    // Set release version if available
    release: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",

    // Debug mode in development
    debug: CONFIG.isDevelopment,
  });

  if (CONFIG.isDevelopment) {
    console.log(
      "Sentry initialized for error tracking and performance monitoring",
    );
  }
}

/**
 * Set user context for Sentry
 */
export function setUserContext(user: {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
  });

  // Also store in window for access in beforeSend
  if (typeof window !== "undefined") {
    (window as any).__sentryUser = {
      id: user.id,
      email: user.email,
      username: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
    };
  }
}

/**
 * Clear user context for Sentry
 */
export function clearUserContext() {
  Sentry.setUser(null);

  if (typeof window !== "undefined") {
    delete (window as any).__sentryUser;
  }
}

/**
 * Set tag context for Sentry
 */
export function setTagContext(tags: Record<string, string>) {
  Sentry.setTags(tags);
}

/**
 * Set extra context for Sentry
 */
export function setExtraContext(extras: Record<string, any>) {
  Sentry.setExtras(extras);
}

/**
 * Add breadcrumb to Sentry
 */
export function addBreadcrumb(
  message: string,
  category: string = "default",
  level: Sentry.SeverityLevel = Sentry.SeverityLevel.Info,
  data?: Record<string, any>,
) {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
  });
}

/**
 * Capture exception with additional context
 */
export function captureException(
  error: Error | string,
  context?: {
    tags?: Record<string, string>;
    extras?: Record<string, any>;
    level?: Sentry.SeverityLevel;
  },
) {
  if (context?.tags) {
    Sentry.setTags(context.tags);
  }

  if (context?.extras) {
    Sentry.setExtras(context.extras);
  }

  if (typeof error === "string") {
    Sentry.captureException(new Error(error), { level: context?.level });
  } else {
    Sentry.captureException(error, { level: context?.level });
  }
}

/**
 * Capture message with additional context
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = Sentry.SeverityLevel.Info,
  context?: {
    tags?: Record<string, string>;
    extras?: Record<string, any>;
  },
) {
  if (context?.tags) {
    Sentry.setTags(context.tags);
  }

  if (context?.extras) {
    Sentry.setExtras(context.extras);
  }

  Sentry.captureMessage(message, level);
}

/**
 * Start a performance transaction
 */
export function startTransaction(
  name: string,
  op: string = "navigation",
): Sentry.Transaction | undefined {
  if (!CONFIG.MONITORING.PERFORMANCE_MONITORING_ENABLED) {
    return undefined;
  }

  return Sentry.startTransaction({
    name,
    op,
  });
}

/**
 * Create a custom performance span
 */
export function startSpan(
  transaction: Sentry.Transaction | undefined,
  name: string,
  op: string = "custom",
): Sentry.Span | undefined {
  if (!transaction || !CONFIG.MONITORING.PERFORMANCE_MONITORING_ENABLED) {
    return undefined;
  }

  return transaction.startChild({
    op,
    description: name,
  });
}

/**
 * Measure performance of a function
 */
export async function measurePerformance<T>(
  name: string,
  fn: () => Promise<T> | T,
  tags?: Record<string, string>,
): Promise<T> {
  if (!CONFIG.MONITORING.PERFORMANCE_MONITORING_ENABLED) {
    return fn();
  }

  const transaction = startTransaction(name);

  try {
    if (tags) {
      setTagContext(tags);
    }

    const result = await fn();

    if (transaction) {
      transaction.setStatus("ok");
      transaction.finish();
    }

    return result;
  } catch (error) {
    if (transaction) {
      transaction.setStatus("internal_error");
      transaction.finish();
    }

    throw error;
  }
}

/**
 * Performance monitoring hook for React components
 */
export function usePerformanceMeasure(name: string) {
  const [transaction, setTransaction] = React.useState<
    Sentry.Transaction | undefined
  >();

  React.useEffect(() => {
    if (CONFIG.MONITORING.PERFORMANCE_MONITORING_ENABLED) {
      const tx = startTransaction(name, "react");
      setTransaction(tx);
      return () => {
        tx?.finish();
      };
    }
    return undefined;
  }, [name]);

  return {
    transaction,
    startSpan: (spanName: string, op: string = "react") =>
      transaction
        ? transaction.startChild({ op, description: spanName })
        : undefined,
  };
}

/**
 * Error boundary for React components that reports to Sentry
 */
export class SentryErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean; error?: Error; errorInfo?: React.ErrorInfo }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });

    captureException(error, {
      extras: {
        errorInfo,
        componentStack: errorInfo.componentStack,
      },
      tags: {
        handling: "error-boundary",
      },
    });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

/**
 * Higher-order component to wrap components with Sentry error boundary
 */
export function withSentryErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback: React.ReactNode,
) {
  return function WrappedComponent(props: P) {
    return React.createElement(SentryErrorBoundary, {
      fallback,
      children: React.createElement(Component, props),
    });
  };
}

// Enhanced error tracking functions

/**
 * Categorize error based on error type and context
 */
export function categorizeError(
  error: Error,
  context?: CustomErrorContext,
): ErrorCategory {
  const errorMessage = error.message.toLowerCase();
  const errorStack = error.stack?.toLowerCase() || "";

  // Database errors
  if (
    errorMessage.includes("database") ||
    errorMessage.includes("prisma") ||
    errorMessage.includes("connection") ||
    errorStack.includes("prisma")
  ) {
    return ErrorCategory.DATABASE;
  }

  // Authentication errors
  if (
    errorMessage.includes("unauthorized") ||
    errorMessage.includes("authentication") ||
    errorMessage.includes("jwt") ||
    errorMessage.includes("token")
  ) {
    return ErrorCategory.AUTHENTICATION;
  }

  // Authorization errors
  if (
    errorMessage.includes("forbidden") ||
    errorMessage.includes("permission") ||
    errorMessage.includes("access denied")
  ) {
    return ErrorCategory.AUTHORIZATION;
  }

  // Validation errors
  if (
    errorMessage.includes("validation") ||
    errorMessage.includes("invalid") ||
    errorMessage.includes("required") ||
    errorMessage.includes("format")
  ) {
    return ErrorCategory.VALIDATION;
  }

  // External API errors
  if (
    errorMessage.includes("network") ||
    errorMessage.includes("fetch") ||
    errorMessage.includes("timeout") ||
    errorMessage.includes("external")
  ) {
    return ErrorCategory.EXTERNAL_API;
  }

  // Trading errors
  if (
    errorMessage.includes("trade") ||
    errorMessage.includes("order") ||
    errorMessage.includes("position") ||
    errorMessage.includes("broker")
  ) {
    return ErrorCategory.TRADING;
  }

  // WebSocket errors
  if (
    errorMessage.includes("websocket") ||
    errorMessage.includes("socket") ||
    (errorMessage.includes("connection") && errorMessage.includes("real-time"))
  ) {
    return ErrorCategory.WEBSOCKET;
  }

  // Backtest errors
  if (
    errorMessage.includes("backtest") ||
    errorMessage.includes("strategy") ||
    errorMessage.includes("historical") ||
    errorMessage.includes("simulation")
  ) {
    return ErrorCategory.BACKTEST;
  }

  // Performance errors
  if (
    errorMessage.includes("timeout") ||
    errorMessage.includes("performance") ||
    errorMessage.includes("memory") ||
    errorMessage.includes("slow")
  ) {
    return ErrorCategory.PERFORMANCE;
  }

  // System errors
  if (
    errorMessage.includes("system") ||
    errorMessage.includes("server") ||
    errorMessage.includes("internal") ||
    errorMessage.includes("crash")
  ) {
    return ErrorCategory.SYSTEM;
  }

  // User interface errors
  if (
    errorStack.includes("react") ||
    errorStack.includes("component") ||
    errorStack.includes("render") ||
    context?.component
  ) {
    return ErrorCategory.USER_INTERFACE;
  }

  return ErrorCategory.BUSINESS_LOGIC;
}

/**
 * Determine error severity based on impact and context
 */
export function determineErrorSeverity(
  error: Error,
  category: ErrorCategory,
  context?: CustomErrorContext,
): ErrorSeverity {
  const errorMessage = error.message.toLowerCase();

  // Critical errors
  if (
    category === ErrorCategory.SYSTEM ||
    (category === ErrorCategory.DATABASE &&
      errorMessage.includes("connection")) ||
    (category === ErrorCategory.AUTHENTICATION &&
      errorMessage.includes("critical")) ||
    errorMessage.includes("crash") ||
    errorMessage.includes("fatal")
  ) {
    return ErrorSeverity.CRITICAL;
  }

  // High severity errors
  if (
    category === ErrorCategory.TRADING ||
    category === ErrorCategory.AUTHENTICATION ||
    category === ErrorCategory.DATABASE ||
    errorMessage.includes("failed") ||
    errorMessage.includes("error")
  ) {
    return ErrorSeverity.HIGH;
  }

  // Medium severity errors
  if (
    category === ErrorCategory.VALIDATION ||
    category === ErrorCategory.EXTERNAL_API ||
    category === ErrorCategory.PERFORMANCE ||
    errorMessage.includes("warning") ||
    errorMessage.includes("deprecated")
  ) {
    return ErrorSeverity.MEDIUM;
  }

  // Low severity errors
  if (
    category === ErrorCategory.USER_INTERFACE ||
    errorMessage.includes("info") ||
    errorMessage.includes("minor")
  ) {
    return ErrorSeverity.LOW;
  }

  return ErrorSeverity.MEDIUM;
}

/**
 * Enhanced error capture with categorization and context
 */
export function captureEnhancedError(
  error: Error | string,
  context?: CustomErrorContext,
  level?: Sentry.SeverityLevel,
): void {
  const errorObj = typeof error === "string" ? new Error(error) : error;
  const category = categorizeError(errorObj, context);
  const severity = determineErrorSeverity(errorObj, category, context);

  // Set tags for categorization
  Sentry.setTags({
    error_category: category,
    error_severity: severity,
    ...(context?.component && { component: context.component }),
    ...(context?.action && { action: context.action }),
    ...(context?.route && { route: context.route }),
  });

  // Set additional context
  Sentry.setExtras({
    error_category: category,
    error_severity: severity,
    timestamp: new Date().toISOString(),
    ...context?.additionalData,
  });

  // Add user context if available
  if (context?.userId) {
    Sentry.setUser({ id: context.userId });
  }

  // Add breadcrumb for error tracking
  addBreadcrumb(
    `Error captured: ${category} - ${severity}`,
    "error",
    level || Sentry.SeverityLevel.Error,
    {
      errorMessage: errorObj.message,
      category,
      severity,
      ...context?.additionalData,
    },
  );

  // Capture the exception
  Sentry.captureException(errorObj, { level });
}

/**
 * Track user session for monitoring
 */
export class UserSessionTracker {
  private static instance: UserSessionTracker;
  private sessions: Map<string, UserSession> = new Map();

  static getInstance(): UserSessionTracker {
    if (!UserSessionTracker.instance) {
      UserSessionTracker.instance = new UserSessionTracker();
    }
    return UserSessionTracker.instance;
  }

  /**
   * Start a new user session
   */
  startSession(userId: string, sessionId?: string): string {
    const id = sessionId || this.generateSessionId();
    const session: UserSession = {
      id,
      userId,
      startTime: new Date(),
      lastActivity: new Date(),
      pageViews: 0,
      errors: 0,
      performanceMetrics: {
        averageLoadTime: 0,
        totalRequests: 0,
        failedRequests: 0,
      },
      features: [],
    };

    this.sessions.set(id, session);

    Sentry.setUser({
      id: userId,
      sessionId: id,
    });

    Sentry.setTags({
      session_id: id,
      user_id: userId,
    });

    return id;
  }

  /**
   * Update session activity
   */
  updateActivity(sessionId: string, data: Partial<UserSession>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      Object.assign(session, data);

      // Update Sentry context
      Sentry.setExtras({
        session_page_views: session.pageViews,
        session_errors: session.errors,
        session_duration: Date.now() - session.startTime.getTime(),
      });
    }
  }

  /**
   * Track page view in session
   */
  trackPageView(sessionId: string, route: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pageViews++;
      session.lastActivity = new Date();

      addBreadcrumb(
        `Page viewed: ${route}`,
        "navigation",
        Sentry.SeverityLevel.Info,
        { route, sessionId },
      );
    }
  }

  /**
   * Track error in session
   */
  trackError(sessionId: string, error: Error, category: ErrorCategory): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.errors++;
      session.lastActivity = new Date();

      Sentry.setExtras({
        session_errors: session.errors,
      });
    }
  }

  /**
   * Track performance metrics
   */
  trackPerformance(
    sessionId: string,
    loadTime: number,
    success: boolean,
  ): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.performanceMetrics.totalRequests++;
      if (!success) {
        session.performanceMetrics.failedRequests++;
      }

      // Update average load time
      const total =
        session.performanceMetrics.averageLoadTime *
          (session.performanceMetrics.totalRequests - 1) +
        loadTime;
      session.performanceMetrics.averageLoadTime =
        total / session.performanceMetrics.totalRequests;

      Sentry.setMetrics({
        session_avg_load_time: session.performanceMetrics.averageLoadTime,
        session_success_rate:
          ((session.performanceMetrics.totalRequests -
            session.performanceMetrics.failedRequests) /
            session.performanceMetrics.totalRequests) *
          100,
      });
    }
  }

  /**
   * End session
   */
  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      const duration = Date.now() - session.startTime.getTime();

      addBreadcrumb(
        `Session ended: ${sessionId}`,
        "session",
        Sentry.SeverityLevel.Info,
        {
          sessionId,
          duration,
          pageViews: session.pageViews,
          errors: session.errors,
          avgLoadTime: session.performanceMetrics.averageLoadTime,
        },
      );

      this.sessions.delete(sessionId);
      Sentry.setUser(null);
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get active session
   */
  getSession(sessionId: string): UserSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Clean up old sessions
   */
  cleanupOldSessions(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    const entries = Array.from(this.sessions.entries());
    for (const [id, session] of entries) {
      if (now - session.lastActivity.getTime() > maxAge) {
        this.endSession(id);
      }
    }
  }
}

/**
 * Performance monitoring with enhanced tracking
 */
export function trackPerformance(
  operationName: string,
  operationType: string,
  context?: PerformanceContext,
): {
  start: () => void;
  end: (success?: boolean) => void;
  cancel: () => void;
} {
  let transaction: Sentry.Transaction | undefined;
  let startTime: number | undefined;

  return {
    start: () => {
      if (!CONFIG.MONITORING.PERFORMANCE_MONITORING_ENABLED) return;

      startTime = Date.now();
      transaction = Sentry.startTransaction({
        name: operationName,
        op: operationType,
      });

      // Set context data
      if (transaction && context?.userId) {
        transaction.setTag("user_id", context.userId);
      }
      if (transaction && context?.sessionId) {
        transaction.setTag("session_id", context.sessionId);
      }
      if (transaction && context?.metadata) {
        transaction.setExtras(context.metadata);
      }
    },

    end: (success: boolean = true) => {
      if (transaction && typeof transaction.setStatus === "function") {
        transaction.setStatus(success ? "ok" : "internal_error");
      }
      if (transaction && typeof transaction.finish === "function") {
        transaction.finish();
      }

      if (startTime && context?.sessionId) {
        const duration = Date.now() - startTime;
        UserSessionTracker.getInstance().trackPerformance(
          context.sessionId,
          duration,
          success,
        );
      }
    },

    cancel: () => {
      if (transaction) {
        transaction.setStatus("cancelled");
        transaction.finish();
      }
    },
  };
}

/**
 * Error rate monitoring
 */
export class ErrorRateMonitor {
  private static instance: ErrorRateMonitor;
  private errorCounts: Map<string, { count: number; lastReset: number }> =
    new Map();
  private readonly RESET_INTERVAL = 5 * 60 * 1000; // 5 minutes

  static getInstance(): ErrorRateMonitor {
    if (!ErrorRateMonitor.instance) {
      ErrorRateMonitor.instance = new ErrorRateMonitor();
    }
    return ErrorRateMonitor.instance;
  }

  /**
   * Record an error
   */
  recordError(category: ErrorCategory, context?: CustomErrorContext): void {
    const key = context?.userId ? `${category}:${context.userId}` : category;
    const now = Date.now();

    const current = this.errorCounts.get(key);
    if (!current || now - current.lastReset > this.RESET_INTERVAL) {
      this.errorCounts.set(key, { count: 1, lastReset: now });
    } else {
      current.count++;
    }

    // Check if error rate exceeds threshold
    if (current && current.count > 10) {
      // 10 errors in 5 minutes
      this.triggerAlert(category, current.count, context);
    }
  }

  /**
   * Get error rate for a category
   */
  getErrorRate(category: ErrorCategory, userId?: string): number {
    const key = userId ? `${category}:${userId}` : category;
    const current = this.errorCounts.get(key);

    if (!current) return 0;

    const now = Date.now();
    const timeDiff = now - current.lastReset;
    if (timeDiff > this.RESET_INTERVAL) return 0;

    // Calculate rate per minute
    return (current.count / timeDiff) * 60000;
  }

  /**
   * Trigger alert for high error rate
   */
  private triggerAlert(
    category: ErrorCategory,
    count: number,
    context?: CustomErrorContext,
  ): void {
    captureEnhancedError(
      new Error(
        `High error rate detected: ${count} errors in 5 minutes for category: ${category}`,
      ),
      {
        ...context,
        additionalData: {
          ...context?.additionalData,
          error_count: count,
          error_category: category,
          alert_type: "high_error_rate",
        },
      },
      Sentry.SeverityLevel.Warning,
    );
  }

  /**
   * Clean up old error counts
   */
  cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.errorCounts.entries());
    for (const [key, data] of entries) {
      if (now - data.lastReset > this.RESET_INTERVAL * 2) {
        this.errorCounts.delete(key);
      }
    }
  }
}

// Initialize error rate monitor
const errorRateMonitor = ErrorRateMonitor.getInstance();

// Override captureException to include error rate monitoring
const originalCaptureException = Sentry.captureException;
Sentry.captureException = (exception: any, hint?: Sentry.EventHint) => {
  // Extract context from hint
  const context = hint?.extra as CustomErrorContext;
  if (context) {
    const category = categorizeError(
      exception instanceof Error ? exception : new Error(exception),
      context,
    );
    errorRateMonitor.recordError(category, context);
  }

  return originalCaptureException(exception, hint);
};
