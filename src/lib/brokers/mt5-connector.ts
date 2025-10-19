/**
 * MT5 Broker Connector
 * 
 * This file implements the IBrokerConnector interface for MT5 integration.
 * It provides a high-level interface for connecting to MT5 and performing
 * trading operations with proper error handling and logging.
 */

import {
  BrokerCredentials,
  TradeResult,
  SymbolInfo,
  Position,
  Order,
  MarketOrder,
  AccountInfo,
  BrokerError,
  ConnectionStatus,
  ConnectionEvent,
  ConnectionEventType,
  BrokerConfig
} from './types';
import { MT5ApiWrapper } from './mt5-api-wrapper';

/**
 * Interface for broker connectors
 * This defines the standard interface that all broker connectors must implement
 */
export interface IBrokerConnector {
  // Connection management
  connect(credentials: BrokerCredentials): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  // Account information
  getAccountInfo(): Promise<AccountInfo>;
  
  // Trading operations
  openPosition(order: MarketOrder): Promise<TradeResult>;
  closePosition(ticket: number, volume?: number): Promise<TradeResult>;
  modifyPosition(ticket: number, sl?: number, tp?: number): Promise<boolean>;
  
  // Market data
  getSymbolInfo(symbol: string): Promise<SymbolInfo>;
  getCurrentPrice(symbol: string): Promise<{bid: number; ask: number}>;
  
  // Position management
  getOpenPositions(): Promise<Position[]>;
  getOrderHistory(from: Date, to: Date): Promise<Order[]>;
  
  // Event handling
  onConnectionEvent(callback: (event: ConnectionEvent) => void): void;
  
  // Error handling
  getLastError(): BrokerError | null;
}

/**
 * MT5 Broker Connector Implementation
 * 
 * This class implements the IBrokerConnector interface for MT5 integration.
 * It provides a high-level interface for connecting to MT5 and performing
 * trading operations with proper error handling and logging.
 */
export class MT5Connector implements IBrokerConnector {
  private apiWrapper: MT5ApiWrapper;
  private connectionEventCallbacks: ((event: ConnectionEvent) => void)[] = [];
  private lastError: BrokerError | null = null;
  private credentials: BrokerCredentials | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isReconnecting: boolean = false;

  constructor(config: Partial<BrokerConfig> = {}) {
    this.apiWrapper = new MT5ApiWrapper(config);
    this.log('info', 'MT5 Connector initialized');
  }

  /**
   * Connect to MT5 broker with provided credentials
   */
  async connect(credentials: BrokerCredentials): Promise<boolean> {
    this.log('info', `Connecting to MT5 broker: ${credentials.server}`);
    this.credentials = credentials;
    this.clearLastError();
    
    try {
      const connected = await this.apiWrapper.connect(credentials);
      
      if (connected) {
        this.log('info', 'Successfully connected to MT5 broker');
        this.emitConnectionEvent({
          type: ConnectionEventType.CONNECTED,
          timestamp: new Date(),
          data: { server: credentials.server }
        });
        return true;
      } else {
        this.log('error', 'Failed to connect to MT5 broker');
        this.setLastError({
          code: 2001,
          message: 'Failed to connect to MT5 broker',
          details: `Server: ${credentials.server}, Login: ${credentials.login}`
        });
        this.emitConnectionEvent({
          type: ConnectionEventType.ERROR,
          timestamp: new Date(),
          error: this.lastError!
        });
        return false;
      }
    } catch (error) {
      this.log('error', `Connection error: ${error}`);
      this.setLastError({
        code: 2002,
        message: 'Connection error',
        details: error?.toString()
      });
      this.emitConnectionEvent({
        type: ConnectionEventType.ERROR,
        timestamp: new Date(),
        error: this.lastError!
      });
      return false;
    }
  }

