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
export class ZeroMQServerService {
    constructor(logger) {
        Object.defineProperty(this, "socket", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "isRunning", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "config", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "logger", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "messageCount", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "lastMessageTime", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "accountInfo", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        }); // Store account info from MT5
        Object.defineProperty(this, "positions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        }); // Store positions from MT5
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
                    const request = JSON.parse(requestStr);
                    // Log only non-market-data requests at debug level
                    if (request.action !== 'market_data') {
                        this.log("debug", `📨 Received: ${request.action}`, { preview: requestStr.substring(0, 100) });
                    }
                    // Process request
                    const response = await this.processRequest(request);
                    // Send response
                    const responseStr = JSON.stringify(response);
                    await this.socket.send(responseStr);
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
                case "account_info": // Handle from EA (alias for update_account_info)
                case "update_account_info":
                    return this.handleUpdateAccountInfo(request.data);
                case "market_data": // Handle market data from EA
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
        this.log("info", `💰 Account Info: Balance=$${data.balance?.toFixed(2)}, Equity=$${data.equity?.toFixed(2)}, Profit=$${data.profit?.toFixed(2)}`);
        return {
            success: true,
            data: { message: "Account info updated" }
        };
    }
    /**
     * Handle market data from MT5
     */
    handleMarketData(data) {
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
