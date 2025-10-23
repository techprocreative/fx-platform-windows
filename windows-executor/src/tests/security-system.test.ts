import { SafetyService } from '../services/safety.service';
import { SecurityService } from '../services/security.service';
import { MonitoringService } from '../services/monitoring.service';
import { DatabaseManager } from '../database/manager';
import { CryptoUtils } from '../utils/crypto';
import { createLogger } from '../utils/logger';
import { 
  SafetyLimits, 
  TradeParams, 
  MonitoringMetrics, 
  SecurityConfig,
  CredentialStorage,
  SecuritySession
} from '../types/security.types';

// Mock implementations
const mockDatabaseManager = {
  initialize: jest.fn().mockResolvedValue(true),
  saveConfig: jest.fn().mockResolvedValue(true),
  getConfig: jest.fn().mockResolvedValue(null),
  saveSecurityEvent: jest.fn().mockResolvedValue(true),
  savePerformanceMetrics: jest.fn().mockResolvedValue(true),
  saveSecuritySession: jest.fn().mockResolvedValue(true),
  getSecuritySession: jest.fn().mockResolvedValue(null),
  saveRateLimitEntry: jest.fn().mockResolvedValue(true),
  getRateLimitEntry: jest.fn().mockResolvedValue(null),
  saveAuditLog: jest.fn().mockResolvedValue(true),
  cleanupOldRecords: jest.fn().mockResolvedValue(),
  backup: jest.fn().mockResolvedValue(true),
  close: jest.fn().mockResolvedValue(),
  isReady: jest.fn().mockReturnValue(true),
  getStats: jest.fn().mockResolvedValue({}),
} as any;

const mockLogger = createLogger('test');

