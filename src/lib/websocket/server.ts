/**
 * WEBSOCKET SERVER
 * Real-time communication between Brain (Web) and Executor (Windows)
 * DO NOT DELETE - CRITICAL ARCHITECTURE COMPONENT
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { prisma } from '../prisma';
import { getCommandQueue } from '../commands/queue';
import jwt from 'jsonwebtoken';

interface WSClient {
  id: string;
  ws: WebSocket;
  executorId: string;
  apiKey: string;
  isAlive: boolean;
  lastHeartbeat: Date;
  ipAddress: string;
}

interface WSMessage {
  type: string;
  payload: any;
  timestamp: string;
}

export class TradingWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, WSClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private commandQueue = getCommandQueue();
  private maxConnections: number = 1000; // Connection pool limit
  private connectionTimeout: number = 300000; // 5 minutes timeout
  private maxInactiveTime: number = 120000; // 2 minutes max inactive time

  constructor(port: number = 8080) {
    this.wss = new WebSocketServer({
      port,
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 7,
          level: 3,
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024,
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
        threshold: 1024,
      },
    });

    this.setupWebSocketServer();
    this.startHeartbeat();
    this.startCleanupInterval();
  }

  /**
   * Setup WebSocket server event handlers
   */
  private setupWebSocketServer(): void {
    this.wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
      // Check connection pool limit
      if (this.clients.size >= this.maxConnections) {
        console.warn(`Connection limit reached (${this.maxConnections}). Rejecting new connection.`);
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: { message: 'Server connection limit reached' },
        }));
        ws.close(1008, 'Connection limit reached');
        return;
      }

      const apiKey = this.extractApiKey(req);
      const ipAddress = this.getClientIP(req);

      if (!apiKey) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: { message: 'Authentication required' },
        }));
        ws.close(1008, 'Authentication required');
        return;
      }

      // Validate API key
      const executor = await this.validateApiKey(apiKey);
      if (!executor) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: { message: 'Invalid API key' },
        }));
        ws.close(1008, 'Invalid API key');
        return;
      }

      // Check if executor already has an active connection
      const existingClient = Array.from(this.clients.values()).find(
        c => c.executorId === executor.id
      );
      
      if (existingClient) {
        console.warn(`Executor ${executor.id} already connected. Terminating previous connection.`);
        this.forceDisconnectClient(existingClient, 'New connection from same executor');
      }

      // Create client object
      const client: WSClient = {
        id: `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ws,
        executorId: executor.id,
        apiKey,
        isAlive: true,
        lastHeartbeat: new Date(),
        ipAddress,
      };

      // Add to clients map
      this.clients.set(client.id, client);

      // Set connection timeout
      this.setConnectionTimeout(client);

      // Log connection
      await this.logConnection(client, true);

      // Send welcome message
      this.sendMessage(client, {
        type: 'CONNECTED',
        payload: {
          executorId: executor.id,
          clientId: client.id,
          timestamp: new Date().toISOString(),
          connectionPoolSize: this.clients.size,
        },
      });

      // Setup client event handlers
      this.setupClientHandlers(client);

      console.log(`Executor connected: ${executor.id} from ${ipAddress}. Total connections: ${this.clients.size}`);
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });
  }

  /**
   * Setup handlers for individual client
   */
  private setupClientHandlers(client: WSClient): void {
    const { ws } = client;

    // Handle incoming messages
    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as WSMessage;
        await this.handleMessage(client, message);
      } catch (error) {
        console.error('Failed to parse message:', error);
        this.sendError(client, 'Invalid message format');
      }
    });

    // Handle pong (heartbeat response)
    ws.on('pong', () => {
      client.isAlive = true;
      client.lastHeartbeat = new Date();
    });

    // Handle client disconnect
    ws.on('close', async (code, reason) => {
      await this.handleDisconnect(client, code, reason.toString());
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`Client ${client.id} error:`, error);
      // Force disconnect on error to prevent hanging connections
      this.forceDisconnectClient(client, 'WebSocket error');
    });
  }

  /**
   * Handle incoming messages from executor
   */
  private async handleMessage(client: WSClient, message: WSMessage): Promise<void> {
    console.log(`Message from ${client.executorId}:`, message.type);

    switch (message.type) {
      case 'HEARTBEAT':
        client.isAlive = true;
        client.lastHeartbeat = new Date();
        this.sendMessage(client, {
          type: 'HEARTBEAT_ACK',
          payload: { timestamp: new Date().toISOString() },
        });
        break;

      case 'REQUEST_COMMAND':
        await this.handleCommandRequest(client);
        break;

      case 'EXECUTION_RESULT':
        await this.handleExecutionResult(client, message.payload);
        break;

      case 'MARKET_UPDATE':
        await this.handleMarketUpdate(client, message.payload);
        break;

      case 'STATUS_UPDATE':
        await this.handleStatusUpdate(client, message.payload);
        break;

      case 'ERROR_REPORT':
        await this.handleErrorReport(client, message.payload);
        break;

      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle command request from executor
   */
  private async handleCommandRequest(client: WSClient): Promise<void> {
    try {
      const command = await this.commandQueue.pop(client.executorId);
      
      if (command) {
        this.sendMessage(client, {
          type: 'TRADE_SIGNAL',
          payload: command,
        });
        
        console.log(`Command sent to executor ${client.executorId}: ${command.id}`);
      } else {
        this.sendMessage(client, {
          type: 'NO_COMMANDS',
          payload: {},
        });
      }
    } catch (error) {
      console.error('Failed to handle command request:', error);
      this.sendError(client, 'Failed to retrieve command');
    }
  }

  /**
   * Handle execution result from executor
   */
  private async handleExecutionResult(client: WSClient, payload: any): Promise<void> {
    try {
      await this.commandQueue.acknowledge(payload.commandId, {
        commandId: payload.commandId,
        success: payload.success,
        executorId: client.executorId,
        result: payload.result,
        error: payload.error,
        timestamp: new Date(),
      });

      // Broadcast result to monitoring clients
      this.broadcastToMonitors({
        type: 'EXECUTION_UPDATE',
        payload: {
          executorId: client.executorId,
          ...payload,
        },
      });
    } catch (error) {
      console.error('Failed to handle execution result:', error);
    }
  }

  /**
   * Handle market update from executor
   */
  private async handleMarketUpdate(client: WSClient, payload: any): Promise<void> {
    // Store market data for analysis
    // This could trigger signal generation
    console.log('Market update received:', payload);
    
    // Broadcast to monitoring clients
    this.broadcastToMonitors({
      type: 'MARKET_DATA',
      payload: {
        executorId: client.executorId,
        ...payload,
      },
    });
  }

  /**
   * Handle status update from executor
   */
  private async handleStatusUpdate(client: WSClient, payload: any): Promise<void> {
    try {
      // Update executor status in database
      await prisma.executor.update({
        where: { id: client.executorId },
        data: {
          status: payload.status,
          lastHeartbeat: new Date(),
        },
      });

      console.log(`Executor ${client.executorId} status: ${payload.status}`);
    } catch (error) {
      console.error('Failed to update executor status:', error);
    }
  }

  /**
   * Handle error report from executor
   */
  private async handleErrorReport(client: WSClient, payload: any): Promise<void> {
    console.error(`Error from executor ${client.executorId}:`, payload);
    
    // Log error to database
    await prisma.auditLog.create({
      data: {
        userId: client.executorId,
        action: 'EXECUTOR_ERROR',
        eventType: 'EXECUTOR_ERROR',
        result: 'error',
        metadata: payload,
        timestamp: new Date(),
      },
    });
  }

  /**
   * Handle client disconnect
   */
  private async handleDisconnect(client: WSClient, code: number = 1000, reason: string = 'Normal closure'): Promise<void> {
    this.clients.delete(client.id);
    await this.logConnection(client, false);
    
    // Update executor status
    try {
      await prisma.executor.update({
        where: { id: client.executorId },
        data: {
          status: 'offline',
        },
      });
    } catch (error) {
      console.error(`Failed to update executor status for ${client.executorId}:`, error);
    }

    console.log(`Executor disconnected: ${client.executorId} (code: ${code}, reason: ${reason}). Remaining connections: ${this.clients.size}`);
  }

  /**
   * Force disconnect a client
   */
  private forceDisconnectClient(client: WSClient, reason: string): void {
    try {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close(1000, reason);
      } else {
        client.ws.terminate();
      }
      this.clients.delete(client.id);
      console.log(`Force disconnected client ${client.id}: ${reason}`);
    } catch (error) {
      console.error(`Error force disconnecting client ${client.id}:`, error);
      this.clients.delete(client.id);
    }
  }

  /**
   * Set connection timeout for client
   */
  private setConnectionTimeout(client: WSClient): void {
    setTimeout(() => {
      const currentClient = this.clients.get(client.id);
      if (currentClient && currentClient.ws.readyState !== WebSocket.OPEN) {
        console.log(`Connection timeout for client ${client.id}`);
        this.forceDisconnectClient(currentClient, 'Connection timeout');
      }
    }, this.connectionTimeout);
  }

  /**
   * Send message to client
   */
  private sendMessage(client: WSClient, message: any): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({
        ...message,
        timestamp: message.timestamp || new Date().toISOString(),
      }));
    }
  }

  /**
   * Send error message to client
   */
  private sendError(client: WSClient, error: string): void {
    this.sendMessage(client, {
      type: 'ERROR',
      payload: { message: error },
    });
  }

  /**
   * Broadcast message to all monitoring clients
   */
  private broadcastToMonitors(message: any): void {
    // In production, you might have separate monitoring connections
    // For now, broadcast to all connected clients
    this.clients.forEach((client) => {
      this.sendMessage(client, message);
    });
  }

  /**
   * Broadcast command to specific executor
   */
  public sendCommand(executorId: string, command: any): boolean {
    const client = Array.from(this.clients.values()).find(
      c => c.executorId === executorId
    );

    if (client) {
      this.sendMessage(client, {
        type: 'TRADE_SIGNAL',
        payload: command,
      });
      return true;
    }

    return false;
  }

  /**
   * Send emergency stop to all executors
   */
  public emergencyStopAll(reason: string): void {
    const message = {
      type: 'EMERGENCY_STOP',
      payload: { reason },
    };

    this.clients.forEach((client) => {
      this.sendMessage(client, message);
    });

    console.log(`Emergency stop sent to all executors: ${reason}`);
  }

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const clientsToRemove: string[] = [];

      this.clients.forEach((client) => {
        const inactiveTime = now.getTime() - client.lastHeartbeat.getTime();
        
        // Check if client is inactive for too long
        if (inactiveTime > this.maxInactiveTime) {
          console.log(`Client ${client.id} inactive for ${inactiveTime}ms. Terminating.`);
          clientsToRemove.push(client.id);
          return;
        }

        if (!client.isAlive) {
          // Client didn't respond to last ping
          console.log(`Terminating unresponsive client: ${client.id}`);
          clientsToRemove.push(client.id);
          return;
        }

        // Check if WebSocket is still open before sending ping
        if (client.ws.readyState === WebSocket.OPEN) {
          client.isAlive = false;
          try {
            client.ws.ping();
          } catch (error) {
            console.error(`Failed to ping client ${client.id}:`, error);
            clientsToRemove.push(client.id);
          }
        } else {
          // WebSocket is not open, mark for removal
          clientsToRemove.push(client.id);
        }
      });

      // Remove inactive/unresponsive clients
      clientsToRemove.forEach(clientId => {
        const client = this.clients.get(clientId);
        if (client) {
          this.forceDisconnectClient(client, 'Heartbeat failure');
        }
      });

      // Log connection pool status
      if (this.clients.size > 0) {
        console.log(`Heartbeat check completed. Active connections: ${this.clients.size}`);
      }
    }, 30000); // 30 seconds
  }

  /**
   * Start cleanup interval for memory management
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Clean up any dangling connections
      this.cleanupDanglingConnections();
      
      // Log memory usage for monitoring
      this.logMemoryUsage();
    }, 300000); // 5 minutes
  }

  /**
   * Clean up dangling connections
   */
  private cleanupDanglingConnections(): void {
    const clientsToRemove: string[] = [];
    
    this.clients.forEach((client, id) => {
      // Remove clients with closed or closing WebSocket connections
      if (client.ws.readyState === WebSocket.CLOSED ||
          client.ws.readyState === WebSocket.CLOSING) {
        clientsToRemove.push(id);
      }
    });

    clientsToRemove.forEach(id => {
      this.clients.delete(id);
      console.log(`Cleaned up dangling connection: ${id}`);
    });
  }

  /**
   * Log memory usage for monitoring
   */
  private logMemoryUsage(): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      console.log(`Memory Usage - RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB, ` +
                  `Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB, ` +
                  `Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB, ` +
                  `Active Connections: ${this.clients.size}`);
    }
  }

  /**
   * Extract API key from request
   */
  private extractApiKey(req: IncomingMessage): string | null {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      return auth.substring(7);
    }
    
    // Check query parameters as fallback
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    return url.searchParams.get('apiKey');
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: IncomingMessage): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || 'unknown';
  }

  /**
   * Validate API key
   */
  private async validateApiKey(apiKey: string): Promise<any> {
    try {
      // In production, validate against database
      // This is a simplified version
      const executor = await prisma.executor.findFirst({
        where: {
          apiKey: apiKey,
        },
      });

      return executor;
    } catch (error) {
      console.error('Failed to validate API key:', error);
      return null;
    }
  }

  /**
   * Log connection event
   */
  private async logConnection(client: WSClient, connected: boolean): Promise<void> {
    try {
      const action = connected ? 'EXECUTOR_CONNECTED' : 'EXECUTOR_DISCONNECTED';
      await prisma.auditLog.create({
        data: {
          userId: client.executorId,
          action,
          eventType: action,
          metadata: {
            clientId: client.id,
            ipAddress: client.ipAddress,
          },
          ipAddress: client.ipAddress,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to log connection:', error);
    }
  }

  /**
   * Get connected executors
   */
  public getConnectedExecutors(): any[] {
    return Array.from(this.clients.values()).map(client => ({
      executorId: client.executorId,
      connected: true,
      lastHeartbeat: client.lastHeartbeat,
      ipAddress: client.ipAddress,
    }));
  }

  /**
   * Shutdown server
   */
  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Close all client connections
    this.clients.forEach((client) => {
      try {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.close(1000, 'Server shutting down');
        } else {
          client.ws.terminate();
        }
      } catch (error) {
        console.error(`Error closing client ${client.id}:`, error);
      }
    });

    // Clear clients map
    this.clients.clear();

    // Close WebSocket server
    this.wss.close();
    
    console.log('WebSocket server shut down');
  }

  /**
   * Get server statistics
   */
  public getServerStats(): any {
    const now = new Date();
    const clientStats = Array.from(this.clients.values()).map(client => ({
      id: client.id,
      executorId: client.executorId,
      isAlive: client.isAlive,
      lastHeartbeat: client.lastHeartbeat,
      inactiveTime: now.getTime() - client.lastHeartbeat.getTime(),
      ipAddress: client.ipAddress,
    }));

    return {
      totalConnections: this.clients.size,
      maxConnections: this.maxConnections,
      activeConnections: clientStats.filter(c => c.isAlive).length,
      inactiveConnections: clientStats.filter(c => !c.isAlive).length,
      clients: clientStats,
      uptime: process.uptime ? process.uptime() : 0,
    };
  }
}

// Singleton instance
let wsServer: TradingWebSocketServer | null = null;

export function getWebSocketServer(port?: number): TradingWebSocketServer {
  if (!wsServer) {
    wsServer = new TradingWebSocketServer(port);
  }
  return wsServer;
}
