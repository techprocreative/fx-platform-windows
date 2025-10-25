/**
 * ZeroMQ Server Service
 * Windows Executor acts as ZMQ SERVER (Reply socket)
 * MT5 EA acts as ZMQ CLIENT (Request socket)
 * 
 * Architecture:
 * - Server binds to tcp://*:5555
 * - Listens for requests from MT5 EA
 * - Processes requests and sends responses
 */

import * as zmq from "zeromq";
import { AppConfig } from "../types/command.types";

export interface ZMQRequest {
  action: string;
  data?: any;
}

export interface ZMQResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class ZeroMQServerService {
  private socket: zmq.Reply | null = null;
  private isRunning = false;
  private config: AppConfig | null = null;
  private logger: (level: string, message: string, metadata?: any) => void;
  private messageCount = 0;
  private lastMessageTime: Date | null = null;
  private accountInfo: any = null;  // Store account info from MT5
  private positions: any[] = [];     // Store positions from MT5

  constructor(
    logger?: (level: string, message: string, metadata?: any) => void,
  ) {
    this.logger = logger || this.defaultLogger;
  }

  private defaultLogger(level: string, message: string, metadata?: any): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] [ZMQServer] ${message}`, metadata || "");
  }

  private log(level: string, message: string, metadata?: any): void {
    this.logger(level, message, metadata);
  }

  /**
   * Start ZeroMQ server and bind to port
   */
  async start(config: AppConfig): Promise<boolean> {
    try {
      this.config = config;
      // Bind to all interfaces (0.0.0.0) to accept both localhost and 127.0.0.1
      const bindAddress = `tcp://0.0.0.0:${config.zmqPort || 5555}`;
      
      this.log("info", "Starting ZeroMQ Server...", { bindAddress });

      // Create Reply socket (server)
      this.socket = new zmq.Reply();
      
      // Bind to address
      await this.socket.bind(bindAddress);
      
      this.isRunning = true;
      this.log("info", `✅ ZeroMQ Server listening on ${bindAddress}`);

      // Start message loop
      this.startMessageLoop();

      return true;
    } catch (error) {
      this.log("error", "Failed to start ZeroMQ server", {
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Message processing loop
   */
  private async startMessageLoop(): Promise<void> {
    if (!this.socket) {
      this.log("error", "Cannot start message loop: socket not initialized");
      return;
    }

    this.log("info", "Message loop started - waiting for MT5 requests...");

    try {
      for await (const [msg] of this.socket) {
        if (!this.isRunning) break;

        this.messageCount++;
        this.lastMessageTime = new Date();

        try {
          // Parse request
          const requestStr = msg.toString();
          const request: ZMQRequest = JSON.parse(requestStr);
          
          // Log only non-market-data requests at debug level
          if (request.action !== 'market_data') {
            this.log("debug", `📨 Received: ${request.action}`, { preview: requestStr.substring(0, 100) });
          }
          
          // Process request
          const response = await this.processRequest(request);
          
          // Send response
          const responseStr = JSON.stringify(response);
          await this.socket.send(responseStr);
        } catch (error) {
          // Send error response
          const errorResponse: ZMQResponse = {
            success: false,
            error: (error as Error).message
          };
          await this.socket.send(JSON.stringify(errorResponse));
          
          this.log("error", "Error processing MT5 request", {
            error: (error as Error).message,
          });
        }
      }
    } catch (error) {
      this.log("error", "Message loop error", {
        error: (error as Error).message,
      });
    }

    this.log("info", "Message loop ended");
  }

  /**
   * Process incoming request from MT5
   */
  private async processRequest(request: ZMQRequest): Promise<ZMQResponse> {
    this.log("info", `Processing MT5 request: ${request.action}`);

    try {
      switch (request.action) {
        case "ping":
          return this.handlePing();
        
        case "heartbeat":
          return this.handleHeartbeat(request.data);
        
        case "get_account_info":
          return this.handleGetAccountInfo();
        
        case "account_info":  // Handle from EA (alias for update_account_info)
        case "update_account_info":
          return this.handleUpdateAccountInfo(request.data);
        
        case "market_data":  // Handle market data from EA
          return this.handleMarketData(request.data);
        
        case "get_positions":
          return this.handleGetPositions();
        
        case "open_trade":
          return await this.handleOpenTrade(request.data);
        
        case "close_trade":
          return await this.handleCloseTrade(request.data);
        
        case "modify_trade":
          return await this.handleModifyTrade(request.data);
        
        default:
          return {
            success: false,
            error: `Unknown action: ${request.action}`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Handle ping request
   */
  private handlePing(): ZMQResponse {
    return {
      success: true,
      data: {
        message: "pong",
        timestamp: Date.now()
      }
    };
  }

  /**
   * Handle heartbeat from MT5
   */
  private handleHeartbeat(data: any): ZMQResponse {
    this.log("debug", "Heartbeat received from MT5", { data });
    return {
      success: true,
      data: {
        message: "heartbeat_ack",
        timestamp: Date.now()
      }
    };
  }

  /**
   * Handle get account info request
   */
  private handleGetAccountInfo(): ZMQResponse {
    if (this.accountInfo) {
      return {
        success: true,
        data: this.accountInfo
      };
    } else {
      return {
        success: false,
        error: "No account info available yet"
      };
    }
  }
  
  /**
   * Handle account info update from MT5
   */
  private handleUpdateAccountInfo(data: any): ZMQResponse {
    this.accountInfo = data;
    this.log("info", `💰 Account Info: Balance=$${data.balance?.toFixed(2)}, Equity=$${data.equity?.toFixed(2)}, Profit=$${data.profit?.toFixed(2)}`);
    return {
      success: true,
      data: { message: "Account info updated" }
    };
  }
  
  /**
   * Handle market data from MT5
   */
  private handleMarketData(data: any): ZMQResponse {
    // Log at debug level to avoid spam (comes every second)
    this.log("debug", `📊 Market: ${data.symbol} Bid=${data.bid} Ask=${data.ask} Spread=${data.spread || 'N/A'}`);
    
    // Store or broadcast market data as needed
    // Could emit event for other services to consume
    
    return {
      success: true,
      data: { message: "Market data received" }
    };
  }

  /**
   * Handle get positions request
   */
  private handleGetPositions(): ZMQResponse {
    return {
      success: true,
      data: {
        positions: []
      }
    };
  }

  /**
   * Handle open trade request
   */
  private async handleOpenTrade(data: any): Promise<ZMQResponse> {
    this.log("info", "Open trade request received", { data });
    
    // TODO: Validate and process trade
    return {
      success: true,
      data: {
        ticket: Math.floor(Math.random() * 1000000),
        message: "Trade order queued"
      }
    };
  }

  /**
   * Handle close trade request
   */
  private async handleCloseTrade(data: any): Promise<ZMQResponse> {
    this.log("info", "Close trade request received", { data });
    
    return {
      success: true,
      data: {
        message: "Trade close queued"
      }
    };
  }

  /**
   * Handle modify trade request
   */
  private async handleModifyTrade(data: any): Promise<ZMQResponse> {
    this.log("info", "Modify trade request received", { data });
    
    return {
      success: true,
      data: {
        message: "Trade modify queued"
      }
    };
  }

  /**
   * Stop ZeroMQ server
   */
  async stop(): Promise<void> {
    this.log("info", "Stopping ZeroMQ Server...");
    
    this.isRunning = false;

    if (this.socket) {
      try {
        await this.socket.close();
        this.socket = null;
        this.log("info", "✅ ZeroMQ Server stopped");
      } catch (error) {
        this.log("error", "Error stopping ZeroMQ server", {
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      messageCount: this.messageCount,
      lastMessageTime: this.lastMessageTime,
      bindAddress: this.config ? `tcp://127.0.0.1:${this.config.zmqPort || 5555}` : null
    };
  }
  
  /**
   * Get current account info from MT5
   */
  getAccountInfo() {
    return this.accountInfo;
  }
  
  /**
   * Get current positions from MT5
   */
  getPositions() {
    return this.positions;
  }
}
