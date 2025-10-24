// Global type definitions for Electron IPC

export {};

declare global {
  interface Window {
    electronAPI: {
      // Status & Monitoring
      getStatus: () => Promise<any>;
      getLogs: (limit?: number) => Promise<any>;
      getConnectionStatus: () => Promise<any>;
      getMT5Installations: () => Promise<any>;
      getPerformanceMetrics: () => Promise<any>;
      getServiceStats: () => Promise<any>;
      
      // Configuration
      getConfig: () => Promise<any>;
      updateConfig: (newConfig: any) => Promise<any>;
      
      // Commands
      executeCommand: (command: any) => Promise<any>;
      cancelCommand: (commandId: string) => Promise<any>;
      getCommandStatus: (commandId: string) => Promise<any>;
      
      // Setup wizard
      setupComplete: (config: any) => Promise<any>;
      completeSetup: (config: any) => Promise<any>;
      
      // Services
      startServices: () => Promise<any>;
      
      // MT5 Operations
      detectMT5: () => Promise<any>;
      autoInstallMT5: () => Promise<any>;
      installComponents: () => Promise<any>;
      
      // Emergency controls
      emergencyStop: (reason?: string) => Promise<any>;
      restartApp: () => Promise<any>;
      
      // App controls
      minimizeApp: () => Promise<void>;
      quitApp: () => Promise<void>;
      
      // Safety Operations
      getSafetyLimits: () => Promise<any>;
      updateSafetyLimits: (limits: any) => Promise<boolean>;
      
      // Event Listeners
      onExecutorInitialized: (callback: () => void) => () => void;
      onMT5Detected: (callback: (installations: any[]) => void) => () => void;
      onMT5NotFound: (callback: () => void) => () => void;
      onAutoInstallCompleted: (callback: (result: any) => void) => () => void;
      onAutoInstallFailed: (callback: (result: any) => void) => () => void;
      onConnectionStatusChanged: (callback: (status: any) => void) => () => void;
      onLogAdded: (callback: (log: any) => void) => () => void;
      onSafetyAlert: (callback: (data: any) => void) => () => void;
      onPerformanceAlert: (callback: (data: any) => void) => () => void;
      onSecurityThreat: (callback: (data: any) => void) => () => void;
      onEmergencyStop: (callback: (data: any) => void) => () => void;
      onShowStatus: (callback: () => void) => () => void;
      
      // Legacy event listeners (for backwards compatibility)
      onStatusUpdate: (callback: (status: any) => void) => void;
      onLog: (callback: (log: any) => void) => void;
      onTrade: (callback: (trade: any) => void) => void;
      onCommand: (callback: (command: any) => void) => void;
      onAlert: (callback: (alert: any) => void) => void;
      
      // Remove listeners
      removeAllListeners: () => void;
    };
  }
}
