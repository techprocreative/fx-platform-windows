"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Server,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  Send,
  AlertCircle,
  Play,
  Pause,
  StopCircle,
  RefreshCw,
} from "lucide-react";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { CardError } from "@/components/ui/ErrorMessage";
import { PositionManagementPanel } from "@/components/positions/PositionManagementPanel";
import Pusher from 'pusher-js';

interface Executor {
  id: string;
  name: string;
  platform: string;
  status: string;
  lastHeartbeat: string | null;
  isConnected: boolean;
  brokerServer?: string | null;
  accountNumber?: string | null;
  createdAt: string;
  _count?: {
    trades: number;
    commands: number;
  };
}

interface Trade {
  id: string;
  symbol: string;
  type: string;
  lots: number;
  openPrice: number;
  closePrice: number | null;
  profit: number | null;
  openTime: string;
  closeTime: string | null;
  strategy: {
    id: string;
    name: string;
  };
}

interface Command {
  id: string;
  command: string;
  parameters: any;
  priority: string;
  status: string;
  createdAt: string;
  executedAt: string | null;
  acknowledgedAt: string | null;
}

export default function ExecutorDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [executor, setExecutor] = useState<Executor | null>(null);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [recentCommands, setRecentCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [sendingCommand, setSendingCommand] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState<string>("");
  const [positions, setPositions] = useState<any[]>([]);
  const [positionSummary, setPositionSummary] = useState<any>({
    total: 0,
    profitable: 0,
    losing: 0,
    totalProfit: 0,
    totalVolume: 0,
    byStrategy: [],
    bySymbol: []
  });
  const [strategies, setStrategies] = useState<any[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status === "authenticated") {
      fetchExecutorDetails();

      // Auto-refresh every 10 seconds
      const interval = setInterval(fetchExecutorDetails, 10000);
      return () => clearInterval(interval);
    }
    // Return undefined for loading state
    return undefined;
  }, [status, router, params.id]);

  // Pusher position updates  
  useEffect(() => {
    if (!executor || !process.env.NEXT_PUBLIC_PUSHER_KEY) return;

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap1',
    });

    const channel = pusher.subscribe('private-executor');

    channel.bind('client-position-update', (data: any) => {
      console.log('Position update received:', data);
      if (data.positions) setPositions(data.positions);
      if (data.summary) setPositionSummary(data.summary);
    });

    return () => {
      channel.unbind('client-position-update');
      pusher.unsubscribe('private-executor');
      pusher.disconnect();
    };
  }, [executor]);

  const fetchExecutorDetails = async () => {
    try {
      setError(null);
      const response = await fetch(`/api/executor/${params.id}`);

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to fetch executor details");
      }

      const data = await response.json();
      setExecutor(data.executor);
      setRecentTrades(data.recentTrades || []);
      setRecentCommands(data.recentCommands || []);
      
      // Fetch strategies for position management
      const strategiesResponse = await fetch('/api/strategies');
      if (strategiesResponse.ok) {
        const strategiesData = await strategiesResponse.json();
        setStrategies(strategiesData.strategies || []);
      }
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error("Failed to load executor");
      setError(err);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStrategies = async () => {
    try {
      const response = await fetch('/api/strategies');
      if (response.ok) {
        const data = await response.json();
        setStrategies(data.strategies || []);
      }
    } catch (error) {
      console.error('Failed to fetch strategies:', error);
    }
  };

  const handleSendCommand = async () => {
    if (!selectedCommand) {
      toast.error("Please select a command");
      return;
    }

    setSendingCommand(true);
    try {
      const response = await fetch(`/api/executor/${params.id}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: selectedCommand,
          priority: "NORMAL",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send command");
      }

      toast.success(data.message || "Command sent successfully");
      setSelectedCommand("");
      fetchExecutorDetails();
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error("Failed to send command");
      toast.error(err.message);
    } finally {
      setSendingCommand(false);
    }
  };

  const getStatusIcon = (isConnected: boolean) => {
    if (isConnected) {
      return <CheckCircle2 className="h-6 w-6 text-green-500" />;
    }
    return <XCircle className="h-6 w-6 text-red-500" />;
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      online: "bg-green-100 text-green-800",
      offline: "bg-red-100 text-red-800",
      error: "bg-yellow-100 text-yellow-800",
    };
    return (
      <span
        className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status as keyof typeof styles] || styles.offline}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getCommandStatusBadge = (status: string) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-800",
      executed: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
    };
    return (
      <span
        className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status as keyof typeof styles] || "bg-gray-100 text-gray-800"}`}
      >
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !executor) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/executors"
          className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Executors
        </Link>
        <CardError
          error={error || new Error("Executor not found")}
          retry={fetchExecutorDetails}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/executors"
          className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Executors
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="mt-1">{getStatusIcon(executor.isConnected)}</div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-neutral-900">
                  {executor.name}
                </h1>
                <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-sm rounded-full font-medium">
                  {executor.platform}
                </span>
                {getStatusBadge(executor.status)}
              </div>
              <p className="text-neutral-600">
                {executor.isConnected
                  ? "Connected and ready"
                  : "Disconnected - waiting for heartbeat"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-600 mb-1">Status</p>
          <p className="text-xl font-bold text-neutral-900 capitalize">
            {executor.status}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-600 mb-1">Total Trades</p>
          <p className="text-xl font-bold text-neutral-900">
            {executor._count?.trades || 0}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-600 mb-1">Commands Sent</p>
          <p className="text-xl font-bold text-neutral-900">
            {executor._count?.commands || 0}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-600 mb-1">Last Heartbeat</p>
          <p className="text-sm font-semibold text-neutral-900">
            {executor.lastHeartbeat
              ? new Date(executor.lastHeartbeat).toLocaleString()
              : "Never"}
          </p>
        </div>
      </div>

      {/* Connection Warning */}
      {!executor.isConnected && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-yellow-900 mb-1">
              Executor Offline
            </h4>
            <p className="text-sm text-yellow-700">
              This executor hasn't sent a heartbeat in the last 5 minutes. Make
              sure the executor application is running and has a valid internet
              connection.
            </p>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Executor Details */}
        <div className="rounded-lg border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
            <Server className="h-5 w-5" />
            Executor Details
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-neutral-100">
              <span className="text-neutral-600">Executor ID</span>
              <span className="font-medium text-neutral-900">
                {executor.id}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-neutral-100">
              <span className="text-neutral-600">Platform</span>
              <span className="font-medium text-neutral-900">
                {executor.platform}
              </span>
            </div>
            {executor.brokerServer && (
              <div className="flex justify-between py-2 border-b border-neutral-100">
                <span className="text-neutral-600">Broker Server</span>
                <span className="font-medium text-neutral-900">
                  {executor.brokerServer}
                </span>
              </div>
            )}
            {executor.accountNumber && (
              <div className="flex justify-between py-2 border-b border-neutral-100">
                <span className="text-neutral-600">Account Number</span>
                <span className="font-medium text-neutral-900">
                  {executor.accountNumber}
                </span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-neutral-100">
              <span className="text-neutral-600">Created At</span>
              <span className="font-medium text-neutral-900">
                {new Date(executor.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Send Command */}
        <div className="rounded-lg border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Command
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Command Type
              </label>
              <select
                value={selectedCommand}
                onChange={(e) => setSelectedCommand(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="">Select a command...</option>
                <option value="GET_STATUS">Get Status</option>
                <option value="PAUSE">Pause Trading</option>
                <option value="RESUME">Resume Trading</option>
                <option value="STOP_ALL">Stop All</option>
                <option value="CLOSE_ALL_POSITIONS">Close All Positions</option>
                <option value="RESTART">Restart Executor</option>
              </select>
            </div>
            <button
              onClick={handleSendCommand}
              disabled={
                !selectedCommand || sendingCommand || !executor.isConnected
              }
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-white font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingCommand ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Command
                </>
              )}
            </button>
            {!executor.isConnected && (
              <p className="text-xs text-red-600">
                Executor must be online to send commands
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Commands */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Commands
        </h2>
        {recentCommands.length === 0 ? (
          <p className="text-center text-neutral-600 py-8">
            No commands sent yet
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">
                    Command
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">
                    Priority
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">
                    Created At
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">
                    Executed At
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentCommands.map((command) => (
                  <tr
                    key={command.id}
                    className="border-b border-neutral-100 hover:bg-neutral-50"
                  >
                    <td className="py-3 px-4 font-medium text-neutral-900">
                      {command.command}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">
                        {command.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {getCommandStatusBadge(command.status)}
                    </td>
                    <td className="py-3 px-4 text-neutral-600">
                      {new Date(command.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-neutral-600">
                      {command.executedAt
                        ? new Date(command.executedAt).toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Position Management */}
      {executor?.isConnected && (
        <div className="mb-6">
          <PositionManagementPanel
            executorId={params.id}
            positions={positions}
            summary={positionSummary}
            strategies={strategies}
            onCommandSent={fetchExecutorDetails}
          />
        </div>
      )}

      {/* Recent Trades */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Trades
        </h2>
        {recentTrades.length === 0 ? (
          <p className="text-center text-neutral-600 py-8">
            No trades executed yet
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">
                    Symbol
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">
                    Type
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">
                    Strategy
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-neutral-600">
                    Lots
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-neutral-600">
                    Open Price
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-neutral-600">
                    Close Price
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-neutral-600">
                    Profit
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentTrades.map((trade) => (
                  <tr
                    key={trade.id}
                    className="border-b border-neutral-100 hover:bg-neutral-50"
                  >
                    <td className="py-3 px-4 font-medium text-neutral-900">
                      {trade.symbol}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          trade.type === "BUY"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {trade.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-neutral-600">
                      <Link
                        href={`/dashboard/strategies/${trade.strategy.id}`}
                        className="text-primary-600 hover:text-primary-700"
                      >
                        {trade.strategy.name}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-right text-neutral-900">
                      {trade.lots}
                    </td>
                    <td className="py-3 px-4 text-right text-neutral-900">
                      {trade.openPrice.toFixed(5)}
                    </td>
                    <td className="py-3 px-4 text-right text-neutral-900">
                      {trade.closePrice ? trade.closePrice.toFixed(5) : "Open"}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-semibold ${
                        (trade.profit || 0) >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {trade.profit ? `$${trade.profit.toFixed(2)}` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
