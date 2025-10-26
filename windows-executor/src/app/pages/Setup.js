import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useConfigStore } from "../../stores/config.store";
import { useAppStore } from "../../stores/app.store";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { StatusIndicator } from "../../components/StatusIndicator";
export function Setup() {
    const { config, fetchConfigFromPlatform, isLoading: configLoading, error: configError, } = useConfigStore();
    const { setIsSetupComplete, addLog, mt5Installations, setMT5Installations, setIsLoading, } = useAppStore();
    const [currentStep, setCurrentStep] = useState(1);
    const [isInstalling, setIsInstalling] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [installProgress] = useState({
        step: 0,
        message: "",
    });
    const [connectionTestResult, setConnectionTestResult] = useState("idle");
    const [errors, setErrors] = useState([]);
    // Form state for credentials input  
    const [platformUrl, setPlatformUrl] = useState("https://fx.nusanexus.com");
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
                console.log('electronAPI available?', !!window.electronAPI);
                console.log('getMT5Installations available?', typeof window.electronAPI?.getMT5Installations);
                setIsLoading(true);
                const installations = (await window.electronAPI?.getMT5Installations?.()) || [];
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
            }
            catch (error) {
                console.error('=== MT5 Detection ERROR ===', error);
                addLog({
                    level: "error",
                    category: "SETUP",
                    message: `Failed to detect MT5: ${error.message}`,
                });
            }
            finally {
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
            const result = await window.electronAPI?.autoInstallMT5?.();
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
            }
            else {
                const errorMessages = result?.errors && result.errors.length > 0
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
        }
        catch (error) {
            const errorMsg = error.message;
            setErrors([errorMsg]);
            addLog({
                level: "error",
                category: "SETUP",
                message: `Auto-installation error: ${errorMsg}`,
            });
        }
        finally {
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
            const configFetched = await fetchConfigFromPlatform(apiKey, apiSecret, platformUrl);
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
            const result = await window.electronAPI?.setupComplete(config);
            console.log("[Setup.tsx] setupComplete result:", result);
            if (result?.success) {
                setConnectionTestResult("success");
                addLog({
                    level: "info",
                    category: "SETUP",
                    message: "All services connected successfully",
                });
                setCurrentStep(3);
            }
            else {
                setConnectionTestResult("error");
                const errorMsg = result?.error || "Service connection failed";
                setErrors([errorMsg]);
                addLog({
                    level: "error",
                    category: "SETUP",
                    message: errorMsg,
                });
            }
        }
        catch (error) {
            setConnectionTestResult("error");
            const errorMsg = error.message;
            setErrors([errorMsg]);
            addLog({
                level: "error",
                category: "SETUP",
                message: `Connection error: ${errorMsg}`,
            });
        }
        finally {
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
            const result = await window.electronAPI.setupComplete(config);
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
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error('[Setup.tsx] Setup error caught:', error);
            console.error('[Setup.tsx] Error stack:', error instanceof Error ? error.stack : 'No stack');
            setErrors([errorMsg]);
            addLog({
                level: "error",
                category: "SETUP",
                message: `Setup completion error: ${errorMsg}`,
            });
        }
        finally {
            setIsConnecting(false);
        }
    };
    // ============================================================
    // STEP 1: Welcome & Auto-Installation
    // ============================================================
    if (currentStep === 1) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "max-w-md w-full space-y-8", children: [_jsxs("div", { children: [_jsx("h2", { className: "mt-6 text-center text-3xl font-extrabold text-gray-900", children: "\uD83D\uDDA5\uFE0F FX Platform Executor Setup" }), _jsx("p", { className: "mt-2 text-center text-sm text-gray-600", children: "Welcome! We'll automatically set up everything for you." })] }), _jsxs("div", { className: "card p-6", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Step 1/3: Auto-Install Components" }), (() => {
                                console.log('=== RENDER: mt5Installations ===', mt5Installations);
                                console.log('Length:', mt5Installations.length);
                                console.log('Is Array?', Array.isArray(mt5Installations));
                                return null;
                            })(), mt5Installations.length > 0 ? (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(StatusIndicator, { status: "online" }), _jsxs("span", { className: "text-sm font-medium text-gray-600", children: ["Found ", mt5Installations.length, " MT5 installation(s)"] })] }), mt5Installations.map((mt5, index) => (_jsxs("div", { className: "text-xs text-gray-500 ml-6", children: ["\uD83D\uDCCD ", mt5.path, " (Build ", mt5.build, ")"] }, index)))] })) : (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(StatusIndicator, { status: "offline" }), _jsx("span", { className: "text-sm text-gray-600", children: "\u274C No MT5 installations found" })] }))] }), _jsx("div", { className: "card p-6 bg-blue-50 border border-blue-200", children: _jsxs("p", { className: "text-sm text-blue-900", children: ["\uD83D\uDCE6 We'll automatically install:", _jsxs("ul", { className: "list-disc list-inside mt-2 space-y-1", children: [_jsx("li", { children: "libzmq.dll (x64 & x86)" }), _jsx("li", { children: "Expert Advisor (ZeroMQBridge)" }), _jsx("li", { children: "Configuration files" })] })] }) }), isInstalling ? (_jsxs("div", { className: "space-y-4", children: [_jsx(LoadingSpinner, { text: "Installing components..." }), _jsx("div", { className: "text-xs text-gray-500 text-center", children: installProgress.message })] })) : (_jsx("button", { onClick: handleAutoInstall, disabled: mt5Installations.length === 0, className: "w-full btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed", children: mt5Installations.length > 0
                            ? "✅ Start Auto-Installation"
                            : "❌ MT5 Not Found" })), errors.length > 0 && (_jsx("div", { className: "bg-red-50 border border-red-200 rounded-md p-4", children: _jsxs("div", { className: "flex", children: [_jsx("div", { className: "flex-shrink-0", children: _jsx(StatusIndicator, { status: "error" }) }), _jsxs("div", { className: "ml-3", children: [_jsx("h3", { className: "text-sm font-medium text-red-800", children: "Errors" }), _jsx("div", { className: "mt-2 text-sm text-red-700 space-y-1", children: errors.map((error, index) => (_jsxs("p", { children: ["\u2022 ", error] }, index))) })] })] }) }))] }) }));
    }
    // ============================================================
    // STEP 2: API Credentials & Auto-Provisioning
    // ============================================================
    if (currentStep === 2) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "max-w-md w-full space-y-8", children: [_jsxs("div", { children: [_jsx("h2", { className: "mt-6 text-center text-3xl font-extrabold text-gray-900", children: "\uD83D\uDD11 API Credentials" }), _jsx("p", { className: "mt-2 text-center text-sm text-gray-600", children: "Step 2/3: Enter your API credentials from the platform" })] }), _jsxs("div", { className: "card p-6 space-y-6", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "platformUrl", className: "label", children: "Platform URL" }), _jsx("input", { id: "platformUrl", type: "text", value: platformUrl, onChange: (e) => setPlatformUrl(e.target.value), className: "input mt-1", placeholder: "https://fx.nusanexus.com" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Leave default if using our platform" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "apiKey", className: "label", children: "API Key" }), _jsx("input", { id: "apiKey", type: "text", value: apiKey, onChange: (e) => setApiKey(e.target.value), className: "input mt-1", placeholder: "exe_xxxxxxxxxxxxxxxx" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Found in your executor dashboard" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "apiSecret", className: "label", children: "API Secret" }), _jsx("input", { id: "apiSecret", type: "password", value: apiSecret, onChange: (e) => setApiSecret(e.target.value), className: "input mt-1", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Encrypted locally, never stored in plain text" })] }), _jsx("div", { className: "bg-blue-50 border border-blue-200 rounded-md p-4", children: _jsx("p", { className: "text-xs text-blue-900", children: "\u2139\uFE0F Your credentials will be used to auto-fetch Pusher configuration and other platform settings. No manual configuration needed!" }) }), connectionTestResult !== "idle" && (_jsxs("div", { className: "flex items-center space-x-2 p-3 rounded-md bg-gray-100", children: [connectionTestResult === "success" && (_jsxs(_Fragment, { children: [_jsx(StatusIndicator, { status: "online" }), _jsx("span", { className: "text-sm font-medium text-green-700", children: "\u2705 Configuration fetched & connection successful" })] })), connectionTestResult === "testing" && (_jsxs(_Fragment, { children: [_jsx(LoadingSpinner, { size: "sm" }), _jsx("span", { className: "text-sm text-gray-700", children: "Testing connection..." })] })), connectionTestResult === "error" && (_jsxs(_Fragment, { children: [_jsx(StatusIndicator, { status: "error" }), _jsx("span", { className: "text-sm font-medium text-red-700", children: "Connection failed" })] }))] })), errors.length > 0 && (_jsx("div", { className: "bg-red-50 border border-red-200 rounded-md p-4", children: _jsxs("div", { className: "flex", children: [_jsx("div", { className: "flex-shrink-0", children: _jsx(StatusIndicator, { status: "error" }) }), _jsxs("div", { className: "ml-3", children: [_jsx("h3", { className: "text-sm font-medium text-red-800", children: "Connection Error" }), _jsx("div", { className: "mt-2 text-sm text-red-700 space-y-1", children: errors.map((error, index) => (_jsxs("p", { children: ["\u2022 ", error] }, index))) })] })] }) })), _jsxs("div", { className: "flex space-x-3", children: [_jsx("button", { onClick: () => setCurrentStep(1), className: "flex-1 btn btn-secondary", children: "\u2190 Back" }), _jsxs("button", { onClick: () => {
                                            console.log("🔘 [Setup.tsx] Button clicked!");
                                            handleConnectAndFetchConfig();
                                        }, disabled: isConnecting || configLoading || !apiKey || !apiSecret, className: "flex-1 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2", children: [(isConnecting || configLoading) && (_jsx(LoadingSpinner, { size: "sm" })), _jsx("span", { children: isConnecting ? "Connecting..." : "Connect & Auto-Provision" })] })] })] })] }) }));
    }
    // ============================================================
    // STEP 3: Final Check & Auto-Start
    // ============================================================
    if (currentStep === 3) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "max-w-md w-full space-y-8", children: [_jsxs("div", { children: [_jsx("h2", { className: "mt-6 text-center text-3xl font-extrabold text-gray-900", children: "\uD83C\uDF89 Ready to Trade!" }), _jsx("p", { className: "mt-2 text-center text-sm text-gray-600", children: "Step 3/3: Your executor is fully configured and ready." })] }), _jsxs("div", { className: "card p-6 space-y-4", children: [_jsxs("div", { className: "space-y-3 mb-6", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("svg", { className: "h-5 w-5 text-green-600", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" }) }), _jsx("span", { className: "text-sm font-medium text-gray-700", children: "MT5 detected & configured" })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("svg", { className: "h-5 w-5 text-green-600", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" }) }), _jsx("span", { className: "text-sm font-medium text-gray-700", children: "libzmq.dll installed (x64 & x86)" })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("svg", { className: "h-5 w-5 text-green-600", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" }) }), _jsx("span", { className: "text-sm font-medium text-gray-700", children: "Expert Advisor installed" })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("svg", { className: "h-5 w-5 text-green-600", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" }) }), _jsx("span", { className: "text-sm font-medium text-gray-700", children: "API connection established" })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("svg", { className: "h-5 w-5 text-green-600", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" }) }), _jsx("span", { className: "text-sm font-medium text-gray-700", children: "Pusher real-time connection ready" })] })] }), _jsxs("div", { className: "border-t pt-4", children: [_jsx("h3", { className: "text-sm font-medium text-gray-900 mb-3", children: "What happens next:" }), _jsxs("ul", { className: "space-y-2 text-xs text-gray-600", children: [_jsx("li", { children: "\u2728 The Expert Advisor starts monitoring for trading signals" }), _jsx("li", { children: "\uD83D\uDCE1 Real-time commands are received via Pusher" }), _jsx("li", { children: "\uD83D\uDD0C ZeroMQ bridge manages all MT5 communication" }), _jsx("li", { children: "\uD83D\uDCCA Heartbeat keeps your connection alive" })] })] }), _jsxs("div", { className: "bg-gray-50 rounded-md p-3 space-y-2 text-xs", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Executor ID:" }), _jsx("span", { className: "font-mono font-semibold text-gray-900", children: config.executorId })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Platform URL:" }), _jsx("span", { className: "font-mono text-gray-900 truncate", children: config.platformUrl })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Pusher Cluster:" }), _jsx("span", { className: "font-mono font-semibold text-gray-900", children: config.pusherCluster })] })] }), _jsx("button", { onClick: () => {
                                    console.log('🔘 Start Executor button clicked!');
                                    console.log('electronAPI available?', !!window.electronAPI);
                                    console.log('setupComplete available?', typeof window.electronAPI?.setupComplete);
                                    handleCompleteSetup();
                                }, disabled: isConnecting, className: "w-full btn btn-primary btn-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2", children: isConnecting ? (_jsxs(_Fragment, { children: [_jsxs("svg", { className: "animate-spin h-5 w-5", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), _jsx("span", { children: "Starting..." })] })) : (_jsx("span", { children: "\uD83D\uDE80 Start Executor" })) }), errors.length > 0 && (_jsx("div", { className: "bg-red-50 border border-red-200 rounded-md p-4", children: _jsxs("div", { className: "flex", children: [_jsx("div", { className: "flex-shrink-0", children: _jsx("svg", { className: "h-5 w-5 text-red-400", xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z", clipRule: "evenodd" }) }) }), _jsxs("div", { className: "ml-3", children: [_jsx("h3", { className: "text-sm font-medium text-red-800", children: "Setup Error" }), _jsx("div", { className: "mt-2 text-sm text-red-700 space-y-1", children: errors.map((err, idx) => (_jsxs("p", { children: ["\u2022 ", err] }, idx))) })] })] }) }))] })] }) }));
    }
    return null;
}
