/**
 * Electron API type declarations for renderer process
 */

import { AppConfig, ConnectionStatus, LogEntry } from './config.types';
import { MT5Info, InstallResult } from './mt5.types';
import { Command } from './command.types';

export interface ElectronAPI {
  // App status
  getStatus: () => Promise<any>;
  getLogs: (limit?: number) => Promise<any>;
  getConnectionStatus: () => Promise<ConnectionStatus>;
  getMT5Installations: () => Promise<MT5Info[]>;
  getPerformanceMetrics: () => Promise<any>;
  getServiceStats: () => Promise<any>;
  autoInstallMT5: () => Promise<InstallResult>;

  // Dashboard APIs (NEW)
  getMT5AccountInfo: () => Promise<any>;
  getSystemHealth: () => Promise<any>;
  getRecentSignals: (limit?: number) => Promise<any>;
  getActiveStrategies: () => Promise<any>;
  getRecentActivity: (limit?: number) => Promise<any>;
  
  // EA Attachment tracking
  notifyEAAttached: (info: { symbol: string; timeframe: string; accountNumber: string; chartId?: string }) => Promise<{ success: boolean }>;
  notifyEADetached: (info: { symbol: string; timeframe: string; accountNumber: string }) => Promise<{ success: boolean }>;
  getEAAttachments: () => Promise<any[]>;

  // Configuration
  getConfig: () => Promise<AppConfig | null>;
  updateConfig: (newConfig: Partial<AppConfig>) => Promise<boolean>;

  // Commands
  executeCommand: (command: Command) => Promise<any>;
  cancelCommand: (commandId: string) => Promise<boolean>;
  getCommandStatus: (commandId: string) => Promise<any>;

  // Setup wizard
  setupComplete: (config: AppConfig) => Promise<any>;

  // Emergency controls
  emergencyStop: (reason?: string) => Promise<void>;
  restartApp: () => void;
  
  // Window controls
  minimizeApp: () => void;
  quitApp: () => void;

  // Event listeners
  onExecutorInitialized: (callback: () => void) => () => void;
  onMT5Detected: (callback: (installations: MT5Info[]) => void) => () => void;
  onMT5NotFound: (callback: () => void) => () => void;
  onAutoInstallCompleted: (callback: (result: any) => void) => () => void;
  onAutoInstallFailed: (callback: (result: any) => void) => () => void;
  onConnectionStatusChanged: (callback: (status: ConnectionStatus) => void) => () => void;
  onLogAdded: (callback: (log: LogEntry) => void) => () => void;
  onSafetyAlert: (callback: (data: any) => void) => () => void;
  onPerformanceAlert: (callback: (data: any) => void) => () => void;
  onSecurityThreat: (callback: (data: any) => void) => () => void;
  onEmergencyStop: (callback: (data: any) => void) => () => void;
  onShowStatus: (callback: () => void) => () => void;
  removeAllListeners: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
