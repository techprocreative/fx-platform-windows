/**
 * WebSocket Reliability Types
 * Defines interfaces and enums for reliable WebSocket communication
 */

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  DISCONNECTING = 'disconnecting',
  ERROR = 'error'
}

export enum MessagePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

export enum MessageType {
  // Standard message types
  DATA = 'data',
  COMMAND = 'command',
  RESPONSE = 'response',
  
  // Reliability message types
  ACK = 'ack',
  NACK = 'nack',
  HEARTBEAT = 'heartbeat',
  HEARTBEAT_ACK = 'heartbeat_ack',
  
  // Connection management
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  RECONNECT = 'reconnect'
}

export interface Message {
  id: string;
  type: MessageType;
  payload: any;
  timestamp: number;
  priority?: MessagePriority;
  requiresAck?: boolean;
  retryCount?: number;
  maxRetries?: number;
  expiresAt?: number;
}

export interface Acknowledgement {
  messageId: string;
  success: boolean;
  error?: string;
  timestamp: number;
}

export interface ConnectionConfig {
  url: string;
  protocols?: string[];
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  messageTimeout?: number;
  enableQueue?: boolean;
  queueSize?: number;
  enablePersistence?: boolean;
  storageKey?: string;
}

export interface QueuedMessage extends Message {
  addedAt: number;
  nextRetryAt?: number;
}

export interface ConnectionStats {
  connectionState: ConnectionState;
  connectedAt?: number;
  lastConnectedAt?: number;
  disconnectedAt?: number;
  reconnectAttempts: number;
  messagesSent: number;
  messagesReceived: number;
  messagesQueued: number;
  messagesDropped: number;
  averageLatency: number;
  lastHeartbeat?: number;
}

export interface HeartbeatConfig {
  interval: number; // in milliseconds
  timeout: number;  // in milliseconds
  maxMissed: number;
}

export interface MessageQueueConfig {
  maxSize: number;
  enablePersistence: boolean;
  storageKey: string;
  defaultPriority: MessagePriority;
  defaultTTL: number; // Time to live in milliseconds
}

export interface ReconnectConfig {
  enabled: boolean;
  maxAttempts: number;
  initialDelay: number; // in milliseconds
  maxDelay: number;     // in milliseconds
  backoffFactor: number;
}

export interface WebSocketEventMap {
  open: Event;
  close: CloseEvent;
  error: Event;
  message: MessageEvent;
  connecting: CustomEvent<{ attempt: number }>;
  reconnecting: CustomEvent<{ attempt: number; delay: number }>;
  disconnected: CustomEvent<{ code: number; reason: string }>;
  connectionFailed: CustomEvent<{ error: Error }>;
  messageQueued: CustomEvent<{ message: Message }>;
  messageSent: CustomEvent<{ message: Message }>;
  messageReceived: CustomEvent<{ message: Message }>;
  messageAcknowledged: CustomEvent<{ acknowledgement: Acknowledgement }>;
  messageDropped: CustomEvent<{ message: Message; reason: string }>;
  heartbeatReceived: CustomEvent<{ latency: number }>;
  heartbeatTimeout: CustomEvent<{ missedCount: number }>;
}

export type WebSocketEventListener<T extends keyof WebSocketEventMap> = (
  event: WebSocketEventMap[T]
) => void;

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface ReliableWebSocketOptions extends Partial<ConnectionConfig> {
  storage?: StorageAdapter;
  onStateChange?: (state: ConnectionState) => void;
  onMessage?: (message: Message) => void;
  onError?: (error: Error) => void;
}

export interface MessageDeliveryResult {
  messageId: string;
  success: boolean;
  delivered: boolean;
  acknowledged: boolean;
  error?: string;
  attempts: number;
  latency?: number;
}