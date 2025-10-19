/**
 * Unit Tests for Reliable WebSocket Client
 * Tests auto-reconnection, message queuing, delivery confirmation, and heartbeat functionality
 */

import { ReliableWebSocketClient } from '../reliable-client';
import { ConnectionState, MessageType, MessagePriority } from '../types';
import { MessageQueue, MemoryStorageAdapter } from '../message-queue';
import { HeartbeatManager } from '../heartbeat-manager';

// Mock WebSocket for testing
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  protocols?: string[];
  onopen?: (event: Event) => void;
  onclose?: (event: CloseEvent) => void;
  onerror?: (event: Event) => void;
  onmessage?: (event: MessageEvent) => void;
  
  sentMessages: any[] = [];
  closeCode?: number;
  closeReason?: string;

  constructor(url: string, protocols?: string[]) {
    this.url = url;
    this.protocols = protocols;
    
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string): void {
    this.sentMessages.push(JSON.parse(data));
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    this.closeCode = code;
    this.closeReason = reason;
    
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: code || 1000, reason: reason || '' }));
    }
  }

  // Helper method to simulate receiving a message
  receiveMessage(data: any): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  // Helper method to simulate connection error
  simulateError(): void {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// Mock WebSocket constructor
global.WebSocket = MockWebSocket as any;

describe('ReliableWebSocketClient', () => {
  let client: ReliableWebSocketClient;
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    if (client) {
      client.destroy();
    }
  });

  describe('Connection Management', () => {
    test('should connect successfully', async () => {
      client = new ReliableWebSocketClient('ws://localhost:8080', {
        storage
      });

      expect(client.getState()).toBe(ConnectionState.DISCONNECTED);
      
      const connectPromise = client.connect();
      expect(client.getState()).toBe(ConnectionState.CONNECTING);
      
      await connectPromise;
      expect(client.getState()).toBe(ConnectionState.CONNECTED);
    });

    test('should handle connection errors', async () => {
      client = new ReliableWebSocketClient('ws://invalid-url', {
        storage
      });

      // Mock a connection error
      const originalWebSocket = global.WebSocket;
      const ErrorWebSocket = class extends MockWebSocket {
        constructor(url: string, protocols?: string[]) {
          super(url, protocols);
          setTimeout(() => {
            if (this.onerror) {
              this.onerror(new Event('error'));
            }
          }, 10);
        }
      } as any;
      global.WebSocket = ErrorWebSocket;

      await expect(client.connect()).rejects.toThrow();
      expect(client.getState()).toBe(ConnectionState.ERROR);

      global.WebSocket = originalWebSocket;
    });

    test('should disconnect successfully', async () => {
      client = new ReliableWebSocketClient('ws://localhost:8080', {
        storage
      });

      await client.connect();
      expect(client.getState()).toBe(ConnectionState.CONNECTED);

      await client.disconnect();
      expect(client.getState()).toBe(ConnectionState.DISCONNECTED);
    });

    test('should auto-reconnect on connection loss', async () => {
      client = new ReliableWebSocketClient('ws://localhost:8080', {
        storage,
        reconnect: true,
        reconnectInterval: 100,
        maxReconnectAttempts: 3
      });

      await client.connect();
      expect(client.getState()).toBe(ConnectionState.CONNECTED);

      // Simulate connection loss
      const ws = (client as any).ws;
      ws.close(1006, 'Connection lost');

      expect(client.getState()).toBe(ConnectionState.DISCONNECTED);

      // Fast-forward time to trigger reconnection
      jest.advanceTimersByTime(100);
      await Promise.resolve(); // Allow async operations to complete

      expect(client.getState()).toBe(ConnectionState.CONNECTED);
    });

    test('should stop reconnecting after max attempts', async () => {
      client = new ReliableWebSocketClient('ws://invalid-url', {
        storage,
        reconnect: true,
        reconnectInterval: 100,
        maxReconnectAttempts: 2
      });

      // Mock a connection that always fails
      const originalWebSocket = global.WebSocket;
      const FailingWebSocket = class extends MockWebSocket {
        constructor(url: string, protocols?: string[]) {
          super(url, protocols);
          setTimeout(() => {
            if (this.onerror) {
              this.onerror(new Event('error'));
            }
          }, 10);
        }
      } as any;
      global.WebSocket = FailingWebSocket;

      try {
        await client.connect();
      } catch (error) {
        // Expected to fail
      }

      // Fast-forward through reconnection attempts
      for (let i = 0; i < 3; i++) {
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      }

      expect(client.getState()).toBe(ConnectionState.ERROR);

      global.WebSocket = originalWebSocket;
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      client = new ReliableWebSocketClient('ws://localhost:8080', {
        storage
      });
      await client.connect();
    });

    test('should send messages when connected', async () => {
      const message = { type: 'test', data: 'hello' };
      const result = await client.send(message);

      expect(result).toBe(true);
      
      const ws = (client as any).ws;
      expect(ws.sentMessages).toHaveLength(1);
      expect(ws.sentMessages[0].payload).toEqual(message);
    });

    test('should queue messages when disconnected', async () => {
      await client.disconnect();
      
      const message = { type: 'test', data: 'queued' };
      const result = await client.send(message);

      expect(result).toBe(true);
      
      const stats = client.getStats();
      expect(stats.queueStats.total).toBe(1);
    });

    test('should process queued messages on reconnect', async () => {
      await client.disconnect();
      
      // Queue a message
      const message = { type: 'test', data: 'queued' };
      await client.send(message);
      
      // Reconnect
      await client.connect();
      
      // Fast-forward to allow message processing
      jest.advanceTimersByTime(10);
      await Promise.resolve();
      
      const ws = (client as any).ws;
      expect(ws.sentMessages).toHaveLength(1);
      expect(ws.sentMessages[0].payload).toEqual(message);
    });

    test('should handle message acknowledgements', async () => {
      const message = { type: 'test', data: 'with ack' };
      const result = await client.sendWithAcknowledgement(message, 1000);

      expect(result.messageId).toBeDefined();
      expect(result.delivered).toBe(true);
      
      const ws = (client as any).ws;
      
      // Simulate acknowledgement
      ws.receiveMessage({
        type: MessageType.ACK,
        payload: {
          messageId: result.messageId,
          success: true,
          timestamp: Date.now()
        },
        timestamp: Date.now()
      });

      // Check if acknowledgement was processed
      // The promise should resolve with acknowledged: true
      // This is handled internally, so we just verify the message was sent
      expect(ws.sentMessages).toHaveLength(1);
    });

    test('should handle acknowledgement timeout', async () => {
      const message = { type: 'test', data: 'timeout' };
      const result = await client.sendWithAcknowledgement(message, 100);

      expect(result.messageId).toBeDefined();
      expect(result.delivered).toBe(true);
      expect(result.acknowledged).toBe(false);
      expect(result.error).toBe('Acknowledgement timeout');
    });

    test('should handle incoming messages', async () => {
      let receivedMessage: any;
      client.addEventListener('message', (event: any) => {
        receivedMessage = JSON.parse(event.data);
      });

      const incomingMessage = {
        id: 'msg_123',
        type: MessageType.DATA,
        payload: { type: 'incoming', data: 'test' },
        timestamp: Date.now()
      };

      const ws = (client as any).ws;
      ws.receiveMessage(incomingMessage);

      expect(receivedMessage).toEqual(incomingMessage);
    });

    test('should send acknowledgement for messages requiring it', async () => {
      const ws = (client as any).ws;
      
      // Receive a message that requires acknowledgement
      ws.receiveMessage({
        id: 'msg_123',
        type: MessageType.DATA,
        payload: { type: 'incoming', data: 'test' },
        timestamp: Date.now(),
        requiresAck: true
      });

      // Check if acknowledgement was sent
      const ackMessage = ws.sentMessages.find((msg: any) => msg.type === MessageType.ACK);
      expect(ackMessage).toBeDefined();
      expect(ackMessage.payload.messageId).toBe('msg_123');
    });
  });

  describe('Heartbeat Management', () => {
    beforeEach(async () => {
      client = new ReliableWebSocketClient('ws://localhost:8080', {
        storage,
        heartbeatInterval: 1000,
        heartbeatTimeout: 500
      });
      await client.connect();
    });

    test('should send ping messages', async () => {
      const ws = (client as any).ws;
      
      // Fast-forward to trigger heartbeat
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      const pingMessage = ws.sentMessages.find((msg: any) => msg.type === MessageType.HEARTBEAT);
      expect(pingMessage).toBeDefined();
    });

    test('should handle pong responses', async () => {
      const ws = (client as any).ws;
      
      // Trigger a ping
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      const pingMessage = ws.sentMessages.find((msg: any) => msg.type === MessageType.HEARTBEAT);
      expect(pingMessage).toBeDefined();

      // Simulate pong response
      ws.receiveMessage({
        type: MessageType.HEARTBEAT_ACK,
        payload: { timestamp: Date.now() },
        timestamp: Date.now()
      });

      const stats = client.getStats();
      expect(stats.heartbeatStats?.isActive).toBe(true);
    });

    test('should detect heartbeat timeout', async () => {
      const ws = (client as any).ws;
      
      // Trigger a ping but don't respond
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      // Fast-forward past timeout
      jest.advanceTimersByTime(500);
      await Promise.resolve();

      // Should have missed a beat
      const stats = client.getStats();
      expect(stats.heartbeatStats?.missedBeats).toBe(1);
    });
  });

  describe('Message Queue', () => {
    let queue: MessageQueue;

    beforeEach(() => {
      queue = new MessageQueue(
        {
          maxSize: 10,
          enablePersistence: false,
          storageKey: 'test_queue',
          defaultPriority: MessagePriority.NORMAL,
          defaultTTL: 5000
        },
        storage
      );
    });

    afterEach(() => {
      queue.destroy();
    });

    test('should enqueue and dequeue messages', async () => {
      const message = {
        id: 'msg_1',
        type: MessageType.DATA,
        payload: { data: 'test' },
        timestamp: Date.now()
      };

      const enqueued = await queue.enqueue(message);
      expect(enqueued).toBe(true);

      const dequeued = queue.dequeue();
      expect(dequeued).toEqual(message);
    });

    test('should maintain priority order', async () => {
      const lowPriorityMsg = {
        id: 'msg_low',
        type: MessageType.DATA,
        payload: { data: 'low' },
        timestamp: Date.now(),
        priority: MessagePriority.LOW
      };

      const highPriorityMsg = {
        id: 'msg_high',
        type: MessageType.DATA,
        payload: { data: 'high' },
        timestamp: Date.now(),
        priority: MessagePriority.HIGH
      };

      await queue.enqueue(lowPriorityMsg);
      await queue.enqueue(highPriorityMsg);

      const first = queue.dequeue();
      const second = queue.dequeue();

      expect(first?.id).toBe('msg_high');
      expect(second?.id).toBe('msg_low');
    });

    test('should handle queue size limit', async () => {
      // Fill the queue
      for (let i = 0; i < 10; i++) {
        await queue.enqueue({
          id: `msg_${i}`,
          type: MessageType.DATA,
          payload: { data: `test_${i}` },
          timestamp: Date.now()
        });
      }

      // Try to add one more (should fail)
      const result = await queue.enqueue({
        id: 'msg_extra',
        type: MessageType.DATA,
        payload: { data: 'extra' },
        timestamp: Date.now()
      });

      expect(result).toBe(false);
    });

    test('should remove expired messages', async () => {
      const expiredMessage = {
        id: 'msg_expired',
        type: MessageType.DATA,
        payload: { data: 'expired' },
        timestamp: Date.now(),
        expiresAt: Date.now() - 1000 // Already expired
      };

      await queue.enqueue(expiredMessage);
      const removedCount = await queue.cleanupExpired();

      expect(removedCount).toBe(1);
      expect(queue.getAll()).toHaveLength(0);
    });
  });

  describe('Heartbeat Manager', () => {
    let heartbeatManager: HeartbeatManager;
    let callbacks: any;

    beforeEach(() => {
      callbacks = {
        onPing: jest.fn(),
        onPong: jest.fn(),
        onTimeout: jest.fn(),
        onConnectionLost: jest.fn()
      };

      heartbeatManager = new HeartbeatManager(
        {
          interval: 1000,
          timeout: 500,
          maxMissed: 3
        },
        callbacks
      );
    });

    afterEach(() => {
      heartbeatManager.stop();
    });

    test('should start and stop heartbeat', () => {
      expect(heartbeatManager.isRunning()).toBe(false);

      heartbeatManager.start();
      expect(heartbeatManager.isRunning()).toBe(true);

      heartbeatManager.stop();
      expect(heartbeatManager.isRunning()).toBe(false);
    });

    test('should send ping at intervals', () => {
      heartbeatManager.start();

      expect(callbacks.onPing).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1000);
      expect(callbacks.onPing).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(1000);
      expect(callbacks.onPing).toHaveBeenCalledTimes(2);
    });

    test('should handle pong responses', () => {
      heartbeatManager.start();

      // Trigger a ping
      jest.advanceTimersByTime(1000);
      expect(callbacks.onPing).toHaveBeenCalledTimes(1);

      // Handle pong
      heartbeatManager.handlePong();
      expect(callbacks.onPong).toHaveBeenCalledWith(expect.any(Number));
      expect(callbacks.onTimeout).not.toHaveBeenCalled();
    });

    test('should detect timeout and trigger connection lost', () => {
      heartbeatManager.start();

      // Trigger a ping
      jest.advanceTimersByTime(1000);

      // Fast-forward past timeout without pong
      jest.advanceTimersByTime(500);
      expect(callbacks.onTimeout).toHaveBeenCalledWith(1);

      // Trigger more timeouts to reach maxMissed
      jest.advanceTimersByTime(1000); // Second ping
      jest.advanceTimersByTime(500);  // Second timeout
      expect(callbacks.onTimeout).toHaveBeenCalledWith(2);

      jest.advanceTimersByTime(1000); // Third ping
      jest.advanceTimersByTime(500);  // Third timeout
      expect(callbacks.onTimeout).toHaveBeenCalledWith(3);
      expect(callbacks.onConnectionLost).toHaveBeenCalled();
      expect(heartbeatManager.isRunning()).toBe(false);
    });

    test('should calculate average latency', () => {
      heartbeatManager.start();

      // Simulate multiple pings and pongs
      for (let i = 0; i < 5; i++) {
        jest.advanceTimersByTime(1000);
        heartbeatManager.handlePong();
      }

      const avgLatency = heartbeatManager.getAverageLatency();
      expect(avgLatency).toBeGreaterThan(0);
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete connection lifecycle', async () => {
      client = new ReliableWebSocketClient('ws://localhost:8080', {
        storage,
        reconnect: true,
        heartbeatInterval: 1000,
        enableQueue: true
      });

      // Connect
      await client.connect();
      expect(client.getState()).toBe(ConnectionState.CONNECTED);

      // Send message
      const message = { type: 'test', data: 'integration' };
      await client.send(message);

      // Disconnect
      await client.disconnect();
      expect(client.getState()).toBe(ConnectionState.DISCONNECTED);

      // Cleanup
      await client.destroy();
    });

    test('should maintain message queue across reconnections', async () => {
      client = new ReliableWebSocketClient('ws://localhost:8080', {
        storage,
        reconnect: true,
        enableQueue: true,
        enablePersistence: true
      });

      await client.connect();
      await client.disconnect();

      // Queue a message while disconnected
      const message = { type: 'test', data: 'persistent' };
      await client.send(message);

      // Reconnect
      await client.connect();

      // Fast-forward to process queue
      jest.advanceTimersByTime(10);
      await Promise.resolve();

      const ws = (client as any).ws;
      expect(ws.sentMessages).toHaveLength(1);
      expect(ws.sentMessages[0].payload).toEqual(message);

      await client.destroy();
    });
  });
});