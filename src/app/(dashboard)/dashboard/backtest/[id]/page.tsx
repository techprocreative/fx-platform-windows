'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  Clock,
  Target,
  Percent,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface BacktestResult {
  id: string;
  strategyId: string;
  strategy: {
    id: string;
    name: string;
    symbol: string;
    timeframe: string;
    rules: any;
  };
  status: 'pending' | 'running' | 'completed' | 'failed';
  dateFrom: string;
  dateTo: string;
  initialBalance: number;
  settings?: {
    spread?: number;
    commission?: number;
    slippage?: number;
  };
  results?: {
    finalBalance?: number;
    totalReturn?: number;
    returnPercentage?: number;
    maxDrawdown?: number;
    winRate?: number;
    totalTrades?: number;
    profitableTrades?: number;
    losingTrades?: number;
    averageWin?: number;
    averageLoss?: number;
    profitFactor?: number;
    sharpeRatio?: number;
    trades?: Array<{
      type: string;
      entryTime: string;
      exitTime: string;
      entryPrice: number;
      exitPrice: number;
      profit: number;
      pips: number;
    }>;
  };
  createdAt: string;
  completedAt?: string;
}

export default function BacktestDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
    if (status === 'authenticated') {
      fetchBacktest();
    }
  }, [status, params.id]);

  const fetchBacktest = async () => {
    try {
      const response = await fetch(`/api/backtest/${params.id}`);
      
      if (response.status === 401) {
        router.replace('/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch backtest');
      }

      const data = await response.json();
      setBacktest(data);
    } catch (error) {
      console.error('Error fetching backtest:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!backtest) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-neutral-900">Backtest not found</h2>
          <Link
            href="/dashboard/backtest"
            className="mt-4 inline-flex items-center gap-2 text-primary-600 hover:text-primary-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Backtests
          </Link>
        </div>
      </div>
    );
  }

  const isCompleted = backtest.status === 'completed';
  const results = backtest.results;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/backtest"
          className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Backtests
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">
              {backtest.strategy.name}
            </h1>
            <p className="text-neutral-600 mt-1">
              {backtest.strategy.symbol} • {backtest.strategy.timeframe}
            </p>
          </div>
          <div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                backtest.status === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : backtest.status === 'running'
                  ? 'bg-blue-100 text-blue-800'
                  : backtest.status === 'failed'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-neutral-100 text-neutral-800'
              }`}
            >
              {backtest.status.charAt(0).toUpperCase() + backtest.status.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Test Period & Settings */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-primary-600" />
              <div>
                <p className="text-sm text-neutral-600">Test Period</p>
                <p className="text-lg font-semibold text-neutral-900">
                  {new Date(backtest.dateFrom).toLocaleDateString()} -{' '}
                  {new Date(backtest.dateTo).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-primary-600" />
              <div>
                <p className="text-sm text-neutral-600">Initial Balance</p>
                <p className="text-lg font-semibold text-neutral-900">
                  ${backtest.initialBalance.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-primary-600" />
              <div>
                <p className="text-sm text-neutral-600">Completed</p>
                <p className="text-lg font-semibold text-neutral-900">
                  {backtest.completedAt
                    ? new Date(backtest.completedAt).toLocaleDateString()
                    : 'In Progress'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {isCompleted && results ? (
        <>
          {/* Performance Overview */}
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-neutral-600" />
                  <div>
                    <p className="text-sm text-neutral-600">Final Balance</p>
                    <p className="text-2xl font-bold text-neutral-900">
                      ${results.finalBalance?.toLocaleString() || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm text-neutral-600">Total Return</p>
                    <p className="text-2xl font-bold text-green-600">
                      {results.returnPercentage?.toFixed(2) || 0}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-neutral-600">Win Rate</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {results.winRate?.toFixed(1) || 0}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="text-sm text-neutral-600">Total Trades</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {results.totalTrades || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Statistics */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Performance Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                    <span className="text-neutral-600">Profitable Trades</span>
                    <span className="font-semibold text-green-600">
                      {results.profitableTrades || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                    <span className="text-neutral-600">Losing Trades</span>
                    <span className="font-semibold text-red-600">
                      {results.losingTrades || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                    <span className="text-neutral-600">Average Win</span>
                    <span className="font-semibold text-neutral-900">
                      ${results.averageWin?.toFixed(2) || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                    <span className="text-neutral-600">Average Loss</span>
                    <span className="font-semibold text-neutral-900">
                      ${results.averageLoss?.toFixed(2) || 0}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                    <span className="text-neutral-600">Max Drawdown</span>
                    <span className="font-semibold text-red-600">
                      {results.maxDrawdown?.toFixed(2) || 0}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                    <span className="text-neutral-600">Profit Factor</span>
                    <span className="font-semibold text-neutral-900">
                      {results.profitFactor?.toFixed(2) || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                    <span className="text-neutral-600">Sharpe Ratio</span>
                    <span className="font-semibold text-neutral-900">
                      {results.sharpeRatio?.toFixed(2) || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-neutral-100">
                    <span className="text-neutral-600">Total Return</span>
                    <span className="font-semibold text-green-600">
                      ${results.totalReturn?.toFixed(2) || 0}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trade History */}
          {results.trades && results.trades.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Trade History ({results.trades.length} trades)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200">
                        <th className="text-left py-3 px-4 font-medium text-neutral-600">
                          Type
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-neutral-600">
                          Entry Time
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-neutral-600">
                          Exit Time
                        </th>
                        <th className="text-right py-3 px-4 font-medium text-neutral-600">
                          Entry Price
                        </th>
                        <th className="text-right py-3 px-4 font-medium text-neutral-600">
                          Exit Price
                        </th>
                        <th className="text-right py-3 px-4 font-medium text-neutral-600">
                          Pips
                        </th>
                        <th className="text-right py-3 px-4 font-medium text-neutral-600">
                          Profit
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.trades.map((trade, index) => (
                        <tr key={index} className="border-b border-neutral-100">
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                trade.type === 'BUY'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {trade.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-neutral-900">
                            {new Date(trade.entryTime).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-neutral-900">
                            {new Date(trade.exitTime).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right text-neutral-900">
                            {trade.entryPrice.toFixed(5)}
                          </td>
                          <td className="py-3 px-4 text-right text-neutral-900">
                            {trade.exitPrice.toFixed(5)}
                          </td>
                          <td className="py-3 px-4 text-right text-neutral-900">
                            {trade.pips.toFixed(1)}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-semibold ${
                              trade.profit >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            ${trade.profit.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">
              {backtest.status === 'running' ? 'Backtest in Progress' : 'No Results Available'}
            </h3>
            <p className="text-neutral-600">
              {backtest.status === 'running'
                ? 'Please wait while the backtest is being executed...'
                : 'Results will appear here once the backtest is completed.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
