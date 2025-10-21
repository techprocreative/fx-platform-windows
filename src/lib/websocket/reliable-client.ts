/**
 * Reliable WebSocket Client
 * Provides auto-reconnection, message queuing, delivery confirmation, and heartbeat functionality
 */

import {
  Message,
  MessageType,
  ConnectionState,
  ConnectionConfig,
  Acknowledgement,
  MessageDeliveryResult,
  ReliableWebSocketOptions,
  StorageAdapter,
  WebSocketEventListener,
  MessageQueueConfig,
  MessagePriority
} from './types';
import { MessageQueue, BrowserStorageAdapter } from './message-queue';
import { HeartbeatManager, HeartbeatCallbacks } from './heartbeat-manager';

export class ReliableWebSocketClient {
  private ws?: WebSocket;
  private config: ConnectionConfig;
  private storage: StorageAdapter;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private messageQueue: MessageQueue;
  private heartbeatManager?: HeartbeatManager;
  private reconnectAttempts = 0;
  private reconnectTimeoutId?: NodeJS.Timeout;
  private pendingAcknowledgements = new Map<string, {
    resolve: (value: boolean) => void;
    reject: (reason: any) => void;
    timeout: NodeJS.Timeout;
    timestamp: number;
  }>();
  private eventListeners = new Map<keyof any, Set<Function>>();
  private stats = {
    connectionState: ConnectionState.DISCONNECTED,
    connectedAt: undefined as number | undefined,
    lastConnectedAt: undefined as number | undefined,
    disconnectedAt: undefined as number | undefined,
    reconnectAttempts: 0,
    messagesSent: 0,
    messagesReceived: 0,
    messagesQueued: 0,
    messagesDropped: 0,
    averageLatency: 0,
    lastHeartbeat: undefined as number | undefined
  };

  constructor(url: string, options: ReliableWebSocketOptions = {}) {
    this.config = {
      url,
      protocols: options.protocols,
      reconnect: options.reconnect !== false,
      reconnectInterval: options.reconnectInterval || 1000,
      maxReconnectAttempts: options.maxReconnectAttempts || 5,
      heartbeatInterval: options.heartbeatInterval || 5000,
      heartbeatTimeout: options.heartbeatTimeout || 3000,
      messageTimeout: options.messageTimeout || 10000,
      enableQueue: options.enableQueue !== false,
      queueSize: options.queueSize || 1000,
      enablePersistence: options.enablePersistence !== false,
      storageKey: options.storageKey || 'reliable_ws_client'
    };

    this.storage = options.storage || new BrowserStorageAdapter();

    // Initialize message queue
    const queueConfig: MessageQueueConfig = {
      maxSize: this.config.queueSize!,
      enablePersistence: this.config.enablePersistence!,
      storageKey: `${this.config.storageKey}_queue`,
      defaultPriority: MessagePriority.NORMAL,
      defaultTTL: 300000 // 5 minutes
    };
    this.messageQueue = new MessageQueue(queueConfig, this.storage);

    // Set up custom callbacks
    if (options.onStateChange) {
      this.addEventListener('statechange', options.onStateChange);
    }
    if (options.onMessage) {
      this.addEventListener('message', options.onMessage);
    }
    if (options.onError) {
      this.addEventListener('error', options.onError);
    }
  }

  /**
   * Connect to the WebSocket server
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state === ConnectionState.CONNECTING || this.state === ConnectionState.CONNECTED) {
        resolve();
        return;
      }

      this.setState(ConnectionState.CONNECTING);
      
      try {
        this.ws = new WebSocket(this.config.url, this.config.protocols);
        this.setupWebSocketEventHandlers(resolve, reject);
      } catch (error) {
        this.setState(ConnectionState.ERROR);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  public disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.state === ConnectionState.DISCONNECTED) {
        resolve();
        return;
      }

      this.setState(ConnectionState.DISCONNECTING);
      
      // Stop reconnection attempts
      if (this.reconnectTimeoutId) {
        clearTimeout(this.reconnectTimeoutId);
        this.reconnectTimeoutId = undefined;
      }

      // Stop heartbeat
      if (this.heartbeatManager) {
        this.heartbeatManager.stop();
      }

      // Close WebSocket
      if (this.ws) {
        this.ws.close(1000, 'Client disconnect');
      } else {
        this.handleDisconnect();
        resolve();
      }
    });
  }

  /**
   * Send a message with optional delivery confirmation
   */
  public async send(message: any, requireAck: boolean = false): Promise<boolean> {
    const msg: Message = {
      id: this.generateMessageId(),
      type: MessageType.DATA,
      payload: message,
      timestamp: Date.now(),
      requiresAck: requireAck
    };

    if (this.state === ConnectionState.CONNECTED && this.ws?.readyState === WebSocket.OPEN) {
      return this.sendMessageDirectly(msg);
    } else {
      // Queue the message for later delivery
      const queued = await this.messageQueue.enqueue(msg);
      if (queued) {
        this.stats.messagesQueued++;
        this.emit('messageQueued', { message: msg });
      }
      return queued;
    }
  }

