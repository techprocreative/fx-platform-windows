/**
 * Unit tests for the Position Monitor system
 */

import { PositionMonitor } from '../position-monitor';
import { PnLCalculator } from '../pnl-calculator';
import { AnomalyDetector } from '../anomaly-detector';
import { 
  MonitoredPosition, 
  MonitoringConfig, 
  AnomalyType, 
  AnomalySeverity,
  PositionEvent,
  AlertType 
} from '../types';
import { IBrokerConnector } from '../../brokers/mt5-connector';
import { Position, SymbolInfo, AccountInfo } from '../../brokers/types';

// Mock broker connector
const mockBrokerConnector: jest.Mocked<IBrokerConnector> = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  isConnected: jest.fn(),
  getAccountInfo: jest.fn(),
  openPosition: jest.fn(),
  closePosition: jest.fn(),
  modifyPosition: jest.fn(),
  getSymbolInfo: jest.fn(),
  getCurrentPrice: jest.fn(),
  getOpenPositions: jest.fn(),
  getOrderHistory: jest.fn(),
  onConnectionEvent: jest.fn(),
  getLastError: jest.fn()
};

// Mock position data
const mockPosition: Position = {
  ticket: 12345,
  symbol: 'EURUSD',
  type: 0, // Buy
  volume: 0.1,
  priceOpen: 1.1000,
  priceCurrent: 1.1050,
  priceSL: 1.0950,
  priceTP: 1.1150,
  swap: 0,
  profit: 50,
  comment: 'Test position',
  openTime: new Date('2023-01-01T10:00:00Z'),
  expiration: new Date('2023-12-31T23:59:59Z'),
  magic: 123,
  commission: 0.5,
  storage: 0,
  identifier: 12345
};

// Mock symbol info
const mockSymbolInfo: SymbolInfo = {
  symbol: 'EURUSD',
  description: 'EUR/USD',
  base: 'EUR',
  quote: 'USD',
  type: 'FOREX',
  digits: 5,
  point: 0.00001,
  tickValue: 1,
  tickSize: 0.00001,
  contractSize: 100000,
  volumeMin: 0.01,
  volumeMax: 100,
  volumeStep: 0.01,
  spread: 2,
  swapLong: -0.5,
  swapShort: 0.2,
  starting: 0,
  expiration: 0,
  tradeMode: 3,
  currencyBase: 'EUR',
  currencyProfit: 'USD',
  currencyMargin: 'USD',
  marginHedged: 0,
  marginInitial: 1000,
  marginMaintenance: 500,
  sessionOpen: 0,
  sessionClose: 0
};

// Mock account info
const mockAccountInfo: AccountInfo = {
  login: 123456,
  server: 'Demo-Server',
  currency: 'USD',
  balance: 10000,
  equity: 10500,
  margin: 500,
  freeMargin: 9500,
  marginLevel: 2100,
  leverage: 100,
  profit: 500,
  marginFree: 9500,
  marginUsed: 500,
  name: 'Test Account',
  stopoutMode: 0,
  stopoutLevel: 20,
  tradeAllowed: true,
  tradeExpert: true
};

