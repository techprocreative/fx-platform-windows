/**
 * Testing Utilities
 * 
 * This file contains common testing utilities, mock implementations,
 * and test data factories that can be used across all test suites.
 */

import { RiskParameters, TradeParams, Position, AccountInfo } from '../risk/types';
import { BrokerCredentials, MarketOrder, SymbolInfo, Position as BrokerPosition } from '../brokers/types';
import { TradeSignal, ExecutionResult } from '../trading/types';
import { ExtendedOrder, OrderParams, OrderStatus } from '../orders/types';

// Mock implementations for external dependencies
export const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

export const mockPrismaClient = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  trade: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  order: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
  $disconnect: jest.fn(),
};

export const mockPusher = {
  trigger: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
};

// Test data factories
export class TestDataFactory {
  static createTestUser(overrides: Partial<any> = {}) {
    return {
      id: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'USER',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createRiskParameters(overrides: Partial<RiskParameters> = {}): RiskParameters {
    return {
      maxRiskPerTrade: 2.0,
      maxDailyLoss: 6.0,
      maxDrawdown: 20.0,
      maxPositions: 5,
      maxLeverage: 100,
      minStopLossDistance: 10,
      maxLotSize: 10.0,
      ...overrides,
    };
  }

  static createTradeParams(overrides: Partial<TradeParams> = {}): TradeParams {
    return {
      symbol: 'EURUSD',
      type: 'BUY',
      lotSize: 0.1,
      entryPrice: 1.1000,
      stopLoss: 1.0980,
      takeProfit: 1.1020,
      userId: 'test-user-123',
      comment: 'Test trade',
      ...overrides,
    };
  }

  static createTradeSignal(overrides: Partial<TradeSignal> = {}): TradeSignal {
    return {
      id: 'test-signal-123',
      symbol: 'EURUSD',
      type: 'BUY',
      lotSize: 0.1,
      entryPrice: 1.1000,
      stopLoss: 1.0900,
      takeProfit: 1.1100,
      userId: 'test-user-456',
      strategyId: 'test-strategy-789',
      confidence: 85,
      source: 'test',
      timestamp: new Date(),
      comment: 'Test trade signal',
      ...overrides,
    };
  }

  static createExecutionResult(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
    return {
      id: 'test-execution-id',
      success: true,
      ticket: 123456,
      executionPrice: 1.1000,
      executedLotSize: 0.1,
      timestamp: new Date(),
      executionTime: 100,
      retryAttempts: 0,
      signal: this.createTradeSignal(),
      ...overrides,
    };
  }

  static createPosition(overrides: Partial<Position> = {}): Position {
    return {
      ticket: 123456,
      symbol: 'EURUSD',
      type: 'BUY',
      lotSize: 1.0,
      openPrice: 1.1000,
      currentPrice: 1.1050,
      profit: 50,
      swap: 0,
      openTime: new Date(),
      userId: 'test-user-123',
      ...overrides,
    };
  }

  static createBrokerPosition(overrides: Partial<BrokerPosition> = {}): BrokerPosition {
    return {
      ticket: 123456,
      symbol: 'EURUSD',
      type: 0, // BUY
      volume: 1.0,
      priceOpen: 1.1000,
      priceCurrent: 1.1050,
      profit: 50,
      swap: 0,
      openTime: new Date(),
      expiration: new Date(),
      comment: 'Test position',
      magic: 0,
      commission: 0,
      storage: 0,
      identifier: 0,
      ...overrides,
    };
  }

  static createAccountInfo(overrides: Partial<AccountInfo> = {}): AccountInfo {
    return {
      balance: 10000,
      equity: 10250.5,
      margin: 500,
      freeMargin: 9750.5,
      marginLevel: 205.01,
      leverage: 100,
      ...overrides,
    };
  }

  static createBrokerCredentials(overrides: Partial<BrokerCredentials> = {}): BrokerCredentials {
    return {
      login: 12345678,
      password: 'testpassword',
      server: 'MetaQuotes-Demo',
      timeout: 30000,
      ...overrides,
    };
  }

  static createMarketOrder(overrides: Partial<MarketOrder> = {}): MarketOrder {
    return {
      symbol: 'EURUSD',
      type: 0, // BUY
      volume: 0.1,
      price: 1.1000,
      sl: 1.0900,
      tp: 1.1100,
      comment: 'Test order',
      ...overrides,
    };
  }

  static createSymbolInfo(overrides: Partial<SymbolInfo> = {}): SymbolInfo {
    return {
      symbol: 'EURUSD',
      description: 'EUR/USD',
      base: 'EUR',
      quote: 'USD',
      type: 'FOREX',
      digits: 5,
      point: 0.00001,
      tickValue: 10,
      tickSize: 0.00001,
      contractSize: 100000,
      volumeMin: 0.01,
      volumeMax: 100,
      volumeStep: 0.01,
      spread: 2,
      swapLong: -0.5,
      swapShort: -0.25,
      starting: 0,
      expiration: 0,
      tradeMode: 3,
      currencyBase: 'EUR',
      currencyProfit: 'USD',
      currencyMargin: 'EUR',
      marginHedged: 0,
      marginInitial: 0,
      marginMaintenance: 0,
      sessionOpen: 0,
      sessionClose: 0,
      ...overrides,
    };
  }

  static createOrderParams(overrides: Partial<OrderParams> = {}): OrderParams {
    return {
      userId: 'test-user-123',
      symbol: 'EURUSD',
      type: 0, // BUY
      volume: 0.1,
      price: 1.1000,
      sl: 1.0980,
      tp: 1.1020,
      strategyId: 'test-strategy-789',
      comment: 'Test order',
      ...overrides,
    };
  }

  static createOrder(overrides: Partial<ExtendedOrder> = {}): ExtendedOrder {
    return {
      id: 'test-order-123',
      ticket: 123456,
      symbol: 'EURUSD',
      type: 0, // BUY
      volume: 0.1,
      priceOpen: 1.1000,
      priceSL: 1.0980,
      priceTP: 1.1020,
      state: 1, // PLACED
      status: OrderStatus.PENDING,
      userId: 'test-user-123',
      strategyId: 'test-strategy-789',
      createdAt: new Date(),
      updatedAt: new Date(),
      comment: 'Test order',
      openTime: new Date(),
      expiration: new Date(),
      magic: 0,
      commission: 0,
      storage: 0,
      identifier: 0,
      volumeCurrent: 0,
      priceCurrent: 1.1000,
      typeTime: 0,
      reason: 0,
      ...overrides,
    };
  }

  static createMultiplePositions(count: number, overrides: Partial<Position> = {}): Position[] {
    return Array.from({ length: count }, (_, i) =>
      this.createPosition({
        ticket: i + 1,
        symbol: i % 2 === 0 ? 'EURUSD' : 'GBPUSD',
        type: i % 2 === 0 ? 'BUY' : 'SELL',
        ...overrides,
      })
    );
  }

  static createMultipleBrokerPositions(count: number, overrides: Partial<BrokerPosition> = {}): BrokerPosition[] {
    return Array.from({ length: count }, (_, i) =>
      this.createBrokerPosition({
        ticket: i + 1,
        symbol: i % 2 === 0 ? 'EURUSD' : 'GBPUSD',
        type: i % 2 === 0 ? 0 : 1, // BUY or SELL
        ...overrides,
      })
    );
  }
}

// Test environment helpers
export class TestEnvironmentHelper {
  static setupMockEnvironment() {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Mock console methods to avoid noise in test output
    const originalConsole = { ...console };
    beforeAll(() => {
      console.debug = jest.fn();
      console.info = jest.fn();
      console.warn = jest.fn();
      console.error = jest.fn();
    });
    
    afterAll(() => {
      console.debug = originalConsole.debug;
      console.info = originalConsole.info;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
    });
    
    // Mock environment variables
    (process.env as any).NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
    process.env.NEXTAUTH_SECRET = 'test-secret';
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
  }

  static createMockResponse() {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  }

  static createMockRequest(overrides: any = {}) {
    return {
      body: {},
      query: {},
      params: {},
      headers: {},
      user: null,
      ...overrides,
    };
  }
}

// Performance testing utilities
export class PerformanceTestHelper {
  static async measureExecutionTime<T>(
    fn: () => Promise<T> | T,
    iterations: number = 1
  ): Promise<{ result: T; averageTime: number; totalTime: number }> {
    const results: T[] = [];
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      const result = await fn();
      const endTime = performance.now();
      
      results.push(result);
      times.push(endTime - startTime);
    }
    
    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const averageTime = totalTime / iterations;
    
    return {
      result: results[0], // Return the first result
      averageTime,
      totalTime,
    };
  }

  static async measureMemoryUsage<T>(
    fn: () => Promise<T> | T
  ): Promise<{ result: T; memoryBefore: number; memoryAfter: number; memoryUsed: number }> {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const memoryBefore = process.memoryUsage().heapUsed;
    const result = await fn();
    const memoryAfter = process.memoryUsage().heapUsed;
    const memoryUsed = memoryAfter - memoryBefore;
    
    return {
      result,
      memoryBefore,
      memoryAfter,
      memoryUsed,
    };
  }
}

// Async testing utilities
export class AsyncTestHelper {
  static async waitFor<T>(
    condition: () => T | Promise<T>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<T> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const result = await condition();
      if (result) {
        return result;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  static async waitForEvent(
    emitter: any,
    event: string,
    timeout: number = 5000
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        emitter.off(event, handler);
        reject(new Error(`Event "${event}" not emitted within ${timeout}ms`));
      }, timeout);
      
      const handler = (data: any) => {
        clearTimeout(timer);
        emitter.off(event, handler);
        resolve(data);
      };
      
      emitter.on(event, handler);
    });
  }
}

