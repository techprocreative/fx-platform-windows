/**
 * Real-time position monitoring system for tracking and analyzing trading positions
 */

import { Position, SymbolInfo } from '../brokers/types';
import { IBrokerConnector } from '../brokers/mt5-connector';
import {
  MonitoredPosition,
  PositionSubscription,
  MonitoringConfig,
  MonitoringStatus,
  PnLReport,
  Anomaly,
  PositionEvent,
  PricePoint,
  AlertType,
  PositionAlert
} from './types';
import { PnLCalculator } from './pnl-calculator';
import { AnomalyDetector } from './anomaly-detector';

export class PositionMonitor {
  private config: MonitoringConfig;
  private subscriptions: Map<string, PositionSubscription> = new Map();
  private monitoredPositions: Map<number, MonitoredPosition> = new Map();
  private brokerConnector?: IBrokerConnector;
  private pnlCalculator: PnLCalculator;
  private anomalyDetector: AnomalyDetector;
  private status: MonitoringStatus;
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();
  private eventCallbacks: Map<string, (event: PositionEvent) => void> = new Map();

  constructor(config?: Partial<MonitoringConfig>) {
    // Default configuration
    this.config = {
      positionUpdateInterval: 1000, // 1 second
      priceUpdateInterval: 500, // 500ms
      pnlUpdateInterval: 2000, // 2 seconds
      priceSpikeThreshold: 5.0, // 5%
      volumeThreshold: 3.0, // 3x average
      drawdownThreshold: 10.0, // 10%
      marginCallThreshold: 20.0, // 20%
      maxPositionAge: 24 * 60 * 60 * 1000, // 24 hours
      enablePriceHistory: true,
      priceHistorySize: 100,
      enableAlerts: true,
      alertChannels: [],
      maxRiskPerPosition: 2.0, // 2%
      maxTotalRisk: 10.0, // 10%
      emergencyStop: false,
      enableLogging: true,
      logLevel: 'info',
      ...config
    };

    this.pnlCalculator = new PnLCalculator();
    this.anomalyDetector = new AnomalyDetector(this.config);
    
    this.status = {
      active: false,
      positionsMonitored: 0,
      anomaliesDetected: 0,
      alertsTriggered: 0,
      errors: []
    };
  }

  /**
   * Set broker connector for position data
   */
  setBrokerConnector(connector: IBrokerConnector): void {
    this.brokerConnector = connector;
  }

