// Global type definitions for Electron IPC

export {};

declare global {
  interface Window {
    electronAPI: {
      // Configuration
      getConfig: () => Promise<any>;
      saveConfig: (config: any) => Promise<boolean>;
      
      // MT5 Operations
      detectMT5: () => Promise<any>;
      installComponents: () => Promise<any>;
      
      // Connection Operations
      connect: () => Promise<boolean>;
      disconnect: () => Promise<void>;
      
      // Command Operations
      sendCommand: (command: any) => Promise<any>;
      
      // Safety Operations
      emergencyStop: () => Promise<void>;
      getSafetyLimits: () => Promise<any>;
      updateSafetyLimits: (limits: any) => Promise<boolean>;
      
      // Monitoring
      getStatus: () => Promise<any>;
      getMetrics: () => Promise<any>;
      getLogs: (filters?: any) => Promise<any[]>;
      
      // Event Listeners
      onStatusUpdate: (callback: (status: any) => void) => void;
      onLog: (callback: (log: any) => void) => void;
      onTrade: (callback: (trade: any) => void) => void;
      onCommand: (callback: (command: any) => void) => void;
      onAlert: (callback: (alert: any) => void) => void;
      
      // Remove listeners
      removeAllListeners: (channel: string) => void;
    };
  }
}