  /**
   * Disconnect from MT5 broker
   */
  async disconnect(): Promise<void> {
    this.log('info', 'Disconnecting from MT5 broker');
    
    // Clear any reconnection timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    try {
      await this.apiWrapper.disconnect();
      this.credentials = null;
      this.isReconnecting = false;
      this.log('info', 'Successfully disconnected from MT5 broker');
      this.emitConnectionEvent({
        type: ConnectionEventType.DISCONNECTED,
        timestamp: new Date()
      });
    } catch (error) {
      this.log('error', `Disconnect error: ${error}`);
      this.setLastError({
        code: 2003,
        message: 'Disconnect error',
        details: error?.toString()
      });
    }
  }

  /**
   * Check if connected to MT5 broker
   */
  isConnected(): boolean {
    return this.apiWrapper.checkConnection();
  }

  /**
   * Get account information from broker
   */
  async getAccountInfo(): Promise<AccountInfo> {
    this.log('debug', 'Getting account information');
    this.clearLastError();
    
    if (!this.isConnected()) {
      this.setLastError({
        code: 2004,
        message: 'Not connected to MT5 broker',
        details: 'Cannot get account information when not connected'
      });
      throw new Error('Not connected to MT5 broker');
    }
    
    try {
      const accountInfo = await this.apiWrapper.getAccountInfo();
      this.log('debug', `Account info retrieved - Balance: ${accountInfo.balance}, Equity: ${accountInfo.equity}`);
      return accountInfo;
    } catch (error) {
      this.log('error', `Failed to get account info: ${error}`);
      this.setLastError({
        code: 2004,
        message: 'Failed to get account information',
        details: error?.toString()
      });
      throw error;
    }
  }

  /**
   * Open a new position
   */
  async openPosition(order: MarketOrder): Promise<TradeResult> {
    this.log('info', `Opening ${order.type === 0 ? 'BUY' : 'SELL'} position: ${order.symbol}, Volume: ${order.volume}`);
    this.clearLastError();
    
    if (!this.isConnected()) {
      this.setLastError({
        code: 2005,
        message: 'Not connected to MT5 broker',
        details: 'Cannot open position when not connected'
      });
      throw new Error('Not connected to MT5 broker');
    }
    
    try {
      // Validate order before sending
      this.validateOrder(order);
      
      const result = await this.apiWrapper.openPosition(order);
      
      if (result.retcode === 0) {
        this.log('info', `Position opened successfully - Ticket: ${result.order}, Price: ${result.price}`);
        return result;
      } else {
        this.log('error', `Failed to open position - Return code: ${result.retcode}, Comment: ${result.comment}`);
        this.setLastError({
          code: result.retcode,
          message: 'Failed to open position',
          details: result.comment
        });
        throw new Error(`Failed to open position: ${result.comment}`);
      }
    } catch (error) {
      this.log('error', `Error opening position: ${error}`);
      if (!this.lastError) {
        this.setLastError({
          code: 2005,
          message: 'Error opening position',
          details: error?.toString()
        });
      }
      throw error;
    }
  }

  /**
   * Close an existing position
   */
  async closePosition(ticket: number, volume?: number): Promise<TradeResult> {
    this.log('info', `Closing position - Ticket: ${ticket}, Volume: ${volume || 'Full'}`);
    this.clearLastError();
    
    if (!this.isConnected()) {
      this.setLastError({
        code: 2006,
        message: 'Not connected to MT5 broker',
        details: 'Cannot close position when not connected'
      });
      throw new Error('Not connected to MT5 broker');
    }
    
    try {
      const result = await this.apiWrapper.closePosition(ticket, volume);
      
      if (result.retcode === 0) {
        this.log('info', `Position closed successfully - Ticket: ${ticket}, Price: ${result.price}`);
        return result;
      } else {
        this.log('error', `Failed to close position - Return code: ${result.retcode}, Comment: ${result.comment}`);
        this.setLastError({
          code: result.retcode,
          message: 'Failed to close position',
          details: result.comment
        });
        throw new Error(`Failed to close position: ${result.comment}`);
      }
    } catch (error) {
      this.log('error', `Error closing position: ${error}`);
      if (!this.lastError) {
        this.setLastError({
          code: 2006,
          message: 'Error closing position',
          details: error?.toString()
        });
      }
      throw error;
    }
  }

  /**
   * Modify an existing position (stop loss, take profit)
   */
  async modifyPosition(ticket: number, sl?: number, tp?: number): Promise<boolean> {
    this.log('info', `Modifying position - Ticket: ${ticket}, SL: ${sl}, TP: ${tp}`);
    this.clearLastError();
    
    if (!this.isConnected()) {
      this.setLastError({
        code: 2008,
        message: 'Not connected to MT5 broker',
        details: 'Cannot modify position when not connected'
      });
      throw new Error('Not connected to MT5 broker');
    }
    
    try {
      const result = await this.apiWrapper.modifyPosition(ticket, sl, tp);
      
      if (result) {
        this.log('info', `Position modified successfully - Ticket: ${ticket}`);
        return true;
      } else {
        this.log('error', `Failed to modify position - Ticket: ${ticket}`);
        this.setLastError({
          code: 2007,
          message: 'Failed to modify position',
          details: `Ticket: ${ticket}`
        });
        throw new Error(`Failed to modify position: ${ticket}`);
      }
    } catch (error) {
      this.log('error', `Error modifying position: ${error}`);
      if (!this.lastError) {
        this.setLastError({
          code: 2008,
          message: 'Error modifying position',
          details: error?.toString()
        });
      }
      throw error;
    }
  }

  /**
   * Get symbol information
   */
  async getSymbolInfo(symbol: string): Promise<SymbolInfo> {
    this.log('debug', `Getting symbol info for: ${symbol}`);
    this.clearLastError();
    
    if (!this.isConnected()) {
      this.setLastError({
        code: 2009,
        message: 'Not connected to MT5 broker',
        details: 'Cannot get symbol information when not connected'
      });
      throw new Error('Not connected to MT5 broker');
    }
    
    try {
      const symbolInfo = await this.apiWrapper.getSymbolInfo(symbol);
      this.log('debug', `Symbol info retrieved for ${symbol} - Spread: ${symbolInfo.spread}`);
      return symbolInfo;
    } catch (error) {
      this.log('error', `Failed to get symbol info for ${symbol}: ${error}`);
      this.setLastError({
        code: 2009,
        message: `Failed to get symbol information for ${symbol}`,
        details: error?.toString()
      });
      throw error;
    }
  }

  /**
   * Get current price for a symbol
   */
  async getCurrentPrice(symbol: string): Promise<{bid: number; ask: number}> {
    this.log('debug', `Getting current price for: ${symbol}`);
    this.clearLastError();
    
    if (!this.isConnected()) {
      this.setLastError({
        code: 2010,
        message: 'Not connected to MT5 broker',
        details: 'Cannot get current price when not connected'
      });
      throw new Error('Not connected to MT5 broker');
    }
    
    try {
      const price = await this.apiWrapper.getCurrentPrice(symbol);
      this.log('debug', `Current price for ${symbol} - Bid: ${price.bid}, Ask: ${price.ask}`);
      return price;
    } catch (error) {
      this.log('error', `Failed to get current price for ${symbol}: ${error}`);
      this.setLastError({
        code: 2010,
        message: `Failed to get current price for ${symbol}`,
        details: error?.toString()
      });
      throw error;
    }
  }

  /**
   * Get all open positions
   */
  async getOpenPositions(): Promise<Position[]> {
    this.log('debug', 'Getting open positions');
    this.clearLastError();
    
    if (!this.isConnected()) {
      this.setLastError({
        code: 2011,
        message: 'Not connected to MT5 broker',
        details: 'Cannot get open positions when not connected'
      });
      throw new Error('Not connected to MT5 broker');
    }
    
    try {
      const positions = await this.apiWrapper.getOpenPositions();
      this.log('debug', `Retrieved ${positions.length} open positions`);
      return positions;
    } catch (error) {
      this.log('error', `Failed to get open positions: ${error}`);
      this.setLastError({
        code: 2011,
        message: 'Failed to get open positions',
        details: error?.toString()
      });
      throw error;
    }
  }

  /**
   * Get order history for a date range
   */
  async getOrderHistory(from: Date, to: Date): Promise<Order[]> {
    this.log('debug', `Getting order history from ${from.toISOString()} to ${to.toISOString()}`);
    this.clearLastError();
    
    if (!this.isConnected()) {
      this.setLastError({
        code: 2012,
        message: 'Not connected to MT5 broker',
        details: 'Cannot get order history when not connected'
      });
      throw new Error('Not connected to MT5 broker');
    }
    
    try {
      const orders = await this.apiWrapper.getOrderHistory(from, to);
      this.log('debug', `Retrieved ${orders.length} orders in history`);
      return orders;
    } catch (error) {
      this.log('error', `Failed to get order history: ${error}`);
      this.setLastError({
        code: 2012,
        message: 'Failed to get order history',
        details: error?.toString()
      });
      throw error;
    }
  }

  /**
   * Register callback for connection events
   */
  onConnectionEvent(callback: (event: ConnectionEvent) => void): void {
    this.connectionEventCallbacks.push(callback);
    this.log('debug', 'Connection event callback registered');
  }

  /**
   * Get the last error that occurred
   */
  getLastError(): BrokerError | null {
    return this.lastError;
  }

  /**
   * Enable mock mode for testing
   */
  enableMockMode(): void {
    this.apiWrapper.enableMockMode();
    this.log('info', 'Mock mode enabled');
  }

  /**
   * Disable mock mode
   */
  disableMockMode(): void {
    this.apiWrapper.disableMockMode();
    this.log('info', 'Mock mode disabled');
  }

  // Private methods

  private validateOrder(order: MarketOrder): void {
    if (!order.symbol) {
      throw new Error('Symbol is required');
    }
    
    if (order.volume <= 0) {
      throw new Error('Volume must be greater than 0');
    }
    
    if (order.type !== 0 && order.type !== 1) {
      throw new Error('Order type must be 0 (BUY) or 1 (SELL)');
    }
    
    if (order.sl !== undefined && order.sl <= 0) {
      throw new Error('Stop loss must be greater than 0');
    }
    
    if (order.tp !== undefined && order.tp <= 0) {
      throw new Error('Take profit must be greater than 0');
    }
  }

  private setLastError(error: BrokerError): void {
    this.lastError = error;
  }

  private clearLastError(): void {
    this.lastError = null;
  }

  private emitConnectionEvent(event: ConnectionEvent): void {
    this.connectionEventCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        this.log('error', `Error in connection event callback: ${error}`);
      }
    });
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const logMessage = `[MT5Connector] ${message}`;
    
    switch (level) {
      case 'debug':
        console.debug(logMessage);
        break;
      case 'info':
        console.info(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'error':
        console.error(logMessage);
        break;
    }
  }
}