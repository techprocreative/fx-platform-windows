'use client';

import { useEffect, useState, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RealTimePerformanceData, PerformanceAlert, MarketStatus } from '@/types';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Clock,
  DollarSign,
  Target,
  Eye,
  RefreshCw,
  Bell,
  Globe
} from 'lucide-react';

interface RealTimeMonitoringProps {
  className?: string;
  onAlert?: (alert: PerformanceAlert) => void;
}

export function RealTimeMonitoring({ 
  className = '',
  onAlert 
}: RealTimeMonitoringProps) {
  const [data, setData] = useState<RealTimePerformanceData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [showAlerts, setShowAlerts] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Simulate real-time data updates
  useEffect(() => {
    const fetchRealTimeData = async () => {
      try {
        // In a real implementation, this would be a WebSocket connection
        // For now, we'll simulate with API calls
        const response = await fetch('/api/analytics/realtime');
        if (response.ok) {
          const realTimeData = await response.json();
          setData(realTimeData);
          setLastUpdate(new Date());
          setIsConnected(true);
          
          // Process new alerts
          if (realTimeData.alerts && realTimeData.alerts.length > 0) {
            const newAlerts = realTimeData.alerts.filter(
              (alert: PerformanceAlert) => !alerts.some(existingAlert => existingAlert.id === alert.id)
            );
            
            if (newAlerts.length > 0) {
              setAlerts(prev => [...newAlerts, ...prev]);
              
              // Notify parent component of new alerts
              newAlerts.forEach((alert: PerformanceAlert) => {
                if (onAlert) onAlert(alert);
              });
            }
          }
        } else {
          setIsConnected(false);
        }
      } catch (error) {
        console.error('Failed to fetch real-time data:', error);
        setIsConnected(false);
        
        // Generate mock data for demonstration
        generateMockData();
      }
    };

    // Initial fetch
    fetchRealTimeData();
    
    // Set up interval for real-time updates
    intervalRef.current = setInterval(fetchRealTimeData, 5000); // Update every 5 seconds
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [alerts, onAlert]);

  const generateMockData = () => {
    const mockData: RealTimePerformanceData = {
      timestamp: new Date(),
      currentEquity: 10500 + Math.random() * 1000,
      dailyPnL: -200 + Math.random() * 500,
      dailyDrawdown: Math.random() * 5,
      openPositions: generateMockPositions(),
      closedTradesToday: generateMockTrades(),
      activeStrategies: ['MA Cross', 'RSI Mean Reversion', 'Breakout'],
      marketStatus: {
        session: 'london',
        isOpen: true,
        volatility: 'normal',
        spread: 1.2,
        nextOpen: new Date(),
        nextClose: new Date()
      },
      alerts: Math.random() > 0.7 ? [generateMockAlert()] : []
    };
    
    setData(mockData);
    setLastUpdate(new Date());
    setIsConnected(true);
  };

  const generateMockPositions = () => {
    const symbols = ['EURUSD', 'GBPUSD', 'USDJPY'];
    const positions = [];
    
    for (let i = 0; i < Math.floor(Math.random() * 5); i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const direction: 'BUY' | 'SELL' = Math.random() > 0.5 ? 'BUY' : 'SELL';
      const entryPrice = 1.1 + Math.random() * 0.2;
      const currentPrice = entryPrice + (Math.random() - 0.5) * 0.01;
      const volume = 0.1 + Math.random() * 0.5;
      
      positions.push({
        tradeId: `pos_${i}`,
        strategyId: 'strategy_1',
        symbol,
        direction,
        entryPrice,
        currentPrice,
        volume,
        unrealizedPnL: (currentPrice - entryPrice) * volume * 100000 * (direction === 'BUY' ? 1 : -1),
        unrealizedPnLPercent: ((currentPrice - entryPrice) / entryPrice) * 100 * (direction === 'BUY' ? 1 : -1),
        duration: Math.floor(Math.random() * 240), // minutes
        stopLoss: entryPrice - 0.01 * (direction === 'BUY' ? 1 : -1),
        takeProfit: entryPrice + 0.02 * (direction === 'BUY' ? 1 : -1)
      });
    }
    
    return positions;
  };

  const generateMockTrades = () => {
    const symbols = ['EURUSD', 'GBPUSD', 'USDJPY'];
    const trades = [];
    
    for (let i = 0; i < Math.floor(Math.random() * 10); i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const direction: 'BUY' | 'SELL' = Math.random() > 0.5 ? 'BUY' : 'SELL';
      const entryPrice = 1.1 + Math.random() * 0.2;
      const exitPrice = entryPrice + (Math.random() - 0.5) * 0.01;
      const volume = 0.1 + Math.random() * 0.5;
      
      trades.push({
        tradeId: `trade_${i}`,
        strategyId: 'strategy_1',
        symbol,
        direction,
        entryPrice,
        exitPrice,
        volume,
        profit: (exitPrice - entryPrice) * volume * 100000 * (direction === 'BUY' ? 1 : -1),
        profitPercent: ((exitPrice - entryPrice) / entryPrice) * 100 * (direction === 'BUY' ? 1 : -1),
        duration: Math.floor(Math.random() * 240), // minutes
        entryTime: new Date(Date.now() - Math.random() * 86400000), // within last day
        exitTime: new Date()
      });
    }
    
    return trades;
  };

  const generateMockAlert = (): PerformanceAlert => {
    const alertTypes: PerformanceAlert['type'][] = [
      'drawdown', 'win_rate', 'profit_factor', 'sharpe_ratio', 
      'daily_loss', 'consecutive_losses', 'position_size', 'margin_call'
    ];
    
    const type = alertTypes[Math.floor(Math.random() * alertTypes.length)];
    const severityValues: PerformanceAlert['severity'][] = ['low', 'medium', 'high', 'critical'];
    const severity = severityValues[Math.floor(Math.random() * severityValues.length)];
    
    return {
      id: `alert_${Date.now()}`,
      type,
      severity,
      title: `${type.replace('_', ' ').charAt(0).toUpperCase() + type.replace('_', ' ').slice(1)} Alert`,
      message: `This is a mock ${type} alert with ${severity} severity`,
      currentValue: Math.random() * 100,
      threshold: 50,
      triggeredAt: new Date(),
      acknowledged: false
    };
  };

  const acknowledgeAlert = (alertId: string) => {
    setAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, acknowledged: true, acknowledgedAt: new Date() }
          : alert
      )
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    }
  };

  const getSeverityColor = (severity: PerformanceAlert['severity']) => {
    switch (severity) {
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (!data) {
    return (
      <div className={`flex items-center justify-center h-64 bg-neutral-50 rounded-lg border border-neutral-200 ${className}`}>
        <div className="text-center">
          <Activity className="h-12 w-12 text-neutral-400 mx-auto mb-4 animate-pulse" />
          <p className="text-lg font-semibold text-neutral-900 mb-2">Connecting to Real-time Data</p>
          <p className="text-sm text-neutral-600">Establishing connection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
          <h3 className="text-lg font-semibold text-neutral-900">Real-time Monitoring</h3>
          <span className="text-sm text-neutral-500">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => generateMockData()}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowAlerts(!showAlerts)}
            className="relative"
          >
            <Bell className="h-4 w-4 mr-1" />
            Alerts
            {alerts.filter(a => !a.acknowledged).length > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
            )}
          </Button>
        </div>
      </div>

      {/* Alerts Panel */}
      {showAlerts && alerts.length > 0 && (
        <Card className="p-4">
          <h4 className="font-semibold text-neutral-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Active Alerts ({alerts.filter(a => !a.acknowledged).length})
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {alerts.map(alert => (
              <div 
                key={alert.id} 
                className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)} ${
                  alert.acknowledged ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{alert.title}</p>
                    <p className="text-xs mt-1">{alert.message}</p>
                    <p className="text-xs mt-1">
                      Value: {alert.currentValue.toFixed(2)} / Threshold: {alert.threshold}
                    </p>
                  </div>
                  {!alert.acknowledged && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="ml-2"
                    >
                      Acknowledge
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Market Status */}
      <Card className="p-4">
        <h4 className="font-semibold text-neutral-900 mb-3 flex items-center gap-2">
          <Globe className="h-5 w-5 text-blue-500" />
          Market Status
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className={`text-lg font-bold ${data.marketStatus.isOpen ? 'text-green-600' : 'text-red-600'}`}>
              {data.marketStatus.isOpen ? 'Open' : 'Closed'}
            </div>
            <div className="text-xs text-neutral-600">Market</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600 capitalize">
              {data.marketStatus.session}
            </div>
            <div className="text-xs text-neutral-600">Session</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-bold ${
              data.marketStatus.volatility === 'high' ? 'text-red-600' :
              data.marketStatus.volatility === 'normal' ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {data.marketStatus.volatility}
            </div>
            <div className="text-xs text-neutral-600">Volatility</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-purple-600">
              {data.marketStatus.spread.toFixed(1)}
            </div>
            <div className="text-xs text-neutral-600">Spread (pips)</div>
          </div>
        </div>
      </Card>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Current Equity</span>
            <DollarSign className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900">
            {formatCurrency(data.currentEquity)}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Daily P&L</span>
            {data.dailyPnL >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </div>
          <p className={`text-2xl font-bold ${data.dailyPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(data.dailyPnL)}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Daily Drawdown</span>
            <Target className="h-4 w-4 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-orange-600">
            -{data.dailyDrawdown.toFixed(2)}%
          </p>
        </Card>
      </div>

      {/* Open Positions */}
      <Card className="p-6">
        <h4 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2">
          <Eye className="h-5 w-5 text-blue-500" />
          Open Positions ({data.openPositions.length})
        </h4>
        {data.openPositions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-2 px-4 text-sm font-medium text-neutral-700">Symbol</th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-neutral-700">Direction</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-neutral-700">Entry</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-neutral-700">Current</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-neutral-700">P&L</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-neutral-700">Duration</th>
                </tr>
              </thead>
              <tbody>
                {data.openPositions.map((position, index) => (
                  <tr key={position.tradeId} className="border-b border-neutral-100">
                    <td className="py-3 px-4 font-medium text-neutral-900">{position.symbol}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        position.direction === 'BUY' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {position.direction}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">{position.entryPrice.toFixed(5)}</td>
                    <td className="py-3 px-4 text-right">{position.currentPrice.toFixed(5)}</td>
                    <td className={`py-3 px-4 text-right font-medium ${
                      position.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(position.unrealizedPnL)} ({formatPercent(position.unrealizedPnLPercent)})
                    </td>
                    <td className="py-3 px-4 text-right text-neutral-600">
                      {formatDuration(position.duration)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-neutral-500 text-center py-4">No open positions</p>
        )}
      </Card>

      {/* Today's Closed Trades */}
      <Card className="p-6">
        <h4 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-purple-500" />
          Today's Closed Trades ({data.closedTradesToday.length})
        </h4>
        {data.closedTradesToday.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-2 px-4 text-sm font-medium text-neutral-700">Symbol</th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-neutral-700">Direction</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-neutral-700">Entry</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-neutral-700">Exit</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-neutral-700">P&L</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-neutral-700">Duration</th>
                </tr>
              </thead>
              <tbody>
                {data.closedTradesToday.map((trade, index) => (
                  <tr key={trade.tradeId} className="border-b border-neutral-100">
                    <td className="py-3 px-4 font-medium text-neutral-900">{trade.symbol}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        trade.direction === 'BUY' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {trade.direction}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">{trade.entryPrice.toFixed(5)}</td>
                    <td className="py-3 px-4 text-right">{trade.exitPrice.toFixed(5)}</td>
                    <td className={`py-3 px-4 text-right font-medium ${
                      trade.profit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(trade.profit)} ({formatPercent(trade.profitPercent)})
                    </td>
                    <td className="py-3 px-4 text-right text-neutral-600">
                      {formatDuration(trade.duration)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-neutral-500 text-center py-4">No trades closed today</p>
        )}
      </Card>
    </div>
  );
}