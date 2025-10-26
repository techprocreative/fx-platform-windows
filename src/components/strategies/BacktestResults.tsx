"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Shield, 
  AlertTriangle,
  BarChart3,
  Calendar,
  DollarSign,
  Target,
  Award
} from "lucide-react";
import { Progress } from "@/components/ui/Progress";

interface BacktestResultsProps {
  results: {
    verified: boolean;
    testPeriod: {
      start: string;
      end: string;
      duration: string;
    };
    configuration: {
      symbol: string;
      timeframe: string;
      initialBalance: number;
      lotSize: number;
      stopLoss: number;
      takeProfit: number;
      riskPerTrade: number;
      maxPositions: number;
    };
    performance: {
      initialBalance: number;
      finalBalance: number;
      totalReturn: number;
      returnPercentage: number;
      monthlyAverage: number;
      annualProjection: number;
    };
    statistics: {
      totalTrades: number;
      winningTrades: number;
      losingTrades: number;
      winRate: number;
      averageWin: number;
      averageLoss: number;
      profitFactor: number;
      largestWin: number;
      largestLoss: number;
    };
    risk: {
      maxDrawdown: number;
      maxDrawdownPercent: number;
      recoveryTime: string;
      sharpeRatio: number;
      sortinoRatio: number;
      calmarRatio: number;
      riskRewardRatio: number;
    };
    monthly: Array<{
      month: string;
      return: number;
      trades: number;
      winRate: number;
    }>;
    reliability: {
      rating: number;
      confidence: string;
      consistency: string;
      note?: string;
    };
  };
}