// Error testing utilities
export class ErrorTestHelper {
  static async expectError<T>(
    fn: () => Promise<T> | T,
    expectedErrorClass: new (...args: any[]) => Error = Error,
    expectedErrorMessage?: string | RegExp
  ): Promise<Error> {
    let error: Error | null = null;
    
    try {
      await fn();
    } catch (e) {
      error = e as Error;
    }
    
    expect(error).not.toBeNull();
    expect(error).toBeInstanceOf(expectedErrorClass);
    
    if (expectedErrorMessage) {
      if (typeof expectedErrorMessage === 'string') {
        expect(error!.message).toContain(expectedErrorMessage);
      } else {
        expect(error!.message).toMatch(expectedErrorMessage);
      }
    }
    
    return error!;
  }
}

// Date testing utilities
export class DateTestHelper {
  static createMockDate(dateString: string) {
    const mockDate = new Date(dateString);
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
    return mockDate;
  }

  static restoreMockDate() {
    jest.restoreAllMocks();
  }
}

// Network testing utilities
export class NetworkTestHelper {
  static createMockNetworkError(message: string = 'Network error') {
    const error = new Error(message);
    error.name = 'NetworkError';
    return error;
  }

  static createMockTimeoutError(message: string = 'Request timeout') {
    const error = new Error(message);
    error.name = 'TimeoutError';
    return error;
  }
}

// Database testing utilities
export class DatabaseTestHelper {
  static async withTransaction<T>(
    fn: (transaction: any) => Promise<T>
  ): Promise<T> {
    const mockTransaction = {
      commit: jest.fn(),
      rollback: jest.fn(),
    };
    
    try {
      const result = await fn(mockTransaction);
      mockTransaction.commit();
      return result;
    } catch (error) {
      mockTransaction.rollback();
      throw error;
    }
  }

  static createMockQueryBuilder() {
    return {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    };
  }
}

// Export all utilities for easy importing
export * from './test-utils';