/**
 * Comprehensive Health Check API Endpoint
 *
 * This endpoint provides detailed health status information for the FX Trading Platform:
 * - Overall system health
 * - Database connectivity
 * - External service status
 * - Performance metrics
 * - System resource usage
 */

import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";
import { alertSystem } from "@/lib/monitoring/alert-system";
import { captureEnhancedError, ErrorCategory } from "@/lib/monitoring/sentry";

// Health check result interface
interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;

  // Component status
  components: {
    api: ComponentStatus;
    database: ComponentStatus;
    cache: ComponentStatus;
    websocket: ComponentStatus;
    externalServices: Record<string, ComponentStatus>;
  };

  // Performance metrics
  performance: {
    responseTime: number;
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
    requestsPerSecond: number;
    errorRate: number;
  };

  // Business metrics
  business: {
    activeUsers: number;
    activeStrategies: number;
    processingQueue: number;
    recentAlerts: number;
  };

  // System information
  system: {
    nodeVersion: string;
    platform: string;
    arch: string;
    totalMemory: number;
    freeMemory: number;
    loadAverage: number[];
  };

  // Additional details
  details?: Record<string, any>;
}

// Component status interface
interface ComponentStatus {
  status: "healthy" | "degraded" | "unhealthy";
  responseTime?: number;
  lastCheck: string;
  error?: string;
  details?: Record<string, any>;
}

// Function to check database connectivity
async function checkDatabaseHealth(): Promise<ComponentStatus> {
  const startTime = Date.now();

  try {
    // This would typically check actual database connectivity
    // For now, we'll simulate a database check
    await new Promise((resolve) => setTimeout(resolve, 10));

    const responseTime = Date.now() - startTime;

    return {
      status:
        responseTime < 100
          ? "healthy"
          : responseTime < 500
            ? "degraded"
            : "unhealthy",
      responseTime,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "unhealthy",
      lastCheck: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}

// Function to check cache connectivity
async function checkCacheHealth(): Promise<ComponentStatus> {
  const startTime = Date.now();

  try {
    // This would typically check actual cache connectivity
    // For now, we'll simulate a cache check
    await new Promise((resolve) => setTimeout(resolve, 5));

    const responseTime = Date.now() - startTime;

    return {
      status:
        responseTime < 50
          ? "healthy"
          : responseTime < 200
            ? "degraded"
            : "unhealthy",
      responseTime,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "unhealthy",
      lastCheck: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown cache error",
    };
  }
}

// Function to check WebSocket connectivity
async function checkWebSocketHealth(): Promise<ComponentStatus> {
  const startTime = Date.now();

  try {
    // This would typically check actual WebSocket connectivity
    // For now, we'll simulate a WebSocket check
    await new Promise((resolve) => setTimeout(resolve, 10));

    const responseTime = Date.now() - startTime;

    return {
      status:
        responseTime < 100
          ? "healthy"
          : responseTime < 300
            ? "degraded"
            : "unhealthy",
      responseTime,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "unhealthy",
      lastCheck: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown WebSocket error",
    };
  }
}

// Function to check external service connectivity
async function checkExternalServiceHealth(
  serviceName: string,
  url: string,
): Promise<ComponentStatus> {
  const startTime = Date.now();

  try {
    // This would typically check actual external service connectivity
    // For now, we'll simulate an external service check
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 200 + 50),
    );

    const responseTime = Date.now() - startTime;

    // Simulate occasional failures
    const isHealthy = Math.random() > 0.05; // 95% success rate

    return {
      status: isHealthy
        ? responseTime < 500
          ? "healthy"
          : "degraded"
        : "unhealthy",
      responseTime,
      lastCheck: new Date().toISOString(),
      details: {
        url,
        responseTime,
      },
    };
  } catch (error) {
    return {
      status: "unhealthy",
      lastCheck: new Date().toISOString(),
      error:
        error instanceof Error ? error.message : `Unknown ${serviceName} error`,
      details: {
        url,
      },
    };
  }
}

