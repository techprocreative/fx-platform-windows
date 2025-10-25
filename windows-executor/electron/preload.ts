import { contextBridge, ipcRenderer } from 'electron';
import { AppConfig, ConnectionStatus, LogEntry } from '../src/types/config.types';
import { MT5Info, InstallResult } from '../src/types/mt5.types';
import { Command, CommandResult } from '../src/types/command.types';

// Define the API that will be exposed to the renderer process
const electronAPI = {
  // App status
  getStatus: () => ipcRenderer.invoke('get-status'),
  getLogs: (limit?: number) => ipcRenderer.invoke('get-logs', limit),
  getConnectionStatus: () => ipcRenderer.invoke('get-connection-status'),
  getMT5Installations: () => ipcRenderer.invoke('get-mt5-installations'),
  getPerformanceMetrics: () => ipcRenderer.invoke('get-performance-metrics'),
  getServiceStats: () => ipcRenderer.invoke('get-service-stats'),
  autoInstallMT5: (): Promise<InstallResult> => ipcRenderer.invoke('auto-install-mt5'),
  
  // Dashboard APIs (NEW)
  getMT5AccountInfo: () => ipcRenderer.invoke('get-mt5-account-info'),
  getSystemHealth: () => ipcRenderer.invoke('get-system-health'),
  getRecentSignals: (limit?: number) => ipcRenderer.invoke('get-recent-signals', limit),
  getActiveStrategies: () => ipcRenderer.invoke('get-active-strategies'),
  getRecentActivity: (limit?: number) => ipcRenderer.invoke('get-recent-activity', limit),
  
  // Configuration
  getConfig: () => ipcRenderer.invoke('get-config'),
  updateConfig: (newConfig: Partial<AppConfig>) => ipcRenderer.invoke('update-config', newConfig),
  
  // Commands
  executeCommand: (command: Command) => ipcRenderer.invoke('execute-command', command),
  cancelCommand: (commandId: string) => ipcRenderer.invoke('cancel-command', commandId),
  getCommandStatus: (commandId: string) => ipcRenderer.invoke('get-command-status', commandId),
  
  // Setup wizard
  setupComplete: (config: AppConfig) => ipcRenderer.invoke('setup-complete', config),
  
  // Emergency controls
  emergencyStop: (reason?: string) => ipcRenderer.invoke('emergency-stop', reason),
  restartApp: () => ipcRenderer.invoke('restart-app'),
  
  // Event listeners
  onExecutorInitialized: (callback: () => void) => {
    ipcRenderer.on('executor-initialized', callback);
    return () => ipcRenderer.removeListener('executor-initialized', callback);
  },
  
  onMT5Detected: (callback: (installations: MT5Info[]) => void) => {
    const handler = (_: any, installations: MT5Info[]) => callback(installations);
    ipcRenderer.on('mt5-detected', handler);
    return () => ipcRenderer.removeListener('mt5-detected', handler);
  },
  
  onMT5NotFound: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('mt5-not-found', handler);
    return () => ipcRenderer.removeListener('mt5-not-found', handler);
  },
  
  onAutoInstallCompleted: (callback: (result: any) => void) => {
    const handler = (_: any, result: any) => callback(result);
    ipcRenderer.on('auto-install-completed', handler);
    return () => ipcRenderer.removeListener('auto-install-completed', handler);
  },
  
  onAutoInstallFailed: (callback: (result: any) => void) => {
    const handler = (_: any, result: any) => callback(result);
    ipcRenderer.on('auto-install-failed', handler);
    return () => ipcRenderer.removeListener('auto-install-failed', handler);
  },
  
  onConnectionStatusChanged: (callback: (status: ConnectionStatus) => void) => {
    const handler = (_: any, status: ConnectionStatus) => callback(status);
    ipcRenderer.on('connection-status-changed', handler);
    return () => ipcRenderer.removeListener('connection-status-changed', handler);
  },
  
  onLogAdded: (callback: (log: LogEntry) => void) => {
    const handler = (_: any, log: LogEntry) => callback(log);
    ipcRenderer.on('log-added', handler);
    return () => ipcRenderer.removeListener('log-added', handler);
  },
  
  onSafetyAlert: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('safety-alert', handler);
    return () => ipcRenderer.removeListener('safety-alert', handler);
  },
  
  onPerformanceAlert: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('performance-alert', handler);
    return () => ipcRenderer.removeListener('performance-alert', handler);
  },
  
  onSecurityThreat: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('security-threat', handler);
    return () => ipcRenderer.removeListener('security-threat', handler);
  },
  
  onEmergencyStop: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('emergency-stop', handler);
    return () => ipcRenderer.removeListener('emergency-stop', handler);
  },
  
  onShowStatus: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('show-status', handler);
    return () => ipcRenderer.removeListener('show-status', handler);
  },
  
  // Add any commands from COMMAND types here as well
  showNotification: (title: string, body: string) => {
    return ipcRenderer.invoke('show-notification', title, body);
  },
};

// Expose the electronAPI object to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// TypeScript declaration for the global window object
declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}

export {};
