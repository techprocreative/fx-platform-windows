'use client';

import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Activity,
  Clock,
  TrendingUp,
  Zap,
} from 'lucide-react';

import { 
  usePusherConnection, 
  useExecutorStatus, 
  useUserNotifications,
  useEmergencyStop 
} from '@/hooks/usePusher';

interface Executor {
  id: string;
  name: string;
  platform: string;
  status: string;
  lastHeartbeat: string | null;
  isConnected: boolean;
  _count?: {
    trades: number;
    commands: number;
  };
}

interface Props {
  executors: Executor[];
  onRefresh: () => void;
}

export function RealtimeMonitor({ executors, onRefresh }: Props) {
  const [isEmergencyStopLoading, setIsEmergencyStopLoading] = useState(false);
  
  // Pusher hooks
  const { isConnected, connectionState } = usePusherConnection();
  const statusUpdates = useExecutorStatus();
  const { executions, trades } = useUserNotifications();

  // Emergency stop handler
  useEmergencyStop(useCallback(() => {
    toast.error('🚨 Emergency stop triggered!');
    onRefresh();
  }, [onRefresh]));

  // Calculate stats
  const totalOnline = executors.filter((e) => e.isConnected).length;
  const totalPositions = 0; // Will be calculated from actual trade data
  const totalPendingCommands = executors.reduce(
    (sum, e) => sum + (e._count?.commands || 0),
    0
  );

  const handleEmergencyStop = async () => {
    const confirmed = confirm(
      '⚠️ CRITICAL ACTION\n\nThis will immediately:\n• Stop ALL active executors\n• Close ALL open positions\n• Cancel ALL pending commands\n\nThis action cannot be undone!\n\nAre you absolutely sure?'
    );

    if (!confirmed) return;

    setIsEmergencyStopLoading(true);
    try {
      const response = await fetch('/api/executor/emergency-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Manual emergency stop from dashboard',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to trigger emergency stop');
      }

      toast.success(`Emergency stop sent to ${data.executors.length} executor(s)`);
      onRefresh();
    } catch (error) {
      const err = error instanceof Error ? error : new Error('An error occurred');
      toast.error(err.message);
    } finally {
      setIsEmergencyStopLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Emergency Stop Button & Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Pusher Connection Status */}
          <div className="flex items-center gap-2 text-sm">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}
            />
            <span className="text-neutral-600">
              Real-time: {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <span className="text-neutral-300">•</span>
          <span className="text-xs text-neutral-500">
            Status: {connectionState}
          </span>
        </div>

        <button
          onClick={handleEmergencyStop}
          disabled={isEmergencyStopLoading || executors.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-white font-bold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <AlertCircle className="h-5 w-5" />
          {isEmergencyStopLoading ? 'STOPPING...' : 'EMERGENCY STOP'}
        </button>
      </div>

      {/* Not Connected Warning */}
      {!isConnected && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-yellow-900 mb-1">
              Real-time Updates Unavailable
            </h4>
            <p className="text-sm text-yellow-700">
              Pusher connection is not established. You'll see cached data with 30-second
              polling. Real-time command delivery may be delayed.
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Online Executors</span>
            <Activity className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900">
            {totalOnline} / {executors.length}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Active Positions</span>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900">{totalPositions}</p>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Pending Commands</span>
            <Clock className="h-4 w-4 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900">{totalPendingCommands}</p>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Recent Executions</span>
            <Zap className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900">{executions.length}</p>
        </div>
      </div>

      {/* Executor Status Grid */}
      <div>
        <h2 className="text-lg font-bold text-neutral-900 mb-4">Executor Status</h2>
        {executors.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-neutral-200">
            <Activity className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-neutral-900 mb-2">
              No executors configured
            </h3>
            <p className="text-neutral-600">Add an executor to start monitoring</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {executors.map((executor) => (
              <div
                key={executor.id}
                className={`bg-white rounded-lg border-2 p-4 transition-all ${
                  executor.isConnected
                    ? 'border-green-200 shadow-sm'
                    : 'border-neutral-200'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {executor.isConnected ? (
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-500" />
                    )}
                    <div>
                      <h3 className="font-bold text-neutral-900">{executor.name}</h3>
                      <span className="text-xs text-neutral-600">
                        {executor.platform}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      executor.isConnected
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {executor.isConnected ? 'Online' : 'Offline'}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Total Trades:</span>
                    <span className="font-medium text-neutral-900">
                      {executor._count?.trades || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Pending Commands:</span>
                    <span className="font-medium text-neutral-900">
                      {executor._count?.commands || 0}
                    </span>
                  </div>
                  {executor.lastHeartbeat && (
                    <div className="flex justify-between text-xs text-neutral-500 pt-2 border-t border-neutral-100">
                      <span>Last heartbeat:</span>
                      <span>
                        {new Date(executor.lastHeartbeat).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Executions Stream */}
      <div>
        <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Executions
          {isConnected && (
            <span className="text-xs text-green-600 font-normal">(Live)</span>
          )}
        </h2>

        {executions.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-lg border border-neutral-200">
            <p className="text-neutral-600">No executions yet</p>
            <p className="text-xs text-neutral-500 mt-1">
              Execution results will appear here in real-time
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              {executions.map((execution, index) => (
                <div
                  key={index}
                  className="px-4 py-3 border-b border-neutral-200 last:border-b-0 hover:bg-neutral-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {execution.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-neutral-900">
                          {execution.command || 'Command Executed'}
                        </p>
                        <p className="text-xs text-neutral-600">
                          Executor: {execution.executorId.substring(0, 8)}...
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-neutral-500">
                        {new Date(execution.timestamp).toLocaleTimeString()}
                      </span>
                      {execution.result && (
                        <p className="text-xs text-neutral-600 mt-1">
                          {execution.result.message || 'Completed'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent Trades Stream */}
      {trades.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Recent Trades
            {isConnected && (
              <span className="text-xs text-green-600 font-normal">(Live)</span>
            )}
          </h2>

          <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              {trades.map((trade, index) => (
                <div
                  key={index}
                  className="px-4 py-3 border-b border-neutral-200 last:border-b-0 hover:bg-neutral-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          trade.type === 'BUY'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {trade.type}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-neutral-900">
                          {trade.symbol}
                        </p>
                        <p className="text-xs text-neutral-600">
                          {trade.lots} lots @ {trade.price?.toFixed(5)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          trade.event === 'opened'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-neutral-100 text-neutral-800'
                        }`}
                      >
                        {trade.event}
                      </span>
                      {trade.profit !== undefined && (
                        <p
                          className={`text-sm font-semibold mt-1 ${
                            trade.profit >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          ${trade.profit.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
