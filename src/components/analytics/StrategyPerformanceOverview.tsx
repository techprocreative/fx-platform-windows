'use client';

import { Card } from '@/components/ui/Card';
import { PerformanceMetrics, StrategyScore } from '@/types';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  Activity,
  AlertTriangle,
  CheckCircle,
  BarChart3
} from 'lucide-react';

interface StrategyPerformanceOverviewProps {
  metrics: PerformanceMetrics;
  score: StrategyScore;
  className?: string;
}

export function StrategyPerformanceOverview({ 
  metrics, 
  score, 
  className = '' 
}: StrategyPerformanceOverviewProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getMetricColor = (value: number, goodThreshold: number, badThreshold: number) => {
    if (value >= goodThreshold) return 'text-green-600';
    if (value <= badThreshold) return 'text-red-600';
    return 'text-yellow-600';
  };

  const getMetricIcon = (isPositive: boolean) => {
    return isPositive ? (
      <TrendingUp className="h-4 w-4 text-green-500" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-500" />
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overall Score */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-neutral-900">Strategy Score</h3>
          <BarChart3 className="h-5 w-5 text-blue-500" />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {score.overall.toFixed(0)}
            </div>
            <div className="text-xs text-neutral-600">Overall</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold text-green-600">
              {score.profitability.toFixed(0)}
            </div>
            <div className="text-xs text-neutral-600">Profitability</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold text-purple-600">
              {score.consistency.toFixed(0)}
            </div>
            <div className="text-xs text-neutral-600">Consistency</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold text-orange-600">
              {score.riskAdjusted.toFixed(0)}
            </div>
            <div className="text-xs text-neutral-600">Risk Adj.</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold text-red-600">
              {score.drawdown.toFixed(0)}
            </div>
            <div className="text-xs text-neutral-600">Drawdown</div>
          </div>
        </div>

        {/* Recommendations */}
        {(score.recommendations.length > 0 || score.warnings.length > 0) && (
          <div className="mt-4 space-y-2">
            {score.recommendations.length > 0 && (
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <span className="font-medium text-green-800">Recommendations:</span>
                  <ul className="mt-1 space-y-1">
                    {score.recommendations.map((rec, index) => (
                      <li key={index} className="text-green-700">• {rec}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            
            {score.warnings.length > 0 && (
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <span className="font-medium text-yellow-800">Warnings:</span>
                  <ul className="mt-1 space-y-1">
                    {score.warnings.map((warning, index) => (
                      <li key={index} className="text-yellow-700">• {warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Profit */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Total Profit</span>
            {getMetricIcon(metrics.totalProfit >= 0)}
          </div>
          <div className={`text-xl font-bold ${getMetricColor(metrics.totalProfit, 1000, -500)}`}>
            {formatCurrency(metrics.totalProfit)}
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            {formatPercent(metrics.totalProfitPercent)}
          </div>
        </Card>

        {/* Win Rate */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Win Rate</span>
            <Activity className="h-4 w-4 text-purple-500" />
          </div>
          <div className={`text-xl font-bold ${getMetricColor(metrics.winRate, 60, 40)}`}>
            {formatPercent(metrics.winRate)}
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            {metrics.winningTrades}/{metrics.totalTrades} trades
          </div>
        </Card>

        {/* Sharpe Ratio */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Sharpe Ratio</span>
            <Target className="h-4 w-4 text-orange-500" />
          </div>
          <div className={`text-xl font-bold ${getMetricColor(metrics.sharpeRatio, 2, 1)}`}>
            {metrics.sharpeRatio.toFixed(2)}
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            {metrics.sharpeRatio >= 2 ? 'Excellent' : 
             metrics.sharpeRatio >= 1 ? 'Good' : 'Poor'}
          </div>
        </Card>

        {/* Max Drawdown */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Max Drawdown</span>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </div>
          <div className={`text-xl font-bold ${getMetricColor(100 - metrics.maxDrawdownPercent, 85, 70)}`}>
            -{formatPercent(metrics.maxDrawdownPercent)}
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            {formatCurrency(metrics.maxDrawdown)}
          </div>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Trade Metrics */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Trade Metrics
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-600">Average Win</span>
              <span className="font-medium text-green-600">
                {formatCurrency(metrics.averageWin)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-600">Average Loss</span>
              <span className="font-medium text-red-600">
                {formatCurrency(metrics.averageLoss)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-600">Average Trade</span>
              <span className={`font-medium ${metrics.averageTrade >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(metrics.averageTrade)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-600">Profit Factor</span>
              <span className={`font-medium ${getMetricColor(metrics.profitFactor, 2, 1.5)}`}>
                {metrics.profitFactor.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-600">Expectancy</span>
              <span className={`font-medium ${metrics.expectancy >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(metrics.expectancy)}
              </span>
            </div>
          </div>
        </Card>

        {/* Risk Metrics */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <Target className="h-5 w-5" />
            Risk Metrics
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-600">Sortino Ratio</span>
              <span className={`font-medium ${getMetricColor(metrics.sortinoRatio, 2, 1)}`}>
                {metrics.sortinoRatio.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-600">Calmar Ratio</span>
              <span className={`font-medium ${getMetricColor(metrics.calmarRatio, 1, 0.5)}`}>
                {metrics.calmarRatio.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-600">Recovery Factor</span>
              <span className={`font-medium ${getMetricColor(metrics.recoveryFactor, 2, 1)}`}>
                {metrics.recoveryFactor.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-600">VaR (95%)</span>
              <span className="font-medium text-red-600">
                {formatCurrency(metrics.var95)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-600">Risk of Ruin</span>
              <span className={`font-medium ${getMetricColor(100 - metrics.riskOfRuin, 95, 80)}`}>
                {formatPercent(metrics.riskOfRuin)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Consistency Metrics */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Consistency Analysis
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className={`text-lg font-bold ${getMetricColor(metrics.monthlyWinRate, 60, 40)}`}>
              {formatPercent(metrics.monthlyWinRate)}
            </div>
            <div className="text-xs text-neutral-600">Monthly Win Rate</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-bold ${getMetricColor(metrics.profitConsistency, 70, 50)}`}>
              {formatPercent(metrics.profitConsistency)}
            </div>
            <div className="text-xs text-neutral-600">Profit Consistency</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-bold ${getMetricColor(metrics.winRateStability, 80, 60)}`}>
              {formatPercent(metrics.winRateStability)}
            </div>
            <div className="text-xs text-neutral-600">Win Rate Stability</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">
              {metrics.tradesPerMonth.toFixed(1)}
            </div>
            <div className="text-xs text-neutral-600">Trades/Month</div>
          </div>
        </div>
      </Card>
    </div>
  );
}