describe('PositionMonitor', () => {
  let positionMonitor: PositionMonitor;
  let testConfig: MonitoringConfig;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Test configuration
    testConfig = {
      positionUpdateInterval: 100,
      priceUpdateInterval: 50,
      pnlUpdateInterval: 200,
      priceSpikeThreshold: 5.0,
      volumeThreshold: 3.0,
      drawdownThreshold: 10.0,
      marginCallThreshold: 20.0,
      maxPositionAge: 24 * 60 * 60 * 1000,
      enablePriceHistory: true,
      priceHistorySize: 100,
      enableAlerts: true,
      alertChannels: [],
      maxRiskPerPosition: 2.0,
      maxTotalRisk: 10.0,
      emergencyStop: false,
      enableLogging: false, // Disable logging for tests
      logLevel: 'info'
    };
    
    // Create position monitor instance
    positionMonitor = new PositionMonitor(testConfig);
    positionMonitor.setBrokerConnector(mockBrokerConnector);
    
    // Setup default mock returns
    mockBrokerConnector.isConnected.mockReturnValue(true);
    mockBrokerConnector.getOpenPositions.mockResolvedValue([mockPosition]);
    mockBrokerConnector.getSymbolInfo.mockResolvedValue(mockSymbolInfo);
    mockBrokerConnector.getCurrentPrice.mockResolvedValue({
      bid: 1.1048,
      ask: 1.1052
    });
    mockBrokerConnector.getAccountInfo.mockResolvedValue(mockAccountInfo);
  });

  afterEach(() => {
    // Stop monitoring to clean up intervals
    positionMonitor.stopMonitoring();
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      const monitor = new PositionMonitor();
      const status = monitor.getStatus();
      
      expect(status.active).toBe(false);
      expect(status.positionsMonitored).toBe(0);
      expect(status.anomaliesDetected).toBe(0);
      expect(status.alertsTriggered).toBe(0);
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        positionUpdateInterval: 2000,
        enableAlerts: false,
        priceSpikeThreshold: 10.0
      };
      
      const monitor = new PositionMonitor(customConfig);
      monitor.updateConfig(customConfig);
      
      // We can't directly access the config, but we can test its effects
      expect(monitor).toBeDefined();
    });
  });

  describe('Broker Connector', () => {
    it('should set broker connector', () => {
      positionMonitor.setBrokerConnector(mockBrokerConnector);
      expect(mockBrokerConnector).toBeDefined();
    });
  });

  describe('Position Subscription', () => {
    it('should subscribe to position updates', () => {
      const callback = jest.fn();
      const subscriptionId = positionMonitor.subscribeToPositions('user123', callback);
      
      expect(subscriptionId).toBeDefined();
      expect(subscriptionId).toMatch(/^sub_user123_\d+$/);
    });

    it('should unsubscribe from position updates', () => {
      const callback = jest.fn();
      const subscriptionId = positionMonitor.subscribeToPositions('user123', callback);
      
      const result = positionMonitor.unsubscribeFromPositions(subscriptionId);
      expect(result).toBe(true);
    });

    it('should return false when unsubscribing non-existent subscription', () => {
      const result = positionMonitor.unsubscribeFromPositions('non-existent');
      expect(result).toBe(false);
    });

    it('should filter positions by symbol when specified', async () => {
      const callback = jest.fn();
      const eurPosition = { ...mockPosition, symbol: 'EURUSD' };
      const gbpPosition = { ...mockPosition, symbol: 'GBPUSD', ticket: 12346 };
      
      mockBrokerConnector.getOpenPositions.mockResolvedValue([eurPosition, gbpPosition]);
      
      positionMonitor.subscribeToPositions('user123', callback, ['EURUSD']);
      await positionMonitor.startMonitoring();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ symbol: 'EURUSD' })
        ])
      );
      
      // Should not include GBPUSD
      expect(callback).not.toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ symbol: 'GBPUSD' })
        ])
      );
    });
  });

  describe('Monitoring Control', () => {
    it('should start monitoring', async () => {
      await positionMonitor.startMonitoring();
      
      const status = positionMonitor.getStatus();
      expect(status.active).toBe(true);
      expect(status.startTime).toBeDefined();
    });

    it('should stop monitoring', async () => {
      await positionMonitor.startMonitoring();
      positionMonitor.stopMonitoring();
      
      const status = positionMonitor.getStatus();
      expect(status.active).toBe(false);
    });

    it('should not start monitoring if already active', async () => {
      await positionMonitor.startMonitoring();
      const status1 = positionMonitor.getStatus();
      
      await positionMonitor.startMonitoring();
      const status2 = positionMonitor.getStatus();
      
      expect(status1.active).toBe(true);
      expect(status2.active).toBe(true);
      expect(status1.startTime).toEqual(status2.startTime);
    });
  });

  describe('Position Updates', () => {
    it('should update positions from broker', async () => {
      await positionMonitor.startMonitoring();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const positions = positionMonitor.getMonitoredPositions();
      expect(positions).toHaveLength(1);
      expect(positions[0].ticket).toBe(mockPosition.ticket);
      expect(positions[0].symbol).toBe(mockPosition.symbol);
    });

    it('should calculate P&L for positions', async () => {
      await positionMonitor.startMonitoring();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const positions = positionMonitor.getMonitoredPositions();
      expect(positions[0].unrealizedPnL).toBeDefined();
      expect(positions[0].totalPnL).toBeDefined();
      expect(positions[0].marginUsed).toBeDefined();
    });

    it('should handle position updates with errors', async () => {
      mockBrokerConnector.getOpenPositions.mockRejectedValue(new Error('Connection error'));
      
      await positionMonitor.startMonitoring();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const status = positionMonitor.getStatus();
      expect(status.errors.length).toBeGreaterThan(0);
      expect(status.errors[0].message).toBe('Failed to update positions');
    });
  });

  describe('P&L Calculation', () => {
    it('should calculate real-time P&L report', async () => {
      await positionMonitor.startMonitoring();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const pnlReport = positionMonitor.calculateRealtimePnL('USD', 10000, 10500);
      
      expect(pnlReport.totalUnrealizedPnL).toBeDefined();
      expect(pnlReport.totalRealizedPnL).toBeDefined();
      expect(pnlReport.totalPnL).toBeDefined();
      expect(pnlReport.positions).toHaveLength(1);
      expect(pnlReport.currency).toBe('USD');
      expect(pnlReport.accountBalance).toBe(10000);
      expect(pnlReport.accountEquity).toBe(10500);
    });
  });

  describe('Stop Loss/Take Profit Monitoring', () => {
    it('should detect stop loss hit', async () => {
      // Create a position where stop loss is hit
      const positionWithSLHit = {
        ...mockPosition,
        priceCurrent: 1.0949, // Below stop loss
        priceSL: 1.0950
      };
      
      mockBrokerConnector.getOpenPositions.mockResolvedValue([positionWithSLHit]);
      
      await positionMonitor.startMonitoring();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const positions = positionMonitor.getMonitoredPositions();
      expect(positions[0].alerts).toBeDefined();
      expect(positions[0].alerts!.some(alert => alert.type === AlertType.STOP_LOSS_APPROACHING)).toBe(true);
    });

    it('should detect take profit hit', async () => {
      // Create a position where take profit is hit
      const positionWithTPHit = {
        ...mockPosition,
        priceCurrent: 1.1151, // Above take profit
        priceTP: 1.1150
      };
      
      mockBrokerConnector.getOpenPositions.mockResolvedValue([positionWithTPHit]);
      
      await positionMonitor.startMonitoring();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const positions = positionMonitor.getMonitoredPositions();
      expect(positions[0].alerts).toBeDefined();
      expect(positions[0].alerts!.some(alert => alert.type === AlertType.TAKE_PROFIT_APPROACHING)).toBe(true);
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect price spike anomalies', async () => {
      // Create a position with significant price change
      const positionWithPriceSpike = {
        ...mockPosition,
        priceCurrent: 1.1600 // 5% increase from open price
      };
      
      mockBrokerConnector.getOpenPositions.mockResolvedValue([positionWithPriceSpike]);
      
      await positionMonitor.startMonitoring();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const anomalies = positionMonitor.getAnomalies();
      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies.some(a => a.type === AnomalyType.PRICE_SPIKE)).toBe(true);
    });

    it('should detect margin call risk', async () => {
      // Create a position with high drawdown
      const positionWithMarginRisk = {
        ...mockPosition,
        priceCurrent: 1.0800, // Significant loss
        marginUsed: 1000,
        totalPnL: -200
      };
      
      mockBrokerConnector.getOpenPositions.mockResolvedValue([positionWithMarginRisk]);
      
      await positionMonitor.startMonitoring();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const anomalies = positionMonitor.getAnomalies();
      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies.some(a => a.type === AnomalyType.MARGIN_CALL)).toBe(true);
    });

    it('should detect position timeout', async () => {
      // Create a very old position
      const oldPosition = {
        ...mockPosition,
        openTime: new Date('2020-01-01T10:00:00Z') // Very old
      };
      
      mockBrokerConnector.getOpenPositions.mockResolvedValue([oldPosition]);
      
      await positionMonitor.startMonitoring();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const anomalies = positionMonitor.getAnomalies();
      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies.some(a => a.type === AnomalyType.POSITION_TIMEOUT)).toBe(true);
    });
  });

  describe('Position Events', () => {
    it('should emit position open event', async () => {
      const eventCallback = jest.fn();
      positionMonitor.onPositionEvent('test', eventCallback);
      
      await positionMonitor.startMonitoring();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(eventCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'open',
          timestamp: expect.any(Date)
        })
      );
    });

    it('should emit position modify event', async () => {
      const eventCallback = jest.fn();
      positionMonitor.onPositionEvent('test', eventCallback);
      
      await positionMonitor.startMonitoring();
      
      // Wait for initial position
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Modify position
      const modifiedPosition = {
        ...mockPosition,
        priceSL: 1.0900 // Changed stop loss
      };
      
      mockBrokerConnector.getOpenPositions.mockResolvedValue([modifiedPosition]);
      
      // Wait for update
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(eventCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'modify',
          timestamp: expect.any(Date),
          data: expect.objectContaining({
            oldSL: mockPosition.priceSL,
            newSL: modifiedPosition.priceSL
          })
        })
      );
    });

    it('should emit position close event', async () => {
      const eventCallback = jest.fn();
      positionMonitor.onPositionEvent('test', eventCallback);
      
      await positionMonitor.startMonitoring();
      
      // Wait for initial position
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Close position
      mockBrokerConnector.getOpenPositions.mockResolvedValue([]);
      
      // Wait for update
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(eventCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'close',
          timestamp: expect.any(Date)
        })
      );
    });
  });

  describe('Alerts', () => {
    it('should create profit alerts', async () => {
      // Create a position with high profit
      const profitablePosition = {
        ...mockPosition,
        priceCurrent: 1.2000, // High profit
        marginUsed: 1000,
        totalPnL: 1000 // 100% profit
      };
      
      mockBrokerConnector.getOpenPositions.mockResolvedValue([profitablePosition]);
      
      await positionMonitor.startMonitoring();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const positions = positionMonitor.getMonitoredPositions();
      expect(positions[0].alerts).toBeDefined();
      expect(positions[0].alerts!.some(alert => alert.type === AlertType.POSITION_PROFIT)).toBe(true);
    });

    it('should create loss alerts', async () => {
      // Create a position with high loss
      const losingPosition = {
        ...mockPosition,
        priceCurrent: 1.0500, // High loss
        marginUsed: 1000,
        totalPnL: -500 // -50% loss
      };
      
      mockBrokerConnector.getOpenPositions.mockResolvedValue([losingPosition]);
      
      await positionMonitor.startMonitoring();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const positions = positionMonitor.getMonitoredPositions();
      expect(positions[0].alerts).toBeDefined();
      expect(positions[0].alerts!.some(alert => alert.type === AlertType.POSITION_LOSS)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle broker connection errors', async () => {
      mockBrokerConnector.isConnected.mockReturnValue(false);
      
      await positionMonitor.startMonitoring();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const status = positionMonitor.getStatus();
      expect(status.errors.length).toBeGreaterThan(0);
    });

    it('should handle symbol info errors', async () => {
      mockBrokerConnector.getSymbolInfo.mockRejectedValue(new Error('Symbol not found'));
      
      await positionMonitor.startMonitoring();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should still have positions, just without symbol info
      const positions = positionMonitor.getMonitoredPositions();
      expect(positions).toHaveLength(1);
    });

    it('should handle price update errors', async () => {
      mockBrokerConnector.getCurrentPrice.mockRejectedValue(new Error('Price not available'));
      
      await positionMonitor.startMonitoring();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should still have positions, just without price updates
      const positions = positionMonitor.getMonitoredPositions();
      expect(positions).toHaveLength(1);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration', () => {
      const newConfig = {
        priceSpikeThreshold: 10.0,
        enableAlerts: false
      };
      
      positionMonitor.updateConfig(newConfig);
      
      // We can't directly test the config change, but we can test that no errors are thrown
      expect(positionMonitor).toBeDefined();
    });
  });

  describe('Utility Methods', () => {
    it('should get position by ticket', async () => {
      await positionMonitor.startMonitoring();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const position = positionMonitor.getPosition(mockPosition.ticket);
      expect(position).toBeDefined();
      expect(position!.ticket).toBe(mockPosition.ticket);
    });

    it('should return undefined for non-existent position', async () => {
      await positionMonitor.startMonitoring();
      
      const position = positionMonitor.getPosition(99999);
      expect(position).toBeUndefined();
    });

    it('should get all anomalies', async () => {
      // Create a position with anomalies
      const positionWithAnomalies = {
        ...mockPosition,
        priceCurrent: 1.1600 // Price spike
      };
      
      mockBrokerConnector.getOpenPositions.mockResolvedValue([positionWithAnomalies]);
      
      await positionMonitor.startMonitoring();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const anomalies = positionMonitor.getAnomalies();
      expect(anomalies.length).toBeGreaterThan(0);
    });

    it('should get unresolved anomalies', async () => {
      // Create a position with anomalies
      const positionWithAnomalies = {
        ...mockPosition,
        priceCurrent: 1.1600 // Price spike
      };
      
      mockBrokerConnector.getOpenPositions.mockResolvedValue([positionWithAnomalies]);
      
      await positionMonitor.startMonitoring();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const unresolvedAnomalies = positionMonitor.getUnresolvedAnomalies();
      expect(unresolvedAnomalies.length).toBeGreaterThan(0);
    });

    it('should resolve anomaly', async () => {
      // Create a position with anomalies
      const positionWithAnomalies = {
        ...mockPosition,
        priceCurrent: 1.1600 // Price spike
      };
      
      mockBrokerConnector.getOpenPositions.mockResolvedValue([positionWithAnomalies]);
      
      await positionMonitor.startMonitoring();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const anomalies = positionMonitor.getAnomalies();
      expect(anomalies.length).toBeGreaterThan(0);
      
      const result = positionMonitor.resolveAnomaly(anomalies[0].id);
      expect(result).toBe(true);
    });
  });
});

