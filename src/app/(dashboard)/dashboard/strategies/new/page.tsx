'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import toast from 'react-hot-toast';
import { 
  ChevronLeft, Plus, Trash2, AlertCircle, 
  Sparkles, BookOpen, Target, TrendingUp, 
  Shield, Info, HelpCircle, Zap 
} from 'lucide-react';
import Link from 'next/link';

interface Condition {
  id: string;
  indicator: string;
  condition: string;
  value: number | null;
  period?: number;
}

interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  icon: React.ReactNode;
  config: {
    name: string;
    description: string;
    symbol: string;
    timeframe: string;
    entryConditions: Omit<Condition, 'id'>[];
    exitRules: any;
    riskManagement: any;
    entryLogic: 'AND' | 'OR';
  };
}

const INDICATORS = ['RSI', 'MACD', 'EMA', 'SMA', 'ADX', 'Bollinger Bands', 'Stochastic'];
const CONDITIONS = ['greater_than', 'less_than', 'equals', 'crosses_above', 'crosses_below'];
const SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD', 'ETHUSD', 'SP500'];
const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];

const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: 'rsi-oversold',
    name: 'RSI Oversold Bounce',
    description: 'Buy when RSI indicates oversold conditions. Great for beginners!',
    difficulty: 'beginner',
    icon: <TrendingUp className="h-5 w-5" />,
    config: {
      name: 'RSI Bounce Strategy',
      description: 'Buys when RSI shows oversold (below 30) and sells at profit target',
      symbol: 'EURUSD',
      timeframe: 'H1',
      entryConditions: [
        {
          indicator: 'RSI',
          condition: 'less_than',
          value: 30,
          period: 14,
        },
      ],
      exitRules: {
        takeProfit: { type: 'pips', value: 30 },
        stopLoss: { type: 'pips', value: 15 },
        trailing: { enabled: false, distance: 10 },
      },
      riskManagement: {
        lotSize: 0.01,
        maxPositions: 2,
        maxDailyLoss: 100,
      },
      entryLogic: 'AND',
    },
  },
  {
    id: 'ma-crossover',
    name: 'Moving Average Crossover',
    description: 'Classic trend-following strategy using MA crossovers',
    difficulty: 'beginner',
    icon: <Target className="h-5 w-5" />,
    config: {
      name: 'MA Crossover Strategy',
      description: 'Trades when fast MA crosses slow MA',
      symbol: 'EURUSD',
      timeframe: 'H4',
      entryConditions: [
        {
          indicator: 'EMA',
          condition: 'crosses_above',
          value: 50,
          period: 20,
        },
      ],
      exitRules: {
        takeProfit: { type: 'pips', value: 50 },
        stopLoss: { type: 'pips', value: 25 },
        trailing: { enabled: true, distance: 15 },
      },
      riskManagement: {
        lotSize: 0.01,
        maxPositions: 3,
        maxDailyLoss: 150,
      },
      entryLogic: 'AND',
    },
  },
  {
    id: 'breakout',
    name: 'Support/Resistance Breakout',
    description: 'Trade breakouts from key levels with momentum',
    difficulty: 'intermediate',
    icon: <Zap className="h-5 w-5" />,
    config: {
      name: 'Breakout Strategy',
      description: 'Trades breakouts with ADX confirmation',
      symbol: 'EURUSD',
      timeframe: 'H1',
      entryConditions: [
        {
          indicator: 'ADX',
          condition: 'greater_than',
          value: 25,
          period: 14,
        },
        {
          indicator: 'RSI',
          condition: 'greater_than',
          value: 50,
          period: 14,
        },
      ],
      exitRules: {
        takeProfit: { type: 'pips', value: 60 },
        stopLoss: { type: 'pips', value: 20 },
        trailing: { enabled: true, distance: 20 },
      },
      riskManagement: {
        lotSize: 0.02,
        maxPositions: 3,
        maxDailyLoss: 200,
      },
      entryLogic: 'AND',
    },
  },
];

