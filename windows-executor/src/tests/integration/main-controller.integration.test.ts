import { MainController } from '../../app/main-controller';
import { AppConfig } from '../../types/config.types';
import { DatabaseConfig } from '../../types/security.types';
import { DatabaseManager } from '../../database/manager';

// Mock dependencies
jest.mock('../../services/mt5-detector.service');
jest.mock('../../services/mt5-auto-installer.service');
jest.mock('../../services/pusher.service');
jest.mock('../../services/zeromq.service');
jest.mock('../../services/command.service');
jest.mock('../../services/heartbeat.service');
jest.mock('../../services/safety.service');
jest.mock('../../services/monitoring.service');
jest.mock('../../services/security.service');

describe('MainController Integration Tests', () => {
  let mainController: MainController;
  let config: AppConfig;
  let mockDatabaseManager: jest.Mocked<DatabaseManager>;

  beforeEach(async () => {
    // Create a mock database manager
    const dbConfig: DatabaseConfig = {
      path: ':memory:',
      encryptionKey: 'test-key',
      backupEnabled: false,
      backupInterval: 24,
      maxBackups: 0,
    };
    
    mockDatabaseManager = new DatabaseManager(dbConfig) as jest.Mocked<DatabaseManager>;
    mockDatabaseManager.initialize = jest.fn().mockResolvedValue(true);
    mockDatabaseManager.isReady = jest.fn().mockReturnValue(true);
    
    // Create main controller
    mainController = new MainController();
    
    // Create test configuration
    config = {
      executorId: 'test-executor',
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      platformUrl: 'https://test.fx.nusanexus.com',
      pusherKey: 'test-pusher-key',
      pusherCluster: 'mt1',
      zmqPort: 5555,
      zmqHost: 'tcp://localhost',
      heartbeatInterval: 60,
      autoReconnect: true,
    };
  });

  afterEach(async () => {
    // Clean up
    if (mainController) {
      await mainController.shutdown('Test cleanup');
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid config', async () => {
      // Mock MT5 detection
      const mockMT5Detector = require('../../services/mt5-detector.service');
      mockMT5Detector.MT5DetectorService.prototype.detectAllInstallations = 
        jest.fn().mockResolvedValue([
          {
            path: 'C:\\Program Files\\MetaTrader 5',
            version: '5.00.2361',
            terminalExePath: 'C:\\Program Files\\MetaTrader 5\\terminal64.exe',
            isPortable: false,
          }
        ]);
      
      // Mock auto-installer
      const mockMT5Installer = require('../../services/mt5-auto-installer.service');
      mockMT5Installer.MT5AutoInstaller.prototype.autoInstallEverything = 
        jest.fn().mockResolvedValue({
          success: true,
          mt5Installations: [],
          componentsInstalled: {
            libzmq: true,
            expertAdvisor: true,
            configFile: true,
          },
          errors: [],
        });
      
      // Mock Pusher service
      const mockPusherService = require('../../services/pusher.service');
      mockPusherService.PusherService.prototype.connect = 
        jest.fn().mockResolvedValue(true);
      
      // Mock ZeroMQ service
      const mockZeroMQService = require('../../services/zeromq.service');
      mockZeroMQService.ZeroMQService.prototype.connect = 
        jest.fn().mockResolvedValue(true);
      
      // Mock Heartbeat service
      const mockHeartbeatService = require('../../services/heartbeat.service');
      mockHeartbeatService.HeartbeatService.prototype.start = 
        jest.fn().mockResolvedValue(true);
      
      // Mock Monitoring service
      const mockMonitoringService = require('../../services/monitoring.service');
      mockMonitoringService.MonitoringService.prototype.startMonitoring = 
        jest.fn().mockResolvedValue(true);
      
      // Initialize the controller
      const result = await mainController.initialize(config);
      
      // Verify initialization was successful
      expect(result).toBe(true);
      
      // Verify status
      const status = mainController.getStatus();
      expect(status.isInitialized).toBe(true);
    });

    it('should fail initialization without MT5 installations', async () => {
      // Mock MT5 detection to return no installations
      const mockMT5Detector = require('../../services/mt5-detector.service');
      mockMT5Detector.MT5DetectorService.prototype.detectAllInstallations = 
        jest.fn().mockResolvedValue([]);
      
      // Initialize the controller
      const result = await mainController.initialize(config);
      
      // Verify initialization failed
      expect(result).toBe(false);
      
      // Verify status
      const status = mainController.getStatus();
      expect(status.isInitialized).toBe(false);
    });

    it('should fail initialization if auto-install fails', async () => {
      // Mock MT5 detection
      const mockMT5Detector = require('../../services/mt5-detector.service');
      mockMT5Detector.MT5DetectorService.prototype.detectAllInstallations = 
        jest.fn().mockResolvedValue([
          {
            path: 'C:\\Program Files\\MetaTrader 5',
            version: '5.00.2361',
            terminalExePath: 'C:\\Program Files\\MetaTrader 5\\terminal64.exe',
            isPortable: false,
          }
        ]);
      
      // Mock auto-installer to fail
      const mockMT5Installer = require('../../services/mt5-auto-installer.service');
      mockMT5Installer.MT5AutoInstaller.prototype.autoInstallEverything = 
        jest.fn().mockResolvedValue({
          success: false,
          mt5Installations: [],
          componentsInstalled: {
            libzmq: false,
            expertAdvisor: false,
            configFile: false,
          },
          errors: ['Failed to install libzmq'],
        });
      
      // Initialize the controller
      const result = await mainController.initialize(config);
      
      // Verify initialization failed
      expect(result).toBe(false);
      
      // Verify status
      const status = mainController.getStatus();
      expect(status.isInitialized).toBe(false);
    });
  });

  describe('Service Integration', () => {
    beforeEach(async () => {
      // Set up successful mocks for all services
      const mockMT5Detector = require('../../services/mt5-detector.service');
      mockMT5Detector.MT5DetectorService.prototype.detectAllInstallations = 
        jest.fn().mockResolvedValue([
          {
            path: 'C:\\Program Files\\MetaTrader 5',
            version: '5.00.2361',
            terminalExePath: 'C:\\Program Files\\MetaTrader 5\\terminal64.exe',
            isPortable: false,
          }
        ]);
      
      const mockMT5Installer = require('../../services/mt5-auto-installer.service');
      mockMT5Installer.MT5AutoInstaller.prototype.autoInstallEverything = 
        jest.fn().mockResolvedValue({
          success: true,
          mt5Installations: [],
          componentsInstalled: {
            libzmq: true,
            expertAdvisor: true,
            configFile: true,
          },
          errors: [],
        });
      
      const mockPusherService = require('../../services/pusher.service');
      mockPusherService.PusherService.prototype.connect = 
        jest.fn().mockResolvedValue(true);
      
      const mockZeroMQService = require('../../services/zeromq.service');
      mockZeroMQService.ZeroMQService.prototype.connect = 
        jest.fn().mockResolvedValue(true);
      
      const mockHeartbeatService = require('../../services/heartbeat.service');
      mockHeartbeatService.HeartbeatService.prototype.start = 
        jest.fn().mockResolvedValue(true);
      
      const mockMonitoringService = require('../../services/monitoring.service');
      mockMonitoringService.MonitoringService.prototype.startMonitoring = 
        jest.fn().mockResolvedValue(true);
      
      // Initialize the controller
      await mainController.initialize(config);
    });

    it('should start successfully after initialization', async () => {
      // Start the controller
      const result = await mainController.start();
      
      // Verify start was successful
      expect(result).toBe(true);
      
      // Verify status
      const status = mainController.getStatus();
      expect(status.connectionStatus.mt5).toBe('connected');
    });

    it('should handle command execution', async () => {
      // Mock command service
      const mockCommandService = require('../../services/command.service');
      mockCommandService.CommandService.prototype.addCommand = 
        jest.fn().mockResolvedValue('cmd-123');
      
      // Execute a command
      const command = {
        id: 'test-cmd',
        command: 'PING',
        priority: 'NORMAL' as const,
        createdAt: new Date().toISOString(),
      };
      
      const result = await mainController.executeCommand(command);
      
      // Verify command was executed
      expect(result).toBe('cmd-123');
    });

    it('should handle emergency stop', async () => {
      // Mock safety service
      const mockSafetyService = require('../../services/safety.service');
      mockSafetyService.SafetyService.prototype.emergencyStop = 
        jest.fn().mockResolvedValue(undefined);
      
      // Set up event listener
      let emergencyStopData = null;
      mainController.on('emergency-stop', (data) => {
        emergencyStopData = data;
      });
      
      // Trigger emergency stop
      await mainController.handleEmergencyStop('Test emergency stop');
      
      // Verify emergency stop was triggered
      expect(emergencyStopData).toEqual({
        reason: 'Test emergency stop',
        initiator: undefined,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      // Mock MT5 detection to throw an error
      const mockMT5Detector = require('../../services/mt5-detector.service');
      mockMT5Detector.MT5DetectorService.prototype.detectAllInstallations = 
        jest.fn().mockRejectedValue(new Error('Detection failed'));
      
      // Initialize the controller
      const result = await mainController.initialize(config);
      
      // Verify initialization failed
      expect(result).toBe(false);
      
      // Verify no crash occurred
      const status = mainController.getStatus();
      expect(status.isInitialized).toBe(false);
    });

    it('should handle service disconnection', async () => {
      // Set up successful mocks for initialization
      const mockMT5Detector = require('../../services/mt5-detector.service');
      mockMT5Detector.MT5DetectorService.prototype.detectAllInstallations = 
        jest.fn().mockResolvedValue([
          {
            path: 'C:\\Program Files\\MetaTrader 5',
            version: '5.00.2361',
            terminalExePath: 'C:\\Program Files\\MetaTrader 5\\terminal64.exe',
            isPortable: false,
          }
        ]);
      
      const mockMT5Installer = require('../../services/mt5-auto-installer.service');
      mockMT5Installer.MT5AutoInstaller.prototype.autoInstallEverything = 
        jest.fn().mockResolvedValue({
          success: true,
          mt5Installations: [],
          componentsInstalled: {
            libzmq: true,
            expertAdvisor: true,
            configFile: true,
          },
          errors: [],
        });
      
      const mockPusherService = require('../../services/pusher.service');
      mockPusherService.PusherService.prototype.connect = 
        jest.fn().mockResolvedValue(true);
      
      const mockZeroMQService = require('../../services/zeromq.service');
      mockZeroMQService.ZeroMQService.prototype.connect = 
        jest.fn().mockResolvedValue(true);
      
      const mockHeartbeatService = require('../../services/heartbeat.service');
      mockHeartbeatService.HeartbeatService.prototype.start = 
        jest.fn().mockResolvedValue(true);
      
      const mockMonitoringService = require('../../services/monitoring.service');
      mockMonitoringService.MonitoringService.prototype.startMonitoring = 
        jest.fn().mockResolvedValue(true);
      
      // Initialize the controller
      await mainController.initialize(config);
      await mainController.start();
      
      // Set up event listener
      let connectionStatusData = null;
      mainController.on('connection-status-changed', (data) => {
        connectionStatusData = data;
      });
      
      // Simulate Pusher disconnection
      const pusherService = (mainController as any).pusherService;
      pusherService.emit('connection-status', { status: 'disconnected' });
      
      // Verify connection status was updated
      expect(connectionStatusData).toBeDefined();
      expect(connectionStatusData.pusher).toBe('disconnected');
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      // Set up successful mocks for initialization
      const mockMT5Detector = require('../../services/mt5-detector.service');
      mockMT5Detector.MT5DetectorService.prototype.detectAllInstallations = 
        jest.fn().mockResolvedValue([
          {
            path: 'C:\\Program Files\\MetaTrader 5',
            version: '5.00.2361',
            terminalExePath: 'C:\\Program Files\\MetaTrader 5\\terminal64.exe',
            isPortable: false,
          }
        ]);
      
      const mockMT5Installer = require('../../services/mt5-auto-installer.service');
      mockMT5Installer.MT5AutoInstaller.prototype.autoInstallEverything = 
        jest.fn().mockResolvedValue({
          success: true,
          mt5Installations: [],
          componentsInstalled: {
            libzmq: true,
            expertAdvisor: true,
            configFile: true,
          },
          errors: [],
        });
      
      const mockPusherService = require('../../services/pusher.service');
      mockPusherService.PusherService.prototype.connect = 
        jest.fn().mockResolvedValue(true);
      mockPusherService.PusherService.prototype.forceReconnect = 
        jest.fn().mockResolvedValue(true);
      
      const mockZeroMQService = require('../../services/zeromq.service');
      mockZeroMQService.ZeroMQService.prototype.connect = 
        jest.fn().mockResolvedValue(true);
      mockZeroMQService.ZeroMQService.prototype.forceReconnect = 
        jest.fn().mockResolvedValue(true);
      
      const mockHeartbeatService = require('../../services/heartbeat.service');
      mockHeartbeatService.HeartbeatService.prototype.start = 
        jest.fn().mockResolvedValue(true);
      
      const mockMonitoringService = require('../../services/monitoring.service');
      mockMonitoringService.MonitoringService.prototype.startMonitoring = 
        jest.fn().mockResolvedValue(true);
      
      // Initialize the controller
      await mainController.initialize(config);
    });

    it('should update configuration', async () => {
      // Update configuration
      const newConfig = {
        heartbeatInterval: 30,
        autoReconnect: false,
      };
      
      const result = await mainController.updateConfig(newConfig);
      
      // Verify configuration was updated
      expect(result).toBe(true);
      
      // Verify the updated configuration
      const updatedConfig = mainController.getConfig();
      expect(updatedConfig?.heartbeatInterval).toBe(30);
      expect(updatedConfig?.autoReconnect).toBe(false);
    });

    it('should reject invalid configuration', async () => {
      // Try to update with invalid configuration
      const invalidConfig = {
        heartbeatInterval: -1, // Invalid value
      };
      
      const result = await mainController.updateConfig(invalidConfig);
      
      // Verify configuration was not updated
      expect(result).toBe(false);
      
      // Verify the original configuration is still in place
      const originalConfig = mainController.getConfig();
      expect(originalConfig?.heartbeatInterval).toBe(60);
    });
  });
});