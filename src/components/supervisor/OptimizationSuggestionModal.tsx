'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Info,
  Loader2,
  Brain
} from 'lucide-react';

interface Suggestion {
  parameter: string;
  current: number;
  proposed: number;
  change: string;
  reasoning: string;
  expectedImprovement: {
    winRate?: string;
    profitFactor?: string;
    dailyProfit?: string;
  };
  riskImpact: {
    maxDrawdown?: string;
    acceptable: boolean;
  };
  confidence: number;
}

interface OptimizationSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  optimizationId: string;
  strategyName: string;
  suggestions: Suggestion[];
  overallConfidence: number;
  reasoning: string;
  onApprove: (optimizationId: string) => Promise<void>;
  onReject: (optimizationId: string) => Promise<void>;
}

export function OptimizationSuggestionModal({
  isOpen,
  onClose,
  optimizationId,
  strategyName,
  suggestions,
  overallConfidence,
  reasoning,
  onApprove,
  onReject,
}: OptimizationSuggestionModalProps) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleApprove = async () => {
    try {
      setLoading(true);
      await onApprove(optimizationId);
      toast.success('Optimization approved and applied!');
      onClose();
    } catch (error) {
      console.error('Failed to approve optimization:', error);
      toast.error('Failed to approve optimization');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    try {
      setLoading(true);
      await onReject(optimizationId);
      toast.success('Optimization rejected');
      onClose();
    } catch (error) {
      console.error('Failed to reject optimization:', error);
      toast.error('Failed to reject optimization');
    } finally {
      setLoading(false);
    }
  };

  const getParameterLabel = (param: string): string => {
    const labels: Record<string, string> = {
      stopLossPips: 'Stop Loss (pips)',
      takeProfitPips: 'Take Profit (pips)',
      lotSize: 'Lot Size',
      riskPerTrade: 'Risk Per Trade (%)',
      maxConcurrentTrades: 'Max Concurrent Trades',
      maxDailyTrades: 'Max Daily Trades',
      maxDailyLoss: 'Max Daily Loss ($)',
      trailingStopDistance: 'Trailing Stop Distance (pips)',
      breakevenPips: 'Breakeven Pips',
      entryConfidence: 'Entry Confidence',
      minVolume: 'Min Volume',
      maxSpread: 'Max Spread (pips)',
    };
    return labels[param] || param;
  };

  const confidenceColor = (confidence: number) => {
    if (confidence >= 0.95) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.85) return 'text-blue-600 dark:text-blue-400';
    if (confidence >= 0.70) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const confidenceBg = (confidence: number) => {
    if (confidence >= 0.95) return 'bg-green-100 dark:bg-green-900/30';
    if (confidence >= 0.85) return 'bg-blue-100 dark:bg-blue-900/30';
    if (confidence >= 0.70) return 'bg-amber-100 dark:bg-amber-900/30';
    return 'bg-red-100 dark:bg-red-900/30';
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Brain className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  LLM Optimization Suggestion
                </h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Strategy: <span className="font-medium">{strategyName}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Overall Confidence */}
          <div className={`${confidenceBg(overallConfidence)} rounded-lg p-4 mb-6 border ${
            overallConfidence >= 0.95 
              ? 'border-green-300 dark:border-green-700' 
              : 'border-blue-300 dark:border-blue-700'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`w-5 h-5 ${confidenceColor(overallConfidence)}`} />
                <span className="font-semibold text-gray-900 dark:text-white">
                  Overall Confidence
                </span>
              </div>
              <span className={`text-2xl font-bold ${confidenceColor(overallConfidence)}`}>
                {(overallConfidence * 100).toFixed(1)}%
              </span>
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {overallConfidence >= 0.95 && (
                <>Very high confidence - Safe to auto-apply</>
              )}
              {overallConfidence >= 0.85 && overallConfidence < 0.95 && (
                <>Good confidence - Review and approve recommended</>
              )}
              {overallConfidence >= 0.70 && overallConfidence < 0.85 && (
                <>Moderate confidence - Careful review suggested</>
              )}
              {overallConfidence < 0.70 && (
                <>Low confidence - Not recommended</>
              )}
            </div>
          </div>

          {/* LLM Reasoning */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              LLM Analysis
            </h3>
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {reasoning}
              </p>
            </div>
          </div>

          {/* Parameter Suggestions */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Suggested Changes ({suggestions.length})
            </h3>
            <div className="space-y-4">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                >
                  {/* Parameter Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white text-lg">
                        {getParameterLabel(suggestion.parameter)}
                      </h4>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-gray-600 dark:text-gray-400">
                          Current: <span className="font-bold text-gray-900 dark:text-white">{suggestion.current}</span>
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="text-blue-600 dark:text-blue-400">
                          Proposed: <span className="font-bold">{suggestion.proposed}</span>
                        </span>
                        <span className={`font-semibold ${
                          suggestion.change.startsWith('+') 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {suggestion.change}
                        </span>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${confidenceBg(suggestion.confidence)} ${confidenceColor(suggestion.confidence)}`}>
                      {(suggestion.confidence * 100).toFixed(0)}%
                    </div>
                  </div>

                  {/* Reasoning */}
                  <div className="mb-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {suggestion.reasoning}
                    </p>
                  </div>

                  {/* Expected Improvement & Risk */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Expected Improvement */}
                    {suggestion.expectedImprovement && (
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <span className="text-sm font-semibold text-green-900 dark:text-green-100">
                            Expected Improvement
                          </span>
                        </div>
                        <div className="space-y-1 text-sm">
                          {suggestion.expectedImprovement.winRate && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Win Rate:</span>
                              <span className="font-medium text-green-700 dark:text-green-300">
                                {suggestion.expectedImprovement.winRate}
                              </span>
                            </div>
                          )}
                          {suggestion.expectedImprovement.profitFactor && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Profit Factor:</span>
                              <span className="font-medium text-green-700 dark:text-green-300">
                                {suggestion.expectedImprovement.profitFactor}
                              </span>
                            </div>
                          )}
                          {suggestion.expectedImprovement.dailyProfit && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Daily Profit:</span>
                              <span className="font-medium text-green-700 dark:text-green-300">
                                {suggestion.expectedImprovement.dailyProfit}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Risk Impact */}
                    {suggestion.riskImpact && (
                      <div className={`rounded-lg p-3 border ${
                        suggestion.riskImpact.acceptable
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          {suggestion.riskImpact.acceptable ? (
                            <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                          )}
                          <span className={`text-sm font-semibold ${
                            suggestion.riskImpact.acceptable
                              ? 'text-blue-900 dark:text-blue-100'
                              : 'text-red-900 dark:text-red-100'
                          }`}>
                            Risk Assessment
                          </span>
                        </div>
                        <div className="space-y-1 text-sm">
                          {suggestion.riskImpact.maxDrawdown && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Max Drawdown:</span>
                              <span className={`font-medium ${
                                suggestion.riskImpact.acceptable
                                  ? 'text-blue-700 dark:text-blue-300'
                                  : 'text-red-700 dark:text-red-300'
                              }`}>
                                {suggestion.riskImpact.maxDrawdown}
                              </span>
                            </div>
                          )}
                          <div className={`text-xs font-medium ${
                            suggestion.riskImpact.acceptable
                              ? 'text-blue-700 dark:text-blue-300'
                              : 'text-red-700 dark:text-red-300'
                          }`}>
                            {suggestion.riskImpact.acceptable ? 'Acceptable risk level' : 'Risk too high!'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {overallConfidence >= 0.85 ? (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  LLM recommends applying these changes
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Review carefully before applying
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleReject}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Reject
              </button>
              <button
                onClick={handleApprove}
                disabled={loading}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Approve & Apply
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
