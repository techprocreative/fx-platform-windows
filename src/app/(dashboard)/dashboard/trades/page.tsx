'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  TrendingUp,
  TrendingDown,
  Download,
  Filter,
  Calendar,
  DollarSign,
} from 'lucide-react';

interface Trade {
  id: string;
  ticket: string;
  symbol: string;
  type: string;
  lots: number;
  openTime: string;
  openPrice: number;
  closeTime: string | null;
  closePrice: number | null;
  profit: number | null;
  pips: number | null;
  strategy: { name: string };
  executor: { name: string };
}

interface Stats {
  totalTrades: number;
  totalProfit: number;
  winningTrades: number;
  losingTrades: number;
}

export default function TradesPage() {
  const { data: session, status } = useSession();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalTrades: 0,
    totalProfit: 0,
    winningTrades: 0,
    losingTrades: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    symbol: '',
    strategyId: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    if (status === 'authenticated') {
      fetchTrades();
    }
  }, [status]);

  const fetchTrades = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.symbol) params.append('symbol', filters.symbol);
      if (filters.strategyId) params.append('strategyId', filters.strategyId);

      const response = await fetch(`/api/trades?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setTrades(data.trades);
        setStats(data.stats);
      }
    } catch (error) {
      toast.error('Failed to load trades');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (trades.length === 0) {
      toast.error('No trades to export');
      return;
    }

    const headers = ['Date', 'Symbol', 'Type', 'Lots', 'Entry', 'Exit', 'Profit', 'Pips', 'Strategy', 'Executor'];
    const rows = trades.map(trade => [
      new Date(trade.openTime).toLocaleDateString(),
      trade.symbol,
      trade.type,
      trade.lots,
      trade.openPrice,
      trade.closePrice || 'Open',
      trade.profit?.toFixed(2) || '0',
      trade.pips?.toFixed(1) || '0',
      trade.strategy.name,
      trade.executor.name,
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Trades exported');
  };

  const winRate = stats.totalTrades > 0 
    ? ((stats.winningTrades / stats.totalTrades) * 100).toFixed(1)
    : '0';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-600">Loading trades...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Trade History</h1>
          <p className="text-neutral-600 mt-1">View all executed trades</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors font-medium"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors font-medium"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Total Trades</span>
            <TrendingUp className="h-4 w-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-bold text-neutral-900">{stats.totalTrades}</p>
        </div>
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Total P&L</span>
            <DollarSign className="h-4 w-4 text-neutral-400" />
          </div>
          <p className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${stats.totalProfit.toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Win Rate</span>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900">{winRate}%</p>
        </div>
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Wins / Losses</span>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900">
            {stats.winningTrades} / {stats.losingTrades}
          </p>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Symbol
              </label>
              <input
                type="text"
                value={filters.symbol}
                onChange={(e) => setFilters({ ...filters, symbol: e.target.value })}
                placeholder="EURUSD"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-900"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchTrades}
                className="w-full px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors font-medium"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trades Table */}
      {trades.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-neutral-200">
          <Calendar className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-neutral-900 mb-2">No trades found</h3>
          <p className="text-neutral-600">Start trading to see your history here</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Symbol</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Lots</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Entry</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Exit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Profit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Pips</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Strategy</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Executor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {trades.map((trade) => (
                  <tr key={trade.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-sm text-neutral-900">
                      {new Date(trade.openTime).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-neutral-900">{trade.symbol}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        trade.type === 'BUY' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {trade.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-neutral-900">{trade.lots}</td>
                    <td className="px-4 py-3 text-sm text-right text-neutral-900">{trade.openPrice.toFixed(5)}</td>
                    <td className="px-4 py-3 text-sm text-right text-neutral-900">
                      {trade.closePrice ? trade.closePrice.toFixed(5) : '-'}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${
                      (trade.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${(trade.profit || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-neutral-900">
                      {trade.pips?.toFixed(1) || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-900">{trade.strategy.name}</td>
                    <td className="px-4 py-3 text-sm text-neutral-900">{trade.executor.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