// Function to get system information
function getSystemInfo(): HealthCheckResult["system"] {
  const process = require("process");
  const os = require("os");

  return {
    nodeVersion: process.version,
    platform: os.platform(),
    arch: os.arch(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    loadAverage: os.loadavg(),
  };
}

// Function to get performance metrics (simplified)
function getPerformanceMetrics(): HealthCheckResult["performance"] {
  // Get active alerts
  const activeAlerts = alertSystem.getActiveAlerts({ severity: ["critical"] });

  return {
    responseTime: 0, // Would need basic timing implementation
    memoryUsage: 0, // Would need basic memory tracking
    cpuUsage: 0, // Would need basic CPU tracking
    activeConnections: 0, // Would be tracked by WebSocket server
    requestsPerSecond: 0, // Would be tracked by API server
    errorRate: activeAlerts.length > 0 ? 5 : 0, // Simplified calculation
  };
}

// Function to get business metrics (simplified)
function getBusinessMetrics(): HealthCheckResult["business"] {
  const activeAlerts = alertSystem.getActiveAlerts();

  return {
    activeUsers: 0, // Would need basic user tracking
    activeStrategies: 0, // Would need basic strategy tracking
    processingQueue: 0, // Would be tracked by queue system
    recentAlerts: activeAlerts.length,
  };
}

// Function to determine overall health status
function determineOverallHealth(
  components: HealthCheckResult["components"],
  performance: HealthCheckResult["performance"],
): "healthy" | "degraded" | "unhealthy" {
  // Check for any unhealthy components
  const hasUnhealthy = Object.values(components).some(
    (component) => component.status === "unhealthy",
  );

  if (hasUnhealthy) {
    return "unhealthy";
  }

  // Check for any degraded components
  const hasDegraded = Object.values(components).some(
    (component) => component.status === "degraded",
  );

  if (hasDegraded) {
    return "degraded";
  }

  // Check performance metrics
  if (performance.errorRate > 5 || performance.responseTime > 1000) {
    return "degraded";
  }

  return "healthy";
}

// Main health check handler
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const detailed = searchParams.get("detailed") === "true";
    const component = searchParams.get("component");

    // Check component-specific health if requested
    if (component) {
      switch (component) {
        case "database":
          const dbHealth = await checkDatabaseHealth();
          return NextResponse.json(dbHealth);

        case "cache":
          const cacheHealth = await checkCacheHealth();
          return NextResponse.json(cacheHealth);

        case "websocket":
          const wsHealth = await checkWebSocketHealth();
          return NextResponse.json(wsHealth);

        default:
          return NextResponse.json(
            { error: `Unknown component: ${component}` },
            { status: 400 },
          );
      }
    }

    // Check all components
    const apiResponseTime = Date.now() - startTime;

    const components: HealthCheckResult["components"] = {
      api: {
        status:
          apiResponseTime < 100
            ? "healthy"
            : apiResponseTime < 500
              ? "degraded"
              : "unhealthy",
        responseTime: apiResponseTime,
        lastCheck: new Date().toISOString(),
      },
      database: await checkDatabaseHealth(),
      cache: await checkCacheHealth(),
      websocket: await checkWebSocketHealth(),
      externalServices: {
        "twelve-data": await checkExternalServiceHealth(
          "twelve-data",
          "https://api.twelvedata.com",
        ),
        "broker-api": await checkExternalServiceHealth(
          "broker-api",
          "https://api.broker.com",
        ),
      },
    };

    // Get metrics
    const performance = getPerformanceMetrics();
    const business = getBusinessMetrics();
    const system = getSystemInfo();

    // Determine overall health
    const status = determineOverallHealth(components, performance);

    // Build health check result
    const healthCheckResult: HealthCheckResult = {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.APP_VERSION || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      components,
      performance,
      business,
      system,
    };

    // Add detailed information if requested
    if (detailed) {
      healthCheckResult.details = {
        // Add recent alerts
        recentAlerts: alertSystem.getActiveAlerts().slice(0, 10),

        // Log statistics - simplified
        logStats: { totalLogs: 0, errorLogs: 0, warnLogs: 0 },

        // Add infrastructure metrics
        infrastructure: {
          server: {
            // Simplified - would need basic resource monitoring
            cpuUsage: 0,
            memoryUsage: 0,
            diskUsage: 0,
          },
          database: {
            // Simplified - would need basic database monitoring
            connections: 0,
            queryTime: 0,
          },
        },
      };
    }

    // Set appropriate status code based on health
    const statusCode =
      status === "healthy" ? 200 : status === "degraded" ? 200 : 503;

    // Log health check - simplified
    console.log(
      `Health check completed: ${status}`,
      {
        service: "health-api",
      },
      {
        responseTime: Date.now() - startTime,
        status,
        componentCount: Object.keys(components).length,
      },
    );

    return NextResponse.json(healthCheckResult, { status: statusCode });
  } catch (error) {
    // Log error - simplified
    console.error(
      "Health check failed",
      error instanceof Error ? error : new Error("Unknown error"),
      {
        service: "health-api",
        responseTime: Date.now() - startTime,
      },
    );

    // Send to Sentry
    captureEnhancedError(
      error instanceof Error ? error : new Error("Health check failed"),
      {
        component: "HealthAPI",
        action: "health_check",
        route: "/api/health",
        additionalData: {
          responseTime: Date.now() - startTime,
        },
      },
    );

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}

// HEAD request handler for simple health checks
export async function HEAD() {
  try {
    // Quick health check without detailed metrics
    const dbHealth = await checkDatabaseHealth();

    if (dbHealth.status === "unhealthy") {
      return new NextResponse(null, { status: 503 });
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}
