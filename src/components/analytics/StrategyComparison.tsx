'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AnalyticsComparison, ComparisonResult, TimeFrame } from '@/types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar,
  Legend
} from 'recharts';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Award, 
  Filter,
  Download,
  Target
} from 'lucide-react';

interface StrategyComparisonProps {
  comparison: AnalyticsComparison | null;
  onRefresh?: () => void;
  onExport?: () => void;
  className?: string;
}

export function StrategyComparison({ 
  comparison, 
  onRefresh, 
  onExport,
  className = '' 
}: StrategyComparisonProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    'totalProfit', 'winRate', 'sharpeRatio', 'maxDrawdownPercent'
  ]);
  const [viewMode, setViewMode] = useState<'bar' | 'radar'>('bar');

  if (!comparison) {
    return (
      <div className={`flex items-center justify-center h-64 bg-neutral-50 rounded-lg border border-neutral-200 ${className}`}>
        <div className="text-center">
          <BarChart3 className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
          <p className="text-lg font-semibold text-neutral-900 mb-2">No Comparison Data</p>
          <p className="text-sm text-neutral-600 mb-4">
            Select strategies or symbols to compare their performance
          </p>
          <Button onClick={onRefresh} variant="primary">
            Load Comparison
          </Button>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const formatValue = (value: number, metric: string) => {
    switch (metric) {
      case 'totalProfit':
        return formatCurrency(value);
      case 'winRate':
      case 'maxDrawdownPercent':
        return formatPercent(value);
      case 'sharpeRatio':
      case 'profitFactor':
      case 'totalTrades':
      case 'averageWin':
      case 'averageLoss':
        return value.toFixed(2);
      default:
        return value.toString();
    }
  };

  // Prepare data for bar chart
  const barChartData = comparison.results.map(result => {
    const data: any = {
      name: comparison.items.find(item => item.id === result.itemId)?.name || result.itemId,
      score: result.score,
      rank: result.rank
    };
    
    selectedMetrics.forEach(metric => {
      data[metric] = result.metrics[metric] || 0;
    });
    
    return data;
  });

  // Prepare data for radar chart
  const radarChartData = selectedMetrics.map(metric => {
    const data: any = {
      metric: getMetricDisplayName(metric)
    };
    
    comparison.results.forEach(result => {
      const name = comparison.items.find(item => item.id === result.itemId)?.name || result.itemId;
      let normalizedValue = normalizeMetricValue(result.metrics[metric] || 0, metric);
      data[name] = normalizedValue;
    });
    
    return data;
  });

  function getMetricDisplayName(metric: string): string {
    const displayNames: Record<string, string> = {
      totalProfit: 'Total Profit',
      winRate: 'Win Rate',
      sharpeRatio: 'Sharpe Ratio',
      maxDrawdownPercent: 'Max Drawdown',
      profitFactor: 'Profit Factor',
      totalTrades: 'Total Trades',
      averageWin: 'Average Win',
      averageLoss: 'Average Loss'
    };
    return displayNames[metric] || metric;
  }

  function normalizeMetricValue(value: number, metric: string): number {
    // Normalize values to 0-100 scale for radar chart
    switch (metric) {
      case 'totalProfit':
        // Assuming -1000 to 10000 range
        return Math.max(0, Math.min(100, (value + 1000) / 110));
      case 'winRate':
        return Math.min(100, value);
      case 'sharpeRatio':
        // Assuming 0-5 range
        return Math.min(100, value * 20);
      case 'maxDrawdownPercent':
        // Lower is better, so invert
        return Math.max(0, 100 - value);
      case 'profitFactor':
        // Assuming 0-5 range
        return Math.min(100, value * 20);
      case 'totalTrades':
        // Assuming 0-1000 range
        return Math.min(100, value / 10);
      case 'averageWin':
        // Assuming 0-1000 range
        return Math.min(100, value / 10);
      case 'averageLoss':
        // Assuming 0-1000 range, lower is better
        return Math.max(0, 100 - (value / 10));
      default:
        return Math.min(100, Math.max(0, value));
    }
  }

  const toggleMetric = (metric: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metric) 
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    );
  };

  const availableMetrics = [
    { id: 'totalProfit', name: 'Total Profit', icon: '💰' },
    { id: 'winRate', name: 'Win Rate', icon: '🎯' },
    { id: 'sharpeRatio', name: 'Sharpe Ratio', icon: '📊' },
    { id: 'maxDrawdownPercent', name: 'Max Drawdown', icon: '📉' },
    { id: 'profitFactor', name: 'Profit Factor', icon: '⚖️' },
    { id: 'totalTrades', name: 'Total Trades', icon: '📈' },
    { id: 'averageWin', name: 'Average Win', icon: '💹' },
    { id: 'averageLoss', name: 'Average Loss', icon: '📉' }
  ];

  const colors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
    '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-neutral-200 rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-neutral-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {getMetricDisplayName(entry.dataKey)}: {formatValue(entry.value, entry.dataKey)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const RadarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-neutral-200 rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-neutral-900 mb-2">{payload[0].payload.metric}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(1)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">{comparison.name}</h2>
          <p className="text-neutral-600">
            {comparison.type.charAt(0).toUpperCase() + comparison.type.slice(1)} comparison 
            from {comparison.period.start.toLocaleDateString()} to {comparison.period.end.toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onRefresh} variant="secondary" size="sm">
            <TrendingUp className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button onClick={onExport} variant="secondary" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Best Performer</span>
            <Award className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-lg font-semibold text-green-600">
            {comparison.items.find(item => item.id === comparison.results[0]?.itemId)?.name || 'N/A'}
          </p>
          <p className="text-sm text-neutral-500">
            Score: {comparison.results[0]?.score.toFixed(1) || 'N/A'}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Items Compared</span>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-lg font-semibold text-blue-600">{comparison.results.length}</p>
          <p className="text-sm text-neutral-500">
            {comparison.type}s analyzed
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Performance Gap</span>
            <Target className="h-4 w-4 text-orange-500" />
          </div>
          <p className="text-lg font-semibold text-orange-600">
            {comparison.results.length > 1 
              ? `${(comparison.results[0].score - comparison.results[comparison.results.length - 1].score).toFixed(1)} pts`
              : 'N/A'
            }
          </p>
          <p className="text-sm text-neutral-500">
            Score difference
          </p>
        </Card>
      </div>

      {/* Metrics Selection */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Select Metrics
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('bar')}
              className={`px-3 py-1 text-sm rounded-md ${
                viewMode === 'bar' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Bar Chart
            </button>
            <button
              onClick={() => setViewMode('radar')}
              className={`px-3 py-1 text-sm rounded-md ${
                viewMode === 'radar' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Radar Chart
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableMetrics.map(metric => (
            <button
              key={metric.id}
              onClick={() => toggleMetric(metric.id)}
              className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                selectedMetrics.includes(metric.id)
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              <span className="mr-1">{metric.icon}</span>
              {metric.name}
            </button>
          ))}
        </div>
      </Card>

      {/* Comparison Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Performance Comparison</h3>
        <div className="h-96">
          {viewMode === 'bar' ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="name" 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                {selectedMetrics.map((metric, index) => (
                  <Bar 
                    key={metric}
                    dataKey={metric} 
                    fill={colors[index % colors.length]}
                    name={getMetricDisplayName(metric)}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarChartData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis 
                  dataKey="metric" 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                />
                <PolarRadiusAxis 
                  angle={90} 
                  domain={[0, 100]} 
                  stroke="#6b7280"
                />
                <Tooltip content={<RadarTooltip />} />
                {comparison.results.map((result, index) => {
                  const name = comparison.items.find(item => item.id === result.itemId)?.name || result.itemId;
                  return (
                    <Radar
                      key={result.itemId}
                      name={name}
                      dataKey={name}
                      stroke={colors[index % colors.length]}
                      fill={colors[index % colors.length]}
                      fillOpacity={0.2}
                    />
                  );
                })}
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Detailed Results Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Detailed Results</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="text-left py-2 px-4 text-sm font-medium text-neutral-700">Rank</th>
                <th className="text-left py-2 px-4 text-sm font-medium text-neutral-700">
                  {comparison.type.charAt(0).toUpperCase() + comparison.type.slice(1)}
                </th>
                <th className="text-right py-2 px-4 text-sm font-medium text-neutral-700">Score</th>
                {selectedMetrics.map(metric => (
                  <th key={metric} className="text-right py-2 px-4 text-sm font-medium text-neutral-700">
                    {getMetricDisplayName(metric)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.results.map((result, index) => (
                <tr key={result.itemId} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="py-3 px-4">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      result.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                      result.rank === 2 ? 'bg-gray-100 text-gray-800' :
                      result.rank === 3 ? 'bg-orange-100 text-orange-800' :
                      'bg-neutral-100 text-neutral-800'
                    }`}>
                      {result.rank}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-neutral-900">
                        {comparison.items.find(item => item.id === result.itemId)?.name || result.itemId}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {result.strengths.slice(0, 2).map((strength, i) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                            {strength}
                          </span>
                        ))}
                        {result.weaknesses.slice(0, 1).map((weakness, i) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                            {weakness}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-semibold text-blue-600">{result.score.toFixed(1)}</span>
                  </td>
                  {selectedMetrics.map(metric => (
                    <td key={metric} className="py-3 px-4 text-right">
                      {formatValue(result.metrics[metric] || 0, metric)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}