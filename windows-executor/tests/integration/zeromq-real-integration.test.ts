/**
 * Real ZeroMQ Integration Tests
 * Tests actual ZeroMQ module loading and connection capabilities
 */

import { ZeroMQService } from '../../src/services/zeromq.service';
import { AppConfig } from '../../src/types/config.types';

describe('ZeroMQ Real Integration Tests', () => {
  let service: ZeroMQService;
  
  beforeAll(() => {
    // Check if ZeroMQ module can be loaded
    try {
      const zmq = require('zeromq');
      expect(zmq).toBeDefined();
      console.log('✅ ZeroMQ module loaded successfully');
    } catch (error) {
      console.error('❌ ZeroMQ module cannot be loaded:', error);
      fail('ZeroMQ module cannot be loaded: ' + (error as Error).message);
    }
  });
  
  beforeEach(() => {
    service = new ZeroMQService();
  });
  
  afterEach(() => {
    if (service) {
      service.disconnect();
    }
  });
  
  describe('Module Loading', () => {
    test('should load ZeroMQ native module', () => {
      const zmq = require('zeromq');
      expect(zmq).toBeDefined();
      expect(zmq.version).toBeDefined();
      console.log('  ZeroMQ version:', zmq.version);
    });
    
    test('should create ZeroMQ socket', async () => {
      const zmq = require('zeromq');
      const socket = new zmq.Request();
      expect(socket).toBeDefined();
      expect(typeof socket.close).toBe('function');
      socket.close();
    });
    
    test('should have required socket types', () => {
      const zmq = require('zeromq');
      expect(zmq.Request).toBeDefined();
      expect(zmq.Reply).toBeDefined();
      expect(zmq.Publisher).toBeDefined();
      expect(zmq.Subscriber).toBeDefined();
    });
  });
  
  describe('Service Initialization', () => {
    test('should create ZeroMQService instance', () => {
      expect(service).toBeDefined();
      expect(service.isConnected()).toBe(false);
    });
    
    test('should have connection methods', () => {
      expect(typeof service.connect).toBe('function');
      expect(typeof service.disconnect).toBe('function');
      expect(typeof service.ping).toBe('function');
    });
    
    test('should have trading methods', () => {
      expect(typeof service.openPosition).toBe('function');
      expect(typeof service.closePosition).toBe('function');
      expect(typeof service.getPositions).toBe('function');
      expect(typeof service.getAccountInfo).toBe('function');
    });
  });
  
  describe('Connection Attempts', () => {
    const testConfig: AppConfig = {
      executorId: 'test-executor',
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      platformUrl: 'https://test.fxplatform.com',
      pusherKey: 'test-pusher-key',
      pusherCluster: 'ap1',
      zmqHost: 'tcp://localhost',
      zmqPort: 5555,
      heartbeatInterval: 60,
      autoReconnect: true
    };
    
    test('should handle connection attempt (MT5 may not be running)', async () => {
      // This test expects MT5 might not be running
      // It should not fail, just return false or timeout gracefully
      
      try {
        const connected = await service.connect(testConfig);
        expect(typeof connected).toBe('boolean');
        
        if (connected) {
          console.log('✅ Connected to MT5 successfully');
          
          // If connected, test ping
          const pingResult = await service.ping();
          expect(typeof pingResult).toBe('boolean');
          
          if (pingResult) {
            console.log('✅ Ping successful');
          }
        } else {
          console.log('ℹ️  MT5 not running (expected in CI/testing)');
        }
      } catch (error) {
        // Connection failure is OK if MT5 not running
        console.log('ℹ️  Connection failed (MT5 not running):', (error as Error).message);
        expect(error).toBeDefined();
      }
    }, 15000); // 15 second timeout
    
    test('should handle invalid port gracefully', async () => {
      const invalidConfig = { 
        ...testConfig, 
        zmqPort: 99999 // Invalid port
      };
      
      try {
        const connected = await service.connect(invalidConfig);
        expect(connected).toBe(false);
      } catch (error) {
        // Error is acceptable for invalid config
        expect(error).toBeDefined();
      }
    }, 10000);
    
    test('should handle disconnect without error', () => {
      expect(() => {
        service.disconnect();
      }).not.toThrow();
    });
  });
  
  describe('Service State', () => {
    test('should return connection status', () => {
      const status = service.getConnectionStatus();
      expect(status).toBeDefined();
      expect(['connected', 'disconnected', 'connecting', 'error']).toContain(status);
    });
    
    test('should return connection stats', () => {
      const stats = service.getConnectionStats();
      expect(stats).toBeDefined();
      expect(stats.status).toBeDefined();
      expect(typeof stats.reconnectAttempts).toBe('number');
      expect(typeof stats.maxReconnectAttempts).toBe('number');
    });
    
    test('should report not connected initially', () => {
      expect(service.isConnected()).toBe(false);
    });
  });
  
  describe('Error Handling', () => {
    test('should throw error when sending command without connection', async () => {
      await expect(async () => {
        await service.openPosition({
          symbol: 'EURUSD',
          type: 'BUY',
          volume: 0.01,
        });
      }).rejects.toThrow();
    });
    
    test('should throw error when pinging without connection', async () => {
      await expect(async () => {
        await service.ping();
      }).rejects.toThrow();
    });
  });
});

describe('ZeroMQ Module Compatibility', () => {
  test('should have correct ZeroMQ version format', () => {
    const zmq = require('zeromq');
    const version = zmq.version;
    
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    console.log('  ZeroMQ version format:', version);
    
    const [major, minor, patch] = version.split('.').map(Number);
    expect(major).toBeGreaterThanOrEqual(4);
  });
  
  test('should support REQ/REP pattern', () => {
    const zmq = require('zeromq');
    
    const req = new zmq.Request();
    const rep = new zmq.Reply();
    
    expect(req).toBeDefined();
    expect(rep).toBeDefined();
    
    req.close();
    rep.close();
  });
  
  test('should support socket events', () => {
    const zmq = require('zeromq');
    const socket = new zmq.Request();
    
    expect(socket.events).toBeDefined();
    expect(typeof socket.events.on).toBe('function');
    
    socket.close();
  });
});
