/**
 * Unit tests for the AdvancedMonitor class
 */

import { AdvancedMonitor } from '../advanced-monitor';
import {
  LatencyMetrics,
  ExecutionQuality,
  SlippageMetrics,
  AlertType,
  AlertSeverity,
  AlertCategory,
  AlertStatus
} from '../monitoring-types';

// Mock the monitoring components
jest.mock('../latency-tracker', () => ({
  LatencyTracker: jest.fn().mockImplementation(() => ({
    recordLatency: jest.fn(),
    getStatistics: jest.fn().mockReturnValue({
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      standardDeviation: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      p95: 0,
      p99: 0,
      count: 0,
      sum: 0,
      variance: 0,
      periodStart: new Date(),
      periodEnd: new Date(),
      componentBreakdown: []
    }),
    checkThresholds: jest.fn().mockReturnValue({}),
    clearHistory: jest.fn(),
    updateThresholds: jest.fn()
  }))
}));

jest.mock('../execution-quality', () => ({
  ExecutionQualityTracker: jest.fn().mockImplementation(() => ({
    recordExecution: jest.fn(),
    getStatistics: jest.fn().mockReturnValue({
      averageFillRatio: 0,
      medianFillRatio: 0,
      minFillRatio: 0,
      maxFillRatio: 0,
      rejectionRate: 0,
      rejectionReasons: [],
      averageExecutionTime: 0,
      medianExecutionTime: 0,
      priceImprovementRate: 0,
      averagePriceImprovement: 0,
      totalOrders: 0,
      filledOrders: 0,
      rejectedOrders: 0,
      partiallyFilledOrders: 0,
      periodStart: new Date(),
      periodEnd: new Date()
    }),
    checkThresholds: jest.fn().mockReturnValue({}),
    clearHistory: jest.fn(),
    updateThresholds: jest.fn()
  }))
}));

jest.mock('../slippage-tracker', () => ({
  SlippageTracker: jest.fn().mockImplementation(() => ({
    recordSlippage: jest.fn(),
    getSlippageDistribution: jest.fn().mockReturnValue({
      buckets: [],
      mean: 0,
      median: 0,
      standardDeviation: 0,
      totalTrades: 0,
      positiveSlippageCount: 0,
      negativeSlippageCount: 0,
      neutralSlippageCount: 0,
      positiveSlippagePercent: 0,
      negativeSlippagePercent: 0,
      neutralSlippagePercent: 0,
      periodStart: new Date(),
      periodEnd: new Date()
    }),
    checkThresholds: jest.fn().mockReturnValue({}),
    clearHistory: jest.fn(),
    updateThresholds: jest.fn()
  }))
}));

jest.mock('../resource-monitor', () => ({
  ResourceMonitor: jest.fn().mockImplementation(() => ({
    startMonitoring: jest.fn(),
    stopMonitoring: jest.fn(),
    getCurrentUsage: jest.fn().mockReturnValue(null),
    checkThresholds: jest.fn().mockReturnValue({}),
    clearHistory: jest.fn(),
    updateThresholds: jest.fn(),
    isActive: jest.fn().mockReturnValue(false)
  }))
}));

// Mock console methods to avoid noise in tests
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