  /**
   * Send a message and wait for acknowledgement
   */
  public async sendWithAcknowledgement(message: any, timeout?: number): Promise<MessageDeliveryResult> {
    const ackTimeout = timeout || this.config.messageTimeout!;
    const msg: Message = {
      id: this.generateMessageId(),
      type: MessageType.DATA,
      payload: message,
      timestamp: Date.now(),
      requiresAck: true
    };

    if (this.state === ConnectionState.CONNECTED && this.ws?.readyState === WebSocket.OPEN) {
      return this.sendMessageAndWaitForAck(msg, ackTimeout);
    } else {
      // Queue the message and return a pending result
      const queued = await this.messageQueue.enqueue(msg);
      if (!queued) {
        return {
          messageId: msg.id,
          success: false,
          delivered: false,
          acknowledged: false,
          error: 'Message queue full',
          attempts: 0
        };
      }

      this.stats.messagesQueued++;
      this.emit('messageQueued', { message: msg });

      return {
        messageId: msg.id,
        success: true,
        delivered: false,
        acknowledged: false,
        attempts: 0
      };
    }
  }

  /**
   * Get current connection state
   */
  public getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get connection statistics
   */
  public getStats() {
    const queueStats = this.messageQueue.getStats();
    const heartbeatStats = this.heartbeatManager?.getStats();

    return {
      ...this.stats,
      queueStats,
      heartbeatStats
    };
  }

  /**
   * Add event listener
   */
  public addEventListener(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * Remove event listener
   */
  public removeEventListener(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.eventListeners.delete(event);
      }
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketEventHandlers(resolve: () => void, reject: (error: Error) => void): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.handleConnect();
      resolve();
    };

    this.ws.onclose = (event) => {
      this.handleDisconnect(event.code, event.reason);
    };

