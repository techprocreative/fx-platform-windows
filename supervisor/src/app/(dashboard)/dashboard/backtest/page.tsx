'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { BarChart3, Plus } from 'lucide-react';

export default function BacktestPage() {
  const { status } = useSession();
  const [backtests] = useState([]);

  if (status === 'unauthenticated') {
    redirect('/login');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Backtesting</h1>
          <p className="text-neutral-600 mt-1">Test your strategies on historical data</p>
        </div>

        <button className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-white font-semibold hover:bg-primary-700 transition-colors">
          <Plus className="h-5 w-5" />
          New Backtest
        </button>
      </div>

      {/* Empty State */}
      {backtests.length === 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-12 text-center">
          <BarChart3 className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-neutral-900">No backtests yet</h3>
          <p className="text-neutral-600 mt-1">
            Run a backtest to see how your strategies perform on historical data
          </p>

          <button className="mt-6 inline-flex items-center gap-2 text-primary-600 font-semibold hover:text-primary-700">
            <Plus className="h-4 w-4" />
            Create Backtest
          </button>
        </div>
      )}
    </div>
  );
}
