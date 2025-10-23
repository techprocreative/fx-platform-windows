'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { 
  Brain, 
  TrendingUp, 
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Activity,
  Calendar
} from 'lucide-react';

import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface Optimization {
  id: string;
  status: string;
  confidence: number;
  currentParameters: any;
  proposedParameters: any;
  reasoning: string;
  createdAt: string;
  appliedAt: string | null;
  evaluatedAt: string | null;
  wasSuccessful: boolean | null;
  affectedExecutors: string[];
  strategy?: {
    name: string;
    symbol: string;
  };
}

interface OptimizationStats {
  total: number;
  successful: number;
  active: number;
  pending: number;
  rolledBack: number;
}

export default function SupervisorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [optimizations, setOptimizations] = useState<Optimization[]>([]);
  const [stats, setStats] = useState<OptimizationStats | null>(null);
  const [selectedOptimization, setSelectedOptimization] = useState<Optimization | null>(null);

  useEffect(() => {
    checkAuth();
    fetchData();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/session');
      if (!response.ok) {
        router.replace('/login');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      router.replace('/login');
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch optimization stats
      const statsResponse = await fetch('/api/supervisor/usage-stats?period=all');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.optimizations);
      }

      // Fetch user's optimization history (we need to create this endpoint)
      const optimizationsResponse = await fetch('/api/supervisor/optimizations');
      if (optimizationsResponse.ok) {
        const optimizationsData = await optimizationsResponse.json();
        setOptimizations(optimizationsData.optimizations || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load optimization history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; icon: any; label: string }> = {
      APPROVED: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2, label: 'Applied' },
      TESTING: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: Activity, label: 'Testing' },
      ACTIVE: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2, label: 'Successful' },
      PENDING_APPROVAL: { color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock, label: 'Pending' },
      REJECTED: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400', icon: XCircle, label: 'Rejected' },
      ROLLED_BACK: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle, label: 'Rolled Back' },
    };

    const badge = badges[status] || badges.REJECTED;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  const getParameterLabel = (param: string): string => {
    const labels: Record<string, string> = {
      stopLossPips: 'Stop Loss',
      takeProfitPips: 'Take Profit',
      lotSize: 'Lot Size',
      riskPerTrade: 'Risk/Trade',
      maxConcurrentTrades: 'Max Trades',
      maxDailyTrades: 'Daily Trades',
      maxDailyLoss: 'Daily Loss',
    };
    return labels[param] || param;
  };

  const getChangedParameters = (current: any, proposed: any) => {
    const changes: Array<{ param: string; from: any; to: any; change: string }> = [];
    
    for (const [key, value] of Object.entries(proposed)) {
      if (current[key] !== value) {
        const changePercent = typeof value === 'number' && typeof current[key] === 'number'
          ? ((Number(value) - Number(current[key])) / Number(current[key]) * 100).toFixed(1)
          : null;
        
        changes.push({
          param: key,
          from: current[key],
          to: value,
          change: changePercent ? `${Number(changePercent) > 0 ? '+' : ''}${changePercent}%` : ''
        });
      }
    }
    
    return changes;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/dashboard"
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    AI Optimization History
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    View your strategy optimization results
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={fetchData}
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Stats */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          ) : stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Optimizations</div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="text-sm text-green-600 dark:text-green-400 mb-1">Successful</div>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.successful}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {stats.total > 0 ? `${((stats.successful / stats.total) * 100).toFixed(0)}% success rate` : 'No data'}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">Active Now</div>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.active}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="text-sm text-red-600 dark:text-red-400 mb-1">Rolled Back</div>
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.rolledBack}</div>
              </div>
            </div>
          )}
        </div>

        {/* Optimization History */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Recent Optimizations
            </h2>
          </div>

          {loading ? (
            <div className="p-6">
              <LoadingSpinner size="lg" />
            </div>
          ) : optimizations.length === 0 ? (
            <div className="p-12 text-center">
              <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Optimizations Yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Start by activating a strategy and clicking "Optimize with AI"
              </p>
              <Link
                href="/dashboard/strategies"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Strategies
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {optimizations.map((opt) => {
                const changes = getChangedParameters(opt.currentParameters, opt.proposedParameters);
                
                return (
                  <div
                    key={opt.id}
                    className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedOptimization(opt)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {opt.strategy?.name || 'Strategy Optimization'}
                          </h3>
                          {getStatusBadge(opt.status)}
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            opt.confidence >= 0.95 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : opt.confidence >= 0.85
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}>
                            {(opt.confidence * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Calendar className="w-4 h-4" />
                          {new Date(opt.createdAt).toLocaleString()}
                          {opt.strategy?.symbol && (
                            <>
                              <span>•</span>
                              <span>{opt.strategy.symbol}</span>
                            </>
                          )}
                          {opt.affectedExecutors.length > 0 && (
                            <>
                              <span>•</span>
                              <span>{opt.affectedExecutors.length} executor(s)</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Parameter Changes */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                      {changes.slice(0, 3).map((change, idx) => (
                        <div key={idx} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            {getParameterLabel(change.param)}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {change.from}
                            </span>
                            <ArrowRight className="w-3 h-3 text-gray-400" />
                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                              {change.to}
                            </span>
                            {change.change && (
                              <span className={`text-xs font-medium ${
                                change.change.startsWith('+') 
                                  ? 'text-green-600 dark:text-green-400' 
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                {change.change}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {changes.length > 3 && (
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            +{changes.length - 3} more changes
                          </span>
                        </div>
                      )}
                    </div>

                    {/* AI Reasoning (truncated) */}
                    <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {opt.reasoning}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-6">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                About AI Optimization
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                AI Supervisor analyzes your trading performance and suggests parameter improvements to maximize profitability. 
                Changes are applied only after thorough validation and risk assessment. 
                If performance degrades, parameters are automatically rolled back.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