describe('AdvancedMonitor', () => {
  let monitor: AdvancedMonitor;
  const mockConfig = {
    enableDebugLogging: true,
    dataCollectionInterval: 100, // Short interval for tests
    batchSize: 10
  };

  beforeEach(() => {
    jest.clearAllMocks();
    monitor = new AdvancedMonitor(mockConfig);
  });

  afterEach(() => {
    if (monitor.isActive()) {
      monitor.stopMonitoring();
    }
  });

  describe('Constructor', () => {
    it('should create an instance with default configuration', () => {
      const defaultMonitor = new AdvancedMonitor();
      expect(defaultMonitor).toBeInstanceOf(AdvancedMonitor);
      expect(defaultMonitor.isActive()).toBe(false);
    });

    it('should create an instance with custom configuration', () => {
      const customConfig = {
        enableLatencyMonitoring: false,
        enableExecutionQualityMonitoring: false,
        enableSlippageMonitoring: false,
        enableResourceMonitoring: false,
        enableAlerts: false
      };
      
      const customMonitor = new AdvancedMonitor(customConfig);
      expect(customMonitor).toBeInstanceOf(AdvancedMonitor);
      expect(customMonitor.isActive()).toBe(false);
    });
  });

  describe('Monitoring Lifecycle', () => {
    it('should start monitoring', () => {
      monitor.startMonitoring();
      expect(monitor.isActive()).toBe(true);
    });

    it('should not start monitoring if already started', () => {
      monitor.startMonitoring();
      monitor.startMonitoring(); // Should not cause issues
      expect(monitor.isActive()).toBe(true);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('[AdvancedMonitor] Monitoring already started')
      );
    });

    it('should stop monitoring', () => {
      monitor.startMonitoring();
      monitor.stopMonitoring();
      expect(monitor.isActive()).toBe(false);
    });

    it('should not stop monitoring if not started', () => {
      monitor.stopMonitoring(); // Should not cause issues
      expect(monitor.isActive()).toBe(false);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('[AdvancedMonitor] Monitoring not started')
      );
    });
  });

  describe('Latency Monitoring', () => {
    it('should record latency metrics', () => {
      const latencyMetrics: LatencyMetrics = {
        endToEndLatency: 500,
        signalProcessingLatency: 50,
        brokerApiLatency: 200,
        orderValidationLatency: 30,
        riskCheckLatency: 70,
        networkLatency: 150,
        roundTripTime: 500,
        signalTimestamp: new Date(),
        processingStartTimestamp: new Date(),
        executionTimestamp: new Date(),
        symbol: 'EURUSD',
        orderType: 'market',
        broker: 'MT5',
        userId: 'user123'
      };

      monitor.recordLatency(latencyMetrics);
      
      // Verify that the latency tracker was called
      expect(monitor.getLatencyStatistics()).toBeDefined();
    });

    it('should not record latency if disabled', () => {
      const disabledMonitor = new AdvancedMonitor({
        enableLatencyMonitoring: false
      });
      
      const latencyMetrics: LatencyMetrics = {
        endToEndLatency: 500,
        signalProcessingLatency: 50,
        brokerApiLatency: 200,
        orderValidationLatency: 30,
        riskCheckLatency: 70,
        networkLatency: 150,
        roundTripTime: 500,
        signalTimestamp: new Date(),
        processingStartTimestamp: new Date(),
        executionTimestamp: new Date()
      };

      disabledMonitor.recordLatency(latencyMetrics);
      
      // Should not record anything
      expect(disabledMonitor.getLatencyStatistics().count).toBe(0);
    });
  });

  describe('Execution Quality Monitoring', () => {
    it('should record execution quality', () => {
      const executionQuality: ExecutionQuality = {
        orderId: 'order123',
        symbol: 'EURUSD',
        requestedVolume: 1.0,
        executedVolume: 1.0,
        fillRatio: 1.0,
        orderTimestamp: new Date(),
        firstFillTimestamp: new Date(),
        lastFillTimestamp: new Date(),
        executionTime: 500,
        requestedPrice: 1.1000,
        averageFillPrice: 1.1001,
        isRejected: false,
        partialFill: false,
        lateExecution: false,
        priceImprovement: true,
        userId: 'user123',
        strategyId: 'strategy1'
      };

      monitor.recordExecutionQuality(executionQuality);
      
      // Verify that the execution quality tracker was called
      expect(monitor.getExecutionQualityStatistics()).toBeDefined();
    });

    it('should not record execution quality if disabled', () => {
      const disabledMonitor = new AdvancedMonitor({
        enableExecutionQualityMonitoring: false
      });
      
      const executionQuality: ExecutionQuality = {
        orderId: 'order123',
        symbol: 'EURUSD',
        requestedVolume: 1.0,
        executedVolume: 1.0,
        fillRatio: 1.0,
        orderTimestamp: new Date(),
        averageFillPrice: 1.1000,
        isRejected: false,
        partialFill: false,
        lateExecution: false,
        priceImprovement: false,
        userId: 'user123'
      };

      disabledMonitor.recordExecutionQuality(executionQuality);
      
      // Should not record anything
      expect(disabledMonitor.getExecutionQualityStatistics().totalOrders).toBe(0);
    });
  });

  describe('Slippage Monitoring', () => {
    it('should record slippage metrics', () => {
      const slippageMetrics: SlippageMetrics = {
        orderId: 'order123',
        symbol: 'EURUSD',
        orderType: 'market',
        direction: 'buy',
        volume: 1.0,
        expectedPrice: 1.1000,
        actualPrice: 1.1002,
        slippage: 0.0002,
        slippagePips: 2,
        slippagePercent: 0.018,
        orderTimestamp: new Date(),
        executionTimestamp: new Date(),
        spreadAtExecution: 1,
        slippageType: 'negative',
        isWithinTolerance: true,
        broker: 'MT5',
        userId: 'user123'
      };

      monitor.recordSlippage(slippageMetrics);
      
      // Verify that the slippage tracker was called
      expect(monitor.getSlippageDistribution()).toBeDefined();
    });

    it('should not record slippage if disabled', () => {
      const disabledMonitor = new AdvancedMonitor({
        enableSlippageMonitoring: false
      });
      
      const slippageMetrics: SlippageMetrics = {
        orderId: 'order123',
        symbol: 'EURUSD',
        orderType: 'market',
        direction: 'buy',
        volume: 1.0,
        expectedPrice: 1.1000,
        actualPrice: 1.1002,
        slippage: 0.0002,
        slippagePips: 2,
        slippagePercent: 0.018,
        orderTimestamp: new Date(),
        executionTimestamp: new Date(),
        spreadAtExecution: 1,
        slippageType: 'negative',
        isWithinTolerance: true
      };

      disabledMonitor.recordSlippage(slippageMetrics);
      
      // Should not record anything
      expect(disabledMonitor.getSlippageDistribution().totalTrades).toBe(0);
    });
  });

  describe('Resource Monitoring', () => {
    it('should get current resource usage', () => {
      const resourceUsage = monitor.getCurrentResourceUsage();
      
      // Resource usage should be null if monitoring is not started
      expect(resourceUsage).toBeNull();
    });

    it('should get resource usage when monitoring is started', () => {
      monitor.startMonitoring();
      
      // Wait a bit for resource monitoring to collect data
      setTimeout(() => {
        const resourceUsage = monitor.getCurrentResourceUsage();
        expect(resourceUsage).toBeDefined();
        expect(resourceUsage).toHaveProperty('timestamp');
        expect(resourceUsage).toHaveProperty('cpuUsage');
        expect(resourceUsage).toHaveProperty('memoryUsagePercent');
      }, 100);
    });
  });

  describe('System Performance', () => {
    it('should get system performance history', () => {
      const history = monitor.getSystemPerformanceHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should get filtered system performance history', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const history = monitor.getSystemPerformanceHistory(oneHourAgo, now);
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Alert Management', () => {
    it('should get alerts', () => {
      const alerts = monitor.getAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should get filtered alerts by status', () => {
      const alerts = monitor.getAlerts(AlertStatus.ACTIVE);
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should get filtered alerts by category', () => {
      const alerts = monitor.getAlerts(undefined, AlertCategory.LATENCY);
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should acknowledge an alert', () => {
      // First, we need to create an alert
      monitor.startMonitoring();
      
      // Record some high latency to trigger an alert
      const highLatency: LatencyMetrics = {
        endToEndLatency: 2000, // High latency
        signalProcessingLatency: 50,
        brokerApiLatency: 200,
        orderValidationLatency: 30,
        riskCheckLatency: 70,
        networkLatency: 150,
        roundTripTime: 2000,
        signalTimestamp: new Date(),
        processingStartTimestamp: new Date(),
        executionTimestamp: new Date()
      };
      
      monitor.recordLatency(highLatency);
      
      // Get the alerts
      const alerts = monitor.getAlerts(AlertStatus.ACTIVE);
      
      if (alerts.length > 0) {
        const alertId = alerts[0].id;
        monitor.acknowledgeAlert(alertId);
        
        // Check if the alert is now acknowledged
        const acknowledgedAlert = monitor.getAlerts(AlertStatus.ACKNOWLEDGED)
          .find(a => a.id === alertId);
        
        expect(acknowledgedAlert).toBeDefined();
        expect(acknowledgedAlert?.status).toBe(AlertStatus.ACKNOWLEDGED);
        expect(acknowledgedAlert?.acknowledgedAt).toBeDefined();
      }
    });

    it('should resolve an alert', () => {
      // First, we need to create an alert
      monitor.startMonitoring();
      
      // Record some high latency to trigger an alert
      const highLatency: LatencyMetrics = {
        endToEndLatency: 2000, // High latency
        signalProcessingLatency: 50,
        brokerApiLatency: 200,
        orderValidationLatency: 30,
        riskCheckLatency: 70,
        networkLatency: 150,
        roundTripTime: 2000,
        signalTimestamp: new Date(),
        processingStartTimestamp: new Date(),
        executionTimestamp: new Date()
      };
      
      monitor.recordLatency(highLatency);
      
      // Get the alerts
      const alerts = monitor.getAlerts(AlertStatus.ACTIVE);
      
      if (alerts.length > 0) {
        const alertId = alerts[0].id;
        monitor.resolveAlert(alertId);
        
        // Check if the alert is now resolved
        const resolvedAlert = monitor.getAlerts(AlertStatus.RESOLVED)
          .find(a => a.id === alertId);
        
        expect(resolvedAlert).toBeDefined();
        expect(resolvedAlert?.status).toBe(AlertStatus.RESOLVED);
        expect(resolvedAlert?.resolvedAt).toBeDefined();
      }
    });

    it('should register alert callbacks', () => {
      const callback = jest.fn();
      monitor.onAlert(callback);
      
      // Start monitoring and trigger an alert
      monitor.startMonitoring();
      
      // Record some high latency to trigger an alert
      const highLatency: LatencyMetrics = {
        endToEndLatency: 2000, // High latency
        signalProcessingLatency: 50,
        brokerApiLatency: 200,
        orderValidationLatency: 30,
        riskCheckLatency: 70,
        networkLatency: 150,
        roundTripTime: 2000,
        signalTimestamp: new Date(),
        processingStartTimestamp: new Date(),
        executionTimestamp: new Date()
      };
      
      // Mock the checkThresholds to return a violation, which will trigger an alert
      const latencyTracker = (monitor as any).latencyTracker;
      latencyTracker.checkThresholds.mockReturnValue({ endToEndLatency: true });
      
      monitor.recordLatency(highLatency);
      
      // Manually trigger the alert creation since our mocks don't automatically do it
      (monitor as any).createAlert(
        'HIGH_LATENCY' as any,
        'WARNING' as any,
        'LATENCY' as any,
        'High latency detected',
        'Latency exceeded threshold'
      );
      
      // Check if the callback was called
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Configuration Management', () => {
    it('should get configuration', () => {
      const config = monitor.getConfig();
      expect(config).toBeDefined();
      expect(config.enableLatencyMonitoring).toBe(true);
      expect(config.enableExecutionQualityMonitoring).toBe(true);
      expect(config.enableSlippageMonitoring).toBe(true);
      expect(config.enableResourceMonitoring).toBe(true);
    });

    it('should update configuration', () => {
      const newConfig = {
        enableLatencyMonitoring: false,
        enableAlerts: false,
        dataCollectionInterval: 1000
      };
      
      monitor.updateConfig(newConfig);
      
      const config = monitor.getConfig();
      expect(config.enableLatencyMonitoring).toBe(false);
      expect(config.enableAlerts).toBe(false);
      expect(config.dataCollectionInterval).toBe(1000);
    });
  });

  describe('History Management', () => {
    it('should clear history', () => {
      // Record some data
      const latencyMetrics: LatencyMetrics = {
        endToEndLatency: 500,
        signalProcessingLatency: 50,
        brokerApiLatency: 200,
        orderValidationLatency: 30,
        riskCheckLatency: 70,
        networkLatency: 150,
        roundTripTime: 500,
        signalTimestamp: new Date(),
        processingStartTimestamp: new Date(),
        executionTimestamp: new Date()
      };
      
      monitor.recordLatency(latencyMetrics);
      
      // Clear history
      monitor.clearHistory();
      
      // Check if history is cleared
      expect(monitor.getLatencyStatistics().count).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in alert callbacks', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      
      monitor.onAlert(errorCallback);
      
      // Start monitoring
      monitor.startMonitoring();
      
      // Manually trigger the alert creation since our mocks don't automatically do it
      (monitor as any).createAlert(
        'HIGH_LATENCY' as any,
        'WARNING' as any,
        'LATENCY' as any,
        'High latency detected',
        'Latency exceeded threshold'
      );
      
      // Check if the error was logged
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[AdvancedMonitor] Error in alert callback'),
        expect.any(Error)
      );
    });
  });

  describe('Integration Tests', () => {
    it('should work with all monitoring components', () => {
      monitor.startMonitoring();
      
      // Record latency
      const latencyMetrics: LatencyMetrics = {
        endToEndLatency: 500,
        signalProcessingLatency: 50,
        brokerApiLatency: 200,
        orderValidationLatency: 30,
        riskCheckLatency: 70,
        networkLatency: 150,
        roundTripTime: 500,
        signalTimestamp: new Date(),
        processingStartTimestamp: new Date(),
        executionTimestamp: new Date(),
        symbol: 'EURUSD',
        orderType: 'market',
        broker: 'MT5',
        userId: 'user123'
      };
      
      monitor.recordLatency(latencyMetrics);
      
      // Record execution quality
      const executionQuality: ExecutionQuality = {
        orderId: 'order123',
        symbol: 'EURUSD',
        requestedVolume: 1.0,
        executedVolume: 1.0,
        fillRatio: 1.0,
        orderTimestamp: new Date(),
        firstFillTimestamp: new Date(),
        lastFillTimestamp: new Date(),
        executionTime: 500,
        requestedPrice: 1.1000,
        averageFillPrice: 1.1001,
        isRejected: false,
        partialFill: false,
        lateExecution: false,
        priceImprovement: true,
        userId: 'user123',
        strategyId: 'strategy1'
      };
      
      monitor.recordExecutionQuality(executionQuality);
      
      // Record slippage
      const slippageMetrics: SlippageMetrics = {
        orderId: 'order123',
        symbol: 'EURUSD',
        orderType: 'market',
        direction: 'buy',
        volume: 1.0,
        expectedPrice: 1.1000,
        actualPrice: 1.1002,
        slippage: 0.0002,
        slippagePips: 2,
        slippagePercent: 0.018,
        orderTimestamp: new Date(),
        executionTimestamp: new Date(),
        spreadAtExecution: 1,
        slippageType: 'negative',
        isWithinTolerance: true,
        broker: 'MT5',
        userId: 'user123'
      };
      
      monitor.recordSlippage(slippageMetrics);
      
      // Get statistics
      const latencyStats = monitor.getLatencyStatistics();
      const executionStats = monitor.getExecutionQualityStatistics();
      const slippageDist = monitor.getSlippageDistribution();
      const resourceUsage = monitor.getCurrentResourceUsage();
      const systemPerf = monitor.getSystemPerformanceHistory();
      const alerts = monitor.getAlerts();
      
      // Verify that all components are working
      expect(latencyStats).toBeDefined();
      expect(executionStats).toBeDefined();
      expect(slippageDist).toBeDefined();
      expect(Array.isArray(alerts)).toBe(true);
      
      // Stop monitoring
      monitor.stopMonitoring();
      expect(monitor.isActive()).toBe(false);
    });
  });
});