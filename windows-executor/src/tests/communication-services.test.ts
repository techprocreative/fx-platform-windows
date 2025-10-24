import { PriorityQueue, PRIORITIES } from '../utils/priority-queue';
import { PusherService } from '../services/pusher.service';
import { ZeroMQService } from '../services/zeromq.service';
import { CommandService } from '../services/command.service';
import { HeartbeatService } from '../services/heartbeat.service';
import { 
  Command, 
  AppConfig, 
  SafetyLimits, 
  RateLimitConfig,
  TradeParams 
} from '../types/command.types';

// Mock implementations for testing
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockConfig: AppConfig = {
  executorId: 'test-executor-1',
  apiKey: 'test-api-key',
  apiSecret: 'test-api-secret',
  platformUrl: 'https://test.fx.nusanexus.com',
  pusherKey: 'test-pusher-key',
  pusherCluster: 'mt1',
  zmqPort: 5555,
  zmqHost: 'tcp://localhost',
  heartbeatInterval: 60,
  autoReconnect: true,
  retryAttempts: 3,
  commandTimeout: 5000,
};

const mockSafetyLimits: SafetyLimits = {
  maxDailyLoss: 500,
  maxPositions: 10,
  maxLotSize: 1.0,
  maxDrawdownPercent: 20,
  maxSpreadPoints: 50,
  maxRiskPerTrade: 2,
};

const mockRateLimitConfig: RateLimitConfig = {
  windowMs: 60000, // 1 minute
  maxRequests: 100,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
};

describe('PriorityQueue', () => {
  let queue: PriorityQueue<string>;

  beforeEach(() => {
    queue = new PriorityQueue(10);
  });

  test('should enqueue items with correct priority order', () => {
    const id1 = queue.enqueue('low priority item', PRIORITIES.LOW);
    const id2 = queue.enqueue('high priority item', PRIORITIES.HIGH);
    const id3 = queue.enqueue('normal priority item', PRIORITIES.NORMAL);

    expect(queue.size()).toBe(3);
    
    // High priority should be dequeued first
    const first = queue.dequeue();
    expect(first?.data).toBe('high priority item');
    
    // Then normal priority
    const second = queue.dequeue();
    expect(second?.data).toBe('normal priority item');
    
    // Then low priority
    const third = queue.dequeue();
    expect(third?.data).toBe('low priority item');
  });

  test('should handle queue overflow', () => {
    const smallQueue = new PriorityQueue(2);
    
    smallQueue.enqueue('item1', PRIORITIES.NORMAL);
    smallQueue.enqueue('item2', PRIORITIES.NORMAL);
    smallQueue.enqueue('item3', PRIORITIES.NORMAL); // Should remove oldest
    
    expect(smallQueue.size()).toBe(2);
  });

  test('should requeue items for retry', () => {
    const id = queue.enqueue('test item', PRIORITIES.NORMAL, 3);
    
    // Mark as attempted
    const item = queue.getById(id);
    expect(item?.attempts).toBe(0);
    
    // Requeue
    const requeued = queue.requeue(id, 1000);
    expect(requeued).toBe(true);
    
    const updatedItem = queue.getById(id);
    expect(updatedItem?.attempts).toBe(1);
    expect(updatedItem?.nextRetryAt).toBeInstanceOf(Date);
  });

  test('should not requeue if max attempts reached', () => {
    const id = queue.enqueue('test item', PRIORITIES.NORMAL, 1);
    
    // Mark as attempted
    queue.requeue(id, 1000);
    
    // Try to requeue again
    const requeued = queue.requeue(id, 1000);
    expect(requeued).toBe(false);
  });

  test('should get queue statistics', () => {
    queue.enqueue('item1', PRIORITIES.HIGH);
    queue.enqueue('item2', PRIORITIES.NORMAL);
    queue.enqueue('item3', PRIORITIES.NORMAL);
    
    const stats = queue.getStats();
    
    expect(stats.total).toBe(3);
    expect(stats.priorityCounts[PRIORITIES.NORMAL]).toBe(2);
    expect(stats.priorityCounts[PRIORITIES.HIGH]).toBe(1);
  });
});