export function BacktestResults({ results }: BacktestResultsProps) {
  const getPerformanceColor = (value: number) => {
    if (value >= 15) return "text-green-600";
    if (value >= 10) return "text-emerald-600";
    if (value >= 5) return "text-blue-600";
    return "text-gray-600";
  };

  const getRiskColor = (percent: number) => {
    if (percent <= 5) return "text-green-600";
    if (percent <= 10) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Official Backtest Results
                <Badge variant="success" className="ml-2">✓ Verified</Badge>
              </CardTitle>
              <CardDescription>
                Test Period: {new Date(results.testPeriod.start).toLocaleDateString()} - {new Date(results.testPeriod.end).toLocaleDateString()} ({results.testPeriod.duration})
              </CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-yellow-500 text-2xl">{"⭐".repeat(results.reliability.rating)}</span>
              <span className="text-gray-400 text-2xl">{"☆".repeat(5 - results.reliability.rating)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <Shield className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Confidence: {results.reliability.confidence}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Consistency: {results.reliability.consistency}
              </p>
              {results.reliability.note && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  {results.reliability.note}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Performance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Total Return</span>
              </div>
              <p className={`text-2xl font-bold ${getPerformanceColor(results.performance.returnPercentage)}`}>
                +{results.performance.returnPercentage.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                ${results.performance.totalReturn.toFixed(2)}
              </p>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Monthly Avg</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">
                +{results.performance.monthlyAverage.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                per month
              </p>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-purple-600" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Annual Projection</span>
              </div>
              <p className="text-2xl font-bold text-purple-600">
                +{results.performance.annualProjection.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                estimated
              </p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-green-900 dark:text-green-100">Balance Growth</span>
              <span className="text-sm font-semibold text-green-900 dark:text-green-100">
                ${results.performance.initialBalance.toLocaleString()} → ${results.performance.finalBalance.toLocaleString()}
              </span>
            </div>
            <Progress 
              value={(results.performance.finalBalance / results.performance.initialBalance) * 100} 
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Trade Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Trade Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Trades</p>
              <p className="text-2xl font-bold">{results.statistics.totalTrades}</p>
            </div>

            <div className="text-center p-3 bg-green-50 dark:bg-green-900 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Winners</p>
              <p className="text-2xl font-bold text-green-600">{results.statistics.winningTrades}</p>
            </div>

            <div className="text-center p-3 bg-red-50 dark:bg-red-900 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Losers</p>
              <p className="text-2xl font-bold text-red-600">{results.statistics.losingTrades}</p>
            </div>

            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Win Rate</p>
              <p className="text-2xl font-bold text-blue-600">{results.statistics.winRate.toFixed(1)}%</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Average Win</p>
              <p className="text-xl font-bold text-green-600">
                +${results.statistics.averageWin.toFixed(2)}
              </p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Average Loss</p>
              <p className="text-xl font-bold text-red-600">
                ${results.statistics.averageLoss.toFixed(2)}
              </p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Profit Factor</p>
              <p className="text-xl font-bold text-purple-600">
                {results.statistics.profitFactor.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {results.statistics.profitFactor >= 2 ? "Excellent" : results.statistics.profitFactor >= 1.5 ? "Good" : "Fair"}
              </p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">R:R Ratio</p>
              <p className="text-xl font-bold text-blue-600">
                {results.risk.riskRewardRatio.toFixed(2)}:1
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Risk Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Max Drawdown</p>
              <p className={`text-2xl font-bold ${getRiskColor(results.risk.maxDrawdownPercent)}`}>
                {results.risk.maxDrawdownPercent.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                ${Math.abs(results.risk.maxDrawdown).toFixed(2)}
              </p>
              <p className="text-xs text-gray-500">
                Recovery: {results.risk.recoveryTime}
              </p>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Sharpe Ratio</p>
              <p className="text-2xl font-bold text-blue-600">
                {results.risk.sharpeRatio.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {results.risk.sharpeRatio >= 2 ? "Excellent" : results.risk.sharpeRatio >= 1.5 ? "Good" : "Fair"}
              </p>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Sortino Ratio</p>
              <p className="text-2xl font-bold text-purple-600">
                {results.risk.sortinoRatio.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Downside risk adjusted
              </p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="text-xs text-yellow-900 dark:text-yellow-100">
                <p className="font-semibold mb-1">Risk Assessment</p>
                <p>Max drawdown of {results.risk.maxDrawdownPercent.toFixed(2)}% is considered {
                  results.risk.maxDrawdownPercent <= 5 ? "low risk" :
                  results.risk.maxDrawdownPercent <= 10 ? "moderate risk" :
                  "high risk"
                }. Strong Sharpe ratio of {results.risk.sharpeRatio.toFixed(2)} indicates good risk-adjusted returns.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Monthly Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {results.monthly.map((month, index) => (
              <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{month.month}</span>
                  <Badge variant={month.return > 0 ? "success" : "destructive"}>
                    {month.return > 0 ? "+" : ""}{month.return.toFixed(1)}%
                  </Badge>
                </div>
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>{month.trades} trades</span>
                  <span>{month.winRate}% win rate</span>
                </div>
                <Progress 
                  value={month.winRate} 
                  className="h-1.5 mt-2"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-600">Test Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-gray-500">Symbol</p>
              <p className="font-semibold">{results.configuration.symbol}</p>
            </div>
            <div>
              <p className="text-gray-500">Timeframe</p>
              <p className="font-semibold">{results.configuration.timeframe}</p>
            </div>
            <div>
              <p className="text-gray-500">Stop Loss</p>
              <p className="font-semibold">{results.configuration.stopLoss} pips</p>
            </div>
            <div>
              <p className="text-gray-500">Take Profit</p>
              <p className="font-semibold">{results.configuration.takeProfit} pips</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <div className="p-4 bg-gray-100 dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-700">
        <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-2">
          ⚠️ IMPORTANT DISCLAIMER
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          Past performance does not guarantee future results. These backtest results are based on historical data and may not reflect future market conditions. Actual trading results may vary significantly due to market volatility, slippage, spreads, execution quality, and other factors. Always start with demo accounts and small position sizes.
        </p>
      </div>
    </div>
  );
}

export default BacktestResults;
