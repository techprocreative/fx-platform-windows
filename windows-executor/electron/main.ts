import { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import * as url from 'url';
import { autoUpdater } from 'electron-updater';
import { MainController } from '../src/app/main-controller';
import { AppConfig } from '../src/types/config.types';
import Store from 'electron-store';
import { safeStorage } from 'electron';

// Initialize secure store
const store = new Store({
  name: 'fx-executor-config',
  defaults: {
    isFirstRun: true,
  },
});

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let mainController: MainController | null = null;
let isQuitting = false;

// Function to create the main window
function createWindow(): void {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, '../../resources/icons/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false, // Don't show until ready-to-show
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, main.js is in dist/electron/electron/main.js
    // index.html is in dist/index.html
    // So we need to go up 2 levels: ../../index.html
    const indexPath = path.join(__dirname, '../../index.html');
    console.log('Loading index.html from:', indexPath);
    
    mainWindow.loadURL(
      url.format({
        pathname: indexPath,
        protocol: 'file:',
        slashes: true,
      })
    );
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      console.log('Window ready to show');
      mainWindow.show();
      
      // If it's the first run, center the window
      if (store.get('isFirstRun')) {
        mainWindow.center();
        store.set('isFirstRun', false);
      }
    }
  });

  // Log errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  // Log when page finishes loading
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page finished loading');
  });

  // Open DevTools on Ctrl+Shift+I (even in production)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow?.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    // Dereference the window object
    mainWindow = null;
  });

  // Handle navigation to external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });

  // Create system tray
  createTray();
}

