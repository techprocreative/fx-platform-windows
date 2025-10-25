/**
 * Simple Dashboard for Windows Executor
 * Focused on essential information only
 * Full dashboard is on web platform
 */

import { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/app.store';
import { StatusIndicator } from '../../components/StatusIndicator';
import { RefreshCcw, Activity, TrendingUp, AlertCircle } from 'lucide-react';
import type { ElectronAPI } from '../../types/window';

// Extend window interface
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export function DashboardSimple() {
  const { 
    connectionStatus,
    config,
    isConfigured,
    performanceMetrics,
    recentActivity
  } = useAppStore();

  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [recentSignals, setRecentSignals] = useState<any[]>([]);
  const [activeStrategies, setActiveStrategies] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Load data
  useEffect(() => {
    loadDashboardData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadDashboardData();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      // Get MT5 account info
      const account = await window.electronAPI?.getMT5AccountInfo?.();
      if (account) {
        setAccountInfo(account);
      }

      // Get system health
      const health = await window.electronAPI?.getSystemHealth?.();
      if (health) {
        setSystemHealth(health);
      }

      // Get recent signals
      const signals = await window.electronAPI?.getRecentSignals?.(10);
      if (signals) {
        setRecentSignals(signals);
      }

      // Get active strategies
      const strategies = await window.electronAPI?.getActiveStrategies?.();
      if (strategies) {
        setActiveStrategies(strategies);
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error('[Dashboard] Failed to load data:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setTimeout(() => setRefreshing(false), 500);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="h-full overflow-auto bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Windows Executor</h1>
            <p className="text-sm text-gray-600">
              Monitoring • Last updated: {formatTime(lastUpdate)}
            </p>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCcw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Connection & Account Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          
          {/* Web Platform Connection */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Web Platform</span>
              <StatusIndicator 
                status={connectionStatus.pusher === 'connected' ? 'online' : 'offline'}
                size="sm"
              />
            </div>
            <div className="text-xs text-gray-500">
              {connectionStatus.pusher === 'connected' ? 'Connected' : 'Disconnected'}
            </div>
          </div>

          {/* MT5 Connection */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">MT5 Terminal</span>
              <StatusIndicator 
                status={connectionStatus.mt5 === 'connected' ? 'online' : 'offline'}
                size="sm"
              />
            </div>
            <div className="text-xs text-gray-500">
              {connectionStatus.mt5 === 'connected' ? 'Connected' : 'Disconnected'}
            </div>
          </div>

          {/* Balance */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm font-medium text-gray-600 mb-1">Balance</div>
            <div className="text-lg font-bold text-gray-900">
              {accountInfo ? formatCurrency(accountInfo.balance) : '---'}
            </div>
            <div className="text-xs text-gray-500">
              Equity: {accountInfo ? formatCurrency(accountInfo.equity) : '---'}
            </div>
          </div>

          {/* Open Positions */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm font-medium text-gray-600 mb-1">Positions</div>
            <div className="text-lg font-bold text-gray-900">
              {accountInfo?.openPositions || 0}
            </div>
            <div className="text-xs text-gray-500">
              Active now
            </div>
          </div>

        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column - Active Strategies & Signals */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Active Strategies */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center">
                  <Activity className="h-4 w-4 mr-2 text-blue-500" />
                  Active Strategies
                </h2>
                <span className="text-xs text-gray-500">
                  {activeStrategies.length} running
                </span>
              </div>
              
              <div className="p-4">
                {activeStrategies.length > 0 ? (
                  <div className="space-y-2">
                    {activeStrategies.slice(0, 5).map((strategy: any) => (
                      <div 
                        key={strategy.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition"
                      >
                        <div className="flex items-center space-x-3">
                          <StatusIndicator 
                            status={strategy.status === 'active' ? 'online' : 'warning'}
                            size="sm"
                          />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {strategy.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {strategy.symbols?.slice(0, 3).join(', ') || 'No symbols'}
                              {strategy.symbols?.length > 3 && ` +${strategy.symbols.length - 3}`}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-medium text-gray-700">
                            {strategy.timeframe || 'M15'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No active strategies</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Signals */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2 text-green-500" />
                  Recent Signals
                </h2>
                <span className="text-xs text-gray-500">Last 10</span>
              </div>
              
              <div className="p-4">
                {recentSignals.length > 0 ? (
                  <div className="space-y-2">
                    {recentSignals.slice(0, 10).map((signal: any, idx: number) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between p-2 border-b border-gray-100 last:border-0"
                      >
                        <div className="flex items-center space-x-3">
                          <span className={`px-2 py-1 text-xs font-bold rounded ${
                            signal.type === 'BUY' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {signal.type}
                          </span>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {signal.symbol}
                            </div>
                            <div className="text-xs text-gray-500">
                              @ {signal.price?.toFixed(5)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-600">
                            {formatTime(signal.timestamp)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {signal.confidence}% conf
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No recent signals</p>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right Column - Performance & Alerts */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Performance Metrics */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">Performance</h2>
              </div>
              <div className="p-4 space-y-3">
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Today P&L</span>
                  <span className={`text-sm font-bold ${
                    performanceMetrics.dailyPnL >= 0 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    {performanceMetrics.dailyPnL >= 0 ? '+' : ''}
                    {formatCurrency(performanceMetrics.dailyPnL)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Win Rate</span>
                  <span className="text-sm font-medium text-gray-900">
                    {performanceMetrics.winRate.toFixed(1)}%
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Trades</span>
                  <span className="text-sm font-medium text-gray-900">
                    {performanceMetrics.totalTrades}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Profit Factor</span>
                  <span className="text-sm font-medium text-gray-900">
                    {performanceMetrics.profitFactor.toFixed(2)}
                  </span>
                </div>

                <div className="pt-3 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Margin Level</span>
                    <span className={`text-sm font-bold ${
                      (accountInfo?.marginLevel || 0) > 200 
                        ? 'text-green-600' 
                        : (accountInfo?.marginLevel || 0) > 100 
                        ? 'text-yellow-600' 
                        : 'text-red-600'
                    }`}>
                      {accountInfo?.marginLevel?.toFixed(0) || 0}%
                    </span>
                  </div>
                </div>

              </div>
            </div>

            {/* System Health */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2 text-blue-500" />
                  System Health
                </h2>
                <StatusIndicator 
                  status={systemHealth?.healthy ? 'online' : 'warning'}
                  size="sm"
                />
              </div>
              <div className="p-4 space-y-2">
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Evaluations/min</span>
                  <span className="text-sm font-medium text-gray-900">
                    {systemHealth?.evaluationsPerMinute?.toFixed(1) || '0.0'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Avg Response</span>
                  <span className="text-sm font-medium text-gray-900">
                    {systemHealth?.avgEvaluationTime?.toFixed(0) || '0'}ms
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Cache Hit Rate</span>
                  <span className="text-sm font-medium text-gray-900">
                    {systemHealth?.cacheHitRate?.toFixed(0) || '0'}%
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Memory Usage</span>
                  <span className="text-sm font-medium text-gray-900">
                    {systemHealth?.memoryUsage?.toFixed(0) || '0'}MB
                  </span>
                </div>

                {systemHealth?.issues && systemHealth.issues.length > 0 && (
                  <div className="pt-3 border-t border-gray-200">
                    <div className="space-y-1">
                      {systemHealth.issues.map((issue: string, idx: number) => (
                        <div key={idx} className="flex items-start text-xs text-yellow-700">
                          <AlertCircle className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                          <span>{issue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
              </div>
              <div className="p-4">
                {recentActivity.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {recentActivity.slice(0, 10).map((activity: any) => (
                      <div key={activity.id} className="text-xs">
                        <div className="flex items-start space-x-2">
                          <span className={`inline-block w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                            activity.type === 'ERROR' ? 'bg-red-500' :
                            activity.type === 'INFO' ? 'bg-blue-500' :
                            'bg-green-500'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-700 truncate">{activity.message}</p>
                            <p className="text-gray-400">{formatTime(activity.timestamp)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-400">
                    <p className="text-sm">No recent activity</p>
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* Footer Info */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4 text-gray-600">
              <span>Executor ID: <span className="font-mono text-gray-900">{config?.executorId || 'N/A'}</span></span>
              <span className="text-gray-300">|</span>
              <span>Platform: <span className="font-medium text-gray-900">{config?.platformUrl || 'N/A'}</span></span>
            </div>
            <div className="text-gray-600">
              <span className="text-blue-600 font-medium">Full Dashboard</span> available on web platform
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
