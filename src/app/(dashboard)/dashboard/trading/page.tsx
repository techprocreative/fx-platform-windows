'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { TradingPanel } from '@/components/trading/trading-panel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity,
  Clock,
  BarChart3,
  Settings,
  AlertTriangle
} from 'lucide-react';
import { TradeParams, AccountInfo, SymbolInfo } from '@/lib/risk/types';

export default function TradingPage() {
  const { data: session, status } = useSession();
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [symbolInfo, setSymbolInfo] = useState<SymbolInfo | null>(null);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [marketStatus, setMarketStatus] = useState<'open' | 'closed'>('open');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    if (status === 'authenticated') {
      fetchAccountInfo();
      fetchRecentTrades();
      checkMarketStatus();
    }
  }, [status]);

  const fetchAccountInfo = async () => {
    try {
      // Mock data for now - in production this would fetch from API
      const mockAccountInfo: AccountInfo = {
        balance: 10000,
        equity: 10250,
        margin: 500,
        freeMargin: 9750,
        marginLevel: 2050,
        leverage: 100
      };

      const mockSymbolInfo: SymbolInfo = {
        symbol: 'EURUSD',
        point: 0.00001,
        contractSize: 100000,
        minLot: 0.01,
        maxLot: 1.0,
        lotStep: 0.01,
        digits: 5,
        spread: 2,
        tradeAllowed: true
      };

      setAccountInfo(mockAccountInfo);
      setSymbolInfo(mockSymbolInfo);
    } catch (error) {
      console.error('Failed to fetch account info:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentTrades = async () => {
    try {
      // Mock data for now
      const mockTrades = [
        {
          id: 'trade_001',
          symbol: 'EURUSD',
          type: 'BUY',
          volume: 0.1,
          openPrice: 1.0850,
          closePrice: 1.0875,
          profit: 25.00,
          status: 'closed',
          openTime: new Date(Date.now() - 3600000),
          closeTime: new Date(Date.now() - 1800000)
        },
        {
          id: 'trade_002',
          symbol: 'GBPUSD',
          type: 'SELL',
          volume: 0.05,
          openPrice: 1.2750,
          closePrice: 1.2730,
          profit: 10.00,
          status: 'closed',
          openTime: new Date(Date.now() - 7200000),
          closeTime: new Date(Date.now() - 5400000)
        },
        {
          id: 'trade_003',
          symbol: 'USDJPY',
          type: 'BUY',
          volume: 0.2,
          openPrice: 150.50,
          closePrice: null,
          profit: -15.00,
          status: 'open',
          openTime: new Date(Date.now() - 1800000),
          closeTime: null
        }
      ];

      setRecentTrades(mockTrades);
    } catch (error) {
      console.error('Failed to fetch recent trades:', error);
    }
  };

  const checkMarketStatus = () => {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    
    // Simple market hours check (Forex market)
    // Weekend check
    if (day === 0 || day === 6) {
      setMarketStatus('closed');
      return;
    }
    
    // Check if within market hours (simplified)
    if (hour >= 22 || hour < 0) {
      setMarketStatus('closed');
    } else {
      setMarketStatus('open');
    }
  };

  const handleTrade = async (params: TradeParams) => {
    try {
      // In production, this would call the API to execute the trade
      console.log('Executing trade:', params);
      
      // Add to recent trades
      const newTrade = {
        id: `trade_${Date.now()}`,
        symbol: params.symbol,
        type: params.type,
        volume: params.lotSize,
        openPrice: params.entryPrice,
        closePrice: null,
        profit: 0,
        status: 'open',
        openTime: new Date(),
        closeTime: null
      };
      
      setRecentTrades(prev => [newTrade, ...prev.slice(0, 9)]);
      
      // Update account info (mock)
      if (accountInfo) {
        setAccountInfo({
          ...accountInfo,
          margin: accountInfo.margin + (params.lotSize * 1000), // Simplified margin calculation
          freeMargin: accountInfo.freeMargin - (params.lotSize * 1000)
        });
      }
    } catch (error) {
      console.error('Trade execution failed:', error);
      throw error;
    }
  };

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
          <h1 className="text-3xl font-bold text-neutral-900">Trading</h1>
          <p className="text-neutral-600 mt-1">
            One-click trading with advanced risk management
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
            marketStatus === 'open' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              marketStatus === 'open' ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span className="text-sm font-medium">
              Market {marketStatus === 'open' ? 'Open' : 'Closed'}
            </span>
          </div>
          
          <Button variant="secondary" size="sm">
            <Settings className="h-4 w-4 mr-1" />
            Settings
          </Button>
        </div>
      </div>

      {/* Market Status Alert */}
      {marketStatus === 'closed' && (
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <h3 className="font-semibold text-amber-900">Market Closed</h3>
              <p className="text-sm text-amber-800">
                The forex market is currently closed. Trading will be available when the market opens.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trading Panel */}
        <div className="lg:col-span-2">
          <TradingPanel
            accountInfo={accountInfo || undefined}
            symbolInfo={symbolInfo || undefined}
            onTrade={handleTrade}
          />
        </div>

        {/* Recent Activity */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card className="p-4">
            <h3 className="font-semibold text-neutral-900 mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Quick Stats
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-neutral-600">Balance</span>
                <span className="font-medium">${accountInfo?.balance.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-600">Equity</span>
                <span className="font-medium">${accountInfo?.equity.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-600">Free Margin</span>
                <span className="font-medium">${accountInfo?.freeMargin.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-600">Margin Level</span>
                <span className="font-medium">{accountInfo?.marginLevel.toFixed(0) || '0'}%</span>
              </div>
            </div>
          </Card>

          {/* Recent Trades */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Trades
              </h3>
              <Button variant="secondary" size="sm">
                <BarChart3 className="h-4 w-4" />
              </Button>
            </div>
            
            {recentTrades.length > 0 ? (
              <div className="space-y-2">
                {recentTrades.map((trade) => (
                  <div key={trade.id} className="border-b border-neutral-100 pb-2 last:border-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{trade.symbol}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          trade.type === 'BUY' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {trade.type}
                        </span>
                      </div>
                      <span className={`text-sm font-medium ${
                        trade.profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ${trade.profit.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                      <span>{trade.volume} lots @ {trade.openPrice.toFixed(5)}</span>
                      <span>{trade.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500 text-center py-4">
                No recent trades
              </p>
            )}
          </Card>

          {/* Market Sentiment */}
          <Card className="p-4">
            <h3 className="font-semibold text-neutral-900 mb-3">Market Sentiment</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>EUR/USD</span>
                  <span className="text-green-600">65% BUY</span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: '65%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>GBP/USD</span>
                  <span className="text-red-600">42% BUY</span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: '42%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>USD/JPY</span>
                  <span className="text-green-600">78% BUY</span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: '78%' }} />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}