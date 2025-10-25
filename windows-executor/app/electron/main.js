"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const url = __importStar(require("url"));
const electron_updater_1 = require("electron-updater");
const main_controller_1 = require("../src/app/main-controller");
const electron_store_1 = __importDefault(require("electron-store"));
const electron_2 = require("electron");
const fs_1 = require("fs");
// Initialize secure store
const store = new electron_store_1.default({
    name: 'fx-executor-config',
    defaults: {
        isFirstRun: true,
    },
});
// Keep a global reference of the window object
let mainWindow = null;
let tray = null;
let mainController = null;
let isQuitting = false;
// Function to create the main window
function createWindow() {
    // Create the browser window
    mainWindow = new electron_1.BrowserWindow({
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
    }
    else {
        // In production, main.js is in dist/electron/electron/main.js
        // index.html is in dist-app/index.html
        // Use absolute path to avoid confusion
        const indexPath = path.join(__dirname, '../dist-app/index.html');
        console.log('Loading index.html from:', indexPath);
        console.log('__dirname:', __dirname);
        if ((0, fs_1.existsSync)(indexPath)) {
            mainWindow.loadFile(indexPath).catch((error) => {
                console.error('Failed to load index.html via loadFile:', error);
            });
        }
        else {
            const fallbackPath = path.join(process.resourcesPath, 'dist-app', 'index.html');
            console.warn('Primary index.html not found, attempting fallback path:', fallbackPath);
            mainWindow.loadURL(url.format({
                pathname: fallbackPath,
                protocol: 'file:',
                slashes: true,
            }));
        }
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
function createTray() {
    const iconPath = path.join(__dirname, '../../resources/icons/tray-icon.png');
    const trayIcon = electron_1.nativeImage.createFromPath(iconPath);
    // Create tray
    tray = new electron_1.Tray(trayIcon.resize({ width: 16, height: 16 }));
    // Create context menu
    const contextMenu = electron_1.Menu.buildFromTemplate([
        {
            label: 'Show FX Executor',
            click: () => {
                if (mainWindow) {
                    if (mainWindow.isMinimized())
                        mainWindow.restore();
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
                electron_1.app.quit();
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
            }
            else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });
}
// Function to initialize the main controller
async function initializeMainController() {
    try {
        mainController = new main_controller_1.MainController();
        // Setup IPC handlers
        setupIpcHandlers();
        // Get stored configuration
        const config = getStoredConfig();
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
        }
        else {
            // Show error dialog
            console.error('Controller initialization returned false');
            if (mainWindow) {
                mainWindow.webContents.send('show-setup-wizard');
            }
        }
    }
    catch (error) {
        console.error('Failed to initialize main controller:', error);
        // Don't show error on first run, just show setup
        if (mainWindow) {
            mainWindow.webContents.send('show-setup-wizard');
        }
    }
}
// Function to get stored configuration
function getStoredConfig() {
    const defaultConfig = {
        executorId: '',
        apiKey: '',
        apiSecret: '',
        platformUrl: 'https://fx.nusanexus.com',
        pusherKey: '',
        pusherCluster: 'ap1', // Changed from 'mt1' to 'ap1'
        zmqPort: 5555,
        zmqHost: 'tcp://localhost',
        heartbeatInterval: 60,
        autoReconnect: true,
    };
    // Try to get stored config - prioritize stored values over defaults
    let storedConfig = store.get('config') || {};
    // IMPORTANT: Don't override saved config with defaults
    // Only use defaults for missing keys
    // Decrypt API secret if it exists
    if (storedConfig.apiSecret) {
        try {
            const encrypted = Buffer.from(storedConfig.apiSecret, 'base64');
            storedConfig.apiSecret = electron_2.safeStorage.decryptString(encrypted);
        }
        catch (error) {
            console.error('Failed to decrypt API secret:', error);
            storedConfig.apiSecret = '';
        }
    }
    // Merge with default config
    return { ...defaultConfig, ...storedConfig };
}
// Function to save configuration
function saveConfig(config) {
    // Encrypt API secret
    let configToSave = { ...config };
    try {
        const encrypted = electron_2.safeStorage.encryptString(config.apiSecret);
        configToSave.apiSecret = encrypted.toString('base64');
    }
    catch (error) {
        console.error('Failed to encrypt API secret:', error);
    }
    // Save to store
    store.set('config', configToSave);
}
// Setup IPC handlers
function setupIpcHandlers() {
    if (!mainController)
        return;
    // Get app status
    electron_1.ipcMain.handle('get-status', () => {
        return mainController?.getStatus();
    });
    // Get logs
    electron_1.ipcMain.handle('get-logs', (event, limit) => {
        return mainController?.getLogs(limit);
    });
    // Get connection status
    electron_1.ipcMain.handle('get-connection-status', () => {
        return mainController?.getConnectionStatus();
    });
    // Get MT5 installations
    electron_1.ipcMain.handle('get-mt5-installations', async () => {
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
        }
        catch (error) {
            console.error('Error getting MT5 installations:', error);
            return [];
        }
    });
    // Trigger MT5 auto-installation
    electron_1.ipcMain.handle('auto-install-mt5', async () => {
        if (!mainController) {
            return {
                success: false,
                mt5Installations: [],
                componentsInstalled: {
                    libzmq: false,
                    expertAdvisor: false,
                    configFile: false,
                },
                errors: ['Main controller not initialized'],
                warnings: [],
            };
        }
        try {
            return await mainController.autoInstallMT5();
        }
        catch (error) {
            console.error('Auto-install IPC error:', error);
            return {
                success: false,
                mt5Installations: [],
                componentsInstalled: {
                    libzmq: false,
                    expertAdvisor: false,
                    configFile: false,
                },
                errors: [error.message || 'Auto-installation failed'],
                warnings: [],
            };
        }
    });
    // Get performance metrics
    electron_1.ipcMain.handle('get-performance-metrics', () => {
        return mainController?.getPerformanceMetrics();
    });
    // Get service stats
    electron_1.ipcMain.handle('get-service-stats', () => {
        return mainController?.getServiceStats();
    });
    // Get MT5 account info
    electron_1.ipcMain.handle('get-mt5-account-info', async () => {
        return await mainController?.getMT5AccountInfo();
    });
    // Get system health
    electron_1.ipcMain.handle('get-system-health', () => {
        return mainController?.getSystemHealth();
    });
    // Get recent signals
    electron_1.ipcMain.handle('get-recent-signals', (event, limit) => {
        return mainController?.getRecentSignals(limit);
    });
    // Get active strategies
    electron_1.ipcMain.handle('get-active-strategies', () => {
        return mainController?.getActiveStrategies();
    });
    // Get recent activity
    electron_1.ipcMain.handle('get-recent-activity', (event, limit) => {
        return mainController?.getRecentActivity(limit);
    });
    // Execute command
    electron_1.ipcMain.handle('execute-command', async (event, command) => {
        try {
            const result = await mainController?.executeCommand(command);
            return { success: true, result };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // Cancel command
    electron_1.ipcMain.handle('cancel-command', (event, commandId) => {
        return mainController?.cancelCommand(commandId);
    });
    // Get command status
    electron_1.ipcMain.handle('get-command-status', (event, commandId) => {
        return mainController?.getCommandStatus(commandId);
    });
    // Update configuration
    electron_1.ipcMain.handle('update-config', async (event, newConfig) => {
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
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // Get configuration
    electron_1.ipcMain.handle('get-config', () => {
        return mainController?.getConfig();
    });
    // Setup wizard events
    electron_1.ipcMain.handle('setup-complete', async (event, config) => {
        try {
            console.log('[setup-complete] Starting setup with config:', {
                executorId: config.executorId,
                platformUrl: config.platformUrl,
                hasPusherKey: !!config.pusherKey
            });
            // Save config
            saveConfig(config);
            console.log('[setup-complete] Config saved');
            // Reinitialize controller with new config
            if (!mainController) {
                console.error('[setup-complete] Main controller not initialized!');
                return { success: false, error: 'Main controller not initialized' };
            }
            console.log('[setup-complete] Stopping controller...');
            try {
                await mainController.stop();
                console.log('[setup-complete] Controller stopped successfully');
            }
            catch (stopError) {
                console.warn('[setup-complete] Stop failed (may not be running):', stopError);
                // Continue anyway - it's OK if controller wasn't running
            }
            console.log('[setup-complete] Initializing with new config...');
            const initialized = await mainController.initialize(config);
            if (!initialized) {
                console.error('[setup-complete] Controller initialization failed');
                return { success: false, error: 'Controller initialization failed' };
            }
            console.log('[setup-complete] Starting controller...');
            await mainController.start();
            console.log('[setup-complete] Setup complete successfully!');
            return { success: true };
        }
        catch (error) {
            console.error('[setup-complete] Error:', error);
            return { success: false, error: error.message };
        }
    });
    // Emergency stop
    electron_1.ipcMain.handle('emergency-stop', async (event, reason) => {
        try {
            // This would trigger the emergency stop in the controller
            if (mainWindow) {
                mainWindow.webContents.send('emergency-stop-activated', { reason });
            }
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // Restart app
    electron_1.ipcMain.handle('restart-app', () => {
        electron_1.app.relaunch();
        electron_1.app.exit();
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
electron_1.app.whenReady().then(() => {
    // Create window
    createWindow();
    // Initialize main controller
    initializeMainController();
    // Setup auto-updater (disabled for local builds)
    // setupAutoUpdater();
});
// Quit when all windows are closed
electron_1.app.on('window-all-closed', () => {
    // On macOS, keep app running even when all windows are closed
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
// Before quitting
electron_1.app.on('before-quit', () => {
    isQuitting = true;
    // Cleanup services
    try {
        if (mainController) {
            mainController.removeAllListeners();
            mainController.shutdown('App quitting').catch(console.error);
        }
    }
    catch (error) {
        console.error('Error during cleanup:', error);
    }
});
// Security: Prevent new window creation
electron_1.app.on('web-contents-created', (event, contents) => {
    // Handle navigation to external links
    contents.setWindowOpenHandler(({ url }) => {
        require('electron').shell.openExternal(url);
        return { action: 'deny' };
    });
});
// Handle protocol for deep linking
electron_1.app.setAsDefaultProtocolClient('fx-executor');
// Handle second instance
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    electron_1.app.quit();
}
else {
    electron_1.app.on('second-instance', () => {
        // Someone tried to run a second instance, focus our window
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.focus();
        }
    });
}
// Setup auto-updater
function setupAutoUpdater() {
    // Configure auto-updater
    electron_updater_1.autoUpdater.checkForUpdatesAndNotify();
    electron_updater_1.autoUpdater.on('update-available', () => {
        electron_1.dialog.showMessageBox({
            type: 'info',
            title: 'Update Available',
            message: 'A new version is available. Download now?',
            buttons: ['Yes', 'No'],
        }).then((result) => {
            if (result.response === 0) {
                electron_updater_1.autoUpdater.downloadUpdate();
            }
        });
    });
    electron_updater_1.autoUpdater.on('update-downloaded', () => {
        electron_1.dialog.showMessageBox({
            type: 'info',
            title: 'Update Ready',
            message: 'Update downloaded. The application will restart now.',
            buttons: ['OK'],
        }).then(() => {
            electron_updater_1.autoUpdater.quitAndInstall();
        });
    });
    electron_updater_1.autoUpdater.on('error', (error) => {
        console.error('Auto-updater error:', error);
    });
}
