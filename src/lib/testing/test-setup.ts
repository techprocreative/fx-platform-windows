/**
 * Test Setup File
 * 
 * This file contains the global setup for all test types.
 * It includes common mocks, global configurations, and test utilities.
 */

import { jest } from '@jest/globals';

// Set up global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise in test output
const originalConsole = { ...console };

beforeAll(() => {
  // Mock console methods
  console.debug = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  // Restore console methods
  console.debug = originalConsole.debug;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Set up test environment variables
(process.env as any).NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';

// Global test utilities
(global as any).testUtils = {
  // Helper function to wait for a specified time
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Helper function to generate random test data
  randomString: (length: number = 10) => {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  },
  
  // Helper function to generate random number
  randomNumber: (min: number = 0, max: number = 100) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
  
  // Helper function to create a test date
  testDate: (daysOffset: number = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date;
  }
};

// Export for use in tests
export default (global as any).testUtils;