describe('PusherService', () => {
  let pusherService: PusherService;

  beforeEach(() => {
    pusherService = new PusherService(mockLogger.info);
  });

  test('should initialize with correct default state', () => {
    expect(pusherService.getConnectionStatus()).toBe('disconnected');
    expect(pusherService.isConnected()).toBe(false);
  });

  test('should handle connection configuration', async () => {
    // Mock Pusher constructor
    const mockPusher = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      connection: {
        bind: jest.fn(),
        state: 'connected',
      },
      subscribe: jest.fn(() => ({
        bind: jest.fn(),
        subscribed: true,
      })),
    };

    // Mock Pusher module
    jest.doMock('pusher-js', () => {
      return jest.fn().mockImplementation(() => mockPusher);
    });

    const result = await pusherService.connect(mockConfig);
    expect(result).toBe(true);
  });

  test('should handle connection errors gracefully', async () => {
    // Mock failed connection
    jest.doMock('pusher-js', () => {
      return jest.fn().mockImplementation(() => {
        throw new Error('Connection failed');
      });
    });

    const result = await pusherService.connect(mockConfig);
    expect(result).toBe(false);
  });

  test('should emit events correctly', () => {
    const mockHandler = jest.fn();
    pusherService.on('test-event', mockHandler);
    
    // Simulate event emission
    pusherService.emitEvent = jest.fn();
    
    // This would normally be called internally
    (pusherService as any).emitEvent('test-event', { data: 'test' });
    
    expect(mockHandler).toHaveBeenCalled();
  });
});

describe('ZeroMQService', () => {
  let zmqService: ZeroMQService;

  beforeEach(() => {
    zmqService = new ZeroMQService(mockLogger.info);
  });

  test('should initialize with correct default state', () => {
    expect(zmqService.getConnectionStatus()).toBe('disconnected');
    expect(zmqService.isConnected()).toBe(false);
  });

  test('should handle connection configuration', async () => {
    // Mock ZeroMQ
    const mockSocket = {
      connect: jest.fn(),
      close: jest.fn(),
      send: jest.fn(),
      receive: jest.fn().mockResolvedValue([Buffer.from('{"status":"OK"}')]),
      events: {
        on: jest.fn(),
      },
    };

    jest.doMock('zeromq', () => ({
      Request: jest.fn().mockImplementation(() => mockSocket),
    }));

    const result = await zmqService.connect(mockConfig);
    expect(result).toBe(true);
  });

  test('should handle ping operation', async () => {
    // Mock successful ping
    (zmqService as any).sendRequest = jest.fn().mockResolvedValue({
      status: 'OK',
    });

    const result = await zmqService.ping();
    expect(result).toBe(true);
  });

  test('should handle trade operations', async () => {
    const tradeParams: TradeParams = {
      symbol: 'EURUSD',
      type: 'BUY',
      volume: 0.1,
      stopLoss: 1.1000,
      takeProfit: 1.2000,
    };

    // Mock successful trade
    (zmqService as any).sendRequest = jest.fn().mockResolvedValue({
      status: 'OK',
      data: {
        ticket: 12345,
        openPrice: 1.1500,
      },
    });

    const result = await zmqService.openPosition(tradeParams);
    expect(result.success).toBe(true);
    expect(result.ticket).toBe(12345);
  });
});

describe('CommandService', () => {
  let commandService: CommandService;
  let mockZeroMQService: jest.Mocked<ZeroMQService>;
  let mockPusherService: jest.Mocked<PusherService>;

  beforeEach(() => {
    mockZeroMQService = {
      isConnected: jest.fn().mockReturnValue(true),
      openPosition: jest.fn(),
      closePosition: jest.fn(),
      closeAllPositions: jest.fn(),
      modifyPosition: jest.fn(),
      getPositions: jest.fn(),
      getAccountInfo: jest.fn(),
      getSymbolInfo: jest.fn(),
    } as any;

    mockPusherService = {
      sendCommandResult: jest.fn(),
      getConnectionStatus: jest.fn().mockReturnValue('connected'),
    } as any;

    commandService = new CommandService(
      mockZeroMQService,
      mockPusherService,
      mockSafetyLimits,
      mockRateLimitConfig,
      mockLogger.info
    );
  });

  test('should validate commands correctly', () => {
    const validCommand: Command = {
      id: 'test-cmd-1',
      command: 'OPEN_POSITION',
      parameters: {
        symbol: 'EURUSD',
        type: 'BUY',
        volume: 0.1,
      },
      priority: 'NORMAL',
      createdAt: new Date().toISOString(),
    };

    // This should not throw an error
    expect(async () => {
      await commandService.addCommand(validCommand);
    }).not.toThrow();
  });

  test('should reject invalid commands', async () => {
    const invalidCommand: Command = {
      id: '', // Invalid empty ID
      command: 'OPEN_POSITION',
      parameters: {},
      priority: 'NORMAL',
      createdAt: new Date().toISOString(),
    };

    await expect(commandService.addCommand(invalidCommand)).rejects.toThrow();
  });

  test('should handle command queue correctly', async () => {
    const command: Command = {
      id: 'test-cmd-2',
      command: 'GET_ACCOUNT_INFO',
      priority: 'LOW',
      createdAt: new Date().toISOString(),
    };

    const queueId = await commandService.addCommand(command);
    expect(queueId).toBeDefined();

    const status = commandService.getCommandStatus(command.id);
    expect(status.status).toBe('queued');
  });

  test('should cancel commands correctly', () => {
    const command: Command = {
      id: 'test-cmd-3',
      command: 'OPEN_POSITION',
      priority: 'NORMAL',
      createdAt: new Date().toISOString(),
    };

    // Add to queue first
    commandService.addCommand(command);

    // Cancel the command
    const cancelled = commandService.cancelCommand(command.id);
    expect(cancelled).toBe(true);
  });

  test('should provide queue statistics', () => {
    const stats = commandService.getQueueStats();
    
    expect(stats).toHaveProperty('queue');
    expect(stats).toHaveProperty('processing');
    expect(stats).toHaveProperty('history');
    expect(stats).toHaveProperty('rateLimit');
  });
});

