import { create } from 'zustand';

// Define log types
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Log {
  id: string;
  timestamp: Date;
  level: LogLevel;
  source: string;
  message: string;
  category?: string;
  metadata?: any;
}

// Define logs store interface
interface LogsState {
  logs: Log[];
  logLevels: Record<LogLevel, boolean>;
  maxLogs: number;
  autoScroll: boolean;
  
  // Actions
  addLog: (log: Omit<Log, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  setLogLevels: (levels: Record<LogLevel, boolean>) => void;
  toggleLogLevel: (level: LogLevel) => void;
  setAutoScroll: (enabled: boolean) => void;
  setMaxLogs: (max: number) => void;
  exportLogs: () => string;
}

// Create the logs store
export const useLogsStore = create<LogsState>((set) => ({
  logs: [],
  logLevels: {
    debug: true,
    info: true,
    warn: true,
    error: true,
  },
  maxLogs: 1000,
  autoScroll: true,
  
  addLog: (logData) => set((state) => {
    const newLog: Log = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      ...logData,
    };
    
    const updatedLogs = [newLog, ...state.logs];
    
    // Keep only maxLogs
    const limitedLogs = updatedLogs.slice(0, state.maxLogs);
    
    return { logs: limitedLogs };
  }),
  
  clearLogs: () => set({ logs: [] }),
  
  setLogLevels: (levels) => set({ logLevels: levels }),
  
  toggleLogLevel: (level) => set((state) => ({
    logLevels: {
      ...state.logLevels,
      [level]: !state.logLevels[level],
    }
  })),
  
  setAutoScroll: (enabled) => set({ autoScroll: enabled }),
  
  setMaxLogs: (max) => set({ maxLogs: max }),
  
  exportLogs: (): string => {
    const state: LogsState = useLogsStore.getState();
    return JSON.stringify(state.logs, null, 2);
  },
}));
