import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAppStore } from '../stores/app.store';
import { Setup } from './pages/Setup';
import { DashboardSimple } from './pages/DashboardSimple';
import { Settings } from './pages/Settings';
import { Logs } from './pages/Logs';
import { StatusBar } from '../components/StatusBar';
import LoadingScreen from '../components/LoadingScreen';
function App() {
    // console.clear(); // Commented out to preserve debug logs
    console.log("╔═══════════════════════════════════════════════════════════════════════════════╗");
    console.log("║ 🚀🚀🚀 APP.TSX LOADED! React is running!                                      ║");
    console.log("╚═══════════════════════════════════════════════════════════════════════════════╝");
    const [, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState('setup');
    // Zustand store
    const { isConfigured, setIsConfigured, connectionStatus, setConnectionStatus, addRecentActivity, updateConnectionStatus } = useAppStore();
    // Initialize app
    useEffect(() => {
        console.log("🔄 App useEffect triggered - initializing...");
        console.log("📍 isConfigured:", isConfigured);
        console.log("📍 currentPage:", currentPage);
        const initializeApp = async () => {
            try {
                console.log('Initializing app...');
                // Check if app is configured with VALID config
                const config = await window.electronAPI?.getConfig();
                console.log('Config loaded:', config ? 'Yes' : 'No', config);
                // Config is loaded, no need to store locally since we check validity directly
                // More thorough validation - check all required fields
                const isValidConfig = config &&
                    config.apiKey &&
                    config.apiSecret &&
                    config.platformUrl &&
                    config.executorId;
                if (isValidConfig) {
                    console.log('App has valid config, showing dashboard');
                    setIsConfigured(true);
                    setCurrentPage('dashboard');
                }
                else {
                    console.log('App not configured or config invalid, showing setup wizard');
                    console.log('Config details:', {
                        hasApiKey: !!config?.apiKey,
                        hasApiSecret: !!config?.apiSecret,
                        hasPlatformUrl: !!config?.platformUrl,
                        hasExecutorId: !!config?.executorId
                    });
                    setIsConfigured(false);
                    setCurrentPage('setup');
                }
                // Set up event listeners
                setupEventListeners();
                // Check initial status
                const status = await window.electronAPI?.getStatus();
                if (status) {
                    setConnectionStatus(status.connectionStatus);
                }
                setIsLoading(false);
                console.log('App initialization complete');
            }
            catch (error) {
                console.error('Failed to initialize app:', error);
                setIsLoading(false);
            }
        };
        initializeApp();
    }, [setIsConfigured, setConnectionStatus]);
    // Setup event listeners
    const setupEventListeners = () => {
        // Listen for executor initialization
        const unsubscribeInitialized = window.electronAPI?.onExecutorInitialized(() => {
            setIsInitialized(true);
            addRecentActivity({
                id: Date.now().toString(),
                type: 'INFO',
                message: 'Executor initialized successfully',
                timestamp: new Date(),
            });
        });
        // Listen for connection status changes
        const unsubscribeConnectionStatus = window.electronAPI?.onConnectionStatusChanged((status) => {
            updateConnectionStatus(status);
            // Add activity log
            const allConnected = Object.values(status).every(s => s === 'connected');
            addRecentActivity({
                id: Date.now().toString(),
                type: allConnected ? 'INFO' : 'ERROR',
                message: allConnected
                    ? 'All services connected'
                    : 'Some services disconnected',
                timestamp: new Date(),
                metadata: { connectionStatus: status },
            });
        });
        // Listen for safety alerts
        const unsubscribeSafetyAlert = window.electronAPI?.onSafetyAlert((data) => {
            addRecentActivity({
                id: Date.now().toString(),
                type: 'ERROR',
                message: 'Safety alert triggered',
                timestamp: new Date(),
                metadata: data,
            });
        });
        // Listen for emergency stop
        const unsubscribeEmergencyStop = window.electronAPI?.onEmergencyStop((data) => {
            addRecentActivity({
                id: Date.now().toString(),
                type: 'ERROR',
                message: `Emergency stop activated: ${data.reason || 'Unknown reason'}`,
                timestamp: new Date(),
                metadata: data,
            });
        });
        // Listen for performance alerts
        const unsubscribePerformanceAlert = window.electronAPI?.onPerformanceAlert((data) => {
            addRecentActivity({
                id: Date.now().toString(),
                type: 'INFO',
                message: 'Performance alert',
                timestamp: new Date(),
                metadata: data,
            });
        });
        // Listen for security threats
        const unsubscribeSecurityThreat = window.electronAPI?.onSecurityThreat((data) => {
            addRecentActivity({
                id: Date.now().toString(),
                type: 'ERROR',
                message: 'Security threat detected',
                timestamp: new Date(),
                metadata: data,
            });
        });
        // Listen for log entries
        const unsubscribeLogAdded = window.electronAPI?.onLogAdded((log) => {
            // Only add important logs to activity
            if (log.level === 'error' || log.level === 'warn') {
                addRecentActivity({
                    id: log.id.toString(),
                    type: log.level === 'error' ? 'ERROR' : 'INFO',
                    message: log.message,
                    timestamp: log.timestamp,
                    metadata: { category: log.category, ...log.metadata },
                });
            }
        });
        // Cleanup function
        return () => {
            unsubscribeInitialized?.();
            unsubscribeConnectionStatus?.();
            unsubscribeSafetyAlert?.();
            unsubscribeEmergencyStop?.();
            unsubscribePerformanceAlert?.();
            unsubscribeSecurityThreat?.();
            unsubscribeLogAdded?.();
        };
    };
    // Handle page navigation (not needed with React Router, but kept for StatusBar compatibility)
    const handleNavigation = (page) => {
        setCurrentPage(page);
        // Note: React Router navigation is handled by Link/useNavigate
    };
    // Show loading screen while initializing
    if (isLoading) {
        console.log('Rendering loading screen');
        return _jsx(LoadingScreen, { message: "Initializing FX Executor..." });
    }
    // Show setup wizard if not configured
    if (!isConfigured) {
        console.log('Rendering setup wizard');
        return (_jsx("div", { className: "min-h-screen bg-gray-100", children: _jsx(Setup, {}) }));
    }
    // Main app interface (wrapped in HashRouter for Electron compatibility)
    return (_jsx(Router, { children: _jsx(AppContent, {}) }));
}
// Separate component to use useLocation inside Router context
function AppContent() {
    const { connectionStatus, } = useAppStore();
    return (_jsxs("div", { className: "h-screen flex flex-col bg-gray-50", children: [_jsx(StatusBar, { connectionStatus: connectionStatus, onNavigate: () => { }, currentPage: "dashboard" }), _jsx("div", { className: "flex-1 overflow-auto", children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(DashboardSimple, {}) }), _jsx(Route, { path: "/dashboard", element: _jsx(DashboardSimple, {}) }), _jsx(Route, { path: "/settings", element: _jsx(Settings, {}) }), _jsx(Route, { path: "/logs", element: _jsx(Logs, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }) }), _jsx(Toaster, { position: "top-right", toastOptions: {
                    duration: 4000,
                    style: {
                        background: '#363636',
                        color: '#fff',
                    },
                    success: {
                        duration: 3000,
                        iconTheme: {
                            primary: '#4ade80',
                            secondary: '#fff',
                        },
                    },
                    error: {
                        duration: 5000,
                        iconTheme: {
                            primary: '#ef4444',
                            secondary: '#fff',
                        },
                    },
                } })] }));
}
export default App;
