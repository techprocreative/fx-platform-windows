import { create } from 'zustand';
import { ConnectionStatus } from '../types/config.types';
import { MT5Info } from '../types/mt5.types';

// Define the app state interface
interface AppState {
  // Configuration
  isConfigured: boolean;
  
  // Connection status
  connectionStatus: ConnectionStatus;
  
  // MT5 installations
  mt5Installations: MT5Info[];
  
  // Recent activity
  recentActivity: Array<{
    id: string;
    type: 'TRADE' | 'SIGNAL' | 'ERROR' | 'INFO';
    message: string;
    timestamp: Date;
    metadata?: any;
  }>;
  
  // UI state
  currentPage: string;
  isLoading: boolean;
  
  // Actions
  setIsConfigured: (configured: boolean) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  updateConnectionStatus: (status: Partial<ConnectionStatus>) => void;
  setMT5Installations: (installations: MT5Info[]) => void;
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
}

// Create the store
export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  isConfigured: false,
  connectionStatus: {
    pusher: 'disconnected',
    zeromq: 'disconnected',
    api: 'disconnected',
    mt5: 'disconnected',
  },
  mt5Installations: [],
  recentActivity: [],
  currentPage: 'dashboard',
  isLoading: false,
  
  // Actions
  setIsConfigured: (configured) => set({ isConfigured: configured }),
  
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  
  updateConnectionStatus: (status) => set((state) => ({
    connectionStatus: { ...state.connectionStatus, ...status }
  })),
  
  setMT5Installations: (installations) => set({ mt5Installations: installations }),
  
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