// Integration tests with PnLCalculator
describe('PnLCalculator Integration', () => {
  let pnlCalculator: PnLCalculator;

  beforeEach(() => {
    pnlCalculator = new PnLCalculator();
    pnlCalculator.updateSymbolInfo('EURUSD', mockSymbolInfo);
  });

  it('should calculate pip value correctly', () => {
    const pipValue = pnlCalculator.calculatePipValue(mockPosition, mockPosition.priceCurrent);
    expect(pipValue).toBeGreaterThan(0);
  });

  it('should calculate pips correctly', () => {
    const pips = pnlCalculator.calculatePips(mockPosition, mockPosition.priceCurrent);
    expect(pips).toBe(500); // 50 pips for EURUSD with 5 digits
  });

  it('should calculate unrealized P&L correctly', () => {
    const unrealizedPnL = pnlCalculator.calculateUnrealizedPnL(mockPosition, mockPosition.priceCurrent);
    expect(unrealizedPnL).toBe(50); // 0.1 * (1.1050 - 1.1000) * 10000
  });

  it('should calculate total P&L correctly', () => {
    const totalPnL = pnlCalculator.calculateTotalPnL(mockPosition, mockPosition.priceCurrent);
    expect(totalPnL).toBe(50.5); // Unrealized P&L + commission
  });

  it('should convert currency correctly', () => {
    pnlCalculator.setExchangeRates({ 'EURUSD': 1.1 });
    const converted = pnlCalculator.convertCurrency(100, 'EUR', 'USD');
    expect(converted).toBe(110);
  });

  it('should calculate margin used correctly', () => {
    const marginUsed = pnlCalculator.calculateMarginUsed(mockPosition);
    expect(marginUsed).toBeGreaterThan(0);
  });
});

