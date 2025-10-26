import { create } from 'zustand';
// Create the logs store
export const useLogsStore = create((set) => ({
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
        const newLog = {
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
    exportLogs: () => {
        const state = useLogsStore.getState();
        return JSON.stringify(state.logs, null, 2);
    },
}));
