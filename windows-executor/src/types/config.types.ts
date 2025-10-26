export interface AppConfig {
  executorId: string;
  apiKey: string;
  apiSecret: string;
  sharedSecret?: string; // For EA authentication
  platformUrl: string;
  pusherKey: string;
  pusherCluster: string;
  zmqPort: number;
  zmqHost: string;
  heartbeatInterval: number;
  autoReconnect: boolean;
}

export interface InstallProgress {
  step: number;
  message: string;
  progress?: number;
}

export interface InstallResult {
  success: boolean;
  mt5Installations: MT5Info[];
  componentsInstalled: {
    libzmq: boolean;
    expertAdvisor: boolean;
    configFile: boolean;
  };
  errors: string[];
}

export interface ConnectionStatus {
  pusher: 'connected' | 'disconnected' | 'error';
  zeromq: 'connected' | 'disconnected' | 'error';
  api: 'connected' | 'disconnected' | 'error';
  mt5: 'connected' | 'disconnected' | 'error';
}

export interface LogEntry {
  id: number;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  message: string;
  metadata?: Record<string, any>;
}

// Import MT5Info dari mt5.types
import { MT5Info } from './mt5.types';