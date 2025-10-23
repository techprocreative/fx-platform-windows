# Source Code Templates untuk Windows Executor

Berikut adalah konten lengkap untuk semua file TypeScript yang diperlukan dalam Windows Executor Application.

## 📝 TypeScript Type Definitions

### `src/types/command.types.ts`
```typescript
export interface Command {
  id: string;
  command: string;
  parameters?: Record<string, any>;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  createdAt: string;
}

export interface CommandResult {
  success: boolean;
  ticket?: number;
  message?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface SafetyCheck {
  passed: boolean;
  warnings: string[];
  errors: string[];
}

export interface TradeParams {
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
  magicNumber?: number;
}

export interface SafetyLimits {
  maxDailyLoss: number;
  maxPositions: number;
  maxLotSize: number;
  maxDrawdownPercent: number;
}
```

### `src/types/config.types.ts`
```typescript
export interface AppConfig {
  executorId: string;
  apiKey: string;
  apiSecret: string;
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
```

## 🔧 Service Layer

### `src/services/pusher.service.ts`
```typescript
import Pusher from 'pusher-js';
import { Command } from '../types/command.types';
import { AppConfig } from '../types/config.types';

export class PusherService {
  private pusher: Pusher | null = null;
  private channel: any = null;
  private config: AppConfig | null = null;

  async connect(config: AppConfig): Promise<boolean> {
    try {
      this.config = config;
      
      this.pusher = new Pusher(config.pusherKey, {
        cluster: config.pusherCluster,
        encrypted: true,
        authEndpoint: `${config.platformUrl}/api/pusher/auth`,
        auth: {
          headers: {
            'X-API-Key': config.apiKey,
            'X-API-Secret': config.apiSecret,
          },
        },
      });

      // Subscribe to private executor channel
      this.channel = this.pusher.subscribe(`private-executor-${config.executorId}`);
      
      // Bind to command events
      this.channel.bind('command-received', this.handleCommand.bind(this));
      this.channel.bind('pusher:subscription_succeeded', () => {
        console.log('✓ Pusher connected');
      });
      
      this.channel.bind('pusher:subscription_error', (error: any) => {
        console.error('✗ Pusher connection error:', error);
      });

      return true;
    } catch (error) {
      console.error('Failed to connect to Pusher:', error);
      return false;
    }
  }

  private async handleCommand(data: Command) {
    console.log('Command received:', data);
    
    // Emit event to main process
    if (window.electronAPI) {
      window.electronAPI.onCommandReceived(data);
    }
  }

  disconnect() {
    if (this.pusher) {
      this.pusher.disconnect();
      this.pusher = null;
      this.channel = null;
    }
  }

  isConnected(): boolean {
    return this.pusher?.connection.state === 'connected';
  }
}
```

### `src/services/api.service.ts`
```typescript
import axios, { AxiosInstance } from 'axios';
import { AppConfig } from '../types/config.types';

export class ApiService {
  private client: AxiosInstance | null = null;
  private config: AppConfig | null = null;

  initialize(config: AppConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.platformUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
        'X-API-Secret': config.apiSecret,
        'User-Agent': `FX-Executor/${process.env.npm_package_version || '1.0.0'}`,
      },
    });

    // Add response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error);
        throw error;
      }
    );
  }

  async sendHeartbeat(metadata: any) {
    if (!this.client || !this.config) {
      throw new Error('API service not initialized');
    }

    try {
      const response = await this.client.post(
        `/api/executor/${this.config.executorId}/heartbeat`,
        metadata
      );
      return response.data;
    } catch (error) {
      console.error('Heartbeat failed:', error);
      throw error;
    }
  }

  async reportCommandResult(commandId: string, status: string, result: any) {
    if (!this.client || !this.config) {
      throw new Error('API service not initialized');
    }

    try {
      const response = await this.client.post(
        `/api/executor/${this.config.executorId}/command/${commandId}/result`,
        {
          status,
          result,
          timestamp: new Date().toISOString(),
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to report command result:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.client || !this.config) {
      return false;
    }

    try {
      const response = await this.client.get('/api/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}
```

