'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity, 
  CheckCircle2, 
  XCircle,
  Zap,
  BarChart3,
  Calendar
} from 'lucide-react';

interface UsageStats {
  period: string;
  summary: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    successRate: string;
    totalTokens: number;
    totalCost: string;
    avgDuration: number;
    avgTokensPerCall: number;
  };
  byModel: Array<{
    model: string;
    calls: number;
    cost: string;
    avgCostPerCall: string;
  }>;
  optimizations: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    testing: number;
    active: number;
    rolledBack: number;
    successful: number;
    avgConfidence: number;
  };
  dailyUsage: Array<{
    date: string;
    calls: number;
    tokens: number;
    cost: number;
  }>;
  recentLogs: Array<{
    id: string;
    model: string;
    tokens: number;
    duration: number;
    success: boolean;
    timestamp: Date;
    cost: string;
  }>;
}

interface LLMCostDashboardProps {
  className?: string;
}

export function LLMCostDashboard({ className = '' }: LLMCostDashboardProps) {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'24h' | '7d' | '30d' | 'all'>('30d');

  useEffect(() => {
    fetchStats();
  }, [period]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/supervisor/usage-stats?period=${period}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch usage stats');
      }
      
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch usage stats:', error);
      toast.error('Failed to load usage statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const modelDisplayNames: Record<string, string> = {
    'x-ai/grok-4-fast': 'Grok 4 Fast ⚡',
    'z-ai/glm-4.6': 'GLM-4.6 🧠',
    'openai/gpt-oss-120b': 'GPT-OSS-120B 💰',
    'deepseek/deepseek-chat': 'DeepSeek 🏆',
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              LLM Cost Dashboard
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Monitor your AI optimization costs and usage
            </p>
          </div>
          
          {/* Period Selector */}
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6">
        {/* Total Cost */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-900 dark:text-green-100">
                Total Cost
              </span>
            </div>
          </div>
          <div className="text-3xl font-bold text-green-900 dark:text-green-100">
            ${stats.summary.totalCost}
          </div>
          <div className="text-sm text-green-600 dark:text-green-400 mt-1">
            {stats.summary.totalCalls} API calls
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Success Rate
              </span>
            </div>
          </div>
          <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
            {stats.summary.successRate}%
          </div>
          <div className="text-sm text-blue-600 dark:text-blue-400 mt-1">
            {stats.summary.successfulCalls}/{stats.summary.totalCalls} calls
          </div>
        </div>

        {/* Total Tokens */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
                Total Tokens
              </span>
            </div>
          </div>
          <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">
            {(stats.summary.totalTokens / 1000).toFixed(1)}K
          </div>
          <div className="text-sm text-purple-600 dark:text-purple-400 mt-1">
            Avg {stats.summary.avgTokensPerCall} per call
          </div>
        </div>

        {/* Avg Duration */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Avg Duration
              </span>
            </div>
          </div>
          <div className="text-3xl font-bold text-amber-900 dark:text-amber-100">
            {(stats.summary.avgDuration / 1000).toFixed(1)}s
          </div>
          <div className="text-sm text-amber-600 dark:text-amber-400 mt-1">
            Per API call
          </div>
        </div>
      </div>

      {/* Cost by Model & Optimization Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-6 pb-6">
        {/* Cost by Model */}
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Cost by Model
          </h3>
          <div className="space-y-3">
            {stats.byModel.map((model) => (
              <div key={model.model} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {modelDisplayNames[model.model] || model.model}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {model.calls} calls
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                    <div
                      className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${(parseFloat(model.cost) / parseFloat(stats.summary.totalCost) * 100)}%`
                      }}
                    ></div>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    ${model.cost}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    ${model.avgCostPerCall}/call
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Optimization Stats */}
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Optimization Statistics
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.optimizations.successful}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Successful
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.optimizations.active}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Active
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {stats.optimizations.pending}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Pending
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {stats.optimizations.rolledBack}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Rolled Back
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Avg Confidence
              </span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {(stats.optimizations.avgConfidence * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="px-6 pb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent API Calls
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Model
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tokens
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {stats.recentLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-2 whitespace-nowrap text-gray-900 dark:text-white">
                    {modelDisplayNames[log.model] || log.model}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-600 dark:text-gray-400">
                    {log.tokens.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-600 dark:text-gray-400">
                    {(log.duration / 1000).toFixed(2)}s
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-900 dark:text-white font-medium">
                    ${log.cost}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {log.success ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                        <CheckCircle2 className="w-3 h-3" />
                        Success
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">
                        <XCircle className="w-3 h-3" />
                        Failed
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-600 dark:text-gray-400">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
