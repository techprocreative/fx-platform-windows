'use client';

import { Card } from '@/components/ui/Card';
import { PerformanceMetrics, DrawdownPeriod } from '@/types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { 
  AlertTriangle, 
  TrendingDown, 
  Shield, 
  Target, 
  Activity,
  BarChart3
} from 'lucide-react';

interface RiskMetricsDashboardProps {
  metrics: PerformanceMetrics;
  drawdownPeriods?: DrawdownPeriod[];
  equityCurve?: Array<{ date: string; equity: number; drawdown?: number }>;
  className?: string;
}

export function RiskMetricsDashboard({ 
  metrics, 
  drawdownPeriods = [], 
  equityCurve = [],
  className = '' 
}: RiskMetricsDashboardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  // Prepare drawdown chart data
  const drawdownChartData = equityCurve.map(point => ({
    date: point.date,
    drawdown: point.drawdown || 0,
    equity: point.equity
  }));

  // Prepare risk metrics comparison data
  const riskMetricsData = [
    { 
      metric: 'Sharpe Ratio', 
      value: metrics.sharpeRatio, 
      benchmark: 2.0, 
      unit: '',
      good: true,
      description: 'Risk-adjusted returns'
    },
    { 
      metric: 'Sortino Ratio', 
      value: metrics.sortinoRatio, 
      benchmark: 2.0, 
      unit: '',
      good: metrics.sortinoRatio >= 2,
      description: 'Downside risk-adjusted returns'
    },
    { 
      metric: 'Max Drawdown', 
      value: metrics.maxDrawdownPercent, 
      benchmark: 15.0, 
      unit: '%',
      good: metrics.maxDrawdownPercent <= 15,
      description: 'Maximum peak to trough decline'
    },
    { 
      metric: 'Calmar Ratio', 
      value: metrics.calmarRatio, 
      benchmark: 1.0, 
      unit: '',
      good: metrics.calmarRatio >= 1,
      description: 'Return relative to max drawdown'
    },
    { 
      metric: 'Recovery Factor', 
      value: metrics.recoveryFactor, 
      benchmark: 2.0, 
      unit: '',
      good: metrics.recoveryFactor >= 2,
      description: 'Ability to recover from drawdowns'
    },
    { 
      metric: 'Risk of Ruin', 
      value: metrics.riskOfRuin, 
      benchmark: 10.0, 
      unit: '%',
      good: metrics.riskOfRuin <= 10,
      description: 'Probability of losing all capital'
    }
  ];

  // Prepare drawdown periods data
  const drawdownPeriodsData = drawdownPeriods.map(period => ({
    name: `DD ${period.id.split('_')[1]}`,
    depth: period.depthPercent,
    duration: period.duration,
    recovered: period.recovered ? 'Yes' : 'No',
    color: period.recovered ? '#10b981' : '#ef4444'
  }));

  // Prepare VaR data
  const varData = [
    { level: 'VaR 90%', value: Math.abs(metrics.var95 * 0.8), color: '#f59e0b' },
    { level: 'VaR 95%', value: Math.abs(metrics.var95), color: '#ef4444' },
    { level: 'VaR 99%', value: Math.abs(metrics.var95 * 1.2), color: '#991b1b' },
    { level: 'CVaR 95%', value: Math.abs(metrics.cvar95), color: '#7f1d1d' }
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-neutral-200 rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-neutral-900">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.name.includes('Drawdown') || entry.name.includes('VaR') 
                ? `${entry.value.toFixed(2)}%` 
                : entry.value.toFixed(2)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const getRiskLevel = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return { level: 'Low', color: 'text-green-600' };
    if (value <= thresholds.warning) return { level: 'Medium', color: 'text-yellow-600' };
    return { level: 'High', color: 'text-red-600' };
  };

  const drawdownRiskLevel = getRiskLevel(metrics.maxDrawdownPercent, { good: 10, warning: 20 });
  const varRiskLevel = getRiskLevel(Math.abs(metrics.var95), { good: 500, warning: 1000 });

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Risk Overview */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-neutral-900">Risk Overview</h3>
          <Shield className="h-5 w-5 text-blue-500" />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className={`text-2xl font-bold ${drawdownRiskLevel.color}`}>
              {formatPercent(metrics.maxDrawdownPercent)}
            </div>
            <div className="text-sm text-neutral-600">Max Drawdown</div>
            <div className={`text-xs ${drawdownRiskLevel.color}`}>
              {drawdownRiskLevel.level} Risk
            </div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${metrics.sharpeRatio >= 2 ? 'text-green-600' : metrics.sharpeRatio >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
              {metrics.sharpeRatio.toFixed(2)}
            </div>
            <div className="text-sm text-neutral-600">Sharpe Ratio</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${varRiskLevel.color}`}>
              {formatCurrency(Math.abs(metrics.var95))}
            </div>
            <div className="text-sm text-neutral-600">VaR (95%)</div>
            <div className={`text-xs ${varRiskLevel.color}`}>
              {varRiskLevel.level} Risk
            </div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${metrics.riskOfRuin <= 10 ? 'text-green-600' : metrics.riskOfRuin <= 25 ? 'text-yellow-600' : 'text-red-600'}`}>
              {formatPercent(metrics.riskOfRuin)}
            </div>
            <div className="text-sm text-neutral-600">Risk of Ruin</div>
          </div>
        </div>
      </Card>

      {/* Drawdown Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          Drawdown Analysis
        </h3>
        <div className="h-80">
          {drawdownChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={drawdownChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => `${value.toFixed(1)}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="drawdown"
                  stroke="#ef4444"
                  fill="#fca5a5"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full bg-neutral-50 rounded-lg">
              <p className="text-neutral-500">No drawdown data available</p>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Metrics Comparison */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Risk Metrics vs Benchmarks
          </h3>
          <div className="space-y-3">
            {riskMetricsData.map((item, index) => (
              <div key={index} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-neutral-700">{item.metric}</span>
                  <span className={`text-sm font-medium ${item.good ? 'text-green-600' : 'text-red-600'}`}>
                    {item.value.toFixed(2)}{item.unit}
                  </span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${item.good ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ 
                      width: `${Math.min(100, (item.value / item.benchmark) * 100)}%` 
                    }}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-neutral-500">{item.description}</span>
                  <span className="text-xs text-neutral-500">Benchmark: {item.benchmark}{item.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Drawdown Periods */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Drawdown Periods
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {drawdownPeriodsData.length > 0 ? (
              drawdownPeriodsData.map((period, index) => (
                <div key={index} className="border border-neutral-200 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">{period.name}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      period.recovered === 'Yes' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {period.recovered}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-neutral-500">Depth: </span>
                      <span className="font-medium text-red-600">{period.depth.toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-neutral-500">Duration: </span>
                      <span className="font-medium">{period.duration.toFixed(0)} days</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-neutral-500 text-center py-4">No drawdown periods recorded</p>
            )}
          </div>
        </Card>
      </div>

      {/* Value at Risk */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Value at Risk (VaR) Analysis
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={varData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="level" 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `$${value.toFixed(0)}`}
              />
              <Tooltip 
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Potential Loss']}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {varData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          {varData.map((item, index) => (
            <div key={index} className="text-center">
              <div className="text-xs text-neutral-600">{item.level}</div>
              <div className="text-sm font-semibold" style={{ color: item.color }}>
                {formatCurrency(item.value)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Risk Assessment */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Risk Assessment</h3>
        <div className="space-y-3">
          {metrics.maxDrawdownPercent > 20 && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium text-red-900">High Drawdown Risk</p>
                <p className="text-sm text-red-700">
                  Maximum drawdown of {formatPercent(metrics.maxDrawdownPercent)} exceeds recommended levels.
                  Consider reducing position sizes or improving stop loss strategy.
                </p>
              </div>
            </div>
          )}
          
          {metrics.sharpeRatio < 1 && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-900">Low Risk-Adjusted Returns</p>
                <p className="text-sm text-yellow-700">
                  Sharpe ratio of {metrics.sharpeRatio.toFixed(2)} is below the recommended minimum of 1.0.
                  Focus on improving your reward-to-risk ratio.
                </p>
              </div>
            </div>
          )}
          
          {metrics.maxDrawdownPercent <= 10 && metrics.sharpeRatio >= 2 && (
            <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Target className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium text-green-900">Excellent Risk Management</p>
                <p className="text-sm text-green-700">
                  Your strategy demonstrates strong risk control with low drawdown and good risk-adjusted returns.
                </p>
              </div>
            </div>
          )}
          
          {metrics.riskOfRuin > 25 && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium text-red-900">High Risk of Ruin</p>
                <p className="text-sm text-red-700">
                  Risk of ruin of {formatPercent(metrics.riskOfRuin)} indicates significant risk of losing all capital.
                  Immediate risk management adjustments are recommended.
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}