// Function to create system tray
function createTray(): void {
  const iconPath = path.join(__dirname, '../../resources/icons/tray-icon.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  
  // Create tray
  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  
  // Create context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show FX Executor',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Status',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('show-status');
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  
  tray.setToolTip('FX Platform Executor');
  tray.setContextMenu(contextMenu);
  
  // Handle tray click
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// Function to initialize the main controller
async function initializeMainController(): Promise<void> {
  try {
    mainController = new MainController();
    
    // Setup IPC handlers
    setupIpcHandlers();
    
    // Get stored configuration
    const config: AppConfig = getStoredConfig();
    
    // Check if this is first run (no config)
    const isFirstRun = !config.executorId || !config.apiKey;
    
    if (isFirstRun) {
      console.log('First run detected, skipping controller initialization');
      // Let the UI show setup wizard
      if (mainWindow) {
        mainWindow.webContents.send('show-setup-wizard');
      }
      return;
    }
    
    // Initialize the controller only if configured
    const initialized = await mainController.initialize(config);
    
    if (initialized) {
      // Start the controller
      await mainController.start();
      
      // Notify renderer process
      if (mainWindow) {
        mainWindow.webContents.send('executor-initialized');
      }
    } else {
      // Show error dialog
      console.error('Controller initialization returned false');
      if (mainWindow) {
        mainWindow.webContents.send('show-setup-wizard');
      }
    }
  } catch (error) {
    console.error('Failed to initialize main controller:', error);
    
    // Don't show error on first run, just show setup
    if (mainWindow) {
      mainWindow.webContents.send('show-setup-wizard');
    }
  }
}

// Function to get stored configuration
function getStoredConfig(): AppConfig {
  const defaultConfig: AppConfig = {
    executorId: '',
    apiKey: '',
    apiSecret: '',
    platformUrl: 'https://platform.com',
    pusherKey: '',
    pusherCluster: 'mt1',
    zmqPort: 5555,
    zmqHost: 'tcp://localhost',
    heartbeatInterval: 60,
    autoReconnect: true,
  };
  
  // Try to get stored config
  let storedConfig = store.get('config') as Partial<AppConfig> || {};
  
  // Decrypt API secret if it exists
  if (storedConfig.apiSecret) {
    try {
      const encrypted = Buffer.from(storedConfig.apiSecret as string, 'base64');
      storedConfig.apiSecret = safeStorage.decryptString(encrypted);
    } catch (error) {
      console.error('Failed to decrypt API secret:', error);
      storedConfig.apiSecret = '';
    }
  }
  
  // Merge with default config
  return { ...defaultConfig, ...storedConfig };
}

// Function to save configuration
function saveConfig(config: AppConfig): void {
  // Encrypt API secret
  let configToSave = { ...config };
  try {
    const encrypted = safeStorage.encryptString(config.apiSecret);
    configToSave.apiSecret = encrypted.toString('base64');
  } catch (error) {
    console.error('Failed to encrypt API secret:', error);
  }
  
  // Save to store
  store.set('config', configToSave);
}

// Setup IPC handlers
function setupIpcHandlers(): void {
  if (!mainController) return;
  
  // Get app status
  ipcMain.handle('get-status', () => {
    return mainController?.getStatus();
  });
  
  // Get logs
  ipcMain.handle('get-logs', (event, limit?: number) => {
    return mainController?.getLogs(limit);
  });
  
  // Get connection status
  ipcMain.handle('get-connection-status', () => {
    return mainController?.getConnectionStatus();
  });
  
  // Get MT5 installations
  ipcMain.handle('get-mt5-installations', async () => {
    console.log('IPC: get-mt5-installations called');
    
    try {
      // If controller not initialized or no installations cached, detect now
      if (!mainController || !mainController.getMT5Installations() || mainController.getMT5Installations().length === 0) {
        console.log('Detecting MT5 installations directly...');
        // Path from dist/electron/electron/main.js to dist/electron/src/services/
        const { MT5DetectorService } = require('../src/services/mt5-detector.service');
        const detector = new MT5DetectorService();
        const installations = await detector.detectAllInstallations();
        console.log('MT5 detection result:', installations);
        return installations;
      }
      
      const installations = mainController.getMT5Installations();
      console.log('MT5 installations from controller:', installations);
      return installations;
    } catch (error) {
      console.error('Error getting MT5 installations:', error);
      return [];
    }
  });
  
  // Get performance metrics
  ipcMain.handle('get-performance-metrics', () => {
    return mainController?.getPerformanceMetrics();
  });
  
  // Get service stats
  ipcMain.handle('get-service-stats', () => {
    return mainController?.getServiceStats();
  });
  
  // Execute command
  ipcMain.handle('execute-command', async (event, command) => {
    try {
      const result = await mainController?.executeCommand(command);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
  
  // Cancel command
  ipcMain.handle('cancel-command', (event, commandId) => {
    return mainController?.cancelCommand(commandId);
  });
  
  // Get command status
  ipcMain.handle('get-command-status', (event, commandId) => {
    return mainController?.getCommandStatus(commandId);
  });
  
  // Update configuration
  ipcMain.handle('update-config', async (event, newConfig) => {
    try {
      const success = await mainController?.updateConfig(newConfig);
      if (success) {
        // Save to store
        const currentConfig = mainController?.getConfig();
        if (currentConfig) {
          saveConfig(currentConfig);
        }
      }
      return { success };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
  
  // Get configuration
  ipcMain.handle('get-config', () => {
    return mainController?.getConfig();
  });
  
  // Setup wizard events
  ipcMain.handle('setup-complete', async (event, config) => {
    try {
      // Save config
      saveConfig(config);
      
      // Reinitialize controller with new config
      if (mainController) {
        await mainController.stop();
        const initialized = await mainController.initialize(config);
        if (initialized) {
          await mainController.start();
          return { success: true };
        }
      }
      return { success: false, error: 'Failed to reinitialize controller' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
  
  // Emergency stop
  ipcMain.handle('emergency-stop', async (event, reason) => {
    try {
      // This would trigger the emergency stop in the controller
      if (mainWindow) {
        mainWindow.webContents.send('emergency-stop-activated', { reason });
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
  
  // Restart app
  ipcMain.handle('restart-app', () => {
    app.relaunch();
    app.exit();
  });
  
  // Setup controller event forwarding to renderer
  mainController.on('initialized', () => {
    if (mainWindow) {
      mainWindow.webContents.send('executor-initialized');
    }
  });
  
  mainController.on('mt5-detected', (installations) => {
    if (mainWindow) {
      mainWindow.webContents.send('mt5-detected', installations);
    }
  });
  
  mainController.on('mt5-not-found', () => {
    if (mainWindow) {
      mainWindow.webContents.send('mt5-not-found');
    }
  });
  
  mainController.on('auto-install-completed', (result) => {
    if (mainWindow) {
      mainWindow.webContents.send('auto-install-completed', result);
    }
  });
  
  mainController.on('auto-install-failed', (result) => {
    if (mainWindow) {
      mainWindow.webContents.send('auto-install-failed', result);
    }
  });
  
  mainController.on('connection-status-changed', (status) => {
    if (mainWindow) {
      mainWindow.webContents.send('connection-status-changed', status);
    }
  });
  
  mainController.on('log-added', (log) => {
    if (mainWindow) {
      mainWindow.webContents.send('log-added', log);
    }
  });
  
  mainController.on('safety-alert', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('safety-alert', data);
    }
  });
  
  mainController.on('performance-alert', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('performance-alert', data);
    }
  });
  
  mainController.on('security-threat', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('security-threat', data);
    }
  });
  
  mainController.on('emergency-stop', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('emergency-stop', data);
    }
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Create window
  createWindow();
  
  // Initialize main controller
  initializeMainController();
  
  // Setup auto-updater (disabled for local builds)
  // setupAutoUpdater();
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Before quitting
app.on('before-quit', () => {
  isQuitting = true;
  
  // Cleanup services
  try {
    if (mainController) {
      mainController.removeAllListeners();
      mainController.shutdown('App quitting').catch(console.error);
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  // Handle navigation to external links
  contents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
});

// Handle protocol for deep linking
app.setAsDefaultProtocolClient('fx-executor');

// Handle second instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Setup auto-updater
function setupAutoUpdater(): void {
  // Configure auto-updater
  autoUpdater.checkForUpdatesAndNotify();
  
  autoUpdater.on('update-available', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: 'A new version is available. Download now?',
      buttons: ['Yes', 'No'],
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });
  
  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded. The application will restart now.',
      buttons: ['OK'],
    }).then(() => {
      autoUpdater.quitAndInstall();
    });
  });
  
  autoUpdater.on('error', (error) => {
    console.error('Auto-updater error:', error);
  });
}