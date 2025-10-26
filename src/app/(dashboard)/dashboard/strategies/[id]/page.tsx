"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Edit2,
  Play,
  BarChart3,
  Plus,
  Activity,
  Pause,
  Server,
  Brain,
  Sparkles,
  TrendingUp,
  Shield,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useApiRequest } from "@/hooks/useApiRequest";
import { ActivateStrategyDialog } from "@/components/strategies/ActivateStrategyDialog";
import { OptimizationSuggestionModal } from "@/components/supervisor/OptimizationSuggestionModal";
import { BacktestResults } from "@/components/strategies/BacktestResults";
import { BacktestBadge } from "@/components/strategies/BacktestBadge";

interface Strategy {
  id: string;
  name: string;
  description?: string;
  symbol: string;
  timeframe: string;
  status: string;
  rules: any;
  version: number;
  createdAt: string;
  backtestVerified?: boolean;
  backtestResults?: any;
  isSystemDefault?: boolean;
  userId: string;
  _count: {
    trades: number;
    backtests: number;
  };
}

export default function StrategyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { data: strategy, loading, error, execute } = useApiRequest<Strategy>();
  const [activeTab, setActiveTab] = useState<
    "overview" | "backtests" | "trades"
  >("overview");
  const [backtests, setBacktests] = useState<any[]>([]);
  const [backtestsLoading, setBacktestsLoading] = useState(false);
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [activating, setActivating] = useState(false);

  // Optimization state
  const [optimizing, setOptimizing] = useState(false);
  const [showOptimizationModal, setShowOptimizationModal] = useState(false);
  const [optimizationData, setOptimizationData] = useState<any>(null);
  const [executorIds, setExecutorIds] = useState<string[]>([]);

  useEffect(() => {
    execute(async () => {
      const response = await fetch(`/api/strategy/${params.id}`);

      if (response.status === 401) {
        router.replace("/login");
        throw new Error("Unauthorized");
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Strategy not found");
      }

      return response.json();
    }).catch((err) => {
      if (err.message !== "Unauthorized") {
        toast.error(err.message);
      }
    });
  }, [execute, params.id, router]);

  // Fetch backtests when strategy is loaded and tab is active
  useEffect(() => {
    if (strategy && activeTab === "backtests") {
      fetchBacktests();
    }
  }, [strategy, activeTab]);

  const fetchBacktests = async () => {
    if (!strategy) return;

    try {
      setBacktestsLoading(true);
      const response = await fetch(`/api/backtest?strategyId=${strategy.id}`);

      if (!response.ok) {
        throw new Error("Failed to fetch backtests");
      }

      const data = await response.json();
      setBacktests(data.backtests || []);
    } catch (error) {
      console.error("Error fetching backtests:", error);
      toast.error("Failed to load backtests");
    } finally {
      setBacktestsLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!strategy) {
      toast.error("Strategy not loaded");
      return;
    }
    if (
      !confirm(
        "Are you sure you want to deactivate this strategy? All executors will stop executing it.",
      )
    ) {
      return;
    }

    setActivating(true);
    try {
      const response = await fetch(`/api/strategy/${strategy.id}/activate`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to deactivate strategy");
      }

      toast.success(data.message);

      // Refresh strategy data
      execute(async () => {
        const response = await fetch(`/api/strategy/${params.id}`);
        if (!response.ok) throw new Error("Failed to refresh strategy");
        return response.json();
      });
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error("An error occurred");
      toast.error(err.message);
    } finally {
      setActivating(false);
    }
  };

  const handleStrategyActivated = () => {
    if (!strategy) {
      toast.error("Strategy not loaded");
      return;
    }
    // Refresh strategy data
    execute(async () => {
      const response = await fetch(`/api/strategy/${params.id}`);
      if (!response.ok) throw new Error("Failed to refresh strategy");
      return response.json();
    });
  };

  // Fetch active executors for this strategy
  useEffect(() => {
    if (strategy) {
      fetchActiveExecutors();
    }
  }, [strategy]);

  const fetchActiveExecutors = async () => {
    try {
      const response = await fetch("/api/executor");
      if (response.ok) {
        const data = await response.json();
        const onlineExecutors = (data.executors || [])
          .filter((e: any) => e.isConnected)
          .map((e: any) => e.id);
        setExecutorIds(onlineExecutors);
      }
    } catch (error) {
      console.error("Failed to fetch executors:", error);
    }
  };

  const handleOptimize = async () => {
    if (executorIds.length === 0) {
      toast.error(
        "No online executors available. Please connect an executor first.",
      );
      return;
    }

    if (!strategy) return;

    if (strategy._count.trades < 20) {
      const confirmed = confirm(
        `This strategy only has ${strategy._count.trades} trades. ` +
          "AI optimization requires at least 20 trades for reliable analysis. " +
          "Continue anyway?",
      );
      if (!confirmed) return;
    }

    setOptimizing(true);
    try {
      const response = await fetch("/api/supervisor/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategyId: strategy!.id,
          executorIds: executorIds,
          forceOptimize: strategy!._count.trades < 20,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Optimization failed");
      }

      if (result.status === "APPROVED") {
        toast.success("Optimization approved and applied automatically!");
        // Refresh strategy data
        handleStrategyActivated();
      } else if (result.status === "REQUIRES_APPROVAL") {
        // Show modal for user approval
        setOptimizationData({
          optimizationId: result.optimizationId,
          strategyName: strategy.name,
          suggestions: result.suggestions,
          overallConfidence: result.confidence,
          reasoning:
            result.suggestions?.[0]?.reasoning || "AI analysis complete",
        });
        setShowOptimizationModal(true);
      } else if (result.status === "REJECTED") {
        toast.error(
          result.error || "Optimization rejected by AI (low confidence)",
        );
      }
    } catch (error: any) {
      console.error("Optimization error:", error);
      toast.error(error.message || "Failed to optimize strategy");
    } finally {
      setOptimizing(false);
    }
  };

  const handleApproveOptimization = async (optimizationId: string) => {
    const response = await fetch(
      `/api/supervisor/optimize/${optimizationId}/apply`,
      {
        method: "POST",
      },
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to apply optimization");
    }

    // Refresh strategy data
    handleStrategyActivated();
  };

  const handleRejectOptimization = async (optimizationId: string) => {
    const response = await fetch(
      `/api/supervisor/optimize/${optimizationId}/reject`,
      {
        method: "POST",
      },
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to reject optimization");
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !strategy) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
        <p className="text-neutral-600">
          {error?.message || "Strategy not found"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/strategies"
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-6 w-6 text-neutral-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-neutral-900">
                {strategy.name}
              </h1>
              {strategy.isSystemDefault && (
                <span className="px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-100 border border-blue-200 rounded-full">
                  System Default
                </span>
              )}
            </div>
            <p className="text-neutral-600 mt-1">
              {strategy.symbol} • {strategy.timeframe}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {strategy.status === "active" ? (
            <button
              onClick={handleDeactivate}
              disabled={activating}
              className="inline-flex items-center gap-2 px-4 py-2 text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              {activating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Deactivating...
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" />
                  Deactivate
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => setShowActivateDialog(true)}
              disabled={activating}
              className="inline-flex items-center gap-2 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              Activate Strategy
            </button>
          )}

          {/* AI Optimization Button */}
          <div className="relative group">
            <button
              onClick={handleOptimize}
              disabled={
                optimizing ||
                strategy.status !== "active" ||
                strategy._count.trades < 20
              }
              className="inline-flex items-center gap-2 px-4 py-2 text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed relative"
            >
              {optimizing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4" />
                  <Sparkles className="h-3 w-3 absolute -top-1 -right-1 text-yellow-300" />
                  Optimize with AI
                </>
              )}
            </button>

            {/* Tooltip */}
            {(strategy.status !== "active" || strategy._count.trades < 20) &&
              !optimizing && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                    {strategy.status !== "active" ? (
                      "Activate strategy first"
                    ) : strategy._count.trades < 20 ? (
                      <>
                        Need {20 - strategy._count.trades} more trade
                        {20 - strategy._count.trades !== 1 ? "s" : ""} (
                        {strategy._count.trades}/20)
                      </>
                    ) : (
                      "Ready to optimize"
                    )}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                    </div>
                  </div>
                </div>
              )}

            {/* Progress Indicator */}
            {strategy.status === "active" && strategy._count.trades < 20 && (
              <div className="absolute -bottom-6 left-0 right-0">
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-600 to-blue-600 h-full transition-all duration-500"
                      style={{
                        width: `${(strategy._count.trades / 20) * 100}%`,
                      }}
                    ></div>
                  </div>
                  <span className="font-medium tabular-nums">
                    {strategy._count.trades}/20
                  </span>
                </div>
              </div>
            )}
          </div>

          <Link
            href={`/dashboard/executors`}
            className="inline-flex items-center gap-2 px-4 py-2 text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            <Server className="h-4 w-4" />
            View Executors
          </Link>
          {/* Only show Edit button if user owns the strategy (not system default) */}
          {!strategy.isSystemDefault && (
            <Link
              href={`/dashboard/strategies/${strategy.id}/edit`}
              className="inline-flex items-center gap-2 px-4 py-2 text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </Link>
          )}
          <Link
            href={`/dashboard/backtest?strategyId=${strategy.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <BarChart3 className="h-4 w-4" />
            Run Backtest
          </Link>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <InfoCard label="Status" value={strategy.status} />
        <InfoCard
          label="Total Trades"
          value={strategy._count.trades.toString()}
        />
        <InfoCard
          label="Backtests"
          value={strategy._count.backtests.toString()}
        />
        <InfoCard label="Version" value={`v${strategy.version}`} />
      </div>

      {/* Tabs */}
      <div className="rounded-lg border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 flex">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
              activeTab === "overview"
                ? "border-b-2 border-primary-600 text-primary-600"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("backtests")}
            className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
              activeTab === "backtests"
                ? "border-b-2 border-primary-600 text-primary-600"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Backtests
          </button>
          <button
            onClick={() => setActiveTab("trades")}
            className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
              activeTab === "trades"
                ? "border-b-2 border-primary-600 text-primary-600"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Trades
          </button>
        </div>

        <div className="p-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Backtest Badge (if verified) */}
              {strategy.backtestVerified && strategy.backtestResults && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <BacktestBadge
                    verified={true}
                    returnPercentage={strategy.backtestResults.performance.returnPercentage}
                    winRate={strategy.backtestResults.statistics.winRate}
                    profitFactor={strategy.backtestResults.statistics.profitFactor}
                    size="md"
                    showDetails={true}
                  />
                </div>
              )}
              
              <h3 className="text-xl font-bold text-neutral-900">
                Strategy Overview
              </h3>

              {strategy.description && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <p className="text-sm font-semibold text-blue-900">
                      Description
                    </p>
                  </div>
                  <p className="text-sm text-blue-800">
                    {strategy.description}
                  </p>
                </div>
              )}

              {/* Extracted Indicators */}
              {(() => {
                const indicators = new Set<string>();
                strategy.rules?.entry?.conditions?.forEach((cond: any) => {
                  if (cond.indicator) {
                    indicators.add(
                      cond.indicator.toUpperCase().replace(/_/g, " "),
                    );
                  }
                });
                const indicatorList = Array.from(indicators);

                if (indicatorList.length > 0) {
                  return (
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="h-4 w-4 text-indigo-600" />
                        <h4 className="text-sm font-semibold text-indigo-900">
                          Technical Indicators Used
                        </h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {indicatorList.map((indicator, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-semibold border border-indigo-300"
                          >
                            {indicator}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Entry Conditions */}
              <div className="rounded-lg border border-green-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h4 className="text-base font-bold text-green-900">
                    Entry Rules (
                    {strategy.rules?.entry?.logic?.toUpperCase() || "AND"}{" "}
                    Logic)
                  </h4>
                </div>
                <p className="text-xs text-green-700 mb-4">
                  {strategy.rules?.entry?.logic === "OR"
                    ? "✓ At least one condition must be true to enter trade"
                    : "✓ All conditions must be true to enter trade"}
                </p>
                <div className="space-y-3">
                  {strategy.rules?.entry?.conditions?.map(
                    (cond: any, idx: number) => {
                      // Format condition operator
                      const formatOperator = (op: string) => {
                        const operators: Record<string, string> = {
                          greater_than: ">",
                          less_than: "<",
                          greater_than_or_equal: "≥",
                          less_than_or_equal: "≤",
                          equal: "=",
                          crosses_above: "↗ crosses above",
                          crosses_below: "↘ crosses below",
                          gt: ">",
                          lt: "<",
                          gte: "≥",
                          lte: "≤",
                          eq: "=",
                        };
                        return operators[op] || op;
                      };

                      // Format indicator name
                      const formatIndicator = (ind: string) => {
                        return ind.toUpperCase().replace(/_/g, " ");
                      };

                      return (
                        <div
                          key={idx}
                          className="border-l-4 border-green-500 bg-green-50 p-3 rounded-r-lg"
                        >
                          <div className="flex items-start gap-2">
                            <span className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold">
                              {idx + 1}
                            </span>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-green-900">
                                {formatIndicator(cond.indicator)}{" "}
                                {formatOperator(cond.condition)}{" "}
                                {cond.value ||
                                  formatIndicator(cond.compareIndicator || "")}
                              </p>
                              <p className="text-xs text-green-700 mt-1">
                                {cond.indicator === "rsi" &&
                                  "Relative Strength Index - measures momentum"}
                                {cond.indicator === "cci" &&
                                  "Commodity Channel Index - identifies cyclical trends"}
                                {cond.indicator === "macd" &&
                                  "Moving Average Convergence Divergence - trend and momentum"}
                                {cond.indicator === "ema" &&
                                  "Exponential Moving Average - price trend"}
                                {cond.indicator === "sma" &&
                                  "Simple Moving Average - price trend"}
                                {cond.indicator === "price" &&
                                  "Current market price"}
                                {cond.indicator.includes("ema_") &&
                                  `${cond.indicator.split("_")[1]}-period Exponential Moving Average`}
                                {cond.indicator.includes("sma_") &&
                                  `${cond.indicator.split("_")[1]}-period Simple Moving Average`}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>

              {/* Risk-Reward Ratio */}
              {strategy.rules?.exit?.takeProfit?.value &&
                strategy.rules?.exit?.stopLoss?.value && (
                  <div className="rounded-lg bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-green-600" />
                        <span className="text-sm font-semibold text-neutral-700">
                          Risk-Reward Ratio:
                        </span>
                      </div>
                      <span className="text-3xl font-bold text-green-600">
                        1:
                        {(
                          strategy.rules.exit.takeProfit.value /
                          strategy.rules.exit.stopLoss.value
                        ).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600 mt-2">
                      For every ${strategy.rules.exit.stopLoss.value} risked (
                      {strategy.rules.exit.stopLoss.value}{" "}
                      {strategy.rules.exit.stopLoss.type}), potential to gain $
                      {strategy.rules.exit.takeProfit.value} (
                      {strategy.rules.exit.takeProfit.value}{" "}
                      {strategy.rules.exit.takeProfit.type})
                    </p>
                  </div>
                )}

              {/* Exit Rules */}
              <div className="rounded-lg border border-neutral-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-5 w-5 text-neutral-600" />
                  <h4 className="text-base font-bold text-neutral-900">
                    Exit Strategy
                  </h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border-2 border-green-300 bg-green-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <p className="text-xs font-semibold text-green-900">
                        TAKE PROFIT
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-green-700">
                      {strategy.rules?.exit?.takeProfit?.value}{" "}
                      {strategy.rules?.exit?.takeProfit?.type}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      Profit target per trade
                    </p>
                  </div>
                  <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-red-600" />
                      <p className="text-xs font-semibold text-red-900">
                        STOP LOSS
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-red-700">
                      {strategy.rules?.exit?.stopLoss?.value}{" "}
                      {strategy.rules?.exit?.stopLoss?.type}
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      Maximum loss per trade
                    </p>
                  </div>
                </div>
              </div>

              {/* Risk Management */}
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-5 w-5 text-orange-600" />
                  <h4 className="text-base font-bold text-orange-900">
                    Risk Management
                  </h4>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-white border border-orange-200 p-3">
                    <p className="text-xs text-orange-700 mb-1">
                      Position Size
                    </p>
                    <p className="text-lg font-bold text-orange-900">
                      {strategy.rules?.riskManagement?.lotSize} lots
                    </p>
                  </div>
                  <div className="rounded-lg bg-white border border-orange-200 p-3">
                    <p className="text-xs text-orange-700 mb-1">
                      Max Concurrent
                    </p>
                    <p className="text-lg font-bold text-orange-900">
                      {strategy.rules?.riskManagement?.maxPositions}{" "}
                      {strategy.rules?.riskManagement?.maxPositions === 1
                        ? "position"
                        : "positions"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white border border-orange-200 p-3">
                    <p className="text-xs text-orange-700 mb-1">
                      Daily Loss Limit
                    </p>
                    <p className="text-lg font-bold text-orange-900">
                      ${strategy.rules?.riskManagement?.maxDailyLoss}
                    </p>
                  </div>
                </div>
              </div>

              {/* Advanced Features - Detailed Display */}
              {(strategy.rules?.smartExit ||
                strategy.rules?.dynamicRisk ||
                strategy.rules?.sessionFilter ||
                strategy.rules?.correlationFilter ||
                strategy.rules?.regimeDetection) && (
                <div className="rounded-lg border border-purple-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-purple-200">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    <h4 className="text-base font-bold text-purple-900">
                      Advanced Features Configuration
                    </h4>
                  </div>
                  
                  {/* Summary indicators */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4 pb-4 border-b border-purple-100">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${strategy.rules?.smartExit ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className={`text-xs font-semibold ${strategy.rules?.smartExit ? 'text-green-700' : 'text-gray-500'}`}>
                        Smart Exit
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${strategy.rules?.dynamicRisk ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className={`text-xs font-semibold ${strategy.rules?.dynamicRisk ? 'text-green-700' : 'text-gray-500'}`}>
                        Dynamic Risk
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${strategy.rules?.sessionFilter ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className={`text-xs font-semibold ${strategy.rules?.sessionFilter ? 'text-green-700' : 'text-gray-500'}`}>
                        Session Filter
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${strategy.rules?.correlationFilter ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className={`text-xs font-semibold ${strategy.rules?.correlationFilter ? 'text-green-700' : 'text-gray-500'}`}>
                        Correlation
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${strategy.rules?.regimeDetection ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className={`text-xs font-semibold ${strategy.rules?.regimeDetection ? 'text-green-700' : 'text-gray-500'}`}>
                        Regime Detection
                      </span>
                    </div>
                  </div>

                  {/* Detailed feature cards */}
                  <div className="space-y-3">
                    {/* Smart Exit Details */}
                    {strategy.rules?.smartExit && (
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-300">
                        <div className="text-xs font-bold text-green-700 mb-2">🎯 Smart Exit Configuration</div>
                        <div className="space-y-1.5 text-xs">
                          {strategy.rules.smartExit.stopLoss && (
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Stop Loss Type:</span>
                              <span className="font-semibold text-neutral-900">{strategy.rules.smartExit.stopLoss.type?.toUpperCase()}</span>
                            </div>
                          )}
                          {strategy.rules.smartExit.stopLoss?.atrMultiplier && (
                            <div className="flex justify-between">
                              <span className="text-neutral-600">ATR Multiplier (SL):</span>
                              <span className="font-semibold text-neutral-900">{strategy.rules.smartExit.stopLoss.atrMultiplier}x</span>
                            </div>
                          )}
                          {strategy.rules.smartExit.takeProfit && (
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Take Profit Type:</span>
                              <span className="font-semibold text-neutral-900">{strategy.rules.smartExit.takeProfit.type?.toUpperCase()}</span>
                            </div>
                          )}
                          {strategy.rules.smartExit.takeProfit?.partialExits && (
                            <div className="mt-2 pt-2 border-t border-green-200">
                              <div className="text-neutral-600 mb-1">Partial Exits:</div>
                              {strategy.rules.smartExit.takeProfit.partialExits.map((exit: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-xs pl-2">
                                  <span className="text-neutral-600">Level {idx + 1}:</span>
                                  <span className="font-semibold text-green-700">{exit.percentage}% @ {exit.atRR}:1 RR</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Dynamic Risk Details */}
                    {strategy.rules?.dynamicRisk && (
                      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg p-3 border border-amber-300">
                        <div className="text-xs font-bold text-amber-700 mb-2">⚡ Dynamic Risk Configuration</div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-neutral-600">ATR Sizing:</span>
                            <span className="font-semibold text-neutral-900">{strategy.rules.dynamicRisk.useATRSizing ? 'Enabled ✅' : 'Disabled'}</span>
                          </div>
                          {strategy.rules.dynamicRisk.atrMultiplier && (
                            <div className="flex justify-between">
                              <span className="text-neutral-600">ATR Multiplier:</span>
                              <span className="font-semibold text-neutral-900">{strategy.rules.dynamicRisk.atrMultiplier}x</span>
                            </div>
                          )}
                          {strategy.rules.dynamicRisk.riskPercentage && (
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Risk Per Trade:</span>
                              <span className="font-semibold text-neutral-900">{strategy.rules.dynamicRisk.riskPercentage}%</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Auto Adjust Lot:</span>
                            <span className="font-semibold text-neutral-900">{strategy.rules.dynamicRisk.autoAdjustLotSize ? 'Yes ✅' : 'No'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Reduce in High Vol:</span>
                            <span className="font-semibold text-neutral-900">{strategy.rules.dynamicRisk.reduceInHighVolatility ? 'Yes ✅' : 'No'}</span>
                          </div>
                          {strategy.rules.dynamicRisk.volatilityThreshold && (
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Volatility Threshold:</span>
                              <span className="font-semibold text-neutral-900">{(strategy.rules.dynamicRisk.volatilityThreshold * 100).toFixed(2)}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Session Filter Details */}
                    {strategy.rules?.sessionFilter && (
                      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-3 border border-blue-300">
                        <div className="text-xs font-bold text-blue-700 mb-2">🌍 Session Filter Configuration</div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Status:</span>
                            <span className="font-semibold text-neutral-900">{strategy.rules.sessionFilter.enabled ? 'Enabled ✅' : 'Disabled'}</span>
                          </div>
                          {strategy.rules.sessionFilter.allowedSessions && (
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Allowed Sessions:</span>
                              <span className="font-semibold text-neutral-900">{strategy.rules.sessionFilter.allowedSessions.join(', ')}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Use Optimal Pairs:</span>
                            <span className="font-semibold text-neutral-900">{strategy.rules.sessionFilter.useOptimalPairs ? 'Yes ✅' : 'No'}</span>
                          </div>
                          {strategy.rules.sessionFilter.aggressivenessMultiplier && (
                            <div className="mt-2 pt-2 border-t border-blue-200">
                              <div className="flex justify-between">
                                <span className="text-neutral-600">Optimal Session:</span>
                                <span className="font-semibold text-green-700">{strategy.rules.sessionFilter.aggressivenessMultiplier.optimal}x</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-neutral-600">Suboptimal Session:</span>
                                <span className="font-semibold text-amber-700">{strategy.rules.sessionFilter.aggressivenessMultiplier.suboptimal}x</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Correlation Filter Details */}
                    {strategy.rules?.correlationFilter && (
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-3 border border-purple-300">
                        <div className="text-xs font-bold text-purple-700 mb-2">🔗 Correlation Filter Configuration</div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Status:</span>
                            <span className="font-semibold text-neutral-900">{strategy.rules.correlationFilter.enabled ? 'Enabled ✅' : 'Disabled'}</span>
                          </div>
                          {strategy.rules.correlationFilter.maxCorrelation && (
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Max Correlation:</span>
                              <span className="font-semibold text-neutral-900">{(strategy.rules.correlationFilter.maxCorrelation * 100).toFixed(0)}%</span>
                            </div>
                          )}
                          {strategy.rules.correlationFilter.lookbackPeriod && (
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Lookback Period:</span>
                              <span className="font-semibold text-neutral-900">{strategy.rules.correlationFilter.lookbackPeriod} days</span>
                            </div>
                          )}
                          {strategy.rules.correlationFilter.timeframes && (
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Timeframes:</span>
                              <span className="font-semibold text-neutral-900">{strategy.rules.correlationFilter.timeframes.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Regime Detection Details */}
                    {strategy.rules?.regimeDetection && (
                      <div className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-lg p-3 border border-indigo-300">
                        <div className="text-xs font-bold text-indigo-700 mb-2">📈 Regime Detection Configuration</div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-neutral-600">MTF Analysis:</span>
                            <span className="font-semibold text-neutral-900">{strategy.rules.regimeDetection.enableMTFAnalysis ? 'Enabled ✅' : 'Disabled'}</span>
                          </div>
                          {strategy.rules.regimeDetection.primaryTimeframe && (
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Primary Timeframe:</span>
                              <span className="font-semibold text-neutral-900">{strategy.rules.regimeDetection.primaryTimeframe}</span>
                            </div>
                          )}
                          {strategy.rules.regimeDetection.confirmationTimeframes && (
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Confirmation TFs:</span>
                              <span className="font-semibold text-neutral-900">{strategy.rules.regimeDetection.confirmationTimeframes.join(', ')}</span>
                            </div>
                          )}
                          {(strategy.rules.regimeDetection.weightTrend || strategy.rules.regimeDetection.weightVolatility || strategy.rules.regimeDetection.weightRange) && (
                            <div className="mt-2 pt-2 border-t border-indigo-200">
                              <div className="text-neutral-600 mb-1">Weights:</div>
                              {strategy.rules.regimeDetection.weightTrend && (
                                <div className="flex justify-between pl-2">
                                  <span className="text-neutral-600">Trend:</span>
                                  <span className="font-semibold text-neutral-900">{(strategy.rules.regimeDetection.weightTrend * 100).toFixed(0)}%</span>
                                </div>
                              )}
                              {strategy.rules.regimeDetection.weightVolatility && (
                                <div className="flex justify-between pl-2">
                                  <span className="text-neutral-600">Volatility:</span>
                                  <span className="font-semibold text-neutral-900">{(strategy.rules.regimeDetection.weightVolatility * 100).toFixed(0)}%</span>
                                </div>
                              )}
                              {strategy.rules.regimeDetection.weightRange && (
                                <div className="flex justify-between pl-2">
                                  <span className="text-neutral-600">Range:</span>
                                  <span className="font-semibold text-neutral-900">{(strategy.rules.regimeDetection.weightRange * 100).toFixed(0)}%</span>
                                </div>
                              )}
                            </div>
                          )}
                          {strategy.rules.regimeDetection.minConfidence && (
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Min Confidence:</span>
                              <span className="font-semibold text-neutral-900">{strategy.rules.regimeDetection.minConfidence}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-8 flex gap-4 pt-6 border-t border-neutral-200">
                <Link
                  href={`/dashboard/backtest?strategyId=${strategy.id}`}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  <BarChart3 className="h-5 w-5" />
                  Run Backtest
                </Link>
                {/* Only show Edit button if user owns the strategy */}
                {!strategy.isSystemDefault && (
                  <Link
                    href={`/dashboard/strategies/${strategy.id}/edit`}
                    className="inline-flex items-center gap-2 px-6 py-3 border-2 border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors font-semibold"
                  >
                    <Edit2 className="h-5 w-5" />
                    Edit Strategy
                  </Link>
                )}
              </div>
            </div>
          )}

          {activeTab === "backtests" && (
            <div className="space-y-6">
              {/* Official Backtest Results (if verified) */}
              {strategy.backtestVerified && strategy.backtestResults && (
                <div>
                  <BacktestResults results={strategy.backtestResults} />
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      📊 These are official backtest results for this system default strategy
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      You can run additional custom backtests below to test different parameters or time periods.
                    </p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-neutral-900">Custom Backtest History</h3>
                <Link
                  href={`/dashboard/backtest?strategyId=${strategy.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Plus className="h-4 w-4" />
                  New Backtest
                </Link>
              </div>

              {backtestsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : backtests.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-neutral-900 mb-2">
                    No backtests yet
                  </h4>
                  <p className="text-neutral-600 mb-4">
                    Run your first backtest to see how this strategy performs
                  </p>
                  <Link
                    href={`/dashboard/backtest?strategyId=${strategy.id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Run Backtest
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {backtests.map((backtest) => (
                    <div
                      key={backtest.id}
                      className="border border-neutral-200 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-3">
                            <h4 className="font-medium text-neutral-900">
                              {backtest.dateFrom} to {backtest.dateTo}
                            </h4>
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                backtest.status === "completed"
                                  ? "bg-green-100 text-green-800"
                                  : backtest.status === "running"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                              }`}
                            >
                              {backtest.status}
                            </span>
                          </div>
                          <p className="text-sm text-neutral-600">
                            Created{" "}
                            {new Date(backtest.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Link
                          href={`/dashboard/backtest/${backtest.id}`}
                          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
                        >
                          View Details
                        </Link>
                      </div>

                      {backtest.status === "completed" && backtest.results && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-neutral-100">
                          <div>
                            <p className="text-xs text-neutral-600 mb-1">
                              Return
                            </p>
                            <p
                              className={`text-sm font-semibold ${
                                (backtest.results.returnPercentage || 0) >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {(backtest.results.returnPercentage || 0).toFixed(
                                2,
                              )}
                              %
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-neutral-600 mb-1">
                              Win Rate
                            </p>
                            <p className="text-sm font-semibold text-neutral-900">
                              {(backtest.results.winRate || 0).toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-neutral-600 mb-1">
                              Total Trades
                            </p>
                            <p className="text-sm font-semibold text-neutral-900">
                              {backtest.results.totalTrades || 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-neutral-600 mb-1">
                              Max Drawdown
                            </p>
                            <p className="text-sm font-semibold text-orange-600">
                              {(backtest.results.maxDrawdown || 0).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "trades" && (
            <div className="space-y-4">
              <h3 className="font-bold text-neutral-900">Recent Trades</h3>
              <div className="text-center py-8">
                <Activity className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-neutral-900 mb-2">
                  No trades yet
                </h4>
                <p className="text-neutral-600">
                  Activate this strategy to start seeing trades here
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Activate Strategy Dialog */}
      <ActivateStrategyDialog
        strategyId={strategy.id}
        strategyName={strategy.name}
        isOpen={showActivateDialog}
        onClose={() => setShowActivateDialog(false)}
        onActivated={handleStrategyActivated}
      />

      {/* Optimization Suggestion Modal */}
      {optimizationData && (
        <OptimizationSuggestionModal
          isOpen={showOptimizationModal}
          onClose={() => {
            setShowOptimizationModal(false);
            setOptimizationData(null);
          }}
          optimizationId={optimizationData.optimizationId}
          strategyName={optimizationData.strategyName}
          suggestions={optimizationData.suggestions}
          overallConfidence={optimizationData.overallConfidence}
          reasoning={optimizationData.reasoning}
          onApprove={handleApproveOptimization}
          onReject={handleRejectOptimization}
        />
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-sm text-neutral-600 mb-1">{label}</p>
      <p className="text-xl font-bold text-neutral-900 capitalize">{value}</p>
    </div>
  );
}
