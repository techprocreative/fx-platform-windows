'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EquityCurveChart } from '@/components/analytics/EquityCurveChart';
import { ProfitDistributionChart } from '@/components/analytics/ProfitDistributionChart';
import { MonthlyPerformanceChart } from '@/components/analytics/MonthlyPerformanceChart';
import { StrategyPerformanceOverview } from '@/components/analytics/StrategyPerformanceOverview';
import { WinRateAnalysis } from '@/components/analytics/WinRateAnalysis';
import { RiskMetricsDashboard } from '@/components/analytics/RiskMetricsDashboard';
import { StrategyComparison } from '@/components/analytics/StrategyComparison';
import {
  PerformanceMetrics,
  StrategyScore,
  StrategyPerformanceData,
  AnalyticsComparison,
  PerformanceTrend,
  TimeFrame,
  AnalyticsFilters
} from '@/types';
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
  AlertCircle,
  Settings,
  RefreshCw,
  ChevronDown
} from 'lucide-react';

interface AnalyticsData {
  performance: StrategyPerformanceData | null;
  trends: PerformanceTrend[];
  comparison: AnalyticsComparison | null;
  filters: AnalyticsFilters;
  summary: {
    totalStrategies?: number;
    totalTrades: number;
    totalProfit: number;
    avgWinRate?: number;
    avgSharpeRatio?: number;
    bestStrategy?: any;
    worstStrategy?: any;
  };
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'winrate' | 'risk' | 'comparison' | 'trends'>('overview');
  const [timeframe, setTimeframe] = useState<TimeFrame>('6M');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('all');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('all');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv' | 'excel'>('pdf');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    if (status === 'authenticated') {
      fetchAnalytics();
    }
  }, [status, timeframe, selectedStrategy, selectedSymbol]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch performance data
      const performanceResponse = await fetch(
        `/api/analytics/performance?timeframe=${timeframe}${
          selectedStrategy !== 'all' ? `&strategyId=${selectedStrategy}` : ''
        }${
          selectedSymbol !== 'all' ? `&symbol=${selectedSymbol}` : ''
        }`
      );
      
      // Fetch trends data
      const trendsResponse = await fetch(
        `/api/analytics/trends?timeframe=${timeframe}&period=monthly&metric=profit`
      );
      
      // Fetch comparison data
      const comparisonResponse = await fetch(
        `/api/analytics/comparison?type=strategy&timeframe=${timeframe}`
      );
      
      let performanceData = null;
      let trendsData = [];
      let comparisonData = null;
      
      if (performanceResponse.ok) {
        const performanceResult = await performanceResponse.json();
        performanceData = performanceResult.performance;
      }
      
      if (trendsResponse.ok) {
        const trendsResult = await trendsResponse.json();
        trendsData = trendsResult.trends || [];
      }
      
      if (comparisonResponse.ok) {
        const comparisonResult = await comparisonResponse.json();
        comparisonData = comparisonResult.comparison;
      }
      
      setData({
        performance: performanceData,
        trends: trendsData,
        comparison: comparisonData,
        filters: {
          timeFrame: timeframe,
          strategies: selectedStrategy !== 'all' ? [selectedStrategy] : [],
          symbols: selectedSymbol !== 'all' ? [selectedSymbol] : []
        },
        summary: performanceData ? {
          totalTrades: performanceData.metrics.totalTrades,
          totalProfit: performanceData.metrics.totalProfit,
          avgWinRate: performanceData.metrics.winRate,
          avgSharpeRatio: performanceData.metrics.sharpeRatio
        } : {
          totalTrades: 0,
          totalProfit: 0,
          avgWinRate: 0,
          avgSharpeRatio: 0
        }
      });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchAnalytics();
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/analytics/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format: exportFormat,
          timeframe,
          filters: data?.filters
        }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-report.${exportFormat}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to export analytics:', error);
    }
    setShowExportDialog(false);
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

  if (!data || !data.performance || data.performance.metrics.totalTrades === 0) {
    return (
      <div className="text-center py-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
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
            onChange={(e) => setTimeframe(e.target.value as TimeFrame)}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="1D">Last Day</option>
            <option value="1W">Last Week</option>
            <option value="1M">Last Month</option>
            <option value="3M">Last 3 Months</option>
            <option value="6M">Last 6 Months</option>
            <option value="1Y">Last Year</option>
            <option value="ALL">All Time</option>
          </select>

          <button
            className="flex items-center gap-2 px-4 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
            Filters
            <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          <button
            className="flex items-center gap-2 px-4 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>

          <button
            className="flex items-center gap-2 px-4 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
            onClick={() => setShowExportDialog(true)}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Strategy</label>
              <select
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="all">All Strategies</option>
                {/* Strategy options would be populated from API */}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Symbol</label>
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="all">All Symbols</option>
                {/* Symbol options would be populated from API */}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => {
                  setSelectedStrategy('all');
                  setSelectedSymbol('all');
                }}
                variant="secondary"
                className="w-full"
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Data Source Info */}
      {data && data.performance && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <div className="flex items-start gap-3">
            <Activity className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-900 mb-1">
                Performance Analytics
              </h4>
              <p className="text-xs text-blue-700 leading-relaxed">
                Analytics calculated from <strong>{data.performance.metrics.totalTrades} trades</strong>.
                Showing performance metrics for the selected timeframe and filters.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'performance', label: 'Performance', icon: TrendingUp },
          { id: 'winrate', label: 'Win Rate', icon: Target },
          { id: 'risk', label: 'Risk Analysis', icon: Target },
          { id: 'comparison', label: 'Comparison', icon: Award },
          { id: 'trends', label: 'Trends', icon: LineChart }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {data && data.performance && (
        <>
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-neutral-600">Total Trades</span>
                    <Activity className="h-4 w-4 text-blue-500" />
                  </div>
                  <p className="text-2xl font-bold text-neutral-900">{data.performance.metrics.totalTrades}</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {data.performance.metrics.winningTrades} wins, {data.performance.metrics.losingTrades} losses
                  </p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-neutral-600">Total Profit</span>
                    {data.performance.metrics.totalProfit >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <p className={`text-2xl font-bold ${data.performance.metrics.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${data.performance.metrics.totalProfit.toFixed(2)}
                  </p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-neutral-600">Win Rate</span>
                    <Activity className="h-4 w-4 text-purple-500" />
                  </div>
                  <p className="text-2xl font-bold text-neutral-900">{data.performance.metrics.winRate.toFixed(1)}%</p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-neutral-600">Max Drawdown</span>
                    <TrendingDown className="h-4 w-4 text-orange-500" />
                  </div>
                  <p className="text-2xl font-bold text-orange-600">-{data.performance.metrics.maxDrawdownPercent.toFixed(1)}%</p>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Equity Curve</h3>
                  <EquityCurveChart
                    data={data.performance.equityCurve.map(point => ({
                      timestamp: point.timestamp.toISOString(),
                      equity: point.equity,
                      date: point.date
                    })) || []}
                    initialBalance={10000}
                  />
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Monthly Performance</h3>
                  <MonthlyPerformanceChart
                    data={data.performance.monthlyData.map(m => ({
                      month: m.month,
                      profit: m.profit,
                      trades: m.trades
                    }))}
                  />
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <StrategyPerformanceOverview
              metrics={data.performance.metrics}
              score={data.performance.score}
            />
          )}

          {activeTab === 'winrate' && (
            <WinRateAnalysis
              metrics={data.performance.metrics}
              monthlyData={data.performance.monthlyData}
            />
          )}

          {activeTab === 'risk' && (
            <RiskMetricsDashboard
              metrics={data.performance.metrics}
              drawdownPeriods={data.performance.drawdownPeriods}
              equityCurve={data.performance.equityCurve.map(point => ({
                timestamp: point.timestamp.toISOString(),
                equity: point.equity,
                date: point.date
              }))}
            />
          )}

          {activeTab === 'comparison' && (
            <StrategyComparison
              comparison={data.comparison}
              onRefresh={handleRefresh}
              onExport={handleExport}
            />
          )}

          {activeTab === 'trends' && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">Performance Trends</h3>
              <div className="h-80">
                {data.trends.length > 0 ? (
                  <div className="space-y-4">
                    {data.trends.map((trend, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                        <div>
                          <p className="font-medium text-neutral-900">{trend.period}</p>
                          <p className="text-sm text-neutral-600">{trend.metric}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${trend.trend === 'up' ? 'text-green-600' : trend.trend === 'down' ? 'text-red-600' : 'text-neutral-600'}`}>
                            {trend.value.toFixed(2)}
                          </p>
                          <p className={`text-sm ${trend.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {trend.change >= 0 ? '+' : ''}{trend.change.toFixed(2)} ({trend.changePercent.toFixed(1)}%)
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full bg-neutral-50 rounded-lg">
                    <p className="text-neutral-500">No trend data available</p>
                  </div>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Performance Tips */}
      {data && data.performance && (
        <Card className="p-6">
          <h3 className="font-semibold text-blue-900 mb-2">Performance Insights</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            {data.performance.metrics.winRate < 40 && (
              <li>• Consider reviewing your entry/exit criteria to improve win rate</li>
            )}
            {data.performance.metrics.maxDrawdownPercent > 20 && (
              <li>• Your drawdown is quite high. Consider reducing position sizes</li>
            )}
            {data.performance.metrics.profitFactor < 1.5 && (
              <li>• Focus on improving your profit factor by cutting losses early</li>
            )}
            {data.performance.metrics.totalTrades < 20 && (
              <li>• You need more trades to get statistically significant results</li>
            )}
            {data.performance.metrics.winRate >= 50 && data.performance.metrics.profitFactor >= 1.5 && data.performance.metrics.maxDrawdownPercent <= 10 && (
              <li>• Great performance! Consider gradually increasing position sizes</li>
            )}
          </ul>
        </Card>
      )}

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
                onClick={handleExport}
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
