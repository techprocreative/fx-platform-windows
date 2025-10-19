'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Calendar,
  Filter,
  Download,
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
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('6M');

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

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-600">No analytics data available</p>
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

          <button className="flex items-center gap-2 px-4 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
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
    </div>
  );
}
