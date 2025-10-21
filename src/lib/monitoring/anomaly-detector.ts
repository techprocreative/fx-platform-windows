/**
 * Anomaly detection algorithms for monitoring unusual position behavior
 */

import { Position } from '../brokers/types';
import { 
  MonitoredPosition, 
  Anomaly, 
  AnomalyType, 
  AnomalySeverity, 
  AnomalyAction,
  MonitoringConfig,
  PricePoint 
} from './types';

export class AnomalyDetector {
  private config: MonitoringConfig;
  private priceHistory: Map<string, PricePoint[]> = new Map();
  private volumeHistory: Map<string, number[]> = new Map();
  private positionHistory: Map<number, MonitoredPosition[]> = new Map();
  private anomalies: Anomaly[] = [];

  constructor(config: MonitoringConfig) {
    this.config = config;
  }

  /**
   * Update monitoring configuration
   */
  updateConfig(config: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Add price data point for analysis
   */
  addPricePoint(symbol: string, pricePoint: PricePoint): void {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }
    
    const history = this.priceHistory.get(symbol)!;
    history.push(pricePoint);
    
    // Keep only recent history (last 1000 points)
    if (history.length > 1000) {
      history.shift();
    }
  }

  /**
   * Add volume data point for analysis
   */
  addVolumePoint(symbol: string, volume: number): void {
    if (!this.volumeHistory.has(symbol)) {
      this.volumeHistory.set(symbol, []);
    }
    
    const history = this.volumeHistory.get(symbol)!;
    history.push(volume);
    
    // Keep only recent history (last 500 points)
    if (history.length > 500) {
      history.shift();
    }
  }

