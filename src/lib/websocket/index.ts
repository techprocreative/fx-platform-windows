/**
 * WebSocket Reliability Module
 * Exports all components for reliable WebSocket communication
 */

// Core types and interfaces
export type {
  Message,
  Acknowledgement,
  ConnectionConfig,
  QueuedMessage,
  ConnectionStats,
  HeartbeatConfig,
  MessageQueueConfig,
  ReconnectConfig,
  WebSocketEventMap,
  WebSocketEventListener,
  StorageAdapter,
  ReliableWebSocketOptions,
  MessageDeliveryResult
} from './types';

export {
  ConnectionState,
  MessagePriority,
  MessageType
} from './types';

// Core components
export { ReliableWebSocketClient } from './reliable-client';
export { MessageQueue, BrowserStorageAdapter, MemoryStorageAdapter } from './message-queue';
export { HeartbeatManager } from './heartbeat-manager';

// Integration example
export { TradingClient, exampleUsage } from './integration-example';