    this.ws.onerror = (event) => {
      const error = new Error('WebSocket connection error');
      this.setState(ConnectionState.ERROR);
      this.emit('error', error);
      reject(error);
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  /**
   * Handle successful connection
   */
  private handleConnect(): void {
    this.setState(ConnectionState.CONNECTED);
    this.stats.connectedAt = Date.now();
    this.stats.lastConnectedAt = Date.now();
    this.reconnectAttempts = 0;

    // Start heartbeat
    this.startHeartbeat();

    // Send queued messages
    this.processQueuedMessages();

    this.emit('open', new Event('open'));
  }

  /**
   * Handle connection loss
   */
  private handleDisconnect(code: number = 1000, reason: string = ''): void {
    this.setState(ConnectionState.DISCONNECTED);
    this.stats.disconnectedAt = Date.now();

    // Stop heartbeat
    if (this.heartbeatManager) {
      this.heartbeatManager.stop();
    }

    // Reject all pending acknowledgements
    this.rejectAllPendingAcknowledgements(new Error('Connection lost'));

    // Attempt reconnection if enabled
    if (this.config.reconnect && code !== 1000) {
      this.scheduleReconnect();
    }

    this.emit('close', new CloseEvent('close', { code, reason }));
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      this.stats.messagesReceived++;

      // Handle special message types
      if (message.type === MessageType.ACK) {
        this.handleAcknowledgement(message);
        return;
      }

      if (HeartbeatManager.isPingMessage(message)) {
        this.handlePingMessage(message);
        return;
      }

      if (HeartbeatManager.isPongMessage(message)) {
        this.handlePongMessage(message);
        return;
      }

      // Regular message
      this.emit('message', { data: JSON.stringify(message) });

      // Send acknowledgement if required
      if (message.requiresAck) {
        this.sendAcknowledgement(message.id);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Send message directly through WebSocket
   */
  private sendMessageDirectly(message: Message): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      this.stats.messagesSent++;
      this.emit('messageSent', { message });
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }

  /**
   * Send message and wait for acknowledgement
   */
  private async sendMessageAndWaitForAck(message: Message, timeout: number): Promise<MessageDeliveryResult> {
    const startTime = Date.now();
    
    // Send the message
    const sent = this.sendMessageDirectly(message);
    if (!sent) {
      return {
        messageId: message.id,
        success: false,
        delivered: false,
        acknowledged: false,
        error: 'Failed to send message',
        attempts: 0
      };
    }

    // Wait for acknowledgement
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        this.pendingAcknowledgements.delete(message.id);
        resolve({
          messageId: message.id,
          success: false,
          delivered: true,
          acknowledged: false,
          error: 'Acknowledgement timeout',
          attempts: 1,
          latency: Date.now() - startTime
        });
      }, timeout);

      this.pendingAcknowledgements.set(message.id, {
        resolve: (success: boolean) => {
          clearTimeout(timeoutId);
          resolve({
            messageId: message.id,
            success,
            delivered: true,
            acknowledged: success,
            attempts: 1,
            latency: Date.now() - startTime
          });
        },
        reject: (reason: any) => {
          clearTimeout(timeoutId);
          resolve({
            messageId: message.id,
            success: false,
            delivered: true,
            acknowledged: false,
            error: String(reason),
            attempts: 1,
            latency: Date.now() - startTime
          });
        },
        timeout: timeoutId,
        timestamp: startTime
      });
    });
  }

  /**
   * Process queued messages
   */
  private async processQueuedMessages(): Promise<void> {
    if (this.state !== ConnectionState.CONNECTED) {
      return;
    }

    // Process regular queued messages
    let message = this.messageQueue.dequeue();
    while (message) {
      const sent = this.sendMessageDirectly(message);
      if (!sent) {
        // Re-queue if failed to send
        await this.messageQueue.enqueue(message);
        break;
      }
      message = this.messageQueue.dequeue();
    }

    // Process retryable messages
    const retryableMessages = this.messageQueue.getRetryableMessages();
    for (const msg of retryableMessages) {
      const sent = this.sendMessageDirectly(msg);
      if (sent) {
        await this.messageQueue.remove(msg.id);
      }
    }
  }

  /**
   * Handle acknowledgement
   */
  private handleAcknowledgement(ack: Acknowledgement): void {
    const pending = this.pendingAcknowledgements.get(ack.messageId);
    if (pending) {
      this.pendingAcknowledgements.delete(ack.messageId);
      pending.resolve(ack.success);
      this.emit('messageAcknowledged', { acknowledgement: ack });
    }
  }

  /**
   * Send acknowledgement for a message
   */
  private sendAcknowledgement(messageId: string): void {
    const ack: Acknowledgement = {
      messageId,
      success: true,
      timestamp: Date.now()
    };

    this.sendMessageDirectly({
      id: this.generateMessageId(),
      type: MessageType.ACK,
      payload: ack,
      timestamp: Date.now()
    });
  }

  /**
   * Handle ping message
   */
  private handlePingMessage(message: any): void {
    // Send pong response
    const pong = HeartbeatManager.createPongMessage();
    this.sendMessageDirectly({
      id: pong.id,
      type: pong.type,
      payload: pong.payload,
      timestamp: pong.timestamp
    });
  }

  /**
   * Handle pong message
   */
  private handlePongMessage(message: any): void {
    if (this.heartbeatManager) {
      this.heartbeatManager.handlePong();
    }
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    const heartbeatCallbacks: HeartbeatCallbacks = {
      onPing: () => {
        const ping = HeartbeatManager.createPingMessage();
        this.sendMessageDirectly({
          id: ping.id,
          type: ping.type,
          payload: ping.payload,
          timestamp: ping.timestamp
        });
      },
      onPong: (latency: number) => {
        this.stats.averageLatency = latency;
        this.stats.lastHeartbeat = Date.now();
        this.emit('heartbeatReceived', { latency });
      },
      onTimeout: (missedCount: number) => {
        this.emit('heartbeatTimeout', { missedCount });
      },
      onConnectionLost: () => {
        console.warn('Connection lost due to heartbeat timeout');
        if (this.ws) {
          this.ws.close(1006, 'Heartbeat timeout');
        }
      }
    };

    this.heartbeatManager = new HeartbeatManager({
      interval: this.config.heartbeatInterval!,
      timeout: this.config.heartbeatTimeout!,
      maxMissed: 3
    }, heartbeatCallbacks);

    this.heartbeatManager.start();
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts!) {
      console.error('Max reconnection attempts reached');
      this.setState(ConnectionState.ERROR);
      this.emit('connectionFailed', { error: new Error('Max reconnection attempts reached') });
      return;
    }

    this.reconnectAttempts++;
    this.stats.reconnectAttempts = this.reconnectAttempts;

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.config.reconnectInterval! * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    this.setState(ConnectionState.RECONNECTING);
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimeoutId = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnection failed:', error);
        this.scheduleReconnect();
      }
    }, delay);
  }

  /**
   * Reject all pending acknowledgements
   */
  private rejectAllPendingAcknowledgements(error: Error): void {
    for (const [messageId, pending] of this.pendingAcknowledgements) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingAcknowledgements.clear();
  }

  /**
   * Set connection state
   */
  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      this.stats.connectionState = newState;
      this.emit('statechange', newState);
      console.log(`WebSocket state changed: ${oldState} -> ${newState}`);
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Destroy the client and clean up resources
   */
  public async destroy(): Promise<void> {
    await this.disconnect();
    this.messageQueue.destroy();
    this.eventListeners.clear();
    this.rejectAllPendingAcknowledgements(new Error('Client destroyed'));
  }
}