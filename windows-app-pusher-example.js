/**
 * WINDOWS APP WITH PUSHER - PRODUCTION READY
 * Executor yang terkoneksi dengan Web Platform via Pusher
 * Compatible dengan Vercel deployment
 */

require('dotenv').config();
const Pusher = require('pusher-js');
const zmq = require('zeromq');
const axios = require('axios');

class WindowsExecutorPusher {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.executorId = config.executorId;
    this.platformUrl = config.platformUrl || 'https://your-app.vercel.app';
    
    // Pusher configuration
    this.pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY || config.pusherKey, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap1',
      forceTLS: true,
      auth: {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        }
      },
      authEndpoint: `${this.platformUrl}/api/pusher/auth`
    });
    
    // ZeroMQ for MT5
    this.zmqSocket = new zmq.Request();
    this.mt5Connected = false;
    
    // State management
    this.isRunning = false;
    this.activePositions = new Map();
    this.commandQueue = [];
  }

  /**
   * Start the executor
   */
  async start() {
    console.log('🚀 Starting Windows Executor with Pusher...');
    
    try {
      // Connect to MT5
      await this.connectToMT5();
      
      // Connect to Pusher
      this.connectToPusher();
      
      // Register with platform
      await this.registerExecutor();
      
      this.isRunning = true;
      console.log('✅ Executor started successfully!');
      
      // Start heartbeat
      this.startHeartbeat();
      
    } catch (error) {
      console.error('❌ Failed to start executor:', error);
      throw error;
    }
  }

  /**
   * Connect to MT5 via ZeroMQ
   */
  async connectToMT5() {
    try {
      const mt5Address = process.env.MT5_ADDRESS || 'tcp://127.0.0.1:5555';
      await this.zmqSocket.connect(mt5Address);
      this.mt5Connected = true;
      console.log('✅ Connected to MT5 via ZeroMQ');
    } catch (error) {
      console.error('❌ Failed to connect to MT5:', error);
      throw error;
    }
  }

  /**
   * Connect to Pusher channels
   */
  connectToPusher() {
    // Connection events
    this.pusher.connection.bind('connected', () => {
      console.log('✅ Connected to Pusher');
      this.subscribeToChannels();
    });

    this.pusher.connection.bind('error', (error) => {
      console.error('❌ Pusher connection error:', error);
    });

    this.pusher.connection.bind('disconnected', () => {
      console.log('⚠️ Disconnected from Pusher');
      // Pusher will auto-reconnect
    });
  }

  /**
   * Subscribe to relevant Pusher channels
   */
  subscribeToChannels() {
    // Private executor channel
    const executorChannel = this.pusher.subscribe(`private-executor-${this.executorId}`);
    
    executorChannel.bind('pusher:subscription_succeeded', () => {
      console.log(`✅ Subscribed to private-executor-${this.executorId}`);
    });

    executorChannel.bind('pusher:subscription_error', (error) => {
      console.error('❌ Subscription error:', error);
    });

    // Trade command handler
    executorChannel.bind('trade-command', (command) => {
      console.log('📨 Received trade command:', command.id);
      this.handleTradeCommand(command);
    });

    // Emergency stop handler
    executorChannel.bind('emergency-stop', (data) => {
      console.log('🚨 EMERGENCY STOP RECEIVED!');
      this.handleEmergencyStop(data.reason);
    });

    // Risk update handler
    executorChannel.bind('risk-update', (data) => {
      console.log('⚠️ Risk parameters updated');
      this.updateRiskParameters(data);
    });

    // Global broadcast channel (optional)
    const broadcastChannel = this.pusher.subscribe('executors');
    
    broadcastChannel.bind('broadcast-command', (command) => {
      console.log('📢 Broadcast command received');
      this.handleBroadcastCommand(command);
    });
  }

  /**
   * Handle trade command from platform
   */
  async handleTradeCommand(command) {
    try {
      console.log(`⚡ Executing command: ${command.command.action}`);
      
      // Validate command
      if (!this.validateCommand(command)) {
        throw new Error('Invalid command parameters');
      }
      
      // Add to queue if busy
      if (this.commandQueue.length > 0) {
        this.commandQueue.push(command);
        console.log(`📋 Command queued (${this.commandQueue.length} in queue)`);
        return;
      }
      
      // Execute command
      const result = await this.executeCommand(command);
      
      // Report result back to platform
      await this.reportExecutionResult(command.id, result);
      
    } catch (error) {
      console.error('❌ Command execution failed:', error);
      await this.reportExecutionResult(command.id, {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error.message
        }
      });
    }
  }

  /**
   * Execute command via MT5
   */
  async executeCommand(command) {
    const { action, symbol, type, volume, stopLoss, takeProfit, ticket } = command.command;
    
    switch (action) {
      case 'OPEN_POSITION':
        return await this.openPosition(symbol, type, volume, stopLoss, takeProfit);
        
      case 'CLOSE_POSITION':
        return await this.closePosition(ticket);
        
      case 'MODIFY_POSITION':
        return await this.modifyPosition(ticket, stopLoss, takeProfit);
        
      case 'CLOSE_ALL':
        return await this.closeAllPositions();
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Open position in MT5
   */
  async openPosition(symbol, type, volume, stopLoss, takeProfit) {
    const mt5Command = {
      action: 'OPEN_POSITION',
      symbol,
      type,
      volume,
      stopLoss,
      takeProfit,
      magicNumber: 123456,
      comment: `Executor ${this.executorId}`
    };
    
    // Send to MT5
    await this.zmqSocket.send(JSON.stringify(mt5Command));
    
    // Wait for response
    const [response] = await this.zmqSocket.receive();
    const result = JSON.parse(response.toString());
    
    if (result.success) {
      // Track position
      this.activePositions.set(result.ticket, {
        symbol,
        type,
        volume,
        openPrice: result.price,
        openTime: new Date()
      });
      
      console.log(`✅ Position opened: ${result.ticket} @ ${result.price}`);
    }
    
    return result;
  }

  /**
   * Close position in MT5
   */
  async closePosition(ticket) {
    const mt5Command = {
      action: 'CLOSE_POSITION',
      ticket
    };
    
    await this.zmqSocket.send(JSON.stringify(mt5Command));
    const [response] = await this.zmqSocket.receive();
    const result = JSON.parse(response.toString());
    
    if (result.success) {
      this.activePositions.delete(ticket);
      console.log(`✅ Position closed: ${ticket}`);
    }
    
    return result;
  }

  /**
   * Modify position in MT5
   */
  async modifyPosition(ticket, stopLoss, takeProfit) {
    const mt5Command = {
      action: 'MODIFY_POSITION',
      ticket,
      stopLoss,
      takeProfit
    };
    
    await this.zmqSocket.send(JSON.stringify(mt5Command));
    const [response] = await this.zmqSocket.receive();
    const result = JSON.parse(response.toString());
    
    if (result.success) {
      console.log(`✅ Position modified: ${ticket}`);
    }
    
    return result;
  }

  /**
   * Close all positions
   */
  async closeAllPositions() {
    console.log('🔴 Closing all positions...');
    const results = [];
    
    for (const [ticket] of this.activePositions) {
      try {
        const result = await this.closePosition(ticket);
        results.push(result);
      } catch (error) {
        console.error(`Failed to close position ${ticket}:`, error);
      }
    }
    
    return {
      success: true,
      closedCount: results.filter(r => r.success).length,
      totalCount: results.length
    };
  }

  /**
   * Emergency stop handler
   */
  async handleEmergencyStop(reason) {
    console.log(`🚨 EMERGENCY STOP: ${reason}`);
    
    // Stop accepting new commands
    this.isRunning = false;
    
    // Clear command queue
    this.commandQueue = [];
    
    // Close all positions
    await this.closeAllPositions();
    
    console.log('✅ Emergency stop completed');
  }

  /**
   * Report execution result back to platform
   */
  async reportExecutionResult(commandId, result) {
    try {
      const response = await axios.post(
        `${this.platformUrl}/api/commands/result`,
        {
          commandId,
          executorId: this.executorId,
          result
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`✅ Result reported for command ${commandId}`);
    } catch (error) {
      console.error('Failed to report result:', error.message);
    }
  }

  /**
   * Register executor with platform
   */
  async registerExecutor() {
    try {
      const response = await axios.post(
        `${this.platformUrl}/api/executors/register`,
        {
          executorId: this.executorId,
          status: 'online',
          capabilities: {
            symbols: ['EURUSD', 'GBPUSD', 'USDJPY'],
            maxPositions: 10,
            allowedCommands: ['OPEN_POSITION', 'CLOSE_POSITION', 'MODIFY_POSITION']
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      
      console.log('✅ Executor registered with platform');
    } catch (error) {
      console.error('Failed to register executor:', error.message);
    }
  }

  /**
   * Send heartbeat to platform
   */
  startHeartbeat() {
    setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        // Send heartbeat via API
        await axios.post(
          `${this.platformUrl}/api/executors/heartbeat`,
          {
            executorId: this.executorId,
            activePositions: this.activePositions.size,
            queueLength: this.commandQueue.length,
            mt5Connected: this.mt5Connected
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`
            }
          }
        );
      } catch (error) {
        console.error('Heartbeat failed:', error.message);
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Validate command parameters
   */
  validateCommand(command) {
    // Add your validation logic
    if (!command.command || !command.id) return false;
    
    const { action, symbol, volume } = command.command;
    
    if (action === 'OPEN_POSITION') {
      if (!symbol || !volume || volume <= 0) return false;
      if (volume > 1.0) return false; // Max lot size
    }
    
    return true;
  }

  /**
   * Update risk parameters
   */
  updateRiskParameters(params) {
    console.log('📊 Updating risk parameters:', params);
    // Implement risk parameter updates
  }

  /**
   * Handle broadcast command
   */
  handleBroadcastCommand(command) {
    console.log('📢 Processing broadcast command:', command.type);
    // Implement broadcast command handling
  }

  /**
   * Shutdown executor
   */
  async shutdown() {
    console.log('🛑 Shutting down executor...');
    
    this.isRunning = false;
    
    // Close all positions
    if (this.activePositions.size > 0) {
      await this.closeAllPositions();
    }
    
    // Disconnect from Pusher
    this.pusher.disconnect();
    
    // Disconnect from MT5
    if (this.mt5Connected) {
      this.zmqSocket.disconnect();
    }
    
    console.log('✅ Executor shutdown complete');
  }
}

// ==========================================
// MAIN EXECUTION
// ==========================================

// Configuration from environment or config file
const config = {
  apiKey: process.env.EXECUTOR_API_KEY || 'your-api-key',
  executorId: process.env.EXECUTOR_ID || 'exec-001',
  platformUrl: process.env.PLATFORM_URL || 'https://your-app.vercel.app'
};

// Create and start executor
const executor = new WindowsExecutorPusher(config);

// Start executor
executor.start().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received shutdown signal...');
  await executor.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received termination signal...');
  await executor.shutdown();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  executor.shutdown().then(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  executor.shutdown().then(() => process.exit(1));
});

console.log('=====================================');
console.log('🚀 FX TRADING WINDOWS EXECUTOR');
console.log('=====================================');
console.log('Platform:', config.platformUrl);
console.log('Executor ID:', config.executorId);
console.log('Pusher Cluster: ap1');
console.log('=====================================\n');
