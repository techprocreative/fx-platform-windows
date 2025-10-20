'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  BarChart3,
  Plus,
  Play,
  TrendingUp,
  TrendingDown,
  Clock,
  Calendar,
  DollarSign,
  Activity,
} from 'lucide-react';

import { LoadingState, TableLoadingState } from '@/components/ui/LoadingState';
import { InlineError, CardError } from '@/components/ui/ErrorMessage';
import { useConfirmDialog, confirmDiscard } from '@/components/ui/ConfirmDialog';
import { BacktestStatus, ProgressIndicator } from '@/components/ui/StatusIndicator';
import { useBacktestStatus } from '@/hooks/useWebSocket';

interface Strategy {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  status: string;
  type: string;
  createdAt: string;
}

interface Backtest {
  id: string;
  strategyId: string;
  strategy?: {
    id: string;
    name: string;
    symbol: string;
    timeframe: string;
  };
  status: 'running' | 'completed' | 'failed';
  dateFrom: string;
  dateTo: string;
  settings?: {
    symbol: string;
    interval: string;
    preferredDataSource?: string;
  };
  initialBalance: number;
  results?: {
    finalBalance?: number;
    totalReturn?: number;
    returnPercentage?: number;
    maxDrawdown?: number;
    winRate?: number;
    totalTrades?: number;
    progress?: number;
  };
  createdAt: string;
  completedAt?: string;
}

