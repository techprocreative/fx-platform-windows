'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  TrendingUp, 
  TrendingDown, 
  XCircle, 
  DollarSign,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Position {
  ticket: number;
  strategy: string;
  strategyName: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  profit: number;
  profitPercent: number;
  duration: number;
  openPrice: number;
  sl: number;
  tp: number;
}

interface PositionSummary {
  total: number;
  profitable: number;
  losing: number;
  totalProfit: number;
  totalVolume: number;
  byStrategy: Array<{
    strategyId: string;
    strategyName: string;
    count: number;
    profit: number;
    volume: number;
  }>;
  bySymbol: Array<{
    symbol: string;
    count: number;
    profit: number;
    volume: number;
  }>;
}

interface Props {
  executorId: string;
  positions: Position[];
  summary: PositionSummary;
  strategies: Array<{ id: string; name: string }>;
  onCommandSent?: () => void;
}

export function PositionManagementPanel({ 
  executorId, 
  positions, 
  summary,
  strategies,
  onCommandSent 
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<string>('');

  const sendCommand = async (command: string, parameters: any = {}) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/executor/${executorId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          parameters,
          priority: 'HIGH'
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message || 'Command sent successfully');
        onCommandSent?.();
      } else {
        toast.error(data.error || 'Command failed');
      }
    } catch (error) {
      console.error('Command error:', error);
      toast.error('Failed to send command');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseProfitable = () => {
    if (summary.profitable === 0) {
      toast.error('No profitable positions to close');
      return;
    }

    if (confirm(`Close ${summary.profitable} profitable position(s)?`)) {
      sendCommand('CLOSE_PROFITABLE', { minProfit: 0 });
    }
  };

  const handleCloseLosing = () => {
    if (summary.losing === 0) {
      toast.error('No losing positions to close');
      return;
    }

    if (confirm(`Close ${summary.losing} losing position(s)?\n\nThis will stop further losses.`)) {
      sendCommand('CLOSE_LOSING', { maxLoss: 0 });
    }
  };

  const handleCloseByStrategy = () => {
    if (!selectedStrategy) {
      toast.error('Please select a strategy');
      return;
    }

    const strategyInfo = summary.byStrategy.find(s => s.strategyId === selectedStrategy);
    if (!strategyInfo || strategyInfo.count === 0) {
      toast.error('No positions for selected strategy');
      return;
    }

    if (confirm(`Close ${strategyInfo.count} position(s) for ${strategyInfo.strategyName}?`)) {
      sendCommand('CLOSE_BY_STRATEGY', { strategyId: selectedStrategy });
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Total Positions</p>
              <p className="text-2xl font-bold">{summary.total}</p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Profitable</p>
              <p className="text-2xl font-bold text-green-600">{summary.profitable}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Losing</p>
              <p className="text-2xl font-bold text-red-600">{summary.losing}</p>
            </div>
            <TrendingDown className="h-8 w-8 text-red-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Total P&L</p>
              <p className={`text-2xl font-bold ${summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${summary.totalProfit.toFixed(2)}
              </p>
            </div>
            <DollarSign className={`h-8 w-8 ${summary.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`} />
          </div>
        </Card>
      </div>

      {/* Action Buttons */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <XCircle className="h-5 w-5" />
          Quick Position Actions
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Close Profitable */}
          <Button
            onClick={handleCloseProfitable}
            disabled={isLoading || summary.profitable === 0}
            className="bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Close Profitable ({summary.profitable})
          </Button>

          {/* Close Losing */}
          <Button
            onClick={handleCloseLosing}
            disabled={isLoading || summary.losing === 0}
            className="bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2"
          >
            <AlertCircle className="h-4 w-4" />
            Close Losing ({summary.losing})
          </Button>

          {/* Close by Strategy */}
          <div className="flex gap-2">
            <select
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value)}
              className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              <option value="">Select Strategy...</option>
              {strategies.map(strategy => {
                const strategyInfo = summary.byStrategy.find(s => s.strategyId === strategy.id);
                const count = strategyInfo?.count || 0;
                return (
                  <option key={strategy.id} value={strategy.id}>
                    {strategy.name} ({count})
                  </option>
                );
              })}
            </select>
            <Button
              onClick={handleCloseByStrategy}
              disabled={isLoading || !selectedStrategy}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              Close
            </Button>
          </div>
        </div>

        <p className="mt-4 text-sm text-neutral-600 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Tip: Use "Close Profitable" to secure profits or "Close Losing" to cut losses quickly
        </p>
      </Card>

      {/* Position List */}
      {positions.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Open Positions ({positions.length})</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-neutral-200">
                <tr>
                  <th className="text-left py-2 px-4 text-sm font-medium text-neutral-700">Ticket</th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-neutral-700">Strategy</th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-neutral-700">Symbol</th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-neutral-700">Type</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-neutral-700">Volume</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-neutral-700">Profit</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-neutral-700">Duration</th>
                </tr>
              </thead>
              <tbody>
                {positions.map(position => (
                  <tr key={position.ticket} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="py-3 px-4 font-mono text-sm">{position.ticket}</td>
                    <td className="py-3 px-4 text-sm">{position.strategyName}</td>
                    <td className="py-3 px-4 font-medium">{position.symbol}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        position.type === 'BUY' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {position.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">{position.volume.toFixed(2)}</td>
                    <td className={`py-3 px-4 text-right font-semibold ${
                      position.profit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${position.profit.toFixed(2)}
                      <span className="text-xs ml-1">
                        ({position.profitPercent >= 0 ? '+' : ''}{position.profitPercent.toFixed(2)}%)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-neutral-600">
                      {formatDuration(position.duration)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Strategy Breakdown */}
      {summary.byStrategy.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">By Strategy</h3>
            <div className="space-y-3">
              {summary.byStrategy.map(strategy => (
                <div key={strategy.strategyId} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                  <div>
                    <p className="font-medium">{strategy.strategyName}</p>
                    <p className="text-sm text-neutral-600">
                      {strategy.count} position(s) • {strategy.volume.toFixed(2)} lots
                    </p>
                  </div>
                  <div className={`text-right font-semibold ${strategy.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${strategy.profit.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">By Symbol</h3>
            <div className="space-y-3">
              {summary.bySymbol.map(symbolInfo => (
                <div key={symbolInfo.symbol} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                  <div>
                    <p className="font-medium">{symbolInfo.symbol}</p>
                    <p className="text-sm text-neutral-600">
                      {symbolInfo.count} position(s) • {symbolInfo.volume.toFixed(2)} lots
                    </p>
                  </div>
                  <div className={`text-right font-semibold ${symbolInfo.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${symbolInfo.profit.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
