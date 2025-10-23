import { create } from 'zustand';
import { LogEntry } from '../types/config.types';

interface LogsState {
  logs: LogEntry[];
  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  getLogsByLevel: (level: LogEntry['level']) => LogEntry[];
  getLogsByCategory: (category: string) => LogEntry[];
  getRecentLogs: (count: number) => LogEntry[];
  exportLogs: () => string;
  logLevels: LogEntry['level'][];
  setLogLevels: (levels: LogEntry['level'][]) => void;
  autoScroll: boolean;
  setAutoScroll: (enabled: boolean) => void;
  maxLogs: number;
  setMaxLogs: (max: number) => void;
}

export const useLogsStore = create<LogsState>((set, get) => ({
  logs: [],
  logLevels: ['debug', 'info', 'warn', 'error'],
  autoScroll: true,
  maxLogs: 1000,

  addLog: (log) => set((state) => {
    const newLog: LogEntry = {
      ...log,
      id: Date.now() + Math.random(),
      timestamp: new Date(),
    };

    const updatedLogs = [newLog, ...state.logs].slice(0, state.maxLogs);
    
    return { logs: updatedLogs };
  }),

  clearLogs: () => set({ logs: [] }),

  getLogsByLevel: (level) => {
    const { logs } = get();
    return logs.filter(log => log.level === level);
  },

  getLogsByCategory: (category) => {
    const { logs } = get();
    return logs.filter(log => log.category === category);
  },

  getRecentLogs: (count) => {
    const { logs } = get();
    return logs.slice(0, count);
  },

  exportLogs: () => {
    const { logs } = get();
    const exportData = logs.map(log => ({
      timestamp: log.timestamp.toISOString(),
      level: log.level,
      category: log.category,
      message: log.message,
      metadata: log.metadata,
    }));

    return JSON.stringify(exportData, null, 2);
  },

  setLogLevels: (levels) => set({ logLevels: levels }),

  setAutoScroll: (enabled) => set({ autoScroll: enabled }),

  setMaxLogs: (max) => set((state) => ({
    maxLogs: max,
    logs: state.logs.slice(0, max),
  })),
}));

// Helper functions for logging
export const createLogger = (category: string) => ({
  debug: (message: string, metadata?: any) => {
    useLogsStore.getState().addLog({
      level: 'debug',
      category,
      message,
      metadata,
    });
  },
  info: (message: string, metadata?: any) => {
    useLogsStore.getState().addLog({
      level: 'info',
      category,
      message,
      metadata,
    });
  },
  warn: (message: string, metadata?: any) => {
    useLogsStore.getState().addLog({
      level: 'warn',
      category,
      message,
      metadata,
    });
  },
  error: (message: string, metadata?: any) => {
    useLogsStore.getState().addLog({
      level: 'error',
      category,
      message,
      metadata,
    });
  },
});

// Predefined loggers
export const appLogger = createLogger('APP');
export const tradeLogger = createLogger('TRADE');
export const connectionLogger = createLogger('CONNECTION');
export const safetyLogger = createLogger('SAFETY');
export const mt5Logger = createLogger('MT5');