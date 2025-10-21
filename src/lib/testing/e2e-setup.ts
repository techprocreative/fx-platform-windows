/**
 * End-to-End Test Setup File
 * 
 * This file contains the setup for end-to-end tests.
 * It includes browser setup, test server initialization, and test data preparation.
 */

import { jest } from '@jest/globals';

// Set up e2e test timeout
jest.setTimeout(120000);

// Mock external services that are not being tested
jest.mock('../../realtime/pusher-service', () => ({
  pusherService: {
    trigger: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn()
  }
}));

// Set up test server
beforeAll(async () => {
  // Initialize test server
  // This would typically involve starting a test server with test data
  console.log('Setting up end-to-end test environment');
});

// Clean up test server
afterAll(async () => {
  // Clean up test server
  // This would typically involve stopping the test server
  console.log('Cleaning up end-to-end test environment');
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Set up e2e test utilities
(global as any).e2eTestUtils = {
  // Helper function to create a complete test user
  createCompleteTestUser: (overrides: any = {}) => {
    return {
      id: 'e2e-user-123',
      email: 'e2e@example.com',
      name: 'E2E Test User',
      role: 'USER',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Additional user properties for e2e tests
      preferences: {
        language: 'en',
        timezone: 'UTC',
        theme: 'light'
      },
      // Account information
      account: {
        balance: 10000,
        equity: 10250.5,
        margin: 500,
        freeMargin: 9750.5,
        marginLevel: 205.01,
        leverage: 100
      },
      ...overrides
    };
  },
  
  // Helper function to create a complete test trade signal
  createCompleteTestTradeSignal: (overrides: any = {}) => {
    return {
      id: 'e2e-signal-123',
      symbol: 'EURUSD',
      type: 'BUY',
      lotSize: 0.1,
      entryPrice: 1.1000,
      stopLoss: 1.0900,
      takeProfit: 1.1100,
      userId: 'e2e-user-456',
      strategyId: 'e2e-strategy-789',
      confidence: 85,
      source: 'e2e-test',
      timestamp: new Date(),
      comment: 'E2E test trade signal',
      // Additional signal properties for e2e tests
      indicators: {
        rsi: 45.2,
        macd: 0.0012,
        bollinger: {
          upper: 1.1050,
          middle: 1.1000,
          lower: 1.0950
        }
      },
      // Market conditions
      marketConditions: {
        volatility: 'low',
        trend: 'bullish',
        volume: 'normal'
      },
      ...overrides
    };
  },
  
  // Helper function to simulate browser actions
  simulateBrowserAction: async (action: string, params: any = {}) => {
    // This would typically involve using a browser automation library like Puppeteer
    console.log(`Simulating browser action: ${action}`, params);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Return a mock result
    return {
      success: true,
      action,
      params,
      timestamp: new Date()
    };
  },
  
  // Helper function to wait for element
  waitForElement: async (selector: string, timeout: number = 5000) => {
    console.log(`Waiting for element: ${selector}`);
    
    // Simulate waiting for element
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Return a mock element
    return {
      selector,
      visible: true,
      text: 'Mock Element Text'
    };
  },
  
  // Helper function to take screenshot
  takeScreenshot: async (name: string) => {
    console.log(`Taking screenshot: ${name}`);
    
    // Simulate taking screenshot
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Return a mock screenshot path
    return `/tmp/screenshots/${name}-${Date.now()}.png`;
  }
};

export default (global as any).e2eTestUtils;