export default function BacktestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [backtests, setBacktests] = useState<Backtest[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewBacktest, setShowNewBacktest] = useState(false);
  const [runningBacktests, setRunningBacktests] = useState<Set<string>>(new Set());
  const [error, setError] = useState<Error | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [formData, setFormData] = useState({
    strategyId: '',
    symbol: '',
    interval: '1h',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    initialBalance: 10000,
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
      return;
    }
    if (status === 'authenticated') {
      fetchData();
      
      // Set up interval for updating running backtests
      const interval = setInterval(() => {
        if (runningBacktests.size > 0) {
          fetchData();
        }
      }, 5000); // Update every 5 seconds if there are running backtests

      return () => clearInterval(interval);
    }
    return undefined;
  }, [status, runningBacktests.size]);

  const fetchData = async () => {
    try {
      setError(null);
      const [backtestsRes, strategiesRes] = await Promise.all([
        fetch('/api/backtest'),
        fetch('/api/strategy'),
      ]);

      if (!backtestsRes.ok) {
        throw new Error(`Failed to fetch backtests: ${backtestsRes.statusText}`);
      }

      if (!strategiesRes.ok) {
        throw new Error(`Failed to fetch strategies: ${strategiesRes.statusText}`);
      }

      const backtestsData = await backtestsRes.json();
      const strategiesData = await strategiesRes.json();
      
      setBacktests(backtestsData.backtests || []);
      setStrategies(strategiesData.strategies || []);
      
      // Update running backtests set
      const runningIds = new Set<string>(
        backtestsData.backtests
          .filter((bt: Backtest) => bt.status === 'running')
          .map((bt: Backtest) => bt.id)
      );
      setRunningBacktests(runningIds);

    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to fetch data');
      setError(err);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Convert strategy timeframe to backtest interval format
  const convertTimeframeToInterval = (timeframe: string): string => {
    const map: Record<string, string> = {
      'M1': '1min',
      'M5': '5min',
      'M15': '15min',
      'M30': '30min',
      'H1': '1h',
      'H4': '4h',
      'D1': '1d',
      'W1': '1w',
    };
    return map[timeframe.toUpperCase()] || '1h';
  };

  const handleStrategyChange = (strategyId: string) => {
    const selectedStrategy = strategies.find(s => s.id === strategyId);
    if (selectedStrategy) {
      setFormData(prev => ({
        ...prev,
        strategyId,
        symbol: selectedStrategy.symbol,
        interval: convertTimeframeToInterval(selectedStrategy.timeframe),
      }));
    }
  };

  const handleRunBacktest = async () => {
    if (!formData.strategyId) {
      toast.error('Please select a strategy');
      return;
    }

    if (!formData.symbol) {
      toast.error('Strategy symbol is not set');
      return;
    }

    try {
      setSubmitting(true);
      
      // Convert dates to ISO datetime format with time component
      const requestData = {
        ...formData,
        startDate: `${formData.startDate}T00:00:00Z`,
        endDate: `${formData.endDate}T23:59:59Z`,
      };
      
      const response = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start backtest');
      }

      toast.success('Backtest started successfully!');
      setRunningBacktests(prev => new Set(prev).add(data.backtest.id));
      setShowNewBacktest(false);
      fetchData();
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to start backtest');
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelForm = async () => {
    if (showNewBacktest) {
      const confirmed = await confirm(confirmDiscard());
      if (confirmed) {
        setShowNewBacktest(false);
        // Reset form
        setFormData({
          strategyId: '',
          symbol: '',
          interval: '1h',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          initialBalance: 10000,
        });
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return `${days} days`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">Backtesting</h1>
            <p className="text-neutral-600 mt-1">
              Loading your backtests...
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white">
          <TableLoadingState />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">Backtesting</h1>
            <p className="text-neutral-600 mt-1">
              Test your strategies on historical data
            </p>
          </div>
        </div>
        <InlineError
          error={error}
          retry={fetchData}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Backtesting</h1>
          <p className="text-neutral-600 mt-1">Test your strategies on historical data</p>
        </div>

        <button
          onClick={() => setShowNewBacktest(!showNewBacktest)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-white font-semibold hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          New Backtest
        </button>
      </div>

      {/* New Backtest Form */}
      {showNewBacktest && (
        <div className="rounded-lg border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Run New Backtest</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Strategy *</label>
              <select
                value={formData.strategyId}
                onChange={(e) => handleStrategyChange(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="">Select a strategy</option>
                {strategies
                  .filter(s => s.status === 'draft' || s.status === 'active')
                  .map(strategy => (
                    <option key={strategy.id} value={strategy.id}>
                      {strategy.name} ({strategy.symbol} {strategy.timeframe})
                    </option>
                  ))}
              </select>
              <p className="text-xs text-neutral-500 mt-1">Symbol and timeframe will be auto-filled from selected strategy</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Symbol</label>
              <div className="w-full rounded-lg border border-neutral-300 px-4 py-2 bg-neutral-50 text-neutral-700">
                {formData.symbol ? formData.symbol : <span className="text-neutral-400">Select a strategy first</span>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Timeframe</label>
              <div className="w-full rounded-lg border border-neutral-300 px-4 py-2 bg-neutral-50 text-neutral-700">
                {formData.interval ? formData.interval.toUpperCase() : <span className="text-neutral-400">Select a strategy first</span>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Initial Balance</label>
              <input
                type="number"
                value={formData.initialBalance}
                onChange={(e) => setFormData(prev => ({ ...prev, initialBalance: Number(e.target.value) }))}
                min="100"
                max="1000000"
                className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleRunBacktest}
              disabled={!formData.strategyId || submitting}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-primary-600/50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {submitting ? 'Starting...' : 'Run Backtest'}
            </button>
            <button
              onClick={handleCancelForm}
              disabled={submitting}
              className="px-6 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Backtest Results */}
      {backtests.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-12 text-center">
          <BarChart3 className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-neutral-900">No backtests yet</h3>
          <p className="text-neutral-600 mt-1">
            Run a backtest to see how your strategies perform on historical data
          </p>

          {strategies.length === 0 ? (
            <div className="mt-6 bg-neutral-50 rounded-lg p-4">
              <p className="text-sm text-neutral-600 mb-2">
                You need to create a strategy first before running backtests.
              </p>
              <Link
                href="/dashboard/strategies/new"
                className="inline-flex items-center gap-2 text-primary-600 font-semibold hover:text-primary-700"
              >
                <Plus className="h-4 w-4" />
                Create Strategy
              </Link>
            </div>
          ) : (
            <button
              onClick={() => setShowNewBacktest(true)}
              className="mt-6 inline-flex items-center gap-2 text-primary-600 font-semibold hover:text-primary-700"
            >
              <Plus className="h-4 w-4" />
              Create Backtest
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {backtests.map((backtest) => (
            <div
              key={backtest.id}
              className="rounded-lg border border-neutral-200 bg-white p-6 hover:border-primary-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-neutral-900">
                      {backtest.strategy?.name || 'Unknown Strategy'}
                    </h3>
                    <BacktestStatus
                      status={backtest.status}
                      progress={(backtest.results as any)?.progress}
                    />
                    {runningBacktests.has(backtest.id) && (
                      <RealtimeBacktestStatus backtestId={backtest.id} />
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-neutral-600 mb-3">
                    <span>{backtest.settings?.symbol} • {backtest.settings?.interval}</span>
                    <span>•</span>
                    <span>{formatDuration(backtest.dateFrom, backtest.dateTo)}</span>
                    <span>•</span>
                    <span>Created {formatDate(backtest.createdAt)}</span>
                  </div>
                </div>

                {backtest.status === 'completed' && (
                  <Link
                    href={`/dashboard/backtest/${backtest.id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
                  >
                    View Details
                  </Link>
                )}
              </div>

              {backtest.status === 'completed' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-neutral-100">
                  <div>
                    <p className="text-xs text-neutral-600 mb-1">Return</p>
                    <p className={`text-lg font-semibold ${((backtest.results as any)?.returnPercentage || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {((backtest.results as any)?.returnPercentage || 0).toFixed(2)}%
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-neutral-600 mb-1">Win Rate</p>
                    <p className="text-lg font-semibold text-neutral-900">
                      {((backtest.results as any)?.winRate || 0).toFixed(1)}%
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-neutral-600 mb-1">Total Trades</p>
                    <p className="text-lg font-semibold text-neutral-900">
                      {(backtest.results as any)?.totalTrades || 0}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-neutral-600 mb-1">Max Drawdown</p>
                    <p className="text-lg font-semibold text-orange-600">
                      {((backtest.results as any)?.maxDrawdown || 0).toFixed(1)}%
                    </p>
                  </div>
                </div>
              )}

              {backtest.status === 'running' && (
                <div className="pt-4 border-t border-neutral-100">
                  <div className="flex items-center gap-3">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <p className="text-sm text-neutral-600">
                      Processing historical data and running simulation...
                    </p>
                  </div>
                </div>
              )}

              {backtest.status === 'failed' && (
                <div className="pt-4 border-t border-neutral-100">
                  <p className="text-sm text-red-600">
                    Backtest failed. Please check your strategy configuration and try again.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Confirmation Dialog */}
      <ConfirmDialog />
    </div>
  );
}

// Component for real-time backtest status updates
function RealtimeBacktestStatus({ backtestId }: { backtestId: string }) {
  const backtestStatus = useBacktestStatus(backtestId);
  
  if (!backtestStatus) {
    return (
      <div className="flex items-center gap-1 text-yellow-600">
        <div className="w-2 h-2 bg-yellow-600 rounded-full animate-pulse" />
        <span className="text-xs">Running...</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2">
      {backtestStatus.progress !== undefined && (
        <div className="text-xs text-neutral-600">
          {Math.round(backtestStatus.progress)}%
        </div>
      )}
      {backtestStatus.currentStep && (
        <div className="text-xs text-neutral-600 max-w-32 truncate">
          {backtestStatus.currentStep}
        </div>
      )}
    </div>
  );
}
