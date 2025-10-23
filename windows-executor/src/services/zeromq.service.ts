import * as zmq from "zeromq";
import {
  TradeParams,
  TradeResult,
  ZeroMQRequest,
  ZeroMQResponse,
  AppConfig,
  ConnectionStatus,
} from "../types/command.types";

export class ZeroMQService {
  private socket: zmq.Request | null = null;
  private connectionStatus: ConnectionStatus["zeromq"] = "disconnected";
  private config: AppConfig | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: any = null;
  private requestTimeouts: Map<string, any> = new Map();
  private pendingRequests: Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason: any) => void;
      startTime: number;
    }
  > = new Map();
  private logger: (level: string, message: string, metadata?: any) => void;
  private connectionPool: zmq.Request[] = [];
  private maxPoolSize = 3;
  private currentPoolIndex = 0;

  constructor(
    logger?: (level: string, message: string, metadata?: any) => void,
  ) {
    this.logger = logger || this.defaultLogger;
  }

  private log(level: string, message: string, metadata?: any): void {
    this.logger(level, message, metadata);
  }

  /**
   * Connect to MT5 via ZeroMQ with connection pooling
   */
  async connect(config: AppConfig): Promise<boolean> {
    try {
      this.config = config;
      this.connectionStatus = "connecting";
      this.log("info", "Connecting to ZeroMQ...", {
        host: config.zmqHost,
        port: config.zmqPort,
      });

      // Clear any existing reconnect timeout
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      // Create connection pool
      const poolPromises = [];
      for (let i = 0; i < this.maxPoolSize; i++) {
        poolPromises.push(this.createPoolConnection());
      }

      const poolResults = await Promise.allSettled(poolPromises);
      const successfulConnections = poolResults.filter(
        (result) => result.status === "fulfilled",
      ).length;

      if (successfulConnections > 0) {
        // Set up main socket for backwards compatibility
        this.socket = this.connectionPool[0];

        // Test connection
        const isConnected = await this.ping();
        this.connectionStatus = isConnected ? "connected" : "error";

        if (isConnected) {
          this.log(
            "info",
            `ZeroMQ connected successfully with ${successfulConnections} connections in pool`,
          );
          return true;
        } else {
          this.log("error", "ZeroMQ connection test failed");
          return false;
        }
      } else {
        this.log("error", "Failed to create any ZeroMQ connections");
        this.connectionStatus = "error";
        return false;
      }
    } catch (error) {
      this.log("error", "Failed to connect to ZeroMQ", {
        error: (error as Error).message,
      });
      this.connectionStatus = "error";
      this.scheduleReconnect();
      return false;
    }
  }

  /**
   * Create a single connection for the pool
   */
  private async createPoolConnection(): Promise<zmq.Request> {
    const socket = new zmq.Request();

    await socket.connect(`${this.config!.zmqHost}:${this.config!.zmqPort}`);

    // Set up event handlers for the socket
    socket.events.on("connect", () => {
      this.log("debug", "ZeroMQ socket connected");
    });

    socket.events.on("disconnect", () => {
      this.log("warn", "ZeroMQ socket disconnected");
    });

    socket.events.on("bind:error", (event: any) => {
      this.log("error", "ZeroMQ socket bind error", {
        error: event.error,
        address: event.address,
      });
    });

    socket.events.on("connect:retry", (event: any) => {
      this.log("warn", "ZeroMQ socket connect retry", {
        interval: event.interval,
        address: event.address,
      });
    });

    socket.events.on("close:error", (event: any) => {
      this.log("error", "ZeroMQ socket close error", {
        error: event.error,
        address: event.address,
      });
    });

    socket.events.on("accept:error", (event: any) => {
      this.log("error", "ZeroMQ socket accept error", {
        error: event.error,
        address: event.address,
      });
    });

    return socket;
  }

  /**
   * Get next available socket from pool (round-robin)
   */
  private getSocketFromPool(): zmq.Request | null {
    if (this.connectionPool.length === 0) {
      return this.socket;
    }

    const socket = this.connectionPool[this.currentPoolIndex];
    this.currentPoolIndex =
      (this.currentPoolIndex + 1) % this.connectionPool.length;
    return socket;
  }

  /**
   * Test connection to MT5
   */
  async ping(): Promise<boolean> {
    try {
      const response = await this.sendRequest(
        {
          command: "PING",
          requestId: this.generateRequestId(),
          timestamp: new Date().toISOString(),
        },
        3000,
      );
      return response.status === "OK";
    } catch (error) {
      return false;
    }
  }

  /**
   * Open a trading position
   */
  async openPosition(params: TradeParams): Promise<TradeResult> {
    const request: ZeroMQRequest = {
      command: "OPEN_POSITION",
      requestId: this.generateRequestId(),
      timestamp: new Date().toISOString(),
      parameters: params,
    };

    const response = await this.sendRequest(request);

    if (response.status === "OK") {
      return {
        success: true,
        ticket: response.data.ticket,
        symbol: params.symbol,
        type: params.type,
        volume: params.volume,
        openPrice: response.data.openPrice,
        stopLoss: response.data.stopLoss,
        takeProfit: response.data.takeProfit,
        swap: response.data.swap,
        profit: response.data.profit,
        commission: response.data.commission,
        timestamp: response.timestamp,
        executionTime: response.executionTime,
      };
    } else {
      return {
        success: false,
        error: response.error || "Unknown error",
        timestamp: response.timestamp,
        executionTime: response.executionTime,
      } as TradeResult;
    }
  }

  /**
   * Close a trading position
   */
  async closePosition(ticket: number): Promise<TradeResult> {
    const request: ZeroMQRequest = {
      command: "CLOSE_POSITION",
      requestId: this.generateRequestId(),
      timestamp: new Date().toISOString(),
      parameters: { ticket },
    };

    const response = await this.sendRequest(request);

    if (response.status === "OK") {
      return {
        success: true,
        ticket: response.data.ticket,
        symbol: response.data.symbol,
        type: response.data.type,
        volume: response.data.volume,
        openPrice: response.data.openPrice,
        closePrice: response.data.closePrice,
        profit: response.data.profit,
        commission: response.data.commission,
        swap: response.data.swap,
        timestamp: response.timestamp,
        executionTime: response.executionTime,
      };
    } else {
      return {
        success: false,
        error: response.error || "Unknown error",
        timestamp: response.timestamp,
        executionTime: response.executionTime,
      } as TradeResult;
    }
  }

  /**
   * Close all positions
   */
  async closeAllPositions(): Promise<TradeResult[]> {
    const request: ZeroMQRequest = {
      command: "CLOSE_ALL_POSITIONS",
      requestId: this.generateRequestId(),
      timestamp: new Date().toISOString(),
    };

    const response = await this.sendRequest(request);

    if (response.status === "OK" && response.data.results) {
      return response.data.results.map((result: any) => ({
        success: result.success,
        ticket: result.ticket,
        symbol: result.symbol,
        type: result.type,
        volume: result.volume,
        profit: result.profit,
        timestamp: result.timestamp,
      }));
    } else {
      return [
        {
          success: false,
          ticket: 0,
          symbol: "",
          type: "BUY",
          volume: 0,
          openPrice: 0,
          error: response.error || "Unknown error",
          timestamp: response.timestamp,
        },
      ];
    }
  }

  /**
   * Modify an existing position
   */
  async modifyPosition(
    ticket: number,
    params: Partial<TradeParams>,
  ): Promise<TradeResult> {
    const request: ZeroMQRequest = {
      command: "MODIFY_POSITION",
      requestId: this.generateRequestId(),
      timestamp: new Date().toISOString(),
      parameters: { ticket, ...params },
    };

    const response = await this.sendRequest(request);

    if (response.status === "OK") {
      return {
        success: true,
        ticket: response.data.ticket,
        symbol: response.data.symbol,
        type: response.data.type,
        volume: response.data.volume,
        openPrice: response.data.openPrice,
        stopLoss: response.data.stopLoss,
        takeProfit: response.data.takeProfit,
        timestamp: response.timestamp,
        executionTime: response.executionTime,
      };
    } else {
      return {
        success: false,
        error: response.error || "Unknown error",
        timestamp: response.timestamp,
        executionTime: response.executionTime,
      } as TradeResult;
    }
  }

  /**
   * Get all open positions
   */
  async getPositions(): Promise<any[]> {
    const request: ZeroMQRequest = {
      command: "GET_POSITIONS",
      requestId: this.generateRequestId(),
      timestamp: new Date().toISOString(),
    };

    const response = await this.sendRequest(request);

    if (response.status === "OK" && response.data.positions) {
      return response.data.positions;
    } else {
      return [];
    }
  }

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<any> {
    const request: ZeroMQRequest = {
      command: "GET_ACCOUNT_INFO",
      requestId: this.generateRequestId(),
      timestamp: new Date().toISOString(),
    };

    const response = await this.sendRequest(request);

    if (response.status === "OK") {
      return response.data;
    } else {
      throw new Error(response.error || "Failed to get account info");
    }
  }

  /**
   * Get symbol information
   */
  async getSymbolInfo(symbol: string): Promise<any> {
    const request: ZeroMQRequest = {
      command: "GET_SYMBOL_INFO",
      requestId: this.generateRequestId(),
      timestamp: new Date().toISOString(),
      parameters: { symbol },
    };

    const response = await this.sendRequest(request);

    if (response.status === "OK") {
      return response.data;
    } else {
      throw new Error(response.error || "Failed to get symbol info");
    }
  }

  /**
   * Send request to ZeroMQ with timeout and retry logic
   */
  private async sendRequest(
    request: ZeroMQRequest,
    timeout: number = 5000,
  ): Promise<ZeroMQResponse> {
    if (!this.isConnected()) {
      throw new Error("ZeroMQ not connected");
    }

    const requestId = request.requestId || this.generateRequestId();
    request.requestId = requestId;

    return new Promise((resolve, reject) => {
      // Store the promise handlers
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        startTime: Date.now(),
      });

      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error("Request timeout"));
      }, timeout);

      this.requestTimeouts.set(requestId, timeoutId);

      // Send request using pool socket
      this.sendWithPool(request).catch((error) => {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(requestId);
        this.requestTimeouts.delete(requestId);
        reject(error);
      });
    });
  }

  /**
   * Send request using connection pool
   */
  private async sendWithPool(request: ZeroMQRequest): Promise<void> {
    const socket = this.getSocketFromPool();
    if (!socket) {
      throw new Error("No available socket in pool");
    }

    try {
      // Send request
      await socket.send(JSON.stringify(request));

      // Wait for response
      const [msg] = await socket.receive();
      const response = JSON.parse(msg.toString());

      // Clear timeout and resolve promise
      const timeoutId = this.requestTimeouts.get(request.requestId!);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.requestTimeouts.delete(request.requestId!);
      }

      const pendingRequest = this.pendingRequests.get(request.requestId!);
      if (pendingRequest) {
        this.pendingRequests.delete(request.requestId!);

        // Calculate execution time
        response.executionTime = Date.now() - pendingRequest.startTime;

        pendingRequest.resolve(response);
      }
    } catch (error) {
      // Clean up on error
      const timeoutId = this.requestTimeouts.get(request.requestId!);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.requestTimeouts.delete(request.requestId!);
      }

      const pendingRequest = this.pendingRequests.get(request.requestId!);
      if (pendingRequest) {
        this.pendingRequests.delete(request.requestId!);
        pendingRequest.reject(error);
      }
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log("error", "Max reconnection attempts reached");
      return;
    }

    // Calculate exponential backoff delay
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(
      baseDelay * Math.pow(2, this.reconnectAttempts),
      maxDelay,
    );

    this.reconnectAttempts++;
    this.log(
      "info",
      `Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`,
    );

    this.reconnectTimeout = setTimeout(async () => {
      if (this.config) {
        await this.connect(this.config);
      }
    }, delay);
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): ConnectionStatus["zeromq"] {
    return this.connectionStatus;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionStatus === "connected" && this.socket !== null;
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    return {
      status: this.connectionStatus,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      poolSize: this.connectionPool.length,
      maxPoolSize: this.maxPoolSize,
      pendingRequests: this.pendingRequests.size,
      connectedAt:
        this.connectionStatus === "connected" ? new Date().toISOString() : null,
    };
  }

  /**
   * Disconnect from ZeroMQ
   */
  disconnect(): void {
    this.log("info", "Disconnecting from ZeroMQ...");

    // Clear timeouts
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Clear pending requests
    this.requestTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.requestTimeouts.clear();

    this.pendingRequests.forEach((request) => {
      request.reject(new Error("Connection closed"));
    });
    this.pendingRequests.clear();

    // Close all sockets in pool
    this.connectionPool.forEach((socket) => {
      try {
        socket.close();
      } catch (error) {
        this.log("error", "Error closing socket", { error });
      }
    });
    this.connectionPool = [];

    this.socket = null;
    this.connectionStatus = "disconnected";
    this.reconnectAttempts = 0;

    this.log("info", "ZeroMQ disconnected");
  }

  /**
   * Force reconnection
   */
  async forceReconnect(): Promise<boolean> {
    this.log("info", "Force reconnection requested");
    this.disconnect();

    if (this.config) {
      return await this.connect(this.config);
    }

    return false;
  }

  /**
   * Default logger implementation
   */
  private defaultLogger(level: string, message: string, metadata?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      service: "ZeroMQService",
      message,
      metadata,
    };

    (console as any)[level]
      ? (console as any)[level](
          `[${timestamp}] [${level}] [ZeroMQService] ${message}`,
          metadata,
        )
      : console.log(logEntry);
  }

  /**
   * Set custom logger
   */
  setLogger(
    logger: (level: string, message: string, metadata?: any) => void,
  ): void {
    this.logger = logger;
  }

  /**
   * Health check for all connections in pool
   */
  async healthCheck(): Promise<boolean> {
    if (this.connectionPool.length === 0) {
      return false;
    }

    const healthPromises = this.connectionPool.map(async (socket, index) => {
      try {
        const testRequest: ZeroMQRequest = {
          command: "PING",
          requestId: this.generateRequestId(),
          timestamp: new Date().toISOString(),
        };

        await socket.send(JSON.stringify(testRequest));
        const [msg] = await socket.receive();
        const response = JSON.parse(msg.toString());

        return response.status === "OK";
      } catch (error) {
        this.log("warn", `Health check failed for socket ${index}`, { error });
        return false;
      }
    });

    const results = await Promise.all(healthPromises);
    const healthyCount = results.filter((result) => result).length;

    this.log(
      "info",
      `Health check completed: ${healthyCount}/${this.connectionPool.length} sockets healthy`,
    );

    return healthyCount > 0;
  }
}
