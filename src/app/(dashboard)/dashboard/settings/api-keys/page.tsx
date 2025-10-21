'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Key,
  Plus,
  Copy,
  Trash2,
  CheckCircle2,
} from 'lucide-react';

interface APIKey {
  id: string;
  name: string;
  keyHash: string;
  createdAt: string;
  lastUsed: string | null;
  expiresAt: string;
  permissions: string[];
}

export default function APIKeysPage() {
  const { data: session, status } = useSession();
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [credentials, setCredentials] = useState({ apiKey: '', secret: '' });
  const [formData, setFormData] = useState({
    name: '',
    expiresInDays: 365,
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    if (status === 'authenticated') {
      fetchAPIKeys();
    }
  }, [status]);

  const fetchAPIKeys = async () => {
    try {
      const response = await fetch('/api/user/api-keys');
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.keys || []);
      }
    } catch (error) {
      console.error('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setCredentials({
          apiKey: data.apiKey,
          secret: data.secret,
        });
        setShowCredentials(true);
        setShowModal(false);
        toast.success('API key generated successfully');
        fetchAPIKeys();
        setFormData({ name: '', expiresInDays: 365 });
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to generate API key');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;

    try {
      const response = await fetch(`/api/user/api-keys?keyId=${keyId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('API key revoked');
        fetchAPIKeys();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to revoke API key');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const maskKey = (key: string) => {
    return key.substring(0, 8) + '...' + key.substring(key.length - 4);
  };

  if (loading && apiKeys.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-600">Loading API keys...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">API Keys</h1>
          <p className="text-neutral-600 mt-1">
            Manage your API keys for programmatic access
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors font-medium"
        >
          <Plus className="h-4 w-4" />
          Generate New Key
        </button>
      </div>

      {apiKeys.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-neutral-200">
          <Key className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-neutral-900 mb-2">No API keys yet</h3>
          <p className="text-neutral-600 mb-4">
            Generate your first API key to access the platform programmatically
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors font-medium"
          >
            Generate API Key
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {apiKeys.map((key) => (
            <div
              key={key.id}
              className="bg-white rounded-lg border border-neutral-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-bold text-neutral-900">{key.name}</h3>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-md font-medium">
                      Active
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-neutral-100 text-neutral-800 rounded font-mono text-xs">
                        {maskKey(key.keyHash)}
                      </code>
                      <button
                        onClick={() => copyToClipboard(key.keyHash, 'API Key')}
                        className="p-1 text-neutral-600 hover:text-neutral-900 transition-colors"
                        title="Copy key"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex gap-4 text-neutral-600">
                      <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
                      {key.lastUsed && (
                        <span>Last used: {new Date(key.lastUsed).toLocaleDateString()}</span>
                      )}
                      <span>Expires: {new Date(key.expiresAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-2">
                      {key.permissions.map((perm) => (
                        <span
                          key={perm}
                          className="px-2 py-1 bg-neutral-100 text-neutral-700 text-xs rounded"
                        >
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(key.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Revoke key"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generate Key Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-neutral-900 mb-4">Generate API Key</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Key Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  placeholder="Production API Key"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Expires In (days)
                </label>
                <select
                  value={formData.expiresInDays}
                  onChange={(e) => setFormData({ ...formData, expiresInDays: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                >
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={180}>180 days</option>
                  <option value={365}>1 year</option>
                  <option value={730}>2 years</option>
                </select>
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
                  {loading ? 'Generating...' : 'Generate'}
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
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <h2 className="text-xl font-bold text-neutral-900">API Key Generated</h2>
            </div>
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
                  Secret
                </label>
                <div className="flex gap-2">
                  <code className="flex-1 px-3 py-2 bg-white border border-neutral-300 rounded text-sm font-mono break-all">
                    {credentials.secret}
                  </code>
                  <button
                    onClick={() => copyToClipboard(credentials.secret, 'Secret')}
                    className="p-2 text-neutral-700 hover:bg-white rounded-lg transition-colors"
                    title="Copy Secret"
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
