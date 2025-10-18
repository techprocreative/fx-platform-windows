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
  const [filter, setFilter] = useState<'all' | 'active' | 'draft'>('all');

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
      const response = await fetch('/api/strategy');
      if (response.ok) {
        const data = await response.json();
        setStrategies(data.strategies || []);
      }
    } catch (error) {
      toast.error('Failed to load strategies');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this strategy?')) return;

    try {
      const response = await fetch(`/api/strategy/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setStrategies(strategies.filter((s) => s.id !== id));
        toast.success('Strategy deleted');
      } else {
        toast.error('Failed to delete strategy');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';

    try {
      const response = await fetch(`/api/strategy/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setStrategies(
          strategies.map((s) =>
            s.id === id ? { ...s, status: newStatus as any } : s
          )
        );
        toast.success(`Strategy ${newStatus}`);
      }
    } catch (error) {
      toast.error('Failed to update strategy');
    }
  };

  const filteredStrategies = strategies.filter((s) => {
    if (filter === 'all') return true;
    return s.status === filter;
  });

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin">
          <div className="h-12 w-12 rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
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
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium capitalize ${
                        strategy.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : strategy.status === 'draft'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {strategy.status}
                    </span>
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
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete strategy"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