describe('Security System Tests', () => {
  let safetyService: SafetyService;
  let securityService: SecurityService;
  let monitoringService: MonitoringService;
  let encryptionKey: string;

  beforeAll(async () => {
    encryptionKey = CryptoUtils.generateKey();
    
    // Initialize services
    safetyService = new SafetyService(mockDatabaseManager);
    securityService = new SecurityService(mockDatabaseManager, encryptionKey);
    monitoringService = new MonitoringService(mockDatabaseManager);
    
    // Initialize services
    await safetyService.checkBeforeTrade({} as TradeParams, {} as MonitoringMetrics);
    await securityService.initialize();
    await monitoringService.startMonitoring();
  });

  afterAll(async () => {
    await monitoringService.stopMonitoring();
    await mockDatabaseManager.close();
  });

  describe('SafetyService', () => {
    describe('checkBeforeTrade', () => {
      it('should pass safety check for valid trade parameters', async () => {
        const tradeParams: TradeParams = {
          symbol: 'EURUSD',
          type: 'BUY',
          volume: 0.01,
          stopLoss: 1.0900,
          takeProfit: 1.1000,
        };

        const metrics: MonitoringMetrics = {
          system: { cpuUsage: 50, memoryUsage: 60, diskUsage: 40, networkLatency: 100 },
          trading: { dailyPnL: 100, openPositions: 2, totalTrades: 10, winRate: 70, averageTradeDuration: 300 },
          connections: {
            pusher: { connected: true, reconnectAttempts: 0 },
            zeromq: { connected: true, reconnectAttempts: 0 },
            mt5: { connected: true, reconnectAttempts: 0 },
            api: { connected: true, reconnectAttempts: 0 },
          },
          performance: { commandQueueSize: 0, averageExecutionTime: 200, errorRate: 0, uptime: 3600000 },
        };

        const result = await safetyService.checkBeforeTrade(tradeParams, metrics);

        expect(result.passed).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should fail safety check when daily loss limit exceeded', async () => {
        const tradeParams: TradeParams = {
          symbol: 'EURUSD',
          type: 'BUY',
          volume: 0.01,
        };

        const metrics: MonitoringMetrics = {
          system: { cpuUsage: 50, memoryUsage: 60, diskUsage: 40, networkLatency: 100 },
          trading: { dailyPnL: -600, openPositions: 2, totalTrades: 10, winRate: 70, averageTradeDuration: 300 },
          connections: {
            pusher: { connected: true, reconnectAttempts: 0 },
            zeromq: { connected: true, reconnectAttempts: 0 },
            mt5: { connected: true, reconnectAttempts: 0 },
            api: { connected: true, reconnectAttempts: 0 },
          },
          performance: { commandQueueSize: 0, averageExecutionTime: 200, errorRate: 0, uptime: 3600000 },
        };

        const result = await safetyService.checkBeforeTrade(tradeParams, metrics);

        expect(result.passed).toBe(false);
        expect(result.errors).toContain('Daily loss limit exceeded: $600.00 > $500');
      });

      it('should fail safety check when maximum positions reached', async () => {
        const tradeParams: TradeParams = {
          symbol: 'EURUSD',
          type: 'BUY',
          volume: 0.01,
        };

        const metrics: MonitoringMetrics = {
          system: { cpuUsage: 50, memoryUsage: 60, diskUsage: 40, networkLatency: 100 },
          trading: { dailyPnL: 100, openPositions: 10, totalTrades: 10, winRate: 70, averageTradeDuration: 300 },
          connections: {
            pusher: { connected: true, reconnectAttempts: 0 },
            zeromq: { connected: true, reconnectAttempts: 0 },
            mt5: { connected: true, reconnectAttempts: 0 },
            api: { connected: true, reconnectAttempts: 0 },
          },
          performance: { commandQueueSize: 0, averageExecutionTime: 200, errorRate: 0, uptime: 3600000 },
        };

        const result = await safetyService.checkBeforeTrade(tradeParams, metrics);

        expect(result.passed).toBe(false);
        expect(result.errors).toContain('Maximum positions reached: 10/10');
      });

      it('should fail safety check when lot size exceeds maximum', async () => {
        const tradeParams: TradeParams = {
          symbol: 'EURUSD',
          type: 'BUY',
          volume: 2.0, // Exceeds max lot size of 1.0
        };

        const metrics: MonitoringMetrics = {
          system: { cpuUsage: 50, memoryUsage: 60, diskUsage: 40, networkLatency: 100 },
          trading: { dailyPnL: 100, openPositions: 2, totalTrades: 10, winRate: 70, averageTradeDuration: 300 },
          connections: {
            pusher: { connected: true, reconnectAttempts: 0 },
            zeromq: { connected: true, reconnectAttempts: 0 },
            mt5: { connected: true, reconnectAttempts: 0 },
            api: { connected: true, reconnectAttempts: 0 },
          },
          performance: { commandQueueSize: 0, averageExecutionTime: 200, errorRate: 0, uptime: 3600000 },
        };

        const result = await safetyService.checkBeforeTrade(tradeParams, metrics);

        expect(result.passed).toBe(false);
        expect(result.errors).toContain('Lot size exceeds maximum: 2 > 1');
      });
    });

    describe('emergencyStop', () => {
      it('should activate emergency stop successfully', async () => {
        const startTime = Date.now();
        
        await safetyService.emergencyStop('Test emergency stop');
        
        const responseTime = Date.now() - startTime;
        
        expect(safetyService.isEmergencyStopActive()).toBe(true);
        expect(responseTime).toBeLessThan(1000); // Should be under 1 second
      });

      it('should reset emergency stop successfully', async () => {
        await safetyService.emergencyStop('Test emergency stop');
        expect(safetyService.isEmergencyStopActive()).toBe(true);
        
        await safetyService.resetEmergencyStop();
        expect(safetyService.isEmergencyStopActive()).toBe(false);
      });
    });

    describe('updateLimits', () => {
      it('should update safety limits successfully', async () => {
        const newLimits: Partial<SafetyLimits> = {
          maxDailyLoss: 1000,
          maxPositions: 20,
          maxLotSize: 2.0,
        };

        await safetyService.updateLimits(newLimits);
        
        const updatedLimits = safetyService.getLimits();
        
        expect(updatedLimits.maxDailyLoss).toBe(1000);
        expect(updatedLimits.maxPositions).toBe(20);
        expect(updatedLimits.maxLotSize).toBe(2.0);
      });
    });
  });

  describe('SecurityService', () => {
    describe('storeCredentials', () => {
      it('should store encrypted credentials successfully', async () => {
        const credentials: CredentialStorage = {
          apiKey: 'test_api_key',
          apiSecret: 'test_api_secret',
          executorId: 'test_executor_id',
          encrypted: false,
          lastUpdated: new Date(),
        };

        const result = await securityService.storeCredentials(credentials);
        
        expect(result).toBe(true);
      });
    });

    describe('getCredentials', () => {
      it('should retrieve and decrypt credentials successfully', async () => {
        const credentials: CredentialStorage = {
          apiKey: 'test_api_key',
          apiSecret: 'test_api_secret',
          executorId: 'test_executor_id',
          encrypted: false,
          lastUpdated: new Date(),
        };

        // First store credentials
        await securityService.storeCredentials(credentials);
        
        // Then retrieve them
        const retrievedCredentials = await securityService.getCredentials();
        
        expect(retrievedCredentials).not.toBeNull();
        expect(retrievedCredentials?.apiKey).toBe('test_api_key');
        expect(retrievedCredentials?.apiSecret).toBe('test_api_secret');
        expect(retrievedCredentials?.executorId).toBe('test_executor_id');
      });
    });

    describe('createSession', () => {
      it('should create security session successfully', async () => {
        const session = await securityService.createSession(
          'test_user',
          '192.168.1.1',
          'Mozilla/5.0 Test Browser'
        );

        expect(session).toBeDefined();
        expect(session.userId).toBe('test_user');
        expect(session.ipAddress).toBe('192.168.1.1');
        expect(session.userAgent).toBe('Mozilla/5.0 Test Browser');
        expect(session.isActive).toBe(true);
      });
    });

    describe('validateSession', () => {
      it('should validate active session successfully', async () => {
        const session = await securityService.createSession('test_user');
        
        const isValid = await securityService.validateSession(session.id);
        
        expect(isValid).toBe(true);
      });

      it('should reject invalid session', async () => {
        const isValid = await securityService.validateSession('invalid_session_id');
        
        expect(isValid).toBe(false);
      });
    });

    describe('checkRateLimit', () => {
      it('should allow requests within rate limit', async () => {
        const isAllowed = await securityService.checkRateLimit('test_key', 10, 60000);
        
        expect(isAllowed).toBe(true);
      });

      it('should block requests exceeding rate limit', async () => {
        // Exceed rate limit
        for (let i = 0; i < 11; i++) {
          await securityService.checkRateLimit('test_key_2', 10, 60000);
        }
        
        const isAllowed = await securityService.checkRateLimit('test_key_2', 10, 60000);
        
        expect(isAllowed).toBe(false);
      });
    });

    describe('validateApiKey', () => {
      it('should validate correct API credentials', async () => {
        const credentials: CredentialStorage = {
          apiKey: 'correct_api_key',
          apiSecret: 'correct_api_secret',
          executorId: 'test_executor_id',
          encrypted: false,
          lastUpdated: new Date(),
        };

        await securityService.storeCredentials(credentials);
        
        const isValid = await securityService.validateApiKey('correct_api_key', 'correct_api_secret');
        
        expect(isValid).toBe(true);
      });

      it('should reject incorrect API credentials', async () => {
        const isValid = await securityService.validateApiKey('wrong_api_key', 'wrong_api_secret');
        
        expect(isValid).toBe(false);
      });
    });
  });

  describe('MonitoringService', () => {
    describe('updateConnectionStatus', () => {
      it('should update connection status successfully', () => {
        monitoringService.updateConnectionStatus('pusher', {
          connected: true,
          latency: 50,
        });

        const status = monitoringService.getConnectionStatus('pusher');
        
        expect(status).toBeDefined();
        expect(status?.connected).toBe(true);
        expect(status?.latency).toBe(50);
      });
    });

    describe('updateTradingMetrics', () => {
      it('should update trading metrics successfully', () => {
        const newMetrics = {
          dailyPnL: 250,
          openPositions: 3,
          totalTrades: 15,
        };

        monitoringService.updateTradingMetrics(newMetrics);
        
        const currentMetrics = monitoringService.getCurrentMetrics();
        
        expect(currentMetrics.trading.dailyPnL).toBe(250);
        expect(currentMetrics.trading.openPositions).toBe(3);
        expect(currentMetrics.trading.totalTrades).toBe(15);
      });
    });

    describe('recordPerformanceMetrics', () => {
      it('should record performance metrics successfully', async () => {
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + 500);

        await monitoringService.recordPerformanceMetrics(
          'test_command_123',
          'OPEN_POSITION',
          startTime,
          endTime,
          true
        );

        // Verify the metrics were saved (mock database)
        expect(mockDatabaseManager.savePerformanceMetrics).toHaveBeenCalled();
      });
    });

    describe('performHealthCheck', () => {
      it('should perform health check successfully', async () => {
        const healthResult = await monitoringService.performHealthCheck();
        
        expect(healthResult).toBeDefined();
        expect(healthResult.timestamp).toBeDefined();
        expect(healthResult.checks).toBeDefined();
        expect(['HEALTHY', 'DEGRADED', 'UNHEALTHY']).toContain(healthResult.status);
      });
    });

    describe('getActiveAlerts', () => {
      it('should return active alerts', () => {
        const alerts = monitoringService.getActiveAlerts();
        
        expect(Array.isArray(alerts)).toBe(true);
      });
    });

    describe('acknowledgeAlert', () => {
      it('should acknowledge alert successfully', async () => {
        // This would need an actual alert to acknowledge
        // For now, just test that the method doesn't throw
        const result = await monitoringService.acknowledgeAlert('non_existent_alert', 'test_user');
        
        expect(result).toBe(false);
      });
    });
  });

  describe('CryptoUtils', () => {
    describe('generateKey', () => {
      it('should generate secure encryption key', () => {
        const key = CryptoUtils.generateKey();
        
        expect(key).toBeDefined();
        expect(typeof key).toBe('string');
        expect(key.length).toBe(64); // 32 bytes * 2 (hex)
      });
    });

    describe('encrypt and decrypt', () => {
      it('should encrypt and decrypt data successfully', () => {
        const data = 'sensitive_data_to_encrypt';
        const key = CryptoUtils.generateKey();

        const encrypted = CryptoUtils.encrypt(data, key);
        
        expect(encrypted.success).toBe(true);
        expect(encrypted.data).toBeDefined();
        expect(encrypted.iv).toBeDefined();
        expect(encrypted.tag).toBeDefined();

        if (encrypted.success && encrypted.data && encrypted.iv && encrypted.tag) {
          const decrypted = CryptoUtils.decrypt(encrypted.data, key, encrypted.iv, encrypted.tag);
          
          expect(decrypted.success).toBe(true);
          expect(decrypted.data).toBe(data);
        }
      });
    });

    describe('hash', () => {
      it('should hash data consistently', () => {
        const data = 'data_to_hash';
        const hash1 = CryptoUtils.hash(data);
        const hash2 = CryptoUtils.hash(data);
        
        expect(hash1).toBe(hash2);
        expect(hash1.length).toBe(64); // SHA-256 hex length
      });
    });

    describe('generateToken', () => {
      it('should generate secure random token', () => {
        const token = CryptoUtils.generateToken(32);
        
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.length).toBe(64); // 32 bytes * 2 (hex)
      });
    });

    describe('generateUUID', () => {
      it('should generate valid UUID', () => {
        const uuid = CryptoUtils.generateUUID();
        
        expect(uuid).toBeDefined();
        expect(typeof uuid).toBe('string');
        expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete trade flow with safety checks', async () => {
      const tradeParams: TradeParams = {
        symbol: 'EURUSD',
        type: 'BUY',
        volume: 0.01,
        stopLoss: 1.0900,
        takeProfit: 1.1000,
      };

      const metrics: MonitoringMetrics = {
        system: { cpuUsage: 30, memoryUsage: 50, diskUsage: 30, networkLatency: 80 },
        trading: { dailyPnL: 50, openPositions: 1, totalTrades: 5, winRate: 80, averageTradeDuration: 250 },
        connections: {
          pusher: { connected: true, reconnectAttempts: 0 },
          zeromq: { connected: true, reconnectAttempts: 0 },
          mt5: { connected: true, reconnectAttempts: 0 },
          api: { connected: true, reconnectAttempts: 0 },
        },
        performance: { commandQueueSize: 0, averageExecutionTime: 150, errorRate: 0, uptime: 1800000 },
      };

      // Safety check
      const safetyResult = await safetyService.checkBeforeTrade(tradeParams, metrics);
      expect(safetyResult.passed).toBe(true);

      // Record performance
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 300);
      
      await monitoringService.recordPerformanceMetrics(
        'trade_123',
        'OPEN_POSITION',
        startTime,
        endTime,
        true
      );

      // Health check
      const healthResult = await monitoringService.performHealthCheck();
      expect(['HEALTHY', 'DEGRADED']).toContain(healthResult.status);
    });

    it('should handle emergency stop scenario', async () => {
      // Simulate emergency conditions
      const emergencyMetrics: MonitoringMetrics = {
        system: { cpuUsage: 95, memoryUsage: 90, diskUsage: 85, networkLatency: 1000 },
        trading: { dailyPnL: -600, openPositions: 15, totalTrades: 50, winRate: 30, averageTradeDuration: 100 },
        connections: {
          pusher: { connected: false, reconnectAttempts: 5 },
          zeromq: { connected: false, reconnectAttempts: 5 },
          mt5: { connected: false, reconnectAttempts: 5 },
          api: { connected: false, reconnectAttempts: 5 },
        },
        performance: { commandQueueSize: 50, averageExecutionTime: 2000, errorRate: 15, uptime: 3600000 },
      };

      // Safety check should fail
      const tradeParams: TradeParams = {
        symbol: 'EURUSD',
        type: 'BUY',
        volume: 0.01,
      };

      const safetyResult = await safetyService.checkBeforeTrade(tradeParams, emergencyMetrics);
      expect(safetyResult.passed).toBe(false);

      // Activate emergency stop
      await safetyService.emergencyStop('Critical system failure');
      expect(safetyService.isEmergencyStopActive()).toBe(true);

      // Check for alerts
      const alerts = monitoringService.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);
    });
  });
});