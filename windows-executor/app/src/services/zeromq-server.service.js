"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZeroMQServerService = void 0;
const zmq = __importStar(require("zeromq"));
class ZeroMQServerService {
    constructor(logger) {
        this.socket = null;
        this.isRunning = false;
        this.config = null;
        this.messageCount = 0;
        this.lastMessageTime = null;
        this.accountInfo = null; // Store account info from MT5
        this.positions = []; // Store positions from MT5
        this.logger = logger || this.defaultLogger;
    }
    defaultLogger(level, message, metadata) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level.toUpperCase()}] [ZMQServer] ${message}`, metadata || "");
    }
    log(level, message, metadata) {
        this.logger(level, message, metadata);
    }
    /**
     * Start ZeroMQ server and bind to port
     */
    async start(config) {
        try {
            this.config = config;
            // Use 127.0.0.1 instead of * for localhost binding (Windows compatibility)
            const bindAddress = `tcp://127.0.0.1:${config.zmqPort || 5555}`;
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
        }
        catch (error) {
            this.log("error", "Failed to start ZeroMQ server", {
                error: error.message,
            });
            return false;
        }
    }
    /**
     * Message processing loop
     */
    async startMessageLoop() {
        if (!this.socket) {
            this.log("error", "Cannot start message loop: socket not initialized");
            return;
        }
        this.log("info", "Message loop started - waiting for MT5 requests...");
        try {
            for await (const [msg] of this.socket) {
                if (!this.isRunning)
                    break;
                this.messageCount++;
                this.lastMessageTime = new Date();
                try {
                    // Parse request
                    const requestStr = msg.toString();
                    this.log("debug", "Received request from MT5", { request: requestStr });
                    const request = JSON.parse(requestStr);
                    // Process request
                    const response = await this.processRequest(request);
                    // Send response
                    const responseStr = JSON.stringify(response);
                    await this.socket.send(responseStr);
                    this.log("debug", "Sent response to MT5", { response });
                }
                catch (error) {
                    // Send error response
                    const errorResponse = {
                        success: false,
                        error: error.message
                    };
                    await this.socket.send(JSON.stringify(errorResponse));
                    this.log("error", "Error processing MT5 request", {
                        error: error.message,
                    });
                }
            }
        }
        catch (error) {
            this.log("error", "Message loop error", {
                error: error.message,
            });
        }
        this.log("info", "Message loop ended");
    }
    /**
     * Process incoming request from MT5
     */
    async processRequest(request) {
        this.log("info", `Processing MT5 request: ${request.action}`);
        try {
            switch (request.action) {
                case "ping":
                    return this.handlePing();
                case "heartbeat":
                    return this.handleHeartbeat(request.data);
                case "get_account_info":
                    return this.handleGetAccountInfo();
                case "update_account_info":
                    return this.handleUpdateAccountInfo(request.data);
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
        }
        catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Handle ping request
     */
    handlePing() {
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
    handleHeartbeat(data) {
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
    handleGetAccountInfo() {
        if (this.accountInfo) {
            return {
                success: true,
                data: this.accountInfo
            };
        }
        else {
            return {
                success: false,
                error: "No account info available yet"
            };
        }
    }
    /**
     * Handle account info update from MT5
     */
    handleUpdateAccountInfo(data) {
        this.accountInfo = data;
        this.log("info", "Account info updated from MT5", {
            balance: data.balance,
            equity: data.equity
        });
        return {
            success: true,
            data: { message: "Account info updated" }
        };
    }
    /**
     * Handle get positions request
     */
    handleGetPositions() {
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
    async handleOpenTrade(data) {
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
    async handleCloseTrade(data) {
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
    async handleModifyTrade(data) {
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
    async stop() {
        this.log("info", "Stopping ZeroMQ Server...");
        this.isRunning = false;
        if (this.socket) {
            try {
                await this.socket.close();
                this.socket = null;
                this.log("info", "✅ ZeroMQ Server stopped");
            }
            catch (error) {
                this.log("error", "Error stopping ZeroMQ server", {
                    error: error.message,
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
exports.ZeroMQServerService = ZeroMQServerService;
