/**
 * WEBSOCKET SERVER
 * Real-time communication between Brain (Web) and Executor (Windows)
 * DO NOT DELETE - CRITICAL ARCHITECTURE COMPONENT
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { prisma } from '@/lib/prisma';
import { getCommandQueue } from '@/lib/commands/queue';
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
  private commandQueue = getCommandQueue();

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
  }

  /**
   * Setup WebSocket server event handlers
   */
  private setupWebSocketServer(): void {
    this.wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
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

      // Log connection
      await this.logConnection(client, true);

      // Send welcome message
      this.sendMessage(client, {
        type: 'CONNECTED',
        payload: {
          executorId: executor.id,
          clientId: client.id,
          timestamp: new Date().toISOString(),
        },
      });

      // Setup client event handlers
      this.setupClientHandlers(client);

      console.log(`Executor connected: ${executor.id} from ${ipAddress}`);
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
    ws.on('close', async () => {
      await this.handleDisconnect(client);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`Client ${client.id} error:`, error);
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
  private async handleDisconnect(client: WSClient): Promise<void> {
    this.clients.delete(client.id);
    await this.logConnection(client, false);
    
    // Update executor status
    await prisma.executor.update({
      where: { id: client.executorId },
      data: {
        status: 'offline',
      },
    });

    console.log(`Executor disconnected: ${client.executorId}`);
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
      this.clients.forEach((client) => {
        if (!client.isAlive) {
          // Client didn't respond to last ping
          console.log(`Terminating inactive client: ${client.id}`);
          client.ws.terminate();
          this.clients.delete(client.id);
          return;
        }

        client.isAlive = false;
        client.ws.ping();
      });
    }, 30000); // 30 seconds
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
      await prisma.auditLog.create({
        data: {
          userId: client.executorId,
          eventType: connected ? 'EXECUTOR_CONNECTED' : 'EXECUTOR_DISCONNECTED',
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

    // Close all client connections
    this.clients.forEach((client) => {
      client.ws.close(1000, 'Server shutting down');
    });

    // Close WebSocket server
    this.wss.close();
    
    console.log('WebSocket server shut down');
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
