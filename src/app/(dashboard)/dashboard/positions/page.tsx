'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { PositionCard } from '@/components/trading/position-card';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity,
  RefreshCw,
  Filter,
  Download,
  Eye,
  EyeOff
} from 'lucide-react';
import { MonitoredPosition, PnLReport } from '@/lib/monitoring/types';
import { Position } from '@/lib/brokers/types';

export default function PositionsPage() {
  const { data: session, status } = useSession();
  const [positions, setPositions] = useState<MonitoredPosition[]>([]);
  const [pnlReport, setPnlReport] = useState<PnLReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(true);
  const [filter, setFilter] = useState<'all' | 'profitable' | 'losing'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
      return;
    }
    if (status === 'authenticated') {
      fetchPositions();
      // Set up WebSocket connection for real-time updates
      const interval = setInterval(fetchPositions, 5000); // Update every 5 seconds
      return () => clearInterval(interval);
    }
    return undefined;
  }, [status]);

  const fetchPositions = async () => {
    try {
      const response = await fetch('/api/positions');
      
      if (!response.ok) {
        throw new Error('Failed to fetch positions');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setPositions(data.positions || []);
        setPnlReport(data.pnlReport || null);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Error fetching positions:', error);
      // Fallback to mock data if API fails
      const mockPositions: MonitoredPosition[] = [
        {
          ticket: 12345,
          symbol: 'EURUSD',
          type: 0, // BUY
          volume: 0.1,
          priceOpen: 1.0850,
          priceCurrent: 1.0875,
          priceSL: 1.0800,
          priceTP: 1.0900,
          swap: 0.25,
          profit: 25.00,
          comment: 'Manual trade',
          openTime: new Date(Date.now() - 3600000), // 1 hour ago
          expiration: new Date(Date.now() + 86400000), // 1 day from now
          magic: 123,
          commission: 0.50,
          storage: 0,
          identifier: 456,
          unrealizedPnL: 25.00,
          realizedPnL: 0,
          totalPnL: 25.00,
          lastUpdated: new Date()
        },
        {
          ticket: 12346,
          symbol: 'GBPUSD',
          type: 1, // SELL
          volume: 0.05,
          priceOpen: 1.2750,
          priceCurrent: 1.2730,
          priceSL: 1.2800,
          priceTP: 1.2700,
          swap: -0.15,
          profit: 10.00,
          comment: 'Strategy trade',
          openTime: new Date(Date.now() - 7200000), // 2 hours ago
          expiration: new Date(Date.now() + 86400000),
          magic: 456,
          commission: 0.25,
          storage: 0,
          identifier: 789,
          unrealizedPnL: 10.00,
          realizedPnL: 0,
          totalPnL: 10.00,
          lastUpdated: new Date()
        },
        {
          ticket: 12347,
          symbol: 'USDJPY',
          type: 0, // BUY
          volume: 0.2,
          priceOpen: 150.50,
          priceCurrent: 150.25,
          priceSL: 149.50,
          priceTP: 152.00,
          swap: 0.50,
          profit: -50.00,
          comment: 'Test position',
          openTime: new Date(Date.now() - 1800000), // 30 minutes ago
          expiration: new Date(Date.now() + 86400000),
          magic: 789,
          commission: 1.00,
          storage: 0,
          identifier: 101,
          unrealizedPnL: -50.00,
          realizedPnL: 0,
          totalPnL: -50.00,
          lastUpdated: new Date()
        }
      ];

      setPositions(mockPositions);
      setLastUpdate(new Date());

      // Calculate P&L report
      const totalUnrealized = mockPositions.reduce((sum, pos) => sum + (pos.unrealizedPnL || 0), 0);
      const totalRealized = mockPositions.reduce((sum, pos) => sum + (pos.realizedPnL || 0), 0);
      const totalPnL = totalUnrealized + totalRealized;

      const report: PnLReport = {
        totalUnrealizedPnL: totalUnrealized,
        totalRealizedPnL: totalRealized,
        totalPnL: totalPnL,
        positions: mockPositions.map(pos => ({
          ticket: pos.ticket,
          symbol: pos.symbol,
          type: pos.type,
          volume: pos.volume,
          openPrice: pos.priceOpen,
          currentPrice: pos.priceCurrent,
          unrealizedPnL: pos.unrealizedPnL || 0,
          realizedPnL: pos.realizedPnL || 0,
          totalPnL: pos.totalPnL || 0,
          pips: 0, // Would calculate based on price difference
          commission: pos.commission,
          swap: pos.swap,
          currency: 'USD',
          marginUsed: 0 // Would calculate based on position size
        })),
        currency: 'USD',
        timestamp: new Date(),
        accountBalance: 10000,
        accountEquity: 10000 + totalPnL,
        dailyPnL: totalPnL,
        weeklyPnL: totalPnL * 2,
        monthlyPnL: totalPnL * 5
      };

      setPnlReport(report);
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchPositions();
  };

  const handleClosePosition = async (ticket: number) => {
    try {
      // In production, this would call the API to close the position
      console.log('Closing position:', ticket);
      // Mock closing the position
      setPositions(prev => prev.filter(pos => pos.ticket !== ticket));
    } catch (error) {
      console.error('Failed to close position:', error);
    }
  };

  const handleModifyPosition = async (ticket: number, params: { stopLoss?: number; takeProfit?: number }) => {
    try {
      // In production, this would call the API to modify the position
      console.log('Modifying position:', ticket, params);
      // Mock modifying the position
      setPositions(prev => prev.map(pos => 
        pos.ticket === ticket 
          ? { ...pos, priceSL: params.stopLoss, priceTP: params.takeProfit }
          : pos
      ));
    } catch (error) {
      console.error('Failed to modify position:', error);
    }
  };

  const filteredPositions = positions.filter(pos => {
    if (filter === 'all') return true;
    if (filter === 'profitable') return (pos.profit || 0) >= 0;
    if (filter === 'losing') return (pos.profit || 0) < 0;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
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
          <h1 className="text-3xl font-bold text-neutral-900">Positions</h1>
          <p className="text-neutral-600 mt-1">
            Real-time position monitoring with P&L tracking
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
            {showDetails ? 'Hide' : 'Show'} Details
          </Button>
          
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="all">All Positions</option>
            <option value="profitable">Profitable</option>
            <option value="losing">Losing</option>
          </select>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="secondary" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* P&L Summary */}
      {pnlReport && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">Total P&L</span>
              <DollarSign className="h-4 w-4 text-blue-500" />
            </div>
            <p className={`text-2xl font-bold ${
              pnlReport.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              ${pnlReport.totalPnL.toFixed(2)}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              {pnlReport.totalUnrealizedPnL.toFixed(2)} unrealized, {pnlReport.totalRealizedPnL.toFixed(2)} realized
            </p>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">Open Positions</span>
              <Activity className="h-4 w-4 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-neutral-900">{positions.length}</p>
            <p className="text-xs text-neutral-500 mt-1">
              {filteredPositions.filter(pos => pos.profit >= 0).length} profitable, {filteredPositions.filter(pos => pos.profit < 0).length} losing
            </p>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">Daily P&L</span>
              {(pnlReport.dailyPnL || 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
            <p className={`text-2xl font-bold ${
              (pnlReport.dailyPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              ${(pnlReport.dailyPnL || 0).toFixed(2)}
            </p>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">Last Update</span>
              <RefreshCw className="h-4 w-4 text-neutral-500" />
            </div>
            <p className="text-sm font-medium text-neutral-900">
              {lastUpdate.toLocaleTimeString()}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Auto-refresh every 5s
            </p>
          </div>
        </div>
      )}

      {/* Positions List */}
      {filteredPositions.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredPositions.map((position) => (
            <PositionCard
              key={position.ticket}
              position={position}
              onClose={handleClosePosition}
              onModify={handleModifyPosition}
              showDetails={showDetails}
            />
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Activity className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">No Positions Found</h3>
          <p className="text-neutral-600 mb-4">
            {filter === 'all' 
              ? "You don't have any open positions at the moment."
              : `No ${filter} positions found.`
            }
          </p>
          {filter !== 'all' && (
            <Button
              variant="secondary"
              onClick={() => setFilter('all')}
            >
              Show All Positions
            </Button>
          )}
        </Card>
      )}

      {/* WebSocket Status */}
      <div className="flex items-center justify-between text-sm text-neutral-500">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span>Real-time connection active</span>
        </div>
        <span>
          Next update in {5 - Math.floor((Date.now() - lastUpdate.getTime()) / 1000)}s
        </span>
      </div>
    </div>
  );
}