// Integration tests with AnomalyDetector
describe('AnomalyDetector Integration', () => {
  let anomalyDetector: AnomalyDetector;
  let testConfig: MonitoringConfig;

  beforeEach(() => {
    testConfig = {
      positionUpdateInterval: 100,
      priceUpdateInterval: 50,
      pnlUpdateInterval: 200,
      priceSpikeThreshold: 5.0,
      volumeThreshold: 3.0,
      drawdownThreshold: 10.0,
      marginCallThreshold: 20.0,
      maxPositionAge: 24 * 60 * 60 * 1000,
      enablePriceHistory: true,
      priceHistorySize: 100,
      enableAlerts: true,
      alertChannels: [],
      maxRiskPerPosition: 2.0,
      maxTotalRisk: 10.0,
      emergencyStop: false,
      enableLogging: false,
      logLevel: 'info'
    };
    
    anomalyDetector = new AnomalyDetector(testConfig);
  });

  it('should detect price spike anomaly', () => {
    const monitoredPosition: MonitoredPosition = {
      ...mockPosition,
      unrealizedPnL: 1000,
      totalPnL: 1000,
      marginUsed: 1000,
      lastUpdated: new Date(),
      priceHistory: [],
      alerts: []
    };

    // Add price history
    for (let i = 0; i < 10; i++) {
      anomalyDetector.addPricePoint('EURUSD', {
        timestamp: new Date(),
        price: 1.1000 + (i * 0.0001),
        type: 'bid'
      });
    }

    // Add current price with spike
    anomalyDetector.addPricePoint('EURUSD', {
      timestamp: new Date(),
      price: 1.1600, // 5.4% increase
      type: 'bid'
    });

    const anomalies = anomalyDetector.detectAnomalies([monitoredPosition]);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].type).toBe(AnomalyType.PRICE_SPIKE);
  });

  it('should detect unusual volume anomaly', () => {
    const monitoredPosition: MonitoredPosition = {
      ...mockPosition,
      volume: 1.0, // 10x normal volume
      unrealizedPnL: 0,
      totalPnL: 0,
      marginUsed: 1000,
      lastUpdated: new Date(),
      priceHistory: [],
      alerts: []
    };

    // Add volume history
    for (let i = 0; i < 20; i++) {
      anomalyDetector.addVolumePoint('EURUSD', 0.1);
    }

    const anomalies = anomalyDetector.detectAnomalies([monitoredPosition]);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].type).toBe(AnomalyType.UNUSUAL_VOLUME);
  });

  it('should detect margin call anomaly', () => {
    const monitoredPosition: MonitoredPosition = {
      ...mockPosition,
      unrealizedPnL: -900,
      totalPnL: -900,
      marginUsed: 1000,
      lastUpdated: new Date(),
      priceHistory: [],
      alerts: []
    };

    const anomalies = anomalyDetector.detectAnomalies([monitoredPosition]);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].type).toBe(AnomalyType.MARGIN_CALL);
  });

  it('should execute anomaly actions', async () => {
    const monitoredPosition: MonitoredPosition = {
      ...mockPosition,
      unrealizedPnL: -900,
      totalPnL: -900,
      marginUsed: 1000,
      lastUpdated: new Date(),
      priceHistory: [],
      alerts: []
    };

    const anomalies = anomalyDetector.detectAnomalies([monitoredPosition]);
    expect(anomalies.length).toBeGreaterThan(0);

    const result = await anomalyDetector.executeAnomalyActions(anomalies[0].id);
    expect(result).toBe(true);
  });
});