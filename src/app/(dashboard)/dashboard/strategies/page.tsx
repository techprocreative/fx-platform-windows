'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Plus,
  MoreVertical,
  Trash2,
  Edit2,
  Play,
  Pause,
  TrendingUp,
} from 'lucide-react';

import { LoadingState, TableLoadingState } from '@/components/ui/LoadingState';
import { InlineError } from '@/components/ui/ErrorMessage';
import { useConfirmDialog, confirmDelete } from '@/components/ui/ConfirmDialog';
import { StrategyStatus } from '@/components/ui/StatusIndicator';
import { Button } from '@/components/ui/Button';
import { ActivateStrategyDialog } from '@/components/strategies/ActivateStrategyDialog';

interface Strategy {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  type: 'manual' | 'ai_generated' | 'imported';
  version: number;
  createdAt: string;
}

export default function StrategiesPage() {
  const { data: session, status } = useSession();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'draft'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  
  const { confirm, ConfirmDialog } = useConfirmDialog();

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }

    if (status === 'authenticated') {
      fetchStrategies();
    }
  }, [status]);

  const fetchStrategies = async () => {
    try {
      setError(null);
      const response = await fetch('/api/strategy');
      if (!response.ok) {
        throw new Error(`Failed to fetch strategies: ${response.statusText}`);
      }
      const data = await response.json();
      setStrategies(data.strategies || []);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to load strategies');
      setError(err);
      toast.error('Failed to load strategies');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const strategy = strategies.find(s => s.id === id);
    if (!strategy) return;

    const confirmed = await confirm(confirmDelete(strategy.name));
    if (!confirmed) return;

    try {
      setDeletingId(id);
      const response = await fetch(`/api/strategy/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete strategy: ${response.statusText}`);
      }

      setStrategies(strategies.filter((s) => s.id !== id));
      toast.success('Strategy deleted successfully');
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to delete strategy');
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const strategy = strategies.find(s => s.id === id);
    if (!strategy) return;

    // If active, allow direct deactivation
    if (currentStatus === 'active') {
      try {
        const response = await fetch(`/api/strategy/${id}/deactivate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            closePositions: false, // Don't close positions by default
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || 'Failed to deactivate strategy');
        }

        const data = await response.json();
        toast.success(data.message || 'Strategy deactivated successfully');
        fetchStrategies(); // Refresh list
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to deactivate strategy');
        toast.error(err.message);
      }
    } else {
      // If not active, open dialog to select executors
      setSelectedStrategy(strategy);
      setShowActivateDialog(true);
    }
  };

  const handleStrategyActivated = () => {
    setShowActivateDialog(false);
    setSelectedStrategy(null);
    fetchStrategies(); // Refresh list
  };

  const filteredStrategies = strategies.filter((s) => {
    if (filter === 'all') return true;
    return s.status === filter;
  });

  if (status === 'loading' || loading) {
    return <PageLoadingState />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">Strategies</h1>
            <p className="text-neutral-600 mt-1">
              Manage your trading strategies
            </p>
          </div>
        </div>
        <InlineError
          error={error}
          retry={fetchStrategies}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Strategies</h1>
          <p className="text-neutral-600 mt-1">
            {strategies.length} strategy{strategies.length !== 1 ? 'ies' : ''}
          </p>
        </div>

        <Link
          href="/dashboard/strategies/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-white font-semibold hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          New Strategy
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'active', 'draft'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize ${
              filter === f
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Strategies Table */}
      {filteredStrategies.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-12 text-center">
          <TrendingUp className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-neutral-900">
            No {filter !== 'all' ? filter : ''} strategies yet
          </h3>
          <p className="text-neutral-600 mt-1">
            Create your first strategy to get started
          </p>

          <Link
            href="/dashboard/strategies/new"
            className="mt-6 inline-flex items-center gap-2 text-primary-600 font-semibold hover:text-primary-700"
          >
            <Plus className="h-4 w-4" />
            Create Strategy
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900">
                  Strategy
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900">
                  Symbol
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900">
                  Timeframe
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-neutral-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredStrategies.map((strategy) => (
                <tr key={strategy.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link
                      href={`/dashboard/strategies/${strategy.id}`}
                      className="font-medium text-primary-600 hover:text-primary-700"
                    >
                      {strategy.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-600">
                    {strategy.symbol}
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-600">
                    {strategy.timeframe}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 capitalize">
                      {strategy.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <StrategyStatus status={strategy.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() =>
                          handleToggleStatus(strategy.id, strategy.status)
                        }
                        className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
                        title={
                          strategy.status === 'active'
                            ? 'Pause strategy'
                            : 'Activate strategy'
                        }
                      >
                        {strategy.status === 'active' ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </button>

                      <Link
                        href={`/dashboard/strategies/${strategy.id}/edit`}
                        className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
                        title="Edit strategy"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Link>

                      <button
                        onClick={() => handleDelete(strategy.id)}
                        disabled={deletingId === strategy.id}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete strategy"
                      >
                        {deletingId === strategy.id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Activate Strategy Dialog */}
      {selectedStrategy && (
        <ActivateStrategyDialog
          strategyId={selectedStrategy.id}
          strategyName={selectedStrategy.name}
          isOpen={showActivateDialog}
          onClose={() => {
            setShowActivateDialog(false);
            setSelectedStrategy(null);
          }}
          onActivated={handleStrategyActivated}
        />
      )}
      
      {/* Confirmation Dialog */}
      <ConfirmDialog />
    </div>
  );
}

// Helper component for page loading state
function PageLoadingState() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Strategies</h1>
          <p className="text-neutral-600 mt-1">
            Loading your strategies...
          </p>
        </div>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white">
        <TableLoadingState />
      </div>
    </div>
  );
}
