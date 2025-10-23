import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/app.store';
import { StatusIndicator } from '../../components/StatusIndicator';
import { PerformanceCard } from '../../components/PerformanceCard';
import { EmergencyButton } from '../../components/EmergencyButton';
import { ActivityLog } from '../../components/ActivityLog';

export function Dashboard() {
  const { 
    connectionStatus,
    config,
    isTradingEnabled,
    setIsTradingEnabled,
    isEmergencyStopActive,
    performanceMetrics,
    activeStrategies,
    recentActivity,
    addRecentActivity,
    addLog,
    setIsEmergencyStopActive
  } = useAppStore();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Update heartbeat time
      addRecentActivity({
        type: 'INFO',
        message: 'Heartbeat sent - OK',
        metadata: { timestamp: new Date() }
      });
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, [addRecentActivity]);

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Simulate API call to refresh data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      addRecentActivity({
        type: 'INFO',
        message: 'Dashboard data refreshed',
      });
    } catch (error) {
      addLog({
        level: 'error',
        category: 'DASHBOARD',
        message: `Failed to refresh: ${(error as Error).message}`,
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Handle emergency stop
  const handleEmergencyStop = () => {
    setIsEmergencyStopActive(true);
    setIsTradingEnabled(false);
    
    addRecentActivity({
      type: 'ERROR',
      message: '🛑 EMERGENCY STOP ACTIVATED',
    });
    
    addLog({
      level: 'warn',
      category: 'SAFETY',
      message: 'Emergency stop activated by user',
    });
    
    // Reset after 30 seconds
    setTimeout(() => {
      setIsEmergencyStopActive(false);
      addRecentActivity({
        type: 'INFO',
        message: 'Emergency stop deactivated',
      });
    }, 30000);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-600">
              Welcome back! Here's your trading overview.
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Timeframe Selector */}
            <div className="flex bg-white rounded-md shadow-sm">
              {(['1h', '24h', '7d', '30d'] as const).map((timeframe) => (
                <button
                  key={timeframe}
                  onClick={() => setSelectedTimeframe(timeframe)}
                  className={`px-3 py-2 text-sm font-medium rounded-l-md rounded-r-md ${
                    selectedTimeframe === timeframe
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {timeframe}
                </button>
              ))}
            </div>
            
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn btn-secondary"
            >
              {refreshing ? 'Refreshing...' : '🔄 Refresh'}
            </button>
            
            {/* Emergency Stop Button */}
            <EmergencyButton
              onClick={handleEmergencyStop}
              disabled={isEmergencyStopActive}
            />
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {/* Connection Status */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Connection</h3>
              <StatusIndicator 
                status={
                  connectionStatus.pusher === 'connected' && 
                  connectionStatus.mt5 === 'connected' 
                    ? 'online' 
                    : 'offline'
                } 
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Platform</span>
                <StatusIndicator 
                  status={connectionStatus.pusher === 'connected' ? 'online' : 'offline'}
                  size="sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">MT5</span>
                <StatusIndicator 
                  status={connectionStatus.mt5 === 'connected' ? 'online' : 'offline'}
                  size="sm"
                />
              </div>
            </div>
          </div>

          {/* Trading Status */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Trading</h3>
              <div className={`px-2 py-1 text-xs font-medium rounded-full ${
                isTradingEnabled 
                  ? 'bg-success-100 text-success-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {isTradingEnabled ? 'ACTIVE' : 'PAUSED'}
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {activeStrategies.length}
            </div>
            <p className="text-xs text-gray-600">Active Strategies</p>
          </div>

          {/* Daily P&L */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Daily P&L</h3>
              <span className={`text-xs font-medium ${
                performanceMetrics.dailyPnL >= 0 
                  ? 'text-success-600' 
                  : 'text-danger-600'
              }`}>
                {performanceMetrics.dailyPnL >= 0 ? '+' : ''}{performanceMetrics.dailyPnL.toFixed(2)}%
              </span>
            </div>
            <div className={`text-2xl font-bold ${
              performanceMetrics.dailyPnL >= 0 
                ? 'text-success-600' 
                : 'text-danger-600'
            }`}>
              {formatCurrency(performanceMetrics.dailyPnL)}
            </div>
            <p className="text-xs text-gray-600">Today's Performance</p>
          </div>

          {/* Open Positions */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Positions</h3>
              <span className="text-xs font-medium text-gray-600">
                Max: 10
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {Math.floor(Math.random() * 5)} {/* Simulated value */}
            </div>
            <p className="text-xs text-gray-600">Open Positions</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Performance Summary (2 columns) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Performance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PerformanceCard
                title="Win Rate"
                value={`${performanceMetrics.winRate.toFixed(1)}%`}
                subtitle="Last 100 trades"
                trend={Math.random() > 0.5 ? 'up' : 'down'}
                trendValue="2.3%"
              />
              
              <PerformanceCard
                title="Profit Factor"
                value={performanceMetrics.profitFactor.toFixed(2)}
                subtitle="Gross profit / loss"
                trend={Math.random() > 0.5 ? 'up' : 'down'}
                trendValue="0.15"
              />
              
              <PerformanceCard
                title="Total Trades"
                value={performanceMetrics.totalTrades}
                subtitle="All time"
                trend="up"
                trendValue="12"
              />
              
              <PerformanceCard
                title="Max Drawdown"
                value={`${performanceMetrics.maxDrawdown.toFixed(1)}%`}
                subtitle="Worst decline"
                trend={Math.random() > 0.5 ? 'down' : 'up'}
                trendValue="0.5%"
              />
            </div>

            {/* Active Strategies */}
            <div className="card p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Active Strategies</h3>
              
              {activeStrategies.length > 0 ? (
                <div className="space-y-3">
                  {activeStrategies.map((strategy) => (
                    <div key={strategy.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                      <div className="flex items-center space-x-3">
                        <StatusIndicator 
                          status={
                            strategy.status === 'ACTIVE' ? 'online' : 
                            strategy.status === 'PAUSED' ? 'warning' : 'offline'
                          } 
                        />
                        <div>
                          <div className="font-medium text-gray-900">{strategy.name}</div>
                          <div className="text-xs text-gray-500">
                            Pairs: {strategy.pairs.join(', ')}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className={`text-xs font-medium ${
                          strategy.status === 'ACTIVE' 
                            ? 'text-success-600' 
                            : strategy.status === 'PAUSED' 
                            ? 'text-warning-600' 
                            : 'text-gray-600'
                        }`}>
                          {strategy.status}
                        </div>
                        {strategy.lastSignal && (
                          <div className="text-xs text-gray-500">
                            Last: {new Date(strategy.lastSignal).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No active strategies
                </div>
              )}
            </div>
          </div>

          {/* Activity Log (1 column) */}
          <div className="lg:col-span-1">
            <ActivityLog 
              activities={recentActivity}
              maxHeight="600px"
            />
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <div>
              Executor ID: {config?.executorId || 'Not configured'}
            </div>
            <div>
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}