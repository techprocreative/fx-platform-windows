'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Clock,
  Zap,
} from 'lucide-react';

interface ExecutorStatus {
  id: string;
  name: string;
  platform: string;
  isOnline: boolean;
  lastHeartbeat: string | null;
  activePositions: number;
  pendingCommands: number;
}

interface RecentExecution {
  id: string;
  timestamp: string;
  executorId: string;
  command: string;
  success: boolean;
  result?: any;
}

export default function MonitorPage() {
  const { data: session, status } = useSession();
  const [executors, setExecutors] = useState<ExecutorStatus[]>([]);
  const [executions, setExecutions] = useState<RecentExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [pusherConnected, setPusherConnected] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
      return;
    }
    if (status === 'authenticated') {
      fetchStatus();
      setupPusher();
      
      const interval = setInterval(fetchStatus, 30000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [status]);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/ws');
      if (response.ok) {
        const data = await response.json();
        const executorsWithStatus = data.executors.map((exec: any) => ({
          id: exec.id,
          name: exec.name,
          platform: exec.platform,
          isOnline: exec.isConnected,
          lastHeartbeat: exec.lastHeartbeat,
          activePositions: 0,
          pendingCommands: 0,
        }));
        setExecutors(executorsWithStatus);
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupPusher = async () => {
    if (!session?.user?.id) return;

    try {
      const Pusher = (await import('pusher-js')).default;
      const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
        forceTLS: true,
      });

      pusher.connection.bind('connected', () => {
        setPusherConnected(true);
      });

      pusher.connection.bind('disconnected', () => {
        setPusherConnected(false);
      });

      const channel = pusher.subscribe(`private-user-${session.user.id}`);
      
      channel.bind('execution-result', (data: any) => {
        setExecutions(prev => [
          {
            id: data.commandId,
            timestamp: new Date().toISOString(),
            executorId: data.executorId,
            command: data.command,
            success: data.success,
            result: data.result,
          },
          ...prev.slice(0, 19),
        ]);
        
        if (data.success) {
          toast.success('Trade executed successfully');
        } else {
          toast.error('Trade execution failed');
        }
      });

      const broadcastChannel = pusher.subscribe('executors');
      broadcastChannel.bind('status-update', () => {
        fetchStatus();
      });
    } catch (error) {
      console.error('Pusher setup error:', error);
    }
  };

  const handleEmergencyStop = async () => {
    if (!confirm('⚠️ This will STOP ALL active executors and close positions. Are you sure?')) {
      return;
    }

    try {
      const response = await fetch('/api/commands', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'emergency_stop',
          reason: 'Manual emergency stop from monitor',
        }),
      });

      if (response.ok) {
        toast.success('Emergency stop signal sent to all executors');
        fetchStatus();
      } else {
        toast.error('Failed to send emergency stop');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const totalOnline = executors.filter(e => e.isOnline).length;
  const totalPositions = executors.reduce((sum, e) => sum + e.activePositions, 0);
  const totalCommands = executors.reduce((sum, e) => sum + e.pendingCommands, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-600">Loading monitor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Real-time Monitor</h1>
          <p className="text-neutral-600 mt-1">Live executor status and executions</p>
        </div>
        <button
          onClick={handleEmergencyStop}
          className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-bold"
        >
          <AlertCircle className="h-5 w-5" />
          EMERGENCY STOP
        </button>
      </div>

      {/* Connection Status */}
      <div className="flex items-center gap-2 text-sm">
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${pusherConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-neutral-600">
            Real-time: {pusherConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <span className="text-neutral-300">•</span>
        <span className="text-neutral-600">Auto-refresh: 30s</span>
      </div>

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
          <p className="text-2xl font-bold text-neutral-900">{totalCommands}</p>
        </div>
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Recent Executions</span>
            <Zap className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900">{executions.length}</p>
        </div>
      </div>

      {/* Executor Status Cards */}
      <div>
        <h2 className="text-lg font-bold text-neutral-900 mb-4">Executor Status</h2>
        {executors.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-neutral-200">
            <Activity className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-neutral-900 mb-2">No executors configured</h3>
            <p className="text-neutral-600">Add an executor to start monitoring</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {executors.map((executor) => (
              <div
                key={executor.id}
                className={`bg-white rounded-lg border-2 p-4 transition-all ${
                  executor.isOnline 
                    ? 'border-green-200 shadow-sm' 
                    : 'border-neutral-200'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {executor.isOnline ? (
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-500" />
                    )}
                    <div>
                      <h3 className="font-bold text-neutral-900">{executor.name}</h3>
                      <span className="text-xs text-neutral-600">{executor.platform}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    executor.isOnline 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {executor.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Active Positions:</span>
                    <span className="font-medium text-neutral-900">{executor.activePositions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Pending Commands:</span>
                    <span className="font-medium text-neutral-900">{executor.pendingCommands}</span>
                  </div>
                  {executor.lastHeartbeat && (
                    <div className="flex justify-between text-xs text-neutral-500">
                      <span>Last seen:</span>
                      <span>{new Date(executor.lastHeartbeat).toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Executions */}
      <div>
        <h2 className="text-lg font-bold text-neutral-900 mb-4">Recent Executions</h2>
        {executions.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-lg border border-neutral-200">
            <p className="text-neutral-600">No executions yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              {executions.map((execution) => (
                <div
                  key={execution.id}
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
                          {execution.command || 'Trade Command'}
                        </p>
                        <p className="text-xs text-neutral-600">
                          Executor: {execution.executorId}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-neutral-500">
                      {new Date(execution.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
