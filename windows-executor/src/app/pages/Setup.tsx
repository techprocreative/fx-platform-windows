import { useState, useEffect } from "react";
import { useConfigStore } from "../../stores/config.store";
import { useAppStore } from "../../stores/app.store";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { StatusIndicator } from "../../components/StatusIndicator";
import { InstallResult } from "../../types/mt5.types";
import { AppConfig } from "../../types/config.types";

export function Setup() {
  const {
    config,
    fetchConfigFromPlatform,
    isLoading: configLoading,
    error: configError,
  } = useConfigStore();

  const {
    setIsSetupComplete,
    addLog,
    mt5Installations,
    setMT5Installations,
    setIsLoading,
  } = useAppStore();

  const [currentStep, setCurrentStep] = useState(1);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [installProgress] = useState({
    step: 0,
    message: "",
  });
  const [connectionTestResult, setConnectionTestResult] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [errors, setErrors] = useState<string[]>([]);

  // Form state for credentials input  
  const [platformUrl, setPlatformUrl] = useState(
    "https://fx.nusanexus.com", // Always default to correct URL
  );
  const [apiKey, setApiKey] = useState(config.apiKey || "");
  const [apiSecret, setApiSecret] = useState(config.apiSecret || "");

  // Auto-detect MT5 installations on mount
  useEffect(() => {
    // DEBUG: Log on mount ONLY
    // console.clear(); // Commented out to preserve debug logs
    console.log("=".repeat(80));
    console.log("🔍🔍🔍 [Setup.tsx] COMPONENT MOUNTED!");
    console.log("🔍 platformUrl state:", platformUrl);
    console.log("🔍 config.platformUrl:", config.platformUrl);
    console.log("🔍 config.apiKey:", config.apiKey?.substring(0, 10) + "...");
    console.log("=".repeat(80));
  }, []); // Empty deps = run once on mount

  // MT5 detection
  useEffect(() => {
    const detectMT5 = async () => {
      try {
        console.log('=== Setup.tsx: Starting MT5 detection ===');
        console.log('electronAPI available?', !!(window as any).electronAPI);
        console.log('getMT5Installations available?', typeof (window as any).electronAPI?.getMT5Installations);
        
        setIsLoading(true);
        const installations =
          (await (window as any).electronAPI?.getMT5Installations?.()) || [];
        
        console.log('=== MT5 Detection Result ===');
        console.log('Installations count:', installations.length);
        console.log('Installations data:', installations);
        console.log('Current mt5Installations state:', mt5Installations);
        
        setMT5Installations(installations);
        
        console.log('setMT5Installations called with:', installations);
        
        addLog({
          level: "info",
          category: "SETUP",
          message: `Found ${installations.length} MT5 installation(s)`,
          metadata: { installations },
        });
      } catch (error) {
        console.error('=== MT5 Detection ERROR ===', error);
        addLog({
          level: "error",
          category: "SETUP",
          message: `Failed to detect MT5: ${(error as Error).message}`,
        });
      } finally {
        setIsLoading(false);
      }
    };

    detectMT5();
  }, [addLog, setMT5Installations, setIsLoading]);

  // Handle auto-installation
  const handleAutoInstall = async () => {
    try {
      setIsInstalling(true);
      setErrors([]);
      addLog({
        level: "info",
        category: "SETUP",
        message: "Starting auto-installation...",
      });

      const result: InstallResult | undefined =
        await (window as any).electronAPI?.autoInstallMT5?.();

      if (result?.mt5Installations) {
        setMT5Installations(result.mt5Installations);
      }

      if (result?.success) {
        addLog({
          level: "info",
          category: "SETUP",
          message: "Auto-installation completed successfully",
          metadata: result,
        });
        setCurrentStep(2);
      } else {
        const errorMessages =
          result?.errors && result.errors.length > 0
            ? result.errors
            : ["Auto-installation failed"];
        setErrors(errorMessages);
        addLog({
          level: "error",
          category: "SETUP",
          message: errorMessages.join("; "),
          metadata: result,
        });
      }
    } catch (error) {
      const errorMsg = (error as Error).message;
      setErrors([errorMsg]);
      addLog({
        level: "error",
        category: "SETUP",
        message: `Auto-installation error: ${errorMsg}`,
      });
    } finally {
      setIsInstalling(false);
    }
  };

  /**
   * Step 2: Handle connection setup
   * 1. Validate credentials
   * 2. Fetch config from platform using /api/executor/config
   * 3. Test connection to all services
   */
  const handleConnectAndFetchConfig = async () => {
    console.log("🚀 [Setup.tsx] handleConnectAndFetchConfig CALLED!");
    console.log("[Setup.tsx] Inputs:", { platformUrl, apiKey: apiKey?.substring(0, 10) + "...", apiSecret: "***" });
    
    // Validate inputs
    if (!platformUrl || !apiKey || !apiSecret) {
      console.error("[Setup.tsx] Validation failed: missing credentials");
      setErrors(["Please fill in all credentials"]);
      return;
    }

    if (!apiKey.startsWith("exe_")) {
      console.error("[Setup.tsx] Validation failed: API key format");
      setErrors(['API Key must start with "exe_"']);
      return;
    }

    console.log("[Setup.tsx] Validation passed, starting connection...");

    try {
      setIsConnecting(true);
      setConnectionTestResult("testing");
      setErrors([]);

      addLog({
        level: "info",
        category: "SETUP",
        message: "Fetching configuration from platform...",
      });

      // CRITICAL: Fetch config from platform using API credentials
      console.log("[Setup.tsx] Calling fetchConfigFromPlatform...");
      const configFetched = await fetchConfigFromPlatform(
        apiKey,
        apiSecret,
        platformUrl,
      );
      console.log("[Setup.tsx] fetchConfigFromPlatform result:", configFetched);

      if (!configFetched) {
        console.error("[Setup.tsx] Config fetch failed!");
        setConnectionTestResult("error");
        setErrors([
          configError || "Failed to fetch configuration from platform",
        ]);
        addLog({
          level: "error",
          category: "SETUP",
          message: configError || "Configuration fetch failed",
        });
        return;
      }
      
      console.log("[Setup.tsx] Config fetch SUCCESS! Current config:", config);

      addLog({
        level: "info",
        category: "SETUP",
        message: "✅ Configuration auto-provisioned from platform",
        metadata: {
          executorId: config.executorId,
          pusherKey: config.pusherKey ? "***" : "not set",
          pusherCluster: config.pusherCluster,
        },
      });

      // Now test connection to services with fetched config
      console.log("[Setup.tsx] Config fetch successful, calling setupComplete...");
      console.log("[Setup.tsx] Config to send:", {
        executorId: config.executorId,
        platformUrl: config.platformUrl,
        hasPusherKey: !!config.pusherKey
      });
      
      addLog({
        level: "info",
        category: "SETUP",
        message: "Testing connection to services...",
      });

      // Call setupComplete to initialize services
      console.log("[Setup.tsx] Calling window.electronAPI.setupComplete...");
      const result = await window.electronAPI?.setupComplete(config as AppConfig);
      console.log("[Setup.tsx] setupComplete result:", result);

      if (result?.success) {
        setConnectionTestResult("success");
        addLog({
          level: "info",
          category: "SETUP",
          message: "All services connected successfully",
        });
        setCurrentStep(3);
      } else {
        setConnectionTestResult("error");
        const errorMsg = result?.error || "Service connection failed";
        setErrors([errorMsg]);
        addLog({
          level: "error",
          category: "SETUP",
          message: errorMsg,
        });
      }
    } catch (error) {
      setConnectionTestResult("error");
      const errorMsg = (error as Error).message;
      setErrors([errorMsg]);
      addLog({
        level: "error",
        category: "SETUP",
        message: `Connection error: ${errorMsg}`,
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle setup completion
  const handleCompleteSetup = async () => {
    try {
      console.log('[Setup.tsx] handleCompleteSetup called');
      console.log('[Setup.tsx] Current config:', config);
      
      // Check if electronAPI is available
      if (!window.electronAPI) {
        const error = 'electronAPI not available - check preload script';
        console.error('[Setup.tsx]', error);
        setErrors([error]);
        return;
      }
      
      if (!window.electronAPI.setupComplete) {
        const error = 'setupComplete function not found in electronAPI';
        console.error('[Setup.tsx]', error);
        setErrors([error]);
        return;
      }
      
      // Set loading state
      setIsConnecting(true);
      setErrors([]);
      
      // Call setupComplete with config (this will initialize controller)
      console.log('[Setup.tsx] Calling setupComplete with config:', {
        executorId: config.executorId,
        platformUrl: config.platformUrl,
        hasPusherKey: !!config.pusherKey,
        pusherCluster: config.pusherCluster
      });
      
      const result = await window.electronAPI.setupComplete(config as AppConfig);
      console.log('[Setup.tsx] setupComplete result:', result);

      if (!result?.success) {
        const error = result?.error || 'Setup completion failed';
        console.error('[Setup.tsx] Setup failed:', error);
        setErrors([error]);
        setIsConnecting(false);
        return;
      }

      console.log('[Setup.tsx] Setup completed successfully! Reloading app...');
      setIsSetupComplete(true);

      addLog({
        level: "info",
        category: "SETUP",
        message: "Setup completed successfully",
      });
      
      // Force reload to re-initialize app with new config
      console.log('[Setup.tsx] Reloading window to apply configuration...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[Setup.tsx] Setup error caught:', error);
      console.error('[Setup.tsx] Error stack:', error instanceof Error ? error.stack : 'No stack');
      setErrors([errorMsg]);
      addLog({
        level: "error",
        category: "SETUP",
        message: `Setup completion error: ${errorMsg}`,
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // ============================================================
  // STEP 1: Welcome & Auto-Installation
  // ============================================================
  if (currentStep === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              🖥️ FX Platform Executor Setup
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Welcome! We'll automatically set up everything for you.
            </p>
          </div>

          {/* MT5 Detection Status */}
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Step 1/3: Auto-Install Components
            </h3>

            {(() => {
              console.log('=== RENDER: mt5Installations ===', mt5Installations);
              console.log('Length:', mt5Installations.length);
              console.log('Is Array?', Array.isArray(mt5Installations));
              return null;
            })()}
            
            {mt5Installations.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <StatusIndicator status="online" />
                  <span className="text-sm font-medium text-gray-600">
                    Found {mt5Installations.length} MT5 installation(s)
                  </span>
                </div>

                {mt5Installations.map((mt5: any, index: number) => (
                  <div key={index} className="text-xs text-gray-500 ml-6">
                    📍 {mt5.path} (Build {mt5.build})
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <StatusIndicator status="offline" />
                <span className="text-sm text-gray-600">
                  ❌ No MT5 installations found
                </span>
              </div>
            )}
          </div>

          {/* Auto-Installation Description */}
          <div className="card p-6 bg-blue-50 border border-blue-200">
            <p className="text-sm text-blue-900">
              📦 We'll automatically install:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>libzmq.dll (x64 & x86)</li>
                <li>Expert Advisor (ZeroMQBridge)</li>
                <li>Configuration files</li>
              </ul>
            </p>
          </div>

          {/* Auto-Installation Button */}
          {isInstalling ? (
            <div className="space-y-4">
              <LoadingSpinner text="Installing components..." />
              <div className="text-xs text-gray-500 text-center">
                {installProgress.message}
              </div>
            </div>
          ) : (
            <button
              onClick={handleAutoInstall}
              disabled={mt5Installations.length === 0}
              className="w-full btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mt5Installations.length > 0
                ? "✅ Start Auto-Installation"
                : "❌ MT5 Not Found"}
            </button>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <StatusIndicator status="error" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Errors</h3>
                  <div className="mt-2 text-sm text-red-700 space-y-1">
                    {errors.map((error, index) => (
                      <p key={index}>• {error}</p>
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

  // ============================================================
  // STEP 2: API Credentials & Auto-Provisioning
  // ============================================================
  if (currentStep === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              🔑 API Credentials
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Step 2/3: Enter your API credentials from the platform
            </p>
          </div>

          <div className="card p-6 space-y-6">
            {/* Platform URL */}
            <div>
              <label htmlFor="platformUrl" className="label">
                Platform URL
              </label>
              <input
                id="platformUrl"
                type="text"
                value={platformUrl}
                onChange={(e) => setPlatformUrl(e.target.value)}
                className="input mt-1"
                placeholder="https://fx.nusanexus.com"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave default if using our platform
              </p>
            </div>

            {/* API Key */}
            <div>
              <label htmlFor="apiKey" className="label">
                API Key
              </label>
              <input
                id="apiKey"
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="input mt-1"
                placeholder="exe_xxxxxxxxxxxxxxxx"
              />
              <p className="text-xs text-gray-500 mt-1">
                Found in your executor dashboard
              </p>
            </div>

            {/* API Secret */}
            <div>
              <label htmlFor="apiSecret" className="label">
                API Secret
              </label>
              <input
                id="apiSecret"
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                className="input mt-1"
                placeholder="••••••••••••••••"
              />
              <p className="text-xs text-gray-500 mt-1">
                Encrypted locally, never stored in plain text
              </p>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <p className="text-xs text-blue-900">
                ℹ️ Your credentials will be used to auto-fetch Pusher
                configuration and other platform settings. No manual
                configuration needed!
              </p>
            </div>

            {/* Connection Status */}
            {connectionTestResult !== "idle" && (
              <div className="flex items-center space-x-2 p-3 rounded-md bg-gray-100">
                {connectionTestResult === "success" && (
                  <>
                    <StatusIndicator status="online" />
                    <span className="text-sm font-medium text-green-700">
                      ✅ Configuration fetched & connection successful
                    </span>
                  </>
                )}
                {connectionTestResult === "testing" && (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="text-sm text-gray-700">
                      Testing connection...
                    </span>
                  </>
                )}
                {connectionTestResult === "error" && (
                  <>
                    <StatusIndicator status="error" />
                    <span className="text-sm font-medium text-red-700">
                      Connection failed
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Errors */}
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <StatusIndicator status="error" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Connection Error
                    </h3>
                    <div className="mt-2 text-sm text-red-700 space-y-1">
                      {errors.map((error, index) => (
                        <p key={index}>• {error}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={() => setCurrentStep(1)}
                className="flex-1 btn btn-secondary"
              >
                ← Back
              </button>
              <button
                onClick={() => {
                  console.log("🔘 [Setup.tsx] Button clicked!");
                  handleConnectAndFetchConfig();
                }}
                disabled={
                  isConnecting || configLoading || !apiKey || !apiSecret
                }
                className="flex-1 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {(isConnecting || configLoading) && (
                  <LoadingSpinner size="sm" />
                )}
                <span>
                  {isConnecting ? "Connecting..." : "Connect & Auto-Provision"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // STEP 3: Final Check & Auto-Start
  // ============================================================
  if (currentStep === 3) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              🎉 Ready to Trade!
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Step 3/3: Your executor is fully configured and ready.
            </p>
          </div>

          <div className="card p-6 space-y-4">
            {/* Success Checklist */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center space-x-2">
                <svg
                  className="h-5 w-5 text-green-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm font-medium text-gray-700">
                  MT5 detected & configured
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <svg
                  className="h-5 w-5 text-green-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm font-medium text-gray-700">
                  libzmq.dll installed (x64 & x86)
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <svg
                  className="h-5 w-5 text-green-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm font-medium text-gray-700">
                  Expert Advisor installed
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <svg
                  className="h-5 w-5 text-green-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm font-medium text-gray-700">
                  API connection established
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <svg
                  className="h-5 w-5 text-green-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm font-medium text-gray-700">
                  Pusher real-time connection ready
                </span>
              </div>
            </div>

            {/* Next Steps */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                What happens next:
              </h3>
              <ul className="space-y-2 text-xs text-gray-600">
                <li>
                  ✨ The Expert Advisor starts monitoring for trading signals
                </li>
                <li>📡 Real-time commands are received via Pusher</li>
                <li>🔌 ZeroMQ bridge manages all MT5 communication</li>
                <li>📊 Heartbeat keeps your connection alive</li>
              </ul>
            </div>

            {/* Configuration Summary */}
            <div className="bg-gray-50 rounded-md p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Executor ID:</span>
                <span className="font-mono font-semibold text-gray-900">
                  {config.executorId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Platform URL:</span>
                <span className="font-mono text-gray-900 truncate">
                  {config.platformUrl}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pusher Cluster:</span>
                <span className="font-mono font-semibold text-gray-900">
                  {config.pusherCluster}
                </span>
              </div>
            </div>

            {/* Start Button */}
            <button
              onClick={() => {
                console.log('🔘 Start Executor button clicked!');
                console.log('electronAPI available?', !!window.electronAPI);
                console.log('setupComplete available?', typeof window.electronAPI?.setupComplete);
                handleCompleteSetup();
              }}
              disabled={isConnecting}
              className="w-full btn btn-primary btn-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isConnecting ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Starting...</span>
                </>
              ) : (
                <span>🚀 Start Executor</span>
              )}
            </button>
            
            {/* Error Display */}
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Setup Error</h3>
                    <div className="mt-2 text-sm text-red-700 space-y-1">
                      {errors.map((err, idx) => (
                        <p key={idx}>• {err}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Build: 141953
