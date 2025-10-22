'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Calendar,
  Filter,
  Download,
  PieChart,
  LineChart,
  Target,
  Zap,
  Award,
  AlertCircle
} from 'lucide-react';

interface PerformanceData {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalProfit: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  averageWin: number;
  averageLoss: number;
  sharpeRatio: number;
  monthlyData: {
    month: string;
    profit: number;
    trades: number;
  }[];
  strategyPerformance: {
    strategyId: string;
    name: string;
    profit: number;
    winRate: number;
    trades: number;
  }[];
  // Additional metadata from new API
  source?: 'trades' | 'backtests' | 'combined';
  hasRealTrades?: boolean;
  hasBacktests?: boolean;
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('6M');
  const [selectedMetric, setSelectedMetric] = useState<'overview' | 'profitability' | 'risk' | 'consistency'>('overview');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv' | 'excel'>('pdf');

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    if (status === 'authenticated') {
      fetchAnalytics();
    }
  }, [status, timeframe]);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`/api/analytics?timeframe=${timeframe}`);
      if (response.ok) {
        const analyticsData = await response.json();
        
        // Check if data is empty and provide guidance
        if (!analyticsData || analyticsData.totalTrades === 0) {
          return;
        }
        
        setData(analyticsData);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin">
          <div className="h-12 w-12 rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!data || data.totalTrades === 0) {
    return (
      <div className="text-center py-12 bg-blue-50 border border border-blue-200 rounded-lg p-6 text-center">
        <div className="mx-auto mb-4">
          <Activity className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-lg font-semibold text-blue-900 mb-2">No Activity Yet</p>
        </div>
        <p className="text-sm text-blue-700 mb-4">
          Start trading or run backtests to see analytics data
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4">
          <div className="text-center">
            <p className="text-sm text-neutral-600 mb-1">Strategy Creation</p>
            <p className="text-xs text-neutral-500">• Create strategy → Run backtest → See analytics</p>
            <Link
              href="/dashboard/strategies/new"
              className="inline-flex items-center gap-2 text-primary-600 font-semibold hover:text-primary-700"
            >
              Create Strategy
            </Link>
          </div>
          <div className="text-center">
            <p className="text-sm text-neutral-600 mb-1">Backtest Testing</p>
            <p className="text-xs text-neutral-500">• Test strategy → View analytics</p>
            <Link
              href="/dashboard/backtest"
              className="inline-flex items-center gap-2 text-primary-600 font-semibold hover:text-primary-700"
            >
              View Backtests
            </Link>
          </div>
          <div className="text-center">
            <p className="text-sm text-neutral-600 mb-1">Trade Execution</p>
            <p className="text-xs text-neutral-500">• Connect executor → Execute trades</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Analytics</h1>
          <p className="text-neutral-600 mt-1">Monitor your trading performance</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as any)}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="1M">Last Month</option>
            <option value="3M">Last 3 Months</option>
            <option value="6M">Last 6 Months</option>
            <option value="1Y">Last Year</option>
            <option value="ALL">All Time</option>
          </select>

          <button
            className="flex items-center gap-2 px-4 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
            onClick={() => setShowExportDialog(true)}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Data Source Info */}
      {data && (data.hasRealTrades || data.hasBacktests) && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <div className="flex items-start gap-3">
            <Activity className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-900 mb-1">
                Data Source: {data.hasRealTrades ? 'Real Trading' : 'Backtests'}
              </h4>
              <p className="text-xs text-blue-700 leading-relaxed">
                {data.hasRealTrades ? (
                  <>Analytics calculated from <strong>{data.totalTrades} real trades</strong>. These are actual trading results from your executed strategies.</>
                ) : (
                  <>Analytics calculated from <strong>{data.totalTrades} backtest executions</strong>. Run real trades to see live performance metrics.</>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metric Selector */}
      <div className="flex gap-2 mb-6">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'profitability', label: 'Profitability', icon: DollarSign },
          { id: 'risk', label: 'Risk Analysis', icon: Target },
          { id: 'consistency', label: 'Consistency', icon: Zap }
        ].map((metric) => (
          <button
            key={metric.id}
            onClick={() => setSelectedMetric(metric.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedMetric === metric.id
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            <metric.icon className="h-4 w-4" />
            {metric.label}
          </button>
        ))}
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Total Trades</span>
            <Activity className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900">{data.totalTrades}</p>
          <p className="text-xs text-neutral-500 mt-1">
            {data.winningTrades} wins, {data.losingTrades} losses
          </p>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Total Profit</span>
            {data.totalProfit >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </div>
          <p className={`text-2xl font-bold ${data.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${data.totalProfit.toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Win Rate</span>
            <Activity className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900">{data.winRate.toFixed(1)}%</p>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Max Drawdown</span>
            <TrendingDown className="h-4 w-4 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-orange-600">-{data.maxDrawdown.toFixed(1)}%</p>
        </div>
      </div>

      {/* Interactive Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Equity Curve */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <LineChart className="h-5 w-5" />
            Equity Curve
          </h2>
          <div className="h-64 bg-neutral-50 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <LineChart className="h-12 w-12 text-neutral-400 mx-auto mb-2" />
              <p className="text-neutral-500">Interactive equity chart</p>
              <p className="text-sm text-neutral-400">Shows account balance over time</p>
            </div>
          </div>
        </div>

        {/* Profit Distribution */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Profit Distribution
          </h2>
          <div className="h-64 bg-neutral-50 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <PieChart className="h-12 w-12 text-neutral-400 mx-auto mb-2" />
              <p className="text-neutral-500">Profit by symbol</p>
              <p className="text-sm text-neutral-400">Breakdown of profitability</p>
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Comparison */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
          <Award className="h-5 w-5" />
          Strategy Performance Comparison
        </h2>
        {data.strategyPerformance.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-2 px-4 text-sm font-medium text-neutral-700">Strategy</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-neutral-700">Profit</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-neutral-700">Win Rate</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-neutral-700">Trades</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-neutral-700">Profit Factor</th>
                  <th className="text-center py-2 px-4 text-sm font-medium text-neutral-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.strategyPerformance.map((strategy) => (
                  <tr key={strategy.strategyId} className="border-b border-neutral-100">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-neutral-900">{strategy.name}</p>
                        <p className="text-xs text-neutral-500">ID: {strategy.strategyId}</p>
                      </div>
                    </td>
                    <td className={`py-3 px-4 text-right font-medium ${
                      strategy.profit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${strategy.profit.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                        strategy.winRate >= 50 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {strategy.winRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-neutral-900">{strategy.trades}</td>
                    <td className="py-3 px-4 text-right text-neutral-900">
                      {(strategy.profit / (strategy.trades * 0.01)).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-neutral-500 text-center py-4">No strategy data available</p>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Performance */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Monthly Performance</h2>
          {data.monthlyData.length > 0 ? (
            <div className="space-y-3">
              {data.monthlyData.map((month) => (
                <div key={month.month} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-neutral-900 w-16">
                      {month.month}
                    </span>
                    <div className="flex-1 bg-neutral-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          month.profit >= 0 ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{
                          width: `${Math.min(Math.abs(month.profit) * 2, 100)}%`
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${
                      month.profit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${month.profit.toFixed(2)}
                    </p>
                    <p className="text-xs text-neutral-500">{month.trades} trades</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-neutral-500 text-center py-4">No monthly data available</p>
          )}
        </div>

        {/* Strategy Performance */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Strategy Performance</h2>
          {data.strategyPerformance.length > 0 ? (
            <div className="space-y-3">
              {data.strategyPerformance.map((strategy) => (
                <div key={strategy.strategyId} className="border-b border-neutral-100 pb-3 last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-neutral-900">
                      {strategy.name}
                    </span>
                    <span className={`text-sm font-medium ${
                      strategy.profit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${strategy.profit.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span>{strategy.trades} trades</span>
                    <span>Win Rate: {strategy.winRate.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-neutral-500 text-center py-4">No strategy data available</p>
          )}
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Risk Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-neutral-600 mb-1">Profit Factor</p>
            <p className="text-xl font-bold text-neutral-900">{data.profitFactor.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-neutral-600 mb-1">Average Win</p>
            <p className="text-xl font-bold text-green-600">${data.averageWin.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-neutral-600 mb-1">Average Loss</p>
            <p className="text-xl font-bold text-red-600">${data.averageLoss.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-neutral-600 mb-1">Sharpe Ratio</p>
            <p className="text-xl font-bold text-neutral-900">{data.sharpeRatio.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Performance Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">Performance Insights</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          {data.winRate < 40 && (
            <li>• Consider reviewing your entry/exit criteria to improve win rate</li>
          )}
          {data.maxDrawdown > 20 && (
            <li>• Your drawdown is quite high. Consider reducing position sizes</li>
          )}
          {data.profitFactor < 1.5 && (
            <li>• Focus on improving your profit factor by cutting losses early</li>
          )}
          {data.totalTrades < 20 && (
            <li>• You need more trades to get statistically significant results</li>
          )}
          {data.winRate >= 50 && data.profitFactor >= 1.5 && data.maxDrawdown <= 10 && (
            <li>• Great performance! Consider gradually increasing position sizes</li>
          )}
        </ul>
      </div>

      {/* Export Dialog */}
      {showExportDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Export Report</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Export Format
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'pdf', label: 'PDF Report', description: 'Comprehensive report with charts' },
                    { value: 'csv', label: 'CSV Data', description: 'Raw data for analysis' },
                    { value: 'excel', label: 'Excel Workbook', description: 'Detailed spreadsheet with all metrics' }
                  ].map((format) => (
                    <label key={format.value} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        value={format.value}
                        checked={exportFormat === format.value}
                        onChange={(e) => setExportFormat(e.target.value as any)}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium text-neutral-900">{format.label}</p>
                        <p className="text-sm text-neutral-500">{format.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                onClick={() => setShowExportDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  // Handle export logic here
                  console.log(`Exporting as ${exportFormat}`);
                  setShowExportDialog(false);
                }}
                className="flex-1"
              >
                Export Report
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
