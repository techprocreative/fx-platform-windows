'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import toast from 'react-hot-toast';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface Condition {
  id: string;
  indicator: string;
  condition: string;
  value: number | null;
  period?: number;
}

interface Strategy {
  id: string;
  name: string;
  description?: string;
  symbol: string;
  timeframe: string;
  type: string;
  rules: any;
}

const INDICATORS = ['RSI', 'MACD', 'EMA', 'SMA', 'ADX', 'Bollinger Bands', 'Stochastic'];
const CONDITIONS = ['greater_than', 'less_than', 'equals', 'crosses_above', 'crosses_below'];
const SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD', 'ETHUSD', 'SP500'];
const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];

export default function EditStrategyPage({ params }: { params: { id: string } }) {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    symbol: 'EURUSD',
    timeframe: 'H1',
    type: 'manual',
  });

  const [entryConditions, setEntryConditions] = useState<Condition[]>([]);
  const [exitRules, setExitRules] = useState({
    takeProfit: { type: 'pips', value: 50 },
    stopLoss: { type: 'pips', value: 25 },
    trailing: { enabled: false, distance: 10 },
  });
  const [riskManagement, setRiskManagement] = useState({
    lotSize: 0.1,
    maxPositions: 5,
    maxDailyLoss: 500,
  });
  const [entryLogic, setEntryLogic] = useState<'AND' | 'OR'>('AND');

  if (status === 'unauthenticated') {
    redirect('/login');
  }

  useEffect(() => {
    fetchStrategy();
  }, []);

  const fetchStrategy = async () => {
    try {
      const response = await fetch(`/api/strategy/${params.id}`);
      if (!response.ok) {
        toast.error('Strategy not found');
        router.push('/dashboard/strategies');
        return;
      }

      const strategy: Strategy = await response.json();
      setFormData({
        name: strategy.name,
        description: strategy.description || '',
        symbol: strategy.symbol,
        timeframe: strategy.timeframe,
        type: strategy.type,
      });

      if (strategy.rules) {
        if (strategy.rules.entry?.conditions) {
          const conditions = strategy.rules.entry.conditions.map((c: any, idx: number) => ({
            id: idx.toString(),
            ...c,
          }));
          setEntryConditions(conditions);
        }
        if (strategy.rules.entry?.logic) {
          setEntryLogic(strategy.rules.entry.logic);
        }
        if (strategy.rules.exit) {
          setExitRules(strategy.rules.exit);
        }
        if (strategy.rules.riskManagement) {
          setRiskManagement(strategy.rules.riskManagement);
        }
      }
    } catch (error) {
      console.error('Failed to load strategy:', error);
      toast.error('Failed to load strategy');
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddCondition = () => {
    setEntryConditions([
      ...entryConditions,
      {
        id: Date.now().toString(),
        indicator: 'RSI',
        condition: 'greater_than',
        value: null,
        period: 14,
      },
    ]);
  };

  const handleRemoveCondition = (id: string) => {
    setEntryConditions(entryConditions.filter((c) => c.id !== id));
  };

  const handleConditionChange = (id: string, field: string, value: any) => {
    setEntryConditions(
      entryConditions.map((c) =>
        c.id === id ? { ...c, [field]: value } : c
      )
    );
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return 'Strategy name is required';
    if (entryConditions.length === 0) return 'At least one entry condition is required';
    if (!exitRules.takeProfit.value) return 'Take profit value is required';
    if (!exitRules.stopLoss.value) return 'Stop loss value is required';
    if (riskManagement.lotSize <= 0) return 'Lot size must be greater than 0';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const error = validateForm();
    if (error) {
      toast.error(error);
      return;
    }

    setSubmitting(true);

    try {
      const rules = {
        entry: {
          conditions: entryConditions.map(({ id, ...rest }) => rest),
          logic: entryLogic,
        },
        exit: exitRules,
        riskManagement,
      };

      const response = await fetch(`/api/strategy/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          rules,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Failed to update strategy');
        setSubmitting(false);
        return;
      }

      toast.success('Strategy updated successfully!');
      router.push(`/dashboard/strategies/${params.id}`);
    } catch (error) {
      toast.error('An error occurred');
      setSubmitting(false);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={`/dashboard/strategies/${params.id}`}
          className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="h-6 w-6 text-neutral-600" />
        </Link>
        <h1 className="text-3xl font-bold text-neutral-900">Edit Strategy</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-neutral-900">Basic Information</h2>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Strategy Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleFormChange}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter strategy name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleFormChange}
              rows={3}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              placeholder="Describe your strategy"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Symbol *</label>
              <select
                name="symbol"
                value={formData.symbol}
                onChange={handleFormChange}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {SYMBOLS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Timeframe *</label>
              <select
                name="timeframe"
                value={formData.timeframe}
                onChange={handleFormChange}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {TIMEFRAMES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Type</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleFormChange}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="manual">Manual</option>
                <option value="automated">Automated</option>
              </select>
            </div>
          </div>
        </div>

        {/* Entry Conditions */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">Entry Conditions *</h2>
            <button
              type="button"
              onClick={handleAddCondition}
              className="inline-flex items-center gap-2 px-3 py-1 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Condition
            </button>
          </div>

          <div className="flex gap-2 mb-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={entryLogic === 'AND'}
                onChange={() => setEntryLogic('AND')}
                className="w-4 h-4"
              />
              <span className="text-sm text-neutral-700">All conditions (AND)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={entryLogic === 'OR'}
                onChange={() => setEntryLogic('OR')}
                className="w-4 h-4"
              />
              <span className="text-sm text-neutral-700">Any condition (OR)</span>
            </label>
          </div>

          <div className="space-y-3">
            {entryConditions.map((condition) => (
              <div key={condition.id} className="flex gap-2 items-end">
                <select
                  value={condition.indicator}
                  onChange={(e) => handleConditionChange(condition.id, 'indicator', e.target.value)}
                  className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                >
                  {INDICATORS.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>

                <select
                  value={condition.condition}
                  onChange={(e) => handleConditionChange(condition.id, 'condition', e.target.value)}
                  className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                >
                  {CONDITIONS.map((cond) => (
                    <option key={cond} value={cond}>{cond.replace('_', ' ')}</option>
                  ))}
                </select>

                <input
                  type="number"
                  value={condition.value || ''}
                  onChange={(e) => handleConditionChange(condition.id, 'value', e.target.value ? parseFloat(e.target.value) : null)}
                  className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                  placeholder="Value"
                />

                <input
                  type="number"
                  value={condition.period || ''}
                  onChange={(e) => handleConditionChange(condition.id, 'period', e.target.value ? parseInt(e.target.value) : undefined)}
                  className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                  placeholder="Period"
                />

                <button
                  type="button"
                  onClick={() => handleRemoveCondition(condition.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Exit Rules */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-neutral-900">Exit Rules</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Take Profit (pips) *</label>
              <input
                type="number"
                value={exitRules.takeProfit.value || ''}
                onChange={(e) =>
                  setExitRules({
                    ...exitRules,
                    takeProfit: { ...exitRules.takeProfit, value: parseFloat(e.target.value) || 0 },
                  })
                }
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Stop Loss (pips) *</label>
              <input
                type="number"
                value={exitRules.stopLoss.value || ''}
                onChange={(e) =>
                  setExitRules({
                    ...exitRules,
                    stopLoss: { ...exitRules.stopLoss, value: parseFloat(e.target.value) || 0 },
                  })
                }
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="25"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="trailing"
              checked={exitRules.trailing?.enabled || false}
              onChange={(e) =>
                setExitRules({
                  ...exitRules,
                  trailing: { ...exitRules.trailing, enabled: e.target.checked },
                })
              }
              className="w-4 h-4"
            />
            <label htmlFor="trailing" className="text-sm font-medium text-neutral-700">
              Enable Trailing Stop
            </label>
          </div>

          {exitRules.trailing?.enabled && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Trailing Distance (pips)</label>
              <input
                type="number"
                value={exitRules.trailing?.distance || ''}
                onChange={(e) =>
                  setExitRules({
                    ...exitRules,
                    trailing: { ...exitRules.trailing, distance: parseFloat(e.target.value) || 10 },
                  })
                }
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg"
                placeholder="10"
              />
            </div>
          )}
        </div>

        {/* Risk Management */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-neutral-900">Risk Management</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Lot Size *</label>
              <input
                type="number"
                step="0.01"
                value={riskManagement.lotSize}
                onChange={(e) =>
                  setRiskManagement({ ...riskManagement, lotSize: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg"
                placeholder="0.1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Max Positions</label>
              <input
                type="number"
                value={riskManagement.maxPositions}
                onChange={(e) =>
                  setRiskManagement({ ...riskManagement, maxPositions: parseInt(e.target.value) || 1 })
                }
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg"
                placeholder="5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Max Daily Loss ($)</label>
              <input
                type="number"
                value={riskManagement.maxDailyLoss}
                onChange={(e) =>
                  setRiskManagement({ ...riskManagement, maxDailyLoss: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg"
                placeholder="500"
              />
            </div>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors font-medium"
          >
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
          <Link
            href={`/dashboard/strategies/${params.id}`}
            className="px-6 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors font-medium"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
