import React, { useState, useEffect } from 'react';
import { useConfigStore } from '../../stores/config.store';
import { useAppStore } from '../../stores/app.store';
import { useLogsStore } from '../../stores/logs.store';
import { StatusIndicator } from '../../components/StatusIndicator';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export function Settings() {
  const { config, updateConfig, isConfigured } = useConfigStore();
  const { 
    connectionStatus, 
    setIsSetupComplete,
    addLog,
    mt5Installations,
    setMt5Installations
  } = useAppStore();
  const { clearLogs, exportLogs } = useLogsStore();
  
  const [activeTab, setActiveTab] = useState<'general' | 'mt5' | 'safety' | 'logs'>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showClearLogsDialog, setShowClearLogsDialog] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState('');

  // Safety limits state
  const [safetyLimits, setSafetyLimits] = useState({
    maxDailyLoss: 500,
    maxPositions: 10,
    maxLotSize: 1.0,
    maxDrawdownPercent: 20,
  });

  // Handle save configuration
  const handleSaveConfig = async () => {
    try {
      setIsSaving(true);
      setErrors([]);
      setSuccessMessage('');
      
      // Save to Electron store
      await window.electronAPI?.saveConfig(config);
      
      // Test connection if API credentials are provided
      if (config.apiKey && config.apiSecret && config.executorId) {
        setIsTesting(true);
        const result = await window.electronAPI?.startServices(config);
        
        if (result?.success) {
          setTestResult('success');
          setSuccessMessage('Configuration saved and connection test successful');
        } else {
          setTestResult('error');
          setErrors([result?.error || 'Connection test failed']);
        }
        setIsTesting(false);
      } else {
        setSuccessMessage('Configuration saved');
      }
      
      addLog({
        level: 'info',
        category: 'SETTINGS',
        message: 'Configuration updated',
      });
      
    } catch (error) {
      const errorMsg = (error as Error).message;
      setErrors([errorMsg]);
      addLog({
        level: 'error',
        category: 'SETTINGS',
        message: `Failed to save config: ${errorMsg}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle reset configuration
  const handleResetConfig = async () => {
    try {
      // Reset to defaults
      updateConfig({
        executorId: '',
        apiKey: '',
        apiSecret: '',
        platformUrl: 'https://platform.com',
        pusherCluster: 'mt1',
        zmqPort: 5555,
        zmqHost: 'tcp://localhost',
        heartbeatInterval: 60,
        autoReconnect: true,
      });
      
      setSuccessMessage('Configuration reset to defaults');
      setShowResetDialog(false);
      
      addLog({
        level: 'info',
        category: 'SETTINGS',
        message: 'Configuration reset to defaults',
      });
      
    } catch (error) {
      const errorMsg = (error as Error).message;
      setErrors([errorMsg]);
    }
  };

  // Handle clear logs
  const handleClearLogs = () => {
    clearLogs();
    setShowClearLogsDialog(false);
    setSuccessMessage('Logs cleared');
  };

  // Handle export logs
  const handleExportLogs = () => {
    const logData = exportLogs();
    const blob = new Blob([logData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fx-executor-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle re-detect MT5
  const handleRedetectMT5 = async () => {
    try {
      const installations = await window.electronAPI?.getMT5Installations() || [];
      setMt5Installations(installations);
      setSuccessMessage(`Found ${installations.length} MT5 installation(s)`);
    } catch (error) {
      const errorMsg = (error as Error).message;
      setErrors([errorMsg]);
    }
  };

  // Handle complete setup reset
  const handleResetSetup = async () => {
    try {
      await window.electronAPI?.completeSetup();
      setIsSetupComplete(false);
      setSuccessMessage('Setup reset. You will need to go through the setup process again.');
    } catch (error) {
      const errorMsg = (error as Error).message;
      setErrors([errorMsg]);
    }
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMessage || errors.length > 0) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
        setErrors([]);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errors]);

  return (
    <div className="flex-1 overflow-auto bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-600">
            Configure your FX Platform Executor.
          </p>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-4 bg-success-50 border border-success-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <StatusIndicator status="online" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-success-800">Success</h3>
                <div className="mt-2 text-sm text-success-700">
                  {successMessage}
                </div>
              </div>
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <div className="mb-4 bg-danger-50 border border-danger-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <StatusIndicator status="error" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-danger-800">Error</h3>
                <div className="mt-2 text-sm text-danger-700">
                  {errors.map((error, index) => (
                    <p key={index}>{error}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {['general', 'mt5', 'safety', 'logs'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="card p-6">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">General Settings</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="executorId" className="label">Executor ID</label>
                  <input
                    id="executorId"
                    type="text"
                    value={config.executorId || ''}
                    onChange={(e) => updateConfig({ executorId: e.target.value })}
                    className="input mt-1"
                    placeholder="Enter your executor ID"
                  />
                </div>
                
                <div>
                  <label htmlFor="platformUrl" className="label">Platform URL</label>
                  <input
                    id="platformUrl"
                    type="text"
                    value={config.platformUrl || ''}
                    onChange={(e) => updateConfig({ platformUrl: e.target.value })}
                    className="input mt-1"
                    placeholder="https://platform.com"
                  />
                </div>
                
                <div>
                  <label htmlFor="apiKey" className="label">API Key</label>
                  <input
                    id="apiKey"
                    type="text"
                    value={config.apiKey || ''}
                    onChange={(e) => updateConfig({ apiKey: e.target.value })}
                    className="input mt-1"
                    placeholder="Enter your API key"
                  />
                </div>
                
                <div>
                  <label htmlFor="apiSecret" className="label">API Secret</label>
                  <input
                    id="apiSecret"
                    type="password"
                    value={config.apiSecret || ''}
                    onChange={(e) => updateConfig({ apiSecret: e.target.value })}
                    className="input mt-1"
                    placeholder="Enter your API secret"
                  />
                </div>
                
                <div>
                  <label htmlFor="pusherKey" className="label">Pusher Key</label>
                  <input
                    id="pusherKey"
                    type="text"
                    value={config.pusherKey || ''}
                    onChange={(e) => updateConfig({ pusherKey: e.target.value })}
                    className="input mt-1"
                    placeholder="Enter your Pusher key"
                  />
                </div>
                
                <div>
                  <label htmlFor="pusherCluster" className="label">Pusher Cluster</label>
                  <input
                    id="pusherCluster"
                    type="text"
                    value={config.pusherCluster || ''}
                    onChange={(e) => updateConfig({ pusherCluster: e.target.value })}
                    className="input mt-1"
                    placeholder="mt1"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowResetDialog(true)}
                  className="btn btn-secondary"
                >
                  Reset to Defaults
                </button>
                <button
                  onClick={handleSaveConfig}
                  disabled={isSaving}
                  className="btn btn-primary"
                >
                  {isSaving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>

              {/* Connection Test Result */}
              {testResult !== 'idle' && (
                <div className="mt-4 flex items-center space-x-2">
                  <StatusIndicator 
                    status={testResult === 'success' ? 'online' : 'error'} 
                  />
                  <span className="text-sm text-gray-600">
                    {testResult === 'success' 
                      ? 'Connection test successful' 
                      : 'Connection test failed'
                    }
                  </span>
                </div>
              )}
            </div>
          )}

          {/* MT5 Settings */}
          {activeTab === 'mt5' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">MT5 Settings</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="zmqHost" className="label">ZeroMQ Host</label>
                  <input
                    id="zmqHost"
                    type="text"
                    value={config.zmqHost || ''}
                    onChange={(e) => updateConfig({ zmqHost: e.target.value })}
                    className="input mt-1"
                    placeholder="tcp://localhost"
                  />
                </div>
                
                <div>
                  <label htmlFor="zmqPort" className="label">ZeroMQ Port</label>
                  <input
                    id="zmqPort"
                    type="number"
                    value={config.zmqPort || ''}
                    onChange={(e) => updateConfig({ zmqPort: parseInt(e.target.value) })}
                    className="input mt-1"
                    placeholder="5555"
                  />
                </div>
                
                <div>
                  <label htmlFor="heartbeatInterval" className="label">Heartbeat Interval (seconds)</label>
                  <input
                    id="heartbeatInterval"
                    type="number"
                    value={config.heartbeatInterval || ''}
                    onChange={(e) => updateConfig({ heartbeatInterval: parseInt(e.target.value) })}
                    className="input mt-1"
                    placeholder="60"
                  />
                </div>
                
                <div className="flex items-center">
                  <input
                    id="autoReconnect"
                    type="checkbox"
                    checked={config.autoReconnect || false}
                    onChange={(e) => updateConfig({ autoReconnect: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="autoReconnect" className="ml-2 block text-sm text-gray-900">
                    Auto-reconnect on disconnection
                  </label>
                </div>
              </div>

              {/* MT5 Installations */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-md font-medium text-gray-900">MT5 Installations</h4>
                  <button
                    onClick={handleRedetectMT5}
                    className="btn btn-secondary text-sm"
                  >
                    Re-detect
                  </button>
                </div>
                
                {mt5Installations.length > 0 ? (
                  <div className="space-y-2">
                    {mt5Installations.map((mt5, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <div>
                          <div className="font-medium text-gray-900">MT5 Build {mt5.build}</div>
                          <div className="text-sm text-gray-500">{mt5.path}</div>
                        </div>
                        <StatusIndicator 
                          status={mt5.isRunning ? 'online' : 'offline'} 
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No MT5 installations found
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleResetSetup}
                  className="btn btn-secondary"
                >
                  Reset Setup
                </button>
                <button
                  onClick={handleSaveConfig}
                  disabled={isSaving}
                  className="btn btn-primary"
                >
                  {isSaving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>
          )}

          {/* Safety Settings */}
          {activeTab === 'safety' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Safety Settings</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="maxDailyLoss" className="label">Max Daily Loss ($)</label>
                  <input
                    id="maxDailyLoss"
                    type="number"
                    value={safetyLimits.maxDailyLoss}
                    onChange={(e) => setSafetyLimits({...safetyLimits, maxDailyLoss: parseFloat(e.target.value)})}
                    className="input mt-1"
                    placeholder="500"
                  />
                </div>
                
                <div>
                  <label htmlFor="maxPositions" className="label">Max Positions</label>
                  <input
                    id="maxPositions"
                    type="number"
                    value={safetyLimits.maxPositions}
                    onChange={(e) => setSafetyLimits({...safetyLimits, maxPositions: parseInt(e.target.value)})}
                    className="input mt-1"
                    placeholder="10"
                  />
                </div>
                
                <div>
                  <label htmlFor="maxLotSize" className="label">Max Lot Size</label>
                  <input
                    id="maxLotSize"
                    type="number"
                    step="0.01"
                    value={safetyLimits.maxLotSize}
                    onChange={(e) => setSafetyLimits({...safetyLimits, maxLotSize: parseFloat(e.target.value)})}
                    className="input mt-1"
                    placeholder="1.0"
                  />
                </div>
                
                <div>
                  <label htmlFor="maxDrawdownPercent" className="label">Max Drawdown (%)</label>
                  <input
                    id="maxDrawdownPercent"
                    type="number"
                    value={safetyLimits.maxDrawdownPercent}
                    onChange={(e) => setSafetyLimits({...safetyLimits, maxDrawdownPercent: parseFloat(e.target.value)})}
                    className="input mt-1"
                    placeholder="20"
                  />
                </div>
              </div>

              <div className="bg-warning-50 border border-warning-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-warning-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-warning-800">Safety Limits</h3>
                    <div className="mt-2 text-sm text-warning-700">
                      These limits help protect your account from excessive losses. The executor will automatically stop trading when any limit is reached.
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveConfig}
                  disabled={isSaving}
                  className="btn btn-primary"
                >
                  {isSaving ? 'Saving...' : 'Save Safety Settings'}
                </button>
              </div>
            </div>
          )}

          {/* Logs Settings */}
          {activeTab === 'logs' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Logs Settings</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-md font-medium text-gray-900">Export Logs</h4>
                    <p className="text-sm text-gray-500">Download all logs as a JSON file</p>
                  </div>
                  <button
                    onClick={handleExportLogs}
                    className="btn btn-secondary"
                  >
                    Export Logs
                  </button>
                </div>
                
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-md font-medium text-gray-900">Clear Logs</h4>
                    <p className="text-sm text-gray-500">Remove all logs from the application</p>
                  </div>
                  <button
                    onClick={() => setShowClearLogsDialog(true)}
                    className="btn btn-danger"
                  >
                    Clear Logs
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showResetDialog}
        title="Reset Configuration"
        message="Are you sure you want to reset all configuration settings to their default values? This action cannot be undone."
        confirmText="Reset"
        cancelText="Cancel"
        onConfirm={handleResetConfig}
        onCancel={() => setShowResetDialog(false)}
        type="warning"
      />

      {/* Clear Logs Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showClearLogsDialog}
        title="Clear Logs"
        message="Are you sure you want to clear all logs? This action cannot be undone."
        confirmText="Clear Logs"
        cancelText="Cancel"
        onConfirm={handleClearLogs}
        onCancel={() => setShowClearLogsDialog(false)}
        type="warning"
      />
    </div>
  );
}