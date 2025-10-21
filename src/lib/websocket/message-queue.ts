/**
 * Message Queue for WebSocket Reliability
 * Handles message persistence, priority queuing, and expiration
 */

import { 
  Message, 
  QueuedMessage, 
  MessagePriority, 
  MessageQueueConfig,
  StorageAdapter 
} from './types';

export class MessageQueue {
  private queue: QueuedMessage[] = [];
  private config: MessageQueueConfig;
  private storage: StorageAdapter;
  private processing = false;
  private expirationTimer?: NodeJS.Timeout;

  constructor(config: MessageQueueConfig, storage: StorageAdapter) {
    this.config = {
      ...config,
      maxSize: config.maxSize || 1000,
      enablePersistence: config.enablePersistence !== false,
      storageKey: config.storageKey || 'websocket_message_queue',
      defaultPriority: config.defaultPriority || MessagePriority.NORMAL,
      defaultTTL: config.defaultTTL || 300000 // 5 minutes
    };
    
    this.storage = storage;
    this.loadFromStorage();
    this.startExpirationTimer();
  }

  /**
   * Add a message to the queue
   */
  public async enqueue(message: Message): Promise<boolean> {
    const now = Date.now();
    
    // Check if message has already expired
    if (message.expiresAt && message.expiresAt < now) {
      return false;
    }

    const queuedMessage: QueuedMessage = {
      ...message,
      addedAt: now,
      priority: message.priority || this.config.defaultPriority,
      retryCount: message.retryCount || 0,
      maxRetries: message.maxRetries || 3,
      expiresAt: message.expiresAt || (now + this.config.defaultTTL)
    };

    // Check queue size limit
    if (this.queue.length >= this.config.maxSize) {
      // Remove lowest priority message that isn't critical
      const lowestPriorityIndex = this.findLowestPriorityIndex();
      if (lowestPriorityIndex !== -1 && 
          this.queue[lowestPriorityIndex].priority! < queuedMessage.priority!) {
        this.queue.splice(lowestPriorityIndex, 1);
      } else {
        return false; // Can't add message, queue full
      }
    }

    // Insert message in priority order
    this.insertByPriority(queuedMessage);
    
    // Persist to storage if enabled
    if (this.config.enablePersistence) {
      await this.saveToStorage();
    }

    return true;
  }

  /**
   * Get the next message from the queue
   */
  public dequeue(): QueuedMessage | null {
    if (this.queue.length === 0) {
      return null;
    }

    const message = this.queue.shift()!;
    
    // Update storage if enabled
    if (this.config.enablePersistence) {
      // Don't await here to avoid blocking
      this.saveToStorage().catch(error => {
        console.error('Failed to save queue to storage:', error);
      });
    }

    return message;
  }

  /**
   * Get all messages in the queue
   */
  public getAll(): QueuedMessage[] {
    return [...this.queue];
  }

  /**
   * Get messages for retry (those that have exceeded their retry delay)
   */
  public getRetryableMessages(): QueuedMessage[] {
    const now = Date.now();
    return this.queue.filter(msg => 
      msg.nextRetryAt && msg.nextRetryAt <= now && 
      msg.retryCount! < msg.maxRetries!
    );
  }

  /**
   * Update a message's retry information
   */
  public async updateRetryInfo(messageId: string, nextRetryAt: number): Promise<boolean> {
    const messageIndex = this.queue.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) {
      return false;
    }

    this.queue[messageIndex].nextRetryAt = nextRetryAt;
    this.queue[messageIndex].retryCount!++;

    // Re-sort by priority if needed
    if (messageIndex > 0 && 
        this.queue[messageIndex].priority! > this.queue[messageIndex - 1].priority!) {
      const message = this.queue.splice(messageIndex, 1)[0];
      this.insertByPriority(message);
    }

    if (this.config.enablePersistence) {
      await this.saveToStorage();
    }

