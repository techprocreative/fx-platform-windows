'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Server,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  Send,
  Eye,
  AlertTriangle,
} from 'lucide-react';

import { LoadingState, TableLoadingState } from '@/components/ui/LoadingState';
import { InlineError } from '@/components/ui/ErrorMessage';
import { useConfirmDialog, confirmDelete } from '@/components/ui/ConfirmDialog';
import { RealtimeMonitor } from '@/components/executors/RealtimeMonitor';

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

interface ExecutorStats {
  total: number;
  online: number;
  offline: number;
  byPlatform: {
    MT5: number;
    MT4: number;
  };
}

export default function ExecutorsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [executors, setExecutors] = useState<Executor[]>([]);
  const [stats, setStats] = useState<ExecutorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [credentials, setCredentials] = useState({ apiKey: '', secretKey: '' });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'monitor'>('overview');
  const [formData, setFormData] = useState({
    name: '',
    platform: 'MT5',
    brokerServer: '',
    accountNumber: '',
  });

  const { confirm, ConfirmDialog } = useConfirmDialog();

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    if (status === 'authenticated') {
      fetchExecutors();
      
      // Auto-refresh every 30 seconds
      const interval = setInterval(fetchExecutors, 30000);
      return () => clearInterval(interval);
    }
  }, [status]);

  const fetchExecutors = async () => {
    try {
      setError(null);
      const response = await fetch('/api/executor');
      if (!response.ok) {
        throw new Error(`Failed to fetch executors: ${response.statusText}`);
      }
      const data = await response.json();
      setExecutors(data.executors || []);
      setStats(data.stats || null);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to load executors');
      setError(err);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/executor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create executor');
      }

      setCredentials({
        apiKey: data.executor.apiKey,
        secretKey: data.executor.secretKey,
      });
      setShowCredentials(true);
      setShowModal(false);
      toast.success('Executor created successfully!');
      fetchExecutors();
      setFormData({ name: '', platform: 'MT5', brokerServer: '', accountNumber: '' });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('An error occurred');
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (executor: Executor) => {
    const confirmed = await confirm(confirmDelete(executor.name));
    if (!confirmed) return;

    setDeletingId(executor.id);
    try {
      const response = await fetch(`/api/executor/${executor.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete executor');
      }

      toast.success('Executor deleted successfully');
      fetchExecutors();
    } catch (error) {
      const err = error instanceof Error ? error : new Error('An error occurred');
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const getStatusIcon = (executor: Executor) => {
    if (executor.isConnected) {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    }
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  const getStatusText = (executor: Executor) => {
    if (executor.isConnected) {
      return <span className="text-green-600 font-medium">Online</span>;
    }
    return <span className="text-red-600 font-medium">Offline</span>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">Executors</h1>
            <p className="text-neutral-600 mt-1">Loading your executors...</p>
          </div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white">
          <TableLoadingState />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">Executors</h1>
            <p className="text-neutral-600 mt-1">Manage your trading executors</p>
          </div>
        </div>
        <InlineError error={error} retry={fetchExecutors} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Executors</h1>
          <p className="text-neutral-600 mt-1">
            {stats ? `${stats.total} executor${stats.total !== 1 ? 's' : ''} • ${stats.online} online` : 'Manage your trading executors'}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-white font-semibold hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Add Executor
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'overview'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
            }`}
          >
            Overview & Management
          </button>
          <button
            onClick={() => setActiveTab('monitor')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'monitor'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
            }`}
          >
            <span className="flex items-center gap-2">
              Real-time Monitor
              {stats && stats.online > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-green-500 rounded-full">
                  {stats.online}
                </span>
              )}
            </span>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Statistics Cards */}
          {stats && stats.total > 0 && (
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-neutral-200 bg-white p-4">
                <p className="text-sm text-neutral-600 mb-1">Total Executors</p>
                <p className="text-2xl font-bold text-neutral-900">{stats.total}</p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white p-4">
                <p className="text-sm text-neutral-600 mb-1">Online</p>
                <p className="text-2xl font-bold text-green-600">{stats.online}</p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white p-4">
                <p className="text-sm text-neutral-600 mb-1">Offline</p>
                <p className="text-2xl font-bold text-red-600">{stats.offline}</p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white p-4">
                <p className="text-sm text-neutral-600 mb-1">Platform</p>
                <p className="text-2xl font-bold text-neutral-900">
                  MT5: {stats.byPlatform.MT5} / MT4: {stats.byPlatform.MT4}
                </p>
              </div>
            </div>
          )}

      {executors.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-neutral-200">
          <Server className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-neutral-900 mb-2">No executors yet</h3>
          <p className="text-neutral-600 mb-4">
            Create your first executor to connect your Windows application
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors font-medium"
          >
            Add Executor
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {executors.map((executor) => (
            <div
              key={executor.id}
              className="bg-white rounded-lg border border-neutral-200 p-6 hover:border-primary-300 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="mt-1">{getStatusIcon(executor)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-neutral-900">{executor.name}</h3>
                      <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                        {executor.platform}
                      </span>
                      {getStatusText(executor)}
                    </div>
                    <div className="space-y-1 text-sm text-neutral-600 mb-3">
                      {executor.brokerServer && (
                        <p>Server: {executor.brokerServer}</p>
                      )}
                      {executor.accountNumber && (
                        <p>Account: {executor.accountNumber}</p>
                      )}
                      {executor.lastHeartbeat && (
                        <p className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last heartbeat: {new Date(executor.lastHeartbeat).toLocaleString()}
                        </p>
                      )}
                    </div>
                    {executor._count && (
                      <div className="flex items-center gap-4 text-xs text-neutral-600">
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          {executor._count.trades} trades
                        </span>
                        <span className="flex items-center gap-1">
                          <Send className="h-3 w-3" />
                          {executor._count.commands} commands
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/executors/${executor.id}`}
                    className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    title="View details"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(executor)}
                    disabled={deletingId === executor.id}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete executor"
                  >
                    {deletingId === executor.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

        </div>
      )}

      {/* Real-time Monitor Tab */}
      {activeTab === 'monitor' && (
        <RealtimeMonitor executors={executors} onRefresh={fetchExecutors} />
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog />

      {/* Add Executor Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-neutral-900 mb-4">Add New Executor</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Executor Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  placeholder="My MT5 Executor"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Platform *
                </label>
                <select
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  required
                >
                  <option value="MT5">MetaTrader 5</option>
                  <option value="MT4">MetaTrader 4</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Broker Server (optional)
                </label>
                <input
                  type="text"
                  value={formData.brokerServer}
                  onChange={(e) => setFormData({ ...formData, brokerServer: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  placeholder="broker.server.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Account Number (optional)
                </label>
                <input
                  type="text"
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  placeholder="12345678"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Creating...' : 'Create Executor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {showCredentials && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-neutral-900 mb-2">Executor Credentials</h2>
            <p className="text-sm text-red-600 mb-4">
              ⚠️ Save these credentials securely. They will not be shown again!
            </p>
            <div className="space-y-4 bg-neutral-50 p-4 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  API Key
                </label>
                <div className="flex gap-2">
                  <code className="flex-1 px-3 py-2 bg-white border border-neutral-300 rounded text-sm font-mono break-all">
                    {credentials.apiKey}
                  </code>
                  <button
                    onClick={() => copyToClipboard(credentials.apiKey, 'API Key')}
                    className="p-2 text-neutral-700 hover:bg-white rounded-lg transition-colors"
                    title="Copy API Key"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Secret Key
                </label>
                <div className="flex gap-2">
                  <code className="flex-1 px-3 py-2 bg-white border border-neutral-300 rounded text-sm font-mono break-all">
                    {credentials.secretKey}
                  </code>
                  <button
                    onClick={() => copyToClipboard(credentials.secretKey, 'Secret Key')}
                    className="p-2 text-neutral-700 hover:bg-white rounded-lg transition-colors"
                    title="Copy Secret Key"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowCredentials(false)}
              className="w-full mt-6 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              I&apos;ve Saved the Credentials
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
