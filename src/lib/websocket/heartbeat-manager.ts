/**
 * Heartbeat Manager for WebSocket Reliability
 * Manages ping/pong messages and connection health monitoring
 */

import { HeartbeatConfig, MessageType } from './types';

export interface HeartbeatCallbacks {
  onPing: () => void;
  onPong: (latency: number) => void;
  onTimeout: (missedCount: number) => void;
  onConnectionLost: () => void;
}

export class HeartbeatManager {
  private config: HeartbeatConfig;
  private callbacks: HeartbeatCallbacks;
  private intervalId?: NodeJS.Timeout;
  private timeoutId?: NodeJS.Timeout;
  private lastPingTime = 0;
  private missedBeats = 0;
  private isActive = false;
  private latencyHistory: number[] = [];
  private maxLatencyHistory = 10;

  constructor(config: HeartbeatConfig, callbacks: HeartbeatCallbacks) {
    this.config = {
      ...config,
      interval: config.interval || 5000,  // 5 seconds default
      timeout: config.timeout || 3000,   // 3 seconds default
      maxMissed: config.maxMissed || 3    // Allow 3 missed heartbeats
    };

    this.callbacks = callbacks;
  }

  /**
   * Start the heartbeat mechanism
   */
  public start(): void {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.missedBeats = 0;
    this.lastPingTime = 0;
    this.latencyHistory = [];

    // Send first ping immediately
    this.sendPing();

    // Set up regular interval
    this.intervalId = setInterval(() => {
      this.sendPing();
    }, this.config.interval);
  }

  /**
   * Stop the heartbeat mechanism
   */
  public stop(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }

  /**
   * Handle a pong response from the server
   */
  public handlePong(): void {
    if (!this.isActive || this.lastPingTime === 0) {
      return;
    }

    // Calculate latency
    const now = Date.now();
    const latency = now - this.lastPingTime;
    this.lastPingTime = 0;

    // Update latency history
    this.updateLatencyHistory(latency);

    // Reset missed beats counter
    this.missedBeats = 0;

    // Clear timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }

    // Notify callback
    this.callbacks.onPong(latency);
  }

  /**
   * Check if heartbeat is active
   */
  public isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Get current connection health statistics
   */
  public getStats() {
    return {
      isActive: this.isActive,
      missedBeats: this.missedBeats,
      maxMissedBeats: this.config.maxMissed,
      averageLatency: this.calculateAverageLatency(),
      lastPingTime: this.lastPingTime,
      config: { ...this.config }
    };
  }

  /**
   * Get average latency over recent history
   */
  public getAverageLatency(): number {
    return this.calculateAverageLatency();
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<HeartbeatConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart if active to apply new configuration
    if (this.isActive) {
      this.stop();
      this.start();
    }
  }

  /**
   * Send a ping message
   */
  private sendPing(): void {
    if (!this.isActive) {
      return;
    }

    // Clear any existing timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    // Record ping time
    this.lastPingTime = Date.now();

    // Set timeout for pong response
    this.timeoutId = setTimeout(() => {
      this.handleTimeout();
    }, this.config.timeout);

    // Send ping through callback
    this.callbacks.onPing();
  }

  /**
   * Handle heartbeat timeout
   */
  private handleTimeout(): void {
    if (!this.isActive) {
      return;
    }

    this.missedBeats++;
    this.lastPingTime = 0;

    // Notify about timeout
    this.callbacks.onTimeout(this.missedBeats);

    // Check if we've exceeded max missed beats
    if (this.missedBeats >= this.config.maxMissed) {
      this.callbacks.onConnectionLost();
      this.stop();
    }
  }

  /**
   * Update latency history and maintain max size
   */
  private updateLatencyHistory(latency: number): void {
    this.latencyHistory.push(latency);

    // Keep only the most recent measurements
    if (this.latencyHistory.length > this.maxLatencyHistory) {
      this.latencyHistory.shift();
    }
  }

  /**
   * Calculate average latency from history
   */
  private calculateAverageLatency(): number {
    if (this.latencyHistory.length === 0) {
      return 0;
    }

    const sum = this.latencyHistory.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / this.latencyHistory.length);
  }

  /**
   * Create a ping message
   */
  public static createPingMessage(): any {
    return {
      type: MessageType.HEARTBEAT,
      payload: {
        timestamp: Date.now()
      },
      timestamp: Date.now()
    };
  }

  /**
   * Create a pong message
   */
  public static createPongMessage(): any {
    return {
      type: MessageType.HEARTBEAT_ACK,
      payload: {
        timestamp: Date.now()
      },
      timestamp: Date.now()
    };
  }

  /**
   * Check if a message is a ping
   */
  public static isPingMessage(message: any): boolean {
    return message && message.type === MessageType.HEARTBEAT;
  }

  /**
   * Check if a message is a pong
   */
  public static isPongMessage(message: any): boolean {
    return message && message.type === MessageType.HEARTBEAT_ACK;
  }

  /**
   * Extract timestamp from ping/pong message
   */
  public static extractTimestamp(message: any): number | null {
    if (message && message.payload && typeof message.payload.timestamp === 'number') {
      return message.payload.timestamp;
    }
    return null;
  }
}