  /**
   * Add position state to history
   */
  addPositionState(position: MonitoredPosition): void {
    if (!this.positionHistory.has(position.ticket)) {
      this.positionHistory.set(position.ticket, []);
    }
    
    const history = this.positionHistory.get(position.ticket)!;
    history.push({ ...position });
    
    // Keep only recent history (last 100 states)
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Detect anomalies in positions
   */
  detectAnomalies(positions: MonitoredPosition[]): Anomaly[] {
    const detectedAnomalies: Anomaly[] = [];
    
    for (const position of positions) {
      // Detect price spikes
      const priceSpike = this.detectPriceSpike(position);
      if (priceSpike) detectedAnomalies.push(priceSpike);
      
      // Detect unusual volume
      const volumeAnomaly = this.detectUnusualVolume(position);
      if (volumeAnomaly) detectedAnomalies.push(volumeAnomaly);
      
      // Detect margin call risk
      const marginCall = this.detectMarginCall(position);
      if (marginCall) detectedAnomalies.push(marginCall);
      
      // Detect stop loss/take profit hits
      const stopHit = this.detectStopLossHit(position);
      if (stopHit) detectedAnomalies.push(stopHit);
      
      const takeHit = this.detectTakeProfitHit(position);
      if (takeHit) detectedAnomalies.push(takeHit);
      
      // Detect position timeout
      const timeout = this.detectPositionTimeout(position);
      if (timeout) detectedAnomalies.push(timeout);
      
      // Detect rapid drawdown
      const drawdown = this.detectRapidDrawdown(position);
      if (drawdown) detectedAnomalies.push(drawdown);
    }
    
    // Detect system-level anomalies
    const connectionLoss = this.detectConnectionLoss();
    if (connectionLoss) detectedAnomalies.push(connectionLoss);
    
    const unauthorizedTrades = this.detectUnauthorizedTrades(positions);
    detectedAnomalies.push(...unauthorizedTrades);
    
    // Store detected anomalies
    this.anomalies.push(...detectedAnomalies);
    
    // Keep only recent anomalies (last 1000)
    if (this.anomalies.length > 1000) {
      this.anomalies = this.anomalies.slice(-1000);
    }
    
    return detectedAnomalies;
  }

  /**
   * Detect price spikes
   */
  private detectPriceSpike(position: MonitoredPosition): Anomaly | null {
    const symbolHistory = this.priceHistory.get(position.symbol);
    if (!symbolHistory || symbolHistory.length < 10) {
      return null;
    }
    
    // Get recent prices
    const recentPrices = symbolHistory.slice(-10).map(p => p.price);
    const currentPrice = position.priceCurrent;
    const avgPrice = recentPrices.reduce((sum, price) => sum + price, 0) / recentPrices.length;
    
    // Calculate percentage change
    const priceChange = Math.abs((currentPrice - avgPrice) / avgPrice) * 100;
    
    if (priceChange > this.config.priceSpikeThreshold) {
      return {
        id: `price_spike_${position.ticket}_${Date.now()}`,
        type: AnomalyType.PRICE_SPIKE,
        severity: priceChange > this.config.priceSpikeThreshold * 2 ? AnomalySeverity.HIGH : AnomalySeverity.MEDIUM,
        positionId: position.ticket,
        symbol: position.symbol,
        description: `Price spike detected for ${position.symbol}: ${priceChange.toFixed(2)}% change`,
        timestamp: new Date(),
        value: priceChange,
        expectedValue: this.config.priceSpikeThreshold,
        threshold: this.config.priceSpikeThreshold,
        confidence: Math.min(95, 50 + priceChange),
        resolved: false,
        actions: [
          {
            type: 'notify',
            description: 'Notify trader of significant price movement',
            executed: false
          }
        ]
      };
    }
    
    return null;
  }

  /**
   * Detect unusual volume
   */
  private detectUnusualVolume(position: MonitoredPosition): Anomaly | null {
    const symbolVolumeHistory = this.volumeHistory.get(position.symbol);
    if (!symbolVolumeHistory || symbolVolumeHistory.length < 20) {
      return null;
    }
    
    // Calculate average volume
    const recentVolumes = symbolVolumeHistory.slice(-20);
    const avgVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
    
    // Check if current volume is unusual
    const volumeRatio = position.volume / avgVolume;
    
    if (volumeRatio > this.config.volumeThreshold) {
      return {
        id: `unusual_volume_${position.ticket}_${Date.now()}`,
        type: AnomalyType.UNUSUAL_VOLUME,
        severity: volumeRatio > this.config.volumeThreshold * 2 ? AnomalySeverity.HIGH : AnomalySeverity.MEDIUM,
        positionId: position.ticket,
        symbol: position.symbol,
        description: `Unusual volume detected for ${position.symbol}: ${volumeRatio.toFixed(2)}x average`,
        timestamp: new Date(),
        value: volumeRatio,
        expectedValue: this.config.volumeThreshold,
        threshold: this.config.volumeThreshold,
        confidence: Math.min(90, 40 + volumeRatio * 10),
        resolved: false,
        actions: [
          {
            type: 'notify',
            description: 'Notify trader of unusual trading volume',
            executed: false
          }
        ]
      };
    }
    
    return null;
  }

  /**
   * Detect margin call risk
   */
  private detectMarginCall(position: MonitoredPosition): Anomaly | null {
    const marginUsed = position.marginUsed || 0;
    const totalPnL = position.totalPnL || 0;
    const marginLevel = marginUsed > 0 ? ((marginUsed + totalPnL) / marginUsed) * 100 : 100;
    
    if (marginLevel < this.config.marginCallThreshold) {
      return {
        id: `margin_call_${position.ticket}_${Date.now()}`,
        type: AnomalyType.MARGIN_CALL,
        severity: marginLevel < this.config.marginCallThreshold * 0.5 ? AnomalySeverity.CRITICAL : AnomalySeverity.HIGH,
        positionId: position.ticket,
        symbol: position.symbol,
        description: `Margin call risk for ${position.symbol}: Margin level at ${marginLevel.toFixed(2)}%`,
        timestamp: new Date(),
        value: marginLevel,
        threshold: this.config.marginCallThreshold,
        confidence: 95,
        resolved: false,
        actions: [
          {
            type: 'notify',
            description: 'Immediate notification of margin call risk',
            executed: false
          },
          {
            type: 'close_position',
            description: 'Consider closing position to prevent margin call',
            executed: false
          }
        ]
      };
    }
    
    return null;
  }

  /**
   * Detect stop loss hit
   */
  private detectStopLossHit(position: MonitoredPosition): Anomaly | null {
    if (!position.priceSL) {
      return null;
    }
    
    const currentPrice = position.priceCurrent;
    const stopLoss = position.priceSL;
    
    // Check if stop loss is hit or very close
    let isHit = false;
    if (position.type === 0) { // Buy position
      isHit = currentPrice <= stopLoss;
    } else { // Sell position
      isHit = currentPrice >= stopLoss;
    }
    
    if (isHit) {
      return {
        id: `stop_loss_hit_${position.ticket}_${Date.now()}`,
        type: AnomalyType.STOP_LOSS_HIT,
        severity: AnomalySeverity.HIGH,
        positionId: position.ticket,
        symbol: position.symbol,
        description: `Stop loss hit for ${position.symbol} at ${stopLoss}`,
        timestamp: new Date(),
        value: currentPrice,
        expectedValue: stopLoss,
        confidence: 100,
        resolved: false,
        actions: [
          {
            type: 'notify',
            description: 'Notify of stop loss trigger',
            executed: false
          }
        ]
      };
    }
    
    return null;
  }

  /**
   * Detect take profit hit
   */
  private detectTakeProfitHit(position: MonitoredPosition): Anomaly | null {
    if (!position.priceTP) {
      return null;
    }
    
    const currentPrice = position.priceCurrent;
    const takeProfit = position.priceTP;
    
    // Check if take profit is hit
    let isHit = false;
    if (position.type === 0) { // Buy position
      isHit = currentPrice >= takeProfit;
    } else { // Sell position
      isHit = currentPrice <= takeProfit;
    }
    
    if (isHit) {
      return {
        id: `take_profit_hit_${position.ticket}_${Date.now()}`,
        type: AnomalyType.TAKE_PROFIT_HIT,
        severity: AnomalySeverity.MEDIUM,
        positionId: position.ticket,
        symbol: position.symbol,
        description: `Take profit hit for ${position.symbol} at ${takeProfit}`,
        timestamp: new Date(),
        value: currentPrice,
        expectedValue: takeProfit,
        confidence: 100,
        resolved: false,
        actions: [
          {
            type: 'notify',
            description: 'Notify of take profit trigger',
            executed: false
          }
        ]
      };
    }
    
    return null;
  }

  /**
   * Detect position timeout (position open too long)
   */
  private detectPositionTimeout(position: MonitoredPosition): Anomaly | null {
    const now = new Date();
    const openTime = new Date(position.openTime);
    const positionAge = now.getTime() - openTime.getTime();
    
    if (positionAge > this.config.maxPositionAge) {
      return {
        id: `position_timeout_${position.ticket}_${Date.now()}`,
        type: AnomalyType.POSITION_TIMEOUT,
        severity: AnomalySeverity.MEDIUM,
        positionId: position.ticket,
        symbol: position.symbol,
        description: `Position ${position.ticket} has been open for ${Math.round(positionAge / (1000 * 60 * 60))} hours`,
        timestamp: new Date(),
        value: positionAge,
        threshold: this.config.maxPositionAge,
        confidence: 75,
        resolved: false,
        actions: [
          {
            type: 'notify',
            description: 'Notify of long-running position',
            executed: false
          },
          {
            type: 'manual_review',
            description: 'Review position for manual closure',
            executed: false
          }
        ]
      };
    }
    
    return null;
  }

  /**
   * Detect rapid drawdown in position value
   */
  private detectRapidDrawdown(position: MonitoredPosition): Anomaly | null {
    const positionHistory = this.positionHistory.get(position.ticket);
    if (!positionHistory || positionHistory.length < 5) {
      return null;
    }
    
    // Get P&L history
    const pnlHistory = positionHistory.map(p => p.totalPnL || 0);
    const currentPnL = position.totalPnL || 0;
    const peakPnL = Math.max(...pnlHistory);
    
    // Calculate drawdown percentage
    const drawdownPercent = peakPnL > 0 ? ((peakPnL - currentPnL) / peakPnL) * 100 : 0;
    
    if (drawdownPercent > this.config.drawdownThreshold) {
      return {
        id: `rapid_drawdown_${position.ticket}_${Date.now()}`,
        type: AnomalyType.RAPID_DRAWDOWN,
        severity: drawdownPercent > this.config.drawdownThreshold * 2 ? AnomalySeverity.HIGH : AnomalySeverity.MEDIUM,
        positionId: position.ticket,
        symbol: position.symbol,
        description: `Rapid drawdown detected for ${position.symbol}: ${drawdownPercent.toFixed(2)}% from peak`,
        timestamp: new Date(),
        value: drawdownPercent,
        threshold: this.config.drawdownThreshold,
        confidence: Math.min(90, 50 + drawdownPercent),
        resolved: false,
        actions: [
          {
            type: 'notify',
            description: 'Notify of rapid drawdown',
            executed: false
          },
          {
            type: 'reduce_position',
            description: 'Consider reducing position size',
            executed: false
          }
        ]
      };
    }
    
    return null;
  }

  /**
   * Detect connection loss (placeholder implementation)
   */
  private detectConnectionLoss(): Anomaly | null {
    // This would integrate with connection monitoring
    // For now, return null as a placeholder
    return null;
  }

  /**
   * Detect unauthorized trades
   */
  private detectUnauthorizedTrades(positions: MonitoredPosition[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    // Check for positions without proper magic numbers or other identifiers
    for (const position of positions) {
      if (position.magic === 0 && position.comment === '') {
        anomalies.push({
          id: `unauthorized_trade_${position.ticket}_${Date.now()}`,
          type: AnomalyType.UNAUTHORIZED_TRADE,
          severity: AnomalySeverity.HIGH,
          positionId: position.ticket,
          symbol: position.symbol,
          description: `Potential unauthorized trade detected: ${position.ticket} has no magic number or comment`,
          timestamp: new Date(),
          confidence: 70,
          resolved: false,
          actions: [
            {
              type: 'notify',
              description: 'Immediate notification of potential unauthorized trade',
              executed: false
            },
            {
              type: 'manual_review',
              description: 'Manual review required for this position',
              executed: false
            }
          ]
        });
      }
    }
    
    return anomalies;
  }

  /**
   * Get all detected anomalies
   */
  getAnomalies(): Anomaly[] {
    return [...this.anomalies];
  }

  /**
   * Get unresolved anomalies
   */
  getUnresolvedAnomalies(): Anomaly[] {
    return this.anomalies.filter(a => !a.resolved);
  }

  /**
   * Resolve an anomaly
   */
  resolveAnomaly(anomalyId: string): boolean {
    const anomaly = this.anomalies.find(a => a.id === anomalyId);
    if (anomaly) {
      anomaly.resolved = true;
      anomaly.resolvedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Execute actions for an anomaly
   */
  async executeAnomalyActions(anomalyId: string): Promise<boolean> {
    const anomaly = this.anomalies.find(a => a.id === anomalyId);
    if (!anomaly) {
      return false;
    }
    
    for (const action of anomaly.actions || []) {
      if (!action.executed) {
        try {
          // Execute action based on type
          switch (action.type) {
            case 'notify':
              // Send notification
              console.log(`NOTIFICATION: ${action.description}`);
              break;
            case 'close_position':
              // Close position (would integrate with broker)
              console.log(`ACTION: ${action.description}`);
              break;
            case 'reduce_position':
              // Reduce position (would integrate with broker)
              console.log(`ACTION: ${action.description}`);
              break;
            case 'stop_trading':
              // Stop all trading (would integrate with trading system)
              console.log(`ACTION: ${action.description}`);
              break;
            case 'manual_review':
              // Flag for manual review
              console.log(`REVIEW: ${action.description}`);
              break;
          }
          
          action.executed = true;
          action.executedAt = new Date();
          action.result = 'Executed successfully';
        } catch (error) {
          action.result = `Execution failed: ${error}`;
          console.error(`Failed to execute action: ${action.description}`, error);
        }
      }
    }
    
    return true;
  }

  /**
   * Get anomaly statistics
   */
  getAnomalyStats(): {
    total: number;
    unresolved: number;
    byType: Record<AnomalyType, number>;
    bySeverity: Record<AnomalySeverity, number>;
  } {
    const stats = {
      total: this.anomalies.length,
      unresolved: this.anomalies.filter(a => !a.resolved).length,
      byType: {} as Record<AnomalyType, number>,
      bySeverity: {} as Record<AnomalySeverity, number>
    };
    
    // Initialize counters
    Object.values(AnomalyType).forEach(type => {
      stats.byType[type] = 0;
    });
    
    Object.values(AnomalySeverity).forEach(severity => {
      stats.bySeverity[severity] = 0;
    });
    
    // Count anomalies
    for (const anomaly of this.anomalies) {
      stats.byType[anomaly.type]++;
      stats.bySeverity[anomaly.severity]++;
    }
    
    return stats;
  }
}