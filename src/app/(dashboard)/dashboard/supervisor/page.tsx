'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { 
  Brain, 
  DollarSign, 
  TrendingUp, 
  ArrowLeft,
  RefreshCw,
  Settings,
  Activity,
  AlertTriangle
} from 'lucide-react';

import { LLMCostDashboard } from '@/components/supervisor/LLMCostDashboard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface OptimizationSummary {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  testing: number;
  active: number;
  successful: number;
  rolledBack: number;
}

export default function SupervisorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [optimizationSummary, setOptimizationSummary] = useState<OptimizationSummary | null>(null);

  useEffect(() => {
    checkAuth();
    fetchOptimizationSummary();
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

  const fetchOptimizationSummary = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/supervisor/usage-stats?period=all');
      
      if (response.ok) {
        const data = await response.json();
        setOptimizationSummary(data.optimizations);
      }
    } catch (error) {
      console.error('Failed to fetch optimization summary:', error);
    } finally {
      setLoading(false);
    }
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
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    AI Supervisor Dashboard
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Monitor LLM-powered parameter optimization and cost tracking
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={fetchOptimizationSummary}
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
          ) : optimizationSummary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Total Optimizations */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-2">
                  <Activity className="w-4 h-4" />
                  <span className="text-sm font-medium">Total Optimizations</span>
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {optimizationSummary.total}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  All time
                </div>
              </div>

              {/* Successful */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-medium">Successful</span>
                </div>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {optimizationSummary.successful}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {optimizationSummary.total > 0 
                    ? `${((optimizationSummary.successful / optimizationSummary.total) * 100).toFixed(1)}% success rate`
                    : 'No data yet'}
                </div>
              </div>

              {/* Active */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                  <Settings className="w-4 h-4 animate-spin-slow" />
                  <span className="text-sm font-medium">Active Now</span>
                </div>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {optimizationSummary.active}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Currently running
                </div>
              </div>

              {/* Pending Approval */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">Pending Approval</span>
                </div>
                <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                  {optimizationSummary.pending}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Needs review
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Quality-First Strategy */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Brain className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Quality-First Strategy
              </h3>
            </div>
            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <div className="flex items-center justify-between">
                <span>Critical Operations:</span>
                <span className="font-medium">Grok 4 Fast ⚡</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Complex Reasoning:</span>
                <span className="font-medium">GLM-4.6 🧠</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Non-Critical:</span>
                <span className="font-medium">GPT-OSS-120B 💰</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Fallback:</span>
                <span className="font-medium">DeepSeek 🏆</span>
              </div>
            </div>
          </div>

          {/* Safety Features */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-green-600 dark:text-green-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Safety Features
              </h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400">✓</span>
                <span>Parameter validation (11 parameters)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400">✓</span>
                <span>Risk simulation on historical data</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400">✓</span>
                <span>Auto-rollback on degradation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400">✓</span>
                <span>Circuit breaker (5 safety checks)</span>
              </li>
            </ul>
          </div>

          {/* Confidence Levels */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Confidence Levels
              </h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400 font-bold">≥95%:</span>
                <span className="text-gray-700 dark:text-gray-300">Auto-apply (very high confidence)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 font-bold">85-94%:</span>
                <span className="text-gray-700 dark:text-gray-300">Request approval (good confidence)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-600 dark:text-amber-400 font-bold">70-84%:</span>
                <span className="text-gray-700 dark:text-gray-300">Suggest only (moderate)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-red-600 dark:text-red-400 font-bold">&lt;70%:</span>
                <span className="text-gray-700 dark:text-gray-300">Reject (insufficient data)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Dashboard */}
        <LLMCostDashboard />

        {/* How to Use */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            How to Use AI Supervisor
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700 dark:text-gray-300">
            <div>
              <div className="font-semibold text-blue-600 dark:text-blue-400 mb-2">1. Activate Strategy</div>
              <p>Go to your strategy page and activate it on executors with at least 20 trades for analysis.</p>
            </div>
            <div>
              <div className="font-semibold text-blue-600 dark:text-blue-400 mb-2">2. Trigger Optimization</div>
              <p>Click "Optimize with AI" button. LLM will analyze performance and suggest improvements.</p>
            </div>
            <div>
              <div className="font-semibold text-blue-600 dark:text-blue-400 mb-2">3. Review & Approve</div>
              <p>If confidence is 85-94%, review suggestions and approve. ≥95% auto-applies with safety checks.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
