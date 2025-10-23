'use client';

import { CheckCircle, Edit, Sparkles, TrendingUp, Shield, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

interface AIPreviewCardProps {
  strategy: {
    name: string;
    description: string;
    symbol?: string;
    timeframe?: string;
    rules: any[];
    parameters: {
      takeProfit?: number;
      stopLoss?: number;
      riskPerTrade?: number;
      maxPositions?: number;
      maxDailyLoss?: number;
    };
  };
  onReview: () => void;
  onUseAsIs: () => void;
}

export function AIPreviewCard({ strategy, onReview, onUseAsIs }: AIPreviewCardProps) {
  // Extract conditions count
  const entryConditionsCount = strategy.rules?.[0]?.conditions?.length || 0;
  const firstCondition = strategy.rules?.[0]?.conditions?.[0];
  
  // Calculate pips from parameters (with optional chaining for safety)
  const takeProfitPips = Math.round((strategy.parameters?.takeProfit || 0.004) * 10000);
  const stopLossPips = Math.round((strategy.parameters?.stopLoss || 0.002) * 10000);
  const lotSize = strategy.parameters?.riskPerTrade || 0.01;
  const maxLoss = strategy.parameters?.maxDailyLoss || 100;
  const riskRewardRatio = (takeProfitPips / stopLossPips).toFixed(2);
  
  // Extract all indicators from conditions
  const extractIndicators = () => {
    const indicators = new Set<string>();
    strategy.rules?.forEach((rule: any) => {
      rule.conditions?.forEach((cond: any) => {
        if (cond.indicator) {
          indicators.add(cond.indicator.toUpperCase());
        }
      });
    });
    return Array.from(indicators);
  };
  
  const indicators = extractIndicators();

  return (
    <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 via-white to-purple-50 shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <div className="rounded-full bg-purple-100 p-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <CardTitle className="text-xl">AI Generated Strategy</CardTitle>
            <CardDescription>Review your strategy before customizing or using it</CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Strategy Overview */}
        <div className="rounded-lg border border-purple-200 bg-white p-4 space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-1">{strategy.name}</h3>
            <p className="text-sm text-neutral-600">{strategy.description}</p>
          </div>
          
          <div className="flex items-center gap-4 pt-2 border-t border-neutral-100">
            <div className="flex items-center gap-1.5 text-sm">
              <CheckCircle className="h-4 w-4 text-purple-600" />
              <span className="text-neutral-700">
                <span className="font-medium">{strategy.symbol || 'EURUSD'}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <CheckCircle className="h-4 w-4 text-purple-600" />
              <span className="text-neutral-700">
                <span className="font-medium">{strategy.timeframe || 'H1'}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-neutral-700">
                <span className="font-medium">{entryConditionsCount}</span> Condition{entryConditionsCount !== 1 ? 's' : ''}
              </span>
            </div>
            {firstCondition && (
              <div className="text-xs text-neutral-500">
                ({firstCondition.indicator} {firstCondition.operator?.replace('_', ' ')} {firstCondition.value})
              </div>
            )}
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Exit Rules */}
          <div className="rounded-lg bg-green-50 border border-green-200 p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-900">Take Profit</span>
            </div>
            <p className="text-lg font-bold text-green-700">{takeProfitPips} pips</p>
          </div>

          <div className="rounded-lg bg-red-50 border border-red-200 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-red-600" />
              <span className="text-xs font-medium text-red-900">Stop Loss</span>
            </div>
            <p className="text-lg font-bold text-red-700">{stopLossPips} pips</p>
          </div>

          {/* Risk Management */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-900">Position Size</span>
            </div>
            <p className="text-lg font-bold text-blue-700">{lotSize} lots</p>
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-900">Max Daily Loss</span>
            </div>
            <p className="text-lg font-bold text-amber-700">${maxLoss}</p>
          </div>
        </div>

        {/* Indicators Used */}
        {indicators.length > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <h4 className="text-sm font-semibold text-blue-900">Indicators Used</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {indicators.map((indicator, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold border border-blue-300"
                >
                  {indicator}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Risk-Reward Ratio */}
        <div className="rounded-lg bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-600" />
              <span className="text-sm font-semibold text-neutral-700">Risk-Reward Ratio:</span>
            </div>
            <span className="text-2xl font-bold text-green-600">
              1:{riskRewardRatio}
            </span>
          </div>
          <p className="text-xs text-neutral-600 mt-2">
            For every $1 risked, potential to gain ${riskRewardRatio}
          </p>
        </div>

        {/* Advanced Features */}
        {(strategy.parameters?.smartExit || strategy.parameters?.dynamicRisk || strategy.parameters?.sessionFilter || strategy.parameters?.correlationFilter || strategy.parameters?.regimeDetection) && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <h4 className="text-sm font-semibold text-indigo-900">Advanced Features Enabled</h4>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {strategy.parameters?.smartExit && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-green-700 font-semibold">Smart Exit Rules</span>
                </div>
              )}
              {strategy.parameters?.dynamicRisk && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-green-700 font-semibold">Dynamic Risk</span>
                </div>
              )}
              {strategy.parameters?.sessionFilter && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-green-700 font-semibold">Session Filter</span>
                </div>
              )}
              {strategy.parameters?.correlationFilter && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-green-700 font-semibold">Correlation Filter</span>
                </div>
              )}
              {strategy.parameters?.regimeDetection && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-green-700 font-semibold">Regime Detection</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Total Conditions Count */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-600">Total Entry Conditions:</span>
            <span className="text-lg font-bold text-neutral-900">{entryConditionsCount}</span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm text-neutral-600">Total Rules:</span>
            <span className="text-lg font-bold text-neutral-900">{strategy.rules?.length || 0}</span>
          </div>
        </div>

        {/* Info Box */}
        <div className="rounded-lg bg-purple-50 border border-purple-200 p-4">
          <p className="text-sm text-purple-900">
            <span className="font-medium">💡 Ready to use:</span> This strategy is complete with all required fields. Click "Use As-Is" to create and backtest immediately, or "Review & Customize" to fine-tune the parameters.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            type="button"
            onClick={onReview}
            className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
            size="lg"
          >
            <Edit className="h-5 w-5" />
            Review & Customize
          </Button>
          
          <Button
            type="button"
            onClick={onUseAsIs}
            variant="secondary"
            className="flex-1 border-2 border-purple-300 hover:bg-purple-50"
            size="lg"
          >
            <CheckCircle className="h-5 w-5" />
            Use As-Is
          </Button>
        </div>

        <p className="text-xs text-center text-neutral-500">
          Generated by Grok AI · Always review strategies before live trading
        </p>
      </CardContent>
    </Card>
  );
}
