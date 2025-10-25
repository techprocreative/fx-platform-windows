import { create } from 'zustand';
import { ConnectionStatus, AppConfig, LogEntry } from '../types/config.types';
import { MT5Info } from '../types/mt5.types';

// Define the app state interface
interface AppState {
  // Configuration
  isConfigured: boolean;
  isSetupComplete: boolean;
  config: AppConfig | null;
  
  // Connection status
  connectionStatus: ConnectionStatus;
  
  // Trading state
  isTradingEnabled: boolean;
  isEmergencyStopActive: boolean;
  
  // MT5 installations
  mt5Installations: MT5Info[];
  
  // Performance metrics
  performanceMetrics: {
    totalTrades: number;
    winRate: number;
    profitFactor: number;
    dailyPnL: number;
    maxDrawdown: number;
  };
  
  // Active strategies
  activeStrategies: Array<{
    id: string;
    name: string;
    status: 'active' | 'paused' | 'stopped';
    pnl: number;
    pairs?: string[];
    lastSignal?: Date;
  }>;
  
  // Recent activity
  recentActivity: Array<{
    id: string;
    type: 'TRADE' | 'SIGNAL' | 'ERROR' | 'INFO';
    message: string;
    timestamp: Date;
    metadata?: any;
  }>;
  
  // Logs
  logs: LogEntry[];
  
  // UI state
  currentPage: string;
  isLoading: boolean;
  
  // Actions
  setIsConfigured: (configured: boolean) => void;
  setIsSetupComplete: (complete: boolean) => void;
  setConfig: (config: AppConfig | null) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  updateConnectionStatus: (status: Partial<ConnectionStatus>) => void;
  setIsTradingEnabled: (enabled: boolean) => void;
  setIsEmergencyStopActive: (active: boolean) => void;
  setMT5Installations: (installations: MT5Info[]) => void;
  setPerformanceMetrics: (metrics: any) => void;
  setActiveStrategies: (strategies: any[]) => void;
  setCurrentPage: (page: string) => void;
  setIsLoading: (loading: boolean) => void;
  addRecentActivity: (activity: {
    id: string;
    type: 'TRADE' | 'SIGNAL' | 'ERROR' | 'INFO';
    message: string;
    timestamp: Date;
    metadata?: any;
  }) => void;
  clearRecentActivity: () => void;
  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
}

// Create the store
export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  isConfigured: false,
  isSetupComplete: false,
  config: null,
  connectionStatus: {
    pusher: 'disconnected',
    zeromq: 'disconnected',
    api: 'disconnected',
    mt5: 'disconnected',
  },
  isTradingEnabled: false,
  isEmergencyStopActive: false,
  mt5Installations: [],
  performanceMetrics: {
    totalTrades: 0,
    winRate: 0,
    profitFactor: 0,
    dailyPnL: 0,
    maxDrawdown: 0,
  },
  activeStrategies: [],
  recentActivity: [],
  logs: [],
  currentPage: 'dashboard',
  isLoading: false,
  
  // Actions
  setIsConfigured: (configured) => set({ isConfigured: configured }),
  
  setIsSetupComplete: (complete) => set({ isSetupComplete: complete }),
  
  setConfig: (config) => set({ config }),
  
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  
  updateConnectionStatus: (status) => set((state) => ({
    connectionStatus: { ...state.connectionStatus, ...status }
  })),
  
  setIsTradingEnabled: (enabled) => set({ isTradingEnabled: enabled }),
  
  setIsEmergencyStopActive: (active) => set({ isEmergencyStopActive: active }),
  
  setMT5Installations: (installations) => set({ mt5Installations: installations }),
  
  setPerformanceMetrics: (metrics) => set({ performanceMetrics: metrics }),
  
  setActiveStrategies: (strategies) => set({ activeStrategies: strategies }),
  
  setCurrentPage: (page) => set({ currentPage: page }),
  
  setIsLoading: (loading) => set({ isLoading: loading }),
  
  addRecentActivity: (activity) => set((state) => {
    // Add new activity to the beginning of the array
    const newActivity = { ...activity, id: activity.id || Date.now().toString() };
    const updatedActivity = [newActivity, ...state.recentActivity];
    
    // Keep only the last 50 activities
    const limitedActivity = updatedActivity.slice(0, 50);
    
    return { recentActivity: limitedActivity };
  }),
  
  clearRecentActivity: () => set({ recentActivity: [] }),
  
  addLog: (log) => set((state) => {
    const newLog: LogEntry = {
      ...log,
      id: Date.now() + Math.random(),
      timestamp: new Date(),
    };
    const updatedLogs = [newLog, ...state.logs];
    
    // Keep only the last 500 logs
    const limitedLogs = updatedLogs.slice(0, 500);
    
    return { logs: limitedLogs };
  }),
  
  clearLogs: () => set({ logs: [] }),
}));

// Create a hook for accessing the store
export const useAppActions = () => useAppStore((state) => ({
  setIsConfigured: state.setIsConfigured,
  setConnectionStatus: state.setConnectionStatus,
  updateConnectionStatus: state.updateConnectionStatus,
  setMT5Installations: state.setMT5Installations,
  setCurrentPage: state.setCurrentPage,
  setIsLoading: state.setIsLoading,
  addRecentActivity: state.addRecentActivity,
  clearRecentActivity: state.clearRecentActivity,
}));

// Create hooks for specific parts of the state
export const useAppState = () => useAppStore((state) => ({
  isConfigured: state.isConfigured,
  connectionStatus: state.connectionStatus,
  mt5Installations: state.mt5Installations,
  recentActivity: state.recentActivity,
  currentPage: state.currentPage,
  isLoading: state.isLoading,
}));

export const useConnectionStatus = () => useAppStore((state) => state.connectionStatus);
export const useMT5Installations = () => useAppStore((state) => state.mt5Installations);
export const useRecentActivity = () => useAppStore((state) => state.recentActivity);
export const useCurrentPage = () => useAppStore((state) => state.currentPage);
export const useIsLoading = () => useAppStore((state) => state.isLoading);
export const useIsConfigured = () => useAppStore((state) => state.isConfigured);