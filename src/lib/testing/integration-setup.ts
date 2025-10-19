/**
 * Integration Test Setup File
 * 
 * This file contains the setup for integration tests.
 * It includes database setup, external service mocking, and test data preparation.
 */

import { jest } from '@jest/globals';

// Set up integration test timeout
jest.setTimeout(60000);

// Mock external services that are not being tested
jest.mock('../../realtime/pusher-service', () => ({
  pusherService: {
    trigger: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn()
  }
}));

// Mock database transaction manager
jest.mock('../../database/transaction-manager', () => ({
  transactionManager: {
    executeInTransaction: jest.fn(),
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn()
  }
}));

// Set up test database
beforeAll(async () => {
  // Initialize test database
  // This would typically involve running migrations and seeding test data
  console.log('Setting up integration test environment');
});

// Clean up test database
afterAll(async () => {
  // Clean up test database
  // This would typically involve dropping test data or tables
  console.log('Cleaning up integration test environment');
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Set up integration test utilities
(global as any).integrationTestUtils = {
  // Helper function to create a test user
  createTestUser: (overrides: any = {}) => {
    return {
      id: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'USER',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  },
  
  // Helper function to create test broker credentials
  createTestBrokerCredentials: (overrides: any = {}) => {
    return {
      login: 12345678,
      password: 'testpassword',
      server: 'MetaQuotes-Demo',
      timeout: 30000,
      ...overrides
    };
  },
  
  // Helper function to create test trade signal
  createTestTradeSignal: (overrides: any = {}) => {
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
      ...overrides
    };
  }
};

export default (global as any).integrationTestUtils;