describe('HeartbeatService', () => {
  let heartbeatService: HeartbeatService;
  let mockZeroMQService: jest.Mocked<ZeroMQService>;
  let mockPusherService: jest.Mocked<PusherService>;
  let mockCommandService: jest.Mocked<CommandService>;

  beforeEach(() => {
    mockZeroMQService = {
      isConnected: jest.fn().mockReturnValue(true),
      forceReconnect: jest.fn(),
    } as any;

    mockPusherService = {
      sendCommandResult: jest.fn(),
      getConnectionStatus: jest.fn().mockReturnValue('connected'),
      forceReconnect: jest.fn(),
    } as any;

    mockCommandService = {
      getQueueStats: jest.fn().mockReturnValue({
        queue: { processable: 0 },
        processing: { activeCommands: 0 },
        history: { total: 0, failed: 0, averageExecutionTime: 0 },
      }),
    } as any;

    heartbeatService = new HeartbeatService(
      mockZeroMQService,
      mockPusherService,
      mockCommandService,
      mockLogger.info
    );
  });

  test('should initialize with correct default state', () => {
    const status = heartbeatService.getHeartbeatStatus();
    
    expect(status.isRunning).toBe(false);
    expect(status.missedHeartbeats).toBe(0);
  });

  test('should start and stop correctly', async () => {
    const started = await heartbeatService.start(mockConfig);
    expect(started).toBe(true);

    let status = heartbeatService.getHeartbeatStatus();
    expect(status.isRunning).toBe(true);

    heartbeatService.stop();
    
    status = heartbeatService.getHeartbeatStatus();
    expect(status.isRunning).toBe(false);
  });

  test('should collect system metrics', () => {
    const metrics = heartbeatService.getSystemMetrics();
    
    expect(metrics).toHaveProperty('cpuUsage');
    expect(metrics).toHaveProperty('memoryUsage');
    expect(metrics).toHaveProperty('diskUsage');
  });

  test('should provide health status', async () => {
    await heartbeatService.start(mockConfig);
    
    const health = await heartbeatService.getHealthStatus();
    
    expect(health).toHaveProperty('status');
    expect(health).toHaveProperty('details');
    expect(health).toHaveProperty('timestamp');
    
    heartbeatService.stop();
  });

  test('should handle missed heartbeats', async () => {
    // Mock failed heartbeat sending
    mockPusherService.sendCommandResult.mockRejectedValue(new Error('Connection failed'));

    await heartbeatService.start(mockConfig);
    
    // Force multiple heartbeat failures
    await heartbeatService.forceHeartbeat();
    await heartbeatService.forceHeartbeat();
    await heartbeatService.forceHeartbeat();
    
    const status = heartbeatService.getHeartbeatStatus();
    expect(status.missedHeartbeats).toBeGreaterThan(0);
    
    heartbeatService.stop();
  });
});

// Integration tests
describe('Communication Services Integration', () => {
  test('should work together seamlessly', async () => {
    // This would be a more complex integration test
    // For now, we'll just verify that services can be instantiated together
    
    const zmqService = new ZeroMQService(mockLogger.info);
    const pusherService = new PusherService(mockLogger.info);
    const commandService = new CommandService(
      zmqService,
      pusherService,
      mockSafetyLimits,
      mockRateLimitConfig,
      mockLogger.info
    );
    const heartbeatService = new HeartbeatService(
      zmqService,
      pusherService,
      commandService,
      mockLogger.info
    );

    expect(zmqService).toBeDefined();
    expect(pusherService).toBeDefined();
    expect(commandService).toBeDefined();
    expect(heartbeatService).toBeDefined();
  });
});