export default function NewStrategyPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(true);

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

  const selectTemplate = (template: StrategyTemplate) => {
    setSelectedTemplate(template.id);
    setFormData({
      name: template.config.name,
      description: template.config.description,
      symbol: template.config.symbol,
      timeframe: template.config.timeframe,
      type: 'manual',
    });
    
    const conditions = template.config.entryConditions.map((c, idx) => ({
      ...c,
      id: Date.now().toString() + idx,
    }));
    setEntryConditions(conditions);
    
    setExitRules(template.config.exitRules);
    setRiskManagement(template.config.riskManagement);
    setEntryLogic(template.config.entryLogic);
    setShowTemplates(false);
  };

  if (status === 'unauthenticated') {
    redirect('/login');
  }

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

    setLoading(true);

    try {
      const rules = {
        entry: {
          conditions: entryConditions.map(({ id, ...rest }) => rest),
          logic: entryLogic,
        },
        exit: exitRules,
        riskManagement,
      };

      const response = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          rules,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Failed to create strategy');
        setLoading(false);
        return;
      }

      const data = await response.json();
      toast.success('Strategy created successfully!');
      router.push(`/dashboard/strategies/${data.id}`);
    } catch (error) {
      toast.error('An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/strategies"
          className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="h-6 w-6 text-neutral-600" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Create Strategy</h1>
          <p className="text-neutral-600 mt-1">
            {mode === 'simple' 
              ? 'Choose a template to get started quickly' 
              : 'Design a custom trading strategy'}
          </p>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary-600" />
            <span className="font-semibold text-neutral-900">Creation Mode</span>
          </div>
          <div className="flex gap-2 bg-neutral-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode('simple');
                setShowTemplates(true);
                setEntryConditions([]);
              }}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                mode === 'simple'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Simple
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode('advanced')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                mode === 'advanced'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Advanced
              </span>
            </button>
          </div>
        </div>
        
        {mode === 'simple' && (
          <div className="text-sm text-neutral-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5" />
              <div>
                <strong className="text-blue-900">Beginner Mode</strong>
                <p className="mt-1">Start with a proven template and customize it to your needs. Perfect for beginners!</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Template Selection (Simple Mode) */}
      {mode === 'simple' && showTemplates && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-neutral-900">Choose a Template</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {STRATEGY_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => selectTemplate(template)}
                className="bg-white border-2 border-neutral-200 rounded-lg p-4 hover:border-primary-500 hover:shadow-md transition-all text-left"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    template.difficulty === 'beginner' ? 'bg-green-100 text-green-600' :
                    template.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-red-100 text-red-600'
                  }`}>
                    {template.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-neutral-900">{template.name}</h3>
                    <p className="text-sm text-neutral-600 mt-1">{template.description}</p>
                    <div className="mt-2">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                        template.difficulty === 'beginner' ? 'bg-green-100 text-green-700' :
                        template.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {template.difficulty}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          
          <div className="text-center">
            <button
              type="button"
              onClick={() => setMode('advanced')}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Or create from scratch →
            </button>
          </div>
        </div>
      )}

      {/* Form (shown when template is selected or in advanced mode) */}
      {(mode === 'advanced' || (mode === 'simple' && !showTemplates)) && (
        <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="rounded-lg border border-neutral-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-900">Basic Information</h2>
            {mode === 'simple' && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                Pre-filled from template
              </span>
            )}
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-neutral-700 mb-2">
              Strategy Name
              {mode === 'simple' && (
                <span className="ml-2 text-xs text-neutral-500 font-normal">
                  (You can customize this)
                </span>
              )}
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleFormChange}
              placeholder="e.g., RSI Breakout Strategy"
              className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-neutral-700 mb-2">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleFormChange}
              placeholder="Describe your strategy..."
              rows={3}
              className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="symbol" className="block text-sm font-medium text-neutral-700 mb-2">
                Trading Symbol
              </label>
              <select
                id="symbol"
                name="symbol"
                value={formData.symbol}
                onChange={handleFormChange}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                disabled={loading}
              >
                {SYMBOLS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="timeframe" className="block text-sm font-medium text-neutral-700 mb-2">
                Timeframe
              </label>
              <select
                id="timeframe"
                name="timeframe"
                value={formData.timeframe}
                onChange={handleFormChange}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                disabled={loading}
              >
                {TIMEFRAMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Entry Conditions */}
        <div className="rounded-lg border border-neutral-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-900">Entry Conditions</h2>
            <button
              type="button"
              onClick={handleAddCondition}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Condition
            </button>
          </div>

          <div className="space-y-3">
            {entryConditions.map((condition) => (
              <div key={condition.id} className="flex gap-2 items-end">
                <div className="flex-1 grid grid-cols-4 gap-2">
                  <select
                    value={condition.indicator}
                    onChange={(e) =>
                      handleConditionChange(condition.id, 'indicator', e.target.value)
                    }
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  >
                    {INDICATORS.map((ind) => (
                      <option key={ind} value={ind}>
                        {ind}
                      </option>
                    ))}
                  </select>

                  {condition.indicator !== 'MACD' && (
                    <input
                      type="number"
                      placeholder="Period"
                      value={condition.period || 14}
                      onChange={(e) =>
                        handleConditionChange(condition.id, 'period', parseInt(e.target.value))
                      }
                      className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                  )}

                  <select
                    value={condition.condition}
                    onChange={(e) =>
                      handleConditionChange(condition.id, 'condition', e.target.value)
                    }
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  >
                    {CONDITIONS.map((cond) => (
                      <option key={cond} value={cond}>
                        {cond}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    placeholder="Value"
                    value={condition.value || ''}
                    onChange={(e) =>
                      handleConditionChange(
                        condition.id,
                        'value',
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>

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

          <div className="flex items-center gap-4 pt-2">
            <span className="text-sm font-medium text-neutral-700">Combine with:</span>
            <select
              value={entryLogic}
              onChange={(e) => setEntryLogic(e.target.value as 'AND' | 'OR')}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="AND">AND (all conditions)</option>
              <option value="OR">OR (any condition)</option>
            </select>
          </div>
        </div>

        {/* Exit Rules */}
        <div className="rounded-lg border border-neutral-200 bg-white p-6 space-y-4">
          <h2 className="text-lg font-bold text-neutral-900">Exit Rules</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Take Profit
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={exitRules.takeProfit.value}
                  onChange={(e) =>
                    setExitRules({
                      ...exitRules,
                      takeProfit: {
                        ...exitRules.takeProfit,
                        value: parseFloat(e.target.value),
                      },
                    })
                  }
                  className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
                <select
                  value={exitRules.takeProfit.type}
                  onChange={(e) =>
                    setExitRules({
                      ...exitRules,
                      takeProfit: { ...exitRules.takeProfit, type: e.target.value },
                    })
                  }
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="pips">Pips</option>
                  <option value="percentage">%</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Stop Loss
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={exitRules.stopLoss.value}
                  onChange={(e) =>
                    setExitRules({
                      ...exitRules,
                      stopLoss: {
                        ...exitRules.stopLoss,
                        value: parseFloat(e.target.value),
                      },
                    })
                  }
                  className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
                <select
                  value={exitRules.stopLoss.type}
                  onChange={(e) =>
                    setExitRules({
                      ...exitRules,
                      stopLoss: { ...exitRules.stopLoss, type: e.target.value },
                    })
                  }
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="pips">Pips</option>
                  <option value="percentage">%</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Management */}
        <div className="rounded-lg border border-neutral-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-900">Risk Management</h2>
            {mode === 'simple' && (
              <div className="flex items-center gap-1 text-xs text-amber-700">
                <HelpCircle className="h-3 w-3" />
                <span>Conservative settings applied</span>
              </div>
            )}
          </div>

          {mode === 'simple' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              <p className="text-amber-900 font-medium mb-1">Beginner-Safe Settings</p>
              <p className="text-amber-800">
                We've set conservative risk limits: small lot sizes (0.01), 
                limited positions, and strict daily loss limits. As you gain experience, 
                you can gradually increase these values.
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Lot Size
                <span className="ml-1 text-xs text-neutral-500 font-normal">
                  (0.01 = micro lot)
                </span>
              </label>
              <input
                type="number"
                step="0.01"
                value={riskManagement.lotSize}
                onChange={(e) =>
                  setRiskManagement({
                    ...riskManagement,
                    lotSize: parseFloat(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Max Positions
              </label>
              <input
                type="number"
                value={riskManagement.maxPositions}
                onChange={(e) =>
                  setRiskManagement({
                    ...riskManagement,
                    maxPositions: parseInt(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Max Daily Loss ($)
              </label>
              <input
                type="number"
                value={riskManagement.maxDailyLoss}
                onChange={(e) =>
                  setRiskManagement({
                    ...riskManagement,
                    maxDailyLoss: parseFloat(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg bg-primary-600 px-6 py-3 text-white font-semibold hover:bg-primary-700 disabled:bg-primary-600/50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating...' : 'Create Strategy'}
          </button>

          <Link
            href="/dashboard/strategies"
            className="px-6 py-3 rounded-lg border border-neutral-300 text-neutral-700 font-semibold hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
        </form>
      )}

      {/* Info Box */}
      {mode === 'simple' && !showTemplates && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex gap-3">
          <Sparkles className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-800">
            <p className="font-semibold mb-1">✅ Template Applied!</p>
            <p>
              We've pre-filled the form with a proven strategy configuration. You can customize 
              any values to match your trading style. Click "Create Strategy" when you're ready!
            </p>
          </div>
        </div>
      )}
      
      {mode === 'advanced' && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">💡 Pro Tip:</p>
            <p>
              Start with simple strategies and test them thoroughly with backtesting before deploying
              to live trading. Diversify across multiple strategies for better risk management.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
