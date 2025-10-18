'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Edit2, Play, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Strategy {
  id: string;
  name: string;
  description?: string;
  symbol: string;
  timeframe: string;
  status: string;
  rules: any;
  version: number;
  createdAt: string;
  _count: {
    trades: number;
    backtests: number;
  };
}

export default function StrategyDetailPage({ params }: { params: { id: string } }) {
  const { status } = useSession();
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }

    if (status === 'authenticated') {
      fetchStrategy();
    }
  }, [status]);

  const fetchStrategy = async () => {
    try {
      const response = await fetch(`/api/strategy/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setStrategy(data);
      } else {
        toast.error('Strategy not found');
      }
    } catch (error) {
      toast.error('Failed to load strategy');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin">
          <div className="h-12 w-12 rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
        <p className="text-neutral-600">Strategy not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/strategies"
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-6 w-6 text-neutral-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">{strategy.name}</h1>
            <p className="text-neutral-600 mt-1">{strategy.symbol} • {strategy.timeframe}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/dashboard/strategies/${strategy.id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2 text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            <Edit2 className="h-4 w-4" />
            Edit
          </Link>

          <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
            <Play className="h-4 w-4" />
            Activate
          </button>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <InfoCard label="Status" value={strategy.status} />
        <InfoCard label="Total Trades" value={strategy._count.trades.toString()} />
        <InfoCard label="Backtests" value={strategy._count.backtests.toString()} />
        <InfoCard label="Version" value={`v${strategy.version}`} />
      </div>

      {/* Tabs */}
      <div className="rounded-lg border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 flex">
          <button className="flex-1 px-6 py-4 text-center font-medium text-neutral-700 border-b-2 border-primary-600 text-primary-600">
            Overview
          </button>
          <button className="flex-1 px-6 py-4 text-center font-medium text-neutral-600 hover:text-neutral-900 transition-colors">
            Backtests
          </button>
          <button className="flex-1 px-6 py-4 text-center font-medium text-neutral-600 hover:text-neutral-900 transition-colors">
            Trades
          </button>
        </div>

        <div className="p-6">
          {/* Rules Summary */}
          <div className="space-y-4">
            <h3 className="font-bold text-neutral-900">Strategy Rules</h3>

            {strategy.description && (
              <div>
                <p className="text-sm font-medium text-neutral-600 mb-1">Description</p>
                <p className="text-neutral-700">{strategy.description}</p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-neutral-600 mb-2">Entry Conditions</p>
              <div className="space-y-2">
                {strategy.rules?.entry?.conditions?.map((cond: any, idx: number) => (
                  <div key={idx} className="text-sm bg-neutral-50 p-3 rounded-lg">
                    {cond.indicator} {cond.condition} {cond.value}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-neutral-600 mb-2">Exit Rules</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-sm bg-neutral-50 p-3 rounded-lg">
                  <p className="font-medium text-neutral-700">Take Profit</p>
                  <p className="text-neutral-600">
                    {strategy.rules?.exit?.takeProfit?.value}{' '}
                    {strategy.rules?.exit?.takeProfit?.type}
                  </p>
                </div>
                <div className="text-sm bg-neutral-50 p-3 rounded-lg">
                  <p className="font-medium text-neutral-700">Stop Loss</p>
                  <p className="text-neutral-600">
                    {strategy.rules?.exit?.stopLoss?.value}{' '}
                    {strategy.rules?.exit?.stopLoss?.type}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-neutral-600 mb-2">Risk Management</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-sm bg-neutral-50 p-3 rounded-lg">
                  <p className="text-neutral-600">Lot Size</p>
                  <p className="font-medium text-neutral-900">
                    {strategy.rules?.riskManagement?.lotSize}
                  </p>
                </div>
                <div className="text-sm bg-neutral-50 p-3 rounded-lg">
                  <p className="text-neutral-600">Max Positions</p>
                  <p className="font-medium text-neutral-900">
                    {strategy.rules?.riskManagement?.maxPositions}
                  </p>
                </div>
                <div className="text-sm bg-neutral-50 p-3 rounded-lg">
                  <p className="text-neutral-600">Max Daily Loss</p>
                  <p className="font-medium text-neutral-900">
                    ${strategy.rules?.riskManagement?.maxDailyLoss}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex gap-4 pt-6 border-t border-neutral-200">
            <Link
              href={`/dashboard/backtest?strategyId=${strategy.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <BarChart3 className="h-4 w-4" />
              Run Backtest
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-sm text-neutral-600 mb-1">{label}</p>
      <p className="text-xl font-bold text-neutral-900 capitalize">{value}</p>
    </div>
  );
}