### `src/services/zeromq.service.ts`
```typescript
import * as zmq from 'zeromq';
import { TradeParams, TradeResult } from '../types/command.types';
import { AppConfig } from '../types/config.types';

export class ZeroMQService {
  private socket: zmq.Socket | null = null;
  private connected = false;
  private config: AppConfig | null = null;

  async connect(config: AppConfig): Promise<boolean> {
    try {
      this.config = config;
      this.socket = new zmq.Request();
      
      await this.socket.connect(`${config.zmqHost}:${config.zmqPort}`);
      
      // Test connection
      const isConnected = await this.ping();
      this.connected = isConnected;
      
      return isConnected;
    } catch (error) {
      console.error('Failed to connect to ZeroMQ:', error);
      this.connected = false;
      return false;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const response = await this.sendRequest({ command: 'PING' });
      return response.status === 'OK';
    } catch (error) {
      return false;
    }
  }

  async openPosition(params: TradeParams): Promise<TradeResult> {
    const request = {
      command: 'OPEN_POSITION',
      ...params,
    };
    
    const response = await this.sendRequest(request);
    return response;
  }

  async closePosition(ticket: number): Promise<TradeResult> {
    const request = {
      command: 'CLOSE_POSITION',
      ticket,
    };
    
    const response = await this.sendRequest(request);
    return response;
  }

  async closeAllPositions(): Promise<TradeResult[]> {
    const request = {
      command: 'CLOSE_ALL_POSITIONS',
    };
    
    const response = await this.sendRequest(request);
    return response.results || [];
  }

  private async sendRequest(request: any, timeout: number = 5000): Promise<any> {
    if (!this.socket || !this.connected) {
      throw new Error('ZeroMQ not connected');
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, timeout);
      
      // Send request
      this.socket!.send(JSON.stringify(request));
      
      // Wait for response
      this.socket!.receive().then(([msg]) => {
        clearTimeout(timer);
        try {
          const response = JSON.parse(msg.toString());
          resolve(response);
        } catch (error) {
          reject(error);
        }
      }).catch(reject);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
```

## 🗂️ State Management

### `src/stores/app.store.ts`
```typescript
import { create } from 'zustand';
import { ConnectionStatus, LogEntry, AppConfig } from '../types/config.types';
import { MT5Info } from '../types/mt5.types';

interface AppState {
  // Connection status
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: Partial<ConnectionStatus>) => void;
  
  // Configuration
  config: AppConfig | null;
  setConfig: (config: AppConfig) => void;
  
  // MT5 installations
  mt5Installations: MT5Info[];
  setMt5Installations: (installations: MT5Info[]) => void;
  
  // Logs
  logs: LogEntry[];
  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  
  // UI state
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  
  // Application state
  isSetupComplete: boolean;
  setIsSetupComplete: (complete: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Connection status
  connectionStatus: {
    pusher: 'disconnected',
    zeromq: 'disconnected',
    api: 'disconnected',
    mt5: 'disconnected',
  },
  setConnectionStatus: (status) => set((state) => ({
    connectionStatus: { ...state.connectionStatus, ...status }
  })),
  
  // Configuration
  config: null,
  setConfig: (config) => set({ config }),
  
  // MT5 installations
  mt5Installations: [],
  setMt5Installations: (installations) => set({ mt5Installations: installations }),
  
  // Logs
  logs: [],
  addLog: (log) => set((state) => ({
    logs: [
      ...state.logs,
      {
        ...log,
        id: Date.now(),
        timestamp: new Date(),
      }
    ].slice(-1000) // Keep last 1000 logs
  })),
  clearLogs: () => set({ logs: [] }),
  
  // UI state
  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),
  
  // Application state
  isSetupComplete: false,
  setIsSetupComplete: (isSetupComplete) => set({ isSetupComplete }),
}));
```

### `src/stores/config.store.ts`
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppConfig } from '../types/config.types';

interface ConfigState {
  config: Partial<AppConfig>;
  updateConfig: (updates: Partial<AppConfig>) => void;
  resetConfig: () => void;
  isConfigured: () => boolean;
}

const defaultConfig: Partial<AppConfig> = {
  platformUrl: 'https://platform.com',
  pusherCluster: 'mt1',
  zmqPort: 5555,
  zmqHost: 'tcp://localhost',
  heartbeatInterval: 60,
  autoReconnect: true,
};

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      config: defaultConfig,
      updateConfig: (updates) => set((state) => ({
        config: { ...state.config, ...updates }
      })),
      resetConfig: () => set({ config: defaultConfig }),
      isConfigured: () => {
        const { config } = get();
        return !!(config.executorId && config.apiKey && config.apiSecret);
      },
    }),
    {
      name: 'executor-config',
    }
  )
);
```

## 🎨 React Components

### `src/app/App.tsx`
```typescript
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAppStore } from '../stores/app.store';
import { Setup } from './pages/Setup';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';
import { Logs } from './pages/Logs';
import { StatusBar } from './components/StatusBar';

