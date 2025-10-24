/**
 * Connection Manager Service
 * Handles auto-reconnection with exponential backoff for all connections
 */

import { EventEmitter } from 'events';

export type ConnectionType = 'pusher' | 'zeromq' | 'api' | 'mt5';

export interface ConnectionStatus {
  type: ConnectionType;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastConnected?: Date;
  lastError?: string;
  reconnectAttempts: number;
}

export interface ReconnectConfig {
  initialDelay: number;
  maxDelay: number;
  maxAttempts: number;
  backoffMultiplier: number;
}

export class ConnectionManager extends EventEmitter {
  private connections: Map<ConnectionType, ConnectionStatus> = new Map();
  private reconnectTimers: Map<ConnectionType, NodeJS.Timeout> = new Map();
  private config: ReconnectConfig;
  private logger: (level: string, message: string, metadata?: any) => void;

  constructor(
    config?: Partial<ReconnectConfig>,
    logger?: (level: string, message: string, metadata?: any) => void
  ) {
    super();
    
    this.config = {
      initialDelay: 1000, // 1 second
      maxDelay: 60000, // 1 minute
      maxAttempts: 10,
      backoffMultiplier: 2,
      ...config,
    };
    
    this.logger = logger || console.log;
    
    // Initialize connection statuses
    const types: ConnectionType[] = ['pusher', 'zeromq', 'api', 'mt5'];
    types.forEach(type => {
      this.connections.set(type, {
        type,
        status: 'disconnected',
        reconnectAttempts: 0,
      });
    });
  }

  /**
   * Register a connection as connected
   */
  setConnected(type: ConnectionType): void {
    const status = this.connections.get(type);
    if (status) {
      status.status = 'connected';
      status.lastConnected = new Date();
      status.reconnectAttempts = 0;
      status.lastError = undefined;
      
      this.log('info', `${type} connected`, { type });
      this.emit('connection-status-changed', { type, status: 'connected' });
      
      // Clear any pending reconnect timer
      this.clearReconnectTimer(type);
    }
  }

  /**
   * Register a connection as disconnected
   */
  setDisconnected(type: ConnectionType, error?: string): void {
    const status = this.connections.get(type);
    if (status) {
      status.status = 'disconnected';
      status.lastError = error;
      
      this.log('warn', `${type} disconnected`, { type, error });
      this.emit('connection-status-changed', { type, status: 'disconnected', error });
      
      // Start auto-reconnection
      this.scheduleReconnect(type);
    }
  }

  /**
   * Register a connection error
   */
  setError(type: ConnectionType, error: string): void {
    const status = this.connections.get(type);
    if (status) {
      status.status = 'error';
      status.lastError = error;
      
      this.log('error', `${type} connection error`, { type, error });
      this.emit('connection-status-changed', { type, status: 'error', error });
      
      // Start auto-reconnection
      this.scheduleReconnect(type);
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(type: ConnectionType): void {
    const status = this.connections.get(type);
    if (!status) return;

    // Check if we've exceeded max attempts
    if (status.reconnectAttempts >= this.config.maxAttempts) {
      this.log('error', `${type} max reconnection attempts reached`, {
        type,
        attempts: status.reconnectAttempts,
      });
      this.emit('max-reconnect-attempts-reached', { type });
      return;
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.config.initialDelay * Math.pow(this.config.backoffMultiplier, status.reconnectAttempts),
      this.config.maxDelay
    );

    status.reconnectAttempts++;
    status.status = 'connecting';

    this.log('info', `${type} scheduling reconnection attempt #${status.reconnectAttempts}`, {
      type,
      attempt: status.reconnectAttempts,
      delay,
    });

    // Notify after 3 failed attempts
    if (status.reconnectAttempts === 3) {
      this.emit('reconnection-struggling', {
        type,
        attempts: status.reconnectAttempts,
        message: `Having trouble reconnecting to ${type}. Will keep trying...`,
      });
    }

    // Clear existing timer
    this.clearReconnectTimer(type);

    // Schedule reconnection
    const timer = setTimeout(() => {
      this.emit('reconnect-requested', { type, attempt: status.reconnectAttempts });
    }, delay);

    this.reconnectTimers.set(type, timer);
  }

  /**
   * Clear reconnect timer for a connection
   */
  private clearReconnectTimer(type: ConnectionType): void {
    const timer = this.reconnectTimers.get(type);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(type);
    }
  }

  /**
   * Reset reconnection attempts for a connection
   */
  resetReconnectAttempts(type: ConnectionType): void {
    const status = this.connections.get(type);
    if (status) {
      status.reconnectAttempts = 0;
      this.clearReconnectTimer(type);
    }
  }

  /**
   * Get status for a specific connection
   */
  getStatus(type: ConnectionType): ConnectionStatus | undefined {
    return this.connections.get(type);
  }

  /**
   * Get status for all connections
   */
  getAllStatuses(): Map<ConnectionType, ConnectionStatus> {
    return new Map(this.connections);
  }

  /**
   * Check if all connections are connected
   */
  areAllConnected(): boolean {
    return Array.from(this.connections.values()).every(
      status => status.status === 'connected'
    );
  }

  /**
   * Check if any connection is in error state
   */
  hasErrors(): boolean {
    return Array.from(this.connections.values()).some(
      status => status.status === 'error'
    );
  }

  /**
   * Get connection health summary
   */
  getHealthSummary(): {
    healthy: boolean;
    connected: number;
    disconnected: number;
    errors: number;
    reconnecting: number;
  } {
    const statuses = Array.from(this.connections.values());
    
    return {
      healthy: this.areAllConnected(),
      connected: statuses.filter(s => s.status === 'connected').length,
      disconnected: statuses.filter(s => s.status === 'disconnected').length,
      errors: statuses.filter(s => s.status === 'error').length,
      reconnecting: statuses.filter(s => s.status === 'connecting').length,
    };
  }

  /**
   * Force reconnection for a specific connection
   */
  forceReconnect(type: ConnectionType): void {
    const status = this.connections.get(type);
    if (status) {
      this.log('info', `Force reconnecting ${type}`, { type });
      this.clearReconnectTimer(type);
      status.reconnectAttempts = 0;
      this.emit('reconnect-requested', { type, forced: true });
    }
  }

  /**
   * Stop all reconnection attempts
   */
  stopAllReconnections(): void {
    this.log('info', 'Stopping all reconnection attempts');
    
    this.connections.forEach((_, type) => {
      this.clearReconnectTimer(type);
    });
  }

  /**
   * Cleanup and stop all timers
   */
  destroy(): void {
    this.log('info', 'Destroying connection manager');
    this.stopAllReconnections();
    this.removeAllListeners();
  }

  /**
   * Helper: Log messages
   */
  private log(level: string, message: string, metadata?: any): void {
    this.logger(level, `[ConnectionManager] ${message}`, metadata);
  }
}
