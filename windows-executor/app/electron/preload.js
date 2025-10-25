"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Define the API that will be exposed to the renderer process
const electronAPI = {
    // App status
    getStatus: () => electron_1.ipcRenderer.invoke('get-status'),
    getLogs: (limit) => electron_1.ipcRenderer.invoke('get-logs', limit),
    getConnectionStatus: () => electron_1.ipcRenderer.invoke('get-connection-status'),
    getMT5Installations: () => electron_1.ipcRenderer.invoke('get-mt5-installations'),
    getPerformanceMetrics: () => electron_1.ipcRenderer.invoke('get-performance-metrics'),
    getServiceStats: () => electron_1.ipcRenderer.invoke('get-service-stats'),
    autoInstallMT5: () => electron_1.ipcRenderer.invoke('auto-install-mt5'),
    // Dashboard APIs (NEW)
    getMT5AccountInfo: () => electron_1.ipcRenderer.invoke('get-mt5-account-info'),
    getSystemHealth: () => electron_1.ipcRenderer.invoke('get-system-health'),
    getRecentSignals: (limit) => electron_1.ipcRenderer.invoke('get-recent-signals', limit),
    getActiveStrategies: () => electron_1.ipcRenderer.invoke('get-active-strategies'),
    getRecentActivity: (limit) => electron_1.ipcRenderer.invoke('get-recent-activity', limit),
    // EA Attachment tracking
    notifyEAAttached: (info) => electron_1.ipcRenderer.invoke('notify-ea-attached', info),
    notifyEADetached: (info) => electron_1.ipcRenderer.invoke('notify-ea-detached', info),
    getEAAttachments: () => electron_1.ipcRenderer.invoke('get-ea-attachments'),
    // Configuration
    getConfig: () => electron_1.ipcRenderer.invoke('get-config'),
    updateConfig: (newConfig) => electron_1.ipcRenderer.invoke('update-config', newConfig),
    // Commands
    executeCommand: (command) => electron_1.ipcRenderer.invoke('execute-command', command),
    cancelCommand: (commandId) => electron_1.ipcRenderer.invoke('cancel-command', commandId),
    getCommandStatus: (commandId) => electron_1.ipcRenderer.invoke('get-command-status', commandId),
    // Setup wizard
    setupComplete: (config) => electron_1.ipcRenderer.invoke('setup-complete', config),
    // Emergency controls
    emergencyStop: (reason) => electron_1.ipcRenderer.invoke('emergency-stop', reason),
    restartApp: () => electron_1.ipcRenderer.invoke('restart-app'),
    // Event listeners
    onExecutorInitialized: (callback) => {
        electron_1.ipcRenderer.on('executor-initialized', callback);
        return () => electron_1.ipcRenderer.removeListener('executor-initialized', callback);
    },
    onMT5Detected: (callback) => {
        const handler = (_, installations) => callback(installations);
        electron_1.ipcRenderer.on('mt5-detected', handler);
        return () => electron_1.ipcRenderer.removeListener('mt5-detected', handler);
    },
    onMT5NotFound: (callback) => {
        const handler = () => callback();
        electron_1.ipcRenderer.on('mt5-not-found', handler);
        return () => electron_1.ipcRenderer.removeListener('mt5-not-found', handler);
    },
    onAutoInstallCompleted: (callback) => {
        const handler = (_, result) => callback(result);
        electron_1.ipcRenderer.on('auto-install-completed', handler);
        return () => electron_1.ipcRenderer.removeListener('auto-install-completed', handler);
    },
    onAutoInstallFailed: (callback) => {
        const handler = (_, result) => callback(result);
        electron_1.ipcRenderer.on('auto-install-failed', handler);
        return () => electron_1.ipcRenderer.removeListener('auto-install-failed', handler);
    },
    onConnectionStatusChanged: (callback) => {
        const handler = (_, status) => callback(status);
        electron_1.ipcRenderer.on('connection-status-changed', handler);
        return () => electron_1.ipcRenderer.removeListener('connection-status-changed', handler);
    },
    onLogAdded: (callback) => {
        const handler = (_, log) => callback(log);
        electron_1.ipcRenderer.on('log-added', handler);
        return () => electron_1.ipcRenderer.removeListener('log-added', handler);
    },
    onSafetyAlert: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('safety-alert', handler);
        return () => electron_1.ipcRenderer.removeListener('safety-alert', handler);
    },
    onPerformanceAlert: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('performance-alert', handler);
        return () => electron_1.ipcRenderer.removeListener('performance-alert', handler);
    },
    onSecurityThreat: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('security-threat', handler);
        return () => electron_1.ipcRenderer.removeListener('security-threat', handler);
    },
    onEmergencyStop: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('emergency-stop', handler);
        return () => electron_1.ipcRenderer.removeListener('emergency-stop', handler);
    },
    onShowStatus: (callback) => {
        const handler = () => callback();
        electron_1.ipcRenderer.on('show-status', handler);
        return () => electron_1.ipcRenderer.removeListener('show-status', handler);
    },
    // Add any commands from COMMAND types here as well
    showNotification: (title, body) => {
        return electron_1.ipcRenderer.invoke('show-notification', title, body);
    },
};
// Expose the electronAPI object to the renderer process
electron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);