function App() {
  const { isSetupComplete } = useAppStore();

  return (
    <div className="min-h-screen bg-gray-100">
      <StatusBar />
      
      <Router>
        <Routes>
          <Route 
            path="/" 
            element={isSetupComplete ? <Dashboard /> : <Setup />} 
          />
          <Route path="/settings" element={<Settings />} />
          <Route path="/logs" element={<Logs />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
```

### `src/app/pages/Setup.tsx`
```typescript
import React, { useState } from 'react';
import { useConfigStore } from '../../stores/config.store';
import { useAppStore } from '../../stores/app.store';
import { ApiService } from '../../services/api.service';

export function Setup() {
  const { config, updateConfig } = useConfigStore();
  const { setIsSetupComplete, addLog } = useAppStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleTestConnection = async () => {
    setIsConnecting(true);
    try {
      const apiService = new ApiService();
      apiService.initialize(config as any);
      
      const isConnected = await apiService.testConnection();
      if (isConnected) {
        addLog({
          level: 'info',
          category: 'setup',
          message: 'Connection test successful',
        });
        setCurrentStep(3);
      } else {
        addLog({
          level: 'error',
          category: 'setup',
          message: 'Connection test failed',
        });
      }
    } catch (error) {
      addLog({
        level: 'error',
        category: 'setup',
        message: `Connection error: ${(error as Error).message}`,
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCompleteSetup = () => {
    setIsSetupComplete(true);
    addLog({
      level: 'info',
      category: 'setup',
      message: 'Setup completed successfully',
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            FX Platform Executor Setup
          </h2>
        </div>

        {currentStep === 1 && (
          <div className="mt-8 space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900">Welcome!</h3>
              <p className="mt-2 text-sm text-gray-600">
                We'll automatically detect your MT5 installation and set up everything for you.
              </p>
            </div>
            <button
              onClick={() => setCurrentStep(2)}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Next
            </button>
          </div>
        )}

        {currentStep === 2 && (
          <div className="mt-8 space-y-6">
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">
                API Key
              </label>
              <input
                id="apiKey"
                type="text"
                value={config.apiKey || ''}
                onChange={(e) => updateConfig({ apiKey: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="Enter your API key"
              />
            </div>
            
            <div>
              <label htmlFor="apiSecret" className="block text-sm font-medium text-gray-700">
                API Secret
              </label>
              <input
                id="apiSecret"
                type="password"
                value={config.apiSecret || ''}
                onChange={(e) => updateConfig({ apiSecret: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="Enter your API secret"
              />
            </div>

            <div>
              <label htmlFor="executorId" className="block text-sm font-medium text-gray-700">
                Executor ID
              </label>
              <input
                id="executorId"
                type="text"
                value={config.executorId || ''}
                onChange={(e) => updateConfig({ executorId: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="Enter your executor ID"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setCurrentStep(1)}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Back
              </button>
              <button
                onClick={handleTestConnection}
                disabled={isConnecting || !config.apiKey || !config.apiSecret || !config.executorId}
                className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {isConnecting ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="mt-8 space-y-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Setup Complete!</h3>
              <p className="mt-2 text-sm text-gray-600">
                Your executor is ready to start trading.
              </p>
            </div>
            <button
              onClick={handleCompleteSetup}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Start Executor
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

## 📱 Entry Points

### `src/main.tsx`
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### `electron/main.ts`
```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile('dist/index.html');
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('show-save-dialog', async () => {
  // Implementation for save dialog
  return { canceled: false, filePath: '' };
});
```

### `electron/preload.ts`
```typescript
import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // File operations
  showSaveDialog: () => ipcRenderer.invoke('show-save-dialog'),
  
  // Command handling
  onCommandReceived: (callback: (command: any) => void) => {
    ipcRenderer.on('command-received', (_, command) => callback(command));
  },
  
  // System info
  getPlatform: () => process.platform,
  
  // App control
  quitApp: () => app.quit(),
  minimizeApp: () => ipcRenderer.invoke('minimize-app'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
```

## 🎨 Styles

### `src/styles/globals.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

@layer components {
  .btn {
    @apply inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50;
  }
  
  .btn-primary {
    @apply bg-primary-600 text-white hover:bg-primary-700;
  }
  
  .btn-secondary {
    @apply bg-gray-200 text-gray-900 hover:bg-gray-300;
  }
  
  .card {
    @apply rounded-lg border bg-card text-card-foreground shadow-sm;
  }
}
```

File-file ini membentuk dasar dari Windows Executor Application. Semua komponen telah dirancang untuk bekerja bersama dalam arsitektur yang terpisah dari web platform.