/**
 * Integration Example for Reliable WebSocket Client
 * Demonstrates how to use the ReliableWebSocketClient with the existing server
 */

import { ReliableWebSocketClient } from './reliable-client';
import { ConnectionState, MessageType } from './types';
import { MemoryStorageAdapter } from './message-queue';

/**
 * Example client that connects to the trading WebSocket server
 */
export class TradingClient {
  private wsClient: ReliableWebSocketClient;
  private isConnected = false;

  constructor(serverUrl: string, apiKey: string) {
    // Create a reliable WebSocket client with trading-specific configuration
    this.wsClient = new ReliableWebSocketClient(serverUrl, {
      // Add API key to URL as query parameter for authentication
      storage: new MemoryStorageAdapter(),
      reconnect: true,
      reconnectInterval: 2000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 5000, // 5-second heartbeat as required
      heartbeatTimeout: 3000,
      messageTimeout: 10000,
      enableQueue: true,
      queueSize: 500,
      enablePersistence: true,
      storageKey: 'trading_client_queue',
      
      // Event handlers
      onStateChange: (state: ConnectionState) => {
        console.log(`Connection state changed to: ${state}`);
        this.isConnected = state === ConnectionState.CONNECTED;
      },
      
      onMessage: (message: any) => {
        this.handleMessage(message);
      },
      
      onError: (error: Error) => {
        console.error('WebSocket error:', error);
      }
    });

    // Add additional event listeners
    this.setupEventListeners();
  }

  /**
   * Connect to the trading server
   */
  public async connect(): Promise<void> {
    try {
      await this.wsClient.connect();
      console.log('Connected to trading server');
    } catch (error) {
      console.error('Failed to connect to trading server:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the trading server
   */
  public async disconnect(): Promise<void> {
    try {
      await this.wsClient.disconnect();
      console.log('Disconnected from trading server');
    } catch (error) {
      console.error('Failed to disconnect from trading server:', error);
      throw error;
    }
  }

  /**
   * Send a trade signal with delivery confirmation
   */
  public async sendTradeSignal(signal: any): Promise<boolean> {
    if (!this.isConnected) {
      console.warn('Not connected to server, message will be queued');
    }

    try {
      const result = await this.wsClient.sendWithAcknowledgement({
        type: 'TRADE_SIGNAL',
        payload: signal,
        timestamp: Date.now()
      });

      if (result.acknowledged) {
        console.log(`Trade signal acknowledged: ${result.messageId}`);
        return true;
      } else {
        console.warn(`Trade signal not acknowledged: ${result.error}`);
        return false;
      }
    } catch (error) {
      console.error('Failed to send trade signal:', error);
      return false;
    }
  }

  /**
   * Request a command from the server
   */
  public async requestCommand(): Promise<void> {
    if (!this.isConnected) {
      console.warn('Not connected to server, message will be queued');
    }

    try {
      await this.wsClient.send({
        type: 'REQUEST_COMMAND',
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Failed to request command:', error);
    }
  }

  /**
   * Send execution result to server
   */
  public async sendExecutionResult(result: any): Promise<void> {
    if (!this.isConnected) {
      console.warn('Not connected to server, message will be queued');
    }

    try {
      await this.wsClient.send({
        type: 'EXECUTION_RESULT',
        payload: result,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Failed to send execution result:', error);
    }
  }

  /**
   * Send market update to server
   */
  public async sendMarketUpdate(update: any): Promise<void> {
    if (!this.isConnected) {
      console.warn('Not connected to server, message will be queued');
    }

    try {
      await this.wsClient.send({
        type: 'MARKET_UPDATE',
        payload: update,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Failed to send market update:', error);
    }
  }

  /**
   * Send status update to server
   */
  public async sendStatusUpdate(status: any): Promise<void> {
    if (!this.isConnected) {
      console.warn('Not connected to server, message will be queued');
    }

    try {
      await this.wsClient.send({
        type: 'STATUS_UPDATE',
        payload: status,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Failed to send status update:', error);
    }
  }

  /**
   * Get connection statistics
   */
  public getStats() {
    return this.wsClient.getStats();
  }

  /**
   * Check if connected to server
   */
  public isClientConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Setup event listeners for specific message types
   */
  private setupEventListeners(): void {
    // Listen for trade signals from server
    this.wsClient.addEventListener('message', (event: any) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'TRADE_SIGNAL':
            this.handleTradeSignal(message.payload);
            break;
          case 'EMERGENCY_STOP':
            this.handleEmergencyStop(message.payload);
            break;
          case 'HEARTBEAT_ACK':
            // Handled by the heartbeat manager
            break;
          default:
            console.log('Received message:', message);
        }
      } catch (error) {
        console.error('Failed to handle message:', error);
      }
    });

    // Listen for heartbeat timeouts
    this.wsClient.addEventListener('heartbeatTimeout', (event: any) => {
      console.warn(`Heartbeat timeout: ${event.missedCount} missed beats`);
    });

    // Listen for reconnection attempts
    this.wsClient.addEventListener('reconnecting', (event: any) => {
      console.log(`Reconnecting... Attempt ${event.attempt}, delay: ${event.delay}ms`);
    });

    // Listen for connection failures
    this.wsClient.addEventListener('connectionFailed', (event: any) => {
      console.error('Connection failed:', event.error);
    });
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: any): void {
    // Basic message handling - can be extended
    console.log('Received message:', message);
  }

  /**
   * Handle trade signal from server
   */
  private handleTradeSignal(signal: any): void {
    console.log('Received trade signal:', signal);
    // Implement trade signal handling logic
  }

  /**
   * Handle emergency stop from server
   */
  private handleEmergencyStop(payload: any): void {
    console.warn('Emergency stop received:', payload.reason);
    // Implement emergency stop logic
  }

  /**
   * Destroy the client and clean up resources
   */
  public async destroy(): Promise<void> {
    await this.wsClient.destroy();
  }
}

/**
 * Example usage of the TradingClient
 */
export async function exampleUsage() {
  // Create client instance
  const client = new TradingClient('ws://localhost:8080', 'your-api-key-here');

  try {
    // Connect to server
    await client.connect();

    // Send a trade signal
    const tradeSignal = {
      symbol: 'EURUSD',
      action: 'BUY',
      volume: 0.1,
      stopLoss: 1.1800,
      takeProfit: 1.1900
    };

    const success = await client.sendTradeSignal(tradeSignal);
    if (success) {
      console.log('Trade signal sent successfully');
    } else {
      console.error('Failed to send trade signal');
    }

    // Request a command from server
    await client.requestCommand();

    // Send status update
    await client.sendStatusUpdate({
      status: 'ready',
      positions: 2,
      balance: 10000
    });

    // Get statistics
    const stats = client.getStats();
    console.log('Connection stats:', stats);

    // Keep connection alive for demonstration
    await new Promise(resolve => setTimeout(resolve, 10000));

  } catch (error) {
    console.error('Error in example usage:', error);
  } finally {
    // Clean up
    await client.destroy();
  }
}

// Export for use in other modules
export { ReliableWebSocketClient };