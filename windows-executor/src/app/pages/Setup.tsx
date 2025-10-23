import React, { useState, useEffect } from 'react';
import { useConfigStore } from '../../stores/config.store';
import { useAppStore } from '../../stores/app.store';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { StatusIndicator } from '../../components/StatusIndicator';

export function Setup() {
  const { config, updateConfig, isConfigured } = useConfigStore();
  const { 
    setIsSetupComplete, 
    addLog, 
    mt5Installations, 
    setMt5Installations,
    setIsLoading 
  } = useAppStore();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState({ step: 0, message: '' });
  const [connectionTestResult, setConnectionTestResult] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errors, setErrors] = useState<string[]>([]);

  // Auto-detect MT5 installations on mount
  useEffect(() => {
    const detectMT5 = async () => {
      try {
        setIsLoading(true);
        const installations = await window.electronAPI?.getMT5Installations() || [];
        setMt5Installations(installations);
        addLog({
          level: 'info',
          category: 'SETUP',
          message: `Found ${installations.length} MT5 installation(s)`,
          metadata: { installations }
        });
      } catch (error) {
        addLog({
          level: 'error',
          category: 'SETUP',
          message: `Failed to detect MT5: ${(error as Error).message}`,
        });
      } finally {
        setIsLoading(false);
      }
    };

    detectMT5();
  }, [addLog, setMt5Installations, setIsLoading]);

  // Handle auto-installation
  const handleAutoInstall = async () => {
    try {
      setIsInstalling(true);
      setErrors([]);
      addLog({
        level: 'info',
        category: 'SETUP',
        message: 'Starting auto-installation...',
      });

      const result = await window.electronAPI?.autoInstallMT5();
      
      if (result?.success) {
        addLog({
          level: 'info',
          category: 'SETUP',
          message: 'Auto-installation completed successfully',
          metadata: result
        });
        setCurrentStep(2);
      } else {
        const errorMsg = result?.error || 'Auto-installation failed';
        setErrors([errorMsg]);
        addLog({
          level: 'error',
          category: 'SETUP',
          message: errorMsg,
        });
      }
    } catch (error) {
      const errorMsg = (error as Error).message;
      setErrors([errorMsg]);
      addLog({
        level: 'error',
        category: 'SETUP',
        message: `Auto-installation error: ${errorMsg}`,
      });
    } finally {
      setIsInstalling(false);
    }
  };

  // Handle connection test
  const handleTestConnection = async () => {
    if (!config.apiKey || !config.apiSecret || !config.executorId) {
      setErrors(['Please fill in all required fields']);
      return;
    }

    try {
      setIsConnecting(true);
      setConnectionTestResult('testing');
      setErrors([]);
      
      addLog({
        level: 'info',
        category: 'SETUP',
        message: 'Testing API connection...',
      });

      const result = await window.electronAPI?.startServices(config);
      
      if (result?.success) {
        setConnectionTestResult('success');
        addLog({
          level: 'info',
          category: 'SETUP',
          message: 'Connection test successful',
        });
        setCurrentStep(3);
      } else {
        setConnectionTestResult('error');
        const errorMsg = result?.error || 'Connection test failed';
        setErrors([errorMsg]);
        addLog({
          level: 'error',
          category: 'SETUP',
          message: errorMsg,
        });
      }
    } catch (error) {
      setConnectionTestResult('error');
      const errorMsg = (error as Error).message;
      setErrors([errorMsg]);
      addLog({
        level: 'error',
        category: 'SETUP',
        message: `Connection error: ${errorMsg}`,
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle setup completion
  const handleCompleteSetup = async () => {
    try {
      // Save configuration
      await window.electronAPI?.saveConfig(config);
      
      // Mark setup as completed
      await window.electronAPI?.completeSetup();
      
      setIsSetupComplete(true);
      
      addLog({
        level: 'info',
        category: 'SETUP',
        message: 'Setup completed successfully',
      });
    } catch (error) {
      const errorMsg = (error as Error).message;
      setErrors([errorMsg]);
      addLog({
        level: 'error',
        category: 'SETUP',
        message: `Setup completion error: ${errorMsg}`,
      });
    }
  };

  // Step 1: Welcome & Auto-Installation
  if (currentStep === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              FX Platform Executor Setup
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Welcome! We'll automatically set up everything for you.
            </p>
          </div>

          {/* MT5 Detection Status */}
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">MT5 Detection</h3>
            
            {mt5Installations.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <StatusIndicator status="online" />
                  <span className="text-sm text-gray-600">
                    Found {mt5Installations.length} MT5 installation(s)
                  </span>
                </div>
                
                {mt5Installations.map((mt5, index) => (
                  <div key={index} className="text-xs text-gray-500 ml-6">
                    {mt5.path} (Build {mt5.build})
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <StatusIndicator status="offline" />
                <span className="text-sm text-gray-600">No MT5 installations found</span>
              </div>
            )}
          </div>

          {/* Auto-Installation */}
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Auto-Installation</h3>
            <p className="text-sm text-gray-600 mb-4">
              We'll automatically install libzmq.dll and the Expert Advisor to your MT5 installation(s).
            </p>
            
            {isInstalling ? (
              <div className="space-y-4">
                <LoadingSpinner text="Installing components..." />
                <div className="text-xs text-gray-500">
                  {installProgress.message}
                </div>
              </div>
            ) : (
              <button
                onClick={handleAutoInstall}
                disabled={mt5Installations.length === 0}
                className="w-full btn btn-primary disabled:opacity-50"
              >
                {mt5Installations.length > 0 ? 'Start Auto-Installation' : 'MT5 Not Found'}
              </button>
            )}
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-danger-50 border border-danger-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <StatusIndicator status="error" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-danger-800">Errors</h3>
                  <div className="mt-2 text-sm text-danger-700">
                    {errors.map((error, index) => (
                      <p key={index}>{error}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Step 2: API Credentials
  if (currentStep === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              API Configuration
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Enter your API credentials from the platform.
            </p>
          </div>

          <div className="card p-6 space-y-6">
            <div>
              <label htmlFor="executorId" className="label">
                Executor ID
              </label>
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
              <label htmlFor="apiKey" className="label">
                API Key
              </label>
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
              <label htmlFor="apiSecret" className="label">
                API Secret
              </label>
              <input
                id="apiSecret"
                type="password"
                value={config.apiSecret || ''}
                onChange={(e) => updateConfig({ apiSecret: e.target.value })}
                className="input mt-1"
                placeholder="Enter your API secret"
              />
            </div>

            <div className="text-xs text-gray-500">
              Your credentials are encrypted and stored locally.
            </div>

            {/* Connection Test Result */}
            {connectionTestResult !== 'idle' && (
              <div className="flex items-center space-x-2">
                <StatusIndicator 
                  status={connectionTestResult === 'success' ? 'online' : 'error'} 
                />
                <span className="text-sm text-gray-600">
                  {connectionTestResult === 'success' 
                    ? 'Connection successful' 
                    : connectionTestResult === 'testing'
                    ? 'Testing connection...'
                    : 'Connection failed'
                  }
                </span>
              </div>
            )}

            {/* Errors */}
            {errors.length > 0 && (
              <div className="bg-danger-50 border border-danger-200 rounded-md p-4">
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

            <div className="flex space-x-3">
              <button
                onClick={() => setCurrentStep(1)}
                className="flex-1 btn btn-secondary"
              >
                Back
              </button>
              <button
                onClick={handleTestConnection}
                disabled={isConnecting || !config.apiKey || !config.apiSecret || !config.executorId}
                className="flex-1 btn btn-primary disabled:opacity-50"
              >
                {isConnecting ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Final Check & Auto-Start
  if (currentStep === 3) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Ready to Trade!
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Your executor is ready to start trading.
            </p>
          </div>

          <div className="card p-6 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <svg className="h-5 w-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-gray-600">MT5 detected and configured</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <svg className="h-5 w-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-gray-600">libzmq.dll installed</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <svg className="h-5 w-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-gray-600">Expert Advisor installed</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <svg className="h-5 w-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-gray-600">API connection established</span>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Next Steps:</h3>
              <p className="text-xs text-gray-600 mb-4">
                The Expert Advisor is ready in MT5 under: Experts/FX_Platform_Bridge
              </p>
              
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-sm text-gray-600">Auto-attach EA to EURUSD chart</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-sm text-gray-600">Start monitoring automatically</span>
                </label>
              </div>
            </div>

            <button
              onClick={handleCompleteSetup}
              className="w-full btn btn-primary"
            >
              Start Executor
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}