  /**
   * Update monitoring configuration
   */
  updateConfig(config: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...config };
    this.anomalyDetector.updateConfig(this.config);
  }

  /**
   * Get current monitoring status
   */
  getStatus(): MonitoringStatus {
    return { ...this.status };
  }

  /**
   * Subscribe to position updates for a user
   */
  subscribeToPositions(
    userId: string,
    callback: (positions: MonitoredPosition[]) => void,
    symbols?: string[]
  ): string {
    const subscriptionId = `sub_${userId}_${Date.now()}`;
    
    const subscription: PositionSubscription = {
      id: subscriptionId,
      userId,
      symbols,
      callback,
      active: true,
      createdAt: new Date()
    };
    
    this.subscriptions.set(subscriptionId, subscription);
    
    // Start monitoring if not already active
    if (!this.status.active) {
      this.startMonitoring();
    }
    
    return subscriptionId;
  }

  /**
   * Unsubscribe from position updates
   */
  unsubscribeFromPositions(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.active = false;
      this.subscriptions.delete(subscriptionId);
      
      // Stop monitoring if no active subscriptions
      if (this.subscriptions.size === 0) {
        this.stopMonitoring();
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Start monitoring positions
   */
  async startMonitoring(): Promise<void> {
    if (this.status.active) {
      return;
    }
    
    this.status.active = true;
    this.status.startTime = new Date();
    
    if (this.config.enableLogging) {
      console.log('Position monitoring started');
    }
    
    // Start update intervals
    this.startUpdateIntervals();
    
    // Initial position fetch
    await this.updatePositions();
  }

  /**
   * Stop monitoring positions
   */
  stopMonitoring(): void {
    if (!this.status.active) {
      return;
    }
    
    this.status.active = false;
    
    if (this.config.enableLogging) {
      console.log('Position monitoring stopped');
    }
    
    // Clear all update intervals
    for (const [key, interval] of this.updateIntervals) {
      clearInterval(interval);
    }
    this.updateIntervals.clear();
  }

  /**
   * Start all update intervals
   */
  private startUpdateIntervals(): void {
    // Position updates
    const positionInterval = setInterval(
      () => this.updatePositions(),
      this.config.positionUpdateInterval
    );
    this.updateIntervals.set('positions', positionInterval);
    
    // Price updates
    const priceInterval = setInterval(
      () => this.updatePrices(),
      this.config.priceUpdateInterval
    );
    this.updateIntervals.set('prices', priceInterval);
    
    // P&L updates
    const pnlInterval = setInterval(
      () => this.updatePnL(),
      this.config.pnlUpdateInterval
    );
    this.updateIntervals.set('pnl', pnlInterval);
    
    // Anomaly detection
    const anomalyInterval = setInterval(
      () => this.detectAnomaliesInternal(),
      this.config.positionUpdateInterval
    );
    this.updateIntervals.set('anomalies', anomalyInterval);
  }

  /**
   * Update positions from broker
   */
  private async updatePositions(): Promise<void> {
    if (!this.brokerConnector) {
      return;
    }
    
    try {
      const positions = await this.brokerConnector.getOpenPositions();
      const updatedPositions = new Map<number, MonitoredPosition>();
      
      // Process each position
      for (const position of positions) {
        const monitoredPosition = await this.processPosition(position);
        updatedPositions.set(position.ticket, monitoredPosition);
        
        // Check for position events (new, closed, modified)
        this.checkPositionEvents(position);
      }
      
      // Check for closed positions
      for (const [ticket, oldPosition] of this.monitoredPositions) {
        if (!updatedPositions.has(ticket)) {
          this.handlePositionClosed(oldPosition);
        }
      }
      
      // Update monitored positions
      this.monitoredPositions = updatedPositions;
      this.status.positionsMonitored = this.monitoredPositions.size;
      this.status.lastUpdate = new Date();
      
      // Notify subscribers
      this.notifySubscribers();
      
    } catch (error) {
      this.handleError('Failed to update positions', error);
    }
  }

  /**
   * Process a position and add monitoring data
   */
  private async processPosition(position: Position): Promise<MonitoredPosition> {
    const existingPosition = this.monitoredPositions.get(position.ticket);
    
    // Get symbol info for P&L calculations
    if (this.brokerConnector) {
      try {
        const symbolInfo = await this.brokerConnector.getSymbolInfo(position.symbol);
        this.pnlCalculator.updateSymbolInfo(position.symbol, symbolInfo);
      } catch (error) {
        console.warn(`Failed to get symbol info for ${position.symbol}:`, error);
      }
    }
    
    // Calculate P&L
    const unrealizedPnL = this.pnlCalculator.calculateUnrealizedPnL(position, position.priceCurrent);
    const totalPnL = this.pnlCalculator.calculateTotalPnL(position, position.priceCurrent);
    const marginUsed = this.pnlCalculator.calculateMarginUsed(position);
    
    // Create monitored position
    const monitoredPosition: MonitoredPosition = {
      ...position,
      unrealizedPnL,
      totalPnL,
      marginUsed,
      lastUpdated: new Date(),
      priceHistory: existingPosition?.priceHistory || [],
      alerts: existingPosition?.alerts || []
    };
    
    // Add price point to history
    if (this.config.enablePriceHistory) {
      const pricePoint: PricePoint = {
        timestamp: new Date(),
        price: position.priceCurrent,
        type: 'bid'
      };
      
      monitoredPosition.priceHistory?.push(pricePoint);
      
      // Limit history size
      if (monitoredPosition.priceHistory && 
          monitoredPosition.priceHistory.length > this.config.priceHistorySize) {
        monitoredPosition.priceHistory.shift();
      }
      
      // Update P&L calculator
      this.pnlCalculator.addPricePoint(position.ticket, pricePoint);
    }
    
    // Update anomaly detector
    this.anomalyDetector.addPositionState(monitoredPosition);
    
    return monitoredPosition;
  }

  /**
   * Update price data for all symbols
   */
  private async updatePrices(): Promise<void> {
    if (!this.brokerConnector) {
      return;
    }
    
    // Get unique symbols from all positions
    const symbols = new Set<string>();
    for (const position of this.monitoredPositions.values()) {
      symbols.add(position.symbol);
    }
    
    // Update prices for each symbol
    for (const symbol of symbols) {
      try {
        const priceInfo = await this.brokerConnector.getCurrentPrice(symbol);
        
        // Add price points to anomaly detector
        const bidPoint: PricePoint = {
          timestamp: new Date(),
          price: priceInfo.bid,
          type: 'bid'
        };
        
        const askPoint: PricePoint = {
          timestamp: new Date(),
          price: priceInfo.ask,
          type: 'ask'
        };
        
        this.anomalyDetector.addPricePoint(symbol, bidPoint);
        this.anomalyDetector.addPricePoint(symbol, askPoint);
        
      } catch (error) {
        console.warn(`Failed to update price for ${symbol}:`, error);
      }
    }
  }

  /**
   * Update P&L for all positions
   */
  private updatePnL(): void {
    for (const position of this.monitoredPositions.values()) {
      const unrealizedPnL = this.pnlCalculator.calculateUnrealizedPnL(position, position.priceCurrent);
      const totalPnL = this.pnlCalculator.calculateTotalPnL(position, position.priceCurrent);
      
      position.unrealizedPnL = unrealizedPnL;
      position.totalPnL = totalPnL;
      position.lastUpdated = new Date();
      
      // Check for P&L alerts
      this.checkPnLAlerts(position);
    }
  }

  /**
   * Detect anomalies in positions (internal method)
   */
  private detectAnomaliesInternal(): void {
    const positions = Array.from(this.monitoredPositions.values());
    const anomalies = this.anomalyDetector.detectAnomalies(positions);
    
    if (anomalies.length > 0) {
      this.status.anomaliesDetected += anomalies.length;
      
      for (const anomaly of anomalies) {
        this.handleAnomaly(anomaly);
      }
    }
  }

  /**
   * Calculate real-time P&L report
   */
  calculateRealtimePnL(accountCurrency = 'USD', accountBalance?: number, accountEquity?: number): PnLReport {
    const positions = Array.from(this.monitoredPositions.values());
    return this.pnlCalculator.calculatePnLReport(positions, accountCurrency, accountBalance, accountEquity);
  }

  /**
   * Check stop loss/take profit levels
   */
  async checkStopLevels(position: MonitoredPosition): Promise<void> {
    if (!position.priceSL && !position.priceTP) {
      return;
    }
    
    const currentPrice = position.priceCurrent;
    
    // Check stop loss
    if (position.priceSL) {
      let stopHit = false;
      if (position.type === 0) { // Buy position
        stopHit = currentPrice <= position.priceSL;
      } else { // Sell position
        stopHit = currentPrice >= position.priceSL;
      }
      
      if (stopHit) {
        await this.handleStopLossHit(position);
      }
    }
    
    // Check take profit
    if (position.priceTP) {
      let takeHit = false;
      if (position.type === 0) { // Buy position
        takeHit = currentPrice >= position.priceTP;
      } else { // Sell position
        takeHit = currentPrice <= position.priceTP;
      }
      
      if (takeHit) {
        await this.handleTakeProfitHit(position);
      }
    }
  }

  /**
   * Detect anomalies in positions
   */
  detectAnomalies(positions?: MonitoredPosition[]): Anomaly[] {
    const positionsToCheck = positions || Array.from(this.monitoredPositions.values());
    return this.anomalyDetector.detectAnomalies(positionsToCheck);
  }

  /**
   * Notify all subscribers with updated positions
   */
  private notifySubscribers(): void {
    const positions = Array.from(this.monitoredPositions.values());
    
    for (const subscription of this.subscriptions.values()) {
      if (!subscription.active) {
        continue;
      }
      
      // Filter by symbols if specified
      let filteredPositions = positions;
      if (subscription.symbols && subscription.symbols.length > 0) {
        filteredPositions = positions.filter(p => subscription.symbols!.includes(p.symbol));
      }
      
      try {
        subscription.callback(filteredPositions);
        subscription.lastUpdate = new Date();
      } catch (error) {
        console.error(`Error in subscription callback for ${subscription.userId}:`, error);
      }
    }
  }

  /**
   * Check for position events
   */
  private checkPositionEvents(position: Position): void {
    const existingPosition = this.monitoredPositions.get(position.ticket);
    
    if (!existingPosition) {
      // New position
      this.emitEvent({
        type: 'open',
        position: this.monitoredPositions.get(position.ticket)!,
        timestamp: new Date()
      });
    } else if (existingPosition.priceSL !== position.priceSL || 
               existingPosition.priceTP !== position.priceTP) {
      // Modified position
      this.emitEvent({
        type: 'modify',
        position: this.monitoredPositions.get(position.ticket)!,
        timestamp: new Date(),
        data: {
          oldSL: existingPosition.priceSL,
          newSL: position.priceSL,
          oldTP: existingPosition.priceTP,
          newTP: position.priceTP
        }
      });
    }
  }

  /**
   * Handle position closed
   */
  private handlePositionClosed(position: MonitoredPosition): void {
    this.emitEvent({
      type: 'close',
      position,
      timestamp: new Date()
    });
  }

  /**
   * Handle stop loss hit
   */
  private async handleStopLossHit(position: MonitoredPosition): Promise<void> {
    this.emitEvent({
      type: 'sl_hit',
      position,
      timestamp: new Date()
    });
    
    if (this.config.enableAlerts) {
      this.createAlert(position, AlertType.STOP_LOSS_APPROACHING, 'Stop loss hit');
    }
  }

  /**
   * Handle take profit hit
   */
  private async handleTakeProfitHit(position: MonitoredPosition): Promise<void> {
    this.emitEvent({
      type: 'tp_hit',
      position,
      timestamp: new Date()
    });
    
    if (this.config.enableAlerts) {
      this.createAlert(position, AlertType.TAKE_PROFIT_APPROACHING, 'Take profit hit');
    }
  }

  /**
   * Handle detected anomaly
   */
  private handleAnomaly(anomaly: Anomaly): void {
    if (this.config.enableLogging) {
      console.warn(`Anomaly detected: ${anomaly.description}`, anomaly);
    }
    
    // Execute anomaly actions
    this.anomalyDetector.executeAnomalyActions(anomaly.id);
  }

  /**
   * Check for P&L alerts
   */
  private checkPnLAlerts(position: MonitoredPosition): void {
    if (!this.config.enableAlerts) {
      return;
    }
    
    const totalPnL = position.totalPnL || 0;
    const marginUsed = position.marginUsed || 1;
    const pnlPercent = (totalPnL / marginUsed) * 100;
    
    // Profit alert
    if (pnlPercent > 10) {
      this.createAlert(position, AlertType.POSITION_PROFIT, `Position profit: ${pnlPercent.toFixed(2)}%`);
    }
    
    // Loss alert
    if (pnlPercent < -5) {
      this.createAlert(position, AlertType.POSITION_LOSS, `Position loss: ${pnlPercent.toFixed(2)}%`);
    }
  }

  /**
   * Create alert for position
   */
  private createAlert(position: MonitoredPosition, type: AlertType, message: string): void {
    const alert: PositionAlert = {
      id: `alert_${position.ticket}_${Date.now()}`,
      type,
      message,
      triggered: true,
      triggeredAt: new Date(),
      acknowledged: false
    };
    
    position.alerts?.push(alert);
    this.status.alertsTriggered++;
  }

  /**
   * Emit position event
   */
  private emitEvent(event: PositionEvent): void {
    for (const [id, callback] of this.eventCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error(`Error in event callback ${id}:`, error);
      }
    }
  }

  /**
   * Register event callback
   */
  onPositionEvent(id: string, callback: (event: PositionEvent) => void): void {
    this.eventCallbacks.set(id, callback);
  }

  /**
   * Unregister event callback
   */
  offPositionEvent(id: string): void {
    this.eventCallbacks.delete(id);
  }

  /**
   * Handle errors
   */
  private handleError(message: string, error: any): void {
    const errorInfo = {
      timestamp: new Date(),
      message,
      details: error,
      resolved: false
    };
    
    this.status.errors.push(errorInfo);
    
    if (this.config.enableLogging) {
      console.error(message, error);
    }
  }

  /**
   * Get monitored positions
   */
  getMonitoredPositions(): MonitoredPosition[] {
    return Array.from(this.monitoredPositions.values());
  }

  /**
   * Get position by ticket
   */
  getPosition(ticket: number): MonitoredPosition | undefined {
    return this.monitoredPositions.get(ticket);
  }

  /**
   * Get all anomalies
   */
  getAnomalies(): Anomaly[] {
    return this.anomalyDetector.getAnomalies();
  }

  /**
   * Get unresolved anomalies
   */
  getUnresolvedAnomalies(): Anomaly[] {
    return this.anomalyDetector.getUnresolvedAnomalies();
  }

  /**
   * Resolve anomaly
   */
  resolveAnomaly(anomalyId: string): boolean {
    return this.anomalyDetector.resolveAnomaly(anomalyId);
  }
}