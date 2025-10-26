import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { AppError, handleApiError } from "@/lib/errors";
import { transformStrategyRules } from "@/lib/backtest/strategy-rules";
import { authOptions } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { applyRateLimit } from "@/lib/middleware/rate-limit-middleware";
import { logEnvDebug, validateRequiredEnvVars } from "@/lib/utils/env-debug";

/**
 * Market calendar holidays (simplified list - in production, use a proper market calendar API)
 */
const MARKET_HOLIDAYS = [
  "2024-01-01", // New Year's Day
  "2024-01-15", // Martin Luther King Jr. Day
  "2024-02-19", // Presidents' Day
  "2024-05-27", // Memorial Day
  "2024-06-19", // Juneteenth
  "2024-07-04", // Independence Day
  "2024-09-02", // Labor Day
  "2024-10-14", // Columbus Day
  "2024-11-11", // Veterans Day
  "2024-11-28", // Thanksgiving Day
  "2024-12-25", // Christmas Day
  "2025-01-01", // New Year's Day
  "2025-01-20", // Martin Luther King Jr. Day
  "2025-02-17", // Presidents' Day
  "2025-05-26", // Memorial Day
  "2025-06-19", // Juneteenth
  "2025-07-04", // Independence Day
  "2025-09-01", // Labor Day
  "2025-10-13", // Columbus Day
  "2025-11-11", // Veterans Day
  "2025-11-27", // Thanksgiving Day
  "2025-12-25", // Christmas Day
];

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

/**
 * Check if a date is a market holiday
 */
function isMarketHoliday(date: Date): boolean {
  const dateStr = date.toISOString().split("T")[0];
  return MARKET_HOLIDAYS.includes(dateStr);
}

/**
 * Check if a date is a valid trading day
 */
function isValidTradingDay(date: Date): boolean {
  return !isWeekend(date) && !isMarketHoliday(date);
}

/**
 * Get the next valid trading day
 */
function getNextTradingDay(date: Date): Date {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  while (!isValidTradingDay(nextDay)) {
    nextDay.setDate(nextDay.getDate() + 1);
  }

  return nextDay;
}

/**
 * Get the previous valid trading day
 */
function getPreviousTradingDay(date: Date): Date {
  const prevDay = new Date(date);
  prevDay.setDate(prevDay.getDate() - 1);

  while (!isValidTradingDay(prevDay)) {
    prevDay.setDate(prevDay.getDate() - 1);
  }

  return prevDay;
}

/**
 * Count trading days between two dates
 */