    return true;
  }

  /**
   * Remove a message from the queue
   */
  public async remove(messageId: string): Promise<boolean> {
    const index = this.queue.findIndex(msg => msg.id === messageId);
    if (index === -1) {
      return false;
    }

    this.queue.splice(index, 1);

    if (this.config.enablePersistence) {
      await this.saveToStorage();
    }

    return true;
  }

  /**
   * Clear all messages from the queue
   */
  public async clear(): Promise<void> {
    this.queue = [];

    if (this.config.enablePersistence) {
      await this.saveToStorage();
    }
  }

  /**
   * Get queue statistics
   */
  public getStats() {
    const now = Date.now();
    const expiredCount = this.queue.filter(msg => msg.expiresAt! < now).length;
    const retryableCount = this.getRetryableMessages().length;
    
    const priorityCounts = {
      [MessagePriority.CRITICAL]: 0,
      [MessagePriority.HIGH]: 0,
      [MessagePriority.NORMAL]: 0,
      [MessagePriority.LOW]: 0
    };

    this.queue.forEach(msg => {
      priorityCounts[msg.priority!]++;
    });

    return {
      total: this.queue.length,
      expired: expiredCount,
      retryable: retryableCount,
      priorityCounts,
      maxSize: this.config.maxSize,
      utilization: (this.queue.length / this.config.maxSize) * 100
    };
  }

  /**
   * Clean up expired messages
   */
  public async cleanupExpired(): Promise<number> {
    const now = Date.now();
    const initialLength = this.queue.length;
    
    this.queue = this.queue.filter(msg => msg.expiresAt! > now);
    
    const removedCount = initialLength - this.queue.length;
    
    if (removedCount > 0 && this.config.enablePersistence) {
      await this.saveToStorage();
    }

    return removedCount;
  }

  /**
   * Insert message into queue maintaining priority order
   */
  private insertByPriority(message: QueuedMessage): void {
    // Find insertion point based on priority (higher priority first)
    let insertIndex = this.queue.length;
    
    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].priority! < message.priority!) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, message);
  }

  /**
   * Find index of lowest priority message that isn't critical
   */
  private findLowestPriorityIndex(): number {
    let lowestIndex = -1;
    let lowestPriority = MessagePriority.CRITICAL + 1;

    for (let i = 0; i < this.queue.length; i++) {
      const priority = this.queue[i].priority!;
      if (priority < lowestPriority && priority < MessagePriority.CRITICAL) {
        lowestPriority = priority;
        lowestIndex = i;
      }
    }

    return lowestIndex;
  }

  /**
   * Start expiration timer to periodically clean up expired messages
   */
  private startExpirationTimer(): void {
    this.expirationTimer = setInterval(async () => {
      await this.cleanupExpired();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Load queue from persistent storage
   */
  private async loadFromStorage(): Promise<void> {
    if (!this.config.enablePersistence) {
      return;
    }

    try {
      const data = await this.storage.getItem(this.config.storageKey);
      if (!data) {
        return;
      }

      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        this.queue = parsed.filter(msg => {
          // Filter out expired messages
          return msg.expiresAt > Date.now();
        });
      }
    } catch (error) {
      console.error('Failed to load message queue from storage:', error);
    }
  }

  /**
   * Save queue to persistent storage
   */
  private async saveToStorage(): Promise<void> {
    if (!this.config.enablePersistence) {
      return;
    }

    try {
      const data = JSON.stringify(this.queue);
      await this.storage.setItem(this.config.storageKey, data);
    } catch (error) {
      console.error('Failed to save message queue to storage:', error);
    }
  }

  /**
   * Destroy the message queue and clean up resources
   */
  public destroy(): void {
    if (this.expirationTimer) {
      clearInterval(this.expirationTimer);
      this.expirationTimer = undefined;
    }
  }
}

/**
 * Default localStorage adapter for browser environments
 */
export class BrowserStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('Failed to get item from localStorage:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('Failed to set item in localStorage:', error);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to remove item from localStorage:', error);
    }
  }
}

/**
 * Memory storage adapter for Node.js environments
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private store: Record<string, string> = {};

  async getItem(key: string): Promise<string | null> {
    return this.store[key] || null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store[key] = value;
  }

  async removeItem(key: string): Promise<void> {
    delete this.store[key];
  }
}