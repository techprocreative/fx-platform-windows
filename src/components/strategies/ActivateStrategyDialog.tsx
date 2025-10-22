'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { X, Server, CheckCircle2, AlertCircle, Play } from 'lucide-react';

interface Executor {
  id: string;
  name: string;
  platform: string;
  status: string;
  lastHeartbeat: string | null;
  isConnected: boolean;
}

interface ActivateStrategyDialogProps {
  strategyId: string;
  strategyName: string;
  isOpen: boolean;
  onClose: () => void;
  onActivated: () => void;
}

export function ActivateStrategyDialog({
  strategyId,
  strategyName,
  isOpen,
  onClose,
  onActivated,
}: ActivateStrategyDialogProps) {
  const [executors, setExecutors] = useState<Executor[]>([]);
  const [selectedExecutors, setSelectedExecutors] = useState<string[]>([]);
  const [autoAssign, setAutoAssign] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fetchingExecutors, setFetchingExecutors] = useState(true);
  const [settings, setSettings] = useState({
    lotSize: '',
    maxRisk: '',
    maxDailyLoss: '',
    maxOpenTrades: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchExecutors();
    }
  }, [isOpen]);

  const fetchExecutors = async () => {
    try {
      setFetchingExecutors(true);
      const response = await fetch('/api/executor');
      if (response.ok) {
        const data = await response.json();
        setExecutors(data.executors || []);
        
        // Auto-select all online executors
        const onlineExecutors = (data.executors || [])
          .filter((e: Executor) => e.isConnected)
          .map((e: Executor) => e.id);
        setSelectedExecutors(onlineExecutors);
      }
    } catch (error) {
      console.error('Failed to fetch executors:', error);
      toast.error('Failed to load executors');
    } finally {
      setFetchingExecutors(false);
    }
  };

  const handleToggleExecutor = (executorId: string) => {
    setSelectedExecutors((prev) =>
      prev.includes(executorId)
        ? prev.filter((id) => id !== executorId)
        : [...prev, executorId]
    );
    setAutoAssign(false);
  };

  const handleActivate = async () => {
    if (!autoAssign && selectedExecutors.length === 0) {
      toast.error('Please select at least one executor');
      return;
    }

    setLoading(true);
    try {
      const body: any = {
        autoAssign,
      };

      if (!autoAssign) {
        body.executorIds = selectedExecutors;
      }

      // Add settings if provided
      const settingsObj: any = {};
      if (settings.lotSize) settingsObj.lotSize = parseFloat(settings.lotSize);
      if (settings.maxRisk) settingsObj.maxRisk = parseFloat(settings.maxRisk);
      if (settings.maxDailyLoss) settingsObj.maxDailyLoss = parseFloat(settings.maxDailyLoss);
      if (settings.maxOpenTrades) settingsObj.maxOpenTrades = parseInt(settings.maxOpenTrades);

      if (Object.keys(settingsObj).length > 0) {
        body.settings = settingsObj;
      }

      const response = await fetch(`/api/strategy/${strategyId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to activate strategy');
      }

      toast.success(
        `Strategy activated on ${data.executorsNotified} executor(s)! Commands sent via Pusher.`
      );
      onActivated();
      onClose();
    } catch (error) {
      const err = error instanceof Error ? error : new Error('An error occurred');
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const onlineExecutors = executors.filter((e) => e.isConnected);
  const offlineExecutors = executors.filter((e) => !e.isConnected);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Play className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900">Activate Strategy</h2>
              <p className="text-sm text-neutral-600">{strategyName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {fetchingExecutors ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-neutral-600">Loading executors...</p>
            </div>
          ) : executors.length === 0 ? (
            <div className="text-center py-8">
              <Server className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-neutral-900 mb-2">
                No executors found
              </h3>
              <p className="text-neutral-600 mb-4">
                You need to create at least one executor first.
              </p>
              <a
                href="/dashboard/executors"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Server className="h-4 w-4" />
                Go to Executors
              </a>
            </div>
          ) : (
            <>
              {/* Auto-assign toggle */}
              <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <input
                  type="checkbox"
                  id="autoAssign"
                  checked={autoAssign}
                  onChange={(e) => setAutoAssign(e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="autoAssign" className="flex-1 cursor-pointer">
                  <span className="text-sm font-medium text-blue-900">
                    Auto-assign to all online executors
                  </span>
                  <p className="text-xs text-blue-700 mt-1">
                    Strategy will automatically start on all online executors ({onlineExecutors.length} available)
                  </p>
                </label>
              </div>

              {/* Executor selection */}
              {!autoAssign && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-3">
                    Select Executors
                  </label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {/* Online executors */}
                    {onlineExecutors.length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-green-600 uppercase tracking-wide px-2">
                          Online ({onlineExecutors.length})
                        </p>
                        {onlineExecutors.map((executor) => (
                          <div
                            key={executor.id}
                            onClick={() => handleToggleExecutor(executor.id)}
                            className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                              selectedExecutors.includes(executor.id)
                                ? 'border-green-500 bg-green-50'
                                : 'border-neutral-200 hover:border-neutral-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedExecutors.includes(executor.id)}
                              onChange={() => {}}
                              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="font-medium text-neutral-900">
                                  {executor.name}
                                </span>
                                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                  {executor.platform}
                                </span>
                              </div>
                              <p className="text-xs text-neutral-500 mt-0.5">
                                Last heartbeat:{' '}
                                {executor.lastHeartbeat
                                  ? new Date(executor.lastHeartbeat).toLocaleTimeString()
                                  : 'Never'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Offline executors */}
                    {offlineExecutors.length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide px-2 mt-4">
                          Offline ({offlineExecutors.length})
                        </p>
                        {offlineExecutors.map((executor) => (
                          <div
                            key={executor.id}
                            className="flex items-center gap-3 p-3 border-2 border-neutral-200 rounded-lg opacity-50 cursor-not-allowed"
                          >
                            <input
                              type="checkbox"
                              disabled
                              className="w-4 h-4 border-gray-300 rounded"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-neutral-400" />
                                <span className="font-medium text-neutral-600">
                                  {executor.name}
                                </span>
                                <span className="text-xs px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded">
                                  {executor.platform}
                                </span>
                                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded">
                                  Offline
                                </span>
                              </div>
                              <p className="text-xs text-neutral-400 mt-0.5">
                                Cannot assign to offline executors
                              </p>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Settings override (optional) */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-3">
                  Settings Override <span className="text-neutral-400">(Optional)</span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-neutral-600 mb-1">Lot Size</label>
                    <input
                      type="number"
                      step="0.01"
                      value={settings.lotSize}
                      onChange={(e) =>
                        setSettings({ ...settings, lotSize: e.target.value })
                      }
                      placeholder="e.g., 0.01"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-600 mb-1">Max Risk (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.maxRisk}
                      onChange={(e) =>
                        setSettings({ ...settings, maxRisk: e.target.value })
                      }
                      placeholder="e.g., 2"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-600 mb-1">
                      Max Daily Loss (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.maxDailyLoss}
                      onChange={(e) =>
                        setSettings({ ...settings, maxDailyLoss: e.target.value })
                      }
                      placeholder="e.g., 5"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-600 mb-1">
                      Max Open Trades
                    </label>
                    <input
                      type="number"
                      value={settings.maxOpenTrades}
                      onChange={(e) =>
                        setSettings({ ...settings, maxOpenTrades: e.target.value })
                      }
                      placeholder="e.g., 5"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Warning */}
              {onlineExecutors.length === 0 && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-orange-900 mb-1">
                        No Online Executors
                      </h4>
                      <p className="text-sm text-orange-700">
                        All executors are offline. The strategy will be activated but won't
                        execute until executors come online and receive the START_STRATEGY
                        command.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {executors.length > 0 && !fetchingExecutors && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 bg-neutral-50">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleActivate}
              disabled={loading || (!autoAssign && selectedExecutors.length === 0)}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Activating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Activate Strategy
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
