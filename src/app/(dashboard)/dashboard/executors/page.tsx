'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Server,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

interface Executor {
  id: string;
  name: string;
  platform: string;
  status: string;
  lastHeartbeat: string | null;
  isConnected: boolean;
  apiKey?: string;
}

export default function ExecutorsPage() {
  const { data: session, status } = useSession();
  const [executors, setExecutors] = useState<Executor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [credentials, setCredentials] = useState({ apiKey: '', secretKey: '' });
  const [formData, setFormData] = useState({
    name: '',
    platform: 'MT5',
    brokerServer: '',
    accountNumber: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    if (status === 'authenticated') {
      fetchExecutors();
    }
  }, [status]);

  const fetchExecutors = async () => {
    try {
      const response = await fetch('/api/ws');
      if (response.ok) {
        const data = await response.json();
        setExecutors(data.executors || []);
      }
    } catch (error) {
      toast.error('Failed to load executors');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/ws', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setCredentials({
          apiKey: data.executor.apiKey,
          secretKey: data.executor.secretKey,
        });
        setShowCredentials(true);
        setShowModal(false);
        toast.success('Executor registered successfully');
        fetchExecutors();
        setFormData({ name: '', platform: 'MT5', brokerServer: '', accountNumber: '' });
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to register executor');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (executorId: string) => {
    if (!confirm('Are you sure you want to delete this executor?')) return;

    try {
      const response = await fetch(`/api/ws?executorId=${executorId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Executor deleted');
        fetchExecutors();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete executor');
      }
    } catch (error) {
      toast.error('An error occurred');
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

  if (loading && executors.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-600">Loading executors...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Executors</h1>
          <p className="text-neutral-600 mt-1">Manage your Windows trading executors</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors font-medium"
        >
          <Plus className="h-4 w-4" />
          Add Executor
        </button>
      </div>

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
              className="bg-white rounded-lg border border-neutral-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="mt-1">{getStatusIcon(executor)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-neutral-900">{executor.name}</h3>
                      <span className="px-2 py-1 bg-neutral-100 text-neutral-700 text-xs rounded-md font-medium">
                        {executor.platform}
                      </span>
                      {getStatusText(executor)}
                    </div>
                    <div className="space-y-1 text-sm text-neutral-600">
                      <p>Executor ID: {executor.id}</p>
                      {executor.lastHeartbeat && (
                        <p className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last seen: {new Date(executor.lastHeartbeat).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(executor.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete executor"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
                  className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors font-medium disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Executor'}
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
              className="w-full mt-6 px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors font-medium"
            >
              I&apos;ve Saved the Credentials
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
