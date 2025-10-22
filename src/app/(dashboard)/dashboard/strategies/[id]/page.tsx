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
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useApiRequest } from "@/hooks/useApiRequest";
import { ActivateStrategyDialog } from "@/components/strategies/ActivateStrategyDialog";
import { OptimizationSuggestionModal } from "@/components/supervisor/OptimizationSuggestionModal";

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
    if (!confirm('Are you sure you want to deactivate this strategy? All executors will stop executing it.')) {
      return;
    }

    setActivating(true);
    try {
      const response = await fetch(`/api/strategy/${strategy.id}/activate`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to deactivate strategy');
      }

      toast.success(data.message);
      
      // Refresh strategy data
      execute(async () => {
        const response = await fetch(`/api/strategy/${params.id}`);
        if (!response.ok) throw new Error('Failed to refresh strategy');
        return response.json();
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('An error occurred');
      toast.error(err.message);
    } finally {
      setActivating(false);
    }
  };

  const handleStrategyActivated = () => {
    // Refresh strategy data
    execute(async () => {
      const response = await fetch(`/api/strategy/${params.id}`);
      if (!response.ok) throw new Error('Failed to refresh strategy');
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
      const response = await fetch('/api/executor');
      if (response.ok) {
        const data = await response.json();
        const onlineExecutors = (data.executors || [])
          .filter((e: any) => e.isConnected)
          .map((e: any) => e.id);
        setExecutorIds(onlineExecutors);
      }
    } catch (error) {
      console.error('Failed to fetch executors:', error);
    }
  };

  const handleOptimize = async () => {
    if (executorIds.length === 0) {
      toast.error('No online executors available. Please connect an executor first.');
      return;
    }

    if (strategy._count.trades < 20) {
      const confirmed = confirm(
        `This strategy only has ${strategy._count.trades} trades. ` +
        'AI optimization requires at least 20 trades for reliable analysis. ' +
        'Continue anyway?'
      );
      if (!confirmed) return;
    }

    setOptimizing(true);
    try {
      const response = await fetch('/api/supervisor/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: strategy.id,
          executorIds: executorIds,
          forceOptimize: strategy._count.trades < 20
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Optimization failed');
      }

      if (result.status === 'APPROVED') {
        toast.success('Optimization approved and applied automatically!');
        // Refresh strategy data
        handleStrategyActivated();
      } else if (result.status === 'REQUIRES_APPROVAL') {
        // Show modal for user approval
        setOptimizationData({
          optimizationId: result.optimizationId,
          strategyName: strategy.name,
          suggestions: result.suggestions,
          overallConfidence: result.confidence,
          reasoning: result.suggestions?.[0]?.reasoning || 'AI analysis complete'
        });
        setShowOptimizationModal(true);
      } else if (result.status === 'REJECTED') {
        toast.error(result.error || 'Optimization rejected by AI (low confidence)');
      }
    } catch (error: any) {
      console.error('Optimization error:', error);
      toast.error(error.message || 'Failed to optimize strategy');
    } finally {
      setOptimizing(false);
    }
  };

  const handleApproveOptimization = async (optimizationId: string) => {
    const response = await fetch(`/api/supervisor/optimize/${optimizationId}/apply`, {
      method: 'POST'
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to apply optimization');
    }

    // Refresh strategy data
    handleStrategyActivated();
  };

  const handleRejectOptimization = async (optimizationId: string) => {
    const response = await fetch(`/api/supervisor/optimize/${optimizationId}/reject`, {
      method: 'POST'
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to reject optimization');
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
            <h1 className="text-3xl font-bold text-neutral-900">
              {strategy.name}
            </h1>
            <p className="text-neutral-600 mt-1">
              {strategy.symbol} • {strategy.timeframe}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {strategy.status === 'active' ? (
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
              disabled={optimizing || strategy.status !== 'active' || strategy._count.trades < 20}
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
            {(strategy.status !== 'active' || strategy._count.trades < 20) && !optimizing && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                  {strategy.status !== 'active' ? (
                    'Activate strategy first'
                  ) : strategy._count.trades < 20 ? (
                    <>
                      Need {20 - strategy._count.trades} more trade{20 - strategy._count.trades !== 1 ? 's' : ''} ({strategy._count.trades}/20)
                    </>
                  ) : (
                    'Ready to optimize'
                  )}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                    <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Progress Indicator */}
            {strategy.status === 'active' && strategy._count.trades < 20 && (
              <div className="absolute -bottom-6 left-0 right-0">
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-purple-600 to-blue-600 h-full transition-all duration-500"
                      style={{ width: `${(strategy._count.trades / 20) * 100}%` }}
                    ></div>
                  </div>
                  <span className="font-medium tabular-nums">{strategy._count.trades}/20</span>
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
          <Link
            href={`/dashboard/strategies/${strategy.id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2 text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            <Edit2 className="h-4 w-4" />
            Edit
          </Link>
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
            <div className="space-y-4">
              <h3 className="font-bold text-neutral-900">Strategy Rules</h3>

              {strategy.description && (
                <div>
                  <p className="text-sm font-medium text-neutral-600 mb-1">
                    Description
                  </p>
                  <p className="text-neutral-700">{strategy.description}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-neutral-600 mb-2">
                  Entry Conditions
                </p>
                <div className="space-y-2">
                  {strategy.rules?.entry?.conditions?.map(
                    (cond: any, idx: number) => (
                      <div
                        key={idx}
                        className="text-sm bg-neutral-50 p-3 rounded-lg"
                      >
                        {cond.indicator} {cond.condition} {cond.value}
                      </div>
                    ),
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-neutral-600 mb-2">
                  Exit Rules
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-sm bg-neutral-50 p-3 rounded-lg">
                    <p className="font-medium text-neutral-700">Take Profit</p>
                    <p className="text-neutral-600">
                      {strategy.rules?.exit?.takeProfit?.value}{" "}
                      {strategy.rules?.exit?.takeProfit?.type}
                    </p>
                  </div>
                  <div className="text-sm bg-neutral-50 p-3 rounded-lg">
                    <p className="font-medium text-neutral-700">Stop Loss</p>
                    <p className="text-neutral-600">
                      {strategy.rules?.exit?.stopLoss?.value}{" "}
                      {strategy.rules?.exit?.stopLoss?.type}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-neutral-600 mb-2">
                  Risk Management
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-sm bg-neutral-50 p-3 rounded-lg">
                    <p className="text-neutral-600">Lot Size</p>
                    <p className="font-medium text-neutral-900">
                      {strategy.rules?.riskManagement?.lotSize}
                    </p>
                  </div>
                  <div className="text-sm bg-neutral-50 p-3 rounded-lg">
                    <p className="text-neutral-600">Max Positions</p>
                    <p className="font-medium text-neutral-900">
                      {strategy.rules?.riskManagement?.maxPositions}
                    </p>
                  </div>
                  <div className="text-sm bg-neutral-50 p-3 rounded-lg">
                    <p className="text-neutral-600">Max Daily Loss</p>
                    <p className="font-medium text-neutral-900">
                      ${strategy.rules?.riskManagement?.maxDailyLoss}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex gap-4 pt-6 border-t border-neutral-200">
                <Link
                  href={`/dashboard/backtest?strategyId=${strategy.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <BarChart3 className="h-4 w-4" />
                  Run Backtest
                </Link>
              </div>
            </div>
          )}

          {activeTab === "backtests" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-neutral-900">Backtest History</h3>
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