function countTradingDays(startDate: Date, endDate: Date): number {
  let tradingDays = 0;
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    if (isValidTradingDay(currentDate)) {
      tradingDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return tradingDays;
}

/**
 * Validate date range for backtesting
 */
function validateDateRange(
  startDate: Date,
  endDate: Date,
): {
  isValid: boolean;
  error?: string;
  tradingDays?: number;
  warnings?: string[];
} {
  const warnings: string[] = [];

  // Basic validation
  if (startDate >= endDate) {
    return { isValid: false, error: "Start date must be before end date" };
  }

  // Check if dates are in the future
  const now = new Date();
  if (startDate > now) {
    return { isValid: false, error: "Start date cannot be in the future" };
  }

  if (endDate > now) {
    warnings.push("End date is in the future, using current date instead");
    endDate = now;
  }

  // Check if dates are too old (limited data availability)
  const minDate = new Date("2020-01-01");
  if (startDate < minDate) {
    return {
      isValid: false,
      error:
        "Start date cannot be before 2020-01-01 (limited data availability)",
    };
  }

  // Count trading days
  const tradingDays = countTradingDays(startDate, endDate);

  if (tradingDays === 0) {
    return {
      isValid: false,
      error: "No valid trading days in the selected date range",
    };
  }

  // Check minimum trading days required
  const minTradingDays = 5;
  if (tradingDays < minTradingDays) {
    return {
      isValid: false,
      error: `Minimum ${minTradingDays} trading days required for meaningful backtest`,
    };
  }

  // Check maximum trading days
  const maxTradingDays = 365;
  if (tradingDays > maxTradingDays) {
    return {
      isValid: false,
      error: `Maximum ${maxTradingDays} trading days allowed per backtest`,
    };
  }

  // Adjust dates to nearest trading days
  const adjustedStartDate = isValidTradingDay(startDate)
    ? startDate
    : getNextTradingDay(startDate);
  const adjustedEndDate = isValidTradingDay(endDate)
    ? endDate
    : getPreviousTradingDay(endDate);

  // Add warnings for date adjustments
  if (adjustedStartDate.getTime() !== startDate.getTime()) {
    warnings.push(
      `Start date adjusted to ${adjustedStartDate.toISOString().split("T")[0]} (nearest trading day)`,
    );
  }

  if (adjustedEndDate.getTime() !== endDate.getTime()) {
    warnings.push(
      `End date adjusted to ${adjustedEndDate.toISOString().split("T")[0]} (nearest trading day)`,
    );
  }

  return {
    isValid: true,
    tradingDays: countTradingDays(adjustedStartDate, adjustedEndDate),
    warnings,
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Concurrency control for backtest operations
const runningBacktests = new Map<
  string,
  {
    userId: string;
    strategyId: string;
    startTime: Date;
    lockId: string;
  }
>();

// Maximum concurrent backtests per user
const MAX_CONCURRENT_BACKTESTS_PER_USER = 2;
const MAX_CONCURRENT_BACKTESTS_TOTAL = 10;

// Backtest lock timeout in milliseconds (30 minutes)
const BACKTEST_LOCK_TIMEOUT = 30 * 60 * 1000;

/**
 * Acquire a lock for backtest operation
 * @param userId User ID
 * @param strategyId Strategy ID
 * @returns Lock ID if successful, null if lock cannot be acquired
 */
function acquireBacktestLock(
  userId: string,
  strategyId: string,
): string | null {
  // Clean up expired locks
  cleanupExpiredLocks();

  // Check user-specific concurrent limits
  const userRunningBacktests = Array.from(runningBacktests.values()).filter(
    (backtest) => backtest.userId === userId,
  );

  if (userRunningBacktests.length >= MAX_CONCURRENT_BACKTESTS_PER_USER) {
    return null;
  }

  // Check total concurrent limits
  if (runningBacktests.size >= MAX_CONCURRENT_BACKTESTS_TOTAL) {
    return null;
  }

  // Check if there's already a running backtest for this strategy
  const existingBacktest = Array.from(runningBacktests.values()).find(
    (backtest) => backtest.strategyId === strategyId,
  );

  if (existingBacktest) {
    return null;
  }

  // Generate unique lock ID
  const lockId = `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Acquire lock
  runningBacktests.set(lockId, {
    userId,
    strategyId,
    startTime: new Date(),
    lockId,
  });

  console.log(
    `Backtest lock acquired: ${lockId} for user ${userId}, strategy ${strategyId}`,
  );
  return lockId;
}

/**
 * Release a backtest lock
 * @param lockId Lock ID to release
 */
function releaseBacktestLock(lockId: string): void {
  const backtest = runningBacktests.get(lockId);
  if (backtest) {
    runningBacktests.delete(lockId);
    console.log(
      `Backtest lock released: ${lockId} for user ${backtest.userId}, strategy ${backtest.strategyId}`,
    );
  }
}

/**
 * Clean up expired locks
 */
function cleanupExpiredLocks(): void {
  const now = Date.now();
  const expiredLocks: string[] = [];

  runningBacktests.forEach((backtest, lockId) => {
    if (now - backtest.startTime.getTime() > BACKTEST_LOCK_TIMEOUT) {
      expiredLocks.push(lockId);
    }
  });

  expiredLocks.forEach((lockId) => {
    const backtest = runningBacktests.get(lockId);
    runningBacktests.delete(lockId);
    console.log(
      `Expired backtest lock cleaned up: ${lockId} for user ${backtest?.userId}`,
    );
  });
}

/**
 * Get current backtest statistics
 */
function getBacktestStats(): {
  totalRunning: number;
  userRunning: number;
  strategyRunning: boolean;
} {
  return {
    totalRunning: runningBacktests.size,
    userRunning: 0, // Will be set by caller
    strategyRunning: false, // Will be set by caller
  };
}

// Request validation schema
const BacktestRequestSchema = z.object({
  strategyId: z.string(),
  symbol: z.string().min(1),
  interval: z.enum(["1min", "5min", "15min", "30min", "1h", "4h", "1d", "1w"]),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  initialBalance: z.number().min(100).max(1000000),
});

export async function POST(request: NextRequest) {
  let lockId: string | null = null;

  try {
    // Debug: Log environment variables at request start
    console.log("🔍 Backtest POST - Environment Debug Start");
    logEnvDebug("BACKTEST API");

    // Validate market data API keys
    const marketDataValidation = validateRequiredEnvVars([
      "TWELVEDATA_API_KEY",
    ]);

    if (!marketDataValidation.valid) {
      console.error(
        "❌ Market data API keys validation failed:",
        marketDataValidation.missing,
      );
      throw new AppError(
        503,
        "Market data service unavailable. API keys not configured properly.",
        "MARKET_DATA_CONFIG_ERROR",
      );
    }

    // Apply rate limiting
    const rateLimitResponse = await applyRateLimit(request, "api" as any);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(401, "Authentication required");
    }

    const body = await request.json();
    const validatedData = BacktestRequestSchema.parse(body);

    // Acquire concurrency lock
    lockId = acquireBacktestLock(session.user.id, validatedData.strategyId);
    if (!lockId) {
      const stats = getBacktestStats();
      const userRunning = Array.from(runningBacktests.values()).filter(
        (bt) => bt.userId === session.user.id,
      ).length;
      const strategyRunning = Array.from(runningBacktests.values()).some(
        (bt) => bt.strategyId === validatedData.strategyId,
      );

      if (userRunning >= MAX_CONCURRENT_BACKTESTS_PER_USER) {
        throw new AppError(
          429,
          `You have reached the maximum concurrent backtests limit (${MAX_CONCURRENT_BACKTESTS_PER_USER})`,
          "CONCURRENT_LIMIT_EXCEEDED",
        );
      }

      if (strategyRunning) {
        throw new AppError(
          409,
          "A backtest is already running for this strategy",
          "STRATEGY_BACKTEST_RUNNING",
        );
      }

      throw new AppError(
        429,
        "Server is at maximum backtest capacity. Please try again later.",
        "SERVER_CAPACITY_EXCEEDED",
      );
    }

    // Add additional check for running backtests in database
    const runningBacktestCount = await prisma.backtest.count({
      where: {
        userId: session.user.id,
        strategyId: validatedData.strategyId,
        status: "running",
      },
    });

    if (runningBacktestCount > 0) {
      releaseBacktestLock(lockId);
      throw new AppError(
        409,
        "A backtest is already running for this strategy",
        "STRATEGY_BACKTEST_RUNNING",
      );
    }

    // Fetch strategy from database
    const strategy = await prisma.strategy.findFirst({
      where: {
        id: validatedData.strategyId,
        userId: session.user.id,
        deletedAt: null,
      },
    });

    if (!strategy) {
      releaseBacktestLock(lockId);
      throw new AppError(404, "Strategy not found", "STRATEGY_NOT_FOUND");
    }

    // Parse dates
    const startDate = new Date(validatedData.startDate);
    const endDate = new Date(validatedData.endDate);

    // Validate date range
    if (startDate >= endDate) {
      releaseBacktestLock(lockId);
      throw new AppError(
        400,
        "Start date must be before end date",
        "INVALID_DATE_RANGE",
      );
    }

    // Limit backtest period to prevent excessive API calls and ensure data accuracy
    const maxDays = 90; // Reduced from 365 to ensure different results
    const daysDiff =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > maxDays) {
      releaseBacktestLock(lockId);
      throw new AppError(
        400,
        `Backtest period cannot exceed ${maxDays} days. For accurate results with different date ranges, use shorter periods (30-90 days). Longer periods may return identical data due to API limitations.`,
        "INVALID_DATE_RANGE",
      );
    }

    // Add warning for periods over 60 days ONLY for limited intervals (15min, 30min)
    // 1h and 4h intervals support up to 365 days
    const limitedIntervals = ["1min", "5min", "15min", "30min"];
    if (daysDiff > 60 && limitedIntervals.includes(interval)) {
      console.warn(
        `⚠️ WARNING: Long backtest period (${Math.round(daysDiff)} days) detected for ${interval}. This interval is limited to 60 days by Yahoo Finance API.`,
      );
    }

    // Create backtest record with lock information
    const backtest = await prisma.backtest.create({
      data: {
        strategyId: validatedData.strategyId,
        userId: session.user.id,
        status: "running",
        dateFrom: startDate,
        dateTo: endDate,
        initialBalance: validatedData.initialBalance,
        settings: {
          symbol: validatedData.symbol,
          interval: validatedData.interval,
          dataSource: "yahoo_finance",
          lockId: lockId, // Store lock ID for tracking
        },
      },
    });

    try {
      // Extract parameters from strategy rules
      const strategyRules = strategy.rules as any;
      const riskManagement = strategyRules?.riskManagement || {};
      const exitRules = strategyRules?.exit || {};

      // Convert pips to decimal for backtest engine
      const stopLossPips = exitRules?.stopLoss?.value || 25;
      const takeProfitPips = exitRules?.takeProfit?.value || 50;

      // Approximate conversion: 1 pip = 0.0001 for most forex pairs
      // For JPY pairs it's 0.01, but we'll use general conversion
      const stopLossDecimal = stopLossPips * 0.0001;
      const takeProfitDecimal = takeProfitPips * 0.0001;

      // Transform strategy data to format expected by backtest engine
      const transformedStrategy = {
        id: strategy.id,
        name: strategy.name,
        symbol: validatedData.symbol, // Add required symbol property
        rules: transformStrategyRules(strategy.rules),
        parameters: {
          riskPerTrade: riskManagement.lotSize || 0.01,
          maxPositions: riskManagement.maxPositions || 1,
          stopLoss: stopLossDecimal,
          takeProfit: takeProfitDecimal,
          maxDailyLoss: riskManagement.maxDailyLoss || 100,
        },
      };

      // Run backtest with Yahoo Finance
      const { runBacktest } = await import("../../../lib/backtest/engine");
      const result = await runBacktest(validatedData.strategyId, {
        startDate,
        endDate,
        initialBalance: validatedData.initialBalance,
        symbol: validatedData.symbol,
        interval: validatedData.interval,
        strategy: transformedStrategy,
      });

      // Update backtest with results
      const updatedBacktest = await prisma.backtest.update({
        where: { id: backtest.id },
        data: {
          status: "completed",
          results: {
            finalBalance: result.finalBalance,
            totalReturn: result.totalReturn,
            returnPercentage: result.returnPercentage,
            maxDrawdown: result.maxDrawdown,
            winRate: result.winRate,
            totalTrades: result.totalTrades,
            winningTrades: result.winningTrades,
            losingTrades: result.losingTrades,
            averageWin: result.averageWin,
            averageLoss: result.averageLoss,
            profitFactor: result.profitFactor,
            sharpeRatio: result.sharpeRatio,
            trades: result.trades,
            equityCurve: result.equityCurve,
            metadata: result.metadata,
          },
          completedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        backtest: updatedBacktest,
        result,
      });
    } catch (backtestError) {
      console.error("Backtest execution error:", backtestError);

      // Update backtest with error status
      await prisma.backtest.update({
        where: { id: backtest.id },
        data: {
          status: "failed",
          results: {
            error:
              backtestError instanceof Error
                ? backtestError.message
                : "Unknown error",
          },
          completedAt: new Date(),
        },
      });

      throw backtestError instanceof Error
        ? backtestError
        : new Error("Backtest execution failed");
    }
  } catch (error) {
    // Always release lock on error
    if (lockId) {
      releaseBacktestLock(lockId);
    }

    if (error instanceof z.ZodError) {
      return handleApiError(
        new AppError(
          400,
          "Invalid request data",
          "VALIDATION_ERROR",
          error.flatten().fieldErrors,
        ),
      );
    }

    return handleApiError(error);
  } finally {
    // Release lock on successful completion
    if (lockId) {
      releaseBacktestLock(lockId);
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await applyRateLimit(request, "api" as any);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(401, "Authentication required");
    }

    const { searchParams } = new URL(request.url);
    const strategyId = searchParams.get("strategyId");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");
    const includeStats = searchParams.get("includeStats") === "true";

    // Build query
    const where: any = {
      userId: session.user.id,
    };

    if (strategyId) {
      where.strategyId = strategyId;
    }

    // Fetch backtests
    const backtests = await prisma.backtest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        strategy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Get total count
    const total = await prisma.backtest.count({ where });

    // Include concurrency stats if requested
    let concurrencyStats = null;
    if (includeStats) {
      cleanupExpiredLocks();
      const userRunning = Array.from(runningBacktests.values()).filter(
        (bt) => bt.userId === session.user.id,
      ).length;
      const strategyRunning = strategyId
        ? Array.from(runningBacktests.values()).some(
            (bt) => bt.strategyId === strategyId,
          )
        : false;

      concurrencyStats = {
        totalRunning: runningBacktests.size,
        userRunning,
        strategyRunning,
        maxConcurrentPerUser: MAX_CONCURRENT_BACKTESTS_PER_USER,
        maxConcurrentTotal: MAX_CONCURRENT_BACKTESTS_TOTAL,
      };
    }

    return NextResponse.json({
      backtests,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      ...(concurrencyStats && { concurrencyStats }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Clean up all locks (for server shutdown)
 */
function cleanupAllBacktestLocks(): void {
  runningBacktests.clear();
  console.log("All backtest locks cleared");
}
