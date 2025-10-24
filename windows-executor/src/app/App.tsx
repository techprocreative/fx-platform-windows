import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAppStore } from '../stores/app.store';
import { Setup } from './pages/Setup';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';
import { Logs } from './pages/Logs';
import { StatusBar } from '../components/StatusBar';
import { ActivityLog } from '../components/ActivityLog';
import LoadingScreen from '../components/LoadingScreen';
import NotificationContainer from '../components/NotificationContainer';

function App() {
  console.clear();
  console.log("╔═══════════════════════════════════════════════════════════════════════════════╗");
  console.log("║ 🚀🚀🚀 APP.TSX LOADED! React is running!                                      ║");
  console.log("╚═══════════════════════════════════════════════════════════════════════════════╝");

  const [, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('setup');
  
  // Zustand store
  const { 
    isConfigured, 
    setIsConfigured,
    connectionStatus,
    setConnectionStatus,
    addRecentActivity,
    updateConnectionStatus
  } = useAppStore();

  // Initialize app
  useEffect(() => {
    console.log("🔄 App useEffect triggered - initializing...");
    console.log("📍 isConfigured:", isConfigured);
    console.log("📍 currentPage:", currentPage);
    const initializeApp = async () => {
      try {
        console.log('Initializing app...');
        
        // Check if app is configured
        const config = await window.electronAPI?.getConfig();
        console.log('Config loaded:', config ? 'Yes' : 'No');
        
        if (config && config.apiKey && config.apiSecret) {
          console.log('App is configured, showing dashboard');
          setIsConfigured(true);
          setCurrentPage('dashboard');
        } else {
          console.log('App not configured, showing setup wizard');
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
      } catch (error) {
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
  const handleNavigation = (page: string) => {
    setCurrentPage(page);
    // Note: React Router navigation is handled by Link/useNavigate
  };

  // Show loading screen while initializing
  if (isLoading) {
    console.log('Rendering loading screen');
    return <LoadingScreen message="Initializing FX Executor..." />;
  }

  // Show setup wizard if not configured
  if (!isConfigured) {
    console.log('Rendering setup wizard');
    return (
      <div className="min-h-screen bg-gray-100">
        <Setup />
      </div>
    );
  }

  console.log('Rendering main app interface');

  // Main app interface (wrapped in Router context)
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

// Separate component to use useLocation inside Router context
function AppContent() {
  const location = useLocation();
  const { 
    connectionStatus,
    addRecentActivity,
  } = useAppStore();

  return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        {/* Status Bar */}
        <StatusBar 
          connectionStatus={connectionStatus}
          onNavigate={() => {}} // Not used with Router
          currentPage={location.pathname.substring(1) || 'dashboard'}
        />
        
        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 bg-white shadow-md">
            <div className="p-4">
              <h2 className="text-lg font-semibold text-gray-800">FX Executor</h2>
            </div>
            
            <nav className="mt-4">
              <ul>
                <li>
                  <Link
                    to="/dashboard"
                    className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${
                      location.pathname === '/dashboard' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link
                    to="/settings"
                    className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${
                      location.pathname === '/settings' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    Settings
                  </Link>
                </li>
                <li>
                  <Link
                    to="/logs"
                    className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${
                      location.pathname === '/logs' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    Logs
                  </Link>
                </li>
              </ul>
            </nav>
            
            {/* Activity Log (Sidebar) */}
            <div className="mt-8 border-t border-gray-200">
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-900">Recent Activity</h3>
              </div>
              <div className="px-4 pb-4">
                <ActivityLog activities={[]} limit={5} />
              </div>
            </div>
          </div>
          
          {/* Page Content */}
          <div className="flex-1 overflow-auto">
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </div>
        
        {/* Notification Container */}
        <NotificationContainer notifications={[]} onDismiss={() => {}} />
        
        {/* Toast Container */}
        <Toaster
          position="top-right"
          toastOptions={{
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
          }}
        />
      </div>
  );
}

export default App;